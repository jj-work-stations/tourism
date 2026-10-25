"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Link2,
  MapPin,
  Plus,
  Sparkles,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { AccountShell } from "@/components/account-shell";
import { RequireAuth } from "@/components/require-auth";
import { Badge, EmptyState, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useApiQuery } from "@/lib/hooks";
import { date, time, toman, tripStatus } from "@/lib/format";
import type { BookingSummary, Trip, TripActivity } from "@/lib/types";
import { cn } from "@/lib/utils";

const TYPE_COLORS: Record<string, string> = {
  note: "bg-slate-100 text-slate-600",
  attraction: "bg-sky-50 text-sky-700",
  food: "bg-amber-50 text-amber-700",
  experience: "bg-violet-50 text-violet-700",
  transport: "bg-brand-50 text-brand-800",
  check_in: "bg-emerald-50 text-emerald-700",
  check_out: "bg-rose-50 text-rose-700",
};

const TYPE_LABELS: Record<string, string> = {
  note: "یادداشت",
  attraction: "جاذبه",
  food: "غذا",
  experience: "تجربه",
  transport: "حمل‌ونقل",
  check_in: "ورود",
  check_out: "خروج",
};

function TripDetailContent() {
  const params = useParams<{ id: string }>();
  const tripId = params.id;
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [pace, setPace] = useState("balanced");
  const [showAdd, setShowAdd] = useState(false);
  const [dayNumber, setDayNumber] = useState(1);
  const [activityTitle, setActivityTitle] = useState("");
  const [activityTime, setActivityTime] = useState("18:00");
  const [activityCost, setActivityCost] = useState(0);

  const tripQuery = useApiQuery<Trip>(["account", "trip", tripId], `/trips/${tripId}`);
  const bookingQuery = useApiQuery<BookingSummary[]>(
    ["account", "trip", tripId, "bookings"],
    `/trips/${tripId}/booking-summary`,
  );
  const trip = tripQuery.data;

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["account", "trip", tripId] });
  }

  async function autoPlan() {
    setBusy(true);
    try {
      await api.post(`/trips/${tripId}/auto-plan`, { pace, replace_existing: true }, true);
      toast.success("برنامه هوشمند ساخته شد.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "برنامه‌ریزی انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  async function addActivity(event: React.FormEvent) {
    event.preventDefault();
    if (!activityTitle.trim()) return;
    setBusy(true);
    try {
      await api.post(
        `/trips/${tripId}/activities`,
        {
          day_number: dayNumber,
          activity_type: "note",
          title: activityTitle.trim(),
          start_time: `${activityTime}:00`,
          cost: activityCost,
        },
        true,
      );
      setActivityTitle("");
      setActivityCost(0);
      setShowAdd(false);
      toast.success("فعالیت اضافه شد.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "افزودن فعالیت انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  async function removeActivity(activityId: string) {
    if (!window.confirm("این فعالیت حذف شود؟")) return;
    try {
      await api.delete(`/trips/${tripId}/activities/${activityId}`, undefined, true);
      toast.success("فعالیت حذف شد.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "حذف انجام نشد.");
    }
  }

  async function publish() {
    try {
      const updated = await api.post<Trip>(`/trips/${tripId}/publish`, undefined, true);
      toast.success("سفر عمومی شد. لینک اشتراک آماده است.");
      if (updated.share_slug && typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(`${window.location.origin}/trips/public/${updated.share_slug}`);
        toast.success("لینک در کلیپ‌بورد کپی شد.");
      }
      await refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "انتشار انجام نشد.");
    }
  }

  async function removeTrip() {
    if (!window.confirm("کل این سفر حذف شود؟ این عمل بازگشت‌پذیر نیست.")) return;
    try {
      await api.delete(`/trips/${tripId}`, undefined, true);
      toast.success("سفر حذف شد.");
      window.location.href = "/account/trips";
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "حذف سفر انجام نشد.");
    }
  }

  if (tripQuery.isLoading) {
    return (
      <div className="container-app grid min-h-[60vh] place-items-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (tripQuery.error || !trip) {
    return (
      <div className="container-app py-16">
        <div className="card mx-auto max-w-md p-8 text-center">
          <h1 className="text-xl font-black text-ink">سفر پیدا نشد</h1>
          <p className="mt-2 text-sm text-ink/50">
            {tripQuery.error instanceof ApiError ? tripQuery.error.message : "این سفر در دسترس نیست."}
          </p>
          <Link href="/account/trips" className="btn-primary mt-6">بازگشت به سفرها</Link>
        </div>
      </div>
    );
  }

  const totalActivities = trip.days.reduce((sum, day) => sum + day.activities.length, 0);

  return (
    <AccountShell title={trip.title} description={`${trip.destination.name_local || trip.destination.name} · ${date(trip.start_date)} تا ${date(trip.end_date)}`}>
      <div className="card mb-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">{tripStatus[trip.status] ?? trip.status}</Badge>
            <Badge tone="slate"><CalendarDays className="h-3 w-3" /> {new Intl.NumberFormat("fa-IR").format(trip.days.length)} روز</Badge>
            <Badge tone="slate"><Users className="h-3 w-3" /> {new Intl.NumberFormat("fa-IR").format(trip.travelers)} نفر</Badge>
            <Badge tone="sand"><Wallet className="h-3 w-3" /> بودجه {toman(trip.budget, true)}</Badge>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <select className="input !w-auto !py-2 !text-xs" value={pace} onChange={(event) => setPace(event.target.value)}>
              <option value="relaxed">آرام</option>
              <option value="balanced">متعادل</option>
              <option value="packed">فشرده</option>
            </select>
            <button type="button" onClick={autoPlan} disabled={busy} className="btn-primary !rounded-xl !px-4 !py-2 !text-xs">
              <Sparkles className="h-3.5 w-3.5" /> برنامه هوشمند
            </button>
            <button type="button" onClick={publish} className="btn-secondary !rounded-xl !px-4 !py-2 !text-xs">
              <Link2 className="h-3.5 w-3.5" /> {trip.is_public ? "به‌روزرسانی لینک" : "انتشار"}
            </button>
            <button type="button" onClick={removeTrip} className="btn !rounded-xl border border-rose-200 bg-white !px-3 !py-2 !text-xs !text-rose-600 hover:bg-rose-50" aria-label="حذف سفر">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-2 text-[11px] sm:grid-cols-3">
          <div className="rounded-2xl bg-black/[0.025] p-3"><span className="text-ink/40">هزینه برنامه‌ریزی‌شده</span><div className="mt-1 font-bold text-ink">{toman(trip.spent)}</div></div>
          <div className="rounded-2xl bg-black/[0.025] p-3"><span className="text-ink/40">فعالیت‌ها</span><div className="mt-1 font-bold text-ink">{new Intl.NumberFormat("fa-IR").format(totalActivities)} مورد</div></div>
          <div className="rounded-2xl bg-black/[0.025] p-3"><span className="text-ink/40">مانده بودجه</span><div className={cn("mt-1 font-bold", trip.budget - trip.spent >= 0 ? "text-emerald-600" : "text-rose-600")}>{toman(trip.budget - trip.spent)}</div></div>
        </div>
        {trip.is_public && trip.share_slug && (
          <div className="mt-3 rounded-2xl bg-brand-50/70 px-3 py-2 text-[11px] text-brand-900">
            سفر شما عمومی است: <span className="font-mono">/trips/public/{trip.share_slug}</span>
          </div>
        )}
        {Object.keys(trip.budget_breakdown).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.entries(trip.budget_breakdown).map(([key, value]) => (
              <span key={key} className="rounded-full bg-white px-2.5 py-1 text-[10px] text-ink/55 ring-1 ring-black/5">{key}: {toman(value, true)}</span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {trip.days.map((day) => (
          <div key={day.id} className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-black/5 bg-black/[0.015] px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-700 text-xs font-black text-white">{new Intl.NumberFormat("fa-IR").format(day.day_number)}</span>
                <div>
                  <div className="text-xs font-bold text-ink">{day.title || `روز ${new Intl.NumberFormat("fa-IR").format(day.day_number)}`}</div>
                  <div className="text-[10px] text-ink/40">{date(day.date)}</div>
                </div>
              </div>
              <div className="text-[10px] text-ink/40">{toman(day.estimated_cost, true)}</div>
            </div>
            <div className="divide-y divide-black/[0.04]">
              {day.activities.map((activity) => (
                <div key={activity.id} className="group flex items-start gap-3 px-4 py-3">
                  <div className="flex w-12 shrink-0 flex-col items-center">
                    <span className="text-[11px] font-bold text-ink/60">{time(activity.start_time)}</span>
                    {activity.end_time && <span className="mt-0.5 text-[9px] text-ink/30">{time(activity.end_time)}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-bold text-ink">{activity.title}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-medium", TYPE_COLORS[activity.activity_type] ?? TYPE_COLORS.note)}>
                        {TYPE_LABELS[activity.activity_type] ?? activity.activity_type}
                      </span>
                    </div>
                    {activity.description && <p className="mt-1 text-[10px] leading-5 text-ink/45">{activity.description}</p>}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[9px] text-ink/35">
                      {activity.location_name && <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" /> {activity.location_name}</span>}
                      {activity.cost > 0 && <span>{toman(activity.cost, true)}</span>}
                    </div>
                  </div>
                  <button type="button" onClick={() => removeActivity(activity.id)} className="grid h-7 w-7 place-items-center rounded-lg text-ink/20 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100" aria-label="حذف فعالیت">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {day.activities.length === 0 && (
                <div className="px-4 py-4 text-center text-[11px] text-ink/35">فعالیتی برای این روز ثبت نشده است.</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 card p-4">
        <button type="button" onClick={() => setShowAdd((value) => !value)} className="flex items-center gap-1.5 text-xs font-bold text-brand-800">
          <Plus className="h-4 w-4" /> افزودن فعالیت به برنامه
        </button>
        {showAdd && (
          <form onSubmit={addActivity} className="mt-3 grid gap-2 sm:grid-cols-[100px_140px_1fr_120px_auto]">
            <select className="input !py-2 !text-xs" value={dayNumber} onChange={(event) => setDayNumber(Number(event.target.value))}>
              {trip.days.map((day) => <option key={day.id} value={day.day_number}>روز {new Intl.NumberFormat("fa-IR").format(day.day_number)}</option>)}
            </select>
            <input type="time" className="input !py-2 !text-xs" value={activityTime} onChange={(event) => setActivityTime(event.target.value)} />
            <input className="input !py-2 !text-xs" placeholder="عنوان فعالیت" value={activityTitle} onChange={(event) => setActivityTitle(event.target.value)} required />
            <input type="number" className="input !py-2 !text-xs" placeholder="هزینه" value={activityCost} min={0} step={50000} onChange={(event) => setActivityCost(Number(event.target.value))} />
            <button type="submit" disabled={busy} className="btn-primary !rounded-xl !px-4 !py-2 !text-xs">افزودن</button>
          </form>
        )}
      </div>

      {bookingQuery.data && bookingQuery.data.length > 0 && (
        <div className="mt-4 card p-4">
          <h2 className="flex items-center gap-2 text-sm font-black text-ink"><CheckCircle2 className="h-4 w-4 text-brand-700" /> رزروهای این سفر</h2>
          <div className="mt-3 space-y-2">
            {bookingQuery.data.map((booking) => (
              <Link key={booking.id} href={`/bookings/${booking.id}`} className="flex items-center justify-between rounded-xl bg-black/[0.025] px-3 py-2 text-xs hover:bg-brand-50/50">
                <span className="font-semibold text-ink">{booking.title}</span>
                <span className="text-brand-800">{toman(booking.total, true)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <Link href="/account/trips" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-ink/50 hover:text-ink">
        <ArrowRight className="h-3.5 w-3.5" /> بازگشت به سفرها
      </Link>
    </AccountShell>
  );
}

export default function TripDetailPage() {
  return (
    <RequireAuth>
      <TripDetailContent />
    </RequireAuth>
  );
}
