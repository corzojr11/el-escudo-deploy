"use client";

import { useState, useEffect } from "react";
import { Loader2, RefreshCw } from "lucide-react";

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = "Cargando datos..." }: LoadingStateProps) {
  const [showColdStart, setShowColdStart] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowColdStart(true), 6000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <Loader2 className="h-8 w-8 animate-spin text-[#FFD700]" />
      <p className="text-sm text-gray-400">{message}</p>
      {showColdStart && (
        <div className="mt-4 max-w-sm text-center">
          <p className="text-xs text-gray-500 mb-3">
            Render (plan gratuito) puede tardar hasta 50 segundos en despertar tras inactividad.
            Esto es normal y solo ocurre en el primer acceso.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs border border-[#2A2A3C] text-gray-400 hover:text-white hover:border-gray-500 transition-colors rounded"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reintentar
          </button>
        </div>
      )}
    </div>
  );
}
