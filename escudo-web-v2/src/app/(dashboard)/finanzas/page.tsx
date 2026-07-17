import { getFinances, getFinanceSummary } from "@/app/actions/finances";
import { normalizeFinances } from "@/lib/api/helpers";
import { FinanzasClient } from "./finanzas-client";

export const metadata = {
  title: "Finanzas — El Escudo",
};

export default async function FinanzasPage() {
  const [transactions, summaryRes] = await Promise.all([
    getFinances("all"),
    getFinanceSummary("all"),
  ]);

  return (
    <FinanzasClient
      transactions={normalizeFinances(transactions)}
      summary={summaryRes.summary ?? []}
      initialRange="all"
      totals={{
        income: summaryRes.total_income ?? 0,
        expense: summaryRes.total_expense ?? 0,
        balance: summaryRes.balance ?? 0,
      }}
    />
  );
}
