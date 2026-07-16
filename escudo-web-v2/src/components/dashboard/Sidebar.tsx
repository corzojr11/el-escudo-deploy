"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { NAV_GROUPS, NAV_MODULES, type NavModule } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const GROUP_TONES = {
  inicio: "text-orange-400",
  productividad: "text-blue-400",
  finanzas: "text-yellow-300",
  bienestar: "text-fuchsia-400",
} as const;

function getNavTone(module: NavModule) {
  if (module.id === "omni") {
    return {
      active: "border-lime-400/60 bg-lime-400/10 text-lime-300",
      idle: "text-lime-400 hover:border-lime-400/40 hover:bg-lime-400/10 hover:text-lime-300",
    };
  }

  return {
    inicio: {
      active: "border-orange-400/60 bg-orange-400/10 text-orange-300",
      idle: "text-muted-foreground hover:border-orange-400/40 hover:bg-orange-400/10 hover:text-orange-300",
    },
    productividad: {
      active: "border-blue-400/60 bg-blue-400/10 text-blue-300",
      idle: "text-muted-foreground hover:border-blue-400/40 hover:bg-blue-400/10 hover:text-blue-300",
    },
    finanzas: {
      active: "border-yellow-300/60 bg-yellow-300/10 text-yellow-200",
      idle: "text-muted-foreground hover:border-yellow-300/40 hover:bg-yellow-300/10 hover:text-yellow-200",
    },
    bienestar: {
      active: "border-fuchsia-400/60 bg-fuchsia-400/10 text-fuchsia-300",
      idle: "text-muted-foreground hover:border-fuchsia-400/40 hover:bg-fuchsia-400/10 hover:text-fuchsia-300",
    },
  }[module.group];
}

function NavLink({
  module: mod,
  collapsed,
  active,
}: {
  module: NavModule;
  collapsed: boolean;
  active: boolean;
}) {
  const Icon = mod.icon;
  const isOmni = mod.id === "omni";
  const tone = getNavTone(mod);

  return (
    <Link
      href={mod.href}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200",
        "border",
        active ? tone.active : tone.idle,
        collapsed && "justify-center px-2",
        isOmni && "text-lime-400"
      )}
      title={collapsed ? mod.label : undefined}
    >
      <span className="relative inline-flex">
        <Icon className="h-5 w-5 shrink-0" />
        {isOmni && (
          <span className="animate-pulse-led absolute -right-1 -top-1 h-2 w-2 rounded-full bg-lime-400" />
        )}
      </span>
      {!collapsed && (
        <span className="truncate font-medium">
          {isOmni ? "> OMNI_" : mod.label}
        </span>
      )}
    </Link>
  );
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 md:flex",
        collapsed ? "w-[4.5rem]" : "w-64"
      )}
    >
      <div className="flex h-16 items-center justify-between px-4">
        <div className={cn("flex items-center gap-2", collapsed && "w-full justify-center")}>
          <Shield className="h-6 w-6 text-primary" />
          {!collapsed && (
            <span className="font-heading text-lg font-bold tracking-[0.16em] text-glow text-foreground">
              EL ESCUDO
            </span>
          )}
        </div>
        {!collapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label="Colapsar sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      {collapsed && (
        <div className="flex justify-center pb-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label="Expandir sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Separator className="bg-sidebar-border" />

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="flex flex-col gap-6">
          {NAV_GROUPS.map((group) => {
            const items = NAV_MODULES.filter((m) => m.group === group.key);
            if (items.length === 0) return null;

            return (
              <div key={group.key} className="flex flex-col gap-1">
                {!collapsed && (
                  <span className={cn("hud-label px-3", GROUP_TONES[group.key])}>{group.label}</span>
                )}
                {items.map((mod) => (
                  <NavLink
                    key={mod.id}
                    module={mod}
                    collapsed={collapsed}
                    active={pathname === mod.href}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </nav>

      <Separator className="bg-sidebar-border" />

      <div className={cn("p-3", collapsed && "flex justify-center")}>
        {!collapsed ? (
          <div className="border border-primary/25 bg-primary/8 px-3 py-2 text-xs text-muted-foreground">
            <p className="font-mono text-sm font-bold text-primary">v2.0.0</p>
            <p>Modo arcade</p>
          </div>
        ) : (
          <span className="text-[10px] text-muted-foreground">v2</span>
        )}
      </div>
    </aside>
  );
}
