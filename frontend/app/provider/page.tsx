"use client";

import { useMemo } from "react";
import {
  ArrowLeft,
  BedDouble,
  CalendarRange,
  CircleDollarSign,
  PieChart as PieChartIcon,
  Plane,
  PlusCircle,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { DashboardShell } from "@/components/dashboard-shell";
import { Badge, EmptyState, Spinner } from "@/components/ui";
import { useApiQuery } from "@/lib/hooks";
import { bookingStatus, date, number, time, toman } from "@/lib/format";
import type { Booking, Page, ProviderDashboard, Review } from "@/lib/types";

interface Services {
  accommodations: { id: string; name: string; type: string; base_price: number; rating: number; is_active: boolean }[];
  transport: { id: string; code: string; type: string; origin: string; destination: string; price: number; seats_available: number; departure_at: string }[];
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#f5c956",
  confirmed: "#10b981",
  completed: "#38bdf8",
  cancelled: "#f87171",
  refunded: "#a3aab5",
};

const ACC_TYPE_LABEL: Record<string, string> = {
  hotel: "هتل",
  apartment_hotel: "هتل‌آپارتمان",
  hostel: "هاستل",
  villa: "ویلا",
  homestay: "بوم‌گردی",
  apartment: "آپارتمان",
  camp: "کمپ",
  heritage: "بنای تاریخی",
};

const TRANSPORT_LABEL: Record<string, string> = {
  flight: "هواپیما",
  train: "قطار",
  bus: "اتوبوس",
  car: "خودرو",
  taxi: "تاکسی",
};

function Overview() {
  const dashboard = useApiQuery<ProviderDashboard>(["provider", "dashboard"], "/provider/dashboard");
  const services = useApiQuery<Services>(["provider", "services"], "/provider/services");
  const bookings = useApiQuery<Page<Booking>>(["provider", "bookings", "all"], "/provider/bookings", {
    page_size: 100,
  });
  const reviews = useApiQuery<Page<Review>>(["provider", "reviews", "meta"], "/provider/reviews", { page_size: 1 });

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const booking of bookings.data?.items ?? []) {
      counts[booking.status] = (counts[booking.status] ?? 0) + 1;
    }
    return Object.entries(counts).map(([status, value]) => ({
      status: bookingStatus[status]?.label ?? status,
      key: status,
      value,
    }));
  }, [bookings.data]);

  if (dashboard.isLoading) {
    return <div className="dash-card grid min-h-[40vh] place-items-center"><Spinner className="h-8 w-8" /></div>;
  }
  if (dashboard.error || !dashboard.data) {
    return (
      <div className="dash-card p-8 text-center">
        <h2 className="text-base font-black text-ink">داشبورد در دسترس نیست</h2>
        <p className="mt-2 text-xs text-ink/50">پروفایل ارائه‌دهنده برای این حساب یافت نشد.</p>
      </div>
    );
  }

  const data = dashboard.data;
  const revenueChart = data.monthly_revenue.slice(-12);
  const avgBookingValue = data.confirmed_bookings > 0 ? Math.round(data.revenue / data.confirmed_bookings) : 0;
  const confirmRate = data.total_bookings > 0 ? Math.round((data.confirmed_bookings / data.total_bookings) * 100) : 0;
  const commissionPct = data.revenue > 0 ? Math.round((data.commission / data.revenue) * 100) : 0;

  const kpis = [
    { label: "درآمد کل", value: toman(data.revenue, true), icon: <CircleDollarSign className="h-5 w-5" />, tone: "bg-gold-100/70 text-gold-600" },
    { label: "سهم خالص شما", value: toman(data.net_revenue, true), hint: `کمیسیون پلتفرم: ${toman(data.commission, true)}`, icon: <TrendingUp className="h-5 w-5" />, tone: "bg-emerald-50 text-emerald-600" },
    { label: "رزروها", value: number(data.total_bookings), hint: `${number(data.confirmed_bookings)} تأیید شده · ${number(confirmRate)}٪ نرخ تأیید`, icon: <CalendarRange className="h-5 w-5" />, tone: "bg-sky-50 text-sky-600" },
    { label: "میانگین ارزش رزرو", value: toman(avgBookingValue, true), icon: <Users className="h-5 w-5" />, tone: "bg-terracotta-50 text-terracotta-500" },
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

      {/* Reputation strip */}
      <div className="dash-card flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-3xl bg-gradient-to-br from-gold-100 to-sand-100 text-2xl font-black text-gold-700 shadow-gold">
            {data.rating ? data.rating.toFixed(1) : "—"}
          </span>
          <div>
            <div className="flex items-center gap-1.5 text-sm font-black text-ink">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> امتیاز مهمانان
              <Badge tone="gold" className="!text-[10px]">{data.provider_name}</Badge>
            </div>
            <div className="mt-1 text-[11px] text-ink/45">
              {number(reviews.data?.total ?? 0)} نظر ثبت‌شده روی خدمات شما
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/provider/reviews" className="btn-xs-soft">
            <Star className="h-3 w-3" /> نظرات مهمانان
          </Link>
          <Link href="/provider/services" className="btn-xs-soft">
            <PlusCircle className="h-3 w-3" /> افزودن خدمت جدید
          </Link>
          <Link href="/provider/financial" className="btn-xs-soft">
            <CircleDollarSign className="h-3 w-3" /> گزارش مالی
          </Link>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="dash-card p-5">
          <h2 className="text-sm font-black text-ink">درآمد ماهانه</h2>
          <div className="mt-4 h-52" dir="ltr">
            {revenueChart.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueChart}>
                  <defs>
                    <linearGradient id="pRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#b8860b" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#b8860b" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 6" stroke="#0b1f1d0f" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#0b1f1d88" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#0b1f1d66" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1_000_000 ? `${Math.round(v / 1_000_000)}M` : `${Math.round(v / 1000)}K`} width={38} />
                  <Tooltip
                    contentStyle={{ borderRadius: 14, border: "1px solid #00000014", fontSize: 11, direction: "rtl", fontFamily: "inherit" }}
                    formatter={(value: number) => [toman(value, true), "درآمد"]}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#b8860b" strokeWidth={2.5} fill="url(#pRev)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center text-xs text-ink/40">درآمدی ثبت نشده است.</div>
            )}
          </div>
        </div>

        <div className="dash-card p-5">
          <h2 className="flex items-center gap-1.5 text-sm font-black text-ink">
            <PieChartIcon className="h-4 w-4 text-brand-700" /> وضعیت رزروها
          </h2>
          <div className="mt-2 h-52" dir="ltr">
            {statusCounts.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusCounts}
                    dataKey="value"
                    nameKey="status"
                    innerRadius={52}
                    outerRadius={80}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {statusCounts.map((entry) => (
                      <Cell key={entry.key} fill={STATUS_COLORS[entry.key] ?? "#94a3b8"} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 14, border: "1px solid #00000014", fontSize: 11, direction: "rtl", fontFamily: "inherit" }}
                    formatter={(value: number) => [`${number(value)} رزرو`, ""]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    iconSize={8}
                    formatter={(value: string) => <span style={{ fontSize: 10, color: "#0b1f1daa" }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center text-xs text-ink/40">رزروی ثبت نشده است.</div>
            )}
          </div>
        </div>
      </div>

      {/* Commission split */}
      <div className="dash-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-ink">تفکیک درآمد و کمیسیون</h2>
          <Badge tone="brand">کمیسیون فعلی: {number(commissionPct)}٪</Badge>
        </div>
        <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-black/[0.05]" dir="ltr">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
            style={{ width: `${Math.max(2, 100 - commissionPct)}%` }}
          />
        </div>
        <div className="mt-2.5 flex flex-wrap justify-between gap-3 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> سهم شما: <b>{toman(data.net_revenue, true)}</b>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-black/15" /> کمیسیون سیر: <b>{toman(data.commission, true)}</b>
          </span>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="dash-card overflow-hidden">
          <div className="border-b border-black/[0.05] px-5 py-3.5">
            <h2 className="flex items-center gap-1.5 text-sm font-black text-ink"><CalendarRange className="h-4 w-4 text-brand-700" /> رزروهای پیش‌رو</h2>
          </div>
          <div className="section-list">
            {data.upcoming_bookings.slice(0, 7).map((booking) => {
              const status = bookingStatus[booking.status] ?? { label: booking.status, tone: "slate" };
              return (
                <div key={booking.id} className="flex items-center justify-between gap-2 px-5 py-3 text-xs">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-ink">{booking.title}</div>
                    <div className="text-[10px] text-ink/35">{date(booking.travel_date || booking.check_in || booking.created_at)}</div>
                  </div>
                  <div className="shrink-0 text-left">
                    <Badge tone={status.tone} className="!py-0 !text-[9px]">{status.label}</Badge>
                    <div className="mt-1 text-[11px] font-bold text-brand-800">{toman(booking.total, true)}</div>
                  </div>
                </div>
              );
            })}
            {data.upcoming_bookings.length === 0 && <div className="py-10 text-center text-xs text-ink/40">رزرو پیش‌رویی ندارید.</div>}
          </div>
          {data.upcoming_bookings.length > 0 && (
            <Link href="/provider/bookings" className="flex items-center justify-center gap-1 border-t border-black/[0.05] py-3 text-[11px] font-bold text-brand-800 hover:bg-brand-50/40">
              مدیریت رزروها <ArrowLeft className="h-3 w-3" />
            </Link>
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="dash-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-black/[0.05] px-5 py-3.5">
              <h2 className="flex items-center gap-1.5 text-sm font-black text-ink"><BedDouble className="h-4 w-4 text-brand-700" /> اقامتگاه‌ها</h2>
              <span className="text-[10px] text-ink/40">{number(services.data?.accommodations.length ?? 0)} مورد</span>
            </div>
            <div className="section-list">
              {(services.data?.accommodations ?? []).slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2 px-5 py-3 text-xs">
                  <div><div className="font-semibold text-ink">{item.name}</div><div className="text-[10px] text-ink/35">{ACC_TYPE_LABEL[item.type] || item.type}</div></div>
                  <div className="text-left">
                    <div className="font-bold text-brand-800">{toman(item.base_price, true)}</div>
                    <Badge tone={item.is_active ? "emerald" : "rose"} className="mt-1 !py-0 !text-[9px]">{item.is_active ? "فعال" : "غیرفعال"}</Badge>
                  </div>
                </div>
              ))}
              {(services.data?.accommodations.length ?? 0) === 0 && <div className="py-10 text-center text-xs text-ink/40">اقامتگاهی ثبت نشده است.</div>}
            </div>
          </div>

          <div className="dash-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-black/[0.05] px-5 py-3.5">
              <h2 className="flex items-center gap-1.5 text-sm font-black text-ink"><Plane className="h-4 w-4 text-brand-700" /> حمل‌ونقل</h2>
              <span className="text-[10px] text-ink/40">{number(services.data?.transport.length ?? 0)} مورد</span>
            </div>
            <div className="section-list">
              {(services.data?.transport ?? []).slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2 px-5 py-3 text-xs">
                  <div><div className="font-semibold text-ink">{item.origin} → {item.destination}</div><div className="text-[10px] text-ink/35">{TRANSPORT_LABEL[item.type] || item.type} · {date(item.departure_at)} {time(item.departure_at)}</div></div>
                  <div className="text-left"><div className="font-bold text-brand-800">{toman(item.price, true)}</div><div className="text-[10px] text-ink/35">{number(item.seats_available)} صندلی</div></div>
                </div>
              ))}
              {(services.data?.transport.length ?? 0) === 0 && <div className="py-10 text-center text-xs text-ink/40">سفری ثبت نشده است.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProviderPage() {
  return (
    <DashboardShell
      portal="provider"
      title="داشبورد ارائه‌دهنده"
      subtitle="عملکرد فروش، درآمد، رزروهای پیش‌رو و مدیریت خدمات خود."
    >
      <Overview />
    </DashboardShell>
  );
}
