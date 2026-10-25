import Link from "next/link";
import { Compass, Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <section className="container-page grid min-h-[60vh] place-items-center py-16">
      <div className="card max-w-lg p-8 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-700">
          <Compass className="h-7 w-7" />
        </span>
        <p className="mt-5 text-5xl font-black text-brand-800">۴۰۴</p>
        <h1 className="mt-2 text-xl font-extrabold text-ink">این مسیر پیدا نشد</h1>
        <p className="mt-2 text-sm leading-7 text-ink/55">
          صفحه‌ای که دنبال آن هستید حذف شده یا آدرس آن تغییر کرده است. از جستجو یا صفحه اصلی
          ادامه دهید.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/search" className="btn-primary gap-2">
            <Search className="h-4 w-4" />
            جستجوی سفر
          </Link>
          <Link href="/" className="btn-secondary gap-2">
            <Home className="h-4 w-4" />
            صفحه اصلی
          </Link>
        </div>
      </div>
    </section>
  );
}
