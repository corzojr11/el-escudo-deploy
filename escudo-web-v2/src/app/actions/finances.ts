"use server";

import { revalidatePath } from "next/cache";
import { fetchFromBackend, postToBackend } from "@/lib/api/server";
import type {
  FinanceEntry,
  FinanceSummaryResponse,
  SyncResponse,
} from "@/lib/api/types";

export async function getFinanceSummary(): Promise<FinanceSummaryResponse> {
  return fetchFromBackend<FinanceSummaryResponse>("/api/v1/finances/summary");
}

export async function getFinances(): Promise<FinanceEntry[]> {
  const sync = await fetchFromBackend<SyncResponse>("/api/v1/sync");
  return sync.finances ?? [];
}

export interface CreateFinanceResult {
  success: boolean;
  error?: string;
}

export async function createFinance(
  _prevState: CreateFinanceResult | null,
  formData: FormData
): Promise<CreateFinanceResult> {
  const description = (formData.get("description") as string) || "";
  const amount = parseFloat(formData.get("amount") as string);
  const category = (formData.get("category") as string) || "General";
  const type = (formData.get("type") as string) || "GASTO";

  if (Number.isNaN(amount) || amount <= 0) {
    return { success: false, error: "El monto debe ser mayor a cero." };
  }

  try {
    await postToBackend<FinanceEntry>("/api/v1/finances", {
      description,
      amount,
      category,
      type,
    });
    revalidatePath("/finanzas");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al registrar el movimiento",
    };
  }
}
