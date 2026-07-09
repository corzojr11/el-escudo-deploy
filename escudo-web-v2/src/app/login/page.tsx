"use client";

import { useActionState } from "react";
import { Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { login } from "@/app/actions/auth";

const initialState = { error: null as string | null };

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(login, initialState);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mb-8 flex items-center gap-2">
        <Shield className="h-8 w-8 text-escudo-gold" />
        <span className="font-mono text-2xl font-bold tracking-tight text-escudo-gold">
          EL ESCUDO
        </span>
      </div>

      <Card className="w-full max-w-sm border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Iniciar sesión</CardTitle>
          <CardDescription>
            Accede a tu panel de comando.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="tu@email.com"
                required
                disabled={isPending}
                className="border-input bg-secondary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                disabled={isPending}
                className="border-input bg-secondary"
              />
            </div>

            {state.error && (
              <div className="rounded-md bg-escudo-red/10 px-3 py-2 text-sm text-escudo-red">
                {state.error}
              </div>
            )}

            <Button
              type="submit"
              disabled={isPending}
              className="w-full bg-escudo-gold text-primary-foreground hover:bg-escudo-gold/90"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </Button>

          </form>
        </CardContent>
      </Card>
    </div>
  );
}
