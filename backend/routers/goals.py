import asyncio
import logging
import re
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from auth import get_current_user
from database import supabase
from exceptions import ApiException, BadRequestException, NotFoundException
from services.observability import track_event

logger = logging.getLogger("escudo")
router = APIRouter()


try:
    from postgrest.exceptions import APIError as PostgrestAPIError
except Exception:
    PostgrestAPIError = Exception  # type: ignore


try:
    from zoneinfo import ZoneInfo
except Exception:
    ZoneInfo = None  # type: ignore


class AchievementPayload(BaseModel):
    name: str

class GoalCreatePayload(BaseModel):
    name: str
    description: str = ""
    goal_type: str = "custom"
    target_value: Optional[float] = None
    current_value: Optional[float] = None
    unit: str = ""
    deadline: Optional[str] = None
    priority: int = 2
    config: dict = {}

class GoalUpdatePayload(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    goal_type: Optional[str] = None
    target_value: Optional[float] = None
    current_value: Optional[float] = None
    unit: Optional[str] = None
    deadline: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[int] = None
    config: Optional[dict] = None

class MetricCreatePayload(BaseModel):
    goal_id: str
    value: float
    unit: str = ""
    notes: str = ""
    recorded_at: Optional[str] = None
    date: Optional[str] = None
    idempotency_key: Optional[str] = None

class MetricUpdatePayload(BaseModel):
    value: Optional[float] = None
    unit: Optional[str] = None
    notes: Optional[str] = None
    date: Optional[str] = None
    recorded_at: Optional[str] = None


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


def _is_unique_conflict(exc: Exception) -> bool:
    code = getattr(exc, "code", None) or ""
    msg = str(exc).lower()
    return (
        code == "23505"
        or "duplicate key value" in msg
        or "unique constraint" in msg
        or "duplicate key" in msg
    )


# ─── Goals ──────────────────────────────────────────────────────────────────


@router.get("/api/v1/goals")
async def list_goals(user = Depends(get_current_user)):
    res = await asyncio.to_thread(lambda: supabase.table("goals").select("*").eq("user_id", user.id).neq("status", "archived").order("created_at", desc=True).execute())
    goals_data = res.data or []
    if goals_data:
        goal_ids = [g["id"] for g in goals_data]
        r_metrics = await asyncio.to_thread(
            lambda: supabase.table("metrics")
                .select("*")
                .in_("goal_id", goal_ids)
                .order("recorded_at", desc=True)
                .execute()
        )
        all_metrics = r_metrics.data or []
        metrics_by_goal = {}
        for m in all_metrics:
            gid = m.get("goal_id")
            metrics_by_goal.setdefault(gid, []).append(m)
        for g in goals_data:
            g["latest_metric"] = metrics_by_goal.get(g["id"], [None])[0]
    return {"goals": goals_data}


@router.post("/api/v1/goals")
async def create_goal(payload: GoalCreatePayload, user = Depends(get_current_user)):
    res = await asyncio.to_thread(lambda: supabase.table("goals").insert({
        "user_id": user.id,
        "name": payload.name,
        "description": payload.description,
        "goal_type": payload.goal_type,
        "target_value": payload.target_value,
        "unit": payload.unit,
        "deadline": payload.deadline,
        "priority": payload.priority,
        "config": payload.config,
    }).execute())
    if not res.data:
        raise ApiException(status_code=500, detail="Error al crear la meta.")
    await track_event("goals", "create_goal", user_id=user.id, metadata={"goal_id": res.data[0].get("id"), "goal_type": payload.goal_type})
    return {"goal": res.data[0]}


@router.put("/api/v1/goals/{goal_id}")
async def update_goal(goal_id: str, payload: GoalUpdatePayload, user = Depends(get_current_user)):
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise BadRequestException("No hay campos para actualizar.")
    res = await asyncio.to_thread(lambda: supabase.table("goals").update(data).eq("id", goal_id).eq("user_id", user.id).execute())
    if not res.data:
        raise NotFoundException("Goal")
    await track_event("goals", "update_goal", user_id=user.id, metadata={"goal_id": goal_id, "fields": list(data.keys())})
    return {"goal": res.data[0]}


@router.delete("/api/v1/goals/{goal_id}")
async def delete_goal(goal_id: str, user = Depends(get_current_user)):
    res = await asyncio.to_thread(lambda: supabase.table("goals").update({"status": "archived"}).eq("id", goal_id).eq("user_id", user.id).execute())
    if not res.data:
        raise NotFoundException("Goal")
    await track_event("goals", "archive_goal", user_id=user.id, metadata={"goal_id": goal_id})
    return {"status": "archived"}


@router.get("/api/v1/goals/{goal_id}/metrics")
async def list_metrics(goal_id: str, user = Depends(get_current_user), limit: int = 50):
    check = await asyncio.to_thread(lambda: supabase.table("goals").select("id").eq("id", goal_id).eq("user_id", user.id).limit(1).execute())
    if not check.data:
        raise NotFoundException("Goal")
    res = await asyncio.to_thread(lambda: supabase.table("metrics").select("*").eq("goal_id", goal_id).eq("user_id", user.id).order("recorded_at", desc=True).limit(limit).execute())
    return {"metrics": res.data or []}


async def _fetch_metric_by_idempotency(user_id: str, key: str) -> Optional[dict]:
    try:
        res = await asyncio.to_thread(
            lambda: supabase.table("metrics")
            .select("*")
            .eq("user_id", user_id)
            .eq("idempotency_key", key)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None
    except Exception as exc:
        logger.warning(f"metric idempotency lookup error: {exc}")
        return None


async def _resolve_goal_id(raw_goal_id: str, user_id: str):
    is_uuid = bool(re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', str(raw_goal_id).lower()))
    goal_info = None
    resolved_goal_id = None

    if is_uuid:
        check = await asyncio.to_thread(lambda: supabase.table("goals").select("id, goal_type, unit").eq("id", raw_goal_id).eq("user_id", user_id).limit(1).execute())
        if check.data:
            resolved_goal_id = raw_goal_id
            goal_info = check.data[0]
    else:
        s = await asyncio.to_thread(lambda: supabase.table("goals").select("id, goal_type, unit").eq("user_id", user_id).neq("status", "archived").ilike("name", f"%{raw_goal_id}%").limit(1).execute())
        if s.data:
            resolved_goal_id = s.data[0]["id"]
            goal_info = s.data[0]
        else:
            stop_words = {"de", "la", "el", "los", "las", "un", "una", "del", "en", "para", "por", "con", "mi", "tu", "su", "al"}
            keywords = [w for w in re.split(r'[\s,;.\-]+', raw_goal_id) if w.lower() not in stop_words and len(w) > 1]
            for kw in keywords:
                s = await asyncio.to_thread(lambda kw=kw: supabase.table("goals").select("id, goal_type, unit").eq("user_id", user_id).neq("status", "archived").ilike("name", f"%{kw}%").limit(1).execute())
                if s.data:
                    resolved_goal_id = s.data[0]["id"]
                    goal_info = s.data[0]
                    break

    return resolved_goal_id, goal_info


@router.post("/api/v1/metrics")
async def create_metric(payload: MetricCreatePayload, user = Depends(get_current_user)):
    raw_goal_id = payload.goal_id
    if not raw_goal_id:
        raise BadRequestException("goal_id es requerido.")

    resolved_goal_id, goal_info = await _resolve_goal_id(raw_goal_id, user.id)
    if not resolved_goal_id:
        raise NotFoundException("Meta activa con ese nombre")

    unit = payload.unit or (goal_info.get("unit", "") if goal_info else "")
    metric_date = _parse_iso_date(payload.date) or _parse_iso_date(payload.recorded_at) or _today_str()
    if metric_date > _today_str():
        raise BadRequestException("No se puede registrar progreso en el futuro.")
    recorded_at = payload.recorded_at or datetime.now(timezone.utc).isoformat()
    idempotency_key = str(payload.idempotency_key or "").strip() or None

    insert_data = {
        "goal_id": resolved_goal_id,
        "user_id": user.id,
        "value": payload.value,
        "unit": unit,
        "notes": payload.notes,
        "date": metric_date,
        "recorded_at": recorded_at,
    }
    if idempotency_key:
        insert_data["idempotency_key"] = idempotency_key

    try:
        res = await asyncio.to_thread(lambda: supabase.table("metrics").insert(insert_data).execute())
    except Exception as exc:
        if idempotency_key and _is_unique_conflict(exc):
            existing = await _fetch_metric_by_idempotency(user.id, idempotency_key)
            if existing:
                return {"metric": existing}
        logger.warning(f"metric insert failed: {exc}")
        raise ApiException(status_code=500, detail="Error al insertar la métrica.")

    if not res.data:
        raise ApiException(status_code=500, detail="Error al insertar la métrica.")

    # Mantener current_value de la meta sincronizado con la última métrica
    try:
        await asyncio.to_thread(
            lambda: supabase.table("goals").update({"current_value": payload.value}).eq("id", resolved_goal_id).eq("user_id", user.id).execute()
        )
    except Exception as exc:
        logger.warning(f"No se pudo actualizar current_value del goal: {exc}")

    await track_event("goals", "create_metric", user_id=user.id, metadata={"goal_id": resolved_goal_id, "value": payload.value, "unit": unit, "date": metric_date})
    return {"metric": res.data[0]}


@router.put("/api/v1/metrics/{metric_id}")
async def update_metric(metric_id: str, payload: MetricUpdatePayload, user = Depends(get_current_user)):
    check = await asyncio.to_thread(lambda: supabase.table("metrics").select("*").eq("id", metric_id).eq("user_id", user.id).limit(1).execute())
    if not check.data:
        raise NotFoundException("Métrica")

    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise BadRequestException("No hay campos para actualizar.")

    if "date" in data:
        metric_date = _parse_iso_date(data["date"])
        if metric_date and metric_date > _today_str():
            raise BadRequestException("No se puede registrar progreso en el futuro.")
        data["date"] = metric_date or _today_str()

    res = await asyncio.to_thread(lambda: supabase.table("metrics").update(data).eq("id", metric_id).eq("user_id", user.id).execute())
    if not res.data:
        raise NotFoundException("Métrica")

    # Re-sincronizar current_value si se cambió el valor y esta métrica es la más reciente
    if "value" in data:
        try:
            metric = res.data[0]
            goal_id = metric.get("goal_id")
            latest = await asyncio.to_thread(
                lambda: supabase.table("metrics").select("value").eq("goal_id", goal_id).order("recorded_at", desc=True).order("created_at", desc=True).limit(1).execute()
            )
            latest_value = latest.data[0].get("value") if latest.data else None
            if latest_value is not None:
                await asyncio.to_thread(
                    lambda: supabase.table("goals").update({"current_value": latest_value}).eq("id", goal_id).eq("user_id", user.id).execute()
                )
        except Exception as exc:
            logger.warning(f"No se pudo re-sincronizar current_value: {exc}")

    await track_event("goals", "update_metric", user_id=user.id, metadata={"metric_id": metric_id})
    return {"metric": res.data[0]}


@router.delete("/api/v1/metrics/{metric_id}")
async def delete_metric(metric_id: str, user = Depends(get_current_user)):
    check = await asyncio.to_thread(lambda: supabase.table("metrics").select("goal_id").eq("id", metric_id).eq("user_id", user.id).limit(1).execute())
    if not check.data:
        raise NotFoundException("Métrica")
    goal_id = check.data[0].get("goal_id")

    res = await asyncio.to_thread(lambda: supabase.table("metrics").delete().eq("id", metric_id).eq("user_id", user.id).execute())
    if not res.data:
        raise NotFoundException("Métrica")

    # Re-sincronizar current_value
    try:
        latest = await asyncio.to_thread(
            lambda: supabase.table("metrics").select("value").eq("goal_id", goal_id).order("recorded_at", desc=True).order("created_at", desc=True).limit(1).execute()
        )
        latest_value = latest.data[0].get("value") if latest.data else None
        await asyncio.to_thread(
            lambda: supabase.table("goals").update({"current_value": latest_value}).eq("id", goal_id).eq("user_id", user.id).execute()
        )
    except Exception as exc:
        logger.warning(f"No se pudo re-sincronizar current_value tras borrar métrica: {exc}")

    await track_event("goals", "delete_metric", user_id=user.id, metadata={"metric_id": metric_id})
    return {"detail": "Métrica eliminada exitosamente"}


# ─── Achievements ───────────────────────────────────────────────────────────


@router.get("/api/v1/achievements")
async def list_achievements(user = Depends(get_current_user)):
    res = await asyncio.to_thread(lambda: supabase.table("achievements").select("*").eq("user_id", user.id).order("unlocked_at", desc=True).execute())
    return {"achievements": res.data or []}


@router.post("/api/v1/achievements")
async def unlock_achievement(payload: AchievementPayload, user = Depends(get_current_user)):
    res = await asyncio.to_thread(lambda: supabase.table("achievements").upsert(
        {"user_id": user.id, "name": payload.name},
        on_conflict="user_id,name",
    ).execute())
    if not res.data:
        raise ApiException(status_code=500, detail="Error al registrar el logro.")
    await track_event("goals", "unlock_achievement", user_id=user.id, metadata={"name": payload.name})
    return {"achievement": res.data[0]}
