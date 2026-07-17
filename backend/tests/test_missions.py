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
