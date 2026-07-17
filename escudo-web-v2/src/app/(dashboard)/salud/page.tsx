import { getFocusStatus, getWeightLogs, getExerciseLogs, getPersonalRecords } from "@/app/actions/health";
import { getSleepAnalysis, getBioSettings } from "@/app/actions/plan";
import { getRoutines } from "@/app/actions/routines";
import { getTodayRoutineCompletions } from "@/app/actions/wellness";
import { SaludClient } from "./salud-client";

export const metadata = {
  title: "Salud - El Escudo",
};

export default async function SaludPage() {
  const [weightLogs, focusStatus, sleepAnalysis, bioResult, exerciseLogs, personalRecords, routines, completions] = await Promise.all([
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
      weightLogs={weightLogs}
      focusStatus={focusStatus}
      sleepAnalysis={sleepAnalysis}
      bioSettings={bioResult.bio_settings}
      exerciseLogs={exerciseLogs}
      personalRecords={personalRecords}
      routines={routines}
      completedDays={completions}
    />
  );
}
