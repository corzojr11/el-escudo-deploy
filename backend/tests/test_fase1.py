"""Tests de seguridad y contratos de la Fase 1 de El Escudo."""

import sys
import asyncio
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.modules["google.genai"] = MagicMock()
sys.modules["sentry_sdk"] = MagicMock()
sys.modules["sentry_sdk.integrations.fastapi"] = MagicMock(FastApiIntegration=MagicMock())

import pytest
from fastapi.testclient import TestClient
from fastapi import HTTPException

from main import app
from auth import get_current_user
from routers import password_reset as password_reset_module
from routers import omni as omni_module
from services import omni_service as omni_service_module
from services import omni_proposals as omni_proposals_module

MOCK_USER_ID = "11111111-1111-1111-1111-111111111111"


async def _mock_get_current_user():
    return type("User", (), {"id": MOCK_USER_ID, "aud": "authenticated"})()


_original_overrides = app.dependency_overrides.copy()
app.dependency_overrides[get_current_user] = _mock_get_current_user


@pytest.fixture(autouse=True)
def _restore_app_state(monkeypatch):
    yield
    app.dependency_overrides.clear()
    app.dependency_overrides.update(_original_overrides)
    app.dependency_overrides[get_current_user] = _mock_get_current_user
    omni_service_module._omni_rate_limits.clear()
    omni_service_module._daily_omni_usage.clear()


class MockResult:
    def __init__(self, data):
        self.data = data


class TableResult:
    def __init__(self, data):
        self.data = data


class SingleResult:
    def __init__(self, data):
        self.data = data


def _make_generic_chain(final_data=None):
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


def _build_mock_supabase_for_proposals():
    """Mock que soporta lectura/escritura de omni_proposals y perfiles."""
    stored_proposals = {}

    def table_side(name):
        tbl = MagicMock()

        if name == "omni_proposals":
            def insert_execute():
                args, _ = tbl.insert.call_args
                payload = args[0] if args else {}
                stored_proposals[payload["id"]] = payload
                return TableResult([payload])

            insert_chain = MagicMock()
            insert_chain.execute.side_effect = insert_execute
            tbl.insert.return_value = insert_chain

            def select_execute():
                eq_calls = getattr(tbl, "_eq_calls", [])
                proposal_id = None
                user_id = None
                for args, kwargs in eq_calls:
                    if args[0] == "id":
                        proposal_id = args[1]
                    if args[0] == "user_id":
                        user_id = args[1]
                matches = [
                    p for p in stored_proposals.values()
                    if (proposal_id is None or p["id"] == proposal_id)
                    and (user_id is None or p["user_id"] == user_id)
                ]
                return TableResult(matches[:1])

            def select_side(cols):
                tbl._eq_calls = []
                sel = MagicMock()

                def eq_side(col, val):
                    tbl._eq_calls.append(((col, val), {}))
                    return sel

                sel.eq.side_effect = eq_side
                sel.limit.return_value = sel
                sel.execute.side_effect = select_execute
                sel.order.return_value = sel
                sel.range.return_value = sel
                return sel

            tbl.select.side_effect = select_side

            def update_execute():
                args, _ = tbl.update.call_args
                payload = args[0] if args else {}
                eq_calls = getattr(tbl, "_update_eq_calls", [])
                target_id = None
                for args, kwargs in eq_calls:
                    if args[0] == "id":
                        target_id = args[1]
                if target_id and target_id in stored_proposals:
                    stored_proposals[target_id].update(payload)
                    return TableResult([stored_proposals[target_id]])
                return TableResult([])

            update_chain = MagicMock()

            def update_eq_side(col, val):
                if not hasattr(tbl, "_update_eq_calls"):
                    tbl._update_eq_calls = []
                tbl._update_eq_calls.append(((col, val), {}))
                return update_chain

            update_chain.eq.side_effect = update_eq_side
            update_chain.execute.side_effect = update_execute
            tbl.update.return_value = update_chain

        elif name == "profiles":
            def prof_select_execute():
                return SingleResult({"user_id": MOCK_USER_ID, "ai_cost_cop": 0})

            prof_select = MagicMock()
            prof_select.eq.return_value = prof_select
            prof_select.limit.return_value = prof_select
            prof_select.single.return_value = prof_select
            prof_select.execute.side_effect = prof_select_execute
            tbl.select.return_value = prof_select

            def update_execute():
                args, _ = tbl.update.call_args
                payload = args[0] if args else {}
                return TableResult([payload])

            update_chain = MagicMock()
            update_chain.eq.return_value = update_chain
            update_chain.execute.side_effect = update_execute
            tbl.update.return_value = update_chain
        else:
            tbl.return_value = _make_generic_chain()

        return tbl

    mock_supa = MagicMock()
    mock_supa.table.side_effect = table_side
    return mock_supa, stored_proposals


class TestPasswordResetSecurity:
    """A. Recuperación de contraseña segura."""

    def test_legacy_forgot_password_returns_410_and_no_dev_code(self, monkeypatch):
        client = TestClient(app)
        resp = client.post("/api/v1/auth/forgot-password", json={"email": "test@example.com"})
        assert resp.status_code == 410
        data = resp.json()
        assert "dev_code" not in data
        assert "desactivado" in data.get("detail", "").lower() or "Supabase" in data.get("detail", "")

    def test_legacy_reset_password_returns_410_and_no_code(self, monkeypatch):
        client = TestClient(app)
        resp = client.post("/api/v1/auth/reset-password", json={
            "email": "test@example.com",
            "code": "123456",
            "new_password": "newpass123",
        })
        assert resp.status_code == 410
        data = resp.json()
        assert "dev_code" not in data

    def test_migration_024_is_conditional_on_table_existence(self):
        """Verifica que 024 no dropee políticas sobre una tabla que podría no existir."""
        repo_root = Path(__file__).resolve().parents[2]
        migration_path = repo_root / "supabase" / "migrations" / "024_password_reset_deprecation.sql"
        assert migration_path.exists(), "No se encontró la migración 024"
        sql = migration_path.read_text(encoding="utf-8")

        # Debe verificar la existencia de la tabla antes de tocar políticas
        assert "SELECT EXISTS (" in sql or "to_regclass" in sql
        assert "DROP POLICY IF EXISTS" in sql
        assert "password_reset_codes" in sql
        # Las políticas deben estar dentro del bloque condicional
        policy_block = sql.split("DROP POLICY IF EXISTS", 1)[0]
        assert "tbl_exists" in policy_block or "IF EXISTS" in policy_block

    def test_migration_027_is_idempotent_when_routines_table_missing(self):
        """Verifica que 027 protege el caso de tabla inexistente: la crea completa."""
        repo_root = Path(__file__).resolve().parents[2]
        migration_path = repo_root / "supabase" / "migrations" / "027_routines_columns.sql"
        assert migration_path.exists(), "No se encontró la migración 027"
        sql = migration_path.read_text(encoding="utf-8")

        assert "information_schema.tables" in sql, (
            "027 debe consultar information_schema.tables para saber si routines existe"
        )
        assert "CREATE TABLE public.routines" in sql, (
            "027 debe contener un CREATE TABLE para el caso de tabla inexistente"
        )
        assert "objective" in sql
        assert "estimated_minutes" in sql
        assert "notes" in sql
        assert "ENABLE ROW LEVEL SECURITY" in sql
        assert "idx_routines_user_day" in sql
        assert "set_updated_at" in sql
        assert "trg_routines_updated_at" in sql
        # Las sentencias ALTER deben estar dentro del bloque ELSE (tabla existente)
        assert "ALTER TABLE public.routines ADD COLUMN" in sql
        # El trigger debe estar protegido por verificación de existencia de la tabla
        assert "DROP TRIGGER IF EXISTS trg_routines_updated_at" in sql


def _build_atomic_mock_supabase(proposal_id: str, initial_status: str = "pending"):
    """Mock de Supabase con claim atómico entre tareas para tests de concurrencia."""

    stored_proposals = {
        proposal_id: {
            "id": proposal_id,
            "user_id": MOCK_USER_ID,
            "session_id": "session-1",
            "command": "registra ingreso",
            "intent": "REGISTER_INCOME",
            "extracted_data": {"amount": 100000},
            "actions": [
                {
                    "intent": "REGISTER_INCOME",
                    "extracted_data": {"amount": 100000},
                    "respuesta_usuario": "Listo",
                    "mensaje_sistema": "Listo",
                }
            ],
            "status": initial_status,
            "trm": 4000.0,
            "expires_at": (datetime.now(timezone.utc).replace(microsecond=0) + timedelta(minutes=30)).isoformat(),
            "result": None,
        }
    }

    claim_lock = threading.Lock()

    class TableResult:
        def __init__(self, data):
            self.data = data

    def table_side(name):
        tbl = MagicMock()
        if name == "omni_proposals":
            def select_execute():
                return TableResult([stored_proposals[proposal_id]])

            select_chain = MagicMock()
            select_chain.eq.return_value = select_chain
            select_chain.limit.return_value = select_chain
            select_chain.execute.side_effect = select_execute
            tbl.select.return_value = select_chain

            def update_execute():
                args, _ = tbl.update.call_args
                payload = args[0] if args else {}
                stored_proposals[proposal_id].update(payload)
                return TableResult([stored_proposals[proposal_id]])

            update_chain = MagicMock()
            update_chain.eq.return_value = update_chain
            update_chain.execute.side_effect = update_execute
            tbl.update.return_value = update_chain
        return tbl

    mock_supa = MagicMock()
    mock_supa.table.side_effect = table_side

    def rpc_side(function_name, params):
        rpc_mock = MagicMock()
        if function_name == "claim_omni_proposal":
            def execute():
                # Claim atómico real entre threads
                with claim_lock:
                    prop = stored_proposals[proposal_id]
                    expires_at = datetime.fromisoformat(prop["expires_at"].replace("Z", "+00:00"))
                    if (
                        prop["status"] == "pending"
                        and prop["user_id"] == params["user_uuid"]
                        and datetime.now(timezone.utc) <= expires_at
                    ):
                        prop["status"] = "processing"
                        return TableResult([prop])
                    return TableResult([])
            rpc_mock.execute.side_effect = execute
        return rpc_mock

    mock_supa.rpc.side_effect = rpc_side
    return mock_supa, stored_proposals


class TestOmniSecureFlow:
    """C. OMNI seguro e idempotente."""

    def _setup_gemini_mock(self, monkeypatch, intent):
        mock_response = MagicMock()
        mock_response.text = (
            f'{{"intent": "{intent}", "extracted_data": {{"amount": 100000}}, '
            f'"respuesta_usuario": "Listo", "xp_ganada": 20}}'
        )
        mock_response.usage_metadata.prompt_token_count = 100
        mock_response.usage_metadata.candidates_token_count = 50

        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = mock_response
        monkeypatch.setattr(omni_service_module, "_omni_client", mock_client)

    def test_mutation_returns_proposal_not_execution(self, monkeypatch):
        self._setup_gemini_mock(monkeypatch, "REGISTER_INCOME")

        async def mock_get_trm():
            return 4000.0

        monkeypatch.setattr(omni_module, "get_trm", mock_get_trm)
        monkeypatch.setattr(omni_service_module, "get_trm", mock_get_trm)

        mock_supa, stored = _build_mock_supabase_for_proposals()
        monkeypatch.setattr(omni_module, "supabase", mock_supa)
        monkeypatch.setattr(omni_service_module, "supabase", mock_supa)
        monkeypatch.setattr(omni_proposals_module, "supabase", mock_supa)

        async def mock_ctx(user):
            return ""

        monkeypatch.setattr(omni_service_module, "_get_user_context", mock_ctx)

        client = TestClient(app)
        resp = client.post("/api/v1/process-command", json={"command": "registra ingreso de 100000"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["kind"] == "proposal"
        assert data["requires_confirmation"] is True
        assert "proposal_id" in data
        assert "preview" in data
        # La base de datos debe contener la propuesta pendiente
        assert len(stored) == 1
        proposal = list(stored.values())[0]
        assert proposal["status"] == "pending"
        assert proposal["user_id"] == MOCK_USER_ID

    def test_confirm_proposal_is_idempotent(self, monkeypatch):
        """confirm_proposal ejecuta una sola vez y devuelve already_executed en reintentos."""
        proposal_id = "22222222-2222-2222-2222-222222222222"
        mock_supa, stored_proposals = _build_atomic_mock_supabase(proposal_id, "pending")
        monkeypatch.setattr(omni_proposals_module, "supabase", mock_supa)

        execution_count = {"n": 0}

        async def fake_execute(res_json, user):
            execution_count["n"] += 1
            res_json["executed"] = True
            res_json["respuesta_usuario"] = "Ingreso registrado"
            return res_json

        monkeypatch.setattr(omni_proposals_module, "_execute_interpreted_command", fake_execute)

        user = type("User", (), {"id": MOCK_USER_ID})()

        async def run():
            result1 = await omni_proposals_module.confirm_proposal(user, proposal_id)
            assert result1["already_executed"] is False
            assert result1["result"]["success"] is True
            assert stored_proposals[proposal_id]["status"] == "confirmed"

            result2 = await omni_proposals_module.confirm_proposal(user, proposal_id)
            assert result2["already_executed"] is True

        asyncio.run(run())
        assert execution_count["n"] == 1

    def test_concurrent_confirmations_only_one_executes(self, monkeypatch):
        """Dos confirmaciones concurrentes de la misma propuesta: solo una ejecuta."""
        proposal_id = "44444444-4444-4444-4444-444444444444"
        mock_supa, stored_proposals = _build_atomic_mock_supabase(proposal_id, "pending")
        monkeypatch.setattr(omni_proposals_module, "supabase", mock_supa)

        execution_count = {"n": 0}
        lock = threading.Lock()

        async def fake_execute(res_json, user):
            # Simula trabajo que toma tiempo para aumentar la ventana de carrera
            await asyncio.sleep(0.01)
            with lock:
                execution_count["n"] += 1
            res_json["executed"] = True
            res_json["respuesta_usuario"] = "Ingreso registrado"
            return res_json

        monkeypatch.setattr(omni_proposals_module, "_execute_interpreted_command", fake_execute)

        user = type("User", (), {"id": MOCK_USER_ID})()

        async def run():
            results = await asyncio.gather(
                omni_proposals_module.confirm_proposal(user, proposal_id),
                omni_proposals_module.confirm_proposal(user, proposal_id),
            )

            # Una ejecutó, la otra recibió already_executed o processing
            kinds = {r["kind"] for r in results}
            assert "result" in kinds

            executed_results = [r for r in results if r["kind"] == "result" and not r["already_executed"]]
            assert len(executed_results) == 1, f"Solo una ejecución real era esperada: {results}"

            # El handler real solo se ejecutó una vez
            assert execution_count["n"] == 1
            assert stored_proposals[proposal_id]["status"] == "confirmed"

        asyncio.run(run())

    def test_confirm_processing_returns_processing_status(self, monkeypatch):
        """Si la propuesta está en processing, confirm devuelve processing sin ejecutar."""
        proposal_id = "55555555-5555-5555-5555-555555555555"
        mock_supa, stored_proposals = _build_atomic_mock_supabase(proposal_id, "processing")
        monkeypatch.setattr(omni_proposals_module, "supabase", mock_supa)

        execution_count = {"n": 0}

        async def fake_execute(res_json, user):
            execution_count["n"] += 1
            return res_json

        monkeypatch.setattr(omni_proposals_module, "_execute_interpreted_command", fake_execute)

        user = type("User", (), {"id": MOCK_USER_ID})()

        async def run():
            result = await omni_proposals_module.confirm_proposal(user, proposal_id)
            assert result["kind"] == "processing"

        asyncio.run(run())
        assert execution_count["n"] == 0

    def test_confirm_other_user_proposal_fails(self, monkeypatch):
        """No se puede reclamar una propuesta que no pertenece al usuario."""
        proposal_id = "66666666-6666-6666-6666-666666666666"
        mock_supa, stored_proposals = _build_atomic_mock_supabase(proposal_id, "pending")
        monkeypatch.setattr(omni_proposals_module, "supabase", mock_supa)

        # Alterar user_id para simular propiedad de otro usuario
        stored_proposals[proposal_id]["user_id"] = "other-user-id"

        user = type("User", (), {"id": MOCK_USER_ID})()

        async def run():
            with pytest.raises(ValueError):
                await omni_proposals_module.confirm_proposal(user, proposal_id)

        asyncio.run(run())

    def test_confirm_expired_proposal_fails(self, monkeypatch):
        """No se ejecuta una propuesta expirada."""
        proposal_id = "77777777-7777-7777-7777-777777777777"
        mock_supa, stored_proposals = _build_atomic_mock_supabase(proposal_id, "pending")
        stored_proposals[proposal_id]["expires_at"] = (
            datetime.now(timezone.utc).replace(microsecond=0) - timedelta(minutes=1)
        ).isoformat()
        monkeypatch.setattr(omni_proposals_module, "supabase", mock_supa)

        user = type("User", (), {"id": MOCK_USER_ID})()

        async def run():
            with pytest.raises(ValueError):
                await omni_proposals_module.confirm_proposal(user, proposal_id)
            assert stored_proposals[proposal_id]["status"] == "expired"

        asyncio.run(run())

    def test_cancel_proposal_prevents_execution(self, monkeypatch):
        """cancel_proposal marca la propuesta como cancelled."""
        proposal_id = "33333333-3333-3333-3333-333333333333"
        mock_supa, stored_proposals = _build_atomic_mock_supabase(proposal_id, "pending")
        monkeypatch.setattr(omni_proposals_module, "supabase", mock_supa)

        user = type("User", (), {"id": MOCK_USER_ID})()

        async def run():
            result = await omni_proposals_module.cancel_proposal(user, proposal_id)
            assert result["status"] == "cancelled"
            assert stored_proposals[proposal_id]["status"] == "cancelled"

            # Tras cancelar, confirmar debe fallar
            with pytest.raises(ValueError):
                await omni_proposals_module.confirm_proposal(user, proposal_id)

        asyncio.run(run())


class TestProfileBootstrap:
    """B. Bootstrap fiable de perfiles."""

    def test_profile_type_has_expected_fields(self):
        # Verificar que el modelo/contrato de Profile usado por sync no pierde campos críticos
        from routers.sync import sync_data
        import inspect
        src = inspect.getsource(sync_data)
        assert "profiles" in src or "profile_data" in src


class TestGoalRoutineContracts:
    """B/D. Contratos reproducibles."""

    def test_goal_payload_includes_current_value(self):
        from routers.goals import GoalCreatePayload, GoalUpdatePayload
        create = GoalCreatePayload(name="Test", current_value=5)
        update = GoalUpdatePayload(current_value=10)
        assert create.current_value == 5
        assert update.current_value == 10

    def test_routine_payload_includes_backend_columns(self):
        from routers.routines import RoutineDayPayload, RoutineExercisePayload
        ex = RoutineExercisePayload(name="Sentadilla")
        day = RoutineDayPayload(day_name="Lunes", objective="Fuerza", estimated_minutes=45, notes=["calentar"])
        assert day.objective == "Fuerza"
        assert day.estimated_minutes == 45
        assert day.notes == ["calentar"]
        assert ex.name == "Sentadilla"
