import { ModulePlaceholder } from "@/components/dashboard/ModulePlaceholder";

export const metadata = {
  title: "Finanzas — El Escudo",
};

export default function FinanzasPage() {
  return (
    <ModulePlaceholder
      title="Finanzas"
      description="Control de ingresos, gastos y resumen financiero."
      features={[
        "Registro de ingresos y gastos",
        "Categorización y etiquetas",
        "Balance diario / mensual",
        "Exportación de reportes",
      ]}
    />
  );
}
