"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowLeftRight,
  Bus,
  CalendarDays,
  Car,
  CarTaxiFront,
  Clock3,
  Filter,
  Hotel,
  MapPin,
  Plane,
  Search,
  Sparkles,
  TrainFront,
  Users,
  Wallet,
} from "lucide-react";

import { AccommodationResultCard, ExperienceCard } from "@/components/cards";
import { Badge, EmptyState, LoadingCards, PageHero, Rating, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { dateInput, duration, time, toman } from "@/lib/format";
import type {
  AccommodationCard,
  Destination,
  Experience,
  Page,
  TransportOffer,
} from "@/lib/types";
import { cn, destinationName } from "@/lib/utils";

type Tab = "transport" | "stay" | "experience";

const TABS: { id: Tab; label: string; icon: typeof Bus }[] = [
  { id: "transport", label: "بلیت سفر", icon: Bus },
  { id: "stay", label: "اقامتگاه", icon: Hotel },
  { id: "experience", label: "تجربه محلی", icon: Sparkles },
];

const TRANSPORT_ICONS = {
  flight: Plane,
  train: TrainFront,
  bus: Bus,
  car: Car,
  taxi: CarTaxiFront,
} as const;

function normalizeTab(value: string | null): Tab {
  if (value === "stay" || value === "accommodation") return "stay";
  if (value === "experience") return "experience";
  return "transport";
}

function SearchContent() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(normalizeTab(searchParams.get("tab")));
  const [originId, setOriginId] = useState(searchParams.get("origin") ?? "");
  const [destinationId, setDestinationId] = useState(searchParams.get("destination") ?? "");
  const [travelDate, setTravelDate] = useState(searchParams.get("date") ?? dateInput(7));
  const [checkOut, setCheckOut] = useState(searchParams.get("checkOut") ?? dateInput(9));
  const [guests, setGuests] = useState(Number(searchParams.get("guests") ?? 2));
  const [sort, setSort] = useState("recommended");
  const [submitted, setSubmitted] = useState({
    tab: normalizeTab(searchParams.get("tab")),
    originId: searchParams.get("origin") ?? "",
    destinationId: searchParams.get("destination") ?? "",
    travelDate: searchParams.get("date") ?? dateInput(7),
    checkOut: searchParams.get("checkOut") ?? dateInput(9),
    guests: Number(searchParams.get("guests") ?? 2),
    sort: "recommended",
  });

  const destinationsQuery = useQuery({
    queryKey: ["destinations", "search"],
    queryFn: () => api.get<Page<Destination>>("/destinations", { limit: 50 }),
  });
  const destinations = useMemo(
    () => destinationsQuery.data?.items ?? [],
    [destinationsQuery.data],
  );

  const origin = submitted.originId || destinations.find((d) => d.slug === "tehran")?.id || "";
  const destination =
    submitted.destinationId || destinations.find((d) => d.slug === "shiraz")?.id || "";

  const transportQuery = useQuery({
    queryKey: ["search", "transport", origin, destination, submitted.travelDate, submitted.guests, submitted.sort],
    queryFn: () =>
      api.post<{ items: TransportOffer[]; total: number; meta: Record<string, unknown> }>(
        "/transportation/search",
        {
          origin_id: origin,
          destination_id: destination,
          date: submitted.travelDate,
          passengers: submitted.guests,
          sort: submitted.sort,
        },
      ),
    enabled:
      submitted.tab === "transport" && Boolean(origin) && Boolean(destination) && origin !== destination,
    retry: false,
  });

  const stayQuery = useQuery({
    queryKey: ["search", "stay", destination, submitted.travelDate, submitted.checkOut, submitted.guests, submitted.sort],
    queryFn: () =>
      api.post<{ items: AccommodationCard[]; total: number }>("/accommodations/search", {
        destination_id: destination,
        check_in: submitted.travelDate,
        check_out: submitted.checkOut,
        guests: submitted.guests,
        sort: submitted.sort === "fastest" ? "recommended" : submitted.sort,
      }),
    enabled: submitted.tab === "stay" && Boolean(destination) && submitted.checkOut > submitted.travelDate,
    retry: false,
  });

  const experienceQuery = useQuery({
    queryKey: ["search", "experience", destination],
    queryFn: () =>
      api.get<Page<Experience>>("/experiences", {
        destination_id: destination,
        page_size: 24,
        sort: "rating",
      }),
    enabled: submitted.tab === "experience" && Boolean(destination),
    retry: false,
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted({ tab, originId, destinationId, travelDate, checkOut, guests, sort });
  }

  function swap() {
    setOriginId(destinationId);
    setDestinationId(originId);
  }

  const activeError = transportQuery.error || stayQuery.error || experienceQuery.error;
  const loading =
    (submitted.tab === "transport" && transportQuery.isFetching) ||
    (submitted.tab === "stay" && stayQuery.isFetching) ||
    (submitted.tab === "experience" && experienceQuery.isFetching);

  return (
    <>
      <PageHero
        title="جستجوی سفر"
        description="بلیت، اقامتگاه و تجربه‌های محلی را در یک‌جا مقایسه کن و بهترین گزینه را رزرو کن."
        badge={
          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-[11px] font-bold text-brand-800">
            <Search className="h-3.5 w-3.5" /> جستجوی هوشمند سیر
          </span>
        }
      >
        <form onSubmit={submit} className="card overflow-hidden p-2">
          <div className="flex gap-1 rounded-2xl bg-black/[0.035] p-1">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition sm:text-sm",
                  tab === item.id ? "bg-white text-brand-800 shadow-sm" : "text-ink/50 hover:text-ink",
                )}
              >
                <item.icon className="h-4 w-4" /> {item.label}
              </button>
            ))}
          </div>

          <div className="grid gap-2 p-2 lg:grid-cols-[1fr_1fr_auto_auto]">
            {tab === "transport" ? (
              <div className="grid grid-cols-[1fr_auto_1fr] items-center rounded-2xl border border-black/10 bg-white px-2">
                <label className="block px-2 py-2">
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-ink/40">
                    <MapPin className="h-3 w-3" /> مبدأ
                  </span>
                  <select
                    className="mt-0.5 w-full bg-transparent text-sm font-bold text-ink outline-none"
                    value={originId || origin}
                    onChange={(event) => setOriginId(event.target.value)}
                  >
                    {destinations.map((item) => (
                      <option key={item.id} value={item.id}>{destinationName(item)}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={swap}
                  className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-700 transition hover:rotate-180"
                  aria-label="جابه‌جایی"
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                </button>
                <label className="block px-2 py-2">
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-ink/40">
                    <MapPin className="h-3 w-3" /> مقصد
                  </span>
                  <select
                    className="mt-0.5 w-full bg-transparent text-sm font-bold text-ink outline-none"
                    value={destinationId || destination}
                    onChange={(event) => setDestinationId(event.target.value)}
                  >
                    {destinations.map((item) => (
                      <option key={item.id} value={item.id}>{destinationName(item)}</option>
                    ))}
                  </select>
                </label>
              </div>
            ) : (
              <label className="block rounded-2xl border border-black/10 bg-white px-4 py-2">
                <span className="flex items-center gap-1 text-[10px] font-semibold text-ink/40">
                  <MapPin className="h-3 w-3" /> مقصد
                </span>
                <select
                  className="mt-0.5 w-full bg-transparent text-sm font-bold text-ink outline-none"
                  value={destinationId || destination}
                  onChange={(event) => setDestinationId(event.target.value)}
                >
                  {destinations.map((item) => (
                    <option key={item.id} value={item.id}>{destinationName(item)}</option>
                  ))}
                </select>
              </label>
            )}

            <div className={cn("grid gap-2", tab === "stay" ? "grid-cols-2" : "grid-cols-1")}>
              <label className="block rounded-2xl border border-black/10 bg-white px-4 py-2">
                <span className="flex items-center gap-1 text-[10px] font-semibold text-ink/40">
                  <CalendarDays className="h-3 w-3" /> {tab === "stay" ? "ورود" : "تاریخ سفر"}
                </span>
                <input
                  type="date"
                  className="mt-0.5 w-full bg-transparent text-sm font-bold text-ink outline-none"
                  value={travelDate}
                  min={dateInput()}
                  onChange={(event) => setTravelDate(event.target.value)}
                />
              </label>
              {tab === "stay" && (
                <label className="block rounded-2xl border border-black/10 bg-white px-4 py-2">
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-ink/40">
                    <CalendarDays className="h-3 w-3" /> خروج
                  </span>
                  <input
                    type="date"
                    className="mt-0.5 w-full bg-transparent text-sm font-bold text-ink outline-none"
                    value={checkOut}
                    min={travelDate}
                    onChange={(event) => setCheckOut(event.target.value)}
                  />
                </label>
              )}
            </div>

            <label className="block min-w-[100px] rounded-2xl border border-black/10 bg-white px-4 py-2">
              <span className="flex items-center gap-1 text-[10px] font-semibold text-ink/40">
                <Users className="h-3 w-3" /> مسافر
              </span>
              <select
                className="mt-0.5 w-full bg-transparent text-sm font-bold text-ink outline-none"
                value={guests}
                onChange={(event) => setGuests(Number(event.target.value))}
              >
                {[1, 2, 3, 4, 5, 6, 8].map((count) => (
                  <option key={count} value={count}>{new Intl.NumberFormat("fa-IR").format(count)} نفر</option>
                ))}
              </select>
            </label>

            <button type="submit" className="btn-primary !rounded-2xl lg:!px-7">
              <Search className="h-4 w-4" /> جستجو
            </button>
          </div>
        </form>
      </PageHero>

      <section className="container-app py-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-ink">
            <Filter className="h-4 w-4 text-brand-700" /> نتایج جستجو
            <span className="text-xs font-normal text-ink/40">
              {submitted.tab === "transport" && transportQuery.data
                ? `${new Intl.NumberFormat("fa-IR").format(transportQuery.data.total)} گزینه`
                : submitted.tab === "stay" && stayQuery.data
                  ? `${new Intl.NumberFormat("fa-IR").format(stayQuery.data.total)} اقامتگاه`
                  : submitted.tab === "experience" && experienceQuery.data
                    ? `${new Intl.NumberFormat("fa-IR").format(experienceQuery.data.total)} تجربه`
                    : ""}
            </span>
          </div>
          <select
            className="input !w-auto !py-2 text-xs"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value);
              setSubmitted((current) => ({ ...current, sort: event.target.value }));
            }}
          >
            <option value="recommended">پیشنهاد سیر</option>
            <option value="cheapest">ارزان‌ترین</option>
            {submitted.tab === "transport" && <option value="fastest">سریع‌ترین</option>}
            {submitted.tab !== "transport" && <option value="rating">بالاترین امتیاز</option>}
          </select>
        </div>

        {origin === destination && submitted.tab === "transport" && (
          <EmptyState title="مبدأ و مقصد یکسان است" description="برای جستجوی بلیت، دو شهر متفاوت را انتخاب کنید." />
        )}

        {loading && <LoadingCards count={3} />}

        {!loading && activeError && (
          <EmptyState
            title="جستجو انجام نشد"
            description={activeError instanceof ApiError ? activeError.message : "اتصال به سرور را بررسی کنید."}
          />
        )}

        {!loading && !activeError && submitted.tab === "transport" && (
          <div className="space-y-3">
            {(transportQuery.data?.items ?? []).map((offer) => {
              const Icon = TRANSPORT_ICONS[offer.type] ?? Bus;
              return (
                <div key={offer.id} className="card grid gap-4 p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="text-sm font-extrabold text-ink">{offer.provider.name}</div>
                      <div className="text-[10px] text-ink/40">{offer.code}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
                    <div>
                      <div className="text-lg font-black text-ink">{time(offer.departure_at)}</div>
                      <div className="text-[10px] text-ink/45">{destinationName(offer.origin)}</div>
                    </div>
                    <div className="min-w-[90px]">
                      <div className="flex items-center gap-1 text-[10px] text-ink/40">
                        <span className="h-px flex-1 bg-black/10" />
                        <Clock3 className="h-3 w-3" />
                        <span className="h-px flex-1 bg-black/10" />
                      </div>
                      <div className="mt-1 text-[10px] text-ink/45">{duration(offer.duration_minutes)}</div>
                      <Badge tone={offer.stops ? "slate" : "emerald"} className="mt-1">
                        {offer.stops ? `${new Intl.NumberFormat("fa-IR").format(offer.stops)} توقف` : "مستقیم"}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-lg font-black text-ink">{time(offer.arrival_at)}</div>
                      <div className="text-[10px] text-ink/45">{destinationName(offer.destination)}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-black/5 pt-3 sm:flex-col sm:items-end sm:border-none sm:pt-0">
                    <div className="text-left">
                      <div className="text-lg font-black text-brand-800">{toman(offer.price)}</div>
                      <div className="text-[10px] text-ink/40">{new Intl.NumberFormat("fa-IR").format(offer.seats_available)} صندلی</div>
                    </div>
                    <Link
                      href={`/booking?type=transport&offer=${offer.id}&date=${submitted.travelDate}&guests=${submitted.guests}`}
                      className="btn-primary !rounded-xl !px-4 !py-2.5 !text-xs"
                    >
                      انتخاب
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
            {transportQuery.data && transportQuery.data.items.length === 0 && (
              <EmptyState title="بلیتی پیدا نشد" description="تاریخ دیگری را امتحان کنید یا مبدأ و مقصد را تغییر دهید." />
            )}
          </div>
        )}

        {!loading && !activeError && submitted.tab === "stay" && (
          <div className="space-y-4">
            {(stayQuery.data?.items ?? []).map((hotel) => (
              <AccommodationResultCard
                key={hotel.id}
                hotel={hotel}
                checkIn={submitted.travelDate}
                checkOut={submitted.checkOut}
                guests={submitted.guests}
              />
            ))}
            {stayQuery.data && stayQuery.data.items.length === 0 && (
              <EmptyState title="اقامتگاهی پیدا نشد" description="بازه تاریخ یا تعداد مسافر را تغییر دهید." />
            )}
          </div>
        )}

        {!loading && !activeError && submitted.tab === "experience" && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {(experienceQuery.data?.items ?? []).map((experience) => (
              <ExperienceCard key={experience.id} experience={experience} />
            ))}
            {experienceQuery.data && experienceQuery.data.items.length === 0 && (
              <div className="sm:col-span-2 lg:col-span-3">
                <EmptyState title="تجربه‌ای پیدا نشد" description="مقصد دیگری را انتخاب کنید." />
              </div>
            )}
          </div>
        )}

        {(submitted.tab === "stay" && submitted.checkOut <= submitted.travelDate) && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-xs text-amber-700">
            <Wallet className="h-4 w-4" /> تاریخ خروج باید بعد از تاریخ ورود باشد.
          </div>
        )}
      </section>
    </>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="container-app grid min-h-[60vh] place-items-center">
          <Spinner className="h-8 w-8" />
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
