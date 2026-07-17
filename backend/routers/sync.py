import asyncio
import json
import logging
import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from google import genai

from auth import get_current_user
from database import supabase
from routers.finances import _execute_finance_query_ordered
from routers.schedule import compute_current_status
from services.observability import track_event
from trm import get_trm

logger = logging.getLogger("escudo")
router = APIRouter()

_quote_cache: dict = {}
_ai_client = None
_gemini_key = os.getenv("GEMINI_API_KEY")
if _gemini_key:
    try:
        _ai_client = genai.Client(api_key=_gemini_key)
    except Exception as exc:
        logger.warning(f"No se pudo inicializar Gemini para sync: {exc}")


async def _fetch_table(user_id: str, table_name: str, limit: Optional[int] = None):
    try:
        query = supabase.table(table_name).select("*").eq("user_id", user_id)
        if limit:
            query = query.limit(limit)
        result = await asyncio.to_thread(query.execute)
        return result.data or []
    except Exception as exc:
        logger.warning(f"{table_name} fetch error: {exc}")
        return []


@router.get("/api/v1/sync")
async def sync_data(user=Depends(get_current_user)):
    """Sincroniza los datos del usuario en una sola respuesta consolidada."""
    try:
        trm_actual = 4000.0
        try:
            trm_actual = await get_trm()
        except Exception as trm_err:
            logger.warning(f"get_trm falló: {trm_err}")

        profile_data = {}
        try:
            res_prof = await asyncio.to_thread(
                lambda: supabase.table("profiles").select("*").eq("user_id", user.id).execute()
            )
            profile_data = res_prof.data[0] if (res_prof.data and len(res_prof.data) > 0) else {}
        except Exception as exc:
            logger.warning(f"Profile fetch error: {exc}")

        results = await asyncio.gather(
            _fetch_table(user.id, "finances", limit=100),
            _fetch_table(user.id, "missions", limit=100),
            _fetch_table(user.id, "shifts"),
            _fetch_table(user.id, "routines"),
            _fetch_table(user.id, "weight_logs", limit=100),
            _fetch_table(user.id, "exercises_logs", limit=100),
            _fetch_table(user.id, "personal_records", limit=100),
            _fetch_table(user.id, "sleep_logs", limit=30),
            _fetch_table(user.id, "debts"),
            _fetch_table(user.id, "fixed_expenses"),
            _fetch_table(user.id, "focus_status", limit=1),
        )

        results_dict = {
            "finances": results[0],
            "missions": results[1],
            "shifts": results[2],
            "routines": results[3],
            "weight_logs": results[4],
            "exercise_logs": results[5],
            "personal_records": results[6],
            "sleep_logs": results[7],
            "debts": results[8],
            "fixed_expenses": results[9],
            "focus_status": results[10][0] if results[10] else None,
        }

        async def fetch_goals():
            try:
                goals_result = await asyncio.to_thread(
                    lambda: supabase.table("goals").select("*").eq("user_id", user.id).neq("status", "archived").execute()
                )
                goals_data = goals_result.data or []
                if not goals_data:
                    return []
                goal_ids = [goal["id"] for goal in goals_data]
                metrics_result = await asyncio.to_thread(
                    lambda: supabase.table("metrics").select("*").in_("goal_id", goal_ids).order("recorded_at", desc=True).execute()
                )
                all_metrics = metrics_result.data or []
                metrics_by_goal = {}
                for metric in all_metrics:
                    goal_id = metric.get("goal_id")
                    metrics_by_goal.setdefault(goal_id, []).append(metric)
                for goal in goals_data:
                    goal["recent_metrics"] = metrics_by_goal.get(goal["id"], [])[:5]
                return goals_data
            except Exception as exc:
                logger.warning(f"Goals fetch error: {exc}")
                return []

        async def fetch_bio():
            try:
                bio_result = await asyncio.to_thread(
                    lambda: supabase.table("user_bio_settings").select("*").eq("user_id", user.id).limit(1).execute()
                )
                return bio_result.data[0] if bio_result.data else None
            except Exception as exc:
                logger.warning(f"Bio settings fetch error: {exc}")
                return None

        results_dict["goals"], results_dict["bio_settings"] = await asyncio.gather(fetch_goals(), fetch_bio())

        quote = "La disciplina es el puente entre las metas y los logros."
        usage_stats = {"input_tokens": 0, "output_tokens": 0, "cost_usd": 0, "cost_cop": 0, "trm": trm_actual}

        today = datetime.now().strftime("%Y-%m-%d")
        cache_key = f"{user.id}:{today}"
        if cache_key in _quote_cache:
            quote, usage_stats = _quote_cache[cache_key]
            usage_stats["trm"] = trm_actual
            usage_stats["cost_cop"] = usage_stats["cost_usd"] * trm_actual
        elif _ai_client:
            try:
                user_name = profile_data.get("name", "usuario")
                ms_seed = datetime.now().microsecond
                prompt = (
                    f"SEMILLA: {ms_seed}. "
                    f"Dile a {user_name} una verdad breve y útil de 10 palabras sobre disciplina. "
                    f"REGLA: Solo texto plano. Sin JSON. Sin comillas."
                )
                response = await _ai_client.aio.models.generate_content(
                    model="models/gemini-2.5-flash-lite",
                    contents=prompt,
                    config=genai.types.GenerateContentConfig(temperature=1.0, top_p=0.95),
                )
                quote = response.text.strip()
                in_t = getattr(response.usage_metadata, "prompt_token_count", 0)
                out_t = getattr(response.usage_metadata, "candidates_token_count", 0)
                if in_t == 0:
                    in_t = len(prompt) // 4
                if out_t == 0:
                    out_t = len(quote) // 4
                cost_u = (in_t * 0.000000075) + (out_t * 0.0000003)
                usage_stats = {
                    "input_tokens": in_t,
                    "output_tokens": out_t,
                    "cost_usd": cost_u,
                    "cost_cop": cost_u * trm_actual,
                    "trm": trm_actual,
                }
                _quote_cache[cache_key] = (quote, usage_stats.copy())
                old_keys = [key for key in _quote_cache if not key.endswith(today)]
                for key in old_keys:
                    del _quote_cache[key]
            except Exception as exc:
                logger.warning(f"Quote/Telemetry error: {exc}")

        response_data = {
            "profile": profile_data,
            "finances": results_dict["finances"],
            "missions": results_dict["missions"],
            "shifts": results_dict["shifts"],
            "routines": results_dict["routines"],
            "weight_logs": results_dict["weight_logs"],
            "exercise_logs": results_dict["exercise_logs"],
            "personal_records": results_dict["personal_records"],
            "sleep_logs": results_dict["sleep_logs"],
            "debts": results_dict["debts"],
            "fixed_expenses": results_dict["fixed_expenses"],
            "focus_status": results_dict["focus_status"],
            "goals": results_dict["goals"],
            "bio_settings": results_dict["bio_settings"],
            "daily_quote": quote,
            "usage": usage_stats,
        }

        await track_event(
            module="sync",
            event="hydrate",
            status="ok",
            user_id=user.id,
            metadata={"finances_count": len(results_dict["finances"]), "missions_count": len(results_dict["missions"])},
        )

        return JSONResponse(
            content=json.loads(json.dumps(response_data, default=str)),
            headers={
                "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
                "Pragma": "no-cache",
                "Expires": "0",
            },
        )

    except Exception as exc:
        logger.error(f"Sync error: {exc}", exc_info=True)
        await track_event(
            module="sync",
            event="hydrate",
            status="error",
            user_id=user.id if hasattr(user, "id") else None,
            metadata={"error": str(exc)[:120]},
        )
        raise HTTPException(status_code=500, detail="Error interno del servidor.")


@router.get("/api/v1/today")
async def today_summary(user=Depends(get_current_user)):
    """Resumen diario liviano para el dashboard. No usa Gemini ni TRM."""
    try:
        from routers.schedule import _bogota_now
        now = _bogota_now()
        today_str = now.strftime("%Y-%m-%d")

        # Perfil ligero
        profile_data = {}
        try:
            res_prof = await asyncio.to_thread(
                lambda: supabase.table("profiles").select("user_id,email,name,level,xp,xp_to_next_level,title,streak").eq("user_id", user.id).execute()
            )
            profile_data = res_prof.data[0] if (res_prof.data and len(res_prof.data) > 0) else {}
        except Exception as exc:
            logger.warning(f"Profile fetch error: {exc}")

        # Finanzas del día
        finances_today = []
        try:
            query_fin = supabase.table("finances").select("*").eq("user_id", user.id).eq("date", today_str)
            res_fin = await _execute_finance_query_ordered(query_fin)
            finances_today = res_fin.data or []
        except Exception as exc:
            logger.warning(f"Finances today fetch error: {exc}")

        daily_balance = sum(
            (f.get("amount") or 0) if (f.get("type") or "").upper() == "INGRESO" else -(f.get("amount") or 0)
            for f in finances_today
        )

        # Turnos / estado
        shift_status = {"status": "free", "message_short": "Sin turnos registrados."}
        try:
            res_shifts = await asyncio.to_thread(
                lambda: supabase.table("shifts").select("*").eq("user_id", user.id).eq("is_active", True).execute()
            )
            shift_status = compute_current_status(res_shifts.data or [], now)
        except Exception as exc:
            logger.warning(f"Shifts status error: {exc}")

        # Metas activas
        goals = []
        try:
            goals_result = await asyncio.to_thread(
                lambda: supabase.table("goals").select("*").eq("user_id", user.id).neq("status", "archived").execute()
            )
            goals = goals_result.data or []
        except Exception as exc:
            logger.warning(f"Goals fetch error: {exc}")

        # Misiones de hoy (scheduled_date == hoy o status active)
        missions_today = []
        try:
            missions_result = await asyncio.to_thread(
                lambda: supabase.table("missions").select("*").eq("user_id", user.id).or_(f"schedule_date.eq.{today_str},status.eq.active").execute()
            )
            missions_today = missions_result.data or []
        except Exception as exc:
            logger.warning(f"Missions today fetch error: {exc}")

        # Último peso
        latest_weight = None
        try:
            weight_result = await asyncio.to_thread(
                lambda: supabase.table("weight_logs").select("*").eq("user_id", user.id).order("date", desc=True).order("timestamp", desc=True).limit(1).execute()
            )
            latest_weight = weight_result.data[0] if weight_result.data else None
        except Exception as exc:
            logger.warning(f"Weight fetch error: {exc}")

        # Tendencia de peso (último vs anterior)
        weight_trend = None
        try:
            if latest_weight:
                prev_weight_result = await asyncio.to_thread(
                    lambda: supabase.table("weight_logs").select("weight, date")
                    .eq("user_id", user.id)
                    .neq("id", latest_weight.get("id"))
                    .order("date", desc=True)
                    .order("timestamp", desc=True)
                    .limit(1)
                    .execute()
                )
                if prev_weight_result.data:
                    prev = prev_weight_result.data[0]
                    weight_trend = round((latest_weight.get("weight") or 0) - (prev.get("weight") or 0), 2)
        except Exception as exc:
            logger.warning(f"Weight trend error: {exc}")

        # Hábitos de hoy
        habits_today = []
        try:
            habits_result = await asyncio.to_thread(
                lambda: supabase.table("habits").select("*").eq("user_id", user.id).execute()
            )
            habits_data = habits_result.data or []
            if habits_data:
                habit_ids = [h["id"] for h in habits_data]
                completions_result = await asyncio.to_thread(
                    lambda: supabase.table("habit_completions")
                    .select("habit_id, date")
                    .in_("habit_id", habit_ids)
                    .eq("user_id", user.id)
                    .execute()
                )
                completions_by_habit = {}
                for row in completions_result.data or []:
                    completions_by_habit.setdefault(row.get("habit_id"), set()).add(row.get("date"))
                for h in habits_data:
                    completed = completions_by_habit.get(h["id"], set())
                    h["completed_today"] = today_str in completed
                    h["completed_dates"] = sorted(completed)
                    habits_today.append(h)
        except Exception as exc:
            logger.warning(f"Habits today fetch error: {exc}")

        # Focus streak
        focus_streak = 0
        try:
            focus_result = await asyncio.to_thread(
                lambda: supabase.table("focus_status").select("focus_streak,focus_best,urge_count,last_check_date").eq("user_id", user.id).limit(1).execute()
            )
            focus_streak = focus_result.data[0].get("focus_streak", 0) if focus_result.data else 0
        except Exception as exc:
            logger.warning(f"Focus fetch error: {exc}")

        response_data = {
            "profile": profile_data,
            "today": {
                "date": today_str,
                "balance": daily_balance,
                "finances": finances_today,
                "shift_status": shift_status,
                "active_goals": goals,
                "missions_today": missions_today,
                "latest_weight": latest_weight,
                "weight_trend": weight_trend,
                "habits_today": habits_today,
                "focus_streak": focus_streak,
            },
        }

        await track_event(
            module="sync",
            event="today",
            status="ok",
            user_id=user.id,
            metadata={"finances_today": len(finances_today), "missions_today": len(missions_today)},
        )

        return JSONResponse(
            content=json.loads(json.dumps(response_data, default=str)),
            headers={
                "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
                "Pragma": "no-cache",
                "Expires": "0",
            },
        )
    except Exception as exc:
        logger.error(f"Today error: {exc}", exc_info=True)
        await track_event(
            module="sync",
            event="today",
            status="error",
            user_id=user.id if hasattr(user, "id") else None,
            metadata={"error": str(exc)[:120]},
        )
        raise HTTPException(status_code=500, detail="Error interno del servidor.")
