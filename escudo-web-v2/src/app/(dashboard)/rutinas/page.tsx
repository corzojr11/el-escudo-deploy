import { getRoutines } from "@/app/actions/routines";
import { RutinasClient } from "./rutinas-client";

export const metadata = {
  title: "Rutinas - El Escudo",
};

export default async function RutinasPage() {
  const routines = await getRoutines();
  return <RutinasClient routines={routines} />;
}
