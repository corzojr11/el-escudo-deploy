"use server";

import { revalidatePath } from "next/cache";
import { fetchFromBackend, postToBackend, putToBackend } from "@/lib/api/server";
import type { Habit } from "@/lib/api/types";

interface HabitsResponse {
  data: Habit[];
  limit: number;
  offset: number;
}

interface CreateHabitBackendResponse {
  habit: Habit;
}

interface UpdateHabitBackendResponse {
  habit: Habit;
  xp_gained?: number;
}

export async function getHabits(): Promise<Habit[]> {
  const res = await fetchFromBackend<HabitsResponse>("/api/v1/habits");
  return res.data ?? [];
}

export interface CreateHabitResult {
  success: boolean;
  error?: string;
}

export async function createHabit(
  _prevState: CreateHabitResult | null,
  formData: FormData
): Promise<CreateHabitResult> {
  const name = (formData.get("name") as string) || "";
  const frequency = (formData.get("frequency") as string) || "daily";

  if (!name.trim()) {
    return { success: false, error: "El nombre del hábito es obligatorio." };
  }

  try {
    await postToBackend<CreateHabitBackendResponse>("/api/v1/habits", {
      name: name.trim(),
      frequency,
    });
    revalidatePath("/habitos");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al crear el hábito",
    };
  }
}

export interface ToggleHabitResult {
  success: boolean;
  error?: string;
  xpGained?: number;
}

export async function toggleHabitToday(
  _prevState: ToggleHabitResult | null,
  formData: FormData
): Promise<ToggleHabitResult> {
  const habitId = (formData.get("habit_id") as string) || "";
  const completedDatesRaw = (formData.get("completed_dates") as string) || "[]";
  const markDone = (formData.get("mark_done") as string) === "true";

  if (!habitId) {
    return { success: false, error: "No se seleccionó un hábito." };
  }

  let completedDates: string[];
  try {
    completedDates = JSON.parse(completedDatesRaw);
  } catch {
    completedDates = [];
  }

  const today = new Date().toISOString().split("T")[0];

  const newDates = markDone
    ? Array.from(new Set([...completedDates, today]))
    : completedDates.filter((d) => d !== today);

  try {
    const res = await putToBackend<UpdateHabitBackendResponse>(
      `/api/v1/habits/${habitId}`,
      { completed_dates: newDates }
    );
    revalidatePath("/habitos");
    revalidatePath("/");
    return { success: true, xpGained: res.xp_gained };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al actualizar el hábito",
    };
  }
}
