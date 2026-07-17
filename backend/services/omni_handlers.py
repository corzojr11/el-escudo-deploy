import asyncio
import logging
import re
import unicodedata
from datetime import datetime, timezone
from typing import Any, Optional

from database import supabase

logger = logging.getLogger("escudo")

GOAL_TYPE_ALIASES = {
    "peso": "weight", "weight": "weight", "bajar de peso": "weight",
    "ejercicio": "fitness", "fitness": "fitness", "entrenamiento": "fitness",
    "correr": "fitness", "running": "fitness",
    "leer": "reading", "reading": "reading", "lectura": "reading", "libros": "reading",
    "dinero": "finance", "finanzas": "finance", "ahorro": "finance", "savings": "finance",
    "estudio": "study", "studying": "study", "estudiar": "study", "curso": "study",
    "habito": "habit", "habit": "habit", "rutina": "habit",
    "sueno": "sleep", "sleep": "sleep", "dormir": "sleep",
}

UNIT_TO_GOAL_TYPE = {
    "kg": "weight", "kilos": "weight",
    "km": "fitness", "min": "fitness", "rep": "fitness",
    "paginas": "reading", "libros": "reading",
    "$": "finance", "usd": "finance", "cop": "finance",
}


def normalize_text(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    return text.encode("ascii", "ignore").decode("ascii").lower().strip()


def normalize_goal_type(raw: str) -> str:
    n = normalize_text(raw)
    return GOAL_TYPE_ALIASES.get(n, n)


async def _resolve_goal_reference(user, ext: dict) -> tuple[Optional[dict], Optional[str]]:
    raw_goal_reference = str(
        ext.get("goal_id")
        or ext.get("goalId")
        or ext.get("goal_name")
        or ext.get("goalName")
        or ext.get("name")
        or ""
    ).strip()
    if not raw_goal_reference:
        return None, None

    is_uuid = bool(re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', raw_goal_reference.lower()))
    if is_uuid:
        check = await asyncio.to_thread(
            lambda: supabase.table("goals")
                .select("id, name, goal_type, unit, target_value, current_value, status")
                .eq("id", raw_goal_reference)
                .eq("user_id", user.id)
                .limit(1)
                .execute()
        )
        if check.data:
            return check.data[0], raw_goal_reference

    stop_words = {"de", "la", "el", "los", "las", "un", "una", "del", "en", "para", "por", "con", "mi", "tu", "su", "al"}
    search_terms = [raw_goal_reference]
    for term in [w for w in re.split(r'[\s,;.\-]+', raw_goal_reference) if normalize_text(w) not in stop_words and len(w) > 1]:
        if term not in search_terms:
            search_terms.append(term)

    for candidate in search_terms:
        s = await asyncio.to_thread(
            lambda candidate=candidate: supabase.table("goals")
                .select("id, name, goal_type, unit, target_value, current_value, status")
                .eq("user_id", user.id)
                .neq("status", "archived")
                .ilike("name", f"%{candidate}%")
                .limit(1)
                .execute()
        )
        if s.data:
            return s.data[0], raw_goal_reference

    norm_type = normalize_goal_type(raw_goal_reference)
    if norm_type:
        s = await asyncio.to_thread(
            lambda: supabase.table("goals")
                .select("id, name, goal_type, unit, target_value, current_value, status")
                .eq("user_id", user.id)
                .neq("status", "archived")
                .eq("goal_type", norm_type)
                .limit(1)
                .execute()
        )
        if s.data:
            return s.data[0], raw_goal_reference

    return None, raw_goal_reference


async def _resolve_mission_reference(user, ext: dict) -> tuple[Optional[dict], Optional[str]]:
    raw_reference = str(
        ext.get("task_id")
        or ext.get("taskId")
        or ext.get("mission_id")
        or ext.get("missionId")
        or ext.get("name")
        or ext.get("title")
        or ""
    ).strip()
    if not raw_reference:
        return None, None

    is_uuid = len(raw_reference) == 36 and raw_reference.count("-") == 4
    if is_uuid:
        check = await asyncio.to_thread(
            lambda: supabase.table("missions")
                .select("id, name, description, status, xp_reward, category")
                .eq("id", raw_reference)
                .eq("user_id", user.id)
                .limit(1)
                .execute()
        )
        if check.data:
            return check.data[0], raw_reference

    search_terms = [raw_reference]
    for term in [w for w in raw_reference.replace(",", " ").replace(";", " ").split() if len(w) > 1]:
        if term not in search_terms:
            search_terms.append(term)

    for candidate in search_terms:
        s = await asyncio.to_thread(
            lambda candidate=candidate: supabase.table("missions")
                .select("id, name, description, status, xp_reward, category")
                .eq("user_id", user.id)
                .ilike("name", f"%{candidate}%")
                .limit(1)
                .execute()
        )
        if s.data:
            return s.data[0], raw_reference

    return None, raw_reference


async def handle_task_intent(intent: str, ext: dict[str, Any], user, res_json: dict) -> bool:
    if intent == "CREATE_TASK" and ext:
        try:
            priority = str(ext.get("priority") or "").strip().lower() or None
            scheduled_at = str(ext.get("scheduled_at") or ext.get("scheduledAt") or ext.get("due_date") or ext.get("dueDate") or "").strip() or None
            payload = {
                "user_id": user.id,
                "name": str(ext.get("name") or ext.get("title") or "Tarea").strip(),
                "description": str(ext.get("description") or "").strip(),
                "priority": priority or "medium",
                "scheduled_at": scheduled_at or None,
                "status": str(ext.get("status") or "active"),
                "xp_reward": int(ext.get("xp_reward") or ext.get("xpReward") or 0),
                "category": str(ext.get("category") or "general").strip(),
            }
            res_task = await asyncio.to_thread(lambda: supabase.table("missions").insert(payload).execute())
            if res_task.data and len(res_task.data) > 0:
                mission_name = res_task.data[0].get("name", payload["name"])
                res_json["mensaje_sistema"] = f"✅ Tarea creada: {mission_name}."
                res_json["respuesta_usuario"] = res_json.get("respuesta_usuario") or f"Listo, creé la tarea {mission_name}."
                res_json["xp_ganada"] = 20
                res_json["executed"] = True
            else:
                res_json["mensaje_sistema"] = "⚠️ La tarea se procesó, pero no pude verificarla en la base de datos."
        except Exception:
            logger.error("CREATE_TASK error", exc_info=True)
            res_json["mensaje_sistema"] = "Error de base de datos al crear la tarea."
        return True

    if intent == "UPDATE_TASK" and ext:
        try:
            mission_row, raw_reference = await _resolve_mission_reference(user, ext)
            if not mission_row:
                raise ValueError("No encontré la tarea")
            update_data = {}
            priority = str(ext.get("priority") or "").strip().lower() or None
            scheduled_at = str(ext.get("scheduled_at") or ext.get("scheduledAt") or ext.get("due_date") or ext.get("dueDate") or "").strip() or None
            if ext.get("name"):
                update_data["name"] = str(ext.get("name")).strip()
            if ext.get("description") is not None:
                update_data["description"] = str(ext.get("description") or "").strip()
            if ext.get("status"):
                update_data["status"] = str(ext.get("status"))
            if ext.get("category"):
                update_data["category"] = str(ext.get("category")).strip()
            if "xp_reward" in ext and ext.get("xp_reward") is not None:
                update_data["xp_reward"] = int(ext.get("xp_reward") or 0)
            if priority:
                update_data["priority"] = priority
            if scheduled_at is not None:
                update_data["scheduled_at"] = scheduled_at or None
            if not update_data:
                raise ValueError("No received changes for task")
            res_task = await asyncio.to_thread(
                lambda: supabase.table("missions").update(update_data).eq("id", mission_row["id"]).eq("user_id", user.id).execute()
            )
            if res_task.data and len(res_task.data) > 0:
                mission_name = res_task.data[0].get("name", mission_row.get("name", "task"))
                res_json["mensaje_sistema"] = f"✅ Tarea actualizada: {mission_name}."
                res_json["respuesta_usuario"] = res_json.get("respuesta_usuario") or f"Listo, actualicé la tarea {mission_name}."
                res_json["xp_ganada"] = 15
                res_json["executed"] = True
            else:
                res_json["mensaje_sistema"] = "⚠️ La tarea se procesó, pero no pude verificarla en la base de datos."
        except Exception:
            logger.error("UPDATE_TASK error", exc_info=True)
            res_json["mensaje_sistema"] = "Error de base de datos al actualizar la tarea."
        return True

    if intent == "COMPLETE_TASK" and ext:
        try:
            mission_row, raw_reference = await _resolve_mission_reference(user, ext)
            if not mission_row:
                raise ValueError(f"No encontré la tarea '{raw_reference or ''}'.")
            complete_payload = {"status": "completed"}
            res_task = await asyncio.to_thread(
                lambda: supabase.table("missions").update(complete_payload).eq("id", mission_row["id"]).eq("user_id", user.id).execute()
            )
            if res_task.data and len(res_task.data) > 0:
                mission_name = res_task.data[0].get("name", mission_row.get("name", "tarea"))
                res_json["mensaje_sistema"] = f"🏁 Tarea completada: {mission_name}."
                res_json["respuesta_usuario"] = res_json.get("respuesta_usuario") or f"Perfecto, marqué la tarea {mission_name} como completada."
                res_json["xp_ganada"] = int(mission_row.get("xp_reward", 0) or 0) or 25
                res_json["executed"] = True
            else:
                res_json["mensaje_sistema"] = "⚠️ La tarea se procesó, pero no pude verificarla en la base de datos."
        except Exception:
            logger.error("COMPLETE_TASK error", exc_info=True)
            res_json["mensaje_sistema"] = "Error de base de datos al completar la tarea."
        return True

    if intent == "DELETE_TASK" and ext:
        try:
            mission_row, raw_reference = await _resolve_mission_reference(user, ext)
            if not mission_row:
                raise ValueError(f"No encontré la tarea '{raw_reference or ''}'.")
            await asyncio.to_thread(
                lambda: supabase.table("missions").delete().eq("id", mission_row["id"]).eq("user_id", user.id).execute()
            )
            mission_name = mission_row.get("name", "tarea")
            res_json["mensaje_sistema"] = f"🗑️ Tarea eliminada: {mission_name}."
            res_json["respuesta_usuario"] = res_json.get("respuesta_usuario") or f"Listo, eliminé la tarea {mission_name}."
            res_json["xp_ganada"] = 5
            res_json["executed"] = True
        except Exception:
            logger.error("DELETE_TASK error", exc_info=True)
            res_json["mensaje_sistema"] = "Error de base de datos al eliminar la tarea."
        return True

    return False


async def handle_goal_intent(intent: str, ext: dict[str, Any], user, res_json: dict) -> bool:
    if intent == "CREATE_GOAL" and ext:
        try:
            data_to_insert = {
                "user_id": user.id,
                "name": ext.get("name", "Meta sin nombre"),
                "description": ext.get("description", ""),
                "goal_type": normalize_goal_type(ext.get("goal_type", "custom")),
                "target_value": ext.get("target_value"),
                "unit": ext.get("unit", ""),
                "deadline": ext.get("deadline"),
                "priority": ext.get("priority", 2),
                "config": ext.get("config", {}),
            }
            goal_res = await asyncio.to_thread(lambda: supabase.table("goals").insert(data_to_insert).execute())
            if goal_res.data and len(goal_res.data) > 0:
                res_json["mensaje_sistema"] = f"✅ Meta '{ext.get('name', '')}': Objetivo registrado en el sistema."
                res_json["xp_ganada"] = 50
                res_json["executed"] = True
            else:
                res_json["mensaje_sistema"] = "⚠️ Meta creada pero no se pudo verificar. Revisa la base de datos."
        except Exception:
            logger.error("CREATE_GOAL error", exc_info=True)
            res_json["mensaje_sistema"] = "Error de base de datos al registrar meta."
        return True

    if intent == "UPDATE_GOAL" and ext:
        try:
            goal_row, raw_goal_reference = await _resolve_goal_reference(user, ext)
            if not goal_row:
                raise ValueError(f"No encontré la meta '{raw_goal_reference or ''}'.")
            update_data = {}
            if ext.get("name"):
                update_data["name"] = ext.get("name")
            if ext.get("description"):
                update_data["description"] = ext.get("description")
            if ext.get("goal_type"):
                update_data["goal_type"] = normalize_goal_type(ext.get("goal_type", "custom"))
            if "target_value" in ext and ext.get("target_value") is not None:
                update_data["target_value"] = ext.get("target_value")
            if ext.get("unit"):
                update_data["unit"] = ext.get("unit")
            if ext.get("deadline"):
                update_data["deadline"] = ext.get("deadline")
            if ext.get("status"):
                update_data["status"] = ext.get("status")
            if "priority" in ext and ext.get("priority") is not None:
                update_data["priority"] = ext.get("priority")
            if "config" in ext and ext.get("config") is not None:
                update_data["config"] = ext.get("config")
            if "current_value" in ext and ext.get("current_value") is not None:
                update_data["current_value"] = ext.get("current_value")
            if not update_data:
                raise ValueError("No recibí cambios concretos para la meta.")
            goal_res = await asyncio.to_thread(
                lambda: supabase.table("goals")
                .update(update_data)
                .eq("id", goal_row["id"])
                .eq("user_id", user.id)
                .execute()
            )
            if goal_res.data and len(goal_res.data) > 0:
                updated_name = goal_res.data[0].get("name", goal_row.get("name", "meta"))
                res_json["mensaje_sistema"] = f"✅ Meta actualizada: {updated_name}."
                res_json["respuesta_usuario"] = res_json.get("respuesta_usuario") or f"Listo, actualicé la meta {updated_name}."
                res_json["xp_ganada"] = 25
                res_json["executed"] = True
            else:
                res_json["mensaje_sistema"] = "⚠️ La meta se procesó, pero no pude verificarla en la base de datos."
        except Exception:
            logger.error("UPDATE_GOAL error", exc_info=True)
            res_json["mensaje_sistema"] = "Error de base de datos al actualizar la meta."
        return True

    if intent == "COMPLETE_GOAL" and ext:
        try:
            goal_row, raw_goal_reference = await _resolve_goal_reference(user, ext)
            if not goal_row:
                raise ValueError(f"No encontré la meta '{raw_goal_reference or ''}'.")
            target_value = goal_row.get("target_value")
            current_value = goal_row.get("current_value", 0)
            complete_payload = {
                "status": "completed",
                "current_value": target_value if target_value is not None else current_value,
            }
            goal_res = await asyncio.to_thread(
                lambda: supabase.table("goals")
                .update(complete_payload)
                .eq("id", goal_row["id"])
                .eq("user_id", user.id)
                .execute()
            )
            if goal_res.data and len(goal_res.data) > 0:
                completed_name = goal_res.data[0].get("name", goal_row.get("name", "meta"))
                res_json["mensaje_sistema"] = f"🏁 Meta completada: {completed_name}."
                res_json["respuesta_usuario"] = res_json.get("respuesta_usuario") or f"Perfecto, marqué la meta {completed_name} como completada."
                res_json["xp_ganada"] = 80
                res_json["executed"] = True
            else:
                res_json["mensaje_sistema"] = "⚠️ La meta se procesó, pero no pude verificarla en la base de datos."
        except Exception:
            logger.error("COMPLETE_GOAL error", exc_info=True)
            res_json["mensaje_sistema"] = "Error de base de datos al completar la meta."
        return True

    return False


async def _get_focus_status(user) -> dict:
    try:
        current_res = await asyncio.to_thread(
            lambda: supabase.table("focus_status").select("*").eq("user_id", user.id).limit(1).execute()
        )
        return (current_res.data or [None])[0] or {}
    except Exception:
        return {}


async def _upsert_focus_status(
    user,
    *,
    focus_streak: Optional[int] = None,
    focus_best: Optional[int] = None,
    urge_count: Optional[int] = None,
    last_check_date: Optional[str] = None,
):
    current = await _get_focus_status(user)
    payload = {
        "user_id": user.id,
        "focus_streak": int(focus_streak if focus_streak is not None else current.get("focus_streak", 0) or 0),
        "focus_best": int(focus_best if focus_best is not None else current.get("focus_best", 0) or 0),
        "urge_count": int(urge_count if urge_count is not None else current.get("urge_count", 0) or 0),
        "last_check_date": last_check_date if last_check_date is not None else current.get("last_check_date"),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await asyncio.to_thread(lambda: supabase.table("focus_status").upsert(payload, on_conflict="user_id").execute())
    return (res.data or [payload])[0]


async def handle_health_intent(intent: str, ext: dict[str, Any], user, res_json: dict) -> bool:
    if intent == "REGISTER_FOCUS_DAY":
        try:
            current = await _upsert_focus_status(user)
            last_check = current.get("last_check_date")
            today = datetime.now(timezone.utc).date().isoformat()
            if last_check != today:
                streak = int(current.get("focus_streak", 0) or 0) + 1
                best = max(int(current.get("focus_best", 0) or 0), streak)
                updated = await _upsert_focus_status(user, focus_streak=streak, focus_best=best, last_check_date=today)
                res_json["mensaje_sistema"] = f"âœ… Racha actualizada a {updated.get('focus_streak', streak)} dÃ­as."
                res_json["respuesta_usuario"] = res_json.get("respuesta_usuario") or f"Bien, dejÃ© tu racha en {updated.get('focus_streak', streak)} dÃ­as."
            else:
                res_json["mensaje_sistema"] = "âœ… Ya habÃ­as registrado tu dÃ­a de enfoque hoy."
                res_json["respuesta_usuario"] = res_json.get("respuesta_usuario") or "Ya quedÃ³ registrado tu dÃ­a de enfoque de hoy."
            res_json["xp_ganada"] = 25
            res_json["executed"] = True
        except Exception:
            logger.error("REGISTER_FOCUS_DAY error", exc_info=True)
            res_json["mensaje_sistema"] = "Error al registrar tu dÃ­a de enfoque."
        return True

    if intent == "REGISTER_URGE":
        try:
            current = await _upsert_focus_status(user)
            urge_count = int(current.get("urge_count", 0) or 0) + 1
            updated = await _upsert_focus_status(
                user,
                urge_count=urge_count,
                focus_streak=int(current.get("focus_streak", 0) or 0),
                focus_best=int(current.get("focus_best", 0) or 0),
            )
            res_json["mensaje_sistema"] = f"âœ… Impulso registrado. Total: {updated.get('urge_count', urge_count)}."
            res_json["respuesta_usuario"] = res_json.get("respuesta_usuario") or "Listo, registrÃ© el impulso y dejo activo el protocolo."
            res_json["xp_ganada"] = 10
            res_json["executed"] = True
        except Exception:
            logger.error("REGISTER_URGE error", exc_info=True)
            res_json["mensaje_sistema"] = "Error al registrar el impulso."
        return True

    if intent == "REGISTER_RELAPSE":
        try:
            current = await _upsert_focus_status(user)
            urge_count = int(current.get("urge_count", 0) or 0) + 1
            updated = await _upsert_focus_status(
                user,
                focus_streak=0,
                urge_count=urge_count,
                focus_best=int(current.get("focus_best", 0) or 0),
                last_check_date=datetime.now(timezone.utc).date().isoformat(),
            )
            res_json["mensaje_sistema"] = f"âš ï¸ Racha reiniciada. Mejor marca: {updated.get('focus_best', 0)} dÃ­as."
            res_json["respuesta_usuario"] = res_json.get("respuesta_usuario") or "Entendido, reiniciÃ© la racha y dejÃ© el sistema listo para empezar de nuevo."
            res_json["xp_ganada"] = 5
            res_json["executed"] = True
        except Exception:
            logger.error("REGISTER_RELAPSE error", exc_info=True)
            res_json["mensaje_sistema"] = "Error al reiniciar la racha."
        return True

    if intent == "RESET_FOCUS":
        try:
            current = await _upsert_focus_status(user)
            updated = await _upsert_focus_status(
                user,
                focus_streak=0,
                urge_count=int(current.get("urge_count", 0) or 0),
                focus_best=int(current.get("focus_best", 0) or 0),
                last_check_date=current.get("last_check_date"),
            )
            res_json["mensaje_sistema"] = f"âœ… Enfoque reiniciado. Racha actual: {updated.get('focus_streak', 0)}."
            res_json["respuesta_usuario"] = res_json.get("respuesta_usuario") or "Listo, reiniciÃ© el enfoque y dejÃ© todo en cero."
            res_json["xp_ganada"] = 5
            res_json["executed"] = True
        except Exception:
            logger.error("RESET_FOCUS error", exc_info=True)
            res_json["mensaje_sistema"] = "Error al reiniciar la racha."
        return True

    if intent == "LOG_WEIGHT" and ext:
        try:
            raw_weight = ext.get("weight", ext.get("value", 0))
            weight = float(raw_weight)
            if weight <= 0:
                raise ValueError("Peso invÃ¡lido")
            res_w = await asyncio.to_thread(lambda: supabase.table("weight_logs").insert({
                "user_id": user.id,
                "weight": weight,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }).execute())
            if res_w.data and len(res_w.data) > 0:
                res_json["mensaje_sistema"] = f"âœ… Peso registrado: {weight} kg."
                res_json["respuesta_usuario"] = res_json.get("respuesta_usuario") or f"Listo, dejÃ© tu peso en {weight} kg."
                res_json["xp_ganada"] = 15
                res_json["executed"] = True
            else:
                res_json["mensaje_sistema"] = "âšï¸ El peso se procesÃ³, pero no pude verificarlo en la base de datos."
        except Exception:
            logger.error("LOG_WEIGHT error", exc_info=True)
            res_json["mensaje_sistema"] = "Error de base de datos al registrar el peso."
        return True

    if intent == "LOG_EXERCISE" and ext:
        try:
            exercise_name = str(ext.get("exercise_name") or ext.get("name") or "").strip()
            if not exercise_name:
                raise ValueError("Ejercicio invalido")

            try:
                weight = float(ext.get("weight", 0) or 0)
            except (ValueError, TypeError):
                weight = 0
            try:
                reps = int(ext.get("reps", 0) or 0)
            except (ValueError, TypeError):
                reps = 0
            try:
                sets = int(ext.get("sets", 0) or 0)
            except (ValueError, TypeError):
                sets = 0
            try:
                rpe = int(ext.get("rpe", 8) or 8)
            except (ValueError, TypeError):
                rpe = 8

            if weight <= 0 or reps <= 0 or sets <= 0:
                raise ValueError("Peso, repeticiones y series deben ser mayores a cero")

            from routers.health import _upsert_exercise_log
            await _upsert_exercise_log(user.id, exercise_name, weight, reps, sets, rpe)

            reps_text = f"{sets}x{reps}" if sets and reps else "serie registrada"
            weight_text = f" con {weight} kg" if weight else ""
            res_json["mensaje_sistema"] = f"Ejercicio registrado: {exercise_name}{weight_text} ({reps_text})."
            res_json["respuesta_usuario"] = res_json.get("respuesta_usuario") or f"Listo, deje registrado {exercise_name}{weight_text}."
            res_json["xp_ganada"] = 20
            res_json["executed"] = True
        except Exception:
            logger.error("LOG_EXERCISE error", exc_info=True)
            res_json["mensaje_sistema"] = "Error de base de datos al registrar el ejercicio."
        return True

    if intent == "LOG_SLEEP" and ext:
        try:
            date = str(ext.get("date") or datetime.now(timezone.utc).date().isoformat()).strip()
            bed_time = str(ext.get("bed_time") or ext.get("sleep_time") or ext.get("bedTime") or "22:30").strip()
            wake_time = str(ext.get("wake_time") or ext.get("wakeTime") or "06:00").strip()
            cycles_raw = ext.get("cycles", 5)
            quality_raw = ext.get("quality_score", ext.get("quality", 3))
            notes = str(ext.get("notes") or "").strip()

            cycles = max(1, min(8, int(cycles_raw or 5)))
            quality_score = max(1, min(5, int(quality_raw or 3)))

            res = await asyncio.to_thread(lambda: supabase.table("sleep_logs").insert({
                "user_id": user.id,
                "date": date,
                "bed_time": bed_time,
                "wake_time": wake_time,
                "cycles": cycles,
                "quality_score": quality_score,
                "notes": notes,
            }).execute())

            if not res.data:
                raise RuntimeError("No se pudo registrar el sueno.")

            # Keep sleep debt in sync with schedule module behavior.
            delta = 7.5 - (cycles * 1.5)
            bio = await asyncio.to_thread(
                lambda: supabase.table("user_bio_settings").select("sleep_debt_hours").eq("user_id", user.id).limit(1).execute()
            )
            current_debt = float(bio.data[0]["sleep_debt_hours"]) if bio.data else 0.0
            new_debt = max(0.0, current_debt + delta)
            await asyncio.to_thread(
                lambda: supabase.table("user_bio_settings").update({"sleep_debt_hours": new_debt}).eq("user_id", user.id).execute()
            )

            res_json["mensaje_sistema"] = f"Sueno registrado: {cycles} ciclos."
            res_json["respuesta_usuario"] = res_json.get("respuesta_usuario") or f"Listo, registre tu descanso de {bed_time} a {wake_time}."
            res_json["xp_ganada"] = 15
            res_json["executed"] = True
        except Exception:
            logger.error("LOG_SLEEP error", exc_info=True)
            res_json["mensaje_sistema"] = "Error de base de datos al registrar el sueno."
        return True

    return False


DAY_ALIASES = {
    "lunes": "Lunes",
    "martes": "Martes",
    "miercoles": "Miércoles",
    "miércoles": "Miércoles",
    "jueves": "Jueves",
    "viernes": "Viernes",
    "sabado": "Sábado",
    "sábado": "Sábado",
    "domingo": "Domingo",
    "monday": "Lunes",
    "tuesday": "Martes",
    "wednesday": "Miércoles",
    "thursday": "Jueves",
    "friday": "Viernes",
    "saturday": "Sábado",
    "sunday": "Domingo",
}


def normalize_day_name(raw: str) -> str:
    value = normalize_text(raw or "")
    return DAY_ALIASES.get(value, raw.strip().title() if raw else "")


async def _resolve_shift_reference(user, ext: dict[str, Any]) -> tuple[Optional[dict], Optional[str]]:
    raw_reference = str(
        ext.get("shift_id")
        or ext.get("shiftId")
        or ext.get("id")
        or ext.get("day")
        or ext.get("day_name")
        or ext.get("dayName")
        or ""
    ).strip()
    if not raw_reference:
        return None, None

    is_uuid = bool(re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', raw_reference.lower()))
    if is_uuid:
        check = await asyncio.to_thread(
            lambda: supabase.table("shifts")
                .select("*")
                .eq("id", raw_reference)
                .eq("user_id", user.id)
                .limit(1)
                .execute()
        )
        if check.data:
            return check.data[0], raw_reference

    search_terms = [raw_reference, normalize_day_name(raw_reference)]
    for candidate in [c for c in search_terms if c]:
        s = await asyncio.to_thread(
            lambda candidate=candidate: supabase.table("shifts")
                .select("*")
                .eq("user_id", user.id)
                .ilike("day", f"%{candidate}%")
                .limit(1)
                .execute()
        )
        if s.data:
            return s.data[0], raw_reference

    fallback = await asyncio.to_thread(
        lambda: supabase.table("shifts")
            .select("*")
            .eq("user_id", user.id)
            .limit(1)
            .execute()
    )
    if fallback.data:
        return fallback.data[0], raw_reference

    return None, raw_reference


async def handle_schedule_intent(intent: str, ext: dict[str, Any], user, res_json: dict) -> bool:
    if intent == "CREATE_SHIFT" and ext:
        try:
            day = normalize_day_name(str(ext.get("day") or ext.get("day_name") or ext.get("dayName") or ""))
            start = str(ext.get("start") or ext.get("start_time") or ext.get("startTime") or "").strip()
            end = str(ext.get("end") or ext.get("end_time") or ext.get("endTime") or "").strip()
            if not day or not start or not end:
                raise ValueError("Faltan datos para crear el turno")
            res = await asyncio.to_thread(lambda: supabase.table("shifts").insert({
                "user_id": user.id,
                "day": day,
                "start": start,
                "end": end,
            }).execute())
            if res.data and len(res.data) > 0:
                shift = res.data[0]
                res_json["mensaje_sistema"] = f"âœ… Turno creado: {day} {start} - {end}."
                res_json["respuesta_usuario"] = res_json.get("respuesta_usuario") or f"Listo, dejÃ© el turno del {day} de {start} a {end}."
                res_json["xp_ganada"] = 20
                res_json["executed"] = True
            else:
                res_json["mensaje_sistema"] = "âš ï¸ El turno se procesÃ³, pero no pude verificarlo en la base de datos."
        except Exception:
            logger.error("CREATE_SHIFT error", exc_info=True)
            res_json["mensaje_sistema"] = "Error de base de datos al crear el turno."
        return True

    if intent == "UPDATE_SHIFT" and ext:
        try:
            shift_row, raw_reference = await _resolve_shift_reference(user, ext)
            if not shift_row:
                raise ValueError(f"No encontrÃ© el turno '{raw_reference or ''}'.")
            update_data = {}
            day = normalize_day_name(str(ext.get("day") or ext.get("day_name") or ext.get("dayName") or ""))
            start = str(ext.get("start") or ext.get("start_time") or ext.get("startTime") or "").strip()
            end = str(ext.get("end") or ext.get("end_time") or ext.get("endTime") or "").strip()
            if day:
                update_data["day"] = day
            if start:
                update_data["start"] = start
            if end:
                update_data["end"] = end
            if not update_data:
                raise ValueError("No recibÃ­ cambios para actualizar el turno.")
            res = await asyncio.to_thread(
                lambda: supabase.table("shifts").update(update_data).eq("id", shift_row["id"]).eq("user_id", user.id).execute()
            )
            if res.data and len(res.data) > 0:
                updated = res.data[0]
                res_json["mensaje_sistema"] = f"âœ… Turno actualizado: {updated.get('day', 'turno')}."
                res_json["respuesta_usuario"] = res_json.get("respuesta_usuario") or f"Listo, actualicÃ© el turno de {updated.get('day', 'ese dÃ­a')}."
                res_json["xp_ganada"] = 15
                res_json["executed"] = True
            else:
                res_json["mensaje_sistema"] = "âš ï¸ El turno se procesÃ³, pero no pude verificarlo en la base de datos."
        except Exception:
            logger.error("UPDATE_SHIFT error", exc_info=True)
            res_json["mensaje_sistema"] = "Error de base de datos al actualizar el turno."
        return True

    if intent == "DELETE_SHIFT" and ext:
        try:
            shift_row, raw_reference = await _resolve_shift_reference(user, ext)
            if not shift_row:
                raise ValueError(f"No encontrÃ© el turno '{raw_reference or ''}'.")
            await asyncio.to_thread(
                lambda: supabase.table("shifts").delete().eq("id", shift_row["id"]).eq("user_id", user.id).execute()
            )
            res_json["mensaje_sistema"] = f"ðŸ—‘ï¸ Turno eliminado: {shift_row.get('day', 'turno')}."
            res_json["respuesta_usuario"] = res_json.get("respuesta_usuario") or f"Listo, eliminÃ© el turno de {shift_row.get('day', 'ese dÃ­a')}."
            res_json["xp_ganada"] = 5
            res_json["executed"] = True
        except Exception:
            logger.error("DELETE_SHIFT error", exc_info=True)
            res_json["mensaje_sistema"] = "Error de base de datos al eliminar el turno."
        return True

    if intent == "SET_WAKE_TIME" and ext:
        try:
            wake_time = str(ext.get("t_wake_target") or ext.get("wake_time") or ext.get("time") or "").strip()
            if not wake_time:
                raise ValueError("Hora de despertar invÃ¡lida")
            existing = await asyncio.to_thread(
                lambda: supabase.table("user_bio_settings").select("id").eq("user_id", user.id).limit(1).execute()
            )
            data = {"user_id": user.id, "t_wake_target": wake_time}
            if existing.data:
                res = await asyncio.to_thread(lambda: supabase.table("user_bio_settings").update(data).eq("user_id", user.id).execute())
            else:
                res = await asyncio.to_thread(lambda: supabase.table("user_bio_settings").insert(data).execute())
            if res.data and len(res.data) > 0:
                res_json["mensaje_sistema"] = f"âœ… Hora de despertar ajustada a {wake_time}."
                res_json["respuesta_usuario"] = res_json.get("respuesta_usuario") or f"Listo, dejÃ© tu hora objetivo en {wake_time}."
                res_json["xp_ganada"] = 10
                res_json["executed"] = True
            else:
                res_json["mensaje_sistema"] = "âš ï¸ La hora se procesÃ³, pero no pude verificarla en la base de datos."
        except Exception:
            logger.error("SET_WAKE_TIME error", exc_info=True)
            res_json["mensaje_sistema"] = "Error de base de datos al actualizar la hora de despertar."
        return True

    return False


def _normalize_day_index(raw: Any) -> Optional[int]:
    if raw is None:
        return None
    day_names = {
        "domingo": 0, "lunes": 1, "martes": 2, "miercoles": 3, "miércoles": 3,
        "jueves": 4, "viernes": 5, "sabado": 6, "sábado": 6,
    }
    try:
        value = int(str(raw).strip())
        if 0 <= value <= 6:
            return value
    except Exception:
        pass
    key = normalize_text(str(raw))
    return day_names.get(key)


async def handle_finance_intent(intent: str, ext: dict[str, Any], user, res_json: dict) -> bool:
    if intent == "REGISTER_INCOME" and ext:
        try:
            amount = float(ext.get("amount", 0) or 0)
            if amount <= 0:
                raise ValueError("Monto de ingreso inválido")
            description = str(ext.get("description") or ext.get("name") or "Ingreso").strip()[:80]
            category = str(ext.get("category") or "Sueldo").strip()[:40] or "Sueldo"
            payload = {
                "user_id": user.id,
                "description": description,
                "amount": amount,
                "category": category,
                "type": "INGRESO",
            }
            res = await asyncio.to_thread(lambda: supabase.table("finances").insert(payload).execute())
            if not res.data:
                compat = {k: v for k, v in payload.items() if k != "type"}
                res = await asyncio.to_thread(lambda: supabase.table("finances").insert(compat).execute())
            res_json["mensaje_sistema"] = f"Ingreso registrado: ${amount:,.0f}."
            res_json["respuesta_usuario"] = res_json.get("respuesta_usuario") or f"Listo, registré ${amount:,.0f} como ingreso."
            res_json["xp_ganada"] = 20
            res_json["executed"] = True
        except Exception:
            logger.error("REGISTER_INCOME error", exc_info=True)
            res_json["mensaje_sistema"] = "Error de base de datos al registrar el ingreso."
        return True

    if intent == "FIXED_EXPENSE" and ext:
        try:
            amount = float(ext.get("amount", 0) or 0)
            if amount <= 0:
                raise ValueError("Monto de gasto fijo inválido")
            name = str(ext.get("name") or ext.get("description") or "Factura").strip()[:80]
            due_date = str(ext.get("due_date") or ext.get("dueDate") or "").strip() or None
            category = str(ext.get("category") or "Servicios").strip()[:40] or "Servicios"
            payload = {
                "user_id": user.id,
                "name": name,
                "amount": amount,
                "category": category,
                "due_date": due_date,
                "is_paid": False,
            }
            res = await asyncio.to_thread(lambda: supabase.table("fixed_expenses").insert(payload).execute())
            res_json["mensaje_sistema"] = f"Factura fija registrada: {name} por ${amount:,.0f}."
            res_json["respuesta_usuario"] = res_json.get("respuesta_usuario") or f"Listo, agregué la factura {name}."
            res_json["xp_ganada"] = 20
            res_json["executed"] = True
        except Exception:
            logger.error("FIXED_EXPENSE error", exc_info=True)
            res_json["mensaje_sistema"] = "Error de base de datos al registrar la factura fija."
        return True

    if intent == "PAY_FIXED_EXPENSE" and ext:
        try:
            raw_ref = str(ext.get("expense_id") or ext.get("id") or ext.get("name") or ext.get("description") or "").strip()
            if not raw_ref:
                raise ValueError("No llegó referencia de factura")
            query = await asyncio.to_thread(
                lambda: supabase.table("fixed_expenses")
                .select("*")
                .eq("user_id", user.id)
                .ilike("name", f"%{raw_ref}%")
                .limit(1)
                .execute()
            )
            row = (query.data or [None])[0]
            if not row:
                raise ValueError("Factura no encontrada")
            update_payload = {
                "is_paid": True,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            await asyncio.to_thread(
                lambda: supabase.table("fixed_expenses")
                .update(update_payload)
                .eq("id", row["id"])
                .eq("user_id", user.id)
                .execute()
            )
            res_json["mensaje_sistema"] = f"Factura marcada como pagada: {row.get('name', 'Factura')}."
            res_json["respuesta_usuario"] = res_json.get("respuesta_usuario") or f"Hecho, marqué como pagada {row.get('name', 'esa factura')}."
            res_json["xp_ganada"] = 15
            res_json["executed"] = True
        except Exception:
            logger.error("PAY_FIXED_EXPENSE error", exc_info=True)
            res_json["mensaje_sistema"] = "Error al marcar la factura como pagada."
        return True

    return False


async def handle_routine_intent(intent: str, ext: dict[str, Any], user, res_json: dict) -> bool:
    if intent == "CREATE_ROUTINE" and ext:
        try:
            day_index = _normalize_day_index(ext.get("day_index") or ext.get("day") or ext.get("day_name"))
            if day_index is None:
                raise ValueError("Día inválido")
            day_name = str(ext.get("day_name") or ext.get("day") or "").strip() or f"Día {day_index}"
            exercises = ext.get("exercises") or []
            if not isinstance(exercises, list):
                exercises = []

            existing = await asyncio.to_thread(
                lambda: supabase.table("routines")
                .select("id, day_name, exercises")
                .eq("user_id", user.id)
                .eq("day_index", day_index)
                .limit(1)
                .execute()
            )
            existing_row = (existing.data or [None])[0]
            if existing_row:
                res_json["mensaje_sistema"] = (
                    f"Tu rutina base para {existing_row.get('day_name', day_name)} ya existe. "
                    "Puedo ajustarla, agregar o quitar ejercicios, pero no reemplazarla completa."
                )
                res_json["respuesta_usuario"] = res_json.get("respuesta_usuario") or (
                    f"Ya tienes una rutina base para {day_name}. Si quieres, te la adapto por partes."
                )
                res_json["xp_ganada"] = 5
                return True

            payload = {
                "user_id": user.id,
                "day_index": day_index,
                "day_name": day_name,
                "exercises": exercises,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            await asyncio.to_thread(lambda: supabase.table("routines").upsert(payload, on_conflict="user_id,day_index").execute())
            res_json["mensaje_sistema"] = f"Rutina guardada para {day_name}."
            res_json["respuesta_usuario"] = res_json.get("respuesta_usuario") or f"Listo, creé tu rutina de {day_name}."
            res_json["xp_ganada"] = 20
            res_json["executed"] = True
        except Exception:
            logger.error("CREATE_ROUTINE error", exc_info=True)
            res_json["mensaje_sistema"] = "Error al crear la rutina."
        return True

    if intent in ("ADD_ROUTINE_EXERCISE", "REMOVE_ROUTINE_EXERCISE", "UPDATE_ROUTINE") and ext:
        try:
            day_index = _normalize_day_index(ext.get("day_index") or ext.get("day") or ext.get("day_name"))
            if day_index is None:
                raise ValueError("Día inválido")
            current = await asyncio.to_thread(
                lambda: supabase.table("routines")
                .select("*")
                .eq("user_id", user.id)
                .eq("day_index", day_index)
                .limit(1)
                .execute()
            )
            row = (current.data or [None])[0]
            if not row:
                raise ValueError("Rutina no encontrada")
            exercises = row.get("exercises") or []
            if not isinstance(exercises, list):
                exercises = []

            if intent == "ADD_ROUTINE_EXERCISE":
                name = str(ext.get("name") or ext.get("exercise_name") or "").strip()
                if not name:
                    raise ValueError("Ejercicio inválido")
                exercises.append({
                    "name": name,
                    "suggestedSets": int(ext.get("sets") or ext.get("suggestedSets") or 3),
                    "suggestedReps": str(ext.get("reps") or ext.get("suggestedReps") or "8-12"),
                })
            elif intent == "REMOVE_ROUTINE_EXERCISE":
                target = normalize_text(str(ext.get("name") or ext.get("exercise_name") or ""))
                exercises = [e for e in exercises if normalize_text(str((e or {}).get("name", ""))) != target]
            else:
                incoming = ext.get("exercises")
                if isinstance(incoming, list):
                    exercises = incoming

            updated = {
                "exercises": exercises,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            await asyncio.to_thread(
                lambda: supabase.table("routines")
                .update(updated)
                .eq("user_id", user.id)
                .eq("day_index", day_index)
                .execute()
            )
            res_json["mensaje_sistema"] = "Rutina actualizada."
            res_json["respuesta_usuario"] = res_json.get("respuesta_usuario") or "Perfecto, actualicé tu rutina."
            res_json["xp_ganada"] = 15
            res_json["executed"] = True
        except Exception:
            logger.error(f"{intent} error", exc_info=True)
            res_json["mensaje_sistema"] = "Error al actualizar la rutina."
        return True

    if intent == "COMPLETE_ROUTINE" and ext:
        try:
            day_index = _normalize_day_index(ext.get("day_index") or ext.get("day") or ext.get("day_name"))
            if day_index is None:
                raise ValueError("Día inválido")
            completed_at = datetime.now(timezone.utc).isoformat()
            res = await asyncio.to_thread(
                lambda: supabase.table("routines")
                .update({"completed_at": completed_at, "updated_at": completed_at})
                .eq("user_id", user.id)
                .eq("day_index", day_index)
                .execute()
            )
            if not res.data:
                raise ValueError("Rutina no encontrada")
            res_json["mensaje_sistema"] = "Rutina marcada como completada."
            res_json["respuesta_usuario"] = res_json.get("respuesta_usuario") or "Excelente, marqué la rutina como hecha."
            res_json["xp_ganada"] = 25
            res_json["executed"] = True
        except Exception:
            logger.error("COMPLETE_ROUTINE error", exc_info=True)
            res_json["mensaje_sistema"] = "Error al completar la rutina."
        return True

    return False


async def handle_metric_intent(intent: str, ext: dict[str, Any], user, res_json: dict) -> bool:
    if intent != "LOG_METRIC" or not ext:
        return False

    try:
        goal_row, raw_goal_reference = await _resolve_goal_reference(user, ext)

        if not goal_row:
            raw_unit = normalize_text(ext.get("unit", ""))
            inferred_type = UNIT_TO_GOAL_TYPE.get(raw_unit)
            if inferred_type:
                inferred = await asyncio.to_thread(
                    lambda: supabase.table("goals")
                    .select("id, name")
                    .eq("user_id", user.id)
                    .neq("status", "archived")
                    .eq("goal_type", inferred_type)
                    .limit(1)
                    .execute()
                )
                if inferred.data:
                    goal_row = inferred.data[0]

        if not goal_row:
            fallback = await asyncio.to_thread(
                lambda: supabase.table("goals")
                .select("id, name")
                .eq("user_id", user.id)
                .neq("status", "archived")
                .limit(1)
                .execute()
            )
            if fallback.data:
                goal_row = fallback.data[0]

        if not goal_row:
            res_json["mensaje_sistema"] = "No encontré una meta activa con ese nombre. ¿Quieres que la cree?"
            res_json["xp_ganada"] = 5
            return True

        data_to_insert = {
            "goal_id": goal_row["id"],
            "user_id": user.id,
            "value": ext.get("value", 0),
            "unit": ext.get("unit", ""),
            "notes": ext.get("notes", ""),
        }
        metric_res = await asyncio.to_thread(lambda: supabase.table("metrics").insert(data_to_insert).execute())
        if metric_res.data and len(metric_res.data) > 0:
            metric_value = ext.get("value", 0)
            metric_unit = ext.get("unit", "")
            res_json["mensaje_sistema"] = f"Avance registrado: {metric_value} {metric_unit}."
            res_json["respuesta_usuario"] = res_json.get("respuesta_usuario") or f"Listo, dejé registrado el avance en {goal_row.get('name', 'tu meta')}."
            res_json["xp_ganada"] = 20
            res_json["executed"] = True
            try:
                await asyncio.to_thread(
                    lambda: supabase.table("goals")
                    .update({"current_value": ext.get("value", 0)})
                    .eq("id", goal_row["id"])
                    .execute()
                )
            except Exception:
                logger.warning("No se pudo sincronizar goals.current_value desde LOG_METRIC.")
        else:
            res_json["mensaje_sistema"] = "Avance registrado pero no verificado."
        return True
    except Exception:
        logger.error("LOG_METRIC error", exc_info=True)
        res_json["mensaje_sistema"] = "Error de base de datos al registrar avance."
        return True

