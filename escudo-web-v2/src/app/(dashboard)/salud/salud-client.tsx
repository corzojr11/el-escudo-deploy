"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Heart, TrendingDown, TrendingUp, Activity, Plus, Pencil, Trash2, Loader2, Sunrise } from "lucide-react";
import { addWeight, updateWeight, deleteWeightLog, logExercise } from "@/app/actions/health";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { ErrorState } from "@/components/dashboard/ErrorState";
import { SubmitButton } from "@/components/dashboard/SubmitButton";
import { FormStatus } from "@/components/dashboard/FormStatus";
import { formatDate, formatShortDate } from "@/lib/api/helpers";
import { logSleep } from "@/app/actions/plan";
import { completeRoutineDay, uncompleteRoutineDay } from "@/app/actions/wellness";
import { RestTimer } from "@/components/dashboard/RestTimer";
import type { FocusStatus, WeightLog, ExerciseLog, PersonalRecord, SleepLog, Routine } from "@/lib/api/types";

function todayInputValue() {
  const values = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => values.find((value) => value.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function bogotaTimeValue() {
  const values = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => values.find((value) => value.type === type)?.value ?? "";
  return `${part("hour")}:${part("minute")}`;
}

function sleepSummary(bedTime: string, wakeTime: string) {
  const toMinutes = (time: string) => {
    const [hours = "0", minutes = "0"] = time.split(":");
    return Number(hours) * 60 + Number(minutes);
  };
  const duration = (toMinutes(wakeTime) - toMinutes(bedTime) + 24 * 60) % (24 * 60);
  return { cycles: Math.max(1, Math.round(duration / 90)), hours: (duration / 60).toFixed(1) };
}

interface SaludClientProps {
  weightLogs: WeightLog[];
  focusStatus: FocusStatus | null;
  sleepAnalysis: {
    logs: SleepLog[];
    average_cycles: number;
    average_quality: number;
    total_hours_week: number;
    daily_debt_hours: number;
  } | null;
  bioSettings: Record<string, unknown> | null;
  exerciseLogs: ExerciseLog[];
  personalRecords: PersonalRecord[];
  routines: Routine[];
  completedDays: number[];
  loadErrors: string[];
}

export function SaludClient({ weightLogs, focusStatus, sleepAnalysis, bioSettings, exerciseLogs, personalRecords, routines, completedDays, loadErrors }: SaludClientProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<{ success?: string; error?: string }>({});
  const [, startTransition] = useTransition();
  const [sleepDate, setSleepDate] = useState(todayInputValue());
  const [sleepBedTime, setSleepBedTime] = useState(String(bioSettings?.t_sleep_target || "22:30"));
  const [sleepWakeTime, setSleepWakeTime] = useState(String(bioSettings?.t_wake_target || "06:00"));
  const [sleepQuality, setSleepQuality] = useState("3");
  const [sleepNotes, setSleepNotes] = useState("");
  const [sleepStatus, setSleepStatus] = useState<{ success?: string; error?: string }>({});
  const [sleeping, setSleeping] = useState(false);
  const [wakeRecorded, setWakeRecorded] = useState(false);

  const [exName, setExName] = useState("");
  const [exWeight, setExWeight] = useState("");
  const [exReps, setExReps] = useState("");
  const [exSets, setExSets] = useState("");
  const [exRpe, setExRpe] = useState("8");
  const [exDate, setExDate] = useState(todayInputValue());
  const [exStatus, setExStatus] = useState<{ success?: string; error?: string }>({});
  const [exercising, setExercising] = useState(false);
  const sleepInfo = sleepSummary(sleepBedTime, sleepWakeTime);
  const latestExercise = exerciseLogs[0];
  const latestSleep = sleepAnalysis?.logs?.[0];

  const [completingRoutine, setCompletingRoutine] = useState(false);

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const bogotaDay = new Intl.DateTimeFormat("en-US", { timeZone: "America/Bogota", weekday: "short" }).format(new Date());
  const todayIdx = weekdays.indexOf(bogotaDay);
  const [routineDone, setRoutineDone] = useState(completedDays.includes(todayIdx));
  const [routineMsg, setRoutineMsg] = useState<{ success?: string; error?: string }>({});

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

  const [editingLog, setEditingLog] = useState<WeightLog | null>(null);
  const [activePanel, setActivePanel] = useState<"weight" | "training" | "sleep" | null>(null);

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

  async function handleUpdate(formData: FormData) {
    setStatus({});
    startTransition(async () => {
      const result = await updateWeight(null, formData);
      if (result.success) {
        setStatus({ success: "Peso actualizado correctamente." });
        setEditingLog(null);
        formRef.current?.reset();
        router.refresh();
      } else {
        setStatus({ error: result.error ?? "Error al actualizar" });
      }
    });
  }

  async function handleDelete(logId: string) {
    setStatus({});
    startTransition(async () => {
      const result = await deleteWeightLog(logId);
      if (result.success) {
        setStatus({ success: "Registro eliminado." });
        setEditingLog(null);
        router.refresh();
      } else {
        setStatus({ error: result.error ?? "Error al eliminar" });
      }
    });
  }

  async function handleWakeNow() {
    const date = todayInputValue();
    const wakeTime = bogotaTimeValue();
    const bedTime = String(bioSettings?.t_sleep_target || sleepBedTime || "22:30");
    const summary = sleepSummary(bedTime, wakeTime);

    setSleeping(true);
    setSleepStatus({});
    try {
      await logSleep({
        date,
        bed_time: bedTime,
        wake_time: wakeTime,
        cycles: summary.cycles,
        quality_score: 3,
        notes: "Registro rápido al despertar.",
      });
      setSleepDate(date);
      setSleepWakeTime(wakeTime);
      setWakeRecorded(true);
      setSleepStatus({ success: `Despertar registrado a las ${wakeTime}. Puedes ajustar la calidad o las notas si lo necesitas.` });
      router.refresh();
    } catch (error: unknown) {
      setSleepStatus({ error: error instanceof Error ? error.message : "No se pudo registrar el despertar" });
    } finally {
      setSleeping(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {loadErrors.length > 0 && (
        <ErrorState
          title="Algunos datos de Salud no se pudieron cargar"
          message={`Las secciones disponibles siguen funcionando. Pendiente de actualizar: ${loadErrors.join(", ")}.`}
          onRetry={() => router.refresh()}
        />
      )}
      <section className="border border-border bg-card p-5 md:p-6">
        <span className="hud-label text-escudo-gold">Protocolo de bienestar</span>
        <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-heading text-3xl font-black tracking-[0.08em] text-foreground md:text-4xl">SALUD</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Mira lo importante, registra lo que pasó y deja que tu plan se adapte a tu día.
            </p>
          </div>
          <p className="max-w-sm border-l-2 border-escudo-gold pl-3 text-xs text-muted-foreground">
            Empieza con una sola acción: peso, descanso o entrenamiento. No necesitas completar todo ahora.
          </p>
        </div>
      </section>

      {routines.length > 0 && (
        (() => {
          const todayRoutine = routines.find((r) => r.day_index === todayIdx);
          if (!todayRoutine) return null;
          return (
            <div className="border border-[#2A2A3C] bg-[#17171A] p-4 flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="hud-label text-[#7C5DFF]">Rutina de hoy</p>
                <p className="text-sm text-white">
                  {todayRoutine.day_name}: {todayRoutine.exercises?.length || 0} ejercicios
                  {todayRoutine.estimated_minutes ? ` · ${todayRoutine.estimated_minutes} min` : ""}
                </p>
                {routineMsg.success && <p className="text-xs text-[#FFD700] mt-1">{routineMsg.success}</p>}
                {routineMsg.error && <p className="text-xs text-red-400 mt-1">{routineMsg.error}</p>}
              </div>
              <div className="flex items-center gap-2">
                {routineDone ? (
                  <>
                    <span className="text-xs text-[#FFD700]">Completada</span>
                    <button
                      onClick={async () => {
                        setCompletingRoutine(true);
                        setRoutineMsg({});
                        try {
                          await uncompleteRoutineDay(todayIdx);
                          setRoutineDone(false);
                          router.refresh();
                        } catch (e: unknown) {
                          setRoutineMsg({ error: e instanceof Error ? e.message : "Error al desmarcar" });
                        }
                        setCompletingRoutine(false);
                      }}
                      disabled={completingRoutine}
                      className="text-[10px] text-gray-500 hover:text-gray-300 underline"
                    >
                      Desmarcar
                    </button>
                    <button
                      onClick={async () => {
                        setCompletingRoutine(true);
                        setRoutineMsg({});
                        try {
                          let loggedCount = 0;
                          for (const ex of todayRoutine.exercises) {
                            await logExercise({
                              exercise_name: ex.name,
                              weight: 20,
                              reps: 10,
                              sets: ex.suggestedSets || 3,
                              rpe: 8,
                              date: todayInputValue(),
                            });
                            loggedCount++;
                          }
                          setRoutineMsg({ success: `Se auto-registraron ${loggedCount} ejercicios en tu historial de Salud.` });
                          router.refresh();
                        } catch (e: unknown) {
                          setRoutineMsg({ error: e instanceof Error ? e.message : "Error al auto-registrar las series." });
                        }
                        setCompletingRoutine(false);
                      }}
                      disabled={completingRoutine}
                      className="text-xs bg-escudo-gold hover:bg-escudo-gold/90 text-black px-2.5 py-1 ml-2 font-semibold"
                    >
                      {completingRoutine ? "Registrando..." : "Auto-registrar series"}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={async () => {
                      setCompletingRoutine(true);
                      setRoutineMsg({});
                      try {
                        await completeRoutineDay(todayIdx);
                        setRoutineDone(true);
                        router.refresh();
                      } catch (e: unknown) {
                        setRoutineMsg({ error: e instanceof Error ? e.message : "Error al completar" });
                      }
                      setCompletingRoutine(false);
                    }}
                    disabled={completingRoutine}
                    className="text-xs bg-[#7C5DFF] hover:bg-[#7C5DFF]/90 text-white px-3 py-1 rounded"
                  >
                    {completingRoutine ? "..." : "Completar"}
                  </button>
                )}
                <a href="/rutinas" className="text-xs text-[#7C5DFF] hover:underline">
                  Ver rutina
                </a>
              </div>
            </div>
          );
        })()
      )}

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
              <span className="text-base font-normal text-muted-foreground">días</span>
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

      <section className="border border-border bg-card p-4 md:p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="hud-label text-escudo-cyan">Registro rápido</span>
            <h3 className="mt-1 text-lg font-semibold text-foreground">¿Qué quieres revisar hoy?</h3>
          </div>
          <p className="text-xs text-muted-foreground">Abre solo el panel que necesitas.</p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <button
            type="button"
            onClick={() => setActivePanel(activePanel === "weight" ? null : "weight")}
            className={`border p-4 text-left transition-colors ${activePanel === "weight" ? "border-escudo-cyan bg-escudo-cyan/5" : "border-border hover:border-escudo-cyan/60"}`}
          >
            <Heart className="h-5 w-5 text-escudo-cyan" />
            <p className="mt-3 text-sm font-semibold text-foreground">Registrar peso</p>
            <p className="mt-1 text-xs text-muted-foreground">{latestLog ? `Último: ${latestLog.weight} kg` : "Crea tu primer punto de referencia."}</p>
          </button>
          <button
            type="button"
            onClick={() => setActivePanel(activePanel === "sleep" ? null : "sleep")}
            className={`border p-4 text-left transition-colors ${activePanel === "sleep" ? "border-escudo-gold bg-escudo-gold/5" : "border-border hover:border-escudo-gold/60"}`}
          >
            <Sunrise className="h-5 w-5 text-escudo-gold" />
            <p className="mt-3 text-sm font-semibold text-foreground">Registrar descanso</p>
            <p className="mt-1 text-xs text-muted-foreground">{latestSleep ? `${latestSleep.cycles} ciclos en tu último registro.` : "Anota cómo dormiste para ajustar tu ritmo."}</p>
          </button>
          <button
            type="button"
            onClick={() => setActivePanel(activePanel === "training" ? null : "training")}
            className={`border p-4 text-left transition-colors ${activePanel === "training" ? "border-escudo-green bg-escudo-green/5" : "border-border hover:border-escudo-green/60"}`}
          >
            <Activity className="h-5 w-5 text-escudo-green" />
            <p className="mt-3 text-sm font-semibold text-foreground">Registrar entrenamiento</p>
            <p className="mt-1 text-xs text-muted-foreground">{latestExercise ? `Último: ${latestExercise.exercise_name}` : "Guarda tus series y revisa tus marcas."}</p>
          </button>
        </div>
      </section>

      {activePanel === "weight" && (
        <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader>
            <span className="hud-label text-accent">Weight Input</span>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-5 w-5 text-escudo-gold" /> Registrar peso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form ref={formRef} action={editingLog ? handleUpdate : handleSubmit} className="flex flex-col gap-4">
              {editingLog && <input type="hidden" name="log_id" value={editingLog.id} />}
              <div className="space-y-2">
                <Label htmlFor="weight">Peso (kg)</Label>
                <Input
                  id="weight"
                  name="weight"
                  type="number"
                  step="0.1"
                  min="0.1"
                  placeholder="Ej. 78.4"
                  defaultValue={editingLog?.weight}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Fecha</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  defaultValue={editingLog?.date ?? todayInputValue()}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notas</Label>
                <Input id="notes" name="notes" placeholder="Opcional" defaultValue={editingLog?.notes ?? ""} />
              </div>
              <FormStatus {...status} />
              <div className="flex gap-2">
                <SubmitButton className="flex-1">{editingLog ? "Actualizar" : "Guardar peso"}</SubmitButton>
                {editingLog && (
                  <Button type="button" variant="outline" onClick={() => setEditingLog(null)}>
                    Cancelar
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader>
            <span className="hud-label text-accent">Weight History</span>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5 text-escudo-cyan" /> Historial de peso
            </CardTitle>
            <CardDescription>Últimos registros de peso</CardDescription>
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
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-escudo-cyan">{log.weight} kg</span>
                        <div className="flex gap-1">
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingLog(log); setActivePanel("weight"); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-escudo-red" onClick={() => handleDelete(log.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      )}

      {activePanel === "training" && (
        <Card className="border-[#2A2A3C] bg-[#17171A]">
        <CardHeader>
          <CardTitle className="text-[#FFD700]">Entrenamiento</CardTitle>
          <CardDescription>Registra tus ejercicios y sigue tus récords.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {exStatus.success && <FormStatus success={exStatus.success} />}
          {exStatus.error && <FormStatus error={exStatus.error} />}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Label className="text-gray-300">Ejercicio</Label>
              <Input
                value={exName}
                onChange={(e) => setExName(e.target.value)}
                placeholder="Press banca, Sentadilla..."
                maxLength={200}
                className="mt-1 border-[#2A2A3C] bg-[#0C0C0E] text-white"
              />
            </div>
            <div>
              <Label className="text-gray-300">Fecha</Label>
              <Input
                type="date"
                value={exDate}
                onChange={(e) => setExDate(e.target.value)}
                className="mt-1 border-[#2A2A3C] bg-[#0C0C0E] text-white color-scheme-dark"
              />
            </div>
            <div>
              <Label className="text-gray-300">Peso (kg)</Label>
              <Input
                type="number"
                value={exWeight}
                onChange={(e) => setExWeight(e.target.value)}
                placeholder="0"
                min={0}
                className="mt-1 border-[#2A2A3C] bg-[#0C0C0E] text-white"
              />
            </div>
            <div>
              <Label className="text-gray-300">Reps</Label>
              <Input
                type="number"
                value={exReps}
                onChange={(e) => setExReps(e.target.value)}
                placeholder="0"
                min={0}
                className="mt-1 border-[#2A2A3C] bg-[#0C0C0E] text-white"
              />
            </div>
            <div>
              <Label className="text-gray-300">Series</Label>
              <Input
                type="number"
                value={exSets}
                onChange={(e) => setExSets(e.target.value)}
                placeholder="0"
                min={0}
                className="mt-1 border-[#2A2A3C] bg-[#0C0C0E] text-white"
              />
            </div>
            <div>
              <Label className="text-gray-300">RPE (1-10)</Label>
              <Input
                type="number"
                value={exRpe}
                onChange={(e) => setExRpe(e.target.value)}
                min={1}
                max={10}
                className="mt-1 border-[#2A2A3C] bg-[#0C0C0E] text-white"
              />
            </div>
          </div>
          <Button
            onClick={async () => {
              if (!exName.trim()) { setExStatus({ error: "El nombre del ejercicio es obligatorio." }); return; }
              setExercising(true);
              setExStatus({});
              try {
                await logExercise({
                  exercise_name: exName.trim(),
                  weight: parseFloat(exWeight) || 0,
                  reps: parseInt(exReps) || 0,
                  sets: parseInt(exSets) || 0,
                  rpe: parseInt(exRpe) || 8,
                  date: exDate || undefined,
                });
                setExStatus({ success: "Ejercicio registrado" });
                setExName("");
                setExWeight("");
                setExReps("");
                setExSets("");
                setExRpe("8");
                router.refresh();
              } catch (e: unknown) {
                setExStatus({ error: e instanceof Error ? e.message : "Error al registrar" });
              } finally {
                setExercising(false);
              }
            }}
            disabled={exercising}
            className="bg-[#7C5DFF] hover:bg-[#7C5DFF]/90 text-white"
          >
            {exercising && <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />}
            Registrar ejercicio
          </Button>
          {latestExercise && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setExName(latestExercise.exercise_name);
                setExWeight(String(latestExercise.weight));
                setExReps(String(latestExercise.reps));
                setExSets(String(latestExercise.sets));
                setExRpe(String(latestExercise.rpe ?? 8));
                setExDate(todayInputValue());
                setExStatus({ success: `Datos de ${latestExercise.exercise_name} cargados. Revisa y registra cuando estés listo.` });
              }}
              className="ml-2 border-[#7C5DFF] text-[#B9A9FF] hover:bg-[#7C5DFF]/10 hover:text-white"
            >
              Repetir {latestExercise.exercise_name}
            </Button>
          )}

          <div className="border-t border-[#2A2A3C] pt-4">
            <RestTimer />
          </div>

          <div className="border-t border-[#2A2A3C] pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="hud-label mb-2">Records personales</p>
                {personalRecords.length > 0 ? (
                  <div className="space-y-1">
                    {personalRecords.map((pr) => (
                      <div key={pr.id} className="flex justify-between text-sm border-b border-[#1a1a1e] py-1 last:border-0">
                        <span className="text-gray-300 truncate">{pr.exercise_name}</span>
                        <span className="text-[#FFD700] font-mono">{pr.max_weight} kg</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 py-2">Sin records. Registra ejercicios para ver tus marcas.</p>
                )}
              </div>
              <div>
                <p className="hud-label mb-2">Historial reciente</p>
                {exerciseLogs.length > 0 ? (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {exerciseLogs.slice(0, 8).map((log) => (
                      <div key={log.id} className="flex justify-between text-sm border-b border-[#1a1a1e] py-1 last:border-0">
                        <span className="text-gray-300 truncate">{log.exercise_name}</span>
                        <span className="text-gray-400 font-mono text-xs">{log.weight > 0 ? `${log.weight}kg` : `${log.sets}x${log.reps}`}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 py-2">Sin ejercicios registrados.</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
        </Card>
      )}

      {activePanel === "sleep" && (
        <Card className="border-[#2A2A3C] bg-[#17171A]">
        <CardHeader>
          <CardTitle className="text-[#FFD700]">Registro de sueño</CardTitle>
          <CardDescription>Registra tus horas de descanso</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sleepStatus.success && <FormStatus success={sleepStatus.success} />}
          {sleepStatus.error && <FormStatus error={sleepStatus.error} />}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-gray-300">Fecha</Label>
              <Input
                type="date"
                value={sleepDate}
                onChange={(e) => setSleepDate(e.target.value)}
                className="mt-1 border-[#2A2A3C] bg-[#0C0C0E] text-white color-scheme-dark"
              />
            </div>
            <div>
              <Label className="text-gray-300">Hora dormir</Label>
              <Input
                type="time"
                value={sleepBedTime}
                onChange={(e) => setSleepBedTime(e.target.value)}
                className="mt-1 border-[#2A2A3C] bg-[#0C0C0E] text-white color-scheme-dark"
              />
            </div>
            <div>
              <Label className="text-gray-300">Hora despertar</Label>
              <Input
                type="time"
                value={sleepWakeTime}
                onChange={(e) => setSleepWakeTime(e.target.value)}
                className="mt-1 border-[#2A2A3C] bg-[#0C0C0E] text-white color-scheme-dark"
              />
            </div>
            <div className="border border-[#2A2A3C] bg-[#0C0C0E] px-3 py-2">
              <p className="text-xs text-gray-300">Ciclos calculados</p>
              <p className="mt-1 font-mono text-sm text-[#FFD700]">{sleepInfo.cycles} ciclos · {sleepInfo.hours} h</p>
            </div>
            <div>
              <Label className="text-gray-300">Calidad (1-5)</Label>
              <Input
                type="number"
                value={sleepQuality}
                onChange={(e) => setSleepQuality(e.target.value)}
                min={1}
                max={5}
                className="mt-1 border-[#2A2A3C] bg-[#0C0C0E] text-white"
              />
            </div>
            <div>
              <Label className="text-gray-300">Notas</Label>
              <Input
                value={sleepNotes}
                onChange={(e) => setSleepNotes(e.target.value)}
                placeholder="Opcional"
                className="mt-1 border-[#2A2A3C] bg-[#0C0C0E] text-white"
              />
            </div>
          </div>
          <Button
            onClick={async () => {
              setSleeping(true);
              setSleepStatus({});
              try {
                await logSleep({
                  date: sleepDate,
                  bed_time: sleepBedTime,
                  wake_time: sleepWakeTime,
                  cycles: sleepInfo.cycles,
                  quality_score: parseInt(sleepQuality) || 3,
                  notes: sleepNotes,
                });
                setSleepStatus({ success: "Sueño registrado" });
                router.refresh();
              } catch (e: unknown) {
                setSleepStatus({ error: e instanceof Error ? e.message : "Error al registrar" });
              } finally {
                setSleeping(false);
              }
            }}
            disabled={sleeping}
            className="bg-[#7C5DFF] hover:bg-[#7C5DFF]/90 text-white"
          >
            {sleeping && <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />}
            Registrar sueño
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!latestSleep) return;
              setSleepDate(todayInputValue());
              setSleepBedTime(latestSleep.bed_time);
              setSleepWakeTime(latestSleep.wake_time);
              setSleepQuality(String(latestSleep.quality_score || 3));
              setSleepNotes("");
              setSleepStatus({ success: "Tomamos tu último horario. Revísalo y registra solo si hoy fue igual." });
            }}
            disabled={sleeping || !latestSleep}
            className="ml-2 border-[#7C5DFF]/60 text-[#c0b2ff] hover:bg-[#7C5DFF]/10 hover:text-[#d7ceff]"
          >
            Repetir último sueño
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleWakeNow}
            disabled={sleeping || wakeRecorded}
            className="ml-2 border-[#FFD700]/60 text-[#ffe476] hover:bg-[#FFD700]/10 hover:text-[#ffe476]"
          >
            {sleeping && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {!sleeping && <Sunrise className="mr-2 h-4 w-4" />}
            {wakeRecorded ? "Despertar registrado" : "Acabo de despertar"}
          </Button>
          <p className="text-xs text-muted-foreground">Usa tu hora objetivo de dormir y calidad neutral. Luego puedes corregir el registro si fue distinto.</p>
        </CardContent>
        </Card>
      )}

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="border-[#2A2A3C] bg-[#17171A] xl:col-span-2">
        <CardHeader>
          <CardTitle className="text-[#FFD700]">Resumen de sueño (7 días)</CardTitle>
        </CardHeader>
        <CardContent>
          {sleepAnalysis && sleepAnalysis.logs?.length > 0 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-xs text-gray-400 mb-2">
                <span>Promedio: {sleepAnalysis.average_cycles?.toFixed(1)} ciclos</span>
                <span>Calidad: {sleepAnalysis.average_quality?.toFixed(1)} / 5</span>
                <span>Deuda: {sleepAnalysis.daily_debt_hours?.toFixed(1)}h</span>
              </div>
              <div className="border-t border-[#2A2A3C]" />
              {sleepAnalysis.logs.map((log) => (
                <div key={log.id} className="flex justify-between items-center text-sm py-1 border-b border-[#1a1a1e] last:border-0">
                  <span className="text-gray-300">{log.date}</span>
                  <span className="text-gray-400">{log.bed_time?.substring(0, 5)} – {log.wake_time?.substring(0, 5)}</span>
                  <span className="text-[#FFD700]">{log.cycles}c</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-gray-400">Sin registros de sueño. Usa el formulario para empezar.</p>
          )}
        </CardContent>
        </Card>
        <Card className="border-[#2A2A3C] bg-[#17171A]">
        <CardHeader>
          <span className="hud-label text-escudo-green">Tu constancia</span>
          <CardTitle className="text-base text-foreground">Enfoque y rutina</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="border-l-2 border-escudo-green pl-3">
            <p className="font-semibold text-foreground">{focusStatus?.focus_streak ?? 0} días de racha</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {(focusStatus?.focus_streak ?? 0) > 0 ? "Ya tienes una base: protégela con una acción simple." : "La constancia empieza cuando eliges una acción posible para hoy."}
            </p>
          </div>
          {routines.length > 0 ? (
            <div className="border-l-2 border-escudo-gold pl-3">
              <p className="font-semibold text-foreground">Rutina del día</p>
              <p className="mt-1 text-xs text-muted-foreground">{routineDone ? "Ya la marcaste como completada." : "Tu rutina está lista para cuando tengas espacio."}</p>
              <a href="/rutinas" className="mt-2 inline-block text-xs text-escudo-gold hover:underline">Ver planificación semanal</a>
            </div>
          ) : (
            <div className="border-l-2 border-muted pl-3">
              <p className="font-semibold text-foreground">Sin rutina planificada</p>
              <a href="/rutinas" className="mt-2 inline-block text-xs text-escudo-gold hover:underline">Crear mi rutina semanal</a>
            </div>
          )}
        </CardContent>
        </Card>
      </section>
    </div>
  );
}
