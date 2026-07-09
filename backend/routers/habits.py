import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from auth import get_current_user
from database import supabase
from exceptions import ApiException, BadRequestException, NotFoundException

logger = logging.getLogger("escudo")
router = APIRouter()


class CreateHabitPayload(BaseModel):
    name: str
    frequency: str = "daily"

class UpdateHabitPayload(BaseModel):
    name: Optional[str] = None
    frequency: Optional[str] = None
    streak: Optional[int] = None
    completed_dates: Optional[list[str]] = None


@router.get("/api/v1/habits")
async def list_habits(user = Depends(get_current_user), limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0)):
    res = await asyncio.to_thread(
        lambda: supabase.table("habits").select("*").eq("user_id", user.id).order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    )
    return {"data": res.data or [], "limit": limit, "offset": offset}


@router.post("/api/v1/habits")
async def create_habit(payload: CreateHabitPayload, user = Depends(get_current_user)):
    name = payload.name.strip()
    if not name:
        raise BadRequestException("El nombre del hábito no puede estar vacío.")
    frequency = payload.frequency
    if frequency not in ("daily", "weekly"):
        raise BadRequestException("frequency debe ser 'daily' o 'weekly'.")
    res = await asyncio.to_thread(
        lambda: supabase.table("habits").insert({
            "user_id": user.id,
            "name": name,
            "frequency": frequency,
        }).execute()
    )
    if not res.data:
        raise ApiException(status_code=500, detail="Error al crear el hábito.")
    return {"habit": res.data[0]}


@router.put("/api/v1/habits/{habit_id}")
async def update_habit(habit_id: str, payload: UpdateHabitPayload, user = Depends(get_current_user)):
    check = await asyncio.to_thread(
        lambda: supabase.table("habits").select("*").eq("id", habit_id).eq("user_id", user.id).limit(1).execute()
    )
    if not check.data:
        raise NotFoundException("Hábito")
    existing = check.data[0]
    old_dates = existing.get("completed_dates") or []
    old_streak = existing.get("streak") or 0

    update_data = {}
    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise BadRequestException("El nombre del hábito no puede estar vacío.")
        update_data["name"] = name
    if payload.frequency is not None:
        if payload.frequency not in ("daily", "weekly"):
            raise BadRequestException("frequency debe ser 'daily' o 'weekly'.")
        update_data["frequency"] = payload.frequency
    if payload.streak is not None:
        update_data["streak"] = payload.streak
    if payload.completed_dates is not None:
        update_data["completed_dates"] = payload.completed_dates

    xp_gained = 0
    new_dates = payload.completed_dates
    if new_dates is not None:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        if today in new_dates and today not in old_dates:
            xp_gained = 10
            if old_streak >= 14:
                xp_gained += 15
            elif old_streak >= 7:
                xp_gained += 5

    if not update_data and xp_gained == 0:
        raise BadRequestException("No hay campos para actualizar.")

    res = await asyncio.to_thread(
        lambda: supabase.table("habits").update(update_data).eq("id", habit_id).eq("user_id", user.id).execute()
    )

    if xp_gained > 0:
        try:
            prof = await asyncio.to_thread(
                lambda: supabase.table("profiles").select("xp, level").eq("user_id", user.id).single().execute()
            )
            current_xp = (prof.data or {}).get("xp", 0) or 0
            current_level = (prof.data or {}).get("level", 0) or 1
            new_xp = current_xp + xp_gained
            next_level_xp = 1000
            new_level = current_level
            if new_xp >= next_level_xp:
                new_xp = new_xp - next_level_xp
                new_level = current_level + 1
            await asyncio.to_thread(
                lambda: supabase.table("profiles").update({"xp": new_xp, "level": new_level}).eq("user_id", user.id).execute()
            )
        except Exception as xp_e:
            logger.warning(f"Error al actualizar XP del hábito: {xp_e}")

    return {
        "habit": res.data[0] if res.data else check.data[0],
        "xp_gained": xp_gained,
    }


@router.delete("/api/v1/habits/{habit_id}")
async def delete_habit(habit_id: str, user = Depends(get_current_user)):
    check = await asyncio.to_thread(
        lambda: supabase.table("habits").select("id").eq("id", habit_id).eq("user_id", user.id).limit(1).execute()
    )
    if not check.data:
        raise NotFoundException("Hábito")
    await asyncio.to_thread(
        lambda: supabase.table("habits").delete().eq("id", habit_id).eq("user_id", user.id).execute()
    )
    return {"success": True}
