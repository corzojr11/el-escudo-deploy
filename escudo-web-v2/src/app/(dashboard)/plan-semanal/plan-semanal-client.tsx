"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, Circle, Flame, Plus, Sparkles, Wallet } from "lucide-react";
import { createMission, updateMission } from "@/app/actions/missions";
import { createPersonalEntry, updatePersonalEntry } from "@/app/actions/personal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Habit, Mission, PersonalEntry, Shift } from "@/lib/api/types";

const DAYS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];
const DAY_KEYS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];

function bogotaToday() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function weekDays() {
  const today = new Date(`${bogotaToday()}T12:00:00Z`);
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
  return DAYS.map((label, index) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + index);
    return { label, key: DAY_KEYS[index], date: date.toISOString().slice(0, 10) };
  });
}

function isTracker(entry: PersonalEntry, type: string) {
  return entry.kind === "discipline" && entry.data?.tracker_type === type;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function PlanSemanalClient({ missions, habits, shifts, personalEntries, loadErrors }: { missions: Mission[]; habits: Habit[]; shifts: Shift[]; personalEntries: PersonalEntry[]; loadErrors: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draftDay, setDraftDay] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [message, setMessage] = useState("");
  const [challengeTitle, setChallengeTitle] = useState("");
  const [challengeDays, setChallengeDays] = useState<28 | 100>(28);
  const [routineDraft, setRoutineDraft] = useState({ physical: "", mental: "", spiritual: "" });
  const days = weekDays();
  const today = bogotaToday();
  const challenge = personalEntries.find((entry) => isTracker(entry, "adaptive_challenge"));
  const morningRoutine = personalEntries.find((entry) => isTracker(entry, "morning_routine"));
  const challengeChecks = strings(challenge?.data.completed_dates);
  const routineChecks = record(morningRoutine?.data.completions)[today];
  const checkedAreas = strings(routineChecks);
  const challengeStart = typeof challenge?.data.start_date === "string" ? challenge.data.start_date : today;
  const totalDays = Number(challenge?.data.duration ?? challengeDays);
  const elapsed = Math.max(1, Math.min(totalDays, Math.floor((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${challengeStart}T12:00:00Z`)) / 86400000) + 1));

  function run(task: () => Promise<void>) {
    setMessage("");
    startTransition(async () => { try { await task(); router.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo guardar el cambio."); } });
  }

  function missionDate(mission: Mission) { return mission.scheduled_at?.slice(0, 10) ?? ""; }
  function createForDay(date: string) {
    if (!draftName.trim()) return;
    run(async () => { await createMission({ name: draftName.trim(), priority: "medium", scheduled_at: date }); setDraftName(""); setDraftDay(null); setMessage("Accion agregada a tu semana."); });
  }
  function toggleMission(mission: Mission) { run(async () => { await updateMission(mission.id, { status: mission.status === "completed" ? "active" : "completed" }); }); }
  function createChallenge() {
    if (!challengeTitle.trim()) return;
    run(async () => { await createPersonalEntry({ kind: "discipline", title: challengeTitle.trim(), data: { tracker_type: "adaptive_challenge", duration: challengeDays, start_date: today, completed_dates: [] } }); setChallengeTitle(""); setMessage("Desafío creado. Si fallas un día, vuelves al siguiente sin reiniciar todo."); });
  }
  function toggleChallengeToday() {
    if (!challenge) return;
    const dates = challengeChecks.includes(today) ? challengeChecks.filter((date) => date !== today) : [...challengeChecks, today];
    run(async () => { await updatePersonalEntry(challenge.id, { title: challenge.title, content: challenge.content, data: { ...challenge.data, completed_dates: dates } }); });
  }
  function saveRoutine() {
    const areas = Object.values(routineDraft).filter(Boolean);
    if (!areas.length) return;
    const data = { tracker_type: "morning_routine", ...routineDraft, completions: record(morningRoutine?.data.completions) };
    run(async () => {
      if (morningRoutine) await updatePersonalEntry(morningRoutine.id, { title: "Rutina matutina", content: "Físico, mental y espiritual.", data });
      else await createPersonalEntry({ kind: "discipline", title: "Rutina matutina", content: "Físico, mental y espiritual.", data });
      setMessage("Rutina guardada. Marca cada area cuando la cumplas.");
    });
  }
  function toggleArea(area: string) {
    if (!morningRoutine) return;
    const next = checkedAreas.includes(area) ? checkedAreas.filter((item) => item !== area) : [...checkedAreas, area];
    run(async () => { await updatePersonalEntry(morningRoutine.id, { title: morningRoutine.title, content: morningRoutine.content, data: { ...morningRoutine.data, completions: { ...record(morningRoutine.data.completions), [today]: next } } }); });
  }

  return <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 pb-8">
    <Card className="border-[#2A2A3C] bg-[#17171A]"><CardHeader><p className="hud-label text-[#bcaeff]">SISTEMA DE SEGUIMIENTO</p><CardTitle className="text-3xl text-white">Tu semana, tus retos y tu energía</CardTitle><CardDescription>Un tablero vivo: eliges acciones, mides constancia y retomas el rumbo sin castigos cuando una semana se complica.</CardDescription></CardHeader></Card>
    {loadErrors > 0 && <div className="border border-[#FFD700]/40 bg-[#FFD700]/10 px-4 py-3 text-sm text-[#FFD700]">Algunas fuentes no cargaron. Puedes continuar con lo disponible.</div>}
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="border-[#2A2A3C] bg-[#17171A]"><CardHeader><p className="hud-label text-[#bcaeff]">DESAFIO ADAPTABLE</p><CardTitle className="flex items-center gap-2 text-white"><Flame className="h-5 w-5 text-[#FFD700]" /> {challenge?.title ?? "Construye una racha que resista dias dificiles"}</CardTitle><CardDescription>{challenge ? `Dia ${elapsed} de ${totalDays}. ${challengeChecks.length} dias cumplidos: el progreso no se pierde por una pausa.` : "Elige 4 semanas o 100 dias para una sola direccion importante."}</CardDescription></CardHeader><CardContent className="space-y-3">{challenge ? <Button onClick={toggleChallengeToday} disabled={isPending} className="w-full bg-[#7C5DFF] hover:bg-[#7C5DFF]/90">{challengeChecks.includes(today) ? <><Check className="mr-2 h-4 w-4" /> Hoy ya avance</> : "Marcar avance de hoy"}</Button> : <><Input value={challengeTitle} onChange={(event) => setChallengeTitle(event.target.value)} placeholder="Ej. 28 dias sin abandonar mi lectura" className="border-[#2A2A3C] bg-[#0C0C0E] text-white" /><div className="flex gap-2"><Button variant={challengeDays === 28 ? "default" : "outline"} onClick={() => setChallengeDays(28)}>4 semanas</Button><Button variant={challengeDays === 100 ? "default" : "outline"} onClick={() => setChallengeDays(100)}>100 dias</Button><Button disabled={isPending || !challengeTitle.trim()} onClick={createChallenge} className="ml-auto bg-[#7C5DFF]">Crear reto</Button></div></>}</CardContent></Card>
      <Card className="border-[#2A2A3C] bg-[#17171A]"><CardHeader><p className="hud-label text-[#bcaeff]">RUTINA MATUTINA</p><CardTitle className="flex items-center gap-2 text-white"><Sparkles className="h-5 w-5 text-[#FFD700]" /> Físico, mental y espiritual</CardTitle><CardDescription>Empieza pequeño: una acción por área vale más que una rutina perfecta abandonada.</CardDescription></CardHeader><CardContent className="space-y-3">{morningRoutine ? <>{(["physical", "mental", "spiritual"] as const).map((area) => { const label = area === "physical" ? "Físico" : area === "mental" ? "Mental" : "Espiritual"; const activity = typeof morningRoutine.data[area] === "string" ? morningRoutine.data[area] : "Sin definir"; return <button key={area} disabled={isPending} onClick={() => toggleArea(area)} className="flex w-full items-center gap-3 border border-[#2A2A3C] p-3 text-left"><span className={checkedAreas.includes(area) ? "text-[#7C5DFF]" : "text-muted-foreground"}>{checkedAreas.includes(area) ? <Check className="h-5 w-5" /> : <Circle className="h-5 w-5" />}</span><span><b className="block text-sm text-white">{label}</b><span className="text-xs text-muted-foreground">{activity}</span></span></button>; })}<p className="text-xs text-muted-foreground">{checkedAreas.length}/3 áreas cumplidas hoy.</p></> : <><Input value={routineDraft.physical} onChange={(event) => setRoutineDraft({ ...routineDraft, physical: event.target.value })} placeholder="Físico: ej. 15 min de movilidad" className="border-[#2A2A3C] bg-[#0C0C0E] text-white" /><Input value={routineDraft.mental} onChange={(event) => setRoutineDraft({ ...routineDraft, mental: event.target.value })} placeholder="Mental: ej. leer 10 páginas" className="border-[#2A2A3C] bg-[#0C0C0E] text-white" /><Input value={routineDraft.spiritual} onChange={(event) => setRoutineDraft({ ...routineDraft, spiritual: event.target.value })} placeholder="Espiritual: ej. oración o gratitud" className="border-[#2A2A3C] bg-[#0C0C0E] text-white" /><Button disabled={isPending} onClick={saveRoutine} className="w-full bg-[#7C5DFF]">Guardar mi rutina</Button></>}</CardContent></Card>
    </div>
    <Card className="border-[#2A2A3C] bg-[#17171A]"><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="hud-label text-[#bcaeff]">PLAN SEMANAL</p><CardTitle className="text-white">Acciones, turnos y hábitos</CardTitle></div><Link className="flex items-center gap-2 text-sm text-[#FFD700] hover:underline" href="/finanzas"><Wallet className="h-4 w-4" /> Abrir protocolo financiero</Link></div></CardHeader><CardContent><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">{days.map((day) => { const dayMissions = missions.filter((mission) => missionDate(mission) === day.date); const shift = shifts.find((item) => item.day.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "") === day.key); const habitsDone = habits.filter((habit) => habit.completed_dates?.some((date) => date.slice(0, 10) === day.date)).length; return <div key={day.date} className={`min-h-64 border p-3 ${day.date === today ? "border-[#7C5DFF]" : "border-[#2A2A3C]"}`}><div className="mb-3 flex justify-between"><b className="text-sm text-white">{day.label}</b><span className="font-mono text-xs text-[#bcaeff]">{day.date.slice(8)}</span></div><p className="mb-2 text-xs text-muted-foreground">{shift ? `Turno ${shift.start}-${shift.end}` : "Sin turno"} · Hábitos {habitsDone}/{habits.length}</p><div className="space-y-2">{dayMissions.map((mission) => <button key={mission.id} disabled={isPending} onClick={() => toggleMission(mission)} className="flex w-full gap-2 text-left text-xs"><span className={mission.status === "completed" ? "text-[#7C5DFF]" : "text-muted-foreground"}>{mission.status === "completed" ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}</span><span className={mission.status === "completed" ? "line-through text-muted-foreground" : "text-white"}>{mission.name ?? mission.title}</span></button>)}</div>{draftDay === day.date ? <div className="mt-3 space-y-2"><Input autoFocus value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="Acción concreta" className="h-8 border-[#2A2A3C] bg-[#0C0C0E] text-xs text-white" /><Button size="sm" disabled={isPending || !draftName.trim()} onClick={() => createForDay(day.date)} className="w-full bg-[#7C5DFF]">Guardar</Button></div> : <button onClick={() => { setDraftDay(day.date); setDraftName(""); }} className="mt-3 flex items-center gap-1 text-xs text-[#d5ccff]"><Plus className="h-3.5 w-3.5" /> Agregar acción</button>}</div>; })}</div></CardContent></Card>
    <Card className="border-[#2A2A3C] bg-[#17171A]"><CardContent className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm text-muted-foreground"><span>{message || "El objetivo no es llenar el tablero: es que tu semana te ayude a respirar, avanzar y volver a ti."}</span><Link className="inline-flex items-center gap-2 text-[#d5ccff] hover:underline" href="/habitos"><CalendarDays className="h-4 w-4" /> Ver habitos</Link></CardContent></Card>
  </div>;
}
