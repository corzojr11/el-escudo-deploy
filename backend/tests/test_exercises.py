"""Tests para log de ejercicios, historial y records personales."""

from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from auth import get_current_user
from main import app

MOCK_USER_ID = "11111111-1111-1111-1111-111111111111"


async def _mock_get_current_user():
    return type("User", (), {"id": MOCK_USER_ID, "aud": "authenticated"})()


app.dependency_overrides[get_current_user] = _mock_get_current_user


class MockResult:
    def __init__(self, data):
        self.data = data


def test_log_exercise_persists_all_fields(monkeypatch):
    import routers.health as health_module

    mock_supa = MagicMock()
    ex_table = MagicMock()
    ex_table.insert.return_value.execute.return_value = MockResult([
        {"id": "e1", "user_id": MOCK_USER_ID, "exercise_name": "Press banca", "weight": 80, "reps": 8, "sets": 3, "rpe": 7}
    ])
    pr_table = MagicMock()
    pr_table.select.return_value.eq.return_value.eq.return_value.execute.return_value = MockResult([])
    pr_table.insert.return_value.execute.return_value = MockResult([{"id": "pr1"}])

    def table_side(name):
        if name == "exercises_logs":
            return ex_table
        if name == "personal_records":
            return pr_table
        return MagicMock()

    mock_supa.table.side_effect = table_side
    monkeypatch.setattr(health_module, "supabase", mock_supa)

    client = TestClient(app)
    resp = client.post("/api/v1/log-exercise", json={
        "exercise_name": "Press banca", "weight": 80, "reps": 8, "sets": 3, "rpe": 7,
    })

    assert resp.status_code == 200
    inserted = ex_table.insert.call_args[0][0]
    assert inserted["exercise_name"] == "Press banca"
    assert inserted["user_id"] == MOCK_USER_ID
    assert inserted["weight"] == 80


def test_log_exercise_rejects_empty_name(monkeypatch):
    client = TestClient(app)
    resp = client.post("/api/v1/log-exercise", json={
        "exercise_name": "", "weight": 80, "reps": 8, "sets": 3, "rpe": 7,
    })
    assert resp.status_code == 422


def test_list_exercise_logs_returns_user_only(monkeypatch):
    import routers.health as health_module

    mock_supa = MagicMock()
    ex_table = MagicMock()
    chain = MagicMock()
    chain.eq.return_value = chain
    chain.order.return_value = chain
    chain.order.return_value = chain
    chain.limit.return_value = chain
    chain.execute.return_value = MockResult([
        {"id": "e1", "user_id": MOCK_USER_ID, "exercise_name": "Sentadilla", "weight": 100, "reps": 5, "sets": 5},
    ])
    ex_table.select.return_value = chain

    def table_side(name):
        if name == "exercises_logs":
            return ex_table
        return MagicMock()

    mock_supa.table.side_effect = table_side
    monkeypatch.setattr(health_module, "supabase", mock_supa)

    client = TestClient(app)
    resp = client.get("/api/v1/exercise-logs")
    assert resp.status_code == 200
    assert len(resp.json()["logs"]) >= 1
    assert chain.eq.called


def test_list_personal_records_returns_user_only(monkeypatch):
    import routers.health as health_module

    mock_supa = MagicMock()
    pr_table = MagicMock()
    chain = MagicMock()
    chain.eq.return_value = chain
    chain.order.return_value = chain
    chain.limit.return_value = chain
    chain.execute.return_value = MockResult([
        {"id": "pr1", "user_id": MOCK_USER_ID, "exercise_name": "Press banca", "max_weight": 90},
    ])
    pr_table.select.return_value = chain

    def table_side(name):
        if name == "personal_records":
            return pr_table
        return MagicMock()

    mock_supa.table.side_effect = table_side
    monkeypatch.setattr(health_module, "supabase", mock_supa)

    client = TestClient(app)
    resp = client.get("/api/v1/personal-records")
    assert resp.status_code == 200
    assert len(resp.json()["records"]) >= 1
    assert chain.eq.called


def test_record_only_improves_not_worsens(monkeypatch):
    import routers.health as health_module

    existing_pr = {"id": "pr1", "user_id": MOCK_USER_ID, "exercise_name": "Press banca", "max_weight": 100}
    pr_update_called = []

    mock_supa = MagicMock()
    ex_table = MagicMock()
    ex_table.insert.return_value.execute.return_value = MockResult([
        {"id": "e1", "exercise_name": "Press banca", "weight": 80}
    ])
    pr_table = MagicMock()
    pr_table.select.return_value.eq.return_value.eq.return_value.execute.return_value = MockResult([existing_pr])

    def pr_update_side(*args, **kwargs):
        pr_update_called.append(True)
        chain = MagicMock()
        chain.eq.return_value.eq.return_value.execute.return_value = MockResult([existing_pr])
        return chain

    pr_table.update.return_value = pr_table
    pr_table.update.return_value.eq.return_value.eq.return_value.execute.return_value = MockResult([existing_pr])

    def table_side(name):
        if name == "exercises_logs":
            return ex_table
        if name == "personal_records":
            return pr_table
        return MagicMock()

    mock_supa.table.side_effect = table_side
    monkeypatch.setattr(health_module, "supabase", mock_supa)

    client = TestClient(app)
    resp = client.post("/api/v1/log-exercise", json={
        "exercise_name": "Press banca", "weight": 80, "reps": 10, "sets": 3, "rpe": 8,
    })

    assert resp.status_code == 200
    assert not pr_table.update.called, "No debe actualizar record si el peso es menor al maximo"