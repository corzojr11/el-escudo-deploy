"use client";

import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Check,
  Circle,
  Droplets,
  Flame,
  Heart,
  Shield,
  Sparkles,
  Target,
  Wallet,
  Zap,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ErrorState } from "@/components/dashboard/ErrorState";
import type { TodayResponse, PlanDiarioResponse, WellnessSummary } from "@/lib/api/types";

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
  plan: PlanDiarioResponse | null;
  wellness: WellnessSummary | null;
}

export function DashboardClient({ data, plan, wellness }: DashboardClientProps) {
  const router = useRouter();
  const profile = data.profile;
  const today = data.today;
  const goals = today.active_goals ?? [];
  const missions = today.missions_today ?? [];
  const shiftStatus = today.shift_status;
  const weightLog = today.latest_weight;
  const weightTrend = today.weight_trend ?? null;
  const focusStreak = today.focus_streak ?? 0;
  const habits = today.habits_today ?? [];
  const habitsDone = habits.filter((h) => h.completed_today).length;

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
          <Metric label="Misiones listas" value={missions.length} detail="pendientes y completadas" tone="text-[#bcaeff]" />
        </div>
      </section>

      {wellness ? <section className="grid gap-4 md:grid-cols-2">
        <div className="border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <div className="relative h-16 w-16">
                <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="28" fill="none" stroke="#2A2A3C" strokeWidth="5" />
                  <circle cx="32" cy="32" r="28" fill="none" stroke={wellness.score >= 70 ? "#FFD700" : wellness.score >= 40 ? "#7C5DFF" : "#666"} strokeWidth="5"
                    strokeDasharray={`${wellness.score * 1.76} 176`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-mono text-lg font-bold text-white">{wellness.score}</span>
                </div>
              </div>
            </div>
            <div>
              <p className="hud-label">Wellness Score</p>
              <p className="text-xs text-muted-foreground">{wellness.completeness}% datos disponibles</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {wellness.factors.slice(0, 4).map((f) => (
                  <span key={f.name} className={`text-[9px] px-1.5 py-0.5 border ${f.score !== null ? "border-[#2A2A3C] text-gray-300" : "border-dashed border-gray-600 text-gray-600"}`}>
                    {f.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="border border-border bg-card p-5">
          <p className="hud-label">Insight semanal</p>
          <p className="mt-2 text-sm leading-relaxed text-gray-300">{wellness.insight}</p>
          {wellness.action_route && wellness.action_label && (
            <a href={wellness.action_route} className="mt-3 inline-block text-xs text-[#7C5DFF] hover:underline">
              {wellness.action_label} →
            </a>
          )}
        </div>
      </section> : (
        <ErrorState title="No se pudo cargar Wellness" message="El resto del tablero sigue disponible. Reintenta para actualizar tu score e insight semanal." onRetry={() => router.refresh()} />
      )}

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
              <div>
                <p className="text-xs text-muted-foreground">Peso actual</p>
                <p className="font-heading text-xl font-bold">{currentWeight ?? "--"} {currentWeight != null ? "kg" : ""}</p>
                {weightTrend != null && (
                  <p className={`text-[10px] ${weightTrend < 0 ? "text-[#7c5dff]" : "text-[#ffd700]"}`}>
                    {weightTrend > 0 ? "+" : ""}{weightTrend} kg vs anterior
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <Flame className="h-5 w-5 text-[#ffd700]" />
              <div><p className="text-xs text-muted-foreground">Hábitos hoy</p><p className="font-heading text-xl font-bold">{habitsDone} / {habits.length}</p></div>
            </div>
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <Droplets className="h-5 w-5 text-[#7C5DFF]" />
              <div>
                <p className="text-xs text-muted-foreground">Hidratacion diaria</p>
                <p className="font-heading text-xl font-bold">
                  {today.hydration_ml != null ? `${today.hydration_ml} ml` : "--"}
                </p>
                <p className="text-[10px] text-muted-foreground">Guia general (peso x 35 ml)</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CalendarClock className="h-5 w-5 text-primary" />
              <div><p className="text-xs text-muted-foreground">Turnos</p><p className="font-heading text-xl font-bold">{shiftStatus?.status === "in_shift" ? "En turno" : shiftStatus?.next_shift ? `Próximo: ${shiftStatus.next_shift.day}` : "Sin turnos"}</p></div>
            </div>
          </div>
        </div>
      </section>

      {plan ? <section className="border border-border bg-card p-5">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <p className="hud-label">Plan del dia</p>
            <h3 className="mt-1 font-heading text-lg font-bold">Tu cronograma</h3>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">{plan.date}</span>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <p className="hud-label text-[#7C5DFF]">Turno</p>
            {plan.shift_status?.status === "in_shift" && plan.shift_status.shift ? (
              <>
                <p className="text-sm text-white">
                  {plan.shift_status.shift.day} {plan.shift_status.shift.start} – {plan.shift_status.shift.end}
                </p>
                <p className="text-[10px] text-gray-500">+{plan.sleep.commute_minutes} min traslado</p>
              </>
            ) : plan.shift_status?.next_shift ? (
              <p className="text-sm text-white">
                Proximo: {plan.shift_status.next_shift.day} {plan.shift_status.next_shift.start}
              </p>
            ) : (
              <p className="text-sm text-gray-400">Sin turnos registrados</p>
            )}
          </div>
          <div className="space-y-1">
            <p className="hud-label text-[#FFD700]">Sueno</p>
            {plan.sleep.windows.length > 0 ? (
              <>
                <p className="text-sm text-white">
                  {plan.sleep.windows[0].sleep_time} – {plan.sleep.windows[0].wake_time}
                </p>
                <p className="text-[10px] text-gray-500">
                  {plan.sleep.windows[0].cycles} ciclos · {plan.sleep.windows[0].hours}h
                </p>
                {plan.sleep.fatigue_alert && (
                  <p className="text-[10px] text-red-400">{plan.sleep.fatigue_alert}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-400">Configura tus ajustes</p>
            )}
          </div>
          <div className="space-y-1">
            <p className="hud-label text-[#7C5DFF]">Entreno</p>
            {plan.workout ? (
              <>
                <p className="text-sm text-white">
                  {plan.workout.start} – {plan.workout.end}
                </p>
                <p className="text-[10px] text-gray-500">{plan.workout.duration_min} min · {plan.workout.label}</p>
              </>
            ) : (
              <p className="text-sm text-gray-500">Recuperacion / descanso activo</p>
            )}
          </div>
        </div>
        {plan.missing_config.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <p className="text-xs text-gray-400">
              Completa tu configuracion en{" "}
              {plan.missing_config.includes("perfil") && <a href="/perfil" className="text-[#7C5DFF] underline">Perfil</a>}
              {plan.missing_config.includes("turnos") && <a href="/turnos" className="text-[#7C5DFF] underline"> Turnos</a>}
              {plan.missing_config.includes("ajustes") && <a href="/turnos" className="text-[#7C5DFF] underline"> Ajustes</a>}
              {" "}para ver tu plan personalizado.
            </p>
          </div>
        )}
        <p className="mt-3 text-[10px] text-gray-600">{plan.disclaimer}</p>
      </section> : (
        <ErrorState title="No se pudo cargar el plan del dia" message="El resto del tablero sigue disponible. Reintenta para ver tu horario de sueno, turno y entrenamiento." onRetry={() => router.refresh()} />
      )}

      <section className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.8fr)]">
        <div className="border border-border bg-card p-5">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div><p className="hud-label">Misiones diarias</p><h3 className="mt-1 font-heading text-lg font-bold">Acciones de hoy</h3></div>
            <span className="font-mono text-[11px] text-muted-foreground">{completedMissions} / {missions.length} COMPLETADAS</span>
          </div>
          <div className="mt-1">
            {missions.length ? missions.map((mission) => {
              const isDone = mission.status === "completed";
              const missionName = mission.name || mission.title || "Sin nombre";
              return (
                <div key={mission.id} className="flex items-center gap-3 border-b border-border py-4 last:border-0">
                  {isDone ? <Check className="h-4 w-4 text-[#7c5dff]" /> : <span className="h-4 w-4 border border-muted-foreground" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{missionName}</p>
                    <p className="font-mono text-[10px] uppercase text-muted-foreground">
                      {mission.priority === "high" ? "Alta" : mission.priority === "medium" ? "Media" : "Baja"} · {isDone ? "Completada" : "Pendiente"}
                    </p>
                  </div>
                  <span className="font-mono text-[10px] text-[#ffd700]">+ {mission.xp_reward || 0} XP</span>
                </div>
              );
            }) : <p className="py-8 text-center text-sm text-muted-foreground">Tu tablero esta listo para la primera mision. <a href="/misiones" className="text-[#7C5DFF] underline">Crea una</a>.</p>}
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
