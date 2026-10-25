"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Coins,
  Compass,
  Map,
  Plane,
  Sparkles,
  Ticket,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { AccountShell } from "@/components/account-shell";
import { RequireAuth } from "@/components/require-auth";
import { Badge, EmptyState, LoadingCards, SmartImage, Stat } from "@/components/ui";
import { useApiQuery } from "@/lib/hooks";
import { bookingStatus, date, levelLabel, toman } from "@/lib/format";
import type { Booking, Gamification, Page, Wallet as WalletType } from "@/lib/types";

interface Stats {
  trips: number;
  bookings: number;
  total_spent: number;
  member_since: string;
  xp: number;
  level: string;
  points: number;
}

function Dashboard() {
  const stats = useApiQuery<Stats>(["account", "stats"], "/users/me/stats");
  const wallet = useApiQuery<WalletType>(["account", "wallet"], "/wallet");
  const gamification = useApiQuery<Gamification>(["account", "gamification"], "/gamification/profile");
  const bookings = useApiQuery<Page<Booking>>(["account", "bookings", "recent"], "/bookings", {
    page_size: 3,
  });
  const notifications = useApiQuery<Page<{ id: string; title: string; body: string; is_read: boolean; created_at: string }>>(
    ["account", "notifications", "recent"],
    "/notifications",
    { page_size: 4 },
  );

  const level = gamification.data?.level ?? stats.data?.level ?? "bronze";
  const progress = gamification.data?.level_progress ?? 0;

  return (
    <AccountShell
      title="داشبورد من"
      description="خلاصه سفرها، رزروها، کیف پول و پیشرفت پاسپورت سفر شما."
      action={
        <Link href="/assistant" className="btn-primary !py-2.5 !text-xs">
          <Sparkles className="h-4 w-4" /> برنامه سفر جدید
        </Link>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="سفرهای من" value={new Intl.NumberFormat("fa-IR").format(stats.data?.trips ?? 0)} icon={<Map className="h-5 w-5" />} />
        <Stat label="رزروها" value={new Intl.NumberFormat("fa-IR").format(stats.data?.bookings ?? 0)} icon={<Ticket className="h-5 w-5" />} tone="sky" />
        <Stat label="مجموع هزینه" value={toman(stats.data?.total_spent ?? 0, true)} icon={<TrendingUp className="h-5 w-5" />} tone="sand" />
        <Stat label="موجودی کیف پول" value={toman(wallet.data?.balance ?? 0, true)} icon={<Wallet className="h-5 w-5" />} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-brand-700">پاسپورت سفر</div>
              <h2 className="mt-1 text-lg font-black text-ink">سطح {levelLabel[level] ?? level}</h2>
            </div>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-500">
              <Coins className="h-6 w-6" />
            </span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/[0.06]">
            <div className="h-full rounded-full bg-gradient-to-l from-brand-700 to-brand-400" style={{ width: `${Math.min(100, Math.round(progress * 100))}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-ink/45">
            <span>{new Intl.NumberFormat("fa-IR").format(gamification.data?.xp ?? 0)} XP</span>
            <span>{new Intl.NumberFormat("fa-IR").format(gamification.data?.xp_to_next_level ?? 0)} XP تا سطح بعد</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-black/[0.025] p-3">
              <div className="text-lg font-black text-ink">{new Intl.NumberFormat("fa-IR").format(gamification.data?.stamps.length ?? 0)}</div>
              <div className="text-[10px] text-ink/40">مهر سفر</div>
            </div>
            <div className="rounded-2xl bg-black/[0.025] p-3">
              <div className="text-lg font-black text-ink">{new Intl.NumberFormat("fa-IR").format(gamification.data?.achievements.filter((a) => a.unlocked).length ?? 0)}</div>
              <div className="text-[10px] text-ink/40">دستاورد</div>
            </div>
            <div className="rounded-2xl bg-black/[0.025] p-3">
              <div className="text-lg font-black text-ink">{new Intl.NumberFormat("fa-IR").format(gamification.data?.points ?? 0)}</div>
              <div className="text-[10px] text-ink/40">امتیاز</div>
            </div>
          </div>
          <Link href="/account/wallet" className="btn-secondary mt-4 w-full !py-2.5 !text-xs">
            مشاهده پاسپورت و کیف پول
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-ink">اعلان‌های اخیر</h2>
            <Link href="/account/notifications" className="text-[11px] font-bold text-brand-800">همه</Link>
          </div>
          <div className="mt-3 space-y-2">
            {(notifications.data?.items ?? []).map((item) => (
              <Link key={item.id} href="/account/notifications" className="block rounded-xl border border-black/5 p-2.5 transition hover:bg-brand-50/40">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-ink">
                  {!item.is_read && <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />}
                  {item.title}
                </div>
                <p className="mt-1 line-clamp-1 text-[10px] text-ink/45">{item.body}</p>
              </Link>
            ))}
            {notifications.data && notifications.data.items.length === 0 && (
              <div className="py-6 text-center text-xs text-ink/40">اعلان جدیدی ندارید.</div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-black text-ink">رزروهای اخیر</h2>
          <Link href="/account/bookings" className="text-[11px] font-bold text-brand-800">همه رزروها</Link>
        </div>
        {bookings.isLoading ? (
          <LoadingCards count={2} />
        ) : bookings.data && bookings.data.items.length > 0 ? (
          <div className="space-y-3">
            {bookings.data.items.map((booking) => {
              const status = bookingStatus[booking.status] ?? { label: booking.status, tone: "slate" };
              return (
                <Link key={booking.id} href={`/bookings/${booking.id}`} className="card flex items-center gap-3 p-3 transition hover:shadow-soft">
                  <SmartImage src={booking.image_url} alt={booking.title} className="h-16 w-16 rounded-2xl" fallbackClassName="h-16 w-16 rounded-2xl" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-ink">{booking.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-ink/40">
                      <span className="font-mono">{booking.code}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {date(booking.travel_date || booking.check_in || booking.created_at)}</span>
                    </div>
                  </div>
                  <div className="text-left">
                    <Badge tone={status.tone}>{status.label}</Badge>
                    <div className="mt-1 text-xs font-black text-brand-800">{toman(booking.total, true)}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={<Ticket className="h-6 w-6" />}
            title="هنوز رزروی ندارید"
            description="اولین سفر خود را جستجو کنید و بلیت یا اقامتگاه رزرو کنید."
            action={<Link href="/search" className="btn-primary mt-2"><Plane className="h-4 w-4" /> جستجوی سفر</Link>}
          />
        )}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { href: "/account/trips", label: "برنامه‌های سفر", icon: Compass },
          { href: "/account/favorites", label: "علاقه‌مندی‌ها", icon: Sparkles },
          { href: "/support", label: "پشتیبانی", icon: Ticket },
        ].map((item) => (
          <Link key={item.href} href={item.href} className="card flex items-center gap-3 p-4 text-sm font-bold text-ink transition hover:border-brand-700/20 hover:bg-brand-50/30">
            <item.icon className="h-4 w-4 text-brand-700" /> {item.label}
            <ArrowLeft className="mr-auto h-4 w-4 text-ink/25" />
          </Link>
        ))}
      </div>
    </AccountShell>
  );
}

export default function AccountPage() {
  return (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  );
}
