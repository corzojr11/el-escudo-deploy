"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, User, LogOut, Loader2 } from "lucide-react";
import { MobileNav } from "./MobileNav";
import { NAV_MODULES } from "@/lib/constants/navigation";
import { createClient } from "@/lib/auth/client";
import { logout } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

export function Topbar() {
  const pathname = usePathname();
  const activeModule = NAV_MODULES.find((m) => m.href === pathname);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? null);
      setLoadingUser(false);
    });
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background px-4 md:px-6">
      <div className="flex items-center gap-3">
        <MobileNav />
        <div>
          <p className="hud-label mb-1 hidden md:block">EL ESCUDO</p>
          <h1 className="font-heading text-sm font-bold uppercase tracking-[0.08em] text-foreground md:text-base">
            {activeModule?.id === "dashboard" ? "Bitacora de viaje" : activeModule?.label ?? "El Escudo"}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Bell className="hidden h-4 w-4 text-muted-foreground md:block" aria-hidden="true" />
        {loadingUser ? (
          <span className="flex h-9 w-9 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </span>
        ) : userEmail ? (
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground md:block">
              {userEmail}
            </span>
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
