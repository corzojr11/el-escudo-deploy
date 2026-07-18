"use client";

import { useState, useTransition } from "react";
import { ChefHat, Clock3, Flame, Loader2, Sparkles } from "lucide-react";
import { generateRecipe } from "@/app/actions/nutrition";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { NutritionRecipe } from "@/lib/api/types";

export function AlimentacionClient() {
  const [meal, setMeal] = useState("comida");
  const [ingredients, setIngredients] = useState("");
  const [minutes, setMinutes] = useState("25");
  const [recipe, setRecipe] = useState<NutritionRecipe | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function generate() {
    setError("");
    startTransition(async () => {
      try { setRecipe((await generateRecipe({ meal, ingredients, minutes: Number(minutes) || 25 })).recipe); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo generar la receta."); }
    });
  }

  return <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 pb-8">
    <Card className="border-[#2A2A3C] bg-[#17171A]"><CardHeader><p className="hud-label text-[#bcaeff]">COMBUSTIBLE PARA TU OBJETIVO</p><CardTitle className="flex items-center gap-2 text-3xl text-white"><ChefHat className="h-7 w-7 text-[#FFD700]" /> Alimentacion</CardTitle><CardDescription>Recetas practicas que se adaptan a tu objetivo de ganar masa, el tiempo real que tienes y los ingredientes que hay en casa.</CardDescription></CardHeader></Card>
    <Card className="border-[#2A2A3C] bg-[#17171A]"><CardContent className="grid gap-3 p-5 md:grid-cols-[1fr_2fr_100px_auto]"><Input value={meal} onChange={(event) => setMeal(event.target.value)} placeholder="Desayuno, comida o cena" className="border-[#2A2A3C] bg-[#0C0C0E] text-white" /><Input value={ingredients} onChange={(event) => setIngredients(event.target.value)} placeholder="Que tienes? Ej. arroz, pollo, huevos" className="border-[#2A2A3C] bg-[#0C0C0E] text-white" /><Input type="number" min="10" max="90" value={minutes} onChange={(event) => setMinutes(event.target.value)} className="border-[#2A2A3C] bg-[#0C0C0E] text-white" /><Button disabled={pending} onClick={generate} className="bg-[#7C5DFF]">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="mr-2 h-4 w-4" /> Crear receta</>}</Button></CardContent></Card>
    {error && <p className="border border-red-500/30 p-3 text-sm text-red-400">{error}</p>}
    {recipe ? <Card className="border-[#2A2A3C] bg-[#17171A]"><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="hud-label text-[#FFD700]">RECETA ADAPTADA</p><CardTitle className="text-2xl text-white">{recipe.name}</CardTitle><CardDescription>{recipe.why}</CardDescription></div><div className="flex gap-3 font-mono text-sm"><span className="text-[#FFD700]"><Flame className="mr-1 inline h-4 w-4" />{recipe.calories} kcal</span><span className="text-[#bcaeff]">{recipe.protein_g} g proteina</span><span className="text-muted-foreground"><Clock3 className="mr-1 inline h-4 w-4" />{recipe.prep_minutes} min</span></div></div></CardHeader><CardContent className="grid gap-5 md:grid-cols-2"><div><p className="mb-2 font-semibold text-white">Ingredientes</p><ul className="space-y-2 text-sm text-muted-foreground">{recipe.ingredients.map((item) => <li key={item}>- {item}</li>)}</ul></div><div><p className="mb-2 font-semibold text-white">Preparacion</p><ol className="space-y-2 text-sm text-muted-foreground">{recipe.steps.map((item, index) => <li key={`${index}-${item}`}>{index + 1}. {item}</li>)}</ol></div></CardContent></Card> : <Card className="border-[#2A2A3C] bg-[#17171A]"><CardContent className="py-12 text-center text-sm text-muted-foreground">Escribe lo que tienes y genera una receta que te acerque a tu objetivo, no una recomendacion generica.</CardContent></Card>}
  </div>;
}
