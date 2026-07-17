import { getAchievements } from "@/app/actions/achievements";
import { LogrosClient } from "./logros-client";

export const metadata = {
  title: "Logros - El Escudo",
};

export default async function LogrosPage() {
  const achievements = await getAchievements();
  return <LogrosClient achievements={achievements} />;
}
