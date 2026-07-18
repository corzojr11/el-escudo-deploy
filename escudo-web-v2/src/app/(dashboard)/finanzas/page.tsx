import { getFinances, getFinanceSummary, getBudget, getFixedExpenses, getDebts } from "@/app/actions/finances";
import { getPersonalEntries } from "@/app/actions/personal";
import { normalizeFinances } from "@/lib/api/helpers";
import { FinanzasClient } from "./finanzas-client";
import type { FixedExpense, Debt, FinanceSummaryItem, FinanceRange, PersonalEntry } from "@/lib/api/types";

export const metadata = {
  title: "Finanzas — El Escudo",
};

function valueOr<T>(r: PromiseSettledResult<T>, fallback: T): T {
  return r.status === "fulfilled" ? r.value : fallback;
}

export default async function FinanzasPage({
  searchParams,
}: {
  searchParams: Promise<{ captura?: string | string[] }>;
}) {
  const params = await searchParams;
  const initialCaptureText = typeof params.captura === "string" ? params.captura.slice(0, 180) : "";
  const [tx, sm, mo, bu, fe, db, entries] = await Promise.allSettled([
    getFinances("all"),
    getFinanceSummary("all"),
    getFinanceSummary("month"),
    getBudget(),
    getFixedExpenses(),
    getDebts(),
    getPersonalEntries(),
  ]);

  const criticalError = tx.status === "rejected" || sm.status === "rejected";
  const transactions = valueOr(tx, []);
  const summaryRes = valueOr(sm, { summary: [], total_income: 0, total_expense: 0, balance: 0 });
  const monthSummaryRes = valueOr(mo, { summary: [], total_income: 0, total_expense: 0, balance: 0 });
  const loadErrors = [
    mo.status === "rejected" ? "gasto mensual" : null,
    bu.status === "rejected" ? "presupuesto" : null,
    fe.status === "rejected" ? "gastos fijos" : null,
    db.status === "rejected" ? "deudas" : null,
  ].filter((section): section is string => section !== null);

  return (
    <FinanzasClient
      transactions={normalizeFinances(transactions)}
      summary={(summaryRes.summary ?? []) as FinanceSummaryItem[]}
      initialRange={"all" as FinanceRange}
      totals={{
        income: summaryRes.total_income ?? 0,
        expense: summaryRes.total_expense ?? 0,
        balance: summaryRes.balance ?? 0,
      }}
      initialMonthlyExpense={monthSummaryRes.total_expense ?? 0}
      initialMonthlyIncome={monthSummaryRes.total_income ?? 0}
      initialBudget={valueOr(bu, 0)}
      fixedExpenses={valueOr(fe, []) as FixedExpense[]}
      debts={valueOr(db, []) as Debt[]}
      personalEntries={valueOr(entries, []) as PersonalEntry[]}
      loadErrors={loadErrors}
      criticalError={criticalError}
      initialCaptureText={initialCaptureText}
    />
  );
}
