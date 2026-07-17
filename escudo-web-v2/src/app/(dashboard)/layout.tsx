"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Topbar } from "@/components/dashboard/Topbar";
import { NAV_MODULES } from "@/lib/constants/navigation";
import { createClient } from "@/lib/auth/client";
import { cn } from "@/lib/utils";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const activeModule = NAV_MODULES.find((module) => module.href === pathname);

  useEffect(() => {
    if (pathname === "/onboarding" || pathname === "/perfil") return;

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("profiles")
        .select("onboarding_completed_at")
        .eq("user_id", user.id)
        .single()
        .then(({ data }) => {
          if (!data?.onboarding_completed_at) {
            router.push("/onboarding");
          }
        });
    });
  }, [pathname, router]);

  return (
    <div data-theme={activeModule?.id ?? "dashboard"} className="relative flex min-h-screen overflow-hidden">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />

      <div
        className={cn(
          "relative z-10 flex flex-1 flex-col transition-all duration-300 md:ml-[4.5rem]",
          !collapsed && "md:ml-56"
        )}
      >
        <Topbar />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
