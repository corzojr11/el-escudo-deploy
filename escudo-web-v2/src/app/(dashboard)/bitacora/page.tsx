import { getPersonalEntries } from "@/app/actions/personal";
import { BitacoraClient } from "./bitacora-client";

export const metadata = { title: "Bitácora - El Escudo" };

export default async function BitacoraPage() {
  const entries = await getPersonalEntries();
  return <BitacoraClient initialEntries={entries} />;
}
