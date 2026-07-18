import { getShifts, getCurrentStatus } from "@/app/actions/turnos";
import { getBioSettings, getPlanDiario } from "@/app/actions/plan";
import { TurnosClient } from "./turnos-client";

export const metadata = {
  title: "Turnos - El Escudo",
};

function valueOr<T>(r: PromiseSettledResult<T>, fallback: T): T {
  return r.status === "fulfilled" ? r.value : fallback;
}

export default async function TurnosPage() {
  const [s, cs, b, planResult] = await Promise.allSettled([
    getShifts(),
    getCurrentStatus(),
    getBioSettings(),
    getPlanDiario(),
  ]);
  const criticalError = s.status === "rejected";
  const loadErrors = [
    cs.status === "rejected" ? "estado actual" : null,
    b.status === "rejected" ? "ajustes biologicos" : null,
  ].filter((section): section is string => section !== null);

  return (
    <TurnosClient
      shifts={valueOr(s, [])}
    currentStatus={valueOr(cs, { status: "free", message_short: "Estado actual no disponible." })}
    bioSettings={valueOr(b, { bio_settings: null }).bio_settings}
    plan={planResult.status === "fulfilled" ? planResult.value : null}
    loadErrors={loadErrors}
      criticalError={criticalError}
    />
  );
}
