"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BedDouble,
  CheckCircle2,
  Clock3,
  CreditCard,
  Loader2,
  MapPin,
  ShieldCheck,
  Tag,
  Ticket,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { RequireAuth } from "@/components/require-auth";
import { Badge, PageHero, Rating, SmartImage, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { date, duration, time, toman } from "@/lib/format";
import type {
  Accommodation,
  Booking,
  Experience,
  PaymentResult,
  TransportOffer,
} from "@/lib/types";
import { destinationName } from "@/lib/utils";

type BookingType = "transport" | "accommodation" | "experience";

function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 1;
  const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(1, Math.round(diff / 86_400_000));
}

function BookingContent() {
  const params = useSearchParams();
  const router = useRouter();
  const user = useAuth((state) => state.user);

  const type = (params.get("type") ?? "transport") as BookingType;
  const offerId = params.get("offer") ?? "";
  const hotelId = params.get("hotel") ?? "";
  const roomId = params.get("room") ?? "";
  const experienceId = params.get("experience") ?? "";
  const travelDate = params.get("date") ?? "";
  const checkIn = params.get("checkIn") ?? "";
  const checkOut = params.get("checkOut") ?? "";
  const guests = Math.max(1, Number(params.get("guests") || 1));
  const rooms = Math.max(1, Number(params.get("rooms") || 1));

  const [firstName, setFirstName] = useState(user?.full_name?.split(" ")[0] ?? "");
  const [lastName, setLastName] = useState(user?.full_name?.split(" ").slice(1).join(" ") ?? "");
  const [nationalId, setNationalId] = useState("");
  const [gender, setGender] = useState("male");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [coupon, setCoupon] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const offerQuery = useQuery({
    queryKey: ["booking", "offer", offerId],
    queryFn: () => api.get<TransportOffer>(`/transportation/offers/${offerId}`),
    enabled: type === "transport" && Boolean(offerId),
  });
  const stayQuery = useQuery({
    queryKey: ["booking", "stay", hotelId, checkIn, checkOut, guests, rooms],
    queryFn: () =>
      api.get<Accommodation>(`/accommodations/${hotelId}`, {
        check_in: checkIn || undefined,
        check_out: checkOut || undefined,
        guests,
        rooms_count: rooms,
      }),
    enabled: type === "accommodation" && Boolean(hotelId),
  });
  const experienceQuery = useQuery({
    queryKey: ["booking", "experience", experienceId],
    queryFn: () => api.get<Experience>(`/experiences/${experienceId}`),
    enabled: type === "experience" && Boolean(experienceId),
  });

  const room = useMemo(
    () => stayQuery.data?.rooms.find((item) => item.id === roomId) ?? stayQuery.data?.rooms[0],
    [stayQuery.data, roomId],
  );
  const nights = nightsBetween(checkIn, checkOut);

  const summary = useMemo(() => {
    if (type === "transport" && offerQuery.data) {
      return {
        title: `${destinationName(offerQuery.data.origin)} → ${destinationName(offerQuery.data.destination)}`,
        subtitle: `${offerQuery.data.provider.name} · ${time(offerQuery.data.departure_at)}`,
        image: offerQuery.data.provider.logo_url,
        unit: offerQuery.data.price,
        quantity: guests,
        quantityLabel: "مسافر",
        total: offerQuery.data.price * guests,
        destination: destinationName(offerQuery.data.destination),
      };
    }
    if (type === "accommodation" && stayQuery.data && room) {
      return {
        title: stayQuery.data.name,
        subtitle: `${date(checkIn)} تا ${date(checkOut)} · ${nights} شب`,
        image: stayQuery.data.images[0],
        unit: room.price_per_night,
        quantity: nights * rooms,
        quantityLabel: `${nights} شب × ${rooms} اتاق`,
        total: room.price_per_night * nights * rooms,
        destination: stayQuery.data.address,
      };
    }
    if (type === "experience" && experienceQuery.data) {
      return {
        title: experienceQuery.data.name,
        subtitle: `${date(travelDate)} · ${duration(experienceQuery.data.duration_minutes)}`,
        image: experienceQuery.data.image_url,
        unit: experienceQuery.data.price,
        quantity: guests,
        quantityLabel: "نفر",
        total: experienceQuery.data.price * guests,
        destination: experienceQuery.data.meeting_point,
      };
    }
    return null;
  }, [type, offerQuery.data, stayQuery.data, room, experienceQuery.data, guests, nights, rooms, checkIn, checkOut, travelDate]);

  const loading =
    (type === "transport" && offerQuery.isLoading) ||
    (type === "accommodation" && stayQuery.isLoading) ||
    (type === "experience" && experienceQuery.isLoading);

  const queryError = offerQuery.error || stayQuery.error || experienceQuery.error;

  async function submit(payNow: boolean) {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("نام و نام خانوادگی مسافر اصلی را وارد کنید.");
      return;
    }
    if (!summary) return;
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        booking_type: type,
        guests,
        passengers: [
          {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            national_id: nationalId || undefined,
            gender,
            phone: phone || undefined,
          },
        ],
        coupon_code: coupon.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      if (type === "transport") {
        payload.transport_offer_id = offerId;
        payload.travel_date = travelDate;
      } else if (type === "accommodation") {
        payload.room_id = room?.id;
        payload.check_in = checkIn;
        payload.check_out = checkOut;
        payload.rooms_count = rooms;
      } else {
        payload.experience_id = experienceId;
        payload.travel_date = travelDate;
      }
      const booking = await api.post<Booking>("/bookings", payload, true);
      if (payNow) {
        const payment = await api.post<PaymentResult>(
          "/payments",
          { booking_id: booking.id, method: "card" },
          true,
        );
        toast.success(payment.message || "پرداخت با موفقیت انجام شد.");
      } else {
        toast.success("رزرو ثبت شد. تا ۳۰ دقیقه فرصت پرداخت دارید.");
      }
      router.push(`/bookings/${booking.id}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "ثبت رزرو انجام نشد.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="container-app grid min-h-[60vh] place-items-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (queryError || !summary) {
    return (
      <div className="container-app py-16">
        <div className="card mx-auto max-w-md p-8 text-center">
          <h1 className="text-xl font-black text-ink">اطلاعات رزرو کامل نیست</h1>
          <p className="mt-2 text-sm text-ink/50">
            {queryError instanceof ApiError ? queryError.message : "لطفاً دوباره از صفحه جستجو گزینه‌ای انتخاب کنید."}
          </p>
          <Link href="/search" className="btn-primary mt-6">بازگشت به جستجو</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHero
        title="تکمیل رزرو"
        description="اطلاعات مسافر را وارد کنید و پرداخت را نهایی کنید. رزرو تا ۳۰ دقیقه برای شما نگه داشته می‌شود."
        badge={
          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-[11px] font-bold text-brand-800">
            <Ticket className="h-3.5 w-3.5" /> گام نهایی رزرو
          </span>
        }
      />

      <div className="container-app grid gap-6 py-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <div className="card p-5">
            <h2 className="font-black text-ink">اطلاعات مسافر اصلی</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="label">نام</span>
                <input className="input" value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="مثلاً سارا" />
              </label>
              <label className="block">
                <span className="label">نام خانوادگی</span>
                <input className="input" value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="مثلاً مسافر" />
              </label>
              <label className="block">
                <span className="label">کد ملی</span>
                <input className="input" value={nationalId} onChange={(event) => setNationalId(event.target.value)} placeholder="۰۰۱۲۳۴۵۶۷۸" inputMode="numeric" />
              </label>
              <label className="block">
                <span className="label">شماره موبایل</span>
                <input className="input" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="۰۹۱۲..." inputMode="tel" />
              </label>
              <label className="block">
                <span className="label">جنسیت</span>
                <select className="input" value={gender} onChange={(event) => setGender(event.target.value)}>
                  <option value="male">آقا</option>
                  <option value="female">خانم</option>
                  <option value="other">سایر</option>
                </select>
              </label>
              <label className="block">
                <span className="label">کد تخفیف (اختیاری)</span>
                <div className="relative">
                  <Tag className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />
                  <input className="input pr-10" value={coupon} onChange={(event) => setCoupon(event.target.value.toUpperCase())} placeholder="WELCOME20" />
                </div>
              </label>
            </div>
            <label className="mt-4 block">
              <span className="label">توضیحات (اختیاری)</span>
              <textarea className="input min-h-[90px]" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="درخواست خاصی دارید؟" />
            </label>
          </div>

          <div className="card p-5">
            <h2 className="font-black text-ink">اطلاعات سفر</h2>
            <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
              <div className="rounded-2xl bg-black/[0.025] p-3">
                <div className="text-ink/40">نوع رزرو</div>
                <div className="mt-1 font-bold text-ink">
                  {type === "transport" ? "بلیت حمل‌ونقل" : type === "accommodation" ? "اقامتگاه" : "تجربه محلی"}
                </div>
              </div>
              <div className="rounded-2xl bg-black/[0.025] p-3">
                <div className="text-ink/40">تعداد</div>
                <div className="mt-1 font-bold text-ink">
                  {type === "accommodation"
                    ? `${new Intl.NumberFormat("fa-IR").format(nights)} شب · ${new Intl.NumberFormat("fa-IR").format(rooms)} اتاق`
                    : `${new Intl.NumberFormat("fa-IR").format(guests)} نفر`}
                </div>
              </div>
              <div className="rounded-2xl bg-black/[0.025] p-3">
                <div className="text-ink/40">{type === "accommodation" ? "ورود" : "تاریخ"}</div>
                <div className="mt-1 font-bold text-ink">{date(type === "accommodation" ? checkIn : travelDate)}</div>
              </div>
              <div className="rounded-2xl bg-black/[0.025] p-3">
                <div className="text-ink/40">{type === "accommodation" ? "خروج" : "مدت"}</div>
                <div className="mt-1 font-bold text-ink">
                  {type === "accommodation"
                    ? date(checkOut)
                    : type === "transport" && offerQuery.data
                      ? duration(offerQuery.data.duration_minutes)
                      : experienceQuery.data
                        ? duration(experienceQuery.data.duration_minutes)
                        : "—"}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-2xl bg-brand-50/70 p-4 text-[11px] leading-6 text-brand-900">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            پرداخت از طریق درگاه امن سیر انجام می‌شود. در صورت لغو طبق سیاست رزرو، مبلغ به کیف پول یا حساب شما بازمی‌گردد.
          </div>
        </div>

        <aside className="h-fit space-y-4 lg:sticky lg:top-24">
          <div className="card overflow-hidden">
            <SmartImage src={summary.image} alt={summary.title} className="h-40 w-full" fallbackClassName="h-40 w-full" />
            <div className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-black text-ink">{summary.title}</h2>
                  <div className="mt-1 text-[11px] text-ink/45">{summary.subtitle}</div>
                </div>
                {type === "transport" && offerQuery.data && <Rating value={offerQuery.data.rating} size="sm" />}
              </div>
              <div className="mt-2 flex items-center gap-1 text-[11px] text-ink/40">
                <MapPin className="h-3 w-3" /> {summary.destination}
              </div>

              <div className="mt-4 space-y-2 border-t border-black/5 pt-4 text-xs">
                <div className="flex justify-between text-ink/50">
                  <span>قیمت واحد</span>
                  <span>{toman(summary.unit)}</span>
                </div>
                <div className="flex justify-between text-ink/50">
                  <span>{summary.quantityLabel}</span>
                  <span>{new Intl.NumberFormat("fa-IR").format(summary.quantity)}</span>
                </div>
                <div className="flex justify-between text-ink/50">
                  <span>مالیات و کارمزد</span>
                  <span>شامل قیمت</span>
                </div>
                <div className="flex justify-between border-t border-black/5 pt-2 text-sm font-black text-ink">
                  <span>مبلغ قابل پرداخت</span>
                  <span>{toman(summary.total)}</span>
                </div>
                {coupon && <div className="text-[10px] text-brand-700">کد «{coupon}» پس از تأیید در مبلغ نهایی اعمال می‌شود.</div>}
              </div>

              <button type="button" onClick={() => submit(true)} disabled={submitting} className="btn-primary mt-4 w-full">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                پرداخت و تأیید رزرو
              </button>
              <button type="button" onClick={() => submit(false)} disabled={submitting} className="btn-secondary mt-2 w-full !py-2.5 !text-xs">
                ثبت بدون پرداخت
              </button>
              <div className="mt-3 flex items-center justify-center gap-3 text-[10px] text-ink/40">
                <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> پرداخت امن</span>
                <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" /> نگهداری ۳۰ دقیقه</span>
              </div>
            </div>
          </div>

          <div className="card p-4 text-[11px] leading-6 text-ink/50">
            <div className="mb-2 flex items-center gap-1 font-bold text-ink"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> مزایای رزرو با سیر</div>
            <div>• پشتیبانی ۲۴ ساعته در طول سفر</div>
            <div>• دریافت امتیاز و پاسپورت سفر</div>
            <div>• امکان مدیریت و لغو آنلاین</div>
          </div>
        </aside>
      </div>
    </>
  );
}

export default function BookingPage() {
  return (
    <RequireAuth>
      <Suspense
        fallback={
          <div className="container-app grid min-h-[60vh] place-items-center">
            <Spinner className="h-8 w-8" />
          </div>
        }
      >
        <BookingContent />
      </Suspense>
    </RequireAuth>
  );
}
