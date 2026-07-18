"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Calendar,
  PiggyBank,
  Repeat,
  CreditCard,
  ScanLine,
  Sparkles,
  CheckCircle2,
  X,
  ChevronDown,
  Receipt,
  Wand2,
  CircleAlert,
} from "lucide-react";
import {
  createFinance,
  updateFinance,
  deleteFinance,
  getFinances,
  getFinanceSummary,
  parseFinanceText,
  uploadReceipt,
  getBudget,
  setBudget,
  getFixedExpenses,
  createFixedExpense,
  updateFixedExpense,
  deleteFixedExpense,
  getDebts,
  createDebt,
  updateDebt,
  deleteDebt,
  recordDebtPayment,
  getDebtPayments,
} from "@/app/actions/finances";
import { createPersonalEntry, updatePersonalEntry } from "@/app/actions/personal";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { ErrorState } from "@/components/dashboard/ErrorState";
import { SubmitButton } from "@/components/dashboard/SubmitButton";
import { FormStatus } from "@/components/dashboard/FormStatus";
import { formatCurrency, formatDate, formatShortDate } from "@/lib/api/helpers";
import { cn } from "@/lib/utils";
import type {
  FinanceEntry,
  FinanceSummaryItem,
  FinanceRange,
  FixedExpense,
  Debt,
  DebtPayment,
} from "@/lib/api/types";

interface FinanzasClientProps {
  transactions: FinanceEntry[];
  summary: FinanceSummaryItem[];
  initialRange: FinanceRange;
  totals: { income: number; expense: number; balance: number };
  initialBudget: number;
  initialMonthlyExpense: number;
  initialMonthlyIncome: number;
  fixedExpenses: FixedExpense[];
  debts: Debt[];
  personalEntries: import("@/lib/api/types").PersonalEntry[];
  loadErrors: string[];
  criticalError: boolean;
}

const RANGE_LABELS: Record<FinanceRange, string> = {
  all: "Todo",
  today: "Hoy",
  week: "Semana",
  month: "Mes",
};

interface DraftTX {
  description: string;
  amount: number;
  category: string;
  type: "GASTO" | "INGRESO";
  date: string;
  source: "manual" | "texto" | "ocr";
  confidence?: number;
}

function todayStr(): string {
  // Fecha local en America/Bogota via Intl.DateTimeFormat (sin depender de UTC).
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const get = (token: string) =>
      parts.find((p) => p.type === token)?.value ?? "";
    const y = get("year");
    const m = get("month");
    const d = get("day");
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // fallback abajo
  }
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function validateImageFile(file: File): { ok: true } | { ok: false; error: string } {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    return { ok: false, error: "Formato no soportado. Usa JPEG, PNG o WebP." };
  }
  if (file.size > 4 * 1024 * 1024) {
    return { ok: false, error: "La imagen supera 4 MB. Reduce su tamano e intenta de nuevo." };
  }
  return { ok: true };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("No se pudo leer la imagen."));
        return;
      }
      const commaIdx = result.indexOf(",");
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error("Error al procesar la imagen."));
    reader.readAsDataURL(file);
  });
}

export function FinanzasClient({
  transactions,
  summary,
  initialRange,
  totals,
  initialBudget,
  initialMonthlyExpense,
  initialMonthlyIncome,
  fixedExpenses: initialFixed,
  debts: initialDebts,
  personalEntries,
  loadErrors,
  criticalError,
}: FinanzasClientProps) {
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

  const [budget, setBudgetState] = useState<number>(initialBudget);
  const [budgetInput, setBudgetInput] = useState<string>(initialBudget ? String(initialBudget) : "");
  const [budgetStatus, setBudgetStatus] = useState<{ success?: string; error?: string }>({});
  const [savingBudget, setSavingBudget] = useState(false);
  const [monthlyExpense, setMonthlyExpense] = useState<number>(initialMonthlyExpense ?? 0);
  const [monthlyIncome] = useState<number>(initialMonthlyIncome ?? 0);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>(initialFixed);
  const [fixedStatus, setFixedStatus] = useState<{ success?: string; error?: string }>({});
  const [creatingFixed, setCreatingFixed] = useState(false);
  const [editingFixedId, setEditingFixedId] = useState<string | null>(null);
  const [deletingFixedId, setDeletingFixedId] = useState<string | null>(null);
  const [confirmDeleteFixedId, setConfirmDeleteFixedId] = useState<string | null>(null);
  const [fixedBusy, setFixedBusy] = useState<string | null>(null);
  const fixedFormRef = useRef<HTMLFormElement>(null);

  const [debts, setDebts] = useState<Debt[]>(initialDebts);
  const [debtStatus, setDebtStatus] = useState<{ success?: string; error?: string }>({});
  const [creatingDebt, setCreatingDebt] = useState(false);
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);
  const [deletingDebtId, setDeletingDebtId] = useState<string | null>(null);
  const [confirmDeleteDebtId, setConfirmDeleteDebtId] = useState<string | null>(null);
  const [expandedDebtId, setExpandedDebtId] = useState<string | null>(null);
  const [debtPayments, setDebtPayments] = useState<Record<string, DebtPayment[]> | null>(null);
  const [paymentsLoading, setPaymentsLoading] = useState<string | null>(null);
  const [abonoAmount, setAbonoAmount] = useState<string>("");
  const [abonoNotes, setAbonoNotes] = useState<string>("");
  const [savingAbono, setSavingAbono] = useState(false);
  const [debtBusy, setDebtBusy] = useState<string | null>(null);
  const debtFormRef = useRef<HTMLFormElement>(null);

  const [draft, setDraft] = useState<DraftTX | null>(null);
  const [captureText, setCaptureText] = useState("");
  const [captureStatus, setCaptureStatus] = useState<{ success?: string; error?: string }>({});
  const [parsing, setParsing] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<{ success?: string; error?: string }>({});
  const [ocrBusy, setOcrBusy] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const protocolEntry = personalEntries.find((entry) => entry.kind === "discipline" && entry.data?.tracker_type === "financial_protocol");
  const [financialGoal, setFinancialGoal] = useState(typeof protocolEntry?.data.goal === "string" ? protocolEntry.data.goal : "");
  const [emergencyTarget, setEmergencyTarget] = useState(String(protocolEntry?.data.emergency_target ?? ""));
  const [protocolBusy, setProtocolBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captureFormRef = useRef<HTMLFormElement>(null);

  async function refreshMonthlyExpense() {
    setMonthlyLoading(true);
    try {
      const m = await getFinanceSummary("month");
      setMonthlyExpense(m.total_expense ?? 0);
    } catch (err) {
      setStatus({ error: err instanceof Error ? err.message : "Error al cargar gasto mensual" });
    } finally {
      setMonthlyLoading(false);
    }
  }

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

  function fullRefresh() {
    return Promise.all([loadRange(range), refreshMonthlyExpense(), refreshFixed(), refreshDebts(), refreshBudget()]);
  }

  async function refreshBudget() {
    try {
      const b = await getBudget();
      setBudgetState(b);
      setBudgetInput(b ? String(b) : "");
    } catch (err) {
      setBudgetStatus({ error: err instanceof Error ? err.message : "Error al cargar presupuesto" });
    }
  }

  async function refreshFixed() {
    try {
      const list = await getFixedExpenses();
      setFixedExpenses(list);
    } catch (err) {
      setFixedStatus({ error: err instanceof Error ? err.message : "Error al cargar gastos fijos" });
    }
  }

  async function refreshDebts() {
    try {
      const list = await getDebts();
      setDebts(list);
    } catch (err) {
      setDebtStatus({ error: err instanceof Error ? err.message : "Error al cargar deudas" });
    }
  }

  async function handleSubmit(formData: FormData) {
    setStatus({});
    startTransition(async () => {
      const result = await createFinance(null, formData);
      if (result.success) {
        setStatus({ success: "Movimiento registrado correctamente." });
        formRef.current?.reset();
        await fullRefresh();
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
        await fullRefresh();
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
      await fullRefresh();
      router.refresh();
    } else {
      setStatus({ error: result.error ?? "Error al eliminar" });
    }
  }

  async function handleSaveBudget() {
    const value = parseFloat(budgetInput);
    setBudgetStatus({});
    if (Number.isNaN(value) || value < 0) {
      setBudgetStatus({ error: "Ingresa un monto valido mayor o igual a 0." });
      return;
    }
    setSavingBudget(true);
    try {
      await setBudget(value);
      setBudgetState(value);
      setBudgetStatus({ success: "Presupuesto guardado correctamente." });
      router.refresh();
    } catch (err) {
      setBudgetStatus({ error: err instanceof Error ? err.message : "Error al guardar el presupuesto" });
    } finally {
      setSavingBudget(false);
    }
  }

  async function handleCreateFixed(formData: FormData) {
    setFixedStatus({});
    const name = (formData.get("name") as string) || "";
    const amount = parseFloat(formData.get("amount") as string);
    const category = (formData.get("category") as string) || "Servicios";
    const dueDate = (formData.get("due_date") as string) || undefined;
    if (!name || Number.isNaN(amount) || amount <= 0) {
      setFixedStatus({ error: "Nombre y monto son obligatorios." });
      return;
    }
    setFixedBusy("create");
    try {
      await createFixedExpense({ name, amount, category, due_date: dueDate });
      setFixedStatus({ success: "Gasto fijo creado correctamente." });
      setCreatingFixed(false);
      fixedFormRef.current?.reset();
      await refreshFixed();
      router.refresh();
    } catch (err) {
      setFixedStatus({ error: err instanceof Error ? err.message : "Error al crear gasto fijo" });
    } finally {
      setFixedBusy(null);
    }
  }

  async function handleUpdateFixed(expense: FixedExpense, patch: Partial<FixedExpense>) {
    setFixedStatus({});
    setFixedBusy(expense.id);
    try {
      await updateFixedExpense(expense.id, patch);
      setFixedStatus({ success: "Gasto fijo actualizado correctamente." });
      setEditingFixedId(null);
      await refreshFixed();
      router.refresh();
    } catch (err) {
      setFixedStatus({ error: err instanceof Error ? err.message : "Error al actualizar gasto fijo" });
    } finally {
      setFixedBusy(null);
    }
  }

  async function handleTogglePaid(expense: FixedExpense) {
    setFixedStatus({});
    setFixedBusy(expense.id);
    try {
      await updateFixedExpense(expense.id, { is_paid: !expense.is_paid });
      setFixedStatus({ success: expense.is_paid ? "Marcado como pendiente." : "Marcado como pagado." });
      await refreshFixed();
      router.refresh();
    } catch (err) {
      setFixedStatus({ error: err instanceof Error ? err.message : "Error al cambiar estado" });
    } finally {
      setFixedBusy(null);
    }
  }

  async function handleDeleteFixed(id: string) {
    setFixedStatus({});
    setDeletingFixedId(id);
    try {
      await deleteFixedExpense(id);
      setFixedStatus({ success: "Gasto fijo eliminado." });
      setConfirmDeleteFixedId(null);
      await refreshFixed();
      router.refresh();
    } catch (err) {
      setFixedStatus({ error: err instanceof Error ? err.message : "Error al eliminar gasto fijo" });
    } finally {
      setDeletingFixedId(null);
    }
  }

  async function handleCreateDebt(formData: FormData) {
    setDebtStatus({});
    const name = (formData.get("name") as string) || "";
    const total = parseFloat(formData.get("total") as string);
    const remainingRaw = formData.get("remaining") as string;
    const monthlyRaw = formData.get("monthly_payment") as string;
    const dueDate = (formData.get("due_date") as string) || undefined;
    const notes = (formData.get("notes") as string) || "";
    if (!name || Number.isNaN(total) || total <= 0) {
      setDebtStatus({ error: "Nombre y total son obligatorios." });
      return;
    }
    const remaining = remainingRaw ? parseFloat(remainingRaw) : undefined;
    const monthly_payment = monthlyRaw ? parseFloat(monthlyRaw) : undefined;
    setDebtBusy("create");
    try {
      await createDebt({ name, total, remaining, monthly_payment, due_date: dueDate, notes });
      setDebtStatus({ success: "Deuda creada correctamente." });
      setCreatingDebt(false);
      debtFormRef.current?.reset();
      await refreshDebts();
      router.refresh();
    } catch (err) {
      setDebtStatus({ error: err instanceof Error ? err.message : "Error al crear deuda" });
    } finally {
      setDebtBusy(null);
    }
  }

  async function handleUpdateDebt(debt: Debt, formData: FormData) {
    setDebtStatus({});
    const name = (formData.get("name") as string) || debt.name;
    const totalRaw = formData.get("total") as string;
    const remainingRaw = formData.get("remaining") as string;
    const monthlyRaw = formData.get("monthly_payment") as string;
    const dueDate = (formData.get("due_date") as string) || undefined;
    const notes = (formData.get("notes") as string) ?? debt.notes ?? "";
    const patch: Partial<Debt> = { name, due_date: dueDate, notes };
    if (totalRaw) patch.total = parseFloat(totalRaw);
    if (remainingRaw) patch.remaining = parseFloat(remainingRaw);
    if (monthlyRaw) patch.monthly_payment = parseFloat(monthlyRaw);
    setDebtBusy(debt.id);
    try {
      await updateDebt(debt.id, patch);
      setDebtStatus({ success: "Deuda actualizada correctamente." });
      setEditingDebtId(null);
      await refreshDebts();
      router.refresh();
    } catch (err) {
      setDebtStatus({ error: err instanceof Error ? err.message : "Error al actualizar deuda" });
    } finally {
      setDebtBusy(null);
    }
  }

  async function handleDeleteDebt(id: string) {
    setDebtStatus({});
    setDeletingDebtId(id);
    try {
      await deleteDebt(id);
      setDebtStatus({ success: "Deuda eliminada." });
      setConfirmDeleteDebtId(null);
      if (expandedDebtId === id) setExpandedDebtId(null);
      await refreshDebts();
      router.refresh();
    } catch (err) {
      setDebtStatus({ error: err instanceof Error ? err.message : "Error al eliminar deuda" });
    } finally {
      setDeletingDebtId(null);
    }
  }

  async function toggleExpandDebt(debtId: string) {
    if (expandedDebtId === debtId) {
      setExpandedDebtId(null);
      return;
    }
    setExpandedDebtId(debtId);
    setAbonoAmount("");
    setAbonoNotes("");
    if (!debtPayments || !debtPayments[debtId]) {
      setPaymentsLoading(debtId);
      try {
        const list = await getDebtPayments(debtId);
        setDebtPayments((prev) => ({ ...(prev ?? {}), [debtId]: list }));
      } catch (err) {
        setDebtStatus({ error: err instanceof Error ? err.message : "Error al cargar historial de abonos" });
      } finally {
        setPaymentsLoading(null);
      }
    }
  }

  async function handleAbono(debt: Debt) {
    setDebtStatus({});
    const amount = parseFloat(abonoAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      setDebtStatus({ error: "Ingresa un monto de abono valido mayor a 0." });
      return;
    }
    if (amount > debt.remaining) {
      setDebtStatus({ error: "El abono no puede superar el saldo pendiente." });
      return;
    }
    setSavingAbono(true);
    try {
      await recordDebtPayment(debt.id, { amount, notes: abonoNotes || undefined });
      setDebtStatus({ success: "Abono registrado correctamente." });
      setAbonoAmount("");
      setAbonoNotes("");
      await refreshDebts();
      const list = await getDebtPayments(debt.id);
      setDebtPayments((prev) => ({ ...(prev ?? {}), [debt.id]: list }));
      router.refresh();
    } catch (err) {
      setDebtStatus({ error: err instanceof Error ? err.message : "Error al registrar el abono" });
    } finally {
      setSavingAbono(false);
    }
  }

  async function handleParseText() {
    setCaptureStatus({});
    const text = captureText.trim();
    if (!text) {
      setCaptureStatus({ error: "Escribe un texto para analizar." });
      return;
    }
    setParsing(true);
    try {
      const parsed = await parseFinanceText(text);
      if (parsed.fallback_mode) {
        setCaptureStatus({ error: "No se detecto un monto. Completa el borrador manualmente." });
        setDraft({
          description: text.slice(0, 80),
          amount: 0,
          category: "General",
          type: "GASTO",
          date: todayStr(),
          source: "texto",
        });
      } else {
        setDraft({
          description: parsed.description,
          amount: parsed.amount,
          category: parsed.category,
          type: (parsed.type === "INGRESO" ? "INGRESO" : "GASTO"),
          date: todayStr(),
          source: "texto",
        });
      }
    } catch (err) {
      setCaptureStatus({ error: err instanceof Error ? err.message : "Error al analizar el texto" });
    } finally {
      setParsing(false);
    }
  }

  async function handleOcrFile(file: File) {
    setOcrStatus({});
    const validation = validateImageFile(file);
    if (!validation.ok) {
      setOcrStatus({ error: validation.error });
      return;
    }
    setOcrBusy(true);
    try {
      const base64 = await fileToBase64(file);
      const result = await uploadReceipt(base64, file.type);
      const draftPrev = draft;
      const baseAmount = draftPrev?.amount ?? 0;
      const baseDescription = draftPrev?.description ?? "";
      const newDraft: DraftTX = {
        description: result.description || baseDescription || "Comprobante",
        amount: result.amount > 0 ? result.amount : baseAmount,
        category: result.category || draftPrev?.category || "General",
        type: (result.type === "INGRESO" ? "INGRESO" : "GASTO"),
        date: todayStr(),
        source: "ocr",
        confidence: result.confidence,
      };
      setDraft(newDraft);
      if (result.amount <= 0) {
        setOcrStatus({
          error:
            "El OCR no detecto un monto claro. Conservamos lo que ya tenias; completa el borrador manualmente.",
        });
      } else if (typeof result.confidence === "number" && result.confidence < 0.5) {
        setOcrStatus({ success: "Comprobante procesado con baja confianza. Revisa antes de guardar." });
      } else {
        setOcrStatus({ success: "Comprobante procesado. Revisa y confirma el borrador." });
      }
    } catch (err) {
      setOcrStatus({
        error: err instanceof Error ? err.message : "Error al procesar la imagen. Completa el borrador manualmente.",
      });
      if (!draft) {
        setDraft({
          description: "Comprobante",
          amount: 0,
          category: "General",
          type: "GASTO",
          date: todayStr(),
          source: "ocr",
        });
      }
    } finally {
      setOcrBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSaveDraft() {
    setStatus({});
    if (!draft) return;
    if (!draft.description.trim() || draft.amount <= 0) {
      setStatus({ error: "Completa descripcion y un monto mayor a 0 antes de guardar." });
      return;
    }
    setSavingDraft(true);
    try {
      const fd = new FormData();
      fd.append("description", draft.description.trim());
      fd.append("amount", String(draft.amount));
      fd.append("category", draft.category || "General");
      fd.append("type", draft.type);
      fd.append("date", draft.date);
      const result = await createFinance(null, fd);
      if (result.success) {
        setStatus({ success: "Movimiento registrado correctamente desde el borrador." });
        setDraft(null);
        setCaptureText("");
        setCaptureStatus({});
        setOcrStatus({});
        await fullRefresh();
        router.refresh();
      } else {
        setStatus({ error: result.error ?? "Error al guardar el borrador" });
      }
    } catch (err) {
      setStatus({ error: err instanceof Error ? err.message : "Error al guardar el borrador" });
    } finally {
      setSavingDraft(false);
    }
  }

  const { income, expense, balance } = currentTotals;
  const incomeCategories = currentSummary.filter((s) => s.category.startsWith("INGRESO:"));
  const expenseCategories = currentSummary.filter((s) => !s.category.startsWith("INGRESO:"));

  const sortedItems = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          new Date(b.date ?? b.timestamp ?? 0).getTime() - new Date(a.date ?? a.timestamp ?? 0).getTime()
      ),
    [items]
  );

  const fixedPending = fixedExpenses.filter((f) => !f.is_paid);
  const fixedPendingTotal = fixedPending.reduce((acc, f) => acc + (f.amount ?? 0), 0);
  const upcomingFixed = useMemo(
    () =>
      [...fixedExpenses]
        .filter((f) => !f.is_paid && f.due_date)
        .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
        .slice(0, 3),
    [fixedExpenses]
  );

  const totalDebtRemaining = debts.reduce((acc, d) => acc + (d.remaining ?? 0), 0);

  const budgetConfigured = budget > 0;
  const budgetUsedPct = budgetConfigured ? Math.min((monthlyExpense / budget) * 100, 100) : 0;
  const budgetSaldo = budget - monthlyExpense;
  const budgetOver = monthlyExpense > budget && budgetConfigured;
  const debtMonthlyCommitment = debts.reduce((acc, debt) => acc + (debt.monthly_payment ?? 0), 0);
  const fixedMonthlyTotal = fixedExpenses.reduce((acc, item) => acc + (item.amount ?? 0), 0);
  const protocolChecks = Array.isArray(protocolEntry?.data.weekly_checks)
    ? protocolEntry.data.weekly_checks.filter((item): item is string => typeof item === "string")
    : [];
  const protocolActions = ["Registre todos mis gastos", "Evite una compra impulsiva", "Separe ahorro o abono", "Revise vencimientos"];
  const emergencyProposal = fixedMonthlyTotal * 3;

  async function saveFinancialProtocol(nextChecks = protocolChecks) {
    setProtocolBusy(true);
    try {
      const data = { tracker_type: "financial_protocol", goal: financialGoal.trim(), emergency_target: Number(emergencyTarget) || 0, weekly_checks: nextChecks };
      if (protocolEntry) await updatePersonalEntry(protocolEntry.id, { title: "Protocolo financiero", content: "Presupuesto, deuda, fondo y disciplina semanal.", data });
      else await createPersonalEntry({ kind: "discipline", title: "Protocolo financiero", content: "Presupuesto, deuda, fondo y disciplina semanal.", data });
      setStatus({ success: "Protocolo financiero actualizado." });
      router.refresh();
    } catch (error) { setStatus({ error: error instanceof Error ? error.message : "No se pudo guardar el protocolo." }); }
    finally { setProtocolBusy(false); }
  }

  function toggleProtocolCheck(action: string) {
    const next = protocolChecks.includes(action) ? protocolChecks.filter((item) => item !== action) : [...protocolChecks, action];
    void saveFinancialProtocol(next);
  }
  const financialFocus = !budgetConfigured
    ? {
        title: "Define tu margen del mes",
        message: "Configura un presupuesto mensual antes de asumir gastos que no sean esenciales.",
        tone: "text-escudo-gold",
      }
    : budgetOver
      ? {
          title: "Recupera tu margen",
          message: `Vas ${formatCurrency(monthlyExpense - budget)} por encima del presupuesto. Pausa gastos flexibles hasta revisar el flujo.`,
          tone: "text-escudo-red",
        }
      : upcomingFixed[0]
        ? {
            title: "Siguiente compromiso",
            message: `${upcomingFixed[0].name} vence ${formatShortDate(upcomingFixed[0].due_date!)} por ${formatCurrency(upcomingFixed[0].amount)}. Sepáralo antes de usar el saldo disponible.`,
            tone: "text-accent",
          }
        : debtMonthlyCommitment > 0
          ? {
              title: "Avance de salida",
              message: `Tu compromiso mensual de deudas es ${formatCurrency(debtMonthlyCommitment)}. Separa ese monto antes de distribuir el resto.`,
              tone: "text-escudo-gold",
            }
          : {
              title: "Conserva visibilidad",
              message: "Registra los movimientos de esta semana para decidir con datos reales y cuidar tu margen.",
              tone: "text-accent",
            };

  if (criticalError) {
    return <ErrorState title="No se pudieron cargar tus movimientos" message="No mostraremos valores incompletos como si fueran reales. Reintenta para cargar Finanzas." onRetry={() => router.refresh()} />;
  }

  return (
    <div className="flex flex-col gap-6">
      {loadErrors.length > 0 && (
        <ErrorState
          title="Algunos datos de Finanzas no se pudieron cargar"
          message={`Puedes seguir usando los movimientos disponibles. Pendiente de actualizar: ${loadErrors.join(", ")}.`}
          onRetry={() => router.refresh()}
        />
      )}
      <section className="panel-neon relative overflow-hidden rounded-[28px] p-6">
        <div className="relative flex flex-col gap-3">
          <span className="hud-label text-escudo-gold">Financial Grid</span>
          <h2 className="font-heading text-3xl font-black tracking-[0.1em] text-glow text-foreground md:text-4xl">
            FINANZAS
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
            Monitorea flujo, presupuesto, gastos fijos, deudas y captura rapida desde un panel tactico.
          </p>
        </div>
      </section>

      <Card className="border-[#2A2A3C] bg-[#17171A]">
        <CardHeader>
          <span className="hud-label text-[#bcaeff]">PROTOCOLO DE LIBERTAD</span>
          <CardTitle className="text-white">Control de tu dinero, sin esconder lo importante</CardTitle>
          <CardDescription>Convierte tus ingresos, gastos, deudas y decisiones de la semana en una salida concreta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ["50% Necesidades", monthlyIncome * 0.5, "Gastos fijos y lo esencial"],
              ["30% Flexibles", monthlyIncome * 0.3, "Compras que puedes ajustar"],
              ["20% Libertad", monthlyIncome * 0.2, "Ahorro y salida de deudas"],
            ].map(([label, amount, note]) => <div key={String(label)} className="border border-[#2A2A3C] p-4"><span className="hud-label text-muted-foreground">{label}</span><p className="mt-1 text-xl font-semibold text-[#FFD700]">{formatCurrency(Number(amount))}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></div>)}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3 border border-[#2A2A3C] p-4">
              <p className="text-sm font-semibold text-white">Plan para salir de deudas</p>
              <p className="text-sm text-muted-foreground">Deuda pendiente: <b className="text-[#FFD700]">{formatCurrency(totalDebtRemaining)}</b> · Compromiso mensual: <b className="text-white">{formatCurrency(debtMonthlyCommitment)}</b></p>
              <Input value={financialGoal} onChange={(event) => setFinancialGoal(event.target.value)} placeholder="Meta principal: Ej. pagar tarjeta antes de diciembre" className="border-[#2A2A3C] bg-[#0C0C0E] text-white" />
              <div className="flex gap-2"><Input type="number" min="0" value={emergencyTarget} onChange={(event) => setEmergencyTarget(event.target.value)} placeholder={`Fondo de emergencia sugerido: ${formatCurrency(emergencyProposal)}`} className="border-[#2A2A3C] bg-[#0C0C0E] text-white" /><Button disabled={protocolBusy} onClick={() => void saveFinancialProtocol()} className="bg-[#7C5DFF]">{protocolBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}</Button></div>
              <p className="text-xs text-muted-foreground">Fondo sugerido: 3 meses de gastos fijos ({formatCurrency(emergencyProposal)}). Tu objetivo: {Number(protocolEntry?.data.emergency_target ?? 0) > 0 ? formatCurrency(Number(protocolEntry?.data.emergency_target)) : "por definir"}.</p>
            </div>
            <div className="space-y-3 border border-[#2A2A3C] p-4"><p className="text-sm font-semibold text-white">Reto financiero de esta semana</p><p className="text-xs text-muted-foreground">{protocolChecks.length}/4 compromisos cumplidos. No busca culpa: busca visibilidad y repeticion.</p>{protocolActions.map((action) => <button key={action} disabled={protocolBusy} onClick={() => toggleProtocolCheck(action)} className="flex w-full items-center gap-2 text-left text-sm"><span className={protocolChecks.includes(action) ? "text-[#7C5DFF]" : "text-muted-foreground"}>{protocolChecks.includes(action) ? <CheckCircle2 className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}</span><span className={protocolChecks.includes(action) ? "text-muted-foreground line-through" : "text-white"}>{action}</span></button>)}</div>
          </div>
        </CardContent>
      </Card>

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

      <Card>
        <CardHeader>
          <span className="hud-label text-accent">Monthly Budget</span>
          <CardTitle className="flex items-center gap-2 text-base">
            <PiggyBank className="h-5 w-5 text-accent" /> Presupuesto mensual
          </CardTitle>
          <CardDescription>
            {budgetConfigured
              ? "Define cuanto puedes gastar al mes y sigue tu saldo disponible."
              : "Configura tu presupuesto mensual para seguir tu gasto."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {budgetConfigured ? (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-border/70 bg-background/35 p-4">
                  <span className="hud-label text-muted-foreground">Presupuesto</span>
                  <p className="mt-1 text-xl font-semibold text-foreground">{formatCurrency(budget)}</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/35 p-4">
                  <span className="hud-label text-escudo-red">Gasto del mes</span>
                  <p className="mt-1 text-xl font-semibold text-escudo-red">
                    {monthlyLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : formatCurrency(monthlyExpense)}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/35 p-4">
                  <span className="hud-label text-escudo-gold">Saldo disponible</span>
                  <p
                    className={cn(
                      "mt-1 text-xl font-semibold",
                      budgetOver ? "text-escudo-red" : "text-escudo-green"
                    )}
                  >
                    {formatCurrency(budgetSaldo)}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Porcentaje usado</span>
                  <span className={cn("font-medium", budgetOver ? "text-escudo-red" : "text-foreground")}>
                    {budgetUsedPct.toFixed(0)}%
                  </span>
                </div>
                <Progress
                  value={budgetUsedPct}
                  className={cn("h-2 bg-secondary", budgetOver ? "[&_[data-slot=progress-indicator]]:bg-escudo-red" : "[&_[data-slot=progress-indicator]]:bg-accent")}
                  aria-label="Porcentaje del presupuesto usado"
                />
                {budgetOver && (
                  <p className="text-xs text-escudo-red">
                    Has superado tu presupuesto mensual en {formatCurrency(monthlyExpense - budget)}.
                  </p>
                )}
              </div>
            </>
          ) : (
            <EmptyState
              title="Configura tu presupuesto"
              message="Aun no has definido un presupuesto mensual. Ingresa un monto abajo para empezar a seguir tu gasto."
            />
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="budget-input">Presupuesto mensual (COP)</Label>
              <Input
                id="budget-input"
                name="budget"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder="Ej. 2000000"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
              />
            </div>
            <Button type="button" onClick={handleSaveBudget} disabled={savingBudget} className="h-11">
              {savingBudget && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {budgetConfigured ? "Actualizar presupuesto" : "Guardar presupuesto"}
            </Button>
          </div>
          <FormStatus {...budgetStatus} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <span className="hud-label text-accent">Monthly Direction</span>
          <CardTitle className={cn("flex items-center gap-2 text-base", financialFocus.tone)}>
            <CircleAlert className="h-5 w-5" /> {financialFocus.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{financialFocus.message}</p>
        </CardContent>
      </Card>

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
                <Input id="date" name="date" type="date" defaultValue={todayStr()} required />
              </div>
              <FormStatus {...status} />
              <SubmitButton className="w-full">Registrar</SubmitButton>
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <span className="hud-label text-accent">Quick Capture</span>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wand2 className="h-5 w-5 text-escudo-gold" /> Captura rapida
              </CardTitle>
              <CardDescription>
                Analiza texto y comprobantes. El resultado se muestra como borrador editable antes de guardar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <form
                ref={captureFormRef}
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleParseText();
                }}
                className="flex flex-col gap-3"
              >
                <div className="space-y-2">
                  <Label htmlFor="capture-text">Texto libre</Label>
                  <Input
                    id="capture-text"
                    name="capture_text"
                    placeholder="Ej. Mercancia Carulla 48000"
                    value={captureText}
                    onChange={(e) => setCaptureText(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="submit" disabled={parsing} variant="outline">
                    {parsing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Analizar texto
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={ocrBusy}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {ocrBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />}
                    Subir comprobante (OCR)
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleOcrFile(f);
                    }}
                    aria-label="Seleccionar imagen de comprobante"
                  />
                </div>
                <FormStatus {...captureStatus} />
              </form>

              {ocrStatus.success || ocrStatus.error ? <FormStatus {...ocrStatus} /> : null}

              {draft && (
                <div className="rounded-2xl border border-accent/40 bg-accent/5 p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="hud-label text-accent">
                      <Receipt className="mr-1 inline h-4 w-4" />
                      Borrador {draft.source === "ocr" ? "(OCR)" : draft.source === "texto" ? "(texto)" : ""}
                      {typeof draft.confidence === "number" ? ` · confianza ${(draft.confidence * 100).toFixed(0)}%` : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDraft(null)}
                      className="rounded-lg p-1 text-muted-foreground hover:text-foreground"
                      title="Cerrar borrador"
                      aria-label="Cerrar borrador"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="draft-description">Descripcion</Label>
                      <Input
                        id="draft-description"
                        value={draft.description}
                        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="draft-amount">Monto</Label>
                      <Input
                        id="draft-amount"
                        type="number"
                        step="0.01"
                        min="0"
                        value={draft.amount || ""}
                        onChange={(e) => setDraft({ ...draft, amount: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="draft-category">Categoria</Label>
                      <Input
                        id="draft-category"
                        value={draft.category}
                        onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="draft-type">Tipo</Label>
                      <select
                        id="draft-type"
                        value={draft.type}
                        onChange={(e) => setDraft({ ...draft, type: e.target.value as "GASTO" | "INGRESO" })}
                        className="h-11 w-full rounded-xl border border-border/80 bg-input/80 px-3 py-2 text-sm text-foreground outline-none transition-all focus-visible:border-accent/60 focus-visible:ring-3 focus-visible:ring-accent/20"
                      >
                        <option value="GASTO">Gasto</option>
                        <option value="INGRESO">Ingreso</option>
                      </select>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="draft-date">Fecha</Label>
                      <Input
                        id="draft-date"
                        type="date"
                        value={draft.date}
                        onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <Button type="button" onClick={handleSaveDraft} disabled={savingDraft}>
                      {savingDraft ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                      Confirmar y guardar
                    </Button>
                    <button
                      type="button"
                      onClick={() => setDraft(null)}
                      className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Descartar
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

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
                      className={cn(
                        "rounded-lg px-3 py-1 text-xs font-medium transition-colors",
                        range === r
                          ? "bg-accent text-white"
                          : "bg-secondary text-muted-foreground hover:text-foreground"
                      )}
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
                                {tx.category} · {formatDate(tx.date ?? tx.timestamp)}
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
                                className={cn(
                                  "text-sm font-semibold",
                                  tx.type === "income" ? "text-escudo-green" : "text-escudo-red"
                                )}
                              >
                                {tx.type === "income" ? "+" : "-"}
                                {formatCurrency(tx.amount ?? 0)}
                              </span>
                              <button
                                type="button"
                                onClick={() => setEditingId(tx.id)}
                                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent/10 hover:text-accent"
                                title="Editar"
                                aria-label="Editar movimiento"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(tx.id)}
                                disabled={deletingId === tx.id}
                                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-escudo-red/10 hover:text-escudo-red"
                                title="Eliminar"
                                aria-label="Eliminar movimiento"
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <span className="hud-label text-accent">Recurring</span>
              <CardTitle className="flex items-center gap-2 text-base">
                <Repeat className="h-5 w-5 text-escudo-gold" /> Gastos fijos
              </CardTitle>
              <CardDescription>
                {fixedPending.length > 0
                  ? `${fixedPending.length} pendientes · ${formatCurrency(fixedPendingTotal)} por pagar`
                  : "Sin gastos pendientes"}
              </CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setCreatingFixed((v) => !v);
                setEditingFixedId(null);
                setFixedStatus({});
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              {creatingFixed ? "Cancelar" : "Agregar"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {upcomingFixed.length > 0 && (
              <div className="rounded-2xl border border-border/70 bg-background/35 p-3">
                <span className="hud-label text-escudo-gold">Proximos vencimientos</span>
                <ul className="mt-2 space-y-1">
                  {upcomingFixed.map((f) => (
                    <li key={f.id} className="flex justify-between text-sm">
                      <span className="text-foreground">{f.name}</span>
                      <span className="text-muted-foreground">
                        {formatShortDate(f.due_date)} · {formatCurrency(f.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {creatingFixed && (
              <div className="rounded-2xl border border-border/70 bg-background/35 p-4">
                <form
                  ref={fixedFormRef}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(fixedFormRef.current ?? undefined);
                    void handleCreateFixed(fd);
                  }}
                  className="flex flex-col gap-3"
                >
                  <div className="space-y-2">
                    <Label htmlFor="fixed-name">Nombre</Label>
                    <Input id="fixed-name" name="name" placeholder="Ej. Arriendo" required />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="fixed-amount">Monto</Label>
                      <Input
                        id="fixed-amount"
                        name="amount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="0"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fixed-category">Categoria</Label>
                      <Input id="fixed-category" name="category" defaultValue="Servicios" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fixed-due">Fecha de vencimiento</Label>
                    <Input id="fixed-due" name="due_date" type="date" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="submit" disabled={fixedBusy === "create"}>
                      {fixedBusy === "create" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Crear gasto fijo
                    </Button>
                    <button
                      type="button"
                      onClick={() => setCreatingFixed(false)}
                      className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            )}

            <FormStatus {...fixedStatus} />

            {fixedExpenses.length === 0 && !creatingFixed ? (
              <EmptyState title="Sin gastos fijos" message="Agrega arriendo, servicios o suscripciones para seguirlos." />
            ) : (
              <div className="flex flex-col gap-3">
                {fixedExpenses.map((f) => {
                  const isEditing = editingFixedId === f.id;
                  if (isEditing) {
                    return (
                      <form
                        key={f.id}
                        action={(fd) => handleUpdateFixed(f, {
                          name: (fd.get("name") as string) || f.name,
                          amount: parseFloat((fd.get("amount") as string) || String(f.amount)) || f.amount,
                          category: (fd.get("category") as string) || f.category,
                          due_date: (fd.get("due_date") as string) || f.due_date,
                        })}
                        className="flex flex-col gap-2 rounded-2xl border border-accent/40 bg-background/35 p-3"
                      >
                        <Input name="name" defaultValue={f.name} required />
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Input name="amount" type="number" step="0.01" min="0.01" defaultValue={f.amount} required />
                          <Input name="category" defaultValue={f.category} />
                        </div>
                        <Input name="due_date" type="date" defaultValue={f.due_date?.slice(0, 10)} />
                        <div className="flex items-center gap-2">
                          <SubmitButton>Guardar</SubmitButton>
                          <button
                            type="button"
                            onClick={() => setEditingFixedId(null)}
                            className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                          >
                            Cancelar
                          </button>
                        </div>
                      </form>
                    );
                  }
                  const confirming = confirmDeleteFixedId === f.id;
                  return (
                    <div
                      key={f.id}
                      className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-background/35 px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-medium text-foreground">{f.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {f.category} · {formatCurrency(f.amount)} · vence {formatShortDate(f.due_date)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={
                              f.is_paid
                                ? "border-escudo-green/30 bg-escudo-green/10 text-escudo-green"
                                : "border-escudo-gold/30 bg-escudo-gold/10 text-escudo-gold"
                            }
                          >
                            {f.is_paid ? "Pagado" : "Pendiente"}
                          </Badge>
                          <button
                            type="button"
                            onClick={() => handleTogglePaid(f)}
                            disabled={fixedBusy === f.id}
                            title={f.is_paid ? "Marcar como pendiente" : "Marcar como pagado"}
                            aria-label={f.is_paid ? "Marcar como pendiente" : "Marcar como pagado"}
                            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent/10 hover:text-accent"
                          >
                            {fixedBusy === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingFixedId(f.id);
                              setCreatingFixed(false);
                              setConfirmDeleteFixedId(null);
                              setFixedStatus({});
                            }}
                            disabled={fixedBusy === f.id}
                            title="Editar gasto fijo"
                            aria-label="Editar gasto fijo"
                            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent/10 hover:text-accent"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {confirming ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleDeleteFixed(f.id)}
                                disabled={deletingFixedId === f.id}
                                title="Confirmar eliminacion"
                                aria-label="Confirmar eliminacion"
                                className="rounded-lg bg-escudo-red/20 px-2 py-1.5 text-xs font-medium text-escudo-red hover:bg-escudo-red/30"
                              >
                                {deletingFixedId === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteFixedId(null)}
                                title="Cancelar"
                                aria-label="Cancelar eliminacion"
                                className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteFixedId(f.id)}
                              disabled={fixedBusy === f.id}
                              title="Eliminar gasto fijo"
                              aria-label="Eliminar gasto fijo"
                              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-escudo-red/10 hover:text-escudo-red"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <span className="hud-label text-accent">Debt Control</span>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-5 w-5 text-accent" /> Deudas
              </CardTitle>
              <CardDescription>
                {debts.length > 0
                  ? `${debts.length} deudas · saldo total ${formatCurrency(totalDebtRemaining)}`
                  : "Sin deudas registradas"}
              </CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setCreatingDebt((v) => !v);
                setEditingDebtId(null);
                setDebtStatus({});
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              {creatingDebt ? "Cancelar" : "Agregar"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {creatingDebt && (
              <div className="rounded-2xl border border-border/70 bg-background/35 p-4">
                <form
                  ref={debtFormRef}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(debtFormRef.current ?? undefined);
                    void handleCreateDebt(fd);
                  }}
                  className="flex flex-col gap-3"
                >
                  <div className="space-y-2">
                    <Label htmlFor="debt-name">Nombre</Label>
                    <Input id="debt-name" name="name" placeholder="Ej. Tarjeta BBVA" required />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="debt-total">Total</Label>
                      <Input id="debt-total" name="total" type="number" step="0.01" min="0.01" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="debt-remaining">Saldo inicial (opcional)</Label>
                      <Input id="debt-remaining" name="remaining" type="number" step="0.01" min="0" />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="debt-monthly">Pago mensual</Label>
                      <Input id="debt-monthly" name="monthly_payment" type="number" step="0.01" min="0" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="debt-due">Fecha limite</Label>
                      <Input id="debt-due" name="due_date" type="date" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="debt-notes">Notas</Label>
                    <Input id="debt-notes" name="notes" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="submit" disabled={debtBusy === "create"}>
                      {debtBusy === "create" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Crear deuda
                    </Button>
                    <button
                      type="button"
                      onClick={() => setCreatingDebt(false)}
                      className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            )}

            <FormStatus {...debtStatus} />

            {debts.length === 0 && !creatingDebt ? (
              <EmptyState title="Sin deudas" message="Agrega tarjetas, prestamos o creditos para seguir su saldo." />
            ) : (
              <div className="flex flex-col gap-3">
                {debts.map((d) => {
                  const total = d.total ?? 0;
                  const remaining = d.remaining ?? 0;
                  const paid = Math.max(total - remaining, 0);
                  const progress = total > 0 ? Math.min((paid / total) * 100, 100) : 0;
                  const isEditing = editingDebtId === d.id;
                  const isExpanded = expandedDebtId === d.id;
                  const payments = debtPayments?.[d.id] ?? [];
                  const confirming = confirmDeleteDebtId === d.id;

                  if (isEditing) {
                    return (
                      <form
                        key={d.id}
                        action={(fd) => handleUpdateDebt(d, fd)}
                        className="flex flex-col gap-2 rounded-2xl border border-accent/40 bg-background/35 p-3"
                      >
                        <Input name="name" defaultValue={d.name} required />
                        <div className="grid gap-2 sm:grid-cols-3">
                          <Input name="total" type="number" step="0.01" min="0.01" defaultValue={d.total} />
                          <Input name="remaining" type="number" step="0.01" min="0" defaultValue={d.remaining} />
                          <Input name="monthly_payment" type="number" step="0.01" min="0" defaultValue={d.monthly_payment ?? 0} />
                        </div>
                        <Input name="due_date" type="date" defaultValue={d.due_date?.slice(0, 10)} />
                        <Input name="notes" defaultValue={d.notes ?? ""} />
                        <div className="flex items-center gap-2">
                          <SubmitButton>Guardar</SubmitButton>
                          <button
                            type="button"
                            onClick={() => setEditingDebtId(null)}
                            className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                          >
                            Cancelar
                          </button>
                        </div>
                      </form>
                    );
                  }

                  return (
                    <div
                      key={d.id}
                      className="rounded-2xl border border-border/70 bg-background/35 px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => toggleExpandDebt(d.id)}
                          className="flex flex-1 items-center gap-2 text-left"
                          aria-expanded={isExpanded}
                          aria-label={isExpanded ? "Contraer historial de abonos" : "Expandir historial de abonos"}
                        >
                          <ChevronDown
                            className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-180")}
                          />
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-medium text-foreground">{d.name}</span>
                            <span className="text-xs text-muted-foreground">
                              Saldo {formatCurrency(remaining)} de {formatCurrency(total)}
                              {d.due_date ? ` · vence ${formatShortDate(d.due_date)}` : ""}
                            </span>
                          </div>
                        </button>
                        <div className="flex items-center gap-2">
                          {remaining <= 0 && total > 0 ? (
                            <Badge variant="outline" className="border-escudo-green/30 bg-escudo-green/10 text-escudo-green">
                              Pagada
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-accent/30 bg-accent/10 text-accent">
                              {progress.toFixed(0)}% pagado
                            </Badge>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDebtId(d.id);
                              setCreatingDebt(false);
                              setConfirmDeleteDebtId(null);
                              setDebtStatus({});
                            }}
                            disabled={debtBusy === d.id || savingAbono}
                            title="Editar deuda"
                            aria-label="Editar deuda"
                            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent/10 hover:text-accent"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {confirming ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleDeleteDebt(d.id)}
                                disabled={deletingDebtId === d.id}
                                title="Confirmar eliminacion"
                                aria-label="Confirmar eliminacion"
                                className="rounded-lg bg-escudo-red/20 px-2 py-1.5 text-xs font-medium text-escudo-red hover:bg-escudo-red/30"
                              >
                                {deletingDebtId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteDebtId(null)}
                                title="Cancelar"
                                aria-label="Cancelar eliminacion"
                                className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteDebtId(d.id)}
                              disabled={debtBusy === d.id || savingAbono}
                              title="Eliminar deuda"
                              aria-label="Eliminar deuda"
                              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-escudo-red/10 hover:text-escudo-red"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 space-y-1">
                        <Progress value={progress} className="h-2 bg-secondary [&_[data-slot=progress-indicator]]:bg-accent" aria-label={`Progreso de pago ${progress}%`} />
                      </div>

                      {isExpanded && (
                        <div className="mt-4 space-y-4 border-t border-border/70 pt-4">
                          {d.monthly_payment ? (
                            <p className="text-xs text-muted-foreground">
                              Pago mensual sugerido: {formatCurrency(d.monthly_payment)}
                            </p>
                          ) : null}
                          {d.notes ? (
                            <p className="text-xs text-muted-foreground">Notas: {d.notes}</p>
                          ) : null}

                          <div className="rounded-xl border border-border/70 bg-background/40 p-3">
                            <span className="hud-label text-accent">Nuevo abono</span>
                            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
                              <div className="flex-1 space-y-1">
                                <Label htmlFor={`abono-${d.id}`} className="text-xs">
                                  Monto del abono
                                </Label>
                                <Input
                                  id={`abono-${d.id}`}
                                  type="number"
                                  step="0.01"
                                  min="0.01"
                                  placeholder="0"
                                  value={abonoAmount}
                                  onChange={(e) => setAbonoAmount(e.target.value)}
                                  disabled={savingAbono || remaining <= 0}
                                />
                              </div>
                              <div className="flex-1 space-y-1">
                                <Label htmlFor={`abono-notes-${d.id}`} className="text-xs">
                                  Notas (opcional)
                                </Label>
                                <Input
                                  id={`abono-notes-${d.id}`}
                                  value={abonoNotes}
                                  onChange={(e) => setAbonoNotes(e.target.value)}
                                  disabled={savingAbono || remaining <= 0}
                                />
                              </div>
                              <Button
                                type="button"
                                onClick={() => handleAbono(d)}
                                disabled={savingAbono || remaining <= 0}
                              >
                                {savingAbono ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Registrar abono
                              </Button>
                            </div>
                            {remaining <= 0 && (
                              <p className="mt-2 text-xs text-escudo-green">Esta deuda ya esta saldada.</p>
                            )}
                          </div>

                          <div>
                            <span className="hud-label text-muted-foreground">Historial de abonos</span>
                            {paymentsLoading === d.id ? (
                              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" /> Cargando abonos...
                              </div>
                            ) : payments.length === 0 ? (
                              <p className="mt-2 text-xs text-muted-foreground">No hay abonos registrados.</p>
                            ) : (
                              <ul className="mt-2 flex flex-col gap-2">
                                {payments.map((p) => (
                                  <li
                                    key={p.id}
                                    className="flex items-center justify-between rounded-lg border border-border/60 bg-background/30 px-3 py-2 text-sm"
                                  >
                                    <div className="flex flex-col gap-0.5">
                                      <span className="font-medium text-escudo-green">
                                        {formatCurrency(p.amount)}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {formatDate(p.payment_date ?? p.created_at)}
                                        {p.notes ? ` · ${p.notes}` : ""}
                                      </span>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
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
  );
}
