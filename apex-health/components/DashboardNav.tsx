"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import {
  Activity,
  BatteryCharging,
  Gauge,
  HeartPulse,
  LogOut,
  PencilLine,
  UtensilsCrossed,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard/vitals", label: "Vitals", icon: HeartPulse },
  { href: "/dashboard/recovery", label: "Recovery", icon: BatteryCharging },
  { href: "/dashboard/training", label: "Training", icon: Gauge },
  { href: "/dashboard/nutrition", label: "Nutrition", icon: UtensilsCrossed },
  { href: "/dashboard/manual-entry", label: "Manual Entry", icon: PencilLine },
];

export function DashboardNav() {
  const pathname = usePathname();
  const { signOut } = useAuthActions();
  const router = useRouter();

  return (
    <nav className="border-apex-border bg-apex-card sticky top-0 z-40 flex shrink-0 gap-1 overflow-x-auto border-b p-3 md:static md:h-screen md:w-56 md:flex-col md:gap-2 md:overflow-visible md:border-r md:border-b-0 md:p-4">
      <Link
        href="/dashboard"
        className="mb-0 flex items-center gap-2 px-2 md:mb-6"
      >
        <span className="bg-apex-cyan/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
          <Activity className="text-apex-cyan h-4 w-4" />
        </span>
        <span className="hidden text-sm font-bold tracking-wide text-slate-100 uppercase md:inline">
          Apex Health
        </span>
      </Link>

      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm whitespace-nowrap transition-colors ${
              active
                ? "bg-apex-cyan/10 text-apex-cyan"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        );
      })}

      <button
        type="button"
        onClick={async () => {
          await signOut();
          router.push("/login");
        }}
        className="mt-0 flex items-center gap-3 rounded-xl px-3 py-2 text-sm whitespace-nowrap text-slate-500 hover:bg-white/5 hover:text-slate-300 md:mt-auto"
      >
        <LogOut className="h-4 w-4 shrink-0" />
        <span className="hidden md:inline">Sign out</span>
      </button>
    </nav>
  );
}
