import { getMissions } from "@/app/actions/missions";
import { getGoals } from "@/app/actions/goals";
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
  const [missionsResult, goalsResult] = await Promise.allSettled([getMissions(), getGoals()]);
  const missions = missionsResult.status === "fulfilled" ? missionsResult.value.missions : [];
  const goals = goalsResult.status === "fulfilled" ? goalsResult.value : [];
  return <MisionesClient missions={missions} goals={goals} initialGoalId={params.meta} />;
}
