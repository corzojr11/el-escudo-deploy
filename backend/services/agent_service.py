import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from pydantic import BaseModel

from database import supabase

logger = logging.getLogger("escudo")


# ─── 8 Agent Checks ─────────────────────────────────────────────────────────

async def shifts_check(user_id: str, now: datetime) -> list[dict]:
    suggestions = []
    try:
        dias_es = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
        today_day_es = dias_es[now.weekday()]
        r = await asyncio.to_thread(
            lambda: supabase.table("shifts").select("*").eq("user_id", user_id).eq("day", today_day_es).order("start", desc=False).limit(1).execute()
        )
        if r.data and len(r.data) > 0:
            shift = r.data[0]
            start = shift.get("start", "")
            if start and start <= "07:00" and now.hour >= 22:
                suggestions.append({
                    "type": "sleep_reminder",
                    "title": "Hora de dormir",
                    "message": f"Tienes turno mañana a las {start}. Es hora de descansar.",
                    "priority": "high",
                })
    except Exception as e:
        logger.warning(f"agent shifts_check: {e}")
    return suggestions


async def habits_check(user_id: str, now: datetime) -> list[dict]:
    suggestions = []
    try:
        today_str = now.strftime("%Y-%m-%d")
        r = await asyncio.to_thread(
            lambda: supabase.table("habits").select("*").eq("user_id", user_id).gte("streak", 5).execute()
        )
        for habit in (r.data or []):
            completed = habit.get("completed_dates") or []
            if today_str not in completed:
                suggestions.append({
                    "type": "habit_streak",
                    "title": "Racha en riesgo",
                    "message": f'Tu racha de "{habit["name"]}" ({habit["streak"]} días) está en riesgo.',
                    "priority": "medium",
                })
                break
    except Exception as e:
        logger.warning(f"agent habits_check: {e}")
    return suggestions


async def weight_check(user_id: str, now: datetime) -> list[dict]:
    suggestions = []
    try:
        r = await asyncio.to_thread(
            lambda: supabase.table("weight_logs").select("*").eq("user_id", user_id).order("timestamp", desc=True).limit(1).execute()
        )
        if r.data and len(r.data) > 0:
            last_ts = r.data[0].get("timestamp") or r.data[0].get("created_at")
            if last_ts:
                last_dt = datetime.fromisoformat(last_ts.replace("Z", "+00:00").replace(" ", "T"))
                days_since = (now - last_dt).days
                if days_since > 7:
                    suggestions.append({
                        "type": "weight_reminder",
                        "title": "Registra tu peso",
                        "message": f"Hace {days_since} días que no registras peso.",
                        "priority": "low",
                    })
    except Exception as e:
        logger.warning(f"agent weight_check: {e}")
    return suggestions


async def exercise_check(user_id: str, now: datetime) -> list[dict]:
    suggestions = []
    try:
        three_days_ago = (now - timedelta(days=3)).isoformat()
        r = await asyncio.to_thread(
            lambda: supabase.table("exercises_logs").select("created_at").eq("user_id", user_id).gte("created_at", three_days_ago).limit(1).execute()
        )
        if not r.data or len(r.data) == 0:
            suggestions.append({
                "type": "exercise_reminder",
                "title": "Movete un poco",
                "message": "Hace 3 días que no registras ejercicio. Una caminata cuenta.",
                "priority": "medium",
            })
    except Exception as e:
        logger.warning(f"agent exercise_check: {e}")
    return suggestions


async def hydration_check(user_id: str, now: datetime) -> list[dict]:
    suggestions = []
    try:
        today_str = now.strftime("%Y-%m-%d")
        r = await asyncio.to_thread(
            lambda: supabase.table("habits").select("name, completed_dates, streak").eq("user_id", user_id).ilike("name", "%agua%").limit(1).execute()
        )
        if not r.data or len(r.data) == 0:
            r = await asyncio.to_thread(
                lambda: supabase.table("habits").select("name, completed_dates, streak").eq("user_id", user_id).ilike("name", "%hidrat%").limit(1).execute()
            )
        if r.data and len(r.data) > 0:
            completed = r.data[0].get("completed_dates") or []
            if today_str not in completed:
                suggestions.append({
                    "type": "hydration_reminder",
                    "title": "¿Ya tomaste agua?",
                    "message": "Recordá mantenerte hidratado. Tus hábitos te esperan.",
                    "priority": "low",
                })
    except Exception as e:
        logger.warning(f"agent hydration_check: {e}")
    return suggestions


async def break_check(user_id: str, now: datetime) -> list[dict]:
    suggestions = []
    try:
        dias_es = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
        today_day_es = dias_es[now.weekday()]
        r = await asyncio.to_thread(
            lambda: supabase.table("shifts").select("*").eq("user_id", user_id).eq("day", today_day_es).order("start", desc=False).limit(1).execute()
        )
        if r.data and len(r.data) > 0 and 10 <= now.hour <= 18:
            suggestions.append({
                "type": "break_reminder",
                "title": "Pausa activa",
                "message": "Llevás varias horas de actividad. Levántate, estirate y respirá hondo.",
                "priority": "medium",
            })
    except Exception as e:
        logger.warning(f"agent break_check: {e}")
    return suggestions


async def mood_check(user_id: str, now: datetime) -> list[dict]:
    suggestions = []
    try:
        r = await asyncio.to_thread(
            lambda: supabase.table("moods").select("created_at").eq("user_id", user_id).order("created_at", desc=True).limit(1).execute()
        )
        if not r.data or len(r.data) == 0:
            suggestions.append({
                "type": "mood_reminder",
                "title": "¿Cómo te sentís?",
                "message": "No has registrado tu estado de ánimo hoy. Un momento de introspección ayuda.",
                "priority": "low",
            })
        else:
            last_ts = r.data[0].get("created_at")
            if last_ts:
                last_dt = datetime.fromisoformat(last_ts.replace("Z", "+00:00").replace(" ", "T"))
                if (now - last_dt).days > 2:
                    suggestions.append({
                        "type": "mood_reminder",
                        "title": "¿Cómo te sentís?",
                        "message": "Hace días que no registras tu estado de ánimo. ¿Todo bien?",
                        "priority": "low",
                    })
    except Exception as e:
        logger.warning(f"agent mood_check: {e}")
    return suggestions


async def finance_check(user_id: str, now: datetime) -> list[dict]:
    suggestions = []
    try:
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
        r = await asyncio.to_thread(
            lambda: supabase.table("finances").select("amount").eq("user_id", user_id).gte("created_at", month_start).execute()
        )
        total = sum(item.get("amount", 0) for item in (r.data or []))
        days_left = ((now.replace(day=1) + timedelta(days=32)).replace(day=1) - now).days
        if total > 0 and days_left <= 5 and days_left >= 0:
            suggestions.append({
                "type": "budget_alert",
                "title": "Alerta financiera",
                "message": f"Llevas ${total:,.0f} en gastos este mes y quedan {days_left} días.",
                "priority": "medium",
            })
    except Exception as e:
        logger.warning(f"agent finance_check: {e}")
    return suggestions


async def run_agent_checks(user_id: str, now: Optional[datetime] = None) -> dict:
    if now is None:
        now = datetime.now(timezone.utc)
    results = await asyncio.gather(
        shifts_check(user_id, now),
        habits_check(user_id, now),
        weight_check(user_id, now),
        exercise_check(user_id, now),
        hydration_check(user_id, now),
        break_check(user_id, now),
        mood_check(user_id, now),
        finance_check(user_id, now),
    )
    suggestions = [s for sublist in results for s in sublist]
    return {"suggestions": suggestions, "checked_at": now.isoformat()}


# ─── Patterns Insights ──────────────────────────────────────────────────

class OmniPatternInsight(BaseModel):
    activity_type: str
    day_of_week: int
    hour_of_day: int
    confidence: float
    insight: str


class OmniPatternsResponse(BaseModel):
    patterns: list[OmniPatternInsight]
    suggestion: str = ""
    next_predicted_action: str = ""
    next_predicted_time: str = ""


async def get_patterns_insights(user_id: str) -> OmniPatternsResponse:
    now = datetime.now(timezone.utc)
    today_weekday = now.weekday()
    dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
    alias = {"weight_log": "registrar peso", "habit_check": "completar hábitos", "exercise_log": "entrenar", "finance_log": "registrar gastos", "omni_use": "usar OMNI", "mood_log": "registrar ánimo"}

    r = await asyncio.to_thread(
        lambda: supabase.table("user_activity_patterns")
            .select("*")
            .eq("user_id", user_id)
            .eq("enabled", True)
            .gte("confidence", 0.5)
            .order("confidence", desc=True)
            .execute()
    )

    patterns = []
    suggestion = ""
    next_action = ""
    next_time = ""

    for p in (r.data or []):
        atype = p["activity_type"]
        dow = p["day_of_week"]
        hod = p["hour_of_day"]
        conf = p.get("confidence", 0)
        label = alias.get(atype, atype)
        day_name = dias[dow] if 0 <= dow <= 6 else f"día {dow}"
        insight = f"Suele {label} los {day_name} a las {hod:02d}:00"
        patterns.append(OmniPatternInsight(
            activity_type=atype,
            day_of_week=dow,
            hour_of_day=hod,
            confidence=float(conf),
            insight=insight,
        ))

    today_patterns = [p for p in (r.data or []) if p["day_of_week"] == today_weekday]

    if today_patterns:
        closest = None
        min_diff = 999
        for p in today_patterns:
            diff = abs(p["hour_of_day"] - now.hour)
            if diff < min_diff:
                min_diff = diff
                closest = p
        if closest and min_diff <= 2:
            label = alias.get(closest["activity_type"], closest["activity_type"])
            hod = closest["hour_of_day"]
            suggestion = f"Es {dias[today_weekday]} por la mañana. ¿Quieres {label}?"
            if hod >= 12:
                suggestion = f"Es {dias[today_weekday]} por la tarde. ¿Quieres {label}?"
            if hod >= 20:
                suggestion = f"Es {dias[today_weekday]} por la noche. ¿Quieres {label}?"

        next_action = alias.get(closest["activity_type"], closest["activity_type"]) if closest else ""
        next_time = f"{closest['hour_of_day']:02d}:00" if closest else ""

    return OmniPatternsResponse(
        patterns=patterns,
        suggestion=suggestion,
        next_predicted_action=next_action,
        next_predicted_time=next_time,
    )
