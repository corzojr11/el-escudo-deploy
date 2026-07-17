"use server";

import { fetchFromBackend, postToBackend, putToBackend } from "@/lib/api/server";
import type { PlanDiarioResponse, SleepLog } from "@/lib/api/types";
import { revalidatePath } from "next/cache";

export async function getPlanDiario(): Promise<PlanDiarioResponse> {
  return fetchFromBackend<PlanDiarioResponse>("/api/v1/plan-diario");
}

export async function logSleep(data: {
  date: string;
  bed_time: string;
  wake_time: string;
  cycles: number;
  quality_score: number;
  notes: string;
}): Promise<{ sleep_log: SleepLog }> {
  const result = await postToBackend<{ sleep_log: SleepLog }>("/api/v1/sleep-log", data);
  revalidatePath("/turnos");
  revalidatePath("/");
  return result;
}

export async function getSleepAnalysis(): Promise<{
  logs: SleepLog[];
  avg_cycles: number;
  avg_quality: number;
  total_hours: number;
  daily_debt: number;
}> {
  return fetchFromBackend("/api/v1/sleep-analysis");
}

export async function getBioSettings(): Promise<{ bio_settings: Record<string, unknown> | null }> {
  return fetchFromBackend("/api/v1/bio-settings");
}

export async function upsertBioSettings(data: Record<string, unknown>): Promise<{ bio_settings: Record<string, unknown> }> {
  const result = await postToBackend<{ bio_settings: Record<string, unknown> }>("/api/v1/bio-settings", data);
  revalidatePath("/turnos");
  revalidatePath("/");
  return result;
}

export async function setWakeTime(wakeTime: string): Promise<{ bio_settings: Record<string, unknown> }> {
  const result = await putToBackend<{ bio_settings: Record<string, unknown> }>("/api/v1/wake-time", { t_wake_target: wakeTime });
  revalidatePath("/turnos");
  revalidatePath("/");
  return result;
}
