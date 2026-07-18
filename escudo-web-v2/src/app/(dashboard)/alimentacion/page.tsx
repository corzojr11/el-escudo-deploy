import { getNutritionFavorites, getNutritionWeeklyPlan } from "@/app/actions/nutrition";
import { AlimentacionClient } from "./alimentacion-client";

export const metadata = { title: "Alimentacion - El Escudo" };

export default async function AlimentacionPage() {
  const [favorites, weeklyPlan] = await Promise.allSettled([
    getNutritionFavorites(),
    getNutritionWeeklyPlan(),
  ]);

  return (
    <AlimentacionClient
      initialFavorites={favorites.status === "fulfilled" ? favorites.value : []}
      initialWeeklyPlan={weeklyPlan.status === "fulfilled" ? weeklyPlan.value : null}
    />
  );
}
