import asyncio
from datetime import date, datetime, timezone
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field, field_validator

from auth import get_current_user
from database import supabase
from exceptions import ApiException, NotFoundException

router = APIRouter()

EntryKind = Literal["idea", "prayer", "reading", "discipline"]


class PersonalEntryPayload(BaseModel):
    kind: EntryKind
    title: str = Field(..., min_length=1, max_length=120)
    content: str = Field(default="", max_length=5000)
    entry_date: Optional[date] = None
    data: dict[str, Any] = Field(default_factory=dict)

    @field_validator("title", "content", mode="before")
    @classmethod
    def clean_text(cls, value: Any) -> str:
        return str(value or "").strip()


class PersonalEntryUpdatePayload(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=120)
    content: Optional[str] = Field(default=None, max_length=5000)
    data: Optional[dict[str, Any]] = None

    @field_validator("title", "content", mode="before")
    @classmethod
    def clean_text(cls, value: Any) -> Any:
        return str(value).strip() if value is not None else value


@router.get("/api/v1/personal-entries")
async def list_personal_entries(
    kind: Optional[EntryKind] = Query(None),
    limit: int = Query(100, ge=1, le=200),
    user=Depends(get_current_user),
):
    query = supabase.table("personal_entries").select("*").eq("user_id", user.id)
    if kind:
        query = query.eq("kind", kind)
    result = await asyncio.to_thread(
        lambda: query.order("entry_date", desc=True).order("created_at", desc=True).limit(limit).execute()
    )
    return {"entries": result.data or []}


@router.post("/api/v1/personal-entries")
async def create_personal_entry(payload: PersonalEntryPayload, user=Depends(get_current_user)):
    result = await asyncio.to_thread(
        lambda: supabase.table("personal_entries").insert(
            {
                "user_id": user.id,
                "kind": payload.kind,
                "title": payload.title,
                "content": payload.content,
                "entry_date": (payload.entry_date or date.today()).isoformat(),
                "data": payload.data,
            }
        ).execute()
    )
    if not result.data:
        raise ApiException(status_code=500, detail="No se pudo guardar la entrada personal.")
    return {"entry": result.data[0]}


async def _owned_entry(entry_id: str, user_id: str) -> None:
    result = await asyncio.to_thread(
        lambda: supabase.table("personal_entries").select("id").eq("id", entry_id).eq("user_id", user_id).limit(1).execute()
    )
    if not result.data:
        raise NotFoundException("Entrada personal")


@router.put("/api/v1/personal-entries/{entry_id}")
async def update_personal_entry(entry_id: str, payload: PersonalEntryUpdatePayload, user=Depends(get_current_user)):
    update_data = payload.model_dump(exclude_unset=True, exclude_none=True)
    if not update_data:
        raise ApiException(status_code=400, detail="No se recibieron cambios para la entrada.")
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await _owned_entry(entry_id, user.id)
    result = await asyncio.to_thread(
        lambda: supabase.table("personal_entries").update(update_data).eq("id", entry_id).eq("user_id", user.id).execute()
    )
    return {"entry": result.data[0]}


@router.delete("/api/v1/personal-entries/{entry_id}")
async def delete_personal_entry(entry_id: str, user=Depends(get_current_user)):
    await _owned_entry(entry_id, user.id)
    await asyncio.to_thread(
        lambda: supabase.table("personal_entries").delete().eq("id", entry_id).eq("user_id", user.id).execute()
    )
    return {"detail": "Entrada eliminada."}
