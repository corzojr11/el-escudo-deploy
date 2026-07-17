"""Tests para wellness score e insight semanal."""

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


def _make_chain(data=None):
    c = MagicMock()
    c.eq.return_value = c
    c.gte.return_value = c
    c.lt.return_value = c
    c.order.return_value = c
    c.limit.return_value = c
    c.in_.return_value = c
    c.execute.return_value = MockResult(data or [])
    return c


def test_wellness_score_between_0_and_100(monkeypatch):
    import routers.wellness as wellness_module

    mock_supa = MagicMock()
    mock_supa.table.side_effect = lambda name: MagicMock(select=MagicMock(return_value=_make_chain([{"status": "active"}])))

    monkeypatch.setattr(wellness_module, "supabase", mock_supa)

    client = TestClient(app)
    resp = client.get("/api/v1/wellness-summary")
    assert resp.status_code == 200
    data = resp.json()
    assert 0 <= data["score"] <= 100


def test_wellness_score_100_when_all_max(monkeypatch):
    import routers.wellness as wellness_module

    mock_supa = MagicMock()

    missions_table = MagicMock()
    missions_table.select.return_value = _make_chain([{"status": "completed"}] * 5)

    habits_table = MagicMock()
    habits_chain = _make_chain([{"id": "h1"}, {"id": "h2"}])
    habits_table.select.return_value = habits_chain
    completions_table = MagicMock()
    completions_table.select.return_value = _make_chain([{"habit_id": "h1"}, {"habit_id": "h2"}])

    focus_table = MagicMock()
    focus_table.select.return_value = _make_chain([{"focus_streak": 7}])

    weight_table = MagicMock()
    weight_table.select.return_value = _make_chain([{"weight": 75, "date": "2026-07-17"}])

    sleep_table = MagicMock()
    sleep_table.select.return_value = _make_chain([{"cycles": 6, "quality_score": 5}])

    finances_table = MagicMock()
    finances_table.select.return_value = _make_chain([{"amount": 100000, "type": "INGRESO"}])

    def table_side(name):
        return {
            "missions": missions_table,
            "habits": habits_table,
            "habit_completions": completions_table,
            "focus_status": focus_table,
            "weight_logs": weight_table,
            "sleep_logs": sleep_table,
            "finances": finances_table,
        }.get(name, MagicMock(select=MagicMock(return_value=_make_chain([]))))

    mock_supa.table.side_effect = table_side
    monkeypatch.setattr(wellness_module, "supabase", mock_supa)

    client = TestClient(app)
    resp = client.get("/api/v1/wellness-summary")
    assert resp.status_code == 200
    data = resp.json()
    assert data["score"] == 100


def test_focus_none_does_not_count_completeness(monkeypatch):
    import routers.wellness as wellness_module

    mock_supa = MagicMock()
    focus_table = MagicMock()
    focus_table.select.return_value = _make_chain([])
    habits_table = MagicMock()
    habits_table.select.return_value = _make_chain([{"id": "h1"}])
    completions_table = MagicMock()
    completions_table.select.return_value = _make_chain([{"habit_id": "h1"}])

    def table_side(name):
        return {
            "missions": MagicMock(select=MagicMock(return_value=_make_chain([]))),
            "habits": habits_table,
            "habit_completions": completions_table,
            "focus_status": focus_table,
            "weight_logs": MagicMock(select=MagicMock(return_value=_make_chain([]))),
            "sleep_logs": MagicMock(select=MagicMock(return_value=_make_chain([]))),
            "finances": MagicMock(select=MagicMock(return_value=_make_chain([]))),
        }.get(name, MagicMock(select=MagicMock(return_value=_make_chain([]))))

    mock_supa.table.side_effect = table_side
    monkeypatch.setattr(wellness_module, "supabase", mock_supa)

    client = TestClient(app)
    resp = client.get("/api/v1/wellness-summary")
    assert resp.status_code == 200
    data = resp.json()
    focus_factor = next(f for f in data["factors"] if f["name"] == "enfoque")
    assert focus_factor["score"] is None
    assert data["completeness"] < 50


def test_sleep_normal_allows_weight_insight(monkeypatch):
    import routers.wellness as wellness_module

    mock_supa = MagicMock()

    def table_side(name):
        return {
            "missions": MagicMock(select=MagicMock(return_value=_make_chain([{"status": "completed"}]))),
            "habits": MagicMock(select=MagicMock(return_value=_make_chain([{"id": "h1"}, {"id": "h2"}]))),
            "habit_completions": MagicMock(select=MagicMock(return_value=_make_chain([{"habit_id": "h1"}, {"habit_id": "h2"}]))),
            "focus_status": MagicMock(select=MagicMock(return_value=_make_chain([{"focus_streak": 5}]))),
            "weight_logs": MagicMock(select=MagicMock(return_value=_make_chain([
                {"weight": 80, "date": "2026-07-17"},
                {"weight": 79, "date": "2026-07-15"},
                {"weight": 78, "date": "2026-07-10"},
                {"weight": 77, "date": "2026-07-08"},
            ]))),
            "sleep_logs": MagicMock(select=MagicMock(return_value=_make_chain([{"cycles": 5, "quality_score": 4}]))),
            "finances": MagicMock(select=MagicMock(return_value=_make_chain([]))),
        }.get(name, MagicMock(select=MagicMock(return_value=_make_chain([]))))

    mock_supa.table.side_effect = table_side
    monkeypatch.setattr(wellness_module, "supabase", mock_supa)

    client = TestClient(app)
    resp = client.get("/api/v1/wellness-summary")
    assert resp.status_code == 200
    data = resp.json()
    assert "kg" in data["insight"].lower()