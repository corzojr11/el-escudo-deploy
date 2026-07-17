"use server";

import { revalidatePath } from "next/cache";
import { fetchFromBackend, postToBackend, putToBackend, deleteFromBackend } from "@/lib/api/server";
import type { Goal, Metric } from "@/lib/api/types";

interface GoalsResponse {
  goals: Goal[];
}

interface CreateGoalBackendResponse {
  goal: Goal;
}

interface CreateMetricBackendResponse {
  metric: Metric;
}

export async function getGoals(): Promise<Goal[]> {
  const res = await fetchFromBackend<GoalsResponse>("/api/v1/goals");
  return res.goals ?? [];
}

export interface CreateGoalResult {
  success: boolean;
  error?: string;
}

export async function createGoal(
  _prevState: CreateGoalResult | null,
  formData: FormData
): Promise<CreateGoalResult> {
  const name = (formData.get("name") as string) || "";
  const description = (formData.get("description") as string) || "";
  const targetValue = parseFloat(formData.get("target_value") as string);
  const unit = (formData.get("unit") as string) || "";
  const deadline = (formData.get("deadline") as string) || undefined;

  if (!name.trim()) {
    return { success: false, error: "El nombre de la meta es obligatorio." };
  }

  try {
    await postToBackend<CreateGoalBackendResponse>("/api/v1/goals", {
      name: name.trim(),
      description: description.trim(),
      goal_type: "custom",
      target_value: Number.isNaN(targetValue) ? undefined : targetValue,
      unit: unit.trim(),
      deadline: deadline || undefined,
      priority: 2,
      config: {},
    });
    revalidatePath("/metas");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al crear la meta",
    };
  }
}

export interface UpdateGoalResult {
  success: boolean;
  error?: string;
}

export async function updateGoal(
  _prevState: UpdateGoalResult | null,
  formData: FormData
): Promise<UpdateGoalResult> {
  const goalId = (formData.get("goal_id") as string) || "";
  const name = (formData.get("name") as string) || "";
  const description = (formData.get("description") as string) || "";
  const targetValue = parseFloat(formData.get("target_value") as string);
  const unit = (formData.get("unit") as string) || "";
  const deadline = (formData.get("deadline") as string) || undefined;
  const status = (formData.get("status") as string) || undefined;

  if (!goalId) {
    return { success: false, error: "No se seleccionó una meta." };
  }

  const payload: Record<string, unknown> = {};
  if (name.trim()) payload.name = name.trim();
  if (description.trim() || description === "") payload.description = description.trim();
  if (!Number.isNaN(targetValue)) payload.target_value = targetValue;
  if (unit.trim() || unit === "") payload.unit = unit.trim();
  if (deadline) payload.deadline = deadline;
  if (status) payload.status = status;

  if (Object.keys(payload).length === 0) {
    return { success: false, error: "No hay campos para actualizar." };
  }

  try {
    await putToBackend(`/api/v1/goals/${goalId}`, payload);
    revalidatePath("/metas");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al actualizar la meta",
    };
  }
}

export async function archiveGoal(goalId: string): Promise<UpdateGoalResult> {
  if (!goalId) {
    return { success: false, error: "No se seleccionó una meta." };
  }
  try {
    await deleteFromBackend(`/api/v1/goals/${goalId}`);
    revalidatePath("/metas");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al archivar la meta",
    };
  }
}

export async function reopenGoal(goalId: string): Promise<UpdateGoalResult> {
  if (!goalId) {
    return { success: false, error: "No se seleccionó una meta." };
  }
  try {
    await putToBackend(`/api/v1/goals/${goalId}`, { status: "active" });
    revalidatePath("/metas");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al reactivar la meta",
    };
  }
}

export interface AddMetricResult {
  success: boolean;
  error?: string;
}

export async function addMetric(
  _prevState: AddMetricResult | null,
  formData: FormData
): Promise<AddMetricResult> {
  const goalId = (formData.get("goal_id") as string) || "";
  const value = parseFloat(formData.get("value") as string);
  const unit = (formData.get("unit") as string) || "";
  const date = (formData.get("date") as string) || undefined;
  const notes = (formData.get("notes") as string) || "";

  if (!goalId) {
    return { success: false, error: "No se seleccionó una meta." };
  }
  if (Number.isNaN(value)) {
    return { success: false, error: "El valor es obligatorio." };
  }

  try {
    const idempotencyKey = `${goalId}:${date || "today"}:${Date.now()}`;
    await postToBackend<CreateMetricBackendResponse>("/api/v1/metrics", {
      goal_id: goalId,
      value,
      unit: unit.trim(),
      date: date,
      notes: notes.trim(),
      idempotency_key: idempotencyKey,
    });
    revalidatePath("/metas");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al registrar el progreso",
    };
  }
}

export interface UpdateMetricResult {
  success: boolean;
  error?: string;
}

export async function updateMetric(
  _prevState: UpdateMetricResult | null,
  formData: FormData
): Promise<UpdateMetricResult> {
  const metricId = (formData.get("metric_id") as string) || "";
  const value = parseFloat(formData.get("value") as string);
  const date = (formData.get("date") as string) || undefined;
  const notes = (formData.get("notes") as string) || undefined;

  if (!metricId) {
    return { success: false, error: "No se seleccionó una métrica." };
  }
  if (Number.isNaN(value)) {
    return { success: false, error: "El valor es obligatorio." };
  }

  try {
    await putToBackend(`/api/v1/metrics/${metricId}`, {
      value,
      date,
      notes,
    });
    revalidatePath("/metas");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al actualizar la métrica",
    };
  }
}

export async function deleteMetric(metricId: string): Promise<UpdateMetricResult> {
  if (!metricId) {
    return { success: false, error: "No se seleccionó una métrica." };
  }
  try {
    await deleteFromBackend(`/api/v1/metrics/${metricId}`);
    revalidatePath("/metas");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al eliminar la métrica",
    };
  }
}

export async function getGoalMetrics(goalId: string): Promise<Metric[]> {
  if (!goalId) return [];
  const res = await fetchFromBackend<{ metrics: Metric[] }>(`/api/v1/goals/${goalId}/metrics`);
  return res.metrics ?? [];
}
