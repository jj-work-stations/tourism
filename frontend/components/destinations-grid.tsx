"use client";

import { useMemo, useState } from "react";
import { Compass, MapPinned, Search, SlidersHorizontal } from "lucide-react";

import { DestinationCard } from "@/components/cards";
import { EmptyState } from "@/components/ui";
import type { Destination } from "@/lib/types";
import { cn, destinationName } from "@/lib/utils";

export function DestinationsGrid({ destinations }: { destinations: Destination[] }) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("all");

  const tags = useMemo(() => {
    const set = new Set<string>();
    destinations.forEach((destination) => destination.tags.forEach((item) => set.add(item)));
    return ["all", ...Array.from(set).slice(0, 8)];
  }, [destinations]);

  const filtered = destinations.filter((destination) => {
    const matchesQuery = `${destination.name} ${destination.name_local} ${destination.region} ${destination.tags.join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase());
    const matchesTag = tag === "all" || destination.tags.includes(tag);
    return matchesQuery && matchesTag;
  });

  return (
    <div>
      <div className="mb-8 flex flex-col gap-3 rounded-3xl border border-black/5 bg-white p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="نام شهر، منطقه یا علاقه‌مندی را جستجو کنید..."
            className="input border-0 bg-black/[0.03] pr-11 focus:bg-white"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="flex shrink-0 items-center gap-1 text-[11px] text-ink/40">
            <SlidersHorizontal className="h-3.5 w-3.5" /> فیلتر:
          </span>
          {tags.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTag(item)}
              className={cn(
                "shrink-0 rounded-xl px-3 py-2 text-[11px] font-semibold transition",
                tag === item ? "bg-brand-700 text-white" : "bg-black/[0.04] text-ink/55 hover:bg-brand-50 hover:text-brand-800",
              )}
            >
              {item === "all" ? "همه" : item}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between text-xs text-ink/45">
        <span>
          <Compass className="mb-0.5 ml-1 inline h-4 w-4" />
          {new Intl.NumberFormat("fa-IR").format(filtered.length)} مقصد پیدا شد
        </span>
        <span className="flex items-center gap-1">
          <MapPinned className="h-3.5 w-3.5" /> مرتب‌شده بر اساس محبوبیت
        </span>
      </div>

      {filtered.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((destination) => (
            <div key={destination.id}>
              <DestinationCard destination={destination} className="h-[320px]" />
              <div className="mt-3 flex items-center justify-between px-1 text-[11px] text-ink/45">
                <span>{destination.region}</span>
                <span>{destination.best_season || "همه فصل‌ها"}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Search className="h-6 w-6" />}
          title="مقصدی پیدا نشد"
          description="عبارت دیگری را جستجو کنید یا فیلترها را بردارید."
        />
      )}
    </div>
  );
}
