"use client";

import { useState, useTransition } from "react";
import { Beef, ChefHat, Clock3, Flame, Loader2, Scale, Sparkles } from "lucide-react";
import { generateRecipe } from "@/app/actions/nutrition";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { NutritionRecipe } from "@/lib/api/types";

type BaseRecipe = NutritionRecipe & {
  meal: "Desayuno" | "Almuerzo" | "Cena" | "Snack";
  cost: "Bajo" | "Medio";
  equipment: string[];
  substitutions: string[];
  storage: string;
};

const BASE_RECIPES: BaseRecipe[] = [
  {
    meal: "Desayuno", cost: "Bajo", name: "Avena potente con banano y huevos", calories: 930, protein_g: 39, prep_minutes: 15,
    ingredients: ["100 g avena en hojuelas", "300 ml leche entera", "120 g banano pelado (1 mediano)", "30 g mani tostado sin sal", "2 huevos (100 g sin cascara)", "1 pizca de canela o sal, opcional"],
    equipment: ["Olla pequena", "cuchara", "sarten", "gramera"],
    steps: ["Pesa la avena, leche y mani. Pela el banano y cortalo en rodajas.", "Pon la leche y la avena en una olla a fuego medio. Revuelve 5 a 7 minutos hasta que quede cremosa; si se pega, baja el fuego y agrega un poco de agua.", "Mientras tanto, calienta una sarten antiadherente a fuego medio-bajo. Cocina los 2 huevos 2 a 3 minutos por lado, hasta que la clara no se vea transparente.", "Sirve la avena. Encima agrega banano, mani y canela. Come los huevos al lado."],
    substitutions: ["Leche por agua y 25 g de leche en polvo", "Mani por 30 g de semillas o queso campesino", "Huevos por 120 g de cuajada"], storage: "La avena cocida dura hasta 2 dias refrigerada; recalienta con un chorrito de leche.", why: "Alta energia y proteina con alimentos faciles de conseguir en Colombia."
  },
  {
    meal: "Desayuno", cost: "Bajo", name: "Arepa con huevos, queso y chocolate", calories: 790, protein_g: 34, prep_minutes: 20,
    ingredients: ["150 g arepa de maiz lista", "3 huevos (150 g sin cascara)", "40 g queso campesino rallado", "250 ml leche entera", "15 g chocolate de mesa", "5 g mantequilla o aceite"],
    equipment: ["Sarten", "olla pequena", "espátula", "gramera"],
    steps: ["Calienta la sarten a fuego medio-bajo. Unta la arepa con la mantequilla y asala 3 minutos por lado, hasta que este caliente y dorada.", "Bate los huevos con un tenedor. En la misma sarten, cocinalos a fuego bajo y mueve con la espatula durante 2 a 3 minutos. Apaga cuando no haya huevo liquido y agrega el queso.", "Para el chocolate, calienta la leche sin dejarla hervir fuerte. Agrega el chocolate y mezcla 2 minutos hasta disolverlo.", "Sirve la arepa, los huevos con queso y el chocolate. Pesa todo antes de cocinar si quieres repetir la porcion."],
    substitutions: ["Queso campesino por cuajada", "Chocolate por cafe con leche", "Arepa por 100 g de pan"], storage: "Prepara los huevos al momento; la arepa asada puede guardarse 1 dia refrigerada.", why: "Desayuno colombiano completo para sumar calorias sin productos costosos."
  },
  {
    meal: "Almuerzo", cost: "Bajo", name: "Arroz, lentejas, pollo y aguacate", calories: 980, protein_g: 55, prep_minutes: 35,
    ingredients: ["90 g arroz crudo (rinde cerca de 250 g cocido)", "180 g lentejas ya cocidas", "180 g pollo crudo sin hueso (rinde cerca de 150 g cocido)", "80 g aguacate", "10 g aceite", "80 g cebolla y tomate picados", "sal, ajo y comino al gusto"],
    equipment: ["Olla con tapa", "sarten", "cuchillo", "tabla", "gramera"],
    steps: ["Lava el arroz en un colador. Ponlo en una olla con 180 ml de agua y una pizca de sal. Cuando hierva, tapa, baja al minimo y cocina 15 minutos. Deja reposar 5 minutos sin destapar.", "Corta el pollo en cubos pequenos. Calienta el aceite en una sarten a fuego medio, sofrie cebolla y tomate 3 minutos y agrega ajo/comino.", "Agrega el pollo y cocina 8 a 10 minutos, moviendo, hasta que este blanco por dentro y no salga jugo rosado. Si se seca, agrega 2 cucharadas de agua.", "Calienta las lentejas en una olla pequena 4 minutos. Sirve arroz, lentejas y pollo; corta y pesa el aguacate al final."],
    substitutions: ["Pollo por 2 huevos y 1 lata de atun", "Lentejas por frijol o garbanzo cocido", "Aguacate por 20 g de mani"], storage: "Cocina doble arroz, lentejas y pollo; refrigerados en recipientes cerrados duran hasta 3 dias.", why: "Usa arroz y lentejas para que el plato sea barato, saciante y alto en energia."
  },
  {
    meal: "Almuerzo", cost: "Medio", name: "Pasta con carne molida y queso", calories: 900, protein_g: 48, prep_minutes: 30,
    ingredients: ["100 g pasta seca (rinde cerca de 250 g cocida)", "170 g carne molida cruda", "120 g salsa de tomate", "30 g queso rallado", "10 g aceite", "60 g cebolla picada", "sal, ajo y oregano al gusto"],
    equipment: ["Olla grande", "colador", "sarten", "gramera"],
    steps: ["Hierve suficiente agua con sal en una olla. Agrega la pasta y cocina el tiempo indicado en el empaque, normalmente 8 a 10 minutos. Prueba un fideo: debe estar blando sin estar deshecho. Escurre.", "Calienta el aceite a fuego medio. Cocina la cebolla 2 minutos, agrega carne y desbaratala con una cuchara.", "Cocina la carne 8 a 10 minutos hasta que no tenga partes rosadas. Agrega salsa, ajo y oregano; cocina 3 minutos mas.", "Mezcla la pasta con la salsa y sirve. Pesa los 30 g de queso y espolvorea encima."],
    substitutions: ["Carne por pollo desmechado", "Pasta por arroz", "Queso rallado por queso campesino picado"], storage: "Guarda una porcion extra hasta 3 dias refrigerada. Recalienta tapada con una cucharada de agua.", why: "Una comida facil de preparar en cantidad para varios dias."
  },
  {
    meal: "Cena", cost: "Bajo", name: "Patacon con pollo desmechado y frijol", calories: 860, protein_g: 47, prep_minutes: 30,
    ingredients: ["200 g platano verde pelado", "170 g pollo crudo sin hueso (rinde cerca de 140 g cocido)", "150 g frijol ya cocido", "30 g queso campesino", "10 g aceite", "50 g cebolla y tomate picados", "sal y ajo al gusto"],
    equipment: ["Olla", "sarten", "tabla", "vaso o tabla para aplastar", "gramera"],
    steps: ["Corta el platano en 3 trozos. Hiervelo 8 minutos en agua hasta que entre un cuchillo con dificultad media. Escurre y aplasta cada trozo entre dos tablas o con un vaso resistente.", "Pinta el sarten con aceite y cocina los patacones a fuego medio 4 a 5 minutos por lado, hasta que esten dorados y firmes.", "En otra olla cocina el pollo en agua con sal 12 minutos, hasta que este blanco por dentro. Desmechalo con dos tenedores. Sofrie cebolla/tomate 3 minutos y mezcla el pollo 2 minutos.", "Calienta los frijoles. Sirve patacon, frijol, pollo y queso desmenuzado encima."],
    substitutions: ["Pollo por atun", "Frijol por lenteja", "Platano verde por 250 g de arroz cocido"], storage: "El pollo y los frijoles duran hasta 3 dias refrigerados; prepara el patacon fresco para que no se ablande.", why: "Combina carbohidrato denso con proteina y leguminosas."
  },
  {
    meal: "Cena", cost: "Bajo", name: "Arroz con atun, huevo y verduras", calories: 760, protein_g: 43, prep_minutes: 20,
    ingredients: ["250 g arroz cocido", "1 lata de atun en agua (120 g escurrido)", "2 huevos (100 g sin cascara)", "120 g verduras mixtas congeladas o picadas", "10 g aceite", "sal, ajo y limon al gusto"],
    equipment: ["Sarten grande", "colador", "espátula", "gramera"],
    steps: ["Abre la lata y escurre toda el agua. Bate los huevos en un vaso con una pizca de sal.", "Calienta el aceite en una sarten a fuego medio. Agrega las verduras y cocina 5 minutos hasta que esten calientes y mas suaves.", "Empuja las verduras a un lado, vierte el huevo y revolvelo 2 minutos hasta que este completamente cocido.", "Agrega arroz y atun. Mezcla y cocina 3 minutos hasta que todo este caliente. Termina con limon si tienes."],
    substitutions: ["Atun por 140 g de pollo cocido", "Verduras congeladas por zanahoria y tomate", "Arroz por pasta cocida"], storage: "No guardes una lata abierta. El plato ya preparado dura hasta 2 dias refrigerado.", why: "Resuelve una cena alta en proteina cuando tienes poco tiempo."
  },
  {
    meal: "Snack", cost: "Bajo", name: "Batido de banano, avena y mani", calories: 730, protein_g: 25, prep_minutes: 5,
    ingredients: ["350 ml leche entera", "120 g banano pelado", "80 g avena", "30 g mani o mantequilla de mani", "10 g panela o miel, opcional", "4 cubos de hielo, opcional"],
    equipment: ["Licuadora", "vaso grande", "gramera"],
    steps: ["Pesa avena y mani; pela el banano. Pon primero la leche en la licuadora para que no se pegue la avena.", "Agrega banano, avena, mani y panela. Licua 45 a 60 segundos hasta que no veas trozos grandes.", "Si queda demasiado espeso, agrega 50 ml mas de leche o agua y licua 10 segundos.", "Sirve y tomalo de inmediato. Si quieres mas proteina, acompanalos con 2 huevos cocidos."],
    substitutions: ["Mani por 30 g de avena extra y 10 g de aceite", "Leche por bebida de soya", "Banano por papaya o mango"], storage: "Mejor tomarlo recien hecho. Refrigerado maximo 12 horas y agitalo antes de beber.", why: "Forma sencilla de aumentar energia sin tener que comer otro plato grande."
  },
  {
    meal: "Snack", cost: "Bajo", name: "Yogur con avena, papaya y mani", calories: 590, protein_g: 22, prep_minutes: 5,
    ingredients: ["250 g yogur natural entero", "60 g avena", "180 g papaya sin cascara", "25 g mani tostado", "10 g miel o panela, opcional"],
    equipment: ["Tazon", "cuchillo", "cuchara", "gramera"],
    steps: ["Pesa el yogur y la avena en un tazon. Mezcla con una cuchara para que la avena se humedezca.", "Pela la papaya, retira semillas y corta 180 g en cubos pequenos.", "Agrega papaya, mani y miel encima. Deja reposar 5 minutos si prefieres la avena mas suave.", "Come frio. Es un snack, no reemplaza una comida principal si tienes mucho apetito."],
    substitutions: ["Papaya por banano o mango", "Mani por queso campesino", "Yogur por kumis natural"], storage: "Puedes dejarlo armado hasta 12 horas refrigerado, pero agrega el mani al momento para que conserve textura.", why: "Snack fresco, economico y facil de pesar."
  },
];

function RecipePanel({ recipe }: { recipe: NutritionRecipe }) {
  const guide = "equipment" in recipe ? recipe as BaseRecipe : null;

  return <Card className="border-[#7C5DFF] bg-[#17171A]"><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="hud-label text-[#FFD700]">RECETA SELECCIONADA · 1 PORCION</p><CardTitle className="text-2xl text-white">{recipe.name}</CardTitle><CardDescription>{recipe.why}</CardDescription></div><div className="flex gap-3 font-mono text-sm"><span className="text-[#FFD700]"><Flame className="mr-1 inline h-4 w-4" />{recipe.calories} kcal</span><span className="text-[#bcaeff]"><Beef className="mr-1 inline h-4 w-4" />{recipe.protein_g} g</span><span className="text-muted-foreground"><Clock3 className="mr-1 inline h-4 w-4" />{recipe.prep_minutes} min</span></div></div></CardHeader><CardContent className="space-y-6"><div className="grid gap-5 md:grid-cols-2"><div><p className="mb-2 flex items-center gap-2 font-semibold text-white"><Scale className="h-4 w-4 text-[#FFD700]" /> Ingredientes: pesa esto</p><ul className="space-y-2 text-sm text-muted-foreground">{recipe.ingredients.map((item) => <li key={item}>- {item}</li>)}</ul></div><div><p className="mb-2 font-semibold text-white">Antes de empezar</p>{guide ? <><p className="text-sm text-muted-foreground">Utensilios: {guide.equipment.join(", ")}.</p><p className="mt-3 text-sm text-muted-foreground">Pesa y deja todos los ingredientes listos antes de encender la estufa.</p></> : <p className="text-sm text-muted-foreground">Lee todos los pasos, pesa los ingredientes y deja listos los utensilios antes de cocinar.</p>}</div></div><div><p className="mb-3 font-semibold text-white">Preparacion paso a paso</p><ol className="space-y-3 text-sm leading-6 text-muted-foreground">{recipe.steps.map((item, index) => <li key={`${index}-${item}`} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center border border-[#7C5DFF] font-mono text-xs text-[#bcaeff]">{index + 1}</span><span>{item}</span></li>)}</ol></div>{guide && <div className="grid gap-5 border-t border-[#2A2A3C] pt-5 md:grid-cols-2"><div><p className="mb-2 font-semibold text-white">Cambios baratos si te falta algo</p><ul className="space-y-2 text-sm text-muted-foreground">{guide.substitutions.map((item) => <li key={item}>- {item}</li>)}</ul></div><div><p className="mb-2 font-semibold text-white">Guardar y recalentar</p><p className="text-sm text-muted-foreground">{guide.storage}</p></div></div>}</CardContent></Card>;
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
