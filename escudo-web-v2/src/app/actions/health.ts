"use server";

import { revalidatePath } from "next/cache";
import { fetchFromBackend, postToBackend, putToBackend, deleteFromBackend } from "@/lib/api/server";
import type { FocusStatus, WeightLog, ExerciseLog, PersonalRecord } from "@/lib/api/types";

interface WeightLogsResponse {
  data: WeightLog[];
  limit: number;
  offset: number;
}

interface FocusStatusResponse {
  focus_status: FocusStatus | null;
}

export async function getWeightLogs(): Promise<WeightLog[]> {
  const res = await fetchFromBackend<WeightLogsResponse>("/api/v1/weight-logs");
  return res.data ?? [];
}

export async function getFocusStatus(): Promise<FocusStatus | null> {
  const res = await fetchFromBackend<FocusStatusResponse>("/api/v1/focus/status");
  return res.focus_status ?? null;
}

export interface AddWeightResult {
  success: boolean;
  error?: string;
}

export async function addWeight(
  _prevState: AddWeightResult | null,
  formData: FormData
): Promise<AddWeightResult> {
  const weight = parseFloat(formData.get("weight") as string);
  const date = (formData.get("date") as string) || undefined;
  const notes = (formData.get("notes") as string) || undefined;

  if (Number.isNaN(weight) || weight <= 0) {
    return { success: false, error: "El peso debe ser mayor a cero." };
  }

  try {
    const idempotencyKey = `weight:${date || "today"}:${Date.now()}`;
    await postToBackend<WeightLog>("/api/v1/weight", {
      weight,
      date,
      notes: notes?.trim(),
      idempotency_key: idempotencyKey,
    });
    revalidatePath("/salud");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al registrar el peso",
    };
  }
}

export interface UpdateWeightResult {
  success: boolean;
  error?: string;
}

export async function updateWeight(
  _prevState: UpdateWeightResult | null,
  formData: FormData
): Promise<UpdateWeightResult> {
  const logId = (formData.get("log_id") as string) || "";
  const weight = parseFloat(formData.get("weight") as string);
  const date = (formData.get("date") as string) || undefined;
  const notes = (formData.get("notes") as string) || undefined;

  if (!logId) {
    return { success: false, error: "No se seleccionó un registro." };
  }
  if (Number.isNaN(weight) || weight <= 0) {
    return { success: false, error: "El peso debe ser mayor a cero." };
  }

  const payload: Record<string, unknown> = { weight };
  if (date) payload.date = date;
  if (notes !== undefined) payload.notes = notes.trim();

  try {
    await putToBackend(`/api/v1/weight-logs/${logId}`, payload);
    revalidatePath("/salud");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al actualizar el peso",
    };
  }
}

export async function deleteWeightLog(logId: string): Promise<UpdateWeightResult> {
  if (!logId) {
    return { success: false, error: "No se seleccionó un registro." };
  }
  try {
    await deleteFromBackend(`/api/v1/weight-logs/${logId}`);
    revalidatePath("/salud");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al eliminar el peso",
    };
  }
}

export async function getExerciseLogs(): Promise<ExerciseLog[]> {
  const res = await fetchFromBackend<{ logs: ExerciseLog[] }>("/api/v1/exercise-logs");
  return res.logs ?? [];
}

export async function getPersonalRecords(): Promise<PersonalRecord[]> {
  const res = await fetchFromBackend<{ records: PersonalRecord[] }>("/api/v1/personal-records");
  return res.records ?? [];
}

export async function logExercise(data: {
  exercise_name: string;
  weight: number;
  reps: number;
  sets: number;
  rpe: number;
  date?: string;
}): Promise<{ status: string; log: ExerciseLog }> {
  const result = await postToBackend<{ status: string; log: ExerciseLog }>("/api/v1/log-exercise", data);
  revalidatePath("/salud");
  revalidatePath("/rutinas");
  revalidatePath("/");
  return result;
}
