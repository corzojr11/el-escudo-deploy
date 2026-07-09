import asyncio
import logging
import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from auth import get_current_user
from database import supabase
from exceptions import ApiException, BadRequestException, NotFoundException
from services.observability import track_event

logger = logging.getLogger("escudo")
router = APIRouter()


class AchievementPayload(BaseModel):
    name: str

class GoalCreatePayload(BaseModel):
    name: str
    description: str = ""
    goal_type: str = "custom"
    target_value: Optional[float] = None
    unit: str = ""
    deadline: Optional[str] = None
    priority: int = 2
    config: dict = {}

class GoalUpdatePayload(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    goal_type: Optional[str] = None
    target_value: Optional[float] = None
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


@router.post("/api/v1/metrics")
async def create_metric(payload: MetricCreatePayload, user = Depends(get_current_user)):
    raw_goal_id = payload.goal_id
    if not raw_goal_id:
        raise BadRequestException("goal_id es requerido.")

    is_uuid = bool(re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', str(raw_goal_id).lower()))
    resolved_goal_id = None
    goal_info = None

    if is_uuid:
        check = await asyncio.to_thread(lambda: supabase.table("goals").select("id, goal_type, unit").eq("id", raw_goal_id).eq("user_id", user.id).limit(1).execute())
        if check.data:
            resolved_goal_id = raw_goal_id
            goal_info = check.data[0]
    else:
        s = await asyncio.to_thread(lambda: supabase.table("goals").select("id, goal_type, unit").eq("user_id", user.id).neq("status", "archived").ilike("name", f"%{raw_goal_id}%").limit(1).execute())
        if s.data:
            resolved_goal_id = s.data[0]["id"]
            goal_info = s.data[0]
        else:
            stop_words = {"de", "la", "el", "los", "las", "un", "una", "del", "en", "para", "por", "con", "mi", "tu", "su", "al"}
            keywords = [w for w in re.split(r'[\s,;.\-]+', raw_goal_id) if w.lower() not in stop_words and len(w) > 1]
            for kw in keywords:
                s = await asyncio.to_thread(lambda kw=kw: supabase.table("goals").select("id, goal_type, unit").eq("user_id", user.id).neq("status", "archived").ilike("name", f"%{kw}%").limit(1).execute())
                if s.data:
                    resolved_goal_id = s.data[0]["id"]
                    goal_info = s.data[0]
                    break

    if not resolved_goal_id:
        raise NotFoundException("Meta activa con ese nombre")

    unit = payload.unit or (goal_info.get("unit", "") if goal_info else "")
    res = await asyncio.to_thread(lambda: supabase.table("metrics").insert({
        "goal_id": resolved_goal_id,
        "user_id": user.id,
        "value": payload.value,
        "unit": unit,
        "notes": payload.notes,
        "recorded_at": payload.recorded_at or datetime.now(timezone.utc).isoformat(),
    }).execute())
    if not res.data:
        raise ApiException(status_code=500, detail="Error al insertar la métrica.")
    await track_event("goals", "create_metric", user_id=user.id, metadata={"goal_id": resolved_goal_id, "value": payload.value, "unit": unit})
    return {"metric": res.data[0]}


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
