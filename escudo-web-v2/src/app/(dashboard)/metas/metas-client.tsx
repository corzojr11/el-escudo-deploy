"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Target, Calendar, Trophy, Plus, TrendingUp, Archive, RotateCcw, CheckCircle2, ChevronDown } from "lucide-react";
import { createGoal, addMetric, archiveGoal, reopenGoal } from "@/app/actions/goals";
import { SubmitButton } from "@/components/dashboard/SubmitButton";
import { FormStatus } from "@/components/dashboard/FormStatus";
import { formatDate } from "@/lib/api/helpers";
import type { Goal, Metric } from "@/lib/api/types";

function todayInputValue() {
  return new Date().toISOString().split("T")[0];
}

interface MetasClientProps {
  goals: Goal[];
}

function GoalCard({
  goal,
  onArchive,
  onReopen,
  archiving,
}: {
  goal: Goal;
  onArchive?: (id: string) => void;
  onReopen?: (id: string) => void;
  archiving: string | null;
}) {
  const latestMetric: Metric | undefined | null = goal.latest_metric ?? goal.recent_metrics?.[0];
  const currentValue = goal.current_value ?? latestMetric?.value ?? 0;
  const targetValue = goal.target_value ?? 0;
  const progress = targetValue > 0 ? Math.min((currentValue / targetValue) * 100, 100) : 0;
  const unit = goal.unit || latestMetric?.unit || "";

  const statusConfig = {
    active: { label: "Activa", className: "border-escudo-cyan/30 bg-escudo-cyan/10 text-escudo-cyan" },
    completed: { label: "Completada", className: "border-escudo-green/30 bg-escudo-green/10 text-escudo-green" },
    archived: { label: "Archivada", className: "border-muted-foreground/30 bg-muted/20 text-muted-foreground" },
  };

  const status = (goal.status ?? "active") as keyof typeof statusConfig;
  const config = statusConfig[status] ?? statusConfig.active;
  const isArchived = status === "archived";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base text-foreground">{goal.name}</CardTitle>
            <CardDescription className="line-clamp-2">
              {goal.description || "Sin descripcion"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={config.className}>
              {config.label}
            </Badge>
            {isArchived ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={archiving === goal.id}
                onClick={() => onReopen?.(goal.id)}
                title="Reactivar meta"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground"
                disabled={archiving === goal.id}
                onClick={() => onArchive?.(goal.id)}
                title="Archivar meta"
              >
                <Archive className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {targetValue > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progreso</span>
              <span className="font-medium text-escudo-green">
                {currentValue.toLocaleString("es-CO")} / {targetValue.toLocaleString("es-CO")} {unit}
              </span>
            </div>
            <Progress value={progress} className="h-2 bg-secondary" />
            <p className="text-right text-xs text-muted-foreground">{progress.toFixed(0)}%</p>
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
        {!isArchived && status !== "completed" && (
          <Link
            href={`/misiones?meta=${goal.id}`}
            className="inline-flex border border-[#7C5DFF] px-3 py-2 font-mono text-[11px] uppercase text-[#d5ccff] transition-colors hover:bg-[#7C5DFF] hover:text-black"
          >
            Crear misión para esta meta
          </Link>
        )}
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
  const [archiving, setArchiving] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(goals.length === 0);
  const [showProgress, setShowProgress] = useState(false);
  const [, startCreateTransition] = useTransition();
  const [, startMetricTransition] = useTransition();
  const [, startArchiveTransition] = useTransition();

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

  async function handleArchive(goalId: string) {
    setArchiving(goalId);
    startArchiveTransition(async () => {
      const result = await archiveGoal(goalId);
      setArchiving(null);
      if (result.success) {
        setMetricStatus({ success: "Meta archivada." });
        router.refresh();
      } else {
        setMetricStatus({ error: result.error ?? "Error al archivar" });
      }
    });
  }

  async function handleReopen(goalId: string) {
    setArchiving(goalId);
    startArchiveTransition(async () => {
      const result = await reopenGoal(goalId);
      setArchiving(null);
      if (result.success) {
        setMetricStatus({ success: "Meta reactivada." });
        router.refresh();
      } else {
        setMetricStatus({ error: result.error ?? "Error al reactivar" });
      }
    });
  }

  function selectStarterGoal(name: string, target: string, unit: string, description: string) {
    setShowCreate(true);

    requestAnimationFrame(() => {
      const form = createFormRef.current;
      if (!form) return;

      const fields = { name, target_value: target, unit, description };
      for (const [fieldName, value] of Object.entries(fields)) {
        const field = form.elements.namedItem(fieldName);
        if (field instanceof HTMLInputElement) field.value = value;
      }
      form.querySelector<HTMLInputElement>("[name='name']")?.focus();
    });
  }

  const activeGoals = goals.filter((g) => g.status === "active" || !g.status);
  const completedGoals = goals.filter((g) => g.status === "completed");
  const archivedGoals = goals.filter((g) => g.status === "archived");

  return (
    <div className="flex w-full flex-col gap-5">
      <section className="panel-neon rounded-[28px] p-5 md:p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <span className="hud-label text-accent">Tu ruta de avance</span>
            <h2 className="font-heading text-3xl font-black tracking-[0.06em] text-foreground md:text-4xl">METAS</h2>
            <p className="max-w-xl text-sm text-muted-foreground">
              Define un resultado concreto y registra solo los avances que importan.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="border border-border/80 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Activas: </span><strong>{activeGoals.length}</strong>
            </div>
            <div className="border border-border/80 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Completadas: </span><strong className="text-escudo-green">{completedGoals.length}</strong>
            </div>
            <Button type="button" onClick={() => setShowCreate((current) => !current)}>
              <Plus className="h-4 w-4" /> {showCreate ? "Cerrar" : "Nueva meta"}
            </Button>
          </div>
        </div>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <section className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="hud-label text-accent">Tablero principal</span>
              <h3 className="mt-1 text-lg font-semibold">En qué estás trabajando</h3>
            </div>
            {activeGoals.length > 0 && (
              <Button type="button" variant="outline" size="sm" onClick={() => setShowProgress((current) => !current)}>
                <TrendingUp className="h-4 w-4" /> Registrar avance
              </Button>
            )}
          </div>

          {goals.length === 0 ? (
            <Card>
              <CardContent className="p-5 md:p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex gap-3">
                    <Target className="mt-0.5 h-5 w-5 shrink-0 text-escudo-gold" />
                    <div>
                      <h4 className="font-semibold">Elige una meta para empezar</h4>
                      <p className="mt-1 text-sm text-muted-foreground">Selecciona una idea y la prepararemos en el formulario. Después podrás ajustarla a tu manera.</p>
                    </div>
                  </div>
                  {!showCreate && <Button type="button" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Crear desde cero</Button>}
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Button type="button" variant="outline" className="h-auto justify-start whitespace-normal px-4 py-3 text-left" onClick={() => selectStarterGoal("Subir 3 kg", "3", "kg", "Ganar peso de forma gradual")}>Subir de peso</Button>
                  <Button type="button" variant="outline" className="h-auto justify-start whitespace-normal px-4 py-3 text-left" onClick={() => selectStarterGoal("Reducir una deuda", "500000", "COP", "Avanzar con un pago concreto")}>Salir de deudas</Button>
                  <Button type="button" variant="outline" className="h-auto justify-start whitespace-normal px-4 py-3 text-left" onClick={() => selectStarterGoal("Leer 2 libros", "2", "libros", "Construir una rutina de lectura")}>Leer más</Button>
                  <Button type="button" variant="outline" className="h-auto justify-start whitespace-normal px-4 py-3 text-left" onClick={() => selectStarterGoal("Entrenar 12 veces", "12", "sesiones", "Mantener constancia este mes")}>Entrenar con constancia</Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {activeGoals.length > 0 && (
                <div className="grid gap-4 md:grid-cols-2">
                  {activeGoals.map((goal) => <GoalCard key={goal.id} goal={goal} onArchive={handleArchive} archiving={archiving} />)}
                </div>
              )}
              {completedGoals.length > 0 && (
                <details className="group border border-border/80 bg-card">
                  <summary className="flex cursor-pointer list-none items-center justify-between p-4 font-medium">
                    <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-escudo-green" /> Metas completadas ({completedGoals.length})</span>
                    <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="grid gap-4 border-t border-border/80 p-4 md:grid-cols-2">
                    {completedGoals.map((goal) => <GoalCard key={goal.id} goal={goal} onArchive={handleArchive} archiving={archiving} />)}
                  </div>
                </details>
              )}
              {archivedGoals.length > 0 && (
                <details className="group border border-border/80 bg-card">
                  <summary className="flex cursor-pointer list-none items-center justify-between p-4 font-medium text-muted-foreground">
                    <span>Archivadas ({archivedGoals.length})</span><ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="grid gap-4 border-t border-border/80 p-4 md:grid-cols-2">
                    {archivedGoals.map((goal) => <GoalCard key={goal.id} goal={goal} onReopen={handleReopen} archiving={archiving} />)}
                  </div>
                </details>
              )}
            </>
          )}
        </section>

        <aside className="space-y-4 lg:sticky lg:top-5">
          {showCreate && (
          <Card>
            <CardHeader className="pb-3">
              <span className="hud-label text-accent">Paso 1</span>
              <CardTitle className="flex items-center gap-2 text-base"><Plus className="h-5 w-5 text-escudo-gold" /> Define tu meta</CardTitle>
              <CardDescription>Qué quieres conseguir y cómo lo vas a medir.</CardDescription>
            </CardHeader>
            <CardContent>
              <form ref={createFormRef} action={handleCreateGoal} className="flex flex-col gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre</Label>
                  <Input id="name" name="name" placeholder="Ej. Leer 12 libros" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Por qué te importa</Label>
                  <Input id="description" name="description" placeholder="Opcional" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="target_value">Objetivo</Label>
                    <Input id="target_value" name="target_value" type="number" step="0.01" min="0" placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit">Unidad</Label>
                    <Input id="unit" name="unit" placeholder="kg, libros..." />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deadline">Fecha límite</Label>
                  <Input id="deadline" name="deadline" type="date" />
                </div>
                <FormStatus {...createStatus} />
                <SubmitButton className="w-full">Crear meta</SubmitButton>
              </form>
            </CardContent>
          </Card>
          )}

          {showProgress && activeGoals.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <span className="hud-label text-accent">Paso 2</span>
              <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-5 w-5 text-escudo-cyan" /> Registra un avance</CardTitle>
              <CardDescription>Solo necesitas la meta y el nuevo valor.</CardDescription>
            </CardHeader>
            <CardContent>
              <form ref={metricFormRef} action={handleAddMetric} className="flex flex-col gap-4">
                <div className="space-y-2">
                  <Label htmlFor="goal_id">Meta</Label>
                  <select
                    id="goal_id"
                    name="goal_id"
                    required
                    className="h-11 w-full rounded-xl border border-border/80 bg-input/80 px-3 py-2 text-sm text-foreground outline-none transition-all focus-visible:border-accent/60 focus-visible:ring-3 focus-visible:ring-accent/20"
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
                  <Input id="value" name="value" type="number" step="0.01" required placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="metric_date">Fecha</Label>
                  <Input id="metric_date" name="date" type="date" defaultValue={todayInputValue()} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="metric_unit">Unidad</Label>
                  <Input id="metric_unit" name="unit" placeholder="Opcional" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notas</Label>
                  <Input id="notes" name="notes" placeholder="Opcional" />
                </div>
                <FormStatus {...metricStatus} />
                <SubmitButton className="w-full">Registrar progreso</SubmitButton>
              </form>
            </CardContent>
          </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
