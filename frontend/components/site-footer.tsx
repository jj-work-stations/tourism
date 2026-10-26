import Link from "next/link";
import { Instagram, Linkedin, Mail, MapPin, Phone, Send, Twitter } from "lucide-react";

import { Brand } from "@/components/site-header";

const columns = [
  {
    title: "سفر",
    links: [
      { href: "/destinations", label: "مقصدهای محبوب" },
      { href: "/search?tab=transport", label: "بلیت هواپیما و قطار" },
      { href: "/stays", label: "رزرو هتل و اقامتگاه" },
      { href: "/attractions", label: "جاذبه‌های گردشگری" },
      { href: "/experiences", label: "تجربه‌های محلی" },
      { href: "/restaurants", label: "رستوران‌ها و غذاهای محلی" },
      { href: "/map", label: "نقشه هوشمند سفر" },
      { href: "/assistant", label: "برنامه‌ریز هوشمند" },
    ],
  },
  {
    title: "حساب من",
    links: [
      { href: "/account", label: "داشبورد" },
      { href: "/account/bookings", label: "رزروهای من" },
      { href: "/account/trips", label: "سفرهای من" },
      { href: "/account/wallet", label: "کیف پول" },
      { href: "/account/rewards", label: "پاسپورت سفر" },
    ],
  },
  {
    title: "سیر",
    links: [
      { href: "#about", label: "درباره ما" },
      { href: "#careers", label: "فرصت‌های شغلی" },
      { href: "/support", label: "پشتیبانی" },
      { href: "#terms", label: "قوانین و مقررات" },
      { href: "#privacy", label: "حریم خصوصی" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-black/5 bg-[#072a26] text-white">
      <div className="container-app py-14">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <div className="[&_span]:!text-white [&_span:last-child]:!text-white/40">
              <Brand />
            </div>
            <p className="mt-4 max-w-sm text-sm leading-7 text-white/60">
              سیر، همراه هوشمند سفر شماست؛ از الهام گرفتن و پیدا کردن مقصد تا رزرو،
              برنامه‌ریزی روزبه‌روز و ثبت خاطرات در پاسپورت سفر.
            </p>
            <div className="mt-6 flex items-center gap-2">
              {[Instagram, Twitter, Linkedin, Send].map((Icon, index) => (
                <span
                  key={index}
                  className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
                >
                  <Icon className="h-4 w-4" />
                </span>
              ))}
            </div>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="mb-4 text-sm font-bold text-white/90">{column.title}</h3>
              <ul className="space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-white/55 transition hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 grid gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-5 md:grid-cols-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10">
              <Phone className="h-4 w-4" />
            </span>
            <div>
              <div className="text-[11px] text-white/40">پشتیبانی ۲۴ ساعته</div>
              <div className="text-sm font-semibold" dir="ltr">021-9100 0000</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10">
              <Mail className="h-4 w-4" />
            </span>
            <div>
              <div className="text-[11px] text-white/40">ایمیل</div>
              <div className="text-sm font-semibold">hello@seir.ir</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10">
              <MapPin className="h-4 w-4" />
            </span>
            <div>
              <div className="text-[11px] text-white/40">دفتر مرکزی</div>
              <div className="text-sm font-semibold">تهران، خیابان ولیعصر</div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-white/40 sm:flex-row">
          <span>© {new Intl.DateTimeFormat("fa-IR", { year: "numeric" }).format(new Date())} سیر. همه حقوق محفوظ است.</span>
          <span>ساخته‌شده با عشق برای مسافران ایران</span>
        </div>
      </div>
    </footer>
  );
}
