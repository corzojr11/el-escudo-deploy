"""Suite de tests unitarios para el router de metas (goals.py)."""

import sys
from unittest.mock import MagicMock

# Evitar que main.py falle al importar google.genai sin API key
sys.modules["google.genai"] = MagicMock()

import pytest
from fastapi.testclient import TestClient

from main import app
from auth import get_current_user
from routers import goals as goals_module


# ─── Fixtures & helpers ─────────────────────────────────────────────────────

MOCK_USER_ID = "11111111-1111-1111-1111-111111111111"


async def _mock_get_current_user():
    return type("User", (), {"id": MOCK_USER_ID, "aud": "authenticated"})()


# Guardamos el estado original de dependency_overrides para restaurarlo al final
_original_overrides = app.dependency_overrides.copy()
app.dependency_overrides[get_current_user] = _mock_get_current_user


@pytest.fixture(autouse=True)
def _restore_app_state(monkeypatch):
    """Restaura dependency_overrides tras cada test y reinstala el mock de auth."""
    yield
    app.dependency_overrides.clear()
    app.dependency_overrides.update(_original_overrides)
    app.dependency_overrides[get_current_user] = _mock_get_current_user


def _build_mock_supabase_goals_batch(goals_data, metrics_data):
    """Construye un mock de supabase para GET /api/v1/goals."""
    mock_supa = MagicMock()

    goals_table = MagicMock()
    goals_chain = MagicMock()
    goals_chain.execute.return_value = MagicMock(data=goals_data)
    goals_table.select.return_value.eq.return_value.neq.return_value.order.return_value = goals_chain

    metrics_table = MagicMock()
    metrics_chain = MagicMock()
    metrics_chain.execute.return_value = MagicMock(data=metrics_data)
    metrics_table.select.return_value.in_.return_value.order.return_value = metrics_chain

    def table_side(name):
        if name == "goals":
            return goals_table
        if name == "metrics":
            return metrics_table
        return MagicMock()

    mock_supa.table.side_effect = table_side
    return mock_supa, goals_table, metrics_table


def _build_metrics_goals_table():
    """Devuelve un goals_table preparado para las cadenas de búsqueda de métricas."""
    goals_table = MagicMock()
    sel_mock = MagicMock()
    eq1_mock = MagicMock()
    eq2_mock = MagicMock()
    lim_uuid = MagicMock()

    # Cadena UUID: select(...).eq("id", ...).eq("user_id", ...).limit(1).execute()
    sel_mock.eq.return_value = eq1_mock
    eq1_mock.eq.return_value = eq2_mock
    eq2_mock.limit.return_value = lim_uuid

    # Cadena ilike: select(...).eq("user_id", ...).neq("status", "archived")
    #               .ilike("name", ...).limit(1).execute()
    neq_mock = MagicMock()
    ilike_mock = MagicMock()
    lim_ilike = MagicMock()
    eq1_mock.neq.return_value = neq_mock
    neq_mock.ilike.return_value = ilike_mock
    ilike_mock.limit.return_value = lim_ilike

    goals_table.select.return_value = sel_mock
    return goals_table, lim_uuid, lim_ilike


# ─── Tests ────────────────────────────────────────────────────────────────────


class TestListGoals:
    """Caso 1: GET /api/v1/goals — query consolidada batch."""

    def test_list_goals_returns_goals_with_latest_metric(self, monkeypatch):
        goal_1 = {
            "id": "g1",
            "name": "Meta 1",
            "user_id": MOCK_USER_ID,
            "status": "active",
            "created_at": "2025-01-01T00:00:00",
        }
        goal_2 = {
            "id": "g2",
            "name": "Meta 2",
            "user_id": MOCK_USER_ID,
            "status": "active",
            "created_at": "2025-01-02T00:00:00",
        }
        metric_1 = {
            "id": "m1",
            "goal_id": "g1",
            "value": 70.0,
            "recorded_at": "2025-01-10T00:00:00",
        }
        metric_2 = {
            "id": "m2",
            "goal_id": "g2",
            "value": 65.0,
            "recorded_at": "2025-01-11T00:00:00",
        }

        mock_supa, goals_table, metrics_table = _build_mock_supabase_goals_batch(
            [goal_1, goal_2], [metric_1, metric_2]
        )
        monkeypatch.setattr(goals_module, "supabase", mock_supa)

        client = TestClient(app)
        resp = client.get("/api/v1/goals")

        assert resp.status_code == 200
        data = resp.json()
        assert len(data["goals"]) == 2
        assert data["goals"][0]["latest_metric"] == metric_1
        assert data["goals"][1]["latest_metric"] == metric_2

    def test_list_goals_no_n_plus_one(self, monkeypatch):
        goal_1 = {"id": "g1", "name": "Meta 1", "user_id": MOCK_USER_ID, "status": "active", "created_at": "2025-01-01T00:00:00"}
        goal_2 = {"id": "g2", "name": "Meta 2", "user_id": MOCK_USER_ID, "status": "active", "created_at": "2025-01-02T00:00:00"}
        metric_1 = {"id": "m1", "goal_id": "g1", "value": 70.0, "recorded_at": "2025-01-10T00:00:00"}

        mock_supa, goals_table, metrics_table = _build_mock_supabase_goals_batch(
            [goal_1, goal_2], [metric_1]
        )
        monkeypatch.setattr(goals_module, "supabase", mock_supa)

        client = TestClient(app)
        resp = client.get("/api/v1/goals")
        assert resp.status_code == 200

        # Verificar que solo se hicieron 2 llamadas a table: goals y metrics
        table_calls = [call.args[0] for call in mock_supa.table.call_args_list]
        assert table_calls.count("goals") == 1
        assert table_calls.count("metrics") == 1
        assert len(table_calls) == 2


class TestCreateGoal:
    """Caso 2: POST /api/v1/goals — inserción correcta."""

    def test_create_goal_success(self, monkeypatch):
        created_goal = {
            "id": "new-g1",
            "name": "Correr 10km",
            "description": "Meta de running",
            "goal_type": "fitness",
            "target_value": 10.0,
            "unit": "km",
            "deadline": "2025-12-31",
            "priority": 1,
            "config": {"frequency": "weekly"},
            "user_id": MOCK_USER_ID,
        }

        mock_supa = MagicMock()
        goals_table = MagicMock()
        goals_table.insert.return_value.execute.return_value = MagicMock(data=[created_goal])

        def table_side(name):
            if name == "goals":
                return goals_table
            return MagicMock()

        mock_supa.table.side_effect = table_side
        monkeypatch.setattr(goals_module, "supabase", mock_supa)

        payload = {
            "name": "Correr 10km",
            "description": "Meta de running",
            "goal_type": "fitness",
            "target_value": 10.0,
            "unit": "km",
            "deadline": "2025-12-31",
            "priority": 1,
            "config": {"frequency": "weekly"},
        }

        client = TestClient(app)
        resp = client.post("/api/v1/goals", json=payload)

        assert resp.status_code == 200
        assert resp.json()["goal"] == created_goal


class TestUpdateGoal:
    """Caso 3: PUT /api/v1/goals/{id} — actualización parcial."""

    def test_update_goal_partial(self, monkeypatch):
        updated_goal = {
            "id": "g1",
            "name": "Nuevo nombre",
            "description": "Desc original",
            "goal_type": "custom",
            "target_value": 5.0,
            "unit": "kg",
            "deadline": "2025-06-30",
            "status": "active",
            "priority": 2,
            "config": {},
        }

        mock_supa = MagicMock()
        goals_table = MagicMock()
        update_chain = MagicMock()
        update_chain.execute.return_value = MagicMock(data=[updated_goal])
        goals_table.update.return_value.eq.return_value.eq.return_value = update_chain

        def table_side(name):
            if name == "goals":
                return goals_table
            return MagicMock()

        mock_supa.table.side_effect = table_side
        monkeypatch.setattr(goals_module, "supabase", mock_supa)

        payload = {"name": "Nuevo nombre"}

        client = TestClient(app)
        resp = client.put("/api/v1/goals/g1", json=payload)

        assert resp.status_code == 200
        assert resp.json()["goal"]["name"] == "Nuevo nombre"
        # Verificar que solo se envió el campo modificado a Supabase
        goals_table.update.assert_called_once_with({"name": "Nuevo nombre"})


class TestDeleteGoal:
    """Caso 4: DELETE /api/v1/goals/{id} — baja lógica."""

    def test_delete_goal_archives_instead_of_removing(self, monkeypatch):
        mock_supa = MagicMock()
        goals_table = MagicMock()
        update_chain = MagicMock()
        update_chain.execute.return_value = MagicMock(data=[{"id": "g1", "status": "archived"}])
        goals_table.update.return_value.eq.return_value.eq.return_value = update_chain

        def table_side(name):
            if name == "goals":
                return goals_table
            return MagicMock()

        mock_supa.table.side_effect = table_side
        monkeypatch.setattr(goals_module, "supabase", mock_supa)

        client = TestClient(app)
        resp = client.delete("/api/v1/goals/g1")

        assert resp.status_code == 200
        assert resp.json() == {"status": "archived"}
        goals_table.update.assert_called_once_with({"status": "archived"})
        goals_table.delete.assert_not_called()


class TestCreateMetric:
    """Caso 5: POST /api/v1/metrics — resolución de goal_id."""

    def _build_metrics_mock(self, goals_table, metric_data):
        mock_supa = MagicMock()
        metrics_table = MagicMock()
        insert_chain = MagicMock()
        insert_chain.execute.return_value = MagicMock(data=[metric_data])
        metrics_table.insert.return_value = insert_chain

        def table_side(name):
            if name == "goals":
                return goals_table
            if name == "metrics":
                return metrics_table
            return MagicMock()

        mock_supa.table.side_effect = table_side
        return mock_supa, metrics_table

    def test_metric_with_uuid_goal_id(self, monkeypatch):
        goal_uuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
        goal_info = {"id": goal_uuid, "goal_type": "custom", "unit": "kg"}
        created_metric = {
            "id": "m-new",
            "goal_id": goal_uuid,
            "user_id": MOCK_USER_ID,
            "value": 75.5,
            "unit": "kg",
        }

        goals_table, lim_uuid, lim_ilike = _build_metrics_goals_table()
        lim_uuid.execute.return_value = MagicMock(data=[goal_info])

        mock_supa, metrics_table = self._build_metrics_mock(goals_table, created_metric)
        monkeypatch.setattr(goals_module, "supabase", mock_supa)

        payload = {"goal_id": goal_uuid, "value": 75.5, "unit": "kg"}
        client = TestClient(app)
        resp = client.post("/api/v1/metrics", json=payload)

        assert resp.status_code == 200
        assert resp.json()["metric"]["goal_id"] == goal_uuid
        assert metrics_table.insert.call_args[0][0]["goal_id"] == goal_uuid

    def test_metric_with_exact_name(self, monkeypatch):
        goal_id = "g-exact"
        goal_info = {"id": goal_id, "goal_type": "custom", "unit": "kg"}
        created_metric = {
            "id": "m-new",
            "goal_id": goal_id,
            "user_id": MOCK_USER_ID,
            "value": 74.0,
            "unit": "kg",
        }

        goals_table, lim_uuid, lim_ilike = _build_metrics_goals_table()
        lim_ilike.execute.return_value = MagicMock(data=[goal_info])

        mock_supa, metrics_table = self._build_metrics_mock(goals_table, created_metric)
        monkeypatch.setattr(goals_module, "supabase", mock_supa)

        payload = {"goal_id": "perder 5kg de peso", "value": 74.0, "unit": "kg"}
        client = TestClient(app)
        resp = client.post("/api/v1/metrics", json=payload)

        assert resp.status_code == 200
        assert resp.json()["metric"]["goal_id"] == goal_id
        assert metrics_table.insert.call_args[0][0]["goal_id"] == goal_id

    def test_metric_with_fuzzy_name(self, monkeypatch):
        goal_id = "g-fuzzy"
        goal_info = {"id": goal_id, "goal_type": "custom", "unit": "kg"}
        created_metric = {
            "id": "m-new",
            "goal_id": goal_id,
            "user_id": MOCK_USER_ID,
            "value": 73.0,
            "unit": "kg",
        }

        goals_table, lim_uuid, lim_ilike = _build_metrics_goals_table()
        # Primera búsqueda (nombre completo) devuelve vacío; segunda (keyword "perder") acierta
        lim_ilike.execute.side_effect = [
            MagicMock(data=[]),
            MagicMock(data=[goal_info]),
        ]

        mock_supa, metrics_table = self._build_metrics_mock(goals_table, created_metric)
        monkeypatch.setattr(goals_module, "supabase", mock_supa)

        payload = {"goal_id": "perder peso", "value": 73.0, "unit": "kg"}
        client = TestClient(app)
        resp = client.post("/api/v1/metrics", json=payload)

        assert resp.status_code == 200
        assert resp.json()["metric"]["goal_id"] == goal_id
        assert metrics_table.insert.call_args[0][0]["goal_id"] == goal_id
