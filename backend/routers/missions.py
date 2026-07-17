import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field, model_validator

from auth import get_current_user
from database import supabase
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


class MissionUpdatePayload(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = Field(default=None, pattern="^(active|completed)$")
    xp_reward: Optional[int] = None
    category: Optional[str] = None
    priority: Optional[str] = Field(default=None, pattern="^(high|medium|low)$")
    scheduled_at: Optional[str] = None


def _mission_row_from_payload(payload: MissionCreatePayload | MissionUpdatePayload) -> dict:
    return payload.model_dump(exclude_unset=True)


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
    query = query.order("scheduled_at", desc=True, nulls_last=True)
    res = await asyncio.to_thread(lambda: query.execute())
    return {"missions": res.data or []}


@router.post("/api/v1/missions")
async def create_mission(payload: MissionCreatePayload, user=Depends(get_current_user)):
    row = {
        "user_id": user.id,
        "name": payload.name,
        "description": payload.description or "",
        "status": payload.status or "active",
        "xp_reward": payload.xp_reward or 0,
        "category": payload.category or "general",
        "priority": (payload.priority or "medium").lower(),
        "scheduled_at": payload.scheduled_at,
    }
    res = await asyncio.to_thread(lambda: supabase.table("missions").insert(row).execute())
    if not res.data:
        raise ApiException(status_code=500, detail="Error al crear la misión.")
    return {"mission": res.data[0]}


@router.put("/api/v1/missions/{mission_id}")
async def update_mission(mission_id: str, payload: MissionUpdatePayload, user=Depends(get_current_user)):
    check = await asyncio.to_thread(
        lambda: supabase.table("missions").select("id").eq("id", mission_id).eq("user_id", user.id).limit(1).execute()
    )
    if not check.data:
        raise NotFoundException("Misión")

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
    update_data = {k: v for k, v in update_data.items() if v is not None}

    if not update_data:
        raise ApiException(status_code=400, detail="No se recibieron cambios para la misión.")

    res = await asyncio.to_thread(
        lambda: supabase.table("missions").update(update_data).eq("id", mission_id).eq("user_id", user.id).execute()
    )

    new_achievement = None
    if payload.status == "completed":
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

    result = {"mission": res.data[0]}
    if new_achievement:
        result["new_achievement"] = new_achievement
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
