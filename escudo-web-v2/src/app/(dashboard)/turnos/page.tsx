import { getShifts, getCurrentStatus } from "@/app/actions/turnos";
import { getBioSettings } from "@/app/actions/plan";
import { TurnosClient } from "./turnos-client";

export const metadata = {
  title: "Turnos - El Escudo",
};

function settle<T>(r: PromiseSettledResult<T>, fallback: T): T {
  return r.status === "fulfilled" ? r.value : fallback;
}

export default async function TurnosPage() {
  const [s, cs, b] = await Promise.allSettled([
    getShifts(),
    getCurrentStatus(),
    getBioSettings(),
  ]);

  return (
    <TurnosClient
      shifts={settle(s, [])}
      currentStatus={settle(cs, { status: "free", message_short: "Sin turnos registrados." })}
      bioSettings={settle(b, { bio_settings: null }).bio_settings}
    />
  );
}
