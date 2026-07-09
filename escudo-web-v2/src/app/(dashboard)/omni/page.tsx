import { ModulePlaceholder } from "@/components/dashboard/ModulePlaceholder";

export const metadata = {
  title: "OMNI — El Escudo",
};

export default function OmniPage() {
  return (
    <ModulePlaceholder
      title="OMNI"
      description="Asistente inteligente de comando para El Escudo."
      features={[
        "Chat con contexto del usuario",
        "Comandos de voz / texto",
        "Recomendaciones de metas y hábitos",
        "Consultas de finanzas y salud",
      ]}
    />
  );
}
