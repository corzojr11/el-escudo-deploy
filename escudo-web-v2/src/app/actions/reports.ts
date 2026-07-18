"use server";

import { fetchFromBackend } from "@/lib/api/server";
import type { ProgressReport } from "@/lib/api/types";

export async function getProgressReport(period: "week" | "month"): Promise<ProgressReport> {
  return fetchFromBackend<ProgressReport>(`/api/v1/reports/summary?period=${period}`);
}
