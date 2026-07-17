"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Loader2, Save } from "lucide-react";
import { saveRoutineDay, deleteRoutineDay } from "@/app/actions/routines";
import { FormStatus } from "@/components/dashboard/FormStatus";
import type { Routine } from "@/lib/api/types";

const DAYS = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];

interface LocalExercise {
  name: string;
  suggestedSets: number;
  suggestedReps: string;
  equipment: string[];
  muscles: string[];
}

function emptyExercise(): LocalExercise {
  return { name: "", suggestedSets: 3, suggestedReps: "8-12", equipment: [], muscles: [] };
}

export function RutinasClient({ routines }: { routines: Routine[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [status, setStatus] = useState<{ success?: string; error?: string }>({});
  const [deletingDay, setDeletingDay] = useState<number | null>(null);

  const routineMap = new Map<number, Routine>();
  for (const r of routines) routineMap.set(r.day_index, r);

  const current = routineMap.get(selectedDay);

  const [objective, setObjective] = useState(current?.objective || "");
  const [estMinutes, setEstMinutes] = useState(current?.estimated_minutes?.toString() || "");
  const [notes, setNotes] = useState((current?.notes || []).join("\n"));
  const [exercises, setExercises] = useState<LocalExercise[]>(
    current?.exercises?.length
      ? current.exercises.map((e) => ({
          name: e.name,
          suggestedSets: e.suggestedSets ?? 3,
          suggestedReps: e.suggestedReps ?? "8-12",
          equipment: e.equipment ?? [],
          muscles: e.muscles ?? [],
        }))
      : [emptyExercise()]
  );

  function selectDay(index: number) {
    setSelectedDay(index);
    const r = routineMap.get(index);
    setObjective(r?.objective || "");
    setEstMinutes(r?.estimated_minutes?.toString() || "");
    setNotes((r?.notes || []).join("\n"));
    setExercises(
      r?.exercises?.length
        ? r.exercises.map((e) => ({
            name: e.name,
            suggestedSets: e.suggestedSets ?? 3,
            suggestedReps: e.suggestedReps ?? "8-12",
            equipment: e.equipment ?? [],
            muscles: e.muscles ?? [],
          }))
        : [emptyExercise()]
    );
    setStatus({});
  }

  function updateExercise(index: number, field: keyof LocalExercise, value: unknown) {
    setExercises((prev) => prev.map((e, i) => (i === index ? { ...e, [field]: value } : e)));
  }

  function addExercise() {
    setExercises((prev) => [...prev, emptyExercise()]);
  }

  function removeExercise(index: number) {
    setExercises((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : [emptyExercise()]));
  }

  async function handleSave() {
    setStatus({});
    const validEx = exercises.filter((e) => e.name.trim());
    if (validEx.length === 0) {
      setStatus({ error: "Agrega al menos un ejercicio con nombre." });
      return;
    }
    startTransition(async () => {
      try {
        await saveRoutineDay(selectedDay, {
          day_name: DAYS[selectedDay],
          objective: objective.trim() || undefined,
          estimated_minutes: estMinutes ? parseInt(estMinutes) : undefined,
          notes: notes.trim() ? notes.split("\n").filter((n) => n.trim()) : undefined,
          exercises: validEx.map((e) => ({
            name: e.name.trim(),
            suggestedSets: e.suggestedSets,
            suggestedReps: e.suggestedReps,
            equipment: e.equipment,
            muscles: e.muscles,
          })),
        });
        setStatus({ success: `Rutina de ${DAYS[selectedDay]} guardada` });
        router.refresh();
      } catch (e: unknown) {
        setStatus({ error: e instanceof Error ? e.message : "Error al guardar" });
      }
    });
  }

  async function handleDelete() {
    setDeletingDay(selectedDay);
    setStatus({});
    try {
      await deleteRoutineDay(selectedDay);
      setObjective("");
      setEstMinutes("");
      setNotes("");
      setExercises([emptyExercise()]);
      setStatus({ success: `Rutina de ${DAYS[selectedDay]} eliminada` });
      router.refresh();
    } catch (e: unknown) {
      setStatus({ error: e instanceof Error ? e.message : "Error al eliminar" });
    } finally {
      setDeletingDay(null);
    }
  }

  const hasContent = routines.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 pb-8">
      <Card className="border-[#2A2A3C] bg-[#17171A]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-[#FFD700]">Rutinas</CardTitle>
              <CardDescription>
                {hasContent ? `${routines.length} dias configurados` : "Planifica tu semana de entrenamiento"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-1 flex-wrap">
            {DAYS.map((day, index) => {
              const has = routineMap.has(index);
              return (
                <button
                  key={day}
                  onClick={() => selectDay(index)}
                  className={`px-3 py-1.5 text-xs border rounded transition-colors font-mono ${
                    selectedDay === index
                      ? "border-[#7C5DFF] bg-[#7C5DFF]/10 text-white"
                      : has
                      ? "border-[#FFD700]/30 bg-[#FFD700]/5 text-[#FFD700]"
                      : "border-[#2A2A3C] text-gray-400 hover:text-white"
                  }`}
                >
                  {day.substring(0, 3)}
                </button>
              );
            })}
          </div>

          <div className="border-t border-[#2A2A3C]" />

          <p className="hud-label text-[#7C5DFF]">{DAYS[selectedDay]}</p>
          {status.success && <FormStatus success={status.success} />}
          {status.error && <FormStatus error={status.error} />}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-300">Objetivo del dia</Label>
              <Input
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="Fuerza, hipertrofia..."
                className="mt-1 border-[#2A2A3C] bg-[#0C0C0E] text-white"
              />
            </div>
            <div>
              <Label className="text-gray-300">Duracion estimada (min)</Label>
              <Input
                type="number"
                value={estMinutes}
                onChange={(e) => setEstMinutes(e.target.value)}
                min={5}
                max={240}
                placeholder="45"
                className="mt-1 border-[#2A2A3C] bg-[#0C0C0E] text-white"
              />
            </div>
          </div>

          <div>
            <Label className="text-gray-300">Notas (una por linea)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Calentar 10 min..."
              className="mt-1 border-[#2A2A3C] bg-[#0C0C0E] text-white"
            />
          </div>

          <div className="border-t border-[#2A2A3C] pt-3">
            <div className="flex items-center justify-between mb-3">
              <p className="hud-label">Ejercicios</p>
              <Button
                onClick={addExercise}
                variant="outline"
                size="sm"
                className="border-[#2A2A3C] text-gray-400 hover:text-white text-xs"
              >
                <Plus className="w-3 h-3 mr-1" /> Agregar
              </Button>
            </div>
            <div className="space-y-3">
              {exercises.map((ex, i) => (
                <div key={i} className="border border-[#2A2A3C] bg-[#0C0C0E] p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Input
                        value={ex.name}
                        onChange={(e) => updateExercise(i, "name", e.target.value)}
                        placeholder="Nombre del ejercicio"
                        className="border-[#2A2A3C] bg-[#0C0C0E] text-white text-sm"
                      />
                    </div>
                    <button
                      onClick={() => removeExercise(i)}
                      className="p-1 text-gray-500 hover:text-red-400"
                      title="Quitar ejercicio"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-gray-500 text-[10px]">Series</Label>
                      <Input
                        type="number"
                        value={ex.suggestedSets}
                        onChange={(e) => updateExercise(i, "suggestedSets", parseInt(e.target.value) || 3)}
                        min={1}
                        max={20}
                        className="mt-0.5 border-[#2A2A3C] bg-[#0C0C0E] text-white text-sm h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-500 text-[10px]">Reps</Label>
                      <Input
                        value={ex.suggestedReps}
                        onChange={(e) => updateExercise(i, "suggestedReps", e.target.value)}
                        placeholder="8-12"
                        className="mt-0.5 border-[#2A2A3C] bg-[#0C0C0E] text-white text-sm h-8"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleSave}
              disabled={isPending}
              className="bg-[#7C5DFF] hover:bg-[#7C5DFF]/90 text-white"
            >
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Save className="w-4 h-4 mr-2" />
              Guardar rutina
            </Button>
            {current && (
              <Button
                onClick={handleDelete}
                disabled={deletingDay === selectedDay}
                variant="outline"
                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
              >
                {deletingDay === selectedDay ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Eliminar rutina
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
