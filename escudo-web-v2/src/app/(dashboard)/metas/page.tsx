import { ModulePlaceholder } from "@/components/dashboard/ModulePlaceholder";

export const metadata = {
  title: "Metas — El Escudo",
};

export default function MetasPage() {
  return (
    <ModulePlaceholder
      title="Metas"
      description="Definición y seguimiento de objetivos personales."
      features={[
        "Metas SMART",
        "Seguimiento de progreso",
        "Recordatorios y hitos",
        "Recompensas XP",
      ]}
    />
  );
}
