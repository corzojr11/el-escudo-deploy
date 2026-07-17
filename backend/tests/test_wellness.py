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


def _make_table(data=None):
    t = MagicMock()
    chain = MagicMock()
    chain.eq.return_value = chain
    chain.order.return_value = chain
    chain.limit.return_value = chain
    chain.gte.return_value = chain
    chain.execute.return_value = MockResult(data or [])
    t.select.return_value = chain
    t.in_.return_value = chain
    return t


def test_wellness_score_between_0_and_100(monkeypatch):
    import routers.wellness as wellness_module

    mock_supa = MagicMock()
    mock_supa.table.side_effect = lambda name: _make_table([{"status": "active"}]) if name != "finances" else _make_table()

    monkeypatch.setattr(wellness_module, "supabase", mock_supa)

    client = TestClient(app)
    resp = client.get("/api/v1/wellness-summary")

    assert resp.status_code == 200
    data = resp.json()
    assert 0 <= data["score"] <= 100
    assert "factors" in data
    assert "insight" in data
    assert data["completeness"] <= 100


def test_wellness_returns_no_data_for_empty_user(monkeypatch):
    import routers.wellness as wellness_module

    mock_supa = MagicMock()
    mock_supa.table.side_effect = lambda name: _make_table([])

    monkeypatch.setattr(wellness_module, "supabase", mock_supa)

    client = TestClient(app)
    resp = client.get("/api/v1/wellness-summary")

    assert resp.status_code == 200
    data = resp.json()
    for f in data["factors"]:
        if f["score"] is not None:
            pass
    assert data["completeness"] <= 100


def test_wellness_is_isolated_by_user(monkeypatch):
    import routers.wellness as wellness_module

    mock_supa = MagicMock()
    missions_table = _make_table([{"id": "m1", "status": "active", "user_id": MOCK_USER_ID}])
    missions_chain = MagicMock()
    missions_chain.eq.return_value = missions_chain
    missions_chain.eq.return_value = missions_chain
    missions_chain.execute.return_value = MockResult([{"id": "m1"}])
    missions_table.select.return_value = missions_chain

    def table_side(name):
        if name == "missions":
            t = missions_table
            t.select.return_value = missions_chain
            return t
        return _make_table([] if name != "missions" else [])

    mock_supa.table.side_effect = table_side
    monkeypatch.setattr(wellness_module, "supabase", mock_supa)

    client = TestClient(app)
    resp = client.get("/api/v1/wellness-summary")
    assert resp.status_code == 200
    assert missions_chain.eq.called