"""Resumenes exportables construidos con los datos reales del usuario."""

import asyncio
from datetime import date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query

from auth import get_current_user
from database import supabase

router = APIRouter()
BOGOTA = ZoneInfo("America/Bogota")


def _as_date(value: Any) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).date()
    except ValueError:
        return None


def _period_window(period: str, today: date | None = None) -> tuple[date, date]:
    end = today or datetime.now(BOGOTA).date()
    days = 7 if period == "week" else 30
    return end - timedelta(days=days - 1), end


def _inside_period(rows: list[dict[str, Any]], start: date, end: date, *keys: str) -> list[dict[str, Any]]:
    selected: list[dict[str, Any]] = []
    for row in rows:
        row_date = next((_as_date(row.get(key)) for key in keys if row.get(key)), None)
        if row_date and start <= row_date <= end:
            selected.append(row)
    return selected


async def _fetch_rows(table: str, user_id: str) -> list[dict[str, Any]]:
    try:
        result = await asyncio.to_thread(
            lambda: supabase.table(table).select("*").eq("user_id", user_id).limit(300).execute()
        )
        return result.data or []
    except Exception:
        # Los reportes deben seguir siendo descargables aunque un modulo antiguo no exista.
        return []


@router.get("/api/v1/reports/summary")
async def progress_summary(
    period: str = Query("week", pattern="^(week|month)$"),
    user=Depends(get_current_user),
):
    start, end = _period_window(period)
    finances_r, missions_r, habits_r, completions_r, weights_r, entries_r = await asyncio.gather(
        _fetch_rows("finances", user.id),
        _fetch_rows("missions", user.id),
        _fetch_rows("habits", user.id),
        _fetch_rows("habit_completions", user.id),
        _fetch_rows("weight_logs", user.id),
        _fetch_rows("personal_entries", user.id),
    )

    finances = _inside_period(finances_r, start, end, "date", "timestamp", "created_at")
    missions = _inside_period(missions_r, start, end, "scheduled_at", "created_at")
    weights = _inside_period(weights_r, start, end, "date", "timestamp", "created_at")
    entries = _inside_period(entries_r, start, end, "entry_date", "created_at")
    completions = _inside_period(completions_r, start, end, "date", "completed_at", "created_at")

    income = sum(float(item.get("amount") or 0) for item in finances if str(item.get("type", "")).lower() in {"income", "ingreso"})
    expense = sum(float(item.get("amount") or 0) for item in finances if str(item.get("type", "")).lower() in {"expense", "gasto"})
    categories: dict[str, float] = {}
    for item in finances:
        if str(item.get("type", "")).lower() not in {"expense", "gasto"}:
            continue
        category = str(item.get("category") or "Sin categoria")
        categories[category] = categories.get(category, 0) + float(item.get("amount") or 0)

    completed = [item for item in missions if item.get("status") == "completed"]
    kinds: dict[str, int] = {}
    for entry in entries:
        kind = str(entry.get("kind") or "nota")
        kinds[kind] = kinds.get(kind, 0) + 1

    weight_values = [float(item["weight"]) for item in weights if item.get("weight") is not None]
    return {
        "period": period,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "finances": {
            "income": income,
            "expense": expense,
            "balance": income - expense,
            "transaction_count": len(finances),
            "top_categories": [
                {"name": name, "amount": amount}
                for name, amount in sorted(categories.items(), key=lambda item: item[1], reverse=True)[:3]
            ],
        },
        "missions": {"total": len(missions), "completed": len(completed), "pending": len(missions) - len(completed)},
        "habits": {"total": len(habits_r), "completions": len(completions)},
        "health": {"latest_weight": weight_values[0] if weight_values else None, "weight_logs": len(weight_values)},
        "bitacora": {"entries": len(entries), "by_kind": kinds},
    }
