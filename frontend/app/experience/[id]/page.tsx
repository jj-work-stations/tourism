import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  Clock3,
  Globe2,
  MapPin,
  Sparkles,
  Users,
} from "lucide-react";

import { ExperienceBookingWidget } from "@/components/experience-booking";
import { ReviewSection } from "@/components/review-section";
import { Badge, Rating, SmartImage } from "@/components/ui";
import { serverFetch } from "@/lib/api";
import { duration, toman } from "@/lib/format";
import type { Experience, Page, Review } from "@/lib/types";
import { destinationName } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const experience = await serverFetch<Experience>(`/experiences/${id}`);
  if (!experience) return { title: "تجربه یافت نشد" };
  return {
    title: `${experience.name} | تجربه محلی`,
    description: experience.description,
    openGraph: {
      title: experience.name,
      images: experience.image_url ? [{ url: experience.image_url }] : [],
    },
  };
}

export default async function ExperiencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const experience = await serverFetch<Experience>(`/experiences/${id}`);
  if (!experience) notFound();

  const reviews = await serverFetch<Page<Review>>("/reviews", {
    entity_type: "experience",
    entity_id: experience.id,
    page_size: 20,
  });

  return (
    <>
      <section className="container-app pt-6">
        <div className="relative overflow-hidden rounded-[2rem]">
          <SmartImage
            src={experience.image_url}
            alt={experience.name}
            className="h-72 w-full sm:h-[420px]"
            fallbackClassName="h-72 w-full sm:h-[420px]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-9">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand" className="bg-brand-500">{experience.category}</Badge>
              {experience.is_featured && <Badge tone="sand" className="bg-white/20 text-white">منتخب سیر</Badge>}
              <span className="inline-flex items-center gap-1 rounded-full bg-black/30 px-2.5 py-1 text-[11px] backdrop-blur">
                <MapPin className="h-3 w-3" /> {experience.destination_name ? destinationName({ name: experience.destination_name }) : "ایران"}
              </span>
            </div>
            <h1 className="mt-3 text-3xl font-black sm:text-4xl">{experience.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-white/75">
              <span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {duration(experience.duration_minutes)}</span>
              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> حداکثر {new Intl.NumberFormat("fa-IR").format(experience.max_participants)} نفر</span>
              <span className="flex items-center gap-1"><StarIcon /> {experience.rating.toFixed(1)} ({new Intl.NumberFormat("fa-IR").format(experience.review_count)} نظر)</span>
            </div>
          </div>
        </div>
      </section>

      <section className="container-app grid gap-8 py-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <p className="text-sm leading-8 text-ink/65">{experience.description}</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-black/5 bg-white p-4">
              <MapPin className="h-4 w-4 text-brand-700" />
              <div className="mt-2 text-[10px] text-ink/40">نقطه شروع</div>
              <div className="mt-1 text-xs font-bold text-ink">{experience.meeting_point || "مرکز شهر"}</div>
            </div>
            <div className="rounded-2xl border border-black/5 bg-white p-4">
              <Globe2 className="h-4 w-4 text-brand-700" />
              <div className="mt-2 text-[10px] text-ink/40">زبان راهنما</div>
              <div className="mt-1 text-xs font-bold text-ink">{experience.languages.join("، ") || "فارسی"}</div>
            </div>
            <div className="rounded-2xl border border-black/5 bg-white p-4">
              <BadgeCheck className="h-4 w-4 text-brand-700" />
              <div className="mt-2 text-[10px] text-ink/40">راهنمای محلی</div>
              <div className="mt-1 text-xs font-bold text-ink">{experience.guide_name || "راهنمای سیر"}</div>
            </div>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div>
              <h2 className="flex items-center gap-2 font-black text-ink"><Sparkles className="h-4 w-4 text-brand-700" /> این تجربه شامل</h2>
              <ul className="mt-3 space-y-2">
                {experience.includes.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs leading-6 text-ink/60">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                    {item}
                  </li>
                ))}
                {experience.includes.length === 0 && <li className="text-xs text-ink/45">جزئیات متعاقباً اعلام می‌شود.</li>}
              </ul>
            </div>
            <div>
              <h2 className="font-black text-ink">قبل از رزرو بدانید</h2>
              <ul className="mt-3 space-y-2 text-xs leading-6 text-ink/55">
                <li>• لطفاً ۱۵ دقیقه قبل از شروع در نقطه قرار حاضر باشید.</li>
                <li>• لباس و کفش راحت بپوشید.</li>
                <li>• در صورت لغو تا ۲۴ ساعت قبل، مبلغ کامل بازگردانده می‌شود.</li>
              </ul>
            </div>
          </div>

          {experience.gallery.length > 0 && (
            <div className="mt-8 grid gap-2 sm:grid-cols-3">
              {experience.gallery.slice(0, 3).map((image) => (
                <SmartImage key={image} src={image} alt={experience.name} className="h-40 w-full rounded-2xl" fallbackClassName="h-40 w-full rounded-2xl" />
              ))}
            </div>
          )}

          <div className="mt-10">
            <h2 className="mb-4 text-lg font-black text-ink">نظر مسافران</h2>
            <ReviewSection entityType="experience" entityId={experience.id} initial={reviews?.items ?? []} />
          </div>
        </div>

        <aside className="h-fit space-y-4 lg:sticky lg:top-24">
          <ExperienceBookingWidget
            experienceId={experience.id}
            price={experience.price}
            maxParticipants={experience.max_participants}
          />
          <div className="rounded-3xl bg-brand-900 p-5 text-white">
            <div className="text-xs font-bold text-sand-200">تجربه را به برنامه سفر اضافه کن</div>
            <p className="mt-2 text-[11px] leading-6 text-white/55">
              دستیار سیر این تجربه را در بهترین روز سفرت قرار می‌دهد.
            </p>
            <Link href="/assistant" className="btn mt-3 w-full bg-white !py-2.5 !text-xs !text-brand-900">
              ساخت برنامه هوشمند
            </Link>
          </div>
          <div className="card p-4 text-xs text-ink/50">
            <div className="flex justify-between border-b border-black/5 pb-2">
              <span>قیمت هر نفر</span>
              <b className="text-ink">{toman(experience.price)}</b>
            </div>
            <div className="mt-2 flex justify-between">
              <span>مدت</span>
              <b className="text-ink">{duration(experience.duration_minutes)}</b>
            </div>
          </div>
        </aside>
      </section>
    </>
  );
}

function StarIcon() {
  return <span className="text-amber-400">★</span>;
}
