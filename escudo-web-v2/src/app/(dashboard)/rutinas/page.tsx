import { getRoutines } from "@/app/actions/routines";
import { getProfile } from "@/app/actions/profile";
import { RutinasClient } from "./rutinas-client";

export const metadata = {
  title: "Rutinas - El Escudo",
};

export default async function RutinasPage() {
  const [routines, { profile }] = await Promise.all([
    getRoutines(),
    getProfile(),
  ]);
  return <RutinasClient routines={routines} userEquipment={profile?.equipment || []} />;
}
