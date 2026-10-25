"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Download,
  MapPin,
  Printer,
  Ticket,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { RequireAuth } from "@/components/require-auth";
import { Badge, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { bookingStatus, bookingType, date, relative, time, toman } from "@/lib/format";
import type { Booking, PaymentResult } from "@/lib/types";

interface TicketData {
  booking_id: string;
  code: string;
  qr_data: string;
  title: string;
  status: string;
  total: number;
  travel_date?: string | null;
  check_in?: string | null;
  check_out?: string | null;
  passengers: { name: string; seat?: string | null }[];
  details: Record<string, unknown>;
}

function BookingDetailContent() {
  const params = useParams<{ id: string }>();
  const bookingId = params.id;
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const bookingQuery = useQuery({
    queryKey: ["booking", bookingId],
    queryFn: () => api.get<Booking>(`/bookings/${bookingId}`, undefined, true),
    enabled: Boolean(bookingId),
  });
  const booking = bookingQuery.data;
  const ticketQuery = useQuery({
    queryKey: ["booking", bookingId, "ticket"],
    queryFn: () => api.get<TicketData>(`/bookings/${bookingId}/ticket`, undefined, true),
    enabled: Boolean(bookingId) && (booking?.status === "confirmed" || booking?.status === "completed"),
    retry: false,
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["booking", bookingId] });
  }

  async function pay() {
    setBusy(true);
    try {
      const result = await api.post<PaymentResult>(
        "/payments",
        { booking_id: bookingId, method: "card" },
        true,
      );
      toast.success(result.message || "پرداخت انجام شد.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "پرداخت انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!window.confirm("از لغو این رزرو مطمئن هستید؟")) return;
    setBusy(true);
    try {
      await api.post(`/bookings/${bookingId}/cancel`, { reason: "لغو توسط کاربر" }, true);
      toast.success("رزرو لغو شد.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "لغو رزرو انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  async function complete() {
    setBusy(true);
    try {
      await api.post(`/bookings/${bookingId}/complete`, undefined, true);
      toast.success("سفر تکمیل شد. امتیاز و نشان جدید در پاسپورت شما ثبت شد!");
      await refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "ثبت پایان سفر انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  if (bookingQuery.isLoading) {
    return (
      <div className="container-app grid min-h-[60vh] place-items-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (bookingQuery.error || !booking) {
    return (
      <div className="container-app py-16">
        <div className="card mx-auto max-w-md p-8 text-center">
          <XCircle className="mx-auto h-10 w-10 text-rose-500" />
          <h1 className="mt-3 text-xl font-black text-ink">رزرو پیدا نشد</h1>
          <p className="mt-2 text-sm text-ink/50">
            {bookingQuery.error instanceof ApiError ? bookingQuery.error.message : "این رزرو در دسترس نیست."}
          </p>
          <Link href="/account/bookings" className="btn-primary mt-6">رزروهای من</Link>
        </div>
      </div>
    );
  }

  const status = bookingStatus[booking.status] ?? { label: booking.status, tone: "slate" };
  const mode = booking.details?.transport_type
    ? String(booking.details.transport_type)
    : bookingType[booking.booking_type] ?? booking.booking_type;

  return (
    <div className="container-app max-w-4xl py-8">
      <Link href="/account/bookings" className="mb-5 inline-flex items-center gap-1 text-xs font-semibold text-ink/50 hover:text-ink">
        <ArrowRight className="h-3.5 w-3.5" /> بازگشت به رزروها
      </Link>

      <div className="card overflow-hidden">
        <div className="bg-gradient-to-l from-brand-800 to-brand-600 p-6 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[11px] text-white/60">{mode} · کد رزرو</div>
              <div className="mt-1 font-mono text-xl font-black tracking-wider">{booking.code}</div>
              <h1 className="mt-3 text-xl font-black">{booking.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-white/70">
                {booking.destination && (
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {booking.destination.name_local || booking.destination.name}</span>
                )}
                <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" /> ثبت {relative(booking.created_at)}</span>
              </div>
            </div>
            <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${
              booking.status === "confirmed" ? "bg-emerald-400/20 text-emerald-50" :
              booking.status === "pending" ? "bg-amber-400/20 text-amber-50" :
              "bg-white/15 text-white"
            }`}>
              {status.label}
            </span>
          </div>
        </div>

        <div className="grid gap-6 p-6 sm:grid-cols-2">
          <div>
            <h2 className="text-sm font-black text-ink">جزئیات سفر</h2>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between gap-3 border-b border-black/5 pb-2">
                <dt className="text-ink/45">نوع</dt><dd className="font-semibold text-ink">{bookingType[booking.booking_type]}</dd>
              </div>
              {booking.travel_date && (
                <div className="flex justify-between gap-3 border-b border-black/5 pb-2">
                  <dt className="text-ink/45">تاریخ سفر</dt><dd className="font-semibold text-ink">{date(booking.travel_date)}</dd>
                </div>
              )}
              {booking.check_in && (
                <div className="flex justify-between gap-3 border-b border-black/5 pb-2">
                  <dt className="text-ink/45">ورود</dt><dd className="font-semibold text-ink">{date(booking.check_in)}</dd>
                </div>
              )}
              {booking.check_out && (
                <div className="flex justify-between gap-3 border-b border-black/5 pb-2">
                  <dt className="text-ink/45">خروج</dt><dd className="font-semibold text-ink">{date(booking.check_out)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3 border-b border-black/5 pb-2">
                <dt className="text-ink/45">مسافران</dt><dd className="font-semibold text-ink">{new Intl.NumberFormat("fa-IR").format(booking.guests)} نفر</dd>
              </div>
              {booking.nights > 0 && (
                <div className="flex justify-between gap-3 border-b border-black/5 pb-2">
                  <dt className="text-ink/45">شب‌ها</dt><dd className="font-semibold text-ink">{new Intl.NumberFormat("fa-IR").format(booking.nights)} شب</dd>
                </div>
              )}
              {booking.cancellation_deadline && (
                <div className="flex justify-between gap-3 border-b border-black/5 pb-2">
                  <dt className="text-ink/45">مهلت لغو</dt><dd className="font-semibold text-ink">{date(booking.cancellation_deadline)}</dd>
                </div>
              )}
            </dl>

            <h2 className="mt-5 text-sm font-black text-ink">مسافران</h2>
            <div className="mt-2 space-y-2">
              {booking.passengers.map((passenger, index) => (
                <div key={passenger.id ?? index} className="flex items-center justify-between rounded-xl bg-black/[0.025] px-3 py-2 text-xs">
                  <span className="flex items-center gap-2 font-semibold text-ink"><Users className="h-3.5 w-3.5 text-brand-700" /> {passenger.first_name} {passenger.last_name}</span>
                  {passenger.seat_number && <Badge tone="slate">صندلی {passenger.seat_number}</Badge>}
                </div>
              ))}
              {booking.passengers.length === 0 && <div className="text-xs text-ink/40">مسافری ثبت نشده است.</div>}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-black text-ink">صورتحساب</h2>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between"><dt className="text-ink/45">زیرمجموع</dt><dd>{toman(booking.subtotal)}</dd></div>
              {booking.discount > 0 && (
                <div className="flex justify-between text-emerald-600"><dt>تخفیف {booking.coupon_code ? `(${booking.coupon_code})` : ""}</dt><dd>− {toman(booking.discount)}</dd></div>
              )}
              <div className="flex justify-between border-t border-black/5 pt-2 text-sm font-black text-ink"><dt>مبلغ نهایی</dt><dd>{toman(booking.total)}</dd></div>
              {booking.payment && (
                <div className="mt-2 rounded-2xl bg-black/[0.025] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-ink/45">وضعیت پرداخت</span>
                    <Badge tone={booking.payment.status === "paid" ? "emerald" : booking.payment.status === "refunded" ? "slate" : "amber"}>
                      {booking.payment.status === "paid" ? "پرداخت شده" : booking.payment.status === "refunded" ? "بازگشت وجه" : "در انتظار پرداخت"}
                    </Badge>
                  </div>
                  <div className="mt-1 text-[10px] text-ink/40">کد پیگیری: {booking.payment.reference}</div>
                </div>
              )}
            </dl>

            <div className="mt-5 grid gap-2">
              {booking.status === "pending" && (
                <button type="button" onClick={pay} disabled={busy} className="btn-primary w-full">
                  <CreditCard className="h-4 w-4" /> پرداخت {toman(booking.total)}
                </button>
              )}
              {booking.status === "confirmed" && (
                <button type="button" onClick={complete} disabled={busy} className="btn-secondary w-full">
                  <CheckCircle2 className="h-4 w-4" /> ثبت پایان سفر
                </button>
              )}
              {booking.can_cancel && (
                <button type="button" onClick={cancel} disabled={busy} className="btn w-full border border-rose-200 bg-white !text-rose-600 hover:bg-rose-50">
                  <XCircle className="h-4 w-4" /> لغو رزرو
                </button>
              )}
              <Link href="/support" className="btn-ghost w-full !py-2.5 !text-xs">نیاز به پشتیبانی دارم</Link>
            </div>
          </div>
        </div>
      </div>

      {ticketQuery.data && (
        <div className="card mt-5 overflow-hidden">
          <div className="flex items-center justify-between border-b border-black/5 px-5 py-3">
            <h2 className="flex items-center gap-2 text-sm font-black text-ink"><Ticket className="h-4 w-4 text-brand-700" /> بلیت الکترونیک</h2>
            <div className="flex gap-1">
              <button type="button" onClick={() => window.print()} className="btn-ghost !px-3 !py-2 !text-xs" aria-label="چاپ">
                <Printer className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="mx-auto rounded-2xl border border-black/5 bg-white p-3">
              <QRCodeSVG value={ticketQuery.data.qr_data} size={132} level="M" />
            </div>
            <div className="text-xs">
              <div className="font-mono text-base font-black tracking-widest text-ink">{ticketQuery.data.code}</div>
              <div className="mt-2 text-ink/50">{ticketQuery.data.title}</div>
              <div className="mt-3 grid gap-1 text-[11px] text-ink/45">
                {ticketQuery.data.travel_date && <div className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {date(ticketQuery.data.travel_date)}</div>}
                {ticketQuery.data.passengers.map((passenger) => (
                  <div key={passenger.name}>مسافر: {passenger.name}</div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-1 text-[10px] text-emerald-600">
                <Download className="h-3 w-3" /> این بلیت را هنگام سفر همراه داشته باشید.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BookingDetailPage() {
  return (
    <RequireAuth>
      <BookingDetailContent />
    </RequireAuth>
  );
}
