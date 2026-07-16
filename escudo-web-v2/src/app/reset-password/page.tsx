"use client";

import { useActionState, useState } from "react";
import { Check, Eye, EyeOff, KeyRound } from "lucide-react";
import { updatePassword, type AuthState } from "@/app/actions/auth";
import { passwordRequirements } from "@/lib/auth/password";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthState = { error: null, success: null };

export default function ResetPasswordPage() {
  const [state, formAction, isPending] = useActionState(updatePassword, initialState);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md border-border bg-card shadow-2xl shadow-black/30">
        <CardHeader>
          <KeyRound className="mb-3 size-7 text-escudo-gold" />
          <CardTitle>Elige una contraseña nueva</CardTitle>
          <CardDescription>Usa una clave única que no hayas utilizado en otros servicios.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nueva contraseña</Label>
              <div className="relative">
                <Input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={isPending} className="h-11 bg-secondary/70 pr-11" />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
              <Input id="confirmPassword" name="confirmPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" required disabled={isPending} className="h-11 bg-secondary/70" />
            </div>
            <ul className="grid gap-1 rounded-lg border border-border bg-secondary/35 p-3 text-xs text-muted-foreground sm:grid-cols-2">
              {passwordRequirements.map((requirement) => <li key={requirement.label} className={requirement.test(password) ? "text-escudo-green" : ""}><Check className="mr-1 inline size-3" />{requirement.label}</li>)}
            </ul>
            {state.error && <p className="rounded-lg bg-escudo-red/10 px-3 py-2 text-sm text-escudo-red" role="alert">{state.error}</p>}
            <Button type="submit" disabled={isPending} className="h-11 w-full bg-escudo-gold text-primary-foreground hover:bg-escudo-gold/90">Actualizar contraseña</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
