import { getFocusStatus, getWeightLogs, getExerciseLogs, getPersonalRecords } from "@/app/actions/health";
import { getSleepAnalysis, getBioSettings } from "@/app/actions/plan";
import { getRoutines } from "@/app/actions/routines";
import { getTodayRoutineCompletions } from "@/app/actions/wellness";
import { SaludClient } from "./salud-client";

export const metadata = {
  title: "Salud - El Escudo",
};

function valueOr<T>(result: PromiseSettledResult<T>, fallback: T): T {
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
  const loadErrors = [
    w.status === "rejected" ? "peso" : null,
    f.status === "rejected" ? "enfoque" : null,
    s.status === "rejected" ? "sueno" : null,
    b.status === "rejected" ? "ajustes biologicos" : null,
    e.status === "rejected" ? "ejercicios" : null,
    p.status === "rejected" ? "records personales" : null,
    r.status === "rejected" ? "rutinas" : null,
    c.status === "rejected" ? "completado de rutina" : null,
  ].filter((section): section is string => section !== null);

  return (
    <SaludClient
      weightLogs={valueOr(w, [])}
      focusStatus={valueOr(f, null)}
      sleepAnalysis={valueOr(s, null)}
      bioSettings={valueOr(b, { bio_settings: null }).bio_settings}
      exerciseLogs={valueOr(e, [])}
      personalRecords={valueOr(p, [])}
      routines={valueOr(r, [])}
      completedDays={valueOr(c, [])}
      loadErrors={loadErrors}
    />
  );
}
