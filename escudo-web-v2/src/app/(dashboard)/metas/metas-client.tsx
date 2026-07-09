"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target, Calendar, Trophy, Plus, TrendingUp } from "lucide-react";
import { createGoal, addMetric } from "@/app/actions/goals";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { SubmitButton } from "@/components/dashboard/SubmitButton";
import { FormStatus } from "@/components/dashboard/FormStatus";
import { formatDate } from "@/lib/api/helpers";
import type { Goal, Metric } from "@/lib/api/types";

interface MetasClientProps {
  goals: Goal[];
}

function GoalCard({ goal }: { goal: Goal }) {
  const latestMetric: Metric | undefined | null =
    goal.latest_metric ?? goal.recent_metrics?.[0];
  const currentValue = goal.current_value ?? latestMetric?.value ?? 0;
  const targetValue = goal.target_value ?? 0;
  const progress =
    targetValue > 0 ? Math.min((currentValue / targetValue) * 100, 100) : 0;
  const unit = goal.unit || latestMetric?.unit || "";

  const statusConfig = {
    active: {
      label: "Activa",
      className: "border-escudo-cyan/30 text-escudo-cyan",
    },
    completed: {
      label: "Completada",
      className: "border-escudo-green/30 text-escudo-green",
    },
    archived: {
      label: "Archivada",
      className: "border-muted-foreground/30 text-muted-foreground",
    },
  };
  const status = (goal.status ?? "active") as keyof typeof statusConfig;
  const config = statusConfig[status] ?? statusConfig.active;

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base text-foreground">{goal.name}</CardTitle>
            <CardDescription className="line-clamp-2">
              {goal.description || "Sin descripción"}
            </CardDescription>
          </div>
          <Badge variant="outline" className={config.className}>
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {targetValue > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progreso</span>
              <span className="font-medium text-escudo-green">
                {currentValue.toLocaleString("es-CO")} /{" "}
                {targetValue.toLocaleString("es-CO")} {unit}
              </span>
            </div>
            <Progress value={progress} className="h-2 bg-secondary" />
            <p className="text-right text-xs text-muted-foreground">
              {progress.toFixed(0)}%
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          {goal.goal_type && (
            <span className="flex items-center gap-1">
              <Target className="h-3 w-3" /> {goal.goal_type}
            </span>
          )}
          {goal.deadline && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" /> {formatDate(goal.deadline)}
            </span>
          )}
          {goal.priority != null && (
            <span className="flex items-center gap-1">
              <Trophy className="h-3 w-3" /> Prioridad {goal.priority}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function MetasClient({ goals }: MetasClientProps) {
  const router = useRouter();
  const createFormRef = useRef<HTMLFormElement>(null);
  const metricFormRef = useRef<HTMLFormElement>(null);
  const [createStatus, setCreateStatus] = useState<{ success?: string; error?: string }>({});
  const [metricStatus, setMetricStatus] = useState<{ success?: string; error?: string }>({});
  const [, startCreateTransition] = useTransition();
  const [, startMetricTransition] = useTransition();

  async function handleCreateGoal(formData: FormData) {
    setCreateStatus({});
    startCreateTransition(async () => {
      const result = await createGoal(null, formData);
      if (result.success) {
        setCreateStatus({ success: "Meta creada correctamente." });
        createFormRef.current?.reset();
        router.refresh();
      } else {
        setCreateStatus({ error: result.error ?? "Error al crear la meta" });
      }
    });
  }

  async function handleAddMetric(formData: FormData) {
    setMetricStatus({});
    startMetricTransition(async () => {
      const result = await addMetric(null, formData);
      if (result.success) {
        setMetricStatus({ success: "Progreso registrado correctamente." });
        metricFormRef.current?.reset();
        router.refresh();
      } else {
        setMetricStatus({ error: result.error ?? "Error al registrar progreso" });
      }
    });
  }

  const activeGoals = goals.filter((g) => g.status === "active" || !g.status);
  const completedGoals = goals.filter((g) => g.status === "completed");
  const archivedGoals = goals.filter((g) => g.status === "archived");

  if (goals.length === 0) {
    // Show inline empty state with form accessible
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Metas</h2>
          <p className="text-sm text-muted-foreground">
            Define y haz seguimiento de tus objetivos personales.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-1">
            <EmptyState
              title="No tienes metas aún"
              message="Crea tu primera meta para comenzar a medir tu progreso."
            />
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Plus className="h-5 w-5 text-escudo-gold" /> Nueva meta
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form ref={createFormRef} action={handleCreateGoal} className="flex flex-col gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre</Label>
                    <Input id="name" name="name" placeholder="Ej. Leer 12 libros" required className="border-input bg-secondary" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Descripción</Label>
                    <Input id="description" name="description" placeholder="Opcional" className="border-input bg-secondary" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="target_value">Objetivo</Label>
                      <Input id="target_value" name="target_value" type="number" step="0.01" min="0" placeholder="0" className="border-input bg-secondary" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="unit">Unidad</Label>
                      <Input id="unit" name="unit" placeholder="kg, libros..." className="border-input bg-secondary" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deadline">Fecha límite</Label>
                    <Input id="deadline" name="deadline" type="date" className="border-input bg-secondary" />
                  </div>
                  <FormStatus {...createStatus} />
                  <SubmitButton className="w-full bg-escudo-gold text-primary-foreground hover:bg-escudo-gold/90">
                    Crear meta
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Metas</h2>
        <p className="text-sm text-muted-foreground">
          {activeGoals.length} activas · {completedGoals.length} completadas ·{" "}
          {archivedGoals.length} archivadas
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Formularios */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Plus className="h-5 w-5 text-escudo-gold" /> Nueva meta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                ref={createFormRef}
                action={handleCreateGoal}
                className="flex flex-col gap-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Ej. Leer 12 libros"
                    required
                    className="border-input bg-secondary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Input
                    id="description"
                    name="description"
                    placeholder="Opcional"
                    className="border-input bg-secondary"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="target_value">Objetivo</Label>
                    <Input
                      id="target_value"
                      name="target_value"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0"
                      className="border-input bg-secondary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit">Unidad</Label>
                    <Input
                      id="unit"
                      name="unit"
                      placeholder="kg, libros..."
                      className="border-input bg-secondary"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deadline">Fecha límite</Label>
                  <Input
                    id="deadline"
                    name="deadline"
                    type="date"
                    className="border-input bg-secondary"
                  />
                </div>
                <FormStatus {...createStatus} />
                <SubmitButton className="w-full bg-escudo-gold text-primary-foreground hover:bg-escudo-gold/90">
                  Crear meta
                </SubmitButton>
              </form>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-5 w-5 text-escudo-cyan" /> Registrar progreso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                ref={metricFormRef}
                action={handleAddMetric}
                className="flex flex-col gap-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="goal_id">Meta</Label>
                  <select
                    id="goal_id"
                    name="goal_id"
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Selecciona una meta</option>
                    {activeGoals.map((goal) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="value">Valor</Label>
                  <Input
                    id="value"
                    name="value"
                    type="number"
                    step="0.01"
                    required
                    placeholder="0"
                    className="border-input bg-secondary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit">Unidad</Label>
                  <Input
                    id="unit"
                    name="unit"
                    placeholder="Opcional"
                    className="border-input bg-secondary"
                  />
                </div>
                <FormStatus {...metricStatus} />
                <SubmitButton className="w-full bg-escudo-cyan text-primary-foreground hover:bg-escudo-cyan/90">
                  Registrar progreso
                </SubmitButton>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Listado de metas */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {activeGoals.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {activeGoals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} />
              ))}
            </div>
          )}

          {completedGoals.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-escudo-gold">
                Completadas
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {completedGoals.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} />
                ))}
              </div>
            </div>
          )}

          {archivedGoals.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Archivadas
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {archivedGoals.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
