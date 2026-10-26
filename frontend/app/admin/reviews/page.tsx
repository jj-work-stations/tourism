"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { Badge, EmptyState, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { date, number } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks";
import type { Page, Review } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_META: Record<string, { label: string; tone: string }> = {
  pending: { label: "در انتظار بررسی", tone: "amber" },
  published: { label: "منتشر شده", tone: "emerald" },
  rejected: { label: "رد شده", tone: "rose" },
};

const FILTERS = [
  { value: "", label: "همه" },
  { value: "pending", label: "در انتظار" },
  { value: "published", label: "منتشر شده" },
  { value: "rejected", label: "رد شده" },
];

const ENTITY_LABEL: Record<string, string> = {
  accommodation: "اقامتگاه",
  destination: "مقصد",
  experience: "تجربه",
  transport: "حمل‌ونقل",
  restaurant: "رستوران",
};

export default function AdminReviewsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reviews = useApiQuery<Page<Review>>(
    ["admin", "reviews", status, page],
    "/admin/reviews",
    { status: status || undefined, page, page_size: 15 },
  );

  async function moderate(id: string, value: string) {
    setBusyId(id);
    try {
      await api.patch(`/admin/reviews/${id}?status=${value}`, undefined, true);
      toast.success(value === "published" ? "نظر تأیید و منتشر شد." : "نظر رد شد.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "عملیات انجام نشد.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("این نظر برای همیشه حذف شود؟")) return;
    setBusyId(id);
    try {
      await api.delete(`/admin/reviews/${id}`, undefined, true);
      toast.success("نظر حذف شد.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "عملیات انجام نشد.");
    } finally {
      setBusyId(null);
    }
  }

  const items = reviews.data?.items ?? [];
  const total = reviews.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 15));

  return (
    <DashboardShell
      portal="admin"
      title="مدیریت نظرات"
      subtitle="بررسی، تأیید یا رد نظرات ثبت‌شده توسط مسافران."
    >
      <div className="dash-card mb-4 flex flex-wrap items-center gap-2 p-3">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => { setStatus(filter.value); setPage(1); }}
            className={cn(
              "rounded-xl border px-3 py-1.5 text-[11px] font-bold transition",
              status === filter.value
                ? "border-brand-700 bg-brand-700 text-white"
                : "border-black/[0.07] bg-white text-ink/55 hover:text-ink",
            )}
          >
            {filter.label}
          </button>
        ))}
        <span className="mr-auto text-[10.5px] text-ink/40">{number(total)} نظر</span>
      </div>

      {reviews.isLoading ? (
        <div className="dash-card grid place-items-center py-16"><Spinner className="h-7 w-7" /></div>
      ) : items.length === 0 ? (
        <EmptyState icon={<Star className="h-6 w-6" />} title="نظری برای بررسی وجود ندارد" />
      ) : (
        <div className="space-y-3">
          {items.map((review) => {
            const meta = STATUS_META[review.status] ?? { label: review.status, tone: "slate" };
            return (
              <div key={review.id} className="dash-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-black text-ink">
                      {review.user?.full_name ?? "کاربر"}
                      <Badge tone={meta.tone} className="!py-0.5 !text-[9.5px]">{meta.label}</Badge>
                    </div>
                    <div className="mt-0.5 text-[10px] text-ink/35">
                      {ENTITY_LABEL[review.entity_type] || review.entity_type} · {date(review.created_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {canAct(review.status) && (
                      <>
                        <button type="button" disabled={busyId === review.id} onClick={() => moderate(review.id, "published")} className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100" aria-label="تأیید"><Check className="h-4 w-4" /></button>
                        <button type="button" disabled={busyId === review.id} onClick={() => moderate(review.id, "rejected")} className="grid h-8 w-8 place-items-center rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100" aria-label="رد"><X className="h-4 w-4" /></button>
                      </>
                    )}
                    <button type="button" disabled={busyId === review.id} onClick={() => remove(review.id)} className="grid h-8 w-8 place-items-center rounded-xl bg-black/[0.04] text-ink/40 hover:bg-rose-50 hover:text-rose-600" aria-label="حذف"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1 text-[12px] text-amber-500">
                  {"★".repeat(review.rating)}
                  <span className="text-ink/25">{"★".repeat(5 - review.rating)}</span>
                </div>
                {review.title && <div className="mt-1 text-xs font-bold text-ink">{review.title}</div>}
                <p className="mt-1 text-xs leading-6 text-ink/60">{review.body}</p>
                {review.photos?.length > 0 && (
                  <div className="mt-2 flex gap-2">
                    {review.photos.slice(0, 4).map((photo) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={photo} src={photo} alt="تصویر نظر" className="h-14 w-14 rounded-xl object-cover" />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {pages > 1 && (
            <div className="flex items-center justify-between text-[11px] text-ink/50">
              <button type="button" className="btn-xs-soft" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>قبلی</button>
              <span className="font-bold text-ink">{number(page)} از {number(pages)}</span>
              <button type="button" className="btn-xs-soft" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>بعدی</button>
            </div>
          )}
        </div>
      )}
    </DashboardShell>
  );
}

function canAct(status: string) {
  return status === "pending" || status === "published" || status === "rejected";
}
