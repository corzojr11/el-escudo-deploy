import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from auth import get_current_user
from database import supabase

logger = logging.getLogger("escudo")
router = APIRouter()


class LeaderboardEntry(BaseModel):
    rank: int
    player_id: str
    name: str
    level: int
    xp: int

class LeaderboardResponse(BaseModel):
    entries: list[LeaderboardEntry]
    limit: int
    offset: int
    total: int

class NearbyPlayer(BaseModel):
    rank: int
    player_id: str
    name: str
    level: int
    xp: int
    is_me: bool = False

class PersonalRankResponse(BaseModel):
    rank: int
    total_users: int
    player_id: str
    name: str
    level: int
    xp: int
    next_milestone: int
    nearby_players: list[NearbyPlayer]


@router.get("/api/v1/leaderboard/global")
async def leaderboard_global(limit: int = Query(10, ge=1, le=50), offset: int = Query(0, ge=0)):
    count = await asyncio.to_thread(
        lambda: supabase.table("profiles").select("player_id", count="exact").neq("player_id", None).execute()
    )
    total = count.count if hasattr(count, 'count') else 0

    r = await asyncio.to_thread(
        lambda: supabase.table("profiles").select("player_id, name, level, xp").neq("player_id", None).order("xp", desc=True).range(offset, offset + limit - 1).execute()
    )
    entries = []
    for i, row in enumerate(r.data or []):
        entries.append(LeaderboardEntry(
            rank=offset + i + 1,
            player_id=row.get("player_id", ""),
            name=row.get("name", "Anónimo"),
            level=row.get("level", 1),
            xp=row.get("xp", 0),
        ))

    return LeaderboardResponse(entries=entries, limit=limit, offset=offset, total=total)


@router.get("/api/v1/leaderboard/personal")
async def leaderboard_personal(user = Depends(get_current_user)):
    me = await asyncio.to_thread(
        lambda: supabase.table("profiles").select("player_id, name, level, xp").eq("user_id", user.id).single().execute()
    )
    if not me.data:
        return PersonalRankResponse(
            rank=0, total_users=0, player_id="", name="", level=1, xp=0,
            next_milestone=1000, nearby_players=[],
        )

    pid = me.data.get("player_id", "")
    my_name = me.data.get("name", "Sin nombre")
    my_level = me.data.get("level", 1)
    my_xp = me.data.get("xp", 0)
    next_ms = ((my_xp // 1000) + 1) * 1000

    higher = await asyncio.to_thread(
        lambda: supabase.table("profiles").select("player_id, name, level, xp", count="exact").neq("player_id", None).gt("xp", my_xp).execute()
    )
    rank = (higher.count if hasattr(higher, 'count') else 0) + 1

    total_r = await asyncio.to_thread(
        lambda: supabase.table("profiles").select("player_id", count="exact").neq("player_id", None).execute()
    )
    total_users = total_r.count if hasattr(total_r, 'count') else 0

    nearby = []
    offset_above = max(0, rank - 3)
    r = await asyncio.to_thread(
        lambda: supabase.table("profiles").select("player_id, name, level, xp").neq("player_id", None).order("xp", desc=True).range(offset_above, offset_above + 4).execute()
    )
    for i, row in enumerate(r.data or []):
        row_pid = row.get("player_id", "")
        nearby.append(NearbyPlayer(
            rank=offset_above + i + 1,
            player_id=row_pid,
            name=row.get("name", "Anónimo"),
            level=row.get("level", 1),
            xp=row.get("xp", 0),
            is_me=(row_pid == pid),
        ))

    return PersonalRankResponse(
        rank=rank, total_users=total_users, player_id=pid, name=my_name,
        level=my_level, xp=my_xp, next_milestone=next_ms, nearby_players=nearby,
    )
