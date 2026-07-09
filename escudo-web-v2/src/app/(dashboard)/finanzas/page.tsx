import { getFinances, getFinanceSummary } from "@/app/actions/finances";
import { normalizeFinances } from "@/lib/api/helpers";
import { FinanzasClient } from "./finanzas-client";

export const metadata = {
  title: "Finanzas — El Escudo",
};

export default async function FinanzasPage() {
  const [transactions, summaryRes] = await Promise.all([
    getFinances(),
    getFinanceSummary(),
  ]);

  return (
    <FinanzasClient
      transactions={normalizeFinances(transactions)}
      summary={summaryRes.summary ?? []}
    />
  );
}
