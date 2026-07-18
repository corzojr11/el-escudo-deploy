import type { ParsedTransaction } from "@/lib/api/types";

function parseCopAmount(raw: string): number {
  const value = raw.trim().toLowerCase().replace(/\s/g, "");
  const multiplier = /(?:k|mil)$/.test(value) ? 1_000 : 1;
  const numeric = value.replace(/(?:k|mil)$/, "");

  if (!numeric) return 0;

  let normalized = numeric;
  if (numeric.includes(".") && numeric.includes(",")) {
    // En Colombia, 12.500,50 representa doce mil quinientos pesos con 50 centavos.
    normalized = numeric.replace(/\./g, "").replace(",", ".");
  } else if (numeric.includes(".")) {
    const groups = numeric.split(".");
    normalized = groups.slice(1).every((group) => group.length === 3)
      ? groups.join("")
      : numeric;
  } else if (numeric.includes(",")) {
    const groups = numeric.split(",");
    const decimal = groups.at(-1);
    normalized = decimal && decimal.length <= 2
      ? `${groups.slice(0, -1).join("")}.${decimal}`
      : groups.join("");
  }

  return (Number.parseFloat(normalized) || 0) * multiplier;
}

/** Convierte una frase cotidiana en un borrador local; nunca registra un movimiento. */
export function parseFinanceTextLocally(text: string): ParsedTransaction {
  const lower = text.toLowerCase().trim();
  const type = /\b(ingreso|sueldo|abono|pago recibido|transferencia|devolucion|salario)\b/.test(lower)
    ? "INGRESO"
    : "GASTO";
  const amountMatch = text.match(/(?:\$|COP\s*)?(\d[\d.,]*(?:\s*(?:k|mil))?)/i);
  const amount = amountMatch ? parseCopAmount(amountMatch[1]) : 0;

  if (amount <= 0) {
    return {
      fallback_mode: "manual_review_required",
      type: "GASTO",
      amount: 0,
      description: text.slice(0, 80) || "Gasto",
      category: "General",
    };
  }

  let description = text
    .replace(amountMatch?.[0] || "", "")
    .replace(/\$|COP/gi, "")
    .trim()
    .slice(0, 80);
  if (!description) description = type === "INGRESO" ? "Ingreso" : "Gasto";

  const categories: Record<string, string[]> = {
    Comida: ["comida", "almuerzo", "mercado", "restaurante", "supermercado", "cena"],
    Transporte: ["transporte", "gasolina", "uber", "taxi", "bus", "pasaje"],
    Servicios: ["luz", "agua", "gas", "internet", "telefono", "servicio", "factura", "arriendo"],
    Entretenimiento: ["cine", "netflix", "spotify", "juego", "suscripcion"],
    Sueldo: ["sueldo", "salario", "nomina", "pago"],
    Compras: ["ropa", "zapatos", "compra", "amazon"],
  };
  const category = Object.entries(categories).find(([, keywords]) =>
    keywords.some((keyword) => lower.includes(keyword))
  )?.[0] ?? "General";

  return { type, amount, description, category };
}
