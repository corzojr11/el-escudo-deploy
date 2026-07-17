"""Tests de Fase 3: metas, hábitos y salud confiables."""

import sys
import asyncio
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import MagicMock

sys.modules["google.genai"] = MagicMock()
sys.modules["sentry_sdk"] = MagicMock()
sys.modules["sentry_sdk.integrations.fastapi"] = MagicMock(FastApiIntegration=MagicMock())

import pytest
from fastapi.testclient import TestClient

from auth import get_current_user
from main import app
from routers import sync as sync_module
from routers import goals as goals_module
from routers import habits as habits_module
from routers import health as health_module

MOCK_USER_ID = "11111111-1111-1111-1111-111111111111"


async def _mock_get_current_user():
    return type("User", (), {"id": MOCK_USER_ID, "aud": "authenticated"})()


_original_overrides = app.dependency_overrides.copy()
app.dependency_overrides[get_current_user] = _mock_get_current_user


@pytest.fixture(autouse=True)
def _restore_app_state(monkeypatch):
    yield
    app.dependency_overrides.clear()
    app.dependency_overrides.update(_original_overrides)
    app.dependency_overrides[get_current_user] = _mock_get_current_user


# ─── Migration 032 safety ───────────────────────────────────────────────────

class TestMigration032:
    def test_migration_032_adds_required_columns_and_table(self):
        repo_root = Path(__file__).resolve().parents[2]
        migration_path = repo_root / "supabase" / "migrations" / "032_fase3_progress_health.sql"
        assert migration_path.exists(), "No se encontró la migración 032"
        sql = migration_path.read_text(encoding="utf-8")

        # metrics
        assert "ALTER TABLE public.metrics" in sql
        assert "ADD COLUMN IF NOT EXISTS date DATE" in sql
        assert "ADD COLUMN IF NOT EXISTS idempotency_key TEXT" in sql
        # weight_logs
        assert "ALTER TABLE public.weight_logs" in sql
        assert "ADD COLUMN IF NOT EXISTS date DATE" in sql
        assert "ADD COLUMN IF NOT EXISTS idempotency_key TEXT" in sql
        # habit_completions
        assert "CREATE TABLE IF NOT EXISTS public.habit_completions" in sql
        assert "UNIQUE(habit_id, date)" in sql
        # backfill usa information_schema
        assert "information_schema.columns" in sql
        # No referencias duras a columnas que podrían no existir
        assert "COALESCE(recorded_at" not in sql
        assert "COALESCE(timestamp" not in sql

    def test_migration_032_policies_are_idempotent(self):
        """032 debe dropear políticas existentes antes de crearlas para no fallar en segunda ejecución."""
        repo_root = Path(__file__).resolve().parents[2]
        migration_path = repo_root / "supabase" / "migrations" / "032_fase3_progress_health.sql"
        sql = migration_path.read_text(encoding="utf-8")

        for policy in ("p_habit_completions_select", "p_habit_completions_insert", "p_habit_completions_delete"):
            drop_line = f"DROP POLICY IF EXISTS {policy} ON public.habit_completions"
            create_line = f"CREATE POLICY {policy} ON public.habit_completions"
            assert drop_line in sql, f"032 debe contener '{drop_line}' para evitar fallar en segunda ejecución"
            assert create_line in sql, f"032 debe contener '{create_line}'"

    def test_migration_032_completed_dates_migration_is_guarded(self):
        """032 verifica existencia de completed_dates antes de migrar datos viejos."""
        repo_root = Path(__file__).resolve().parents[2]
        migration_path = repo_root / "supabase" / "migrations" / "032_fase3_progress_health.sql"
        sql = migration_path.read_text(encoding="utf-8")

        assert "column_name = 'completed_dates'" in sql, (
            "032 debe verificar que completed_dates existe antes de migrar datos"
        )
        assert "ON CONFLICT (habit_id, date) DO NOTHING" in sql


# ─── Goals / metrics ───────────────────────────────────────────────────────

class TestGoalsMetrics:
    def test_create_metric_includes_date_and_idempotency_key(self, monkeypatch):
        created_metric = {
            "id": "m1",
            "goal_id": "g1",
            "user_id": MOCK_USER_ID,
            "value": 75,
            "unit": "kg",
            "date": "2026-07-16",
        }

        mock_supa = MagicMock()
        goals_table = MagicMock()
        goals_table.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[{"id": "g1", "goal_type": "custom", "unit": "kg"}]
        )
        metrics_table = MagicMock()
        metrics_table.insert.return_value.execute.return_value = MagicMock(data=[created_metric])

        def table_side(name):
            if name == "goals":
                return goals_table
            if name == "metrics":
                return metrics_table
            return MagicMock()

        mock_supa.table.side_effect = table_side
        monkeypatch.setattr(goals_module, "supabase", mock_supa)

        client = TestClient(app)
        resp = client.post("/api/v1/metrics", json={"goal_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890", "value": 75, "unit": "kg", "date": "2026-07-16", "idempotency_key": "key-123"})

        assert resp.status_code == 200
        inserted = metrics_table.insert.call_args[0][0]
        assert inserted["goal_id"] == "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
        assert inserted["date"] == "2026-07-16"
        assert inserted["idempotency_key"] == "key-123"

    def test_create_metric_resolves_duplicate_idempotency_key(self, monkeypatch):
        existing_metric = {"id": "m1", "goal_id": "g1", "user_id": MOCK_USER_ID, "value": 75, "date": "2026-07-16"}

        mock_supa = MagicMock()
        goals_table = MagicMock()
        goals_table.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[{"id": "g1", "goal_type": "custom", "unit": "kg"}]
        )
        metrics_table = MagicMock()
        conflict_exc = Exception("duplicate key value violates unique constraint")
        conflict_exc.code = "23505"
        metrics_table.insert.return_value.execute.side_effect = conflict_exc
        metrics_table.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[existing_metric]
        )

        def table_side(name):
            if name == "goals":
                return goals_table
            if name == "metrics":
                return metrics_table
            return MagicMock()

        mock_supa.table.side_effect = table_side
        monkeypatch.setattr(goals_module, "supabase", mock_supa)

        client = TestClient(app)
        resp = client.post("/api/v1/metrics", json={"goal_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890", "value": 75, "idempotency_key": "dup-key"})

        assert resp.status_code == 200
        assert resp.json()["metric"]["id"] == "m1"

    def test_update_metric_rejects_future_date(self, monkeypatch):
        mock_supa = MagicMock()
        metrics_table = MagicMock()
        metrics_table.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[{"id": "m1", "goal_id": "g1", "value": 70}]
        )
        metrics_table.update.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{"id": "m1", "goal_id": "g1", "value": 72}]
        )

        def table_side(name):
            if name == "metrics":
                return metrics_table
            return MagicMock()

        mock_supa.table.side_effect = table_side
        monkeypatch.setattr(goals_module, "supabase", mock_supa)

        future = (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d")
        client = TestClient(app)
        resp = client.put("/api/v1/metrics/m1", json={"value": 72, "date": future})

        assert resp.status_code == 400


# ─── Habits ─────────────────────────────────────────────────────────────────

class TestHabits:
    def test_toggle_habit_uses_atomic_endpoint(self, monkeypatch):
        habit = {"id": "h1", "user_id": MOCK_USER_ID, "name": "Correr", "frequency": "daily", "streak": 0}

        mock_supa = MagicMock()
        habits_table = MagicMock()
        habits_table.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[habit]
        )
        habits_table.update.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{**habit, "streak": 1}]
        )

        completions_table = MagicMock()
        completions_table.select.return_value.in_.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(
            data=[{"habit_id": "h1", "date": "2026-07-16"}]
        )
        completions_table.insert.return_value.execute.return_value = MagicMock(data=[{}])

        def table_side(name):
            if name == "habits":
                return habits_table
            if name == "habit_completions":
                return completions_table
            return MagicMock()

        mock_supa.table.side_effect = table_side
        monkeypatch.setattr(habits_module, "supabase", mock_supa)

        client = TestClient(app)
        resp = client.post("/api/v1/habits/h1/toggle", json={"mark_done": True, "date": "2026-07-16"})

        assert resp.status_code == 200
        assert resp.json()["habit"]["id"] == "h1"
        assert completions_table.insert.called

    def test_toggle_habit_does_not_require_client_dates_array(self, monkeypatch):
        mock_supa = MagicMock()
        habits_table = MagicMock()
        habits_table.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[{"id": "h1", "user_id": MOCK_USER_ID, "name": "Leer", "frequency": "daily", "streak": 0}]
        )
        habits_table.update.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{"id": "h1", "user_id": MOCK_USER_ID, "name": "Leer", "frequency": "daily", "streak": 1}]
        )

        completions_table = MagicMock()
        completions_table.select.return_value.in_.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(
            data=[]
        )
        completions_table.insert.return_value.execute.return_value = MagicMock(data=[{}])

        def table_side(name):
            if name == "habits":
                return habits_table
            if name == "habit_completions":
                return completions_table
            return MagicMock()

        mock_supa.table.side_effect = table_side
        monkeypatch.setattr(habits_module, "supabase", mock_supa)

        client = TestClient(app)
        resp = client.post("/api/v1/habits/h1/toggle", json={"mark_done": True})

        assert resp.status_code == 200
        inserted = completions_table.insert.call_args[0][0]
        assert "date" in inserted


# ─── Health / weight ────────────────────────────────────────────────────────

class TestHealth:
    def test_add_weight_rejects_future_date(self, monkeypatch):
        mock_supa = MagicMock()
        weight_table = MagicMock()
        weight_table.insert.return_value.execute.return_value = MagicMock(data=[{"id": "w1", "weight": 78}])

        def table_side(name):
            if name == "weight_logs":
                return weight_table
            return MagicMock()

        mock_supa.table.side_effect = table_side
        monkeypatch.setattr(health_module, "supabase", mock_supa)

        future = (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d")
        client = TestClient(app)
        resp = client.post("/api/v1/weight", json={"weight": 78, "date": future})

        assert resp.status_code == 400

    def test_add_weight_uses_idempotency_key(self, monkeypatch):
        mock_supa = MagicMock()
        weight_table = MagicMock()
        weight_table.insert.return_value.execute.return_value = MagicMock(
            data=[{"id": "w1", "weight": 78, "date": "2026-07-16"}]
        )

        def table_side(name):
            if name == "weight_logs":
                return weight_table
            return MagicMock()

        mock_supa.table.side_effect = table_side
        monkeypatch.setattr(health_module, "supabase", mock_supa)

        client = TestClient(app)
        resp = client.post("/api/v1/weight", json={"weight": 78, "date": "2026-07-16", "idempotency_key": "w-123"})

        assert resp.status_code == 200
        inserted = weight_table.insert.call_args[0][0]
        assert inserted["idempotency_key"] == "w-123"
        assert inserted["date"] == "2026-07-16"


# ─── Today / dashboard ─────────────────────────────────────────────────────

class TestToday:
    def test_today_includes_habits_and_weight_trend(self, monkeypatch):
        from datetime import datetime as dt
        from zoneinfo import ZoneInfo
        import routers.schedule as schedule_module

        fixed_now = dt(2026, 7, 16, 10, 0, 0, tzinfo=ZoneInfo("America/Bogota"))
        monkeypatch.setattr(schedule_module, "_bogota_now", lambda: fixed_now)

        mock_supa = MagicMock()
        profile_row = {"user_id": MOCK_USER_ID, "name": "Test", "level": 1, "xp": 0, "xp_to_next_level": 100}
        weight_rows = [
            {"id": "w1", "weight": 78, "date": "2026-07-16"},
            {"id": "w2", "weight": 80, "date": "2026-07-15"},
        ]
        habit_rows = [{"id": "h1", "user_id": MOCK_USER_ID, "name": "Leer", "frequency": "daily"}]
        completions_rows = [{"habit_id": "h1", "date": "2026-07-16"}]

        def table_side(name):
            t = MagicMock()
            if name == "profiles":
                t.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[profile_row])
            elif name == "finances":
                t.select.return_value.eq.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(data=[])
            elif name == "shifts":
                t.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
            elif name == "goals":
                t.select.return_value.eq.return_value.neq.return_value.execute.return_value = MagicMock(data=[])
            elif name == "missions":
                t.select.return_value.eq.return_value.or_.return_value.execute.return_value = MagicMock(data=[])
            elif name == "weight_logs":
                t.select.return_value.eq.return_value.order.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
                    data=[weight_rows[0]]
                )
                t.select.return_value.eq.return_value.neq.return_value.order.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
                    data=[weight_rows[1]]
                )
            elif name == "habits":
                t.select.return_value.eq.return_value.execute.return_value = MagicMock(data=habit_rows)
            elif name == "habit_completions":
                t.select.return_value.in_.return_value.eq.return_value.execute.return_value = MagicMock(data=completions_rows)
            elif name == "focus_status":
                t.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(data=[])
            return t

        mock_supa.table.side_effect = table_side
        monkeypatch.setattr(sync_module, "supabase", mock_supa)

        client = TestClient(app)
        resp = client.get("/api/v1/today")

        assert resp.status_code == 200
        data = resp.json()
        assert data["today"]["weight_trend"] == -2
        habits = data["today"]["habits_today"]
        assert len(habits) == 1
        assert habits[0]["completed_today"] is True

    def test_today_keeps_no_external_calls(self, monkeypatch):
        # Simular que no hay supabase externo real: la respuesta debe construirse sin llamar a Gemini/TRM.
        mock_supa = MagicMock()
        mock_supa.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

        monkeypatch.setattr(sync_module, "supabase", mock_supa)
        monkeypatch.setattr(sync_module, "get_trm", lambda: 4000.0)

        client = TestClient(app)
        resp = client.get("/api/v1/today")

        assert resp.status_code == 200
        data = resp.json()
        assert "profile" in data
        assert "today" in data
        assert "finances" in data["today"]


# --- Perfil y onboarding ---------------------------------------------------

class TestProfileValidation:
    def test_profile_update_rejects_short_name(self, monkeypatch):
        import routers.profile as profile_module
        from routers.profile import ProfileUpdatePayload
        import pydantic

        with pytest.raises(pydantic.ValidationError):
            ProfileUpdatePayload(name="A")

    def test_profile_update_rejects_invalid_health_goal(self, monkeypatch):
        import routers.profile as profile_module
        from routers.profile import ProfileUpdatePayload
        import pydantic

        with pytest.raises(pydantic.ValidationError):
            ProfileUpdatePayload(health_goal="invalid_goal")

    def test_profile_update_accepts_valid_fields(self):
        from routers.profile import ProfileUpdatePayload
        p = ProfileUpdatePayload(name="Juan Perez", birth_date="1990-01-15", height_cm=175, health_goal="ganar_musculo")
        assert p.name == "Juan Perez"
        assert p.birth_date == "1990-01-15"
        assert p.height_cm == 175
        assert p.health_goal == "ganar_musculo"

    def test_onboarding_rejects_underage(self):
        from routers.profile import OnboardingPayload
        import pydantic

        with pytest.raises(pydantic.ValidationError):
            OnboardingPayload(name="Test", birth_date=(datetime.now() - timedelta(days=365 * 15)).strftime("%Y-%m-%d"), weight_kg=70, height_cm=170, health_goal="ganar_musculo")

    def test_profile_update_rejects_onboarding_completed_at(self):
        from routers.profile import ProfileUpdatePayload
        p = ProfileUpdatePayload(name="Test", onboarding_completed_at="2026-01-01")
        assert "onboarding_completed_at" not in p.model_dump(exclude_unset=True)

    def test_migration_033_has_profiles_table_guard(self):
        repo_root = Path(__file__).resolve().parents[2]
        migration_path = repo_root / "supabase" / "migrations" / "033_profile_onboarding.sql"
        assert migration_path.exists(), "No se encontro la migracion 033"
        sql = migration_path.read_text(encoding="utf-8")
        assert "information_schema.tables" in sql, "033 debe consultar si profiles existe"
        assert "025_profiles_bootstrap" in sql, "033 debe mencionar 025 como requisito"
        assert "RAISE NOTICE" in sql, "033 debe emitir NOTICE si profiles no existe"


class TestOnboardingIdempotent:
    def test_onboarding_does_not_duplicate_weight_on_retry(self, monkeypatch):
        import routers.profile as profile_module

        profile_row = {"user_id": MOCK_USER_ID, "name": "Test"}
        weight_row = {"id": "w1", "weight": 78, "idempotency_key": f"onboarding:{MOCK_USER_ID}"}

        mock_supa = MagicMock()
        profiles_table = MagicMock()
        profiles_table.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[profile_row])

        weight_table = MagicMock()
        insert_call_count = [0]

        def insert_side(*args, **kwargs):
            insert_call_count[0] += 1
            if insert_call_count[0] == 1:
                return MagicMock(data=[weight_row])
            exc = Exception("duplicate key value violates unique constraint")
            exc.code = "23505"
            raise exc

        weight_table.insert.return_value.execute.side_effect = insert_side
        weight_table.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[weight_row]
        )

        def table_side(name):
            if name == "profiles":
                return profiles_table
            if name == "weight_logs":
                return weight_table
            return MagicMock()

        mock_supa.table.side_effect = table_side
        monkeypatch.setattr(profile_module, "supabase", mock_supa)

        client = TestClient(app)
        payload = {"name": "Test", "birth_date": "1990-01-15", "weight_kg": 78, "height_cm": 175, "health_goal": "ganar_musculo"}

        resp1 = client.post("/api/v1/onboarding", json=payload)
        assert resp1.status_code == 200

        resp2 = client.post("/api/v1/onboarding", json=payload)
        assert resp2.status_code == 200

        assert insert_call_count[0] == 2
        assert weight_table.select.called


class TestHydration:
    def test_hydration_calculation_from_weight(self):
        from routers.sync import _calculate_hydration_ml
        assert _calculate_hydration_ml({"weight": 70}) == 2500
        assert _calculate_hydration_ml({"weight": 42}) == 1500
        assert _calculate_hydration_ml({"weight": 100}) == 3500
        assert _calculate_hydration_ml(None) is None
        assert _calculate_hydration_ml({}) is None

    def test_hydration_rounds_to_nearest_250(self):
        from routers.sync import _calculate_hydration_ml
        assert _calculate_hydration_ml({"weight": 75}) == 2750
        assert _calculate_hydration_ml({"weight": 68}) == 2500


class TestTodayPartialResponse:
    def test_today_returns_partial_when_some_queries_fail(self, monkeypatch):
        mock_supa = MagicMock()

        def table_side(name):
            t = MagicMock()
            if name == "profiles":
                t.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"user_id": MOCK_USER_ID, "name": "Test"}])
            elif name == "finances":
                raise RuntimeError("simulated db failure")
            elif name == "shifts":
                t.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
            elif name == "goals":
                t.select.return_value.eq.return_value.neq.return_value.execute.return_value = MagicMock(data=[])
            elif name == "missions":
                t.select.return_value.eq.return_value.or_.return_value.execute.return_value = MagicMock(data=[])
            elif name == "weight_logs":
                t.select.return_value.eq.return_value.order.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(data=[])
            elif name == "habits":
                t.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
            elif name == "focus_status":
                t.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(data=[])
            return t

        mock_supa.table.side_effect = table_side
        monkeypatch.setattr(sync_module, "supabase", mock_supa)

        client = TestClient(app)
        resp = client.get("/api/v1/today")

        assert resp.status_code == 200
        data = resp.json()
        assert "profile" in data
        assert "today" in data
        assert data["today"]["finances"] == []
