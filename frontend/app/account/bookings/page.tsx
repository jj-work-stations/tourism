"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, Plane, Ticket, Users } from "lucide-react";

import { AccountShell } from "@/components/account-shell";
import { RequireAuth } from "@/components/require-auth";
import { Badge, EmptyState, LoadingCards, SmartImage } from "@/components/ui";
import { useApiQuery } from "@/lib/hooks";
import { bookingStatus, bookingType, date, toman } from "@/lib/format";
import type { Booking, Page } from "@/lib/types";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "", label: "همه" },
  { id: "pending", label: "در انتظار پرداخت" },
  { id: "confirmed", label: "تأیید شده" },
  { id: "completed", label: "تکمیل شده" },
  { id: "cancelled", label: "لغو شده" },
];

function BookingsContent() {
  const [status, setStatus] = useState("");
  const bookings = useApiQuery<Page<Booking>>(["account", "bookings", status], "/bookings", {
    status: status || undefined,
    page_size: 50,
  });

  return (
    <AccountShell
      title="رزروها و بلیت‌ها"
      description="همه رزروهای حمل‌ونقل، اقامتگاه و تجربه‌های خود را مدیریت کنید."
      action={<Link href="/search" className="btn-primary !py-2.5 !text-xs"><Plane className="h-4 w-4" /> رزرو جدید</Link>}
    >
      <div className="mb-4 flex flex-wrap gap-1 rounded-2xl bg-black/[0.035] p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatus(tab.id)}
            className={cn(
              "rounded-xl px-3.5 py-2 text-xs font-bold transition",
              status === tab.id ? "bg-white text-brand-800 shadow-sm" : "text-ink/50 hover:text-ink",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {bookings.isLoading ? (
        <LoadingCards count={3} />
      ) : bookings.data && bookings.data.items.length > 0 ? (
        <div className="space-y-3">
          {bookings.data.items.map((booking) => {
            const state = bookingStatus[booking.status] ?? { label: booking.status, tone: "slate" };
            return (
              <Link key={booking.id} href={`/bookings/${booking.id}`} className="card block overflow-hidden transition hover:shadow-soft">
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <SmartImage src={booking.image_url} alt={booking.title} className="h-24 w-full rounded-2xl sm:h-20 sm:w-24" fallbackClassName="h-24 w-full rounded-2xl sm:h-20 sm:w-24" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={state.tone}>{state.label}</Badge>
                      <Badge tone="slate">{bookingType[booking.booking_type] ?? booking.booking_type}</Badge>
                      <span className="font-mono text-[10px] text-ink/35">{booking.code}</span>
                    </div>
                    <h3 className="mt-1.5 truncate text-sm font-extrabold text-ink">{booking.title}</h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-ink/45">
                      <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {date(booking.travel_date || booking.check_in || booking.created_at)}</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {new Intl.NumberFormat("fa-IR").format(booking.guests)} مسافر</span>
                      {booking.nights > 0 && <span>{new Intl.NumberFormat("fa-IR").format(booking.nights)} شب</span>}
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="text-base font-black text-brand-800">{toman(booking.total)}</div>
                    <div className="mt-1 text-[10px] text-ink/40">
                      {booking.status === "pending" ? "برای پرداخت کلیک کنید" : "مشاهده جزئیات"}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Ticket className="h-6 w-6" />}
          title={status ? "رزروی در این وضعیت نیست" : "هنوز رزروی ندارید"}
          description="از صفحه جستجو بلیت یا اقامتگاه مناسب را پیدا کنید."
          action={<Link href="/search" className="btn-primary mt-2">جستجوی سفر</Link>}
        />
      )}
    </AccountShell>
  );
}

export default function BookingsPage() {
  return (
    <RequireAuth>
      <BookingsContent />
    </RequireAuth>
  );
}
