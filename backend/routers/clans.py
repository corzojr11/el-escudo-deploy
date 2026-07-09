import asyncio
import logging
import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from auth import get_current_user
from database import supabase

logger = logging.getLogger("escudo")
router = APIRouter()


# ─── Helpers ──────────────────────────────────────────────────────────────

async def _get_player_id(user) -> str:
    r = await asyncio.to_thread(
        lambda: supabase.table("profiles").select("player_id").eq("user_id", user.id).single().execute()
    )
    return r.data.get("player_id", "") if r.data else ""


async def _get_player_name(player_id: str) -> str:
    r = await asyncio.to_thread(
        lambda: supabase.table("profiles").select("name").eq("player_id", player_id).maybe_single().execute()
    )
    return r.data.get("name", "Anónimo") if r.data else "Anónimo"


def _dt_now():
    return datetime.now(timezone.utc)


_TAG_PATTERN = re.compile(r"^[A-Za-z0-9]{3,4}$")
_NAME_MIN = 3
_NAME_MAX = 30


# ─── Pydantic models ──────────────────────────────────────────────────────

class ClanSummary(BaseModel):
    id: str
    name: str
    tag: Optional[str] = None
    description: Optional[str] = None
    color: str = "#00D4FF"
    total_xp: int = 0
    member_count: int = 1
    max_members: int = 20

class ClanMember(BaseModel):
    player_id: str
    name: str = ""
    role: str = "member"
    joined_at: Optional[str] = None
    contributed_xp: int = 0

class ClanMission(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    target_value: int
    current_value: int = 0
    unit: str = "xp"
    xp_reward: int = 200
    status: str = "active"
    ends_at: Optional[str] = None

class ClanDetailResponse(ClanSummary):
    members: list[ClanMember] = []
    missions: list[ClanMission] = []

class ClanCreateRequest(BaseModel):
    name: str = Field(min_length=_NAME_MIN, max_length=_NAME_MAX)
    tag: Optional[str] = Field(None, min_length=3, max_length=4)
    description: Optional[str] = None
    color: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_valid(cls, v: str) -> str:
        stripped = v.strip()
        if len(stripped) < _NAME_MIN:
            raise ValueError(f"El nombre debe tener al menos {_NAME_MIN} caracteres")
        return stripped

    @field_validator("tag")
    @classmethod
    def tag_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip().upper()
            if not _TAG_PATTERN.match(v):
                raise ValueError("El tag debe tener 3-4 caracteres alfanuméricos")
        return v

    @field_validator("color")
    @classmethod
    def color_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not re.match(r"^#[0-9A-Fa-f]{6}$", v):
            raise ValueError("El color debe ser un hex válido (ej: #00D4FF)")
        return v

class ClanKickRequest(BaseModel):
    player_id: str

class ClanMissionCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    target_value: int = Field(ge=1)
    unit: Optional[str] = "xp"
    xp_reward: Optional[int] = 200
    ends_at: Optional[str] = None

class MissionProgressRequest(BaseModel):
    value: int = Field(default=1, ge=1)

class MyClanResponse(BaseModel):
    clan: Optional[ClanSummary] = None


# ─── Endpoints ────────────────────────────────────────────────────────────

@router.get("/api/v1/clans")
async def list_clans(limit: int = Query(20, ge=1, le=50), offset: int = Query(0, ge=0), search: Optional[str] = Query(None)):
    q = supabase.table("clans").select("*", count="exact").order("total_xp", desc=True)

    if search:
        q = q.or_(f"name.ilike.%{search}%,tag.ilike.%{search}%")

    r = await asyncio.to_thread(lambda: q.range(offset, offset + limit - 1).execute())
    count_obj = await asyncio.to_thread(
        lambda: supabase.table("clans").select("id", count="exact").execute()
    ) if not search else r

    total = r.count if hasattr(r, 'count') and r.count else 0
    items = [ClanSummary(**{**c, "total_xp": c.get("total_xp") or 0}) for c in (r.data or [])]
    return {"clans": items, "limit": limit, "offset": offset, "total": total}


@router.post("/api/v1/clans", status_code=201)
async def create_clan(body: ClanCreateRequest, user=Depends(get_current_user)):
    pid = await _get_player_id(user)
    if not pid:
        raise HTTPException(400, "No tienes player_id. Completa tu perfil primero.")

    existing = await asyncio.to_thread(
        lambda: supabase.table("clan_members").select("id").eq("player_id", pid).maybe_single().execute()
    )
    if existing.data:
        raise HTTPException(400, "Ya perteneces a un clan. Sal de él antes de crear uno.")

    name_taken = await asyncio.to_thread(
        lambda: supabase.table("clans").select("id").eq("name", body.name).maybe_single().execute()
    )
    if name_taken.data:
        raise HTTPException(409, "Ya existe un clan con ese nombre.")

    if body.tag:
        tag_taken = await asyncio.to_thread(
            lambda: supabase.table("clans").select("id").eq("tag", body.tag).maybe_single().execute()
        )
        if tag_taken.data:
            raise HTTPException(409, "Ese tag ya está en uso.")

    payload = {
        "name": body.name,
        "owner_player_id": pid,
        "member_count": 1,
    }
    if body.tag:
        payload["tag"] = body.tag
    if body.description:
        payload["description"] = body.description
    if body.color:
        payload["color"] = body.color

    r = await asyncio.to_thread(
        lambda: supabase.table("clans").insert(payload).execute()
    )
    if not r.data:
        raise HTTPException(500, "No se pudo crear el clan.")
    clan = r.data[0]

    await asyncio.to_thread(
        lambda: supabase.table("clan_members").insert({
            "clan_id": clan["id"],
            "player_id": pid,
            "role": "owner",
        }).execute()
    )

    return ClanSummary(**{**clan, "total_xp": clan.get("total_xp") or 0})


@router.get("/api/v1/clans/my-clan")
async def my_clan(user=Depends(get_current_user)):
    pid = await _get_player_id(user)
    if not pid:
        return MyClanResponse(clan=None)

    mem = await asyncio.to_thread(
        lambda: supabase.table("clan_members").select("clan_id").eq("player_id", pid).maybe_single().execute()
    )
    if not mem.data:
        return MyClanResponse(clan=None)

    r = await asyncio.to_thread(
        lambda: supabase.table("clans").select("*").eq("id", mem.data["clan_id"]).single().execute()
    )
    if not r.data:
        return MyClanResponse(clan=None)

    return MyClanResponse(clan=ClanSummary(**{**r.data, "total_xp": await _calc_total_xp(r.data["id"])}))


@router.get("/api/v1/clans/{clan_id}")
async def clan_detail(clan_id: str, user=Depends(get_current_user)):
    pid = await _get_player_id(user)
    clan = await _get_clan_or_404(clan_id)

    mem_r = await asyncio.to_thread(
        lambda: supabase.table("clan_members").select("*").eq("clan_id", clan_id).execute()
    )
    members = []
    for m in (mem_r.data or []):
        name = await _get_player_name(m["player_id"])
        members.append(ClanMember(
            player_id=m["player_id"],
            name=name,
            role=m["role"],
            joined_at=_s(m.get("joined_at")),
            contributed_xp=m.get("contributed_xp", 0),
        ))

    mis_r = await asyncio.to_thread(
        lambda: supabase.table("clan_missions").select("*").eq("clan_id", clan_id).eq("status", "active").execute()
    )
    missions = [ClanMission(**m) for m in (mis_r.data or [])]

    total_xp = sum(m.contributed_xp for m in members)

    return ClanDetailResponse(
        id=clan["id"], name=clan["name"], tag=clan.get("tag"),
        description=clan.get("description"), color=clan.get("color", "#00D4FF"),
        total_xp=total_xp, member_count=len(members), max_members=clan.get("max_members", 20),
        members=members, missions=missions,
    )


@router.post("/api/v1/clans/{clan_id}/join")
async def join_clan(clan_id: str, user=Depends(get_current_user)):
    pid = await _get_player_id(user)
    if not pid:
        raise HTTPException(400, "Perfil incompleto.")

    clan = await _get_clan_or_404(clan_id)

    existing = await asyncio.to_thread(
        lambda: supabase.table("clan_members").select("id").eq("player_id", pid).maybe_single().execute()
    )
    if existing.data:
        raise HTTPException(400, "Ya perteneces a un clan.")

    if clan.get("member_count", 0) >= clan.get("max_members", 20):
        raise HTTPException(400, "El clan está lleno.")

    await asyncio.to_thread(
        lambda: supabase.table("clan_members").insert({
            "clan_id": clan_id, "player_id": pid, "role": "member",
        }).execute()
    )
    await asyncio.to_thread(
        lambda: supabase.table("clans").update({"member_count": clan["member_count"] + 1}).eq("id", clan_id).execute()
    )
    return {"message": "Te has unido al clan", "clan_id": clan_id}


@router.post("/api/v1/clans/{clan_id}/leave")
async def leave_clan(clan_id: str, user=Depends(get_current_user)):
    pid = await _get_player_id(user)
    clan = await _get_clan_or_404(clan_id)

    mem = await asyncio.to_thread(
        lambda: supabase.table("clan_members").select("*").eq("clan_id", clan_id).eq("player_id", pid).maybe_single().execute()
    )
    if not mem.data:
        raise HTTPException(404, "No eres miembro de este clan.")

    if mem.data["role"] == "owner":
        raise HTTPException(400, "El owner no puede salir del clan. Transfiere la propiedad o disuelve el clan.")

    await asyncio.to_thread(
        lambda: supabase.table("clan_members").delete().eq("id", mem.data["id"]).execute()
    )
    await asyncio.to_thread(
        lambda: supabase.table("clans").update({"member_count": clan["member_count"] - 1}).eq("id", clan_id).execute()
    )
    return {"message": "Has salido del clan"}


@router.post("/api/v1/clans/{clan_id}/kick")
async def kick_member(clan_id: str, body: ClanKickRequest, user=Depends(get_current_user)):
    pid = await _get_player_id(user)

    my_mem = await asyncio.to_thread(
        lambda: supabase.table("clan_members").select("role").eq("clan_id", clan_id).eq("player_id", pid).maybe_single().execute()
    )
    if not my_mem.data or my_mem.data["role"] not in ("owner", "admin"):
        raise HTTPException(403, "Solo el owner o admin pueden expulsar miembros.")

    target = await asyncio.to_thread(
        lambda: supabase.table("clan_members").select("*").eq("clan_id", clan_id).eq("player_id", body.player_id).maybe_single().execute()
    )
    if not target.data:
        raise HTTPException(404, "El jugador no es miembro del clan.")

    if target.data["role"] == "owner":
        raise HTTPException(400, "No puedes expulsar al owner del clan.")

    clan = await _get_clan_or_404(clan_id)
    await asyncio.to_thread(
        lambda: supabase.table("clan_members").delete().eq("id", target.data["id"]).execute()
    )
    await asyncio.to_thread(
        lambda: supabase.table("clans").update({"member_count": clan["member_count"] - 1}).eq("id", clan_id).execute()
    )
    return {"message": "Miembro expulsado del clan"}


@router.get("/api/v1/clans/{clan_id}/missions")
async def list_missions(clan_id: str, user=Depends(get_current_user)):
    await _get_clan_or_404(clan_id)
    r = await asyncio.to_thread(
        lambda: supabase.table("clan_missions").select("*").eq("clan_id", clan_id).order("created_at", desc=True).execute()
    )
    return {"missions": [ClanMission(**m) for m in (r.data or [])]}


@router.post("/api/v1/clans/{clan_id}/missions", status_code=201)
async def create_mission(clan_id: str, body: ClanMissionCreateRequest, user=Depends(get_current_user)):
    pid = await _get_player_id(user)

    my_mem = await asyncio.to_thread(
        lambda: supabase.table("clan_members").select("role").eq("clan_id", clan_id).eq("player_id", pid).maybe_single().execute()
    )
    if not my_mem.data or my_mem.data["role"] not in ("owner", "admin"):
        raise HTTPException(403, "Solo el owner o admin pueden crear misiones.")

    payload = {
        "clan_id": clan_id,
        "name": body.name,
        "target_value": body.target_value,
        "unit": body.unit or "xp",
        "xp_reward": body.xp_reward or 200,
    }
    if body.description:
        payload["description"] = body.description
    if body.ends_at:
        payload["ends_at"] = body.ends_at

    r = await asyncio.to_thread(
        lambda: supabase.table("clan_missions").insert(payload).execute()
    )
    if not r.data:
        raise HTTPException(500, "No se pudo crear la misión.")
    return ClanMission(**r.data[0])


@router.post("/api/v1/clans/{clan_id}/missions/{mission_id}/progress")
async def mission_progress(clan_id: str, mission_id: str, body: MissionProgressRequest, user=Depends(get_current_user)):
    pid = await _get_player_id(user)

    mem = await asyncio.to_thread(
        lambda: supabase.table("clan_members").select("id").eq("clan_id", clan_id).eq("player_id", pid).maybe_single().execute()
    )
    if not mem.data:
        raise HTTPException(403, "No eres miembro de este clan.")

    mis_r = await asyncio.to_thread(
        lambda: supabase.table("clan_missions").select("*").eq("id", mission_id).eq("clan_id", clan_id).maybe_single().execute()
    )
    if not mis_r.data:
        raise HTTPException(404, "Misión no encontrada en este clan.")
    if mis_r.data["status"] != "active":
        raise HTTPException(400, f"La misión está en estado «{mis_r.data['status']}».")

    new_value = (mis_r.data["current_value"] or 0) + body.value
    completed = new_value >= mis_r.data["target_value"]
    new_status = "completed" if completed else "active"

    await asyncio.to_thread(
        lambda: supabase.table("clan_missions").update({
            "current_value": new_value,
            "status": new_status,
        }).eq("id", mission_id).execute()
    )

    result = {"current_value": new_value, "status": new_status}

    if completed:
        xp_reward = mis_r.data.get("xp_reward", 200)
        members_r = await asyncio.to_thread(
            lambda: supabase.table("clan_members").select("player_id").eq("clan_id", clan_id).execute()
        )
        active_members = [m["player_id"] for m in (members_r.data or [])]
        share = xp_reward // len(active_members) if active_members else 0
        total_added = 0
        for m_pid in active_members:
            prof = await asyncio.to_thread(
                lambda pid=m_pid: supabase.table("profiles").select("xp, level").eq("player_id", pid).maybe_single().execute()
            )
            if prof.data:
                cx = prof.data.get("xp", 0)
                cl = prof.data.get("level", 1)
                nx = cx + share
                nl = cl
                while nx >= nl * 1000:
                    nx -= nl * 1000
                    nl += 1
                await asyncio.to_thread(
                    lambda pid=m_pid, x=nx, lvl=nl: supabase.table("profiles").update({"xp": x, "level": lvl}).eq("player_id", pid).execute()
                )
                total_added += share

            mem_update = await asyncio.to_thread(
                lambda pid=m_pid: supabase.table("clan_members").select("contributed_xp").eq("clan_id", clan_id).eq("player_id", pid).single().execute()
            )
            if mem_update.data:
                curr = mem_update.data.get("contributed_xp", 0)
                await asyncio.to_thread(
                    lambda pid=m_pid, new=curr + share: supabase.table("clan_members").update({"contributed_xp": new}).eq("clan_id", clan_id).eq("player_id", pid).execute()
                )

        result["xp_distributed"] = share
        result["members_rewarded"] = len(active_members)
        result["total_xp_added"] = total_added

    return result


# ─── Internal ─────────────────────────────────────────────────────────────

async def _get_clan_or_404(clan_id: str) -> dict:
    r = await asyncio.to_thread(
        lambda: supabase.table("clans").select("*").eq("id", clan_id).maybe_single().execute()
    )
    if not r.data:
        raise HTTPException(404, "Clan no encontrado.")
    return r.data


async def _calc_total_xp(clan_id: str) -> int:
    r = await asyncio.to_thread(
        lambda: supabase.table("clan_members").select("contributed_xp").eq("clan_id", clan_id).execute()
    )
    return sum(m.get("contributed_xp", 0) for m in (r.data or []))


def _s(v):
    if v is None:
        return None
    if isinstance(v, str):
        return v
    return v.isoformat() if hasattr(v, "isoformat") else str(v)
