"use client";

import Link from "next/link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Check,
  MapPinned,
  Plane,
  Search,
  ShieldCheck,
  Star,
  Ticket,
  TrendingUp,
  UserRound,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { RequireAuth } from "@/components/require-auth";
import { Badge, Spinner, Stat } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { useApiQuery } from "@/lib/hooks";
import { bookingStatus, date, number, toman } from "@/lib/format";
import type {
  AdminStats,
  AdminUser,
  Booking,
  Page,
  ProviderDashboard,
  Review,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "overview", label: "نمای کلی", icon: BarChart3 },
  { id: "bookings", label: "رزروها", icon: Ticket },
  { id: "users", label: "کاربران", icon: Users },
  { id: "reviews", label: "نظرات", icon: Star },
  { id: "providers", label: "ارائه‌دهندگان", icon: Plane },
];

const REVIEW_STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: "در انتظار", tone: "amber" },
  published: { label: "منتشر شده", tone: "emerald" },
  rejected: { label: "رد شده", tone: "rose" },
};

interface ProviderRow {
  id: string;
  name: string;
  slug: string;
  type: string;
  rating: number;
  is_verified: boolean;
  is_active: boolean;
  commission_rate: number;
}

function AdminContent() {
  const user = useAuth((state) => state.user);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("overview");
  const [search, setSearch] = useState("");

  const canStats = ["admin", "content_manager", "marketing_manager"].includes(user?.role ?? "");
  const canUsers = user?.role === "admin";
  const canReviews = ["admin", "content_manager", "support_agent"].includes(user?.role ?? "");
  const canProviders = ["admin", "content_manager"].includes(user?.role ?? "");

  const stats = useApiQuery<AdminStats>(["admin", "stats"], "/admin/stats", undefined, { enabled: canStats });
  const bookings = useApiQuery<Page<Booking>>(["admin", "bookings"], "/admin/bookings", { page_size: 30 }, { enabled: tab === "bookings" || tab === "overview" });
  const users = useApiQuery<Page<AdminUser>>(["admin", "users", search], "/admin/users", { q: search || undefined, page_size: 30 }, { enabled: canUsers && tab === "users" });
  const reviews = useApiQuery<Page<Review>>(["admin", "reviews"], "/admin/reviews", { page_size: 30 }, { enabled: canReviews && tab === "reviews" });
  const providers = useApiQuery<ProviderRow[]>(["admin", "providers"], "/admin/providers", undefined, { enabled: canProviders && tab === "providers" });

  async function patchUser(id: string, payload: Record<string, unknown>) {
    try {
      await api.patch(`/admin/users/${id}`, payload, true);
      toast.success("کاربر به‌روزرسانی شد.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "به‌روزرسانی انجام نشد.");
    }
  }

  async function moderateReview(id: string, status: string) {
    try {
      await api.patch(`/admin/reviews/${id}?status=${status}`, undefined, true);
      toast.success(status === "published" ? "نظر تأیید شد." : "نظر رد شد.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "عملیات انجام نشد.");
    }
  }

  return (
    <div className="container-app py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-brand-700">پنل مدیریت سیر</div>
          <h1 className="mt-1 text-2xl font-black text-ink sm:text-3xl">داشبورد عملیات</h1>
          <p className="mt-1 text-sm text-ink/50">کاربران، رزروها، نظرات و عملکرد ارائه‌دهندگان.</p>
        </div>
        <Badge tone="brand" className="px-3 py-1.5"><ShieldCheck className="h-3.5 w-3.5" /> {user?.role}</Badge>
      </div>

      <div className="mb-5 flex gap-1 overflow-x-auto rounded-2xl bg-black/[0.035] p-1 no-scrollbar">
        {TABS.map((item) => {
          const hidden =
            (item.id === "users" && !canUsers) ||
            (item.id === "reviews" && !canReviews) ||
            (item.id === "providers" && !canProviders);
          if (hidden) return null;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn("flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition", tab === item.id ? "bg-white text-brand-800 shadow-sm" : "text-ink/50 hover:text-ink")}
            >
              <item.icon className="h-3.5 w-3.5" /> {item.label}
            </button>
          );
        })}
      </div>

      {tab === "overview" && (
        <div className="space-y-5">
          {canStats && stats.data ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="درآمد کل" value={toman(stats.data.revenue_total, true)} icon={<Wallet className="h-5 w-5" />} />
                <Stat label="درآمد ۳۰ روز" value={toman(stats.data.revenue_30d, true)} icon={<TrendingUp className="h-5 w-5" />} tone="sand" />
                <Stat label="رزروهای تأییدشده" value={number(stats.data.confirmed_bookings)} icon={<Ticket className="h-5 w-5" />} tone="sky" />
                <Stat label="کاربران" value={number(stats.data.total_users)} hint={`${number(stats.data.active_users_30d)} فعال در ۳۰ روز`} icon={<Users className="h-5 w-5" />} />
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
                <div className="card p-5">
                  <h2 className="text-sm font-black text-ink">روند درآمد ماهانه</h2>
                  <div className="mt-4 flex h-44 items-end gap-2">
                    {stats.data.revenue_series.slice(-12).map((item) => {
                      const max = Math.max(...stats.data!.revenue_series.map((row) => row.revenue), 1);
                      return (
                        <div key={item.month} className="flex flex-1 flex-col items-center gap-1">
                          <div className="w-full rounded-t-lg bg-gradient-to-t from-brand-700 to-brand-400" style={{ height: `${Math.max(4, (item.revenue / max) * 150)}px` }} title={toman(item.revenue)} />
                          <span className="text-[8px] text-ink/35">{item.month.slice(-2)}</span>
                        </div>
                      );
                    })}
                    {stats.data.revenue_series.length === 0 && <div className="grid w-full place-items-center text-xs text-ink/40">داده‌ای نیست.</div>}
                  </div>
                </div>
                <div className="card p-5">
                  <h2 className="text-sm font-black text-ink">تفکیک رزروها</h2>
                  <div className="mt-4 space-y-3">
                    {Object.entries(stats.data.bookings_by_type).map(([type, count]) => {
                      const max = Math.max(...Object.values(stats.data!.bookings_by_type), 1);
                      return (
                        <div key={type}>
                          <div className="flex justify-between text-[11px] text-ink/55"><span>{type === "transport" ? "حمل‌ونقل" : type === "accommodation" ? "اقامتگاه" : "تجربه"}</span><span>{number(count)}</span></div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/[0.05]"><div className="h-full rounded-full bg-brand-500" style={{ width: `${(count / max) * 100}%` }} /></div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-center text-[10px]">
                    <div className="rounded-xl bg-black/[0.025] p-2"><div className="text-base font-black text-ink">{number(stats.data.pending_reviews)}</div><div className="text-ink/40">نظر در انتظار</div></div>
                    <div className="rounded-xl bg-black/[0.025] p-2"><div className="text-base font-black text-ink">{number(stats.data.total_providers)}</div><div className="text-ink/40">ارائه‌دهنده</div></div>
                  </div>
                </div>
              </div>

              <div className="card overflow-hidden">
                <div className="flex items-center justify-between border-b border-black/5 px-5 py-3">
                  <h2 className="text-sm font-black text-ink">آخرین رزروها</h2>
                  <button type="button" onClick={() => setTab("bookings")} className="text-[11px] font-bold text-brand-800">همه</button>
                </div>
                <div className="divide-y divide-black/[0.04]">
                  {stats.data.recent_bookings.slice(0, 6).map((booking) => (
                    <div key={booking.id} className="flex items-center justify-between gap-3 px-4 py-3 text-xs">
                      <div className="min-w-0"><div className="truncate font-semibold text-ink">{booking.title}</div><div className="text-[10px] text-ink/35">{booking.code} · {date(booking.created_at)}</div></div>
                      <div className="text-left"><div className="font-bold text-brand-800">{toman(booking.total, true)}</div><div className="text-[10px] text-ink/35">{booking.status}</div></div>
                    </div>
                  ))}
                  {stats.data.recent_bookings.length === 0 && <div className="py-8 text-center text-xs text-ink/40">رزروی ثبت نشده است.</div>}
                </div>
              </div>
            </>
          ) : (
            <div className="grid place-items-center py-16"><Spinner /></div>
          )}
        </div>
      )}

      {tab === "bookings" && (
        <div className="card overflow-hidden">
          <div className="border-b border-black/5 px-5 py-3"><h2 className="text-sm font-black text-ink">آخرین رزروها</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-[11px]">
              <thead className="bg-black/[0.02] text-ink/40"><tr><th className="px-4 py-2.5 font-medium">کد</th><th className="px-4 py-2.5 font-medium">عنوان</th><th className="px-4 py-2.5 font-medium">نوع</th><th className="px-4 py-2.5 font-medium">مبلغ</th><th className="px-4 py-2.5 font-medium">وضعیت</th></tr></thead>
              <tbody className="divide-y divide-black/[0.04]">
                {(bookings.data?.items ?? []).map((booking) => {
                  const status = bookingStatus[booking.status] ?? { label: booking.status, tone: "slate" };
                  return (
                    <tr key={booking.id} className="hover:bg-black/[0.015]">
                      <td className="px-4 py-2.5 font-mono text-[10px]">{booking.code}</td>
                      <td className="max-w-[240px] truncate px-4 py-2.5 font-semibold text-ink">{booking.title}</td>
                      <td className="px-4 py-2.5 text-ink/50">{booking.booking_type}</td>
                      <td className="px-4 py-2.5 font-bold text-brand-800">{toman(booking.total, true)}</td>
                      <td className="px-4 py-2.5"><Badge tone={status.tone}>{status.label}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "users" && (
        <div>
          <label className="relative mb-3 block max-w-sm">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />
            <input className="input pr-10" placeholder="جستجوی نام، ایمیل یا موبایل..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <div className="card overflow-x-auto">
            <table className="w-full text-right text-[11px]">
              <thead className="bg-black/[0.02] text-ink/40"><tr><th className="px-4 py-2.5 font-medium">کاربر</th><th className="px-4 py-2.5 font-medium">نقش</th><th className="px-4 py-2.5 font-medium">رزرو</th><th className="px-4 py-2.5 font-medium">هزینه</th><th className="px-4 py-2.5 font-medium">وضعیت</th></tr></thead>
              <tbody className="divide-y divide-black/[0.04]">
                {(users.data?.items ?? []).map((item) => (
                  <tr key={item.id} className="hover:bg-black/[0.015]">
                    <td className="px-4 py-2.5"><div className="font-semibold text-ink">{item.full_name}</div><div className="text-[9px] text-ink/35">{item.email || item.phone}</div></td>
                    <td className="px-4 py-2.5">
                      <select className="rounded-lg border border-black/10 bg-white px-2 py-1 text-[10px]" value={item.role} onChange={(event) => patchUser(item.id, { role: event.target.value })}>
                        {["traveler", "provider", "support_agent", "content_manager", "marketing_manager", "admin"].map((role) => <option key={role} value={role}>{role}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2.5">{number(item.bookings_count)}</td>
                    <td className="px-4 py-2.5">{toman(item.total_spent, true)}</td>
                    <td className="px-4 py-2.5">
                      <button type="button" onClick={() => patchUser(item.id, { is_active: !item.is_active })} className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold", item.is_active ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600")}>
                        {item.is_active ? "فعال" : "غیرفعال"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.data && users.data.items.length === 0 && <div className="py-10 text-center text-xs text-ink/40">کاربری پیدا نشد.</div>}
          </div>
        </div>
      )}

      {tab === "reviews" && (
        <div className="space-y-3">
          {(reviews.data?.items ?? []).map((review) => {
            const status = REVIEW_STATUS[review.status] ?? { label: review.status, tone: "slate" };
            return (
              <div key={review.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-ink">{review.user.full_name}<Badge tone={status.tone}>{status.label}</Badge></div>
                    <div className="mt-0.5 text-[10px] text-ink/35">{review.entity_type} · {date(review.created_at)}</div>
                  </div>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => moderateReview(review.id, "published")} className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100" aria-label="تأیید"><Check className="h-4 w-4" /></button>
                    <button type="button" onClick={() => moderateReview(review.id, "rejected")} className="grid h-8 w-8 place-items-center rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100" aria-label="رد"><X className="h-4 w-4" /></button>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1 text-[11px] text-amber-500">{"★".repeat(review.rating)}<span className="text-ink/30">{"★".repeat(5 - review.rating)}</span></div>
                <p className="mt-1 text-xs leading-6 text-ink/60">{review.body}</p>
              </div>
            );
          })}
          {reviews.data && reviews.data.items.length === 0 && <div className="card py-10 text-center text-xs text-ink/40">نظری برای بررسی وجود ندارد.</div>}
        </div>
      )}

      {tab === "providers" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(providers.data ?? []).map((provider) => (
            <div key={provider.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-ink"><MapPinned className="h-4 w-4 text-brand-700" /> {provider.name}</div>
                  <div className="mt-1 text-[10px] text-ink/40">{provider.type}</div>
                </div>
                <Badge tone={provider.is_verified ? "emerald" : "amber"}>{provider.is_verified ? "تأیید شده" : "در انتظار"}</Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                <div className="rounded-xl bg-black/[0.025] p-2"><div className="text-ink/40">امتیاز</div><div className="mt-0.5 font-bold text-ink">{provider.rating.toFixed(1)}</div></div>
                <div className="rounded-xl bg-black/[0.025] p-2"><div className="text-ink/40">کمیسیون</div><div className="mt-0.5 font-bold text-ink">{number(Math.round(provider.commission_rate * 100))}٪</div></div>
              </div>
            </div>
          ))}
          {providers.data && providers.data.length === 0 && <div className="card py-10 text-center text-xs text-ink/40 sm:col-span-3">ارائه‌دهنده‌ای ثبت نشده است.</div>}
        </div>
      )}

      <div className="mt-5 text-center">
        <Link href="/" className="text-[11px] text-ink/35 hover:text-ink/60">بازگشت به سایت</Link>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <RequireAuth roles={["admin", "content_manager", "marketing_manager", "support_agent"]}>
      <AdminContent />
    </RequireAuth>
  );
}
