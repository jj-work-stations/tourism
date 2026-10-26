"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BadgePercent,
  BarChart3,
  BedDouble,
  BellRing,
  CalendarRange,
  CircleDollarSign,
  Compass,
  CreditCard,
  Headset,
  History,
  Landmark,
  LayoutGrid,
  LifeBuoy,
  Megaphone,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Ticket,
  Trophy,
  UserRound,
  Users,
  Menu,
  X,
} from "lucide-react";

import { RequireAuth } from "@/components/require-auth";
import { PersianDivider } from "@/components/persian-decorations";
import { useAuth } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
}

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "نمای کلی", icon: BarChart3 },
  { href: "/admin/bookings", label: "رزروها", icon: Ticket },
  { href: "/admin/payments", label: "پرداخت‌ها و بازگشت وجه", icon: CreditCard },
  { href: "/admin/users", label: "کاربران و دسترسی‌ها", icon: Users, roles: ["admin"] },
  { href: "/admin/providers", label: "ارائه‌دهندگان", icon: ShoppingBag },
  { href: "/admin/reviews", label: "مدیریت نظرات", icon: Star },
  { href: "/admin/content", label: "مدیریت محتوا", icon: Compass },
  { href: "/admin/marketing", label: "کمپین‌ها و تخفیف‌ها", icon: Megaphone },
  { href: "/admin/support", label: "پشتیبانی و اعلان‌ها", icon: Headset },
  { href: "/admin/audit", label: "لاگ فعالیت‌ها", icon: History, roles: ["admin", "content_manager"] },
  { href: "/admin/settings", label: "تنظیمات سیستم", icon: Settings, roles: ["admin"] },
];

const PROVIDER_NAV: NavItem[] = [
  { href: "/provider", label: "نمای کلی", icon: BarChart3 },
  { href: "/provider/bookings", label: "رزروهای من", icon: CalendarRange },
  { href: "/provider/services", label: "مدیریت خدمات", icon: BedDouble },
  { href: "/provider/financial", label: "گزارش مالی", icon: CircleDollarSign },
  { href: "/provider/reviews", label: "نظرات مهمانان", icon: Star },
];

const ROLE_LABEL: Record<string, string> = {
  admin: "مدیر سیستم",
  content_manager: "مدیر محتوا",
  marketing_manager: "مدیر بازاریابی",
  support_agent: "کارشناس پشتیبانی",
  provider: "ارائه‌دهنده خدمات",
  traveler: "مسافر",
};

const NAV_LABEL: Record<string, string> = {
  admin: "پنل مدیریت سیر",
  provider: "پنل ارائه‌دهنده",
};

/** Ornamental medallion used in the sidebar footer. */
function Medallion() {
  return (
    <svg viewBox="0 0 48 48" className="h-9 w-9 text-gold-400/80" aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M24 4 C33 4 40 10 40 19 C40 29 30 37 24 43 C18 37 8 29 8 19 C8 10 15 4 24 4 Z" />
        <path d="M24 12 C28 12 31 15 31 19 C31 24 26 28 24 31 C22 28 17 24 17 19 C17 15 20 12 24 12 Z" />
        <circle cx="24" cy="19" r="1.6" fill="currentColor" />
      </g>
    </svg>
  );
}

export function DashboardShell({
  portal,
  title,
  subtitle,
  badge,
  headerAction,
  children,
}: {
  portal: "admin" | "provider";
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const user = useAuth((state) => state.user);
  const [navOpen, setNavOpen] = useState(false);
  const nav =
    portal === "admin"
      ? ADMIN_NAV.filter((item) => !item.roles || item.roles.includes(user?.role ?? ""))
      : PROVIDER_NAV;

  const body = (
    <div className="dash-shell">
      <aside
        className={cn(
          "dash-sidebar h-fit lg:sticky lg:top-6",
          "max-lg:fixed max-lg:inset-x-4 max-lg:top-4 max-lg:z-50 max-lg:flex max-lg:max-h-[calc(100vh-2rem)] max-lg:flex-col max-lg:overflow-y-auto",
          !navOpen && "max-lg:hidden",
        )}
      >
        <div className="relative z-10 flex items-center justify-between px-2 pb-3 pt-1">
          <Link href="/" className="flex items-center gap-2.5">
            <Medallion />
            <div>
              <div className="text-sm font-black tracking-tight">سیر</div>
              <div className="text-[10px] text-white/45">سوپراپ سفر ایران</div>
            </div>
          </Link>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-xl bg-white/10 lg:hidden"
            onClick={() => setNavOpen(false)}
            aria-label="بستن فهرست"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="relative z-10 my-2 h-px bg-gradient-to-l from-transparent via-white/20 to-transparent" />
        <nav className="relative z-10 mt-1 flex flex-col gap-1">
          {nav.map((item) => {
            const active =
              item.href === pathname ||
              (item.href !== "/admin" &&
                item.href !== "/provider" &&
                pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setNavOpen(false)}
                className={cn("dash-nav-link", active && "dash-nav-link-active")}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="relative z-10 mt-auto pt-6">
          <Link
            href="/"
            className="dash-nav-link !text-white/45 hover:!text-white/80"
          >
            <Compass className="h-4 w-4" />
            بازگشت به سایت
          </Link>
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/[0.07] p-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gold-400/20 text-gold-300">
              <UserRound className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-xs font-bold text-white">{user?.full_name}</div>
              <div className="truncate text-[10px] text-white/40">{user?.email || user?.phone}</div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-center gap-2 pb-1 text-[9px] text-white/25">
            <span>پنل اختصاصی</span>
            <span className="h-1 w-1 rounded-full bg-gold-400/50" />
            <span>{ROLE_LABEL[user?.role ?? ""] || user?.role}</span>
          </div>
        </div>
      </aside>

      <div className="min-w-0 space-y-6">
        <header className="dash-header">
          <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-bold text-gold-300">
                <Sparkles className="h-3.5 w-3.5" />
                {NAV_LABEL[portal]}
                {badge}
              </div>
              <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{title}</h1>
              {subtitle && <p className="mt-2 max-w-2xl text-[13px] leading-6 text-white/60">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-2">
              {headerAction}
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-white/80 lg:hidden"
                onClick={() => setNavOpen(true)}
                aria-label="باز کردن فهرست"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="pointer-events-none absolute -bottom-6 left-8 opacity-50">
            <PersianDivider className="w-64 text-gold-300/40" />
          </div>
        </header>
        {children}
      </div>
    </div>
  );
  return body;
}

export function DashboardLayout({
  portal,
  roles,
  children,
}: {
  portal: "admin" | "provider";
  roles: string[];
  children: React.ReactNode;
}) {
  return <RequireAuth roles={roles}>{children}</RequireAuth>;
}
