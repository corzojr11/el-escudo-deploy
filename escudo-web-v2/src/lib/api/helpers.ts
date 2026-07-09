import type { FinanceEntry } from "@/lib/api/types";

export function normalizeFinanceType(
  raw: string | undefined
): "income" | "expense" {
  const value = (raw ?? "").toUpperCase();
  if (value === "INGRESO" || value === "INCOME") return "income";
  return "expense";
}

export function normalizeFinances(finances: FinanceEntry[]): FinanceEntry[] {
  return finances.map((f) => ({
    ...f,
    type: normalizeFinanceType(f.type),
  }));
}

export function formatCurrency(value: number): string {
  return `$${value.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatDate(date: string | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatShortDate(date: string | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
  });
}
