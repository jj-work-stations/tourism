"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  ChevronDown,
  Compass,
  Heart,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  Plane,
  Search,
  Sparkles,
  Ticket,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "خانه" },
  { href: "/destinations", label: "مقصدها" },
  { href: "/stays", label: "اقامتگاه‌ها" },
  { href: "/attractions", label: "جاذبه‌ها" },
  { href: "/experiences", label: "تجربه‌ها" },
  { href: "/restaurants", label: "رستوران‌ها", secondary: true },
  { href: "/map", label: "نقشه", secondary: true },
  { href: "/search", label: "جستجوی سفر", secondary: true },
];

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="group flex items-center gap-2.5">
      <span className="relative grid h-10 w-10 place-items-center rounded-2xl bg-brand-700 text-white shadow-soft transition group-hover:rotate-6">
        <Compass className="h-5 w-5" strokeWidth={2.2} />
        <span className="absolute -left-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-sand-400" />
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-xl font-black tracking-tight text-ink">سیر</span>
          <span className="block text-[10px] font-medium text-ink/45">سوپراپ سفر ایران</span>
        </span>
      )}
    </Link>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, tokens, hydrated, clear } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  const loggedIn = Boolean(tokens?.access_token && user);

  function logout() {
    clear();
    setAccountOpen(false);
    toast.success("از حساب خود خارج شدید.");
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur-xl">
      <div className="container-app flex h-[72px] items-center justify-between gap-3">
        <div className="flex items-center gap-8">
          <Brand />
          <nav className="hidden items-center gap-0.5 lg:flex">
            {NAV.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-xl px-2.5 py-2 text-[13px] font-medium transition xl:px-3.5 xl:text-sm",
                    item.secondary && "hidden xl:block",
                    active
                      ? "bg-brand-50 text-brand-800"
                      : "text-ink/60 hover:bg-black/[0.04] hover:text-ink",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/search"
            className="hidden h-10 w-10 place-items-center rounded-xl text-ink/60 transition hover:bg-black/5 hover:text-ink sm:grid"
            aria-label="جستجو"
          >
            <Search className="h-[18px] w-[18px]" />
          </Link>
          <Link
            href="/assistant"
            className="hidden items-center gap-2 rounded-xl bg-gradient-to-l from-brand-700 to-brand-500 px-4 py-2.5 text-xs font-bold text-white shadow-soft transition hover:opacity-95 md:flex"
          >
            <Sparkles className="h-4 w-4" />
            برنامه‌ریز هوشمند
          </Link>

          {!hydrated ? (
            <span className="h-10 w-24 animate-pulse rounded-xl bg-black/5" />
          ) : loggedIn ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setAccountOpen((v) => !v)}
                className="flex items-center gap-2 rounded-2xl border border-black/5 bg-white py-1.5 pl-1.5 pr-3 text-sm transition hover:border-brand-700/20"
              >
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-50 text-brand-800">
                  <UserRound className="h-4 w-4" />
                </span>
                <span className="hidden max-w-[110px] truncate font-semibold text-ink/80 sm:block">
                  {user?.full_name}
                </span>
                <ChevronDown className={cn("h-4 w-4 text-ink/40 transition", accountOpen && "rotate-180")} />
              </button>

              {accountOpen && (
                <>
                  <button
                    className="fixed inset-0 z-10 cursor-default"
                    aria-label="بستن منو"
                    onClick={() => setAccountOpen(false)}
                  />
                  <div className="absolute left-0 z-20 mt-2 w-64 overflow-hidden rounded-2xl border border-black/5 bg-white p-2 shadow-soft">
                    <div className="mb-1 rounded-xl bg-brand-50/70 px-3 py-2.5">
                      <div className="text-sm font-bold text-ink">{user?.full_name}</div>
                      <div className="mt-0.5 text-[11px] text-ink/50">{user?.email || user?.phone}</div>
                    </div>
                    {[
                      { href: "/account", label: "داشبورد من", icon: LayoutDashboard },
                      { href: "/account/bookings", label: "رزروها و بلیت‌ها", icon: Ticket },
                      { href: "/account/trips", label: "سفرهای من", icon: Map },
                      { href: "/account/wallet", label: "کیف پول", icon: Wallet },
                      { href: "/account/favorites", label: "علاقه‌مندی‌ها", icon: Heart },
                      { href: "/account/notifications", label: "اعلان‌ها", icon: Bell },
                    ].map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-ink/70 transition hover:bg-black/[0.04] hover:text-ink"
                      >
                        <item.icon className="h-4 w-4 text-ink/40" />
                        {item.label}
                      </Link>
                    ))}
                    {(user?.role === "admin" || user?.role === "support_agent" ||
                      user?.role === "content_manager" || user?.role === "marketing_manager") && (
                      <Link
                        href="/admin"
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-brand-800 transition hover:bg-brand-50"
                      >
                        <LayoutDashboard className="h-4 w-4" />
                        پنل مدیریت
                      </Link>
                    )}
                    {user?.role === "provider" && (
                      <Link
                        href="/provider"
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-brand-800 transition hover:bg-brand-50"
                      >
                        <Plane className="h-4 w-4" />
                        پنل ارائه‌دهنده
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={logout}
                      className="mt-1 flex w-full items-center gap-2.5 rounded-xl border-t border-black/5 px-3 py-2.5 text-sm text-rose-600 transition hover:bg-rose-50"
                    >
                      <LogOut className="h-4 w-4" />
                      خروج از حساب
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-ink/70 transition hover:text-ink sm:block">
                ورود
              </Link>
              <Link href="/register" className="btn-primary !rounded-xl !px-4 !py-2.5 !text-xs">
                ثبت‌نام
              </Link>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="grid h-10 w-10 place-items-center rounded-xl text-ink/70 transition hover:bg-black/5 lg:hidden"
            aria-label="منو"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-black/5 bg-white lg:hidden">
          <div className="container-app grid gap-1 py-3">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl px-3 py-3 text-sm font-medium text-ink/75 hover:bg-brand-50"
              >
                {item.label}
              </Link>
            ))}
            {!loggedIn && (
              <Link href="/login" className="rounded-xl px-3 py-3 text-sm font-semibold text-brand-800 hover:bg-brand-50">
                ورود / ثبت‌نام
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
