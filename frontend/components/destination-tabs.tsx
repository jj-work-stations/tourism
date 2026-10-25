"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CloudSun,
  Coffee,
  Compass,
  Hotel,
  MapPin,
  MapPinned,
  Sparkles,
  Star,
  Utensils,
  Users,
  Wallet,
} from "lucide-react";

import { ExperienceCard } from "@/components/cards";
import { DestinationMap } from "@/components/destination-map";
import { Badge, EmptyState, Rating, SmartImage } from "@/components/ui";
import { ReviewSection } from "@/components/review-section";
import { dateInput, date, toman } from "@/lib/format";
import type { Attraction, Destination, Experience, MapData, Restaurant, Review } from "@/lib/types";
import { cn, destinationName } from "@/lib/utils";

interface HotelSummary {
  id: string;
  slug: string;
  name: string;
  type: string;
  image_url?: string | null;
  images: string[];
  short_description: string;
  guest_rating: number;
  star_rating: number;
  review_count: number;
  base_price: number;
  amenities: string[];
  distance_to_center_km: number;
  is_featured: boolean;
}

interface Weather {
  temperature_c: number;
  feels_like_c: number;
  condition: string;
  humidity: number;
  wind_kph: number;
  forecast: { date: string; temp_min: number; temp_max: number; condition: string }[];
}

const tabs = [
  { id: "overview", label: "نمای کلی", icon: Compass },
  { id: "attractions", label: "جاذبه‌ها", icon: MapPinned },
  { id: "stays", label: "اقامتگاه", icon: Hotel },
  { id: "experiences", label: "تجربه‌ها", icon: Sparkles },
  { id: "food", label: "غذا و کافه", icon: Utensils },
  { id: "map", label: "نقشه", icon: MapPin },
  { id: "reviews", label: "نظرات", icon: Star },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function DestinationTabs({
  destination,
  attractions,
  hotels,
  experiences,
  restaurants,
  map,
  weather,
  reviews,
}: {
  destination: Destination;
  attractions: Attraction[];
  hotels: HotelSummary[];
  experiences: Experience[];
  restaurants: Restaurant[];
  map: MapData | null;
  weather: Weather | null;
  reviews: Review[];
}) {
  const [tab, setTab] = useState<TabId>("overview");
  const [checkIn, setCheckIn] = useState(dateInput(7));
  const [checkOut, setCheckOut] = useState(dateInput(9));
  const [guests, setGuests] = useState(2);
  const name = destinationName(destination);

  return (
    <div>
      <div className="sticky top-[72px] z-20 border-y border-black/5 bg-[#fbf8f3]/90 backdrop-blur-xl">
        <div className="container-app flex gap-1 overflow-x-auto py-2 no-scrollbar">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition",
                tab === item.id ? "bg-brand-700 text-white shadow-sm" : "text-ink/55 hover:bg-black/[0.04] hover:text-ink",
              )}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
              {item.id === "attractions" && attractions.length > 0 && (
                <span className={cn("rounded-md px-1 text-[10px]", tab === item.id ? "bg-white/20" : "bg-black/5")}>{attractions.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="container-app py-8">
        {tab === "overview" && (
          <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-black text-ink">درباره {name}</h2>
                <p className="mt-3 text-sm leading-8 text-ink/60">{destination.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {destination.tags.map((tag) => (
                    <Badge key={tag} tone="slate" className="bg-white">#{tag}</Badge>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "بهترین فصل", value: destination.best_season || "همه فصل‌ها", icon: CloudSun },
                  { label: "بودجه روزانه", value: toman(destination.avg_daily_budget, true), icon: Wallet },
                  { label: "جاذبه", value: `${new Intl.NumberFormat("fa-IR").format(destination.attraction_count)} مورد`, icon: MapPinned },
                  { label: "اقامتگاه", value: `${new Intl.NumberFormat("fa-IR").format(destination.accommodation_count)} مورد`, icon: Hotel },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-black/5 bg-white p-4">
                    <item.icon className="h-4 w-4 text-brand-700" />
                    <div className="mt-3 text-[10px] text-ink/40">{item.label}</div>
                    <div className="mt-1 text-xs font-extrabold text-ink">{item.value}</div>
                  </div>
                ))}
              </div>

              {weather && (
                <div className="rounded-3xl border border-black/5 bg-gradient-to-l from-brand-50 to-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-3xl shadow-sm">
                        {weather.condition.includes("باران") ? "🌧️" : weather.condition.includes("آفتاب") ? "☀️" : "⛅"}
                      </span>
                      <div>
                        <div className="text-xs text-ink/45">هوای امروز {name}</div>
                        <div className="mt-0.5 text-2xl font-black text-ink">
                          {new Intl.NumberFormat("fa-IR").format(weather.temperature_c)}°
                          <span className="mr-2 text-xs font-medium text-ink/45">{weather.condition}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 text-center text-[10px] text-ink/45">
                      <span className="rounded-xl bg-white px-3 py-2">رطوبت {new Intl.NumberFormat("fa-IR").format(weather.humidity)}٪</span>
                      <span className="rounded-xl bg-white px-3 py-2">باد {new Intl.NumberFormat("fa-IR").format(weather.wind_kph)} km/h</span>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-5 gap-2 border-t border-black/5 pt-4">
                    {weather.forecast.map((day) => (
                      <div key={day.date} className="rounded-xl bg-white/70 p-2 text-center">
                        <div className="text-[10px] text-ink/40">{new Intl.DateTimeFormat("fa-IR", { weekday: "short" }).format(new Date(day.date))}</div>
                        <div className="my-1 text-base">{day.condition.includes("باران") ? "🌧️" : day.condition.includes("آفتاب") ? "☀️" : "⛅"}</div>
                        <div className="text-[10px] font-bold text-ink">{new Intl.NumberFormat("fa-IR").format(day.temp_max)}° / {new Intl.NumberFormat("fa-IR").format(day.temp_min)}°</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {attractions.length > 0 && (
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-black text-ink">جاذبه‌های پیشنهادی</h3>
                    <button type="button" onClick={() => setTab("attractions")} className="text-xs font-bold text-brand-800">مشاهده همه ←</button>
                  </div>
                  <div className="space-y-3">
                    {attractions.slice(0, 3).map((attraction) => (
                      <AttractionRow key={attraction.id} attraction={attraction} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <aside className="space-y-4">
              <div className="card p-5">
                <h3 className="font-black text-ink">اقامتگاه پیدا کن</h3>
                <div className="mt-4 space-y-3">
                  <label className="block">
                    <span className="label">تاریخ ورود</span>
                    <input type="date" className="input" value={checkIn} min={dateInput()} onChange={(event) => setCheckIn(event.target.value)} />
                  </label>
                  <label className="block">
                    <span className="label">تاریخ خروج</span>
                    <input type="date" className="input" value={checkOut} min={checkIn} onChange={(event) => setCheckOut(event.target.value)} />
                  </label>
                  <label className="block">
                    <span className="label">تعداد مسافر</span>
                    <select className="input" value={guests} onChange={(event) => setGuests(Number(event.target.value))}>
                      {[1, 2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{new Intl.NumberFormat("fa-IR").format(count)} نفر</option>)}
                    </select>
                  </label>
                  <Link href={`/search?tab=stay&destination=${destination.id}&checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`} className="btn-primary w-full">
                    جستجوی اقامتگاه
                  </Link>
                </div>
              </div>

              <div className="rounded-3xl bg-brand-900 p-5 text-white">
                <Sparkles className="h-5 w-5 text-sand-300" />
                <h3 className="mt-3 font-black">برنامه سفر هوشمند</h3>
                <p className="mt-2 text-xs leading-6 text-white/55">
                  بگو چند روز می‌مانی و چه چیزی دوست داری؛ برنامه روزبه‌روز {name} را برایت می‌چینیم.
                </p>
                <Link href={`/assistant?destination=${destination.id}`} className="btn mt-4 w-full bg-white !py-2.5 !text-xs !text-brand-900">
                  ساخت برنامه سفر
                </Link>
              </div>

              {hotels.length > 0 && (
                <div className="card p-4">
                  <h3 className="mb-3 px-1 text-sm font-black text-ink">محبوب‌ترین اقامتگاه‌ها</h3>
                  <div className="space-y-2">
                    {hotels.slice(0, 3).map((hotel) => (
                      <Link key={hotel.id} href={`/stays/${hotel.slug}?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`} className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-brand-50/60">
                        <SmartImage src={hotel.image_url} alt={hotel.name} className="h-12 w-12 rounded-xl" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-bold text-ink">{hotel.name}</div>
                          <div className="mt-0.5"><Rating value={hotel.guest_rating} count={hotel.review_count} size="sm" /></div>
                        </div>
                        <span className="text-[10px] font-bold text-brand-800">{toman(hotel.base_price, true)}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}

        {tab === "attractions" && (
          <div>
            {attractions.length ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {attractions.map((attraction) => (
                  <div key={attraction.id} className="card overflow-hidden">
                    <SmartImage src={attraction.image_url} alt={attraction.name} className="h-48 w-full" />
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-extrabold text-ink">{attraction.name}</h3>
                        <Rating value={attraction.rating} size="sm" />
                      </div>
                      <div className="mt-2 flex items-center gap-1 text-[11px] text-ink/40">
                        <MapPin className="h-3.5 w-3.5" /> {attraction.address}
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs leading-6 text-ink/50">{attraction.description}</p>
                      <div className="mt-3 flex flex-wrap gap-2 border-t border-black/5 pt-3 text-[10px]">
                        <Badge tone="slate">{attraction.category}</Badge>
                        <Badge tone="brand">بلیت {attraction.ticket_price ? toman(attraction.ticket_price) : "رایگان"}</Badge>
                        <Badge tone="sand">{new Intl.NumberFormat("fa-IR").format(attraction.suggested_visit_minutes)} دقیقه</Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={<MapPinned className="h-6 w-6" />} title="جاذبه‌ای ثبت نشده" description="به‌زودی جاذبه‌های این مقصد اضافه می‌شود." />
            )}
          </div>
        )}

        {tab === "stays" && (
          <div>
            <div className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-black/5 bg-white p-4">
              <label className="block">
                <span className="label">ورود</span>
                <input type="date" className="input !py-2" value={checkIn} min={dateInput()} onChange={(event) => setCheckIn(event.target.value)} />
              </label>
              <label className="block">
                <span className="label">خروج</span>
                <input type="date" className="input !py-2" value={checkOut} min={checkIn} onChange={(event) => setCheckOut(event.target.value)} />
              </label>
              <label className="block">
                <span className="label">مسافر</span>
                <select className="input !py-2" value={guests} onChange={(event) => setGuests(Number(event.target.value))}>
                  {[1, 2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{new Intl.NumberFormat("fa-IR").format(count)} نفر</option>)}
                </select>
              </label>
              <Link href={`/search?tab=stay&destination=${destination.id}&checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`} className="btn-primary !py-2.5">جستجوی کامل</Link>
            </div>
            {hotels.length ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {hotels.map((hotel) => (
                  <div key={hotel.id} className="card flex gap-4 p-3">
                    <SmartImage src={hotel.image_url} alt={hotel.name} className="h-36 w-32 shrink-0 rounded-2xl" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-center gap-1 text-[10px] text-amber-500">
                        {Array.from({ length: hotel.star_rating }).map((_, index) => <Star key={index} className="h-3 w-3 fill-current" />)}
                      </div>
                      <h3 className="mt-1 font-bold text-ink">{hotel.name}</h3>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-ink/45">{hotel.short_description}</p>
                      <div className="mt-auto flex items-end justify-between pt-2">
                        <Rating value={hotel.guest_rating} count={hotel.review_count} size="sm" />
                        <div className="text-left">
                          <div className="text-[10px] text-ink/40">از هر شب</div>
                          <div className="text-sm font-black text-brand-800">{toman(hotel.base_price)}</div>
                        </div>
                      </div>
                      <Link href={`/stays/${hotel.slug}?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`} className="btn-secondary mt-2 w-full !py-2 !text-[11px]">
                        مشاهده و رزرو
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={<Hotel className="h-6 w-6" />} title="اقامتگاهی ثبت نشده" />
            )}
          </div>
        )}

        {tab === "experiences" && (
          <div>
            {experiences.length ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {experiences.map((experience) => <ExperienceCard key={experience.id} experience={experience} />)}
              </div>
            ) : (
              <EmptyState icon={<Sparkles className="h-6 w-6" />} title="تجربه‌ای ثبت نشده" />
            )}
          </div>
        )}

        {tab === "food" && (
          <div>
            {restaurants.length ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {restaurants.map((restaurant) => (
                  <div key={restaurant.id} className="card overflow-hidden">
                    <SmartImage src={restaurant.image_url} alt={restaurant.name} className="h-44 w-full" />
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-extrabold text-ink">{restaurant.name}</h3>
                          <div className="mt-1 flex items-center gap-1 text-[11px] text-ink/40"><Utensils className="h-3 w-3" /> {restaurant.cuisine}</div>
                        </div>
                        <Rating value={restaurant.rating} count={restaurant.review_count} size="sm" />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {(restaurant.signature_dishes || []).slice(0, 3).map((dish) => (
                          <Badge key={dish} tone="sand">{dish}</Badge>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-black/5 pt-3 text-[11px]">
                        <span className="text-ink/45">میانگین هر نفر</span>
                        <span className="font-black text-brand-800">{toman(restaurant.average_price)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={<Coffee className="h-6 w-6" />} title="رستورانی ثبت نشده" />
            )}
          </div>
        )}

        {tab === "map" && (
          <div>
            {map ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink/45">
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-brand-700" /> مقصد</span>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-sand-500" /> اقامتگاه</span>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-sky-500" /> جاذبه</span>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> رستوران</span>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-violet-500" /> تجربه</span>
                </div>
                <DestinationMap data={map} />
                <p className="text-[11px] text-ink/40">برای مشاهده جزئیات هر مکان روی نشانگرها کلیک کنید.</p>
              </div>
            ) : (
              <EmptyState icon={<MapPin className="h-6 w-6" />} title="نقشه‌ای موجود نیست" />
            )}
          </div>
        )}

        {tab === "reviews" && (
          <ReviewSection entityType="destination" entityId={destination.id} initial={reviews} />
        )}
      </div>
    </div>
  );
}

function AttractionRow({ attraction }: { attraction: Attraction }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-black/5 bg-white p-3">
      <SmartImage src={attraction.image_url} alt={attraction.name} className="h-20 w-20 rounded-xl" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h4 className="truncate text-sm font-bold text-ink">{attraction.name}</h4>
          <Rating value={attraction.rating} size="sm" />
        </div>
        <div className="mt-1 flex items-center gap-1 text-[10px] text-ink/40"><MapPin className="h-3 w-3" /> {attraction.address}</div>
        <div className="mt-2 flex items-center gap-2 text-[10px] text-ink/40">
          <span className="rounded-md bg-black/[0.04] px-1.5 py-0.5"><CalendarDays className="mb-0.5 ml-0.5 inline h-3 w-3" /> {date(attraction.opening_hours?.weekdays || "")}</span>
          <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-brand-800">{attraction.ticket_price ? toman(attraction.ticket_price) : "ورود رایگان"}</span>
        </div>
      </div>
    </div>
  );
}
