"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarRange } from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { Badge, EmptyState, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { bookingStatus, date, number, time, toman } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks";
import type { Booking, Page } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const FILTERS = [
  { value: "", label: "همه" },
  { value: "pending", label: "در انتظار" },
  { value: "confirmed", label: "تأیید شده" },
  { value: "completed", label: "تکمیل شده" },
  { value: "cancelled", label: "لغو شده" },
];

export default function ProviderBookingsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);

  const bookings = useApiQuery<Page<Booking>>(
    ["provider", "bookings", status, page],
    "/provider/bookings",
    { status: status || undefined, page, page_size: 20 },
  );

  async function setStatusAction(id: string, value: string) {
    setBusyId(id);
    try {
      await api.patch(`/provider/bookings/${id}`, { status: value }, true);
      toast.success("وضعیت رزرو به‌روزرسانی شد.");
      await queryClient.invalidateQueries({ queryKey: ["provider", "bookings"] });
      await queryClient.invalidateQueries({ queryKey: ["provider", "dashboard"] });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "عملیات انجام نشد.");
    } finally {
      setBusyId(null);
    }
  }

  const items = bookings.data?.items ?? [];
  const total = bookings.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 20));

  return (
    <DashboardShell
      portal="provider"
      title="رزروهای من"
      subtitle="مدیریت رزروهای خدمات شما: تأیید، تکمیل و لغو درخواست مسافران."
    >
      <div className="space-y-4">
        <div className="dash-card flex flex-wrap gap-2 p-3">
          {FILTERS.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => { setStatus(chip.value); setPage(1); }}
              className={cn(
                "rounded-xl border px-3 py-1.5 text-[11px] font-bold transition",
                status === chip.value ? "border-brand-700 bg-brand-700 text-white" : "border-black/[0.07] bg-white text-ink/55 hover:text-ink",
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="dash-card overflow-x-auto">
          {bookings.isLoading ? (
            <div className="grid place-items-center py-16"><Spinner className="h-7 w-7" /></div>
          ) : items.length === 0 ? (
            <EmptyState icon={<CalendarRange className="h-6 w-6" />} title="رزروی ثبت نشده است" description="به‌محض ثبت رزرو توسط مسافران، همین‌جا نمایش داده می‌شود." />
          ) : (
            <>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>کد</th>
                    <th>خدمت</th>
                    <th>مسافران</th>
                    <th>تاریخ</th>
                    <th>مبلغ کل</th>
                    <th>وضعیت</th>
                    <th className="text-left">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((booking) => {
                    const meta = bookingStatus[booking.status] ?? { label: booking.status, tone: "slate" };
                    return (
                      <tr key={booking.id}>
                        <td className="font-mono text-[10.5px] text-ink/50">{booking.code}</td>
                        <td className="max-w-[220px] truncate font-bold text-ink">{booking.title}</td>
                        <td>{number(booking.passengers?.length ?? booking.guests ?? 0)} نفر</td>
                        <td className="text-[10.5px] text-ink/55">
                          {date(booking.travel_date || booking.check_in || booking.created_at)}
                          {booking.check_out && <div className="text-[9.5px] text-ink/35">تا {date(booking.check_out)}</div>}
                        </td>
                        <td className="font-black text-brand-800">{toman(booking.total, true)}</td>
                        <td><Badge tone={meta.tone} className="!py-0 !text-[9.5px]">{meta.label}</Badge></td>
                        <td>
                          <div className="flex justify-end gap-1.5">
                            {booking.status === "pending" && (
                              <>
                                <button type="button" disabled={busyId === booking.id} onClick={() => setStatusAction(booking.id, "confirmed")} className="btn-xs-primary">تأیید</button>
                                <button type="button" disabled={busyId === booking.id} onClick={() => setStatusAction(booking.id, "cancelled")} className="btn-xs-danger">رد</button>
                              </>
                            )}
                            {booking.status === "confirmed" && (
                              <button type="button" disabled={busyId === booking.id} onClick={() => setStatusAction(booking.id, "completed")} className="btn-xs-soft">تکمیل سرویس</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {pages > 1 && (
                <div className="flex items-center justify-between border-t border-black/[0.05] px-5 py-3 text-[11px] text-ink/50">
                  <button type="button" className="btn-xs-soft" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>صفحه قبل</button>
                  <span className="font-bold text-ink">{number(page)} از {number(pages)}</span>
                  <button type="button" className="btn-xs-soft" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>صفحه بعد</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
