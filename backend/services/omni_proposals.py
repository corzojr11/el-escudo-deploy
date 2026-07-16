"""Gestión de propuestas OMNI: preview, confirmación, idempotencia y auditoría."""

import asyncio
import json
import logging
import uuid
from datetime import datetime, timedelta, timezone

from database import supabase
from services.omni_service import (
    _interpret_command,
    _execute_interpreted_command,
    _MUTATION_INTENTS,
    split_multi_intent,
)

logger = logging.getLogger("escudo")

_PROPOSAL_TTL_MINUTES = 30


def _is_mutation(intent: str) -> bool:
    return intent in _MUTATION_INTENTS


def _build_preview_text(command: str, actions: list[dict]) -> str:
    lines = [f"OMNI interpretó: \"{command}\""]
    if len(actions) == 1:
        action = actions[0]
        intent = action.get("intent", "NONE")
        preview = action.get("respuesta_usuario") or action.get("mensaje_sistema") or ""
        lines.append(f"Acción propuesta: {intent.replace('_', ' ').title()}")
        if preview:
            lines.append(f"Efecto esperado: {preview}")
    else:
        lines.append(f"Se detectaron {len(actions)} acciones:")
        for idx, action in enumerate(actions, start=1):
            intent = action.get("intent", "NONE")
            preview = action.get("respuesta_usuario") or action.get("mensaje_sistema") or ""
            lines.append(f"{idx}. {intent.replace('_', ' ').title()}: {preview}")
    return "\n".join(lines)


async def create_proposal(
    user,
    session_id: str,
    command: str,
    trm: float,
    lite_profile: dict,
    tasks: list,
    equipment: list | None,
) -> dict:
    """Interpreta un comando y crea una propuesta OMNI.

    - Si es consulta pura (intent NONE), devuelve directamente la respuesta sin
      persistir propuesta.
    - Si contiene mutaciones, persiste la propuesta en `omni_proposals` con
      status='pending' y devuelve un preview para confirmación.
    """
    sub_commands = split_multi_intent(command)
    actions = []
    total_cost = 0.0

    for sub_cmd in sub_commands:
        try:
            parsed = await _interpret_command(sub_cmd, user, trm, lite_profile, tasks, equipment)
            actions.append(parsed)
            total_cost += float(parsed.get("interaction_cost_cop", 0) or 0)
        except Exception as exc:
            logger.error(f"OMNI interpretation error for sub-command '{sub_cmd}': {exc}")
            actions.append({
                "intent": "NONE",
                "extracted_data": {},
                "respuesta_usuario": "",
                "mensaje_sistema": f"No pude interpretar: {sub_cmd}",
                "xp_ganada": 0,
                "interaction_cost_cop": 0,
                "current_trm": trm,
            })

    mutation_actions = [a for a in actions if _is_mutation(a.get("intent", "NONE"))]

    # Consulta pura: no requiere confirmación
    # Actualizar costo acumulado de IA en el perfil (solo lecturas y propuestas)
    try:
        res_prof = await asyncio.to_thread(
            lambda: supabase.table("profiles").select("ai_cost_cop").eq("user_id", user.id).single().execute()
        )
        current_cost = float(res_prof.data.get("ai_cost_cop", 0) or 0) if res_prof.data else 0
        await asyncio.to_thread(
            lambda: supabase.table("profiles").update({"ai_cost_cop": current_cost + total_cost}).eq("user_id", user.id).execute()
        )
    except Exception as e:
        logger.warning(f"Error actualizando costo de OMNI para usuario {user.id}: {e}")

    if not mutation_actions:
        texts = [a.get("respuesta_usuario") or a.get("mensaje_sistema") or "" for a in actions]
        combined = "\n\n".join([t for t in texts if t.strip()])
        return {
            "kind": "response",
            "multi_intent": len(actions) > 1,
            "actions": actions,
            "response": combined or "Te leo. ¿En qué más puedo ayudarte?",
            "cost_cop": total_cost,
            "current_trm": trm,
        }

    # Mutación(es): persistir propuesta
    proposal_id = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=_PROPOSAL_TTL_MINUTES)

    # Para propósitos de preview, mostramos todas las acciones interpretadas
    preview_actions = []
    for a in actions:
        preview_actions.append({
            "intent": a.get("intent", "NONE"),
            "respuesta_usuario": a.get("respuesta_usuario", ""),
            "mensaje_sistema": a.get("mensaje_sistema", ""),
            "extracted_data": a.get("extracted_data", {}),
        })

    preview_text = _build_preview_text(command, preview_actions)

    # Persistir solo mutaciones ejecutables (evita reprocesar consultas mezcladas)
    executable_actions = [
        {
            "intent": a.get("intent", "NONE"),
            "extracted_data": a.get("extracted_data", {}),
            "respuesta_usuario": a.get("respuesta_usuario", ""),
            "mensaje_sistema": a.get("mensaje_sistema", ""),
        }
        for a in mutation_actions
    ]

    try:
        await asyncio.to_thread(
            lambda: supabase.table("omni_proposals").insert({
                "id": proposal_id,
                "user_id": user.id,
                "session_id": session_id,
                "command": command,
                "intent": executable_actions[0].get("intent", "NONE"),
                "extracted_data": executable_actions[0].get("extracted_data", {}),
                "preview_text": preview_text,
                "actions": executable_actions,
                "status": "pending",
                "cost_cop": total_cost,
                "trm": trm,
                "expires_at": expires_at.isoformat(),
            }).execute()
        )
    except Exception as exc:
        logger.error(f"Error persistiendo propuesta OMNI: {exc}")
        raise RuntimeError("No se pudo guardar la propuesta de OMNI. Intenta de nuevo.")

    return {
        "kind": "proposal",
        "proposal_id": proposal_id,
        "multi_intent": len(mutation_actions) > 1,
        "requires_confirmation": True,
        "command": command,
        "preview": preview_text,
        "actions": preview_actions,
        "cost_cop": total_cost,
        "current_trm": trm,
        "expires_at": expires_at.isoformat(),
    }


async def confirm_proposal(user, proposal_id: str, session_id: str | None = None) -> dict:
    """Confirma y ejecuta una propuesta OMNI de forma idempotente.

    - Si la propuesta ya fue confirmada, devuelve el resultado previo.
    - Si expiró, devuelve error accionable.
    - Solo el propietario puede confirmar su propuesta.
    """
    from services.omni_service import _persist_messages

    try:
        res = await asyncio.to_thread(
            lambda: supabase.table("omni_proposals")
                .select("*")
                .eq("id", proposal_id)
                .eq("user_id", user.id)
                .limit(1)
                .execute()
        )
    except Exception as exc:
        logger.error(f"Error consultando propuesta {proposal_id}: {exc}")
        raise RuntimeError("No se pudo consultar la propuesta. Intenta de nuevo.")

    if not res.data:
        raise ValueError("Propuesta no encontrada o no pertenece a tu sesión.")

    proposal = res.data[0]

    if proposal["status"] == "confirmed":
        return {
            "kind": "result",
            "proposal_id": proposal_id,
            "already_executed": True,
            "result": proposal.get("result", {}),
        }

    if proposal["status"] != "pending":
        raise ValueError(f"La propuesta ya no puede usarse (estado: {proposal['status']}).")

    expires_at = datetime.fromisoformat(proposal["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires_at:
        # Marcar como expirada
        try:
            await asyncio.to_thread(
                lambda: supabase.table("omni_proposals")
                    .update({"status": "expired"})
                    .eq("id", proposal_id)
                    .execute()
            )
        except Exception as exc:
            logger.warning(f"Error marcando propuesta expirada: {exc}")
        raise ValueError("La propuesta expiró. Vuelve a enviar el comando para generar una nueva.")

    # Ejecutar cada acción de la propuesta
    executed_actions = []
    errors = []
    total_xp = 0
    first_error = None

    for action in proposal.get("actions", []):
        # Reconstruir el res_json que handlers esperan
        res_json = {
            "intent": action.get("intent", "NONE"),
            "extracted_data": action.get("extracted_data", {}),
            "respuesta_usuario": action.get("respuesta_usuario", ""),
            "mensaje_sistema": action.get("mensaje_sistema", ""),
            "xp_ganada": 0,
            "interaction_cost_cop": 0,
            "current_trm": proposal.get("trm", 0),
        }
        try:
            executed = await _execute_interpreted_command(res_json, user)
            executed_actions.append(executed)
            total_xp += int(executed.get("xp_ganada", 0) or 0)
            if executed.get("intent") == "NONE":
                errors.append(executed.get("mensaje_sistema", "Acción no ejecutada"))
                if first_error is None:
                    first_error = errors[-1]
        except Exception as exc:
            msg = str(exc)[:160]
            logger.error(f"Error ejecutando acción OMNI {action.get('intent')}: {exc}")
            errors.append(msg)
            if first_error is None:
                first_error = msg

    texts = [a.get("respuesta_usuario") or a.get("mensaje_sistema") or "" for a in executed_actions]
    combined_text = "\n\n".join([t for t in texts if t.strip()])

    result_payload = {
        "actions": executed_actions,
        "errors": errors,
        "xp_ganada": total_xp,
        "response": combined_text or (first_error if first_error else "Procesado."),
        "success": len(errors) == 0,
    }

    status = "confirmed" if len(errors) == 0 else "failed"
    confirmed_at = datetime.now(timezone.utc).isoformat()

    try:
        await asyncio.to_thread(
            lambda: supabase.table("omni_proposals")
                .update({
                    "status": status,
                    "result": result_payload,
                    "confirmed_at": confirmed_at,
                })
                .eq("id", proposal_id)
                .execute()
        )
    except Exception as exc:
        logger.error(f"Error actualizando propuesta {proposal_id} tras ejecución: {exc}")

    # Persistir mensajes en historial (solo si hubo ejecución real)
    session_id_to_use = session_id or proposal.get("session_id") or str(uuid.uuid4())
    try:
        assistant_texts = [a.get("respuesta_usuario") or a.get("mensaje_sistema") or "" for a in executed_actions]
        assistant_content = "\n\n".join([t for t in assistant_texts if t.strip()])
        if assistant_content:
            await _persist_messages(
                user.id,
                session_id_to_use,
                [
                    {"role": "user", "content": proposal["command"]},
                    {"role": "assistant", "content": assistant_content},
                ],
            )
    except Exception as exc:
        logger.warning(f"Error persistiendo mensajes OMNI tras confirmación: {exc}")

    return {
        "kind": "result",
        "proposal_id": proposal_id,
        "already_executed": False,
        "result": result_payload,
    }


async def cancel_proposal(user, proposal_id: str) -> dict:
    """Cancela una propuesta pendiente."""
    try:
        res = await asyncio.to_thread(
            lambda: supabase.table("omni_proposals")
                .select("status")
                .eq("id", proposal_id)
                .eq("user_id", user.id)
                .limit(1)
                .execute()
        )
        if not res.data:
            raise ValueError("Propuesta no encontrada.")
        if res.data[0]["status"] != "pending":
            raise ValueError("La propuesta ya no puede cancelarse.")
        await asyncio.to_thread(
            lambda: supabase.table("omni_proposals")
                .update({"status": "cancelled"})
                .eq("id", proposal_id)
                .execute()
        )
        return {"proposal_id": proposal_id, "status": "cancelled"}
    except Exception as exc:
        logger.warning(f"Error cancelando propuesta {proposal_id}: {exc}")
        raise


