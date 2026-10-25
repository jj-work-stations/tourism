"use client";

import { useState } from "react";
import { CalendarDays, MapPin, Star } from "lucide-react";

export function Avatar({ name, src }: { name: string; src?: string | null }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={name} onError={() => setFailed(true)} className="h-10 w-10 rounded-full object-cover" />
    );
  }
  return (
    <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-brand-100 to-sand-200 text-xs font-black text-brand-900">
      {name.slice(0, 1)}
    </span>
  );
}

export function HotelMiniCard({
  hotel,
  destinationSlug,
}: {
  hotel: {
    id: string;
    slug: string;
    name: string;
    image_url?: string | null;
    short_description: string;
    guest_rating: number;
    star_rating: number;
    review_count: number;
    base_price: number;
    amenities: string[];
    distance_to_center_km: number;
  };
  destinationSlug: string;
}) {
  return (
    <a href={`/stays/${hotel.slug}?checkIn=&checkOut=&guests=2`} className="group flex gap-4 rounded-2xl border border-black/5 bg-white p-3 transition hover:shadow-card">
      <img src={hotel.image_url || ""} alt={hotel.name} className="h-24 w-24 rounded-xl object-cover" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-[10px] text-amber-500">
          {Array.from({ length: hotel.star_rating }).map((_, index) => <Star key={index} className="h-3 w-3 fill-current" />)}
        </div>
        <h4 className="mt-0.5 truncate font-bold text-ink group-hover:text-brand-800">{hotel.name}</h4>
        <div className="mt-1 flex items-center gap-1 text-[10px] text-ink/40">
          <MapPin className="h-3 w-3" /> {hotel.distance_to_center_km} کیلومتر از مرکز
          <span className="mr-1 flex items-center gap-0.5 text-ink/60">★ {hotel.guest_rating}</span>
        </div>
        <div className="mt-2 flex items-end justify-between">
          <span className="text-[10px] text-ink/40">{destinationSlug}</span>
          <span className="text-xs font-black text-brand-800">
            از {new Intl.NumberFormat("fa-IR").format(hotel.base_price)} ت
          </span>
        </div>
      </div>
    </a>
  );
}

export function CalendarNote() {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-ink/40">
      <CalendarDays className="h-3.5 w-3.5" /> قیمت‌ها برای هر شب است
    </span>
  );
}
