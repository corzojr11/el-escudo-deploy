import asyncio
import logging

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from auth import get_current_user
from database import supabase
from exceptions import BadRequestException

logger = logging.getLogger("escudo")
router = APIRouter()


class MoodPayload(BaseModel):
    mood: int = Field(..., ge=1, le=10)
    notes: str = ""


@router.post("/api/v1/moods")
async def create_mood(payload: MoodPayload, user = Depends(get_current_user)):
    res = await asyncio.to_thread(lambda: supabase.table("moods").insert({
        "user_id": user.id,
        "mood": payload.mood,
        "notes": payload.notes,
    }).execute())
    if not res.data:
        raise BadRequestException("No se pudo registrar el estado de ánimo.")
    return {"mood": res.data[0]}


@router.get("/api/v1/moods")
async def list_moods(user = Depends(get_current_user), limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0)):
    res = await asyncio.to_thread(
        lambda: supabase.table("moods").select("*").eq("user_id", user.id).order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    )
    return {"data": res.data or [], "limit": limit, "offset": offset}
