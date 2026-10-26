"use client";

import { CircleDollarSign } from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { EmptyState, Spinner } from "@/components/ui";
import { date, number, toman } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks";

interface FinancialData {
  rows: { id: string; code: string; title: string; date: string; total: number; commission: number; net: number }[];
  totals: { revenue: number; commission: number; net: number; count: number };
}

export default function ProviderFinancialPage() {
  const financial = useApiQuery<FinancialData>(["provider", "financial"], "/provider/financial");

  if (financial.isLoading) {
    return (
      <DashboardShell portal="provider" title="گزارش مالی">
        <div className="dash-card grid place-items-center py-16"><Spinner className="h-7 w-7" /></div>
      </DashboardShell>
    );
  }

  const data = financial.data;

  return (
    <DashboardShell
      portal="provider"
      title="گزارش مالی"
      subtitle="سهم خالص شما پس از کسر کمیسیون پلتفرم، به تفکیک هر رزرو تأییدشده."
    >
      {!data || data.rows.length === 0 ? (
        <EmptyState icon={<CircleDollarSign className="h-6 w-6" />} title="درآمدی برای نمایش نیست" description="پس از تکمیل نخستین رزروها، گزارش مالی این‌جا ساخته می‌شود." />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="kpi"><div className="text-xs text-ink/45">درآمد ناخالص</div><div className="mt-2 text-xl font-black text-ink">{toman(data.totals.revenue, true)}</div></div>
            <div className="kpi"><div className="text-xs text-ink/45">کمیسیون پلتفرم</div><div className="mt-2 text-xl font-black text-terracotta-500">{toman(data.totals.commission, true)}</div></div>
            <div className="kpi !border-gold-500/25 !bg-gradient-to-br !from-gold-50 !to-white"><div className="text-xs text-ink/45">سهم خالص</div><div className="mt-2 text-xl font-black text-gold-600">{toman(data.totals.net, true)}</div></div>
            <div className="kpi"><div className="text-xs text-ink/45">تعداد رزرو</div><div className="mt-2 text-xl font-black text-ink">{number(data.totals.count)}</div></div>
          </div>

          <div className="dash-card overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>کد رزرو</th>
                  <th>عنوان</th>
                  <th>تاریخ</th>
                  <th>مبلغ کل</th>
                  <th>کمیسیون</th>
                  <th>سهم شما</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="font-mono text-[10.5px] text-ink/50">{row.code}</td>
                    <td className="font-bold text-ink">{row.title}</td>
                    <td className="text-ink/45 text-[10.5px]">{date(row.date)}</td>
                    <td className="font-bold text-ink/70">{toman(row.total, true)}</td>
                    <td className="text-rose-500 font-bold">{toman(row.commission, true)}</td>
                    <td className="font-black text-emerald-600">{toman(row.net, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
