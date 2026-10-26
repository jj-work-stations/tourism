"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  CalendarClock,
  Coins,
  Compass,
  Crown,
  Gift,
  Heart,
  Map,
  MapPin,
  Plane,
  Plus,
  Receipt,
  Sparkles,
  Stamp,
  Ticket,
  TrendingUp,
  Trophy,
  Wallet,
} from "lucide-react";

import { AccountShell } from "@/components/account-shell";
import { RequireAuth } from "@/components/require-auth";
import { Badge, EmptyState, SmartImage, Stat } from "@/components/ui";
import { useApiQuery } from "@/lib/hooks";
import { bookingStatus, date, levelLabel, number, shortDate, toman, tripStatus } from "@/lib/format";
import type { Booking, Gamification, Page, Trip, Wallet as WalletType } from "@/lib/types";

interface Stats {
  trips: number;
  bookings: number;
  total_spent: number;
  member_since: string;
  xp: number;
  level: string;
  points: number;
}

function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null;
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) return null;
  return Math.max(0, Math.ceil((target - Date.now()) / 86_400_000));
}

/** XP level progress ring in gold-foil style. */
function LevelRing({ progress, level }: { progress: number; level: string }) {
  const pct = Math.min(100, Math.max(0, Math.round(progress * 100)));
  return (
    <div
      className="relative grid h-24 w-24 shrink-0 place-items-center rounded-full"
      style={{
        background: `conic-gradient(#fcd266 0deg, #b8860b ${pct * 3.6}deg, rgba(11, 31, 29, 0.07) ${pct * 3.6}deg)`,
      }}
    >
      <div className="grid h-[76px] w-[76px] place-items-center rounded-full bg-white text-center shadow-sm">
        <div>
          <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-gold-600">
            <Crown className="h-3 w-3" /> {levelLabel[level] ?? level}
          </div>
          <div className="text-lg font-black leading-none text-ink">{number(pct)}٪</div>
          <div className="text-[9px] text-ink/40">پیشرفت سطح</div>
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const stats = useApiQuery<Stats>(["account", "stats"], "/users/me/stats");
  const wallet = useApiQuery<WalletType>(["account", "wallet"], "/wallet");
  const gamification = useApiQuery<Gamification>(["account", "gamification"], "/gamification/profile");
  const bookings = useApiQuery<Page<Booking>>(["account", "bookings", "recent"], "/bookings", { page_size: 10 });
  const upcomingTrips = useApiQuery<Page<Trip>>(["account", "trips", "dashboard"], "/trips", { tab: "upcoming", page_size: 3 });

  const level = gamification.data?.level ?? stats.data?.level ?? "bronze";
  const progress = gamification.data?.level_progress ?? 0;

  const nextTrip = upcomingTrips.data?.items?.[0];
  const nextBooking = (bookings.data?.items ?? [])
    .filter((b) => ["pending", "confirmed"].includes(b.status))
    .sort((a, b) => (a.travel_date || a.check_in || "9999").localeCompare(b.travel_date || b.check_in || "9999"))[0];

  const unlockedAchievements = (gamification.data?.achievements ?? []).filter((a) => a.unlocked);
  const lockedAchievements = (gamification.data?.achievements ?? []).filter((a) => !a.unlocked).slice(0, 4);
  const activeChallenges = (gamification.data?.challenges ?? []).filter((c) => !c.completed).slice(0, 3);

  return (
    <AccountShell
      title="داشبورد من"
      description="خلاصه سفرها، رزروها، کیف پول و پیشرفت پاسپورت سفر شما."
      action={
        <div className="flex gap-2">
          <Link href="/account/trips" className="btn-secondary !py-2.5 !text-xs">
            <Plus className="h-4 w-4" /> سفر جدید
          </Link>
          <Link href="/assistant" className="btn-primary !py-2.5 !text-xs">
            <Sparkles className="h-4 w-4" /> برنامه هوشمند
          </Link>
        </div>
      }
    >
      {/* ── KPI row ─────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="سفرهای من" value={number(stats.data?.trips ?? 0)} icon={<Map className="h-5 w-5" />} />
        <Stat label="رزروها" value={number(stats.data?.bookings ?? 0)} icon={<Ticket className="h-5 w-5" />} tone="sky" />
        <Stat label="مجموع هزینه" value={toman(stats.data?.total_spent ?? 0, true)} icon={<TrendingUp className="h-5 w-5" />} tone="sand" />
        <Stat label="موجودی کیف پول" value={toman(wallet.data?.balance ?? 0, true)} icon={<Wallet className="h-5 w-5" />} tone="gold" />
      </div>

      {/* ── Next trip + level ──────────────────────────────────── */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
        {/* Next trip countdown */}
        {nextTrip ? (
          <Link href={`/account/trips/${nextTrip.id}`} className="card card-hover group relative overflow-hidden">
            <div className="relative h-40">
              <SmartImage
                src={nextTrip.cover_image || nextTrip.destination.image_url}
                alt={nextTrip.title}
                className="h-full w-full transition duration-700 group-hover:scale-105"
                fallbackClassName="h-full w-full"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5 text-white">
                <div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-sand-300">
                    <CalendarClock className="h-3.5 w-3.5" /> سفر پیش‌رو
                  </div>
                  <h3 className="mt-1 text-lg font-black">{nextTrip.title}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-white/75">
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {nextTrip.destination.name}</span>
                    <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {date(nextTrip.start_date)}</span>
                  </div>
                </div>
                <div className="shrink-0 rounded-2xl bg-white/95 px-4 py-2.5 text-center text-ink shadow-soft">
                  <div className="text-xl font-black leading-none text-brand-800">{number(daysUntil(nextTrip.start_date) ?? 0)}</div>
                  <div className="mt-1 text-[9px] text-ink/50">روز تا پرواز</div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 p-4 text-center">
              <div className="rounded-2xl bg-black/[0.025] p-2.5">
                <div className="text-sm font-black text-ink">{number(nextTrip.days.length)}</div>
                <div className="text-[10px] text-ink/40">روز برنامه</div>
              </div>
              <div className="rounded-2xl bg-black/[0.025] p-2.5">
                <div className="text-sm font-black text-ink">{number(nextTrip.days.reduce((sum, day) => sum + day.activities.length, 0))}</div>
                <div className="text-[10px] text-ink/40">فعالیت</div>
              </div>
              <div className="rounded-2xl bg-brand-50/60 p-2.5">
                <div className="text-sm font-black text-brand-800">{toman(nextTrip.budget, true)}</div>
                <div className="text-[10px] text-ink/40">بودجه کل</div>
              </div>
            </div>
            {nextTrip.budget > 0 && (
              <div className="px-4 pb-4">
                <div className="flex justify-between text-[10px] text-ink/45">
                  <span>هزینه‌شده: {toman(nextTrip.spent, true)}</span>
                  <span>{number(Math.round((nextTrip.spent / nextTrip.budget) * 100))}٪ از بودجه</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
                  <div
                    className="h-full rounded-full bg-gradient-to-l from-gold-500 to-brand-600"
                    style={{ width: `${Math.min(100, Math.round((nextTrip.spent / nextTrip.budget) * 100))}%` }}
                  />
                </div>
              </div>
            )}
          </Link>
        ) : (
          <div className="card-ornamental flex flex-col items-center justify-center gap-3 p-8 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-700">
              <Compass className="h-6 w-6" />
            </span>
            <h3 className="text-base font-bold text-ink">سفر پیش‌رویی ندارید</h3>
            <p className="max-w-sm text-xs leading-6 text-ink/50">یک سفر بسازید یا از دستیار هوشمند بخواهید برایتان برنامه بریزد.</p>
            <div className="flex gap-2">
              <Link href="/account/trips" className="btn-primary mt-1 !py-2.5 !text-xs"><Plus className="h-4 w-4" /> ساخت سفر</Link>
              <Link href="/assistant" className="btn-secondary mt-1 !py-2.5 !text-xs"><Sparkles className="h-4 w-4" /> دستیار</Link>
            </div>
          </div>
        )}

        {/* Level / XP panel */}
        <div className="panel-gold relative p-5">
          <div className="relative flex items-center gap-4">
            <LevelRing progress={progress} level={level} />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-gold-700">پاسپورت سفر</div>
              <h2 className="mt-1 text-lg font-black text-ink">سطح {levelLabel[level] ?? level}</h2>
              <div className="mt-2 text-[11px] leading-5 text-ink/50">
                {number(gamification.data?.xp ?? 0)} XP · {number(gamification.data?.xp_to_next_level ?? 0)} XP تا{" "}
                <b className="text-gold-700">{levelLabel[gamification.data?.next_level ?? ""] ?? gamification.data?.next_level}</b>
              </div>
              <Link href="/account/rewards" className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-brand-800 hover:underline">
                مشاهده پاسپورت <ArrowLeft className="h-3 w-3" />
              </Link>
            </div>
          </div>
          <div className="relative mt-4 grid grid-cols-3 gap-2 border-t border-sand-200/70 pt-4 text-center">
            <div>
              <div className="flex items-center justify-center gap-1 text-base font-black text-ink"><Stamp className="h-3.5 w-3.5 text-brand-600" /> {number(gamification.data?.stamps.length ?? 0)}</div>
              <div className="text-[10px] text-ink/40">مهر سفر</div>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 text-base font-black text-ink"><Trophy className="h-3.5 w-3.5 text-gold-600" /> {number(unlockedAchievements.length)}</div>
              <div className="text-[10px] text-ink/40">دستاورد</div>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 text-base font-black text-ink"><Coins className="h-3.5 w-3.5 text-amber-500" /> {number(gamification.data?.points ?? 0)}</div>
              <div className="text-[10px] text-ink/40">امتیاز</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Next booking highlight ─────────────────────────────── */}
      {nextBooking && (
        <Link href={`/bookings/${nextBooking.id}`} className="card card-hover mt-5 flex flex-wrap items-center gap-4 p-4">
          <SmartImage src={nextBooking.image_url} alt={nextBooking.title} className="h-16 w-16 rounded-2xl" fallbackClassName="h-16 w-16 rounded-2xl" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[10px] font-bold text-brand-700">
              <Plane className="h-3.5 w-3.5" /> رزرو بعدی شما
            </div>
            <div className="mt-0.5 truncate text-sm font-black text-ink">{nextBooking.title}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-ink/45">
              <span className="font-mono">{nextBooking.code}</span>
              <span>·</span>
              <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {date(nextBooking.travel_date || nextBooking.check_in)}</span>
            </div>
          </div>
          {daysUntil(nextBooking.travel_date || nextBooking.check_in) !== null && (
            <span className="rounded-2xl bg-brand-50 px-3.5 py-2 text-center">
              <span className="block text-base font-black leading-none text-brand-800">{number(daysUntil(nextBooking.travel_date || nextBooking.check_in)!)}</span>
              <span className="mt-1 block text-[9px] text-ink/50">روز مانده</span>
            </span>
          )}
          <Badge tone={bookingStatus[nextBooking.status]?.tone ?? "slate"}>{bookingStatus[nextBooking.status]?.label ?? nextBooking.status}</Badge>
          <span className="text-left">
            <span className="block text-[10px] text-ink/40">مبلغ</span>
            <span className="text-sm font-black text-brand-800">{toman(nextBooking.total, true)}</span>
          </span>
          <span className="btn-primary !rounded-xl !px-4 !py-2 !text-[11px]">بلیت و QR</span>
        </Link>
      )}

      {/* ── Wallet + challenges ────────────────────────────────── */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-black text-ink"><Wallet className="h-4 w-4 text-brand-700" /> کیف پول سیر</h2>
            <Link href="/account/wallet" className="text-[11px] font-bold text-brand-800">مدیریت</Link>
          </div>
          <div className="mt-3 flex items-end justify-between rounded-2xl bg-gradient-to-l from-brand-900 to-brand-700 p-4 text-white">
            <div>
              <div className="text-[10px] text-white/55">موجودی</div>
              <div className="text-xl font-black">{toman(wallet.data?.balance ?? 0, true)}</div>
            </div>
            <div className="text-left">
              <div className="text-[10px] text-white/55">امتیاز قابل تبدیل</div>
              <div className="text-lg font-black text-sand-300">{number(wallet.data?.points ?? 0)}</div>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            {(wallet.data?.transactions ?? []).slice(0, 3).map((txn) => (
              <div key={txn.id} className="flex items-center justify-between rounded-xl bg-black/[0.025] px-3 py-2 text-[11px]">
                <span className="truncate text-ink/60">{txn.description}</span>
                <span className={txn.amount >= 0 ? "font-bold text-emerald-600" : "font-bold text-rose-600"}>
                  {txn.amount >= 0 ? "+" : "−"}{toman(Math.abs(txn.amount), true)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-black text-ink"><Trophy className="h-4 w-4 text-gold-600" /> چالش‌های فعال</h2>
            <Link href="/account/rewards" className="text-[11px] font-bold text-brand-800">همه</Link>
          </div>
          <div className="mt-3 space-y-3">
            {activeChallenges.map((challenge) => {
              const pct = Math.min(100, Math.round((challenge.progress / Math.max(challenge.target, 1)) * 100));
              return (
                <div key={challenge.id}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 font-semibold text-ink">
                      <Gift className="h-3.5 w-3.5 text-gold-600" /> {challenge.title}
                    </span>
                    <span className="text-ink/40">{number(challenge.progress)} از {number(challenge.target)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
                    <div className="h-full rounded-full bg-gradient-to-l from-gold-500 to-amber-400" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {activeChallenges.length === 0 && (
              <div className="py-6 text-center text-xs text-ink/40">چالش فعالی ندارید — با رزرو و ثبت نظر XP بگیرید!</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Passport stamps ────────────────────────────────────── */}
      {(gamification.data?.stamps.length ?? 0) > 0 && (
        <div className="card mt-5 p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-black text-ink"><Stamp className="h-4 w-4 text-brand-700" /> پاسپورت گردشگری شما</h2>
            <Link href="/account/rewards" className="text-[11px] font-bold text-brand-800">مشاهده همه</Link>
          </div>
          <div className="no-scrollbar mt-4 flex gap-3 overflow-x-auto pb-1">
            {gamification.data!.stamps.map((stamp) => (
              <div key={stamp.destination_id} className="w-28 shrink-0 text-center">
                <div className="relative">
                  <SmartImage
                    src={stamp.image_url}
                    alt={stamp.name}
                    className="arch-mask h-24 w-24 border-2 border-gold-500/40"
                    fallbackClassName="arch-mask h-24 w-24 border-2 border-gold-500/40"
                  />
                  <BadgeCheck className="absolute -bottom-1 -left-1 h-5 w-5 rounded-full bg-white text-brand-600" />
                </div>
                <div className="mt-2 truncate text-[11px] font-bold text-ink">{stamp.name}</div>
                <div className="text-[9px] text-ink/40">{shortDate(stamp.visited_at)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Achievements ───────────────────────────────────────── */}
      <div className="card mt-5 p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-black text-ink"><Trophy className="h-4 w-4 text-gold-600" /> دستاوردها</h2>
          <Link href="/account/rewards" className="text-[11px] font-bold text-brand-800">همه</Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[...unlockedAchievements.slice(0, 4), ...lockedAchievements].slice(0, 8).map((achievement) => (
            <div
              key={achievement.id}
              className={`rounded-2xl border p-3 text-center transition ${
                achievement.unlocked
                  ? "border-gold-500/30 bg-gradient-to-b from-gold-50 to-white shadow-sm"
                  : "border-black/[0.05] bg-black/[0.02] opacity-55"
              }`}
            >
              <div className="text-2xl">{achievement.icon || (achievement.unlocked ? "🏆" : "🔒")}</div>
              <div className="mt-1.5 truncate text-[11px] font-bold text-ink">{achievement.title}</div>
              <div className="text-[9px] text-ink/40">+{number(achievement.xp_reward)} XP</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Recent bookings ────────────────────────────────────── */}
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-black text-ink">رزروهای اخیر</h2>
          <Link href="/account/bookings" className="text-[11px] font-bold text-brand-800">همه رزروها</Link>
        </div>
        {bookings.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[1, 2].map((i) => <div key={i} className="skeleton h-20 rounded-3xl" />)}
          </div>
        ) : bookings.data && bookings.data.items.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {bookings.data.items.slice(0, 4).map((booking) => {
              const status = bookingStatus[booking.status] ?? { label: booking.status, tone: "slate" };
              return (
                <Link key={booking.id} href={`/bookings/${booking.id}`} className="card card-hover flex items-center gap-3 p-3">
                  <SmartImage src={booking.image_url} alt={booking.title} className="h-14 w-14 rounded-2xl" fallbackClassName="h-14 w-14 rounded-2xl" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold text-ink">{booking.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-ink/40">
                      <span className="font-mono">{booking.code}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {date(booking.travel_date || booking.check_in || booking.created_at)}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-left">
                    <Badge tone={status.tone} className="!px-2 !text-[9px]">{status.label}</Badge>
                    <div className="mt-1 text-[11px] font-black text-brand-800">{toman(booking.total, true)}</div>
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

      {/* ── Quick actions ──────────────────────────────────────── */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/search", label: "جستجوی سفر", icon: Plane, tone: "bg-brand-50 text-brand-700" },
          { href: "/account/trips", label: "برنامه سفرها", icon: Compass, tone: "bg-violet-50 text-violet-600" },
          { href: "/account/favorites", label: "علاقه‌مندی‌ها", icon: Heart, tone: "bg-rose-50 text-rose-600" },
          { href: "/account/bookings", label: "بلیت‌ها و QR", icon: Receipt, tone: "bg-sky-50 text-sky-600" },
        ].map((item) => (
          <Link key={item.href} href={item.href} className="card card-hover flex items-center gap-3 p-4 text-sm font-bold text-ink">
            <span className={`grid h-10 w-10 place-items-center rounded-2xl ${item.tone}`}>
              <item.icon className="h-5 w-5" />
            </span>
            {item.label}
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
