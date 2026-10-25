"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Heart,
  LayoutDashboard,
  Map,
  Settings2,
  Ticket,
  UserRound,
  Wallet,
} from "lucide-react";

import { useAuth } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/account", label: "داشبورد", icon: LayoutDashboard },
  { href: "/account/bookings", label: "رزروها و بلیت‌ها", icon: Ticket },
  { href: "/account/trips", label: "سفرهای من", icon: Map },
  { href: "/account/wallet", label: "کیف پول و امتیاز", icon: Wallet },
  { href: "/account/favorites", label: "علاقه‌مندی‌ها", icon: Heart },
  { href: "/account/notifications", label: "اعلان‌ها", icon: Bell },
  { href: "/account/profile", label: "پروفایل و امنیت", icon: UserRound },
  { href: "/account/preferences", label: "ترجیحات سفر", icon: Settings2 },
];

export function AccountShell({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const pathname = usePathname();
  const user = useAuth((state) => state.user);

  return (
    <div className="container-app py-8">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-brand-700">حساب کاربری</div>
          <h1 className="mt-1 text-2xl font-black text-ink sm:text-3xl">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-sm text-ink/50">{description}</p>}
        </div>
        {action}
      </div>

      <div className="grid gap-6 lg:grid-cols-[250px_1fr]">
        <aside className="h-fit rounded-3xl border border-black/5 bg-white p-3 shadow-card">
          <div className="mb-2 flex items-center gap-3 rounded-2xl bg-brand-50/70 p-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-brand-700 shadow-sm">
              <UserRound className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-ink">{user?.full_name}</div>
              <div className="text-[10px] text-ink/45">{user?.email || user?.phone}</div>
            </div>
          </div>
          <nav className="grid gap-0.5">
            {LINKS.map((link) => {
              const active =
                link.href === "/account"
                  ? pathname === "/account"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition",
                    active
                      ? "bg-brand-700 font-bold text-white"
                      : "text-ink/65 hover:bg-black/[0.04] hover:text-ink",
                  )}
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
