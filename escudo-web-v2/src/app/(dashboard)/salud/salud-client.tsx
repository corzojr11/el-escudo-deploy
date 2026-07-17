"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Heart, TrendingDown, TrendingUp, Activity, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { addWeight, updateWeight, deleteWeightLog, logExercise } from "@/app/actions/health";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { SubmitButton } from "@/components/dashboard/SubmitButton";
import { FormStatus } from "@/components/dashboard/FormStatus";
import { formatDate, formatShortDate } from "@/lib/api/helpers";
import { logSleep } from "@/app/actions/plan";
import type { FocusStatus, WeightLog, ExerciseLog, PersonalRecord, SleepLog, Routine } from "@/lib/api/types";

function todayInputValue() {
  return new Date().toISOString().split("T")[0];
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
}

export function SaludClient({ weightLogs, focusStatus, sleepAnalysis, bioSettings, exerciseLogs, personalRecords, routines }: SaludClientProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<{ success?: string; error?: string }>({});
  const [, startTransition] = useTransition();
  const [sleepDate, setSleepDate] = useState(todayInputValue());
  const [sleepBedTime, setSleepBedTime] = useState(String(bioSettings?.t_sleep_target || "22:30"));
  const [sleepWakeTime, setSleepWakeTime] = useState(String(bioSettings?.t_wake_target || "06:00"));
  const [sleepCycles, setSleepCycles] = useState("5");
  const [sleepQuality, setSleepQuality] = useState("3");
  const [sleepNotes, setSleepNotes] = useState("");
  const [sleepStatus, setSleepStatus] = useState<{ success?: string; error?: string }>({});
  const [sleeping, setSleeping] = useState(false);

  const [exName, setExName] = useState("");
  const [exWeight, setExWeight] = useState("");
  const [exReps, setExReps] = useState("");
  const [exSets, setExSets] = useState("");
  const [exRpe, setExRpe] = useState("8");
  const [exDate, setExDate] = useState(todayInputValue());
  const [exStatus, setExStatus] = useState<{ success?: string; error?: string }>({});
  const [exercising, setExercising] = useState(false);

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

      {routines.length > 0 && (
        (() => {
          const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
          const bogotaDay = new Intl.DateTimeFormat("en-US", { timeZone: "America/Bogota", weekday: "short" }).format(new Date());
          const todayIdx = weekdays.indexOf(bogotaDay);
          const todayRoutine = routines.find((r) => r.day_index === todayIdx);
          if (!todayRoutine) return null;
          return (
            <div className="border border-[#2A2A3C] bg-[#17171A] p-4 flex items-center justify-between">
              <div>
                <p className="hud-label text-[#7C5DFF]">Rutina de hoy</p>
                <p className="text-sm text-white">
                  {todayRoutine.day_name}: {todayRoutine.exercises?.length || 0} ejercicios
                  {todayRoutine.estimated_minutes ? ` · ${todayRoutine.estimated_minutes} min` : ""}
                </p>
              </div>
              <a href="/rutinas" className="text-xs text-[#7C5DFF] hover:underline">
                Ver rutina completa
              </a>
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
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-escudo-cyan">{log.weight} kg</span>
                        <div className="flex gap-1">
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingLog(log)}>
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

      <Card className="border-[#2A2A3C] bg-[#17171A]">
        <CardHeader>
          <CardTitle className="text-[#FFD700]">Entrenamiento</CardTitle>
          <CardDescription>Registra tus ejercicios y segui tus records</CardDescription>
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

      <Card className="border-[#2A2A3C] bg-[#17171A]">
        <CardHeader>
          <CardTitle className="text-[#FFD700]">Registro de sueno</CardTitle>
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
            <div>
              <Label className="text-gray-300">Ciclos</Label>
              <Input
                type="number"
                value={sleepCycles}
                onChange={(e) => setSleepCycles(e.target.value)}
                min={1}
                max={8}
                className="mt-1 border-[#2A2A3C] bg-[#0C0C0E] text-white"
              />
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
                  cycles: parseInt(sleepCycles) || 5,
                  quality_score: parseInt(sleepQuality) || 3,
                  notes: sleepNotes,
                });
                setSleepStatus({ success: "Sueno registrado" });
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
            Registrar sueno
          </Button>
        </CardContent>
      </Card>

      <Card className="border-[#2A2A3C] bg-[#17171A]">
        <CardHeader>
          <CardTitle className="text-[#FFD700]">Resumen de sueno (7 dias)</CardTitle>
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
            <p className="text-sm text-gray-400 py-4 text-center">Sin registros de sueno. Usa el formulario para empezar.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
