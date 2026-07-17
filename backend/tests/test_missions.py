"""Tests para CRUD de misiones con campos directos de prioridad y programacion."""

import os
from unittest.mock import MagicMock

from fastapi.testclient import TestClient

os.environ.setdefault("GEMINI_API_KEY", "test-key")

from auth import get_current_user
from main import app
from routers import missions as missions_module

MOCK_USER_ID = "11111111-1111-1111-1111-111111111111"


async def _mock_get_current_user():
    return type("User", (), {"id": MOCK_USER_ID, "aud": "authenticated"})()


app.dependency_overrides[get_current_user] = _mock_get_current_user


class MockResult:
    def __init__(self, data):
        self.data = data


def _build_missions_supabase():
    mock_supa = MagicMock()

    missions_table = MagicMock()
    insert_chain = MagicMock()
    insert_chain.execute.return_value = MockResult(
        [
            {
                "id": "mission-1",
                "user_id": MOCK_USER_ID,
                "name": "Entrenar",
                "description": "Pierna",
                "status": "active",
                "xp_reward": 50,
                "category": "FITNESS",
                "priority": "high",
                "scheduled_at": "2026-05-30T18:00:00Z",
            }
        ]
    )
    missions_table.insert.return_value = insert_chain

    select_chain = MagicMock()
    select_chain.eq.return_value.eq.return_value.limit.return_value.execute.return_value = MockResult([{"id": "mission-1"}])

    update_chain = MagicMock()
    update_chain.eq.return_value.eq.return_value.execute.return_value = MockResult(
        [
            {
                "id": "mission-1",
                "name": "Entrenar",
                "priority": "medium",
                "scheduled_at": "2026-05-31T07:00:00Z",
            }
        ]
    )

    def select_side(cols):
        if cols == "id":
            return select_chain
        return MagicMock()

    missions_table.select.side_effect = select_side
    missions_table.update.return_value = update_chain

    def table_side(name):
        if name == "missions":
            return missions_table
        return MagicMock()

    mock_supa.table.side_effect = table_side
    return mock_supa


def test_create_mission_persists_priority_and_schedule(monkeypatch):
    mock_supa = _build_missions_supabase()
    monkeypatch.setattr(missions_module, "supabase", mock_supa)

    client = TestClient(app)
    response = client.post(
        "/api/v1/missions",
        json={
            "name": "Entrenar",
            "description": "Pierna",
            "category": "FITNESS",
            "xp_reward": 50,
            "priority": "high",
            "scheduled_at": "2026-05-30T18:00:00Z",
        },
    )

    assert response.status_code == 200
    mission = response.json()["mission"]
    assert mission["priority"] == "high"
    assert mission["scheduled_at"] == "2026-05-30T18:00:00Z"


def test_update_mission_updates_priority_and_schedule(monkeypatch):
    mock_supa = _build_missions_supabase()
    monkeypatch.setattr(missions_module, "supabase", mock_supa)

    client = TestClient(app)
    response = client.put(
        "/api/v1/missions/mission-1",
        json={
            "priority": "medium",
            "scheduled_at": "2026-05-31T07:00:00Z",
        },
    )

    assert response.status_code == 200
    mission = response.json()["mission"]
    assert mission["priority"] == "medium"
    assert mission["scheduled_at"] == "2026-05-31T07:00:00Z"


def test_list_missions_returns_array(monkeypatch):
    mock_supa = MagicMock()
    missions_table = MagicMock()
    chain = MagicMock()
    chain.eq.return_value = chain
    chain.order.return_value = chain
    chain.execute.return_value = MockResult([
        {"id": "m1", "user_id": MOCK_USER_ID, "name": "Test", "status": "active", "priority": "medium"},
        {"id": "m2", "user_id": MOCK_USER_ID, "name": "Test 2", "status": "completed", "priority": "high"},
    ])
    missions_table.select.return_value = chain

    def table_side(name):
        if name == "missions":
            return missions_table
        return MagicMock()

    mock_supa.table.side_effect = table_side
    monkeypatch.setattr(missions_module, "supabase", mock_supa)

    client = TestClient(app)
    resp = client.get("/api/v1/missions")
    assert resp.status_code == 200
    assert len(resp.json()["missions"]) == 2


def test_toggle_mission_complete_to_active(monkeypatch):
    mock_supa = MagicMock()
    missions_table = MagicMock()

    check_chain = MagicMock()
    check_chain.eq.return_value.eq.return_value.limit.return_value.execute.return_value = MockResult([{"id": "m1"}])

    update_chain = MagicMock()
    update_chain.eq.return_value.eq.return_value.execute.return_value = MockResult([
        {"id": "m1", "user_id": MOCK_USER_ID, "name": "Test", "status": "active", "priority": "medium"}
    ])

    count_chain = MagicMock()
    count_chain.eq.return_value.eq.return_value.execute.return_value = MagicMock(count=0)
    missions_table.select.return_value = count_chain
    missions_table.update.return_value = update_chain

    def select_side(cols):
        if "id" in str(cols):
            return check_chain
        return count_chain

    missions_table.select.side_effect = select_side

    def table_side(name):
        if name == "missions":
            return missions_table
        if name == "achievements":
            return MagicMock()
        return MagicMock()

    mock_supa.table.side_effect = table_side
    monkeypatch.setattr(missions_module, "supabase", mock_supa)

    client = TestClient(app)
    resp = client.put("/api/v1/missions/m1", json={"status": "active"})
    assert resp.status_code == 200
    assert resp.json()["mission"]["status"] == "active"


def test_delete_mission_blocks_other_user(monkeypatch):
    mock_supa = MagicMock()
    missions_table = MagicMock()
    select_chain = MagicMock()
    select_chain.eq.return_value.eq.return_value.limit.return_value.execute.return_value = MockResult([])

    def table_side(name):
        if name == "missions":
            missions_table.select.return_value = select_chain
            return missions_table
        return MagicMock()

    mock_supa.table.side_effect = table_side
    monkeypatch.setattr(missions_module, "supabase", mock_supa)

    client = TestClient(app)
    resp = client.delete("/api/v1/missions/another-user-mission")
    assert resp.status_code == 404


def test_create_mission_rejects_invalid_status(monkeypatch):
    client = TestClient(app)
    resp = client.post("/api/v1/missions", json={
        "name": "Test", "status": "invalid_status", "priority": "medium",
    })
    assert resp.status_code == 422


def test_create_mission_rejects_invalid_priority(monkeypatch):
    client = TestClient(app)
    resp = client.post("/api/v1/missions", json={
        "name": "Test", "status": "active", "priority": "urgent",
    })
    assert resp.status_code == 422


def test_dashboard_missions_use_scheduled_at_not_schedule_date(monkeypatch):
    mock_supa = MagicMock()
    missions_table = MagicMock()
    chain = MagicMock()
    chain.eq.return_value = chain
    chain.gte.return_value = chain
    chain.lte.return_value = chain
    chain.order.return_value = chain
    chain.execute.return_value = MockResult([])
    missions_table.select.return_value = chain

    def table_side(name):
        if name == "missions":
            return missions_table
        return MagicMock()

    mock_supa.table.side_effect = table_side
    import routers.sync as sync_module
    monkeypatch.setattr(sync_module, "supabase", mock_supa)

    client = TestClient(app)
    resp = client.get("/api/v1/today")
    assert resp.status_code == 200
    assert missions_table.select.called
    assert chain.gte.called


def test_mission_without_date_not_in_today(monkeypatch):
    import routers.sync as sync_module

    mock_supa = MagicMock()
    missions_table = MagicMock()
    chain = MagicMock()
    chain.eq.return_value = chain
    chain.gte.return_value = chain
    chain.lte.return_value = chain
    chain.order.return_value = chain
    chain.execute.return_value = MockResult([
        {"id": "m1", "name": "Con fecha", "scheduled_at": "2026-07-17T08:00:00Z", "status": "active"},
    ])
    missions_table.select.return_value = chain

    def table_side(name):
        if name == "missions":
            return missions_table
        if name == "profiles":
            t = MagicMock()
            t.select.return_value.eq.return_value.execute.return_value = MockResult([{"name": "T", "onboarding_completed_at": "2026-01-01"}])
            return t
        if name in ("finances", "shifts", "goals", "weight_logs", "habits", "habit_completions", "focus_status"):
            t = MagicMock()
            t.select.return_value = MagicMock()
            t.select.return_value.eq.return_value = MagicMock()
            t.select.return_value.eq.return_value.execute.return_value = MockResult([])
            t.select.return_value.eq.return_value.neq.return_value = MagicMock()
            t.select.return_value.eq.return_value.neq.return_value.execute.return_value = MockResult([])
            return t
        return MagicMock()

    mock_supa.table.side_effect = table_side
    monkeypatch.setattr(sync_module, "supabase", mock_supa)

    client = TestClient(app)
    resp = client.get("/api/v1/today")
    assert resp.status_code == 200
    assert chain.gte.called, "Debe usar gte(scheduled_at, start_of_day)"
    assert chain.lte.called, "Debe usar lte(scheduled_at, end_of_day)"
    assert chain.eq.called, "Debe filtrar por user_id"


def test_no_nullslast_in_routers():
    from pathlib import Path
    import os as _os
    routers_dir = Path(__file__).resolve().parents[1] / "routers"
    for f in routers_dir.glob("*.py"):
        content = f.read_text(encoding="utf-8")
        assert "nulls_last" not in content, (
            f"{f.name} usa nulls_last, que no es compatible con todas las versiones del cliente Supabase. "
            "Usa nullsfirst=False en su lugar."
        )


def test_migration_037_covers_core_tables():
    from pathlib import Path
    repo_root = Path(__file__).resolve().parents[2]
    migration_path = repo_root / "supabase" / "migrations" / "037_reconcile_core_modules.sql"
    assert migration_path.exists(), "No se encontro la migracion 037"
    sql = migration_path.read_text(encoding="utf-8")

    required_tables = [
        "shifts", "user_bio_settings", "sleep_logs", "weight_logs",
        "focus_status", "exercises_logs", "personal_records",
        "achievements", "routines", "routine_completions",
    ]

    for table in required_tables:
        assert f"CREATE TABLE IF NOT EXISTS public.{table}" in sql, (
            f"037 debe contener CREATE TABLE IF NOT EXISTS para {table}"
        )

    assert "_037_col_exists" in sql, "037 debe usar _037_col_exists"
    assert "information_schema.columns" in sql, "037 debe usar information_schema.columns"
    assert "ALTER COLUMN" not in sql, "037 no debe contener ALTER COLUMN ... TYPE"
    assert "DROP TABLE" not in sql, "037 no debe contener DROP TABLE"
    assert "DROP COLUMN" not in sql, "037 no debe contener DROP COLUMN"
    assert "DELETE FROM" not in sql, "037 no debe contener DELETE FROM"
    assert "TRUNCATE" not in sql, "037 no debe contener TRUNCATE"
    assert "pg_policies" in sql, "037 debe verificar politicas con pg_policies"
    assert "schemaname" in sql, "037 debe calificar schemaname en pg_policies"

    # Constraints con guard de duplicados
    assert "RAISE NOTICE" in sql, "037 debe contener RAISE NOTICE"
    assert "HAVING" in sql and "count(*)" in sql, "037 debe comprobar duplicados"

    # Verificar que shifts tiene guards para columnas del GROUP BY
    assert "_037_col_exists('shifts','user_id')" in sql
    assert "_037_col_exists('shifts','day')" in sql
    assert "_037_col_exists('shifts','start')" in sql
    assert "_037_col_exists('shifts','end')" in sql
    assert "shifts_user_day_start_end_unique" in sql

    # Verificar que routines tiene guards para columnas del GROUP BY
    assert "_037_col_exists('routines','user_id')" in sql
    assert "_037_col_exists('routines','day_index')" in sql
    assert "routines_user_day_unique" in sql

    # Verificar que routine_completions tiene guards para columnas del GROUP BY
    assert "_037_col_exists('routine_completions','user_id')" in sql
    assert "_037_col_exists('routine_completions','day_index')" in sql
    assert "_037_col_exists('routine_completions','completed_date')" in sql

    assert sql.count("ADD COLUMN") >= 60, f"037 debe contener muchos ADD COLUMN guards (encontrados {sql.count('ADD COLUMN')})"


def test_multi_fetch_pages_use_allsettled():
    from pathlib import Path
    pages_dir = Path(__file__).resolve().parents[2] / "escudo-web-v2" / "src" / "app" / "(dashboard)"

    multi_fetch_globs = [
        "salud/page.tsx",
        "turnos/page.tsx",
        "finanzas/page.tsx",
        "page.tsx",
    ]

    for pattern in multi_fetch_globs:
        for f in pages_dir.glob(pattern):
            content = f.read_text(encoding="utf-8")
            has_multiple_awaits = content.count("await") > 1 or content.count("getWeightLogs") > 0 or content.count("getShifts") > 0 or content.count("getFinances") > 0
            if has_multiple_awaits:
                assert "allSettled" in content, (
                    f"{f.name} tiene multiples fetches pero no usa Promise.allSettled. "
                    "Un fallo en un dato secundario no debe tumbar la pagina completa."
                )


def test_multi_fetch_failures_are_visible_not_fake_data():
    from pathlib import Path

    root = Path(__file__).resolve().parents[2] / "escudo-web-v2" / "src" / "app" / "(dashboard)"
    dashboard = (root / "dashboard-client.tsx").read_text(encoding="utf-8")
    finances = (root / "finanzas" / "finanzas-client.tsx").read_text(encoding="utf-8")
    shifts = (root / "turnos" / "turnos-client.tsx").read_text(encoding="utf-8")

    assert "No se pudo cargar Wellness" in dashboard
    assert "No se pudo cargar el plan del dia" in dashboard
    assert "criticalError" in finances and "No se pudieron cargar tus movimientos" in finances
    assert "criticalError" in shifts and "No se pudieron cargar tus turnos" in shifts
