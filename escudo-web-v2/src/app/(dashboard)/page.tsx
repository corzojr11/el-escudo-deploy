import { getTodayData } from "@/app/actions/dashboard";
import { getPlanDiario } from "@/app/actions/plan";
import { getWellnessSummary } from "@/app/actions/wellness";
import { DashboardClient } from "./dashboard-client";
import type { PlanDiarioResponse, WellnessSummary } from "@/lib/api/types";

export const metadata = {
  title: "Bitacora de viaje - El Escudo",
};

const emptyPlan: PlanDiarioResponse = {
  date: "", shift_status: { status: "free", message_short: "" },
  sleep: { windows: [], fatigue_alert: null, recommended_cycles: null, wake_target: "", sleep_target: "", commute_minutes: 0 },
  workout: null, hydration_ml: null, sleep_logs_recent: [], missing_config: [],
  disclaimer: "",
};

const emptyWellness: WellnessSummary = {
  date: "", score: 0, completeness: 0, factors: [],
  insight: "Cargando...", action_route: null, action_label: null,
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
      plan={planR.status === "fulfilled" ? planR.value : emptyPlan}
      wellness={wellnessR.status === "fulfilled" ? wellnessR.value : emptyWellness}
    />
  );
}
