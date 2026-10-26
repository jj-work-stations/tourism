"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  BedDouble,
  CloudSun,
  Compass,
  Droplets,
  Landmark,
  Map as MapIcon,
  MapPin,
  UtensilsCrossed,
  Wind,
} from "lucide-react";

import { DestinationMap } from "@/components/destination-map";
import { EmptyState, PageHero, Rating, Spinner, ChipFilter } from "@/components/ui";
import { api } from "@/lib/api";
import { number, toman } from "@/lib/format";
import type { Destination, MapData, Page } from "@/lib/types";

const MARKER_META: Record<string, { label: string; icon: React.ReactNode; tone: string }> = {
  destination: { label: "مرکز مقصد", icon: <Compass className="h-3.5 w-3.5" />, tone: "text-brand-800 bg-brand-50" },
  accommodation: { label: "اقامتگاه", icon: <BedDouble className="h-3.5 w-3.5" />, tone: "text-sand-700 bg-sand-100" },
  attraction: { label: "جاذبه", icon: <Landmark className="h-3.5 w-3.5" />, tone: "text-sky-700 bg-sky-50" },
  restaurant: { label: "رستوران", icon: <UtensilsCrossed className="h-3.5 w-3.5" />, tone: "text-amber-700 bg-amber-50" },
  experience: { label: "تجربه", icon: <SparklesDummy className="h-3.5 w-3.5" />, tone: "text-violet-700 bg-violet-50" },
};

function SparklesDummy({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" strokeLinecap="round" />
    </svg>
  );
}

interface Weather {
  temperature_c: number;
  feels_like_c: number;
  condition: string;
  humidity: number;
  wind_kph: number;
  forecast: { date: string; temp_min: number; temp_max: number; condition: string }[];
}

function MapContent() {
  const searchParams = useSearchParams();
  const destParam = searchParams.get("dest");

  const destinationsQuery = useQuery({
    queryKey: ["destinations", "map-page"],
    queryFn: () => api.get<Page<Destination>>("/destinations", { limit: 50 }),
  });
  const destinations = useMemo(() => destinationsQuery.data?.items ?? [], [destinationsQuery.data]);

  // Accept either a destination id (from tiles) or slug (?dest=shiraz).
  const selected = useMemo(() => {
    if (!destinations.length) return undefined;
    if (destParam) {
      return (
        destinations.find((d) => d.id === destParam) ??
        destinations.find((d) => d.slug === destParam) ??
        destinations.find((d) => d.slug === "shiraz")
      );
    }
    return destinations.find((d) => d.slug === "isfahan") ?? destinations[0];
  }, [destinations, destParam]);

  const [selectedId, setSelectedId] = useState("");
  const active = selectedId ? destinations.find((d) => d.id === selectedId) : selected;
  const activeSlug = active?.slug ?? "";

  const [typeFilter, setTypeFilter] = useState<string[]>([]);

  const mapQuery = useQuery({
    queryKey: ["map", activeSlug],
    queryFn: () => api.get<MapData>(`/destinations/${activeSlug}/map`),
    enabled: Boolean(activeSlug),
  });
  const weatherQuery = useQuery({
    queryKey: ["weather", activeSlug],
    queryFn: () => api.get<Weather>(`/destinations/${activeSlug}/weather`),
    enabled: Boolean(activeSlug),
  });

  useEffect(() => {
    if (selected && !selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  const markers = mapQuery.data?.markers ?? [];
  const visibleMarkers = typeFilter.length ? markers.filter((m) => typeFilter.includes(m.type)) : markers;
  const availableTypes = useMemo(() => [...new Set(markers.map((m) => m.type))], [markers]);

  return (
    <>
      <PageHero
        title="نقشه هوشمند سفر"
        description="همه چیز روی یک نقشه: مقصدها، اقامتگاه‌ها، جاذبه‌ها، رستوران‌ها و تجربه‌ها — فیلتر کن، نزدیک‌ترین را پیدا کن."
        badge={
          <span className="eyebrow">
            <MapIcon className="h-3.5 w-3.5" /> نقشه مرکزی سیر
          </span>
        }
      >
        <div className="card flex flex-wrap items-center gap-2 p-2">
          <span className="mr-2 grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700">
            <MapPin className="h-4 w-4" />
          </span>
          <select
            className="h-11 flex-1 bg-transparent px-2 text-sm font-bold text-ink outline-none"
            value={active?.id ?? ""}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {destinations.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          {weatherQuery.data && (
            <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-l from-sky-50 to-white px-4 py-2 text-xs">
              <CloudSun className="h-5 w-5 text-sky-600" />
              <div>
                <div className="font-black text-ink">{number(weatherQuery.data.temperature_c)}°</div>
                <div className="text-[10px] text-ink/45">{weatherQuery.data.condition}</div>
              </div>
              <div className="flex items-center gap-2 border-r border-black/[0.07] pr-3 text-[10px] text-ink/50">
                <span className="flex items-center gap-1"><Droplets className="h-3 w-3" /> {number(weatherQuery.data.humidity)}٪</span>
                <span className="flex items-center gap-1"><Wind className="h-3 w-3" /> {number(weatherQuery.data.wind_kph)}</span>
              </div>
            </div>
          )}
        </div>
      </PageHero>

      <section className="container-app py-8">
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {availableTypes.map((type) => {
            const meta = MARKER_META[type];
            if (!meta) return null;
            return (
              <ChipFilter
                key={type}
                active={typeFilter.includes(type)}
                onClick={() =>
                  setTypeFilter((current) =>
                    current.includes(type) ? current.filter((t) => t !== type) : [...current, type],
                  )
                }
              >
                {meta.icon} {meta.label}
                <span className="opacity-60">({number(markers.filter((m) => m.type === type).length)})</span>
              </ChipFilter>
            );
          })}
          {typeFilter.length > 0 && (
            <button type="button" onClick={() => setTypeFilter([])} className="text-[11px] font-bold text-brand-800 hover:underline">
              پاک کردن فیلتر
            </button>
          )}
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0">
            {mapQuery.isLoading ? (
              <div className="skeleton h-[460px] w-full rounded-3xl" />
            ) : mapQuery.data ? (
              <DestinationMap data={{ ...mapQuery.data, markers: visibleMarkers }} height={460} />
            ) : (
              <EmptyState title="نقشه در دسترس نیست" description="اتصال به سرور را بررسی کنید." />
            )}
          </div>

          <aside className="max-h-[460px] min-w-0 overflow-y-auto rounded-3xl border border-black/5 bg-white p-3 shadow-card">
            <div className="mb-2 px-2 text-xs font-black text-ink">
              مکان‌های {active?.name} ({number(visibleMarkers.length)})
            </div>
            <div className="space-y-1.5">
              {visibleMarkers.map((marker) => {
                const meta = MARKER_META[marker.type];
                return (
                  <div key={`${marker.type}-${marker.id}`} className="flex items-center gap-2.5 rounded-2xl border border-black/[0.04] p-2.5 transition hover:bg-brand-50/40">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${meta?.tone ?? "bg-black/5"}`}>
                      {meta?.icon ?? <MapPin className="h-3.5 w-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-bold text-ink">{marker.name}</div>
                      <div className="flex items-center gap-2 text-[10px] text-ink/40">
                        {meta?.label}
                        {marker.rating ? <Rating value={marker.rating} size="sm" className="!gap-0.5" /> : null}
                        {marker.price ? <span>· از {toman(marker.price, true)}</span> : null}
                      </div>
                    </div>
                  </div>
                );
              })}
              {visibleMarkers.length === 0 && !mapQuery.isLoading && (
                <div className="py-10 text-center text-xs text-ink/40">
                  {typeFilter.length ? "با این فیلتر مکان‌ای نیست." : "مکانی ثبت نشده است."}
                </div>
              )}
            </div>
          </aside>
        </div>

        {weatherQuery.data?.forecast && weatherQuery.data.forecast.length > 0 && (
          <div className="card mt-6 p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-black text-ink">
              <CloudSun className="h-4 w-4 text-sky-600" /> پیش‌بینی ۵ روز {active?.name}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {weatherQuery.data.forecast.map((day) => (
                <div key={day.date} className="rounded-2xl bg-sky-50/60 p-3 text-center">
                  <div className="text-[10px] text-ink/45">
                    {new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long" }).format(new Date(day.date))}
                  </div>
                  <div className="mt-1 text-lg font-black text-ink">
                    {number(day.temp_max)}° <span className="text-xs font-medium text-ink/40">/ {number(day.temp_min)}°</span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-ink/50">{day.condition}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  );
}

export default function MapPage() {
  return (
    <Suspense
      fallback={
        <div className="container-app grid min-h-[60vh] place-items-center">
          <Spinner className="h-8 w-8" />
        </div>
      }
    >
      <MapContent />
    </Suspense>
  );
}
