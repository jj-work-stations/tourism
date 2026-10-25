import { Compass, MapPinned, Sparkles } from "lucide-react";

import { DestinationsGrid } from "@/components/destinations-grid";
import { PageHero } from "@/components/ui";
import { serverFetch } from "@/lib/api";
import type { Destination, Page } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "مقصدهای سفر",
  description: "کاوش در شهرها و مقصدهای گردشگری ایران؛ از تهران و شیراز تا کیش و یزد.",
};

export default async function DestinationsPage() {
  const data = await serverFetch<Page<Destination>>("/destinations", { limit: 50 });
  const destinations = data?.items ?? [];

  return (
    <>
      <PageHero
        badge={
          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-[11px] font-bold text-brand-800">
            <Compass className="h-3.5 w-3.5" /> {new Intl.NumberFormat("fa-IR").format(destinations.length)} مقصد منتخب
          </span>
        }
        title="کجای ایران، دل تو را می‌برد؟"
        description="از بافت تاریخی یزد و معماری اصفهان تا ساحل کیش؛ مقصد بعدی‌ات را پیدا کن و برنامه سفرت را با سیر بچین."
      >
        <div className="flex flex-wrap gap-2 text-[11px] text-ink/50">
          <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-2 shadow-sm">
            <MapPinned className="h-3.5 w-3.5 text-brand-700" /> {new Intl.NumberFormat("fa-IR").format(destinations.length)} شهر و جزیره
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-2 shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-sand-500" /> پیشنهاد شخصی‌سازی‌شده
          </span>
        </div>
      </PageHero>

      <section className="container-app py-10">
        {destinations.length ? (
          <DestinationsGrid destinations={destinations} />
        ) : (
          <div className="card p-10 text-center text-sm text-ink/50">
            در حال حاضر داده‌ای برای نمایش وجود ندارد. اتصال به سرور را بررسی کنید.
          </div>
        )}
      </section>
    </>
  );
}
