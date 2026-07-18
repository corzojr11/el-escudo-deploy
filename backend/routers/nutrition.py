import asyncio
import json
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from auth import get_current_user
from database import supabase
from exceptions import ApiException, NotFoundException
from services.deepseek import complete_chat, is_configured

router = APIRouter()


class RecipeRequest(BaseModel):
    meal: str = Field(default="comida", min_length=3, max_length=30)
    ingredients: str = Field(default="", max_length=500)
    minutes: int = Field(default=25, ge=10, le=90)


class RecipeContent(BaseModel):
    name: str = Field(..., min_length=3, max_length=120)
    calories: int = Field(..., ge=100, le=2500)
    protein_g: int = Field(..., ge=0, le=250)
    prep_minutes: int = Field(..., ge=1, le=180)
    ingredients: list[str] = Field(..., min_length=1, max_length=30)
    steps: list[str] = Field(..., min_length=1, max_length=12)
    why: str = Field(..., min_length=3, max_length=500)


class FavoriteRecipePayload(BaseModel):
    recipe: RecipeContent


class MealPlanDay(BaseModel):
    day: str = Field(..., min_length=3, max_length=20)
    breakfast: str = Field(default="", max_length=120)
    lunch: str = Field(default="", max_length=120)
    dinner: str = Field(default="", max_length=120)
    snack: str = Field(default="", max_length=120)


class WeeklyMealPlanPayload(BaseModel):
    days: list[MealPlanDay] = Field(..., min_length=7, max_length=7)


def _current_week_start() -> date:
    today = datetime.now(ZoneInfo("America/Bogota")).date()
    return today - timedelta(days=today.weekday())


@router.post("/api/v1/nutrition/recipe")
async def generate_recipe(payload: RecipeRequest, user=Depends(get_current_user)):
    profile_result = await asyncio.to_thread(
        lambda: supabase.table("profiles").select("health_goal, height_cm").eq("user_id", user.id).maybe_single().execute()
    )
    weight_result = await asyncio.to_thread(
        lambda: supabase.table("weight_logs").select("weight, date").eq("user_id", user.id).order("date", desc=True).limit(1).execute()
    )
    profile = profile_result.data or {}
    weight_rows = weight_result.data or []
    weight = weight_rows[0].get("weight") if weight_rows else None
    goal = profile.get("health_goal") or "ganar_musculo"

    if not is_configured():
        return {
            "recipe": {
                "name": "Avena proteica con banano y mani",
                "calories": 650,
                "protein_g": 32,
                "prep_minutes": 10,
                "ingredients": ["100 g avena", "300 ml leche entera", "120 g banano pelado", "30 g mani", "2 huevos (100 g sin cascara)"],
                "steps": ["Pon la leche y la avena en una olla a fuego medio. Revuelve 5 a 7 minutos hasta que este cremosa.", "Pela y corta el banano en rodajas; pesa el mani.", "Cocina los huevos en una sarten a fuego medio-bajo 2 a 3 minutos por lado, hasta que la clara no se vea transparente.", "Sirve la avena con banano y mani, y acompana con los huevos."],
                "why": "Opcion practica de alta energia para apoyar el aumento de peso.",
            },
            "fallback": True,
        }


    prompt = (
        "Genera UNA receta casera colombiana o latinoamericana, segura y realista. "
        f"Objetivo: {goal}; ultimo peso: {weight or 'no registrado'} kg; tipo de comida: {payload.meal}; "
        f"ingredientes disponibles: {payload.ingredients or 'comunes y economicos'}; maximo {payload.minutes} minutos. "
        "Para ganar musculo/peso prioriza proteina y energia sin prometer resultados. "
        "Cada ingrediente DEBE incluir cantidad en gramos o mililitros, incluso huevos (ej. 2 huevos, 100 g). "
        "Escribe pasos para una persona sin experiencia: indica fuego, minutos, orden y una senal visible de que cada alimento esta cocido. "
        "Responde JSON con name, calories (numero aproximado), protein_g (numero aproximado), prep_minutes, "
        "ingredients (lista de strings con gramos), steps (lista de 4 a 7 strings detallados) y why (una frase)."
    )
    try:
        response = await complete_chat([{"role": "system", "content": "Eres un asistente de cocina practica. No das consejo medico."}, {"role": "user", "content": prompt}], json_output=True, temperature=0.5, max_tokens=450)
        recipe = json.loads(response["text"])
        if not isinstance(recipe.get("name"), str) or not isinstance(recipe.get("ingredients"), list) or not isinstance(recipe.get("steps"), list):
            raise ValueError("Formato de receta invalido")
        return {"recipe": recipe, "fallback": False}
    except Exception:
        return {
            "recipe": {
                "name": "Arroz con pollo, huevo y aguacate",
                "calories": 780,
                "protein_g": 45,
                "prep_minutes": 25,
                "ingredients": ["90 g arroz crudo", "180 g pollo crudo sin hueso", "2 huevos (100 g sin cascara)", "80 g aguacate", "100 g verduras picadas", "10 g aceite"],
                "steps": ["Lava el arroz y cocina 90 g con 180 ml de agua: cuando hierva, tapa y deja a fuego minimo 15 minutos.", "Corta el pollo en cubos. Cocina con el aceite en una sarten a fuego medio 8 a 10 minutos, hasta que no se vea rosado por dentro.", "Agrega verduras y cocina 4 minutos hasta que esten calientes y suaves.", "En otro espacio de la sarten cocina los huevos revolviendo 2 minutos, hasta que no haya partes liquidas.", "Sirve arroz, pollo con verduras, huevos y 80 g de aguacate."],
                "why": "Combina carbohidrato, proteina y grasas para una comida completa.",
            },
            "fallback": True,
        }


@router.get("/api/v1/nutrition/favorites")
async def list_favorite_recipes(user=Depends(get_current_user)):
    result = await asyncio.to_thread(
        lambda: supabase.table("nutrition_favorites").select("*").eq("user_id", user.id).order("created_at", desc=True).execute()
    )
    return {"favorites": result.data or []}


@router.post("/api/v1/nutrition/favorites")
async def save_favorite_recipe(payload: FavoriteRecipePayload, user=Depends(get_current_user)):
    record = {
        "user_id": user.id,
        "name": payload.recipe.name,
        "recipe": payload.recipe.model_dump(),
    }
    result = await asyncio.to_thread(lambda: supabase.table("nutrition_favorites").insert(record).execute())
    if not result.data:
        raise ApiException(status_code=500, detail="No se pudo guardar la receta.")
    return {"favorite": result.data[0]}


@router.delete("/api/v1/nutrition/favorites/{favorite_id}")
async def delete_favorite_recipe(favorite_id: str, user=Depends(get_current_user)):
    exists = await asyncio.to_thread(
        lambda: supabase.table("nutrition_favorites").select("id").eq("id", favorite_id).eq("user_id", user.id).limit(1).execute()
    )
    if not exists.data:
        raise NotFoundException("Receta guardada")
    await asyncio.to_thread(
        lambda: supabase.table("nutrition_favorites").delete().eq("id", favorite_id).eq("user_id", user.id).execute()
    )
    return {"detail": "Receta eliminada."}


@router.get("/api/v1/nutrition/weekly-plan")
async def get_weekly_meal_plan(
    week_start: date | None = Query(default=None),
    user=Depends(get_current_user),
):
    start = week_start or _current_week_start()
    result = await asyncio.to_thread(
        lambda: supabase.table("nutrition_weekly_plans").select("*").eq("user_id", user.id).eq("week_start", start.isoformat()).maybe_single().execute()
    )
    return {"plan": result.data, "week_start": start.isoformat()}


@router.put("/api/v1/nutrition/weekly-plan")
async def save_weekly_meal_plan(payload: WeeklyMealPlanPayload, user=Depends(get_current_user)):
    start = _current_week_start()
    record = {"user_id": user.id, "week_start": start.isoformat(), "days": [day.model_dump() for day in payload.days]}
    result = await asyncio.to_thread(
        lambda: supabase.table("nutrition_weekly_plans").upsert(record, on_conflict="user_id,week_start").execute()
    )
    if not result.data:
        raise ApiException(status_code=500, detail="No se pudo guardar el plan semanal.")
    return {"plan": result.data[0]}
