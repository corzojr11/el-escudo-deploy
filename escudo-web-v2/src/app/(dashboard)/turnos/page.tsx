import { getShifts, getCurrentStatus } from "@/app/actions/turnos";
import { TurnosClient } from "./turnos-client";

export const metadata = {
  title: "Turnos - El Escudo",
};

export default async function TurnosPage() {
  const [shifts, currentStatus] = await Promise.all([getShifts(), getCurrentStatus()]);
  return <TurnosClient shifts={shifts} currentStatus={currentStatus} />;
}
