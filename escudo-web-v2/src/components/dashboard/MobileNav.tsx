"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Shield, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { NAV_GROUPS, NAV_MODULES, type NavModule } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils";

function MobileNavLink({
  module: mod,
  active,
  onClick,
}: {
  module: NavModule;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = mod.icon;
  const isOmni = mod.id === "omni";
  const tone = "text-[#bcaeff]";

  return (
    <Link
      href={mod.href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-3 text-sm transition-colors",
        active ? "bg-current/10" : "text-muted-foreground hover:bg-secondary",
        tone,
      )}
    >
      <span className="relative inline-flex">
        <Icon className="h-5 w-5" />
        {isOmni && (
          <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[#7c5dff] animate-pulse-led" />
        )}
      </span>
      <span className="font-medium">{isOmni ? "> OMNI_" : mod.label}</span>
    </Link>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="inline-flex h-10 w-10 items-center justify-center rounded-md text-foreground transition-colors hover:bg-secondary md:hidden"
        aria-label="Abrir menú"
      >
        <Menu className="h-6 w-6" />
      </SheetTrigger>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="w-[280px] border-r border-border bg-sidebar p-0 h-screen h-[100dvh] max-h-screen max-h-[100dvh] flex flex-col overflow-hidden"
      >
        <SheetHeader className="px-4 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-escudo-gold" />
              <SheetTitle className="font-mono text-lg font-bold tracking-tight text-escudo-gold">
                EL ESCUDO
              </SheetTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              aria-label="Cerrar menú"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <Separator className="my-4 bg-sidebar-border" />

        <nav className="flex-1 overflow-y-auto px-3 pb-6 flex flex-col gap-6">
          {NAV_GROUPS.map((group) => {
            const items = NAV_MODULES.filter((m) => m.group === group.key);
            if (items.length === 0) return null;

            return (
              <div key={group.key} className="flex flex-col gap-1">
                <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-escudo-gold/80">
                  {group.label}
                </span>
                {items.map((mod) => (
                  <MobileNavLink
                    key={mod.id}
                    module={mod}
                    active={pathname === mod.href}
                    onClick={() => setOpen(false)}
                  />
                ))}
              </div>
            );
          })}
        </nav>

        <div className="mt-auto px-4 pb-4">
          <div className="rounded-md bg-secondary px-3 py-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">v2.0.0-alpha</p>
            <p>Modo preparación</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
