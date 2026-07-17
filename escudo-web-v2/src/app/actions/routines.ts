"use server";

import { fetchFromBackend, putToBackend, deleteFromBackend } from "@/lib/api/server";
import type { Routine } from "@/lib/api/types";
import { revalidatePath } from "next/cache";

export async function getRoutines(): Promise<Routine[]> {
  const res = await fetchFromBackend<{ routines: Routine[] }>("/api/v1/routines");
  return res.routines ?? [];
}

export async function saveRoutineDay(
  dayIndex: number,
  data: {
    day_name: string;
    objective?: string;
    estimated_minutes?: number;
    notes?: string[];
    exercises: { name: string; suggestedSets: number; suggestedReps: string; equipment?: string[]; muscles?: string[] }[];
  }
): Promise<{ routine: Routine }> {
  const result = await putToBackend<{ routine: Routine }>(`/api/v1/routines/${dayIndex}`, data);
  revalidatePath("/rutinas");
  revalidatePath("/salud");
  revalidatePath("/");
  return result;
}

export async function deleteRoutineDay(dayIndex: number): Promise<void> {
  await deleteFromBackend(`/api/v1/routines/${dayIndex}`);
  revalidatePath("/rutinas");
  revalidatePath("/salud");
  revalidatePath("/");
}
