"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";
import { sendPasswordRecovery, type AuthState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthState = { error: null, success: null };

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState(sendPasswordRecovery, initialState);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md border-border bg-card shadow-2xl shadow-black/30">
        <CardHeader>
          <ShieldCheck className="mb-3 size-7 text-escudo-gold" />
          <CardTitle>Recupera tu acceso</CardTitle>
          <CardDescription>Te enviaremos un enlace seguro para crear una nueva contraseña.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input id="email" name="email" type="email" autoComplete="email" placeholder="tu@email.com" required disabled={isPending} className="h-11 bg-secondary/70" />
            </div>
            {state.error && <p className="rounded-lg bg-escudo-red/10 px-3 py-2 text-sm text-escudo-red" role="alert">{state.error}</p>}
            {state.success && <p className="rounded-lg bg-escudo-green/10 px-3 py-2 text-sm text-escudo-green" role="status">{state.success}</p>}
            <Button type="submit" disabled={isPending} className="h-11 w-full bg-escudo-gold text-primary-foreground hover:bg-escudo-gold/90"><Mail />{isPending ? "Enviando..." : "Enviar enlace"}</Button>
          </form>
          <Link href="/login" className="mt-5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Volver a iniciar sesión</Link>
        </CardContent>
      </Card>
    </main>
  );
}
