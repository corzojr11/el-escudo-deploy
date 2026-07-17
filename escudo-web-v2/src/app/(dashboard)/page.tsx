import { getTodayData } from "@/app/actions/dashboard";
import { DashboardClient } from "./dashboard-client";

export const metadata = {
  title: "Bitácora de viaje - El Escudo",
};

export default async function DashboardPage() {
  const data = await getTodayData();
  return <DashboardClient data={data} />;
}
