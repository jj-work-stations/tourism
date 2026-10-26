"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChefHat,
  MapPin,
  Phone,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  UtensilsCrossed,
} from "lucide-react";

import { SmartImage, EmptyState, LoadingCards, PageHero, Rating, Spinner, ChipFilter } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { number, toman } from "@/lib/format";
import type { Destination, Page, Restaurant } from "@/lib/types";
import { cn } from "@/lib/utils";

const SORTS = [
  { value: "rating", label: "بالاترین امتیاز" },
  { value: "price", label: "ارزان‌ترین" },
  { value: "name", label: "نام (الفبا)" },
];

const PRICE_LABEL: Record<number, string> = {
  1: "اقتصادی",
  2: "متوسط",
  3: "گران",
  4: "بسیار گران",
};

function RestaurantTile({ restaurant }: { restaurant: Restaurant }) {
  return (
    <Link href={`/map?dest=${restaurant.destination_id}`} className="card card-hover group overflow-hidden">
      <div className="relative">
        <SmartImage
          src={restaurant.image_url}
          alt={restaurant.name}
          className="h-40 w-full transition duration-700 group-hover:scale-105"
          fallbackClassName="h-40 w-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <div className="absolute right-3 top-3 flex gap-1.5">
          {restaurant.is_featured && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-brand-800 backdrop-blur">
              <Sparkles className="h-3 w-3" /> ویژه
            </span>
          )}
          <span className="rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur">
            {PRICE_LABEL[restaurant.price_range] ?? "—"}
          </span>
        </div>
        <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[10px] text-white backdrop-blur">
          <UtensilsCrossed className="h-3 w-3" /> {restaurant.cuisine}
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 font-extrabold text-ink group-hover:text-brand-800">{restaurant.name}</h3>
          <Rating value={restaurant.rating} count={restaurant.review_count} size="sm" />
        </div>
        <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-6 text-ink/50">{restaurant.description}</p>
        {restaurant.signature_dishes.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {restaurant.signature_dishes.slice(0, 3).map((dish) => (
              <span key={dish} className="rounded-lg bg-gold-50 px-2 py-1 text-[10px] font-semibold text-gold-700">
                {dish}
              </span>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center justify-between border-t border-black/[0.06] pt-3 text-[11px]">
          <span className="flex items-center gap-1 text-ink/45">
            <MapPin className="h-3.5 w-3.5 text-brand-600" /> {restaurant.address || restaurant.destination_name}
          </span>
          <span className="font-bold text-brand-800">
            میانگین {toman(restaurant.average_price, true)}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function RestaurantsPage() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [priceRanges, setPriceRanges] = useState<number[]>([]);
  const [minRating, setMinRating] = useState(0);
  const [reservationOnly, setReservationOnly] = useState(false);
  const [sort, setSort] = useState("rating");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const destinationsQuery = useQuery({
    queryKey: ["destinations", "restaurants"],
    queryFn: () => api.get<Page<Destination>>("/destinations", { limit: 50 }),
  });
  const destinations = useMemo(() => destinationsQuery.data?.items ?? [], [destinationsQuery.data]);

  const results = useQuery({
    queryKey: ["restaurants", "list", query, destinationId, minRating, sort],
    queryFn: () =>
      api.get<Page<Restaurant>>("/restaurants", {
        q: query || undefined,
        destination_id: destinationId || undefined,
        min_rating: minRating || undefined,
        sort,
        page_size: 60,
      }),
    retry: false,
  });

  const items = results.data?.items ?? [];
  const cuisines = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) if (item.cuisine) set.add(item.cuisine);
    return [...set];
  }, [items]);

  const filtered = useMemo(
    () =>
      items.filter(
        (item) =>
          (!cuisine || item.cuisine === cuisine) &&
          (priceRanges.length === 0 || priceRanges.includes(item.price_range)) &&
          (!reservationOnly || item.reservation_enabled),
      ),
    [items, cuisine, priceRanges, reservationOnly],
  );

  const activeFilters = (cuisine ? 1 : 0) + priceRanges.length + (minRating ? 1 : 0) + (reservationOnly ? 1 : 0);

  const filterPanel = (
    <div className="space-y-6">
      <div>
        <div className="mb-2.5 flex items-center gap-1.5 text-xs font-black text-ink">
          <ChefHat className="h-3.5 w-3.5 text-brand-700" /> نوع غذا
        </div>
        <div className="flex flex-wrap gap-1.5">
          {cuisines.map((item) => (
            <ChipFilter key={item} active={cuisine === item} onClick={() => setCuisine(cuisine === item ? "" : item)}>
              {item}
            </ChipFilter>
          ))}
          {cuisines.length === 0 && <span className="text-[11px] text-ink/35">برای دیدن انواع غذا، نتیجه‌ای بارگذاری شود.</span>}
        </div>
      </div>

      <div>
        <div className="mb-2.5 text-xs font-black text-ink">مقصد</div>
        <select className="field-sm" value={destinationId} onChange={(event) => setDestinationId(event.target.value)}>
          <option value="">همه شهرها</option>
          {destinations.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </div>

      <div>
        <div className="mb-2.5 text-xs font-black text-ink">سطح قیمت</div>
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 4].map((level) => (
            <ChipFilter
              key={level}
              active={priceRanges.includes(level)}
              onClick={() =>
                setPriceRanges((current) =>
                  current.includes(level) ? current.filter((c) => c !== level) : [...current, level],
                )
              }
            >
              {PRICE_LABEL[level]}
            </ChipFilter>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2.5 text-xs font-black text-ink">حداقل امتیاز</div>
        <div className="flex flex-wrap gap-1.5">
          {[
            { value: 0, label: "همه" },
            { value: 4, label: "۴+" },
            { value: 4.5, label: "۴.۵+" },
          ].map((item) => (
            <ChipFilter key={item.value} active={minRating === item.value} onClick={() => setMinRating(item.value)}>
              {item.label}
            </ChipFilter>
          ))}
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2 border-t border-black/[0.06] pt-4 text-xs font-semibold text-ink/70">
        <input type="checkbox" checked={reservationOnly} onChange={(e) => setReservationOnly(e.target.checked)} className="h-4 w-4 accent-brand-700" />
        <Phone className="h-3.5 w-3.5 text-brand-600" /> امکان رزرو میز
      </label>

      {activeFilters > 0 && (
        <button
          type="button"
          onClick={() => {
            setCuisine("");
            setPriceRanges([]);
            setMinRating(0);
            setReservationOnly(false);
          }}
          className="btn-ghost w-full !py-2 !text-xs"
        >
          <RotateCcw className="h-3.5 w-3.5" /> پاک کردن فیلترها
        </button>
      )}
    </div>
  );

  return (
    <>
      <PageHero
        title="رستوران‌ها و غذاهای محلی"
        description="از کلم‌پای شیراز تا قورمه‌سبزی اصفهان؛ بهترین رستوران‌ها، غذاهای امضادار و منوهای اصیل هر شهر."
        badge={
          <span className="eyebrow">
            <UtensilsCrossed className="h-3.5 w-3.5" /> سفره ایرانی
          </span>
        }
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(q);
          }}
          className="card flex items-center gap-2 p-2"
        >
          <Search className="mx-3 h-4 w-4 shrink-0 text-ink/35" />
          <input
            className="h-11 flex-1 bg-transparent text-sm font-semibold text-ink outline-none placeholder:text-ink/35"
            placeholder="نام رستوران، غذا یا شهر..."
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
          <button type="submit" className="btn-primary !rounded-xl !px-5 !py-2.5 !text-xs">
            جستجو
          </button>
        </form>
      </PageHero>

      <section className="container-app py-8">
        <div className="mb-5 flex flex-wrap gap-1.5 xl:hidden">
          <button type="button" onClick={() => setFiltersOpen((v) => !v)} className="filter-pill">
            <SlidersHorizontal className="h-3.5 w-3.5" /> فیلترها {activeFilters > 0 && `(${number(activeFilters)})`}
          </button>
        </div>
        {filtersOpen && <div className="card mb-5 p-5 xl:hidden">{filterPanel}</div>}

        <div className="grid gap-6 xl:grid-cols-[1fr_250px]">
          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-bold text-ink">
                <Star className="h-4 w-4 text-gold-500" />
                {number(filtered.length)} رستوران
                {results.isFetching && <Spinner className="h-3.5 w-3.5" />}
              </div>
              <select className="input !w-auto !py-2 text-xs" value={sort} onChange={(e) => setSort(e.target.value)}>
                {SORTS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>

            {results.isLoading ? (
              <LoadingCards count={6} />
            ) : results.error ? (
              <EmptyState
                title="بارگذاری رستوران‌ها انجام نشد"
                description={results.error instanceof ApiError ? results.error.message : undefined}
              />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((restaurant) => (
                  <RestaurantTile key={restaurant.id} restaurant={restaurant} />
                ))}
                {filtered.length === 0 && (
                  <div className="sm:col-span-2 lg:col-span-3">
                    <EmptyState
                      icon={<UtensilsCrossed className="h-6 w-6" />}
                      title="رستورانی پیدا نشد"
                      description="فیلترها را تغییر دهید یا شهر دیگری را انتخاب کنید."
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <aside className="hidden h-fit xl:block">
            <div className={cn("card sticky top-24 p-5")}>
              <div className="mb-4 flex items-center gap-2 border-b border-black/[0.06] pb-3 text-sm font-black text-ink">
                <SlidersHorizontal className="h-4 w-4 text-brand-700" /> فیلترها
              </div>
              {filterPanel}
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
