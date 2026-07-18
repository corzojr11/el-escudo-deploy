import { getHabits } from "@/app/actions/habits";
import { getMissions } from "@/app/actions/missions";
import { getShifts } from "@/app/actions/turnos";
import { getPersonalEntries } from "@/app/actions/personal";
import { PlanSemanalClient } from "./plan-semanal-client";

export const metadata = {
  title: "Plan semanal - El Escudo",
};

function valueOr<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

export default async function PlanSemanalPage() {
  const [missions, habits, shifts, personalEntries] = await Promise.allSettled([
    getMissions(),
    getHabits(),
    getShifts(),
    getPersonalEntries(),
  ]);

  return (
    <PlanSemanalClient
      missions={valueOr(missions, { missions: [] }).missions}
      habits={valueOr(habits, [])}
      shifts={valueOr(shifts, [])}
      personalEntries={valueOr(personalEntries, [])}
      loadErrors={[missions, habits, shifts, personalEntries].filter((item) => item.status === "rejected").length}
    />
  );
}
