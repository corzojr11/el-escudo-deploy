import { getHabits } from "@/app/actions/habits";
import { HabitosClient } from "./habitos-client";

export const metadata = {
  title: "Hábitos — El Escudo",
};

export default async function HabitosPage() {
  const habits = await getHabits();
  return <HabitosClient habits={habits} />;
}
