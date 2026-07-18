"use client";

import { useState, useTransition } from "react";
import { Beef, BookmarkPlus, CalendarDays, ChefHat, Clock3, Flame, Loader2, Scale, Sparkles, Trash2 } from "lucide-react";
import { deleteNutritionFavorite, generateRecipe, saveNutritionFavorite, saveNutritionWeeklyPlan } from "@/app/actions/nutrition";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { NutritionFavorite, NutritionMealPlanDay, NutritionRecipe, NutritionWeeklyPlan } from "@/lib/api/types";

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
    equipment: ["Sarten", "olla pequena", "espÃ¡tula", "gramera"],
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
    equipment: ["Sarten grande", "colador", "espÃ¡tula", "gramera"],
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
  {
    meal: "Desayuno", cost: "Bajo", name: "Calentado con huevo, frijol y queso", calories: 820, protein_g: 35, prep_minutes: 15,
    ingredients: ["250 g arroz cocido", "150 g frijol cocido", "2 huevos (100 g sin cascara)", "35 g queso campesino", "8 g aceite", "50 g hogao o tomate y cebolla"], equipment: ["Sarten grande", "espatula", "gramera"],
    steps: ["Pesa todos los ingredientes y desmenuza el queso.", "Calienta el aceite a fuego medio. Agrega el hogao, arroz y frijol; mezcla 5 minutos hasta que salga vapor de todo el arroz.", "Haz dos espacios en la sarten, agrega los huevos y cocina 2 a 3 minutos hasta que no haya clara transparente.", "Sirve el calentado con los huevos y el queso encima."], substitutions: ["Frijol por lentejas", "Queso por 20 g de mani", "Hogao por tomate picado"], storage: "El arroz y frijol ya cocidos duran 3 dias refrigerados.", why: "Aprovecha comida preparada y evita saltarte el desayuno."
  },
  {
    meal: "Desayuno", cost: "Bajo", name: "Tortilla de papa, huevo y queso", calories: 720, protein_g: 32, prep_minutes: 25,
    ingredients: ["250 g papa pelada", "3 huevos (150 g sin cascara)", "40 g queso campesino", "8 g aceite", "40 g cebolla", "sal al gusto"], equipment: ["Olla", "sarten con tapa", "cuchillo", "gramera"],
    steps: ["Corta la papa en cubos de 2 cm. Hiervela 12 minutos hasta que un cuchillo entre sin resistencia.", "Sofrie la cebolla con aceite a fuego medio 3 minutos. Agrega la papa escurrida y dora 4 minutos.", "Bate los huevos, agrega queso y sal. Vierte sobre la papa, tapa y cocina a fuego bajo 5 minutos.", "Voltea con ayuda de un plato y cocina 2 minutos mas. El centro debe quedar firme, no liquido."], substitutions: ["Papa por yuca cocida", "Queso por cuajada", "Cebolla por espinaca"], storage: "Guarda porciones hasta 2 dias y recalienta en sarten tapada.", why: "Ingredientes baratos para un desayuno caliente y denso en energia."
  },
  {
    meal: "Desayuno", cost: "Medio", name: "Sandwich de pollo, queso y aguacate", calories: 760, protein_g: 46, prep_minutes: 15,
    ingredients: ["120 g pollo cocido desmechado", "100 g pan tajado", "40 g queso", "70 g aguacate", "30 g tomate", "10 g mayonesa o aceite"], equipment: ["Sarten", "cuchillo", "gramera"],
    steps: ["Pesa y corta tomate y aguacate. Mezcla el pollo con la mayonesa o aceite.", "Tuesta el pan a fuego bajo 2 minutos por lado hasta que este seco y dorado.", "Pon queso y pollo sobre dos tajadas; tapa la sarten 2 minutos para que el queso se derrita.", "Agrega tomate y aguacate al final y cierra el sandwich."], substitutions: ["Pollo por atun", "Pan por arepa", "Aguacate por 20 g de mani"], storage: "Guarda el pollo aparte; arma el sandwich al comer.", why: "Es rapido para dias con poco tiempo antes de salir."
  },
  {
    meal: "Almuerzo", cost: "Bajo", name: "Frijoles con arroz, huevo y carne", calories: 1030, protein_g: 53, prep_minutes: 35,
    ingredients: ["250 g arroz cocido", "220 g frijol cocido", "120 g carne molida cruda", "2 huevos (100 g sin cascara)", "10 g aceite", "80 g tomate y cebolla"], equipment: ["Sarten", "olla", "gramera"],
    steps: ["Calienta los frijoles en una olla a fuego bajo con 2 cucharadas de agua, 5 minutos.", "Sofrie tomate y cebolla en aceite 3 minutos. Agrega la carne y rompe los grumos con cuchara durante 8 minutos, hasta que no haya carne rosada.", "Calienta el arroz 3 minutos en la misma sarten. Cocina los huevos al lado hasta que la clara este blanca.", "Sirve arroz, frijoles, carne y huevos. Ajusta sal solo al final."], substitutions: ["Carne por pollo", "Frijol por garbanzo", "Huevos por 80 g de queso"], storage: "Prepara frijoles y carne para 3 dias en recipientes separados.", why: "Plato colombiano rendidor para subir calorias sin depender de suplementos."
  },
  {
    meal: "Almuerzo", cost: "Bajo", name: "Garbanzos guisados con pollo y arroz", calories: 900, protein_g: 51, prep_minutes: 30,
    ingredients: ["250 g garbanzo cocido", "160 g pollo crudo sin hueso", "250 g arroz cocido", "10 g aceite", "100 g tomate y cebolla", "60 g zanahoria"], equipment: ["Olla", "sarten", "cuchillo", "gramera"],
    steps: ["Corta pollo y zanahoria en cubos pequenos. Sofrie tomate y cebolla 3 minutos con aceite.", "Agrega pollo y cocina 8 a 10 minutos hasta que este blanco en el centro.", "Incorpora garbanzos, zanahoria y medio vaso de agua. Tapa y cocina 10 minutos hasta que la zanahoria este blanda.", "Calienta el arroz y sirve junto al guiso."], substitutions: ["Garbanzos por lentejas", "Pollo por 2 huevos y 80 g queso", "Arroz por pasta cocida"], storage: "El guiso dura 3 dias refrigerado y mejora de sabor al dia siguiente.", why: "Una forma economica de sumar proteina vegetal y animal."
  },
  {
    meal: "Almuerzo", cost: "Medio", name: "Sudado de pollo con papa y arroz", calories: 850, protein_g: 49, prep_minutes: 45,
    ingredients: ["200 g pollo crudo", "250 g papa", "250 g arroz cocido", "10 g aceite", "120 g tomate y cebolla", "200 ml agua", "sal y comino"], equipment: ["Olla con tapa", "cuchillo", "gramera"],
    steps: ["Corta la papa en cubos medianos. Sofrie tomate y cebolla con aceite 3 minutos.", "Agrega el pollo y sellalo 2 minutos por lado. Incorpora papa, agua, sal y comino.", "Tapa y cocina a fuego medio-bajo 25 minutos. El pollo debe estar blanco por dentro y la papa debe partirse con tenedor.", "Calienta el arroz y sirve con el caldo del sudado."], substitutions: ["Pollo por carne en cubos", "Papa por yuca", "Arroz por platano cocido"], storage: "Refrigera maximo 3 dias y recalienta hasta que hierva suavemente.", why: "Comida casera con salsa que ayuda a comer una porcion completa."
  },
  {
    meal: "Cena", cost: "Bajo", name: "Lentejas espesas con arroz y huevo", calories: 790, protein_g: 35, prep_minutes: 20,
    ingredients: ["260 g lentejas cocidas", "250 g arroz cocido", "3 huevos (150 g sin cascara)", "8 g aceite", "80 g tomate y cebolla", "40 g aguacate"], equipment: ["Olla", "sarten", "gramera"],
    steps: ["Calienta lentejas con tomate y cebolla en una olla 6 minutos. Si estan secas, agrega agua de a poco.", "Calienta el arroz en una sarten o microondas hasta que saque vapor.", "Cocina los huevos en aceite a fuego medio-bajo 2 a 3 minutos por lado; la clara debe quedar totalmente blanca.", "Sirve lentejas, arroz, huevos y aguacate pesado al final."], substitutions: ["Lentejas por frijol", "Huevos por atun", "Aguacate por mani"], storage: "Las lentejas se conservan 3 dias; el aguacate se corta al servir.", why: "Cena sencilla con buena energia cuando no quieres cocinar carne."
  },
  {
    meal: "Cena", cost: "Medio", name: "Arepas rellenas de pollo y queso", calories: 830, protein_g: 49, prep_minutes: 20,
    ingredients: ["200 g arepas de maiz", "150 g pollo cocido desmechado", "50 g queso campesino", "70 g aguacate", "40 g tomate", "8 g aceite"], equipment: ["Sarten con tapa", "cuchillo", "gramera"],
    steps: ["Abre las arepas por un borde sin partirlas por completo. Mezcla pollo con tomate picado.", "Rellena con pollo y queso. Calienta el aceite a fuego bajo y cocina las arepas tapadas 4 minutos por lado.", "Revisa que el queso este blando y el relleno caliente antes de retirar.", "Agrega aguacate en laminas justo antes de comer."], substitutions: ["Pollo por carne molida o atun", "Queso por cuajada", "Aguacate por 20 g mani"], storage: "Guarda el relleno hasta 3 dias y rellena las arepas al momento.", why: "Cena portable y facil de repetir con ingredientes comunes."
  },
  {
    meal: "Cena", cost: "Bajo", name: "Pasta con atun, huevo y maiz", calories: 820, protein_g: 45, prep_minutes: 20,
    ingredients: ["100 g pasta seca", "120 g atun escurrido", "2 huevos (100 g sin cascara)", "80 g maiz dulce", "10 g aceite", "60 g salsa de tomate"], equipment: ["Olla", "colador", "sarten", "gramera"],
    steps: ["Hierve la pasta en agua con sal 8 a 10 minutos; debe quedar suave sin romperse. Escurre.", "Calienta aceite y salsa de tomate 2 minutos. Agrega atun y maiz, mezcla hasta que todo este caliente.", "Bate los huevos y cocinalos en la sarten 2 minutos, sin dejar partes liquidas.", "Mezcla pasta, salsa y huevo; sirve caliente."], substitutions: ["Atun por pollo", "Maiz por arveja", "Pasta por arroz"], storage: "Dura 2 dias refrigerado. Recalienta con una cucharada de agua.", why: "Una cena de despensa que no exige ingredientes raros."
  },
  {
    meal: "Snack", cost: "Bajo", name: "Arepa dulce con queso y mani", calories: 610, protein_g: 22, prep_minutes: 10,
    ingredients: ["120 g arepa", "50 g queso campesino", "30 g mani", "20 g bocadillo", "250 ml leche entera"], equipment: ["Sarten", "cuchillo", "gramera"],
    steps: ["Pesa queso, mani y bocadillo. Corta el bocadillo en cubos pequenos.", "Asa la arepa en sarten a fuego medio-bajo 3 minutos por lado hasta que este caliente.", "Pon queso y bocadillo encima, tapa 1 minuto para que el queso se ablande.", "Sirve con mani y un vaso de leche."], substitutions: ["Bocadillo por banano", "Mani por avena", "Leche por yogur"], storage: "Consume recien hecho; el mani se guarda aparte.", why: "Snack barato para sumar energia entre comidas."
  },
  {
    meal: "Snack", cost: "Bajo", name: "Batido de kumis, avena y mango", calories: 680, protein_g: 24, prep_minutes: 5,
    ingredients: ["300 ml kumis natural", "80 g avena", "180 g mango pelado", "25 g mani", "10 g panela opcional"], equipment: ["Licuadora", "gramera"],
    steps: ["Pesa todos los ingredientes y corta el mango en cubos.", "Agrega kumis primero a la licuadora, luego avena, mango, mani y panela.", "Licua 60 segundos hasta que no se vean trozos de avena. Si queda espeso agrega 50 ml de agua.", "Sirve y toma de inmediato."], substitutions: ["Mango por banano o papaya", "Kumis por yogur y leche", "Mani por mantequilla de mani"], storage: "Tomalo recien hecho; no lo dejes a temperatura ambiente.", why: "Variante fresca para no aburrirte del batido de banano."
  },
];

const PLAN_DAYS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];

function defaultPlan(): NutritionMealPlanDay[] {
  const breakfasts = BASE_RECIPES.filter((recipe) => recipe.meal === "Desayuno");
  const lunches = BASE_RECIPES.filter((recipe) => recipe.meal === "Almuerzo");
  const dinners = BASE_RECIPES.filter((recipe) => recipe.meal === "Cena");
  const snacks = BASE_RECIPES.filter((recipe) => recipe.meal === "Snack");

  return PLAN_DAYS.map((day, index) => ({
    day,
    breakfast: breakfasts[index % breakfasts.length].name,
    lunch: lunches[index % lunches.length].name,
    dinner: dinners[index % dinners.length].name,
    snack: snacks[index % snacks.length].name,
  }));
}

function RecipePanel({ recipe }: { recipe: NutritionRecipe }) {
  const guide = "equipment" in recipe ? recipe as BaseRecipe : null;

  return <Card className="border-[#7C5DFF] bg-[#17171A]"><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="hud-label text-[#FFD700]">RECETA SELECCIONADA Â· 1 PORCION</p><CardTitle className="text-2xl text-white">{recipe.name}</CardTitle><CardDescription>{recipe.why}</CardDescription></div><div className="flex gap-3 font-mono text-sm"><span className="text-[#FFD700]"><Flame className="mr-1 inline h-4 w-4" />{recipe.calories} kcal</span><span className="text-[#bcaeff]"><Beef className="mr-1 inline h-4 w-4" />{recipe.protein_g} g</span><span className="text-muted-foreground"><Clock3 className="mr-1 inline h-4 w-4" />{recipe.prep_minutes} min</span></div></div></CardHeader><CardContent className="space-y-6"><div className="grid gap-5 md:grid-cols-2"><div><p className="mb-2 flex items-center gap-2 font-semibold text-white"><Scale className="h-4 w-4 text-[#FFD700]" /> Ingredientes: pesa esto</p><ul className="space-y-2 text-sm text-muted-foreground">{recipe.ingredients.map((item) => <li key={item}>- {item}</li>)}</ul></div><div><p className="mb-2 font-semibold text-white">Antes de empezar</p>{guide ? <><p className="text-sm text-muted-foreground">Utensilios: {guide.equipment.join(", ")}.</p><p className="mt-3 text-sm text-muted-foreground">Pesa y deja todos los ingredientes listos antes de encender la estufa.</p></> : <p className="text-sm text-muted-foreground">Lee todos los pasos, pesa los ingredientes y deja listos los utensilios antes de cocinar.</p>}</div></div><div><p className="mb-3 font-semibold text-white">Preparacion paso a paso</p><ol className="space-y-3 text-sm leading-6 text-muted-foreground">{recipe.steps.map((item, index) => <li key={`${index}-${item}`} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center border border-[#7C5DFF] font-mono text-xs text-[#bcaeff]">{index + 1}</span><span>{item}</span></li>)}</ol></div>{guide && <div className="grid gap-5 border-t border-[#2A2A3C] pt-5 md:grid-cols-2"><div><p className="mb-2 font-semibold text-white">Cambios baratos si te falta algo</p><ul className="space-y-2 text-sm text-muted-foreground">{guide.substitutions.map((item) => <li key={item}>- {item}</li>)}</ul></div><div><p className="mb-2 font-semibold text-white">Guardar y recalentar</p><p className="text-sm text-muted-foreground">{guide.storage}</p></div></div>}</CardContent></Card>;
}

interface AlimentacionClientProps {
  initialFavorites: NutritionFavorite[];
  initialWeeklyPlan: NutritionWeeklyPlan | null;
}

export function AlimentacionClient({ initialFavorites, initialWeeklyPlan }: AlimentacionClientProps) {
  const [meal, setMeal] = useState("Almuerzo");
  const [ingredients, setIngredients] = useState("");
  const [minutes, setMinutes] = useState("25");
  const [selected, setSelected] = useState<NutritionRecipe>(BASE_RECIPES[2]);
  const [favorites, setFavorites] = useState(initialFavorites);
  const [weeklyPlan, setWeeklyPlan] = useState<NutritionMealPlanDay[]>(initialWeeklyPlan?.days ?? defaultPlan());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();
  const [saving, startSaving] = useTransition();
  const visible = BASE_RECIPES.filter((recipe) => meal === "Todo" || recipe.meal === meal);
  const recipeNames = [...BASE_RECIPES.map((recipe) => recipe.name), ...favorites.map((favorite) => favorite.recipe.name)];

  function generate() {
    setError("");
    setNotice("");
    startTransition(async () => {
      try {
        setSelected((await generateRecipe({ meal, ingredients, minutes: Number(minutes) || 25 })).recipe);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudo generar la receta.");
      }
    });
  }

  function saveFavorite() {
    if (favorites.some((favorite) => favorite.recipe.name === selected.name)) {
      setNotice("Esta receta ya esta en tus guardadas.");
      return;
    }
    startSaving(async () => {
      try {
        const favorite = await saveNutritionFavorite(selected);
        setFavorites((current) => [favorite, ...current]);
        setNotice("Receta guardada para repetirla cuando quieras.");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudo guardar la receta.");
      }
    });
  }

  function removeFavorite(id: string) {
    startSaving(async () => {
      try {
        await deleteNutritionFavorite(id);
        setFavorites((current) => current.filter((favorite) => favorite.id !== id));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudo eliminar la receta.");
      }
    });
  }

  function updatePlan(dayIndex: number, field: keyof Omit<NutritionMealPlanDay, "day">, value: string) {
    setWeeklyPlan((current) => current.map((day, index) => index === dayIndex ? { ...day, [field]: value } : day));
  }

  function savePlan() {
    startSaving(async () => {
      try {
        await saveNutritionWeeklyPlan(weeklyPlan);
        setNotice("Plan semanal guardado. Puedes cambiarlo cuando cambien tus turnos o tu mercado.");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudo guardar el plan semanal.");
      }
    });
  }

  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 pb-8">
    <Card className="border-[#2A2A3C] bg-[#17171A]"><CardHeader><p className="hud-label text-[#bcaeff]">COMBUSTIBLE PARA GANAR MASA</p><CardTitle className="flex items-center gap-2 text-3xl text-white"><ChefHat className="h-7 w-7 text-[#FFD700]" /> Alimentacion economica</CardTitle><CardDescription>Comidas de mercado colombiano, con porciones en gramos para que uses gramera. Calorias y proteina son aproximadas; ajusta con un profesional si tienes una condicion medica.</CardDescription></CardHeader></Card>
    <Card className="border-[#2A2A3C] bg-[#17171A]"><CardContent className="space-y-4 p-5"><div className="flex flex-wrap gap-2">{["Todo", "Desayuno", "Almuerzo", "Cena", "Snack"].map((option) => <Button key={option} size="sm" variant={meal === option ? "default" : "outline"} onClick={() => setMeal(option)} className={meal === option ? "bg-[#7C5DFF]" : ""}>{option}</Button>)}</div><div className="grid gap-3 md:grid-cols-[2fr_100px_auto]"><Input value={ingredients} onChange={(event) => setIngredients(event.target.value)} placeholder="Que tienes? Ej. arroz, pollo, huevos, lentejas" className="border-[#2A2A3C] bg-[#0C0C0E] text-white" /><Input type="number" min="10" max="90" value={minutes} onChange={(event) => setMinutes(event.target.value)} className="border-[#2A2A3C] bg-[#0C0C0E] text-white" /><Button disabled={pending} onClick={generate} className="bg-[#7C5DFF]">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="mr-2 h-4 w-4" /> Adaptar receta</>}</Button></div><p className="text-xs text-muted-foreground">La IA crea una variacion con ingredientes colombianos y porciones en gramos; las recetas base estan disponibles de inmediato.</p></CardContent></Card>
    {error && <p className="border border-red-500/30 p-3 text-sm text-red-400">{error}</p>}
    {notice && <p className="border border-[#7C5DFF] bg-[#7C5DFF]/10 p-3 text-sm text-[#d8ccff]">{notice}</p>}
    <RecipePanel recipe={selected} />
    <div className="flex justify-end"><Button variant="outline" disabled={saving} onClick={saveFavorite} className="border-[#7C5DFF] text-[#d8ccff]"><BookmarkPlus className="mr-2 h-4 w-4" />{saving ? "Guardando..." : "Guardar en mis recetas"}</Button></div>
    <section><div className="mb-3 flex items-end justify-between"><div><p className="hud-label text-[#bcaeff]">RECETAS BASE</p><h2 className="text-xl font-semibold text-white">Baratas, pesables y repetibles</h2></div><span className="text-xs text-muted-foreground">Selecciona una para ver cantidades</span></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{visible.map((recipe) => <button key={recipe.name} onClick={() => setSelected(recipe)} className={`border p-4 text-left transition-colors ${selected.name === recipe.name ? "border-[#7C5DFF] bg-[#7C5DFF]/10" : "border-[#2A2A3C] bg-[#17171A] hover:border-[#7C5DFF]/60"}`}><div className="flex justify-between gap-2"><span className="hud-label text-[#FFD700]">{recipe.meal} Â· {recipe.cost}</span><span className="font-mono text-xs text-[#bcaeff]">{recipe.calories} kcal</span></div><p className="mt-2 font-semibold text-white">{recipe.name}</p><p className="mt-1 text-xs text-muted-foreground">{recipe.protein_g} g proteina Â· {recipe.prep_minutes} min</p></button>)}</div></section>
    <section className="border-t border-[#2A2A3C] pt-5">
      <div className="mb-3"><p className="hud-label text-[#bcaeff]">TU BIBLIOTECA</p><h2 className="text-xl font-semibold text-white">Recetas guardadas</h2></div>
      {favorites.length === 0 ? <p className="border border-dashed border-[#2A2A3C] p-4 text-sm text-muted-foreground">Guarda una receta base o una creada por IA para construir tu propio recetario.</p> : <div className="grid gap-3 md:grid-cols-2">{favorites.map((favorite) => <div key={favorite.id} className="flex items-center justify-between gap-3 border border-[#2A2A3C] bg-[#17171A] p-4"><button onClick={() => setSelected(favorite.recipe)} className="min-w-0 text-left"><p className="truncate font-semibold text-white">{favorite.name}</p><p className="mt-1 text-xs text-muted-foreground">{favorite.recipe.calories} kcal - {favorite.recipe.protein_g} g proteina</p></button><Button aria-label={`Eliminar ${favorite.name}`} size="icon" variant="ghost" disabled={saving} onClick={() => removeFavorite(favorite.id)} className="text-muted-foreground hover:text-red-400"><Trash2 className="h-4 w-4" /></Button></div>)}</div>}
    </section>
    <section className="border-t border-[#2A2A3C] pt-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="hud-label text-[#bcaeff]">PLAN SEMANAL</p><h2 className="flex items-center gap-2 text-xl font-semibold text-white"><CalendarDays className="h-5 w-5 text-[#FFD700]" /> Mercado y comidas sin improvisar</h2><p className="mt-1 text-sm text-muted-foreground">Organiza cuatro momentos del dia. Cambia cualquier opcion segun tu turno, presupuesto o ingredientes.</p></div><Button disabled={saving} onClick={savePlan} className="bg-[#7C5DFF]">{saving ? "Guardando..." : "Guardar semana"}</Button></div>
      <div className="grid gap-3 lg:grid-cols-2">{weeklyPlan.map((day, index) => <Card key={day.day} className="border-[#2A2A3C] bg-[#17171A]"><CardContent className="space-y-3 p-4"><p className="font-semibold text-white">{day.day}</p>{([ ["breakfast", "Desayuno"], ["lunch", "Almuerzo"], ["dinner", "Cena"], ["snack", "Snack"] ] as const).map(([field, label]) => <label key={field} className="grid grid-cols-[78px_1fr] items-center gap-2 text-xs text-muted-foreground"><span>{label}</span><select value={day[field]} onChange={(event) => updatePlan(index, field, event.target.value)} className="h-9 min-w-0 border border-[#2A2A3C] bg-[#0C0C0E] px-2 text-sm text-white"><option value="">Sin definir</option>{recipeNames.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>)}</CardContent></Card>)}</div>
    </section>
  </div>;
}
