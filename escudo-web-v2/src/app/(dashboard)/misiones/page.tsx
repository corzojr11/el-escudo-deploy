import { getMissions } from "@/app/actions/missions";
import { getGoals } from "@/app/actions/goals";
import { getPlanDiario } from "@/app/actions/plan";
import { MisionesClient } from "./misiones-client";

export const metadata = {
  title: "Misiones - El Escudo",
};

export default async function MisionesPage({
  searchParams,
}: {
  searchParams: Promise<{ meta?: string }>;
}) {
  const params = await searchParams;
  const [missionsResult, goalsResult, planResult] = await Promise.allSettled([getMissions(), getGoals(), getPlanDiario()]);
  const missions = missionsResult.status === "fulfilled" ? missionsResult.value.missions : [];
  const goals = goalsResult.status === "fulfilled" ? goalsResult.value : [];
  const plan = planResult.status === "fulfilled" ? planResult.value : null;
  const capacityNotice = plan?.shift_status.status === "in_shift"
    ? "Estás en turno. Deja como máximo una misión ligera para cuando salgas."
    : plan?.sleep.fatigue_alert
      ? "Tu descanso está comprometido. Mantén una sola misión importante y evita llenar el día."
      : null;

  return <MisionesClient missions={missions} goals={goals} initialGoalId={params.meta} capacityNotice={capacityNotice} />;
}
