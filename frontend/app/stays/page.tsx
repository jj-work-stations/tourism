"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  BedDouble,
  CalendarDays,
  Coffee,
  MapPin,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Users,
} from "lucide-react";

import { AccommodationResultCard } from "@/components/cards";
import {
  ChipFilter,
  EmptyState,
  LoadingCards,
  PageHero,
  Spinner,
} from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { dateInput, number } from "@/lib/format";
import type {
  AccommodationCard,
  Destination,
  MetaOptions,
  Page,
} from "@/lib/types";
import { destinationName } from "@/lib/utils";

const SORTS = [
  { value: "recommended", label: "پیشنهاد سیر" },
  { value: "cheapest", label: "ارزان‌ترین" },
  { value: "expensive", label: "گران‌ترین" },
  { value: "rating", label: "بالاترین امتیاز" },
];

function StaysContent() {
  const searchParams = useSearchParams();
  const slugFromUrl = searchParams.get("destination");

  const [checkIn, setCheckIn] = useState(searchParams.get("checkIn") ?? dateInput(7));
  const [checkOut, setCheckOut] = useState(searchParams.get("checkOut") ?? dateInput(9));
  const [guests, setGuests] = useState(Number(searchParams.get("guests") ?? 2));
  const [types, setTypes] = useState<string[]>([]);
  const [minRating, setMinRating] = useState(0);
  const [maxPrice, setMaxPrice] = useState(0);
  const [breakfast, setBreakfast] = useState(false);
  const [freeCancellation, setFreeCancellation] = useState(false);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [sort, setSort] = useState("recommended");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const destinationsQuery = useQuery({
    queryKey: ["destinations", "stays"],
    queryFn: () => api.get<Page<Destination>>("/destinations", { limit: 50 }),
  });
  const metaQuery = useQuery({
    queryKey: ["meta", "options", "stays"],
    queryFn: () => api.get<MetaOptions>("/meta/options"),
  });

  const destinations = useMemo(
    () => destinationsQuery.data?.items ?? [],
    [destinationsQuery.data],
  );
  const initialDestination = useMemo(
    () => destinations.find((d) => d.slug === slugFromUrl) ?? destinations.find((d) => d.slug === "shiraz") ?? destinations[0],
    [destinations, slugFromUrl],
  );
  const [destinationId, setDestinationId] = useState("");
  const activeDestinationId = destinationId || initialDestination?.id || "";

  const accommodationTypes = metaQuery.data?.accommodation_types ?? [];
  const amenityOptions = (metaQuery.data?.amenities ?? []).slice(0, 12);

  const searchBody = useMemo(
    () => ({
      destination_id: activeDestinationId,
      check_in: checkIn,
      check_out: checkOut,
      guests,
      types: types.length ? types : undefined,
      min_rating: minRating || undefined,
      max_price: maxPrice || undefined,
      breakfast: breakfast || undefined,
      free_cancellation: freeCancellation || undefined,
      amenities: amenities.length ? amenities : undefined,
      sort,
    }),
    [activeDestinationId, checkIn, checkOut, guests, types, minRating, maxPrice, breakfast, freeCancellation, amenities, sort],
  );

  const results = useQuery({
    queryKey: ["stays", "search", searchBody],
    queryFn: () =>
      api.post<{ items: AccommodationCard[]; total: number }>(
        "/accommodations/search",
        searchBody,
      ),
    enabled: Boolean(activeDestinationId) && checkOut > checkIn,
    retry: false,
  });

  const dateInvalid = checkOut <= checkIn;
  const activeFilters = types.length + amenities.length + (minRating ? 1 : 0) + (maxPrice ? 1 : 0) + (breakfast ? 1 : 0) + (freeCancellation ? 1 : 0);

  function toggle(list: string[], setList: (value: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  const filterPanel = (
    <div className="space-y-6">
      <div>
        <div className="mb-2.5 flex items-center gap-1.5 text-xs font-black text-ink">
          <BedDouble className="h-3.5 w-3.5 text-brand-700" /> نوع اقامتگاه
        </div>
        <div className="flex flex-wrap gap-1.5">
          {accommodationTypes.map((item) => (
            <ChipFilter
              key={item.value}
              active={types.includes(item.value)}
              onClick={() => toggle(types, setTypes, item.value)}
            >
              {item.label}
            </ChipFilter>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2.5 text-xs font-black text-ink">حداقل امتیاز مهمان</div>
        <div className="flex flex-wrap gap-1.5">
          {[
            { value: 0, label: "همه" },
            { value: 7, label: "۷+ خیلی خوب" },
            { value: 8, label: "۸+ عالی" },
            { value: 9, label: "۹+ استثنایی" },
          ].map((item) => (
            <ChipFilter key={item.value} active={minRating === item.value} onClick={() => setMinRating(item.value)}>
              {item.label}
            </ChipFilter>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2.5 text-xs font-black text-ink">حداکثر قیمت هر شب</div>
        <input
          type="range"
          min={0}
          max={30_000_000}
          step={500_000}
          value={maxPrice}
          onChange={(event) => setMaxPrice(Number(event.target.value))}
          className="w-full accent-brand-700"
        />
        <div className="mt-1 flex justify-between text-[10px] text-ink/40">
          <span>بدون محدودیت</span>
          <span className="font-bold text-brand-800">
            {maxPrice ? `تا ${number(maxPrice)} تومان` : "همه قیمت‌ها"}
          </span>
        </div>
      </div>

      <div>
        <div className="mb-2.5 text-xs font-black text-ink">امکانات</div>
        <div className="flex flex-wrap gap-1.5">
          {amenityOptions.map((item) => (
            <ChipFilter
              key={item.value}
              active={amenities.includes(item.value)}
              onClick={() => toggle(amenities, setAmenities, item.value)}
            >
              {item.label}
            </ChipFilter>
          ))}
        </div>
      </div>

      <div className="space-y-2 border-t border-black/[0.06] pt-4">
        <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink/70">
          <input type="checkbox" checked={breakfast} onChange={(e) => setBreakfast(e.target.checked)} className="h-4 w-4 accent-brand-700" />
          <Coffee className="h-3.5 w-3.5 text-gold-600" /> صبحانه رایگان
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink/70">
          <input type="checkbox" checked={freeCancellation} onChange={(e) => setFreeCancellation(e.target.checked)} className="h-4 w-4 accent-brand-700" />
          <RotateCcw className="h-3.5 w-3.5 text-emerald-600" /> لغو رایگان
        </label>
      </div>

      {activeFilters > 0 && (
        <button
          type="button"
          onClick={() => {
            setTypes([]);
            setAmenities([]);
            setMinRating(0);
            setMaxPrice(0);
            setBreakfast(false);
            setFreeCancellation(false);
          }}
          className="btn-ghost w-full !py-2 !text-xs"
        >
          <RotateCcw className="h-3.5 w-3.5" /> پاک کردن {number(activeFilters)} فیلتر
        </button>
      )}
    </div>
  );

  return (
    <>
      <PageHero
        title="اقامتگاه‌های ایران"
        description="از هتل‌های پنج‌ستاره تا بوم‌گردی‌های اصیل و بناهای تاریخی؛ با فیلترهای دقیق، اقامتگاه رویایی‌ات را پیدا کن."
        badge={
          <span className="eyebrow">
            <BedDouble className="h-3.5 w-3.5" /> اقامت اصیل و مدرن
          </span>
        }
      >
        <form
          onSubmit={(event) => event.preventDefault()}
          className="card grid gap-2 p-2 lg:grid-cols-[1.2fr_auto_auto_auto]"
        >
          <label className="block rounded-2xl border border-black/10 bg-white px-4 py-2">
            <span className="flex items-center gap-1 text-[10px] font-semibold text-ink/40">
              <MapPin className="h-3 w-3" /> مقصد
            </span>
            <select
              className="mt-0.5 w-full bg-transparent text-sm font-bold text-ink outline-none"
              value={activeDestinationId}
              onChange={(event) => setDestinationId(event.target.value)}
            >
              {destinations.map((item) => (
                <option key={item.id} value={item.id}>{destinationName(item)}</option>
              ))}
            </select>
          </label>
          <label className="block rounded-2xl border border-black/10 bg-white px-4 py-2">
            <span className="flex items-center gap-1 text-[10px] font-semibold text-ink/40">
              <CalendarDays className="h-3 w-3" /> ورود
            </span>
            <input
              type="date"
              className="mt-0.5 w-full bg-transparent text-sm font-bold text-ink outline-none"
              value={checkIn}
              min={dateInput()}
              onChange={(event) => setCheckIn(event.target.value)}
            />
          </label>
          <label className="block rounded-2xl border border-black/10 bg-white px-4 py-2">
            <span className="flex items-center gap-1 text-[10px] font-semibold text-ink/40">
              <CalendarDays className="h-3 w-3" /> خروج
            </span>
            <input
              type="date"
              className="mt-0.5 w-full bg-transparent text-sm font-bold text-ink outline-none"
              value={checkOut}
              min={checkIn}
              onChange={(event) => setCheckOut(event.target.value)}
            />
          </label>
          <label className="block min-w-[110px] rounded-2xl border border-black/10 bg-white px-4 py-2">
            <span className="flex items-center gap-1 text-[10px] font-semibold text-ink/40">
              <Users className="h-3 w-3" /> مهمان
            </span>
            <select
              className="mt-0.5 w-full bg-transparent text-sm font-bold text-ink outline-none"
              value={guests}
              onChange={(event) => setGuests(Number(event.target.value))}
            >
              {[1, 2, 3, 4, 5, 6, 8].map((count) => (
                <option key={count} value={count}>{number(count)} نفر</option>
              ))}
            </select>
          </label>
        </form>
      </PageHero>

      <section className="container-app py-8">
        <div className="grid gap-6 lg:grid-cols-[270px_1fr]">
          <aside className="hidden h-fit lg:block">
            <div className="card sticky top-24 p-5">
              <div className="mb-4 flex items-center gap-2 border-b border-black/[0.06] pb-3 text-sm font-black text-ink">
                <SlidersHorizontal className="h-4 w-4 text-brand-700" /> فیلترها
                {activeFilters > 0 && (
                  <span className="rounded-full bg-brand-700 px-2 py-0.5 text-[10px] text-white">{number(activeFilters)}</span>
                )}
              </div>
              {filterPanel}
            </div>
          </aside>

          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-bold text-ink">
                {number(results.data?.total ?? 0)} اقامتگاه پیدا شد
                {results.isFetching && <Spinner className="h-3.5 w-3.5" />}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFiltersOpen((v) => !v)}
                  className="filter-pill lg:hidden"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  فیلترها {activeFilters > 0 && `(${number(activeFilters)})`}
                </button>
                <select className="input !w-auto !py-2 text-xs" value={sort} onChange={(e) => setSort(e.target.value)}>
                  {SORTS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {filtersOpen && (
              <div className="card mb-5 p-5 lg:hidden">{filterPanel}</div>
            )}

            {dateInvalid && (
              <div className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-xs text-amber-700">
                تاریخ خروج باید بعد از تاریخ ورود باشد.
              </div>
            )}

            {results.isLoading && <LoadingCards count={4} />}

            {!results.isLoading && results.error && (
              <EmptyState
                title="جستجوی اقامتگاه انجام نشد"
                description={results.error instanceof ApiError ? results.error.message : "اتصال به سرور را بررسی کنید."}
              />
            )}

            {!results.isLoading && !results.error && (
              <div className="space-y-4">
                {(results.data?.items ?? []).map((hotel) => (
                  <AccommodationResultCard
                    key={hotel.id}
                    hotel={hotel}
                    checkIn={checkIn}
                    checkOut={checkOut}
                    guests={guests}
                  />
                ))}
                {results.data && results.data.items.length === 0 && (
                  <EmptyState
                    icon={<BedDouble className="h-6 w-6" />}
                    title="اقامتگاهی با این شرایط پیدا نشد"
                    description="بازه تاریخ، تعداد مهمان یا فیلترها را تغییر دهید."
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

export default function StaysPage() {
  return (
    <Suspense
      fallback={
        <div className="container-app grid min-h-[60vh] place-items-center">
          <Spinner className="h-8 w-8" />
        </div>
      }
    >
      <StaysContent />
    </Suspense>
  );
}
