"use server";

import { revalidatePath } from "next/cache";
import { fetchFromBackend, postToBackend, putToBackend, apiRequest } from "@/lib/api/server";
import type {
  FinanceEntry,
  FinanceSummaryResponse,
  FinanceRange,
} from "@/lib/api/types";

export async function getFinanceSummary(
  range: FinanceRange = "all"
): Promise<FinanceSummaryResponse> {
  return fetchFromBackend<FinanceSummaryResponse>(`/api/v1/finances/summary?range=${range}`);
}

export async function getFinances(range: FinanceRange = "all"): Promise<FinanceEntry[]> {
  const res = await fetchFromBackend<{ finances: FinanceEntry[] }>(`/api/v1/finances?range=${range}`);
  return res.finances ?? [];
}

export interface CreateFinanceResult {
  success: boolean;
  error?: string;
}

function generateIdempotencyKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createFinance(
  _prevState: CreateFinanceResult | null,
  formData: FormData
): Promise<CreateFinanceResult> {
  const description = (formData.get("description") as string) || "";
  const amount = parseFloat(formData.get("amount") as string);
  const category = (formData.get("category") as string) || "General";
  const type = (formData.get("type") as string) || "GASTO";
  const date = (formData.get("date") as string) || "";
  const idempotencyKey = generateIdempotencyKey("finance-create");

  if (Number.isNaN(amount) || amount <= 0) {
    return { success: false, error: "El monto debe ser mayor a cero." };
  }

  try {
    await postToBackend<FinanceEntry>("/api/v1/finances", {
      description,
      amount,
      category,
      type,
      date: date || undefined,
      idempotency_key: idempotencyKey,
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

export interface UpdateFinanceResult {
  success: boolean;
  error?: string;
}

export async function updateFinance(
  financeId: string,
  formData: FormData
): Promise<UpdateFinanceResult> {
  const description = (formData.get("description") as string) || "";
  const amountRaw = formData.get("amount") as string;
  const amount = amountRaw ? parseFloat(amountRaw) : NaN;
  const category = (formData.get("category") as string) || "General";
  const type = (formData.get("type") as string) || "GASTO";
  const date = (formData.get("date") as string) || "";

  if (amountRaw && (Number.isNaN(amount) || amount <= 0)) {
    return { success: false, error: "El monto debe ser mayor a cero." };
  }

  const body: Record<string, unknown> = {};
  if (description) body.description = description;
  if (amountRaw && !Number.isNaN(amount)) body.amount = amount;
  if (category) body.category = category;
  if (type) body.type = type;
  if (date) body.date = date;

  if (Object.keys(body).length === 0) {
    return { success: false, error: "No hay campos para actualizar." };
  }

  try {
    await putToBackend<{ finance: FinanceEntry }>(`/api/v1/finances/${financeId}`, body);
    revalidatePath("/finanzas");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al actualizar el movimiento",
    };
  }
}

export async function deleteFinance(financeId: string) {
  try {
    await apiRequest("DELETE", `/api/v1/finances/${financeId}`);
    revalidatePath("/finanzas");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al eliminar el movimiento",
    };
  }
}
