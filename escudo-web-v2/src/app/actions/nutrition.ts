"use server";

import { deleteFromBackend, fetchFromBackend, postToBackend, putToBackend } from "@/lib/api/server";
import type { NutritionFavorite, NutritionMealPlanDay, NutritionRecipe, NutritionWeeklyPlan } from "@/lib/api/types";

export async function generateRecipe(data: { meal: string; ingredients: string; minutes: number }): Promise<{ recipe: NutritionRecipe; fallback: boolean }> {
  return postToBackend<{ recipe: NutritionRecipe; fallback: boolean }>("/api/v1/nutrition/recipe", data);
}

export async function getNutritionFavorites(): Promise<NutritionFavorite[]> {
  const response = await fetchFromBackend<{ favorites: NutritionFavorite[] }>("/api/v1/nutrition/favorites");
  return response.favorites;
}

export async function saveNutritionFavorite(recipe: NutritionRecipe): Promise<NutritionFavorite> {
  const response = await postToBackend<{ favorite: NutritionFavorite }>("/api/v1/nutrition/favorites", { recipe });
  return response.favorite;
}

export async function deleteNutritionFavorite(id: string): Promise<void> {
  await deleteFromBackend(`/api/v1/nutrition/favorites/${id}`);
}

export async function getNutritionWeeklyPlan(): Promise<NutritionWeeklyPlan | null> {
  const response = await fetchFromBackend<{ plan: NutritionWeeklyPlan | null }>("/api/v1/nutrition/weekly-plan");
  return response.plan;
}

export async function saveNutritionWeeklyPlan(days: NutritionMealPlanDay[]): Promise<NutritionWeeklyPlan> {
  const response = await putToBackend<{ plan: NutritionWeeklyPlan }>("/api/v1/nutrition/weekly-plan", { days });
  return response.plan;
}
