"""Recordatorios push proactivos basados en patrones de uso del usuario.

Ejecutados por APScheduler desde main.py:
- analyze_user_patterns: 3:00 AM (diario)
- schedule_reminders: 6:00 AM (diario)
- send_due_reminders: cada 5 minutos
"""

import logging
from datetime import datetime, timedelta, timezone

from database import supabase

logger = logging.getLogger("escudo")

_ACTIVITY_TYPES = ("weight_log", "habit_check", "exercise_log", "finance_log", "omni_use", "mood_log")

_NOTIFICATION_BODIES = {
    "weight_log": "Sueles registrar tu peso ahora. ¿Quieres actualizarlo?",
    "habit_check": "Es hora de tu rutina. ¿Completaste tus hábitos hoy?",
    "exercise_log": "Tu hora de entrenamiento habitual. ¿Registraste tu sesión?",
    "finance_log": "Momento de revisar tus gastos. ¿Usaste OMNI para registrar?",
    "omni_use": "¿Necesitas ayuda de OMNI hoy?",
    "mood_log": "¿Cómo te sientes? Registra tu ánimo en un segundo.",
}

_DAILY_CAP = 3


# ─── Job 1: Analyze patterns (3 AM daily) ────────────────────────────────

def analyze_user_patterns():
    """Analiza las últimas 4 semanas de actividad y upserta patrones."""
    cutoff = datetime.now(timezone.utc) - timedelta(weeks=4)
    profiles = supabase.table("profiles").select("user_id").execute()
    users = [p["user_id"] for p in (profiles.data or [])]

    for uid in users:
        for activity_type in _ACTIVITY_TYPES:
            rows = _fetch_recent(uid, activity_type, cutoff)
            if not rows:
                continue
            buckets = _bucket_by_day_hour(rows)
            total_weeks = 4.0
            for (dow, hod), count in buckets.items():
                confidence = round(count / total_weeks, 2)
                if confidence < 0.50:
                    continue
                existing = supabase.table("user_activity_patterns") \
                    .select("id") \
                    .eq("user_id", uid) \
                    .eq("activity_type", activity_type) \
                    .eq("day_of_week", dow) \
                    .eq("hour_of_day", hod) \
                    .maybe_single() \
                    .execute()
                payload = {
                    "user_id": uid,
                    "activity_type": activity_type,
                    "day_of_week": dow,
                    "hour_of_day": hod,
                    "frequency": count,
                    "confidence": float(confidence),
                    "last_calculated_at": datetime.now(timezone.utc).isoformat(),
                }
                if existing.data:
                    supabase.table("user_activity_patterns") \
                        .update(payload) \
                        .eq("id", existing.data["id"]) \
                        .execute()
                else:
                    payload["enabled"] = True
                    supabase.table("user_activity_patterns") \
                        .insert(payload) \
                        .execute()

    logger.info("analyze_user_patterns completado para %d usuarios.", len(users))


# ─── Job 2: Schedule reminders (6 AM daily) ──────────────────────────────

def schedule_reminders():
    """Programa recordatorios para hoy basados en patrones con confianza >= 0.5."""
    today_dow = datetime.now(timezone.utc).weekday()
    patterns = supabase.table("user_activity_patterns") \
        .select("*") \
        .eq("day_of_week", today_dow) \
        .gte("confidence", 0.5) \
        .eq("enabled", True) \
        .execute()

    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    created = 0

    for p in (patterns.data or []):
        try:
            uid = p["user_id"]
            atype = p["activity_type"]
            hod = p["hour_of_day"]

            schedule_hour = hod - 1 if hod >= 1 else 0
            schedule_minute = 45
            scheduled = now.replace(
                hour=schedule_hour, minute=schedule_minute,
                second=0, microsecond=0,
            )
            if scheduled <= now:
                scheduled += timedelta(days=1)

            dup = supabase.table("reminder_schedules") \
                .select("id") \
                .eq("user_id", uid) \
                .eq("activity_type", atype) \
                .gte("scheduled_at", f"{today_str}T00:00:00Z") \
                .lt("scheduled_at", f"{today_str}T23:59:59Z") \
                .maybe_single() \
                .execute()
            if dup.data:
                continue

            supabase.table("reminder_schedules").insert({
                "user_id": uid,
                "activity_type": atype,
                "scheduled_at": scheduled.isoformat(),
            }).execute()
            created += 1
        except Exception as e:
            logger.warning("Error programando recordatorio para user=%s type=%s: %s", p.get("user_id"), p.get("activity_type"), e)

    logger.info("schedule_reminders: %d recordatorios creados.", created)


# ─── Job 3: Send due reminders (every 5 min) ─────────────────────────────

def send_due_reminders():
    """Envía notificaciones push para recordatorios vencidos no enviados."""
    now = datetime.now(timezone.utc)
    due = supabase.table("reminder_schedules") \
        .select("*") \
        .eq("sent", False) \
        .lte("scheduled_at", now.isoformat()) \
        .order("scheduled_at") \
        .limit(100) \
        .execute()

    sent_count = 0
    for r in (due.data or []):
        try:
            uid = r["user_id"]
            atype = r["activity_type"]

            already_today = supabase.table("reminder_schedules") \
                .select("id", count="exact") \
                .eq("user_id", uid) \
                .eq("sent", True) \
                .gte("scheduled_at", now.strftime("%Y-%m-%dT00:00:00Z")) \
                .execute()
            daily_sent = already_today.count if hasattr(already_today, 'count') else 0
            if daily_sent >= _DAILY_CAP:
                continue

            tokens_r = supabase.table("push_tokens") \
                .select("token") \
                .eq("user_id", uid) \
                .execute()
            tokens = [t["token"] for t in (tokens_r.data or [])]
            if not tokens:
                supabase.table("reminder_schedules") \
                    .update({"sent": True}) \
                    .eq("id", r["id"]) \
                    .execute()
                continue

            body = _NOTIFICATION_BODIES.get(atype, "Tienes un recordatorio pendiente.")
            messages = []
            from exponent_server_sdk import PushMessage
            for token in tokens:
                messages.append(PushMessage(to=token, body=body, title="Recordatorio Inteligente"))

            if messages:
                from exponent_server_sdk import PushClient, DeviceNotRegisteredError, PushTicketError
                response = PushClient().publish_multiple(messages)
                for ticket in response:
                    try:
                        ticket.validate_response()
                    except DeviceNotRegisteredError:
                        supabase.table("push_tokens").delete().eq("token", ticket.to).execute()
                    except PushTicketError as exc:
                        logger.warning("Error en ticket push: %s", exc)

            supabase.table("reminder_schedules").update({"sent": True}).eq("id", r["id"]).execute()
            sent_count += 1

        except Exception as e:
            logger.warning("Error enviando recordatorio %s: %s", r.get("id"), e)

    logger.info("send_due_reminders: %d enviados de %d pendientes.", sent_count, len(due.data or []))


# ─── Internal helpers ────────────────────────────────────────────────────

def _fetch_recent(user_id: str, activity_type: str, cutoff: datetime):
    """Obtiene registros de actividad recientes desde la tabla correspondiente."""
    c = cutoff.isoformat()
    queries = {
        "weight_log": lambda: supabase.table("weight_logs")
            .select("timestamp")
            .eq("user_id", user_id)
            .gte("timestamp", c)
            .execute(),
        "habit_check": lambda: supabase.table("habits")
            .select("updated_at")
            .eq("user_id", user_id)
            .gte("updated_at", c)
            .execute(),
        "exercise_log": lambda: supabase.table("exercises_logs")
            .select("created_at")
            .eq("user_id", user_id)
            .gte("created_at", c)
            .execute(),
        "finance_log": lambda: supabase.table("finances")
            .select("created_at")
            .eq("user_id", user_id)
            .gte("created_at", c)
            .execute(),
        "omni_use": lambda: supabase.table("omni_messages")
            .select("created_at")
            .eq("user_id", user_id)
            .eq("role", "user")
            .gte("created_at", c)
            .execute(),
        "mood_log": lambda: supabase.table("moods")
            .select("created_at")
            .eq("user_id", user_id)
            .gte("created_at", c)
            .execute(),
    }
    fn = queries.get(activity_type)
    if not fn:
        return []
    try:
        r = fn()
        return r.data or []
    except Exception as e:
        logger.warning("Error fetching %s for user %s: %s", activity_type, user_id, e)
        return []


def _bucket_by_day_hour(rows: list) -> dict:
    """Agrupa registros por (day_of_week, hour_of_day) y cuenta frecuencias."""
    buckets = {}
    for row in rows:
        ts_str = row.get("timestamp") or row.get("created_at") or row.get("updated_at")
        if not ts_str:
            continue
        try:
            dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            try:
                dt = datetime.strptime(str(ts_str)[:19], "%Y-%m-%dT%H:%M:%S")
            except (ValueError, TypeError):
                continue
        dow = dt.weekday()
        hod = dt.hour
        key = (dow, hod)
        buckets[key] = buckets.get(key, 0) + 1
    return buckets
