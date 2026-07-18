"use server";

import { postToBackend } from "@/lib/api/server";
import type { NutritionRecipe } from "@/lib/api/types";

export async function generateRecipe(data: { meal: string; ingredients: string; minutes: number }): Promise<{ recipe: NutritionRecipe; fallback: boolean }> {
  return postToBackend<{ recipe: NutritionRecipe; fallback: boolean }>("/api/v1/nutrition/recipe", data);
}
