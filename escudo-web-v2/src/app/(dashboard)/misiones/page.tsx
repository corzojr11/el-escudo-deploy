import { getMissions } from "@/app/actions/missions";
import { MisionesClient } from "./misiones-client";

export const metadata = {
  title: "Misiones - El Escudo",
};

export default async function MisionesPage() {
  const { missions } = await getMissions();
  return <MisionesClient missions={missions} />;
}
