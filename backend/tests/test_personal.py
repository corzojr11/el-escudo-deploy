import os
from unittest.mock import MagicMock

from fastapi.testclient import TestClient

os.environ.setdefault("GEMINI_API_KEY", "test-key")

from auth import get_current_user
from main import app
from routers import personal as personal_module

USER_ID = "11111111-1111-1111-1111-111111111111"


async def _user():
    return type("User", (), {"id": USER_ID, "aud": "authenticated"})()


app.dependency_overrides[get_current_user] = _user


class Result:
    def __init__(self, data):
        self.data = data


def test_personal_entry_rejects_unknown_kind():
    response = TestClient(app).post("/api/v1/personal-entries", json={"kind": "unknown", "title": "x"})
    assert response.status_code == 422


def test_create_personal_entry_persists_owner_and_data(monkeypatch):
    supa = MagicMock()
    table = MagicMock()
    table.insert.return_value.execute.return_value = Result([{"id": "entry-1", "user_id": USER_ID, "kind": "reading", "title": "Libro", "data": {"current_page": 10}}])
    supa.table.return_value = table
    monkeypatch.setattr(personal_module, "supabase", supa)

    response = TestClient(app).post("/api/v1/personal-entries", json={"kind": "reading", "title": "Libro", "data": {"current_page": 10}})

    assert response.status_code == 200
    assert table.insert.call_args.args[0]["user_id"] == USER_ID
    assert response.json()["entry"]["data"]["current_page"] == 10
