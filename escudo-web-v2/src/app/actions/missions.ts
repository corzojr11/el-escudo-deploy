"use server";

import { fetchFromBackend, postToBackend, putToBackend, deleteFromBackend } from "@/lib/api/server";
import type { Mission } from "@/lib/api/types";
import { revalidatePath } from "next/cache";

export async function getMissions(params?: {
  status?: string;
  date?: string;
}): Promise<{ missions: Mission[] }> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.date) qs.set("date", params.date);
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return fetchFromBackend<{ missions: Mission[] }>(`/api/v1/missions${query}`);
}

export async function createMission(data: {
  name: string;
  description?: string;
  priority?: string;
  scheduled_at?: string;
  xp_reward?: number;
  category?: string;
}): Promise<{ mission: Mission }> {
  const result = await postToBackend<{ mission: Mission }>("/api/v1/missions", data);
  revalidatePath("/misiones");
  revalidatePath("/");
  return result;
}

export async function updateMission(
  missionId: string,
  data: Record<string, unknown>
): Promise<{ mission: Mission }> {
  const result = await putToBackend<{ mission: Mission }>(`/api/v1/missions/${missionId}`, data);
  revalidatePath("/misiones");
  revalidatePath("/");
  return result;
}

export async function deleteMission(missionId: string): Promise<void> {
  await deleteFromBackend(`/api/v1/missions/${missionId}`);
  revalidatePath("/misiones");
  revalidatePath("/");
}
