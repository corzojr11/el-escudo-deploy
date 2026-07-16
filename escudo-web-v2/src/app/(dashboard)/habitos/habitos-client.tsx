"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CheckSquare, Flame, CalendarDays, Plus, Loader2 } from "lucide-react";
import { createHabit, toggleHabitToday } from "@/app/actions/habits";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { SubmitButton } from "@/components/dashboard/SubmitButton";
import { FormStatus } from "@/components/dashboard/FormStatus";
import { cn } from "@/lib/utils";
import type { Habit } from "@/lib/api/types";

interface HabitosClientProps {
  habits: Habit[];
}

function getLast7Days(): Date[] {
  const days: Date[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d);
  }
  return days;
}

function toISODate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function HabitCard({
  habit,
  onToggle,
  toggling,
}: {
  habit: Habit;
  onToggle: (habit: Habit, markDone: boolean) => void;
  toggling: string | null;
}) {
  const last7Days = useMemo(() => getLast7Days(), []);
  const completedDates = new Set(habit.completed_dates ?? []);
  const completedThisWeek = last7Days.filter((d) => completedDates.has(toISODate(d))).length;
  const today = toISODate(new Date());
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
            <span>Ultimos 7 dias</span>
            <span>
              {completedThisWeek} / {last7Days.length}
            </span>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {last7Days.map((day) => {
              const iso = toISODate(day);
              const completed = completedDates.has(iso);
              const label = day.toLocaleDateString("es-CO", { weekday: "narrow" });
              return (
                <div key={iso} className="flex flex-col items-center gap-1" title={`${iso}: ${completed ? "Completado" : "Pendiente"}`}>
                  <div
                    className={cn(
                      "flex aspect-square w-full items-center justify-center rounded-xl border text-xs font-medium",
                      completed
                        ? "border-escudo-green/30 bg-escudo-green/20 text-escudo-green shadow-[0_0_14px_rgba(42,245,152,0.24)]"
                        : "border-border bg-secondary/70 text-muted-foreground"
                    )}
                  >
                    {completed && <CheckSquare className="h-3 w-3" />}
                  </div>
                  <span className="text-[10px] uppercase text-muted-foreground">{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            Completado {completedDates.size} {completedDates.size === 1 ? "dia" : "dias"} en total
          </span>
          <Button
            type="button"
            size="sm"
            variant={doneToday ? "outline" : "default"}
            disabled={toggling === habit.id}
            onClick={() => onToggle(habit, !doneToday)}
            className={doneToday ? "border-escudo-green/30 bg-escudo-green/10 text-escudo-green" : ""}
          >
            {toggling === habit.id ? (
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

  async function handleToggle(habit: Habit, markDone: boolean) {
    setToggling(habit.id);
    const formData = new FormData();
    formData.set("habit_id", habit.id);
    formData.set("completed_dates", JSON.stringify(habit.completed_dates ?? []));
    formData.set("mark_done", markDone ? "true" : "false");
    const result = await toggleHabitToday(null, formData);
    setToggling(null);

    if (result.success) router.refresh();
    else setStatus({ error: result.error ?? "Error al actualizar el habito" });
  }

  const today = toISODate(new Date());
  const completedToday = habits.filter((h) => (h.completed_dates ?? []).includes(today)).length;
  const totalStreak = habits.reduce((sum, h) => sum + (h.streak ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <section className="panel-neon relative overflow-hidden rounded-[28px] p-6">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,rgba(42,245,152,0.12),transparent_62%)]" />
        <div className="relative flex flex-col gap-3">
          <span className="hud-label text-escudo-green">Streak Protocol</span>
          <h2 className="font-heading text-3xl font-black tracking-[0.1em] text-glow text-foreground md:text-4xl">
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
                  <CalendarDays className="h-4 w-4" /> Habitos
                </CardDescription>
                <CardTitle className="text-2xl text-foreground">{habits.length}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {habits.length === 0 ? (
            <EmptyState
              title="No tienes habitos aun"
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
