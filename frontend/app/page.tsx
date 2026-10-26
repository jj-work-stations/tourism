import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  BedDouble,
  Bot,
  Compass,
  CreditCard,
  FireExtinguisher,
  Gift,
  Globe2,
  Headphones,
  HeartHandshake,
  Landmark,
  MapPinned,
  Plane,
  ShieldCheck,
  Sparkles,
  Star,
  Ticket,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";

import { AttractionCard, DestinationCard, ExperienceCard } from "@/components/cards";
import { HeroSearch } from "@/components/hero-search";
import { Badge, SectionHeader, SmartImage } from "@/components/ui";
import { serverFetch } from "@/lib/api";
import { toman } from "@/lib/format";
import type { HomeData } from "@/lib/types";
import { destinationName } from "@/lib/utils";

export const dynamic = "force-dynamic";

const fallback: HomeData = {
  featured_destinations: [],
  popular_destinations: [],
  campaigns: [],
  featured_attractions: [],
  featured_experiences: [],
  deals: [],
  stats: { destinations: 0, accommodations: 0, attractions: 0, experiences: 0 },
};

export default async function HomePage() {
  const data = (await serverFetch<HomeData>("/home")) ?? fallback;
  const destinations = data.popular_destinations.length
    ? data.popular_destinations
    : data.featured_destinations;
  const heroDestinations = data.featured_destinations.length
    ? data.featured_destinations
    : destinations;
  const heroImage = heroDestinations[0]?.image_url;

  return (
    <>
      <section className="container-app pt-5 sm:pt-8">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-brand-950">
          {heroImage && (
            <SmartImage
              src={heroImage}
              alt="سفر با سیر"
              className="absolute inset-0 h-full w-full opacity-45"
              fallbackClassName="absolute inset-0 h-full w-full opacity-30"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-l from-brand-950 via-brand-950/80 to-brand-900/35" />
          <div className="absolute -left-16 top-10 h-64 w-64 rounded-full bg-brand-400/20 blur-3xl" />
          <div className="absolute -bottom-24 right-10 h-72 w-72 rounded-full bg-sand-300/20 blur-3xl" />

          <div className="relative grid gap-8 px-5 py-10 sm:px-10 sm:py-14 lg:grid-cols-[1.15fr_.85fr] lg:px-14 lg:py-16">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/85 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-sand-300" />
                سوپراپ هوشمند سفر ایران
              </span>
              <h1 className="mt-5 text-4xl font-black leading-[1.25] text-white sm:text-5xl lg:text-[3.4rem]">
                سفر بعدی‌ات را
                <br />
                <span className="bg-gradient-to-l from-sand-200 to-brand-200 bg-clip-text text-transparent">
                  با سیر بساز
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-8 text-white/65 sm:text-base">
                از پیدا کردن بلیت و هتل تا چیدن برنامه روزبه‌روز با دستیار هوشمند؛
                همه‌چیز برای یک سفر بی‌دغدغه، در یک اپلیکیشن.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link href="/assistant" className="btn bg-white !text-ink hover:bg-sand-50">
                  <Bot className="h-4 w-4 text-brand-700" />
                  برنامه‌ریزی با هوش مصنوعی
                </Link>
                <Link href="/destinations" className="btn border border-white/20 bg-white/5 !text-white hover:bg-white/10">
                  <Compass className="h-4 w-4" />
                  کشف مقصدها
                </Link>
              </div>

              <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-[11px] text-white/55">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-brand-300" />
                  پرداخت امن و ضمانت بازگشت وجه
                </span>
                <span className="flex items-center gap-1.5">
                  <Headphones className="h-4 w-4 text-brand-300" />
                  پشتیبانی ۲۴ ساعته
                </span>
                <span className="flex items-center gap-1.5">
                  <BadgeCheck className="h-4 w-4 text-brand-300" />
                  مجوز رسمی گردشگری
                </span>
              </div>
            </div>

            <div className="hidden items-end justify-end lg:flex">
              <div className="w-full max-w-sm space-y-3">
                {heroDestinations.slice(1, 4).map((destination, index) => (
                  <Link
                    key={destination.id}
                    href={`/destinations/${destination.slug}`}
                    className="glass group flex items-center gap-3 rounded-2xl p-3 transition hover:bg-white/90"
                    style={{ marginRight: `${index * 18}px` }}
                  >
                    <SmartImage
                      src={destination.image_url}
                      alt={destinationName(destination)}
                      className="h-14 w-14 rounded-xl"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-ink">{destinationName(destination)}</div>
                      <div className="text-[10px] text-ink/45">{destination.short_description}</div>
                    </div>
                    <span className="text-[11px] font-bold text-brand-800">
                      {toman(destination.starting_price, true)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 -mt-6 px-2 sm:-mt-8 sm:px-6">
          <HeroSearch destinations={destinations} />
        </div>
      </section>

      <section className="container-app mt-8">
        <div className="grid grid-cols-2 gap-3 rounded-3xl border border-black/5 bg-white/70 p-4 sm:grid-cols-4 sm:p-5">
          {[
            { value: data.stats.destinations, label: "مقصد منتخب", icon: MapPinned },
            { value: data.stats.accommodations, label: "اقامتگاه همکار", icon: Globe2 },
            { value: data.stats.attractions, label: "جاذبه گردشگری", icon: Compass },
            { value: data.stats.experiences, label: "تجربه محلی", icon: Sparkles },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-center gap-3 py-2 sm:border-l sm:border-black/5 sm:last:border-none">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                <item.icon className="h-4 w-4" />
              </span>
              <div>
                <div className="text-xl font-black leading-none text-ink">
                  {new Intl.NumberFormat("fa-IR").format(item.value)}
                  <span className="text-brand-600">+</span>
                </div>
                <div className="mt-1 text-[11px] text-ink/45">{item.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Discovery categories — arch-shaped tiles */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { href: "/stays", label: "اقامتگاه‌ها", sub: "هتل، بوم‌گردی، ویلا", icon: BedDouble },
            { href: "/attractions", label: "جاذبه‌ها", sub: "تاریخی، طبیعی، مذهبی", icon: Landmark },
            { href: "/restaurants", label: "رستوران‌ها", sub: "غذاهای محلی و منو", icon: UtensilsCrossed },
            { href: "/experiences", label: "تجربه‌ها", sub: "تور، آشپزی، عکاسی", icon: Sparkles },
            { href: "/map", label: "نقشه هوشمند", sub: "همه‌چیز روی یک نقشه", icon: MapPinned },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="card card-hover group flex items-center gap-3 p-4"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-700 to-brand-500 text-white shadow-soft transition group-hover:rotate-6">
                <item.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-extrabold text-ink">{item.label}</div>
                <div className="truncate text-[10px] text-ink/45">{item.sub}</div>
              </div>
              <ArrowLeft className="mr-auto h-4 w-4 shrink-0 text-ink/20 transition group-hover:-translate-x-0.5 group-hover:text-brand-700" />
            </Link>
          ))}
        </div>
      </section>

      {destinations.length > 0 && (
        <section className="container-app mt-16">
          <SectionHeader
            eyebrow="مقصدهای محبوب"
            title="کجای ایران را می‌خواهی ببینی؟"
            description="از کوچه‌های تاریخی یزد تا آب‌های فیروزه‌ای کیش؛ مقصدت را انتخاب کن و بقیه را به سیر بسپار."
            href="/destinations"
          />
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {destinations.slice(0, 3).map((destination, index) => (
              <DestinationCard
                key={destination.id}
                destination={destination}
                className={index === 0 ? "h-[340px] md:h-[380px]" : "h-[260px] md:h-[300px]"}
              />
            ))}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {destinations.slice(3, 8).map((destination) => (
              <Link
                key={destination.id}
                href={`/destinations/${destination.slug}`}
                className="group flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-3 transition hover:border-brand-700/20 hover:shadow-card"
              >
                <SmartImage src={destination.image_url} alt={destinationName(destination)} className="h-11 w-11 rounded-xl" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-ink">{destinationName(destination)}</div>
                  <div className="text-[10px] text-ink/40">{destination.attraction_count} جاذبه</div>
                </div>
                <ArrowLeft className="mr-auto h-4 w-4 text-ink/25 transition group-hover:-translate-x-1 group-hover:text-brand-700" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {data.campaigns.length > 0 && (
        <section className="container-app mt-16">
          <div className="grid gap-4 md:grid-cols-2">
            {data.campaigns.slice(0, 2).map((campaign) => (
              <Link
                key={campaign.id}
                href={campaign.cta_url || "/destinations"}
                className="group relative min-h-[210px] overflow-hidden rounded-3xl bg-ink"
              >
                <SmartImage src={campaign.image_url} alt={campaign.title} className="absolute inset-0 h-full w-full opacity-60 transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-l from-black/80 via-black/35 to-transparent" />
                <div className="relative flex h-full flex-col justify-end p-6 text-white">
                  {campaign.badge && (
                    <span className="mb-2 w-fit rounded-full bg-brand-500 px-2.5 py-1 text-[10px] font-bold">{campaign.badge}</span>
                  )}
                  <h3 className="text-xl font-black">{campaign.title}</h3>
                  <p className="mt-1 max-w-sm text-xs leading-6 text-white/60">{campaign.subtitle}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-sand-200">
                    {campaign.cta_label || "مشاهده پیشنهاد"}
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {data.featured_experiences.length > 0 && (
        <section className="container-app mt-16">
          <SectionHeader
            eyebrow="تجربه‌های اصیل"
            title="مثل یک محلی زندگی کن"
            description="آشپزی ایرانی، کارگاه صنایع دستی، شب‌گردی تاریخی و تجربه‌هایی که در هیچ کتابی پیدا نمی‌کنی."
            href="/search?tab=experience"
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {data.featured_experiences.slice(0, 4).map((experience) => (
              <ExperienceCard key={experience.id} experience={experience} />
            ))}
          </div>
        </section>
      )}

      <section className="container-app mt-16">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-l from-brand-800 via-brand-700 to-brand-600 p-7 text-white sm:p-12">
          <div className="absolute -left-16 -top-20 h-72 w-72 rounded-full border-[40px] border-white/5" />
          <div className="absolute -bottom-24 right-1/3 h-64 w-64 rounded-full bg-sand-300/10 blur-2xl" />
          <div className="relative grid items-center gap-8 lg:grid-cols-[1.1fr_.9fr]">
            <div>
              <Badge tone="sand" className="bg-white/10 text-sand-100">
                <Bot className="h-3.5 w-3.5" /> دستیار سفر سیر
              </Badge>
              <h2 className="mt-4 text-3xl font-black leading-snug sm:text-4xl">
                بگو کجا و چند روز؛
                <br />
                برنامه سفرت را می‌چینیم.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-8 text-white/65">
                دستیار هوشمند سیر بر اساس بودجه، علاقه و سرعت سفرت، یک برنامه روزبه‌روز
                با جاذبه‌ها، غذاهای محلی و زمان‌بندی واقعی می‌سازد — و می‌توانی همین‌جا
                اقامتگاه و وسیله سفر را هم رزرو کنی.
              </p>
              <div className="mt-6 flex flex-wrap gap-2 text-xs">
                {["برنامه ۳ روزه شیراز", "سفر خانوادگی به کیش", "یزدگردی فرهنگی"].map((prompt) => (
                  <span key={prompt} className="rounded-full border border-white/15 bg-white/10 px-3 py-2">
                    {prompt}
                  </span>
                ))}
              </div>
              <Link href="/assistant" className="btn mt-7 bg-white !text-brand-900 hover:bg-sand-50">
                <Sparkles className="h-4 w-4" />
                شروع برنامه‌ریزی
              </Link>
            </div>

            <div className="relative">
              <div className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur-md">
                <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-sand-300/20 text-sand-100">
                    <Bot className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-xs font-bold">دستیار سیر</div>
                    <div className="text-[10px] text-white/50">آنلاین · آماده کمک</div>
                  </div>
                </div>
                <div className="mt-3 space-y-3 text-xs leading-6">
                  <div className="w-fit rounded-2xl rounded-tr-sm bg-white/15 px-3 py-2">
                    سه روز می‌خوام برم شیراز، بودجه ۱۲ میلیون
                  </div>
                  <div className="rounded-2xl rounded-tl-sm bg-white p-3 text-ink">
                    <div className="font-bold text-brand-800">برنامه پیشنهادی روز اول</div>
                    <div className="mt-2 text-ink/60">صبح: حافظیه · ظهر: ناهار سنتی · عصر: بازار وکیل</div>
                    <div className="mt-2 flex gap-2">
                      <span className="rounded-lg bg-brand-50 px-2 py-1 text-[10px] text-brand-800">هزینه تقریبی ۲.۱ م</span>
                      <span className="rounded-lg bg-amber-50 px-2 py-1 text-[10px] text-amber-700">۴ ساعت</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-4 -right-4 hidden rounded-2xl bg-white p-3 text-ink shadow-soft sm:block">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-50 text-amber-500">
                    <Star className="h-4 w-4 fill-current" />
                  </span>
                  <div>
                    <div className="text-[10px] text-ink/40">رضایت مسافران</div>
                    <div className="text-sm font-black">۹۸٪</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {data.featured_attractions.length > 0 && (
        <section className="container-app mt-16">
          <SectionHeader
            eyebrow="دیدنی‌ها"
            title="جاذبه‌هایی که نباید از دست بدهی"
            description="منتخب جاذبه‌های ثبت‌شده در سیر، با اطلاعات بازدید و امتیاز واقعی مسافران."
            href="/destinations"
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.featured_attractions.slice(0, 6).map((attraction) => (
              <AttractionCard key={attraction.id} attraction={attraction} />
            ))}
          </div>
        </section>
      )}

      {data.deals.length > 0 && (
        <section className="container-app mt-16">
          <div className="grid gap-4 sm:grid-cols-2">
            {data.deals.map((deal) => (
              <div key={deal.code} className="relative overflow-hidden rounded-3xl border border-dashed border-brand-700/25 bg-brand-50/60 p-6">
                <Gift className="absolute -left-3 -top-3 h-24 w-24 text-brand-700/10" />
                <div className="relative">
                  <div className="text-xs font-bold text-brand-700">پیشنهاد ویژه سیر</div>
                  <h3 className="mt-1 text-lg font-black text-ink">{deal.title}</h3>
                  <p className="mt-1 text-xs leading-6 text-ink/50">{deal.description}</p>
                  <div className="mt-4 flex items-center gap-2">
                    <span className="rounded-xl border border-brand-700/20 bg-white px-4 py-2 font-mono text-sm font-bold tracking-widest text-brand-900">
                      {deal.code}
                    </span>
                    <span className="text-[10px] text-ink/40">کد را هنگام پرداخت وارد کنید</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="container-app mt-16">
        <SectionHeader eyebrow="چرا سیر؟" title="یک سوپراپ، برای تمام سفر" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Plane, title: "همه راه‌های سفر", text: "هواپیما، قطار، اتوبوس و اقامتگاه‌ها در یک جستجو." },
            { icon: Bot, title: "برنامه‌ریز هوشمند", text: "برنامه سفر شخصی‌سازی‌شده بر اساس بودجه و سلیقه." },
            { icon: Wallet, title: "کیف پول سیر", text: "پرداخت سریع، بازگشت وجه و پاداش هر رزرو." },
            { icon: HeartHandshake, title: "پشتیبانی انسانی", text: "همراه شما از لحظه رزرو تا بازگشت از سفر." },
          ].map((feature) => (
            <div key={feature.title} className="card group p-6 transition hover:-translate-y-1 hover:shadow-soft">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700 transition group-hover:bg-brand-700 group-hover:text-white">
                <feature.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-extrabold text-ink">{feature.title}</h3>
              <p className="mt-2 text-xs leading-6 text-ink/50">{feature.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-app mt-16">
        <div className="grid items-center gap-6 rounded-[2.5rem] border border-brand-700/10 bg-white p-7 sm:p-10 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-brand-700">
              <Ticket className="h-4 w-4" />
              آماده‌ای؟
            </div>
            <h2 className="mt-2 text-2xl font-black text-ink sm:text-3xl">
              اولین سفرت را همین امروز شروع کن.
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-7 text-ink/50">
              ثبت‌نام رایگان است. با ساخت حساب، پاسپورت سفر، کیف پول و پیشنهادهای
              شخصی‌سازی‌شده در اختیارت قرار می‌گیرد.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/register" className="btn-primary">
              ساخت حساب رایگان
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Link href="/login" className="btn-secondary">
              ورود با حساب دمو
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
