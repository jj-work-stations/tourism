"use client";

import { Star } from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { Badge, EmptyState, Spinner } from "@/components/ui";
import { date, number } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks";
import type { Page, Review } from "@/lib/types";

export default function ProviderReviewsPage() {
  const reviews = useApiQuery<Page<Review>>(["provider", "reviews"], "/provider/reviews", { page_size: 20 });

  const items = reviews.data?.items ?? [];

  return (
    <DashboardShell
      portal="provider"
      title="نظرات مهمانان"
      subtitle="بازخورد مسافران درباره خدمات شما — رضایت مهمان، بهترین تبلیغ شماست."
    >
      {reviews.isLoading ? (
        <div className="dash-card grid place-items-center py-16"><Spinner className="h-7 w-7" /></div>
      ) : items.length === 0 ? (
        <EmptyState icon={<Star className="h-6 w-6" />} title="هنوز نظری ثبت نشده است" description="پس از بازدید مهمانان، نظرات منتشرشده در این‌جا نمایش داده می‌شود." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((review) => (
            <div key={review.id} className="dash-card p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-black text-ink">{review.user?.full_name ?? "مهمان"}</div>
                <Badge tone="slate" className="!py-0 !text-[9px]">{date(review.created_at)}</Badge>
              </div>
              <div className="mt-2 flex items-center gap-1 text-[13px] text-amber-500">
                {"★".repeat(review.rating)}
                <span className="text-ink/25">{"★".repeat(5 - review.rating)}</span>
              </div>
              {review.title && <div className="mt-1 text-xs font-bold text-ink">{review.title}</div>}
              <p className="mt-1 text-xs leading-6 text-ink/60">{review.body}</p>
            </div>
          ))}
          {reviews.data?.total && reviews.data.total > items.length && (
            <div className="text-center text-[10.5px] text-ink/35 lg:col-span-2">
              {number(reviews.data.total)} نظر ثبت شده — قدیمی‌ترین‌ها در صفحات بعدی هستند.
            </div>
          )}
        </div>
      )}
    </DashboardShell>
  );
}
