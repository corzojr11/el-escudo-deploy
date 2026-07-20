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
            parsed = await _interpret_command(
                sub_cmd,
                user,
                trm,
                lite_profile,
                tasks,
                equipment,
                session_id=session_id,
            )
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


async def _get_proposal_by_id(user, proposal_id: str) -> dict | None:
    """Lee el estado actual de una propuesta del usuario."""
    try:
        res = await asyncio.to_thread(
            lambda: supabase.table("omni_proposals")
                .select("*")
                .eq("id", proposal_id)
                .eq("user_id", user.id)
                .limit(1)
                .execute()
        )
        return (res.data or [None])[0]
    except Exception as exc:
        logger.error(f"Error consultando propuesta {proposal_id}: {exc}")
        raise RuntimeError("No se pudo consultar la propuesta. Intenta de nuevo.")


async def _mark_proposal_expired(proposal_id: str):
    """Marca una propuesta como expirada (best effort)."""
    try:
        await asyncio.to_thread(
            lambda: supabase.table("omni_proposals")
                .update({"status": "expired"})
                .eq("id", proposal_id)
                .execute()
        )
    except Exception as exc:
        logger.warning(f"Error marcando propuesta expirada: {exc}")


async def _claim_proposal_atomically(user, proposal_id: str) -> dict | None:
    """Reclama una propuesta pending de forma atómica usando la función RPC.

    Retorna la propuesta reclamada (status='processing') o None si otra sesión
    ya la reclamó, no existe, no pertenece al usuario o expiró.
    """
    try:
        res = await asyncio.to_thread(
            lambda: supabase.rpc(
                "claim_omni_proposal",
                {"proposal_uuid": proposal_id, "user_uuid": str(user.id)},
            ).execute()
        )
        return (res.data or [None])[0]
    except Exception as exc:
        logger.error(f"Error reclamando propuesta {proposal_id}: {exc}")
        # Fallback atómico directo por si RPC no estuviera disponible
        try:
            update_res = await asyncio.to_thread(
                lambda: supabase.table("omni_proposals")
                    .update({"status": "processing", "claimed_at": datetime.now(timezone.utc).isoformat()})
                    .eq("id", proposal_id)
                    .eq("user_id", user.id)
                    .eq("status", "pending")
                    .execute()
            )
            return (update_res.data or [None])[0]
        except Exception as fallback_exc:
            logger.error(f"Fallback claim también falló: {fallback_exc}")
            raise RuntimeError("No se pudo reclamar la propuesta. Intenta de nuevo.")


async def confirm_proposal(user, proposal_id: str, session_id: str | None = None) -> dict:
    """Confirma y ejecuta una propuesta OMNI de forma atómicamente idempotente.

    Flujo:
      1. Intenta reclamar la propuesta pending -> processing de forma atómica.
      2. Si otra sesión ya la reclamó, observa el estado actual:
         - confirmed  -> devuelve already_executed=true con el resultado.
         - processing -> devuelve estado processing para que la UI espere.
         - failed/cancelled/expired -> devuelve error accionable sin ejecutar.
      3. Si esta sesión gana el claim, ejecuta los handlers y guarda
         confirmed/failed con el resultado.
      4. Ante cualquier excepción durante la ejecución, se marca como failed
         para que nunca se vuelva a reejecutar.
    """
    from services.omni_service import _persist_messages

    # 1. Claim atómico
    proposal = await _claim_proposal_atomically(user, proposal_id)

    if proposal is None:
        # No pudimos reclamar: otra sesión la tiene o no está disponible.
        # Leemos el estado real para dar una respuesta coherente.
        current = await _get_proposal_by_id(user, proposal_id)
        if not current:
            raise ValueError("Propuesta no encontrada o no pertenece a tu sesión.")

        status = current.get("status")
        if status == "confirmed":
            return {
                "kind": "result",
                "proposal_id": proposal_id,
                "already_executed": True,
                "result": current.get("result", {}),
            }
        if status == "processing":
            return {
                "kind": "processing",
                "proposal_id": proposal_id,
                "message": "La propuesta se está ejecutando en otra solicitud. Espera un momento y vuelve a intentar.",
            }
        if status == "cancelled":
            raise ValueError("La propuesta fue cancelada. Vuelve a enviar el comando si deseas continuar.")
        if status == "failed":
            raise ValueError("La propuesta falló. Vuelve a enviar el comando si deseas intentarlo de nuevo.")

        # Si está pending pero expiró, marcar como expired y devolver error accionable
        if status == "pending":
            expires_at = datetime.fromisoformat(current["expires_at"].replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > expires_at:
                await _mark_proposal_expired(proposal_id)
                raise ValueError("La propuesta expiró. Vuelve a enviar el comando para generar una nueva.")

        raise ValueError(f"La propuesta ya no puede usarse (estado: {status}).")

    # 2. Ejecutar los efectos de la propuesta (solo el claim ganador llega aquí)
    executed_actions = []
    errors = []
    total_xp = 0
    first_error = None

    try:
        for action in proposal.get("actions", []):
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

        if total_xp > 0:
            try:
                from database import award_xp
                await award_xp(user.id, total_xp)
            except Exception as xp_exc:
                logger.warning(f"Error persistiendo XP de OMNI para user {user.id}: {xp_exc}")

        # Persistir mensajes en historial
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

    except Exception as exc:
        # 3. Cualquier error inesperado durante la ejecución deja la propuesta
        #    como failed para evitar reejecuciones.
        logger.exception(f"Error inesperado ejecutando propuesta {proposal_id}: {exc}")
        try:
            await asyncio.to_thread(
                lambda: supabase.table("omni_proposals")
                    .update({
                        "status": "failed",
                        "result": {
                            "actions": [],
                            "errors": [str(exc)[:160]],
                            "xp_ganada": 0,
                            "response": "Error inesperado al ejecutar la propuesta.",
                            "success": False,
                        },
                    })
                    .eq("id", proposal_id)
                    .execute()
            )
        except Exception as update_exc:
            logger.error(f"No se pudo marcar propuesta {proposal_id} como failed: {update_exc}")
        raise RuntimeError("Error inesperado al ejecutar la propuesta. Intenta de nuevo.")


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

