"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquarePlus, Star, ThumbsUp } from "lucide-react";
import { toast } from "sonner";

import { Avatar } from "@/components/mini-cards";
import { EmptyState, Rating } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { relative } from "@/lib/format";
import type { Page, Review } from "@/lib/types";

export function ReviewSection({
  entityType,
  entityId,
  initial,
}: {
  entityType: string;
  entityId: string;
  initial: Review[];
}) {
  const user = useAuth((state) => state.user);
  const hydrated = useAuth((state) => state.hydrated);
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);

  const { data } = useQuery({
    queryKey: ["reviews", entityType, entityId],
    queryFn: () =>
      api.get<Page<Review>>("/reviews", {
        entity_type: entityType,
        entity_id: entityId,
        limit: 20,
      }),
    initialData: { items: initial, total: initial.length, page: 1, page_size: 20, pages: 1 },
  });

  const reviews = data?.items ?? [];
  const average = reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) {
      toast.error("متن نظر را بنویسید.");
      return;
    }
    setLoading(true);
    try {
      await api.post(
        "/reviews",
        { entity_type: entityType, entity_id: entityId, rating, body },
        true,
      );
      setBody("");
      setRating(5);
      toast.success("نظر شما ثبت شد. ۱۰ امتیاز تجربه گرفتید!");
      await queryClient.invalidateQueries({ queryKey: ["reviews", entityType, entityId] });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "ثبت نظر انجام نشد.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <div className="space-y-4">
        <div className="card p-6 text-center">
          <div className="text-4xl font-black text-ink">{average ? average.toFixed(1) : "—"}</div>
          <div className="mt-2 flex justify-center">
            <Rating value={average} />
          </div>
          <div className="mt-1 text-xs text-ink/45">
            از {new Intl.NumberFormat("fa-IR").format(data?.total ?? 0)} نظر مسافران
          </div>
          <div className="mt-5 space-y-2">
            {[5, 4, 3, 2, 1].map((score) => {
              const count = reviews.filter((review) => review.rating === score).length;
              const width = reviews.length ? (count / reviews.length) * 100 : 0;
              return (
                <div key={score} className="flex items-center gap-2 text-[11px] text-ink/45">
                  <span className="flex w-6 items-center gap-0.5">{new Intl.NumberFormat("fa-IR").format(score)} <Star className="h-3 w-3 fill-amber-400 text-amber-400" /></span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.05]">
                    <span className="block h-full rounded-full bg-amber-400" style={{ width: `${width}%` }} />
                  </span>
                  <span className="w-5 text-left">{new Intl.NumberFormat("fa-IR").format(count)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {hydrated && user ? (
          <form onSubmit={submit} className="card p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-ink">
              <MessageSquarePlus className="h-4 w-4 text-brand-700" /> تجربه‌ات را بنویس
            </div>
            <div className="mt-3 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((score) => (
                <button key={score} type="button" onClick={() => setRating(score)} aria-label={`${score} ستاره`}>
                  <Star className={`h-6 w-6 transition ${score <= rating ? "fill-amber-400 text-amber-400" : "text-black/15"}`} />
                </button>
              ))}
            </div>
            <textarea
              className="input mt-3 min-h-24 resize-none"
              placeholder="از چه چیزی لذت بردی؟ چه نکته‌ای برای مسافران بعدی مفید است؟"
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
            <button type="submit" disabled={loading} className="btn-primary mt-3 w-full !py-2.5 !text-xs">
              {loading ? "در حال ثبت..." : "ثبت نظر"}
            </button>
          </form>
        ) : (
          <div className="card p-5 text-center text-xs leading-6 text-ink/50">
            برای ثبت نظر ابتدا{" "}
            <Link href="/login" className="font-bold text-brand-800 hover:underline">وارد حساب</Link>{" "}
            شوید.
          </div>
        )}
      </div>

      <div className="space-y-3">
        {reviews.length ? (
          reviews.map((review) => (
            <article key={review.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar name={review.user.full_name} src={review.user.avatar_url} />
                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold text-ink">
                      {review.user.full_name}
                      {review.is_verified && <span className="chip bg-brand-50 text-[10px] text-brand-800">خرید تأییدشده</span>}
                    </div>
                    <div className="mt-0.5 text-[10px] text-ink/40">{relative(review.created_at)}</div>
                  </div>
                </div>
                <Rating value={review.rating} size="sm" />
              </div>
              {review.title && <h4 className="mt-3 font-bold text-ink">{review.title}</h4>}
              <p className="mt-2 text-sm leading-7 text-ink/60">{review.body}</p>
              {review.response && (
                <div className="mt-3 rounded-2xl bg-brand-50/60 p-3 text-xs leading-6 text-brand-900">
                  <b>پاسخ سیر:</b> {review.response}
                </div>
              )}
              <div className="mt-3 flex items-center gap-3 border-t border-black/5 pt-3 text-[11px] text-ink/40">
                <button type="button" className="flex items-center gap-1 rounded-lg px-2 py-1 transition hover:bg-black/[0.04]">
                  <ThumbsUp className="h-3.5 w-3.5" /> مفید بود ({new Intl.NumberFormat("fa-IR").format(review.helpful_count)})
                </button>
              </div>
            </article>
          ))
        ) : (
          <EmptyState
            icon={<MessageSquarePlus className="h-6 w-6" />}
            title="هنوز نظری ثبت نشده"
            description="اولین مسافری باش که تجربه‌اش را با بقیه به اشتراک می‌گذارد."
          />
        )}
      </div>
    </div>
  );
}
