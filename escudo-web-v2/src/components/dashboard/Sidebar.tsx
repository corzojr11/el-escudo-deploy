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

  return (
    <Link
      href={mod.href}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200",
        active
          ? "border border-accent/50 bg-accent/10 text-accent shadow-[0_0_22px_rgba(53,244,255,0.2)]"
          : "border border-transparent text-muted-foreground hover:border-primary/45 hover:bg-primary/10 hover:text-foreground",
        collapsed && "justify-center px-2",
        isOmni && "text-escudo-green hover:bg-escudo-green/10 hover:text-escudo-green"
      )}
      title={collapsed ? mod.label : undefined}
    >
      <span className="relative inline-flex">
        <Icon className={cn("h-5 w-5 shrink-0", isOmni && "text-escudo-green")} />
        {isOmni && (
          <span className="animate-pulse-led absolute -right-1 -top-1 h-2 w-2 rounded-full bg-escudo-green" />
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
        "fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-sidebar-border bg-sidebar/95 backdrop-blur-xl transition-all duration-300 md:flex",
        collapsed ? "w-[4.5rem]" : "w-64"
      )}
    >
      <div className="flex h-16 items-center justify-between px-4">
        <div className={cn("flex items-center gap-2", collapsed && "w-full justify-center")}>
          <Shield className="h-6 w-6 text-primary drop-shadow-[0_0_12px_rgba(255,122,0,0.58)]" />
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
                  <span className="hud-label px-3 text-accent/80">{group.label}</span>
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
