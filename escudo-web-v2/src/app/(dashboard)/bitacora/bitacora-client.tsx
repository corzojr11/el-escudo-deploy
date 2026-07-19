"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  BookOpen,
  Check,
  ChevronRight,
  Heart,
  Lightbulb,
  Loader2,
  MoonStar,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { createMission } from "@/app/actions/missions";
import {
  createPersonalEntry,
  deletePersonalEntry,
  updatePersonalEntry,
} from "@/app/actions/personal";
import type { PersonalEntry } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type BitacoraPanel = "idea" | "prayer" | "reading" | "discipline" | "close";

interface BitacoraClientProps {
  initialEntries: PersonalEntry[];
  loadError?: boolean;
}

function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
  }).format(new Date());
}

function tomorrow() {
  const date = new Date(`${today()}T12:00:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function entryValue(entry: PersonalEntry, key: string) {
  const value = entry.data?.[key];
  return typeof value === "string" || typeof value === "number" ? value : "";
}

function isTracker(entry: PersonalEntry) {
  return entryValue(entry, "entry_type") === "private_commitment";
}

function linkedMissionId(entry: PersonalEntry) {
  const value = entry.data?.mission_id;
  return typeof value === "string" ? value : undefined;
}

function trackerStreak(entries: PersonalEntry[]) {
  const dates = new Set(entries.map((entry) => entry.entry_date));
  const cursor = new Date(`${today()}T12:00:00`);
  let streak = 0;

  while (dates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function formatEntryDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function EntryDelete({
  onDelete,
  pending,
  label = "Eliminar",
}: {
  onDelete: () => void;
  pending: boolean;
  label?: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="destructive"
          size="xs"
          disabled={pending}
          onClick={onDelete}
        >
          {pending ? "Eliminando..." : "Confirmar"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          disabled={pending}
          aria-label="Cancelar eliminacion"
          onClick={() => setConfirming(false)}
        >
          x
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className="text-muted-foreground hover:text-destructive"
      disabled={pending}
      onClick={() => setConfirming(true)}
    >
      <Trash2 className="size-3" />
      {label}
    </Button>
  );
}

const panelCopy: Record<
  BitacoraPanel,
  { eyebrow: string; title: string; description: string }
> = {
  idea: {
    eyebrow: "CAPTURA RAPIDA",
    title: "No pierdas una idea util",
    description: "Escribela en bruto. Luego decides si vale la pena convertirla en una mision.",
  },
  prayer: {
    eyebrow: "PAUSA PERSONAL",
    title: "Un momento para volver a tu centro",
    description: "Registra una intencion breve para esta noche o para la novena que estas haciendo.",
  },
  reading: {
    eyebrow: "LECTURA REALISTA",
    title: "Retoma un libro sin exigirte de mas",
    description: "Guarda el punto donde vas y vuelve cuando tengas un bloque corto disponible.",
  },
  discipline: {
    eyebrow: "COMPROMISO PRIVADO",
    title: "Haz visible la disciplina que quieres cuidar",
    description: "Un registro discreto, sin culpa ni juicios. Hoy cuenta aunque sea un paso pequeno.",
  },
  close: {
    eyebrow: "CIERRE DEL DIA",
    title: "Cierra el dia con una idea clara",
    description: "Conserva lo que funciono, suelta una carga y deja un paso posible para manana.",
  },
};

export function BitacoraClient({ initialEntries, loadError = false }: BitacoraClientProps) {
  const [entries, setEntries] = useState(initialEntries);
  const [activePanel, setActivePanel] = useState<BitacoraPanel>("idea");
  const [ideaTitle, setIdeaTitle] = useState("");
  const [ideaContent, setIdeaContent] = useState("");
  const [intention, setIntention] = useState("");
  const [novenaDay, setNovenaDay] = useState("1");
  const [bookTitle, setBookTitle] = useState("");
  const [bookCurrent, setBookCurrent] = useState("");
  const [bookTotal, setBookTotal] = useState("");
  const [commitmentTitle, setCommitmentTitle] = useState("");
  const [win, setWin] = useState("");
  const [release, setRelease] = useState("");
  const [tomorrowStep, setTomorrowStep] = useState("");
  const [status, setStatus] = useState("");
  const [isPending, startTransition] = useTransition();

  const ideas = useMemo(
    () => entries.filter((entry) => entry.kind === "idea"),
    [entries],
  );
  const prayers = useMemo(
    () => entries.filter((entry) => entry.kind === "prayer"),
    [entries],
  );
  const books = useMemo(
    () => entries.filter((entry) => entry.kind === "reading"),
    [entries],
  );
  const commitments = useMemo(
    () => entries.filter((entry) => entry.kind === "discipline" && isTracker(entry)),
    [entries],
  );
  const dailyReviews = useMemo(
    () => entries.filter((entry) => entry.kind === "discipline" && !isTracker(entry)),
    [entries],
  );
  const todayCommitment = commitments.find((entry) => entry.entry_date === today());
  const todayReview = dailyReviews.find((entry) => entry.entry_date === today());
  const readToday = books.some((entry) => entryValue(entry, "last_read_date") === today());

  const dailySteps = [
    {
      id: "idea" as const,
      short: "Idea",
      label: "Captura una idea",
      helper: "No pierdas una idea util.",
      done: ideas.some((entry) => entry.entry_date === today()),
      icon: Lightbulb,
    },
    {
      id: "prayer" as const,
      short: "Oracion",
      label: "Pausa y oracion",
      helper: "Un minuto para volver a tu centro.",
      done: prayers.some((entry) => entry.entry_date === today()),
      icon: Heart,
    },
    {
      id: "reading" as const,
      short: "Lectura",
      label: "Lectura breve",
      helper: "Unas paginas tambien cuentan.",
      done: readToday,
      icon: BookOpen,
    },
    {
      id: "discipline" as const,
      short: "Disciplina",
      label: "Cuida un compromiso",
      helper: "Registra tu dia sin culpa.",
      done: Boolean(todayCommitment),
      icon: ShieldCheck,
    },
    {
      id: "close" as const,
      short: "Cierre",
      label: "Cierra el dia",
      helper: "Deja claro lo que sigue.",
      done: Boolean(todayReview),
      icon: MoonStar,
    },
  ];

  const activeStep = dailySteps.find((step) => step.id === activePanel) ?? dailySteps[0];
  const completedToday = dailySteps.filter((step) => step.done).length;
  const recentEntries = [...entries]
    .sort((a, b) => b.entry_date.localeCompare(a.entry_date))
    .slice(0, 5);

  function runTask(task: () => Promise<void>) {
    setStatus("");
    startTransition(async () => {
      try {
        await task();
      } catch {
        setStatus("No se pudo guardar. Intenta de nuevo.");
      }
    });
  }

  function saveIdea() {
    if (!ideaTitle.trim()) {
      setStatus("Escribe al menos un titulo para la idea.");
      return;
    }

    runTask(async () => {
      const entry = await createPersonalEntry({
        kind: "idea",
        title: ideaTitle.trim(),
        content: ideaContent.trim(),
      });
      setEntries((current) => [entry, ...current]);
      setIdeaTitle("");
      setIdeaContent("");
      setStatus("Idea guardada. Puedes volver a ella cuando quieras.");
    });
  }

  function savePrayer() {
    runTask(async () => {
      const entry = await createPersonalEntry({
        kind: "prayer",
        title: `Novena - dia ${novenaDay}`,
        content: intention.trim(),
        data: { novena_day: Number(novenaDay) },
      });
      setEntries((current) => [entry, ...current]);
      setIntention("");
      setStatus("Oracion registrada. Que este momento te acompane.");
    });
  }

  function saveBook() {
    const total = Number(bookTotal);
    const current = Number(bookCurrent || 0);
    if (!bookTitle.trim() || !Number.isFinite(total) || total <= 0 || current < 0 || current > total) {
      setStatus("Agrega titulo y paginas validas para el libro.");
      return;
    }

    runTask(async () => {
      const entry = await createPersonalEntry({
        kind: "reading",
        title: bookTitle.trim(),
        content: "",
        data: {
          current_page: current,
          total_pages: total,
          last_read_date: current > 0 ? today() : "",
        },
      });
      setEntries((currentEntries) => [entry, ...currentEntries]);
      setBookTitle("");
      setBookCurrent("");
      setBookTotal("");
      setStatus("Libro agregado a tu bitacora.");
    });
  }

  function saveCommitment() {
    if (!commitmentTitle.trim()) {
      setStatus("Escribe el compromiso que quieres cuidar hoy.");
      return;
    }

    runTask(async () => {
      const entry = await createPersonalEntry({
        kind: "discipline",
        title: commitmentTitle.trim(),
        content: "",
        data: { entry_type: "private_commitment" },
      });
      setEntries((current) => [entry, ...current]);
      setCommitmentTitle("");
      setStatus("Compromiso registrado para hoy.");
    });
  }

  function saveReview() {
    if (!win.trim() && !release.trim() && !tomorrowStep.trim()) {
      setStatus("Escribe al menos una idea para cerrar el dia.");
      return;
    }

    runTask(async () => {
      const entry = await createPersonalEntry({
        kind: "discipline",
        title: "Cierre del dia",
        content: [win, release, tomorrowStep].filter(Boolean).join(" | "),
        data: {
          win: win.trim(),
          release: release.trim(),
          tomorrow_step: tomorrowStep.trim(),
        },
      });
      setEntries((current) => [entry, ...current]);
      setWin("");
      setRelease("");
      setTomorrowStep("");
      setStatus("Cierre guardado. Manana puedes retomar desde ese paso.");
    });
  }

  function removeEntry(id: string) {
    runTask(async () => {
      await deletePersonalEntry(id);
      setEntries((current) => current.filter((entry) => entry.id !== id));
      setStatus("Registro eliminado.");
    });
  }

  function turnEntryIntoMission(entry: PersonalEntry) {
    runTask(async () => {
      const mission = await createMission({
        name: entry.title,
        description: entry.content,
        priority: "medium",
        scheduled_at: tomorrow(),
      });
      const updated = await updatePersonalEntry(entry.id, {
        title: entry.title,
        content: entry.content,
          data: { ...entry.data, mission_id: mission.mission.id },
      });
      setEntries((current) => current.map((item) => (item.id === entry.id ? updated : item)));
      setStatus("Idea programada como mision para manana.");
    });
  }

  function updateBook(entry: PersonalEntry, currentPage: number) {
    const total = Number(entryValue(entry, "total_pages"));
    if (!Number.isFinite(currentPage) || currentPage < 0 || currentPage > total) {
      setStatus("La pagina debe estar entre 0 y el total del libro.");
      return;
    }

    runTask(async () => {
      const updated = await updatePersonalEntry(entry.id, {
        title: entry.title,
        content: entry.content,
        data: {
          ...entry.data,
          current_page: currentPage,
          last_read_date: currentPage > Number(entryValue(entry, "current_page")) ? today() : entryValue(entry, "last_read_date"),
        },
      });
      setEntries((current) => current.map((item) => (item.id === entry.id ? updated : item)));
      setStatus("Progreso de lectura actualizado.");
    });
  }

  const ActiveIcon = activeStep.icon;

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 pb-8 pt-4 md:px-6 md:pt-6">
      <section className="border border-border bg-card px-5 py-5 md:px-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="min-w-0">
            <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">ESPACIO PERSONAL / HOY</p>
            <h1 className="mt-1 text-3xl font-black uppercase tracking-tight text-foreground md:text-4xl">Bitacora viva</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Una ruta corta para capturar lo que importa, volver a ti y dejar listo el siguiente paso.
            </p>
          </div>
          <div className="grid grid-cols-2 border border-border bg-background text-left md:min-w-72">
            <div className="border-r border-border px-4 py-3">
              <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground">RITUAL DE HOY</p>
              <p className="mt-1 text-xl font-bold text-foreground">{completedToday}/5</p>
            </div>
            <div className="px-4 py-3">
              <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground">REGISTROS</p>
              <p className="mt-1 text-xl font-bold text-accent">{entries.length}</p>
            </div>
          </div>
        </div>
      </section>

      {loadError ? (
        <p className="border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          No se pudo cargar todo tu archivo. Aun puedes trabajar con los nuevos registros cuando el servidor se recupere.
        </p>
      ) : null}

      <section className="border border-border bg-card p-3">
        <div className="mb-3 flex items-center justify-between gap-4 px-1">
          <div>
            <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground">RUTA DEL DIA</p>
            <p className="text-sm font-semibold text-foreground">Elige un momento. No necesitas hacerlo todo de una vez.</p>
          </div>
          <p className="hidden text-xs text-muted-foreground sm:block">{completedToday === 5 ? "Ruta completa" : `${5 - completedToday} pasos disponibles`}</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {dailySteps.map((step) => {
            const StepIcon = step.icon;
            const isActive = step.id === activePanel;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActivePanel(step.id)}
                className={`min-w-0 border p-3 text-left transition-colors ${
                  isActive
                    ? "border-accent bg-accent/10"
                    : "border-border bg-background hover:border-accent/60"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <StepIcon className={`size-4 ${step.done ? "text-escudo-green" : "text-accent"}`} />
                  {step.done ? <Check className="size-4 text-escudo-green" /> : <span className="font-mono text-[10px] text-muted-foreground">0{dailySteps.indexOf(step) + 1}</span>}
                </div>
                <p className="mt-3 truncate text-sm font-bold text-foreground">{step.short}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{step.helper}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <Card className="border-border bg-card shadow-none">
          <CardContent className="p-0">
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 md:px-6">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-accent">
                  <ActiveIcon className="size-4" />
                  <p className="font-mono text-[10px] tracking-[0.18em]">{panelCopy[activePanel].eyebrow}</p>
                </div>
                <h2 className="mt-1 text-xl font-bold text-foreground">{panelCopy[activePanel].title}</h2>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{panelCopy[activePanel].description}</p>
              </div>
              <span className="hidden shrink-0 border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground sm:inline-flex">
                {activeStep.done ? "HECHO HOY" : "EN CURSO"}
              </span>
            </div>

            <div className="p-5 md:p-6">
              {activePanel === "idea" ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
                    <div className="space-y-2">
                      <Label htmlFor="idea-title">Titulo de la idea</Label>
                      <Input id="idea-title" value={ideaTitle} onChange={(event) => setIdeaTitle(event.target.value)} placeholder="Ej. Resolver una necesidad que vi hoy" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="idea-content">Que quieres recordar</Label>
                      <textarea id="idea-content" value={ideaContent} onChange={(event) => setIdeaContent(event.target.value)} placeholder="Negocio, trabajo, aplicacion o cualquier detalle que no quieres perder..." className="min-h-24 w-full resize-y border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-accent" />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                    <p className="text-xs text-muted-foreground">Guardala rapido. Puedes convertirla en una mision cuando quieras.</p>
                    <Button type="button" onClick={saveIdea} disabled={isPending}>
                      {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                      Guardar idea
                    </Button>
                  </div>
                  {ideas.length > 0 ? (
                    <div className="border-t border-border pt-4">
                      <p className="mb-3 font-mono text-[10px] tracking-[0.16em] text-muted-foreground">IDEAS RECIENTES</p>
                      <div className="grid gap-2">
                        {ideas.slice(0, 3).map((entry) => (
                          <div key={entry.id} className="flex flex-col justify-between gap-3 border border-border bg-background p-3 sm:flex-row sm:items-center">
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-foreground">{entry.title}</p>
                              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{entry.content || "Sin detalle adicional"}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              {linkedMissionId(entry) ? (
                                <span className="border border-escudo-green/40 px-2 py-1 text-xs text-escudo-green">En mision</span>
                              ) : (
                                <Button type="button" variant="outline" size="xs" disabled={isPending} onClick={() => turnEntryIntoMission(entry)}>
                                  Programar manana
                                </Button>
                              )}
                              <EntryDelete onDelete={() => removeEntry(entry.id)} pending={isPending} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {activePanel === "prayer" ? (
                <div className="space-y-4">
                  <div className="border-l-2 border-accent bg-background px-4 py-3 text-sm italic leading-relaxed text-muted-foreground">
                    San Judas Tadeo, acompaname esta noche; dame serenidad para actuar con fe, claridad para decidir y fuerza para perseverar en el bien.
                  </div>
                  <div className="grid gap-4 md:grid-cols-[13rem_minmax(0,1fr)]">
                    <div className="space-y-2">
                      <Label htmlFor="novena-day">Dia de la novena</Label>
                      <select id="novena-day" value={novenaDay} onChange={(event) => setNovenaDay(event.target.value)} className="h-10 w-full border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-accent">
                        {Array.from({ length: 9 }, (_, index) => index + 1).map((day) => <option key={day} value={day}>Novena - dia {day}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="prayer-intention">Tu intencion</Label>
                      <textarea id="prayer-intention" value={intention} onChange={(event) => setIntention(event.target.value)} placeholder="Algo que agradeces, pides o quieres entregar hoy..." className="min-h-24 w-full resize-y border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-accent" />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                    <p className="text-xs text-muted-foreground">No tiene que ser perfecto. Una intencion honesta basta.</p>
                    <Button type="button" onClick={savePrayer} disabled={isPending}>
                      {isPending ? <Loader2 className="size-4 animate-spin" /> : <Heart className="size-4" />}
                      Registrar oracion
                    </Button>
                  </div>
                  {prayers[0] ? <p className="border border-border bg-background px-3 py-2 text-xs text-muted-foreground">Ultima oracion: {formatEntryDate(prayers[0].entry_date)}{prayers[0].content ? ` - ${prayers[0].content}` : ""}</p> : null}
                </div>
              ) : null}

              {activePanel === "reading" ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_9rem_9rem_auto] md:items-end">
                    <div className="space-y-2"><Label htmlFor="book-title">Libro que quieres retomar</Label><Input id="book-title" value={bookTitle} onChange={(event) => setBookTitle(event.target.value)} placeholder="Ej. Habitos atomicos" /></div>
                    <div className="space-y-2"><Label htmlFor="book-current">Pagina actual</Label><Input id="book-current" inputMode="numeric" value={bookCurrent} onChange={(event) => setBookCurrent(event.target.value)} placeholder="0" /></div>
                    <div className="space-y-2"><Label htmlFor="book-total">Total paginas</Label><Input id="book-total" inputMode="numeric" value={bookTotal} onChange={(event) => setBookTotal(event.target.value)} placeholder="250" /></div>
                    <Button type="button" onClick={saveBook} disabled={isPending}>{isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}Agregar libro</Button>
                  </div>
                  {books.length === 0 ? <p className="border border-dashed border-border bg-background px-4 py-8 text-center text-sm text-muted-foreground">Elige un libro que de verdad quieras retomar. Dos paginas tambien son avance.</p> : null}
                  <div className="grid gap-2">
                    {books.map((entry) => <BookRow key={entry.id} entry={entry} pending={isPending} onUpdate={updateBook} onDelete={removeEntry} onMission={turnEntryIntoMission} />)}
                  </div>
                </div>
              ) : null}

              {activePanel === "discipline" ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Metric label="Racha actual" value={`${trackerStreak(commitments)} dias`} />
                    <Metric label="Registros" value={String(commitments.length)} />
                    <Metric label="Hoy" value={todayCommitment ? "Hecho" : "Pendiente"} positive={Boolean(todayCommitment)} />
                  </div>
                  {todayCommitment ? (
                    <div className="flex flex-col justify-between gap-3 border border-escudo-green/40 bg-escudo-green/5 p-4 sm:flex-row sm:items-center">
                      <div><p className="font-semibold text-foreground">{todayCommitment.title}</p><p className="mt-1 text-xs text-muted-foreground">Hoy ya protegiste este compromiso.</p></div>
                      <EntryDelete onDelete={() => removeEntry(todayCommitment.id)} pending={isPending} label="Desmarcar" />
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                      <div className="space-y-2"><Label htmlFor="commitment-title">Que quieres cuidar hoy</Label><Input id="commitment-title" value={commitmentTitle} onChange={(event) => setCommitmentTitle(event.target.value)} placeholder="Ej. Dormir sin pantalla a las 10:30 p. m." /></div>
                      <Button type="button" onClick={saveCommitment} disabled={isPending}>{isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Registrar hoy</Button>
                    </div>
                  )}
                  <p className="border-l-2 border-border px-3 text-xs leading-relaxed text-muted-foreground">Esto es un registro privado. Si una situacion te causa angustia o interfiere con tu vida, buscar apoyo profesional tambien es una forma de cuidarte.</p>
                </div>
              ) : null}

              {activePanel === "close" ? (
                <div className="space-y-4">
                  {todayReview ? (
                    <div className="border border-escudo-green/40 bg-escudo-green/5 p-4">
                      <p className="font-semibold text-foreground">Tu cierre ya esta guardado</p>
                      <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
                        <ReviewValue label="Algo que salio bien" value={String(entryValue(todayReview, "win") || "No registrado")} />
                        <ReviewValue label="Lo que sueltas" value={String(entryValue(todayReview, "release") || "No registrado")} />
                        <ReviewValue label="Paso de manana" value={String(entryValue(todayReview, "tomorrow_step") || "No registrado")} />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 border-t border-escudo-green/20 pt-3">
                        {linkedMissionId(todayReview) ? <Link href="/misiones" className="text-sm font-semibold text-accent">Ver mision de manana <ChevronRight className="inline size-4" /></Link> : <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => turnEntryIntoMission(todayReview)}>Convertir paso en mision</Button>}
                        <EntryDelete onDelete={() => removeEntry(todayReview.id)} pending={isPending} />
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2"><Label htmlFor="review-win">Algo que salio bien</Label><Input id="review-win" value={win} onChange={(event) => setWin(event.target.value)} placeholder="Aunque haya sido pequeno" /></div>
                      <div className="space-y-2"><Label htmlFor="review-release">Lo que necesito soltar</Label><Input id="review-release" value={release} onChange={(event) => setRelease(event.target.value)} placeholder="Una preocupacion o carga" /></div>
                      <div className="space-y-2"><Label htmlFor="review-tomorrow">Un paso para manana</Label><Input id="review-tomorrow" value={tomorrowStep} onChange={(event) => setTomorrowStep(event.target.value)} placeholder="Algo posible, no perfecto" /></div>
                    </div>
                  )}
                  {!todayReview ? <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"><p className="text-xs text-muted-foreground">Un minuto basta. No conviertas el cierre en otro formulario largo.</p><Button type="button" onClick={saveReview} disabled={isPending}>{isPending ? <Loader2 className="size-4 animate-spin" /> : <MoonStar className="size-4" />}Guardar cierre</Button></div> : null}
                </div>
              ) : null}

              {status ? <p className={`mt-5 border px-3 py-2 text-sm ${status.startsWith("No se pudo") || status.startsWith("Escribe") || status.startsWith("Agrega") || status.startsWith("La pagina") ? "border-destructive/50 text-destructive" : "border-escudo-green/40 text-escudo-green"}`}>{status}</p> : null}
            </div>
          </CardContent>
        </Card>

        <aside className="grid gap-4">
          <Card className="border-border bg-card shadow-none"><CardContent className="p-0">
            <div className="border-b border-border px-4 py-3"><p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground">PROGRESO DE HOY</p><p className="mt-1 text-sm font-semibold text-foreground">Tu ruta, en orden</p></div>
            <div className="divide-y divide-border">
              {dailySteps.map((step, index) => {
                const StepIcon = step.icon;
                return <button key={step.id} type="button" onClick={() => setActivePanel(step.id)} className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 ${step.id === activePanel ? "bg-accent/10" : ""}`}><span className={`flex size-7 shrink-0 items-center justify-center border ${step.done ? "border-escudo-green/50 text-escudo-green" : "border-border text-accent"}`}>{step.done ? <Check className="size-4" /> : <StepIcon className="size-4" />}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-foreground">{step.label}</span><span className="block truncate text-xs text-muted-foreground">{step.done ? "Completado hoy" : step.helper}</span></span><span className="font-mono text-[10px] text-muted-foreground">0{index + 1}</span></button>;
              })}
            </div>
          </CardContent></Card>
          <Card className="border-border bg-card shadow-none"><CardContent className="p-4">
            <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground">ARCHIVO RECIENTE</p>
            <div className="mt-3 space-y-2">
              {recentEntries.length === 0 ? <p className="text-sm text-muted-foreground">Aun no hay registros. Empieza por un momento que te importe.</p> : recentEntries.map((entry) => <button key={entry.id} type="button" onClick={() => setActivePanel(entry.kind === "idea" ? "idea" : entry.kind === "prayer" ? "prayer" : entry.kind === "reading" ? "reading" : "discipline")} className="flex w-full items-center justify-between gap-3 border border-border bg-background px-3 py-2 text-left hover:border-accent/60"><span className="min-w-0"><span className="block truncate text-sm font-medium text-foreground">{entry.title}</span><span className="block text-xs text-muted-foreground">{formatEntryDate(entry.entry_date)}</span></span><ChevronRight className="size-4 shrink-0 text-muted-foreground" /></button>)}
            </div>
          </CardContent></Card>
        </aside>
      </section>
    </main>
  );
}

function Metric({ label, value, positive = false }: { label: string; value: string; positive?: boolean }) {
  return <div className="border border-border bg-background px-3 py-3"><p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground">{label}</p><p className={`mt-1 text-lg font-bold ${positive ? "text-escudo-green" : "text-foreground"}`}>{value}</p></div>;
}

function ReviewValue({ label, value }: { label: string; value: string }) {
  return <div><p className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground">{label}</p><p className="mt-1 text-sm text-foreground">{value}</p></div>;
}

function BookRow({ entry, pending, onUpdate, onDelete, onMission }: { entry: PersonalEntry; pending: boolean; onUpdate: (entry: PersonalEntry, currentPage: number) => void; onDelete: (id: string) => void; onMission: (entry: PersonalEntry) => void }) {
  const [page, setPage] = useState(String(entryValue(entry, "current_page") || 0));
  const total = Number(entryValue(entry, "total_pages"));
  const current = Number(entryValue(entry, "current_page"));
  const progress = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  const missionId = linkedMissionId(entry);

  return <div className="border border-border bg-background p-3"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div className="min-w-0"><p className="font-semibold text-foreground">{entry.title}</p><p className="mt-1 text-xs text-muted-foreground">{current} de {total} paginas - {progress}%</p></div><div className="flex items-center gap-1"><EntryDelete onDelete={() => onDelete(entry.id)} pending={pending} /></div></div><div className="mt-3 h-1.5 overflow-hidden bg-muted"><div className="h-full bg-accent" style={{ width: `${progress}%` }} /></div><div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input aria-label={`Pagina actual de ${entry.title}`} inputMode="numeric" value={page} onChange={(event) => setPage(event.target.value)} className="sm:max-w-36" /><Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => onUpdate(entry, Number(page))}>Actualizar pagina</Button>{missionId ? <span className="self-center text-xs text-escudo-green">Lectura programada</span> : <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => onMission(entry)}>Programar lectura</Button>}</div></div>;
}
