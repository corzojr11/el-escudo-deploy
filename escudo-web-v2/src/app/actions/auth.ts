"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/auth/server";

export async function login(prevState: { error: string | null }, formData: FormData) {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });

  if (error) {
    if (error.message.includes("Invalid login credentials")) {
      return { error: "Credenciales inválidas. Revisa tu correo y contraseña." };
    }
    if (error.message.includes("Email not confirmed")) {
      return { error: "Confirma tu correo electrónico antes de iniciar sesión." };
    }
    return { error: error.message };
  }

  redirect("/");
}

export async function logout() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login");
}
