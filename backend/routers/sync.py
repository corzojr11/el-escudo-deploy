import asyncio
import json
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from auth import get_current_user
from database import supabase
from routers.finances import _execute_finance_query_ordered
from routers.schedule import compute_current_status
from services.observability import track_event
from services.deepseek import complete_chat, is_configured as is_deepseek_configured
from trm import get_trm

logger = logging.getLogger("escudo")
router = APIRouter()

_quote_cache: dict = {}


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
        elif is_deepseek_configured():
            try:
                user_name = profile_data.get("name", "usuario")
                ms_seed = datetime.now().microsecond
                prompt = (
                    f"SEMILLA: {ms_seed}. "
                    f"Dile a {user_name} una verdad breve y útil de 10 palabras sobre disciplina. "
                    f"REGLA: Solo texto plano. Sin JSON. Sin comillas."
                )
                response = await complete_chat(
                    [{"role": "user", "content": prompt}],
                    temperature=1.0,
                    max_tokens=60,
                )
                quote = response["text"]
                in_t = response["prompt_tokens"]
                out_t = response["completion_tokens"]
                if in_t == 0:
                    in_t = len(prompt) // 4
                if out_t == 0:
                    out_t = len(quote) // 4
                cost_u = (in_t * 0.00000014) + (out_t * 0.00000028)
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


def _calculate_hydration_ml(latest_weight: dict | None) -> int | None:
    if not latest_weight or not latest_weight.get("weight"):
        return None
    raw = float(latest_weight["weight"]) * 35
    rounded = int(raw / 250 + 0.5) * 250
    return max(1500, min(3500, rounded))


@router.get("/api/v1/today")
async def today_summary(user=Depends(get_current_user)):
    """Resumen diario liviano para el dashboard. No depende de IA ni TRM."""
    try:
        from routers.schedule import _bogota_now
        now = _bogota_now()
        today_str = now.strftime("%Y-%m-%d")

        async def _fetch_profile():
            try:
                res = await asyncio.to_thread(
                    lambda: supabase.table("profiles")
                    .select("user_id,email,name,level,xp,xp_to_next_level,title,streak,birth_date,height_cm,health_goal,onboarding_completed_at,monthly_budget")
                    .eq("user_id", user.id).execute()
                )
                return res.data[0] if (res.data and len(res.data) > 0) else {}
            except Exception as exc:
                logger.warning(f"Profile fetch error: {exc}")
                return {}

        async def _fetch_finances():
            try:
                query = supabase.table("finances").select("*").eq("user_id", user.id).eq("date", today_str)
                res = await _execute_finance_query_ordered(query)
                return res.data or []
            except Exception as exc:
                logger.warning(f"Finances today fetch error: {exc}")
                return []

        async def _fetch_shifts():
            try:
                res = await asyncio.to_thread(
                    lambda: supabase.table("shifts").select("*").eq("user_id", user.id).eq("is_active", True).execute()
                )
                return compute_current_status(res.data or [], now)
            except Exception as exc:
                logger.warning(f"Shifts status error: {exc}")
                return {"status": "free", "message_short": "Sin turnos registrados."}

        async def _fetch_goals():
            try:
                res = await asyncio.to_thread(
                    lambda: supabase.table("goals").select("*").eq("user_id", user.id).neq("status", "archived").execute()
                )
                return res.data or []
            except Exception as exc:
                logger.warning(f"Goals fetch error: {exc}")
                return []

        async def _fetch_missions():
            try:
                from datetime import datetime
                from zoneinfo import ZoneInfo
                try:
                    now = datetime.now(ZoneInfo("America/Bogota"))
                except Exception:
                    now = datetime.now()
                start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
                end_of_day = start_of_day.replace(hour=23, minute=59, second=59, microsecond=999999)
                res = await asyncio.to_thread(
                    lambda: supabase.table("missions").select("*").eq("user_id", user.id)
                    .gte("scheduled_at", start_of_day.isoformat())
                    .lte("scheduled_at", end_of_day.isoformat())
                    .order("scheduled_at", desc=False)
                    .execute()
                )
                return res.data or []
            except Exception as exc:
                logger.warning(f"Missions today fetch error: {exc}")
                return []

        async def _fetch_latest_weight():
            try:
                res = await asyncio.to_thread(
                    lambda: supabase.table("weight_logs").select("*").eq("user_id", user.id)
                    .order("date", desc=True).order("timestamp", desc=True).limit(1).execute()
                )
                return res.data[0] if res.data else None
            except Exception as exc:
                logger.warning(f"Weight fetch error: {exc}")
                return None

        async def _fetch_habits():
            try:
                res = await asyncio.to_thread(
                    lambda: supabase.table("habits").select("*").eq("user_id", user.id).execute()
                )
                return res.data or []
            except Exception as exc:
                logger.warning(f"Habits fetch error: {exc}")
                return []

        async def _fetch_focus():
            try:
                res = await asyncio.to_thread(
                    lambda: supabase.table("focus_status")
                    .select("focus_streak,focus_best,urge_count,last_check_date")
                    .eq("user_id", user.id).limit(1).execute()
                )
                return res.data[0].get("focus_streak", 0) if res.data else 0
            except Exception as exc:
                logger.warning(f"Focus fetch error: {exc}")
                return 0

        async def _fetch_financial_stability():
            try:
                month_start = today_str[:8] + "01"
                month_finances, fixed_expenses, debts = await asyncio.gather(
                    asyncio.to_thread(
                        lambda: supabase.table("finances").select("amount,type").eq("user_id", user.id)
                        .gte("date", month_start).lte("date", today_str).execute()
                    ),
                    asyncio.to_thread(
                        lambda: supabase.table("fixed_expenses").select("id,name,amount,due_date,is_paid")
                        .eq("user_id", user.id).eq("is_paid", False).execute()
                    ),
                    asyncio.to_thread(
                        lambda: supabase.table("debts").select("id,name,total,remaining,monthly_payment,due_date")
                        .eq("user_id", user.id).execute()
                    ),
                )
                month_expense = sum(
                    float(row.get("amount") or 0)
                    for row in month_finances.data or []
                    if str(row.get("type") or "").upper() != "INGRESO"
                )
                return {
                    "month_expense": month_expense,
                    "fixed_expenses": fixed_expenses.data or [],
                    "debts": debts.data or [],
                }
            except Exception as exc:
                logger.warning(f"Financial stability fetch error: {exc}")
                return {"month_expense": None, "fixed_expenses": [], "debts": []}

        # ── Ejecución paralela: 8 consultas independientes ──
        profile_data, finances_today, shift_status, goals, missions_today, latest_weight, habits_data, focus_streak, financial_stability = await asyncio.gather(
            _fetch_profile(), _fetch_finances(), _fetch_shifts(), _fetch_goals(),
            _fetch_missions(), _fetch_latest_weight(), _fetch_habits(), _fetch_focus(), _fetch_financial_stability(),
        )

        # ── Cálculos derivados (ligeros, secuenciales sobre memoria) ──
        daily_balance = sum(
            (f.get("amount") or 0) if (f.get("type") or "").upper() == "INGRESO" else -(f.get("amount") or 0)
            for f in finances_today
        )

        # Tendencia de peso (depende de latest_weight)
        weight_trend = None
        if latest_weight:
            try:
                prev = await asyncio.to_thread(
                    lambda: supabase.table("weight_logs").select("weight, date")
                    .eq("user_id", user.id)
                    .neq("id", latest_weight.get("id"))
                    .order("date", desc=True).order("timestamp", desc=True).limit(1)
                    .execute()
                )
                if prev.data:
                    weight_trend = round((latest_weight.get("weight") or 0) - (prev.data[0].get("weight") or 0), 2)
            except Exception as exc:
                logger.warning(f"Weight trend error: {exc}")

        # Hábitos completados (depende de habits_data)
        habits_today = []
        if habits_data:
            try:
                habit_ids = [h["id"] for h in habits_data]
                completions_result = await asyncio.to_thread(
                    lambda: supabase.table("habit_completions")
                    .select("habit_id, date").in_("habit_id", habit_ids).eq("user_id", user.id).execute()
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
                logger.warning(f"Habits completions error: {exc}")

        # Hidratación (depende de latest_weight)
        hydration_ml = _calculate_hydration_ml(latest_weight)

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
                "hydration_ml": hydration_ml,
                "financial_stability": {
                    "monthly_budget": profile_data.get("monthly_budget") if profile_data else None,
                    **financial_stability,
                },
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
