import {
  LayoutDashboard,
  Zap,
  Wallet,
  Target,
  Heart,
  CalendarClock,
  CheckSquare,
  Flag,
  type LucideIcon,
} from "lucide-react";

export interface NavModule {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  group: "inicio" | "productividad" | "bienestar" | "finanzas";
  badge?: string;
}

export const NAV_MODULES: NavModule[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    group: "inicio",
  },
  {
    id: "omni",
    label: "OMNI",
    href: "/omni",
    icon: Zap,
    group: "inicio",
    badge: "IA",
  },
  {
    id: "metas",
    label: "Metas",
    href: "/metas",
    icon: Target,
    group: "productividad",
  },
  {
    id: "habitos",
    label: "Habitos",
    href: "/habitos",
    icon: CheckSquare,
    group: "productividad",
  },
  {
    id: "misiones",
    label: "Misiones",
    href: "/misiones",
    icon: Flag,
    group: "productividad",
  },
  {
    id: "turnos",
    label: "Turnos",
    href: "/turnos",
    icon: CalendarClock,
    group: "productividad",
  },
  {
    id: "finanzas",
    label: "Finanzas",
    href: "/finanzas",
    icon: Wallet,
    group: "finanzas",
  },
  {
    id: "salud",
    label: "Salud",
    href: "/salud",
    icon: Heart,
    group: "bienestar",
  },
];

export const NAV_GROUPS = [
  { key: "inicio", label: "Inicio" },
  { key: "productividad", label: "Productividad" },
  { key: "finanzas", label: "Finanzas" },
  { key: "bienestar", label: "Bienestar" },
] as const;
