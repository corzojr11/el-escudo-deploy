"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CheckSquare, Flame, CalendarDays, Plus, Loader2, TrendingUp, Target } from "lucide-react";
import { createHabit, toggleHabitToday } from "@/app/actions/habits";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { SubmitButton } from "@/components/dashboard/SubmitButton";
import { FormStatus } from "@/components/dashboard/FormStatus";
import { cn } from "@/lib/utils";
import type { Habit } from "@/lib/api/types";

interface HabitosClientProps {
  habits: Habit[];
}

function bogotaToday(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts();
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function getRecentDays(count: number): Date[] {
  const days: Date[] = [];
  const [year, month, day] = bogotaToday().split("-").map(Number);
  const today = new Date(Date.UTC(year, month - 1, day, 12));
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    days.push(d);
  }
  return days;
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dayLabel(date: Date, options: Intl.DateTimeFormatOptions): string {
  return date.toLocaleDateString("es-CO", { ...options, timeZone: "UTC" });
}

function HabitCard({
  habit,
  onToggle,
  toggling,
}: {
  habit: Habit;
  onToggle: (habit: Habit, date: string, markDone: boolean) => void;
  toggling: string | null;
}) {
  const last7Days = useMemo(() => getRecentDays(7), []);
  const completedDates = new Set(habit.completed_dates ?? []);
  const completedThisWeek = last7Days.filter((d) => completedDates.has(toISODate(d))).length;
  const today = bogotaToday();
  const doneToday = completedDates.has(today);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base text-foreground">{habit.name}</CardTitle>
            <CardDescription>
              Frecuencia: {habit.frequency === "daily" ? "Diaria" : "Semanal"}
            </CardDescription>
          </div>
          <Badge variant="outline" className="border-escudo-gold/30 bg-escudo-gold/10 text-escudo-gold">
            <Flame className="mr-1 h-3 w-3" />
            Racha {habit.streak ?? 0}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Últimos 7 días</span>
            <span>
              {completedThisWeek} / {last7Days.length}
            </span>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {last7Days.map((day) => {
              const iso = toISODate(day);
              const completed = completedDates.has(iso);
              const label = dayLabel(day, { weekday: "narrow" });
              return (
                <div key={iso} className="flex flex-col items-center gap-1" title={`${iso}: ${completed ? "Completado" : "Pendiente"}`}>
                  <button
                    type="button"
                    aria-label={`${completed ? "Desmarcar" : "Completar"} ${habit.name} el ${iso}`}
                    disabled={toggling === `${habit.id}:${iso}`}
                    onClick={() => onToggle(habit, iso, !completed)}
                    className={cn(
                      "flex aspect-square w-full items-center justify-center rounded-xl border text-xs font-medium transition-colors disabled:opacity-50",
                      completed
                        ? "border-escudo-green/30 bg-escudo-green/20 text-escudo-green"
                        : "border-border bg-secondary/70 text-muted-foreground hover:border-primary/50 hover:text-primary"
                    )}
                  >
                    {toggling === `${habit.id}:${iso}` ? <Loader2 className="h-3 w-3 animate-spin" /> : completed && <CheckSquare className="h-3 w-3" />}
                  </button>
                  <span className="text-[10px] uppercase text-muted-foreground">{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            Completado {completedDates.size} {completedDates.size === 1 ? "día" : "días"} en total
          </span>
          <Button
            type="button"
            size="sm"
            variant={doneToday ? "outline" : "default"}
            disabled={toggling === `${habit.id}:${today}`}
            onClick={() => onToggle(habit, today, !doneToday)}
            className={doneToday ? "border-escudo-green/30 bg-escudo-green/10 text-escudo-green" : ""}
          >
            {toggling === `${habit.id}:${today}` ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <CheckSquare className="mr-1 h-4 w-4" />
            )}
            {doneToday ? "Completado" : "Completar hoy"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function HabitosClient({ habits }: HabitosClientProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<{ success?: string; error?: string }>({});
  const [toggling, setToggling] = useState<string | null>(null);
  const [, startCreateTransition] = useTransition();

  async function handleCreateHabit(formData: FormData) {
    setStatus({});
    startCreateTransition(async () => {
      const result = await createHabit(null, formData);
      if (result.success) {
        setStatus({ success: "Habito creado correctamente." });
        formRef.current?.reset();
        router.refresh();
      } else {
        setStatus({ error: result.error ?? "Error al crear el habito" });
      }
    });
  }

  async function handleToggle(habit: Habit, date: string, markDone: boolean) {
    setToggling(`${habit.id}:${date}`);
    const formData = new FormData();
    formData.set("habit_id", habit.id);
    formData.set("mark_done", markDone ? "true" : "false");
    formData.set("date", date);
    const result = await toggleHabitToday(null, formData);
    setToggling(null);

    if (result.success) router.refresh();
    else setStatus({ error: result.error ?? "Error al actualizar el habito" });
  }

  const today = bogotaToday();
  const completedToday = habits.filter((h) => (h.completed_dates ?? []).includes(today)).length;
  const totalStreak = habits.reduce((sum, h) => sum + (h.streak ?? 0), 0);
  const last7Days = useMemo(() => getRecentDays(7), []);
  const previous7Days = useMemo(() => getRecentDays(14).slice(0, 7), []);
  const expectedThisWeek = habits.reduce((total, habit) => total + (habit.frequency === "weekly" ? 1 : 7), 0);
  const completedThisWeek = habits.reduce(
    (total, habit) => total + last7Days.filter((day) => (habit.completed_dates ?? []).includes(toISODate(day))).length,
    0
  );
  const completedPreviousWeek = habits.reduce(
    (total, habit) => total + previous7Days.filter((day) => (habit.completed_dates ?? []).includes(toISODate(day))).length,
    0
  );
  const focusHabit = habits.find((habit) => !(habit.completed_dates ?? []).includes(today));
  const monthDays = useMemo(() => getRecentDays(30), []);

  return (
    <div className="flex flex-col gap-6">
      <section className="panel-neon relative overflow-hidden p-6">
        <div className="relative flex flex-col gap-3">
          <span className="hud-label text-escudo-green">SISTEMA DE RACHA</span>
          <h2 className="font-heading text-3xl font-black tracking-[0.14em] text-glow text-foreground md:text-4xl">
            HABITOS
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
            Construye rutina, protege rachas y completa el ciclo diario desde una vista gamer.
          </p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <span className="hud-label text-accent">Create Habit</span>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-5 w-5 text-escudo-gold" /> Nuevo habito
            </CardTitle>
            <CardDescription>Agrega una rutina y empieza a marcarla hoy</CardDescription>
          </CardHeader>
          <CardContent>
            <form ref={formRef} action={handleCreateHabit} className="flex flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input id="name" name="name" placeholder="Ej. Tomar 2L de agua" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="frequency">Frecuencia</Label>
                <select
                  id="frequency"
                  name="frequency"
                  required
                  className="h-11 w-full rounded-xl border border-border/80 bg-input/80 px-3 py-2 text-sm text-foreground outline-none transition-all focus-visible:border-accent/60 focus-visible:ring-3 focus-visible:ring-accent/20"
                >
                  <option value="daily">Diaria</option>
                  <option value="weekly">Semanal</option>
                </select>
              </div>
              <FormStatus {...status} />
              <SubmitButton className="w-full">Crear habito</SubmitButton>
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2 text-escudo-green">
                  <CheckSquare className="h-4 w-4" /> Hoy
                </CardDescription>
                <CardTitle className="text-2xl text-foreground">
                  {completedToday} / {habits.length}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2 text-escudo-gold">
                  <Flame className="h-4 w-4" /> Racha total
                </CardDescription>
                <CardTitle className="text-2xl text-escudo-gold">{totalStreak}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2 text-escudo-cyan">
                  <CalendarDays className="h-4 w-4" /> Hábitos
                </CardDescription>
                <CardTitle className="text-2xl text-foreground">{habits.length}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {habits.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
              <Card>
                <CardHeader className="pb-3">
                  <span className="hud-label text-accent">Ritmo mensual</span>
                  <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4 text-primary" /> Últimos 30 días</CardTitle>
                  <CardDescription>Tu constancia real por día. Cada bloque muestra hábitos completados.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-[repeat(10,minmax(0,1fr))] gap-2 sm:grid-cols-[repeat(15,minmax(0,1fr))]">
                    {monthDays.map((day) => {
                      const iso = toISODate(day);
                      const completed = habits.filter((habit) => (habit.completed_dates ?? []).includes(iso)).length;
                      const level = completed === 0 ? "border-border bg-secondary/60 text-muted-foreground" : completed === habits.length ? "border-escudo-green/50 bg-escudo-green/25 text-escudo-green" : "border-primary/50 bg-primary/20 text-primary";
                      return (
                        <div key={iso} title={`${iso}: ${completed}/${habits.length} hábitos`} className={cn("flex aspect-square items-center justify-center rounded-sm border text-[10px] font-medium", level)}>
                          {dayLabel(day, { day: "numeric" })}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <span className="hud-label text-escudo-gold">Revision semanal</span>
                  <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4 text-escudo-gold" /> Tu ritmo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="border-b border-border pb-3">
                    <p className="text-2xl font-bold text-foreground">{completedThisWeek} <span className="text-sm font-normal text-muted-foreground">/ {expectedThisWeek}</span></p>
                    <p className="mt-1 text-xs text-muted-foreground">registros previstos esta semana</p>
                  </div>
                  <p className="leading-6 text-muted-foreground">
                    {completedThisWeek > completedPreviousWeek
                      ? "Vas mejor que la semana pasada. Protege una acción pequeña mañana."
                      : completedThisWeek === completedPreviousWeek
                        ? "Mantienes el ritmo. Una acción concreta hoy puede inclinar la semana a tu favor."
                        : "Esta semana ha sido mas pesada. Retoma solo un habito, no intentes arreglarlo todo hoy."}
                  </p>
                  {focusHabit && (
                    <div className="flex items-start gap-2 border border-primary/35 bg-primary/10 p-3">
                      <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <p className="text-xs leading-5 text-foreground"><span className="font-semibold">Siguiente paso:</span> {focusHabit.name}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {habits.length === 0 ? (
            <EmptyState
              title="Aún no tienes hábitos"
              message="Crea tu primer habito para empezar a registrar tu constancia."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {habits.map((habit) => (
                <HabitCard key={habit.id} habit={habit} onToggle={handleToggle} toggling={toggling} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
