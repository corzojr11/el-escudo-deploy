import { getTodayData } from "@/app/actions/dashboard";
import { getPlanDiario } from "@/app/actions/plan";
import { getWellnessSummary } from "@/app/actions/wellness";
import { DashboardClient } from "./dashboard-client";

export const metadata = {
  title: "Bitacora de viaje - El Escudo",
};

export default async function DashboardPage() {
  const data = await getTodayData();
  const [planR, wellnessR] = await Promise.allSettled([
    getPlanDiario(),
    getWellnessSummary(),
  ]);

  return (
    <DashboardClient
      data={data}
      plan={planR.status === "fulfilled" ? planR.value : null}
      wellness={wellnessR.status === "fulfilled" ? wellnessR.value : null}
    />
  );
}
