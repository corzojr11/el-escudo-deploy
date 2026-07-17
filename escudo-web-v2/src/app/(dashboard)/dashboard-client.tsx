"use client";

import {
  CalendarClock,
  Check,
  Circle,
  Heart,
  Shield,
  Sparkles,
  Target,
  Wallet,
  Zap,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { TodayResponse } from "@/lib/api/types";

function Metric({ label, value, detail, tone = "text-foreground" }: {
  label: string;
  value: string | number;
  detail: string;
  tone?: string;
}) {
  return (
    <div className="border border-border bg-card p-4">
      <p className="hud-label">{label}</p>
      <p className={`mt-2 font-heading text-3xl font-bold tracking-tight ${tone}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

interface DashboardClientProps {
  data: TodayResponse;
}

export function DashboardClient({ data }: DashboardClientProps) {
  const profile = data.profile;
  const today = data.today;
  const goals = today.active_goals ?? [];
  const missions = today.missions_today ?? [];
  const shiftStatus = today.shift_status;
  const weightLog = today.latest_weight;
  const focusStreak = today.focus_streak ?? 0;

  const level = profile?.level ?? 0;
  const xp = profile?.xp ?? 0;
  const xpToNextLevel = profile?.xp_to_next_level ?? 100;
  const xpPercent = xpToNextLevel ? Math.min((xp / xpToNextLevel) * 100, 100) : 0;
  const completedMissions = missions.filter((mission) => mission.status === "completed").length;
  const currentWeight = weightLog?.weight;
  const balance = today.balance ?? 0;
  const routeItems = goals.slice(0, 3);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 pb-8">
      <section className="grid gap-5 border-b border-border pb-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="hud-label text-primary">Commander log // 024</p>
          <h2 className="mt-3 max-w-xl font-heading text-4xl font-extrabold uppercase leading-[0.94] tracking-[-0.05em] text-foreground sm:text-6xl">
            Bitacora de<br />viaje
          </h2>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
            <span className="border border-[#5a5122] bg-[#292515] px-2 py-1 font-mono text-[11px] uppercase text-[#ffe476]">
              Estado: activo
            </span>
            <span className="text-muted-foreground">Tu ruta de evolucion personal</span>
          </div>
        </div>
        <div className="border-l-2 border-primary pl-4 lg:mb-1">
          <p className="hud-label">Expedicion actual</p>
          <p className="mt-1 font-heading text-3xl font-bold text-[#bcaeff]">{level || "--"} / 12</p>
          <p className="font-mono text-[11px] uppercase text-muted-foreground">Fases de progreso</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="hud-label">Rango actual</p>
              <h3 className="mt-1 font-heading text-2xl font-bold text-foreground">
                {profile?.name ? `Agente ${profile.name}` : "Tu siguiente nivel"}
              </h3>
            </div>
            <div className="text-right">
              <p className="hud-label">Nivel</p>
              <p className="font-heading text-4xl font-bold text-[#bcaeff]">{level || "--"}</p>
            </div>
          </div>
          <div className="mt-12 space-y-2">
            <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
              <span>XP: {xp.toLocaleString()} / {xpToNextLevel.toLocaleString()}</span>
              <span>{xpPercent.toFixed(0)}% AL SIGUIENTE NIVEL</span>
            </div>
            <Progress value={xpPercent} className="h-2 rounded-none bg-secondary [&_[data-slot=progress-indicator]]:bg-[#ffd700]" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1">
          <Metric label="Racha actual" value={focusStreak} detail="dias consecutivos" tone="text-[#ffd700]" />
          <Metric label="Misiones listas" value={routeItems.length} detail="objetivos activos" tone="text-[#bcaeff]" />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.8fr)]">
        <div className="border border-border bg-card p-5">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <p className="hud-label">Ruta semanal</p>
              <h3 className="mt-1 font-heading text-lg font-bold">Proximos hitos</h3>
            </div>
            <Target className="h-5 w-5 text-primary" />
          </div>
          <div className="mt-4 space-y-0">
            {routeItems.length ? routeItems.map((goal, index) => (
              <div key={goal.id} className="grid grid-cols-[24px_1fr_auto] gap-3 border-b border-border py-4 last:border-0">
                {index === 0 ? <Circle className="mt-0.5 h-4 w-4 text-[#ffd700]" /> : <Circle className="mt-0.5 h-4 w-4 text-[#7c5dff]" />}
                <div>
                  <p className="text-sm font-semibold text-foreground">{goal.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{goal.description || "Siguiente paso de tu ruta personal"}</p>
                </div>
                <span className="font-mono text-[10px] uppercase text-muted-foreground">Activa</span>
              </div>
            )) : (
              <div className="flex min-h-44 flex-col items-center justify-center text-center">
                <Target className="h-7 w-7 text-primary" />
                <p className="mt-3 text-sm text-muted-foreground">Crea una meta para iniciar tu primera ruta.</p>
              </div>
            )}
          </div>
        </div>

        <div className="border border-border bg-card p-5">
          <p className="hud-label">Recursos de hoy</p>
          <div className="mt-4 grid gap-3">
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <Wallet className="h-5 w-5 text-[#ffd700]" />
              <div><p className="text-xs text-muted-foreground">Balance diario</p><p className="font-heading text-xl font-bold">${balance.toLocaleString()}</p></div>
            </div>
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <Heart className="h-5 w-5 text-[#bcaeff]" />
              <div><p className="text-xs text-muted-foreground">Peso actual</p><p className="font-heading text-xl font-bold">{currentWeight ?? "--"} {currentWeight != null ? "kg" : ""}</p></div>
            </div>
            <div className="flex items-center gap-3">
              <CalendarClock className="h-5 w-5 text-primary" />
              <div><p className="text-xs text-muted-foreground">Turnos</p><p className="font-heading text-xl font-bold">{shiftStatus?.status === "in_shift" ? "En turno" : shiftStatus?.next_shift ? `Próximo: ${shiftStatus.next_shift.day}` : "Sin turnos"}</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.8fr)]">
        <div className="border border-border bg-card p-5">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div><p className="hud-label">Misiones diarias</p><h3 className="mt-1 font-heading text-lg font-bold">Acciones de hoy</h3></div>
            <span className="font-mono text-[11px] text-muted-foreground">{completedMissions} COMPLETADAS</span>
          </div>
          <div className="mt-1">
            {routeItems.length ? routeItems.map((goal, index) => (
              <div key={`mission-${goal.id}`} className="flex items-center gap-3 border-b border-border py-4 last:border-0">
                {index < completedMissions ? <Check className="h-4 w-4 text-[#7c5dff]" /> : <span className="h-4 w-4 border border-muted-foreground" />}
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{goal.name}</p><p className="font-mono text-[10px] uppercase text-muted-foreground">Progreso en curso</p></div>
                <span className="font-mono text-[10px] text-[#ffd700]">+ XP</span>
              </div>
            )) : <p className="py-8 text-center text-sm text-muted-foreground">Tu tablero esta listo para la primera mision.</p>}
          </div>
        </div>
        <div className="border border-border bg-card p-5">
          <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#7c5dff]" /><p className="hud-label">OMNI insights</p></div>
          <p className="mt-5 font-heading text-lg font-semibold leading-snug text-foreground">Tu progreso se construye con una accion clara cada dia.</p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">OMNI puede ayudarte a convertir una meta en el siguiente paso concreto.</p>
          <div className="mt-6 flex items-center gap-2 border-t border-border pt-4 text-xs text-[#ffd700]"><Zap className="h-4 w-4" /> Sistema listo para continuar</div>
        </div>
      </section>

      <footer className="flex items-center gap-2 border-t border-border pt-4 font-mono text-[10px] uppercase tracking-wide text-muted-foreground"><Shield className="h-3.5 w-3.5 text-primary" /> El Escudo // bitacora sincronizada</footer>
    </div>
  );
}
