"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, User, LogOut, Loader2, Sparkles, Wallet } from "lucide-react";
import { MobileNav } from "./MobileNav";
import { NAV_MODULES } from "@/lib/constants/navigation";
import { createClient } from "@/lib/auth/client";
import { logout } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const activeModule = NAV_MODULES.find((m) => m.href === pathname);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [quickCommand, setQuickCommand] = useState("");
  const quickCommandRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUserEmail(user?.email ?? null);
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name")
          .eq("user_id", user.id)
          .single();
        setUserName(profile?.name || null);
      }
      setLoadingUser(false);
    });
  }, []);

  useEffect(() => {
    function handleQuickCommand(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        quickCommandRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleQuickCommand);
    return () => window.removeEventListener("keydown", handleQuickCommand);
  }, []);

  const displayName = userName || userEmail;

  function openQuickCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const command = quickCommand.trim();
    if (!command) return;

    // Expense-like input uses the existing confirmation flow; everything else stays conversational.
    const looksLikeExpense = /(?:gast[ée]|pagu[ée]|compr[ée]|cobr[ée]|ingres[ée]|recib[íi]|dinero|\$|\b\d+\s*k\b)/i.test(command);
    router.push(looksLikeExpense
      ? `/finanzas?captura=${encodeURIComponent(command)}`
      : `/omni?consulta=${encodeURIComponent(command)}`);
    setQuickCommand("");
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background px-4 md:px-6">
      <div className="flex items-center gap-3">
        <MobileNav />
        <div>
          <p className="hud-label mb-1 hidden md:block">EL ESCUDO</p>
          <h1 className="font-heading text-sm font-bold uppercase tracking-[0.08em] text-foreground md:text-base">
            {activeModule?.id === "dashboard" ? "Bitácora de viaje" : activeModule?.label ?? "El Escudo"}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <Link
          href="/omni"
          className="inline-flex h-9 items-center gap-2 border border-[#7C5DFF] bg-secondary px-3 font-mono text-[11px] uppercase text-[#d5ccff] transition-colors hover:bg-[#7C5DFF] hover:text-black"
          aria-label="Abrir OMNI"
          title="Hablar con OMNI"
        >
          <Sparkles className="h-4 w-4" />
          <span className="hidden xl:inline">OMNI</span>
        </Link>
        <form onSubmit={openQuickCommand} className="hidden items-center gap-2 lg:flex">
          <Sparkles className="h-4 w-4 text-[#7C5DFF]" aria-hidden="true" />
          <input
            ref={quickCommandRef}
            value={quickCommand}
            onChange={(event) => setQuickCommand(event.target.value)}
            placeholder="Comando rápido: gasto, tarea o idea"
            aria-label="Escribir un comando rápido"
            className="h-9 w-56 border border-border bg-secondary px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-[#7C5DFF] xl:w-72"
          />
        </form>
        <Link
          href="/finanzas#captura-rapida"
          className="inline-flex h-9 w-9 items-center justify-center border border-border bg-secondary text-[#FFD700] transition-colors hover:border-[#FFD700] lg:hidden"
          aria-label="Registrar gasto rápido"
          title="Registrar gasto rápido"
        >
          <Wallet className="h-4 w-4" />
        </Link>
        <Bell className="hidden h-4 w-4 text-muted-foreground md:block" aria-hidden="true" />
        {loadingUser ? (
          <span className="flex h-9 w-9 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </span>
        ) : userEmail ? (
          <div className="flex items-center gap-2">
            <Link
              href="/perfil"
              className="hidden text-sm text-muted-foreground hover:text-foreground transition-colors md:block"
            >
              {displayName}
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center border border-border bg-secondary text-muted-foreground transition-colors hover:text-foreground"
                )}
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </form>
          </div>
        ) : (
          <Link
            href="/login"
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center border border-border bg-secondary text-muted-foreground transition-colors hover:text-foreground"
            )}
            aria-label="Iniciar sesión"
          >
            <User className="h-5 w-5" />
          </Link>
        )}
      </div>
    </header>
  );
}
