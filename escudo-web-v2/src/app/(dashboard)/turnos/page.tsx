import { ModulePlaceholder } from "@/components/dashboard/ModulePlaceholder";

export const metadata = {
  title: "Turnos — El Escudo",
};

export default function TurnosPage() {
  return (
    <ModulePlaceholder
      title="Turnos"
      description="Gestión de horarios, jornadas y disponibilidad."
      features={[
        "Calendario de turnos",
        "Registro de horas",
        "Alertas de superposición",
        "Resumen semanal",
      ]}
    />
  );
}
