"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LockKeyhole } from "lucide-react";

import { useAuth } from "@/lib/auth-store";
import { Spinner } from "@/components/ui";

export function RequireAuth({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: string[];
}) {
  const pathname = usePathname();
  const hydrated = useAuth((state) => state.hydrated);
  const user = useAuth((state) => state.user);
  const tokens = useAuth((state) => state.tokens);

  if (!hydrated) {
    return (
      <div className="container-app grid min-h-[50vh] place-items-center py-16">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!tokens?.access_token || !user) {
    const next = encodeURIComponent(pathname || "/");
    return (
      <div className="container-app py-16">
        <div className="card mx-auto max-w-md p-8 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-700">
            <LockKeyhole className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-xl font-black text-ink">برای ادامه وارد شوید</h1>
          <p className="mt-2 text-sm leading-6 text-ink/50">
            این بخش مخصوص اعضای سیر است. با حساب خود وارد شوید یا یک حساب رایگان بسازید.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Link href={`/login?next=${next}`} className="btn-primary">
              ورود به حساب
            </Link>
            <Link href="/register" className="btn-secondary">
              ثبت‌نام
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="container-app py-16">
        <div className="card mx-auto max-w-md p-8 text-center">
          <h1 className="text-xl font-black text-ink">دسترسی محدود</h1>
          <p className="mt-2 text-sm text-ink/50">حساب شما اجازه مشاهده این صفحه را ندارد.</p>
          <Link href="/" className="btn-primary mt-6">
            بازگشت به خانه
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
