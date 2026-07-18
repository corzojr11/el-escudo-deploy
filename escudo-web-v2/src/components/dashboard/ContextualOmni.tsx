"use client";

import { useState, useTransition } from "react";
import { Bot, Loader2, Send } from "lucide-react";
import { getContextualOmniAdvice } from "@/app/actions/omni-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DEFAULT_QUESTIONS: Record<string, string> = {
  dashboard: "¿Cuál es la acción más importante que debería hacer hoy?",
  metas: "¿Cómo puedo avanzar de forma realista en mis metas?",
  habitos: "¿Qué hábito me conviene priorizar hoy?",
  misiones: "¿Cómo debería organizar mis misiones pendientes?",
  turnos: "¿Cómo puedo organizar mejor mi día alrededor de mis turnos?",
  finanzas: "¿Cuál debería ser mi prioridad financiera ahora?",
  salud: "¿Qué acción de salud me conviene priorizar hoy?",
  rutinas: "¿Cómo adapto mi rutina a mi semana actual?",
  logros: "¿Qué pequeño objetivo me ayudaría a mantener el impulso?",
  bitacora: "Ayúdame a convertir una de mis ideas en un siguiente paso concreto.",
  perfil: "¿Qué dato de mi perfil debería completar para recibir mejores recomendaciones?",
};

export function ContextualOmni({ section }: { section: string }) {
  const defaultQuestion = DEFAULT_QUESTIONS[section] ?? DEFAULT_QUESTIONS.dashboard;
  const [question, setQuestion] = useState(defaultQuestion);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function ask() {
    setError(null);
    setAnswer(null);
    startTransition(async () => {
      try {
        const result = await getContextualOmniAdvice(section, question);
        setAnswer(result.response);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "OMNI no pudo responder ahora.");
      }
    });
  }

  return (
    <details className="border-b border-border bg-card/60 px-4 py-2 md:px-6">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-foreground">
        <Bot className="h-4 w-4 text-accent" /> OMNI contextual para esta sección
      </summary>
      <div className="mt-3 flex max-w-3xl flex-col gap-2 pb-2 sm:flex-row">
        <Input value={question} onChange={(event) => setQuestion(event.target.value)} aria-label="Pregunta para OMNI" />
        <Button type="button" disabled={pending || question.trim().length < 3} onClick={ask}>
          {pending ? <Loader2 className="animate-spin" /> : <Send />} Consultar
        </Button>
      </div>
      {answer && <p className="max-w-3xl border-l-2 border-accent pb-2 pl-3 text-sm text-muted-foreground">{answer}</p>}
      {error && <p role="alert" className="pb-2 text-sm text-destructive">{error}</p>}
    </details>
  );
}
