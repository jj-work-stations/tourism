"use client";

import Link from "next/link";
import { ArrowUpLeft, CalendarDays, Clock3, MapPin, Sparkles, Users } from "lucide-react";

import { SmartImage, Rating, Badge } from "@/components/ui";
import { duration, toman } from "@/lib/format";
import type { AccommodationCard, Attraction, Destination, Experience, TransportOffer } from "@/lib/types";
import { cn, destinationName } from "@/lib/utils";

export function DestinationCard({ destination, className }: { destination: Destination; className?: string }) {
  return (
    <Link
      href={`/destinations/${destination.slug}`}
      className={cn(
        "group relative block overflow-hidden rounded-3xl bg-ink shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-soft",
        className,
      )}
    >
      <SmartImage
        src={destination.image_url}
        alt={destinationName(destination)}
        className="h-full w-full transition duration-700 group-hover:scale-105"
        fallbackClassName="h-full w-full"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
        <div className="mb-2 flex items-center gap-2">
          {destination.is_featured && (
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold backdrop-blur">
              پیشنهاد سیر
            </span>
          )}
          <span className="rounded-full bg-brand-500/90 px-2.5 py-1 text-[10px] font-bold">
            {new Intl.NumberFormat("fa-IR").format(destination.attraction_count)} جاذبه
          </span>
        </div>
        <h3 className="text-xl font-black">{destinationName(destination)}</h3>
        <p className="mt-1 line-clamp-1 text-xs text-white/65">{destination.short_description}</p>
        <div className="mt-3 flex items-center justify-between border-t border-white/15 pt-3 text-[11px]">
          <span className="text-white/60">
            شروع از <b className="text-white">{toman(destination.starting_price, true)}</b>
          </span>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-ink transition group-hover:-translate-x-0.5 group-hover:-translate-y-0.5">
            <ArrowUpLeft className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export function ExperienceCard({ experience }: { experience: Experience }) {
  return (
    <Link href={`/experience/${experience.id}`} className="card group overflow-hidden transition hover:-translate-y-1 hover:shadow-soft">
      <div className="relative">
        <SmartImage src={experience.image_url} alt={experience.name} className="h-48 w-full transition duration-500 group-hover:scale-105" fallbackClassName="h-48 w-full" />
        <div className="absolute right-3 top-3">
          <Badge tone="brand" className="bg-white/90 backdrop-blur">
            <Sparkles className="h-3 w-3" /> {experience.category}
          </Badge>
        </div>
        <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur">
          <Clock3 className="mb-0.5 ml-1 inline h-3 w-3" /> {duration(experience.duration_minutes)}
        </span>
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 font-extrabold text-ink">{experience.name}</h3>
          <Rating value={experience.rating} size="sm" />
        </div>
        <p className="mt-2 line-clamp-2 text-xs leading-6 text-ink/50">{experience.description}</p>
        <div className="mt-4 flex items-center justify-between border-t border-black/5 pt-4">
          <span className="text-[11px] text-ink/45">
            <Users className="mb-0.5 ml-1 inline h-3.5 w-3.5" />
            {experience.destination_name && destinationName({ name: experience.destination_name })}
          </span>
          <span className="text-sm font-black text-brand-800">{toman(experience.price)}</span>
        </div>
      </div>
    </Link>
  );
}

export function AttractionCard({ attraction }: { attraction: Attraction }) {
  return (
    <Link href={`/destinations/${attraction.destination_name.toLowerCase()}?tab=attractions`} className="card group flex gap-4 overflow-hidden p-3 transition hover:shadow-soft">
      <SmartImage src={attraction.image_url} alt={attraction.name} className="h-24 w-24 shrink-0 rounded-2xl" fallbackClassName="h-24 w-24 rounded-2xl" />
      <div className="min-w-0 py-1">
        <h3 className="line-clamp-1 font-bold text-ink">{attraction.name}</h3>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-ink/45">
          <MapPin className="h-3.5 w-3.5" /> {attraction.destination_name}
        </div>
        <p className="mt-2 line-clamp-1 text-xs text-ink/50">{attraction.description}</p>
        <div className="mt-2">
          <Rating value={attraction.rating} count={attraction.review_count} size="sm" />
        </div>
      </div>
    </Link>
  );
}

export function AccommodationResultCard({
  hotel,
  checkIn,
  checkOut,
  guests,
}: {
  hotel: AccommodationCard;
  checkIn: string;
  checkOut: string;
  guests: number;
}) {
  const href = `/stays/${hotel.slug}?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`;
  return (
    <Link href={href} className="card group grid overflow-hidden sm:grid-cols-[240px_1fr]">
      <div className="relative">
        <SmartImage src={hotel.images[0]} alt={hotel.name} className="h-52 w-full sm:h-full" fallbackClassName="h-52 w-full sm:h-full" />
        <div className="absolute right-3 top-3 flex gap-1">
          {hotel.is_featured && <Badge tone="brand" className="bg-white/90">ویژه</Badge>}
          {hotel.free_cancellation && <Badge tone="emerald" className="bg-white/90">لغو رایگان</Badge>}
        </div>
      </div>
      <div className="flex flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-1 text-[11px] font-medium text-ink/45">
              {Array.from({ length: hotel.star_rating }).map((_, i) => (
                <span key={i} className="text-amber-400">★</span>
              ))}
              <span className="mr-1">{hotel.type}</span>
            </div>
            <h3 className="text-lg font-extrabold text-ink group-hover:text-brand-800">{hotel.name}</h3>
            <div className="mt-1 flex items-center gap-1 text-xs text-ink/45">
              <MapPin className="h-3.5 w-3.5" /> {hotel.address}
              <span className="mx-1">·</span>
              {hotel.distance_to_center_km} کیلومتر از مرکز شهر
            </div>
          </div>
          <Rating value={hotel.guest_rating} count={hotel.review_count} />
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {hotel.amenities.slice(0, 5).map((amenity) => (
            <Badge key={amenity} tone="slate" className="bg-black/[0.035]">{amenity}</Badge>
          ))}
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-black/5 pt-4">
          <div className="text-[11px] text-ink/45">
            {hotel.breakfast_included && <span className="ml-2">صبحانه رایگان</span>}
            <span className="text-emerald-600">{new Intl.NumberFormat("fa-IR").format(hotel.rooms_available)} اتاق موجود</span>
          </div>
          <div className="text-left">
            <div className="text-[10px] text-ink/40">برای {new Intl.NumberFormat("fa-IR").format(hotel.nights)} شب</div>
            <div className="text-lg font-black text-brand-800">{toman(hotel.total_price)}</div>
            <div className="text-[10px] text-ink/35">{toman(hotel.min_price)} هر شب</div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function TransportResultCard({
  offer,
  passengers,
  date,
}: {
  offer: TransportOffer;
  passengers: number;
  date: string;
}) {
  const href = `/booking?type=transport&id=${offer.id}&date=${date}&guests=${passengers}`;
  const icon = { flight: "✈️", train: "🚆", bus: "🚌", car: "🚗", taxi: "🚕" }[offer.type] || "🚌";
  return (
    <div className="card p-5 transition hover:shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-2xl">{icon}</span>
          <div>
            <div className="font-extrabold text-ink">{offer.provider.name}</div>
            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-ink/45">
              {offer.type === "flight" ? "پرواز" : offer.type === "train" ? "قطار" : "سفر"} · {offer.code}
              {offer.stops === 0 ? " · بدون توقف" : ` · ${offer.stops} توقف`}
            </div>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center gap-3 sm:gap-6">
          <div className="text-center">
            <div className="text-xl font-black text-ink">{new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(new Date(offer.departure_at))}</div>
            <div className="text-[11px] text-ink/45">{destinationName(offer.origin)}</div>
          </div>
          <div className="flex min-w-24 flex-col items-center">
            <span className="text-[10px] text-ink/40">{duration(offer.duration_minutes)}</span>
            <span className="my-1 h-px w-full bg-gradient-to-l from-transparent via-brand-300 to-transparent" />
            <span className="text-[10px] text-brand-700">{offer.amenities.includes("wifi") ? "وای‌فای" : "مستقیم"}</span>
          </div>
          <div className="text-center">
            <div className="text-xl font-black text-ink">{new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(new Date(offer.arrival_at))}</div>
            <div className="text-[11px] text-ink/45">{destinationName(offer.destination)}</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-left">
            <div className="text-[10px] text-ink/40">{new Intl.NumberFormat("fa-IR").format(offer.seats_available)} صندلی باقی‌مانده</div>
            <div className="text-lg font-black text-brand-800">{toman(offer.price)}</div>
            <Rating value={offer.rating} size="sm" />
          </div>
          <Link href={href} className="btn-primary !rounded-xl !px-4 !py-2.5 !text-xs">
            انتخاب
          </Link>
        </div>
      </div>
    </div>
  );
}

export function DateChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-black/[0.035] px-2 py-1 text-[11px] text-ink/55">
      <CalendarDays className="h-3 w-3" /> {children}
    </span>
  );
}
