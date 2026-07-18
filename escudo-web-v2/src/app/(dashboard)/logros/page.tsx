import { getAchievements } from "@/app/actions/achievements";
import { getMissions } from "@/app/actions/missions";
import { LogrosClient } from "./logros-client";

export const metadata = {
  title: "Logros - El Escudo",
};

export default async function LogrosPage() {
  const [achievementsResult, missionsResult] = await Promise.allSettled([
    getAchievements(),
    getMissions({ status: "completed" }),
  ]);
  const achievements = achievementsResult.status === "fulfilled" ? achievementsResult.value : [];
  const completedMissionCount = missionsResult.status === "fulfilled"
    ? missionsResult.value.missions.length
    : 0;

  return <LogrosClient achievements={achievements} completedMissionCount={completedMissionCount} />;
}
