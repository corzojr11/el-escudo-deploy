import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends

from auth import get_current_user
from database import supabase

logger = logging.getLogger("escudo")
router = APIRouter()


def _bogota_now() -> datetime:
    try:
        return datetime.now(ZoneInfo("America/Bogota"))
    except Exception:
        return datetime.now()


def _bogota_today_str() -> str:
    return _bogota_now().strftime("%Y-%m-%d")


@router.get("/api/v1/wellness-summary")
async def wellness_summary(user=Depends(get_current_user)):
    now = _bogota_now()
    today_str = now.strftime("%Y-%m-%d")
    week_start = (now - timedelta(days=now.weekday())).strftime("%Y-%m-%d")

    async def _fetch_missions():
        try:
            r = await asyncio.to_thread(lambda: supabase.table("missions").select("status").eq("user_id", user.id).eq("scheduled_at", today_str).execute())
            return r.data or []
        except Exception:
            return []

    async def _fetch_habits():
        try:
            h = await asyncio.to_thread(lambda: supabase.table("habits").select("id").eq("user_id", user.id).execute())
            habits = h.data or []
            if habits:
                ids = [x["id"] for x in habits]
                c = await asyncio.to_thread(lambda: supabase.table("habit_completions").select("habit_id,date").in_("habit_id", ids).eq("user_id", user.id).eq("date", today_str).execute())
                completions = c.data or []
                done = len(completions)
                return done, len(habits)
            return 0, 0
        except Exception:
            return 0, 0

    async def _fetch_focus():
        try:
            r = await asyncio.to_thread(lambda: supabase.table("focus_status").select("focus_streak").eq("user_id", user.id).limit(1).execute())
            return r.data[0].get("focus_streak", 0) if r.data else 0
        except Exception:
            return 0

    async def _fetch_weight_recent():
        try:
            r = await asyncio.to_thread(lambda: supabase.table("weight_logs").select("weight,date").eq("user_id", user.id).order("date", desc=True).limit(14).execute())
            return r.data or []
        except Exception:
            return []

    async def _fetch_sleep_recent():
        try:
            r = await asyncio.to_thread(lambda: supabase.table("sleep_logs").select("cycles,quality_score").eq("user_id", user.id).order("date", desc=True).limit(7).execute())
            return r.data or []
        except Exception:
            return []

    async def _fetch_finances_month():
        try:
            r = await asyncio.to_thread(lambda: supabase.table("finances").select("amount,type").eq("user_id", user.id).gte("date", now.strftime("%Y-%m-01")).execute())
            return r.data or []
        except Exception:
            return []

    async def _fetch_routine_completed_today():
        try:
            idx = now.weekday() + 1
            if idx > 6:
                idx = 0
            r = await asyncio.to_thread(lambda: supabase.table("routine_completions").select("id").eq("user_id", user.id).eq("day_index", idx).eq("completed_date", today_str).limit(1).execute())
            return bool(r.data)
        except Exception:
            return False

    missions_data, habits_result, focus, weights, sleep_data, finances, routine_done = await asyncio.gather(
        _fetch_missions(), _fetch_habits(), _fetch_focus(), _fetch_weight_recent(),
        _fetch_sleep_recent(), _fetch_finances_month(), _fetch_routine_completed_today(),
    )

    habits_done, habits_total = habits_result
    completed_missions = sum(1 for m in missions_data if m.get("status") == "completed")
    total_missions = len(missions_data)

    factors = []
    score = 0
    data_points = 0

    # --- Habitos ---
    if habits_total > 0:
        pct = habits_done / habits_total
        s = round(pct * 35)
        score += s
        data_points += 1
        factors.append({"name": "habitos", "label": "Habitos hoy", "value": f"{habits_done}/{habits_total}", "score": s, "max": 35})
    else:
        factors.append({"name": "habitos", "label": "Habitos hoy", "value": "sin datos", "score": None, "max": 35})

    # --- Misiones ---
    if total_missions > 0:
        pct = completed_missions / total_missions
        s = round(pct * 25)
        score += s
        data_points += 1
        factors.append({"name": "misiones", "label": "Misiones hoy", "value": f"{completed_missions}/{total_missions}", "score": s, "max": 25})
    else:
        factors.append({"name": "misiones", "label": "Misiones hoy", "value": "sin datos", "score": None, "max": 25})

    # --- Enfoque ---
    if focus >= 0:
        s = min(round(focus * 2.5), 15)
        score += s
        data_points += 1
        factors.append({"name": "enfoque", "label": "Racha enfoque", "value": f"{focus} dias", "score": s, "max": 15})
    else:
        factors.append({"name": "enfoque", "label": "Racha enfoque", "value": "sin datos", "score": None, "max": 15})

    # --- Peso ---
    if weights:
        s = 10
        data_points += 1
        factors.append({"name": "peso", "label": "Peso reciente", "value": "registrado", "score": s, "max": 10})
    else:
        factors.append({"name": "peso", "label": "Peso reciente", "value": "sin datos", "score": None, "max": 10})

    # --- Sueno ---
    if sleep_data:
        avg_cycles = sum(s.get("cycles", 5) for s in sleep_data) / len(sleep_data)
        s = min(round(avg_cycles * 2), 10)
        score += s
        data_points += 1
        factors.append({"name": "sueno", "label": "Sueno reciente", "value": f"{avg_cycles:.1f} ciclos", "score": s, "max": 10})
    else:
        factors.append({"name": "sueno", "label": "Sueno reciente", "value": "sin datos", "score": None, "max": 10})

    # --- Finanzas (solo si hay datos) ---
    income = sum(float(f.get("amount", 0)) for f in finances if str(f.get("type", "")).upper() == "INGRESO")
    expense = sum(float(f.get("amount", 0)) for f in finances if str(f.get("type", "")).upper() != "INGRESO")
    if finances:
        if income > 0:
            ratio = 1 - (expense / income)
            s = max(0, min(round(ratio * 5), 5))
        else:
            s = 0
        score += s
        data_points += 1
        factors.append({"name": "finanzas", "label": "Finanzas mes", "value": f"${int(income - expense):,}", "score": s, "max": 5})
    else:
        factors.append({"name": "finanzas", "label": "Finanzas mes", "value": "sin datos", "score": None, "max": 5})

    completeness = round(data_points / 6 * 100)

    # --- Insight deterministico ---
    insight = "Sigue construyendo tus habitos. Cada dia cuenta."
    action_route: Optional[str] = None
    action_label: Optional[str] = None

    if focus >= 7:
        insight = f"Racha solida de {focus} dias de enfoque. Estas construyendo disciplina real."
        action_route = "/salud"
        action_label = "Ver enfoque"
    elif habits_total > 0 and habits_done / habits_total < 0.5:
        insight = f"Solo {habits_done} de {habits_total} habitos completados hoy. Retoma el ritmo."
        action_route = "/habitos"
        action_label = "Ir a habitos"
    elif total_missions > 0 and completed_missions == 0:
        insight = "No has completado ninguna mision hoy. Empieza con la mas pequena."
        action_route = "/misiones"
        action_label = "Ir a misiones"
    elif not weights:
        insight = "Registra tu peso para que pueda seguir tu evolucion corporal."
        action_route = "/salud"
        action_label = "Registrar peso"
    elif sleep_data:
        avg = sum(s.get("cycles", 5) for s in sleep_data) / len(sleep_data)
        if avg < 4:
            insight = f"Tu promedio de {avg:.1f} ciclos de sueno esta bajo. Intenta dormir mas."
            action_route = "/salud"
            action_label = "Ver sueno"
    elif len(weights) >= 2:
        recent = weights[0].get("weight", 0)
        last_week = weights[-1].get("weight", recent) if len(weights) > 1 else recent
        if last_week and recent:
            diff = round(recent - last_week, 1)
            if abs(diff) > 0.5:
                trend = "bajando" if diff < 0 else "subiendo"
                insight = f"Tu peso ha variado {abs(diff)} kg en la ultima semana ({trend})."
                action_route = "/salud"
                action_label = "Ver peso"
    elif completeness < 50:
        insight = "Apenas estamos empezando. Completa tu perfil, turnos y habitos para mediciones mas precisas."

    return {
        "date": today_str,
        "score": min(score, 100),
        "completeness": completeness,
        "factors": factors,
        "insight": insight,
        "action_route": action_route,
        "action_label": action_label,
    }
