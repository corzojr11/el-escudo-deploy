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
      .then((res) => setMessages(mapHistoryToLocal(res.data ?? [])))
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
    setMessages((prev) => [
      ...prev,
      { id: `usr-${Date.now()}`, role: "user", text, time: formatTime() },
    ]);
    setSending(true);

    try {
      const result = await sendOmniCommand(text, sessionIdRef.current);

      if ("multi_intent" in result && result.multi_intent) {
        if (result.requires_confirmation) {
          const actionList = result.actions
            .map((a) => `• ${a.intent ?? "Accion"}: ${a.respuesta_usuario || a.mensaje_sistema || ""}`)
            .join("\n");

          setMessages((prev) => [
            ...prev,
            {
              id: `omni-${Date.now()}`,
              role: "assistant",
              text: `Se detectaron multiples acciones.\n\n${actionList}\n\nReenvia el comando si deseas confirmar.`,
              time: formatTime(),
            },
          ]);
        } else {
          const texts = result.actions
            .map((a) => a.respuesta_usuario || a.mensaje_sistema || "")
            .filter(Boolean);
          const combinedText = texts.length > 0 ? texts.join("\n\n") : "Procesado.";
          const costs = result.actions.reduce((sum, a) => sum + (a.interaction_cost_cop ?? 0), 0);
          const xps = result.actions.reduce((sum, a) => sum + (a.xp_ganada ?? 0), 0);
          const intents = result.actions.map((a) => a.intent).filter((i) => i && i !== "NONE");

          setMessages((prev) => [
            ...prev,
            {
              id: `omni-${Date.now()}`,
              role: "assistant",
              text: combinedText,
              intent: intents.join(", "),
              xp: xps > 0 ? xps : undefined,
              cost: costs > 0 ? costs : undefined,
              time: formatTime(),
            },
          ]);
        }
      } else {
        const single = result as OmniCommandResult;
        setMessages((prev) => [
          ...prev,
          {
            id: `omni-${Date.now()}`,
            role: "assistant",
            text: single.respuesta_usuario || single.mensaje_sistema || "Procesado.",
            intent: single.intent !== "NONE" ? single.intent : undefined,
            xp: single.xp_ganada && single.xp_ganada > 0 ? single.xp_ganada : undefined,
            cost:
              single.interaction_cost_cop && single.interaction_cost_cop > 0
                ? single.interaction_cost_cop
                : undefined,
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
    <div className="flex flex-col gap-4">
      <section className="panel-neon relative overflow-hidden rounded-[28px] p-6">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,rgba(42,245,152,0.12),transparent_62%)]" />
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

      <Card className="flex h-[calc(100vh-14rem)] flex-col overflow-hidden">
        <CardContent className="flex flex-1 flex-col gap-0 p-0">
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
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Sparkles className="h-10 w-10 text-escudo-green/40" />
                <p className="text-sm text-muted-foreground">
                  OMNI esta listo. Escribe un comando para empezar.
                </p>
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  {["Como voy con mis metas?", "Registra mi peso", "Crea una tarea para hoy"].map((hint) => (
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
                        "max-w-[82%] rounded-2xl border px-4 py-3 text-sm",
                        msg.role === "user"
                          ? "border-primary/40 bg-primary/16 text-foreground shadow-[0_0_20px_rgba(124,58,237,0.18)]"
                          : msg.isError
                            ? "border-escudo-red/20 bg-escudo-red/10 text-escudo-red"
                            : "border-accent/15 bg-background/45 text-foreground"
                      )}
                    >
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

                {sending && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-2xl border border-accent/15 bg-background/45 px-4 py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-escudo-green" />
                      <span className="text-sm text-muted-foreground">Procesando...</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-border/60 bg-background/50 px-4 py-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => {
                  inputRef.current = e.target.value;
                  setInput(e.target.value);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Escribe un comando para OMNI..."
                disabled={sending}
                className={cn(
                  "h-11 flex-1 rounded-xl border border-border/80 bg-input/80 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all",
                  "focus:border-escudo-green/50 focus:ring-3 focus:ring-escudo-green/20 disabled:opacity-50"
                )}
              />
              <Button onClick={handleSend} disabled={!input.trim() || sending} size="icon" className="h-11 w-11 shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
