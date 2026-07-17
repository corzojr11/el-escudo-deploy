import asyncio
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import get_current_user
from database import supabase
from exceptions import ApiException
from services.observability import track_event

logger = logging.getLogger("escudo")
router = APIRouter()


class RoutineExercisePayload(BaseModel):
    name: str = Field(..., min_length=1)
    suggestedSets: int = Field(default=3, ge=1, le=20)
    suggestedReps: str = Field(default="8-12")
    equipment: list[str] = Field(default_factory=list)
    muscles: list[str] = Field(default_factory=list)


class RoutineDayPayload(BaseModel):
    day_name: str
    exercises: list[RoutineExercisePayload] = Field(default_factory=list)
    objective: str | None = None
    estimated_minutes: int | None = Field(default=None, ge=5, le=240)
    notes: list[str] = Field(default_factory=list)
    completed_at: str | None = None


def _normalize_day_name(day_index: int, day_name: str | None = None) -> str:
    if day_name and day_name.strip():
        return day_name.strip()
    day_names = {
        0: "Domingo",
        1: "Lunes",
        2: "Martes",
        3: "Miércoles",
        4: "Jueves",
        5: "Viernes",
        6: "Sábado",
        7: "Domingo",
    }
    return day_names.get(day_index, f"Día {day_index}")


@router.get("/api/v1/routines")
async def list_routines(user = Depends(get_current_user)):
    res = await asyncio.to_thread(
        lambda: supabase.table("routines")
            .select("*")
            .eq("user_id", user.id)
            .order("day_index", desc=False)
            .execute()
    )
    return {"routines": res.data or []}


@router.put("/api/v1/routines/{day_index}")
async def upsert_routine_day(day_index: int, payload: RoutineDayPayload, user = Depends(get_current_user)):
    if day_index < 0 or day_index > 6:
        raise ApiException(status_code=400, detail="day_index inválido. Debe ser 0 (Domingo) a 6 (Sabado).")

    record = {
        "user_id": user.id,
        "day_index": day_index,
        "day_name": _normalize_day_name(day_index),
        "objective": payload.objective,
        "estimated_minutes": payload.estimated_minutes,
        "notes": payload.notes,
        "exercises": [
            {
                "name": ex.name,
                "suggestedSets": ex.suggestedSets,
                "suggestedReps": ex.suggestedReps,
                "equipment": ex.equipment,
                "muscles": ex.muscles,
            }
            for ex in payload.exercises
        ],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if payload.completed_at is not None:
        record["completed_at"] = payload.completed_at

    res = await asyncio.to_thread(
        lambda: supabase.table("routines")
            .upsert(record, on_conflict="user_id,day_index")
            .execute()
    )
    if not res.data:
        raise ApiException(status_code=500, detail="No se pudo guardar la rutina.")
    await track_event("routines", "upsert_routine_day", user_id=user.id, metadata={"day_index": day_index, "day_name": record["day_name"], "exercise_count": len(record["exercises"])})
    return {"routine": res.data[0]}


@router.post("/api/v1/routines/{day_index}/complete")
async def complete_routine_day(day_index: int, user = Depends(get_current_user)):
    if day_index < 0 or day_index > 6:
        raise ApiException(status_code=400, detail="day_index inválido. Debe ser 0 (Domingo) a 6 (Sabado).")
    current = await asyncio.to_thread(
        lambda: supabase.table("routines")
            .select("*")
            .eq("user_id", user.id)
            .eq("day_index", day_index)
            .limit(1)
            .execute()
    )
    existing = (current.data or [None])[0] or {}
    if not existing:
        raise ApiException(status_code=404, detail="Rutina no encontrada.")

    completed_at = datetime.now(timezone.utc).isoformat()
    res = await asyncio.to_thread(
        lambda: supabase.table("routines")
            .update({"completed_at": completed_at, "updated_at": completed_at})
            .eq("user_id", user.id)
            .eq("day_index", day_index)
            .execute()
    )
    if not res.data:
        raise ApiException(status_code=500, detail="No se pudo completar la rutina.")
    await track_event("routines", "complete_routine_day", user_id=user.id, metadata={"day_index": day_index})
    return {"routine": res.data[0]}


@router.delete("/api/v1/routines/{day_index}")
async def delete_routine_day(day_index: int, user = Depends(get_current_user)):
    if day_index < 0 or day_index > 6:
        raise ApiException(status_code=400, detail="day_index inválido. Debe ser 0 (Domingo) a 6 (Sabado).")
    res = await asyncio.to_thread(
        lambda: supabase.table("routines")
            .delete()
            .eq("user_id", user.id)
            .eq("day_index", day_index)
            .execute()
    )
    if not res.data:
        raise ApiException(status_code=404, detail="Rutina no encontrada.")
    await track_event("routines", "delete_routine_day", user_id=user.id, metadata={"day_index": day_index})
    return {"detail": "Rutina eliminada exitosamente"}
