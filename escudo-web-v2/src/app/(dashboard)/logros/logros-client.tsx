"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, Star, Trophy } from "lucide-react";
import { EmptyState } from "@/components/dashboard/EmptyState";
import type { Achievement } from "@/lib/api/types";

const ACHIEVEMENT_META: Record<string, { icon: typeof Award; description: string }> = {
  "Primeros Pasos": { icon: Star, description: "Completaste tu primera mision" },
  "Gran Misionero": { icon: Award, description: "Completaste 10 misiones" },
  "Veterano": { icon: Trophy, description: "Completaste 25 misiones" },
  "Leyenda": { icon: Trophy, description: "Completaste 50 misiones" },
};

export function LogrosClient({ achievements }: { achievements: Achievement[] }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 pb-8">
      <Card className="border-[#2A2A3C] bg-[#17171A]">
        <CardHeader>
          <CardTitle className="text-[#FFD700]">Logros</CardTitle>
          <CardDescription>
            {achievements.length > 0
              ? `${achievements.length} logro${achievements.length > 1 ? "s" : ""} desbloqueado${achievements.length > 1 ? "s" : ""}`
              : "Completa misiones para desbloquear logros"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {achievements.length === 0 ? (
            <EmptyState message="Sin logros todavia. Completa misiones para ganar tus primeros logros." />
          ) : (
            <div className="space-y-3">
              {achievements.map((a) => {
                const meta = ACHIEVEMENT_META[a.name];
                const Icon = meta?.icon || Award;
                return (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 border border-[#2A2A3C] bg-[#0C0C0E] p-4"
                  >
                    <div className="flex-shrink-0">
                      <Icon className="h-6 w-6 text-[#FFD700]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white font-medium">{a.name}</p>
                      <p className="text-xs text-gray-400">
                        {meta?.description || "Logro desbloqueado"}
                      </p>
                    </div>
                    <div className="text-right">
                      {a.unlocked_at && (
                        <p className="text-[10px] text-gray-500">
                          {new Date(a.unlocked_at).toLocaleDateString("es-CO")}
                        </p>
                      )}
                      <Badge className="border-[#FFD700]/30 bg-[#FFD700]/10 text-[#FFD700] text-[10px] mt-1">
                        Desbloqueado
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
