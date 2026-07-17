"""Tests de backend para el cierre tecnico de Finanzas (migracion 036 + API).

Cubre:
- Migracion 036: guards, idempotencia, creacion de tablas, RLS y proteccion de la RPC.
- Creacion/edicion de deudas: rechazar remaining > total.
- Pago: invoca la RPC, filtra por usuario y mapea saldo excedido a HTTP 400.
- Fixed expenses: CRUD y aislamiento por user_id.
- Budget: error si el perfil del usuario no existe.

No usa infraestructura externa ni Supabase real; el modulo `database` ya esta
mockeado por conftest.py. Usamos HTTPX.TestClient contra la app de FastAPI con
el mock del usuario autenticado.
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock

# Evitar fallos de importacion sin API key de Gemini
sys.modules["google.genai"] = MagicMock()

import pytest
from fastapi.testclient import TestClient

from main import app
from auth import get_current_user
from routers import finances as finances_module


# --- Constantes y helpers -----------------------------------------------------

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


class MockResult:
    def __init__(self, data):
        self.data = data


def _set_table(mock_supa, name, table_mock):
    """Instala o reemplaza el mock de una tabla dentro de mock_supa.table."""
    table_side = mock_supa.table.side_effect

    def new_side(n, _existing=table_side, _override=name, _mock=table_mock):
        if n == _override:
            return _mock
        return _existing(n)

    mock_supa.table.side_effect = new_side


def _build_base_supa():
    mock_supa = MagicMock()
    return mock_supa


# --- Tests: migracion 036 (estatico sobre el SQL) -----------------------------

MIGRATION_PATH = (
    Path(__file__).resolve().parents[2] / "supabase" / "migrations" / "036_monthly_budget.sql"
)


def _read_migration() -> str:
    return MIGRATION_PATH.read_text(encoding="utf-8")


def _strip_sql_comments(text: str) -> str:
    """Elimina lineas que empiezan con '--' para no capturar keywords en comentarios."""
    out_lines = []
    for line in text.splitlines():
        stripped = line.lstrip()
        if stripped.startswith("--"):
            continue
        out_lines.append(line)
    return "\n".join(out_lines)


class TestMigration036:
    def test_file_exists(self):
        assert MIGRATION_PATH.exists(), "La migracion 036 debe existir"
        text = _read_migration()
        assert "036" in text
        assert "monthly_budget" in text

    def test_is_idempotent(self):
        text = _read_migration()
        code = _strip_sql_comments(text)
        # Sin DROP/TRUNCATE destructivos en codigo SQL (se excluyen comentarios)
        for forbidden in ("DROP TABLE", "TRUNCATE", "DROP DATABASE"):
            assert forbidden not in code.upper(), f"La migracion no debe contener {forbidden}"
        # Idempotencia: IF NOT EXISTS, DROP POLICY IF EXISTS y CREATE OR REPLACE FUNCTION
        assert "CREATE TABLE IF NOT EXISTS" in code or (
            "CREATE TABLE public.debts" in code and "IF NOT EXISTS" in code
        )
        assert "DROP POLICY IF EXISTS" in code
        assert "CREATE OR REPLACE FUNCTION public.record_debt_payment" in code
        assert "information_schema.tables" in code
        assert "information_schema.columns" in code
        assert "RAISE NOTICE" in code

    def test_creates_debts_table_and_columns(self):
        text = _read_migration()
        assert "CREATE TABLE public.debts" in text
        assert "user_id" in text and "auth.users" in text
        assert "remaining" in text and "monthly_payment" in text
        assert "due_date" in text and "notes" in text and "status" in text

    def test_creates_fixed_expenses_table(self):
        text = _read_migration()
        assert "CREATE TABLE public.fixed_expenses" in text
        assert "is_paid" in text and "category" in text

    def test_creates_debt_payments_inside_debts_guard(self):
        text = _read_migration()
        # debt_payments solo se crea si debts existe (guard explicito)
        assert "debt_payments" in text
        # La primera referencia a 'debts' aparece antes que la creacion de
        # debt_payments, garantizando la verificacion de existencia.
        first_debts = text.find("table_name = 'debts'")
        first_debt_payments_create = text.find("CREATE TABLE public.debt_payments")
        assert first_debts != -1
        assert first_debt_payments_create > first_debts

    def test_rls_policies_for_all_tables(self):
        text = _read_migration()
        for policy in (
            "p_debts_select",
            "p_debts_insert",
            "p_debts_update",
            "p_debts_delete",
            "p_fixed_expenses_select",
            "p_fixed_expenses_insert",
            "p_fixed_expenses_update",
            "p_fixed_expenses_delete",
            "p_debt_payments_select",
            "p_debt_payments_insert",
        ):
            assert policy in text, f"Falta politica {policy} en la migracion"
        assert "ENABLE ROW LEVEL SECURITY" in text

    def test_rpc_only_created_when_tables_exist(self):
        text = _read_migration()
        # La seccion 7 valida ambas tablas antes de crear la RPC
        rpc_section = text.split("record_debt_payment", 1)[0]
        assert "table_name = 'debts'" in rpc_section
        assert "table_name = 'debt_payments'" in rpc_section
        # Mensaje explicito de omision
        assert "Se omite la RPC" in text or "no existen" in text

    def test_rpc_revokes_public_and_anon_authenticated(self):
        text = _read_migration()
        assert "REVOKE ALL ON FUNCTION public.record_debt_payment" in text
        assert "REVOKE EXECUTE ON FUNCTION public.record_debt_payment" in text
        assert "FROM anon" in text
        assert "FROM authenticated" in text
        assert "FROM PUBLIC" in text

    def test_rpc_grants_only_service_role(self):
        text = _read_migration()
        grant_line = "GRANT EXECUTE ON FUNCTION public.record_debt_payment" in text
        assert grant_line
        assert "TO service_role" in text
        # No debe haber GRANT a anon ni authenticated para la funcion
        assert "GRANT EXECUTE ON FUNCTION public.record_debt_payment" + " TO anon" not in text
        assert "GRANT EXECUTE ON FUNCTION public.record_debt_payment" + " TO authenticated" not in text

    def test_rpc_uses_security_definer_and_lock(self):
        text = _read_migration()
        assert "SECURITY DEFINER" in text
        assert "FOR UPDATE" in text
        # Codigos de error internos estables
        assert "DEBT_NOT_FOUND" in text
        assert "AMOUNT_EXCEEDS_REMAINING" in text

    def test_useful_indexes(self):
        text = _read_migration()
        assert "idx_debts_user" in text
        assert "idx_fixed_expenses_user" in text
        assert "idx_debt_payments_debt" in text


# --- Tests: validacion de Pydantic para deudas --------------------------------

class TestDebtValidation:
    def _build_supa_for_create(self, created_debt):
        mock_supa = MagicMock()
        debts_table = MagicMock()
        insert_chain = MagicMock()
        insert_chain.execute.return_value = MagicMock(data=[created_debt])
        debts_table.insert.return_value = insert_chain

        def table_side(name):
            if name == "debts":
                return debts_table
            return MagicMock()

        mock_supa.table.side_effect = table_side
        return mock_supa

    def test_create_debt_rejects_remaining_greater_than_total(self, monkeypatch):
        mock_supa = self._build_supa_for_create({"id": "x"})
        monkeypatch.setattr(finances_module, "supabase", mock_supa)

        client = TestClient(app)
        resp = client.post(
            "/api/v1/debts",
            json={
                "name": "Tarjeta x",
                "total": 1000,
                "remaining": 5000,
            },
        )
        assert resp.status_code == 422, resp.text
        # No se debe insertar nada
        debts_table = mock_supa.table("debts")
        debts_table.insert.assert_not_called()

    def test_create_debt_defaults_remaining_to_total(self, monkeypatch):
        created = {
            "id": "d1",
            "name": "Tarjeta",
            "total": 1000,
            "remaining": 1000,
            "monthly_payment": 0,
        }
        mock_supa = self._build_supa_for_create(created)
        monkeypatch.setattr(finances_module, "supabase", mock_supa)

        client = TestClient(app)
        resp = client.post(
            "/api/v1/debts",
            json={"name": "Tarjeta", "total": 1000},
        )
        assert resp.status_code == 200, resp.text
        insert_payload = mock_supa.table("debts").insert.call_args[0][0]
        assert insert_payload["remaining"] == 1000
        assert insert_payload["total"] == 1000
        assert insert_payload["user_id"] == MOCK_USER_ID

    def test_create_debt_explicit_remaining_below_total(self, monkeypatch):
        created = {"id": "d2", "name": "Tarjeta", "total": 1000, "remaining": 300}
        mock_supa = self._build_supa_for_create(created)
        monkeypatch.setattr(finances_module, "supabase", mock_supa)

        client = TestClient(app)
        resp = client.post(
            "/api/v1/debts",
            json={"name": "Tarjeta", "total": 1000, "remaining": 300},
        )
        assert resp.status_code == 200, resp.text
        insert_payload = mock_supa.table("debts").insert.call_args[0][0]
        assert insert_payload["remaining"] == 300
        assert insert_payload["total"] == 1000

    def test_create_debt_rejects_non_positive_total(self, monkeypatch):
        mock_supa = self._build_supa_for_create({"id": "x"})
        monkeypatch.setattr(finances_module, "supabase", mock_supa)

        client = TestClient(app)
        resp = client.post(
            "/api/v1/debts",
            json={"name": "Tarjeta", "total": 0, "remaining": 0},
        )
        assert resp.status_code == 422, resp.text

    def test_update_debt_rejects_remaining_greater_than_existing_total(self, monkeypatch):
        mock_supa = MagicMock()
        debts_table = MagicMock()
        # Cadena: select("total, remaining").eq("id").eq("user_id").limit(1).execute()
        select_chain = MagicMock()
        select_chain.limit.return_value.execute.return_value = MagicMock(data=[{
            "total": 500, "remaining": 100,
        }])
        select_chain.limit.return_value = select_chain.limit.return_value
        select_chain.limit.return_value.execute.return_value = MagicMock(data=[{
            "total": 500, "remaining": 100,
        }])
        # Reconstruir sinon
        prev_chain = MagicMock()
        prev_chain.execute.return_value = MagicMock(data=[{
            "total": 500, "remaining": 100,
        }])
        # Cadena exacta esperada (ver orden del codigo)
        debts_table.select.return_value.eq.return_value.eq.return_value.limit.return_value = prev_chain

        update_chain = MagicMock()
        update_chain.execute.return_value = MagicMock(data=[{"id": "d", "total": 500, "remaining": 700}])
        debts_table.update.return_value.eq.return_value.eq.return_value = update_chain

        def table_side(name):
            if name == "debts":
                return debts_table
            return MagicMock()

        mock_supa.table.side_effect = table_side
        monkeypatch.setattr(finances_module, "supabase", mock_supa)

        client = TestClient(app)
        resp = client.put(
            "/api/v1/debts/d9",
            json={"remaining": 700},
        )
        assert resp.status_code == 400, resp.text
        # No se debe haber llamado a update
        debts_table.update.assert_not_called()


# --- Tests: pago de deuda (RPC) ----------------------------------------------

class TestDebtPayment:
    def test_payment_returns_new_remaining(self, monkeypatch):
        mock_supa = MagicMock()
        rpc_chain = MagicMock()
        rpc_chain.execute.return_value = MagicMock(data=[{
            "payment_id": "p1",
            "new_remaining": 450,
        }])
        mock_supa.rpc.return_value = rpc_chain

        monkeypatch.setattr(finances_module, "supabase", mock_supa)

        client = TestClient(app)
        resp = client.post(
            "/api/v1/debts/debt-uuid/payments",
            json={"amount": 50},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["debt"]["remaining"] == 450
        # La RPC se invoca con el usuario autenticado
        rpc_args = mock_supa.rpc.call_args
        assert rpc_args.args[0] == "record_debt_payment"
        params = rpc_args.args[1] if len(rpc_args.args) > 1 else rpc_args.kwargs
        assert params["p_user_id"] == MOCK_USER_ID
        assert params["p_amount"] == 50

    def test_payment_amount_exceeds_remaining_maps_to_400(self, monkeypatch):
        mock_supa = MagicMock()
        rpc_chain = MagicMock()

        def boom(*_a, **_kw):
            raise Exception("El abono supera el saldo pendiente. Code=AMOUNT_EXCEEDS_REMAINING")

        rpc_chain.execute.side_effect = boom
        mock_supa.rpc.return_value = rpc_chain

        monkeypatch.setattr(finances_module, "supabase", mock_supa)

        client = TestClient(app)
        resp = client.post(
            "/api/v1/debts/debt-uuid/payments",
            json={"amount": 9999},
        )
        assert resp.status_code == 400, resp.text
        body = resp.json()
        assert "saldo" in body.get("detail", "").lower() or "abono" in body.get("detail", "").lower()

    def test_payment_debt_not_found_maps_to_404(self, monkeypatch):
        mock_supa = MagicMock()
        rpc_chain = MagicMock()
        rpc_chain.execute.side_effect = Exception("DEBT_NOT_FOUND")
        mock_supa.rpc.return_value = rpc_chain
        monkeypatch.setattr(finances_module, "supabase", mock_supa)

        client = TestClient(app)
        resp = client.post(
            "/api/v1/debts/other-user-debt/payments",
            json={"amount": 100},
        )
        assert resp.status_code == 404, resp.text

    def test_payment_zero_amount_rejected_by_pydantic(self, monkeypatch):
        mock_supa = MagicMock()
        monkeypatch.setattr(finances_module, "supabase", mock_supa)

        client = TestClient(app)
        resp = client.post(
            "/api/v1/debts/x/payments",
            json={"amount": 0},
        )
        assert resp.status_code == 422, resp.text

    def test_list_payments_filters_by_user_and_debt(self, monkeypatch):
        mock_supa = MagicMock()
        payments_table = MagicMock()
        chain = MagicMock()
        chain.execute.return_value = MagicMock(data=[
            {"id": "p1", "debt_id": "d1", "user_id": MOCK_USER_ID, "amount": 100, "payment_date": "2026-01-01"},
        ])
        # select("*").eq("debt_id", id).eq("user_id", uid).order(...).execute()
        payments_table.select.return_value.eq.return_value.eq.return_value.order.return_value = chain

        def table_side(name):
            if name == "debt_payments":
                return payments_table
            return MagicMock()

        mock_supa.table.side_effect = table_side
        monkeypatch.setattr(finances_module, "supabase", mock_supa)

        client = TestClient(app)
        resp = client.get("/api/v1/debts/d1/payments")
        assert resp.status_code == 200, resp.text
        payments = resp.json()["payments"]
        assert len(payments) == 1
        assert payments[0]["user_id"] == MOCK_USER_ID
        assert payments[0]["debt_id"] == "d1"
        # El filtro user_id es la segunda eq de la cadena
        eq_user = payments_table.select.return_value.eq.return_value.eq
        assert eq_user.call_args.args == ("user_id", MOCK_USER_ID)


# --- Tests: fixed expenses ---------------------------------------------------

class TestFixedExpenses:
    def _build_table(self, insert_data=None, update_data=None, delete_data=None, list_data=None):
        table = MagicMock()
        # Insert
        insert_chain = MagicMock()
        insert_chain.execute.return_value = MagicMock(data=insert_data or [])
        table.insert.return_value = insert_chain
        # List (order chain)
        order_chain = MagicMock()
        order_chain.execute.return_value = MagicMock(data=list_data or [])
        table.select.return_value.eq.return_value.order.return_value = order_chain
        # Update
        update_chain = MagicMock()
        update_chain.execute.return_value = MagicMock(data=update_data or [])
        table.update.return_value.eq.return_value.eq.return_value = update_chain
        # Delete
        delete_chain = MagicMock()
        delete_chain.execute.return_value = MagicMock(data=delete_data or [])
        table.delete.return_value.eq.return_value.eq.return_value = delete_chain
        return table

    def test_list_fixed_expenses_filters_by_user(self, monkeypatch):
        list_data = [
            {"id": "f1", "user_id": MOCK_USER_ID, "name": "Internet", "amount": 100, "category": "Servicios"},
        ]
        mock_supa = MagicMock()
        table = self._build_table(list_data=list_data)

        def table_side(name):
            if name == "fixed_expenses":
                return table
            return MagicMock()

        mock_supa.table.side_effect = table_side
        monkeypatch.setattr(finances_module, "supabase", mock_supa)

        client = TestClient(app)
        resp = client.get("/api/v1/fixed-expenses")
        assert resp.status_code == 200
        assert resp.json()["fixed_expenses"][0]["user_id"] == MOCK_USER_ID
        # Verificamos filtro user_id
        eq_chain = table.select.return_value.eq
        assert eq_chain.call_args.args == ("user_id", MOCK_USER_ID)

    def test_create_fixed_expense_success(self, monkeypatch):
        created = {"id": "f2", "user_id": MOCK_USER_ID, "name": "Internet", "amount": 120, "category": "Servicios"}
        mock_supa = MagicMock()
        table = self._build_table(insert_data=[created])

        def table_side(name):
            if name == "fixed_expenses":
                return table
            return MagicMock()

        mock_supa.table.side_effect = table_side
        monkeypatch.setattr(finances_module, "supabase", mock_supa)

        client = TestClient(app)
        resp = client.post(
            "/api/v1/fixed-expenses",
            json={"name": "Internet", "amount": 120, "due_date": "2026-02-01"},
        )
        assert resp.status_code == 200, resp.text
        payload = table.insert.call_args[0][0]
        assert payload["user_id"] == MOCK_USER_ID
        assert payload["amount"] == 120
        assert payload["due_date"] == "2026-02-01"

    def test_create_fixed_expense_validates_amount(self, monkeypatch):
        mock_supa = MagicMock()
        table = self._build_table()
        monkeypatch.setattr(finances_module, "supabase", mock_supa)
        monkeypatch.setattr(finances_module, "supabase", mock_supa)

        client = TestClient(app)
        resp = client.post(
            "/api/v1/fixed-expenses",
            json={"name": "x", "amount": -5},
        )
        assert resp.status_code == 422, resp.text

    def test_update_fixed_expense_includes_user_id_filter(self, monkeypatch):
        updated = {"id": "f1", "user_id": MOCK_USER_ID, "amount": 200}
        mock_supa = MagicMock()
        table = self._build_table(update_data=[updated])

        def table_side(name):
            if name == "fixed_expenses":
                return table
            return MagicMock()

        mock_supa.table.side_effect = table_side
        monkeypatch.setattr(finances_module, "supabase", mock_supa)

        client = TestClient(app)
        resp = client.put(
            "/api/v1/fixed-expenses/f1",
            json={"amount": 200},
        )
        assert resp.status_code == 200, resp.text
        # update(...).eq("id", "f1").eq("user_id", uid)
        eq_user = table.update.return_value.eq.return_value.eq
        assert eq_user.call_args.args == ("user_id", MOCK_USER_ID)

    def test_delete_fixed_expense_not_found(self, monkeypatch):
        mock_supa = MagicMock()
        table = self._build_table(delete_data=[])

        def table_side(name):
            if name == "fixed_expenses":
                return table
            return MagicMock()

        mock_supa.table.side_effect = table_side
        monkeypatch.setattr(finances_module, "supabase", mock_supa)

        client = TestClient(app)
        resp = client.delete("/api/v1/fixed-expenses/nope")
        assert resp.status_code == 404, resp.text

    def test_delete_fixed_expense_filters_user(self, monkeypatch):
        mock_supa = MagicMock()
        table = self._build_table(delete_data=[{"id": "f1", "user_id": MOCK_USER_ID}])

        def table_side(name):
            if name == "fixed_expenses":
                return table
            return MagicMock()

        mock_supa.table.side_effect = table_side
        monkeypatch.setattr(finances_module, "supabase", mock_supa)

        client = TestClient(app)
        resp = client.delete("/api/v1/fixed-expenses/f1")
        assert resp.status_code == 200
        # delete().eq("id", id).eq("user_id", uid)
        eq_user = table.delete.return_value.eq.return_value.eq
        assert eq_user.call_args.args == ("user_id", MOCK_USER_ID)


# --- Tests: budget -----------------------------------------------------------

class TestBudget:
    def test_set_budget_fails_if_profile_missing(self, monkeypatch):
        mock_supa = MagicMock()
        profiles_table = MagicMock()

        select_chain = MagicMock()
        select_chain.execute.return_value = MagicMock(data=[])
        profiles_table.select.return_value.eq.return_value.limit.return_value = select_chain

        def table_side(name):
            if name == "profiles":
                return profiles_table
            return MagicMock()

        mock_supa.table.side_effect = table_side
        monkeypatch.setattr(finances_module, "supabase", mock_supa)

        client = TestClient(app)
        resp = client.put("/api/v1/budget", json={"monthly_budget": 1000000})
        assert resp.status_code == 404, resp.text
        body = resp.json()
        assert "perfil" in body.get("detail", "").lower() or "no encontrado" in body.get("detail", "").lower()
        # No se llama a update
        profiles_table.update.assert_not_called()

    def test_set_budget_success_when_profile_exists(self, monkeypatch):
        mock_supa = MagicMock()
        profiles_table = MagicMock()

        select_chain = MagicMock()
        select_chain.execute.return_value = MagicMock(data=[{"user_id": MOCK_USER_ID}])
        profiles_table.select.return_value.eq.return_value.limit.return_value = select_chain

        update_chain = MagicMock()
        update_chain.execute.return_value = MagicMock(data=[{"user_id": MOCK_USER_ID, "monthly_budget": 1500000}])
        profiles_table.update.return_value.eq.return_value = update_chain

        def table_side(name):
            if name == "profiles":
                return profiles_table
            return MagicMock()

        mock_supa.table.side_effect = table_side
        monkeypatch.setattr(finances_module, "supabase", mock_supa)

        client = TestClient(app)
        resp = client.put("/api/v1/budget", json={"monthly_budget": 1500000})
        assert resp.status_code == 200, resp.text
        assert resp.json()["monthly_budget"] == 1500000

    def test_set_budget_rejects_negative_amount(self, monkeypatch):
        mock_supa = MagicMock()
        monkeypatch.setattr(finances_module, "supabase", mock_supa)

        client = TestClient(app)
        resp = client.put("/api/v1/budget", json={"monthly_budget": -10})
        assert resp.status_code == 422, resp.text

    def test_get_budget_defaults_to_zero_if_no_profile(self, monkeypatch):
        mock_supa = MagicMock()
        profiles_table = MagicMock()
        select_chain = MagicMock()
        select_chain.execute.return_value = MagicMock(data=[])
        profiles_table.select.return_value.eq.return_value.limit.return_value = select_chain

        def table_side(name):
            if name == "profiles":
                return profiles_table
            return MagicMock()

        mock_supa.table.side_effect = table_side
        monkeypatch.setattr(finances_module, "supabase", mock_supa)

        client = TestClient(app)
        resp = client.get("/api/v1/budget")
        assert resp.status_code == 200
        assert resp.json()["monthly_budget"] == 0