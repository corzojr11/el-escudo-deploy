import { getFinances, getFinanceSummary, getBudget, getFixedExpenses, getDebts } from "@/app/actions/finances";
import { normalizeFinances } from "@/lib/api/helpers";
import { FinanzasClient } from "./finanzas-client";
import type { FixedExpense, Debt, FinanceSummaryItem, FinanceRange } from "@/lib/api/types";

export const metadata = {
  title: "Finanzas — El Escudo",
};

function settle<T>(r: PromiseSettledResult<T>, fallback: T): T {
  return r.status === "fulfilled" ? r.value : fallback;
}

export default async function FinanzasPage() {
  const [tx, sm, mo, bu, fe, db] = await Promise.allSettled([
    getFinances("all"),
    getFinanceSummary("all"),
    getFinanceSummary("month"),
    getBudget(),
    getFixedExpenses(),
    getDebts(),
  ]);

  const transactions = settle(tx, []);
  const summaryRes = settle(sm, { summary: [], total_income: 0, total_expense: 0, balance: 0 });
  const monthSummaryRes = settle(mo, { summary: [], total_income: 0, total_expense: 0, balance: 0 });

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
      initialBudget={settle(bu, 0)}
      fixedExpenses={settle(fe, []) as FixedExpense[]}
      debts={settle(db, []) as Debt[]}
    />
  );
}