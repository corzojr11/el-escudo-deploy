"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  CheckSquare,
  Flame,
  CalendarDays,
  Plus,
  Loader2,
} from "lucide-react";
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
  const completedThisWeek = last7Days.filter((d) =>
    completedDates.has(toISODate(d))
  ).length;
  const today = toISODate(new Date());
  const doneToday = completedDates.has(today);

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base text-foreground">{habit.name}</CardTitle>
            <CardDescription>
              Frecuencia: {habit.frequency === "daily" ? "Diaria" : "Semanal"}
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className="border-escudo-gold/30 text-escudo-gold"
          >
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
          <div className="flex justify-between gap-1">
            {last7Days.map((day) => {
              const iso = toISODate(day);
              const completed = completedDates.has(iso);
              const label = day.toLocaleDateString("es-CO", { weekday: "narrow" });
              return (
                <div
                  key={iso}
                  className="flex flex-1 flex-col items-center gap-1"
                  title={`${iso}: ${completed ? "Completado" : "Pendiente"}`}
                >
                  <div
                    className={cn(
                      "flex aspect-square w-full max-w-[2rem] items-center justify-center rounded-md border text-xs font-medium",
                      completed
                        ? "border-escudo-green/30 bg-escudo-green/20 text-escudo-green"
                        : "border-border bg-secondary text-muted-foreground"
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
            Completado {completedDates.size}{" "}
            {completedDates.size === 1 ? "día" : "días"} en total
          </span>
          <Button
            type="button"
            size="sm"
            variant={doneToday ? "outline" : "default"}
            disabled={toggling === habit.id}
            onClick={() => onToggle(habit, !doneToday)}
            className={
              doneToday
                ? "border-escudo-green/30 text-escudo-green hover:bg-escudo-green/10"
                : "bg-escudo-green text-primary-foreground hover:bg-escudo-green/90"
            }
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
        setStatus({ success: "Hábito creado correctamente." });
        formRef.current?.reset();
        router.refresh();
      } else {
        setStatus({ error: result.error ?? "Error al crear el hábito" });
      }
    });
  }

  async function handleToggle(habit: Habit, markDone: boolean) {
    setToggling(habit.id);
    const formData = new FormData();
    formData.set("habit_id", habit.id);
    formData.set(
      "completed_dates",
      JSON.stringify(habit.completed_dates ?? [])
    );
    formData.set("mark_done", markDone ? "true" : "false");

    const result = await toggleHabitToday(null, formData);
    setToggling(null);

    if (result.success) {
      router.refresh();
    } else {
      setStatus({ error: result.error ?? "Error al actualizar el hábito" });
    }
  }

  if (habits.length === 0) {
    // Show inline empty state with form accessible
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Hábitos</h2>
          <p className="text-sm text-muted-foreground">
            Construye rutinas positivas y sigue tus rachas.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-1">
            <EmptyState
              title="No tienes hábitos aún"
              message="Crea tu primer hábito para empezar a registrar tu constancia."
            />
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Plus className="h-5 w-5 text-escudo-gold" /> Nuevo hábito
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form ref={formRef} action={handleCreateHabit} className="flex flex-col gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre</Label>
                    <Input id="name" name="name" placeholder="Ej. Tomar 2L de agua" required className="border-input bg-secondary" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="frequency">Frecuencia</Label>
                    <select id="frequency" name="frequency" required className="flex h-10 w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <option value="daily">Diaria</option>
                      <option value="weekly">Semanal</option>
                    </select>
                  </div>
                  <FormStatus {...status} />
                  <SubmitButton className="w-full bg-escudo-gold text-primary-foreground hover:bg-escudo-gold/90">
                    Crear hábito
                  </SubmitButton>
                </form>
              </CardContent>
            </Card>
          </div>
          <div className="lg:col-span-2" />
        </div>
      </div>
    );
  }

  const today = toISODate(new Date());
  const completedToday = habits.filter((h) =>
    (h.completed_dates ?? []).includes(today)
  ).length;
  const totalStreak = habits.reduce((sum, h) => sum + (h.streak ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Hábitos</h2>
        <p className="text-sm text-muted-foreground">
          {habits.length} hábitos · {completedToday} completados hoy ·{" "}
          {totalStreak} racha total
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Formulario crear hábito */}
        <Card className="border-border bg-card lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-5 w-5 text-escudo-gold" /> Nuevo hábito
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form ref={formRef} action={handleCreateHabit} className="flex flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Ej. Tomar 2L de agua"
                  required
                  className="border-input bg-secondary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="frequency">Frecuencia</Label>
                <select
                  id="frequency"
                  name="frequency"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="daily">Diaria</option>
                  <option value="weekly">Semanal</option>
                </select>
              </div>
              <FormStatus {...status} />
              <SubmitButton className="w-full bg-escudo-gold text-primary-foreground hover:bg-escudo-gold/90">
                Crear hábito
              </SubmitButton>
            </form>
          </CardContent>
        </Card>

        {/* KPIs y listado */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2 text-escudo-gold">
                  <CheckSquare className="h-4 w-4" /> Hoy
                </CardDescription>
                <CardTitle className="text-2xl text-foreground">
                  {completedToday} / {habits.length}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2 text-escudo-gold">
                  <Flame className="h-4 w-4" /> Racha total
                </CardDescription>
                <CardTitle className="text-2xl text-escudo-gold">{totalStreak}</CardTitle>
              </CardHeader>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2 text-escudo-gold">
                  <CalendarDays className="h-4 w-4" /> Hábitos
                </CardDescription>
                <CardTitle className="text-2xl text-foreground">{habits.length}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {habits.map((habit) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                onToggle={handleToggle}
                toggling={toggling}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
