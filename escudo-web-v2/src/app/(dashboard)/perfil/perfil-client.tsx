"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/app/actions/profile";
import type { Profile } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { FormStatus } from "@/components/dashboard/FormStatus";
import { Loader2 } from "lucide-react";

interface Props {
  profile: Profile | null;
}

const GOAL_LABELS: Record<string, string> = {
  ganar_musculo: "Ganar musculo",
  perder_grasa: "Perder grasa",
  energia_bienestar: "Energía y bienestar",
};

export function PerfilClient({ profile }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState(profile?.name || "");
  const [birthDate, setBirthDate] = useState(profile?.birth_date || "");
  const [heightCm, setHeightCm] = useState(profile?.height_cm?.toString() || "");
  const [healthGoal, setHealthGoal] = useState(profile?.health_goal || "");
  const [equipment, setEquipment] = useState((profile?.equipment || []).join(", "));

  const age = useMemo(() => {
    if (!birthDate) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
    if (!match) return null;
    const by = parseInt(match[1], 10);
    const bm = parseInt(match[2], 10);
    const bd = parseInt(match[3], 10);
    const today = new Date();
    const ty = today.getFullYear();
    const tm = today.getMonth() + 1;
    const td = today.getDate();
    let years = ty - by;
    if (tm < bm || (tm === bm && td < bd)) years--;
    return years;
  }, [birthDate]);

  if (!profile) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <Card className="border-[#2A2A3C] bg-[#17171A]">
          <CardContent className="p-6 text-center text-gray-400">
            Perfil no encontrado.{" "}
            <a href="/onboarding" className="text-[#7C5DFF] underline">
              Completa tu onboarding
            </a>{" "}
            para crear tu perfil.
          </CardContent>
        </Card>
      </div>
    );
  }

  function handleSave() {
    setError(null);
    setSuccess(null);
    const data: Record<string, unknown> = {};
    const trimmedName = name.trim();
    if (trimmedName && trimmedName !== (profile?.name || "")) {
      data.name = trimmedName;
    }
    if (birthDate && birthDate !== (profile?.birth_date || "")) {
      data.birth_date = birthDate;
    }
    const h = parseInt(heightCm);
    if (heightCm && !isNaN(h) && h !== (profile?.height_cm ?? undefined)) {
      data.height_cm = h;
    }
    if (healthGoal && healthGoal !== (profile?.health_goal || "")) {
      data.health_goal = healthGoal;
    }
    const equipArray = equipment.split(",").map(s => s.trim()).filter(s => s.length > 0);
    if (equipArray.join(",") !== (profile?.equipment || []).join(",")) {
      data.equipment = equipArray;
    }
    if (Object.keys(data).length === 0) {
      setError("No hay cambios para guardar.");
      return;
    }
    startTransition(async () => {
      try {
        await updateProfile(data);
        setSuccess("Perfil actualizado.");
        router.refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error al actualizar");
      }
    });
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <Card className="border-[#2A2A3C] bg-[#17171A]">
        <CardHeader>
          <CardTitle className="text-[#FFD700]">Perfil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <FormStatus error={error} />}
          {success && <FormStatus success={success} />}

          <div>
            <Label className="text-gray-300">Email</Label>
            <Input
              value={profile.email || ""}
              disabled
              className="mt-1 border-[#2A2A3C] bg-[#0C0C0E] text-gray-500"
            />
          </div>

          <div>
            <Label htmlFor="name" className="text-gray-300">Nombre</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre"
              maxLength={60}
              className="mt-1 border-[#2A2A3C] bg-[#0C0C0E] text-white"
            />
          </div>

          <div>
            <Label htmlFor="birth_date" className="text-gray-300">
              Fecha de nacimiento {age !== null && <span className="text-gray-500">({age} anos)</span>}
            </Label>
            <Input
              id="birth_date"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="mt-1 border-[#2A2A3C] bg-[#0C0C0E] text-white color-scheme-dark"
            />
          </div>

          <div>
            <Label htmlFor="height" className="text-gray-300">Estatura (cm)</Label>
            <Input
              id="height"
              type="number"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              placeholder="175"
              min={100}
              max={250}
              className="mt-1 border-[#2A2A3C] bg-[#0C0C0E] text-white"
            />
          </div>

          <div>
            <Label className="text-gray-300">Objetivo</Label>
            <div className="flex gap-2 mt-1">
              {Object.entries(GOAL_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setHealthGoal(key)}
                  className={`px-3 py-2 rounded-md border text-sm transition-colors ${
                    healthGoal === key
                      ? "border-[#7C5DFF] bg-[#7C5DFF]/10 text-white"
                      : "border-[#2A2A3C] bg-[#0C0C0E] text-gray-400 hover:border-gray-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="equipment" className="text-gray-300">Equipamiento disponible (separado por comas)</Label>
            <Input
              id="equipment"
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              placeholder="Barra, mancuernas, rack..."
              className="mt-1 border-[#2A2A3C] bg-[#0C0C0E] text-white"
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={isPending}
            className="w-full bg-[#7C5DFF] hover:bg-[#7C5DFF]/90 text-white"
          >
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Guardar cambios
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
