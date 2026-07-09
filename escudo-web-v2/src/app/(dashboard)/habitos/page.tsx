import { ModulePlaceholder } from "@/components/dashboard/ModulePlaceholder";

export const metadata = {
  title: "Hábitos — El Escudo",
};

export default function HabitosPage() {
  return (
    <ModulePlaceholder
      title="Hábitos"
      description="Construcción de rutinas positivas y seguimiento de rachas."
      features={[
        "Lista de hábitos diarios",
        "Rachas y calendario",
        "Recordatorios",
        "Recompensas por constancia",
      ]}
    />
  );
}
