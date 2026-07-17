import { getShifts, getCurrentStatus } from "@/app/actions/turnos";
import { getBioSettings } from "@/app/actions/plan";
import { TurnosClient } from "./turnos-client";

export const metadata = {
  title: "Turnos - El Escudo",
};

export default async function TurnosPage() {
  const [shifts, currentStatus, bioResult] = await Promise.all([
    getShifts(),
    getCurrentStatus(),
    getBioSettings(),
  ]);
  return (
    <TurnosClient
      shifts={shifts}
      currentStatus={currentStatus}
      bioSettings={bioResult.bio_settings}
    />
  );
}
