"use server";

import { fetchFromBackend } from "@/lib/api/server";
import type { TodayResponse } from "@/lib/api/types";

export async function getTodayData(): Promise<TodayResponse> {
  return fetchFromBackend<TodayResponse>("/api/v1/today");
}
