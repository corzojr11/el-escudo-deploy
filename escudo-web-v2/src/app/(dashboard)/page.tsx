import { getTodayData } from "@/app/actions/dashboard";
import { getPlanDiario } from "@/app/actions/plan";
import { getNutritionWeeklyPlan } from "@/app/actions/nutrition";
import { getRoutines } from "@/app/actions/routines";
import { getTodayRoutineCompletions, getWellnessSummary } from "@/app/actions/wellness";
import { DashboardClient, type DashboardStabilityData } from "./dashboard-client";

export const metadata = {
  title: "Bitácora de viaje - El Escudo",
};

export default async function DashboardPage() {
  const data = await getTodayData();
  const [planR, wellnessR, routinesR, completionsR, nutritionPlanR] = await Promise.allSettled([
    getPlanDiario(),
    getWellnessSummary(),
    getRoutines(),
    getTodayRoutineCompletions(),
    getNutritionWeeklyPlan(),
  ]);
  const todayDayIndex = (new Date(`${data.today.date}T12:00:00Z`).getUTCDay() + 6) % 7;
  const routines = routinesR.status === "fulfilled" ? routinesR.value : [];
  const completedDays = completionsR.status === "fulfilled" ? completionsR.value : [];
  const nutritionPlan = nutritionPlanR.status === "fulfilled" ? nutritionPlanR.value : null;
  const stability: DashboardStabilityData = {
    budget: data.today.financial_stability?.monthly_budget ?? null,
    monthExpense: data.today.financial_stability?.month_expense ?? null,
    fixedExpenses: data.today.financial_stability?.fixed_expenses ?? [],
    debts: data.today.financial_stability?.debts ?? [],
  };

  return (
    <DashboardClient
      data={data}
      plan={planR.status === "fulfilled" ? planR.value : null}
      wellness={wellnessR.status === "fulfilled" ? wellnessR.value : null}
      stability={stability}
      todayRoutine={routines.find((routine) => routine.day_index === todayDayIndex) ?? null}
      routineCompleted={completedDays.includes(todayDayIndex)}
      todayMeals={nutritionPlan?.days[todayDayIndex] ?? null}
    />
  );
}
