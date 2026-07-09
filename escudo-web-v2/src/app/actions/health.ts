"use server";

import { revalidatePath } from "next/cache";
import { fetchFromBackend, postToBackend } from "@/lib/api/server";
import type { FocusStatus, WeightLog } from "@/lib/api/types";

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

  if (Number.isNaN(weight) || weight <= 0) {
    return { success: false, error: "El peso debe ser mayor a cero." };
  }

  try {
    await postToBackend<WeightLog>("/api/v1/weight", { weight });
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
