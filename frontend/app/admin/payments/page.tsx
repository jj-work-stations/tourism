"use client";

import { useState } from "react";
import { CircleDollarSign } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { EmptyState, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { date, number, toman } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks";
import { cn } from "@/lib/utils";

interface AdminPayment {
  id: string;
  reference: string;
  booking_id: string;
  booking_code: string | null;
  amount: number;
  currency: string;
  method: string;
  status: string;
  gateway: string;
  refunded_amount: number;
  paid_at: string | null;
  created_at: string;
}

const STATUS_META: Record<string, { label: string; tone: string }> = {
  pending: { label: "در انتظار", tone: "bg-amber-50 text-amber-700" },
  paid: { label: "پرداخت موفق", tone: "bg-emerald-50 text-emerald-700" },
  failed: { label: "ناموفق", tone: "bg-rose-50 text-rose-700" },
  refunded: { label: "بازگشت کامل وجه", tone: "bg-slate-100 text-slate-600" },
  partially_refunded: { label: "بازگشت جزئی", tone: "bg-sky-50 text-sky-700" },
};

const METHOD_LABEL: Record<string, string> = {
  wallet: "کیف پول",
  online: "پرداخت آنلاین",
  card: "کارت",
  sandbox: "درگاه آزمایشی",
};

export default function AdminPaymentsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const payments = useApiQuery<{ items: AdminPayment[]; total: number; total_items?: number; has_next?: boolean }>(
    ["admin", "payments", status, page],
    "/admin/payments",
    { status: status || undefined, page, page_size: 20 },
  );

  async function refundPayment(item: AdminPayment) {
    const remaining = item.amount - item.refunded_amount;
    const value = window.prompt("مبلغ بازگشت وجه به تومان:", String(remaining));
    if (value === null || !Number(value)) return;
    setBusyId(item.id);
    try {
      await api.post(`/admin/bookings/${item.booking_id}/refund`, { amount: Number(value) }, true);
      toast.success("بازگشت وجه ثبت شد.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "payments"] });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "عملیات انجام نشد.");
    } finally {
      setBusyId(null);
    }
  }

  const items = payments.data?.items ?? [];
  const total = payments.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 20));

  return (
    <DashboardShell
      portal="admin"
      title="پرداخت‌ها و بازگشت وجه"
      subtitle="پیگیری تراکنش‌های درگاه پرداخت و انجام بازگشت وجوه."
    >
      <div className="dash-card mb-4 flex flex-wrap items-center gap-2 p-3">
        {[
          { value: "", label: "همه" },
          { value: "paid", label: "موفق" },
          { value: "pending", label: "در انتظار" },
          { value: "failed", label: "ناموفق" },
          { value: "refunded", label: "بازگشتی" },
        ].map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => { setStatus(chip.value); setPage(1); }}
            className={cn(
              "rounded-xl border px-3 py-1.5 text-[11px] font-bold transition",
              status === chip.value
                ? "border-brand-700 bg-brand-700 text-white"
                : "border-black/[0.07] bg-white text-ink/55 hover:text-ink",
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="dash-card overflow-x-auto">
        {payments.isLoading ? (
          <div className="grid place-items-center py-16"><Spinner className="h-7 w-7" /></div>
        ) : items.length === 0 ? (
          <EmptyState icon={<CircleDollarSign className="h-6 w-6" />} title="پرداختی ثبت نشده است" />
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>مرجع تراکنش</th>
                  <th>رزرو</th>
                  <th>مبلغ</th>
                  <th>روش</th>
                  <th>درگاه</th>
                  <th>وضعیت</th>
                  <th>تاریخ</th>
                  <th className="text-left">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {items.map((payment) => {
                  const meta = STATUS_META[payment.status] ?? { label: payment.status, tone: "bg-slate-100 text-slate-600" };
                  const refundable = payment.status === "paid" || payment.status === "partially_refunded";
                  return (
                    <tr key={payment.id}>
                      <td className="font-mono text-[10px] text-ink/50">{payment.reference}</td>
                      <td className="font-mono text-[10px] font-bold text-ink">{payment.booking_code ?? "—"}</td>
                      <td className="font-black text-brand-800">
                        {toman(payment.amount, true)}
                        {payment.refunded_amount > 0 && (
                          <div className="text-[9px] font-normal text-rose-500">بازگشتی: {toman(payment.refunded_amount, true)}</div>
                        )}
                      </td>
                      <td className="text-ink/55">{METHOD_LABEL[payment.method] || payment.method}</td>
                      <td className="text-[10px] text-ink/40">{payment.gateway}</td>
                      <td><span className={cn("rounded-lg px-2 py-1 text-[9.5px] font-bold", meta.tone)}>{meta.label}</span></td>
                      <td className="text-[10.5px] text-ink/45">{date(payment.paid_at || payment.created_at)}</td>
                      <td>
                        <div className="flex justify-end">
                          {refundable && (
                            <button type="button" disabled={busyId === payment.id} onClick={() => refundPayment(payment)} className="btn-xs-soft">
                              بازگشت وجه
                            </button>
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
    </DashboardShell>
  );
}
