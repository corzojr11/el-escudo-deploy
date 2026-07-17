"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet, ArrowDownCircle, ArrowUpCircle, TrendingUp, Plus, Pencil, Trash2, Loader2, Calendar } from "lucide-react";
import { createFinance, updateFinance, deleteFinance, getFinances, getFinanceSummary } from "@/app/actions/finances";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { SubmitButton } from "@/components/dashboard/SubmitButton";
import { FormStatus } from "@/components/dashboard/FormStatus";
import { formatCurrency, formatDate } from "@/lib/api/helpers";
import type { FinanceEntry, FinanceSummaryItem, FinanceRange } from "@/lib/api/types";

interface FinanzasClientProps {
  transactions: FinanceEntry[];
  summary: FinanceSummaryItem[];
  initialRange: FinanceRange;
  totals: { income: number; expense: number; balance: number };
}

const RANGE_LABELS: Record<FinanceRange, string> = {
  all: "Todo",
  today: "Hoy",
  week: "Semana",
  month: "Mes",
};

export function FinanzasClient({ transactions, summary, initialRange, totals }: FinanzasClientProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<{ success?: string; error?: string }>({});
  const [, startTransition] = useTransition();

  const [range, setRange] = useState<FinanceRange>(initialRange);
  const [items, setItems] = useState<FinanceEntry[]>(transactions);
  const [currentSummary, setCurrentSummary] = useState<FinanceSummaryItem[]>(summary);
  const [currentTotals, setCurrentTotals] = useState(totals);
  const [loadingRange, setLoadingRange] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  async function loadRange(nextRange: FinanceRange) {
    setLoadingRange(true);
    setRange(nextRange);
    try {
      const [newItems, newSummary] = await Promise.all([getFinances(nextRange), getFinanceSummary(nextRange)]);
      setItems(newItems);
      setCurrentSummary(newSummary.summary ?? []);
      setCurrentTotals({
        income: newSummary.total_income ?? 0,
        expense: newSummary.total_expense ?? 0,
        balance: newSummary.balance ?? 0,
      });
    } catch (err) {
      setStatus({ error: err instanceof Error ? err.message : "Error al cargar movimientos" });
    } finally {
      setLoadingRange(false);
    }
  }

  async function handleSubmit(formData: FormData) {
    setStatus({});
    startTransition(async () => {
      const result = await createFinance(null, formData);
      if (result.success) {
        setStatus({ success: "Movimiento registrado correctamente." });
        formRef.current?.reset();
        await loadRange(range);
        router.refresh();
      } else {
        setStatus({ error: result.error ?? "Error al registrar" });
      }
    });
  }

  async function handleUpdate(financeId: string, formData: FormData) {
    setStatus({});
    startTransition(async () => {
      const result = await updateFinance(financeId, formData);
      if (result.success) {
        setStatus({ success: "Movimiento actualizado correctamente." });
        setEditingId(null);
        await loadRange(range);
        router.refresh();
      } else {
        setStatus({ error: result.error ?? "Error al actualizar" });
      }
    });
  }

  async function handleDelete(financeId: string) {
    if (!window.confirm("Eliminar este movimiento?")) return;
    setDeletingId(financeId);
    setStatus({});
    const result = await deleteFinance(financeId);
    setDeletingId(null);
    if (result.success) {
      setStatus({ success: "Movimiento eliminado correctamente." });
      await loadRange(range);
      router.refresh();
    } else {
      setStatus({ error: result.error ?? "Error al eliminar" });
    }
  }

  const { income, expense, balance } = currentTotals;
  const incomeCategories = currentSummary.filter((s) => s.category.startsWith("INGRESO:"));
  const expenseCategories = currentSummary.filter((s) => !s.category.startsWith("INGRESO:"));

  const sortedItems = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          new Date(b.date ?? b.created_at ?? 0).getTime() - new Date(a.date ?? a.created_at ?? 0).getTime()
      ),
    [items]
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="panel-neon relative overflow-hidden rounded-[28px] p-6">
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
            <CardTitle className={`text-2xl ${balance >= 0 ? "text-escudo-green" : "text-escudo-red"}`}>
              {formatCurrency(balance)}
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
              <div className="space-y-2">
                <Label htmlFor="date">Fecha</Label>
                <Input id="date" name="date" type="date" defaultValue={todayStr} required />
              </div>
              <FormStatus {...status} />
              <SubmitButton className="w-full">Registrar</SubmitButton>
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="hud-label text-accent">Heatmap</span>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="h-5 w-5 text-escudo-cyan" /> Por categoria
                  </CardTitle>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(RANGE_LABELS) as FinanceRange[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => loadRange(r)}
                      disabled={loadingRange}
                      className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                        range === r
                          ? "bg-accent text-white"
                          : "bg-secondary text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {RANGE_LABELS[r]}
                    </button>
                  ))}
                </div>
              </div>
              <CardDescription>Distribucion de ingresos y gastos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {expenseCategories.length === 0 && incomeCategories.length === 0 ? (
                <EmptyState title="Sin categorias" message="No hay datos agrupados por categoria en este rango." />
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
                              className="h-full rounded-full bg-escudo-red"
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
                                className="h-full rounded-full bg-escudo-green"
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
                <Wallet className="h-5 w-5 text-escudo-gold" /> Movimientos
              </CardTitle>
              <CardDescription>Transacciones del rango seleccionado</CardDescription>
            </CardHeader>
            <CardContent>
              {sortedItems.length === 0 ? (
                <EmptyState title="Sin movimientos" message="No se encontraron transacciones en este rango." />
              ) : (
                <div className="flex flex-col gap-3">
                  {sortedItems.map((tx) => {
                    const isEditing = editingId === tx.id;
                    return (
                      <div
                        key={tx.id}
                        className="rounded-xl border border-border/70 bg-background/35 px-4 py-3 transition-colors hover:border-accent/35"
                      >
                        {isEditing ? (
                          <form
                            action={(formData) => handleUpdate(tx.id, formData)}
                            className="flex flex-col gap-3"
                          >
                            <div className="grid gap-3 sm:grid-cols-2">
                              <Input name="description" defaultValue={tx.description || tx.category} required />
                              <Input name="amount" type="number" step="0.01" min="0.01" defaultValue={tx.amount} required />
                              <Input name="category" defaultValue={tx.category} required />
                              <select
                                name="type"
                                defaultValue={tx.type === "income" ? "INGRESO" : "GASTO"}
                                className="h-10 rounded-xl border border-border/80 bg-input/80 px-3 text-sm"
                              >
                                <option value="GASTO">Gasto</option>
                                <option value="INGRESO">Ingreso</option>
                              </select>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <Input name="date" type="date" defaultValue={tx.date?.slice(0, 10)} required />
                            </div>
                            <div className="flex gap-2">
                              <SubmitButton>Guardar</SubmitButton>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                              >
                                Cancelar
                              </button>
                            </div>
                          </form>
                        ) : (
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
                              <button
                                type="button"
                                onClick={() => setEditingId(tx.id)}
                                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent/10 hover:text-accent"
                                title="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(tx.id)}
                                disabled={deletingId === tx.id}
                                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-escudo-red/10 hover:text-escudo-red"
                                title="Eliminar"
                              >
                                {deletingId === tx.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
