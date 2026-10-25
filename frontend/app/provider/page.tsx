"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BedDouble,
  CalendarDays,
  Plane,
  Star,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

import { RequireAuth } from "@/components/require-auth";
import { Badge, Spinner, Stat } from "@/components/ui";
import { useApiQuery } from "@/lib/hooks";
import { bookingStatus, date, number, time, toman } from "@/lib/format";
import type { ProviderDashboard } from "@/lib/types";

interface Services {
  accommodations: { id: string; name: string; type: string; base_price: number; rating: number; is_active: boolean }[];
  transport: { id: string; code: string; type: string; origin: string; destination: string; price: number; seats_available: number; departure_at: string }[];
}

function ProviderContent() {
  const dashboard = useApiQuery<ProviderDashboard>(["provider", "dashboard"], "/provider/dashboard");
  const services = useApiQuery<Services>(["provider", "services"], "/provider/services");

  if (dashboard.isLoading) {
    return <div className="container-app grid min-h-[60vh] place-items-center"><Spinner className="h-8 w-8" /></div>;
  }

  if (dashboard.error || !dashboard.data) {
    return (
      <div className="container-app py-16">
        <div className="card mx-auto max-w-md p-8 text-center">
          <h1 className="text-xl font-black text-ink">داشبورد ارائه‌دهنده در دسترس نیست</h1>
          <p className="mt-2 text-sm text-ink/50">این بخش مخصوص حساب‌های ارائه‌دهنده است.</p>
          <Link href="/" className="btn-primary mt-6">بازگشت به خانه</Link>
        </div>
      </div>
    );
  }

  const data = dashboard.data;
  const maxRevenue = Math.max(...data.monthly_revenue.map((item) => item.revenue), 1);

  return (
    <div className="container-app py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-brand-700">پنل ارائه‌دهنده</div>
          <h1 className="mt-1 text-2xl font-black text-ink sm:text-3xl">{data.provider_name}</h1>
          <div className="mt-1 flex items-center gap-2 text-xs text-ink/45">
            <Badge tone="brand">{data.provider_type}</Badge>
            <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {data.rating.toFixed(1)}</span>
          </div>
        </div>
        <Link href="/support" className="btn-secondary !py-2.5 !text-xs">پشتیبانی ارائه‌دهندگان</Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="درآمد کل" value={toman(data.revenue, true)} icon={<Wallet className="h-5 w-5" />} />
        <Stat label="سهم خالص" value={toman(data.net_revenue, true)} hint={`کمیسیون ${toman(data.commission, true)}`} icon={<TrendingUp className="h-5 w-5" />} tone="sand" />
        <Stat label="رزروها" value={number(data.total_bookings)} hint={`${number(data.confirmed_bookings)} تأیید شده`} icon={<Users className="h-5 w-5" />} tone="sky" />
        <Stat label="خدمات فعال" value={number(data.services_count)} icon={<BedDouble className="h-5 w-5" />} tone="rose" />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
        <div className="card p-5">
          <h2 className="text-sm font-black text-ink">درآمد ماهانه</h2>
          <div className="mt-4 flex h-40 items-end gap-2">
            {data.monthly_revenue.slice(-12).map((item) => (
              <div key={item.month} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-full rounded-t-lg bg-gradient-to-t from-brand-700 to-brand-400" style={{ height: `${Math.max(4, (item.revenue / maxRevenue) * 130)}px` }} title={toman(item.revenue)} />
                <span className="text-[8px] text-ink/35">{item.month.slice(-2)}</span>
              </div>
            ))}
            {data.monthly_revenue.length === 0 && <div className="grid w-full place-items-center text-xs text-ink/40">درآمدی ثبت نشده است.</div>}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-black/5 px-5 py-3"><h2 className="text-sm font-black text-ink">رزروهای پیش‌رو</h2></div>
          <div className="divide-y divide-black/[0.04]">
            {data.upcoming_bookings.slice(0, 6).map((booking) => {
              const status = bookingStatus[booking.status] ?? { label: booking.status, tone: "slate" };
              return (
                <div key={booking.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-xs">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-ink">{booking.title}</div>
                    <div className="text-[10px] text-ink/35">{date(booking.travel_date || booking.check_in || booking.created_at)}</div>
                  </div>
                  <div className="text-left"><Badge tone={status.tone}>{status.label}</Badge><div className="mt-1 text-[10px] font-bold text-brand-800">{toman(booking.total, true)}</div></div>
                </div>
              );
            })}
            {data.upcoming_bookings.length === 0 && <div className="py-8 text-center text-xs text-ink/40">رزرو پیش‌رویی ندارید.</div>}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-black/5 px-5 py-3">
            <h2 className="flex items-center gap-1.5 text-sm font-black text-ink"><BedDouble className="h-4 w-4 text-brand-700" /> اقامتگاه‌ها</h2>
            <span className="text-[10px] text-ink/40">{number(services.data?.accommodations.length ?? 0)} مورد</span>
          </div>
          <div className="divide-y divide-black/[0.04]">
            {(services.data?.accommodations ?? []).map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 px-4 py-3 text-xs">
                <div><div className="font-semibold text-ink">{item.name}</div><div className="text-[10px] text-ink/35">{item.type} · امتیاز {item.rating.toFixed(1)}</div></div>
                <div className="text-left"><div className="font-bold text-brand-800">{toman(item.base_price, true)}</div><Badge tone={item.is_active ? "emerald" : "rose"}>{item.is_active ? "فعال" : "غیرفعال"}</Badge></div>
              </div>
            ))}
            {(services.data?.accommodations.length ?? 0) === 0 && <div className="py-8 text-center text-xs text-ink/40">اقامتگاهی ثبت نشده است.</div>}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-black/5 px-5 py-3">
            <h2 className="flex items-center gap-1.5 text-sm font-black text-ink"><Plane className="h-4 w-4 text-brand-700" /> سفرهای حمل‌ونقل</h2>
            <span className="text-[10px] text-ink/40">{number(services.data?.transport.length ?? 0)} مورد</span>
          </div>
          <div className="divide-y divide-black/[0.04]">
            {(services.data?.transport ?? []).slice(0, 8).map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 px-4 py-3 text-xs">
                <div><div className="font-semibold text-ink">{item.origin} → {item.destination}</div><div className="text-[10px] text-ink/35">{item.code} · {date(item.departure_at)} {time(item.departure_at)}</div></div>
                <div className="text-left"><div className="font-bold text-brand-800">{toman(item.price, true)}</div><div className="text-[10px] text-ink/35">{number(item.seats_available)} صندلی</div></div>
              </div>
            ))}
            {(services.data?.transport.length ?? 0) === 0 && <div className="py-8 text-center text-xs text-ink/40">سفری ثبت نشده است.</div>}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl bg-brand-50/60 p-4 text-[11px] leading-6 text-brand-900">
        برای ثبت خدمات جدید، تغییر قیمت یا مدیریت ظرفیت با تیم پشتیبانی ارائه‌دهندگان در ارتباط باشید. در نسخه بعدی، فرم مدیریت خدمات به‌صورت کامل در دسترس قرار می‌گیرد.
      </div>

      <Link href="/" className="mt-5 inline-flex items-center gap-1 text-[11px] text-ink/35 hover:text-ink/60"><ArrowLeft className="h-3 w-3" /> بازگشت به سایت</Link>
    </div>
  );
}

export default function ProviderPage() {
  return (
    <RequireAuth roles={["provider", "admin"]}>
      <ProviderContent />
    </RequireAuth>
  );
}
