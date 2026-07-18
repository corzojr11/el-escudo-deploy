import asyncio
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Path
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from auth import get_current_user
from database import supabase
from exceptions import ApiException, NotFoundException
from trm import get_trm
from postgrest.exceptions import APIError

from services.omni_service import (
    _persist_messages,
    _check_omni_rate_limit,
    _get_daily_cost,
    DAILY_COST_LIMIT,
    _interpret_command,
)
from services.omni_proposals import create_proposal, confirm_proposal, cancel_proposal
from services.agent_service import run_agent_checks, get_patterns_insights
from services.observability import track_event

logger = logging.getLogger("escudo")
router = APIRouter()


# ─── Models ─────────────────────────────────────────────────────────────────

class OmniRecipePayload(BaseModel):
    name: str
    command_sequence: str
    description: str = ""


class ProcessCommandPayload(BaseModel):
    command: str = Field(..., min_length=1)
    user_profile: dict | None = None
    available_equipment: list[str] | None = None
    context_tasks: list | None = None
    session_id: str | None = None


class ConfirmProposalPayload(BaseModel):
    session_id: str | None = None


class ContextualAdvicePayload(BaseModel):
    section: str = Field(..., pattern="^(dashboard|omni|metas|habitos|misiones|turnos|finanzas|salud|rutinas|logros|bitacora|perfil)$")
    question: str = Field(..., min_length=3, max_length=500)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _lite_profile(payload: ProcessCommandPayload) -> dict:
    user_prof = payload.user_profile or {}
    return {"name": user_prof.get("name"), "goal": user_prof.get("goal")}


def _equipment(payload: ProcessCommandPayload, lite_profile: dict) -> list:
    return payload.available_equipment or lite_profile.get("equipment") or []


def _tasks(payload: ProcessCommandPayload) -> list:
    return [t.get("title") for t in (payload.context_tasks or [])] if payload.context_tasks else []


async def _section_snapshot(section: str, user_id: str) -> str:
    """Resumen breve y seguro para consejos de OMNI solicitados por el usuario."""
    table_fields = {
        "finanzas": ("finances", "type,amount,category,date", 5),
        "salud": ("weight_logs", "weight,date", 3),
        "misiones": ("missions", "name,status,priority", 5),
        "habitos": ("habits", "name,streak", 5),
        "turnos": ("shifts", "day,start,end", 7),
        "rutinas": ("routines", "day_name,objective,estimated_minutes", 7),
    }
    if section == "bitacora":
        try:
            result = await asyncio.to_thread(
                lambda: supabase.table("personal_entries").select("kind", count="exact").eq("user_id", user_id).execute()
            )
            return f"La bitácora tiene {result.count or 0} entradas. No se envía su contenido privado a OMNI."
        except Exception:
            return "No hay resumen disponible de la bitácora; no se envía contenido privado a OMNI."
    if section not in table_fields:
        return "No hay datos adicionales para esta sección."

    table, fields, limit = table_fields[section]
    try:
        result = await asyncio.to_thread(
            lambda: supabase.table(table).select(fields).eq("user_id", user_id).limit(limit).execute()
        )
        rows = result.data or []
        return f"Datos recientes de {section}: {rows}" if rows else f"Aún no hay datos en {section}."
    except Exception:
        return f"No hay resumen disponible de {section}."


# ─── Endpoints ──────────────────────────────────────────────────────────────


@router.post("/api/v1/process-command")
async def process_command(payload: ProcessCommandPayload, user = Depends(get_current_user)):
    _check_omni_rate_limit(user.id)

    from services.omni_service import _omni_client
    if not _omni_client:
        return {"kind": "response", "response": "Offline", "xp_ganada": 0, "interaction_cost_cop": 0}

    trm = await get_trm()
    if not trm:
        return JSONResponse(
            status_code=503,
            content={"detail": "Error crítico: API de divisas inaccesible. No se puede calcular costo estricto."},
        )

    lite_profile = _lite_profile(payload)
    equipment = _equipment(payload, lite_profile)
    tasks = _tasks(payload)
    session_id = payload.session_id or str(uuid.uuid4())

    await track_event(
        module="omni",
        event="process_command_received",
        user_id=user.id,
        metadata={
            "session_id": session_id,
            "command_length": len(payload.command),
        },
    )

    try:
        result = await create_proposal(
            user=user,
            session_id=session_id,
            command=payload.command,
            trm=trm,
            lite_profile=lite_profile,
            tasks=tasks,
            equipment=equipment,
        )
    except Exception as e:
        logger.error(f"OMNI proposal creation error: {e}")
        await track_event(
            module="omni",
            event="process_command_failed",
            status="error",
            user_id=user.id,
            metadata={"session_id": session_id, "error": str(e)[:160]},
        )
        return {
            "kind": "response",
            "response": "Error al preparar la propuesta. Intenta de nuevo.",
            "is_error": True,
            "interaction_cost_cop": 0,
            "current_trm": trm,
        }

    if result["kind"] == "response":
        # Consulta pura: persistir historial directamente
        try:
            await _persist_messages(user.id, session_id, [
                {"role": "user", "content": payload.command},
                {"role": "assistant", "content": result["response"]},
            ])
        except Exception as e:
            logger.warning(f"Error persistiendo mensaje OMNI de consulta: {e}")

        await track_event(
            module="omni",
            event="process_command_completed",
            user_id=user.id,
            metadata={
                "session_id": session_id,
                "kind": "response",
                "cost_cop": result.get("cost_cop", 0),
            },
        )

    else:
        # Mutación: se requiere confirmación
        await track_event(
            module="omni",
            event="process_command_proposal_created",
            user_id=user.id,
            metadata={
                "session_id": session_id,
                "proposal_id": result.get("proposal_id"),
                "multi_intent": result.get("multi_intent", False),
                "actions_count": len(result.get("actions", [])),
                "cost_cop": result.get("cost_cop", 0),
            },
        )

    return result


@router.post("/api/v1/omni/contextual-advice")
async def contextual_advice(payload: ContextualAdvicePayload, user=Depends(get_current_user)):
    """Genera orientación contextual sin ejecutar ni proponer mutaciones."""
    _check_omni_rate_limit(user.id)
    from services.omni_service import _omni_client
    if not _omni_client:
        return {"response": "OMNI no está disponible en este momento. Intenta de nuevo más tarde.", "cost_cop": 0}

    trm = await get_trm()
    if not trm:
        raise HTTPException(status_code=503, detail="No se pudo calcular el costo de OMNI.")

    snapshot = await _section_snapshot(payload.section, user.id)
    command = (
        f"Consulta de orientación para la sección {payload.section}. "
        "No ejecutes acciones ni afirmes que cambiaste datos. "
        f"Datos disponibles: {snapshot}. Pregunta: {payload.question.strip()}"
    )
    result = await _interpret_command(command, user, trm, {"section": payload.section}, [], [])
    response = result.get("respuesta_usuario") or result.get("mensaje_sistema") or "No pude preparar una respuesta útil ahora."
    return {"response": response, "cost_cop": result.get("interaction_cost_cop", 0)}


@router.post("/api/v1/process-command/{proposal_id}/confirm")
async def confirm_command(
    proposal_id: str = Path(..., min_length=36),
    payload: ConfirmProposalPayload | None = None,
    user = Depends(get_current_user),
):
    _check_omni_rate_limit(user.id)
    try:
        result = await confirm_proposal(user, proposal_id, payload.session_id if payload else None)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    event_name = "process_command_confirmed"
    track_metadata = {"proposal_id": proposal_id}
    if result.get("kind") == "processing":
        event_name = "process_command_processing"
        track_metadata["status"] = "processing"
    else:
        track_metadata["already_executed"] = result.get("already_executed", False)
        track_metadata["success"] = result.get("result", {}).get("success", False)

    await track_event(
        module="omni",
        event=event_name,
        user_id=user.id,
        metadata=track_metadata,
    )
    return result


@router.post("/api/v1/process-command/{proposal_id}/cancel")
async def cancel_command(
    proposal_id: str = Path(..., min_length=36),
    user = Depends(get_current_user),
):
    try:
        return await cancel_proposal(user, proposal_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api/v1/omni/agent-check")
async def agent_check(user = Depends(get_current_user)):
    result = await run_agent_checks(user.id)
    return result


@router.get("/api/v1/omni/patterns-insights")
async def patterns_insights(user = Depends(get_current_user)):
    return await get_patterns_insights(user.id)


@router.post("/api/v1/omni/recipes")
async def create_omni_recipe(payload: OmniRecipePayload, user = Depends(get_current_user)):
    res = await asyncio.to_thread(lambda: supabase.table("omni_recipes").insert({
        "user_id": user.id,
        "name": payload.name,
        "command_sequence": payload.command_sequence,
        "description": payload.description or "",
    }).execute())
    if not res.data:
        raise ApiException(status_code=500, detail="Error al crear la receta.")
    return {"recipe": res.data[0]}


@router.get("/api/v1/omni/recipes")
async def list_omni_recipes(user = Depends(get_current_user)):
    res = await asyncio.to_thread(lambda: supabase.table("omni_recipes").select("*").eq("user_id", user.id).order("created_at", desc=True).execute())
    return {"recipes": res.data or []}


@router.delete("/api/v1/omni/recipes/{recipe_id}")
async def delete_omni_recipe(recipe_id: str, user = Depends(get_current_user)):
    check = await asyncio.to_thread(lambda: supabase.table("omni_recipes").select("id").eq("id", recipe_id).eq("user_id", user.id).limit(1).execute())
    if not check.data:
        raise NotFoundException("Recipe")
    await asyncio.to_thread(lambda: supabase.table("omni_recipes").delete().eq("id", recipe_id).eq("user_id", user.id).execute())
    return {"detail": "Receta eliminada exitosamente"}


@router.get("/api/v1/omni/usage")
async def omni_usage(user = Depends(get_current_user)):
    daily_cost = _get_daily_cost(user.id)
    return {
        "daily_cost": daily_cost,
        "limit": DAILY_COST_LIMIT,
        "remaining": max(0, DAILY_COST_LIMIT - daily_cost),
    }


@router.get("/api/v1/omni/messages")
async def list_omni_messages(
    user = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    session_id: str | None = Query(None),
):
    try:
        query = supabase.table("omni_messages").select("*").eq("user_id", user.id)
        if session_id:
            query = query.eq("session_id", session_id)
        res = await asyncio.to_thread(
            lambda: query.order("created_at", desc=False).range(offset, offset + limit - 1).execute()
        )
        return {"data": res.data or [], "limit": limit, "offset": offset}
    except APIError:
        return {"data": [], "limit": limit, "offset": offset}
