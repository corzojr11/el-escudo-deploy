"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  Wallet,
  Target,
  Heart,
  CalendarClock,
  CheckSquare,
  TrendingUp,
  TrendingDown,
  Shield,
} from "lucide-react";
import { getDashboardData } from "@/app/actions/dashboard";
import { LoadingState } from "@/components/dashboard/LoadingState";
import { ErrorState } from "@/components/dashboard/ErrorState";
import { normalizeFinances } from "@/lib/api/helpers";
import type { SyncResponse } from "@/lib/api/types";

export default function DashboardPage() {
  const [data, setData] = useState<SyncResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function loadData() {
    setLoading(true);
    setError(null);
    getDashboardData()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Error desconocido"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    getDashboardData()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Error desconocido"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <LoadingState message="Conectando con el centro de comando..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadData} />;
  }

  const profile = data?.profile;
  const rawFinances = data?.finances ?? [];
  const finances = normalizeFinances(rawFinances);
  const shifts = data?.shifts ?? [];
  const weightLogs = data?.weight_logs ?? [];
  const missions = data?.missions ?? [];
  const goals = data?.goals ?? [];
  const quote = data?.daily_quote;

  const level = profile?.level ?? 0;
  const xp = profile?.xp ?? 0;
  const xpToNextLevel = profile?.xp_to_next_level ?? 100;
  const xpPercent = xpToNextLevel > 0 ? (xp / xpToNextLevel) * 100 : 0;
  const streak = data?.focus_status?.current_streak ?? 0;

  const today = new Date().toISOString().split("T")[0];
  const todayFinances = finances.filter((f) => f.date?.startsWith(today));
  const todayIncome = todayFinances
    .filter((f) => f.type === "income")
    .reduce((sum, f) => sum + (f.amount ?? 0), 0);
  const todayExpense = todayFinances
    .filter((f) => f.type === "expense")
    .reduce((sum, f) => sum + (f.amount ?? 0), 0);
  const balance = todayIncome - todayExpense;

  const sortedWeight = [...weightLogs].sort(
    (a, b) =>
      new Date(b.date ?? b.timestamp ?? b.created_at ?? 0).getTime() -
      new Date(a.date ?? a.timestamp ?? a.created_at ?? 0).getTime()
  );
  const latestWeight = sortedWeight[0]?.weight ?? null;
  const previousWeight = sortedWeight.length >= 2 ? sortedWeight[1].weight : null;
  const weightTrend =
    latestWeight != null && previousWeight != null ? latestWeight - previousWeight : null;

  const completedMissions = missions.filter((m) => m.status === "completed").length;
  const activeMissions = missions.filter(
    (m) => m.status !== "completed" && m.status !== "archived"
  ).length;
  const totalMissions = completedMissions + activeMissions;

  const displayGoals =
    goals.length > 0 ? goals.filter((g) => g.status !== "archived").slice(0, 4) : [];

  const isEmpty = !profile || Object.keys(profile).length === 0;

  return (
    <div className="flex flex-col gap-6">
      <section className="panel-neon relative overflow-hidden rounded-[28px] p-6 md:p-8">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,rgba(255,100,34,0.14),transparent_62%)]" />
        <div className="relative flex flex-col gap-3">
          <span className="hud-label text-primary">Panorama personal</span>
          <h2 className="font-heading text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            {profile?.name ? `Bienvenido, ${profile.name}` : "Bienvenido de vuelta"}
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
            {isEmpty
              ? "Activa tu perfil para desbloquear el panel completo."
              : "Tu progreso, energía, finanzas y bienestar en un solo lugar."}
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Badge className="border border-primary/30 bg-primary/10 text-primary hover:bg-primary/10">
              Todo en orden
            </Badge>
            <Badge className="border border-border bg-white/5 text-muted-foreground hover:bg-white/5">
              Un día a la vez
            </Badge>
            {quote && (
              <Badge className="max-w-full border border-white/10 bg-white/5 text-muted-foreground hover:bg-white/5">
                &ldquo;{quote}&rdquo;
              </Badge>
            )}
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          Tu resumen de hoy
        </h2>
        <p className="text-sm text-muted-foreground">
          {isEmpty
            ? "Completa tu perfil para ver tu resumen completo."
            : "Una mirada rápida a lo que importa."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-escudo-gold">
              <Zap className="h-4 w-4" /> Nivel del jugador
            </CardDescription>
            <CardTitle className="text-3xl text-foreground">
              {isEmpty ? "--" : level}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>XP</span>
                <span>
                  {isEmpty ? "-- / --" : `${xp.toLocaleString()} / ${xpToNextLevel.toLocaleString()}`}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-escudo-green transition-all"
                  style={{ width: `${isEmpty ? 0 : Math.min(xpPercent, 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-escudo-gold">
              <Target className="h-4 w-4" /> Racha actual
            </CardDescription>
            <CardTitle className="text-3xl text-foreground">
              {isEmpty ? "--" : streak}{" "}
              <span className="text-base font-normal text-muted-foreground">dias</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className="border-escudo-green/30 text-escudo-green">
              {streak > 0 ? "En racha activa" : "Empieza tu racha hoy"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-escudo-gold">
              <Wallet className="h-4 w-4" /> Balance del dia
            </CardDescription>
            <CardTitle
              className={`text-3xl ${balance >= 0 ? "text-escudo-green" : "text-escudo-red"}`}
            >
              {balance >= 0 ? "+" : "-"}${Math.abs(balance).toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Ingresos: +${todayIncome.toLocaleString()} · Gastos: -${todayExpense.toLocaleString()}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-escudo-gold">
              <Heart className="h-4 w-4" /> Peso actual
            </CardDescription>
            <CardTitle className="text-3xl text-foreground">
              {latestWeight != null ? latestWeight : "--"}{" "}
              <span className="text-base font-normal text-muted-foreground">kg</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-1 text-xs">
            {weightTrend != null ? (
              weightTrend < 0 ? (
                <>
                  <TrendingDown className="h-3 w-3 text-escudo-green" />
                  <span className="text-escudo-green">
                    {weightTrend.toFixed(1)} kg vs anterior
                  </span>
                </>
              ) : (
                <>
                  <TrendingUp className="h-3 w-3 text-escudo-red" />
                  <span className="text-escudo-red">
                    +{weightTrend.toFixed(1)} kg vs anterior
                  </span>
                </>
              )
            ) : (
              <span className="text-muted-foreground">Sin datos suficientes</span>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckSquare className="h-5 w-5 text-escudo-green" /> Resumen diario
              </CardTitle>
              <CardDescription>Progreso de tareas y habitos de hoy</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Misiones completadas</span>
                  <span className="font-medium text-escudo-green">
                    {completedMissions} / {totalMissions || "--"}
                  </span>
                </div>
                <Progress
                  value={totalMissions > 0 ? (completedMissions / totalMissions) * 100 : 0}
                  className="h-2 bg-secondary"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Metas activas</span>
                  <span className="font-medium text-escudo-cyan">
                    {goals.filter((g) => g.status === "active").length}
                  </span>
                </div>
                <Progress
                  value={
                    goals.length > 0
                      ? (goals.filter((g) => g.status === "completed").length / goals.length) *
                        100
                      : 0
                  }
                  className="h-2 bg-secondary"
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarClock className="h-4 w-4 text-escudo-cyan" />
                <span>Turnos activos: {shifts.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-5 w-5 text-escudo-gold" /> Metas activas
              </CardTitle>
              <CardDescription>Seguimiento de metas y objetivos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {displayGoals.length > 0 ? (
                displayGoals.map((goal) => {
                  const latestMetric = goal.recent_metrics?.[0];
                  const progressValue = goal.target_value
                    ? ((latestMetric?.value ?? 0) / goal.target_value) * 100
                    : goal.status === "completed"
                      ? 100
                      : 0;

                  return (
                    <div key={goal.id} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-foreground">{goal.name}</span>
                        <span className="font-medium text-escudo-green">
                          {Math.min(progressValue, 100).toFixed(0)}%
                        </span>
                      </div>
                      <Progress
                        value={Math.min(progressValue, 100)}
                        className="h-2 bg-secondary"
                      />
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <Shield className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No hay metas activas. Crea tu primera meta desde OMNI o la seccion Metas.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-5 w-5 text-escudo-cyan" /> Gastos recientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {finances.length > 0 ? (
                <div className="space-y-3">
                  {finances
                    .filter((f) => f.type === "expense")
                    .sort(
                      (a, b) =>
                        new Date(b.date ?? b.created_at ?? 0).getTime() -
                        new Date(a.date ?? a.created_at ?? 0).getTime()
                    )
                    .slice(0, 5)
                    .map((tx) => (
                      <div key={tx.id} className="flex justify-between text-sm">
                        <span className="max-w-[160px] truncate text-foreground">
                          {tx.description || tx.category || "Sin categoria"}
                        </span>
                        <span className="font-medium text-escudo-red">
                          -${(tx.amount ?? 0).toLocaleString()}
                        </span>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <Wallet className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No hay gastos registrados aun.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="h-5 w-5 text-escudo-green" /> OMNI
              </CardTitle>
              <CardDescription>Asistente de comando</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-escudo-green/20 bg-escudo-green/8 p-3 text-sm text-escudo-green">
                <p>OMNI esta listo para recibir comandos.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
