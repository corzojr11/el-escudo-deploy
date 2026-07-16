"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ArrowRight, Check, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { login, signUp, type AuthState } from "@/app/actions/auth";
import { passwordRequirements } from "@/lib/auth/password";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthState = { error: null, success: null };

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginState, loginAction, isLoggingIn] = useActionState(login, initialState);
  const [signUpState, signUpAction, isSigningUp] = useActionState(signUp, initialState);
  const state = mode === "login" ? loginState : signUpState;
  const isPending = mode === "login" ? isLoggingIn : isSigningUp;
  const passingRequirements = passwordRequirements.filter((requirement) => requirement.test(password)).length;

  function changeMode(nextMode: "login" | "signup") {
    setMode(nextMode);
    setPassword("");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,184,0,0.12),transparent_38%),linear-gradient(135deg,transparent_20%,rgba(0,229,255,0.04)_100%)]" />
      <section className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-escudo-gold/30 bg-escudo-gold/10 shadow-[0_0_32px_rgba(255,184,0,0.18)]">
            <ShieldCheck className="size-7 text-escudo-gold" />
          </div>
          <p className="font-mono text-xs tracking-[0.32em] text-escudo-gold">EL ESCUDO</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">Tu sistema personal, protegido.</h1>
        </div>

        <Card className="border-border/80 bg-card/95 shadow-2xl shadow-black/30 backdrop-blur">
          <CardHeader className="space-y-4">
            <div className="grid grid-cols-2 rounded-lg border border-border bg-secondary/45 p-1">
              <button
                type="button"
                onClick={() => changeMode("login")}
                className={`rounded-md px-3 py-2 text-sm font-medium transition ${mode === "login" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                onClick={() => changeMode("signup")}
                className={`rounded-md px-3 py-2 text-sm font-medium transition ${mode === "signup" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Crear cuenta
              </button>
            </div>
            <div>
              <CardTitle>{mode === "login" ? "Bienvenido de nuevo" : "Crea tu acceso"}</CardTitle>
              <CardDescription className="mt-1">
                {mode === "login" ? "Entra a tu panel de comando." : "Usa una contraseña sólida para proteger tu información."}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form action={mode === "login" ? loginAction : signUpAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input id="email" name="email" type="email" autoComplete="email" placeholder="tu@email.com" required disabled={isPending} className="h-11 bg-secondary/70" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Contraseña</Label>
                  {mode === "login" && <Link href="/forgot-password" className="text-xs text-escudo-cyan hover:underline">¿La olvidaste?</Link>}
                </div>
                <div className="relative">
                  <Input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} required disabled={isPending} className="h-11 bg-secondary/70 pr-11" />
                  <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {mode === "signup" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                    <Input id="confirmPassword" name="confirmPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" required disabled={isPending} className="h-11 bg-secondary/70" />
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/35 p-3" aria-live="polite">
                    <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Seguridad de la contraseña</span>
                      <span>{passingRequirements}/5</span>
                    </div>
                    <div className="mb-3 flex gap-1">
                      {passwordRequirements.map((_, index) => <span key={index} className={`h-1 flex-1 rounded-full ${index < passingRequirements ? "bg-escudo-green" : "bg-border"}`} />)}
                    </div>
                    <ul className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                      {passwordRequirements.map((requirement) => {
                        const passes = requirement.test(password);
                        return <li key={requirement.label} className={passes ? "text-escudo-green" : ""}><Check className="mr-1 inline size-3" />{requirement.label}</li>;
                      })}
                    </ul>
                  </div>
                </>
              )}

              {state.error && <p className="rounded-lg border border-escudo-red/30 bg-escudo-red/10 px-3 py-2 text-sm text-escudo-red" role="alert">{state.error}</p>}
              {state.success && <p className="rounded-lg border border-escudo-green/30 bg-escudo-green/10 px-3 py-2 text-sm text-escudo-green" role="status">{state.success}</p>}

              <Button type="submit" disabled={isPending} className="h-11 w-full bg-escudo-gold font-semibold text-primary-foreground hover:bg-escudo-gold/90">
                {isPending ? <><Loader2 className="animate-spin" />Procesando...</> : <>{mode === "login" ? "Entrar al panel" : "Crear cuenta segura"}<ArrowRight /></>}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
