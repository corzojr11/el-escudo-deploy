import { getExerciseLogs, getPersonalRecords } from "@/app/actions/health";
import { getProfile } from "@/app/actions/profile";
import { getRoutines } from "@/app/actions/routines";
import { RutinasClient } from "./rutinas-client";

export const metadata = { title: "Rutinas - El Escudo" };

export default async function RutinasPage() {
  const [routines, profileResult, exerciseLogs, personalRecords] = await Promise.all([
    getRoutines(),
    getProfile(),
    getExerciseLogs().catch(() => []),
    getPersonalRecords().catch(() => []),
  ]);

  return (
    <RutinasClient
      routines={routines}
      userEquipment={profileResult.profile?.equipment || []}
      exerciseLogs={exerciseLogs}
      personalRecords={personalRecords}
    />
  );
}
