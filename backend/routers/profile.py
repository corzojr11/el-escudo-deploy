import asyncio
import logging
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, model_validator

from auth import get_current_user
from database import supabase
from exceptions import ApiException

logger = logging.getLogger("escudo")
router = APIRouter()

VALID_HEALTH_GOALS = {"ganar_musculo", "perder_grasa", "energia_bienestar"}


def _bogota_now() -> datetime:
    try:
        return datetime.now(ZoneInfo("America/Bogota"))
    except Exception:
        return datetime.now(timezone.utc)


def _calculate_age(birth_date: date) -> int:
    today = _bogota_now().date()
    return today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))


class ProfileUpdatePayload(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=60)
    birth_date: str | None = None
    height_cm: int | None = Field(default=None, ge=100, le=250)
    health_goal: str | None = None
    onboarding_completed_at: str | None = None

    @model_validator(mode="after")
    def validate_optional_fields(self):
        if self.health_goal is not None and self.health_goal not in VALID_HEALTH_GOALS:
            raise ValueError(f"health_goal debe ser uno de: {', '.join(sorted(VALID_HEALTH_GOALS))}")
        if self.birth_date is not None:
            try:
                parsed = date.fromisoformat(self.birth_date)
            except (ValueError, TypeError):
                raise ValueError("birth_date debe ser una fecha válida en formato YYYY-MM-DD")
            age = _calculate_age(parsed)
            if age < 18 or age > 120:
                raise ValueError(f"Edad calculada {age} fuera del rango permitido (18-120)")
        return self


class OnboardingPayload(BaseModel):
    name: str = Field(..., min_length=2, max_length=60)
    birth_date: str
    weight_kg: float = Field(..., gt=0, le=300)
    height_cm: int = Field(..., ge=100, le=250)
    health_goal: str

    @model_validator(mode="after")
    def validate_onboarding(self):
        if self.health_goal not in VALID_HEALTH_GOALS:
            raise ValueError(f"health_goal debe ser uno de: {', '.join(sorted(VALID_HEALTH_GOALS))}")
        try:
            parsed = date.fromisoformat(self.birth_date)
        except (ValueError, TypeError):
            raise ValueError("birth_date debe ser una fecha válida en formato YYYY-MM-DD")
        age = _calculate_age(parsed)
        if age < 18 or age > 120:
            raise ValueError(f"Edad calculada {age} fuera del rango permitido (18-120)")
        return self


@router.get("/api/v1/profile")
async def get_profile(user=Depends(get_current_user)):
    res = await asyncio.to_thread(
        lambda: supabase.table("profiles")
        .select("*")
        .eq("user_id", user.id)
        .limit(1)
        .execute()
    )
    if not res.data:
        return {"profile": None}
    return {"profile": res.data[0]}


@router.put("/api/v1/profile")
async def update_profile(payload: ProfileUpdatePayload, user=Depends(get_current_user)):
    data = payload.model_dump(exclude_unset=True)

    if "birth_date" in data and data["birth_date"] is not None:
        data["birth_date"] = data["birth_date"]
    if "onboarding_completed_at" in data and data["onboarding_completed_at"] is not None:
        pass

    if not data:
        raise ApiException(status_code=400, detail="No hay campos para actualizar.")

    data["updated_at"] = datetime.now(timezone.utc).isoformat()

    res = await asyncio.to_thread(
        lambda: supabase.table("profiles")
        .update(data)
        .eq("user_id", user.id)
        .execute()
    )
    if not res.data:
        raise ApiException(status_code=404, detail="Perfil no encontrado.")
    return {"profile": res.data[0]}


@router.post("/api/v1/onboarding")
async def complete_onboarding(payload: OnboardingPayload, user=Depends(get_current_user)):
    now_iso = datetime.now(timezone.utc).isoformat()
    today_str = _bogota_now().strftime("%Y-%m-%d")

    profile_data = {
        "name": payload.name,
        "birth_date": payload.birth_date,
        "height_cm": payload.height_cm,
        "health_goal": payload.health_goal,
        "onboarding_completed_at": now_iso,
        "updated_at": now_iso,
    }

    res_profile = await asyncio.to_thread(
        lambda: supabase.table("profiles")
        .update(profile_data)
        .eq("user_id", user.id)
        .execute()
    )

    weight_data = {
        "user_id": user.id,
        "weight": payload.weight_kg,
        "date": today_str,
        "timestamp": now_iso,
    }
    await asyncio.to_thread(
        lambda: supabase.table("weight_logs").insert(weight_data).execute()
    )

    if not res_profile.data:
        profile_data["user_id"] = user.id
        profile_data["email"] = None
        profile_data["level"] = 1
        profile_data["xp"] = 0
        profile_data["xp_to_next_level"] = 100
        profile_data["streak"] = 0
        profile_data["ai_cost_cop"] = 0
        profile_data["created_at"] = now_iso
        res_profile = await asyncio.to_thread(
            lambda: supabase.table("profiles").insert(profile_data).execute()
        )

    return {"profile": res_profile.data[0] if res_profile.data else profile_data}
