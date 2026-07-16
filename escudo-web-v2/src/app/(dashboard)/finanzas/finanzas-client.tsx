"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet, ArrowDownCircle, ArrowUpCircle, TrendingUp, Plus } from "lucide-react";
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

export function FinanzasClient({ transactions, summary }: FinanzasClientProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<{ success?: string; error?: string }>({});
  const [, startTransition] = useTransition();

  const { income, expense } = useMemo(
    () =>
      transactions.reduce(
        (acc, tx) => {
          if (tx.type === "income") acc.income += tx.amount ?? 0;
          else acc.expense += tx.amount ?? 0;
          return acc;
        },
        { income: 0, expense: 0 }
      ),
    [transactions]
  );

  const balanceCalculated = income - expense;
  const incomeCategories = summary.filter((s) => s.category.startsWith("INGRESO:"));
  const expenseCategories = summary.filter((s) => !s.category.startsWith("INGRESO:"));

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
      <section className="panel-neon relative overflow-hidden rounded-[28px] p-6">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,rgba(255,209,102,0.14),transparent_62%)]" />
        <div className="relative flex flex-col gap-3">
          <span className="hud-label text-escudo-gold">Financial Grid</span>
          <h2 className="font-heading text-3xl font-black tracking-[0.1em] text-glow text-foreground md:text-4xl">
            FINANZAS
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
            Monitorea flujo, categorias y ultimos movimientos desde un panel tactico.
          </p>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-escudo-green">
              <ArrowDownCircle className="h-4 w-4" /> Ingresos
            </CardDescription>
            <CardTitle className="text-2xl text-escudo-green">{formatCurrency(income)}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-escudo-red">
              <ArrowUpCircle className="h-4 w-4" /> Gastos
            </CardDescription>
            <CardTitle className="text-2xl text-escudo-red">{formatCurrency(expense)}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-escudo-gold">
              <Wallet className="h-4 w-4" /> Balance neto
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
        <Card className="lg:col-span-1">
          <CardHeader>
            <span className="hud-label text-accent">New Entry</span>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-5 w-5 text-escudo-gold" /> Nuevo movimiento
            </CardTitle>
            <CardDescription>Registra ingreso o gasto en segundos</CardDescription>
          </CardHeader>
          <CardContent>
            <form ref={formRef} action={handleSubmit} className="flex flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="description">Descripcion</Label>
                <Input id="description" name="description" placeholder="Ej. Mercado" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Monto</Label>
                <Input id="amount" name="amount" type="number" step="0.01" min="0.01" placeholder="0" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Input id="category" name="category" placeholder="Ej. Alimentacion" defaultValue="General" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Tipo</Label>
                <select
                  id="type"
                  name="type"
                  required
                  className="h-11 w-full rounded-xl border border-border/80 bg-input/80 px-3 py-2 text-sm text-foreground outline-none transition-all focus-visible:border-accent/60 focus-visible:ring-3 focus-visible:ring-accent/20"
                >
                  <option value="GASTO">Gasto</option>
                  <option value="INGRESO">Ingreso</option>
                </select>
              </div>
              <FormStatus {...status} />
              <SubmitButton className="w-full">Registrar</SubmitButton>
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <span className="hud-label text-accent">Heatmap</span>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-5 w-5 text-escudo-cyan" /> Por categoria
              </CardTitle>
              <CardDescription>Distribucion de ingresos y gastos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {expenseCategories.length === 0 && incomeCategories.length === 0 ? (
                <EmptyState title="Sin categorias" message="No hay datos agrupados por categoria." />
              ) : (
                <>
                  {expenseCategories.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="hud-label text-escudo-red">Gastos</h4>
                      {expenseCategories.map((item) => (
                        <div key={item.category} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-foreground">{item.category}</span>
                            <span className="font-medium text-escudo-red">{formatCurrency(item.total)}</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                            <div
                              className="h-full rounded-full bg-escudo-red shadow-[0_0_16px_rgba(255,77,141,0.4)]"
                              style={{ width: `${expense > 0 ? Math.min((item.total / expense) * 100, 100) : 0}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {incomeCategories.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="hud-label text-escudo-green">Ingresos</h4>
                      {incomeCategories.map((item) => {
                        const label = item.category.replace("INGRESO:", "");
                        return (
                          <div key={item.category} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-foreground">{label}</span>
                              <span className="font-medium text-escudo-green">{formatCurrency(item.total)}</span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                              <div
                                className="h-full rounded-full bg-escudo-green shadow-[0_0_16px_rgba(42,245,152,0.4)]"
                                style={{ width: `${income > 0 ? Math.min((item.total / income) * 100, 100) : 0}%` }}
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

          <Card>
            <CardHeader>
              <span className="hud-label text-accent">Recent Log</span>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="h-5 w-5 text-escudo-gold" /> Movimientos recientes
              </CardTitle>
              <CardDescription>Ultimas transacciones registradas</CardDescription>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <EmptyState title="Sin movimientos" message="No se encontraron transacciones individuales." />
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
                        className="rounded-xl border border-border/70 bg-background/35 px-4 py-3 transition-colors hover:border-accent/35"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-medium text-foreground">
                              {tx.description || tx.category || "Sin descripcion"}
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
                                  ? "border-escudo-green/30 bg-escudo-green/10 text-escudo-green"
                                  : "border-escudo-red/30 bg-escudo-red/10 text-escudo-red"
                              }
                            >
                              {tx.type === "income" ? "Ingreso" : "Gasto"}
                            </Badge>
                            <span
                              className={`text-sm font-semibold ${tx.type === "income" ? "text-escudo-green" : "text-escudo-red"}`}
                            >
                              {tx.type === "income" ? "+" : "-"}
                              {formatCurrency(tx.amount ?? 0)}
                            </span>
                          </div>
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
