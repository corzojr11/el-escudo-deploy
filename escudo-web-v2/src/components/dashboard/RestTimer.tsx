"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, RotateCcw, Timer } from "lucide-react";

const PRESETS = [60, 90, 120];

export function RestTimer() {
  const [seconds, setSeconds] = useState(60);
  const [remaining, setRemaining] = useState(60);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRunning(false);
  }, []);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setRemaining((prev) => {
          const next = prev - 1;
          if (next <= 0) {
            stop();
            try {
              const ctx = audioCtxRef.current || new AudioContext();
              audioCtxRef.current = ctx;
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.frequency.value = 800;
              gain.gain.value = 0.1;
              osc.start();
              osc.stop(ctx.currentTime + 0.3);
            } catch {}
            return 0;
          }
          return next;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, stop]);

  const start = () => {
    setRunning(true);
    if (remaining === 0) setRemaining(seconds);
  };

  const reset = () => {
    stop();
    setRemaining(seconds);
  };

  const selectPreset = (s: number) => {
    stop();
    setSeconds(s);
    setRemaining(s);
  };

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <div className="border border-[#2A2A3C] bg-[#17171A] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Timer className="h-4 w-4 text-[#7C5DFF]" />
        <p className="text-sm text-gray-300">Descanso entre series</p>
      </div>
      <div className="flex gap-1 mb-3">
        {PRESETS.map((s) => (
          <button
            key={s}
            onClick={() => selectPreset(s)}
            className={`px-2 py-1 text-xs border rounded ${seconds === s ? "border-[#7C5DFF] bg-[#7C5DFF]/10 text-white" : "border-[#2A2A3C] text-gray-400"}`}
          >
            {s}s
          </button>
        ))}
      </div>
      <div className="font-mono text-3xl text-white text-center mb-3">
        {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </div>
      <div className="flex gap-2 justify-center">
        {!running ? (
          <button onClick={start} className="px-3 py-1 bg-[#7C5DFF] text-white text-xs rounded flex items-center gap-1 hover:bg-[#7C5DFF]/90">
            <Play className="h-3 w-3" /> Iniciar
          </button>
        ) : (
          <button onClick={stop} className="px-3 py-1 bg-[#FFD700] text-black text-xs rounded flex items-center gap-1">
            <Pause className="h-3 w-3" /> Pausa
          </button>
        )}
        <button onClick={reset} className="px-3 py-1 border border-[#2A2A3C] text-gray-400 text-xs rounded flex items-center gap-1">
          <RotateCcw className="h-3 w-3" /> Reiniciar
        </button>
      </div>
    </div>
  );
}
