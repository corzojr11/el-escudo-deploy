import asyncio
import json

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from auth import get_current_user
from database import supabase
from services.deepseek import complete_chat, is_configured

router = APIRouter()


class RecipeRequest(BaseModel):
    meal: str = Field(default="comida", min_length=3, max_length=30)
    ingredients: str = Field(default="", max_length=500)
    minutes: int = Field(default=25, ge=10, le=90)


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
                "ingredients": ["Avena", "leche", "banano", "mani o mantequilla de mani", "huevos o proteina"],
                "steps": ["Cocina la avena con leche.", "Agrega banano y mani.", "Acompanala con huevos o proteina."],
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
        "Responde JSON con name, calories (numero aproximado), protein_g (numero aproximado), prep_minutes, "
        "ingredients (lista de strings con gramos), steps (lista de 3 a 5 strings) y why (una frase)."
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
                "ingredients": ["Arroz", "pollo", "huevos", "aguacate", "verduras"],
                "steps": ["Cocina el arroz.", "Saltea el pollo y las verduras.", "Sirve con huevo y aguacate."],
                "why": "Combina carbohidrato, proteina y grasas para una comida completa.",
            },
            "fallback": True,
        }
