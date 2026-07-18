"use server";

import { revalidatePath } from "next/cache";
import { fetchFromBackend, postToBackend, putToBackend, apiRequest } from "@/lib/api/server";
import { parseFinanceTextLocally } from "@/lib/parse-finance-text";
import type {
  FinanceEntry,
  FinanceSummaryResponse,
  FinanceRange,
  FixedExpense,
  Debt,
  DebtPayment,
  ParsedTransaction,
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

export async function uploadReceipt(
  imageBase64: string,
  mimeType: string = "image/jpeg"
): Promise<ParsedTransaction & { confidence?: number }> {
  return postToBackend<ParsedTransaction & { confidence: number }>(
    "/api/v1/finances/parse-receipt",
    { image_base64: imageBase64, mime_type: mimeType }
  );
}

export async function quickFinanceEntry(text: string): Promise<ParsedTransaction> {
  return postToBackend<ParsedTransaction>("/api/v1/finances/quick-entry", { text });
}

export async function parseFinanceText(text: string): Promise<ParsedTransaction> {
  return parseFinanceTextLocally(text);
}

export async function getFixedExpenses(): Promise<FixedExpense[]> {
  const res = await fetchFromBackend<{ fixed_expenses: FixedExpense[] }>("/api/v1/fixed-expenses");
  return res.fixed_expenses ?? [];
}
export async function createFixedExpense(data: { name: string; amount: number; category?: string; due_date?: string; is_paid?: boolean }): Promise<{ fixed_expense: FixedExpense }> {
  const r = await postToBackend<{ fixed_expense: FixedExpense }>("/api/v1/fixed-expenses", data);
  revalidatePath("/finanzas"); revalidatePath("/"); return r;
}
export async function updateFixedExpense(id: string, data: Partial<Pick<FixedExpense, "name" | "amount" | "category" | "due_date" | "is_paid">>): Promise<{ fixed_expense: FixedExpense }> {
  const r = await putToBackend<{ fixed_expense: FixedExpense }>(`/api/v1/fixed-expenses/${id}`, data);
  revalidatePath("/finanzas"); revalidatePath("/"); return r;
}
export async function deleteFixedExpense(id: string): Promise<void> {
  await apiRequest("DELETE", `/api/v1/fixed-expenses/${id}`);
  revalidatePath("/finanzas"); revalidatePath("/");
}

export async function getDebts(): Promise<Debt[]> {
  const res = await fetchFromBackend<{ debts: Debt[] }>("/api/v1/debts");
  return res.debts ?? [];
}
export async function createDebt(data: { name: string; total: number; remaining?: number; monthly_payment?: number; due_date?: string; notes?: string }): Promise<{ debt: Debt }> {
  const r = await postToBackend<{ debt: Debt }>("/api/v1/debts", data);
  revalidatePath("/finanzas"); revalidatePath("/"); return r;
}
export async function updateDebt(id: string, data: Partial<Pick<Debt, "name" | "total" | "remaining" | "monthly_payment" | "due_date" | "notes" | "status">>): Promise<{ debt: Debt }> {
  const r = await putToBackend<{ debt: Debt }>(`/api/v1/debts/${id}`, data);
  revalidatePath("/finanzas"); revalidatePath("/"); return r;
}
export async function deleteDebt(id: string): Promise<void> {
  await apiRequest("DELETE", `/api/v1/debts/${id}`);
  revalidatePath("/finanzas"); revalidatePath("/");
}
export async function recordDebtPayment(debtId: string, data: { amount: number; notes?: string; payment_date?: string }): Promise<{ debt: { remaining: number } }> {
  const r = await postToBackend<{ debt: { remaining: number } }>(`/api/v1/debts/${debtId}/payments`, data);
  revalidatePath("/finanzas"); revalidatePath("/"); return r;
}
export async function getDebtPayments(debtId: string): Promise<DebtPayment[]> {
  const res = await fetchFromBackend<{ payments: DebtPayment[] }>(`/api/v1/debts/${debtId}/payments`);
  return res.payments ?? [];
}

export async function getBudget(): Promise<number> {
  const res = await fetchFromBackend<{ monthly_budget: number }>("/api/v1/budget");
  return res.monthly_budget ?? 0;
}
export async function setBudget(monthlyBudget: number): Promise<{ monthly_budget: number }> {
  const r = await putToBackend<{ monthly_budget: number }>("/api/v1/budget", { monthly_budget: monthlyBudget });
  revalidatePath("/finanzas"); revalidatePath("/perfil"); revalidatePath("/"); return r;
}
