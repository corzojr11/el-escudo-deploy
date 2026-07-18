"use client";

import { useMemo, useState, useTransition } from "react";
import {
  BookOpen,
  Check,
  Heart,
  Lightbulb,
  Loader2,
  MoonStar,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { createPersonalEntry, deletePersonalEntry, updatePersonalEntry } from "@/app/actions/personal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PersonalEntry, PersonalEntryKind } from "@/lib/api/types";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

function entryValue(entry: PersonalEntry, key: string): string {
  const raw = entry.data?.[key];
  return raw === undefined || raw === null ? "" : String(raw);
}

function isTracker(entry: PersonalEntry, trackerType: string) {
  return entry.kind === "discipline" && entryValue(entry, "tracker_type") === trackerType;
}

function trackerStreak(entries: PersonalEntry[]): number {
  const dates = new Set(entries.map((entry) => entry.entry_date));
  const cursor = new Date(`${today()}T12:00:00`);
  let total = 0;

  while (dates.has(cursor.toISOString().slice(0, 10))) {
    total += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return total;
}

function EntryDelete({ id, onDeleted }: { id: string; onDeleted: (id: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  return confirming ? (
    <div className="flex gap-1">
      <Button
        size="xs"
        variant="destructive"
        disabled={pending}
        onClick={() => startTransition(async () => onDeleted(id))}
      >
        {pending ? <Loader2 className="animate-spin" /> : "Confirmar"}
      </Button>
      <Button size="icon-xs" variant="ghost" aria-label="Cancelar eliminación" onClick={() => setConfirming(false)}>
        x
      </Button>
    </div>
  ) : (
    <Button size="icon-xs" variant="ghost" aria-label="Eliminar entrada" onClick={() => setConfirming(true)}>
      <Trash2 />
    </Button>
  );
}

export function BitacoraClient({
  initialEntries,
  loadError = false,
}: {
  initialEntries: PersonalEntry[];
  loadError?: boolean;
}) {
  const [entries, setEntries] = useState(initialEntries);
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
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ideas = useMemo(() => entries.filter((entry) => entry.kind === "idea"), [entries]);
  const prayers = useMemo(() => entries.filter((entry) => entry.kind === "prayer"), [entries]);
  const books = useMemo(() => entries.filter((entry) => entry.kind === "reading"), [entries]);
  const commitments = useMemo(
    () => entries.filter((entry) => isTracker(entry, "private_commitment")),
    [entries]
  );
  const dailyReviews = useMemo(
    () => entries.filter((entry) => isTracker(entry, "daily_review")),
    [entries]
  );
  const todayCommitment = commitments.find((entry) => entry.entry_date === today());
  const todayReview = dailyReviews.find((entry) => entry.entry_date === today());

  function save(
    kind: PersonalEntryKind,
    title: string,
    content = "",
    data: Record<string, unknown> = {}
  ) {
    setStatus(null);
    startTransition(async () => {
      try {
        const entry = await createPersonalEntry({ kind, title, content, entry_date: today(), data });
        setEntries((current) => [entry, ...current]);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "No se pudo guardar la entrada.");
      }
    });
  }

  async function remove(id: string) {
    try {
      await deletePersonalEntry(id);
      setEntries((current) => current.filter((entry) => entry.id !== id));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo eliminar la entrada.");
    }
  }

  function updateBook(entry: PersonalEntry, currentPage: string, totalPages: string) {
    const current = Math.max(0, Number(currentPage) || 0);
    const total = Math.max(current, Number(totalPages) || 0);

    startTransition(async () => {
      try {
        const updated = await updatePersonalEntry(entry.id, {
          title: entry.title,
          content: entry.content,
          data: { ...entry.data, current_page: current, total_pages: total, last_read_date: today() },
        });
        setEntries((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "No se pudo actualizar el libro.");
      }
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 pb-8">
      <section className="border border-border bg-card p-6">
        <p className="hud-label text-accent">ESPACIO PERSONAL</p>
        <h2 className="mt-2 font-heading text-3xl font-black tracking-[0.08em] text-foreground md:text-4xl">
          BITACORA VIVA
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Ideas, lectura, oración, disciplina y cierre del día. Todo queda privado en tu cuenta y se adapta a
          lo que quieras sostener ahora.
        </p>
      </section>

      {loadError && (
        <p role="status" className="border border-escudo-gold/40 bg-escudo-gold/10 p-3 text-sm text-foreground">
          No se pudo cargar tu historial anterior. Puedes seguir registrando desde aquí y volver a intentar más tarde.
        </p>
      )}
      {status && <p role="alert" className="border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{status}</p>}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Lightbulb className="text-escudo-gold" /> Ideas de la noche</CardTitle>
            <CardDescription>Captura lo que se te ocurrió antes de que se pierda.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={ideaTitle} onChange={(event) => setIdeaTitle(event.target.value)} placeholder="Título de la idea" />
            <textarea
              value={ideaContent}
              onChange={(event) => setIdeaContent(event.target.value)}
              rows={4}
              placeholder="Una idea de negocio, trabajo, aplicación o algo que quieras recordar..."
              className="w-full resize-y rounded-xl border border-border/80 bg-input/80 p-3 text-sm text-foreground outline-none focus-visible:border-accent/60 focus-visible:ring-3 focus-visible:ring-accent/20"
            />
            <Button disabled={pending || !ideaTitle.trim()} onClick={() => {
              save("idea", ideaTitle.trim(), ideaContent.trim(), { source: "night_capture" });
              setIdeaTitle("");
              setIdeaContent("");
            }}><Plus /> Guardar idea</Button>
            {ideas.slice(0, 4).map((entry) => (
              <div key={entry.id} className="border-t border-border pt-3">
                <div className="flex justify-between gap-2"><p className="font-medium text-foreground">{entry.title}</p><EntryDelete id={entry.id} onDeleted={remove} /></div>
                {entry.content && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{entry.content}</p>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Heart className="text-accent" /> Oración y novena</CardTitle>
            <CardDescription>Un momento nocturno para volver a encontrar tu centro.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="border-l-2 border-accent pl-3 text-sm italic text-muted-foreground">
              San Judas Tadeo, acompáñame esta noche; dame serenidad para actuar con fe, claridad para decidir y
              fuerza para perseverar en el bien.
            </p>
            <Label htmlFor="novena-day">Día de la novena</Label>
            <select id="novena-day" value={novenaDay} onChange={(event) => setNovenaDay(event.target.value)} className="h-11 w-full rounded-xl border border-border/80 bg-input/80 px-3 text-sm text-foreground">
              <option value="0">Oración personal</option>
              {Array.from({ length: 9 }, (_, index) => <option key={index} value={String(index + 1)}>Novena - día {index + 1}</option>)}
            </select>
            <textarea
              value={intention}
              onChange={(event) => setIntention(event.target.value)}
              rows={3}
              placeholder="Tu intención, agradecimiento o lo que hoy quieres entregar..."
              className="w-full resize-y rounded-xl border border-border/80 bg-input/80 p-3 text-sm text-foreground outline-none focus-visible:border-accent/60 focus-visible:ring-3 focus-visible:ring-accent/20"
            />
            <Button disabled={pending} onClick={() => {
              const day = Number(novenaDay);
              save("prayer", day ? `Novena - día ${day}` : "Oración personal", intention.trim(), day ? { novena_day: day } : { prayer_type: "personal" });
              setIntention("");
            }}><Check /> Registrar oración</Button>
            <div className="border-t border-border pt-3 text-xs text-muted-foreground">
              {prayers.length ? `${prayers.length} registro${prayers.length === 1 ? "" : "s"} de oración. Último: ${prayers[0]?.title}.` : "Todavía no has guardado una oración. Puedes empezar hoy."}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BookOpen className="text-escudo-green" /> Lectura</CardTitle>
            <CardDescription>Guarda tus libros y actualiza el avance al terminar de leer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={bookTitle} onChange={(event) => setBookTitle(event.target.value)} placeholder="Título del libro" />
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" min="0" value={bookCurrent} onChange={(event) => setBookCurrent(event.target.value)} placeholder="Página actual" />
              <Input type="number" min="0" value={bookTotal} onChange={(event) => setBookTotal(event.target.value)} placeholder="Total de páginas" />
            </div>
            <Button disabled={pending || !bookTitle.trim()} onClick={() => {
              const current = Math.max(0, Number(bookCurrent) || 0);
              const total = Math.max(current, Number(bookTotal) || 0);
              save("reading", bookTitle.trim(), "", { current_page: current, total_pages: total, last_read_date: today() });
              setBookTitle("");
              setBookCurrent("");
              setBookTotal("");
            }}><Plus /> Agregar libro</Button>
            {books.length ? books.map((entry) => <BookRow key={entry.id} entry={entry} pending={pending} onSave={updateBook} onDelete={remove} />) : <p className="border-t border-border pt-3 text-sm text-muted-foreground">Añade el libro que quieres retomar. No necesitas leer mucho para volver a empezar.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="text-escudo-green" /> Disciplina privada</CardTitle>
            <CardDescription>Un registro discreto para el compromiso que tú elijas, sin culpa ni juicios.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-border bg-background p-3"><p className="hud-label text-muted-foreground">Racha actual</p><p className="mt-1 text-3xl font-bold text-escudo-gold">{trackerStreak(commitments)} días</p></div>
              <div className="border border-border bg-background p-3"><p className="hud-label text-muted-foreground">Registros</p><p className="mt-1 text-3xl font-bold text-foreground">{commitments.length}</p></div>
            </div>
            <Input value={commitmentTitle} onChange={(event) => setCommitmentTitle(event.target.value)} placeholder="Solo para ti: ej. nofap, menos redes, dormir mejor" />
            {todayCommitment ? (
              <div className="flex items-center justify-between border border-escudo-green/40 bg-escudo-green/10 p-3 text-sm text-escudo-green">
                <span>Hoy ya registraste: {todayCommitment.title}.</span><EntryDelete id={todayCommitment.id} onDeleted={remove} />
              </div>
            ) : (
              <Button disabled={pending} onClick={() => save("discipline", commitmentTitle.trim() || "Compromiso privado", "", { tracker_type: "private_commitment", completed: true })}><Check /> Registrar hoy</Button>
            )}
            <p className="text-xs text-muted-foreground">Si esta situación te causa angustia, se vuelve compulsiva o interfiere con tu vida, conversar con un profesional de salud puede ser un buen apoyo.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MoonStar className="text-accent" /> Cierre de hoy</CardTitle>
          <CardDescription>Un minuto para cerrar el día sin convertirlo en otro formulario.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          {todayReview ? (
            <div className="lg:col-span-3 border border-escudo-green/40 bg-escudo-green/10 p-4 text-sm">
              <div className="flex items-center justify-between gap-3"><p className="font-medium text-escudo-green">Tu cierre de hoy ya está guardado.</p><EntryDelete id={todayReview.id} onDeleted={remove} /></div>
              <div className="mt-3 grid gap-3 md:grid-cols-3 text-muted-foreground">
                <p><span className="font-medium text-foreground">Salió bien:</span> {entryValue(todayReview, "win") || "Sin nota."}</p>
                <p><span className="font-medium text-foreground">Suelto:</span> {entryValue(todayReview, "release") || "Sin nota."}</p>
                <p><span className="font-medium text-foreground">Mañana:</span> {entryValue(todayReview, "tomorrow_step") || "Sin paso definido."}</p>
              </div>
            </div>
          ) : (
            <>
              <div><Label htmlFor="daily-win">Algo que sí salió bien</Label><Input id="daily-win" value={win} onChange={(event) => setWin(event.target.value)} placeholder="Aunque haya sido pequeño" /></div>
              <div><Label htmlFor="daily-release">Lo que necesito soltar</Label><Input id="daily-release" value={release} onChange={(event) => setRelease(event.target.value)} placeholder="Una preocupación o carga" /></div>
              <div><Label htmlFor="tomorrow-step">Un paso claro para mañana</Label><Input id="tomorrow-step" value={tomorrowStep} onChange={(event) => setTomorrowStep(event.target.value)} placeholder="Algo posible, no perfecto" /></div>
              <div className="lg:col-span-3"><Button disabled={pending || !(win.trim() || release.trim() || tomorrowStep.trim())} onClick={() => {
                save("discipline", "Cierre del día", "", { tracker_type: "daily_review", win: win.trim(), release: release.trim(), tomorrow_step: tomorrowStep.trim() });
                setWin("");
                setRelease("");
                setTomorrowStep("");
              }}><Check /> Guardar cierre de hoy</Button></div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BookRow({
  entry,
  pending,
  onSave,
  onDelete,
}: {
  entry: PersonalEntry;
  pending: boolean;
  onSave: (entry: PersonalEntry, current: string, total: string) => void;
  onDelete: (id: string) => void;
}) {
  const [current, setCurrent] = useState(entryValue(entry, "current_page"));
  const [total, setTotal] = useState(entryValue(entry, "total_pages"));
  const currentNumber = Number(current) || 0;
  const totalNumber = Number(total) || 0;
  const percentage = totalNumber > 0 ? Math.min(100, Math.round((currentNumber / totalNumber) * 100)) : 0;

  return <div className="border-t border-border pt-3">
    <div className="flex justify-between gap-2"><p className="font-medium text-foreground">{entry.title}</p><EntryDelete id={entry.id} onDeleted={onDelete} /></div>
    <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2"><Input type="number" min="0" value={current} onChange={(event) => setCurrent(event.target.value)} aria-label="Página actual" /><Input type="number" min="0" value={total} onChange={(event) => setTotal(event.target.value)} aria-label="Total de páginas" /><Button size="sm" variant="outline" disabled={pending} onClick={() => onSave(entry, current, total)}>Actualizar</Button></div>
    <p className="mt-2 text-xs text-muted-foreground">{currentNumber} / {totalNumber || "?"} páginas - {percentage}%{entryValue(entry, "last_read_date") ? ` - última lectura: ${entryValue(entry, "last_read_date")}` : ""}</p>
  </div>;
}
