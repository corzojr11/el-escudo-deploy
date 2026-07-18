import { getNutritionFavorites, getNutritionWeeklyPlan } from "@/app/actions/nutrition";
import { getPlanDiario } from "@/app/actions/plan";
import { getPersonalEntries } from "@/app/actions/personal";
import { AlimentacionClient } from "./alimentacion-client";

export const metadata = { title: "Alimentación - El Escudo" };

export default async function AlimentacionPage() {
  const [favorites, weeklyPlan, dailyPlan, entries] = await Promise.allSettled([
    getNutritionFavorites(),
    getNutritionWeeklyPlan(),
    getPlanDiario(),
    getPersonalEntries(),
  ]);

  return (
    <AlimentacionClient
      initialFavorites={favorites.status === "fulfilled" ? favorites.value : []}
      initialWeeklyPlan={weeklyPlan.status === "fulfilled" ? weeklyPlan.value : null}
      dailyPlan={dailyPlan.status === "fulfilled" ? dailyPlan.value : null}
      initialEntries={entries.status === "fulfilled" ? entries.value : []}
    />
  );
}
