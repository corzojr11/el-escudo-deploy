"use server";

import { fetchFromBackend, putToBackend, postToBackend } from "@/lib/api/server";
import type { Profile } from "@/lib/api/types";
import { revalidatePath } from "next/cache";

export async function getProfile(): Promise<{ profile: Profile | null }> {
  return fetchFromBackend<{ profile: Profile | null }>("/api/v1/profile");
}

export async function updateProfile(data: Record<string, unknown>): Promise<{ profile: Profile }> {
  const result = await putToBackend<{ profile: Profile }>("/api/v1/profile", data);
  revalidatePath("/perfil");
  revalidatePath("/");
  return result;
}

export async function completeOnboarding(data: {
  name: string;
  birth_date: string;
  weight_kg: number;
  height_cm: number;
  health_goal: string;
}): Promise<{ profile: Profile }> {
  const result = await postToBackend<{ profile: Profile }>("/api/v1/onboarding", data);
  revalidatePath("/");
  revalidatePath("/perfil");
  revalidatePath("/onboarding");
  return result;
}
