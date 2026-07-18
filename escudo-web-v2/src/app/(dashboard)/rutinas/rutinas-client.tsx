"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Dumbbell,
  Flame,
  Loader2,
  Play,
  Plus,
  Save,
  TimerReset,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeRoutineDay } from "@/app/actions/wellness";
import { logExercise } from "@/app/actions/health";
import { deleteRoutineDay, saveRoutineDay } from "@/app/actions/routines";
import { RestTimer } from "@/components/dashboard/RestTimer";
import type { ExerciseLog, PersonalRecord, Routine, RoutineExercise } from "@/lib/api/types";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const SHORT_DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

type RoutineTemplate = {
  title: string;
  objective: string;
  estimatedMinutes: number;
  notes: string[];
  exercises: RoutineExercise[];
};

const TEMPLATES: RoutineTemplate[] = [
  {
    title: "Empuje",
    objective: "Pecho, hombros y tríceps",
    estimatedMinutes: 55,
    notes: ["Calienta 8 minutos", "Descansa 90 segundos entre series"],
    exercises: [
      { name: "Press de pecho", suggestedSets: 3, suggestedReps: "8-12", muscles: ["Pecho", "Tríceps"] },
      { name: "Press militar", suggestedSets: 3, suggestedReps: "8-12", muscles: ["Hombros", "Tríceps"] },
      { name: "Fondos o extensión de tríceps", suggestedSets: 3, suggestedReps: "10-15", muscles: ["Tríceps"] },
    ],
  },
  {
    title: "Tirón",
    objective: "Espalda y bíceps",
    estimatedMinutes: 55,
    notes: ["Calienta 8 minutos", "Controla el descenso"],
    exercises: [
      { name: "Remo", suggestedSets: 3, suggestedReps: "8-12", muscles: ["Espalda", "Bíceps"] },
      { name: "Jalón o dominadas", suggestedSets: 3, suggestedReps: "6-12", muscles: ["Espalda"] },
      { name: "Curl de bíceps", suggestedSets: 3, suggestedReps: "10-15", muscles: ["Bíceps"] },
    ],
  },
  {
    title: "Piernas",
    objective: "Piernas y glúteos",
    estimatedMinutes: 60,
    notes: ["Calienta 8 minutos", "Prioriza técnica antes de subir peso"],
    exercises: [
      { name: "Sentadilla", suggestedSets: 3, suggestedReps: "6-10", muscles: ["Piernas", "Glúteos"] },
      { name: "Peso muerto rumano", suggestedSets: 3, suggestedReps: "8-12", muscles: ["Posterior", "Glúteos"] },
      { name: "Zancadas", suggestedSets: 3, suggestedReps: "10-12", muscles: ["Piernas"] },
    ],
  },
  {
    title: "Cuerpo completo",
    objective: "Fuerza general",
    estimatedMinutes: 50,
    notes: ["Elige cargas sostenibles", "Descansa 90 segundos"],
    exercises: [
      { name: "Sentadilla", suggestedSets: 3, suggestedReps: "8-12", muscles: ["Piernas"] },
      { name: "Press de pecho", suggestedSets: 3, suggestedReps: "8-12", muscles: ["Pecho"] },
      { name: "Remo", suggestedSets: 3, suggestedReps: "8-12", muscles: ["Espalda"] },
    ],
  },
];

type RoutineDraft = {
  objective: string;
  estimatedMinutes: string;
  notes: string;
  exercises: RoutineExercise[];
};

type SetDraft = { weight: string; reps: string; rpe: string };

function todayInBogota() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

function bogotaDayIndex() {
  const day = new Intl.DateTimeFormat("en-US", { timeZone: "America/Bogota", weekday: "short" }).format(new Date());
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(day);
}

function draftFromRoutine(routine?: Routine): RoutineDraft {
  return {
    objective: routine?.objective || "",
    estimatedMinutes: routine?.estimated_minutes ? String(routine.estimated_minutes) : "45",
    notes: (routine?.notes || []).join("\n"),
    exercises: routine?.exercises?.length ? routine.exercises : [],
  };
}

function normalized(value: string) {
  return value.trim().toLocaleLowerCase("es-CO");
}

export function RutinasClient({
  routines,
  userEquipment,
  exerciseLogs,
  personalRecords,
}: {
  routines: Routine[];
  userEquipment: string[];
  exerciseLogs: ExerciseLog[];
  personalRecords: PersonalRecord[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const todayIndex = bogotaDayIndex();
  const routinesByDay = new Map(routines.map((routine) => [routine.day_index, routine]));
  const [activeView, setActiveView] = useState<"session" | "plan">("session");
  const [selectedDay, setSelectedDay] = useState(todayIndex);
  const [draft, setDraft] = useState<RoutineDraft>(() => draftFromRoutine(routinesByDay.get(todayIndex)));
  const [status, setStatus] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [recordingIndex, setRecordingIndex] = useState<number | null>(null);
  const [setDrafts, setSetDrafts] = useState<Record<number, SetDraft>>({});
  const [loggedSets, setLoggedSets] = useState<Record<number, number>>({});

  const todayRoutine = routinesByDay.get(todayIndex);
  const plannedSets = todayRoutine?.exercises.reduce((total, exercise) => total + (exercise.suggestedSets || 3), 0) || 0;
  const completedSets = Object.values(loggedSets).reduce((total, value) => total + value, 0);

  function selectDay(dayIndex: number) {
    setSelectedDay(dayIndex);
    setDraft(draftFromRoutine(routinesByDay.get(dayIndex)));
    setConfirmDelete(false);
    setStatus(null);
  }

  function applyTemplate(template: RoutineTemplate) {
    setDraft({
      objective: template.objective,
      estimatedMinutes: String(template.estimatedMinutes),
      notes: template.notes.join("\n"),
      exercises: template.exercises,
    });
    setSelectedDay(todayIndex);
    setActiveView("plan");
    setStatus(`Plantilla ${template.title} lista para ajustar y guardar.`);
  }

  function updateExercise(index: number, field: keyof RoutineExercise, value: string) {
    setDraft((current) => ({
      ...current,
      exercises: current.exercises.map((exercise, exerciseIndex) => {
        if (exerciseIndex !== index) return exercise;
        if (field === "suggestedSets") return { ...exercise, suggestedSets: Number(value) || 0 };
        if (field === "equipment" || field === "muscles") {
          return { ...exercise, [field]: value.split(",").map((item) => item.trim()).filter(Boolean) };
        }
        return { ...exercise, [field]: value };
      }),
    }));
  }

  function addExercise() {
    setDraft((current) => ({
      ...current,
      exercises: [...current.exercises, { name: "", suggestedSets: 3, suggestedReps: "8-12", equipment: [], muscles: [] }],
    }));
  }

  function removeExercise(index: number) {
    setDraft((current) => ({ ...current, exercises: current.exercises.filter((_, exerciseIndex) => exerciseIndex !== index) }));
  }

  function handleSave() {
    const exercises = draft.exercises
      .filter((exercise) => exercise.name.trim())
      .map((exercise) => ({
        name: exercise.name.trim(),
        suggestedSets: exercise.suggestedSets ?? 3,
        suggestedReps: exercise.suggestedReps ?? "8-12",
        equipment: exercise.equipment ?? [],
        muscles: exercise.muscles ?? [],
      }));
    if (!exercises.length) {
      setStatus("Añade al menos un ejercicio antes de guardar.");
      return;
    }

    startTransition(async () => {
      try {
        await saveRoutineDay(selectedDay, {
          day_name: DAYS[selectedDay],
          objective: draft.objective.trim() || `Rutina de ${DAYS[selectedDay].toLocaleLowerCase("es-CO")}`,
          estimated_minutes: Math.max(10, Number(draft.estimatedMinutes) || 45),
          notes: draft.notes.split("\n").map((note) => note.trim()).filter(Boolean),
          exercises,
        });
        setStatus("Rutina guardada. Ya puedes abrir tu sesión de hoy.");
        setConfirmDelete(false);
        router.refresh();
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "No se pudo guardar la rutina.");
      }
    });
  }

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    startTransition(async () => {
      try {
        await deleteRoutineDay(selectedDay);
        setDraft(draftFromRoutine());
        setConfirmDelete(false);
        setStatus("Rutina eliminada.");
        router.refresh();
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "No se pudo eliminar la rutina.");
      }
    });
  }

  function updateSetDraft(index: number, field: keyof SetDraft, value: string) {
    setSetDrafts((current) => {
      const existing = current[index] || { weight: "", reps: "", rpe: "7" };
      return { ...current, [index]: { ...existing, [field]: value } };
    });
  }

  async function recordSet(index: number, exercise: RoutineExercise) {
    const set = {
      weight: setDrafts[index]?.weight ?? "",
      reps: setDrafts[index]?.reps ?? "",
      rpe: setDrafts[index]?.rpe ?? "7",
    };
    const weight = Number(set.weight);
    const reps = Number(set.reps);
    const rpe = Number(set.rpe);
    if (!exercise.name.trim() || weight <= 0 || reps <= 0 || rpe < 1 || rpe > 10) {
      setStatus("Registra peso, repeticiones y un RPE entre 1 y 10.");
      return;
    }

    setRecordingIndex(index);
    setStatus(null);
    try {
      await logExercise({ exercise_name: exercise.name, weight, reps, sets: 1, rpe, date: todayInBogota() });
      setLoggedSets((current) => ({ ...current, [index]: (current[index] || 0) + 1 }));
      setSetDrafts((current) => ({ ...current, [index]: { weight: set.weight, reps: "", rpe: set.rpe } }));
      setStatus(`Serie de ${exercise.name} guardada.`);
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo guardar la serie.");
    } finally {
      setRecordingIndex(null);
    }
  }

  async function finishSession() {
    setIsCompleting(true);
    try {
      await completeRoutineDay(todayIndex);
      setSessionDone(true);
      setStatus("Sesión completada. Tu progreso quedó registrado.");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo finalizar la sesión.");
    } finally {
      setIsCompleting(false);
    }
  }

  const selectedRoutine = routinesByDay.get(selectedDay);
  const missingEquipment = draft.exercises.flatMap((exercise) => exercise.equipment || []).filter((item) => !userEquipment.some((owned) => normalized(owned) === normalized(item)));

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 pb-8">
      <section className="border border-[#2A2A3C] bg-[#17171A] px-5 py-4 sm:flex sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center border border-[#7C5DFF] text-[#A995FF]"><Dumbbell className="size-5" /></span>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A995FF]">Centro de entrenamiento</p>
            <h1 className="text-2xl font-black uppercase tracking-wide text-white">Rutinas</h1>
            <p className="text-sm text-[#A9A3B8]">Planifica tu semana y registra lo que haces en cada sesión.</p>
          </div>
        </div>
        <div className="mt-4 flex border border-[#2A2A3C] sm:mt-0">
          <button type="button" onClick={() => setActiveView("session")} className={`px-4 py-2 text-sm font-semibold ${activeView === "session" ? "bg-[#7C5DFF] text-[#0C0C0E]" : "text-[#B7B1C2]"}`}>Sesión de hoy</button>
          <button type="button" onClick={() => setActiveView("plan")} className={`border-l border-[#2A2A3C] px-4 py-2 text-sm font-semibold ${activeView === "plan" ? "bg-[#7C5DFF] text-[#0C0C0E]" : "text-[#B7B1C2]"}`}>Plan semanal</button>
        </div>
      </section>

      {status && <p className="border border-[#4D3B8F] bg-[#1E1B2E] px-4 py-3 text-sm text-[#D8D0FF]" role="status">{status}</p>}

      {activeView === "session" ? (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="flex flex-col gap-4">
            {todayRoutine?.exercises?.length ? (
              <>
                <div className="border border-[#2A2A3C] bg-[#17171A] p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A995FF]">Rutina de {DAYS[todayIndex]}</p>
                      <h2 className="mt-1 text-xl font-bold text-white">{todayRoutine.objective || "Sesión de fuerza"}</h2>
                      <p className="mt-1 text-sm text-[#A9A3B8]">{todayRoutine.exercises.length} ejercicios · {plannedSets} series objetivo · {todayRoutine.estimated_minutes || 45} min</p>
                    </div>
                    {!sessionStarted ? (
                      <Button type="button" onClick={() => setSessionStarted(true)} className="bg-[#7C5DFF] text-[#0C0C0E] hover:bg-[#A995FF]"><Play className="mr-2 size-4" />Iniciar sesión</Button>
                    ) : sessionDone ? (
                      <span className="inline-flex items-center gap-2 border border-[#2C9A71] px-3 py-2 text-sm font-semibold text-[#5FE0A8]"><CheckCircle2 className="size-4" />Completada</span>
                    ) : (
                      <Button type="button" disabled={isCompleting} onClick={finishSession} className="bg-[#FFD700] text-[#0C0C0E] hover:bg-[#FFE349]">{isCompleting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Check className="mr-2 size-4" />}Finalizar sesión</Button>
                    )}
                  </div>
                  {sessionStarted && <div className="mt-4 h-2 bg-[#25252A]"><div className="h-full bg-[#7C5DFF] transition-all" style={{ width: `${Math.min(100, plannedSets ? (completedSets / plannedSets) * 100 : 0)}%` }} /></div>}
                </div>

                {!sessionStarted ? (
                  <div className="border border-dashed border-[#3A3650] bg-[#121214] p-5 text-sm text-[#B7B1C2]">
                    <p className="font-semibold text-white">Empieza cuando estés listo.</p>
                    <p className="mt-1">Al iniciar podrás registrar cada serie, usar el temporizador y ver tus referencias de fuerza.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {todayRoutine.exercises.map((exercise, index) => {
                      const completed = loggedSets[index] || 0;
                      const target = exercise.suggestedSets || 3;
                      const record = personalRecords.find((item) => normalized(item.exercise_name) === normalized(exercise.name));
                      const recent = exerciseLogs.find((item) => normalized(item.exercise_name) === normalized(exercise.name));
    const set = {
      weight: setDrafts[index]?.weight ?? "",
      reps: setDrafts[index]?.reps ?? "",
      rpe: setDrafts[index]?.rpe ?? "7",
    };
                      return (
                        <article key={`${exercise.name}-${index}`} className="border border-[#2A2A3C] bg-[#17171A] p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A995FF]">Ejercicio {String(index + 1).padStart(2, "0")}</p>
                              <h3 className="truncate text-lg font-bold text-white">{exercise.name}</h3>
                              <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#B7B1C2]">
                                <span className="border border-[#353543] px-2 py-1">{target} series · {exercise.suggestedReps || "8-12"} reps</span>
                                {(exercise.muscles || []).map((muscle) => <span key={muscle} className="border border-[#353543] px-2 py-1">{muscle}</span>)}
                              </div>
                            </div>
                            <span className={`border px-2 py-1 text-sm font-bold ${completed >= target ? "border-[#2C9A71] text-[#5FE0A8]" : "border-[#4D3B8F] text-[#D8D0FF]"}`}>{completed}/{target} series</span>
                          </div>
                          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_6rem_auto]">
                            <Input aria-label={`Peso de ${exercise.name}`} inputMode="decimal" placeholder="Peso kg" value={set.weight} onChange={(event) => updateSetDraft(index, "weight", event.target.value)} />
                            <Input aria-label={`Repeticiones de ${exercise.name}`} inputMode="numeric" placeholder="Reps" value={set.reps} onChange={(event) => updateSetDraft(index, "reps", event.target.value)} />
                            <Input aria-label={`RPE de ${exercise.name}`} inputMode="numeric" min="1" max="10" placeholder="RPE" value={set.rpe} onChange={(event) => updateSetDraft(index, "rpe", event.target.value)} />
                            <Button type="button" disabled={recordingIndex === index || sessionDone} onClick={() => recordSet(index, exercise)} className="bg-[#7C5DFF] text-[#0C0C0E] hover:bg-[#A995FF]">{recordingIndex === index ? <Loader2 className="size-4 animate-spin" /> : <><Plus className="mr-1 size-4" />Serie</>}</Button>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#A9A3B8]">
                            {record && <span><BarChart3 className="mr-1 inline size-3 text-[#FFD700]" />Récord: {record.max_weight} kg</span>}
                            {recent && <span>Último: {recent.weight} kg × {recent.reps}</span>}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="border border-[#2A2A3C] bg-[#17171A] p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A995FF]">Sesión de hoy</p>
                <h2 className="mt-1 text-xl font-bold text-white">Aún no tienes una rutina para {DAYS[todayIndex].toLocaleLowerCase("es-CO")}</h2>
                <p className="mt-1 text-sm text-[#A9A3B8]">Elige una base y la ajustamos a tu equipo y tiempo disponible.</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {TEMPLATES.map((template) => (
                    <button key={template.title} type="button" onClick={() => applyTemplate(template)} className="group border border-[#2A2A3C] bg-[#121214] p-4 text-left transition-colors hover:border-[#7C5DFF]">
                      <span className="flex items-center justify-between text-sm font-bold text-white">{template.title}<ChevronRight className="size-4 text-[#A995FF]" /></span>
                      <span className="mt-1 block text-xs text-[#A9A3B8]">{template.exercises.length} ejercicios · {template.estimatedMinutes} min</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className="flex flex-col gap-4">
            <div className="border border-[#2A2A3C] bg-[#17171A] p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A995FF]">Marcador de sesión</p>
              <p className="mt-2 text-3xl font-black text-white">{completedSets}<span className="text-base text-[#A9A3B8]">/{plannedSets || "-"}</span></p>
              <p className="text-sm text-[#B7B1C2]">series registradas hoy</p>
              {todayRoutine && <div className="mt-4 border-t border-[#2A2A3C] pt-3 text-sm text-[#B7B1C2]"><Flame className="mr-2 inline size-4 text-[#FFD700]" />Mantén una sesión realista: técnica antes que volumen.</div>}
            </div>
            <RestTimer />
            <div className="border border-[#2A2A3C] bg-[#17171A] p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A995FF]">Referencias</p>
              {personalRecords.length ? (
                <div className="mt-3 flex flex-col gap-2">
                  {personalRecords.slice(0, 4).map((record) => <div key={record.id} className="flex items-center justify-between gap-2 border-b border-[#2A2A3C] pb-2 text-sm"><span className="truncate text-[#D9D4E4]">{record.exercise_name}</span><strong className="shrink-0 text-[#FFD700]">{record.max_weight} kg</strong></div>)}
                </div>
              ) : <p className="mt-2 text-sm text-[#A9A3B8]">Tus récords aparecerán al registrar las primeras series.</p>}
            </div>
          </aside>
        </section>
      ) : (
        <section className="grid gap-4 xl:grid-cols-[15rem_minmax(0,1fr)]">
          <aside className="border border-[#2A2A3C] bg-[#17171A] p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A995FF]">Semana de entrenamiento</p>
            <div className="mt-3 grid grid-cols-4 gap-2 xl:grid-cols-1">
              {DAYS.map((day, index) => (
                <button key={day} type="button" onClick={() => selectDay(index)} className={`flex items-center justify-between border px-3 py-2 text-left text-sm ${selectedDay === index ? "border-[#7C5DFF] bg-[#1E1B2E] text-white" : "border-[#2A2A3C] text-[#B7B1C2] hover:border-[#4D3B8F]"}`}>
                  <span>{SHORT_DAYS[index]}</span>{routinesByDay.has(index) && <Check className="size-3 text-[#5FE0A8]" />}
                </button>
              ))}
            </div>
            <p className="mt-5 border-t border-[#2A2A3C] pt-4 text-xs text-[#A9A3B8]">Una rutina no tiene que ser perfecta: deja claro qué harás y cuánto tiempo le vas a dar.</p>
          </aside>

          <div className="border border-[#2A2A3C] bg-[#17171A] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A995FF]">Plan de {DAYS[selectedDay]}</p>
                <h2 className="text-xl font-bold text-white">{selectedRoutine ? "Ajusta tu rutina" : "Diseña una sesión útil"}</h2>
              </div>
              {selectedRoutine && <div className="flex gap-2"><Button type="button" variant="outline" onClick={handleDelete} disabled={isPending} className={confirmDelete ? "border-[#FF5C78] text-[#FF5C78]" : "border-[#353543] text-[#B7B1C2]"}>{confirmDelete ? "Confirmar" : <><Trash2 className="mr-1 size-4" />Eliminar</>}</Button>{confirmDelete && <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}><X className="size-4" /></Button>}</div>}
            </div>

            {!selectedRoutine && <div className="mt-4 flex flex-wrap gap-2"><span className="mr-1 self-center text-xs text-[#A9A3B8]">Base rápida:</span>{TEMPLATES.map((template) => <button key={template.title} type="button" onClick={() => applyTemplate(template)} className="border border-[#353543] px-3 py-1 text-xs text-[#D8D0FF] hover:border-[#7C5DFF]">{template.title}</button>)}</div>}

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div><Label htmlFor="routine-objective">Objetivo del día</Label><Input id="routine-objective" className="mt-2" value={draft.objective} placeholder="Ej. Fuerza de tren superior" onChange={(event) => setDraft((current) => ({ ...current, objective: event.target.value }))} /></div>
              <div><Label htmlFor="routine-duration">Duración estimada</Label><div className="relative mt-2"><Input id="routine-duration" type="number" min="10" max="240" value={draft.estimatedMinutes} onChange={(event) => setDraft((current) => ({ ...current, estimatedMinutes: event.target.value }))} /><Clock3 className="pointer-events-none absolute right-3 top-3 size-4 text-[#A9A3B8]" /></div></div>
            </div>
            <div className="mt-4"><Label htmlFor="routine-notes">Notas rápidas</Label><textarea id="routine-notes" rows={3} value={draft.notes} placeholder="Una nota por línea: calentar, ritmo, técnica..." onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} className="mt-2 flex w-full rounded-none border border-[#2A2A3C] bg-[#0C0C0E] px-3 py-2 text-sm text-white outline-none placeholder:text-[#777285] focus:border-[#7C5DFF]" /></div>

            <div className="mt-5 border-t border-[#2A2A3C] pt-5">
              <div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A995FF]">Lista de ejercicios</p><p className="text-sm text-[#A9A3B8]">Define lo mínimo que necesitas para empezar.</p></div><Button type="button" variant="outline" onClick={addExercise} className="border-[#4D3B8F] text-[#D8D0FF]"><Plus className="mr-1 size-4" />Añadir</Button></div>
              <div className="mt-4 flex flex-col gap-3">
                {draft.exercises.map((exercise, index) => (
                  <div key={`${index}-${exercise.name}`} className="border border-[#2A2A3C] bg-[#121214] p-3">
                    <div className="flex gap-2"><Input value={exercise.name} placeholder="Nombre del ejercicio" onChange={(event) => updateExercise(index, "name", event.target.value)} /><Button type="button" variant="ghost" size="icon" onClick={() => removeExercise(index)} aria-label="Quitar ejercicio"><Trash2 className="size-4 text-[#FF5C78]" /></Button></div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2"><Input value={String(exercise.suggestedSets || "")} inputMode="numeric" placeholder="Series sugeridas" onChange={(event) => updateExercise(index, "suggestedSets", event.target.value)} /><Input value={exercise.suggestedReps || ""} placeholder="Repeticiones, ej. 8-12" onChange={(event) => updateExercise(index, "suggestedReps", event.target.value)} /><Input value={(exercise.equipment || []).join(", ")} placeholder="Equipo, separado por comas" onChange={(event) => updateExercise(index, "equipment", event.target.value)} /><Input value={(exercise.muscles || []).join(", ")} placeholder="Músculos, separado por comas" onChange={(event) => updateExercise(index, "muscles", event.target.value)} /></div>
                  </div>
                ))}
                {!draft.exercises.length && <button type="button" onClick={addExercise} className="border border-dashed border-[#3A3650] px-4 py-6 text-sm text-[#B7B1C2] hover:border-[#7C5DFF]">+ Añade el primer ejercicio</button>}
              </div>
            </div>

            {missingEquipment.length > 0 && <div className="mt-4 flex gap-3 border border-[#6E5D1B] bg-[#242112] p-3 text-sm text-[#E9D98D]"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><p>Te falta: <strong>{Array.from(new Set(missingEquipment)).join(", ")}</strong>. Puedes cambiar el ejercicio o actualizar tu equipo en Perfil.</p></div>}
            <div className="mt-5 flex flex-wrap items-center gap-3"><Button type="button" disabled={isPending} onClick={handleSave} className="bg-[#7C5DFF] text-[#0C0C0E] hover:bg-[#A995FF]">{isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}Guardar rutina</Button>{selectedDay === todayIndex && <Button type="button" variant="outline" onClick={() => setActiveView("session")} className="border-[#353543] text-[#D8D0FF]"><TimerReset className="mr-2 size-4" />Ver sesión de hoy</Button>}</div>
          </div>
        </section>
      )}
    </div>
  );
}
