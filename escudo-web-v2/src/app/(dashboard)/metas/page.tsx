import { getGoals } from "@/app/actions/goals";
import { MetasClient } from "./metas-client";

export const metadata = {
  title: "Metas — El Escudo",
};

export default async function MetasPage() {
  const goals = await getGoals();
  return <MetasClient goals={goals} />;
}
