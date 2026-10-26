"use client";

import Link from "next/link";
import {
  BarChart3,
  Compass,
  Plane,
  ShieldCheck,
  Star,
  Ticket,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { DashboardShell } from "@/components/dashboard-shell";
import { Badge, EmptyState, Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth-store";
import { useApiQuery } from "@/lib/hooks";
import { bookingStatus, date, number, toman } from "@/lib/format";
import type { AdminStats } from "@/lib/types";

const TYPE_LABEL: Record<string, string> = {
  transport: "حمل‌ونقل",
  accommodation: "اقامتگاه",
  experience: "تجربه",
};

const EVENT_LABEL: Record<string, string> = {
  APP_OPENED: "باز کردن اپ",
  SEARCH_STARTED: "جستجوی سفر",
  DESTINATION_VIEWED: "مشاهده مقصد",
  HOTEL_VIEWED: "مشاهده اقامتگاه",
  BOOKING_STARTED: "شروع رزرو",
  PAYMENT_STARTED: "شروع پرداخت",
  BOOKING_COMPLETED: "تکمیل رزرو",
  BOOKING_CANCELLED: "لغو رزرو",
  REVIEW_CREATED: "ثبت نظر",
};

const FA_MONTH = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];

function monthLabel(month: string) {
  return FA_MONTH[(Number(month.slice(-2)) + 8) % 12] || month;
}

function Overview() {
  const user = useAuth((state) => state.user);
  const canStats = ["admin", "content_manager", "marketing_manager"].includes(user?.role ?? "");

  const stats = useApiQuery<AdminStats>(["admin", "stats"], "/admin/stats", undefined, {
    enabled: canStats,
  });

  if (!canStats) {
    return (
      <div className="dash-shell">
        <div className="lg:col-span-2" />
      </div>
    );
  }

  if (stats.isLoading) {
    return (
      <div className="dash-card grid min-h-[40vh] place-items-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const data = stats.data;
  if (!data) return <EmptyState icon={<BarChart3 className="h-6 w-6" />} title="آماری در دسترس نیست" />;

  const revenueChart = data.revenue_series.slice(-12).map((item) => ({
    ...item,
    label: monthLabel(item.month),
  }));
  const typeChart = Object.entries(data.bookings_by_type)
    .map(([type, count]) => ({ type: TYPE_LABEL[type] || type, count }));

  const kpis = [
    { label: "درآمد کل", value: toman(data.revenue_total, true), hint: "۱۸ ماه اخیر", icon: <Wallet className="h-5 w-5" />, tone: "bg-gold-100/70 text-gold-600" },
    { label: "درآمد ۳۰ روز گذشته", value: toman(data.revenue_30d, true), hint: "میگنام ماهانه", icon: <TrendingUp className="h-5 w-5" />, tone: "bg-emerald-50 text-emerald-600" },
    { label: "کاربران فعال", value: number(data.active_users_30d), hint: `${number(data.new_users_30d)} کاربر جدید در ۳۰ روز`, icon: <Users className="h-5 w-5" />, tone: "bg-sky-50 text-sky-600" },
    { label: "رزروهای تأییدشده", value: number(data.confirmed_bookings), hint: `لغو: ${number(data.cancelled_bookings)} (${data.cancellation_rate}٪)`, icon: <Ticket className="h-5 w-5" />, tone: "bg-terracotta-50 text-terracotta-500" },
  ];

  const eventCount = (name: string): number => {
    for (const entry of data.top_events) {
      const key = (entry as { event_type?: string; name?: string }).name ?? (entry as { event_type?: string }).event_type ?? "";
      if (key === name) return entry.count;
    }
    return 0;
  };

  const funnel = [
    { label: "جستجوی سفر", rate: 100 },
    { label: "مشاهده مقصد/اقامتگاه", rate: Math.min(100, Math.round((eventCount("DESTINATION_VIEWED") / Math.max(eventCount("SEARCH_STARTED"), 1)) * 100)) },
    { label: "شروع رزرو", rate: Math.min(100, Math.round((data.bookings_30d / Math.max(data.new_users_30d, 1)) * 100)) },
    { label: "نرخ تبدیل کلی", rate: data.conversion_rate },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="kpi">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-medium text-ink/45">{kpi.label}</div>
                <div className="mt-2 truncate text-[22px] font-black tracking-tight text-ink">{kpi.value}</div>
                {kpi.hint && <div className="mt-1 text-[11px] text-ink/40">{kpi.hint}</div>}
              </div>
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${kpi.tone}`}>{kpi.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="dash-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-ink">روند درآمد ۱۲ ماه</h2>
            <Badge tone="brand">تومان</Badge>
          </div>
          <div className="mt-4 h-56" dir="ltr">
            {revenueChart.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueChart} margin={{ top: 6, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0e7c66" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#0e7c66" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 6" stroke="#0b1f1d0f" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#0b1f1d88" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#0b1f1d66" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1_000_000 ? `${Math.round(v / 1_000_000)}M` : `${Math.round(v / 1000)}K`} width={38} />
                  <Tooltip
                    contentStyle={{ borderRadius: 14, border: "1px solid #00000014", fontSize: 11, direction: "rtl", fontFamily: "inherit" }}
                    formatter={(value: number) => [toman(value, true), "درآمد"]}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#0e7c66" strokeWidth={2.5} fill="url(#revGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center text-xs text-ink/40">هنوز درآمدی ثبت نشده است.</div>
            )}
          </div>
        </div>

        <div className="dash-card p-5">
          <h2 className="text-sm font-black text-ink">تفکیک رزروها بر اساس نوع</h2>
          <div className="mt-4 h-40" dir="ltr">
            {typeChart.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={typeChart}>
                  <XAxis dataKey="type" tick={{ fontSize: 10, fill: "#0b1f1d88" }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ borderRadius: 14, border: "1px solid #00000014", fontSize: 11, direction: "rtl", fontFamily: "inherit" }}
                    formatter={(value: number) => [number(value), "رزرو"]}
                  />
                  <Bar dataKey="count" fill="#0fa3a3" radius={[10, 10, 0, 0]} maxBarSize={46} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center text-xs text-ink/40">داده‌ای ثبت نشده.</div>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-center text-[11px]">
            <div className="rounded-2xl bg-gold-100/60 p-3">
              <div className="text-lg font-black text-ink">{number(data.pending_reviews)}</div>
              <div className="text-ink/45">نظر در انتظار بررسی</div>
            </div>
            <div className="rounded-2xl bg-brand-50 p-3">
              <div className="text-lg font-black text-ink">{number(data.total_providers)}</div>
              <div className="text-ink/45">ارائه‌دهنده فعال</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="dash-card overflow-hidden">
          <div className="border-b border-black/[0.05] px-5 py-3.5">
            <h2 className="flex items-center gap-1.5 text-sm font-black text-ink"><Compass className="h-4 w-4 text-brand-700" /> مقصدهای محبوب</h2>
          </div>
          <div className="section-list">
            {data.popular_destinations.map((item) => (
              <div key={item.name} className="flex items-center justify-between gap-3 px-5 py-3 text-xs">
                <span className="truncate font-semibold text-ink">{item.name}</span>
                <span className="flex shrink-0 items-center gap-3 text-[11px]">
                  <span className="text-ink/45">{number(item.bookings)} رزرو</span>
                  {item.revenue ? <span className="font-bold text-brand-800">{toman(item.revenue, true)}</span> : null}
                </span>
              </div>
            ))}
            {data.popular_destinations.length === 0 && <div className="py-8 text-center text-xs text-ink/40">داده‌ای نیست.</div>}
          </div>
        </div>

        <div className="dash-card overflow-hidden">
          <div className="border-b border-black/[0.05] px-5 py-3.5">
            <h2 className="flex items-center gap-1.5 text-sm font-black text-ink"><Plane className="h-4 w-4 text-brand-700" /> حمل‌ونقل محبوب</h2>
          </div>
          <div className="section-list p-5">
            {data.popular_transport.map((item) => (
              <div key={item.type} className="mb-3 last:mb-0">
                <div className="flex justify-between text-[11px] text-ink/55">
                  <span>{item.type}</span>
                  <span className="font-bold text-ink">{number(item.count)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/[0.05]">
                  <div
                    className="h-full rounded-full bg-gradient-to-l from-turquoise-400 to-brand-600"
                    style={{ width: `${(item.count / Math.max(...data.popular_transport.map((t) => t.count), 1)) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {data.popular_transport.length === 0 && <div className="py-8 text-center text-xs text-ink/40">داده‌ای نیست.</div>}
          </div>
        </div>

        <div className="dash-card p-5">
          <h2 className="flex items-center gap-1.5 text-sm font-black text-ink"><BarChart3 className="h-4 w-4 text-brand-700" /> قیف تبدیل (۳۰ روز)</h2>
          <div className="mt-4 space-y-3">
            {funnel.map((step, index) => (
              <div key={step.label}>
                <div className="flex justify-between text-[11px] text-ink/55">
                  <span>{step.label}</span>
                  <span className="font-bold text-ink">{index === 3 ? `${number(step.rate)}٪` : number(step.rate)}{index < 3 && index !== 2 ? "" : index === 2 ? "٪" : ""}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/[0.05]">
                  <div
                    className="h-full rounded-full bg-gradient-to-l from-brand-500 via-brand-600 to-gold-500"
                    style={{ width: `${Math.min(100, Math.max(3, step.rate))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <div className="dash-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-black/[0.05] px-5 py-3.5">
            <h2 className="text-sm font-black text-ink">آخرین رزروها</h2>
            <Link href="/admin/bookings" className="text-[11px] font-bold text-brand-800 hover:underline">همه رزروها</Link>
          </div>
          <div className="section-list">
            {data.recent_bookings.slice(0, 7).map((booking) => {
              const status = bookingStatus[booking.status] ?? { label: booking.status, tone: "slate" };
              return (
                <div key={booking.id} className="flex items-center justify-between gap-3 px-5 py-3 text-xs">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-ink">{booking.title}</div>
                    <div className="text-[10px] text-ink/35">{booking.code} · {date(booking.created_at)}</div>
                  </div>
                  <div className="shrink-0 text-left">
                    <div className="font-bold text-brand-800">{toman(booking.total, true)}</div>
                    <Badge tone={status.tone} className="mt-1 !px-2 !py-0.5 !text-[9px]">{status.label}</Badge>
                  </div>
                </div>
              );
            })}
            {data.recent_bookings.length === 0 && <div className="py-8 text-center text-xs text-ink/40">رزروی ثبت نشده است.</div>}
          </div>
        </div>

        <div className="dash-card overflow-hidden">
          <div className="border-b border-black/[0.05] px-5 py-3.5">
            <h2 className="text-sm font-black text-ink">رفتار کاربران (رویدادهای ۳۰ روز)</h2>
          </div>
          <div className="section-list">
            {(data.top_events ?? []).map((event: { event_type: string; count: number }) => {
              const key = event.event_type || "";
              return (
              <div key={key} className="flex items-center justify-between px-5 py-2.5 text-xs">
                <span className="text-ink/60">{EVENT_LABEL[key] || key}</span>
                <span className="font-bold text-ink">{number(event.count)}</span>
              </div>
              );
            })}
            {(data.top_events ?? []).length === 0 && <div className="py-8 text-center text-xs text-ink/40">رویدادی ثبت نشده است.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminOverviewPage() {
  return (
    <DashboardShell
      portal="admin"
      title="داشبورد عملیات"
      subtitle="نمای کلی درآمد، رزروها، کاربران و رفتار مسافران در سوپراپ سفر."
      badge={
        <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[10px] text-white/80">
          <ShieldCheck className="h-3 w-3" /> مدیریت
        </span>
      }
    >
      <Overview />
    </DashboardShell>
  );
}
