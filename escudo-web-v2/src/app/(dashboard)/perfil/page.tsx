import { getProfile } from "@/app/actions/profile";
import { PerfilClient } from "./perfil-client";

export default async function PerfilPage() {
  const { profile } = await getProfile();
  return <PerfilClient profile={profile} />;
}
