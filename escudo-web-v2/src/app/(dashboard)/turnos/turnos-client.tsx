"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  Plus,
  Trash2,
  Loader2,
  Timer,
  Play,
  Square,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createShift, deleteShift } from "@/app/actions/turnos";
import { FormStatus } from "@/components/dashboard/FormStatus";
import { SubmitButton } from "@/components/dashboard/SubmitButton";
import { EmptyState } from "@/components/dashboard/EmptyState";
import type { Shift, CurrentStatusResponse } from "@/lib/api/types";

const DAYS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];
const DAY_ORDER: Record<string, number> = Object.fromEntries(DAYS.map((d, i) => [d, i]));

function sortByDay(shifts: Shift[]): Shift[] {
  return [...shifts].sort((a, b) => (DAY_ORDER[a.day] ?? 99) - (DAY_ORDER[b.day] ?? 99));
}

function formatRemaining(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  return `${hours.toFixed(1)}h`;
}

interface TurnosClientProps {
  shifts: Shift[];
  currentStatus: CurrentStatusResponse;
}

export function TurnosClient({ shifts, currentStatus }: TurnosClientProps) {
  const router = useRouter();
  const [shiftList, setShiftList] = useState<Shift[]>(sortByDay(shifts));
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formStatus, setFormStatus] = useState<{ success?: string; error?: string }>({});
  const [formKey, setFormKey] = useState(0);

  async function handleCreate(formData: FormData) {
    setFormStatus({});
    const result = await createShift(null, formData);
    if (result.success) {
      setFormStatus({ success: "Turno creado correctamente." });
      setCreating(false);
      setFormKey((k) => k + 1);
      router.refresh();
    } else {
      setFormStatus({ error: result.error ?? "Error al crear el turno" });
    }
  }

  const handleDelete = async (shiftId: string, shiftLabel: string) => {
    if (!window.confirm(`Eliminar el turno del ${shiftLabel}?`)) return;
    const removed = shiftList.find((s) => s.id === shiftId);
    setDeletingId(shiftId);
    setShiftList((prev) => prev.filter((s) => s.id !== shiftId));
    setFormStatus({});

    const result = await deleteShift(shiftId);
    setDeletingId(null);

    if (!result.success) {
      if (removed) setShiftList((prev) => sortByDay([...prev, removed]));
      setFormStatus({ error: result.error ?? "Error al eliminar el turno" });
    }
  };

  const inShift = currentStatus.status === "in_shift";
  const currentShift = currentStatus.shift ?? null;
  const nextShift = currentStatus.next_shift ?? null;

  return (
    <div className="flex flex-col gap-6">
      <section className="panel-neon relative overflow-hidden rounded-[28px] p-6">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,rgba(45,226,230,0.14),transparent_62%)]" />
        <div className="relative flex flex-col gap-3">
          <span className="hud-label text-accent">Time Grid</span>
          <h2 className="font-heading text-3xl font-black tracking-[0.1em] text-glow text-foreground md:text-4xl">
            TURNOS
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
            Controla estado en vivo, proximo turno y agenda semanal desde un panel tactico.
          </p>
        </div>
      </section>

      <Card className={cn(inShift && "border-escudo-green/30 shadow-[0_0_24px_rgba(42,245,152,0.12)]")}>
        <CardHeader className="pb-3">
          <span className="hud-label text-accent">Live Status</span>
          <CardTitle className="flex items-center gap-2 text-base">
            <div className={cn("flex h-3 w-3 items-center justify-center rounded-full", inShift ? "bg-escudo-green" : "bg-muted-foreground")}>
              <span className={cn("h-2 w-2 rounded-full", inShift ? "animate-pulse-led bg-escudo-green" : "bg-muted-foreground")} />
            </div>
            Estado actual
          </CardTitle>
          <CardDescription>{currentStatus.message_short}</CardDescription>
        </CardHeader>
        <CardContent>
          {inShift && currentShift ? (
            <div className="flex flex-wrap items-center gap-4">
              <Badge variant="outline" className="border-escudo-green/40 bg-escudo-green/10 px-3 py-1 text-escudo-green">
                <Play className="mr-1.5 h-3.5 w-3.5" />
                En turno
              </Badge>
              <span className="text-sm text-foreground">
                <span className="text-muted-foreground">Dia:</span> {currentShift.day}
              </span>
              <span className="text-sm text-foreground">
                <span className="text-muted-foreground">Horario:</span> {currentShift.start} - {currentShift.end}
              </span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-escudo-cyan">
                <Timer className="h-4 w-4" />
                {formatRemaining(currentShift.remaining_hours)} restantes
              </span>
            </div>
          ) : nextShift ? (
            <div className="flex flex-wrap items-center gap-4">
              <Badge variant="outline" className="border-muted-foreground/30 bg-muted/20 px-3 py-1 text-muted-foreground">
                <Square className="mr-1.5 h-3.5 w-3.5" />
                Libre
              </Badge>
              <span className="text-sm text-foreground">
                <span className="text-muted-foreground">Proximo:</span> {nextShift.day} {nextShift.start} - {nextShift.end}
              </span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-escudo-gold">
                <Clock className="h-4 w-4" />
                En {formatRemaining(nextShift.starts_in_hours)}
              </span>
            </div>
          ) : (
            <EmptyState title="Sin turnos registrados" message="No tienes turnos registrados. Agrega tu primer turno abajo." />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <span className="hud-label text-accent">Weekly Map</span>
            <CardTitle className="text-base">Horario semanal</CardTitle>
            <CardDescription>
              {shiftList.length > 0 ? `${shiftList.length} turnos registrados` : "Sin turnos registrados"}
            </CardDescription>
          </div>
          <Button
            onClick={() => {
              setCreating(!creating);
              setFormStatus({});
            }}
            size="sm"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            {creating ? "Cancelar" : "Agregar"}
          </Button>
        </CardHeader>
        <CardContent>
          {creating && (
            <div className="mb-4 rounded-2xl border border-border/70 bg-background/35 p-4">
              <form key={formKey} action={handleCreate} className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Dia</label>
                  <select
                    name="day"
                    required
                    className="h-11 rounded-xl border border-border/80 bg-input/80 px-3 py-2 text-sm text-foreground outline-none transition-all focus-visible:border-accent/60 focus-visible:ring-3 focus-visible:ring-accent/20"
                  >
                    <option value="">Seleccionar...</option>
                    {DAYS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Inicio</label>
                  <input
                    name="start"
                    type="time"
                    required
                    className="h-11 rounded-xl border border-border/80 bg-input/80 px-3 py-2 text-sm text-foreground outline-none transition-all focus-visible:border-accent/60 focus-visible:ring-3 focus-visible:ring-accent/20"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Fin</label>
                  <input
                    name="end"
                    type="time"
                    required
                    className="h-11 rounded-xl border border-border/80 bg-input/80 px-3 py-2 text-sm text-foreground outline-none transition-all focus-visible:border-accent/60 focus-visible:ring-3 focus-visible:ring-accent/20"
                  />
                </div>
                <SubmitButton>Guardar</SubmitButton>
              </form>
              <div className="mt-3">
                <FormStatus {...formStatus} />
              </div>
            </div>
          )}

          {!creating && <FormStatus {...formStatus} />}

          {shiftList.length === 0 && !creating ? (
            <EmptyState title="Agenda vacia" message="No hay turnos registrados." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shiftList.map((shift) => (
                <div
                  key={shift.id}
                  className="rounded-2xl border border-border/70 bg-background/35 px-4 py-3 transition-colors hover:border-accent/35"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-foreground">{shift.day}</span>
                      <span className="text-xs text-muted-foreground">
                        {shift.start} - {shift.end}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(shift.id, `${shift.day} ${shift.start}-${shift.end}`)}
                      disabled={deletingId === shift.id}
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-escudo-red/10 hover:text-escudo-red"
                      title="Eliminar turno"
                    >
                      {deletingId === shift.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
