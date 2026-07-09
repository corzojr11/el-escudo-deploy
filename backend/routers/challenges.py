import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

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
        lambda: supabase.table("profiles").select("name").eq("player_id", player_id).single().execute()
    )
    return r.data.get("name", "Anónimo") if r.data else "Anónimo"


def _dt_now():
    return datetime.now(timezone.utc)


# ─── Pydantic models ──────────────────────────────────────────────────────

class ChallengeTemplate(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    category: str
    target_value: Optional[int] = None
    target_unit: Optional[str] = None
    duration_days: int = 7
    xp_reward: int = 100

class ChallengeTemplateListResponse(BaseModel):
    templates: list[ChallengeTemplate]

class ChallengeCreateRequest(BaseModel):
    template_id: str
    challenged_player_id: str

class PlayerInfo(BaseModel):
    player_id: str
    name: str

class ChallengeProgressEntry(BaseModel):
    player_id: str
    name: str = ""
    current_value: int = 0
    completed: bool = False

class ChallengeResponse(BaseModel):
    id: str
    template: Optional[ChallengeTemplate] = None
    challenger: PlayerInfo
    challenged: PlayerInfo
    status: str
    winner_player_id: Optional[str] = None
    started_at: Optional[str] = None
    ends_at: Optional[str] = None
    created_at: str

class ChallengeDetailResponse(ChallengeResponse):
    progress: list[ChallengeProgressEntry] = []

class ProgressUpdateRequest(BaseModel):
    current_value: int = Field(ge=0)

class ProgressUpdateResponse(BaseModel):
    player_id: str
    current_value: int
    completed: bool
    challenge_status: str


# ─── Endpoints ────────────────────────────────────────────────────────────

@router.get("/api/v1/challenges/templates")
async def list_templates():
    r = await asyncio.to_thread(
        lambda: supabase.table("challenge_templates").select("*").order("name").execute()
    )
    return ChallengeTemplateListResponse(
        templates=[ChallengeTemplate(**t) for t in (r.data or [])]
    )


@router.post("/api/v1/challenges", status_code=201)
async def create_challenge(body: ChallengeCreateRequest, user=Depends(get_current_user)):
    pid = await _get_player_id(user)
    if not pid:
        raise HTTPException(400, "No tienes player_id. Completa tu perfil primero.")

    if pid == body.challenged_player_id:
        raise HTTPException(400, "No puedes retarte a ti mismo.")

    challenged = await asyncio.to_thread(
        lambda: supabase.table("profiles").select("player_id").eq("player_id", body.challenged_player_id).maybe_single().execute()
    )
    if not challenged.data:
        raise HTTPException(404, "El jugador retado no existe.")

    active_count = await asyncio.to_thread(
        lambda: supabase.table("challenges").select("id", count="exact")\
            .or_(f"challenger_player_id.eq.{pid},challenged_player_id.eq.{pid}")\
            .in_("status", ("accepted", "pending")).execute()
    )
    if (active_count.count or 0) >= 3:
        raise HTTPException(400, "Ya tienes 3 retos activos. Completa o cancela uno antes.")

    r = await asyncio.to_thread(
        lambda: supabase.table("challenges").insert({
            "template_id": body.template_id,
            "challenger_player_id": pid,
            "challenged_player_id": body.challenged_player_id,
        }).execute()
    )
    if not r.data:
        raise HTTPException(500, "No se pudo crear el reto.")
    return await _build_challenge_response(r.data[0], include_template=True)


@router.post("/api/v1/challenges/{challenge_id}/accept")
async def accept_challenge(challenge_id: str, user=Depends(get_current_user)):
    pid = await _get_player_id(user)
    chal = await _get_challenge_or_404(challenge_id)

    if chal["challenged_player_id"] != pid:
        raise HTTPException(403, "Solo el jugador retado puede aceptar.")
    if chal["status"] != "pending":
        raise HTTPException(400, f"El reto está en estado «{chal['status']}», no se puede aceptar.")

    now = _dt_now().isoformat()
    template = await asyncio.to_thread(
        lambda: supabase.table("challenge_templates").select("duration_days").eq("id", chal["template_id"]).single().execute()
    )
    dur = (template.data or {}).get("duration_days", 7)
    ends = _dt_now()
    try:
        from dateutil.relativedelta import relativedelta
        ends += relativedelta(days=int(dur))
    except Exception:
        from datetime import timedelta
        ends += timedelta(days=int(dur))

    r = await asyncio.to_thread(
        lambda: supabase.table("challenges").update({
            "status": "accepted",
            "started_at": now,
            "ends_at": ends.isoformat(),
            "updated_at": now,
        }).eq("id", challenge_id).execute()
    )
    if not r.data:
        raise HTTPException(500, "No se pudo aceptar el reto.")

    for p in (chal["challenger_player_id"], chal["challenged_player_id"]):
        await asyncio.to_thread(
            lambda pid=p: supabase.table("challenge_progress").insert({
                "challenge_id": challenge_id,
                "player_id": pid,
                "current_value": 0,
                "completed": False,
            }).execute()
        )

    return await _build_challenge_response(r.data[0], include_template=True)


@router.post("/api/v1/challenges/{challenge_id}/reject")
async def reject_challenge(challenge_id: str, user=Depends(get_current_user)):
    pid = await _get_player_id(user)
    chal = await _get_challenge_or_404(challenge_id)

    if chal["challenged_player_id"] != pid:
        raise HTTPException(403, "Solo el jugador retado puede rechazar.")
    if chal["status"] != "pending":
        raise HTTPException(400, f"El reto está en estado «{chal['status']}», no se puede rechazar.")

    now = _dt_now().isoformat()
    r = await asyncio.to_thread(
        lambda: supabase.table("challenges").update({
            "status": "rejected",
            "updated_at": now,
        }).eq("id", challenge_id).execute()
    )
    return await _build_challenge_response(r.data[0], include_template=True) if r.data else None


@router.post("/api/v1/challenges/{challenge_id}/cancel")
async def cancel_challenge(challenge_id: str, user=Depends(get_current_user)):
    pid = await _get_player_id(user)
    chal = await _get_challenge_or_404(challenge_id)

    if chal["challenger_player_id"] != pid:
        raise HTTPException(403, "Solo el creador del reto puede cancelarlo.")
    if chal["status"] not in ("pending",):
        raise HTTPException(400, "Solo se pueden cancelar retos pendientes.")

    now = _dt_now().isoformat()
    r = await asyncio.to_thread(
        lambda: supabase.table("challenges").update({
            "status": "cancelled",
            "updated_at": now,
        }).eq("id", challenge_id).execute()
    )
    return await _build_challenge_response(r.data[0], include_template=True) if r.data else None


@router.get("/api/v1/challenges/active")
async def active_challenges(user=Depends(get_current_user)):
    pid = await _get_player_id(user)
    r = await asyncio.to_thread(
        lambda: supabase.table("challenges").select("*")\
            .or_(f"challenger_player_id.eq.{pid},challenged_player_id.eq.{pid}")\
            .in_("status", ("pending", "accepted"))\
            .order("created_at", desc=True).execute()
    )
    results = []
    for c in (r.data or []):
        resp = await _build_challenge_response(c)
        results.append(resp)
    return {"challenges": results}


@router.get("/api/v1/challenges/history")
async def challenge_history(user=Depends(get_current_user)):
    pid = await _get_player_id(user)
    r = await asyncio.to_thread(
        lambda: supabase.table("challenges").select("*")\
            .or_(f"challenger_player_id.eq.{pid},challenged_player_id.eq.{pid}")\
            .in_("status", ("completed", "failed", "rejected", "cancelled"))\
            .order("updated_at", desc=True).limit(20).execute()
    )
    results = []
    for c in (r.data or []):
        resp = await _build_challenge_response(c)
        results.append(resp)
    return {"challenges": results}


@router.get("/api/v1/challenges/{challenge_id}")
async def challenge_detail(challenge_id: str, user=Depends(get_current_user)):
    pid = await _get_player_id(user)
    chal = await _get_challenge_or_404(challenge_id)

    if pid not in (chal["challenger_player_id"], chal["challenged_player_id"]):
        raise HTTPException(403, "No participas en este reto.")

    base = await _build_challenge_response(chal, include_template=True)

    prog_r = await asyncio.to_thread(
        lambda: supabase.table("challenge_progress").select("*").eq("challenge_id", challenge_id).execute()
    )
    progress = []
    for p in (prog_r.data or []):
        name = await _get_player_name(p["player_id"])
        progress.append(ChallengeProgressEntry(
            player_id=p["player_id"],
            name=name,
            current_value=p.get("current_value", 0),
            completed=p.get("completed", False),
        ))

    return ChallengeDetailResponse(**base.model_dump(), progress=progress)


@router.post("/api/v1/challenges/{challenge_id}/progress")
async def report_progress(challenge_id: str, body: ProgressUpdateRequest, user=Depends(get_current_user)):
    pid = await _get_player_id(user)
    chal = await _get_challenge_or_404(challenge_id)

    if pid not in (chal["challenger_player_id"], chal["challenged_player_id"]):
        raise HTTPException(403, "No participas en este reto.")
    if chal["status"] != "accepted":
        raise HTTPException(400, f"El reto está en estado «{chal['status']}». Solo se puede reportar progreso en retos activos.")

    prog_r = await asyncio.to_thread(
        lambda: supabase.table("challenge_progress").select("*").eq("challenge_id", challenge_id).eq("player_id", pid).maybe_single().execute()
    )
    if not prog_r.data:
        raise HTTPException(404, "No tienes registro de progreso para este reto.")

    now = _dt_now().isoformat()

    template = await asyncio.to_thread(
        lambda: supabase.table("challenge_templates").select("target_value, xp_reward").eq("id", chal["template_id"]).single().execute()
    )
    target = (template.data or {}).get("target_value", 1)
    xp_reward = (template.data or {}).get("xp_reward", 100)
    completed = body.current_value >= target

    await asyncio.to_thread(
        lambda: supabase.table("challenge_progress").update({
            "current_value": body.current_value,
            "completed": completed,
            "updated_at": now,
        }).eq("id", prog_r.data["id"]).execute()
    )

    challenge_status = chal["status"]
    if completed:
        other_pid = chal["challenger_player_id"] if pid == chal["challenged_player_id"] else chal["challenged_player_id"]
        other_r = await asyncio.to_thread(
            lambda: supabase.table("challenge_progress").select("completed").eq("challenge_id", challenge_id).eq("player_id", other_pid).maybe_single().execute()
        )
        both_completed = other_r.data and other_r.data.get("completed", False) is True

        if both_completed:
            await asyncio.to_thread(
                lambda: supabase.table("challenges").update({
                    "status": "completed",
                    "updated_at": now,
                }).eq("id", challenge_id).execute()
            )
            challenge_status = "completed"
            for p in (chal["challenger_player_id"], chal["challenged_player_id"]):
                await _award_xp(p, xp_reward)
        else:
            challenge_status = "accepted"

    return ProgressUpdateResponse(
        player_id=pid,
        current_value=body.current_value,
        completed=completed,
        challenge_status=challenge_status,
    )


# ─── Internal builders ────────────────────────────────────────────────────

async def _get_challenge_or_404(challenge_id: str) -> dict:
    r = await asyncio.to_thread(
        lambda: supabase.table("challenges").select("*").eq("id", challenge_id).maybe_single().execute()
    )
    if not r.data:
        raise HTTPException(404, "Reto no encontrado.")
    return r.data


async def _build_challenge_response(data: dict, include_template: bool = False) -> ChallengeResponse:
    tmpl = None
    if include_template and data.get("template_id"):
        t_r = await asyncio.to_thread(
            lambda: supabase.table("challenge_templates").select("*").eq("id", data["template_id"]).maybe_single().execute()
        )
        if t_r.data:
            tmpl = ChallengeTemplate(**t_r.data)

    c_name = await _get_player_name(data["challenger_player_id"])
    d_name = await _get_player_name(data["challenged_player_id"])

    def _s(v):
        if v is None:
            return None
        if isinstance(v, str):
            return v
        return v.isoformat() if hasattr(v, 'isoformat') else str(v)

    return ChallengeResponse(
        id=data["id"],
        template=tmpl,
        challenger=PlayerInfo(player_id=data["challenger_player_id"], name=c_name),
        challenged=PlayerInfo(player_id=data["challenged_player_id"], name=d_name),
        status=data["status"],
        winner_player_id=data.get("winner_player_id"),
        started_at=_s(data.get("started_at")),
        ends_at=_s(data.get("ends_at")),
        created_at=_s(data["created_at"]),
    )


async def _award_xp(player_id: str, xp: int):
    prof = await asyncio.to_thread(
        lambda: supabase.table("profiles").select("xp, level").eq("player_id", player_id).single().execute()
    )
    if not prof.data:
        return
    current_xp = prof.data.get("xp", 0)
    current_level = prof.data.get("level", 1)
    new_xp = current_xp + xp
    new_level = current_level
    while new_xp >= new_level * 1000:
        new_xp -= new_level * 1000
        new_level += 1
    await asyncio.to_thread(
        lambda: supabase.table("profiles").update({
            "xp": new_xp,
            "level": new_level,
        }).eq("player_id", player_id).execute()
    )
