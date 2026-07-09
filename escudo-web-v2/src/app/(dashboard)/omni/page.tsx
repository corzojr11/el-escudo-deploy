"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, AlertTriangle, Zap, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { sendOmniCommand, getOmniMessages } from "@/app/actions/omni";
import type { OmniCommandResult, OmniMessage } from "@/lib/api/types";
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

function formatTime(): string {
  return new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function mapHistoryToLocal(messages: OmniMessage[]): LocalMessage[] {
  return messages.map((msg) => ({
    id: msg.id,
    role: msg.role,
    text: msg.content,
    time: new Date(msg.created_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: true }),
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
};

export default function OmniPage() {
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef(generateSessionId());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef("");

  useEffect(() => {
    getOmniMessages(30)
      .then((res) => {
        const local = mapHistoryToLocal(res.data ?? []);
        setMessages(local);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Error al cargar historial");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    const text = inputRef.current.trim();
    if (!text || sending) return;

    setInput("");
    setError(null);

    const userMsg: LocalMessage = {
      id: `usr-${Date.now()}`,
      role: "user",
      text,
      time: formatTime(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      const result = await sendOmniCommand(text, sessionIdRef.current);

      if ("multi_intent" in result && result.multi_intent) {
        if (result.requires_confirmation) {
          const actionList = result.actions
            .map((a) => `• ${a.intent ?? "Acción"}: ${a.respuesta_usuario || a.mensaje_sistema || ""}`)
            .join("\n");
          setMessages((prev) => [
            ...prev,
            {
              id: `omni-${Date.now()}`,
              role: "assistant",
              text: `⚠️ Se detectaron múltiples acciones. Revisa:\n\n${actionList}\n\n¿Deseas continuar? Vuelve a enviar el comando para confirmar.`,
              time: formatTime(),
            },
          ]);
        } else {
          const texts = result.actions.map((a) => a.respuesta_usuario || a.mensaje_sistema || "").filter(Boolean);
          const combinedText = texts.length > 0 ? texts.join("\n\n") : "Procesado.";
          const costs = result.actions.reduce((sum, a) => sum + (a.interaction_cost_cop ?? 0), 0);
          const xps = result.actions.reduce((sum, a) => sum + (a.xp_ganada ?? 0), 0);
          const intentos = result.actions.map((a) => a.intent).filter((i) => i && i !== "NONE");
          setMessages((prev) => [
            ...prev,
            {
              id: `omni-${Date.now()}`,
              role: "assistant",
              text: combinedText,
              intent: intentos.join(", "),
              xp: xps > 0 ? xps : undefined,
              cost: costs > 0 ? costs : undefined,
              time: formatTime(),
            },
          ]);
        }
      } else {
        const single = result as OmniCommandResult;
        const responseText = single.respuesta_usuario || single.mensaje_sistema || "Procesado.";
        setMessages((prev) => [
          ...prev,
          {
            id: `omni-${Date.now()}`,
            role: "assistant",
            text: responseText,
            intent: single.intent !== "NONE" ? single.intent : undefined,
            xp: single.xp_ganada && single.xp_ganada > 0 ? single.xp_ganada : undefined,
            cost: single.interaction_cost_cop && single.interaction_cost_cop > 0 ? single.interaction_cost_cop : undefined,
            time: formatTime(),
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          text: err instanceof Error ? err.message : "Error al comunicarse con OMNI.",
          isError: true,
          time: formatTime(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="relative inline-flex">
            <Zap className="h-6 w-6 text-escudo-green" />
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-escudo-green animate-pulse-led" />
          </span>
          <h2 className="font-mono text-xl font-bold text-escudo-green">{">"} OMNI_</h2>
        </div>
        <span className="text-xs text-muted-foreground font-mono">
          NAVIR v1.0 // ONLINE
        </span>
      </div>

      <Card className="flex flex-1 flex-col overflow-hidden border-border bg-card">
        <CardContent className="flex flex-1 flex-col gap-0 p-0">
          {/* Mensajes */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4"
          >
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-escudo-gold" />
              </div>
            ) : error && messages.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <AlertTriangle className="h-8 w-8 text-escudo-red" />
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Sparkles className="h-10 w-10 text-escudo-green/40" />
                <p className="text-sm text-muted-foreground">
                  OMNI está listo. Escribe un comando para empezar.
                </p>
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  {["¿Cómo voy con mis metas?", "Registra mi peso", "Crea una tarea para hoy"].map((hint) => (
                    <button
                      key={hint}
                      type="button"
                      className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-escudo-green/30 hover:text-escudo-green"
                      onClick={() => { inputRef.current = hint; setInput(hint); handleSend(); }}
                    >
                      {hint}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg px-4 py-3 text-sm",
                        msg.role === "user"
                          ? "bg-escudo-gold text-primary-foreground"
                          : msg.isError
                            ? "bg-escudo-red/10 text-escudo-red border border-escudo-red/20"
                            : "bg-secondary text-foreground"
                      )}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>

                      {msg.intent && (
                        <span className="mt-2 inline-block rounded bg-escudo-green/10 px-2 py-0.5 text-[11px] font-medium text-escudo-green">
                          {intentLabels[msg.intent] || msg.intent.replace(/_/g, " ")}
                        </span>
                      )}

                      <div className="mt-2 flex items-center gap-3">
                        <span className="text-[11px] text-muted-foreground">
                          [{msg.time}]
                        </span>
                        {msg.xp != null && msg.xp > 0 && (
                          <span className="text-[11px] font-medium text-escudo-gold">
                            +{msg.xp} XP
                          </span>
                        )}
                        {msg.cost != null && msg.cost > 0 && (
                          <span className="text-[11px] text-muted-foreground">
                            ${msg.cost.toFixed(2)} COP
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {sending && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-escudo-green" />
                      <span className="text-sm text-muted-foreground">Procesando...</span>
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => { inputRef.current = e.target.value; setInput(e.target.value); }}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Escribe un comando para OMNI..."
                disabled={sending}
                className={cn(
                  "flex-1 rounded-md border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground",
                  "focus:border-escudo-green/50 focus:outline-none focus:ring-1 focus:ring-escudo-green/30",
                  "disabled:opacity-50"
                )}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                size="icon"
                className="h-10 w-10 shrink-0 bg-escudo-green text-primary-foreground hover:bg-escudo-green/90"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
