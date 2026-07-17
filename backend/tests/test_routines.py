"""Tests para rutinas semanales de gimnasio."""

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


def test_list_routines_returns_user_routines(monkeypatch):
    import routers.routines as routines_module

    mock_supa = MagicMock()
    routines_table = MagicMock()
    chain = MagicMock()
    chain.eq.return_value = chain
    chain.order.return_value = chain
    chain.execute.return_value = MockResult([
        {"id": "r1", "user_id": MOCK_USER_ID, "day_index": 1, "day_name": "Lunes", "exercises": [{"name": "Press banca"}]},
        {"id": "r2", "user_id": MOCK_USER_ID, "day_index": 2, "day_name": "Martes", "exercises": []},
    ])
    routines_table.select.return_value = chain

    def table_side(name):
        if name == "routines":
            return routines_table
        return MagicMock()

    mock_supa.table.side_effect = table_side
    monkeypatch.setattr(routines_module, "supabase", mock_supa)

    client = TestClient(app)
    resp = client.get("/api/v1/routines")

    assert resp.status_code == 200
    data = resp.json()
    assert len(data["routines"]) == 2
    assert chain.eq.called


def test_upsert_routine_isolated_by_user(monkeypatch):
    import routers.routines as routines_module

    mock_supa = MagicMock()
    routines_table = MagicMock()
    upsert_chain = MagicMock()
    upsert_chain.execute.return_value = MockResult([
        {"id": "r1", "user_id": MOCK_USER_ID, "day_index": 1, "day_name": "Lunes", "exercises": [{"name": "Sentadilla"}]}
    ])
    routines_table.upsert.return_value = upsert_chain

    def table_side(name):
        if name == "routines":
            return routines_table
        return MagicMock()

    mock_supa.table.side_effect = table_side
    monkeypatch.setattr(routines_module, "supabase", mock_supa)

    client = TestClient(app)
    resp = client.put("/api/v1/routines/1", json={
        "day_name": "Lunes",
        "exercises": [{"name": "Sentadilla", "suggestedSets": 4, "suggestedReps": "10-12"}],
    })

    assert resp.status_code == 200
    inserted = routines_table.upsert.call_args[0][0]
    assert inserted["user_id"] == MOCK_USER_ID
    assert inserted["day_index"] == 1


def test_upsert_routine_validates_day_index(monkeypatch):
    client = TestClient(app)
    resp = client.put("/api/v1/routines/-1", json={
        "day_name": "Invalido",
        "exercises": [],
    })

    assert resp.status_code == 400


def test_delete_routine_isolated_by_user(monkeypatch):
    import routers.routines as routines_module

    mock_supa = MagicMock()
    routines_table = MagicMock()
    delete_chain = MagicMock()
    delete_chain.eq.return_value = delete_chain
    delete_chain.eq.return_value.execute.return_value = MockResult([{"id": "r1"}])
    routines_table.delete.return_value = delete_chain

    def table_side(name):
        if name == "routines":
            return routines_table
        return MagicMock()

    mock_supa.table.side_effect = table_side
    monkeypatch.setattr(routines_module, "supabase", mock_supa)

    client = TestClient(app)
    resp = client.delete("/api/v1/routines/1")

    assert resp.status_code == 200
    assert routines_table.delete.called


def test_upsert_rejects_day_index_7(monkeypatch):
    client = TestClient(app)
    resp = client.put("/api/v1/routines/7", json={
        "day_name": "Invalido",
        "exercises": [],
    })
    assert resp.status_code == 400


def test_complete_rejects_day_index_negative(monkeypatch):
    client = TestClient(app)
    resp = client.post("/api/v1/routines/-2/complete")
    assert resp.status_code == 400


def test_delete_rejects_day_index_7(monkeypatch):
    client = TestClient(app)
    resp = client.delete("/api/v1/routines/7")
    assert resp.status_code == 400


def test_upsert_uses_canonical_day_name(monkeypatch):
    import routers.routines as routines_module

    mock_supa = MagicMock()
    routines_table = MagicMock()
    upsert_chain = MagicMock()
    upsert_chain.execute.return_value = MockResult([
        {"id": "r1", "user_id": MOCK_USER_ID, "day_index": 3, "day_name": "Sabado"}
    ])
    routines_table.upsert.return_value = upsert_chain

    def table_side(name):
        if name == "routines":
            return routines_table
        return MagicMock()

    mock_supa.table.side_effect = table_side
    monkeypatch.setattr(routines_module, "supabase", mock_supa)

    client = TestClient(app)
    resp = client.put("/api/v1/routines/3", json={
        "day_name": "NombreArbitrario",
        "exercises": [],
    })

    assert resp.status_code == 200
    inserted = routines_table.upsert.call_args[0][0]
    assert inserted["day_name"] == "Miércoles"
    assert inserted["day_index"] == 3


def test_upsert_preserves_equipment_and_muscles(monkeypatch):
    import routers.routines as routines_module

    mock_supa = MagicMock()
    routines_table = MagicMock()
    upsert_chain = MagicMock()
    upsert_chain.execute.return_value = MockResult([
        {"id": "r1", "user_id": MOCK_USER_ID, "day_index": 1, "day_name": "Lunes",
         "exercises": [{"name": "Press", "equipment": ["barra"], "muscles": ["pecho"]}]}
    ])
    routines_table.upsert.return_value = upsert_chain

    def table_side(name):
        if name == "routines":
            return routines_table
        return MagicMock()

    mock_supa.table.side_effect = table_side
    monkeypatch.setattr(routines_module, "supabase", mock_supa)

    client = TestClient(app)
    resp = client.put("/api/v1/routines/1", json={
        "day_name": "Lunes",
        "exercises": [{"name": "Press", "equipment": ["barra", "mancuernas"], "muscles": ["pecho", "triceps"]}],
    })

    assert resp.status_code == 200
    inserted = routines_table.upsert.call_args[0][0]
    ex = inserted["exercises"][0]
    assert "barra" in ex["equipment"]
    assert "mancuernas" in ex["equipment"]
    assert "pecho" in ex["muscles"]
    assert "triceps" in ex["muscles"]
