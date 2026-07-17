import asyncio
import logging
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from auth import get_current_user
from database import supabase
from exceptions import ApiException, BadRequestException, NotFoundException
from services.observability import track_event

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
        return date.fromisoformat(value).isoformat()
    except Exception:
        return None


def _validate_weight_date(value: Optional[str]) -> str:
    parsed = _parse_iso_date(value)
    if not parsed:
        raise BadRequestException("La fecha debe tener formato YYYY-MM-DD.")
    if parsed > _today_str():
        raise BadRequestException("No se puede registrar peso en el futuro.")
    return parsed


def _is_unique_conflict(exc: Exception) -> bool:
    code = getattr(exc, "code", None) or ""
    msg = str(exc).lower()
    return (
        code == "23505"
        or "duplicate key value" in msg
        or "unique constraint" in msg
        or "duplicate key" in msg
    )


async def _fetch_weight_by_idempotency(user_id: str, key: str) -> Optional[dict]:
    try:
        res = await asyncio.to_thread(
            lambda: supabase.table("weight_logs")
            .select("*")
            .eq("user_id", user_id)
            .eq("idempotency_key", key)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None
    except Exception as exc:
        logger.warning(f"weight idempotency lookup error: {exc}")
        return None


class WeightLogPayload(BaseModel):
    weight: float = Field(..., gt=0)
    date: Optional[str] = None
    notes: Optional[str] = None
    idempotency_key: Optional[str] = None

class WeightLogUpdatePayload(BaseModel):
    weight: Optional[float] = Field(None, gt=0)
    date: Optional[str] = None
    notes: Optional[str] = None

class ExerciseLogPayload(BaseModel):
    extracted_data: Optional[dict] = None
    exercise_name: str = Field(..., min_length=1, max_length=200)
    weight: float = Field(..., gt=0, le=999)
    reps: int = Field(..., gt=0, le=999)
    sets: int = Field(..., gt=0, le=99)
    rpe: int = Field(default=8, ge=1, le=10)
    date: Optional[str] = None

class FitnessSyncPayload(BaseModel):
    steps: Optional[int] = None
    calories_burned: Optional[float] = None
    distance_km: Optional[float] = None
    active_minutes: Optional[int] = None
    date: Optional[str] = None
    source: Optional[str] = "manual"

class FocusStatusPayload(BaseModel):
    focus_streak: int = Field(..., ge=0, le=36500)
    focus_best: int = Field(..., ge=0, le=36500)
    urge_count: int = Field(..., ge=0, le=1000000)
    last_check_date: Optional[str] = None


# ─── Weight ─────────────────────────────────────────────────────────────────


async def _execute_weight_query_ordered(query):
    """Ordena weight_logs por date DESC y timestamp DESC, con fallback."""
    query = query.order("date", desc=True)
    try:
        res = await asyncio.to_thread(lambda: query.order("timestamp", desc=True).execute())
        if isinstance(res.data, list):
            return res
    except Exception as exc:
        logger.warning(f"timestamp order not available for weight_logs: {exc}")
    return await asyncio.to_thread(lambda: query.execute())


@router.get("/api/v1/weight-logs")
async def list_weight_logs(user = Depends(get_current_user), limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0)):
    query = supabase.table("weight_logs").select("*").eq("user_id", user.id)
    res = await _execute_weight_query_ordered(query.range(offset, offset + limit - 1))
    return {"data": res.data or [], "limit": limit, "offset": offset}


@router.delete("/api/v1/weight-logs/{log_id}")
async def delete_weight_log(log_id: str, user = Depends(get_current_user)):
    res = await asyncio.to_thread(lambda: supabase.table("weight_logs").delete().eq("id", log_id).eq("user_id", user.id).execute())
    if not res.data:
        raise NotFoundException("Registro de peso")
    await track_event("health", "delete_weight_log", user_id=user.id, metadata={"log_id": log_id})
    return {"detail": "Registro de peso eliminado exitosamente"}


@router.put("/api/v1/weight-logs/{log_id}")
async def update_weight_log(log_id: str, payload: WeightLogUpdatePayload, user = Depends(get_current_user)):
    check = await asyncio.to_thread(lambda: supabase.table("weight_logs").select("*").eq("id", log_id).eq("user_id", user.id).limit(1).execute())
    if not check.data:
        raise NotFoundException("Registro de peso")

    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise BadRequestException("No hay campos para actualizar.")

    if "date" in data:
        data["date"] = _validate_weight_date(data["date"])

    res = await asyncio.to_thread(lambda: supabase.table("weight_logs").update(data).eq("id", log_id).eq("user_id", user.id).execute())
    if not res.data:
        raise NotFoundException("Registro de peso")
    await track_event("health", "update_weight_log", user_id=user.id, metadata={"log_id": log_id, "weight": payload.weight})
    return {"log": res.data[0]}


@router.post("/api/v1/weight")
async def add_weight(payload: WeightLogPayload, user = Depends(get_current_user)):
    log_date = _validate_weight_date(payload.date)
    idempotency_key = str(payload.idempotency_key or "").strip() or None

    insert_data = {
        "weight": payload.weight,
        "user_id": user.id,
        "date": log_date,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    if payload.notes:
        insert_data["notes"] = payload.notes
    if idempotency_key:
        insert_data["idempotency_key"] = idempotency_key

    try:
        res = await asyncio.to_thread(lambda: supabase.table("weight_logs").insert(insert_data).execute())
    except Exception as exc:
        if idempotency_key and _is_unique_conflict(exc):
            existing = await _fetch_weight_by_idempotency(user.id, idempotency_key)
            if existing:
                return existing
        logger.warning(f"weight insert failed: {exc}")
        raise ApiException(status_code=500, detail="Error al registrar el peso.")

    if not res.data:
        raise ApiException(status_code=500, detail="Error al registrar el peso.")
    await track_event("health", "add_weight_log", user_id=user.id, metadata={"weight": payload.weight, "date": log_date})
    return res.data[0]


# ─── Exercise ───────────────────────────────────────────────────────────────


async def _upsert_exercise_log(
    user_id: str,
    exercise_name: str,
    weight: float,
    reps: int,
    sets: int,
    rpe: int = 8,
    log_date: Optional[str] = None,
) -> dict:
    """Inserta un log de ejercicio y actualiza el record personal si corresponde.
    Solo mejora el record si el nuevo peso es estrictamente mayor.
    Usa condicion en DB (max_weight < nuevo_peso) para evitar race conditions."""

    res_log = await asyncio.to_thread(lambda: supabase.table("exercises_logs").insert({
        "user_id": user_id,
        "exercise_name": exercise_name,
        "weight": weight,
        "reps": reps,
        "sets": sets,
        "rpe": rpe,
        "date": log_date or _today_str(),
    }).execute())

    if weight > 0:
        res_pr = await asyncio.to_thread(
            lambda: supabase.table("personal_records").select("*")
            .eq("user_id", user_id).eq("exercise_name", exercise_name).execute()
        )
        if res_pr.data:
            current_max = float(res_pr.data[0].get("max_weight", 0))
            if weight > current_max:
                pr_id = res_pr.data[0]["id"]
                await asyncio.to_thread(
                    lambda: supabase.table("personal_records")
                    .update({"max_weight": weight, "date": datetime.now(timezone.utc).isoformat()})
                    .eq("id", pr_id)
                    .lt("max_weight", weight)
                    .execute()
                )
        else:
            await asyncio.to_thread(lambda: supabase.table("personal_records").insert({
                "user_id": user_id,
                "exercise_name": exercise_name,
                "max_weight": weight,
            }).execute())

    return res_log.data[0] if res_log.data else {}


@router.post("/api/v1/log-exercise")
async def log_exercise(payload: ExerciseLogPayload, user = Depends(get_current_user)):
    if payload.extracted_data is not None:
        try:
            validated = ExerciseLogPayload(**payload.extracted_data)
        except Exception:
            raise ApiException(status_code=422, detail="Datos de ejercicio invalidos en extracted_data")
    else:
        validated = payload

    exercise_name = validated.exercise_name
    weight = validated.weight
    reps = validated.reps
    sets = validated.sets
    rpe = validated.rpe
    log_date = validated.date

    res = await _upsert_exercise_log(user.id, exercise_name, weight, reps, sets, rpe, log_date)

    await track_event(
        "health",
        "log_exercise",
        user_id=user.id,
        metadata={"exercise_name": exercise_name, "weight": weight, "reps": reps, "sets": sets, "rpe": rpe},
    )
    return {"status": "success", "log": res}


@router.get("/api/v1/exercise-logs")
async def list_exercise_logs(user = Depends(get_current_user), limit: int = Query(50, ge=1, le=100)):
    res = await asyncio.to_thread(
        lambda: supabase.table("exercises_logs").select("*").eq("user_id", user.id)
        .order("date", desc=True).order("created_at", desc=True).limit(limit).execute()
    )
    return {"logs": res.data or []}


@router.get("/api/v1/personal-records")
async def list_personal_records(user = Depends(get_current_user)):
    res = await asyncio.to_thread(
        lambda: supabase.table("personal_records").select("*").eq("user_id", user.id)
        .order("max_weight", desc=True).limit(100).execute()
    )
    return {"records": res.data or []}


# ─── Fitness Integration ────────────────────────────────────────────────────


@router.post("/api/v1/integrations/fitness/sync")
async def fitness_sync(payload: FitnessSyncPayload, user = Depends(get_current_user)):
    from integrations.fitness import sync_fitness_data, FITNESS_FIELDS

    data = payload.model_dump(exclude_unset=True)
    data.pop("source", None)

    try:
        record = sync_fitness_data(user.id, {
            **data,
            "source": payload.source or "manual",
        })
        await track_event("health", "fitness_sync", user_id=user.id, metadata={"source": payload.source or "manual"})
        return {"status": "ok", "fitness_log": record}
    except ValueError as e:
        raise BadRequestException(str(e))
    except RuntimeError as e:
        raise ApiException(status_code=500, detail=str(e))


@router.get("/api/v1/integrations/fitness/logs")
async def fitness_logs(user = Depends(get_current_user), limit: int = 30):
    from integrations.fitness import get_fitness_logs
    return {"logs": get_fitness_logs(user.id, limit)}


@router.get("/api/v1/focus/status")
async def get_focus_status(user = Depends(get_current_user)):
    try:
        res = await asyncio.to_thread(
            lambda: supabase.table("focus_status").select("*").eq("user_id", user.id).limit(1).execute()
        )
    except Exception as e:
        logger.warning(f"focus/status GET fallback: {e}")
        return {"focus_status": None}
    if res.data and len(res.data) > 0:
        return {"focus_status": res.data[0]}
    return {"focus_status": None}


@router.put("/api/v1/focus/status")
async def upsert_focus_status(payload: FocusStatusPayload, user = Depends(get_current_user)):
    record = {
        "user_id": user.id,
        "focus_streak": payload.focus_streak,
        "focus_best": payload.focus_best,
        "urge_count": payload.urge_count,
        "last_check_date": payload.last_check_date,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        res = await asyncio.to_thread(
            lambda: supabase.table("focus_status").upsert(record, on_conflict="user_id").execute()
        )
    except Exception as e:
        logger.warning(f"focus/status PUT fallback: {e}")
        # No bloqueamos UX en cliente si esta tabla no existe en el schema.
        return {"focus_status": record}
    if not res.data:
        await track_event("health", "upsert_focus_status", user_id=user.id, metadata=record)
        return {"focus_status": record}
    await track_event("health", "upsert_focus_status", user_id=user.id, metadata=record)
    return {"focus_status": res.data[0]}
