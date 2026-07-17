import { getTodayData } from "@/app/actions/dashboard";
import { getPlanDiario } from "@/app/actions/plan";
import { getWellnessSummary } from "@/app/actions/wellness";
import { DashboardClient } from "./dashboard-client";

export const metadata = {
  title: "Bitacora de viaje - El Escudo",
};

export default async function DashboardPage() {
  const [data, plan, wellness] = await Promise.all([
    getTodayData(),
    getPlanDiario(),
    getWellnessSummary(),
  ]);
  return <DashboardClient data={data} plan={plan} wellness={wellness} />;
}
