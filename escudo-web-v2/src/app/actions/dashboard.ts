"use server";

import { fetchFromBackend } from "@/lib/api/server";
import type { SyncResponse } from "@/lib/api/types";

export async function getDashboardData(): Promise<SyncResponse> {
  return fetchFromBackend<SyncResponse>("/api/v1/sync");
}
