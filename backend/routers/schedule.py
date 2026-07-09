import asyncio
import base64
import json
import logging
import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel
from google import genai

from auth import get_current_user
from bio import CYCLE_MINUTES
from database import supabase
from exceptions import ApiException
from services.observability import track_event

logger = logging.getLogger("escudo")
router = APIRouter()
_gemini_api_key = os.getenv("GEMINI_API_KEY")
_ai_client = genai.Client(api_key=_gemini_api_key) if _gemini_api_key else None

# ─── Sleep Optimizer constants ──────────────────────────────────────────────

LATENCIA_MINUTOS = 15
TIEMPO_POR_CICLO = CYCLE_MINUTES + LATENCIA_MINUTOS

BUFFER_PRE_SHIFT  = 45
BUFFER_POST_SHIFT = 75


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


class WakeTimePayload(BaseModel):
    t_wake_target: str


def _normalize_day_name_text(value: str) -> str:
    raw = (value or "").strip().lower()
    mapping = {
        "lunes": "Lunes",
        "martes": "Martes",
        "miercoles": "Miércoles",
        "miércoles": "Miércoles",
        "jueves": "Jueves",
        "viernes": "Viernes",
        "sabado": "Sábado",
        "sábado": "Sábado",
        "domingo": "Domingo",
    }
    return mapping.get(raw, value.strip().title() if value else "")


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


# ─── Endpoints ──────────────────────────────────────────────────────────────


@router.get("/api/v1/shifts")
async def list_shifts(user = Depends(get_current_user)):
    s = await asyncio.to_thread(lambda: supabase.table("shifts").select("*").eq("user_id", user.id).order("day", desc=False).execute())
    return {"shifts": s.data or []}


@router.post("/api/v1/shifts/upload-image")
async def upload_shift_image(
    file: UploadFile = File(...),
    user_name: str = Form("Usuario"),
    user = Depends(get_current_user),
):
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
        }, on_conflict="user_id,day,start,end").execute())
        if res.data:
            inserted.extend(res.data)
        else:
            inserted.append({
                "user_id": user.id,
                "day": shift["day"],
                "start": shift["start"],
                "end": shift["end"],
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
    res = await asyncio.to_thread(lambda: supabase.table("shifts").insert({
        "user_id": user.id,
        "day": payload.day,
        "start": payload.start,
        "end": payload.end,
    }).execute())
    if not res.data:
        raise ApiException(status_code=500, detail="No se pudo crear el turno.")
    await track_event("schedule", "create_shift", user_id=user.id, metadata={"day": payload.day, "start": payload.start, "end": payload.end})
    return {"shift": res.data[0]}


@router.put("/api/v1/shifts/{shift_id}")
async def update_shift(shift_id: str, payload: ShiftPayload, user = Depends(get_current_user)):
    res = await asyncio.to_thread(lambda: supabase.table("shifts").update({
        "day": payload.day,
        "start": payload.start,
        "end": payload.end,
    }).eq("id", shift_id).eq("user_id", user.id).execute())
    if not res.data:
        raise ApiException(status_code=404, detail="Turno no encontrado.")
    await track_event("schedule", "update_shift", user_id=user.id, metadata={"shift_id": shift_id, "day": payload.day, "start": payload.start, "end": payload.end})
    return {"shift": res.data[0]}


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
    dias_es = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
    hoy_nombre = dias_es[datetime.now().weekday()]

    shifts = await asyncio.to_thread(lambda: supabase.table("shifts").select("*").eq("user_id", user.id).eq("day", hoy_nombre).execute())
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
    dias_es = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
    ahora = datetime.now()
    hoy_nombre = dias_es[ahora.weekday()]
    ahora_minutos = ahora.hour * 60 + ahora.minute

    shifts = await asyncio.to_thread(lambda: supabase.table("shifts").select("*").eq("user_id", user.id).execute())
    shifts_data = shifts.data or []
    dias_idx = {n: i for i, n in enumerate(dias_es)}

    activo = None
    proximo = None

    for s in shifts_data:
        dia = s.get("day", "")
        if dias_idx.get(dia, 99) < dias_idx.get(hoy_nombre, 0):
            continue
        sh, sm = _parse_time(s.get("start", "00:00"))
        eh, em = _parse_time(s.get("end", "23:59"))
        inicio = sh * 60 + sm
        fin = eh * 60 + em
        if fin <= inicio:
            fin += 24 * 60

        if dia == hoy_nombre and inicio <= ahora_minutos < fin:
            activo = {"day": dia, "start": s["start"], "end": s["end"],
                      "remaining_hours": round((fin - ahora_minutos) / 60, 1)}
            break
        if not activo and (dia != hoy_nombre or ahora_minutos < inicio):
            if dia == hoy_nombre:
                diff = inicio - ahora_minutos
            else:
                diff = (dias_idx.get(dia, 0) - dias_idx.get(hoy_nombre, 0)) * 24 * 60 - ahora_minutos + inicio
            proximo = {"day": dia, "start": s["start"], "end": s["end"],
                      "starts_in_hours": round(diff / 60, 1)}
            break

    if activo:
        msg = f"Turno activo hasta las {activo['end']} ({activo['remaining_hours']}h restantes)."
        return {"status": "in_shift", "shift": activo, "message_short": msg}
    if proximo:
        msg = f"Libre. Proximo turno: {proximo['day']} {proximo['start']} (en {proximo['starts_in_hours']}h)."
        return {"status": "free", "next_shift": proximo, "message_short": msg}
    return {"status": "free", "message_short": "Sin turnos registrados."}
