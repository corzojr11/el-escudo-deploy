"use server";

import { revalidatePath } from "next/cache";
import { fetchFromBackend, postToBackend } from "@/lib/api/server";
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

  if (!goalId) {
    return { success: false, error: "No se seleccionó una meta." };
  }
  if (Number.isNaN(value)) {
    return { success: false, error: "El valor es obligatorio." };
  }

  try {
    await postToBackend<CreateMetricBackendResponse>("/api/v1/metrics", {
      goal_id: goalId,
      value,
      unit: unit.trim(),
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
