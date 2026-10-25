import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BedDouble,
  CalendarDays,
  CheckCircle2,
  Coffee,
  MapPin,
  Ruler,
  ShieldCheck,
  Star,
  Users,
} from "lucide-react";

import { ReviewSection } from "@/components/review-section";
import { Badge, Rating, SmartImage } from "@/components/ui";
import { serverFetch } from "@/lib/api";
import { date, duration, toman } from "@/lib/format";
import type { Accommodation, Page, Review } from "@/lib/types";

export const dynamic = "force-dynamic";

interface StaySearchParams {
  checkIn?: string;
  checkOut?: string;
  guests?: string;
  rooms?: string;
}

function nightsBetween(checkIn?: string, checkOut?: string): number {
  if (!checkIn || !checkOut) return 1;
  const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(1, Math.round(diff / 86_400_000));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const hotel = await serverFetch<Accommodation>(`/accommodations/slug/${slug}`);
  if (!hotel) return { title: "اقامتگاه یافت نشد" };
  return {
    title: `${hotel.name} | رزرو اقامتگاه`,
    description: hotel.short_description || hotel.description,
    openGraph: {
      title: hotel.name,
      images: hotel.images[0] ? [{ url: hotel.images[0] }] : [],
    },
  };
}

export default async function StayPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<StaySearchParams>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const guests = Number(query.guests || 2);
  const rooms = Number(query.rooms || 1);

  const hotel = await serverFetch<Accommodation>(`/accommodations/slug/${slug}`, {
    check_in: query.checkIn,
    check_out: query.checkOut,
    guests,
    rooms_count: rooms,
  });
  if (!hotel) notFound();

  const reviews = await serverFetch<Page<Review>>("/reviews", {
    entity_type: "accommodation",
    entity_id: hotel.id,
    page_size: 20,
  });

  const nights = nightsBetween(query.checkIn, query.checkOut);
  const checkIn = query.checkIn;
  const checkOut = query.checkOut;

  return (
    <>
      <section className="container-app pt-6">
        <div className="grid gap-2 overflow-hidden rounded-3xl sm:grid-cols-[2fr_1fr]">
          <SmartImage
            src={hotel.images[0]}
            alt={hotel.name}
            className="h-72 w-full sm:h-[420px]"
            fallbackClassName="h-72 w-full sm:h-[420px]"
          />
          <div className="hidden grid-rows-2 gap-2 sm:grid">
            <SmartImage src={hotel.images[1]} alt={hotel.name} className="h-full w-full" fallbackClassName="h-full w-full" />
            <SmartImage src={hotel.images[2]} alt={hotel.name} className="h-full w-full" fallbackClassName="h-full w-full" />
          </div>
        </div>
      </section>

      <section className="container-app grid gap-8 py-8 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge tone="brand">{hotel.type}</Badge>
                {hotel.is_featured && <Badge tone="sand">پیشنهاد سیر</Badge>}
                <span className="flex items-center gap-0.5 text-amber-400">
                  {Array.from({ length: hotel.star_rating }).map((_, index) => (
                    <Star key={index} className="h-3.5 w-3.5 fill-current" />
                  ))}
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-black text-ink sm:text-3xl">{hotel.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-ink/50">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {hotel.address}
                </span>
                <span>{new Intl.NumberFormat("fa-IR").format(hotel.distance_to_center_km)} کیلومتر از مرکز</span>
              </div>
            </div>
            <div className="text-center">
              <Rating value={hotel.guest_rating} count={hotel.review_count} />
              <div className="mt-1 text-[10px] text-ink/40">امتیاز مهمانان</div>
            </div>
          </div>

          <p className="mt-5 text-sm leading-8 text-ink/60">{hotel.description}</p>

          <div className="mt-5 flex flex-wrap gap-2">
            {hotel.amenities.map((amenity) => (
              <Badge key={amenity} tone="slate" className="bg-black/[0.035]">
                <CheckCircle2 className="h-3 w-3 text-brand-600" /> {amenity}
              </Badge>
            ))}
          </div>

          <div className="mt-8">
            <h2 className="flex items-center gap-2 text-lg font-black text-ink">
              <BedDouble className="h-5 w-5 text-brand-700" /> اتاق‌ها و قیمت‌ها
            </h2>
            {checkIn && checkOut && (
              <p className="mt-1 text-xs text-ink/45">
                {date(checkIn)} تا {date(checkOut)} · {new Intl.NumberFormat("fa-IR").format(nights)} شب
              </p>
            )}
            <div className="mt-4 space-y-3">
              {hotel.rooms.map((room) => {
                const total = room.price_per_night * nights;
                const available = (room.rooms_left ?? room.total_rooms) >= rooms;
                return (
                  <div key={room.id} className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                    <SmartImage src={room.images[0]} alt={room.name} className="h-28 w-full rounded-2xl sm:w-36" fallbackClassName="h-28 w-full rounded-2xl sm:w-36" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-extrabold text-ink">{room.name}</h3>
                        {room.breakfast_included && <Badge tone="emerald"><Coffee className="h-3 w-3" /> صبحانه</Badge>}
                        {room.refundable && <Badge tone="sky">لغو رایگان</Badge>}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-6 text-ink/50">{room.description}</p>
                      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-ink/45">
                        <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> تا {new Intl.NumberFormat("fa-IR").format(room.capacity)} نفر</span>
                        {room.beds && <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" /> {room.beds}</span>}
                        {room.size_sqm ? <span className="flex items-center gap-1"><Ruler className="h-3.5 w-3.5" /> {new Intl.NumberFormat("fa-IR").format(room.size_sqm)} متر</span> : null}
                        {room.rooms_left !== null && room.rooms_left !== undefined && (
                          <span className={available ? "text-emerald-600" : "text-rose-600"}>
                            {available
                              ? `${new Intl.NumberFormat("fa-IR").format(room.rooms_left)} اتاق موجود`
                              : "ظرفیت تکمیل"}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-left sm:text-center">
                      <div className="text-[10px] text-ink/40">هر شب</div>
                      <div className="text-lg font-black text-brand-800">{toman(room.price_per_night)}</div>
                      {nights > 1 && <div className="text-[10px] text-ink/40">جمع {toman(total)}</div>}
                      <Link
                        href={`/booking?type=accommodation&hotel=${hotel.id}&room=${room.id}&checkIn=${checkIn ?? ""}&checkOut=${checkOut ?? ""}&guests=${guests}&rooms=${rooms}`}
                        className="btn-primary mt-2 !rounded-xl !px-4 !py-2 !text-xs"
                      >
                        رزرو اتاق
                        <ArrowLeft className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="card p-5">
              <h3 className="flex items-center gap-2 font-black text-ink"><ShieldCheck className="h-4 w-4 text-brand-700" /> قوانین اقامتگاه</h3>
              <ul className="mt-3 space-y-2 text-xs leading-6 text-ink/55">
                {hotel.rules.map((rule) => (
                  <li key={rule} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand-600" />{rule}</li>
                ))}
                {hotel.rules.length === 0 && <li>قانون خاصی ثبت نشده است.</li>}
              </ul>
            </div>
            <div className="card p-5">
              <h3 className="flex items-center gap-2 font-black text-ink"><CalendarDays className="h-4 w-4 text-brand-700" /> سیاست‌ها</h3>
              <dl className="mt-3 space-y-2 text-xs leading-6 text-ink/55">
                {Object.entries(hotel.policies).map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-3">
                    <dt className="text-ink/40">{key}</dt>
                    <dd className="text-left font-medium text-ink/70">{value}</dd>
                  </div>
                ))}
                {hotel.cancellation_policy && (
                  <div className="border-t border-black/5 pt-2 text-ink/60">{hotel.cancellation_policy}</div>
                )}
              </dl>
            </div>
          </div>

          {hotel.nearby_attractions.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-black text-ink">نزدیک این اقامتگاه</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {hotel.nearby_attractions.map((attraction) => (
                  <div key={attraction.id} className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-3">
                    <SmartImage src={attraction.image_url} alt={attraction.name} className="h-12 w-12 rounded-xl" />
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold text-ink">{attraction.name}</div>
                      <div className="text-[10px] text-ink/40">{attraction.distance_km} کیلومتر</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-10">
            <h2 className="mb-4 text-lg font-black text-ink">نظرات مهمانان</h2>
            <ReviewSection
              entityType="accommodation"
              entityId={hotel.id}
              initial={reviews?.items ?? []}
            />
          </div>
        </div>

        <aside className="h-fit lg:sticky lg:top-24">
          <div className="card p-5">
            <div className="text-xs text-ink/45">شروع قیمت برای هر شب</div>
            <div className="mt-1 text-2xl font-black text-brand-800">
              {toman(Math.min(...hotel.rooms.map((room) => room.price_per_night), hotel.base_price))}
            </div>
            <div className="mt-3 rounded-2xl bg-brand-50/70 p-3 text-[11px] leading-6 text-brand-900">
              {checkIn && checkOut ? (
                <>
                  <div className="flex justify-between"><span>ورود</span><b>{date(checkIn)}</b></div>
                  <div className="flex justify-between"><span>خروج</span><b>{date(checkOut)}</b></div>
                  <div className="flex justify-between"><span>مدت</span><b>{duration(nights * 24 * 60)}</b></div>
                  <div className="flex justify-between"><span>مهمان</span><b>{new Intl.NumberFormat("fa-IR").format(guests)} نفر</b></div>
                </>
              ) : (
                <span>برای مشاهده قیمت نهایی، تاریخ ورود و خروج را انتخاب کنید.</span>
              )}
            </div>
            <div className="mt-3 space-y-2 text-[11px] text-ink/50">
              {hotel.breakfast_included && <div className="flex items-center gap-2"><Coffee className="h-3.5 w-3.5 text-brand-600" /> صبحانه شامل قیمت</div>}
              {hotel.free_cancellation && <div className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> امکان لغو رایگان</div>}
              <div className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-brand-600" /> پرداخت امن از طریق سیر</div>
            </div>
            <Link
              href={`/booking?type=accommodation&hotel=${hotel.id}&room=${hotel.rooms[0]?.id ?? ""}&checkIn=${checkIn ?? ""}&checkOut=${checkOut ?? ""}&guests=${guests}&rooms=${rooms}`}
              className="btn-primary mt-4 w-full"
            >
              ادامه رزرو
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-4 rounded-3xl bg-brand-900 p-5 text-white">
            <div className="text-xs font-bold text-sand-200">می‌خواهی برنامه سفر هم داشته باشی؟</div>
            <p className="mt-2 text-[11px] leading-6 text-white/55">
              دستیار سیر اقامتگاه و جاذبه‌های اطراف را در یک برنامه روزبه‌روز می‌چیند.
            </p>
            <Link href="/assistant" className="btn mt-3 w-full bg-white !py-2.5 !text-xs !text-brand-900">
              ساخت برنامه هوشمند
            </Link>
          </div>
        </aside>
      </section>
    </>
  );
}
