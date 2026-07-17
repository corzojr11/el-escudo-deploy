"use server";

import { fetchFromBackend, postToBackend, deleteFromBackend } from "@/lib/api/server";
import type { WellnessSummary } from "@/lib/api/types";
import { revalidatePath } from "next/cache";

export async function getWellnessSummary(): Promise<WellnessSummary> {
  return fetchFromBackend<WellnessSummary>("/api/v1/wellness-summary");
}

export async function getTodayRoutineCompletions(): Promise<number[]> {
  const result = await fetchFromBackend<{ completed_days: number[] }>("/api/v1/routines/completions/today");
  return result.completed_days ?? [];
}

export async function completeRoutineDay(dayIndex: number): Promise<{ completed: boolean }> {
  const result = await postToBackend<{ completed: boolean }>(`/api/v1/routines/${dayIndex}/complete`, {});
  revalidatePath("/salud");
  revalidatePath("/rutinas");
  revalidatePath("/");
  return result;
}

export async function uncompleteRoutineDay(dayIndex: number): Promise<{ completed: boolean }> {
  const result = await deleteFromBackend<{ completed: boolean }>(`/api/v1/routines/${dayIndex}/complete`);
  revalidatePath("/salud");
  revalidatePath("/rutinas");
  revalidatePath("/");
  return result;
}
