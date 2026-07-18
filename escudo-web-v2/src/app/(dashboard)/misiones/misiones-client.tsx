"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen, CalendarClock, Check, Circle, Dumbbell, Loader2, Pencil, Plus, ShieldAlert, Trash2, WalletCards, X } from "lucide-react";
import { createMission, updateMission, deleteMission } from "@/app/actions/missions";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { FormStatus } from "@/components/dashboard/FormStatus";
import type { Goal, Mission } from "@/lib/api/types";

const FILTERS = [
  { key: "all", label: "Todas" },
  { key: "hoy", label: "Hoy" },
  { key: "proximas", label: "Próximas" },
  { key: "active", label: "Pendientes" },
  { key: "completed", label: "Completadas" },
];

const PRIORITY_COLORS: Record<string, string> = {
  high: "border-red-500/30 bg-red-500/10 text-red-400",
  medium: "border-[#FFD700]/30 bg-[#FFD700]/10 text-[#FFD700]",
  low: "border-gray-500/30 bg-gray-500/10 text-gray-400",
};

function bogotaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function MisionesClient({
  missions,
  goals,
  initialGoalId,
  initialMissionName,
  initialMissionDate,
  capacityNotice,
}: {
  missions: Mission[];
  goals: Goal[];
  initialGoalId?: string;
  initialMissionName?: string;
  initialMissionDate?: string;
  capacityNotice?: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState("all");
  const [creating, setCreating] = useState(Boolean(initialMissionName));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ success?: string; error?: string }>({});
  const [showAllDuringLowCapacity, setShowAllDuringLowCapacity] = useState(false);

  const [name, setName] = useState(initialMissionName ?? "");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [scheduledAt, setScheduledAt] = useState(initialMissionDate ?? "");
  const [goalId, setGoalId] = useState(initialGoalId || "");
  const [progressIncrement, setProgressIncrement] = useState("");

  function isMissionToday(m: Mission): boolean {
    return Boolean(m.scheduled_at && m.scheduled_at.slice(0, 10) === bogotaToday());
  }

  function isMissionUpcoming(m: Mission): boolean {
    if (!m.scheduled_at || m.status === "completed") return false;
    return m.scheduled_at.slice(0, 10) > bogotaToday();
  }

  const filtered = missions.filter((m) => {
    if (filter === "hoy") return isMissionToday(m);
    if (filter === "proximas") return isMissionUpcoming(m);
    if (filter === "active") return m.status !== "completed";
    if (filter === "completed") return m.status === "completed";
    return true;
  });

  const completedCount = missions.filter((m) => m.status === "completed").length;
  const activeCount = missions.filter((m) => m.status !== "completed").length;
  const lowCapacity = Boolean(capacityNotice);
  const shouldPrioritizeMissions = lowCapacity && !showAllDuringLowCapacity && filter !== "completed";
  const visibleMissions = shouldPrioritizeMissions
    ? filtered.filter((mission) => mission.status !== "completed").slice(0, 1)
    : filtered;

  function resetForm() {
    setName("");
    setDescription("");
    setPriority("medium");
    setScheduledAt("");
    setGoalId("");
    setProgressIncrement("");
    setEditingId(null);
    setCreating(false);
  }

  function startStarterMission(starterName: string, starterPriority = "medium") {
    setName(starterName);
    setDescription("");
    setPriority(starterPriority);
    setScheduledAt(bogotaToday());
    setGoalId(initialGoalId || "");
    setProgressIncrement("");
    setEditingId(null);
    setStatus({});
    setCreating(true);
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setStatus({});
    startTransition(async () => {
      try {
        await createMission({
          name: name.trim(),
          description,
          priority,
          scheduled_at: scheduledAt || undefined,
          goal_id: goalId || undefined,
          progress_increment: goalId && progressIncrement ? Number(progressIncrement) : 0,
        });
        setStatus({ success: "Misión creada" });
        resetForm();
        router.refresh();
      } catch (e: unknown) {
        setStatus({ error: e instanceof Error ? e.message : "Error al crear" });
      }
    });
  }

  async function handleUpdate(missionId: string) {
    if (!name.trim()) return;
    setStatus({});
    startTransition(async () => {
      try {
        await updateMission(missionId, {
          name: name.trim(),
          description,
          priority,
          scheduled_at: scheduledAt || undefined,
          goal_id: goalId || null,
          progress_increment: goalId && progressIncrement ? Number(progressIncrement) : 0,
        });
        setStatus({ success: "Misión actualizada" });
        resetForm();
        router.refresh();
      } catch (e: unknown) {
        setStatus({ error: e instanceof Error ? e.message : "Error al actualizar" });
      }
    });
  }

  function handleDeleteClick(missionId: string) {
    if (confirmDeleteId === missionId) {
      handleDelete(missionId);
    } else {
      setConfirmDeleteId(missionId);
    }
  }

  async function handleDelete(missionId: string) {
    setDeletingId(missionId);
    setConfirmDeleteId(null);
    setStatus({});
    try {
      await deleteMission(missionId);
      router.refresh();
    } catch (e: unknown) {
      setStatus({ error: e instanceof Error ? e.message : "Error al eliminar" });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggle(mission: Mission) {
    setTogglingId(mission.id);
    setStatus({});
    const newStatus = mission.status === "completed" ? "active" : "completed";
    try {
      const result = await updateMission(mission.id, { status: newStatus });
      const progressMessage = result.goal_progress
        ? `Sumaste ${result.goal_progress.applied_increment} de progreso a tu meta.`
        : undefined;
      if (result.new_achievement || progressMessage) {
        setStatus({ success: [progressMessage, result.new_achievement && `Logro desbloqueado: ${result.new_achievement}`].filter(Boolean).join(" ") });
      }
      router.refresh();
    } catch (e: unknown) {
      setStatus({ error: e instanceof Error ? e.message : "Error al actualizar" });
    } finally {
      setTogglingId(null);
    }
  }

  function startEdit(mission: Mission) {
    setName(mission.name || mission.title || "");
    setDescription(mission.description || "");
    setPriority(mission.priority || "medium");
    setScheduledAt(mission.scheduled_at?.substring(0, 10) || "");
    setGoalId(mission.goal_id || "");
    setProgressIncrement(mission.progress_increment ? String(mission.progress_increment) : "");
    setEditingId(mission.id);
    setCreating(true);
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 pb-8">
      <Card className="border-[#2A2A3C] bg-[#17171A]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-[#FFD700]">Misiones</CardTitle>
              <CardDescription>
                {activeCount} pendientes · {completedCount} completadas
              </CardDescription>
            </div>
            {!creating && (
              <Button
                onClick={() => { resetForm(); setGoalId(initialGoalId || ""); setCreating(true); }}
                className="bg-[#7C5DFF] hover:bg-[#7C5DFF]/90 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nueva mision
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {status.success && <FormStatus success={status.success} />}
          {status.error && <FormStatus error={status.error} />}

          {lowCapacity && (
            <div className="flex flex-wrap items-center justify-between gap-3 border border-[#7C5DFF]/45 bg-[#7C5DFF]/10 p-3 text-sm text-[#d5ccff]">
              <span className="flex items-start gap-2"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />{capacityNotice}</span>
              {activeCount > 1 && (
                <button
                  type="button"
                  onClick={() => setShowAllDuringLowCapacity((value) => !value)}
                  className="font-mono text-[11px] uppercase text-white underline underline-offset-4"
                >
                  {showAllDuringLowCapacity ? "Ver prioridad" : `Ver las ${activeCount} pendientes`}
                </button>
              )}
            </div>
          )}

          {creating && (
            <div className="border border-[#2A2A3C] bg-[#0C0C0E] p-4 space-y-3">
              {lowCapacity && (
                <p className="border-l-2 border-[#FFD700] pl-3 text-xs leading-5 text-[#ffe476]">
                  Antes de crearla, revisa si realmente cabe hoy. Una misión concreta vale más que una lista imposible.
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-gray-300">Nombre</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Que necesitas hacer?"
                    maxLength={200}
                    className="mt-1 border-[#2A2A3C] bg-[#0C0C0E] text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">Fecha</Label>
                  <Input
                    type="date"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="mt-1 border-[#2A2A3C] bg-[#0C0C0E] text-white color-scheme-dark"
                  />
                </div>
              </div>
              <div>
                <Label className="text-gray-300">Descripcion</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Opcional"
                  className="mt-1 border-[#2A2A3C] bg-[#0C0C0E] text-white"
                />
              </div>
              <div className="flex items-center gap-3">
                <div>
                  <Label className="text-gray-300 text-xs">Prioridad</Label>
                  <div className="flex gap-2 mt-1">
                    {["high", "medium", "low"].map((p) => (
                      <button
                        key={p}
                        onClick={() => setPriority(p)}
                        className={`px-3 py-1 text-xs border rounded ${
                          priority === p
                            ? PRIORITY_COLORS[p]
                            : "border-[#2A2A3C] text-gray-500"
                        }`}
                      >
                        {p === "high" ? "Alta" : p === "medium" ? "Media" : "Baja"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-gray-300">Meta vinculada</Label>
                  <select
                    value={goalId}
                    onChange={(event) => setGoalId(event.target.value)}
                    className="mt-1 h-10 w-full border border-[#2A2A3C] bg-[#0C0C0E] px-3 text-sm text-white"
                  >
                    <option value="">Sin meta vinculada</option>
                    {goals.filter((goal) => goal.status !== "archived").map((goal) => (
                      <option key={goal.id} value={goal.id}>{goal.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-gray-300">Progreso al completar</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={progressIncrement}
                    onChange={(event) => setProgressIncrement(event.target.value)}
                    disabled={!goalId}
                    placeholder={goalId ? "Ej.: 1, 5 o 30" : "Elige una meta primero"}
                    className="mt-1 border-[#2A2A3C] bg-[#0C0C0E] text-white"
                  />
                </div>
              </div>
              {goalId && (
                <p className="text-xs text-gray-400">Al completar la misión, este avance se sumará una sola vez a la meta. Reabrirla no lo descuenta.</p>
              )}
              <div className="flex gap-2">
                <Button
                  onClick={() => (editingId ? handleUpdate(editingId) : handleCreate())}
                  disabled={isPending || !name.trim()}
                  className="bg-[#7C5DFF] hover:bg-[#7C5DFF]/90 text-white"
                >
                  {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingId ? "Guardar cambios" : "Crear mision"}
                </Button>
                <Button
                  variant="outline"
                  onClick={resetForm}
                  className="border-[#2A2A3C] text-gray-400"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1 text-xs border rounded transition-colors ${
                  filter === f.key
                    ? "border-[#7C5DFF] bg-[#7C5DFF]/10 text-white"
                    : "border-[#2A2A3C] text-gray-400 hover:text-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="border-t border-[#2A2A3C]" />

          {visibleMissions.length === 0 ? (
            missions.length === 0 && !creating ? (
              <div className="border border-[#2A2A3C] bg-[#0C0C0E] p-5 sm:p-6">
                <span className="hud-label text-[#7C5DFF]">PRIMERA MISIÓN</span>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">Haz que hoy cuente con una acción concreta</h3>
                    <p className="mt-1 max-w-2xl text-sm text-gray-400">Elige una base, ajusta el nombre si quieres y guárdala. No necesitas planear toda la semana ahora.</p>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-gray-500">Se programa para hoy</span>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Button type="button" variant="outline" onClick={() => startStarterMission("Ordenar mi día durante 10 minutos")} className="h-auto min-h-28 min-w-0 justify-start gap-3 whitespace-normal border-[#2A2A3C] px-4 py-4 text-left hover:border-[#7C5DFF]/70">
                    <CalendarClock className="h-5 w-5 shrink-0 text-[#7C5DFF]" />
                    <span className="min-w-0"><span className="block font-semibold text-white">Ordenar mi día</span><span className="mt-1 block break-words text-xs font-normal leading-5 text-gray-400">Revisar turnos, pendientes y una prioridad.</span></span>
                  </Button>
                  <Button type="button" variant="outline" onClick={() => startStarterMission("Entrenar 30 minutos", "high")} className="h-auto min-h-28 min-w-0 justify-start gap-3 whitespace-normal border-[#2A2A3C] px-4 py-4 text-left hover:border-[#7C5DFF]/70">
                    <Dumbbell className="h-5 w-5 shrink-0 text-[#00FF9D]" />
                    <span className="min-w-0"><span className="block font-semibold text-white">Mover mi cuerpo</span><span className="mt-1 block break-words text-xs font-normal leading-5 text-gray-400">Una sesión realista, no una rutina perfecta.</span></span>
                  </Button>
                  <Button type="button" variant="outline" onClick={() => startStarterMission("Registrar mis gastos de hoy")} className="h-auto min-h-28 min-w-0 justify-start gap-3 whitespace-normal border-[#2A2A3C] px-4 py-4 text-left hover:border-[#7C5DFF]/70">
                    <WalletCards className="h-5 w-5 shrink-0 text-[#FFD700]" />
                    <span className="min-w-0"><span className="block font-semibold text-white">Cuidar mi dinero</span><span className="mt-1 block break-words text-xs font-normal leading-5 text-gray-400">Registrar primero para decidir mejor después.</span></span>
                  </Button>
                  <Button type="button" variant="outline" onClick={() => startStarterMission("Leer 10 minutos antes de dormir")} className="h-auto min-h-28 min-w-0 justify-start gap-3 whitespace-normal border-[#2A2A3C] px-4 py-4 text-left hover:border-[#7C5DFF]/70">
                    <BookOpen className="h-5 w-5 shrink-0 text-[#B7A5FF]" />
                    <span className="min-w-0"><span className="block font-semibold text-white">Retomar la lectura</span><span className="mt-1 block break-words text-xs font-normal leading-5 text-gray-400">Un bloque breve que sí cabe en el día.</span></span>
                  </Button>
                </div>

                <div className="mt-5 grid gap-3 border-t border-[#2A2A3C] pt-4 text-sm sm:grid-cols-3">
                  <p className="text-gray-400"><span className="font-mono text-xs text-[#7C5DFF]">01</span><br /><span className="font-semibold text-white">Elige una misión</span><br />Una sola acción con final claro.</p>
                  <p className="text-gray-400"><span className="font-mono text-xs text-[#7C5DFF]">02</span><br /><span className="font-semibold text-white">Ajústala a tu realidad</span><br />Cambia nombre, fecha o prioridad si hace falta.</p>
                  <p className="text-gray-400"><span className="font-mono text-xs text-[#7C5DFF]">03</span><br /><span className="font-semibold text-white">Ciérrala cuando termines</span><br />Tu avance se vuelve visible, no solo pensado.</p>
                </div>
              </div>
            ) : (
              <EmptyState message="No hay misiones para este filtro. Prueba otra vista o crea una nueva." />
            )
          ) : (
            <div className="space-y-0">
              {visibleMissions.map((mission) => {
                const isCompleted = mission.status === "completed";
                const missionName = mission.name || mission.title || "Sin nombre";
                return (
                  <div
                    key={mission.id}
                    className="flex items-center gap-3 border-b border-[#1a1a1e] py-3 last:border-0"
                  >
                    <button
                      onClick={() => handleToggle(mission)}
                      disabled={togglingId === mission.id}
                      className="flex-shrink-0"
                    >
                      {togglingId === mission.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-[#7C5DFF]" />
                      ) : isCompleted ? (
                        <Check className="h-5 w-5 text-[#7C5DFF]" />
                      ) : (
                        <Circle className="h-5 w-5 text-gray-500" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm ${isCompleted ? "line-through text-gray-500" : "text-white"}`}>
                        {missionName}
                      </p>
                      {mission.scheduled_at && (
                        <p className="text-[10px] text-gray-500">{mission.scheduled_at.substring(0, 10)}</p>
                      )}
                      {mission.goal_id && (
                        <p className="text-[10px] text-[#B7A5FF]">
                          Meta: {goals.find((goal) => goal.id === mission.goal_id)?.name || "Vinculada"}
                          {mission.progress_increment ? ` · +${mission.progress_increment}` : ""}
                        </p>
                      )}
                    </div>
                    {mission.priority && (
                      <Badge className={`font-mono text-[10px] ${PRIORITY_COLORS[mission.priority] || ""}`}>
                        {mission.priority === "high" ? "Alta" : mission.priority === "medium" ? "Media" : "Baja"}
                      </Badge>
                    )}
                    <div className="flex gap-1">
                      <button
                        onClick={() => startEdit(mission)}
                        className="p-1 text-gray-500 hover:text-white transition-colors"
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {confirmDeleteId === mission.id ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleDeleteClick(mission.id)}
                            disabled={deletingId === mission.id}
                            className="p-1 text-red-400 hover:text-red-300 transition-colors"
                            title="Confirmar eliminar"
                          >
                            {deletingId === mission.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="p-1 text-gray-500 hover:text-white transition-colors"
                            title="Cancelar"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleDeleteClick(mission.id)}
                          className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
