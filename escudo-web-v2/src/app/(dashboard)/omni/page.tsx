"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, AlertTriangle, Zap, Sparkles, CheckCircle2, XCircle, MessageCircle, UserRound } from "lucide-react";
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
  REGISTER_FOCUS_DAY: "Dia limpio registrado",
  REGISTER_RELAPSE: "Recaida registrada",
  RESET_FOCUS: "Racha reiniciada",
  CREATE_ROUTINE: "Rutina creada",
  COMPLETE_ROUTINE: "Rutina completada",
  LOG_METRIC: "Metrica registrada",
};

const QUICK_PROMPTS = [
  "Ayudame a ordenar mi dia",
  "Estoy saturado por el trabajo",
  "Que deberia priorizar con mi dinero?",
  "Quiero retomar un habito importante",
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

  return (
    <div className="flex flex-col gap-4">
      <section className="panel-neon relative overflow-hidden rounded-[28px] p-6">
        <div className="relative flex items-center gap-3">
          <span className="relative inline-flex">
            <Zap className="h-7 w-7 text-escudo-green" />
            <span className="animate-pulse-led absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-escudo-green" />
          </span>
          <div>
            <span className="hud-label text-escudo-green">Navir Online</span>
            <h2 className="font-heading text-3xl font-black tracking-[0.12em] text-glow text-foreground">
              &gt; OMNI_
            </h2>
          </div>
        </div>
      </section>

      {(patterns?.suggestion || patterns?.patterns[0]) && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
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

      <Card className="flex h-[calc(100dvh-17rem)] min-h-[34rem] flex-col overflow-hidden">
        <CardContent className="flex flex-1 flex-col gap-0 p-0">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-accent" />
              <div>
                <p className="text-sm font-semibold text-foreground">Conversacion actual</p>
                <p className="text-xs text-muted-foreground">Escribe como hablas. OMNI respondera a la situacion completa.</p>
              </div>
            </div>
            <span className="hud-label text-escudo-green">Activo</span>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
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
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Sparkles className="h-10 w-10 text-escudo-green/40" />
                <p className="text-sm text-muted-foreground">
                  OMNI esta listo. Escribe un comando para empezar.
                </p>
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  {QUICK_PROMPTS.map((hint) => (
                    <button
                      key={hint}
                      type="button"
                      className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-escudo-green/30 hover:text-escudo-green"
                      onClick={() => {
                        inputRef.current = hint;
                        setInput(hint);
                        handleSend();
                      }}
                    >
                      {hint}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {messages.map((msg) => (
                  <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[min(100%,46rem)] rounded-2xl border px-4 py-3 text-sm",
                        msg.role === "user"
                          ? "max-w-[min(100%,38rem)] border-primary/40 bg-primary/16 text-foreground"
                          : msg.isError
                            ? "border-escudo-red/20 bg-escudo-red/10 text-escudo-red"
                            : "border-accent/15 bg-background/45 text-foreground"
                      )}
                    >
                      {msg.role === "assistant" && (
                        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-accent">
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
                        <span className="mt-2 inline-block rounded-full border border-escudo-green/25 bg-escudo-green/10 px-2 py-0.5 text-[11px] font-medium text-escudo-green">
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
                  </div>
                ))}

                {pendingProposal && (
                  <div className="flex justify-start">
                    <div className="max-w-[90%] rounded-2xl border border-escudo-gold/30 bg-escudo-gold/10 px-4 py-4 text-sm text-foreground">
                      <div className="mb-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-escudo-gold" />
                        <span className="font-semibold">Acción pendiente de confirmación</span>
                      </div>
                      <p className="mb-3 whitespace-pre-wrap leading-relaxed">{pendingProposal.preview}</p>

                      <div className="mb-3 rounded-lg border border-border/40 bg-background/60 p-2">
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
                    <div className="flex items-center gap-2 rounded-2xl border border-accent/15 bg-background/45 px-4 py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-escudo-green" />
                      <span className="text-sm text-muted-foreground">Interpretando comando...</span>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex justify-center">
                    <div className="flex items-center gap-2 rounded-xl border border-escudo-red/30 bg-escudo-red/10 px-3 py-2 text-xs text-escudo-red">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {error}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-border/60 bg-background/50 px-4 py-3">
            <div className="flex items-center gap-2">
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
                placeholder="Cuentame que esta pasando o pide una accion concreta..."
                disabled={isBusy}
                className={cn(
                  "min-h-11 max-h-32 flex-1 resize-y rounded-xl border border-border/80 bg-input/80 px-4 py-2.5 text-sm leading-6 text-foreground placeholder:text-muted-foreground outline-none transition-all",
                  "focus:border-escudo-green/50 focus:ring-3 focus:ring-escudo-green/20 disabled:opacity-50"
                )}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isBusy}
                size="icon"
                aria-label="Enviar mensaje a OMNI"
                className="h-11 w-11 shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Ctrl/Cmd + Enter para enviar. Enter crea una nueva linea.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
