"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Map,
  Plus,
  Sparkles,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { AccountShell } from "@/components/account-shell";
import { RequireAuth } from "@/components/require-auth";
import { Badge, EmptyState, LoadingCards, SmartImage } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useApiQuery } from "@/lib/hooks";
import { dateInput, date, toman, tripStatus } from "@/lib/format";
import type { Destination, Page, Trip } from "@/lib/types";
import { cn, destinationName } from "@/lib/utils";

const TABS = [
  { id: "upcoming", label: "پیش‌رو" },
  { id: "ongoing", label: "در حال سفر" },
  { id: "completed", label: "تکمیل شده" },
  { id: "", label: "همه" },
];

function TripsContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("upcoming");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [destinationId, setDestinationId] = useState("");
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(dateInput(14));
  const [endDate, setEndDate] = useState(dateInput(17));
  const [travelers, setTravelers] = useState(2);
  const [budget, setBudget] = useState(15_000_000);
  const [interests, setInterests] = useState<string[]>(["history", "food"]);

  const trips = useApiQuery<Page<Trip>>(["account", "trips", tab], "/trips", {
    tab: tab || undefined,
    page_size: 30,
  });
  const destinations = useQuery({
    queryKey: ["destinations", "trip-form"],
    queryFn: () => api.get<Page<Destination>>("/destinations", { limit: 50 }),
    enabled: open,
  });

  async function createTrip(event: React.FormEvent) {
    event.preventDefault();
    if (!destinationId) {
      toast.error("مقصد را انتخاب کنید.");
      return;
    }
    if (endDate < startDate) {
      toast.error("تاریخ پایان باید بعد از شروع باشد.");
      return;
    }
    setSaving(true);
    try {
      const trip = await api.post<Trip>(
        "/trips",
        {
          destination_id: destinationId,
          title: title || undefined,
          start_date: startDate,
          end_date: endDate,
          travelers,
          budget,
          interests,
        },
        true,
      );
      toast.success("سفر ساخته شد. حالا برنامه هوشمند بساز!");
      await queryClient.invalidateQueries({ queryKey: ["account", "trips"] });
      setOpen(false);
      router.push(`/account/trips/${trip.id}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "ساخت سفر انجام نشد.");
    } finally {
      setSaving(false);
    }
  }

  const interestOptions = [
    { value: "history", label: "تاریخ" },
    { value: "culture", label: "فرهنگ" },
    { value: "nature", label: "طبیعت" },
    { value: "food", label: "غذا" },
    { value: "shopping", label: "خرید" },
    { value: "adventure", label: "ماجراجویی" },
    { value: "photography", label: "عکاسی" },
    { value: "family", label: "خانوادگی" },
  ];

  return (
    <AccountShell
      title="سفرهای من"
      description="برنامه سفرها را بساز، روزبه‌روز ویرایش کن و با دوستانت به اشتراک بگذار."
      action={
        <button type="button" onClick={() => setOpen(true)} className="btn-primary !py-2.5 !text-xs">
          <Plus className="h-4 w-4" /> سفر جدید
        </button>
      }
    >
      {open && (
        <div className="card mb-5 p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-black text-ink"><Sparkles className="h-4 w-4 text-brand-700" /> ساخت سفر جدید</h2>
            <button type="button" onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-ink/40 hover:bg-black/5"><X className="h-4 w-4" /></button>
          </div>
          <form onSubmit={createTrip} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="label">مقصد</span>
              <select className="input" value={destinationId} onChange={(event) => setDestinationId(event.target.value)} required>
                <option value="">انتخاب مقصد...</option>
                {(destinations.data?.items ?? []).map((destination) => (
                  <option key={destination.id} value={destination.id}>{destinationName(destination)}</option>
                ))}
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="label">عنوان سفر (اختیاری)</span>
              <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="مثلاً سفر بهاری اصفهان" />
            </label>
            <label className="block">
              <span className="label">تاریخ شروع</span>
              <input type="date" className="input" value={startDate} min={dateInput()} onChange={(event) => setStartDate(event.target.value)} />
            </label>
            <label className="block">
              <span className="label">تاریخ پایان</span>
              <input type="date" className="input" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} />
            </label>
            <label className="block">
              <span className="label">تعداد مسافر</span>
              <select className="input" value={travelers} onChange={(event) => setTravelers(Number(event.target.value))}>
                {[1, 2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{new Intl.NumberFormat("fa-IR").format(count)} نفر</option>)}
              </select>
            </label>
            <label className="block">
              <span className="label">بودجه (تومان)</span>
              <input type="number" className="input" value={budget} min={0} step={500000} onChange={(event) => setBudget(Number(event.target.value))} />
            </label>
            <div className="sm:col-span-2">
              <span className="label">علاقه‌مندی‌ها</span>
              <div className="flex flex-wrap gap-1.5">
                {interestOptions.map((item) => {
                  const active = interests.includes(item.value);
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setInterests((current) => active ? current.filter((value) => value !== item.value) : [...current, item.value])}
                      className={cn("rounded-full px-3 py-1.5 text-[11px] font-semibold transition", active ? "bg-brand-700 text-white" : "bg-black/[0.04] text-ink/55 hover:bg-black/[0.07]")}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="sm:col-span-2">
              <button type="submit" disabled={saving} className="btn-primary w-full sm:w-auto">
                {saving ? "در حال ساخت..." : "ساخت سفر"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-1 rounded-2xl bg-black/[0.035] p-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn("rounded-xl px-3.5 py-2 text-xs font-bold transition", tab === item.id ? "bg-white text-brand-800 shadow-sm" : "text-ink/50 hover:text-ink")}
          >
            {item.label}
          </button>
        ))}
      </div>

      {trips.isLoading ? (
        <LoadingCards count={3} />
      ) : trips.data && trips.data.items.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {trips.data.items.map((trip) => (
            <Link key={trip.id} href={`/account/trips/${trip.id}`} className="card group overflow-hidden transition hover:shadow-soft">
              <div className="relative">
                <SmartImage src={trip.cover_image || trip.destination.image_url} alt={trip.title} className="h-36 w-full" fallbackClassName="h-36 w-full" />
                <div className="absolute right-3 top-3">
                  <Badge tone="brand" className="bg-white/90">{tripStatus[trip.status] ?? trip.status}</Badge>
                </div>
              </div>
              <div className="p-4">
                <h3 className="truncate font-extrabold text-ink group-hover:text-brand-800">{trip.title}</h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-ink/45">
                  <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {date(trip.start_date)}</span>
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {new Intl.NumberFormat("fa-IR").format(trip.travelers)} نفر</span>
                  <span className="flex items-center gap-1"><Wallet className="h-3 w-3" /> {toman(trip.budget, true)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-black/5 pt-2 text-[10px]">
                  <span className="text-ink/40">{new Intl.NumberFormat("fa-IR").format(trip.days.length)} روز · {new Intl.NumberFormat("fa-IR").format(trip.days.reduce((sum, day) => sum + day.activities.length, 0))} فعالیت</span>
                  <span className="font-bold text-brand-800">{toman(trip.spent, true)} هزینه</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Map className="h-6 w-6" />}
          title={tab ? "سفری در این وضعیت نیست" : "هنوز سفری نساخته‌اید"}
          description="یک سفر بسازید و با دستیار هوشمند برنامه روزبه‌روز دریافت کنید."
          action={<button type="button" onClick={() => setOpen(true)} className="btn-primary mt-2"><Plus className="h-4 w-4" /> ساخت اولین سفر</button>}
        />
      )}

      <Link href="/assistant" className="mt-5 flex items-center justify-between rounded-2xl bg-brand-900 p-4 text-white">
        <span className="flex items-center gap-2 text-xs font-bold"><Sparkles className="h-4 w-4 text-sand-300" /> نمی‌دانی کجا بروی؟ از دستیار هوشمند بپرس</span>
        <ArrowLeft className="h-4 w-4" />
      </Link>
    </AccountShell>
  );
}

export default function TripsPage() {
  return (
    <RequireAuth>
      <TripsContent />
    </RequireAuth>
  );
}
