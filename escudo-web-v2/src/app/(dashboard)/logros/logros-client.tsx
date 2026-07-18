"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Award, Check, LockKeyhole, Star, Target, Trophy } from "lucide-react";
import type { Achievement } from "@/lib/api/types";

const ACHIEVEMENT_MILESTONES = [
  { name: "Primeros Pasos", threshold: 1, icon: Star, description: "Completa tu primera misión." },
  { name: "Gran Misionero", threshold: 10, icon: Award, description: "Completa 10 misiones." },
  { name: "Veterano", threshold: 25, icon: Trophy, description: "Completa 25 misiones." },
  { name: "Leyenda", threshold: 50, icon: Trophy, description: "Completa 50 misiones." },
];

function missionLabel(count: number) {
  return `${count} misión${count === 1 ? "" : "es"} completada${count === 1 ? "" : "s"}`;
}

function formatDate(value?: string) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function LogrosClient({
  achievements,
  completedMissionCount,
}: {
  achievements: Achievement[];
  completedMissionCount: number;
}) {
  const unlockedNames = new Set(achievements.map((achievement) => achievement.name));
  const nextMilestone = ACHIEVEMENT_MILESTONES.find(
    (milestone) => !unlockedNames.has(milestone.name)
  );
  const nextProgress = nextMilestone
    ? Math.min(100, Math.round((completedMissionCount / nextMilestone.threshold) * 100))
    : 100;

  return (
    <div className="flex w-full flex-col gap-5 pb-8">
      <Card className="border-[#2A2A3C] bg-[#17171A]">
        <CardContent className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#FFD700]">Ruta de reconocimiento</p>
            <CardTitle className="mt-2 text-2xl text-white">Logros</CardTitle>
            <CardDescription className="mt-1 max-w-2xl">
              Cada misión cerrada deja una señal visible de tu avance. No necesitas hacerlo todo hoy: elige una acción y súmala.
            </CardDescription>
          </div>
          <div className="flex gap-3">
            <div className="border border-[#2A2A3C] bg-[#0C0C0E] px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-wider text-gray-500">Desbloqueados</p>
              <p className="mt-1 text-xl font-semibold text-[#FFD700]">{achievements.length} / {ACHIEVEMENT_MILESTONES.length}</p>
            </div>
            <div className="border border-[#2A2A3C] bg-[#0C0C0E] px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-wider text-gray-500">Recorrido</p>
              <p className="mt-1 text-xl font-semibold text-white">{completedMissionCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.8fr)]">
        <Card className="border-[#2A2A3C] bg-[#17171A]">
          <CardHeader className="border-b border-[#2A2A3C] pb-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">Siguiente hito</p>
            <CardTitle className="mt-1 text-lg text-white">
              {nextMilestone ? nextMilestone.name : "Ruta completada"}
            </CardTitle>
            <CardDescription>
              {nextMilestone
                ? `Te faltan ${Math.max(0, nextMilestone.threshold - completedMissionCount)} para desbloquearlo.`
                : "Ya alcanzaste todos los hitos actuales."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div className="h-2 overflow-hidden bg-[#0C0C0E]">
              <div className="h-full bg-[#7C5DFF]" style={{ width: `${nextProgress}%` }} />
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-gray-400">{missionLabel(completedMissionCount)}</span>
              <span className="font-mono text-[#B8A7FF]">{nextProgress}%</span>
            </div>
            <Link
              href="/misiones?accion=Una%20misi%C3%B3n%20que%20puedo%20terminar%20hoy"
              className="inline-flex min-h-10 items-center gap-2 border border-[#7C5DFF] bg-[#7C5DFF] px-4 text-sm font-medium text-white transition-colors hover:bg-[#6C4DEB]"
            >
              <Target className="h-4 w-4" /> Crear la siguiente misión <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>

        <Card className="border-[#2A2A3C] bg-[#17171A]">
          <CardHeader className="pb-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">Cómo se desbloquea</p>
            <CardTitle className="mt-1 text-lg text-white">Una misión cerrada a la vez</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-400">
            <p>Elige una misión concreta, ajústala a tu día y márcala como completada al terminar.</p>
            <Link href="/misiones" className="inline-flex items-center gap-2 text-sm font-medium text-[#B8A7FF] hover:text-white">
              Ir a misiones <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </section>

      <Card className="border-[#2A2A3C] bg-[#17171A]">
        <CardHeader>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">Mapa de hitos</p>
          <CardTitle className="mt-1 text-lg text-white">Tu ruta de avance</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {ACHIEVEMENT_MILESTONES.map((milestone) => {
            const unlocked = unlockedNames.has(milestone.name);
            const Icon = milestone.icon;
            const progress = Math.min(100, Math.round((completedMissionCount / milestone.threshold) * 100));

            return (
              <div
                key={milestone.name}
                className={`border p-4 ${unlocked ? "border-[#FFD700]/50 bg-[#FFD700]/5" : "border-[#2A2A3C] bg-[#0C0C0E]"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center border ${unlocked ? "border-[#FFD700]/50 text-[#FFD700]" : "border-[#2A2A3C] text-gray-500"}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  {unlocked ? <Check className="h-4 w-4 text-[#00D68F]" /> : <LockKeyhole className="h-4 w-4 text-gray-600" />}
                </div>
                <p className="mt-4 font-medium text-white">{milestone.name}</p>
                <p className="mt-1 min-h-10 text-xs leading-5 text-gray-400">{milestone.description}</p>
                <div className="mt-4 h-1.5 overflow-hidden bg-[#17171A]">
                  <div className={`h-full ${unlocked ? "bg-[#FFD700]" : "bg-[#7C5DFF]"}`} style={{ width: `${progress}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className={unlocked ? "text-[#FFD700]" : "text-gray-500"}>{unlocked ? "Desbloqueado" : "Bloqueado"}</span>
                  <span className="font-mono text-gray-400">{milestone.threshold} misiones</span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {achievements.length > 0 && (
        <Card className="border-[#2A2A3C] bg-[#17171A]">
          <CardHeader>
            <CardTitle className="text-lg text-white">Logros obtenidos</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {achievements.map((achievement) => {
              const milestone = ACHIEVEMENT_MILESTONES.find(({ name }) => name === achievement.name);
              const Icon = milestone?.icon || Award;
              return (
                <div key={achievement.id} className="flex items-center gap-3 border border-[#2A2A3C] bg-[#0C0C0E] p-4">
                  <Icon className="h-5 w-5 text-[#FFD700]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{achievement.name}</p>
                    <p className="mt-1 text-xs text-gray-500">{formatDate(achievement.unlocked_at) || "Logro desbloqueado"}</p>
                  </div>
                  <Badge className="border-[#FFD700]/30 bg-[#FFD700]/10 text-[10px] text-[#FFD700]">Obtenido</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
