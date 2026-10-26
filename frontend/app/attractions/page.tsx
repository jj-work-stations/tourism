"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Clock3,
  Compass,
  Landmark,
  MapPin,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Ticket,
} from "lucide-react";

import { SmartImage, EmptyState, LoadingCards, PageHero, Rating, Spinner, ChipFilter } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { duration, number, toman } from "@/lib/format";
import type { Attraction, Destination, MetaOptions, Page } from "@/lib/types";
import { cn, destinationName } from "@/lib/utils";

const SORTS = [
  { value: "rating", label: "بالاترین امتیاز" },
  { value: "name", label: "نام (الفبا)" },
  { value: "price", label: "ارزان‌ترین بلیت" },
];

function AttractionTile({ attraction }: { attraction: Attraction }) {
  return (
    <Link
      href={`/map?dest=${attraction.destination_id}`}
      className="card card-hover group overflow-hidden"
    >
      <div className="relative">
        <SmartImage
          src={attraction.image_url}
          alt={attraction.name}
          className="h-44 w-full transition duration-700 group-hover:scale-105"
          fallbackClassName="h-44 w-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
        {attraction.is_featured && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-brand-800 backdrop-blur">
            <Sparkles className="h-3 w-3" /> منتخب سیر
          </span>
        )}
        <span className="absolute bottom-3 right-3 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur">
          {attraction.destination_name}
        </span>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 font-extrabold text-ink group-hover:text-brand-800">{attraction.name}</h3>
          <Rating value={attraction.rating} count={attraction.review_count} size="sm" />
        </div>
        <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-6 text-ink/50">{attraction.description}</p>
        <div className="mt-3 flex items-center justify-between border-t border-black/[0.06] pt-3 text-[11px]">
          <span className="flex items-center gap-1 text-ink/45">
            <Clock3 className="h-3.5 w-3.5 text-brand-600" /> {duration(attraction.suggested_visit_minutes)} بازدید
          </span>
          <span className="flex items-center gap-1 font-bold text-brand-800">
            <Ticket className="h-3.5 w-3.5" />
            {attraction.ticket_price ? toman(attraction.ticket_price) : "رایگان"}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function AttractionsPage() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [destinationId, setDestinationId] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [featured, setFeatured] = useState(false);
  const [sort, setSort] = useState("rating");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const metaQuery = useQuery({
    queryKey: ["meta", "options", "attractions"],
    queryFn: () => api.get<MetaOptions>("/meta/options"),
  });
  const destinationsQuery = useQuery({
    queryKey: ["destinations", "attractions"],
    queryFn: () => api.get<Page<Destination>>("/destinations", { limit: 50 }),
  });
  const destinations = useMemo(() => destinationsQuery.data?.items ?? [], [destinationsQuery.data]);

  const results = useQuery({
    queryKey: ["attractions", "list", query, categories, destinationId, minRating, featured, sort],
    queryFn: () =>
      api.get<Page<Attraction>>("/attractions", {
        q: query || undefined,
        category: categories.length === 1 ? categories[0] : undefined,
        destination_id: destinationId || undefined,
        min_rating: minRating || undefined,
        featured: featured || undefined,
        sort,
        page_size: 30,
      }),
    retry: false,
  });

  const categoryOptions = metaQuery.data?.attraction_categories ?? [];
  const activeFilters = categories.length + (minRating ? 1 : 0) + (destinationId ? 1 : 0) + (featured ? 1 : 0);

  const filterPanel = (
    <div className="space-y-6">
      <div>
        <div className="mb-2.5 flex items-center gap-1.5 text-xs font-black text-ink">
          <Landmark className="h-3.5 w-3.5 text-brand-700" /> دسته‌بندی
        </div>
        <div className="flex flex-wrap gap-1.5">
          {categoryOptions.map((item) => (
            <ChipFilter
              key={item.value}
              active={categories.includes(item.value)}
              onClick={() =>
                setCategories((current) =>
                  current.includes(item.value) ? current.filter((c) => c !== item.value) : [...current, item.value],
                )
              }
            >
              {item.label}
            </ChipFilter>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2.5 text-xs font-black text-ink">مقصد</div>
        <select
          className="field-sm"
          value={destinationId}
          onChange={(event) => setDestinationId(event.target.value)}
        >
          <option value="">همه شهرها</option>
          {destinations.map((item) => (
            <option key={item.id} value={item.id}>{destinationName(item)}</option>
          ))}
        </select>
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
        <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="h-4 w-4 accent-brand-700" />
        <Sparkles className="h-3.5 w-3.5 text-gold-600" /> فقط منتخب‌های سیر
      </label>

      {activeFilters > 0 && (
        <button
          type="button"
          onClick={() => {
            setCategories([]);
            setMinRating(0);
            setDestinationId("");
            setFeatured(false);
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
        title="جاذبه‌های گردشگری"
        description="از تخت‌جمشید تا پل خواجو؛ گنجینه‌های تاریخی، طبیعی و فرهنگی ایران را با فیلتر دسته‌بندی کشف کن."
        badge={
          <span className="eyebrow">
            <Landmark className="h-3.5 w-3.5" /> میراث ایران
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
            placeholder="نام جاذبه، شهر یا دسته..."
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
                <Compass className="h-4 w-4 text-brand-700" />
                {number(results.data?.total ?? 0)} جاذبه
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
                title="بارگذاری جاذبه‌ها انجام نشد"
                description={results.error instanceof ApiError ? results.error.message : undefined}
              />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {(results.data?.items ?? []).map((attraction) => (
                  <AttractionTile key={attraction.id} attraction={attraction} />
                ))}
                {results.data && results.data.items.length === 0 && (
                  <div className="sm:col-span-2 lg:col-span-3">
                    <EmptyState
                      icon={<Landmark className="h-6 w-6" />}
                      title="جاذبه‌ای پیدا نشد"
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
