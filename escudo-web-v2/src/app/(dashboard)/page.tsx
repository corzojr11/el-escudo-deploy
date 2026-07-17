import { getTodayData } from "@/app/actions/dashboard";
import { getPlanDiario } from "@/app/actions/plan";
import { DashboardClient } from "./dashboard-client";

export const metadata = {
  title: "Bitacora de viaje - El Escudo",
};

export default async function DashboardPage() {
  const [data, plan] = await Promise.all([getTodayData(), getPlanDiario()]);
  return <DashboardClient data={data} plan={plan} />;
}
