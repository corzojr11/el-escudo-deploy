"use client";

import { useState, useTransition } from "react";
import { Beef, ChefHat, Clock3, Flame, Loader2, Scale, Sparkles } from "lucide-react";
import { generateRecipe } from "@/app/actions/nutrition";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { NutritionRecipe } from "@/lib/api/types";

type BaseRecipe = NutritionRecipe & { meal: "Desayuno" | "Almuerzo" | "Cena" | "Snack"; cost: "Bajo" | "Medio" };

const BASE_RECIPES: BaseRecipe[] = [
  { meal: "Desayuno", cost: "Bajo", name: "Avena potente con banano y huevos", calories: 930, protein_g: 39, prep_minutes: 15, ingredients: ["100 g avena", "300 ml leche entera", "120 g banano (1 mediano)", "30 g mani", "2 huevos (100 g)"], steps: ["Cocina la avena en la leche.", "Agrega banano en rodajas y mani.", "Acompana con los huevos."], why: "Alta energia y proteina con alimentos faciles de conseguir en Colombia." },
  { meal: "Desayuno", cost: "Bajo", name: "Arepa con huevos, queso y chocolate", calories: 790, protein_g: 34, prep_minutes: 20, ingredients: ["150 g arepa de maiz", "3 huevos (150 g)", "40 g queso campesino", "250 ml leche", "15 g chocolate de mesa"], steps: ["Asa la arepa.", "Prepara los huevos y agrega el queso.", "Haz chocolate con leche."], why: "Desayuno colombiano completo para sumar calorias sin productos costosos." },
  { meal: "Almuerzo", cost: "Bajo", name: "Arroz, lentejas, pollo y aguacate", calories: 980, protein_g: 55, prep_minutes: 35, ingredients: ["250 g arroz cocido", "180 g lentejas cocidas", "150 g pechuga o perniles de pollo cocidos", "80 g aguacate", "10 g aceite"], steps: ["Sirve el arroz y las lentejas calientes.", "Dora el pollo con poco aceite.", "Completa con aguacate."], why: "Usa arroz y lentejas para que el plato sea barato, saciante y alto en energia." },
  { meal: "Almuerzo", cost: "Medio", name: "Pasta con carne molida y queso", calories: 900, protein_g: 48, prep_minutes: 30, ingredients: ["250 g pasta cocida", "140 g carne molida cocida", "120 g salsa de tomate", "30 g queso rallado", "10 g aceite"], steps: ["Cocina la pasta.", "Sofrie la carne con salsa.", "Mezcla y termina con queso."], why: "Una comida facil de preparar en cantidad para varios dias." },
  { meal: "Cena", cost: "Bajo", name: "Patacon con pollo desmechado y frijol", calories: 860, protein_g: 47, prep_minutes: 30, ingredients: ["200 g platano verde", "140 g pollo desmechado", "150 g frijol cocido", "30 g queso campesino", "10 g aceite"], steps: ["Prepara el patacon con poco aceite.", "Calienta frijoles y pollo.", "Monta con queso."], why: "Combina carbohidrato denso con proteina y leguminosas." },
  { meal: "Cena", cost: "Bajo", name: "Arroz con atún, huevo y verduras", calories: 760, protein_g: 43, prep_minutes: 20, ingredients: ["250 g arroz cocido", "1 lata atun en agua (120 g escurrido)", "2 huevos (100 g)", "120 g verduras mixtas", "10 g aceite"], steps: ["Saltea verduras con aceite.", "Mezcla arroz y atun.", "Termina con huevos."], why: "Resuelve una cena alta en proteina cuando tienes poco tiempo." },
  { meal: "Snack", cost: "Bajo", name: "Batido de banano, avena y mani", calories: 730, protein_g: 25, prep_minutes: 5, ingredients: ["350 ml leche entera", "120 g banano", "80 g avena", "30 g mani o mantequilla de mani", "10 g panela opcional"], steps: ["Licua todos los ingredientes.", "Toma junto a una comida o despues de entrenar."], why: "Forma sencilla de aumentar energia sin tener que comer otro plato grande." },
  { meal: "Snack", cost: "Bajo", name: "Yogur con avena, papaya y mani", calories: 590, protein_g: 22, prep_minutes: 5, ingredients: ["250 g yogur natural", "60 g avena", "180 g papaya", "25 g mani"], steps: ["Mezcla yogur y avena.", "Agrega papaya y mani encima."], why: "Snack fresco, economico y facil de pesar." },
];

function RecipePanel({ recipe }: { recipe: NutritionRecipe }) {
  return <Card className="border-[#7C5DFF] bg-[#17171A]"><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="hud-label text-[#FFD700]">RECETA SELECCIONADA</p><CardTitle className="text-2xl text-white">{recipe.name}</CardTitle><CardDescription>{recipe.why}</CardDescription></div><div className="flex gap-3 font-mono text-sm"><span className="text-[#FFD700]"><Flame className="mr-1 inline h-4 w-4" />{recipe.calories} kcal</span><span className="text-[#bcaeff]"><Beef className="mr-1 inline h-4 w-4" />{recipe.protein_g} g</span><span className="text-muted-foreground"><Clock3 className="mr-1 inline h-4 w-4" />{recipe.prep_minutes} min</span></div></div></CardHeader><CardContent className="grid gap-5 md:grid-cols-2"><div><p className="mb-2 flex items-center gap-2 font-semibold text-white"><Scale className="h-4 w-4 text-[#FFD700]" /> Cantidades para gramera</p><ul className="space-y-2 text-sm text-muted-foreground">{recipe.ingredients.map((item) => <li key={item}>- {item}</li>)}</ul></div><div><p className="mb-2 font-semibold text-white">Preparacion</p><ol className="space-y-2 text-sm text-muted-foreground">{recipe.steps.map((item, index) => <li key={`${index}-${item}`}>{index + 1}. {item}</li>)}</ol></div></CardContent></Card>;
}

export function AlimentacionClient() {
  const [meal, setMeal] = useState("Almuerzo");
  const [ingredients, setIngredients] = useState("");
  const [minutes, setMinutes] = useState("25");
  const [selected, setSelected] = useState<NutritionRecipe>(BASE_RECIPES[2]);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const visible = BASE_RECIPES.filter((recipe) => meal === "Todo" || recipe.meal === meal);

  function generate() { setError(""); startTransition(async () => { try { setSelected((await generateRecipe({ meal, ingredients, minutes: Number(minutes) || 25 })).recipe); } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo generar la receta."); } }); }

  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 pb-8">
    <Card className="border-[#2A2A3C] bg-[#17171A]"><CardHeader><p className="hud-label text-[#bcaeff]">COMBUSTIBLE PARA GANAR MASA</p><CardTitle className="flex items-center gap-2 text-3xl text-white"><ChefHat className="h-7 w-7 text-[#FFD700]" /> Alimentacion economica</CardTitle><CardDescription>Comidas de mercado colombiano, con porciones en gramos para que uses gramera. Calorias y proteina son aproximadas; ajusta con un profesional si tienes una condicion medica.</CardDescription></CardHeader></Card>
    <Card className="border-[#2A2A3C] bg-[#17171A]"><CardContent className="space-y-4 p-5"><div className="flex flex-wrap gap-2">{["Todo", "Desayuno", "Almuerzo", "Cena", "Snack"].map((option) => <Button key={option} size="sm" variant={meal === option ? "default" : "outline"} onClick={() => setMeal(option)} className={meal === option ? "bg-[#7C5DFF]" : ""}>{option}</Button>)}</div><div className="grid gap-3 md:grid-cols-[2fr_100px_auto]"><Input value={ingredients} onChange={(event) => setIngredients(event.target.value)} placeholder="Que tienes? Ej. arroz, pollo, huevos, lentejas" className="border-[#2A2A3C] bg-[#0C0C0E] text-white" /><Input type="number" min="10" max="90" value={minutes} onChange={(event) => setMinutes(event.target.value)} className="border-[#2A2A3C] bg-[#0C0C0E] text-white" /><Button disabled={pending} onClick={generate} className="bg-[#7C5DFF]">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="mr-2 h-4 w-4" /> Adaptar receta</>}</Button></div><p className="text-xs text-muted-foreground">La IA crea una variacion con ingredientes colombianos y porciones en gramos; las recetas base estan disponibles de inmediato.</p></CardContent></Card>
    {error && <p className="border border-red-500/30 p-3 text-sm text-red-400">{error}</p>}
    <RecipePanel recipe={selected} />
    <section><div className="mb-3 flex items-end justify-between"><div><p className="hud-label text-[#bcaeff]">RECETAS BASE</p><h2 className="text-xl font-semibold text-white">Baratas, pesables y repetibles</h2></div><span className="text-xs text-muted-foreground">Selecciona una para ver cantidades</span></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{visible.map((recipe) => <button key={recipe.name} onClick={() => setSelected(recipe)} className={`border p-4 text-left transition-colors ${selected.name === recipe.name ? "border-[#7C5DFF] bg-[#7C5DFF]/10" : "border-[#2A2A3C] bg-[#17171A] hover:border-[#7C5DFF]/60"}`}><div className="flex justify-between gap-2"><span className="hud-label text-[#FFD700]">{recipe.meal} · {recipe.cost}</span><span className="font-mono text-xs text-[#bcaeff]">{recipe.calories} kcal</span></div><p className="mt-2 font-semibold text-white">{recipe.name}</p><p className="mt-1 text-xs text-muted-foreground">{recipe.protein_g} g proteina · {recipe.prep_minutes} min</p></button>)}</div></section>
  </div>;
}
