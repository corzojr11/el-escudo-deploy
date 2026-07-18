import { getHabits } from "@/app/actions/habits";
import { getPlanDiario } from "@/app/actions/plan";
import { HabitosClient } from "./habitos-client";

export const metadata = {
  title: "Hábitos — El Escudo",
};

export default async function HabitosPage() {
  const [habitsResult, planResult] = await Promise.allSettled([getHabits(), getPlanDiario()]);
  const habits = habitsResult.status === "fulfilled" ? habitsResult.value : [];
  const plan = planResult.status === "fulfilled" ? planResult.value : null;
  const survivalMode = plan?.shift_status?.status === "in_shift" || Boolean(plan?.sleep.fatigue_alert);

  return <HabitosClient habits={habits} survivalMode={survivalMode} />;
}
