import asyncio
import json
import logging
import os
import re
import time
import unicodedata
from datetime import datetime, timezone

from fastapi import HTTPException
from database import supabase
from trm import get_trm
from services.deepseek import complete_chat, is_configured as is_deepseek_configured
from services.omni_handlers import (
    handle_task_intent,
    handle_goal_intent,
    handle_health_intent,
    handle_schedule_intent,
    handle_finance_intent,
    handle_routine_intent,
    handle_metric_intent,
)

logger = logging.getLogger("escudo")


def normalize_text(value: str) -> str:
    text = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode("ascii")
    return text.strip().lower()


GOAL_TYPE_ALIASES = {
    "bajar de peso": "weight",
    "peso": "weight",
    "adelgazar": "weight",
    "ahorro": "finance",
    "savings": "finance",
    "finanzas": "finance",
    "correr": "fitness",
    "entrenamiento": "fitness",
    "gym": "fitness",
}


def normalize_goal_type(value: str) -> str:
    normalized = normalize_text(value)
    return GOAL_TYPE_ALIASES.get(normalized, normalized)


# ─── Rate Limit ─────────────────────────────────────────────────────────────

_omni_rate_limits = {}


def _check_omni_rate_limit(user_id: str, max_requests: int = 30, window_seconds: int = 60):
    now = time.time()
    requests = _omni_rate_limits.get(user_id, [])
    requests = [t for t in requests if now - t < window_seconds]
    if len(requests) >= max_requests:
        raise HTTPException(
            status_code=429,
            detail="Demasiados comandos. Espera un momento."
        )
    requests.append(now)
    _omni_rate_limits[user_id] = requests
    if not requests:
        _omni_rate_limits.pop(user_id, None)


# ─── Daily Cost Limit ──────────────────────────────────────────────────────

DAILY_COST_LIMIT = int(os.getenv("OMNI_DAILY_COST_LIMIT_COP", 5000))
_daily_omni_usage = {}


def _get_daily_cost(user_id: str) -> float:
    now = time.time()
    today_start = now - (now % 86400)
    costs = _daily_omni_usage.get(user_id, [])
    costs = [(t, c) for t, c in costs if t >= today_start]
    _daily_omni_usage[user_id] = costs
    return sum(c for _, c in costs)


def _check_omni_daily_limit(user_id: str):
    total = _get_daily_cost(user_id)
    if total >= DAILY_COST_LIMIT:
        raise HTTPException(
            status_code=429,
            detail=f"Límite diario de OMNI alcanzado (${DAILY_COST_LIMIT:,} COP). Intenta mañana."
        )


def _record_omni_daily_cost(user_id: str, cost_cop: float):
    if cost_cop <= 0:
        return
    now = time.time()
    today_start = now - (now % 86400)
    costs = _daily_omni_usage.get(user_id, [])
    costs = [(t, c) for t, c in costs if t >= today_start]
    costs.append((now, cost_cop))
    _daily_omni_usage[user_id] = costs


# ─── Modelo Generativo OMNI ────────────────────────────────────────────────

_omni_client = is_deepseek_configured()
_omni_system_instruction = (
        "Eres NAVIR, asistente conversacional integrado en un sistema operativo personal. "
        "Responde SIEMPRE en formato JSON válido (sin markdown). "
        "Debes incluir: 'intent', 'extracted_data', 'respuesta_usuario', 'xp_ganada'. "
        "La clave 'respuesta_usuario' debe sonar natural, útil y humana, como un chatbot real en español. "
        "Cuando el usuario hable de sueldo, pago recibido, ingreso, abono o transferencia entrante, usa intent='REGISTER_INCOME'. "
        "Cuando el usuario hable de una factura o gasto fijo ya pagado, usa intent='PAY_FIXED_EXPENSE'. "
        "Cuando quiera registrar una factura por pagar, usa intent='FIXED_EXPENSE'. "
        "Cuando quiera registrar su peso, usa intent='LOG_WEIGHT'. "
        "Cuando quiera registrar un entrenamiento o ejercicio, usa intent='LOG_EXERCISE'. "
        "Cuando quiera registrar su descanso o sueno, usa intent='LOG_SLEEP'. "
        "Cuando quiera crear, mover o borrar un turno, usa intent='CREATE_SHIFT', 'UPDATE_SHIFT' o 'DELETE_SHIFT'. "
        "Cuando quiera cambiar su hora objetivo de despertar, usa intent='SET_WAKE_TIME'. "
        "Cuando quiera crear o editar una rutina de entrenamiento, usa intent='CREATE_ROUTINE', 'ADD_ROUTINE_EXERCISE', 'REMOVE_ROUTINE_EXERCISE', 'UPDATE_ROUTINE' o 'COMPLETE_ROUTINE'. "
        "La rutina base semanal ya existe y no debes reemplazarla completa: solo ajusta un día específico, agrega o quita ejercicios, o adapta variantes según el equipo disponible. "
        "Cuando quiera crear, editar o completar una meta, usa intent='CREATE_GOAL', 'UPDATE_GOAL', 'COMPLETE_GOAL' o 'LOG_METRIC'. "
        "Cuando quiera registrar impulso, recaída, día limpio o reinicio de racha, usa intent='REGISTER_URGE', 'REGISTER_RELAPSE', 'REGISTER_FOCUS_DAY' o 'RESET_FOCUS'. "
        "Cuando quiera crear, editar, completar o borrar una tarea/proyecto, o cambiar prioridad/reprogramar una tarea, usa intent='CREATE_TASK', 'UPDATE_TASK', 'COMPLETE_TASK' o 'DELETE_TASK'. "
        "Si recibes contexto de equipamiento de gimnasio, úsalo para proponer ejercicios compatibles con el equipo disponible y evita sugerir maquinaria no listada. "
        "Si el usuario pide consejo/plan/explicación, entrega contenido accionable en 'respuesta_usuario'. "
        "Si no hay acción de base de datos, usa intent='NONE' y deja extracted_data={}. "
        "Nunca dejes 'respuesta_usuario' vacío."
)

_omni_system_instruction += (
    " Para conversaciones personales, laborales o de animo, interpreta el mensaje completo como una sola situacion. "
    "Reconoce primero dos detalles concretos que la persona haya expresado y responde una sola vez, sin fragmentar ni repetir preguntas genericas. "
    "Ofrece una accion pequena y realista para hoy o una unica pregunta de seguimiento si hace falta informacion. "
    "No diagnostiques ni prometas soluciones; si hay riesgo inmediato para la persona, recomienda buscar ayuda urgente local. "
    "Para consultas sin registro, mantente por debajo de 120 palabras."
)
if _omni_client:
    logger.info("Cliente OMNI (DeepSeek) inicializado correctamente.")



# ─── Multi-Intent ─────────────────────────────────────────────────────────
_MUTATION_INTENTS = {
    "CREATE_GOAL",
    "UPDATE_GOAL",
    "COMPLETE_GOAL",
    "LOG_METRIC",
    "REGISTER_INCOME",
    "REGISTER_FOCUS_DAY",
    "REGISTER_URGE",
    "REGISTER_RELAPSE",
    "RESET_FOCUS",
    "CREATE_TASK",
    "UPDATE_TASK",
    "COMPLETE_TASK",
    "DELETE_TASK",
    "PAY_FIXED_EXPENSE",
    "LOG_WEIGHT",
    "LOG_EXERCISE",
    "LOG_SLEEP",
    "CREATE_SHIFT",
    "UPDATE_SHIFT",
    "DELETE_SHIFT",
    "SET_WAKE_TIME",
    "CREATE_ROUTINE",
    "ADD_ROUTINE_EXERCISE",
    "REMOVE_ROUTINE_EXERCISE",
    "COMPLETE_ROUTINE",
}
_MULTI_SEPARATORS = re.compile(r"\s+(?:y\s+luego|luego|despu(?:es|\u00e9s))\s+|;\s*", re.IGNORECASE)


def split_multi_intent(command_text: str) -> list[str]:
    """Solo divide instrucciones encadenadas de forma explicita.

    Comas y conjunciones tambien aparecen en mensajes personales; dividirlas
    multiplica llamadas al modelo y destruye el contexto de la persona.
    """
    parts = _MULTI_SEPARATORS.split(command_text)
    return [p.strip() for p in parts if p.strip()]


# ─── Core processor ──────────────────────────────────────────────────────

async def _get_user_context(user) -> str:
    try:
        prof_r = await asyncio.to_thread(
            lambda: supabase.table("profiles").select("level, xp, player_id, name, health_goal").eq("user_id", user.id).maybe_single().execute()
        )
    except Exception:
        prof_r = type('obj', (object,), {'data': None})()

    level = prof_r.data.get("level", 1) if prof_r.data else 1
    xp = prof_r.data.get("xp", 0) if prof_r.data else 0
    pid = prof_r.data.get("player_id", "") if prof_r.data else ""

    lines = [f"Nivel: {level} | XP: {xp}"]
    if prof_r.data and prof_r.data.get("name"):
        lines.append(f"Nombre: {prof_r.data['name']}")
    if prof_r.data and prof_r.data.get("health_goal"):
        lines.append(f"Objetivo de bienestar: {prof_r.data['health_goal']}")

    try:
        pat_r = await asyncio.to_thread(
            lambda: supabase.table("user_activity_patterns")
                .select("activity_type, day_of_week, hour_of_day, confidence")
                .eq("user_id", user.id)
                .gte("confidence", 0.5)
                .eq("enabled", True)
                .order("confidence", desc=True)
                .limit(5)
                .execute()
        )
        if pat_r.data:
            dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
            alias = {"weight_log": "registrar peso", "habit_check": "completar hábitos", "exercise_log": "entrenar", "finance_log": "registrar gastos", "omni_use": "usar OMNI", "mood_log": "registrar ánimo"}
            pattern_lines = []
            for p in pat_r.data:
                atype = alias.get(p["activity_type"], p["activity_type"])
                day = dias[p["day_of_week"]] if 0 <= p["day_of_week"] <= 6 else f"día {p['day_of_week']}"
                hour = f"{p['hour_of_day']:02d}:00"
                conf = int(p["confidence"] * 100)
                pattern_lines.append(f"* Suele {atype} los {day} a las {hour} (confianza: {conf}%)")
            if pattern_lines:
                lines.append("Patrones detectados:")
                lines.extend(pattern_lines)
    except Exception as e:
        logger.warning(f"Error en contexto de usuario (patterns): {e}")

    if pid:
        try:
            cm_r = await asyncio.to_thread(
                lambda: supabase.table("clan_members").select("clan_id").eq("player_id", pid).maybe_single().execute()
            )
            if cm_r.data:
                c_r = await asyncio.to_thread(
                    lambda: supabase.table("clans").select("name").eq("id", cm_r.data["clan_id"]).maybe_single().execute()
                )
                if c_r.data:
                    lines.append(f"Clan: \"{c_r.data['name']}\"")
        except Exception as e:
            logger.warning(f"Error en contexto de usuario (clan/retos): {e}")

        try:
            chal_r = await asyncio.to_thread(
                lambda: supabase.table("challenges").select("id", count="exact")
                    .or_(f"challenger_player_id.eq.{pid},challenged_player_id.eq.{pid}")
                    .in_("status", ("pending", "accepted"))
                    .execute()
            )
            count = chal_r.count if hasattr(chal_r, 'count') else 0
            if count > 0:
                lines.append(f"Retos activos: {count}")
        except Exception as e:
            logger.warning(f"Error obteniendo retos activos del usuario: {e}")

    return "\n".join(lines)


async def _get_conversation_context(user_id: str, session_id: str | None) -> str:
    """Recupera un contexto corto de la conversacion actual sin crecer el prompt."""
    if not session_id:
        return ""

    try:
        result = await asyncio.to_thread(
            lambda: supabase.table("omni_messages")
                .select("role, content")
                .eq("user_id", user_id)
                .eq("session_id", session_id)
                .order("created_at", desc=True)
                .limit(4)
                .execute()
        )
        rows = result.data if isinstance(result.data, list) else []
        if not rows:
            return ""
        transcript = []
        for row in reversed(rows):
            role = "Usuario" if row.get("role") == "user" else "OMNI"
            content = str(row.get("content") or "").strip().replace("\n", " ")[:320]
            if content:
                transcript.append(f"{role}: {content}")
        return "\n".join(transcript)
    except Exception as exc:
        logger.warning("No se pudo leer el contexto conversacional de OMNI: %s", exc)
        return ""


async def _interpret_command(
    command_text: str,
    user,
    trm: float,
    lite_profile: dict,
    tasks: list,
    equipment: list | None = None,
    session_id: str | None = None,
) -> dict:
    """Llama al modelo generativo y devuelve la interpretación SIN ejecutar mutaciones."""
    _check_omni_daily_limit(user.id)
    user_ctx = await _get_user_context(user)
    conversation_ctx = await _get_conversation_context(user.id, session_id)
    equipment_ctx = ", ".join([str(item).strip() for item in (equipment or []) if str(item).strip()]) or "No especificado"
    prompt_context = (
        f"[CONTEXTO DEL USUARIO]\n{user_ctx}\n\n"
        f"Perfil: {lite_profile}. Metas: {tasks}. Equipo: {equipment_ctx}.\n"
        f"[CONVERSACION RECIENTE]\n{conversation_ctx or 'Sin mensajes previos en esta sesion.'}\n\n"
        f"[MENSAJE ACTUAL]\n{command_text}"
    )
    response = await complete_chat(
        [
            {"role": "system", "content": _omni_system_instruction},
            {"role": "user", "content": prompt_context},
        ],
        json_output=True,
        temperature=0.2,
        max_tokens=420,
    )

    input_tokens = response["prompt_tokens"] or len(prompt_context) // 4
    output_tokens = response["completion_tokens"] or len(response["text"]) // 4
    cost_usd = (input_tokens * 0.00000014) + (output_tokens * 0.00000028)
    cost_cop = cost_usd * trm

    _record_omni_daily_cost(user.id, cost_cop)

    res_json = json.loads(response["text"].strip().replace("```json", "").replace("```", ""))
    res_json["interaction_cost_cop"] = cost_cop
    res_json["current_trm"] = trm

    if os.getenv("OMNI_DEBUG_RAW_RESPONSE", "false").lower() == "true":
        logger.debug("RAW DEEPSEEK RESPONSE: %s", json.dumps(res_json, indent=2, ensure_ascii=False))

    if not res_json.get("mensaje_sistema"):
        res_json["mensaje_sistema"] = res_json.get("respuesta_usuario", "").strip()
    if not res_json.get("mensaje_sistema"):
        # Fallback conversacional para evitar respuestas vacías o robóticas.
        res_json["mensaje_sistema"] = "Te leo. ¿Quieres que lo convierta en un plan corto de hoy o en pasos detallados?"

    return res_json


async def _execute_interpreted_command(res_json: dict, user) -> dict:
    """Ejecuta los handlers de mutación sobre una interpretación ya generada."""
    intent = res_json.get("intent", "NONE")
    ext = res_json.get("extracted_data", {})

    if await handle_task_intent(intent, ext, user, res_json):
        return res_json

    if await handle_goal_intent(intent, ext, user, res_json):
        return res_json

    if await handle_health_intent(intent, ext, user, res_json):
        return res_json

    if await handle_schedule_intent(intent, ext, user, res_json):
        return res_json

    if await handle_finance_intent(intent, ext, user, res_json):
        return res_json

    if await handle_routine_intent(intent, ext, user, res_json):
        return res_json

    if await handle_metric_intent(intent, ext, user, res_json):
        return res_json

    return res_json


async def process_single_command(command_text: str, user, trm: float, lite_profile: dict, tasks: list, equipment: list | None = None) -> dict:
    """Flujo legacy: interpreta + ejecuta en un solo paso. Usado por tests y compatibilidad."""
    res_json = await _interpret_command(command_text, user, trm, lite_profile, tasks, equipment)
    return await _execute_interpreted_command(res_json, user)



async def _persist_messages(user_id: str, session_id: str, messages: list[dict]):
    try:
        now_ts = datetime.now(timezone.utc).isoformat()
        rows = []
        for msg in messages:
            rows.append({
                "user_id": user_id,
                "session_id": session_id,
                "role": msg["role"],
                "content": msg["content"],
                "created_at": now_ts,
            })
        await asyncio.to_thread(lambda: supabase.table("omni_messages").insert(rows).execute())
    except Exception as e:
        logger.warning(f"Error persistiendo mensajes OMNI: {e}")



