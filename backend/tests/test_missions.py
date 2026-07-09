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
