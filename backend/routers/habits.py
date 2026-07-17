import asyncio
import logging
from datetime import date as dt_date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from auth import get_current_user
from database import supabase
from exceptions import ApiException, BadRequestException, NotFoundException

logger = logging.getLogger("escudo")
router = APIRouter()


try:
    from zoneinfo import ZoneInfo
except Exception:
    ZoneInfo = None  # type: ignore


try:
    from postgrest.exceptions import APIError as PostgrestAPIError
except Exception:
    PostgrestAPIError = Exception  # type: ignore


class CreateHabitPayload(BaseModel):
    name: str
    frequency: str = "daily"

class UpdateHabitPayload(BaseModel):
    name: Optional[str] = None
    frequency: Optional[str] = None
    streak: Optional[int] = None

class ToggleHabitPayload(BaseModel):
    date: Optional[str] = None
    mark_done: Optional[bool] = None


def _bogota_now() -> datetime:
    if ZoneInfo:
        try:
            return datetime.now(ZoneInfo("America/Bogota"))
        except Exception as exc:
            logger.warning(f"No se pudo usar zona America/Bogota: {exc}")
    return datetime.now()


def _today_str() -> str:
    return _bogota_now().date().isoformat()


def _parse_iso_date(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    try:
        return dt_date.fromisoformat(value).isoformat()
    except Exception:
        return None


def _compute_streak(dates: list[str]) -> int:
    """Calcula racha de días consecutivos terminando en hoy o ayer."""
    if not dates:
        return 0
    sorted_dates = sorted(set(dates))
    today = _bogota_now().date()
    streak = 0
    current = today
    # Si hoy no está completado, empezar desde ayer
    if today.isoformat() not in sorted_dates:
        current = today - timedelta(days=1)
    for d_str in reversed(sorted_dates):
        d = dt_date.fromisoformat(d_str)
        if d == current:
            streak += 1
            current -= timedelta(days=1)
        elif d < current:
            break
    return streak


def _is_unique_conflict(exc: Exception) -> bool:
    code = getattr(exc, "code", None) or ""
    msg = str(exc).lower()
    return (
        code == "23505"
        or "duplicate key value" in msg
        or "unique constraint" in msg
        or "duplicate key" in msg
    )


async def _fetch_completions_for_habits(user_id: str, habit_ids: list[str]) -> dict[str, list[str]]:
    if not habit_ids:
        return {}
    res = await asyncio.to_thread(
        lambda: supabase.table("habit_completions")
        .select("habit_id, date")
        .in_("habit_id", habit_ids)
        .eq("user_id", user_id)
        .order("date", desc=True)
        .execute()
    )
    completions_by_habit: dict[str, list[str]] = {}
    for row in res.data or []:
        completions_by_habit.setdefault(row.get("habit_id"), []).append(row.get("date"))
    return completions_by_habit


@router.get("/api/v1/habits")
async def list_habits(user = Depends(get_current_user), limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0)):
    res = await asyncio.to_thread(
        lambda: supabase.table("habits").select("*").eq("user_id", user.id).order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    )
    habits_data = res.data or []
    if habits_data:
        habit_ids = [h["id"] for h in habits_data]
        completions_by_habit = await _fetch_completions_for_habits(user.id, habit_ids)
        for h in habits_data:
            dates = completions_by_habit.get(h["id"], [])
            h["completed_dates"] = dates
            h["streak"] = _compute_streak(dates)
    return {"data": habits_data, "limit": limit, "offset": offset}


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

    if not update_data:
        raise BadRequestException("No hay campos para actualizar.")

    res = await asyncio.to_thread(
        lambda: supabase.table("habits").update(update_data).eq("id", habit_id).eq("user_id", user.id).execute()
    )

    # Enriquecer respuesta con fechas completadas y racha calculada
    habit = res.data[0] if res.data else check.data[0]
    completions = await _fetch_completions_for_habits(user.id, [habit_id])
    dates = completions.get(habit_id, [])
    habit["completed_dates"] = dates
    habit["streak"] = _compute_streak(dates)

    return {"habit": habit}


@router.post("/api/v1/habits/{habit_id}/toggle")
async def toggle_habit(habit_id: str, payload: ToggleHabitPayload, user = Depends(get_current_user)):
    check = await asyncio.to_thread(
        lambda: supabase.table("habits").select("*").eq("id", habit_id).eq("user_id", user.id).limit(1).execute()
    )
    if not check.data:
        raise NotFoundException("Hábito")

    habit = check.data[0]
    target_date = _parse_iso_date(payload.date) or _today_str()
    mark_done = payload.mark_done if payload.mark_done is not None else True

    if mark_done:
        try:
            await asyncio.to_thread(
                lambda: supabase.table("habit_completions").insert({
                    "habit_id": habit_id,
                    "user_id": user.id,
                    "date": target_date,
                }).execute()
            )
        except Exception as exc:
            if _is_unique_conflict(exc):
                # Ya existe: idempotente
                pass
            else:
                logger.warning(f"habit toggle insert failed: {exc}")
                raise ApiException(status_code=500, detail="Error al registrar la completación.")
    else:
        await asyncio.to_thread(
            lambda: supabase.table("habit_completions").delete()
            .eq("habit_id", habit_id)
            .eq("user_id", user.id)
            .eq("date", target_date)
            .execute()
        )

    # Recompute completions + streak
    completions = await _fetch_completions_for_habits(user.id, [habit_id])
    dates = completions.get(habit_id, [])
    streak = _compute_streak(dates)

    await asyncio.to_thread(
        lambda: supabase.table("habits").update({"streak": streak}).eq("id", habit_id).eq("user_id", user.id).execute()
    )

    # XP solo si se marca hoy por primera vez
    xp_gained = 0
    today = _today_str()
    if mark_done and target_date == today:
        today_already = today in dates and len([d for d in dates if d == today]) >= 1
        # Si acabamos de insertar y no había conflict, es nuevo
        xp_gained = 10
        old_streak = habit.get("streak") or 0
        if old_streak >= 14:
            xp_gained += 15
        elif old_streak >= 7:
            xp_gained += 5
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

    habit["completed_dates"] = dates
    habit["streak"] = streak
    return {"habit": habit, "xp_gained": xp_gained}


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
