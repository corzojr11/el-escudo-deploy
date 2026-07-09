import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from auth import get_current_user
from database import supabase
from exceptions import ApiException, NotFoundException
from trm import get_trm
from postgrest.exceptions import APIError

from services.omni_service import (
    process_single_command,
    _persist_messages,
    _check_omni_rate_limit,
    _get_daily_cost,
    DAILY_COST_LIMIT,
    split_multi_intent,
    _MUTATION_INTENTS,
)
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
    command: str
    user_profile: dict | None = None
    available_equipment: list[str] | None = None
    context_tasks: list | None = None
    session_id: str | None = None


# ─── Endpoints ──────────────────────────────────────────────────────────────


@router.post("/api/v1/process-command")
async def process_command(payload: ProcessCommandPayload, user = Depends(get_current_user)):
    _check_omni_rate_limit(user.id)
    command = payload.command
    from services.omni_service import _omni_client
    if not _omni_client:
        return {"intent": "NONE", "mensaje_sistema": "Offline", "xp_ganada": 0}

    trm = await get_trm()
    if not trm:
        return JSONResponse(status_code=503, content={"detail": "Error crítico: API de divisas inaccesible. No se puede calcular costo estricto."})

    user_prof = payload.user_profile or {}
    lite_profile = {"name": user_prof.get("name"), "goal": user_prof.get("goal")}
    equipment = payload.available_equipment or user_prof.get("equipment") or []
    tasks = [t.get("title") for t in (payload.context_tasks or [])] if payload.context_tasks else []
    session_id = payload.session_id or str(uuid.uuid4())

    sub_commands = split_multi_intent(command)
    await track_event(
        module="omni",
        event="process_command_received",
        user_id=user.id,
        metadata={
            "session_id": session_id,
            "command_length": len(command),
            "sub_commands": len(sub_commands),
        },
    )

    if len(sub_commands) == 1:
        try:
            result = await process_single_command(command, user, trm, lite_profile, tasks, equipment)
            assistant_message = (result.get("respuesta_usuario") or result.get("mensaje_sistema") or "").strip()
            await _persist_messages(user.id, session_id, [
                {"role": "user", "content": command},
                {"role": "assistant", "content": assistant_message},
            ])
            await track_event(
                module="omni",
                event="process_command_completed",
                user_id=user.id,
                metadata={
                    "session_id": session_id,
                    "intent": result.get("intent", "NONE"),
                    "multi_intent": False,
                },
            )
            return result
        except Exception as e:
            logger.error(f"OMNI Error: {e}")
            await track_event(
                module="omni",
                event="process_command_failed",
                status="error",
                user_id=user.id,
                metadata={"session_id": session_id, "error": str(e)[:160]},
            )
            return {"intent": "NONE", "mensaje_sistema": "Error en enlace neuronal.", "xp_ganada": 0, "interaction_cost_cop": 0, "current_trm": trm}

    responses = []
    mutation_count = 0
    for sub_cmd in sub_commands:
        try:
            result = await process_single_command(sub_cmd, user, trm, lite_profile, tasks, equipment)
            responses.append(result)
            if result.get("intent") in _MUTATION_INTENTS:
                mutation_count += 1
        except Exception as e:
            logger.error(f"OMNI sub-command error: {e}")
            responses.append({"intent": "NONE", "mensaje_sistema": f"Error en subcomando: {sub_cmd}", "xp_ganada": 0})

    await _persist_messages(user.id, session_id, [
        {"role": "user", "content": command},
        *[{"role": "assistant", "content": (r.get("respuesta_usuario") or r.get("mensaje_sistema") or "").strip()} for r in responses],
    ])

    if mutation_count > 1:
        await track_event(
            module="omni",
            event="process_command_multi_intent",
            user_id=user.id,
            metadata={
                "session_id": session_id,
                "sub_commands": len(sub_commands),
                "mutations": mutation_count,
                "requires_confirmation": True,
            },
        )
        return {"multi_intent": True, "actions": responses, "requires_confirmation": True}

    await track_event(
        module="omni",
        event="process_command_completed",
        user_id=user.id,
        metadata={
            "session_id": session_id,
            "multi_intent": False,
            "sub_commands": len(sub_commands),
        },
    )
    return {"multi_intent": False, "actions": responses}


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
async def list_omni_messages(user = Depends(get_current_user), limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0)):
    try:
        res = await asyncio.to_thread(
            lambda: supabase.table("omni_messages").select("*").eq("user_id", user.id).order("created_at", desc=False).range(offset, offset + limit - 1).execute()
        )
        return {"data": res.data or [], "limit": limit, "offset": offset}
    except APIError:
        return {"data": [], "limit": limit, "offset": offset}
