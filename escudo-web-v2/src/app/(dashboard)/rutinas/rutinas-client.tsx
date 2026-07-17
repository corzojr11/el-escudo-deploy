"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Loader2, Save, X } from "lucide-react";
import { saveRoutineDay, deleteRoutineDay } from "@/app/actions/routines";
import { FormStatus } from "@/components/dashboard/FormStatus";
import type { Routine } from "@/lib/api/types";

const DAYS = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];

export function RutinasClient({ routines }: { routines: Routine[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [status, setStatus] = useState<{ success?: string; error?: string }>({});
  const [deletingDay, setDeletingDay] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const routineMap = new Map<number, Routine>();
  for (const r of routines) routineMap.set(r.day_index, r);
  const current = routineMap.get(selectedDay);

  const [objective, setObjective] = useState(current?.objective || "");
  const [estMinutes, setEstMinutes] = useState(current?.estimated_minutes?.toString() || "");
  const [notes, setNotes] = useState((current?.notes || []).join("\n"));
  const [exercises, setExercises] = useState<number[]>(
    current?.exercises?.length ? current.exercises.map((_, i) => i) : [0]
  );
  const [exNames, setExNames] = useState<Record<number, string>>(
    current?.exercises?.reduce((acc, e, i) => ({ ...acc, [i]: e.name }), {}) || { 0: "" }
  );
  const [exSets, setExSets] = useState<Record<number, number>>(
    current?.exercises?.reduce((acc, e, i) => ({ ...acc, [i]: e.suggestedSets ?? 3 }), {}) || { 0: 3 }
  );
  const [exReps, setExReps] = useState<Record<number, string>>(
    current?.exercises?.reduce((acc, e, i) => ({ ...acc, [i]: e.suggestedReps ?? "8-12" }), {}) || { 0: "8-12" }
  );
  const [exEquip, setExEquip] = useState<Record<number, string>>(
    current?.exercises?.reduce((acc, e, i) => ({ ...acc, [i]: (e.equipment ?? []).join(", ") }), {}) || { 0: "" }
  );
  const [exMuscles, setExMuscles] = useState<Record<number, string>>(
    current?.exercises?.reduce((acc, e, i) => ({ ...acc, [i]: (e.muscles ?? []).join(", ") }), {}) || { 0: "" }
  );
  const [nextExId, setNextExId] = useState(exercises.length);

  function selectDay(index: number) {
    setSelectedDay(index);
    setConfirmDelete(false);
    const r = routineMap.get(index);
    setObjective(r?.objective || "");
    setEstMinutes(r?.estimated_minutes?.toString() || "");
    setNotes((r?.notes || []).join("\n"));
    if (r?.exercises?.length) {
      setExercises(r.exercises.map((_, i) => i));
      setExNames(r.exercises.reduce((acc, e, i) => ({ ...acc, [i]: e.name }), {}));
      setExSets(r.exercises.reduce((acc, e, i) => ({ ...acc, [i]: e.suggestedSets ?? 3 }), {}));
      setExReps(r.exercises.reduce((acc, e, i) => ({ ...acc, [i]: e.suggestedReps ?? "8-12" }), {}));
      setExEquip(r.exercises.reduce((acc, e, i) => ({ ...acc, [i]: (e.equipment ?? []).join(", ") }), {}));
      setExMuscles(r.exercises.reduce((acc, e, i) => ({ ...acc, [i]: (e.muscles ?? []).join(", ") }), {}));
      setNextExId(r.exercises.length);
    } else {
      setExercises([0]);
      setExNames({ 0: "" });
      setExSets({ 0: 3 });
      setExReps({ 0: "8-12" });
      setExEquip({ 0: "" });
      setExMuscles({ 0: "" });
      setNextExId(1);
    }
    setStatus({});
  }

  function addExercise() {
    setExercises((prev) => [...prev, nextExId]);
    setExNames((prev) => ({ ...prev, [nextExId]: "" }));
    setExSets((prev) => ({ ...prev, [nextExId]: 3 }));
    setExReps((prev) => ({ ...prev, [nextExId]: "8-12" }));
    setExEquip((prev) => ({ ...prev, [nextExId]: "" }));
    setExMuscles((prev) => ({ ...prev, [nextExId]: "" }));
    setNextExId((n) => n + 1);
  }

  function removeExercise(id: number) {
    if (exercises.length <= 1) return;
    setExercises((prev) => prev.filter((x) => x !== id));
  }

  function parseArray(text: string): string[] {
    return text
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .filter((s, i, arr) => arr.indexOf(s) === i);
  }

  async function handleSave() {
    setStatus({});
    const validIds = exercises.filter((id) => (exNames[id] || "").trim());
    if (validIds.length === 0) {
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
          exercises: validIds.map((id) => ({
            name: (exNames[id] || "").trim(),
            suggestedSets: exSets[id] ?? 3,
            suggestedReps: exReps[id] ?? "8-12",
            equipment: parseArray(exEquip[id] || ""),
            muscles: parseArray(exMuscles[id] || ""),
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
    setConfirmDelete(false);
    setStatus({});
    try {
      await deleteRoutineDay(selectedDay);
      setObjective("");
      setEstMinutes("");
      setNotes("");
      setExercises([0]);
      setExNames({ 0: "" });
      setExSets({ 0: 3 });
      setExReps({ 0: "8-12" });
      setExEquip({ 0: "" });
      setExMuscles({ 0: "" });
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
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Calentar 10 min..."
              rows={3}
              className="mt-1 w-full border border-[#2A2A3C] bg-[#0C0C0E] text-white text-sm px-3 py-2 rounded-md resize-y"
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
              {exercises.map((id) => (
                <div key={id} className="border border-[#2A2A3C] bg-[#0C0C0E] p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Input
                        value={exNames[id] || ""}
                        onChange={(e) => setExNames((prev) => ({ ...prev, [id]: e.target.value }))}
                        placeholder="Nombre del ejercicio"
                        className="border-[#2A2A3C] bg-[#0C0C0E] text-white text-sm"
                      />
                    </div>
                    <button
                      onClick={() => removeExercise(id)}
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
                        value={exSets[id] ?? 3}
                        onChange={(e) => setExSets((prev) => ({ ...prev, [id]: parseInt(e.target.value) || 3 }))}
                        min={1}
                        max={20}
                        className="mt-0.5 border-[#2A2A3C] bg-[#0C0C0E] text-white text-sm h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-500 text-[10px]">Reps</Label>
                      <Input
                        value={exReps[id] || "8-12"}
                        onChange={(e) => setExReps((prev) => ({ ...prev, [id]: e.target.value }))}
                        placeholder="8-12"
                        className="mt-0.5 border-[#2A2A3C] bg-[#0C0C0E] text-white text-sm h-8"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-gray-500 text-[10px]">Equipo (separado por comas)</Label>
                      <Input
                        value={exEquip[id] || ""}
                        onChange={(e) => setExEquip((prev) => ({ ...prev, [id]: e.target.value }))}
                        placeholder="Barra, mancuernas"
                        className="mt-0.5 border-[#2A2A3C] bg-[#0C0C0E] text-white text-sm h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-500 text-[10px]">Musculos (separado por comas)</Label>
                      <Input
                        value={exMuscles[id] || ""}
                        onChange={(e) => setExMuscles((prev) => ({ ...prev, [id]: e.target.value }))}
                        placeholder="Pecho, triceps"
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
              confirmDelete ? (
                <div className="flex gap-2">
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
                    Confirmar eliminar
                  </Button>
                  <Button
                    onClick={() => setConfirmDelete(false)}
                    variant="outline"
                    className="border-[#2A2A3C] text-gray-400"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => setConfirmDelete(true)}
                  variant="outline"
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar rutina
                </Button>
              )
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
