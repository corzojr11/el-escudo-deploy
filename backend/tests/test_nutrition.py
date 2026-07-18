import os
from unittest.mock import MagicMock

from fastapi.testclient import TestClient
from pydantic import ValidationError

os.environ.setdefault("GEMINI_API_KEY", "test-key")

from auth import get_current_user
from main import app
from routers import nutrition as nutrition_module

USER_ID = "11111111-1111-1111-1111-111111111111"


async def _user():
    return type("User", (), {"id": USER_ID, "aud": "authenticated"})()


app.dependency_overrides[get_current_user] = _user


class Result:
    def __init__(self, data):
        self.data = data


def test_recipe_content_requires_ingredients_and_steps():
    payload = {
        "name": "Receta valida",
        "calories": 700,
        "protein_g": 30,
        "prep_minutes": 20,
        "ingredients": [],
        "steps": [],
        "why": "Una explicacion suficiente.",
    }

    try:
        nutrition_module.RecipeContent(**payload)
    except ValidationError:
        return
    assert False, "Una receta sin ingredientes ni pasos debe rechazarse"


def test_week_start_is_monday_in_bogota():
    assert nutrition_module._current_week_start().weekday() == 0


def test_save_favorite_recipe_persists_owner(monkeypatch):
    supa = MagicMock()
    table = MagicMock()
    table.insert.return_value.execute.return_value = Result([{"id": "favorite-1", "name": "Avena", "recipe": {}}])
    supa.table.return_value = table
    monkeypatch.setattr(nutrition_module, "supabase", supa)

    response = TestClient(app).post("/api/v1/nutrition/favorites", json={"recipe": {"name": "Avena", "calories": 650, "protein_g": 30, "prep_minutes": 10, "ingredients": ["100 g avena"], "steps": ["Cocina hasta que espese."], "why": "Practica y economica."}})

    assert response.status_code == 200
    assert table.insert.call_args.args[0]["user_id"] == USER_ID


def test_save_weekly_plan_uses_user_week_key(monkeypatch):
    supa = MagicMock()
    table = MagicMock()
    table.upsert.return_value.execute.return_value = Result([{"id": "plan-1", "days": []}])
    supa.table.return_value = table
    monkeypatch.setattr(nutrition_module, "supabase", supa)

    days = [{"day": day, "breakfast": "Avena", "lunch": "Arroz", "dinner": "Lentejas", "snack": "Banano"} for day in ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"]]
    response = TestClient(app).put("/api/v1/nutrition/weekly-plan", json={"days": days})

    assert response.status_code == 200
    assert table.upsert.call_args.kwargs["on_conflict"] == "user_id,week_start"
    assert table.upsert.call_args.args[0]["user_id"] == USER_ID
