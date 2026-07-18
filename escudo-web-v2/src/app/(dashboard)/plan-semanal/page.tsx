import { getHabits } from "@/app/actions/habits";
import { getMissions } from "@/app/actions/missions";
import { getShifts } from "@/app/actions/turnos";
import { PlanSemanalClient } from "./plan-semanal-client";

export const metadata = {
  title: "Plan semanal - El Escudo",
};

function valueOr<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

export default async function PlanSemanalPage() {
  const [missions, habits, shifts] = await Promise.allSettled([
    getMissions(),
    getHabits(),
    getShifts(),
  ]);

  return (
    <PlanSemanalClient
      missions={valueOr(missions, { missions: [] }).missions}
      habits={valueOr(habits, [])}
      shifts={valueOr(shifts, [])}
      loadErrors={[missions, habits, shifts].filter((item) => item.status === "rejected").length}
    />
  );
}
