"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarClock,
  Clock,
  Plus,
  Trash2,
  Loader2,
  Timer,
  Play,
  Square,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createShift, deleteShift } from "@/app/actions/turnos";
import { FormStatus } from "@/components/dashboard/FormStatus";
import { SubmitButton } from "@/components/dashboard/SubmitButton";
import type { Shift, CurrentStatusResponse } from "@/lib/api/types";

const DAYS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

const DAY_ORDER: Record<string, number> = Object.fromEntries(
  DAYS.map((d, i) => [d, i])
);

function sortByDay(shifts: Shift[]): Shift[] {
  return [...shifts].sort((a, b) => {
    const ai = DAY_ORDER[a.day] ?? 99;
    const bi = DAY_ORDER[b.day] ?? 99;
    return ai - bi;
  });
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
    if (!window.confirm(`¿Eliminar el turno del ${shiftLabel}?`)) return;

    const removed = shiftList.find((s) => s.id === shiftId);
    setDeletingId(shiftId);
    setShiftList((prev) => prev.filter((s) => s.id !== shiftId));
    setFormStatus({});

    const result = await deleteShift(shiftId);
    setDeletingId(null);

    if (!result.success) {
      if (removed) {
        setShiftList((prev) => sortByDay([...prev, removed]));
      }
      setFormStatus({ error: result.error ?? "Error al eliminar el turno" });
    } else {
      setFormStatus({});
    }
  };

  const inShift = currentStatus.status === "in_shift";
  const currentShift = currentStatus.shift ?? null;
  const nextShift = currentStatus.next_shift ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <CalendarClock className="h-6 w-6 text-escudo-cyan" />
        <h2 className="text-xl font-bold text-foreground">Turnos</h2>
      </div>

      <Card className={cn(
        "border-border bg-card",
        inShift ? "border-escudo-green/30" : "border-border"
      )}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className={cn(
              "flex h-3 w-3 items-center justify-center rounded-full",
              inShift ? "bg-escudo-green" : "bg-muted-foreground"
            )}>
              <span className={cn(
                "h-2 w-2 rounded-full",
                inShift ? "bg-escudo-green animate-pulse-led" : "bg-muted-foreground"
              )} />
            </div>
            Estado actual
          </CardTitle>
          <CardDescription>
            {currentStatus.message_short}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {inShift && currentShift ? (
            <div className="flex flex-wrap items-center gap-4">
              <Badge variant="outline" className="border-escudo-green/40 text-escudo-green text-sm px-3 py-1">
                <Play className="mr-1.5 h-3.5 w-3.5" />
                En turno
              </Badge>
              <span className="text-sm text-foreground">
                <span className="text-muted-foreground">Día:</span> {currentShift.day}
              </span>
              <span className="text-sm text-foreground">
                <span className="text-muted-foreground">Horario:</span> {currentShift.start} – {currentShift.end}
              </span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-escudo-cyan">
                <Timer className="h-4 w-4" />
                {formatRemaining(currentShift.remaining_hours)} restantes
              </span>
            </div>
          ) : nextShift ? (
            <div className="flex flex-wrap items-center gap-4">
              <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground text-sm px-3 py-1">
                <Square className="mr-1.5 h-3.5 w-3.5" />
                Libre
              </Badge>
              <span className="text-sm text-foreground">
                <span className="text-muted-foreground">Próximo:</span> {nextShift.day} {nextShift.start} – {nextShift.end}
              </span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-escudo-gold">
                <Clock className="h-4 w-4" />
                En {formatRemaining(nextShift.starts_in_hours)}
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-3 text-center">
              <Calendar className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No tienes turnos registrados. Agrega tu primer turno abajo.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">Horario semanal</CardTitle>
            <CardDescription>
              {shiftList.length > 0
                ? `${shiftList.length} turnos registrados`
                : "Sin turnos registrados"}
            </CardDescription>
          </div>
          <Button
            onClick={() => { setCreating(!creating); setFormStatus({}); }}
            size="sm"
            className="bg-escudo-cyan text-primary-foreground hover:bg-escudo-cyan/90"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            {creating ? "Cancelar" : "Agregar"}
          </Button>
        </CardHeader>
        <CardContent>
          {creating && (
            <div className="mb-4 rounded-lg border border-border bg-secondary/50 p-4">
              <form key={formKey} action={handleCreate} className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Día</label>
                  <select
                    name="day"
                    required
                    className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-escudo-cyan/50 focus:outline-none focus:ring-1 focus:ring-escudo-cyan/30"
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
                    className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-escudo-cyan/50 focus:outline-none focus:ring-1 focus:ring-escudo-cyan/30"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Fin</label>
                  <input
                    name="end"
                    type="time"
                    required
                    className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-escudo-cyan/50 focus:outline-none focus:ring-1 focus:ring-escudo-cyan/30"
                  />
                </div>
                <SubmitButton className="bg-escudo-green text-primary-foreground hover:bg-escudo-green/90">
                  Guardar
                </SubmitButton>
              </form>
              <div className="mt-3">
                <FormStatus {...formStatus} />
              </div>
            </div>
          )}

          {!creating && (
            <div className="mt-0">
              <FormStatus {...formStatus} />
            </div>
          )}

          {shiftList.length === 0 && !creating ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Calendar className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No hay turnos registrados.
              </p>
              <Button
                onClick={() => setCreating(true)}
                variant="outline"
                size="sm"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Agregar turno
              </Button>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {shiftList.map((shift) => (
                <div
                  key={shift.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-4 py-3"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">
                      {shift.day}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {shift.start} – {shift.end}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(shift.id, `${shift.day} ${shift.start}-${shift.end}`)}
                    disabled={deletingId === shift.id}
                    className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-escudo-red/10 hover:text-escudo-red"
                    title="Eliminar turno"
                  >
                    {deletingId === shift.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
