"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { NAV_GROUPS, NAV_MODULES, type NavModule } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const DEFAULT_EXPANDED: Record<string, boolean> = {
  inicio: true,
  productividad: false,
  finanzas: false,
  bienestar: false,
};

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
        "group flex items-center gap-3 px-3 py-2 text-sm transition-colors duration-200 border-l-2",
        active
          ? "border-[#7c5dff] bg-[#7c5dff]/10 text-[#d5ccff]"
          : "border-transparent text-muted-foreground hover:border-[#7c5dff]/40 hover:bg-[#7c5dff]/5 hover:text-foreground",
        collapsed && "justify-center border-l-0 px-2",
      )}
      title={collapsed ? mod.label : undefined}
    >
      <span className="relative inline-flex">
        <Icon className="h-5 w-5 shrink-0" />
        {isOmni && (
          <span className="animate-pulse-led absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[#7c5dff]" />
        )}
      </span>
      {!collapsed && (
        <span className="truncate font-medium text-sm">
          {isOmni ? "OMNI" : mod.label}
        </span>
      )}
      {!collapsed && isOmni && (
        <span className="ml-auto font-mono text-[9px] uppercase text-[#7c5dff]/70 border border-[#7c5dff]/30 px-1.5 py-0.5">
          IA
        </span>
      )}
      {!collapsed && mod.badge && !isOmni && (
        <span className="ml-auto font-mono text-[9px] uppercase text-muted-foreground border border-border px-1.5 py-0.5">
          {mod.badge}
        </span>
      )}
    </Link>
  );
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(DEFAULT_EXPANDED);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isGroupExpanded = (key: string) => {
    if (collapsed) return true;
    return expandedGroups[key] ?? false;
  };

  const hasActiveChild = (groupKey: string) => {
    return NAV_MODULES.some((m) => m.group === groupKey && pathname === m.href);
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 md:flex",
        collapsed ? "w-[4.5rem]" : "w-56"
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
              className="h-8 w-8 rounded-none text-muted-foreground hover:bg-secondary hover:text-foreground"
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
            className="h-8 w-8 rounded-none text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Expandir sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Separator className="bg-sidebar-border" />

      <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-none">
        <div className="flex flex-col gap-3">
          {NAV_GROUPS.map((group) => {
            const items = NAV_MODULES.filter((m) => m.group === group.key);
            if (items.length === 0) return null;
            const expanded = isGroupExpanded(group.key);
            const active = hasActiveChild(group.key);

            return (
              <div key={group.key} className="flex flex-col">
                {!collapsed ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 text-left text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors",
                      active
                        ? "text-[#d5ccff]"
                        : "text-muted-foreground/60 hover:text-muted-foreground",
                    )}
                  >
                    <ChevronDown
                      className={cn(
                        "h-3 w-3 shrink-0 transition-transform duration-200",
                        !expanded && "-rotate-90",
                      )}
                    />
                    {group.label}
                    {!expanded && active && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#7c5dff]" />
                    )}
                  </button>
                ) : null}
                <div
                  className={cn(
                    "flex flex-col gap-0.5 overflow-hidden transition-all duration-200",
                    collapsed || expanded ? "max-h-96 opacity-100 mt-1" : "max-h-0 opacity-0",
                  )}
                >
                  {items.map((mod) => (
                    <NavLink
                      key={mod.id}
                      module={mod}
                      collapsed={collapsed}
                      active={pathname === mod.href}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </nav>

      <Separator className="bg-sidebar-border" />

      <div className={cn("p-3", collapsed && "flex justify-center")}>
        {!collapsed ? (
          <div className="border border-border bg-secondary px-3 py-2 text-xs text-muted-foreground">
            <p className="font-mono text-sm font-bold text-primary">v2.0.0</p>
            <p>Bitácora personal</p>
          </div>
        ) : (
          <span className="text-[10px] text-muted-foreground">v2</span>
        )}
      </div>
    </aside>
  );
}
