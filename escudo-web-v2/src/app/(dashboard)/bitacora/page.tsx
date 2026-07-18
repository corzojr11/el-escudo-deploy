import { getPersonalEntries } from "@/app/actions/personal";
import { BitacoraClient } from "./bitacora-client";

export const metadata = { title: "Bitácora - El Escudo" };

export default async function BitacoraPage() {
  const result = await Promise.allSettled([getPersonalEntries()]);
  const entries = result[0].status === "fulfilled" ? result[0].value : [];

  return <BitacoraClient initialEntries={entries} loadError={result[0].status === "rejected"} />;
}
