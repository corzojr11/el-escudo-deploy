"use server";

import { revalidatePath } from "next/cache";
import { fetchFromBackend, postToBackend, putToBackend, deleteFromBackend } from "@/lib/api/server";
import type { Habit } from "@/lib/api/types";

interface HabitsResponse {
  data: Habit[];
  limit: number;
  offset: number;
}

interface CreateHabitBackendResponse {
  habit: Habit;
}

interface ToggleHabitBackendResponse {
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

export interface UpdateHabitResult {
  success: boolean;
  error?: string;
}

export async function updateHabit(
  _prevState: UpdateHabitResult | null,
  formData: FormData
): Promise<UpdateHabitResult> {
  const habitId = (formData.get("habit_id") as string) || "";
  const name = (formData.get("name") as string) || "";
  const frequency = (formData.get("frequency") as string) || "";

  if (!habitId) {
    return { success: false, error: "No se seleccionó un hábito." };
  }

  const payload: Record<string, unknown> = {};
  if (name.trim()) payload.name = name.trim();
  if (frequency === "daily" || frequency === "weekly") payload.frequency = frequency;

  if (Object.keys(payload).length === 0) {
    return { success: false, error: "No hay campos para actualizar." };
  }

  try {
    await putToBackend(`/api/v1/habits/${habitId}`, payload);
    revalidatePath("/habitos");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al actualizar el hábito",
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
  const markDone = (formData.get("mark_done") as string) === "true";
  const date = (formData.get("date") as string) || undefined;

  if (!habitId) {
    return { success: false, error: "No se seleccionó un hábito." };
  }

  try {
    const res = await postToBackend<ToggleHabitBackendResponse>(
      `/api/v1/habits/${habitId}/toggle`,
      { mark_done: markDone, date }
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

export async function deleteHabit(habitId: string): Promise<UpdateHabitResult> {
  if (!habitId) {
    return { success: false, error: "No se seleccionó un hábito." };
  }
  try {
    await deleteFromBackend(`/api/v1/habits/${habitId}`);
    revalidatePath("/habitos");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al eliminar el hábito",
    };
  }
}
