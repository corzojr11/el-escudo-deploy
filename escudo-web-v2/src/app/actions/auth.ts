"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/auth/server";
import { isStrongPassword } from "@/lib/auth/password";

export type AuthState = { error: string | null; success: string | null };

function invalidState(message: string): AuthState {
  return { error: message, success: null };
}

async function getSiteUrl() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";

  return host ? `${protocol}://${host}` : "http://localhost:3000";
}

export async function login(_: AuthState, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return invalidState("Completa tu correo y contraseña.");
  }

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.message.includes("Invalid login credentials")) {
      return invalidState("Credenciales inválidas. Revisa tu correo y contraseña.");
    }
    if (error.message.includes("Email not confirmed")) {
      return invalidState("Confirma tu correo electrónico antes de iniciar sesión.");
    }
    return invalidState("No fue posible iniciar sesión. Intenta de nuevo.");
  }

  redirect("/");
}

export async function signUp(_: AuthState, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!email || !isStrongPassword(password)) {
    return invalidState("Usa un correo válido y una contraseña que cumpla todos los requisitos.");
  }
  if (password !== confirmPassword) {
    return invalidState("Las contraseñas no coinciden.");
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${await getSiteUrl()}/auth/callback` },
  });

  if (error) {
    return invalidState("No fue posible crear la cuenta. Intenta con otro correo.");
  }

  return {
    error: null,
    success: "Revisa tu correo para confirmar la cuenta antes de iniciar sesión.",
  };
}

export async function sendPasswordRecovery(_: AuthState, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return invalidState("Escribe tu correo electrónico.");
  }

  const supabase = await createServerSupabaseClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await getSiteUrl()}/auth/callback?next=/reset-password`,
  });

  // Do not reveal whether an email has an account.
  return {
    error: null,
    success: "Si existe una cuenta para ese correo, recibirás un enlace de recuperación.",
  };
}

export async function updatePassword(_: AuthState, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!isStrongPassword(password)) {
    return invalidState("La contraseña aún no cumple los requisitos de seguridad.");
  }
  if (password !== confirmPassword) {
    return invalidState("Las contraseñas no coinciden.");
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return invalidState("El enlace expiró. Solicita una nueva recuperación.");
  }

  redirect("/");
}

export async function logout() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login");
}
