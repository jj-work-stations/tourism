"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CircleDollarSign, RefreshCw, Search, Ticket } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { Badge, EmptyState, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { bookingStatus, bookingType, date, number, time, toman } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks";
import type { Booking, Page } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_FILTERS = [
  { value: "", label: "همه" },
  { value: "pending", label: "در انتظار" },
  { value: "confirmed", label: "تأیید شده" },
  { value: "cancelled", label: "لغو شده" },
  { value: "completed", label: "تکمیل شده" },
  { value: "refunded", label: "بازگشت وجه" },
];

const STATUS_CHIPS: Record<string, string> = {
  pending: "bg-amber-50 text-amber-300 border-amber-200/60",
  confirmed: "bg-emerald-50 text-emerald-300 border-emerald-200/60",
  cancelled: "bg-rose-50 text-rose-300 border-rose-200/60",
  completed: "bg-sky-50 text-sky-300 border-sky-200/60",
  refunded: "bg-slate-50 text-slate-300 border-slate-200/60",
};

const STATUS_TARGET = bookingStatus;

export default function AdminBookingsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);

  const bookings = useApiQuery<Page<Booking>>(
    ["admin", "bookings", status, search, page],
    "/admin/bookings",
    { status: status || undefined, q: search || undefined, page, page_size: 20 },
  );

  async function changeStatus(id: string, newStatus: string) {
    setBusyId(id);
    try {
      await api.patch(`/admin/bookings/${id}/status`, { status: newStatus }, true);
      toast.success("وضعیت رزرو تغییر کرد.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "bookings"] });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "عملیات انجام نشد.");
    } finally {
      setBusyId(null);
    }
  }

  async function refund(id: string, amount: number) {
    const value = window.prompt("مبلغ بازگشت وجه به تومان (خالی = کل مبلغ):", amount ? String(amount) : "");
    if (value === null) return;
    setBusyId(id);
    try {
      await api.post(`/admin/bookings/${id}/refund`, { amount: value ? Number(value) : null }, true);
      toast.success("بازگشت وجه ثبت شد.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "bookings"] });
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
      portal="admin"
      title="مدیریت رزروها"
      subtitle="جستجو، تغییر وضعیت و بازگشت وجه همه رزروهای پلتفرم."
    >
      <div className="space-y-4">
        <div className="dash-card flex flex-wrap items-center gap-3 p-4">
          <label className="relative min-w-[240px] flex-1">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />
            <input
              className="field-sm pr-9"
              placeholder="جستجوی عنوان رزرو..."
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => { setStatus(filter.value); setPage(1); }}
                className={cn(
                  "rounded-xl border px-3 py-1.5 text-[11px] font-bold transition",
                  status === filter.value
                    ? "border-brand-700 bg-brand-700 text-white"
                    : "border-black/[0.07] bg-white text-ink/55 hover:border-brand-600/30 hover:text-ink",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="dash-card overflow-x-auto">
          {bookings.isLoading ? (
            <div className="grid place-items-center py-16"><Spinner className="h-7 w-7" /></div>
          ) : items.length === 0 ? (
            <EmptyState icon={<Ticket className="h-6 w-6" />} title="رزروی پیدا نشد" description="با تغییر فیلترها دوباره تلاش کنید." />
          ) : (
            <>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>کد</th>
                    <th>عنوان</th>
                    <th>نوع</th>
                    <th>مسافر</th>
                    <th>تاریخ سفر</th>
                    <th>مبلغ</th>
                    <th>وضعیت</th>
                    <th className="text-left">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((booking) => {
                    const meta = STATUS_TARGET[booking.status] ?? { label: booking.status, tone: "slate" };
                    const canConfirm = booking.status === "pending";
                    const canRefund = ["pending", "confirmed", "cancelled"].includes(booking.status);
                    return (
                      <tr key={booking.id}>
                        <td className="font-mono text-[10.5px] text-ink/50">{booking.code}</td>
                        <td className="max-w-[220px] truncate font-bold text-ink">{booking.title}</td>
                        <td>
                          <div className="font-semibold text-ink">{bookingType[booking.booking_type] || booking.booking_type}</div>
                          <div className="text-[9.5px] text-ink/35">{number(booking.passengers?.length ?? 0)} مسافر</div>
                        </td>
                        <td className="text-[10.5px] text-ink/55">
                          {date(booking.travel_date || booking.check_in) !== "—"
                            ? date(booking.travel_date || booking.check_in)
                            : date(booking.created_at)}
                        </td>
                        <td className="font-black text-brand-800">{toman(booking.total, true)}</td>
                        <td>
                          <select
                            value={booking.status}
                            disabled={busyId === booking.id}
                            onChange={(event) => changeStatus(booking.id, event.target.value)}
                            className="rounded-lg border border-black/10 bg-white px-2 py-1 text-[10.5px] font-semibold outline-none focus:border-brand-600"
                          >
                            {["pending", "confirmed", "cancelled", "completed", "refunded"].map((value) => (
                              <option key={value} value={value}>
                                {(STATUS_TARGET[value] ?? { label: value }).label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <div className="flex justify-end gap-1.5">
                            {canConfirm && (
                              <button
                                type="button"
                                disabled={busyId === booking.id}
                                onClick={() => changeStatus(booking.id, "confirmed")}
                                className="btn-xs-primary"
                              >
                                تأیید سریع
                              </button>
                            )}
                            {canRefund && (
                              <button
                                type="button"
                                disabled={busyId === booking.id}
                                onClick={() => refund(booking.id, booking.total)}
                                className="btn-xs-soft flex items-center gap-1"
                              >
                                <CircleDollarSign className="h-3.5 w-3.5" /> بازگشت وجه
                              </button>
                            )}
                            <span className={cn("hidden rounded-lg border px-2 py-1 text-[9.5px] font-bold sm:inline", STATUS_CHIPS[booking.status] ?? "border-black/10")}>
                              {meta.label}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {pages > 1 && (
                <div className="flex items-center justify-between border-t border-black/[0.05] px-5 py-3 text-[11px] text-ink/50">
                  <button type="button" className="btn-xs-soft" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                    صفحه قبل
                  </button>
                  <span className="flex items-center gap-1.5 font-bold text-ink">
                    <RefreshCw className="h-3 w-3 text-ink/25" /> {number(page)} از {number(pages)}
                  </span>
                  <button type="button" className="btn-xs-soft" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>
                    صفحه بعد
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
