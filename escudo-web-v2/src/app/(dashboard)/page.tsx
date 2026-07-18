import { getTodayData } from "@/app/actions/dashboard";
import { getPlanDiario } from "@/app/actions/plan";
import { getWellnessSummary } from "@/app/actions/wellness";
import { DashboardClient, type DashboardStabilityData } from "./dashboard-client";

export const metadata = {
  title: "Bitacora de viaje - El Escudo",
};

export default async function DashboardPage() {
  const data = await getTodayData();
  const [planR, wellnessR] = await Promise.allSettled([
    getPlanDiario(),
    getWellnessSummary(),
  ]);
  const stability: DashboardStabilityData = {
    budget: data.today.financial_stability?.monthly_budget ?? null,
    monthExpense: data.today.financial_stability?.month_expense ?? null,
    fixedExpenses: data.today.financial_stability?.fixed_expenses ?? [],
    debts: data.today.financial_stability?.debts ?? [],
  };

  return (
    <DashboardClient
      data={data}
      plan={planR.status === "fulfilled" ? planR.value : null}
      wellness={wellnessR.status === "fulfilled" ? wellnessR.value : null}
      stability={stability}
    />
  );
}
