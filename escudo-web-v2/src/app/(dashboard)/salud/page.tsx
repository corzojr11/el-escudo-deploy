import { getFocusStatus, getWeightLogs, getExerciseLogs, getPersonalRecords } from "@/app/actions/health";
import { getSleepAnalysis, getBioSettings } from "@/app/actions/plan";
import { getRoutines } from "@/app/actions/routines";
import { getTodayRoutineCompletions } from "@/app/actions/wellness";
import { SaludClient } from "./salud-client";

export const metadata = {
  title: "Salud - El Escudo",
};

function settle<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

export default async function SaludPage() {
  const [w, f, s, b, e, p, r, c] = await Promise.allSettled([
    getWeightLogs(),
    getFocusStatus(),
    getSleepAnalysis(),
    getBioSettings(),
    getExerciseLogs(),
    getPersonalRecords(),
    getRoutines(),
    getTodayRoutineCompletions(),
  ]);

  return (
    <SaludClient
      weightLogs={settle(w, [])}
      focusStatus={settle(f, null)}
      sleepAnalysis={settle(s, null)}
      bioSettings={settle(b, { bio_settings: null }).bio_settings}
      exerciseLogs={settle(e, [])}
      personalRecords={settle(p, [])}
      routines={settle(r, [])}
      completedDays={settle(c, [])}
    />
  );
}
