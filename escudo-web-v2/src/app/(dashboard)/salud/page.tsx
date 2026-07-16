import { getFocusStatus, getWeightLogs } from "@/app/actions/health";
import { SaludClient } from "./salud-client";

export const metadata = {
  title: "Salud - El Escudo",
};

export default async function SaludPage() {
  const [weightLogs, focusStatus] = await Promise.all([getWeightLogs(), getFocusStatus()]);
  return <SaludClient weightLogs={weightLogs} focusStatus={focusStatus} />;
}
