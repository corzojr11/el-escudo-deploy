"""Tests de Fase 2: dashboard /today, turnos robustos y finanzas idempotentes."""

import sys
import asyncio
from datetime import datetime
from unittest.mock import MagicMock

sys.modules["google.genai"] = MagicMock()
sys.modules["sentry_sdk"] = MagicMock()
sys.modules["sentry_sdk.integrations.fastapi"] = MagicMock(FastApiIntegration=MagicMock())

import pytest
from fastapi.testclient import TestClient

from auth import get_current_user
from main import app
from routers import sync as sync_module
from routers import schedule as schedule_module
from routers import finances as finances_module

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


class TableResult:
    def __init__(self, data):
        self.data = data


def _chain_with_result(data):
    chain = MagicMock()
    chain.execute.return_value = TableResult(data)
    return chain


# ─── Schedule / current-status ────────────────────────────────────────────

class TestScheduleStatus:
    def test_compute_current_status_active_shift(self):
        now = datetime(2026, 7, 16, 14, 0, 0)  # Jueves 14:00
        shifts = [{"id": "1", "day": "Jueves", "start": "08:00", "end": "17:00"}]
        status = schedule_module.compute_current_status(shifts, now)
        assert status["status"] == "in_shift"
        assert status["shift"]["remaining_hours"] == 3.0

    def test_compute_current_status_next_shift_tomorrow(self):
        now = datetime(2026, 7, 16, 22, 0, 0)  # Jueves 22:00
        shifts = [
            {"id": "1", "day": "Jueves", "start": "08:00", "end": "17:00"},
            {"id": "2", "day": "Viernes", "start": "09:00", "end": "18:00"},
        ]
        status = schedule_module.compute_current_status(shifts, now)
        assert status["status"] == "free"
        assert status["next_shift"]["day"] == "Viernes"
        assert status["next_shift"]["starts_in_hours"] == 11.0

    def test_compute_current_status_overnight_shift(self):
        now = datetime(2026, 7, 16, 23, 30, 0)  # Jueves 23:30
        shifts = [{"id": "1", "day": "Jueves", "start": "22:00", "end": "02:00"}]
        status = schedule_module.compute_current_status(shifts, now)
        assert status["status"] == "in_shift"
        assert status["shift"]["end"] == "02:00"
        # 2.5h restantes hasta las 02:00
        assert status["shift"]["remaining_hours"] == 2.5

    def test_compute_current_status_overnight_next_day_morning(self):
        # Viernes 01:00: el turno Jueves 22:00-02:00 aún está activo
        now = datetime(2026, 7, 17, 1, 0, 0)
        shifts = [{"id": "1", "day": "Jueves", "start": "22:00", "end": "02:00"}]
        status = schedule_module.compute_current_status(shifts, now)
        assert status["status"] == "in_shift"
        assert status["shift"]["day"] == "Jueves"
        assert status["shift"]["end"] == "02:00"
        # 1h restante
        assert status["shift"]["remaining_hours"] == 1.0

    def test_compute_current_status_sunday_to_monday(self):
        # Domingo 23:00 -> próximo turno es Lunes 08:00 (9h)
        now = datetime(2026, 7, 19, 23, 0, 0)  # Domingo
        shifts = [{"id": "1", "day": "Lunes", "start": "08:00", "end": "17:00"}]
        status = schedule_module.compute_current_status(shifts, now)
        assert status["status"] == "free"
        assert status["next_shift"]["day"] == "Lunes"
        assert status["next_shift"]["starts_in_hours"] == 9.0

    def test_compute_current_status_accented_wednesday(self):
        now = datetime(2026, 7, 15, 14, 0, 0)  # Miércoles
        shifts = [{"id": "1", "day": "Miércoles", "start": "08:00", "end": "17:00"}]
        status = schedule_module.compute_current_status(shifts, now)
        assert status["status"] == "in_shift"
        assert status["shift"]["remaining_hours"] == 3.0

    def test_compute_current_status_no_shifts(self):
        status = schedule_module.compute_current_status([], datetime.now())
        assert status["status"] == "free"
        assert "Sin turnos" in status["message_short"]


# ─── /today endpoint ───────────────────────────────────────────────────────

class TestTodayEndpoint:
    def _build_today_supabase(self):
        mock_supa = MagicMock()

        profiles = MagicMock()
        profiles.select.return_value.eq.return_value.execute.return_value = TableResult(
            [{"name": "Dairo", "level": 3, "xp": 250, "xp_to_next_level": 500}]
        )

        finances = MagicMock()
        finances.select.return_value.eq.return_value.eq.return_value.order.return_value.execute.return_value = TableResult(
            [{"id": "f1", "amount": 50000, "type": "INGRESO", "category": "Sueldo", "date": "2026-07-16", "description": "Pago"}]
        )

        shifts = MagicMock()
        shifts.select.return_value.eq.return_value.eq.return_value.execute.return_value = TableResult(
            [{"id": "s1", "day": "Jueves", "start": "08:00", "end": "17:00"}]
        )

        goals = MagicMock()
        goals.select.return_value.eq.return_value.neq.return_value.execute.return_value = TableResult(
            [{"id": "g1", "name": "Bajar de peso", "status": "active"}]
        )

        missions = MagicMock()
        missions.select.return_value.eq.return_value.or_.return_value.execute.return_value = TableResult(
            [{"id": "m1", "title": "Entrenar", "status": "active", "schedule_date": "2026-07-16"}]
        )

        weight = MagicMock()
        weight.select.return_value.eq.return_value.order.return_value.order.return_value.limit.return_value.execute.return_value = TableResult(
            [{"id": "w1", "weight": 78.4, "date": "2026-07-16"}]
        )

        focus = MagicMock()
        focus.select.return_value.eq.return_value.limit.return_value.execute.return_value = TableResult(
            [{"focus_streak": 5, "focus_best": 10}]
        )

        def table_side(name):
            return {
                "profiles": profiles,
                "finances": finances,
                "shifts": shifts,
                "goals": goals,
                "missions": missions,
                "weight_logs": weight,
                "focus_status": focus,
            }.get(name, MagicMock())

        mock_supa.table.side_effect = table_side
        return mock_supa

    def test_today_returns_required_fields(self, monkeypatch):
        mock_supa = self._build_today_supabase()
        monkeypatch.setattr(sync_module, "supabase", mock_supa)
        monkeypatch.setattr(sync_module, "track_event", lambda **kwargs: asyncio.sleep(0))
        monkeypatch.setattr(schedule_module, "_bogota_now", lambda: datetime(2026, 7, 16, 14, 0, 0))

        client = TestClient(app)
        resp = client.get("/api/v1/today")
        assert resp.status_code == 200
        data = resp.json()
        assert data["profile"]["name"] == "Dairo"
        assert data["today"]["date"]
        assert data["today"]["balance"] == 50000
        assert data["today"]["shift_status"]["status"] == "in_shift"
        assert len(data["today"]["active_goals"]) == 1
        assert len(data["today"]["missions_today"]) == 1
        assert data["today"]["latest_weight"]["weight"] == 78.4
        assert data["today"]["focus_streak"] == 5


# ─── Finances idempotency + filters ─────────────────────────────────────────

class TestFinancesFase2:
    def _build_finances_supabase(self):
        stored = []
        mock_supa = MagicMock()

        def table_side(name):
            tbl = MagicMock()
            if name == "finances":
                def insert_execute():
                    args, _ = tbl.insert.call_args
                    payload = args[0] if args else {}
                    key = payload.get("idempotency_key")
                    if key:
                        for row in stored:
                            if row.get("idempotency_key") == key and row.get("user_id") == MOCK_USER_ID:
                                err = Exception("duplicate key value violates unique constraint \"idx_finances_user_idempotency_unique\"")
                                err.code = "23505"
                                raise err
                    payload["id"] = f"fin-{len(stored) + 1}"
                    stored.append(payload)
                    return TableResult([payload])

                insert_chain = MagicMock()
                insert_chain.execute.side_effect = insert_execute
                tbl.insert.return_value = insert_chain

                def select_execute():
                    eq_calls = getattr(tbl, "_eq_calls", [])
                    filters = {}
                    for args, kwargs in eq_calls:
                        filters[args[0]] = args[1]
                    matches = [
                        row for row in stored
                        if ("user_id" not in filters or row.get("user_id") == filters["user_id"])
                        and ("idempotency_key" not in filters or row.get("idempotency_key") == filters["idempotency_key"])
                        and ("date" not in filters or row.get("date") == filters["date"])
                    ]
                    return TableResult(matches)

                def select_side(cols):
                    sel = MagicMock()

                    def eq_side(col, val):
                        if not hasattr(tbl, "_eq_calls"):
                            tbl._eq_calls = []
                        tbl._eq_calls.append(((col, val), {}))
                        return sel

                    def gte_side(col, val):
                        if not hasattr(tbl, "_gte_calls"):
                            tbl._gte_calls = []
                        tbl._gte_calls.append(((col, val), {}))
                        return sel

                    def lte_side(col, val):
                        if not hasattr(tbl, "_lte_calls"):
                            tbl._lte_calls = []
                        tbl._lte_calls.append(((col, val), {}))
                        return sel

                    sel.eq.side_effect = eq_side
                    sel.gte.side_effect = gte_side
                    sel.lte.side_effect = lte_side
                    sel.order.return_value = sel
                    sel.limit.return_value = sel
                    sel.execute.side_effect = select_execute
                    return sel

                tbl.select.side_effect = select_side

                def update_execute():
                    args, _ = tbl.update.call_args
                    payload = args[0] if args else {}
                    for row in stored:
                        if row.get("user_id") == MOCK_USER_ID:
                            row.update(payload)
                            return TableResult([row])
                    return TableResult([])

                update_chain = MagicMock()
                update_chain.eq.return_value = update_chain
                update_chain.execute.side_effect = update_execute
                tbl.update.return_value = update_chain

                def delete_execute():
                    for i, row in enumerate(stored):
                        if row.get("user_id") == MOCK_USER_ID:
                            deleted = {"id": row.get("id")}
                            del stored[i]
                            return TableResult([deleted])
                    return TableResult([])

                delete_chain = MagicMock()
                delete_chain.eq.return_value = delete_chain
                delete_chain.execute.side_effect = delete_execute
                tbl.delete.return_value = delete_chain

            return tbl

        mock_supa.table.side_effect = table_side
        return mock_supa, stored

    def test_add_finance_stores_date_and_idempotency_key(self, monkeypatch):
        mock_supa, stored = self._build_finances_supabase()
        monkeypatch.setattr(finances_module, "supabase", mock_supa)

        client = TestClient(app)
        resp = client.post("/api/v1/finances", json={
            "description": "Mercado",
            "amount": 25000,
            "category": "Alimentación",
            "type": "GASTO",
            "date": "2026-07-16",
            "idempotency_key": "key-abc",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["date"] == "2026-07-16"
        assert data["idempotency_key"] == "key-abc"
        assert data["type"] == "GASTO"

    def test_add_finance_is_idempotent_by_key(self, monkeypatch):
        mock_supa, stored = self._build_finances_supabase()
        monkeypatch.setattr(finances_module, "supabase", mock_supa)

        client = TestClient(app)
        payload = {
            "description": "Mercado",
            "amount": 25000,
            "category": "Alimentación",
            "type": "GASTO",
            "date": "2026-07-16",
            "idempotency_key": "key-duplicate",
        }
        r1 = client.post("/api/v1/finances", json=payload)
        r2 = client.post("/api/v1/finances", json=payload)
        assert r1.status_code == 200
        assert r2.status_code == 200
        assert r1.json()["id"] == r2.json()["id"]
        assert len(stored) == 1

    def test_update_finance_changes_date(self, monkeypatch):
        mock_supa, stored = self._build_finances_supabase()
        monkeypatch.setattr(finances_module, "supabase", mock_supa)

        client = TestClient(app)
        created = client.post("/api/v1/finances", json={
            "description": "Cena",
            "amount": 30000,
            "category": "Comida",
            "type": "GASTO",
            "date": "2026-07-16",
        }).json()

        updated = client.put(f"/api/v1/finances/{created['id']}", json={
            "date": "2026-07-15",
            "amount": 35000,
        }).json()
        assert updated["finance"]["date"] == "2026-07-15"
        assert updated["finance"]["amount"] == 35000

    def test_list_finances_with_range_today(self, monkeypatch):
        mock_supa, stored = self._build_finances_supabase()
        monkeypatch.setattr(finances_module, "supabase", mock_supa)
        # Simular turnos almacenados con user_id
        today = finances_module._today_str()
        stored.append({
            "id": "fin-x", "user_id": MOCK_USER_ID, "amount": 10000,
            "type": "GASTO", "category": "Transporte", "date": today,
        })

        client = TestClient(app)
        resp = client.get("/api/v1/finances?range=today")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["finances"]) >= 1

    def test_finance_summary_returns_totals(self, monkeypatch):
        mock_supa, stored = self._build_finances_supabase()
        monkeypatch.setattr(finances_module, "supabase", mock_supa)
        today = finances_module._today_str()
        stored.append({"id": "a", "user_id": MOCK_USER_ID, "amount": 100000, "type": "INGRESO", "category": "Sueldo", "date": today})
        stored.append({"id": "b", "user_id": MOCK_USER_ID, "amount": 30000, "type": "GASTO", "category": "Comida", "date": today})

        client = TestClient(app)
        resp = client.get("/api/v1/finances/summary?range=today")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_income"] == 100000
        assert data["total_expense"] == 30000
        assert data["balance"] == 70000

    def test_delete_finance_returns_neutral_message(self, monkeypatch):
        mock_supa, stored = self._build_finances_supabase()
        monkeypatch.setattr(finances_module, "supabase", mock_supa)
        stored.append({"id": "del-1", "user_id": MOCK_USER_ID, "amount": 1000, "type": "INGRESO", "category": "A", "date": "2026-07-16"})

        client = TestClient(app)
        resp = client.delete("/api/v1/finances/del-1")
        assert resp.status_code == 200
        assert "Movimiento" in resp.json()["detail"]
        assert len(stored) == 0

    def test_add_finance_concurrent_idempotency_returns_existing_row(self, monkeypatch):
        """Simula un conflicto de clave única: la segunda solicitud recupera la fila existente."""
        mock_supa, stored = self._build_finances_supabase()
        monkeypatch.setattr(finances_module, "supabase", mock_supa)

        client = TestClient(app)
        payload = {
            "description": "Transporte",
            "amount": 12000,
            "category": "Transporte",
            "type": "GASTO",
            "date": "2026-07-16",
            "idempotency_key": "concurrent-finance-key",
        }
        r1 = client.post("/api/v1/finances", json=payload)
        assert r1.status_code == 200
        r2 = client.post("/api/v1/finances", json=payload)
        assert r2.status_code == 200
        assert r1.json()["id"] == r2.json()["id"]
        assert len(stored) == 1


# ─── Shifts idempotency ───────────────────────────────────────────────────

class TestShiftsFase2:
    def _build_shifts_supabase(self):
        stored = []
        mock_supa = MagicMock()

        def table_side(name):
            tbl = MagicMock()
            if name == "shifts":
                def insert_execute():
                    args, _ = tbl.insert.call_args
                    payload = args[0] if args else {}
                    key = payload.get("idempotency_key")
                    if key:
                        for row in stored:
                            if row.get("idempotency_key") == key and row.get("user_id") == MOCK_USER_ID:
                                err = Exception("duplicate key value violates unique constraint \"idx_shifts_user_idempotency_unique\"")
                                err.code = "23505"
                                raise err
                    payload["id"] = f"shift-{len(stored) + 1}"
                    stored.append(payload)
                    return TableResult([payload])

                insert_chain = MagicMock()
                insert_chain.execute.side_effect = insert_execute
                tbl.insert.return_value = insert_chain

                def select_execute():
                    eq_calls = getattr(tbl, "_eq_calls", [])
                    filters = {}
                    for args, kwargs in eq_calls:
                        filters[args[0]] = args[1]
                    matches = [
                        row for row in stored
                        if ("user_id" not in filters or row.get("user_id") == filters["user_id"])
                        and ("idempotency_key" not in filters or row.get("idempotency_key") == filters["idempotency_key"])
                    ]
                    return TableResult(matches)

                def select_side(cols):
                    sel = MagicMock()

                    def eq_side(col, val):
                        if not hasattr(tbl, "_eq_calls"):
                            tbl._eq_calls = []
                        tbl._eq_calls.append(((col, val), {}))
                        return sel

                    sel.eq.side_effect = eq_side
                    sel.order.return_value = sel
                    sel.limit.return_value = sel
                    sel.execute.side_effect = select_execute
                    return sel

                tbl.select.side_effect = select_side

                def update_execute():
                    args, _ = tbl.update.call_args
                    payload = args[0] if args else {}
                    for row in stored:
                        if row.get("user_id") == MOCK_USER_ID:
                            row.update(payload)
                            return TableResult([row])
                    return TableResult([])

                update_chain = MagicMock()
                update_chain.eq.return_value = update_chain
                update_chain.execute.side_effect = update_execute
                tbl.update.return_value = update_chain

                def delete_execute():
                    for i, row in enumerate(stored):
                        if row.get("user_id") == MOCK_USER_ID:
                            deleted = {"id": row.get("id")}
                            del stored[i]
                            return TableResult([deleted])
                    return TableResult([])

                delete_chain = MagicMock()
                delete_chain.eq.return_value = delete_chain
                delete_chain.execute.side_effect = delete_execute
                tbl.delete.return_value = delete_chain

            return tbl

        mock_supa.table.side_effect = table_side
        return mock_supa, stored

    def test_create_shift_is_idempotent_by_key(self, monkeypatch):
        mock_supa, stored = self._build_shifts_supabase()
        monkeypatch.setattr(schedule_module, "supabase", mock_supa)

        client = TestClient(app)
        payload = {
            "day": "Viernes",
            "start": "09:00",
            "end": "18:00",
            "idempotency_key": "shift-concurrent-key",
        }
        r1 = client.post("/api/v1/shifts", json=payload)
        r2 = client.post("/api/v1/shifts", json=payload)
        assert r1.status_code == 200
        assert r2.status_code == 200
        assert r1.json()["shift"]["id"] == r2.json()["shift"]["id"]
        assert len(stored) == 1

    def test_create_shift_without_key_still_works(self, monkeypatch):
        mock_supa, stored = self._build_shifts_supabase()
        monkeypatch.setattr(schedule_module, "supabase", mock_supa)

        client = TestClient(app)
        payload = {"day": "Lunes", "start": "08:00", "end": "17:00"}
        r1 = client.post("/api/v1/shifts", json=payload)
        assert r1.status_code == 200
        assert len(stored) == 1
