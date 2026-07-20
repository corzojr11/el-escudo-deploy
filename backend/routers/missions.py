import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field, model_validator

from auth import get_current_user
from database import supabase, award_xp
from exceptions import ApiException, NotFoundException

logger = logging.getLogger("escudo")
router = APIRouter()


def _bogota_now() -> datetime:
    try:
        return datetime.now(ZoneInfo("America/Bogota"))
    except Exception:
        return datetime.now()


class MissionCreatePayload(BaseModel):
    name: str
    description: Optional[str] = ""
    status: Optional[str] = Field(default="active", pattern="^(active|completed)$")
    xp_reward: Optional[int] = 0
    category: Optional[str] = "general"
    priority: Optional[str] = Field(default="medium", pattern="^(high|medium|low)$")
    scheduled_at: Optional[str] = None
    goal_id: Optional[str] = None
    progress_increment: float = Field(default=0, ge=0, le=1_000_000)


class MissionUpdatePayload(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = Field(default=None, pattern="^(active|completed)$")
    xp_reward: Optional[int] = None
    category: Optional[str] = None
    priority: Optional[str] = Field(default=None, pattern="^(high|medium|low)$")
    scheduled_at: Optional[str] = None
    goal_id: Optional[str] = None
    progress_increment: Optional[float] = Field(default=None, ge=0, le=1_000_000)


def _mission_row_from_payload(payload: MissionCreatePayload | MissionUpdatePayload) -> dict:
    return payload.model_dump(exclude_unset=True)


async def _validate_goal_for_user(goal_id: str, user_id: str) -> None:
    goal = await asyncio.to_thread(
        lambda: supabase.table("goals")
        .select("id")
        .eq("id", goal_id)
        .eq("user_id", user_id)
        .neq("status", "archived")
        .limit(1)
        .execute()
    )
    if not goal.data:
        raise ApiException(status_code=400, detail="La meta seleccionada no existe o esta archivada.")


async def _apply_mission_goal_progress(mission_id: str, user_id: str) -> Optional[dict]:
    """Apply a mission's confirmed progress exactly once through the database RPC."""
    try:
        result = await asyncio.to_thread(
            lambda: supabase.rpc(
                "apply_mission_goal_progress",
                {"p_mission_id": mission_id, "p_user_id": user_id},
            ).execute()
        )
        return result.data[0] if result.data else None
    except Exception as exc:
        logger.error("No se pudo aplicar el progreso de la mision %s: %s", mission_id, exc)
        raise ApiException(status_code=500, detail="La mision se completo, pero no se pudo actualizar su meta.")


@router.get("/api/v1/missions")
async def list_missions(
    status: Optional[str] = Query(None, pattern="^(active|completed|all)$"),
    date: Optional[str] = Query(None, pattern="^(today|upcoming)$"),
    user=Depends(get_current_user),
):
    query = supabase.table("missions").select("*").eq("user_id", user.id)
    if status and status != "all":
        query = query.eq("status", status)
    if date == "today":
        now = _bogota_now()
        start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = start_of_day + timedelta(days=1)
        query = query.gte("scheduled_at", start_of_day.isoformat()).lt("scheduled_at", end_of_day.isoformat())
    elif date == "upcoming":
        now = _bogota_now()
        end_of_today = now.replace(hour=23, minute=59, second=59, microsecond=999999)
        query = query.gt("scheduled_at", end_of_today.isoformat()).eq("status", "active")
    query = query.order("scheduled_at", desc=True, nullsfirst=False)
    res = await asyncio.to_thread(lambda: query.execute())
    return {"missions": res.data or []}


@router.post("/api/v1/missions")
async def create_mission(payload: MissionCreatePayload, user=Depends(get_current_user)):
    if payload.goal_id:
        await _validate_goal_for_user(payload.goal_id, user.id)

    row = {
        "user_id": user.id,
        "name": payload.name,
        "description": payload.description or "",
        "status": payload.status or "active",
        "xp_reward": payload.xp_reward or 0,
        "category": payload.category or "general",
        "priority": (payload.priority or "medium").lower(),
        "scheduled_at": payload.scheduled_at,
        "goal_id": payload.goal_id,
        "progress_increment": payload.progress_increment if payload.goal_id else 0,
    }
    res = await asyncio.to_thread(lambda: supabase.table("missions").insert(row).execute())
    if not res.data:
        raise ApiException(status_code=500, detail="Error al crear la misión.")
    return {"mission": res.data[0]}


@router.put("/api/v1/missions/{mission_id}")
async def update_mission(mission_id: str, payload: MissionUpdatePayload, user=Depends(get_current_user)):
    check = await asyncio.to_thread(
        lambda: supabase.table("missions")
        .select("id,status,goal_id,progress_increment,progress_applied_at")
        .eq("id", mission_id)
        .eq("user_id", user.id)
        .limit(1)
        .execute()
    )
    if not check.data:
        raise NotFoundException("Misión")

    existing = check.data[0]
    update_data = _mission_row_from_payload(payload)
    if "priority" in update_data and update_data["priority"] is not None:
        update_data["priority"] = str(update_data["priority"]).lower()
    if "description" in update_data and update_data["description"] is not None:
        update_data["description"] = str(update_data["description"])
    if "name" in update_data and update_data["name"] is not None:
        update_data["name"] = str(update_data["name"]).strip()
    if "category" in update_data and update_data["category"] is not None:
        update_data["category"] = str(update_data["category"]).strip()
    if "status" in update_data and update_data["status"] is not None:
        update_data["status"] = str(update_data["status"]).strip()
    if "scheduled_at" in update_data and update_data["scheduled_at"] is not None:
        update_data["scheduled_at"] = str(update_data["scheduled_at"]).strip() or None
    if "goal_id" in update_data and update_data["goal_id"] is not None:
        await _validate_goal_for_user(str(update_data["goal_id"]), user.id)
    if existing.get("progress_applied_at") and ("goal_id" in update_data or "progress_increment" in update_data):
        raise ApiException(
            status_code=400,
            detail="No puedes cambiar la meta o el avance de una mision que ya sumo progreso.",
        )
    update_data = {k: v for k, v in update_data.items() if v is not None or k == "goal_id"}

    if not update_data:
        raise ApiException(status_code=400, detail="No se recibieron cambios para la misión.")

    res = await asyncio.to_thread(
        lambda: supabase.table("missions").update(update_data).eq("id", mission_id).eq("user_id", user.id).execute()
    )

    goal_progress = None
    # The RPC is idempotent. Retrying after a transient error can safely finish
    # a progress update that was not confirmed on the mission yet.
    if payload.status == "completed" and not existing.get("progress_applied_at"):
        goal_progress = await _apply_mission_goal_progress(mission_id, user.id)

    new_achievement = None
    xp_result = None
    if payload.status == "completed" and existing.get("status") != "completed":
        try:
            completed = await asyncio.to_thread(
                lambda: supabase.table("missions").select("id", count="exact").eq("user_id", user.id).eq("status", "completed").execute()
            )
            count = completed.count or 0
            milestones = [
                (1, "Primeros Pasos"),
                (10, "Gran Misionero"),
                (25, "Veterano"),
                (50, "Leyenda"),
            ]
            new_achievement = None
            for threshold, name in milestones:
                if count >= threshold:
                    check = await asyncio.to_thread(
                        lambda n=name: supabase.table("achievements").select("id").eq("user_id", user.id).eq("name", n).limit(1).execute()
                    )
                    if not check.data:
                        await asyncio.to_thread(
                            lambda n=name: supabase.table("achievements").insert(
                                {"user_id": user.id, "name": n}
                            ).execute()
                        )
                        new_achievement = name
        except Exception as e:
            logger.error(f"Error al desbloquear logro para {user.id}: {e}")

        mission_xp = existing.get("xp_reward") or payload.xp_reward or 0
        if mission_xp > 0:
            xp_result = await award_xp(user.id, mission_xp)

    result = {"mission": res.data[0]}
    if goal_progress:
        result["goal_progress"] = goal_progress
    if new_achievement:
        result["new_achievement"] = new_achievement
    if xp_result:
        result["xp"] = xp_result
    return result


@router.delete("/api/v1/missions/{mission_id}")
async def delete_mission(mission_id: str, user=Depends(get_current_user)):
    check = await asyncio.to_thread(
        lambda: supabase.table("missions").select("id").eq("id", mission_id).eq("user_id", user.id).limit(1).execute()
    )
    if not check.data:
        raise NotFoundException("Misión")
    await asyncio.to_thread(lambda: supabase.table("missions").delete().eq("id", mission_id).eq("user_id", user.id).execute())
    return {"detail": "Misión eliminada exitosamente"}
