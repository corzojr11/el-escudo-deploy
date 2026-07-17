"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeOnboarding } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { FormStatus } from "@/components/dashboard/FormStatus";
import { ArrowRight, ArrowLeft, Check, Loader2 } from "lucide-react";

const GOALS = [
  { id: "ganar_musculo", label: "Quiero ganar músculo", emoji: "💪" },
  { id: "perder_grasa", label: "Quiero bajar de peso", emoji: "🔥" },
  { id: "energia_bienestar", label: "Quiero energía y bienestar", emoji: "⚡" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);

  function isValidStep1() {
    return name.trim().length >= 2 && name.trim().length <= 60 && birthDate !== "";
  }

  function isValidStep2() {
    const w = parseFloat(weight);
    const h = parseInt(height);
    return w > 0 && w <= 300 && h >= 100 && h <= 250;
  }

  function handleSubmit() {
    if (!selectedGoal) return;
    startTransition(async () => {
      try {
        await completeOnboarding({
          name: name.trim(),
          birth_date: birthDate,
          weight_kg: parseFloat(weight),
          height_cm: parseInt(height),
          health_goal: selectedGoal,
        });
        router.push("/");
        router.refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error al guardar");
      }
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0C0C0E] p-4">
      <Card className="w-full max-w-md border-[#2A2A3C] bg-[#17171A]">
        <CardHeader>
          <CardTitle className="text-xl text-[#FFD700]">
            {step === 1 && "¿Cómo quieres que te llamemos?"}
            {step === 2 && "Métricas físicas"}
            {step === 3 && "Tu objetivo principal"}
          </CardTitle>
          <CardDescription className="text-gray-400">
            {step === 1 && "Contanos tu nombre y fecha de nacimiento"}
            {step === 2 && "Registrá tu peso y estatura actuales"}
            {step === 3 && "Elegí lo que más se acerque a tu propósito"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <FormStatus error={error} />}

          {step === 1 && (
            <>
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
                <Label htmlFor="birth_date" className="text-gray-300">Fecha de nacimiento</Label>
                <Input
                  id="birth_date"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="mt-1 border-[#2A2A3C] bg-[#0C0C0E] text-white color-scheme-dark"
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <Label htmlFor="weight" className="text-gray-300">Peso actual (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="75.0"
                  min={30}
                  max={300}
                  step="0.1"
                  className="mt-1 border-[#2A2A3C] bg-[#0C0C0E] text-white"
                />
              </div>
              <div>
                <Label htmlFor="height" className="text-gray-300">Estatura (cm)</Label>
                <Input
                  id="height"
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="175"
                  min={100}
                  max={250}
                  className="mt-1 border-[#2A2A3C] bg-[#0C0C0E] text-white"
                />
              </div>
            </>
          )}

          {step === 3 && (
            <div className="space-y-3">
              {GOALS.map((goal) => (
                <button
                  key={goal.id}
                  onClick={() => setSelectedGoal(goal.id)}
                  className={`w-full flex items-center gap-3 p-4 rounded-md border text-left transition-colors ${
                    selectedGoal === goal.id
                      ? "border-[#7C5DFF] bg-[#7C5DFF]/10 text-white"
                      : "border-[#2A2A3C] bg-[#0C0C0E] text-gray-300 hover:border-gray-500"
                  }`}
                >
                  <span className="text-2xl">{goal.emoji}</span>
                  <span className="flex-1">{goal.label}</span>
                  {selectedGoal === goal.id && <Check className="w-5 h-5 text-[#7C5DFF]" />}
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-between pt-2">
            {step > 1 ? (
              <Button
                variant="outline"
                onClick={() => setStep(step - 1)}
                className="border-[#2A2A3C] text-gray-300"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Atrás
              </Button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={step === 1 ? !isValidStep1() : !isValidStep2()}
                className="bg-[#7C5DFF] hover:bg-[#7C5DFF]/90 text-white"
              >
                Siguiente
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!selectedGoal || isPending}
                className="bg-[#FFD700] hover:bg-[#FFD700]/90 text-black"
              >
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Comenzar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
