"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Input,
} from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  Plus,
} from "lucide-react";
import { createFinance } from "@/app/actions/finances";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { SubmitButton } from "@/components/dashboard/SubmitButton";
import { FormStatus } from "@/components/dashboard/FormStatus";
import { formatCurrency, formatDate } from "@/lib/api/helpers";
import type { FinanceEntry, FinanceSummaryItem } from "@/lib/api/types";

interface FinanzasClientProps {
  transactions: FinanceEntry[];
  summary: FinanceSummaryItem[];
}

export function FinanzasClient({
  transactions,
  summary,
}: FinanzasClientProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<{ success?: string; error?: string }>({});
  const [, startTransition] = useTransition();

  const { income, expense } = useMemo(() => {
    return transactions.reduce(
      (acc, tx) => {
        if (tx.type === "income") acc.income += tx.amount ?? 0;
        else acc.expense += tx.amount ?? 0;
        return acc;
      },
      { income: 0, expense: 0 }
    );
  }, [transactions]);

  const balanceCalculated = income - expense;

  const incomeCategories = summary.filter((s) =>
    s.category.startsWith("INGRESO:")
  );
  const expenseCategories = summary.filter(
    (s) => !s.category.startsWith("INGRESO:")
  );

  async function handleSubmit(formData: FormData) {
    setStatus({});
    startTransition(async () => {
      const result = await createFinance(null, formData);
      if (result.success) {
        setStatus({ success: "Movimiento registrado correctamente." });
        formRef.current?.reset();
        router.refresh();
      } else {
        setStatus({ error: result.error ?? "Error al registrar" });
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Finanzas</h2>
        <p className="text-sm text-muted-foreground">
          Resumen de tus ingresos y gastos registrados.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-escudo-green">
              <ArrowDownCircle className="h-4 w-4" /> Ingresos
            </CardDescription>
            <CardTitle className="text-2xl text-escudo-green">
              {formatCurrency(income)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-escudo-red">
              <ArrowUpCircle className="h-4 w-4" /> Gastos
            </CardDescription>
            <CardTitle className="text-2xl text-escudo-red">
              {formatCurrency(expense)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-escudo-gold">
              <Wallet className="h-4 w-4" /> Balance
            </CardDescription>
            <CardTitle
              className={`text-2xl ${balanceCalculated >= 0 ? "text-escudo-green" : "text-escudo-red"}`}
            >
              {formatCurrency(balanceCalculated)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Formulario nuevo movimiento */}
        <Card className="border-border bg-card lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-5 w-5 text-escudo-gold" /> Nuevo movimiento
            </CardTitle>
            <CardDescription>Registra un ingreso o gasto</CardDescription>
          </CardHeader>
          <CardContent>
            <form ref={formRef} action={handleSubmit} className="flex flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Input
                  id="description"
                  name="description"
                  placeholder="Ej. Mercado"
                  required
                  className="border-input bg-secondary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Monto</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0"
                  required
                  className="border-input bg-secondary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoría</Label>
                <Input
                  id="category"
                  name="category"
                  placeholder="Ej. Alimentación"
                  defaultValue="General"
                  required
                  className="border-input bg-secondary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Tipo</Label>
                <select
                  id="type"
                  name="type"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="GASTO">Gasto</option>
                  <option value="INGRESO">Ingreso</option>
                </select>
              </div>
              <FormStatus {...status} />
              <SubmitButton className="w-full bg-escudo-gold text-primary-foreground hover:bg-escudo-gold/90">
                Registrar
              </SubmitButton>
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Resumen por categoría */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-5 w-5 text-escudo-cyan" /> Por categoría
              </CardTitle>
              <CardDescription>Distribución de ingresos y gastos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {expenseCategories.length === 0 && incomeCategories.length === 0 ? (
                <EmptyState
                  title="Sin categorías"
                  message="No hay datos agrupados por categoría."
                />
              ) : (
                <>
                  {expenseCategories.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-escudo-red">Gastos</h4>
                      {expenseCategories.map((item) => (
                        <div key={item.category} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-foreground">{item.category}</span>
                            <span className="font-medium text-escudo-red">
                              {formatCurrency(item.total)}
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                            <div
                              className="h-full rounded-full bg-escudo-red"
                              style={{
                                width: `${expense > 0 ? Math.min((item.total / expense) * 100, 100) : 0}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {incomeCategories.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-escudo-green">Ingresos</h4>
                      {incomeCategories.map((item) => {
                        const label = item.category.replace("INGRESO:", "");
                        return (
                          <div key={item.category} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-foreground">{label}</span>
                              <span className="font-medium text-escudo-green">
                                {formatCurrency(item.total)}
                              </span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                              <div
                                className="h-full rounded-full bg-escudo-green"
                                style={{
                                  width: `${income > 0 ? Math.min((item.total / income) * 100, 100) : 0}%`,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Movimientos recientes */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="h-5 w-5 text-escudo-gold" /> Movimientos recientes
              </CardTitle>
              <CardDescription>Últimas transacciones registradas</CardDescription>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <EmptyState
                  title="Sin movimientos"
                  message="No se encontraron transacciones individuales."
                />
              ) : (
                <div className="flex flex-col gap-3">
                  {transactions
                    .slice()
                    .sort(
                      (a, b) =>
                        new Date(b.date ?? b.created_at ?? 0).getTime() -
                        new Date(a.date ?? a.created_at ?? 0).getTime()
                    )
                    .slice(0, 10)
                    .map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between rounded-md border border-border p-3"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium text-foreground">
                            {tx.description || tx.category || "Sin descripción"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {tx.category} · {formatDate(tx.date ?? tx.created_at)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={
                              tx.type === "income"
                                ? "border-escudo-green/30 text-escudo-green"
                                : "border-escudo-red/30 text-escudo-red"
                            }
                          >
                            {tx.type === "income" ? "Ingreso" : "Gasto"}
                          </Badge>
                          <span
                            className={`text-sm font-semibold ${
                              tx.type === "income" ? "text-escudo-green" : "text-escudo-red"
                            }`}
                          >
                            {tx.type === "income" ? "+" : "-"}
                            {formatCurrency(tx.amount ?? 0)}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
