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

export async function uploadReceipt(imageBase64: string, mimeType: string = "image/jpeg") {
  return postToBackend<{
    type: string; amount: number; description: string; category: string; confidence: number; fallback_mode?: string;
  }>("/api/v1/finances/parse-receipt", { image_base64: imageBase64, mime_type: mimeType });
}

export async function quickFinanceEntry(text: string) {
  return postToBackend<{
    type: string; amount: number; description: string; category: string; fallback_mode?: string;
  }>("/api/v1/finances/quick-entry", { text });
}

export async function parseFinanceText(text: string) {
  const lower = text.toLowerCase().trim();
  let txType = "GASTO";
  if (/\b(ingreso|sueldo|abono|pago recibido|transferencia|devolucion|salario)\b/.test(lower)) txType = "INGRESO";
  const amountMatch = text.match(/(?:\$|COP\s*)?(\d[\d,.]*)/);
  let amount = 0;
  if (amountMatch) { const raw = amountMatch[1].replace(/,/g, ""); amount = parseFloat(raw) || 0; }
  if (amount <= 0) return { fallback_mode: "manual_review_required" as const };
  let description = text.replace(amountMatch?.[0] || "", "").replace(/\$|COP/gi, "").trim().slice(0, 80);
  if (!description) description = txType === "INGRESO" ? "Ingreso" : "Gasto";
  const categories: Record<string, string[]> = { Comida: ["comida","almuerzo","mercado","restaurante","supermercado","cena"], Transporte: ["transporte","gasolina","uber","taxi","bus","pasaje"], Servicios: ["luz","agua","gas","internet","telefono","servicio","factura","arriendo"], Entretenimiento: ["cine","netflix","spotify","juego","suscripcion"], Sueldo: ["sueldo","salario","nomina","pago"], Compras: ["ropa","zapatos","compra","amazon"] };
  let category = "General";
  for (const [cat, keywords] of Object.entries(categories)) { if (keywords.some(kw => lower.includes(kw))) { category = cat; break; } }
  return { type: txType, amount, description, category };
}

export async function getFixedExpenses() {
  const res = await fetchFromBackend<{ fixed_expenses: unknown[] }>("/api/v1/fixed-expenses");
  return res.fixed_expenses ?? [];
}
export async function createFixedExpense(data: { name: string; amount: number; category?: string; due_date?: string }) {
  const r = await postToBackend<{ fixed_expense: unknown }>("/api/v1/fixed-expenses", data);
  revalidatePath("/finanzas"); revalidatePath("/"); return r;
}
export async function updateFixedExpense(id: string, data: Record<string, unknown>) {
  const r = await putToBackend<{ fixed_expense: unknown }>(`/api/v1/fixed-expenses/${id}`, data);
  revalidatePath("/finanzas"); revalidatePath("/"); return r;
}
export async function deleteFixedExpense(id: string) {
  await apiRequest("DELETE", `/api/v1/fixed-expenses/${id}`);
  revalidatePath("/finanzas"); revalidatePath("/");
}

export async function getDebts() {
  const res = await fetchFromBackend<{ debts: unknown[] }>("/api/v1/debts");
  return res.debts ?? [];
}
export async function createDebt(data: { name: string; total: number; remaining?: number; due_date?: string; notes?: string }) {
  const r = await postToBackend<{ debt: unknown }>("/api/v1/debts", data);
  revalidatePath("/finanzas"); revalidatePath("/"); return r;
}
export async function updateDebt(id: string, data: Record<string, unknown>) {
  const r = await putToBackend<{ debt: unknown }>(`/api/v1/debts/${id}`, data);
  revalidatePath("/finanzas"); revalidatePath("/"); return r;
}
export async function deleteDebt(id: string) {
  await apiRequest("DELETE", `/api/v1/debts/${id}`);
  revalidatePath("/finanzas"); revalidatePath("/");
}
export async function recordDebtPayment(debtId: string, data: { amount: number; notes?: string }) {
  const r = await postToBackend<{ debt: unknown }>(`/api/v1/debts/${debtId}/payments`, data);
  revalidatePath("/finanzas"); revalidatePath("/"); return r;
}

export async function getBudget() {
  const res = await fetchFromBackend<{ monthly_budget: number }>("/api/v1/budget");
  return res.monthly_budget ?? 0;
}
export async function setBudget(monthlyBudget: number) {
  const r = await putToBackend<{ monthly_budget: number }>("/api/v1/budget", { monthly_budget: monthlyBudget });
  revalidatePath("/finanzas"); revalidatePath("/perfil"); revalidatePath("/"); return r;
}
