import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator

from auth import get_current_user
from database import supabase

logger = logging.getLogger("escudo")
router = APIRouter()

_ACTIVITY_TYPES = ("weight_log", "habit_check", "exercise_log", "finance_log", "omni_use", "mood_log")


class ActivityPattern(BaseModel):
    activity_type: str
    day_of_week: int
    hour_of_day: int
    frequency: int = 0
    confidence: float = 0.0
    enabled: bool = True

class ReminderToggleRequest(BaseModel):
    activity_type: str
    enabled: bool

    @field_validator("activity_type")
    @classmethod
    def valid_type(cls, v: str) -> str:
        if v not in _ACTIVITY_TYPES:
            raise ValueError(f"Tipo inválido. Válidos: {', '.join(_ACTIVITY_TYPES)}")
        return v


@router.get("/api/v1/reminders/patterns")
async def list_patterns(user=Depends(get_current_user)):
    r = await asyncio.to_thread(
        lambda: supabase.table("user_activity_patterns")
            .select("*")
            .eq("user_id", user.id)
            .order("confidence", desc=True)
            .execute()
    )
    patterns = []
    for p in (r.data or []):
        patterns.append(ActivityPattern(
            activity_type=p["activity_type"],
            day_of_week=p["day_of_week"],
            hour_of_day=p["hour_of_day"],
            frequency=p.get("frequency", 0),
            confidence=float(p.get("confidence", 0)),
            enabled=p.get("enabled", True),
        ))
    return {"patterns": patterns}


@router.post("/api/v1/reminders/toggle")
async def toggle_reminder(body: ReminderToggleRequest, user=Depends(get_current_user)):
    await asyncio.to_thread(
        lambda: supabase.table("user_activity_patterns")
            .update({"enabled": body.enabled})
            .eq("user_id", user.id)
            .eq("activity_type", body.activity_type)
            .execute()
    )
    status = "activados" if body.enabled else "desactivados"
    return {"message": f"Recordatorios de «{body.activity_type}» {status}", "enabled": body.enabled}
