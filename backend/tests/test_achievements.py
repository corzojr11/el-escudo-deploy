"""Tests para logros y gamificacion."""

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


def test_list_achievements_returns_user_only(monkeypatch):
    import routers.goals as goals_module

    mock_supa = MagicMock()
    ach_table = MagicMock()
    chain = MagicMock()
    chain.eq.return_value = chain
    chain.order.return_value = chain
    chain.execute.return_value = MockResult([
        {"id": "a1", "user_id": MOCK_USER_ID, "name": "Primeros Pasos", "unlocked_at": "2026-01-01"},
    ])
    ach_table.select.return_value = chain

    def table_side(name):
        if name == "achievements":
            return ach_table
        return MagicMock()

    mock_supa.table.side_effect = table_side
    monkeypatch.setattr(goals_module, "supabase", mock_supa)

    client = TestClient(app)
    resp = client.get("/api/v1/achievements")

    assert resp.status_code == 200
    data = resp.json()
    assert len(data["achievements"]) >= 1
    assert data["achievements"][0]["name"] == "Primeros Pasos"
    assert chain.eq.called


def _make_chain(return_value=None):
    chain = MagicMock()
    chain.eq.return_value = chain
    chain.limit.return_value = chain
    chain.order.return_value = chain
    chain.execute.return_value = return_value
    return chain


def test_mission_complete_returns_new_achievement_once(monkeypatch):
    import routers.missions as missions_module

    mock_supa = MagicMock()

    missions_table = MagicMock()
    check_chain = _make_chain(MockResult([{"id": "m1"}]))
    update_chain = _make_chain(MockResult([
        {"id": "m1", "user_id": MOCK_USER_ID, "name": "Test", "status": "completed"}
    ]))

    count_result = MagicMock()
    count_result.count = 1
    count_chain = _make_chain(count_result)

    def select_side(*args, **kwargs):
        s = str(args[0]) if args else ""
        if s == "id" and not kwargs.get("count"):
            return check_chain
        return count_chain

    missions_table.select.side_effect = select_side
    missions_table.update.return_value = update_chain

    ach_table = MagicMock()
    ach_check = _make_chain(MockResult([]))
    ach_insert = MagicMock()
    ach_insert.execute.return_value = MockResult([{"id": "a1"}])
    ach_table.select.return_value = ach_check
    ach_table.insert.return_value = ach_insert

    def table_side(name):
        if name == "missions":
            return missions_table
        if name == "achievements":
            return ach_table
        return MagicMock()

    mock_supa.table.side_effect = table_side
    monkeypatch.setattr(missions_module, "supabase", mock_supa)

    client = TestClient(app)
    resp = client.put("/api/v1/missions/m1", json={"status": "completed"})

    assert resp.status_code == 200
    data = resp.json()
    assert data.get("new_achievement") == "Primeros Pasos"


def test_mission_complete_no_duplicate_achievement(monkeypatch):
    import routers.missions as missions_module

    mock_supa = MagicMock()

    missions_table = MagicMock()
    check_chain = _make_chain(MockResult([{"id": "m1"}]))
    update_chain = _make_chain(MockResult([
        {"id": "m1", "user_id": MOCK_USER_ID, "name": "Test", "status": "completed"}
    ]))

    count_result = MagicMock()
    count_result.count = 1
    count_chain = _make_chain(count_result)

    def select_side(*args, **kwargs):
        s = str(args[0]) if args else ""
        if s == "id" and not kwargs.get("count"):
            return check_chain
        return count_chain

    missions_table.select.side_effect = select_side
    missions_table.update.return_value = update_chain

    ach_table = MagicMock()
    ach_check = _make_chain(MockResult([
        {"id": "a1", "user_id": MOCK_USER_ID, "name": "Primeros Pasos"}
    ]))
    ach_table.select.return_value = ach_check

    def table_side(name):
        if name == "missions":
            return missions_table
        if name == "achievements":
            return ach_table
        return MagicMock()

    mock_supa.table.side_effect = table_side
    monkeypatch.setattr(missions_module, "supabase", mock_supa)

    client = TestClient(app)
    resp = client.put("/api/v1/missions/m1", json={"status": "completed"})

    assert resp.status_code == 200
    assert not resp.json().get("new_achievement"), "No debe anunciar logro que ya existe"