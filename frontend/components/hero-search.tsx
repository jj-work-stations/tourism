"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeftRight, Bus, CalendarDays, Hotel, MapPin, Search, Sparkles, Users } from "lucide-react";

import { dateInput } from "@/lib/format";
import type { Destination } from "@/lib/types";
import { cn, destinationName } from "@/lib/utils";

type Tab = "transport" | "stay" | "experience";

const tabs: { id: Tab; label: string; icon: typeof Bus }[] = [
  { id: "transport", label: "بلیت سفر", icon: Bus },
  { id: "stay", label: "اقامتگاه", icon: Hotel },
  { id: "experience", label: "تجربه محلی", icon: Sparkles },
];

export function HeroSearch({ destinations }: { destinations: Destination[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("transport");
  const [originId, setOriginId] = useState(destinations.find((d) => d.slug === "tehran")?.id || destinations[0]?.id || "");
  const [destinationId, setDestinationId] = useState(destinations.find((d) => d.slug === "shiraz")?.id || destinations[1]?.id || "");
  const [date, setDate] = useState(dateInput(7));
  const [checkOut, setCheckOut] = useState(dateInput(9));
  const [guests, setGuests] = useState(2);

  function swap() {
    setOriginId(destinationId);
    setDestinationId(originId);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams({ tab });
    if (tab === "transport") {
      params.set("origin", originId);
      params.set("destination", destinationId);
      params.set("date", date);
      params.set("guests", String(guests));
    } else if (tab === "stay") {
      params.set("destination", destinationId);
      params.set("checkIn", date);
      params.set("checkOut", checkOut);
      params.set("guests", String(guests));
    } else {
      params.set("destination", destinationId);
      params.set("date", date);
      params.set("guests", String(guests));
    }
    router.push(`/search?${params.toString()}`);
  }

  return (
    <div className="rounded-[2rem] border border-white/50 bg-white/90 p-2 shadow-[0_30px_80px_-32px_rgba(4,47,42,0.55)] backdrop-blur-xl">
      <div className="flex items-center gap-1 rounded-2xl bg-black/[0.035] p-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition sm:text-sm",
              tab === item.id ? "bg-white text-brand-800 shadow-sm" : "text-ink/50 hover:text-ink",
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="grid gap-2 p-2 lg:grid-cols-[1fr_1fr_auto_auto]">
        {tab === "transport" ? (
          <>
            <div className="relative grid grid-cols-[1fr_auto_1fr] items-center rounded-2xl border border-black/10 bg-white px-2">
              <label className="block px-2 py-2">
                <span className="flex items-center gap-1 text-[10px] font-semibold text-ink/40">
                  <MapPin className="h-3 w-3" /> مبدأ
                </span>
                <select
                  value={originId}
                  onChange={(e) => setOriginId(e.target.value)}
                  className="mt-0.5 w-full bg-transparent text-sm font-bold text-ink outline-none"
                >
                  {destinations.map((destination) => (
                    <option key={destination.id} value={destination.id}>
                      {destinationName(destination)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={swap}
                aria-label="جابه‌جایی مبدأ و مقصد"
                className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-700 transition hover:rotate-180"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
              </button>
              <label className="block px-2 py-2">
                <span className="flex items-center gap-1 text-[10px] font-semibold text-ink/40">
                  <MapPin className="h-3 w-3" /> مقصد
                </span>
                <select
                  value={destinationId}
                  onChange={(e) => setDestinationId(e.target.value)}
                  className="mt-0.5 w-full bg-transparent text-sm font-bold text-ink outline-none"
                >
                  {destinations.map((destination) => (
                    <option key={destination.id} value={destination.id}>
                      {destinationName(destination)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </>
        ) : (
          <label className="block rounded-2xl border border-black/10 bg-white px-4 py-2">
            <span className="flex items-center gap-1 text-[10px] font-semibold text-ink/40">
              <MapPin className="h-3 w-3" /> مقصد
            </span>
            <select
              value={destinationId}
              onChange={(e) => setDestinationId(e.target.value)}
              className="mt-0.5 w-full bg-transparent text-sm font-bold text-ink outline-none"
            >
              {destinations.map((destination) => (
                <option key={destination.id} value={destination.id}>
                  {destinationName(destination)}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className={cn("grid gap-2", tab === "stay" ? "grid-cols-2" : "grid-cols-1")}>
          <label className="block rounded-2xl border border-black/10 bg-white px-4 py-2">
            <span className="flex items-center gap-1 text-[10px] font-semibold text-ink/40">
              <CalendarDays className="h-3 w-3" /> {tab === "stay" ? "تاریخ ورود" : "تاریخ سفر"}
            </span>
            <input
              type="date"
              value={date}
              min={dateInput()}
              onChange={(e) => setDate(e.target.value)}
              className="mt-0.5 w-full bg-transparent text-sm font-bold text-ink outline-none"
            />
          </label>
          {tab === "stay" && (
            <label className="block rounded-2xl border border-black/10 bg-white px-4 py-2">
              <span className="flex items-center gap-1 text-[10px] font-semibold text-ink/40">
                <CalendarDays className="h-3 w-3" /> تاریخ خروج
              </span>
              <input
                type="date"
                value={checkOut}
                min={date || dateInput()}
                onChange={(e) => setCheckOut(e.target.value)}
                className="mt-0.5 w-full bg-transparent text-sm font-bold text-ink outline-none"
              />
            </label>
          )}
        </div>

        <label className="block min-w-[100px] rounded-2xl border border-black/10 bg-white px-4 py-2">
          <span className="flex items-center gap-1 text-[10px] font-semibold text-ink/40">
            <Users className="h-3 w-3" /> مسافر
          </span>
          <select
            value={guests}
            onChange={(e) => setGuests(Number(e.target.value))}
            className="mt-0.5 w-full bg-transparent text-sm font-bold text-ink outline-none"
          >
            {[1, 2, 3, 4, 5, 6, 8, 10].map((count) => (
              <option key={count} value={count}>
                {new Intl.NumberFormat("fa-IR").format(count)} نفر
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className="btn-primary !rounded-2xl lg:!px-7">
          <Search className="h-4 w-4" />
          جستجو
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2 px-4 pb-3 text-[11px] text-ink/45">
        <span className="font-semibold text-ink/60">جستجوهای پرطرفدار:</span>
        {[
          { label: "تهران → شیراز", href: "/search?tab=transport&origin=none" },
          { label: "هتل‌های اصفهان", href: "/destinations/isfahan" },
          { label: "کیش در آبان", href: "/destinations/kish" },
          { label: "تجربه‌های یزد", href: "/destinations/yazd" },
        ].map((item) => (
          <a key={item.label} href={item.href} className="rounded-full bg-black/[0.035] px-2.5 py-1 transition hover:bg-brand-50 hover:text-brand-800">
            {item.label}
          </a>
        ))}
      </div>
    </div>
  );
}
