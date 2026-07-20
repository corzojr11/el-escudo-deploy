"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  Plus,
  Trash2,
  Loader2,
  Timer,
  Play,
  Square,
  Pencil,
  Route,
  Moon,
  AlarmClock,
  CircleAlert,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createShift, updateShift, deleteShift } from "@/app/actions/turnos";
import { upsertBioSettings } from "@/app/actions/plan";
import { FormStatus } from "@/components/dashboard/FormStatus";
import { SubmitButton } from "@/components/dashboard/SubmitButton";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { ErrorState } from "@/components/dashboard/ErrorState";
import type { Shift, CurrentStatusResponse, PlanDiarioResponse } from "@/lib/api/types";

const DAYS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];
const DAY_ORDER: Record<string, number> = Object.fromEntries(DAYS.map((d, i) => [d, i]));

function sortByDay(shifts: Shift[]): Shift[] {
  return [...shifts].sort((a, b) => (DAY_ORDER[a.day] ?? 99) - (DAY_ORDER[b.day] ?? 99));
}

function formatRemaining(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  return `${hours.toFixed(1)}h`;
}

const CYCLE_MINUTES = 90;
const SLEEP_LATENCY_MINUTES = 15;
const CYCLE_OPTIONS = [4, 5, 6];

function bogotaMinutesNow(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return value("hour") * 60 + value("minute");
}

function timeToMinutes(value: string): number {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function formatClock(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

interface TurnosClientProps {
  shifts: Shift[];
  currentStatus: CurrentStatusResponse;
  bioSettings: Record<string, unknown> | null;
  plan: PlanDiarioResponse | null;
  loadErrors: string[];
  criticalError: boolean;
  conflicts?: any[];
}

export function TurnosClient({ shifts, currentStatus, bioSettings, plan, loadErrors, criticalError, conflicts = [] }: TurnosClientProps) {
  const router = useRouter();
  const [shiftList, setShiftList] = useState<Shift[]>(sortByDay(shifts));
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formStatus, setFormStatus] = useState<{ success?: string; error?: string }>({});
  const [formKey, setFormKey] = useState(0);
  const [wakeTime, setWakeTime] = useState(String(bioSettings?.t_wake_target || "06:00"));
  const [sleepTime, setSleepTime] = useState(String(bioSettings?.t_sleep_target || "22:30"));
  const [commuteMin, setCommuteMin] = useState(String(bioSettings?.commute_minutes || 35));
  const [savingBio, setSavingBio] = useState(false);
  const [bioMsg, setBioMsg] = useState<{ success?: string; error?: string }>({});
  const [nowMinutes, setNowMinutes] = useState(bogotaMinutesNow);
  const [targetWakeTime, setTargetWakeTime] = useState(plan?.sleep.wake_target ?? wakeTime);
  const [overrideStatus, setOverrideStatus] = useState<string>(
    (bioSettings?.today_override_status as string) || "normal"
  );

  async function handleStatusOverride(status: string) {
    setOverrideStatus(status);
    setBioMsg({});
    try {
      await upsertBioSettings({
        t_wake_target: wakeTime,
        t_sleep_target: sleepTime,
        commute_minutes: parseInt(commuteMin) || 35,
        today_override_status: status,
        today_override_date: plan?.date || new Date().toLocaleDateString("en-CA"),
      });
      setBioMsg({ success: `Estado cambiado a ${status === 'rest' ? 'Descanso' : status === 'travel' ? 'Viaje' : 'Normal'}.` });
      router.refresh();
    } catch (e) {
      setBioMsg({ error: e instanceof Error ? e.message : "Error al cambiar el estado" });
    }
  }

  async function handleCreate(formData: FormData) {
    setFormStatus({});
    const result = await createShift(null, formData);
    if (result.success) {
      setFormStatus({ success: "Turno creado correctamente." });
      setCreating(false);
      setFormKey((k) => k + 1);
      router.refresh();
    } else {
      setFormStatus({ error: result.error ?? "Error al crear el turno" });
    }
  }

  async function handleUpdate(shiftId: string, formData: FormData) {
    setFormStatus({});
    const result = await updateShift(shiftId, formData);
    if (result.success) {
      setFormStatus({ success: "Turno actualizado correctamente." });
      setEditingId(null);
      router.refresh();
    } else {
      setFormStatus({ error: result.error ?? "Error al actualizar el turno" });
    }
  }

  const handleDelete = async (shiftId: string, shiftLabel: string) => {
    if (!window.confirm(`Eliminar el turno del ${shiftLabel}?`)) return;
    const removed = shiftList.find((s) => s.id === shiftId);
    setDeletingId(shiftId);
    setShiftList((prev) => prev.filter((s) => s.id !== shiftId));
    setFormStatus({});

    const result = await deleteShift(shiftId);
    setDeletingId(null);

    if (!result.success) {
      if (removed) setShiftList((prev) => sortByDay([...prev, removed]));
      setFormStatus({ error: result.error ?? "Error al eliminar el turno" });
    }
  };

  const inShift = currentStatus.status === "in_shift";
  const currentShift = currentStatus.shift ?? null;
  const nextShift = currentStatus.next_shift ?? null;
  const hasRegisteredShifts = shiftList.length > 0;
  const prepMinutes = Math.max(0, Number(commuteMin) || 0) + 45;
  const minutesUntilPreparation = nextShift ? Math.round(nextShift.starts_in_hours * 60 - prepMinutes) : null;

  const preparationGuidance = inShift
    ? {
        title: "Protege tu energía durante el turno",
        message: "Evita comprometer tareas exigentes antes de terminar. Al salir, decide entre descanso o una sola misión ligera.",
      }
    : nextShift && minutesUntilPreparation !== null
      ? minutesUntilPreparation <= 0
        ? {
            title: "Es hora de prepararte",
            message: `Tu turno empieza ${nextShift.day} a las ${nextShift.start}. Reserva ${prepMinutes} min para preparación y traslado.`,
          }
        : {
          title: "Tu siguiente bloque útil",
            message: `Tienes ${formatRemaining(minutesUntilPreparation / 60)} antes de prepararte para el turno. Elige una sola tarea importante.`,
          }
      : {
          title: "Espacio disponible para tu plan",
          message: "No tienes un turno próximo registrado. Usa este espacio para una misión, una rutina o recuperación.",
        };

  const sleepWindows = plan?.sleep.windows ?? [];
  const recommendedCycles = plan?.sleep.recommended_cycles ?? null;
  const sleepNowWindows = CYCLE_OPTIONS.map((cycles) => ({
    cycles,
    wakeTime: formatClock(nowMinutes + SLEEP_LATENCY_MINUTES + cycles * CYCLE_MINUTES),
  }));
  const wakeTargetWindows = CYCLE_OPTIONS.map((cycles) => ({
    cycles,
    sleepTime: formatClock(timeToMinutes(targetWakeTime) - SLEEP_LATENCY_MINUTES - cycles * CYCLE_MINUTES),
  }));
  const openBioSettings = () => document.getElementById("ajustes-biologicos")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const openShiftCreator = () => {
    setCreating(true);
    setEditingId(null);
    setFormStatus({});
    requestAnimationFrame(() => document.getElementById("horario-semanal")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  if (criticalError) {
    return <ErrorState title="No se pudieron cargar tus turnos" message="No mostraremos una agenda vacia como si fuera tu horario real. Reintenta para cargar Turnos." onRetry={() => router.refresh()} />;
  }

  return (
    <div className="flex flex-col gap-6">
      {loadErrors.length > 0 && (
        <ErrorState
          title="Algunos datos de Turnos no se pudieron cargar"
          message={`Tu agenda sigue disponible. Pendiente de actualizar: ${loadErrors.join(", ")}.`}
          onRetry={() => router.refresh()}
        />
      )}

      {conflicts && conflicts.length > 0 && (
        <div className="border border-escudo-red/35 bg-escudo-red/10 p-4 rounded-xl flex flex-col gap-2">
          <p className="hud-label text-escudo-red font-bold flex items-center gap-1.5">
            <CircleAlert className="h-4 w-4" /> Alerta de Riesgo Biológico / Horario
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-muted-foreground">
            {conflicts.map((conflict: any, idx: number) => (
              <li key={idx} className="leading-relaxed">
                <span className="text-[#FF7F7F] font-semibold">[{conflict.type}]</span> {conflict.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      <section className="panel-neon relative overflow-hidden rounded-[28px] p-6">
        <div className="relative flex flex-col gap-3">
          <span className="hud-label text-accent">Time Grid</span>
          <h2 className="font-heading text-3xl font-black tracking-[0.1em] text-glow text-foreground md:text-4xl">
            TURNOS
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
            Controla estado en vivo, proximo turno y agenda semanal desde un panel tactico.
          </p>
        </div>
      </section>

      <Card className="border-accent/35">
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
          <div>
            <span className="hud-label text-accent">Sleep Protocol</span>
            <CardTitle className="flex items-center gap-2 text-base">
              <Moon className="h-5 w-5 text-accent" /> Tus ciclos de sueño
            </CardTitle>
            <CardDescription>
              {hasRegisteredShifts
                ? "Calculado desde tu siguiente turno, con traslado y preparación incluidos."
                : `Por ahora usa tu alarma manual de ${plan?.sleep.wake_target ?? wakeTime}. Registra tus turnos para calcularlo desde tu horario laboral.`}
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={openBioSettings}>
            Ajustar horario
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 rounded-xl border border-[#2A2A3C] bg-[#14141B] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Modo para hoy</p>
              <p className="text-xs text-gray-400">¿Estás de viaje, descanso o jornada normal?</p>
              {bioMsg.success && <p className="text-xs text-emerald-400 mt-1">{bioMsg.success}</p>}
              {bioMsg.error && <p className="text-xs text-red-400 mt-1">{bioMsg.error}</p>}
            </div>
            <select
              value={overrideStatus}
              onChange={(e) => handleStatusOverride(e.target.value)}
              className="h-9 rounded-lg border border-[#2A2A3C] bg-[#0C0C0E] px-3 py-1 text-xs text-white outline-none focus-visible:border-accent w-full sm:w-auto"
            >
              <option value="normal">Normal (Seguir turnos)</option>
              <option value="rest">Día de descanso</option>
              <option value="travel">Viaje / Fuera de la ciudad</option>
            </select>
          </div>

          {!hasRegisteredShifts && (
            <div className="flex flex-col gap-3 rounded-xl border border-escudo-gold/35 bg-escudo-gold/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-3xl">
                <p className="font-medium text-foreground">Aún falta tu horario laboral</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Si entras a trabajar a las 06:00, la app debe despertarte antes. Al registrar los días y la hora de entrada, restará {prepMinutes} min de preparación y traslado antes de calcular tus ciclos.
                </p>
              </div>
              <Button type="button" size="sm" onClick={openShiftCreator} className="shrink-0">
                <Plus className="mr-1.5 h-4 w-4" /> Registrar horario
              </Button>
            </div>
          )}
          {sleepWindows.length > 0 ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                {sleepWindows.map((window) => {
                  const recommended = window.cycles === recommendedCycles;
                  return (
                    <div
                      key={window.cycles}
                      className={cn(
                        "rounded-xl border px-4 py-3",
                        recommended ? "border-escudo-gold/55 bg-escudo-gold/5" : "border-border/70 bg-background/35",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-foreground">{window.cycles} ciclos</span>
                        {recommended && <Badge className="bg-escudo-gold/15 text-escudo-gold">Sugerido</Badge>}
                      </div>
                      <p className="mt-2 text-xl font-bold text-foreground">{window.sleep_time}</p>
                      <p className="text-xs text-muted-foreground">Acostarte para despertar a las {window.wake_time}</p>
                      <p className="mt-1 text-xs text-accent">{window.hours.toFixed(1)} horas de descanso</p>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><AlarmClock className="h-3.5 w-3.5 text-accent" /> Incluye 15 min para conciliar el sueño</span>
                <span className="flex items-center gap-1.5"><Route className="h-3.5 w-3.5 text-accent" /> Traslado: {plan?.sleep.commute_minutes ?? commuteMin} min</span>
              </div>
              {plan?.sleep.fatigue_alert && (
                <p className="flex items-start gap-2 rounded-lg border border-escudo-gold/25 bg-escudo-gold/5 p-3 text-xs leading-5 text-muted-foreground">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-escudo-gold" />
                  {plan.sleep.fatigue_alert}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Configura tu hora de despertar y traslado para calcular tus ciclos de sueño.</p>
          )}
          <div className="grid gap-3 border-t border-border/70 pt-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border/70 bg-background/35 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">Si te acuestas ahora</p>
                  <p className="mt-1 text-xs text-muted-foreground">Hora real de Bogotá: {formatClock(nowMinutes)}. Incluye 15 min para conciliar el sueño.</p>
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setNowMinutes(bogotaMinutesNow())} aria-label="Actualizar hora actual">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {sleepNowWindows.map((window) => (
                  <div key={window.cycles} className="rounded-lg border border-border/70 p-2 text-center">
                    <p className="text-xs text-muted-foreground">{window.cycles} ciclos</p>
                    <p className="mt-1 text-base font-bold text-foreground">{window.wakeTime}</p>
                    {window.cycles === 5 && <p className="mt-1 text-[10px] font-medium text-escudo-gold">Equilibrado</p>}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/35 p-4">
              <label className="font-medium text-foreground" htmlFor="wake-target-calculator">Si quieres despertar a</label>
              <div className="mt-2 flex items-center gap-3">
                <input
                  id="wake-target-calculator"
                  type="time"
                  value={targetWakeTime}
                  onChange={(event) => setTargetWakeTime(event.target.value)}
                  className="h-10 rounded-lg border border-border/80 bg-input/80 px-3 text-sm text-foreground outline-none focus-visible:border-accent/60"
                />
                <span className="text-xs text-muted-foreground">acostarte a:</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {wakeTargetWindows.map((window) => (
                  <div key={window.cycles} className="rounded-lg border border-border/70 p-2 text-center">
                    <p className="text-xs text-muted-foreground">{window.cycles} ciclos</p>
                    <p className="mt-1 text-base font-bold text-foreground">{window.sleepTime}</p>
                    {window.cycles === 5 && <p className="mt-1 text-[10px] font-medium text-escudo-gold">Equilibrado</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={cn(inShift && "border-escudo-green/30")}>
        <CardHeader className="pb-3">
          <span className="hud-label text-accent">Live Status</span>
          <CardTitle className="flex items-center gap-2 text-base">
            <div className={cn("flex h-3 w-3 items-center justify-center rounded-full", inShift ? "bg-escudo-green" : "bg-muted-foreground")}>
              <span className={cn("h-2 w-2 rounded-full", inShift ? "animate-pulse-led bg-escudo-green" : "bg-muted-foreground")} />
            </div>
            Estado actual
          </CardTitle>
          <CardDescription>{currentStatus.message_short}</CardDescription>
        </CardHeader>
        <CardContent>
          {inShift && currentShift ? (
            <div className="flex flex-wrap items-center gap-4">
              <Badge variant="outline" className="border-escudo-green/40 bg-escudo-green/10 px-3 py-1 text-escudo-green">
                <Play className="mr-1.5 h-3.5 w-3.5" />
                En turno
              </Badge>
              <span className="text-sm text-foreground">
                <span className="text-muted-foreground">Día:</span> {currentShift.day}
              </span>
              <span className="text-sm text-foreground">
                <span className="text-muted-foreground">Horario:</span> {currentShift.start} - {currentShift.end}
              </span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-escudo-cyan">
                <Timer className="h-4 w-4" />
                {formatRemaining(currentShift.remaining_hours)} restantes
              </span>
            </div>
          ) : nextShift ? (
            <div className="flex flex-wrap items-center gap-4">
              <Badge variant="outline" className="border-muted-foreground/30 bg-muted/20 px-3 py-1 text-muted-foreground">
                <Square className="mr-1.5 h-3.5 w-3.5" />
                Libre
              </Badge>
              <span className="text-sm text-foreground">
                <span className="text-muted-foreground">Proximo:</span> {nextShift.day} {nextShift.start} - {nextShift.end}
              </span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-escudo-gold">
                <Clock className="h-4 w-4" />
                En {formatRemaining(nextShift.starts_in_hours)}
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/35 p-4">
              <div>
                <p className="font-medium text-foreground">Aún no has registrado turnos</p>
                <p className="text-sm text-muted-foreground">Agrega tu horario para que el plan de sueño y tus bloques libres se adapten a tu vida real.</p>
              </div>
              <Button type="button" size="sm" onClick={openShiftCreator}>
                <Plus className="mr-1.5 h-4 w-4" /> Agregar turno
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card id="horario-semanal">
        <CardHeader className="pb-3">
          <span className="hud-label text-accent">Preparation Window</span>
          <CardTitle className="flex items-center gap-2 text-base">
            <Route className="h-5 w-5 text-accent" /> {preparationGuidance.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{preparationGuidance.message}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <span className="hud-label text-accent">Weekly Map</span>
            <CardTitle className="text-base">Horario semanal</CardTitle>
            <CardDescription>
              {shiftList.length > 0 ? `${shiftList.length} turnos registrados` : "Sin turnos registrados"}
            </CardDescription>
          </div>
          <Button
            onClick={() => {
              setCreating(!creating);
              setEditingId(null);
              setFormStatus({});
            }}
            size="sm"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            {creating ? "Cancelar" : "Agregar"}
          </Button>
        </CardHeader>
        <CardContent>
          {creating && (
            <div className="mb-4 rounded-2xl border border-border/70 bg-background/35 p-4">
              <form key={formKey} action={handleCreate} className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Día</label>
                  <select
                    name="day"
                    required
                    className="h-11 rounded-xl border border-border/80 bg-input/80 px-3 py-2 text-sm text-foreground outline-none transition-all focus-visible:border-accent/60 focus-visible:ring-3 focus-visible:ring-accent/20"
                  >
                    <option value="">Seleccionar...</option>
                    {DAYS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Inicio</label>
                  <input
                    name="start"
                    type="time"
                    required
                    className="h-11 rounded-xl border border-border/80 bg-input/80 px-3 py-2 text-sm text-foreground outline-none transition-all focus-visible:border-accent/60 focus-visible:ring-3 focus-visible:ring-accent/20"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Fin</label>
                  <input
                    name="end"
                    type="time"
                    required
                    className="h-11 rounded-xl border border-border/80 bg-input/80 px-3 py-2 text-sm text-foreground outline-none transition-all focus-visible:border-accent/60 focus-visible:ring-3 focus-visible:ring-accent/20"
                  />
                </div>
                <SubmitButton>Guardar</SubmitButton>
              </form>
              <div className="mt-3">
                <FormStatus {...formStatus} />
              </div>
            </div>
          )}

          {!creating && <FormStatus {...formStatus} />}

          {shiftList.length === 0 && !creating ? (
            <EmptyState title="Agenda vacia" message="No hay turnos registrados." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shiftList.map((shift) => (
                <div
                  key={shift.id}
                  className="rounded-2xl border border-border/70 bg-background/35 px-4 py-3 transition-colors hover:border-accent/35"
                >
                  {editingId === shift.id ? (
                    <form action={(formData) => handleUpdate(shift.id, formData)} className="flex flex-wrap items-end gap-2">
                      <select
                        name="day"
                        defaultValue={shift.day}
                        required
                        className="h-9 rounded-lg border border-border/80 bg-input/80 px-2 text-sm"
                      >
                        {DAYS.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                      <input
                        name="start"
                        type="time"
                        defaultValue={shift.start}
                        required
                        className="h-9 rounded-lg border border-border/80 bg-input/80 px-2 text-sm"
                      />
                      <input
                        name="end"
                        type="time"
                        defaultValue={shift.end}
                        required
                        className="h-9 rounded-lg border border-border/80 bg-input/80 px-2 text-sm"
                      />
                      <SubmitButton>Guardar</SubmitButton>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Cancelar
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-foreground">{shift.day}</span>
                        <span className="text-xs text-muted-foreground">
                          {shift.start} - {shift.end}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(shift.id);
                            setCreating(false);
                            setFormStatus({});
                          }}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent/10 hover:text-accent"
                          title="Editar turno"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(shift.id, `${shift.day} ${shift.start}-${shift.end}`)}
                          disabled={deletingId === shift.id}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-escudo-red/10 hover:text-escudo-red"
                          title="Eliminar turno"
                        >
                          {deletingId === shift.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card id="ajustes-biologicos" className="border-[#2A2A3C] bg-[#17171A]">
        <CardHeader>
          <CardTitle className="text-[#FFD700]">Ajustes biologicos</CardTitle>
          <CardDescription>Configura tu ritmo circadiano y traslado</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {bioMsg.success && <FormStatus success={bioMsg.success} />}
          {bioMsg.error && <FormStatus error={bioMsg.error} />}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Despertar</label>
              <input
                type="time"
                value={wakeTime}
                onChange={(e) => setWakeTime(e.target.value)}
                className="w-full border border-[#2A2A3C] bg-[#0C0C0E] text-white px-3 py-2 text-sm rounded"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Dormir</label>
              <input
                type="time"
                value={sleepTime}
                onChange={(e) => setSleepTime(e.target.value)}
                className="w-full border border-[#2A2A3C] bg-[#0C0C0E] text-white px-3 py-2 text-sm rounded"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Traslado (min)</label>
              <input
                type="number"
                value={commuteMin}
                onChange={(e) => setCommuteMin(e.target.value)}
                min={0}
                max={180}
                className="w-full border border-[#2A2A3C] bg-[#0C0C0E] text-white px-3 py-2 text-sm rounded"
              />
            </div>
          </div>
          <Button
            onClick={async () => {
              setSavingBio(true);
              setBioMsg({});
              try {
                await upsertBioSettings({
                  t_wake_target: wakeTime,
                  t_sleep_target: sleepTime,
                  commute_minutes: parseInt(commuteMin) || 35,
                });
                setBioMsg({ success: "Ajustes guardados" });
                router.refresh();
              } catch (e: unknown) {
                setBioMsg({ error: e instanceof Error ? e.message : "Error al guardar" });
              } finally {
                setSavingBio(false);
              }
            }}
            disabled={savingBio}
            className="bg-[#7C5DFF] hover:bg-[#7C5DFF]/90 text-white"
          >
            {savingBio && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Guardar ajustes
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
