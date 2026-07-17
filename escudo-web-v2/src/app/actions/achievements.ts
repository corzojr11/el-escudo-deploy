"use server";

import { fetchFromBackend } from "@/lib/api/server";
import type { Achievement } from "@/lib/api/types";

export async function getAchievements(): Promise<Achievement[]> {
  const res = await fetchFromBackend<{ achievements: Achievement[] }>("/api/v1/achievements");
  return res.achievements ?? [];
}
