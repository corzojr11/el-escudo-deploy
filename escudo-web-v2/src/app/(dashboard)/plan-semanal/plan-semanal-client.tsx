"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, Circle, Loader2, Plus, Wallet } from "lucide-react";
import { createMission, updateMission } from "@/app/actions/missions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Habit, Mission, Shift } from "@/lib/api/types";

const DAY_KEYS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];
const PRIORITY_LABEL: Record<string, string> = { high: "Alta", medium: "Media", low: "Baja" };
const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

function bogotaDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return { year: get("year"), month: get("month"), day: get("day") };
}

function isoDate(date: Date) {
  const { year, month, day } = bogotaDateParts(date);
  return `${year}-${month}-${day}`;
}

function weekDays() {
  const { year, month, day } = bogotaDateParts();
  const today = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
  const mondayOffset = (today.getUTCDay() + 6) % 7;
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - mondayOffset);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + index);
    return { date: isoDate(date), label: DAY_NAMES[(index + 1) % 7], key: DAY_KEYS[(index + 1) % 7] };
  });
}

function missionDate(mission: Mission) {
  return mission.scheduled_at?.slice(0, 10) ?? "";
}

export function PlanSemanalClient({
  missions,
  habits,
  shifts,
  loadErrors,
}: {
  missions: Mission[];
  habits: Habit[];
  shifts: Shift[];
  loadErrors: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draftDay, setDraftDay] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const days = weekDays();
  const today = isoDate(new Date());
  const activeMissions = missions.filter((mission) => mission.status !== "completed");
  const weekMissionCount = missions.filter((mission) => days.some((day) => day.date === missionDate(mission))).length;
  const weekDone = missions.filter((mission) => mission.status === "completed" && days.some((day) => day.date === missionDate(mission))).length;
  const topPriority = activeMissions
    .filter((mission) => days.some((day) => day.date === missionDate(mission)))
    .sort((a, b) => PRIORITY_RANK[a.priority ?? "medium"] - PRIORITY_RANK[b.priority ?? "medium"])[0];

  function completedHabits(date: string) {
    return habits.filter((habit) => habit.completed_dates?.some((value) => value.slice(0, 10) === date)).length;
  }

  function createForDay(date: string) {
    if (!draftName.trim()) return;
    setStatus(null);
    startTransition(async () => {
      try {
        await createMission({ name: draftName.trim(), priority: "medium", scheduled_at: date });
        setDraftName("");
        setDraftDay(null);
        setStatus("Accion programada para la semana.");
        router.refresh();
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "No se pudo crear la accion.");
      }
    });
  }

  function toggleMission(mission: Mission) {
    startTransition(async () => {
      try {
        await updateMission(mission.id, { status: mission.status === "completed" ? "active" : "completed" });
        router.refresh();
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "No se pudo actualizar la accion.");
      }
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 pb-8">
      <Card className="border-[#2A2A3C] bg-[#17171A]">
        <CardHeader className="gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="hud-label text-[#bcaeff]">RUTA DE LA SEMANA</p>
            <CardTitle className="mt-1 text-3xl text-white">Plan semanal</CardTitle>
            <CardDescription className="mt-2 max-w-2xl">Una vista para decidir que importa, proteger tu energia y no perder de vista el trabajo que te acerca a tu salida.</CardDescription>
          </div>
          <div className="border border-[#7C5DFF] px-4 py-3 font-mono text-sm text-[#d5ccff]">
            {weekDone}/{weekMissionCount} misiones completadas
          </div>
        </CardHeader>
      </Card>

      {loadErrors > 0 && (
        <div className="border border-[#FFD700]/40 bg-[#FFD700]/10 px-4 py-3 text-sm text-[#FFD700]">
          Parte del plan no se pudo cargar. Lo que si esta disponible sigue siendo util.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.6fr_0.8fr]">
        <Card className="border-[#2A2A3C] bg-[#17171A]">
          <CardHeader>
            <p className="hud-label text-[#bcaeff]">FOCO PRINCIPAL</p>
            <CardTitle className="text-lg text-white">{topPriority?.name ?? topPriority?.title ?? "Elige una accion importante para esta semana"}</CardTitle>
            <CardDescription>{topPriority ? `Prioridad ${PRIORITY_LABEL[topPriority.priority ?? "medium"]}. Hazla antes de llenar la semana de tareas menores.` : "Programa una primera accion en el dia que mejor encaje con tu turno."}</CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-[#2A2A3C] bg-[#17171A]">
          <CardHeader>
            <p className="hud-label text-[#bcaeff]">LIBERTAD FINANCIERA</p>
            <CardTitle className="flex items-center gap-2 text-lg text-white"><Wallet className="h-4 w-4 text-[#FFD700]" /> Plan de deudas</CardTitle>
            <CardDescription>Revisa el pago minimo, vencimientos y tu margen antes de decidir gastos flexibles.</CardDescription>
          </CardHeader>
          <CardContent><Link className="text-sm font-medium text-[#FFD700] hover:underline" href="/finanzas">Abrir control de dinero</Link></CardContent>
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        {days.map((day) => {
          const dayMissions = missions.filter((mission) => missionDate(mission) === day.date);
          const dayShift = shifts.find((shift) => shift.day.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "") === day.key);
          const done = completedHabits(day.date);
          const isToday = day.date === today;

          return (
            <Card key={day.date} className={`min-h-72 border-[#2A2A3C] bg-[#17171A] ${isToday ? "border-[#7C5DFF]" : ""}`}>
              <CardHeader className="space-y-1 pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base text-white">{day.label}</CardTitle>
                  <span className="font-mono text-xs text-[#bcaeff]">{day.date.slice(8)}</span>
                </div>
                <CardDescription>{dayShift ? `Turno ${dayShift.start}-${dayShift.end}` : "Sin turno registrado"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="border-y border-[#2A2A3C] py-2 text-xs text-muted-foreground">
                  Habitos: <span className="font-mono text-[#FFD700]">{done}/{habits.length}</span>
                </div>
                <div className="space-y-2">
                  {dayMissions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin accion programada.</p>
                  ) : dayMissions.map((mission) => {
                    const completed = mission.status === "completed";
                    return (
                      <button key={mission.id} onClick={() => toggleMission(mission)} disabled={isPending} className="flex w-full items-start gap-2 text-left text-xs">
                        {completed ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#7C5DFF]" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                        <span className={completed ? "text-muted-foreground line-through" : "text-white"}>{mission.name ?? mission.title}</span>
                      </button>
                    );
                  })}
                </div>
                {draftDay === day.date ? (
                  <div className="space-y-2">
                    <Input autoFocus value={draftName} onChange={(event) => setDraftName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && createForDay(day.date)} placeholder="Una accion concreta" className="h-8 border-[#2A2A3C] bg-[#0C0C0E] text-xs text-white" />
                    <div className="flex gap-2"><Button size="sm" disabled={isPending || !draftName.trim()} onClick={() => createForDay(day.date)} className="h-7 bg-[#7C5DFF] text-xs hover:bg-[#7C5DFF]/90">{isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Guardar"}</Button><Button size="sm" variant="ghost" onClick={() => setDraftDay(null)} className="h-7 text-xs">Cancelar</Button></div>
                  </div>
                ) : (
                  <button onClick={() => { setDraftDay(day.date); setDraftName(""); }} className="flex items-center gap-1 text-xs font-medium text-[#d5ccff] hover:text-white"><Plus className="h-3.5 w-3.5" /> Agregar accion</button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-[#2A2A3C] bg-[#17171A]">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm text-muted-foreground">
          <span>{status ?? "No busques una semana perfecta: protege una prioridad y vuelve al plan al dia siguiente."}</span>
          <Link className="inline-flex items-center gap-2 font-medium text-[#d5ccff] hover:underline" href="/habitos"><CalendarDays className="h-4 w-4" /> Revisar consistencia de habitos</Link>
        </CardContent>
      </Card>
    </div>
  );
}
