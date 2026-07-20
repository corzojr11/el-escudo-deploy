import asyncio
import logging
import base64
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel

try:
    from zoneinfo import ZoneInfo
except Exception:
    ZoneInfo = None  # type: ignore

try:
    from postgrest.exceptions import APIError as PostgrestAPIError
except Exception:
    PostgrestAPIError = Exception  # type: ignore

from auth import get_current_user
from bio import CYCLE_MINUTES
from database import supabase
from exceptions import ApiException
from services.observability import track_event
from services.gemini import get_gemini_client

logger = logging.getLogger("escudo")
router = APIRouter()

# ─── Sleep Optimizer constants ──────────────────────────────────────────────

LATENCIA_MINUTOS = 15
TIEMPO_POR_CICLO = CYCLE_MINUTES + LATENCIA_MINUTOS

BUFFER_PRE_SHIFT  = 45
BUFFER_POST_SHIFT = 75

# ─── Timezone / weekday helpers ───────────────────────────────────────────────

DAY_NAMES_ES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]


def _bogota_now() -> datetime:
    """Hora actual en America/Bogotá; fallback a hora local del servidor."""
    if ZoneInfo:
        try:
            return datetime.now(ZoneInfo("America/Bogota"))
        except Exception as exc:
            logger.warning(f"No se pudo usar zona America/Bogota: {exc}")
    return datetime.now()


def _day_name_to_index(name: str) -> int:
    raw = (name or "").strip().lower()
    mapping = {
        "lunes": 0,
        "martes": 1,
        "miercoles": 2,
        "miércoles": 2,
        "jueves": 3,
        "viernes": 4,
        "sabado": 5,
        "sábado": 5,
        "domingo": 6,
    }
    return mapping.get(raw, 99)


def _day_index_to_name(index: int) -> str:
    if 0 <= index <= 6:
        return DAY_NAMES_ES[index]
    return ""


def _normalize_day_name_text(value: str) -> str:
    return _day_index_to_name(_day_name_to_index(value))


def _parse_time(t_str: str) -> tuple:
    parts = t_str.strip().split(":")
    return int(parts[0]), int(parts[1]) if len(parts) > 1 else 0


def _time_to_minutes(h: int, m: int) -> int:
    return h * 60 + m


def _minutes_to_time(total_min: int) -> str:
    total_min = total_min % (24 * 60)
    return f"{total_min // 60:02d}:{total_min % 60:02d}"


def _optimizar_ciclos(minutos_libres: int):
    max_posibles = minutos_libres // TIEMPO_POR_CICLO
    if max_posibles >= 6 and minutos_libres >= 9 * 60:
        return 6
    elif max_posibles >= 5:
        return 5
    elif max_posibles >= 4:
        return 4
    else:
        return max(0, max_posibles)


class SleepLogPayload(BaseModel):
    date: str
    bed_time: str
    wake_time: str
    cycles: int = 5
    quality_score: int = 3
    notes: str = ""


class ShiftPayload(BaseModel):
    day: str
    start: str
    end: str
    type: Optional[str] = "work"
    idempotency_key: Optional[str] = None


class WakeTimePayload(BaseModel):
    t_wake_target: str


def _normalize_time_text(value: str) -> str:
    raw = (value or "").strip().upper()
    if not raw:
        return ""
    if "AM" in raw or "PM" in raw:
        try:
            t = datetime.strptime(raw.replace(".", ""), "%I:%M %p")
            return t.strftime("%H:%M")
        except Exception:
            try:
                t = datetime.strptime(raw.replace(".", ""), "%I %p")
                return t.strftime("%H:%M")
            except Exception:
                return ""
    if ":" in raw:
        try:
            hh, mm = raw.split(":")[:2]
            hour = int(hh)
            minute = int(mm[:2])
            if 0 <= hour <= 23 and 0 <= minute <= 59:
                return f"{hour:02d}:{minute:02d}"
        except Exception:
            return ""
    return ""


def _extract_json_object(raw_text: str) -> dict:
    raw = (raw_text or "").strip()
    if not raw:
        return {}
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return {}
    try:
        return json.loads(raw[start : end + 1])
    except Exception:
        return {}


# ─── Core shift status computation (exported for /today) ─────────────────────


def _is_unique_conflict(exc: Exception) -> bool:
    code = getattr(exc, "code", None) or ""
    msg = str(exc).lower()
    return (
        code == "23505"
        or "duplicate key value" in msg
        or "unique constraint" in msg
        or "duplicate key" in msg
    )


def _shift_instance_minutes(shift: dict) -> Optional[tuple[int, int, int]]:
    """
    Devuelve (day_index, inicio_minutos, fin_minutos) para un turno.
    Si el turno cruza medianoche, fin > 24*60.
    """
    shift_day = _day_name_to_index(shift.get("day", ""))
    if shift_day == 99:
        return None

    sh, sm = _parse_time(shift.get("start", "00:00"))
    eh, em = _parse_time(shift.get("end", "23:59"))
    inicio = _time_to_minutes(sh, sm)
    fin = _time_to_minutes(eh, em)
    if fin <= inicio:
        fin += 24 * 60
    return (shift_day, inicio, fin)


def _build_shift_instances(shifts_data: list) -> list[dict]:
    """Helper compartido: normaliza turnos y genera instancias k=-1,0,1
    con start_total/end_total absolutos en minutos desde Lunes 00:00.
    Maneja acentos, turnos nocturnos y domingo-lunes."""
    instances = []
    week_minutes = 7 * 24 * 60

    for s in shifts_data:
        if not isinstance(s, dict):
            continue
        day = _normalize_day_name_text(s.get("day", ""))
        if not day:
            continue
        start = _normalize_time_text(s.get("start", ""))
        end = _normalize_time_text(s.get("end", ""))
        if not start or not end:
            continue
        if start == "00:00" and end == "00:01":
            continue
        if s.get("type", "work") != "work":
            continue
        parsed = _shift_instance_minutes({"day": day, "start": start, "end": end})
        if parsed is None:
            continue
        day_index, inicio, fin = parsed
        base_start = day_index * 24 * 60 + inicio
        base_end = day_index * 24 * 60 + fin
        for k in (-1, 0, 1):
            instances.append({
                "day": day,
                "start": start,
                "end": end,
                "start_total": base_start + k * week_minutes,
                "end_total": base_end + k * week_minutes,
            })
    return instances


def compute_current_status(shifts_data: list, now: Optional[datetime] = None, bio_settings: Optional[dict] = None) -> dict:
    """Calcula el estado de turno actual/proximo a partir de una lista de turnos."""
    if now is None:
        now = _bogota_now()

    hoy_index = now.weekday()
    ahora_minutos = now.hour * 60 + now.minute
    now_total = hoy_index * 24 * 60 + ahora_minutos

    instances = _build_shift_instances(shifts_data)

    if not instances:
        return {"status": "free", "message_short": "Sin turnos registrados.", "is_rest_day": False, "is_travel_day": False}

    # 1. Comprobar primero si está en turno activo (cubre overnight y cruzados)
    for inst in instances:
        if inst["start_total"] <= now_total < inst["end_total"]:
            remaining_hours = round((inst["end_total"] - now_total) / 60, 1)
            return {
                "status": "in_shift",
                "shift": {"day": inst["day"], "start": inst["start"], "end": inst["end"], "remaining_hours": remaining_hours},
                "message_short": f"Turno activo hasta las {inst['end']} ({remaining_hours}h restantes).",
                "is_rest_day": False,
                "is_travel_day": False,
            }

    # 2. Si no está en turno activo, evaluar overrides y día de descanso
    is_rest_day = False
    is_travel_day = False
    if bio_settings:
        override_status = bio_settings.get("today_override_status") or "normal"
        override_date = bio_settings.get("today_override_date")
        today_str = now.strftime("%Y-%m-%d")
        if override_date == today_str and override_status in ("rest", "travel"):
            if override_status == "rest":
                is_rest_day = True
            elif override_status == "travel":
                is_travel_day = True

    if not is_rest_day and not is_travel_day:
        shifts_today = [
            s for s in shifts_data
            if s.get("is_active", True) is not False and
               (_day_name_to_index(s.get("day", "")) if s.get("day_index") is None else s.get("day_index")) == hoy_index
        ]
        if not shifts_today:
            is_rest_day = True
        else:
            def get_shift_type(s: dict) -> str:
                t = s.get("type")
                if t and t != "work":
                    return t
                if s.get("start") == "00:00" and s.get("end") == "00:01":
                    ikey = str(s.get("idempotency_key") or "").lower()
                    if "travel" in ikey:
                        return "travel"
                    return "rest"
                return t or "work"

            has_work = any(get_shift_type(s) == "work" for s in shifts_today)
            has_travel = any(get_shift_type(s) == "travel" for s in shifts_today)
            has_rest = any(get_shift_type(s) == "rest" for s in shifts_today)
            
            if has_travel:
                is_travel_day = True
            elif has_rest:
                is_rest_day = True
            elif not has_work:
                is_rest_day = True

    # Encontrar el próximo turno en el futuro
    proximo = None
    min_diff = None
    for inst in instances:
        diff = inst["start_total"] - now_total
        if diff > 0 and (min_diff is None or diff < min_diff):
            min_diff = diff
            proximo = inst

    if is_rest_day or is_travel_day:
        status_label = "free"
        msg = "Día de descanso. Libre."
        if is_travel_day:
            msg = "Fuera de la ciudad (Viaje). Libre."
            
        res_dict = {
            "status": status_label,
            "message_short": msg,
            "is_rest_day": is_rest_day,
            "is_travel_day": is_travel_day,
        }
        if proximo:
            starts_in_hours = round((proximo["start_total"] - now_total) / 60, 1)
            res_dict["next_shift"] = {
                "day": proximo["day"],
                "start": proximo["start"],
                "end": proximo["end"],
                "starts_in_hours": starts_in_hours
            }
        return res_dict

    if proximo:
        starts_in_hours = round((proximo["start_total"] - now_total) / 60, 1)
        return {
            "status": "free",
            "next_shift": {"day": proximo["day"], "start": proximo["start"], "end": proximo["end"], "starts_in_hours": starts_in_hours},
            "message_short": f"Libre. Proximo turno: {proximo['day']} {proximo['start']} (en {starts_in_hours}h).",
            "is_rest_day": is_rest_day,
            "is_travel_day": is_travel_day,
        }

    return {"status": "free", "message_short": "Sin turnos registrados.", "is_rest_day": is_rest_day, "is_travel_day": is_travel_day}


async def _fetch_shift_by_idempotency(user_id: str, key: str) -> Optional[dict]:
    try:
        res = await asyncio.to_thread(
            lambda: supabase.table("shifts")
            .select("*")
            .eq("user_id", user_id)
            .eq("idempotency_key", key)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None
    except Exception as exc:
        logger.warning(f"shift idempotency lookup error: {exc}")
        return None


async def _fetch_shift_by_day_time(user_id: str, day: str, start: str, end: str) -> dict | None:
    try:
        res = await asyncio.to_thread(
            lambda: supabase.table("shifts")
            .select("*")
            .eq("user_id", user_id)
            .eq("day", day)
            .eq("start", start)
            .eq("end", end)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None
    except Exception as exc:
        logger.warning(f"shift day-time lookup error: {exc}")
        return None


async def _insert_shift_row(user_id: str, payload: dict) -> dict:
    day = _normalize_day_name_text(payload.get("day", ""))
    start = _normalize_time_text(payload.get("start", ""))
    end = _normalize_time_text(payload.get("end", ""))
    shift_type = payload.get("type") or "work"
    idempotency_key = str(payload.get("idempotency_key") or "").strip() or None

    insert_data = {
        "user_id": user_id,
        "day": day,
        "start": start,
        "end": end,
        "type": shift_type,
        "is_active": True,
    }
    if idempotency_key:
        insert_data["idempotency_key"] = idempotency_key

    try:
        try:
            res = await asyncio.to_thread(lambda: supabase.table("shifts").insert(insert_data).execute())
        except Exception as exc:
            exc_msg = str(exc).lower()
            if 'column "type"' in exc_msg or 'type' in exc_msg:
                # Column doesn't exist yet, retry without type
                insert_data.pop("type", None)
                res = await asyncio.to_thread(lambda: supabase.table("shifts").insert(insert_data).execute())
            else:
                raise
    except Exception as exc:
        exc_msg = str(exc).lower()
        if 'column "date"' in exc_msg and ('not-null' in exc_msg or 'violates' in exc_msg):
            insert_data["date"] = datetime.now().strftime("%Y-%m-%d")
            try:
                res = await asyncio.to_thread(lambda: supabase.table("shifts").insert(insert_data).execute())
            except Exception as retry_exc:
                if _is_unique_conflict(retry_exc):
                    existing = None
                    if idempotency_key:
                        existing = await _fetch_shift_by_idempotency(user_id, idempotency_key)
                    if not existing:
                        existing = await _fetch_shift_by_day_time(user_id, day, start, end)
                    if existing:
                        return existing
                logger.warning(f"shift insert retry with date failed: {retry_exc}")
                raise retry_exc
        else:
            if _is_unique_conflict(exc):
                existing = None
                if idempotency_key:
                    existing = await _fetch_shift_by_idempotency(user_id, idempotency_key)
                if not existing:
                    existing = await _fetch_shift_by_day_time(user_id, day, start, end)
                if existing:
                    return existing
            logger.warning(f"shift insert failed: {exc}")
            raise

    return res.data[0] if res.data else insert_data


# ─── Endpoints ──────────────────────────────────────────────────────────────


@router.get("/api/v1/shifts")
async def list_shifts(user = Depends(get_current_user)):
    s = await asyncio.to_thread(
        lambda: supabase.table("shifts")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", True)
        .order("day_index", desc=False)
        .order("start", desc=False)
        .execute()
    )
    shifts_list = s.data or []
    from bio import check_shift_conflicts
    conflicts = check_shift_conflicts(shifts_list)
    return {"shifts": shifts_list, "conflicts": conflicts}


@router.post("/api/v1/shifts/upload-image")
async def upload_shift_image(
    file: UploadFile = File(...),
    user_name: str = Form("Usuario"),
    user = Depends(get_current_user),
):
    _ai_client = get_gemini_client()
    if _ai_client is None:
        raise ApiException(status_code=503, detail="OCR no disponible. Configura GEMINI_API_KEY para escaneo de horario.")

    raw_bytes = await file.read()
    if not raw_bytes:
        raise ApiException(status_code=400, detail="La imagen del horario está vacía.")
    if len(raw_bytes) > 8_000_000:
        raise ApiException(status_code=400, detail="La imagen es demasiado grande. Usa una imagen menor a 8MB.")

    image_b64 = base64.b64encode(raw_bytes).decode("utf-8")
    prompt = (
        "Analiza esta imagen de un horario laboral y extrae todos los turnos visibles. "
        "Devuelve SOLO JSON válido con estas llaves exactas: "
        "shifts (array de objetos con day, start, end), confidence (0 a 1), notes (string). "
        "Formato obligatorio: day debe ser uno de Lunes, Martes, Miércoles, Jueves, Viernes, Sábado, Domingo. "
        "start y end deben ir en formato 24h HH:MM. "
        "Si hay varios turnos, extrae todos. "
        f"El nombre del usuario es {user_name}. "
        "Si no puedes leer claramente, devuelve shifts vacio, confidence 0.2 y notes con una recomendación breve. "
        "No incluyas texto adicional."
    )

    try:
        response = await _ai_client.aio.models.generate_content(
            model="models/gemini-2.5-flash-lite",
            contents=[
                {
                    "role": "user",
                    "parts": [
                        {"text": prompt},
                        {
                            "inline_data": {
                                "mime_type": file.content_type or "image/jpeg",
                                "data": image_b64,
                            }
                        },
                    ],
                }
            ],
        )
        parsed = _extract_json_object(response.text or "")
    except Exception as e:
        logger.warning(f"upload_shift_image AI error: {e}")
        raise ApiException(status_code=500, detail="No se pudo escanear la imagen del horario.")

    raw_shifts = parsed.get("shifts") or []
    shifts = []
    for item in raw_shifts:
        if not isinstance(item, dict):
            continue
        day = _normalize_day_name_text(str(item.get("day") or ""))
        start = _normalize_time_text(str(item.get("start") or ""))
        end = _normalize_time_text(str(item.get("end") or ""))
        if day and start and end:
            shifts.append({
                "day": day,
                "start": start,
                "end": end,
            })

    confidence = parsed.get("confidence", 0.4)
    try:
        confidence = max(0.0, min(1.0, float(confidence)))
    except Exception:
        confidence = 0.4

    notes = str(parsed.get("notes") or "").strip()
    if not shifts:
        return {
            "shifts": [],
            "confidence": confidence,
            "notes": notes or "No pude leer turnos con suficiente claridad. Completa manualmente.",
            "fallback_mode": "manual_review_required",
        }

    # Guardamos los turnos detectados y devolvemos la versión persistida.
    inserted = []
    for shift in shifts:
        res = await asyncio.to_thread(lambda s=shift: supabase.table("shifts").upsert({
            "user_id": user.id,
            "day": s["day"],
            "start": s["start"],
            "end": s["end"],
            "is_active": True,
        }, on_conflict="user_id,day,start,end").execute())
        if res.data:
            inserted.extend(res.data)
        else:
            inserted.append({
                "user_id": user.id,
                "day": shift["day"],
                "start": shift["start"],
                "end": shift["end"],
                "is_active": True,
            })

    await track_event(
        "schedule",
        "upload_shift_image",
        user_id=user.id,
        metadata={"confidence": confidence, "detected_shifts": len(inserted)},
    )
    return {
        "shifts": inserted,
        "confidence": confidence,
        "notes": notes or f"Se detectaron {len(inserted)} turnos.",
    }


@router.post("/api/v1/shifts")
async def create_shift(payload: ShiftPayload, user = Depends(get_current_user)):
    try:
        day = _normalize_day_name_text(payload.day)
        if not day:
            raise ApiException(status_code=400, detail="Día de la semana inválido.")
        start = _normalize_time_text(payload.start)
        end = _normalize_time_text(payload.end)
        if not start or not end:
            raise ApiException(status_code=400, detail="Formato de hora inválido (HH:MM).")
        created = await _insert_shift_row(user.id, payload.model_dump(exclude_unset=True))
        await track_event("schedule", "create_shift", user_id=user.id, metadata={"day": day, "start": start, "end": end})
        return {"shift": created}
    except ApiException:
        raise
    except Exception as exc:
        logger.error(f"Error in create_shift: {exc}", exc_info=True)
        raise ApiException(status_code=500, detail=f"Error al guardar el turno: {str(exc)}")


@router.put("/api/v1/shifts/{shift_id}")
async def update_shift(shift_id: str, payload: ShiftPayload, user = Depends(get_current_user)):
    try:
        day = _normalize_day_name_text(payload.day)
        if not day:
            raise ApiException(status_code=400, detail="Día de la semana inválido.")
        start = _normalize_time_text(payload.start)
        end = _normalize_time_text(payload.end)
        if not start or not end:
            raise ApiException(status_code=400, detail="Formato de hora inválido (HH:MM).")
        
        update_data = {
            "day": day,
            "start": start,
            "end": end,
            "type": payload.type or "work",
        }
        try:
            res = await asyncio.to_thread(lambda: supabase.table("shifts").update(update_data).eq("id", shift_id).eq("user_id", user.id).execute())
        except Exception as exc:
            exc_msg = str(exc).lower()
            if 'column "type"' in exc_msg or 'type' in exc_msg:
                update_data.pop("type", None)
                res = await asyncio.to_thread(lambda: supabase.table("shifts").update(update_data).eq("id", shift_id).eq("user_id", user.id).execute())
            else:
                raise

        if not res.data:
            raise ApiException(status_code=404, detail="Turno no encontrado.")
        await track_event("schedule", "update_shift", user_id=user.id, metadata={"shift_id": shift_id, "day": day, "start": start, "end": end})
        return {"shift": res.data[0]}
    except ApiException:
        raise
    except Exception as exc:
        logger.error(f"Error in update_shift: {exc}", exc_info=True)
        raise ApiException(status_code=500, detail=f"Error al actualizar el turno: {str(exc)}")


@router.delete("/api/v1/shifts/{shift_id}")
async def delete_shift(shift_id: str, user = Depends(get_current_user)):
    res = await asyncio.to_thread(lambda: supabase.table("shifts").delete().eq("id", shift_id).eq("user_id", user.id).execute())
    if not res.data:
        raise ApiException(status_code=404, detail="Turno no encontrado.")
    await track_event("schedule", "delete_shift", user_id=user.id, metadata={"shift_id": shift_id})
    return {"detail": "Turno eliminado exitosamente"}


@router.get("/api/v1/sleep-analysis")
async def get_sleep_analysis(user = Depends(get_current_user)):
    logs = await asyncio.to_thread(lambda: supabase.table("sleep_logs").select("*").eq("user_id", user.id).order("date", desc=True).limit(7).execute())
    data = logs.data or []
    total_hours = sum((l.get("cycles", 5) * 1.5) for l in data) if data else 0
    avg_q = sum(l.get("quality_score", 3) for l in data) / len(data) if data else 0
    avg_c = sum(l.get("cycles", 5) for l in data) / len(data) if data else 5
    debt = max(0, (7 * 7.5 - total_hours) / 7)
    return {
        "logs": data, "average_cycles": round(avg_c, 1), "average_quality": round(avg_q, 1),
        "total_hours_week": round(total_hours, 1), "daily_debt_hours": round(debt, 2),
        "recommendation": f"Promedio de {round(avg_c,1)} ciclos/noche. {'Deuda: '+str(round(debt,1))+'h/día.' if debt > 0.5 else 'Ritmo estable.'}",
    }


@router.post("/api/v1/sleep-log")
async def log_sleep(payload: SleepLogPayload, user = Depends(get_current_user)):
    res = await asyncio.to_thread(lambda: supabase.table("sleep_logs").insert({
        "user_id": user.id, "date": payload.date, "bed_time": payload.bed_time,
        "wake_time": payload.wake_time, "cycles": payload.cycles,
        "quality_score": payload.quality_score, "notes": payload.notes,
    }).execute())
    if not res.data:
        raise ApiException(status_code=500, detail="No se pudo registrar el sueño.")
    delta = 7.5 - res.data[0].get("cycles", 5) * 1.5
    bio = await asyncio.to_thread(lambda: supabase.table("user_bio_settings").select("sleep_debt_hours").eq("user_id", user.id).limit(1).execute())
    new_debt = max(0, (float(bio.data[0]["sleep_debt_hours"]) if bio.data else 0) + delta)
    await asyncio.to_thread(lambda: supabase.table("user_bio_settings").update({"sleep_debt_hours": new_debt}).eq("user_id", user.id).execute())
    await track_event("schedule", "log_sleep", user_id=user.id, metadata={"date": payload.date, "cycles": payload.cycles, "quality_score": payload.quality_score})
    return {"sleep_log": res.data[0], "updated_debt": new_debt}


@router.put("/api/v1/wake-time")
async def set_wake_time(payload: WakeTimePayload, user = Depends(get_current_user)):
    existing = await asyncio.to_thread(lambda: supabase.table("user_bio_settings").select("id").eq("user_id", user.id).limit(1).execute())
    data = {"user_id": user.id, "t_wake_target": payload.t_wake_target}
    if existing.data:
      res = await asyncio.to_thread(lambda: supabase.table("user_bio_settings").update(data).eq("user_id", user.id).execute())
    else:
      res = await asyncio.to_thread(lambda: supabase.table("user_bio_settings").insert(data).execute())
    if not res.data:
        raise ApiException(status_code=500, detail="No se pudo actualizar la hora de despertar.")
    await track_event("schedule", "set_wake_time", user_id=user.id, metadata={"t_wake_target": payload.t_wake_target})
    return {"bio_settings": res.data[0]}


@router.get("/api/v1/sleep-optimizer")
async def sleep_optimizer(user = Depends(get_current_user)):
    now = _bogota_now()
    hoy_nombre = DAY_NAMES_ES[now.weekday()]

    shifts = await asyncio.to_thread(lambda: supabase.table("shifts").select("*").eq("user_id", user.id).eq("day", hoy_nombre).eq("is_active", True).execute())
    shifts_data = shifts.data or []

    if not shifts_data:
        bio = await asyncio.to_thread(lambda: supabase.table("user_bio_settings").select("*").eq("user_id", user.id).limit(1).execute())
        bs = bio.data[0] if bio.data else {"t_sleep_target": "22:30", "t_wake_target": "06:00"}
        sleep_h, sleep_m = _parse_time(bs["t_sleep_target"])
        wake_h,  wake_m  = _parse_time(bs["t_wake_target"])
        inicio  = _time_to_minutes(sleep_h, sleep_m)
        destino = _time_to_minutes(wake_h, wake_m)
        if destino <= inicio:
            destino += 24 * 60
        minutos_libres = destino - inicio
        ciclos = _optimizar_ciclos(minutos_libres)
        alarma = (inicio + ciclos * TIEMPO_POR_CICLO) % (24 * 60)
        return {
            "source": "bio_settings",
            "free_hours": round(minutos_libres / 60, 1),
            "selected_cycles": ciclos,
            "alarm_time": _minutes_to_time(alarma),
            "sleep_start": _minutes_to_time(inicio),
            "message": f"He analizado tu ritmo. Sin turno hoy, tienes {minutos_libres // 60}h libres. He programado {ciclos} ciclos para que despiertes al 100% a las {_minutes_to_time(alarma)}.",
        }

    start_h, start_m = _parse_time(shifts_data[0].get("start", "08:00"))
    end_h,   end_m   = _parse_time(shifts_data[0].get("end", "17:00"))

    ts = _time_to_minutes(start_h, start_m)
    te = _time_to_minutes(end_h, end_m)
    if te <= ts:
        te += 24 * 60

    buffer_fin  = te + BUFFER_POST_SHIFT
    buffer_manana = ts + 24 * 60 - BUFFER_PRE_SHIFT
    minutos_libres = buffer_manana - buffer_fin

    ciclos = _optimizar_ciclos(minutos_libres)
    dormir_en = buffer_fin % (24 * 60)
    alarma_en = (buffer_fin + ciclos * TIEMPO_POR_CICLO) % (24 * 60)

    alerta = None
    if ciclos < 4:
        if ciclos <= 0:
            alerta = "ALERTA DE FATIGA: No hay ventana suficiente para completar ni un ciclo. Revisa tu carga laboral."
        else:
            alerta = f"ALERTA: Solo {ciclos} ciclos disponibles. Menos de 4 genera déficit cognitivo."

    return {
        "source": "work_shift",
        "free_hours": round(minutos_libres / 60, 1),
        "selected_cycles": ciclos,
        "alarm_time": _minutes_to_time(alarma_en),
        "sleep_start": _minutes_to_time(dormir_en),
        "fatigue_alert": alerta,
        "message": f"He analizado tu turno. Tienes {minutos_libres // 60} horas libres. He programado {ciclos} ciclos para que despiertes al 100% a las {_minutes_to_time(alarma_en)}." + (f" {alerta}" if alerta else ""),
    }


@router.get("/api/v1/current-status")
async def current_status(user = Depends(get_current_user)):
    shifts = await asyncio.to_thread(lambda: supabase.table("shifts").select("*").eq("user_id", user.id).eq("is_active", True).execute())
    shifts_data = shifts.data or []
    return compute_current_status(shifts_data)


def _sleep_windows_from_wake(wake_h: int, wake_m: int) -> list[dict]:
    target = _time_to_minutes(wake_h, wake_m)
    windows = []
    for c in [6, 5, 4]:
        total_sleep = c * CYCLE_MINUTES + LATENCIA_MINUTOS
        sleep_mins = (target - total_sleep) % (24 * 60)
        windows.append({
            "cycles": c,
            "hours": round(total_sleep / 60, 1),
            "sleep_time": _minutes_to_time(sleep_mins),
            "wake_time": _minutes_to_time(target),
        })
    return windows


def _find_next_shift(shifts_data: list, now: datetime) -> dict | None:
    """Encuentra la proxima instancia real de turno. Reutiliza _build_shift_instances."""
    instances = _build_shift_instances(shifts_data)
    if not instances:
        return None

    hoy_index = now.weekday()
    ahora_minutos = now.hour * 60 + now.minute
    now_total = hoy_index * 24 * 60 + ahora_minutos

    proximo = None
    min_diff = None
    for inst in instances:
        diff = inst["start_total"] - now_total
        if diff > 0 and (min_diff is None or diff < min_diff):
            min_diff = diff
            proximo = inst

    if not proximo:
        return None

    sh, sm = _parse_time(proximo["start"])
    eh, em = _parse_time(proximo["end"])
    start_min = _time_to_minutes(sh, sm)
    end_min = _time_to_minutes(eh, em)
    if end_min <= start_min:
        end_min += 24 * 60

    return {
        "day": proximo["day"],
        "start": proximo["start"],
        "end": proximo["end"],
        "start_total": proximo["start_total"],
        "end_total": proximo["end_total"],
        "start_minutes": start_min,
        "end_minutes": end_min,
    }


def _generate_companion_timeline(
    now: datetime,
    shift_status: dict,
    sleep_windows: list,
    workout_block: dict,
    is_rest_day: bool,
    is_travel_day: bool,
    commute: int,
    wake_target: str,
    sleep_target: str
) -> list[dict]:
    # 1. Determinar hora de despertar
    wake_time_str = wake_target
    if sleep_windows and len(sleep_windows) > 0:
        wake_time_str = sleep_windows[0].get("wake_time", wake_target)
    
    wake_h, wake_m = _parse_time(wake_time_str)
    wake_mins = wake_h * 60 + wake_m
    
    # 2. Determinar hora de dormir
    sleep_time_str = sleep_target
    if sleep_windows and len(sleep_windows) > 0:
        sleep_time_str = sleep_windows[0].get("sleep_time", sleep_target)

    sleep_h, sleep_m = _parse_time(sleep_time_str)
    sleep_mins = sleep_h * 60 + sleep_m
    if sleep_mins < wake_mins:
        sleep_mins += 1440

    timeline = []

    # Determinar si hay un turno de trabajo activo hoy
    has_work_today = False
    shift_start_mins = None
    shift_end_mins = None
    
    if shift_status and not is_rest_day and not is_travel_day:
        shift = shift_status.get("shift")
        if not shift and shift_status.get("next_shift"):
            next_s = shift_status["next_shift"]
            dias_es = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]
            hoy_es = dias_es[now.weekday()]
            if next_s.get("day", "").lower() == hoy_es.lower():
                shift = next_s
        
        if shift:
            has_work_today = True
            sh, sm = _parse_time(shift.get("start", "08:00"))
            eh, em = _parse_time(shift.get("end", "17:00"))
            shift_start_mins = sh * 60 + sm
            shift_end_mins = eh * 60 + em
            if shift_end_mins <= shift_start_mins:
                shift_end_mins += 1440

    if has_work_today and shift_start_mins is not None and shift_end_mins is not None:
        # --- CASO JORNADA LABORAL ---
        
        # 1. Despertar y Preparación (Bañarse se integra aquí)
        timeline.append({
            "time": wake_time_str,
            "title": "🌅 Despertar y Preparación",
            "description": "¡Buenos días! Toma un vaso de agua para hidratarte, haz una ducha rápida para activar tu cuerpo y disponte a iniciar el día.",
            "type": "wake"
        })

        # 2. Alimento Pre-Jornada
        comida_mins = (wake_mins + 30) % 1440
        if wake_mins >= 10 * 60 + 30: # Despertar tarde (después de las 10:30 AM)
            # Combinar en almuerzo/brunch directo
            timeline.append({
                "time": _minutes_to_time(comida_mins),
                "title": "🍲 Almuerzo / Brunch",
                "description": "Dado que despertaste tarde, combina tu desayuno y almuerzo. Prepara una comida completa con buena proteína y grasas saludables antes de ir a trabajar.",
                "type": "lunch"
            })
        else:
            # Desayuno normal
            timeline.append({
                "time": _minutes_to_time(comida_mins),
                "title": "🍳 Desayuno Pre-Jornada",
                "description": "Prepara huevos, avena o pan integral y café. Te dará energía sostenida para el inicio de tu turno.",
                "type": "breakfast"
            })

        # 3. Turno Laboral (Camino al trabajo se integra aquí)
        commute_mins_start = (shift_start_mins - commute - 10) % 1440
        commute_time_str = _minutes_to_time(commute_mins_start)
        timeline.append({
            "time": _minutes_to_time(shift_start_mins % 1440),
            "title": "💼 Jornada Laboral",
            "description": f"Inicio de labores. Traslado sugerido: salir a las {commute_time_str} ({commute} min de camino). Mantente enfocado, bebe agua y haz pausas activas.",
            "type": "work"
        })

        # 4. Ocio y Desconexión (Juegos y Lectura se integran aquí después del trabajo)
        ocio_mins = (shift_end_mins + 30) % 1440
        timeline.append({
            "time": _minutes_to_time(ocio_mins),
            "title": "🎮 Ocio y Desconexión",
            "description": "¡Jornada terminada! Espacio libre para jugar, ver series o leer. Apaga las pantallas al menos 30 minutos antes de dormir.",
            "type": "leisure"
        })

        # 5. Sueño Reparador
        timeline.append({
            "time": sleep_time_str,
            "title": "🌙 Sueño Reparador",
            "description": "Habitación fresca, oscura y silenciosa. Hora de apagar luces para recuperar tu energía. ¡Buenas noches, Samid!",
            "type": "sleep"
        })

    else:
        # --- CASO DÍA LIBRE / VIAJE / DESCANSO ---
        
        # 1. Despertar
        timeline.append({
            "time": wake_time_str,
            "title": "🌅 Mañana y Despertar",
            "description": "Despierta a tu propio ritmo. Rehidrátate, toma una ducha refrescante y estira tu cuerpo sin presiones.",
            "type": "wake"
        })

        # 2. Desayuno Saludable
        desayuno_mins = (wake_mins + 45) % 1440
        if is_travel_day:
            desayuno_desc = "Desayuno de viaje: Huevos revueltos o yogur. Evita alimentos fritos o azúcares para no sentir fatiga en tus trayectos."
        else:
            desayuno_desc = "Desayuno completo: Prepárate huevos, palta y un buen café. Disfruta tu mañana tranquila."
        timeline.append({
            "time": _minutes_to_time(desayuno_mins),
            "title": "🍳 Desayuno Completo",
            "description": desayuno_desc,
            "type": "breakfast"
        })

        # 3. Almuerzo
        timeline.append({
            "time": "13:00",
            "title": "🍲 Almuerzo Balanceado",
            "description": "Tu comida principal. Disfruta con tranquilidad tu comida (proteína magra, vegetales y carbohidratos limpios) y descansa un momento después.",
            "type": "lunch"
        })

        # 4. Entrenamiento o Tiempo Recreativo
        if workout_block:
            timeline.append({
                "time": workout_block.get("start", "16:00"),
                "title": "💪 Hora de Entrenar",
                "description": f"Tu rutina de hoy: {workout_block.get('label', 'Actividad física')}. ¡Dale con energía!",
                "type": "workout"
            })
        else:
            timeline.append({
                "time": "17:00",
                "title": "🎮 Tiempo Libre y Ocio",
                "description": "Espacio libre para jugar tus videojuegos favoritos, leer un libro o disfrutar de tus pasatiempos favoritos.",
                "type": "leisure"
            })

        # 5. Cena y Relajación
        cena_mins = (sleep_mins - 120) % 1440
        timeline.append({
            "time": _minutes_to_time(cena_mins),
            "title": "🥗 Cena y Relajación",
            "description": "Cena suave para favorecer una digestión rápida. Desconecta de pantallas y lee un poco antes de acostarte.",
            "type": "dinner"
        })

        # 6. Descanso Profundo
        timeline.append({
            "time": sleep_time_str,
            "title": "🌙 Sueño Reparador",
            "description": "Habitación fresca y a oscuras. Hora de apagar luces y descansar profundo.",
            "type": "sleep"
        })

    # Ordenar cronológicamente el timeline empezando desde la hora de despertar
    def minutes_from_wake(item):
        h, m = _parse_time(item["time"])
        mins = h * 60 + m
        diff = mins - wake_mins
        if diff < 0:
            diff += 1440
        return diff

    timeline.sort(key=minutes_from_wake)
    return timeline


@router.get("/api/v1/plan-diario")
async def plan_diario(user = Depends(get_current_user)):
    now = _bogota_now()

    async def _fetch_shifts():
        r = await asyncio.to_thread(lambda: supabase.table("shifts").select("*").eq("user_id", user.id).eq("is_active", True).execute())
        return r.data or []

    async def _fetch_bio():
        r = await asyncio.to_thread(lambda: supabase.table("user_bio_settings").select("*").eq("user_id", user.id).limit(1).execute())
        return r.data[0] if r.data else None

    async def _fetch_profile():
        r = await asyncio.to_thread(lambda: supabase.table("profiles").select("name,height_cm,health_goal,onboarding_completed_at").eq("user_id", user.id).limit(1).execute())
        return r.data[0] if r.data else None

    async def _fetch_sleep_recent():
        r = await asyncio.to_thread(lambda: supabase.table("sleep_logs").select("*").eq("user_id", user.id).order("date", desc=True).limit(7).execute())
        return r.data or []

    async def _fetch_weight_latest():
        r = await asyncio.to_thread(lambda: supabase.table("weight_logs").select("weight").eq("user_id", user.id).order("date", desc=True).limit(1).execute())
        return r.data[0]["weight"] if r.data else None

    shifts_data, bio, profile, sleep_logs, weight_kg = await asyncio.gather(
        _fetch_shifts(), _fetch_bio(), _fetch_profile(), _fetch_sleep_recent(), _fetch_weight_latest()
    )

    bs = bio or {}
    wake_target = str(bs.get("t_wake_target") or "06:00")
    sleep_target = str(bs.get("t_sleep_target") or "22:30")
    commute = int(bs.get("commute_minutes") or 35)
    PREP = 45

    hoy_index = now.weekday()
    ahora_minutos = now.hour * 60 + now.minute
    now_total = hoy_index * 24 * 60 + ahora_minutos

    # Determinar estado de override de hoy (descanso o viaje)
    override_status = bs.get("today_override_status") or "normal"
    override_date = bs.get("today_override_date")
    
    is_rest_day = False
    is_travel_day = False
    
    today_str = now.strftime("%Y-%m-%d")
    if override_date == today_str and override_status in ("rest", "travel"):
        if override_status == "rest":
            is_rest_day = True
        elif override_status == "travel":
            is_travel_day = True
    else:
        # Determinar si hoy es un día de descanso o viaje según la agenda semanal
        shifts_today = [
            s for s in shifts_data
            if s.get("is_active", True) is not False and
               (_day_name_to_index(s.get("day", "")) if s.get("day_index") is None else s.get("day_index")) == hoy_index
        ]
        if not shifts_today:
            is_rest_day = True
        else:
            def get_shift_type(s: dict) -> str:
                t = s.get("type")
                if t and t != "work":
                    return t
                if s.get("start") == "00:00" and s.get("end") == "00:01":
                    ikey = str(s.get("idempotency_key") or "").lower()
                    if "travel" in ikey:
                        return "travel"
                    return "rest"
                return t or "work"

            has_work = any(get_shift_type(s) == "work" for s in shifts_today)
            has_travel = any(get_shift_type(s) == "travel" for s in shifts_today)
            has_rest = any(get_shift_type(s) == "rest" for s in shifts_today)
            
            if has_travel:
                is_travel_day = True
            elif has_rest:
                is_rest_day = True
            elif not has_work:
                is_rest_day = True

    WORKOUT_DURATION = 120 if is_rest_day else 90

    wake_h, wake_m = _parse_time(wake_target)
    sleep_h, sleep_m = _parse_time(sleep_target)

    shift_status = compute_current_status(shifts_data, now, bio)
    next_shift = _find_next_shift(shifts_data, now)
    instances = _build_shift_instances(shifts_data)

    workout_block = None
    fatigue_alert = None
    best_cycles = None
    wake_deadline_total = None

    # Calcular deadline de despertar para el proximo turno
    if next_shift:
        wake_deadline_total = next_shift["start_total"] - commute - PREP
        # Si ya paso el limite para dormir (es decir, ya estamos despiertos para el proximo turno,
        # o estamos a menos de 3 horas de despertarnos, o ya lo pasamos)
        if now_total >= wake_deadline_total - 180:
            # Buscar el siguiente turno despues de este
            following_shift = None
            min_diff = None
            for inst in instances:
                diff = inst["start_total"] - next_shift["start_total"]
                if diff > 0 and (min_diff is None or diff < min_diff):
                    min_diff = diff
                    following_shift = inst
            
            if following_shift:
                next_shift = {
                    "day": following_shift["day"],
                    "start": following_shift["start"],
                    "end": following_shift["end"],
                    "start_total": following_shift["start_total"],
                    "end_total": following_shift["end_total"],
                    "start_minutes": _time_to_minutes(*_parse_time(following_shift["start"])),
                    "end_minutes": _time_to_minutes(*_parse_time(following_shift["end"])),
                }
                wake_deadline_total = next_shift["start_total"] - commute - PREP
            else:
                next_shift = None
                wake_deadline_total = None

    if wake_deadline_total:
        # Convertir deadline a HH:MM local para generar ventanas de sueno
        deadline_local = wake_deadline_total % (24 * 60)
        deadline_h = deadline_local // 60
        deadline_m = deadline_local % 60
        sleep_windows = _sleep_windows_from_wake(deadline_h, deadline_m)
    else:
        sleep_windows = _sleep_windows_from_wake(wake_h, wake_m)

    # Elegir ciclos recomendados
    if wake_deadline_total:
        for w in sleep_windows:
            w_sleep_h, w_sleep_m = _parse_time(w["sleep_time"])
            w_sleep_total = _time_to_minutes(w_sleep_h, w_sleep_m)
            w_wake_total = _time_to_minutes(*_parse_time(w["wake_time"]))
            if w_wake_total <= w_sleep_total:
                w_wake_total += 24 * 60
            sleep_abs = now_total - ahora_minutos + w_sleep_total
            if sleep_abs <= now_total:
                sleep_abs += 24 * 60
            if sleep_abs + (w["cycles"] * CYCLE_MINUTES + LATENCIA_MINUTOS) <= wake_deadline_total:
                best_cycles = w["cycles"]
                break
        if best_cycles is None:
            best_cycles = sleep_windows[-1]["cycles"]
            fatigue_alert = "ALERTA DE FATIGA: Ninguna ventana de sueno cabe antes del proximo turno con traslado y preparacion."
    else:
        sleep_min_abs = _time_to_minutes(sleep_h, sleep_m)
        wake_min_abs = _time_to_minutes(wake_h, wake_m)
        if wake_min_abs <= sleep_min_abs:
            wake_min_abs += 24 * 60
        best_cycles = _optimizar_ciclos(wake_min_abs - sleep_min_abs)

    # Bloque de entrenamiento
    recommended_sleep_time = sleep_windows[0]["sleep_time"]
    bed_h, bed_m = _parse_time(recommended_sleep_time)
    bed_min = _time_to_minutes(bed_h, bed_m)
    now_min = ahora_minutos

    if wake_deadline_total:
        bed_abs = now_total - now_min + bed_min
        if bed_abs <= now_total:
            bed_abs += 24 * 60
    else:
        bed_abs = bed_min
        if bed_min <= now_min:
            bed_abs = bed_min + 24 * 60

    can_workout = True

    if not wake_deadline_total and bed_min <= now_min:
        can_workout = False

    if can_workout and bed_abs < now_min + 30 + WORKOUT_DURATION + 60:
        can_workout = False

    if can_workout:
        wo_start = now_min + 30
        wo_end = wo_start + WORKOUT_DURATION

        # Verificar que no solape con ningun turno
        for inst in instances:
            inst_s = (now_total // (7 * 24 * 60)) * 7 * 24 * 60 + inst["start_total"]
            inst_e = (now_total // (7 * 24 * 60)) * 7 * 24 * 60 + inst["end_total"]
            wo_s = now_total - now_min + wo_start
            wo_e = now_total - now_min + wo_end
            if wo_s < inst_e and wo_e >= inst_s:
                can_workout = False
                break

    if can_workout and wake_deadline_total:
        deadline_with_buffer = wake_deadline_total - 60
        wo_e_abs = now_total - now_min + WORKOUT_DURATION + 30
        if wo_e_abs > deadline_with_buffer:
            can_workout = False

    if is_travel_day:
        workout_block = {
            "start": _minutes_to_time(now_min + 30),
            "end": _minutes_to_time(now_min + 60),
            "duration_min": 30,
            "label": "Caminata de movilidad y estiramiento (Viaje)",
        }
    elif can_workout:
        workout_block = {
            "start": _minutes_to_time(now_min + 30),
            "end": _minutes_to_time(now_min + 30 + WORKOUT_DURATION),
            "duration_min": WORKOUT_DURATION,
            "label": "Entrenamiento intensivo (Día de descanso)" if is_rest_day else "Entrenamiento sugerido",
        }

    hydration_ml = None
    if weight_kg:
        raw = float(weight_kg) * 35
        rounded = int(raw / 250 + 0.5) * 250
        hydration_ml = max(1500, min(3500, rounded))

    missing_config = []
    if not profile or not profile.get("onboarding_completed_at"):
        missing_config.append("perfil")
    if not shifts_data:
        missing_config.append("turnos")
    if not bio:
        missing_config.append("ajustes")

    # Merge is_rest_day and is_travel_day into shift_status
    if isinstance(shift_status, dict):
        shift_status = {**shift_status, "is_rest_day": is_rest_day, "is_travel_day": is_travel_day}

    companion_timeline = _generate_companion_timeline(
        now=now,
        shift_status=shift_status,
        sleep_windows=sleep_windows,
        workout_block=workout_block,
        is_rest_day=is_rest_day,
        is_travel_day=is_travel_day,
        commute=commute,
        wake_target=wake_target,
        sleep_target=sleep_target
    )

    return {
        "date": now.strftime("%Y-%m-%d"),
        "shift_status": shift_status,
        "sleep": {
            "windows": sleep_windows,
            "fatigue_alert": fatigue_alert,
            "recommended_cycles": best_cycles,
            "wake_target": wake_target,
            "sleep_target": sleep_target,
            "commute_minutes": commute,
        },
        "workout": workout_block,
        "hydration_ml": hydration_ml,
        "sleep_logs_recent": sleep_logs[:7],
        "missing_config": missing_config,
        "companion_timeline": companion_timeline,
        "disclaimer": "Esta es una planificacion orientativa basada en tus datos. No constituye consejo medico.",
    }
