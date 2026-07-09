"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Heart,
  TrendingDown,
  TrendingUp,
  Activity,
  Plus,
} from "lucide-react";
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

  const sortedLogs = useMemo(() => {
    return [...weightLogs].sort(
      (a, b) =>
        new Date(b.date ?? b.timestamp ?? b.created_at ?? 0).getTime() -
        new Date(a.date ?? a.timestamp ?? a.created_at ?? 0).getTime()
    );
  }, [weightLogs]);

  const latestLog = sortedLogs[0];
  const previousLog = sortedLogs[1];
  const weightTrend =
    latestLog && previousLog
      ? (latestLog.weight ?? 0) - (previousLog.weight ?? 0)
      : null;

  const maxWeight = useMemo(() => {
    if (sortedLogs.length === 0) return 0;
    return Math.max(...sortedLogs.map((l) => l.weight ?? 0));
  }, [sortedLogs]);

  const minWeight = useMemo(() => {
    if (sortedLogs.length === 0) return 0;
    return Math.min(...sortedLogs.map((l) => l.weight ?? 0));
  }, [sortedLogs]);

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
      <div>
        <h2 className="text-2xl font-bold text-foreground">Salud</h2>
        <p className="text-sm text-muted-foreground">
          Seguimiento de peso y bienestar.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-escudo-gold">
              <Heart className="h-4 w-4" /> Peso actual
            </CardDescription>
            <CardTitle className="text-3xl text-foreground">
              {latestLog ? `${latestLog.weight} kg` : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {latestLog
              ? `Registrado el ${formatDate(latestLog.date ?? latestLog.timestamp ?? latestLog.created_at)}`
              : "Sin registros"}
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
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
                weightTrend == null
                  ? "text-foreground"
                  : weightTrend < 0
                    ? "text-escudo-green"
                    : "text-escudo-red"
              }`}
            >
              {weightTrend != null
                ? `${weightTrend > 0 ? "+" : ""}${weightTrend.toFixed(1)} kg`
                : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            vs registro anterior
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-escudo-gold">
              <Activity className="h-4 w-4" /> Racha de enfoque
            </CardDescription>
            <CardTitle className="text-3xl text-foreground">
              {focusStatus?.current_streak ?? 0}{" "}
              <span className="text-base font-normal text-muted-foreground">días</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge
              variant="outline"
              className="border-escudo-green/30 text-escudo-green"
            >
              {(focusStatus?.current_streak ?? 0) > 0
                ? "Racha activa"
                : "Empieza hoy"}
            </Badge>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-escudo-gold">
              <TrendingUp className="h-4 w-4" /> Rango
            </CardDescription>
            <CardTitle className="text-3xl text-foreground">
              {sortedLogs.length > 0
                ? `${minWeight.toFixed(1)} - ${maxWeight.toFixed(1)}`
                : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            kg registrados
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Formulario de peso */}
        <Card className="border-border bg-card lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-5 w-5 text-escudo-gold" /> Registrar peso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form ref={formRef} action={handleSubmit} className="flex flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="weight">Peso (kg)</Label>
                <Input
                  id="weight"
                  name="weight"
                  type="number"
                  step="0.1"
                  min="0.1"
                  placeholder="Ej. 78.4"
                  required
                  className="border-input bg-secondary"
                />
              </div>
              <FormStatus {...status} />
              <SubmitButton className="w-full bg-escudo-gold text-primary-foreground hover:bg-escudo-gold/90">
                Guardar peso
              </SubmitButton>
            </form>
          </CardContent>
        </Card>

        {/* Gráfico de peso */}
        <Card className="border-border bg-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5 text-escudo-cyan" /> Historial de peso
            </CardTitle>
            <CardDescription>Últimos registros de peso</CardDescription>
          </CardHeader>
          <CardContent>
            {sortedLogs.length === 0 ? (
              <EmptyState
                title="Sin registros de peso"
                message="Aún no has registrado tu peso."
              />
            ) : (
              <div className="space-y-4">
                <div className="flex h-48 items-end justify-around gap-2 border-b border-border pb-2">
                  {[...sortedLogs].reverse().slice(-12).map((log) => {
                    const range = maxWeight - minWeight || 1;
                    const heightPct =
                      maxWeight > 0 && log.weight != null
                        ? ((log.weight - minWeight) / range) * 80 + 10
                        : 10;
                    return (
                      <div
                        key={log.id}
                        className="flex flex-col items-center gap-1"
                      >
                        <div
                          className="w-6 rounded-t-sm bg-escudo-cyan/70 transition-all"
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
                      className="flex items-center justify-between rounded-md border border-border p-3"
                    >
                      <span className="text-sm text-foreground">
                        {formatDate(log.date ?? log.timestamp ?? log.created_at)}
                      </span>
                      <span className="font-medium text-escudo-cyan">
                        {log.weight} kg
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Estado de focus */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-5 w-5 text-escudo-green" /> Bienestar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-escudo-green/5 p-4">
            <p className="text-sm text-escudo-green">
              Racha actual: {focusStatus?.current_streak ?? 0} días
            </p>
            <p className="text-xs text-muted-foreground">
              {(focusStatus?.current_streak ?? 0) > 0
                ? "¡Sigue manteniendo tu constancia!"
                : "Cada día cuenta. Empieza con un pequeño hábito."}
            </p>
          </div>
          {focusStatus?.status && (
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Estado</span>
              <p className="text-sm font-medium text-foreground capitalize">
                {focusStatus.status}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
