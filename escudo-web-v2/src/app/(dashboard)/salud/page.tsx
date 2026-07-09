import { ModulePlaceholder } from "@/components/dashboard/ModulePlaceholder";

export const metadata = {
  title: "Salud — El Escudo",
};

export default function SaludPage() {
  return (
    <ModulePlaceholder
      title="Salud"
      description="Seguimiento de peso, ejercicio y hábitos de bienestar."
      features={[
        "Registro de peso",
        "Historial de ejercicio",
        "Indicadores de bienestar",
        "Consejos personalizados",
      ]}
    />
  );
}
