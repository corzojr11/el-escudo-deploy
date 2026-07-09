import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from auth import get_current_user
from bio import calcular_anclajes_bio, calcular_ventanas_sueno
from database import supabase
from exceptions import ApiException

logger = logging.getLogger("escudo")
router = APIRouter()


class BioSettingsPayload(BaseModel):
    chronotype: str = "intermedio"
    t_wake_target: str = "06:00"
    t_sleep_target: str = "22:30"
    cycle_duration: int = 90
    sleep_debt_hours: float = 0
    t_last_meal: Optional[str] = None
    t_last_caffeine: Optional[str] = None
    sunlight_offset: int = 30


@router.get("/api/v1/bio-settings")
async def get_bio_settings(user = Depends(get_current_user)):
    s = await asyncio.to_thread(lambda: supabase.table("user_bio_settings").select("*").eq("user_id", user.id).limit(1).execute())
    return {"bio_settings": s.data[0] if s.data else None}


@router.post("/api/v1/bio-settings")
async def upsert_bio_settings(payload: BioSettingsPayload, user = Depends(get_current_user)):
    data = {k: v for k, v in {
        "user_id": user.id,
        "chronotype": payload.chronotype,
        "t_wake_target": payload.t_wake_target,
        "t_sleep_target": payload.t_sleep_target,
        "cycle_duration": payload.cycle_duration,
        "sleep_debt_hours": payload.sleep_debt_hours,
        "t_last_meal": payload.t_last_meal,
        "t_last_caffeine": payload.t_last_caffeine,
        "sunlight_offset": payload.sunlight_offset,
    }.items() if v is not None}
    existing = await asyncio.to_thread(lambda: supabase.table("user_bio_settings").select("id").eq("user_id", user.id).limit(1).execute())
    res = await asyncio.to_thread(
        lambda: (supabase.table("user_bio_settings").update(data).eq("user_id", user.id).execute()
                 if existing.data
                 else supabase.table("user_bio_settings").insert(data).execute())
    )
    if not res.data:
        raise ApiException(status_code=500, detail="Error al guardar la configuración biológica.")
    return {"bio_settings": res.data[0]}


@router.get("/api/v1/bio-anchors")
async def get_bio_anchors(user = Depends(get_current_user)):
    s = await asyncio.to_thread(lambda: supabase.table("user_bio_settings").select("*").eq("user_id", user.id).limit(1).execute())
    settings = s.data[0] if s.data else {"t_wake_target": "06:00", "sleep_debt_hours": 0}
    wake_h, wake_m = [int(x) for x in settings["t_wake_target"].split(":")]
    debt = float(settings.get("sleep_debt_hours", 0))
    optimal = datetime.now().replace(hour=wake_h, minute=wake_m, second=0, microsecond=0)
    if debt > 0:
        optimal += timedelta(hours=min(debt, 2))
    ventanas = calcular_ventanas_sueno(optimal.hour, optimal.minute)
    anclajes = calcular_anclajes_bio(optimal.hour, optimal.minute)
    return {
        "wake_target": settings["t_wake_target"], "sleep_debt_hours": debt,
        "optimal_wake": optimal.strftime("%H:%M"), "sleep_windows": ventanas,
        "bio_anchors": anclajes,
        "message": f"Tu ventana de despertar óptima es {optimal.strftime('%H:%M')} para completar {ventanas[0]['cycles']} ciclos.",
    }
