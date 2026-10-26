"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileClock,
  History,
  RotateCcw,
} from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { Badge, EmptyState, Spinner } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { number, relative } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks";
import type { Page } from "@/lib/types";

interface AuditLogRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  user_id?: string | null;
  data: Record<string, unknown>;
  created_at: string;
}

const ACTION_LABEL: Record<string, string> = {
  "booking.status_change": "تغییر وضعیت رزرو",
  "booking.refund": "بازگشت وجه",
  "content.upsert": "به‌روزرسانی محتوا",
  "review.moderation": "بررسی نظر",
  "review.delete": "حذف نظر",
  "provider.update": "به‌روزرسانی ارائه‌دهنده",
  "user.update": "ویرایش کاربر",
  "settings.update": "تغییر تنظیمات",
  "campaign.upsert": "به‌روزرسانی کمپین",
  "coupon.upsert": "به‌روزرسانی کد تخفیف",
  "coupon.toggle": "فعال/غیرفعال‌سازی کد تخفیف",
  "support.update": "به‌روزرسانی تیکت",
  "notification.broadcast": "ارسال اعلان گروهی",
};

const ENTITY_LABEL: Record<string, string> = {
  booking: "رزرو",
  payment: "پرداخت",
  user: "کاربر",
  provider: "ارائه‌دهنده",
  destination: "مقصد",
  accommodation: "اقامتگاه",
  attraction: "جاذبه",
  restaurant: "رستوران",
  experience: "تجربه",
  review: "نظر",
  campaign: "کمپین",
  coupon: "کد تخفیف",
  support_ticket: "تیکت پشتیبانی",
  settings: "تنظیمات سیستم",
};

const TONE_BY_ACTION: Record<string, string> = {
  "booking.refund": "amber",
  "booking.status_change": "sky",
  "review.moderation": "violet",
  "review.delete": "rose",
  "settings.update": "rose",
  "notification.broadcast": "amber",
};

function toneFor(action: string): string {
  if (action.includes("refund")) return "amber";
  if (action.includes("delete") || action.includes("reject")) return "rose";
  if (action.includes("status")) return "sky";
  if (action.includes("content") || action.includes("campaign") || action.includes("coupon")) return "emerald";
  return "slate";
}

export default function AdminAuditPage() {
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [page, setPage] = useState(1);

  const logs = useApiQuery<Page<AuditLogRow>>(
    ["admin", "audit", action, entityType, page],
    "/admin/audit",
    {
      action: action || undefined,
      entity_type: entityType || undefined,
      page,
      page_size: 25,
    },
  );

  const rows = logs.data?.items ?? [];
  const totalPages = logs.data?.pages ?? 1;

  return (
    <DashboardShell
      portal="admin"
      title="لاگ فعالیت‌ها"
      subtitle="تمام تغییرات حساس سیستم — از تغییر وضعیت رزرو تا ویرایش محتوا — با ثبت کامل کاربر و زمان."
    >
      <div className="space-y-5">
        {/* Filters */}
        <div className="dash-card flex flex-wrap items-center gap-3 p-4">
          <div className="flex items-center gap-2 text-xs font-black text-ink">
            <History className="h-4 w-4 text-brand-700" /> فیلتر رویدادها
          </div>
          <select
            className="field-sm !w-52"
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              setPage(1);
            }}
          >
            <option value="">همه عملیات</option>
            {Object.entries(ACTION_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select
            className="field-sm !w-44"
            value={entityType}
            onChange={(event) => {
              setEntityType(event.target.value);
              setPage(1);
            }}
          >
            <option value="">همه موجودیت‌ها</option>
            {Object.entries(ENTITY_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          {(action || entityType) && (
            <button
              type="button"
              onClick={() => {
                setAction("");
                setEntityType("");
                setPage(1);
              }}
              className="btn-xs-soft"
            >
              <RotateCcw className="h-3 w-3" /> پاک کردن
            </button>
          )}
          <span className="mr-auto flex items-center gap-1.5 text-[11px] text-ink/40">
            {logs.isFetching ? <Spinner className="h-3.5 w-3.5" /> : null}
            {number(logs.data?.total ?? 0)} رویداد
          </span>
        </div>

        {logs.isLoading ? (
          <div className="dash-card grid min-h-[30vh] place-items-center">
            <Spinner className="h-8 w-8" />
          </div>
        ) : logs.error ? (
          <EmptyState
            icon={<ClipboardList className="h-6 w-6" />}
            title="بارگذاری لاگ‌ها انجام نشد"
            description={logs.error instanceof ApiError ? logs.error.message : "دسترسی یا اتصال را بررسی کنید."}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<FileClock className="h-6 w-6" />}
            title="رویدادی ثبت نشده است"
            description="با انجام عملیات مدیریتی (تغییر وضعیت، بازگشت وجه، ویرایش محتوا) لاگ‌ها اینجا نمایش داده می‌شوند."
          />
        ) : (
          <div className="dash-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>زمان</th>
                    <th>عملیات</th>
                    <th>موجودیت</th>
                    <th>شناسه</th>
                    <th>جزئیات</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="whitespace-nowrap text-ink/50">{relative(row.created_at)}</td>
                      <td>
                        <Badge tone={TONE_BY_ACTION[row.action] ?? toneFor(row.action)} className="!text-[10px]">
                          {ACTION_LABEL[row.action] ?? row.action}
                        </Badge>
                      </td>
                      <td className="text-ink/70">{ENTITY_LABEL[row.entity_type] ?? row.entity_type}</td>
                      <td>
                        <span className="font-mono text-[10px] text-ink/40">
                          {row.entity_id ? `${row.entity_id.slice(0, 8)}…` : "—"}
                        </span>
                      </td>
                      <td className="max-w-[340px]">
                        <span className="line-clamp-1 text-[11px] text-ink/50" dir="ltr">
                          {Object.keys(row.data ?? {}).length
                            ? JSON.stringify(row.data).slice(0, 90)
                            : "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-black/[0.06] px-5 py-3">
                <span className="text-[11px] text-ink/45">
                  صفحه {number(logs.data?.page ?? 1)} از {number(totalPages)}
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="btn-xs-soft"
                  >
                    <ChevronRight className="h-3.5 w-3.5" /> قبلی
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="btn-xs-soft"
                  >
                    بعدی <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
