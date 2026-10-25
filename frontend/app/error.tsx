"use client";

import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="container-page grid min-h-[60vh] place-items-center py-16">
      <div className="card max-w-lg p-8 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-600">
          <AlertTriangle className="h-7 w-7" />
        </span>
        <h1 className="mt-5 text-2xl font-black text-ink">مشکلی پیش آمد</h1>
        <p className="mt-2 text-sm leading-7 text-ink/55">
          در پردازش این صفحه خطایی رخ داد. دوباره تلاش کنید؛ اگر مشکل ادامه داشت با پشتیبانی
          تماس بگیرید.
        </p>
        {error.digest && (
          <p className="mt-2 text-[11px] text-ink/30" dir="ltr">
            {error.digest}
          </p>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={reset} className="btn-primary gap-2">
            <RotateCcw className="h-4 w-4" />
            تلاش دوباره
          </button>
          <Link href="/" className="btn-secondary gap-2">
            <Home className="h-4 w-4" />
            صفحه اصلی
          </Link>
        </div>
      </div>
    </section>
  );
}
