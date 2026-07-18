"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  HeartPulse,
  Lightbulb,
  Loader2,
  MessageCircle,
  Send,
  Sparkles,
  UserRound,
  Wallet,
  XCircle,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  sendOmniCommand,
  confirmOmniProposal,
  cancelOmniProposal,
  getOmniMessages,
  getOmniPatterns,
} from "@/app/actions/omni";
import {
  isOmniProposal,
  isOmniQuery,
  isOmniConfirmResult,
  isOmniProcessing,
} from "@/lib/api/omni-helpers";
import type { OmniCommandResult, OmniMessage, OmniPatternsResponse } from "@/lib/api/types";
import { cn } from "@/lib/utils";

function generateSessionId() {
  return `web-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  intent?: string;
  xp?: number;
  cost?: number;
  time: string;
  isError?: boolean;
}

interface PendingProposal {
  proposalId: string;
  command: string;
  preview: string;
  actions: OmniCommandResult[];
  costCOP?: number;
}

function formatTime(): string {
  return new Date().toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function mapHistoryToLocal(messages: OmniMessage[]): LocalMessage[] {
  return messages.map((msg) => ({
    id: msg.id,
    role: msg.role,
    text: msg.content,
    time: new Date(msg.created_at).toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
  }));
}

const intentLabels: Record<string, string> = {
  REGISTER_INCOME: "Ingreso registrado",
  LOG_WEIGHT: "Peso registrado",
  LOG_EXERCISE: "Ejercicio registrado",
  LOG_SLEEP: "Descanso registrado",
  CREATE_TASK: "Tarea creada",
  COMPLETE_TASK: "Tarea completada",
  DELETE_TASK: "Tarea eliminada",
  CREATE_GOAL: "Meta creada",
  UPDATE_GOAL: "Meta actualizada",
  COMPLETE_GOAL: "Meta completada",
  CREATE_SHIFT: "Turno creado",
  UPDATE_SHIFT: "Turno actualizado",
  DELETE_SHIFT: "Turno eliminado",
  REGISTER_FOCUS_DAY: "Día limpio registrado",
  REGISTER_RELAPSE: "Recaída registrada",
  RESET_FOCUS: "Racha reiniciada",
  CREATE_ROUTINE: "Rutina creada",
  COMPLETE_ROUTINE: "Rutina completada",
  LOG_METRIC: "Métrica registrada",
};

const QUICK_PROMPTS = [
  {
    title: "Ordenar mi día",
    description: "Turnos, tareas y energía disponible.",
    prompt: "Ayúdame a ordenar mi día",
    icon: CalendarClock,
  },
  {
    title: "Bajar la saturación",
    description: "Trabajo, cansancio o demasiadas cosas a la vez.",
    prompt: "Estoy saturado por el trabajo",
    icon: HeartPulse,
  },
  {
    title: "Cuidar mi dinero",
    description: "Prioridades, deudas y una decisión concreta.",
    prompt: "¿Qué debería priorizar con mi dinero?",
    icon: Wallet,
  },
  {
    title: "Volver a mí",
    description: "Un hábito, una idea o algo que quieres retomar.",
    prompt: "Quiero retomar un hábito importante",
    icon: Lightbulb,
  },
];

function formatActionList(actions: OmniCommandResult[]): string {
  return actions
    .map(
      (a) =>
        `• ${intentLabels[a.intent] || a.intent.replace(/_/g, " ")}: ${a.respuesta_usuario || a.mensaje_sistema || ""}`
    )
    .join("\n");
}

export default function OmniPage() {
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingProposal, setPendingProposal] = useState<PendingProposal | null>(null);
  const [patterns, setPatterns] = useState<OmniPatternsResponse | null>(null);
  const sessionIdRef = useRef(generateSessionId());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef("");

  useEffect(() => {
    Promise.allSettled([
      getOmniMessages(30, 0, sessionIdRef.current),
      getOmniPatterns(),
    ]).then(([history, patternsResult]) => {
      if (history.status === "fulfilled") {
        setMessages(mapHistoryToLocal(history.value.data ?? []));
      } else {
        setError(history.reason instanceof Error ? history.reason.message : "Error al cargar historial");
      }
      if (patternsResult.status === "fulfilled") {
        setPatterns(patternsResult.value);
      }
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, pendingProposal]);

  const addAssistantMessage = (
    text: string,
    options?: { intent?: string; xp?: number; cost?: number; isError?: boolean }
  ) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `omni-${Date.now()}`,
        role: "assistant",
        text,
        intent: options?.intent,
        xp: options?.xp,
        cost: options?.cost,
        time: formatTime(),
        isError: options?.isError,
      },
    ]);
  };

  const handleSend = async () => {
    const text = inputRef.current.trim();
    if (!text || sending || confirming || cancelling) return;

    // Si hay una propuesta pendiente, enviar un nuevo comando la cancela implícitamente en UI
    if (pendingProposal) {
      setPendingProposal(null);
    }

    setInput("");
    setError(null);
    setMessages((prev) => [
      ...prev,
      { id: `usr-${Date.now()}`, role: "user", text, time: formatTime() },
    ]);
    setSending(true);

    try {
      const result = await sendOmniCommand(text, sessionIdRef.current);

      if (isOmniQuery(result)) {
        addAssistantMessage(result.response, {
          cost: result.cost_cop,
          isError: result.is_error,
        });
      } else if (isOmniProposal(result)) {
        setPendingProposal({
          proposalId: result.proposal_id,
          command: result.command,
          preview: result.preview,
          actions: result.actions,
          costCOP: result.cost_cop,
        });
      } else if (isOmniConfirmResult(result)) {
        // Reconfirmación de una propuesta ya ejecutada
        addAssistantMessage(
          result.already_executed
            ? `Esta acción ya fue ejecutada. ${result.result.response}`
            : result.result.response,
          {
            xp: result.result.xp_ganada,
          }
        );
      } else {
        addAssistantMessage("Respuesta inesperada de OMNI.", { isError: true });
      }
    } catch (err) {
      addAssistantMessage(err instanceof Error ? err.message : "Error al comunicarse con OMNI.", {
        isError: true,
      });
    } finally {
      setSending(false);
    }
  };

  const handleConfirm = async () => {
    if (!pendingProposal || confirming || cancelling) return;
    setConfirming(true);
    setError(null);

    try {
      const result = await confirmOmniProposal(
        pendingProposal.proposalId,
        sessionIdRef.current
      );

      if (isOmniProcessing(result)) {
        // Otra pestaña/solicitud está ejecutando la propuesta.
        // Mostramos mensaje informativo; no limpiamos pendingProposal para
        // permitir que el usuario espere o vuelva a intentar.
        addAssistantMessage(result.message, { isError: false });
      } else {
        setPendingProposal(null);

        const intent = result.result.actions
          .map((a) => a.intent)
          .filter((i) => i && i !== "NONE")
          .join(", ");

        addAssistantMessage(result.result.response, {
          intent,
          xp: result.result.xp_ganada,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al confirmar la acción.");
    } finally {
      setConfirming(false);
    }
  };

  const handleCancel = async () => {
    if (!pendingProposal || confirming || cancelling) return;
    setCancelling(true);
    setError(null);

    try {
      await cancelOmniProposal(pendingProposal.proposalId);
      setPendingProposal(null);
      addAssistantMessage("Propuesta cancelada. Nada se modificó.", { isError: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cancelar la propuesta.");
    } finally {
      setCancelling(false);
    }
  };

  const isBusy = sending || confirming || cancelling;

  const startPrompt = (prompt: string) => {
    inputRef.current = prompt;
    setInput(prompt);
    handleSend();
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 pb-4">
      <section className="border border-border bg-card px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center border border-primary/60 bg-primary/15 text-primary">
              <Zap className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="hud-label text-accent">Asistente personal</p>
              <h2 className="font-heading text-2xl font-bold tracking-[0.08em] text-foreground">OMNI</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Ordena lo que te está pasando y define un siguiente paso.</p>
            </div>
          </div>
          <span className="hidden shrink-0 border border-escudo-green/35 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-escudo-green sm:inline-block">
            Contexto activo
          </span>
        </div>
      </section>

      {(patterns?.suggestion || patterns?.patterns[0]) && (
        <Card className="border-l-2 border-l-primary">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="hud-label text-escudo-green">Sugerencia personal</p>
              <p className="mt-1 text-sm text-foreground">{patterns.suggestion || patterns.patterns[0].insight}</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                const suggestion = patterns.suggestion || patterns.patterns[0].insight;
                inputRef.current = suggestion;
                setInput(suggestion);
                document.getElementById("omni-command")?.focus();
              }}
            >
              Usar sugerencia
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="flex h-[calc(100dvh-14rem)] min-h-[34rem] max-h-[46rem] flex-col overflow-hidden">
        <CardContent className="flex min-h-0 flex-1 flex-col gap-0 p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-semibold text-foreground">Conversación</p>
                <p className="text-xs text-muted-foreground">Una respuesta para toda tu situación.</p>
              </div>
            </div>
            <span className="hud-label text-primary">OMNI // activo</span>
          </div>
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-escudo-gold" />
              </div>
            ) : error && messages.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <AlertTriangle className="h-8 w-8 text-escudo-red" />
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            ) : messages.length === 0 && !pendingProposal ? (
              <div className="mx-auto flex min-h-full w-full max-w-none flex-col justify-between gap-6 py-2 sm:py-4">
                <section className="border border-primary/35 bg-primary/5 p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div className="max-w-xl">
                      <div className="flex items-center gap-2 text-primary">
                        <Sparkles className="h-4 w-4" />
                        <p className="hud-label">Punto de partida</p>
                      </div>
                      <h3 className="mt-2 font-heading text-xl font-bold tracking-wide text-foreground sm:text-2xl">
                        No tienes que resolverlo todo hoy.
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Cuéntame lo que te está pasando con tus propias palabras. OMNI te ayuda a encontrar
                        un paso claro antes de proponerte cualquier cambio.
                      </p>
                    </div>
                    <div className="border border-border bg-card px-3 py-2 text-left sm:w-44">
                      <p className="hud-label text-escudo-gold">Modo de hoy</p>
                      <p className="mt-1 text-sm font-medium text-foreground">Conversación primero</p>
                    </div>
                  </div>
                </section>

                <section>
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div>
                      <p className="hud-label text-primary">Elige una ruta</p>
                      <h3 className="mt-1 font-heading text-lg font-semibold text-foreground">¿Por dónde empezamos?</h3>
                    </div>
                    <span className="hidden text-xs text-muted-foreground sm:block">O escribe tu propia situación en el cuadro de mensaje.</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {QUICK_PROMPTS.map(({ title, description, prompt, icon: Icon }) => (
                      <button
                        key={title}
                        type="button"
                        className="group flex min-h-24 items-start gap-3 border border-border bg-background p-3 text-left transition-colors hover:border-primary/70 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                        onClick={() => startPrompt(prompt)}
                      >
                        <span className="grid h-10 w-10 shrink-0 place-items-center border border-primary/45 bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2 text-sm font-semibold text-foreground">
                            {title}
                            <ArrowUpRight className="h-4 w-4 shrink-0 text-primary" />
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="grid border border-border bg-card sm:grid-cols-3">
                  {[
                    ["01", "Habla sin ordenar", "No necesitas saber qué menú usar ni llenar un formulario."],
                    ["02", "Aterrizamos lo urgente", "OMNI separa lo importante de lo que puede esperar."],
                    ["03", "Tú decides el cambio", "Nada se guarda ni se modifica sin tu confirmación."],
                  ].map(([step, title, description], index) => (
                    <div
                      key={step}
                      className={cn(
                        "p-4",
                        index > 0 && "border-t border-border sm:border-t-0 sm:border-l"
                      )}
                    >
                      <p className="hud-label text-escudo-gold">{step}</p>
                      <p className="mt-2 text-sm font-semibold text-foreground">{title}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
                    </div>
                  ))}
                </section>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {messages.map((msg) => (
                  <div key={msg.id} className={cn("flex items-start gap-2.5", msg.role === "user" ? "justify-end" : "justify-start")}>
                    {msg.role === "assistant" && (
                      <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center border border-primary/45 bg-primary/10 text-primary">
                        <Zap className="h-3.5 w-3.5" />
                      </span>
                    )}
                    <div
                      className={cn(
                        "max-w-[min(100%,42rem)] border px-4 py-3 text-sm shadow-none",
                        msg.role === "user"
                          ? "max-w-[min(100%,38rem)] border-primary/60 bg-primary/15 text-foreground"
                          : msg.isError
                            ? "border-escudo-red/20 bg-escudo-red/10 text-escudo-red"
                            : "border-border bg-card text-foreground"
                      )}
                    >
                      {msg.role === "assistant" && (
                      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-primary">
                          <Zap className="h-3.5 w-3.5" /> NAVIR
                        </div>
                      )}
                      {msg.role === "user" && (
                        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-primary">
                          <UserRound className="h-3.5 w-3.5" /> TU MENSAJE
                        </div>
                      )}
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>

                      {msg.intent && (
                      <span className="mt-2 inline-block border border-escudo-green/25 bg-escudo-green/10 px-2 py-0.5 text-[11px] font-medium text-escudo-green">
                          {intentLabels[msg.intent] || msg.intent.replace(/_/g, " ")}
                        </span>
                      )}

                      <div className="mt-2 flex items-center gap-3">
                        <span className="text-[11px] text-muted-foreground">[{msg.time}]</span>
                        {msg.xp != null && msg.xp > 0 && (
                          <span className="text-[11px] font-medium text-escudo-gold">+{msg.xp} XP</span>
                        )}
                        {msg.cost != null && msg.cost > 0 && (
                          <span className="text-[11px] text-muted-foreground">${msg.cost.toFixed(2)} COP</span>
                        )}
                      </div>
                    </div>
                    {msg.role === "user" && (
                      <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center border border-primary/60 bg-primary text-primary-foreground">
                        <UserRound className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                ))}

                {pendingProposal && (
                  <div className="flex justify-start">
                    <div className="max-w-[90%] border border-escudo-gold/30 bg-escudo-gold/10 px-4 py-4 text-sm text-foreground">
                      <div className="mb-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-escudo-gold" />
                        <span className="font-semibold">Acción pendiente de confirmación</span>
                      </div>
                      <p className="mb-3 whitespace-pre-wrap leading-relaxed">{pendingProposal.preview}</p>

                      <div className="mb-3 border border-border/40 bg-background/60 p-2">
                        <p className="text-xs text-muted-foreground">Acciones propuestas:</p>
                        <p className="mt-1 whitespace-pre-wrap text-xs">
                          {formatActionList(pendingProposal.actions)}
                        </p>
                      </div>

                      {pendingProposal.costCOP != null && pendingProposal.costCOP > 0 && (
                        <p className="mb-3 text-[11px] text-muted-foreground">
                          Costo estimado: ${pendingProposal.costCOP.toFixed(2)} COP
                        </p>
                      )}

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={handleConfirm}
                          disabled={isBusy}
                          className="gap-1 bg-escudo-green text-background hover:bg-escudo-green/90"
                        >
                          {confirming ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          Confirmar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancel}
                          disabled={isBusy}
                          className="gap-1"
                        >
                          {cancelling ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5" />
                          )}
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {sending && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 border border-accent/15 bg-background/45 px-4 py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-escudo-green" />
                      <span className="text-sm text-muted-foreground">Interpretando comando...</span>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex justify-center">
                    <div className="flex items-center gap-2 border border-escudo-red/30 bg-escudo-red/10 px-3 py-2 text-xs text-escudo-red">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {error}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-border bg-card px-4 py-3">
            <div className="flex items-end gap-2">
              <textarea
                id="omni-command"
                rows={1}
                value={input}
                onChange={(e) => {
                  inputRef.current = e.target.value;
                  setInput(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                aria-label="Mensaje para OMNI"
                placeholder="Cuéntame qué está pasando o pide una acción concreta..."
                disabled={isBusy}
                className={cn(
                  "min-h-12 max-h-32 flex-1 resize-y border border-border bg-background px-4 py-3 text-sm leading-6 text-foreground placeholder:text-muted-foreground outline-none transition-colors",
                  "focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                )}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isBusy}
                size="icon"
                aria-label="Enviar mensaje a OMNI"
                className="h-12 w-12 shrink-0 rounded-none"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Ctrl/Cmd + Enter para enviar. Enter crea una nueva línea.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
