"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heart, TrendingDown, TrendingUp, Activity, Plus } from "lucide-react";
import { addWeight } from "@/app/actions/health";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { SubmitButton } from "@/components/dashboard/SubmitButton";
import { FormStatus } from "@/components/dashboard/FormStatus";
import { formatDate, formatShortDate } from "@/lib/api/helpers";
import type { FocusStatus, WeightLog } from "@/lib/api/types";

interface SaludClientProps {
  weightLogs: WeightLog[];
  focusStatus: FocusStatus | null;
}

export function SaludClient({ weightLogs, focusStatus }: SaludClientProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<{ success?: string; error?: string }>({});
  const [, startTransition] = useTransition();

  const sortedLogs = useMemo(
    () =>
      [...weightLogs].sort(
        (a, b) =>
          new Date(b.date ?? b.timestamp ?? b.created_at ?? 0).getTime() -
          new Date(a.date ?? a.timestamp ?? a.created_at ?? 0).getTime()
      ),
    [weightLogs]
  );

  const latestLog = sortedLogs[0];
  const previousLog = sortedLogs[1];
  const weightTrend = latestLog && previousLog ? (latestLog.weight ?? 0) - (previousLog.weight ?? 0) : null;

  const maxWeight = useMemo(
    () => (sortedLogs.length === 0 ? 0 : Math.max(...sortedLogs.map((l) => l.weight ?? 0))),
    [sortedLogs]
  );
  const minWeight = useMemo(
    () => (sortedLogs.length === 0 ? 0 : Math.min(...sortedLogs.map((l) => l.weight ?? 0))),
    [sortedLogs]
  );

  async function handleSubmit(formData: FormData) {
    setStatus({});
    startTransition(async () => {
      const result = await addWeight(null, formData);
      if (result.success) {
        setStatus({ success: "Peso registrado correctamente." });
        formRef.current?.reset();
        router.refresh();
      } else {
        setStatus({ error: result.error ?? "Error al registrar" });
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="panel-neon relative overflow-hidden rounded-[28px] p-6">
        <div className="relative flex flex-col gap-3">
          <span className="hud-label text-escudo-red">Vital Monitor</span>
          <h2 className="font-heading text-3xl font-black tracking-[0.1em] text-glow text-foreground md:text-4xl">
            SALUD
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
            Registra peso, visualiza tendencia y sigue tu estado de enfoque en una sola cabina.
          </p>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-escudo-gold">
              <Heart className="h-4 w-4" /> Peso actual
            </CardDescription>
            <CardTitle className="text-3xl text-foreground">
              {latestLog ? `${latestLog.weight} kg` : "-"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {latestLog
              ? `Registrado el ${formatDate(latestLog.date ?? latestLog.timestamp ?? latestLog.created_at)}`
              : "Sin registros"}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-escudo-gold">
              {weightTrend == null ? (
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              ) : weightTrend < 0 ? (
                <TrendingDown className="h-4 w-4 text-escudo-green" />
              ) : (
                <TrendingUp className="h-4 w-4 text-escudo-red" />
              )}{" "}
              Tendencia
            </CardDescription>
            <CardTitle
              className={`text-3xl ${
                weightTrend == null ? "text-foreground" : weightTrend < 0 ? "text-escudo-green" : "text-escudo-red"
              }`}
            >
              {weightTrend != null ? `${weightTrend > 0 ? "+" : ""}${weightTrend.toFixed(1)} kg` : "-"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">vs registro anterior</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-escudo-green">
              <Activity className="h-4 w-4" /> Racha de enfoque
            </CardDescription>
            <CardTitle className="text-3xl text-foreground">
              {focusStatus?.focus_streak ?? 0}{" "}
              <span className="text-base font-normal text-muted-foreground">dias</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className="border-escudo-green/30 bg-escudo-green/10 text-escudo-green">
              {(focusStatus?.focus_streak ?? 0) > 0 ? "Racha activa" : "Empieza hoy"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-escudo-cyan">
              <TrendingUp className="h-4 w-4" /> Rango
            </CardDescription>
            <CardTitle className="text-3xl text-foreground">
              {sortedLogs.length > 0 ? `${minWeight.toFixed(1)} - ${maxWeight.toFixed(1)}` : "-"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">kg registrados</CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <span className="hud-label text-accent">Weight Input</span>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-5 w-5 text-escudo-gold" /> Registrar peso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form ref={formRef} action={handleSubmit} className="flex flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="weight">Peso (kg)</Label>
                <Input id="weight" name="weight" type="number" step="0.1" min="0.1" placeholder="Ej. 78.4" required />
              </div>
              <FormStatus {...status} />
              <SubmitButton className="w-full">Guardar peso</SubmitButton>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <span className="hud-label text-accent">Weight History</span>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5 text-escudo-cyan" /> Historial de peso
            </CardTitle>
            <CardDescription>Ultimos registros de peso</CardDescription>
          </CardHeader>
          <CardContent>
            {sortedLogs.length === 0 ? (
              <EmptyState title="Sin registros de peso" message="Aun no has registrado tu peso." />
            ) : (
              <div className="space-y-4">
                <div className="flex h-48 items-end justify-around gap-2 border-b border-border pb-2">
                  {[...sortedLogs].reverse().slice(-12).map((log) => {
                    const range = maxWeight - minWeight || 1;
                    const heightPct =
                      maxWeight > 0 && log.weight != null ? ((log.weight - minWeight) / range) * 80 + 10 : 10;
                    return (
                      <div key={log.id} className="flex flex-col items-center gap-1">
                        <div
                          className="w-6 rounded-t-sm bg-escudo-cyan/80 transition-all"
                          style={{ height: `${heightPct}%` }}
                          title={`${log.weight} kg`}
                        />
                        <span className="text-[10px] text-muted-foreground">
                          {formatShortDate(log.date ?? log.timestamp ?? log.created_at)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-2">
                  {sortedLogs.slice(0, 8).map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between rounded-xl border border-border/70 bg-background/35 p-3"
                    >
                      <span className="text-sm text-foreground">
                        {formatDate(log.date ?? log.timestamp ?? log.created_at)}
                      </span>
                      <span className="font-medium text-escudo-cyan">{log.weight} kg</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <span className="hud-label text-escudo-green">Focus State</span>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-5 w-5 text-escudo-green" /> Bienestar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-escudo-green/20 bg-escudo-green/8 p-4">
            <p className="text-sm text-escudo-green">
              Racha actual: {focusStatus?.focus_streak ?? 0} dias
            </p>
            <p className="text-xs text-muted-foreground">
              {(focusStatus?.focus_streak ?? 0) > 0
                ? "Sigue manteniendo tu constancia."
                : "Cada dia cuenta. Empieza con un pequeno habito."}
            </p>
          </div>
          {(focusStatus?.focus_best ?? 0) > 0 && (
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Mejor racha</span>
              <p className="text-sm font-medium text-foreground">{focusStatus?.focus_best} dias</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
