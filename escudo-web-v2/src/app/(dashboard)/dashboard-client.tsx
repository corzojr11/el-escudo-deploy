"use client";

import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CalendarClock,
  Check,
  Circle,
  Droplets,
  Flame,
  Heart,
  Shield,
  Sparkles,
  Target,
  TrendingDown,
  Wallet,
  Zap,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ErrorState } from "@/components/dashboard/ErrorState";
import type { Debt, FixedExpense, TodayResponse, PlanDiarioResponse, WellnessSummary } from "@/lib/api/types";

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
  stability: DashboardStabilityData;
}

export interface DashboardStabilityData {
  budget: number | null;
  monthExpense: number | null;
  fixedExpenses: FixedExpense[];
  debts: Debt[];
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
}

export function DashboardClient({ data, plan, wellness, stability }: DashboardClientProps) {
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
  const survivalMode = plan?.shift_status?.status === "in_shift" || Boolean(plan?.sleep.fatigue_alert);
  const survivalReason = plan?.shift_status?.status === "in_shift"
    ? "Estas en turno. Hoy la meta es sostener lo importante, no llenar mas pendientes."
    : plan?.sleep.fatigue_alert
      ? "Tu descanso necesita prioridad. Reduce la carga y protege una accion posible."
      : null;
  const priorityHabit = habits.find((habit) => !habit.completed_today);

  const level = profile?.level ?? 0;
  const xp = profile?.xp ?? 0;
  const xpToNextLevel = profile?.xp_to_next_level ?? 100;
  const xpPercent = xpToNextLevel ? Math.min((xp / xpToNextLevel) * 100, 100) : 0;
  const completedMissions = missions.filter((mission) => mission.status === "completed").length;
  const currentWeight = weightLog?.weight;
  const balance = today.balance ?? 0;
  const routeItems = goals.slice(0, 3);
  const pendingFixed = stability.fixedExpenses.filter((expense) => !expense.is_paid);
  const totalPendingFixed = pendingFixed.reduce((total, expense) => total + Number(expense.amount || 0), 0);
  const activeDebts = stability.debts.filter((debt) => (debt.remaining ?? 0) > 0);
  const totalDebt = activeDebts.reduce((total, debt) => total + Number(debt.remaining || 0), 0);
  const debtCommitment = activeDebts.reduce((total, debt) => total + Number(debt.monthly_payment || 0), 0);
  const availableBudget = stability.budget && stability.monthExpense != null ? stability.budget - stability.monthExpense : null;
  const immediateAction = plan?.shift_status?.status === "in_shift"
    ? { label: "Estás en turno: protege tu energía y deja una sola misión ligera para después.", href: "/turnos", cta: "Ver turno" }
    : plan?.sleep.fatigue_alert
      ? { label: "Tu descanso está comprometido por el próximo turno. Prioriza recuperar sueño hoy.", href: "/salud", cta: "Registrar sueño" }
      : availableBudget != null && availableBudget < totalPendingFixed + debtCommitment
        ? { label: "Tu margen del mes no cubre los compromisos pendientes. Revisa gastos fijos y abonos antes de hacer compras nuevas.", href: "/finanzas", cta: "Revisar finanzas" }
        : missions.some((mission) => mission.status !== "completed")
        ? { label: "Elige una sola misión pendiente y ciérrala antes de abrir otra tarea.", href: "/misiones", cta: "Ver misiones" }
        : { label: "Tu día está despejado. Define el siguiente paso que más protege tu futuro.", href: "/metas", cta: "Definir meta" };

  const visibleMissions = survivalMode
    ? missions.filter((mission) => mission.status !== "completed").slice(0, 1)
    : missions.slice(0, 3);
  const focusMessage = survivalMode
    ? "Reduce el alcance: una misión ligera y un hábito base son suficiente para hoy."
    : missions.filter((mission) => mission.status !== "completed").length > 3
      ? "Tienes varias misiones abiertas. Elige solo una antes de sumar otra."
      : availableBudget != null && availableBudget < totalPendingFixed + debtCommitment
        ? "Tu dinero ya tiene compromisos asignados. Protege el margen antes de convertirlo en otro gasto."
        : goals.length === 0
        ? "Convierte una intención importante en una meta antes de abrir más tareas."
        : "Tu siguiente avance está en cerrar una misión que ya sostiene una meta activa.";

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 pb-8">
      <section className="grid gap-5 border-b border-border pb-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="hud-label text-primary">Commander log // 024</p>
          <h2 className="mt-3 max-w-xl font-heading text-4xl font-extrabold uppercase leading-[0.94] tracking-[-0.05em] text-foreground sm:text-6xl">
            Bitácora de<br />viaje
          </h2>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
            <span className="border border-[#5a5122] bg-[#292515] px-2 py-1 font-mono text-[11px] uppercase text-[#ffe476]">
              Estado: activo
            </span>
            <span className="text-muted-foreground">Tu ruta de evolucion personal</span>
            <a href="/plan-semanal" className="inline-flex items-center gap-2 border border-[#7C5DFF] px-3 py-2 font-mono text-[11px] uppercase text-[#d5ccff] hover:bg-[#7C5DFF] hover:text-black">
              <CalendarDays className="h-4 w-4" /> Abrir plan semanal
            </a>
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
          <Metric label="Racha actual" value={focusStreak} detail="días consecutivos" tone="text-[#ffd700]" />
          <Metric label="Misiones listas" value={missions.length} detail="pendientes y completadas" tone="text-[#bcaeff]" />
        </div>
      </section>

      {survivalMode && survivalReason && (
        <section className="border border-[#7C5DFF] bg-card p-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="hud-label text-[#bcaeff]">Modo supervivencia</p>
              <h3 className="mt-1 font-heading text-lg font-bold text-foreground">Hoy basta con sostener lo esencial</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{survivalReason}</p>
            </div>
            <a href={immediateAction.href} className="shrink-0 border border-[#7C5DFF] px-3 py-2 font-mono text-[11px] uppercase text-[#d5ccff] hover:bg-[#7C5DFF] hover:text-black">
              {immediateAction.cta}
            </a>
          </div>
          <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
            <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Una mision:</span> {visibleMissions[0]?.name || visibleMissions[0]?.title || "No agregues una nueva hasta cerrar lo urgente."}</p>
            <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Un habito:</span> {priorityHabit?.name || "Tu descanso ya cuenta como prioridad."}</p>
          </div>
        </section>
      )}

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
            <p className="hud-label">Plan del día</p>
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
            <p className="hud-label text-[#FFD700]">Sueño</p>
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
        <ErrorState title="No se pudo cargar el plan del día" message="El resto del tablero sigue disponible. Reintenta para ver tu horario de sueño, turno y entrenamiento." onRetry={() => router.refresh()} />
      )}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.8fr)]">
        <div className="border border-border bg-card p-5">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <p className="hud-label">Siguiente paso</p>
              <h3 className="mt-1 font-heading text-lg font-bold">Una acción, no diez pendientes</h3>
            </div>
            <Zap className="h-5 w-5 text-[#ffd700]" />
          </div>
          <p className="mt-5 max-w-xl text-sm leading-6 text-gray-300">{immediateAction.label}</p>
          <a href={immediateAction.href} className="mt-5 inline-block border border-[#7C5DFF] px-3 py-2 font-mono text-[11px] uppercase text-[#bcaeff] hover:bg-[#7C5DFF] hover:text-black">
            {immediateAction.cta} →
          </a>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-[#bcaeff]" />
            <p className="hud-label">Estabilidad financiera</p>
          </div>
          {stability.budget && stability.monthExpense != null ? (
            <>
              <p className="mt-4 text-xs text-muted-foreground">Disponible del presupuesto este mes</p>
              <p className={`font-heading text-2xl font-bold ${availableBudget != null && availableBudget < 0 ? "text-red-400" : "text-[#ffd700]"}`}>
                {formatCurrency(availableBudget ?? 0)}
              </p>
            </>
          ) : (
            <p className="mt-4 text-sm text-gray-300">Configura un presupuesto para ver cuánto margen real tienes este mes.</p>
          )}
          <div className="mt-4 space-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
            <p>Gastos fijos pendientes: <span className="font-mono text-gray-200">{formatCurrency(totalPendingFixed)}</span></p>
            <p>Abonos mensuales de deuda: <span className="font-mono text-gray-200">{formatCurrency(debtCommitment)}</span></p>
            <p>Saldo total de deudas: <span className="font-mono text-gray-200">{formatCurrency(totalDebt)}</span></p>
          </div>
          <a href="/finanzas" className="mt-4 inline-block text-xs text-[#7C5DFF] hover:underline">Ordenar finanzas →</a>
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.8fr)]">
        <div className="border border-border bg-card p-5">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div><p className="hud-label">Misiones diarias</p><h3 className="mt-1 font-heading text-lg font-bold">Acciones de hoy</h3></div>
            <span className="font-mono text-[11px] text-muted-foreground">{completedMissions} / {missions.length} COMPLETADAS</span>
          </div>
          <div className="mt-1">
            {visibleMissions.length ? visibleMissions.map((mission) => {
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
            }) : <p className="py-8 text-center text-sm text-muted-foreground">Tu tablero está listo para la primera misión. <a href="/misiones" className="text-[#7C5DFF] underline">Crea una</a>.</p>}
          </div>
        </div>
        <div className="border border-border bg-card p-5">
          <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#7c5dff]" /><p className="hud-label">OMNI insights</p></div>
          <p className="mt-5 font-heading text-lg font-semibold leading-snug text-foreground">{focusMessage}</p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">OMNI puede ayudarte a aterrizarlo sin convertirlo en otro formulario.</p>
          <a href="/omni" className="mt-4 inline-flex border border-[#7C5DFF] px-3 py-2 font-mono text-[11px] uppercase text-[#d5ccff] hover:bg-[#7C5DFF] hover:text-black">Hablar con OMNI</a>
          <div className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-xs text-[#ffd700]"><Zap className="h-4 w-4" /> Sistema listo para continuar</div>
        </div>
      </section>

      <footer className="flex items-center gap-2 border-t border-border pt-4 font-mono text-[10px] uppercase tracking-wide text-muted-foreground"><Shield className="h-3.5 w-3.5 text-primary" /> El Escudo // bitácora sincronizada</footer>
    </div>
  );
}
