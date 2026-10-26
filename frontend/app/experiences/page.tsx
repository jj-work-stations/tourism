"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Clock3,
  Languages,
  MapPin,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";

import { ExperienceCard } from "@/components/cards";
import { EmptyState, LoadingCards, PageHero, Spinner, ChipFilter, Rating } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { duration, number, toman } from "@/lib/format";
import type { Destination, Experience, MetaOptions, Page } from "@/lib/types";

const SORTS = [
  { value: "rating", label: "بالاترین امتیاز" },
  { value: "price", label: "ارزان‌ترین" },
  { value: "name", label: "نام (الفبا)" },
];

export default function ExperiencesPage() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [destinationId, setDestinationId] = useState("");
  const [maxPrice, setMaxPrice] = useState(0);
  const [sort, setSort] = useState("rating");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const metaQuery = useQuery({
    queryKey: ["meta", "options", "experiences"],
    queryFn: () => api.get<MetaOptions>("/meta/options"),
  });
  const destinationsQuery = useQuery({
    queryKey: ["destinations", "experiences"],
    queryFn: () => api.get<Page<Destination>>("/destinations", { limit: 50 }),
  });
  const destinations = useMemo(() => destinationsQuery.data?.items ?? [], [destinationsQuery.data]);

  const results = useQuery({
    queryKey: ["experiences", "list", query, categories, destinationId, maxPrice, sort],
    queryFn: () =>
      api.get<Page<Experience>>("/experiences", {
        q: query || undefined,
        category: categories.length === 1 ? categories[0] : undefined,
        destination_id: destinationId || undefined,
        max_price: maxPrice || undefined,
        sort,
        page_size: 30,
      }),
    retry: false,
  });

  const categoryOptions = metaQuery.data?.experience_categories ?? [];
  const activeFilters = categories.length + (destinationId ? 1 : 0) + (maxPrice ? 1 : 0);

  const filterPanel = (
    <div className="space-y-6">
      <div>
        <div className="mb-2.5 flex items-center gap-1.5 text-xs font-black text-ink">
          <Sparkles className="h-3.5 w-3.5 text-brand-700" /> نوع تجربه
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
        <select className="field-sm" value={destinationId} onChange={(event) => setDestinationId(event.target.value)}>
          <option value="">همه شهرها</option>
          {destinations.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </div>

      <div>
        <div className="mb-2.5 text-xs font-black text-ink">حداکثر قیمت</div>
        <input
          type="range"
          min={0}
          max={10_000_000}
          step={250_000}
          value={maxPrice}
          onChange={(event) => setMaxPrice(Number(event.target.value))}
          className="w-full accent-brand-700"
        />
        <div className="mt-1 flex justify-between text-[10px] text-ink/40">
          <span>بدون محدودیت</span>
          <span className="font-bold text-brand-800">{maxPrice ? `تا ${toman(maxPrice, true)}` : "همه قیمت‌ها"}</span>
        </div>
      </div>

      {activeFilters > 0 && (
        <button
          type="button"
          onClick={() => {
            setCategories([]);
            setDestinationId("");
            setMaxPrice(0);
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
        title="تجربه‌های محلی"
        description="آشپزی با یک مادربزرگ یزدی، تور عکاسی در کوچه‌های شیراز، شب‌گردی تاریخی؛ تجربه‌هایی که سفر را به خاطره تبدیل می‌کند."
        badge={
          <span className="eyebrow">
            <Sparkles className="h-3.5 w-3.5" /> زندگی مثل یک محلی
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
            placeholder="تور، کارگاه، کلاس آشپزی یا مقصد..."
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
                <Users className="h-4 w-4 text-brand-700" />
                {number(results.data?.total ?? 0)} تجربه
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
                title="بارگذاری تجربه‌ها انجام نشد"
                description={results.error instanceof ApiError ? results.error.message : undefined}
              />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {(results.data?.items ?? []).map((experience) => (
                  <ExperienceCard key={experience.id} experience={experience} />
                ))}
                {results.data && results.data.items.length === 0 && (
                  <div className="sm:col-span-2 lg:col-span-3">
                    <EmptyState
                      icon={<Sparkles className="h-6 w-6" />}
                      title="تجربه‌ای پیدا نشد"
                      description="فیلترها را تغییر دهید یا شهر دیگری را انتخاب کنید."
                    />
                  </div>
                )}
              </div>
            )}

            <Link
              href="/assistant"
              className="mt-8 flex items-center justify-between rounded-3xl bg-gradient-to-l from-brand-900 to-brand-700 p-5 text-white transition hover:shadow-soft"
            >
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-sand-300">
                  <Sparkles className="h-4 w-4" /> پیشنهاد هوشمند
                </div>
                <div className="mt-1 font-black">نمی‌دانی کدام تجربه برایت ساخته شده؟ از دستیار بپرس.</div>
              </div>
              <ArrowLeft className="h-5 w-5 shrink-0" />
            </Link>
          </div>

          <aside className="hidden h-fit xl:block">
            <div className="card sticky top-24 p-5">
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
