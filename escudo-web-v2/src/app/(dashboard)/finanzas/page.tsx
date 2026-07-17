import { getFinances, getFinanceSummary, getBudget, getFixedExpenses, getDebts } from "@/app/actions/finances";
import { normalizeFinances } from "@/lib/api/helpers";
import { FinanzasClient } from "./finanzas-client";
import type { FixedExpense, Debt, FinanceSummaryItem, FinanceRange } from "@/lib/api/types";

export const metadata = {
  title: "Finanzas — El Escudo",
};

export default async function FinanzasPage() {
  const [transactions, summaryRes, budget, fixedExpenses, debts] = await Promise.all([
    getFinances("all"),
    getFinanceSummary("all"),
    getBudget(),
    getFixedExpenses(),
    getDebts(),
  ]);

  const props = {
    transactions: normalizeFinances(transactions),
    summary: (summaryRes.summary ?? []) as FinanceSummaryItem[],
    initialRange: "all" as FinanceRange,
    totals: {
      income: summaryRes.total_income ?? 0,
      expense: summaryRes.total_expense ?? 0,
      balance: summaryRes.balance ?? 0,
    },
    initialBudget: budget,
    fixedExpenses: fixedExpenses as FixedExpense[],
    debts: debts as Debt[],
  };

  return <FinanzasClient {...props} />;
}