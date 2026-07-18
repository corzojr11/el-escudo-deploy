"""Tests para el endpoint consolidado de sincronizacion."""

import asyncio
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from auth import get_current_user
from main import app
from routers import sync as sync_module

MOCK_USER_ID = "11111111-1111-1111-1111-111111111111"


async def _mock_get_current_user():
    return type("User", (), {"id": MOCK_USER_ID, "aud": "authenticated"})()


app.dependency_overrides[get_current_user] = _mock_get_current_user


class MockResult:
    def __init__(self, data):
        self.data = data


@pytest.fixture(autouse=True)
def _reset_sync_state(monkeypatch):
    monkeypatch.setattr(sync_module, "is_deepseek_configured", lambda: False)
    monkeypatch.setattr(sync_module, "get_trm", lambda: asyncio.sleep(0, result=4200.0))
    sync_module._quote_cache.clear()
    yield
    sync_module._quote_cache.clear()


def _chain_with_result(data):
    chain = MagicMock()
    chain.execute.return_value = MockResult(data)
    return chain


def _build_sync_supabase():
    mock_supa = MagicMock()

    profiles = MagicMock()
    profiles.select.return_value.eq.return_value.execute.return_value = MockResult(
        [{"name": "Dairo", "level": 3, "xp": 250}]
    )

    finances = MagicMock()
    finances.select.return_value.eq.return_value.limit.return_value.execute.return_value = MockResult(
        [{"id": "fin-1", "amount": 20000, "description": "Comida", "category": "food"}]
    )

    missions = MagicMock()
    missions.select.return_value.eq.return_value.limit.return_value.execute.return_value = MockResult(
        [
            {
                "id": "mis-1",
                "name": "Entrenar",
                "description": "Pierna",
                "status": "active",
                "priority": "high",
                "scheduled_at": "2026-05-30T18:00:00Z",
            }
        ]
    )

    shifts = MagicMock()
    shifts.select.return_value.eq.return_value.execute.return_value = MockResult(
        [{"id": "shift-1", "day": "monday", "start": "08:00", "end": "17:00"}]
    )

    weight_logs = MagicMock()
    weight_logs.select.return_value.eq.return_value.limit.return_value.execute.return_value = MockResult(
        [{"id": "w-1", "weight": 78.4, "timestamp": "2026-05-30T08:00:00Z"}]
    )

    exercise_logs = MagicMock()
    exercise_logs.select.return_value.eq.return_value.limit.return_value.execute.return_value = MockResult(
        [{"id": "ex-1", "exercise_name": "Sentadilla", "weight": 80, "reps": 8, "sets": 4, "rpe": 8, "date": "2026-05-30"}]
    )

    personal_records = MagicMock()
    personal_records.select.return_value.eq.return_value.limit.return_value.execute.return_value = MockResult(
        [{"id": "pr-1", "exercise_name": "Sentadilla", "max_weight": 100, "date": "2026-05-30"}]
    )

    sleep_logs = MagicMock()
    sleep_logs.select.return_value.eq.return_value.limit.return_value.execute.return_value = MockResult(
        [{"id": "sl-1", "date": "2026-05-30", "bed_time": "22:30", "wake_time": "06:00", "cycles": 5, "quality_score": 4}]
    )

    debts = MagicMock()
    debts.select.return_value.eq.return_value.execute.return_value = MockResult([])

    fixed_expenses = MagicMock()
    fixed_expenses.select.return_value.eq.return_value.execute.return_value = MockResult(
        [{"id": "fx-1", "name": "Internet", "amount": 120000, "paid": False}]
    )

    focus_status = MagicMock()
    focus_status.select.return_value.eq.return_value.limit.return_value.execute.return_value = MockResult(
        [{"focus_streak": 6, "focus_best": 10, "urge_count": 1, "last_check_date": "2026-05-30"}]
    )

    goals = MagicMock()
    goals.select.return_value.eq.return_value.neq.return_value.execute.return_value = MockResult(
        [{"id": "goal-1", "name": "Bajar de peso", "status": "active"}]
    )

    metrics = MagicMock()
    metrics.select.return_value.in_.return_value.order.return_value.execute.return_value = MockResult(
        [{"goal_id": "goal-1", "value": 78.4, "recorded_at": "2026-05-30T08:00:00Z"}]
    )

    bio = MagicMock()
    bio.select.return_value.eq.return_value.limit.return_value.execute.return_value = MockResult(
        [{"t_wake_target": "06:00"}]
    )

    def table_side(name):
        return {
            "profiles": profiles,
            "finances": finances,
            "missions": missions,
            "shifts": shifts,
            "weight_logs": weight_logs,
            "exercises_logs": exercise_logs,
            "personal_records": personal_records,
            "sleep_logs": sleep_logs,
            "debts": debts,
            "fixed_expenses": fixed_expenses,
            "focus_status": focus_status,
            "goals": goals,
            "metrics": metrics,
            "user_bio_settings": bio,
        }.get(name, MagicMock())

    mock_supa.table.side_effect = table_side
    return mock_supa


def test_sync_returns_consolidated_payload(monkeypatch):
    mock_supa = _build_sync_supabase()
    monkeypatch.setattr(sync_module, "supabase", mock_supa)
    monkeypatch.setattr(sync_module, "track_event", lambda **kwargs: asyncio.sleep(0))

    client = TestClient(app)
    response = client.get("/api/v1/sync")

    assert response.status_code == 200
    data = response.json()
    assert data["profile"]["name"] == "Dairo"
    assert data["missions"][0]["priority"] == "high"
    assert data["missions"][0]["scheduled_at"] == "2026-05-30T18:00:00Z"
    assert data["focus_status"]["focus_streak"] == 6
    assert data["bio_settings"]["t_wake_target"] == "06:00"
