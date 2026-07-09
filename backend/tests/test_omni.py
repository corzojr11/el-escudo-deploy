"""Suite de tests unitarios para el asistente OMNI."""

import sys
import asyncio
import time
from unittest.mock import MagicMock, patch

# Evitar que main.py / omni_service.py fallen al importar google.genai sin API key
sys.modules["google.genai"] = MagicMock()
sys.modules["sentry_sdk"] = MagicMock()
sys.modules["sentry_sdk.integrations.fastapi"] = MagicMock(FastApiIntegration=MagicMock())

import pytest
from fastapi.testclient import TestClient
from fastapi import HTTPException

from main import app
from auth import get_current_user
from routers import omni as omni_module
from services import omni_service as omni_service_module

MOCK_USER_ID = "11111111-1111-1111-1111-111111111111"


async def _mock_get_current_user():
    return type("User", (), {"id": MOCK_USER_ID, "aud": "authenticated"})()


# Guardamos el estado original de dependency_overrides para restaurarlo
_original_overrides = app.dependency_overrides.copy()
app.dependency_overrides[get_current_user] = _mock_get_current_user


@pytest.fixture(autouse=True)
def _restore_app_state(monkeypatch):
    """Restaura dependency_overrides y limpia estado de OMNI entre tests."""
    yield
    app.dependency_overrides.clear()
    app.dependency_overrides.update(_original_overrides)
    app.dependency_overrides[get_current_user] = _mock_get_current_user
    # Limpiar rate limits y daily usage
    omni_service_module._omni_rate_limits.clear()
    omni_service_module._daily_omni_usage.clear()


# ─── Helpers ────────────────────────────────────────────────────────────────

class MockResult:
    def __init__(self, data):
        self.data = data


def _make_generic_chain(final_data=None):
    """Devuelve un mock chainable que termina en execute() -> MockResult."""
    class GenericChain:
        def execute(self):
            return MockResult(final_data)

        def __getattr__(self, name):
            if name == "execute":
                return self.execute
            return _make_generic_chain(final_data)

        def __call__(self, *args, **kwargs):
            return _make_generic_chain(final_data)

    return GenericChain()


def _build_mock_supabase_for_recipes():
    """Construye un mock de supabase para operaciones CRUD de omni_recipes."""
    stored_recipes = []

    class RMockResult:
        def __init__(self, data):
            self.data = data

    recipes_table = MagicMock()

    # ── Insert ──
    insert_chain = MagicMock()

    def _insert_execute():
        args, _ = recipes_table.insert.call_args
        payload = args[0] if args else {}
        if "id" not in payload:
            payload["id"] = "recipe-123"
        stored_recipes.append(payload)
        return RMockResult([payload])

    insert_chain.execute.side_effect = _insert_execute
    recipes_table.insert.return_value = insert_chain

    # ── List ──
    list_chain = MagicMock()
    list_chain.execute.return_value = RMockResult(stored_recipes)

    # ── Check exists ──
    check_sel = MagicMock()
    check_eq1 = MagicMock()
    check_eq2 = MagicMock()
    check_lim = MagicMock()
    check_sel.eq.return_value = check_eq1
    check_eq1.eq.return_value = check_eq2
    check_eq2.limit.return_value = check_lim
    check_lim.execute.return_value = RMockResult([{"id": "recipe-123"}])

    def select_side(cols):
        if cols == "id":
            return check_sel
        sel_mock = MagicMock()
        sel_mock.eq.return_value.order.return_value = list_chain
        return sel_mock

    recipes_table.select.side_effect = select_side

    # ── Delete ──
    del_eq1 = MagicMock()
    del_eq2 = MagicMock()
    del_chain = MagicMock()
    del_chain.eq.return_value = del_eq1
    del_eq1.eq.return_value = del_eq2

    def _delete_execute():
        args, _ = del_chain.eq.call_args
        recipe_id = args[1] if len(args) > 1 else None
        if recipe_id:
            stored_recipes[:] = [r for r in stored_recipes if r.get("id") != recipe_id]
        return RMockResult([])

    del_eq2.execute.side_effect = _delete_execute
    recipes_table.delete.return_value = del_chain

    def table_side(name):
        if name == "omni_recipes":
            return recipes_table
        return _make_generic_chain()

    mock_supa = MagicMock()
    mock_supa.table.side_effect = table_side
    return mock_supa, recipes_table, stored_recipes


# ─── Caso 1: Multi-Intent Splitting ─────────────────────────────────────────

class TestMultiIntentSplitting:
    def test_split_two_intents_with_y_and_luego(self):
        result = omni_service_module.split_multi_intent("Registra peso y luego agrega un gasto")
        assert isinstance(result, list)
        assert len(result) == 2
        assert result[0] == "Registra peso"
        assert result[1] == "luego agrega un gasto"

    def test_split_three_intents_with_comma_and_y(self):
        result = omni_service_module.split_multi_intent("Compra leche, pan y huevos")
        assert isinstance(result, list)
        assert len(result) == 3
        assert result[0] == "Compra leche"
        assert result[1] == "pan"
        assert result[2] == "huevos"


# ─── Caso 2: Rate Limiting ────────────────────────────────────────────────

class TestRateLimiting:
    def test_31st_request_returns_429(self, monkeypatch):
        """Simula 31 llamadas al endpoint process-command desde el mismo user_id."""
        # Forzar modo offline para respuestas inmediatas sin invocar Gemini
        monkeypatch.setattr(omni_service_module, "_omni_client", None)

        client = TestClient(app)
        for i in range(30):
            resp = client.post("/api/v1/process-command", json={"command": f"cmd {i}"})
            assert resp.status_code == 200, f"Fallo en llamada {i + 1}: {resp.text}"

        resp = client.post("/api/v1/process-command", json={"command": "cmd 31"})
        assert resp.status_code == 429
        detail = resp.json().get("detail", "")
        assert "Demasiados comandos" in detail


# ─── Caso 3: Daily Cost Limit ─────────────────────────────────────────────

class TestDailyCostLimit:
    def test_check_omni_daily_limit_raises_429(self, monkeypatch):
        """Verifica que _check_omni_daily_limit lanza HTTPException 429."""
        monkeypatch.setattr(omni_service_module, "DAILY_COST_LIMIT", 5000)
        now = time.time()
        omni_service_module._daily_omni_usage[MOCK_USER_ID] = [(now, 5000)]

        with pytest.raises(HTTPException) as exc_info:
            omni_service_module._check_omni_daily_limit(MOCK_USER_ID)

        assert exc_info.value.status_code == 429
        assert "OMNI alcanzado" in exc_info.value.detail

    def test_process_single_command_blocked_by_daily_limit(self, monkeypatch):
        """Verifica que process_single_command no ejecuta cuando se alcanza el límite."""
        monkeypatch.setattr(omni_service_module, "DAILY_COST_LIMIT", 5000)
        now = time.time()
        omni_service_module._daily_omni_usage[MOCK_USER_ID] = [(now, 5000)]

        user = type("User", (), {"id": MOCK_USER_ID})()

        loop = asyncio.new_event_loop()
        try:
            with pytest.raises(HTTPException) as exc_info:
                loop.run_until_complete(
                    omni_service_module.process_single_command("test", user, 4000.0, {}, [])
                )
            assert exc_info.value.status_code == 429
        finally:
            loop.close()


# ─── Caso 4: Recipes CRUD ───────────────────────────────────────────────────

class TestRecipesCrud:
    def test_create_list_delete_recipe(self, monkeypatch):
        mock_supa, recipes_table, stored = _build_mock_supabase_for_recipes()
        monkeypatch.setattr(omni_module, "supabase", mock_supa)

        client = TestClient(app)

        # CREATE
        payload = {
            "name": "Receta Test",
            "command_sequence": "comprar leche; comprar pan",
            "description": "Lista de compras",
        }
        resp = client.post("/api/v1/omni/recipes", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert "recipe" in data
        recipe_id = data["recipe"].get("id", "recipe-123")

        # LIST
        resp = client.get("/api/v1/omni/recipes")
        assert resp.status_code == 200
        recipes = resp.json()["recipes"]
        assert any(r.get("id") == recipe_id for r in recipes)

        # DELETE
        resp = client.delete(f"/api/v1/omni/recipes/{recipe_id}")
        assert resp.status_code == 200
        assert "eliminada" in resp.json()["detail"].lower()

        # Verify list is empty after delete
        resp = client.get("/api/v1/omni/recipes")
        assert resp.status_code == 200
        assert resp.json()["recipes"] == []


# ─── Caso 5: Mock de API de Gemini ────────────────────────────────────────

class TestMockGeminiAPI:
    def test_endpoint_processes_mocked_gemini_and_uses_asyncio_to_thread(self, monkeypatch):
        # Mock respuesta de Gemini
        mock_response = MagicMock()
        mock_response.text = (
            '{"intent": "NONE", "extracted_data": {}, '
            '"respuesta_usuario": "Entendido", "xp_ganada": 5}'
        )
        mock_response.usage_metadata.prompt_token_count = 100
        mock_response.usage_metadata.candidates_token_count = 50

        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = mock_response
        monkeypatch.setattr(omni_service_module, "_omni_client", mock_client)

        # Mock get_trm
        async def mock_get_trm():
            return 4000.0

        monkeypatch.setattr(omni_module, "get_trm", mock_get_trm)
        monkeypatch.setattr(omni_service_module, "get_trm", mock_get_trm)

        # Mock supabase
        mock_supa = MagicMock()
        mock_supa.table.return_value = _make_generic_chain({"ai_cost_cop": 0})
        monkeypatch.setattr(omni_module, "supabase", mock_supa)
        monkeypatch.setattr(omni_service_module, "supabase", mock_supa)

        # Mock _get_user_context
        async def mock_ctx(user):
            return ""

        monkeypatch.setattr(omni_service_module, "_get_user_context", mock_ctx)

        tracked_events = []

        async def mock_track_event(**kwargs):
            tracked_events.append(kwargs)

        monkeypatch.setattr(omni_module, "track_event", mock_track_event)

        with patch("services.omni_service.asyncio.to_thread", side_effect=asyncio.to_thread) as mock_to_thread:
            client = TestClient(app)
            resp = client.post("/api/v1/process-command", json={"command": "test command"})

            assert resp.status_code == 200
            data = resp.json()
            assert data["intent"] == "NONE"
            assert data["respuesta_usuario"] == "Entendido"
            assert data["xp_ganada"] == 5
            assert "interaction_cost_cop" in data
            assert data["current_trm"] == 4000.0

            # Verificar que Gemini fue llamado
            mock_client.models.generate_content.assert_called_once()
            call_kwargs = mock_client.models.generate_content.call_args[1]
            assert call_kwargs["model"] == "models/gemini-2.5-flash-lite"
            assert "contents" in call_kwargs

            # Verificar que asyncio.to_thread fue usado (no bloquea el event loop)
            assert mock_to_thread.call_count >= 1
            assert [e["event"] for e in tracked_events] == [
                "process_command_received",
                "process_command_completed",
            ]
            assert all(e["module"] == "omni" for e in tracked_events)
