"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowLeft, Compass, KeyRound, Mail, Phone, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Brand } from "@/components/site-header";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import type { AuthResponse } from "@/lib/types";

const demos = [
  { label: "مسافر دمو", identifier: "traveler@seir.ir", password: "Traveler123", tone: "bg-brand-50 text-brand-800" },
  { label: "مدیر", identifier: "admin@seir.ir", password: "Admin12345", tone: "bg-sand-100 text-sand-800" },
  { label: "ارائه‌دهنده", identifier: "provider@seir.ir", password: "Provider123", tone: "bg-sky-50 text-sky-700" },
];

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const setSession = useAuth((state) => state.setSession);
  const [mode, setMode] = useState<"password" | "otp">("password");
  const [identifier, setIdentifier] = useState("traveler@seir.ir");
  const [password, setPassword] = useState("Traveler123");
  const [phone, setPhone] = useState("09120000000");
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const next = params.get("next") || "/account";

  function done(result: AuthResponse, message: string) {
    setSession(result.user, result.tokens);
    toast.success(message);
    router.push(next);
  }

  async function submitPassword(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await api.post<AuthResponse>("/auth/login", { identifier, password });
      done(result, `خوش آمدید ${result.user.full_name}!`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "ورود انجام نشد.");
    } finally {
      setLoading(false);
    }
  }

  async function requestOtp(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await api.post<{ message: string; debug_code?: string | null }>("/auth/otp/request", { phone });
      setOtpSent(true);
      if (result.debug_code) setCode(result.debug_code);
      toast.success(result.debug_code ? `کد دمو: ${result.debug_code}` : result.message);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "ارسال کد انجام نشد.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await api.post<AuthResponse>("/auth/otp/verify", { phone, code });
      done(result, "با موفقیت وارد شدید.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "کد واردشده معتبر نیست.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-[calc(100vh-72px)] lg:grid-cols-[1.05fr_.95fr]">
      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 inline-flex">
            <Brand />
          </Link>
          <h1 className="text-3xl font-black text-ink">خوش برگشتی 👋</h1>
          <p className="mt-2 text-sm leading-7 text-ink/50">
            وارد حساب سیر شو و سفرهایت را از همان‌جا که رها کردی ادامه بده.
          </p>

          <div className="mt-7 flex rounded-2xl bg-black/[0.04] p-1">
            <button
              type="button"
              onClick={() => setMode("password")}
              className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition ${mode === "password" ? "bg-white text-brand-800 shadow-sm" : "text-ink/50"}`}
            >
              رمز عبور
            </button>
            <button
              type="button"
              onClick={() => setMode("otp")}
              className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition ${mode === "otp" ? "bg-white text-brand-800 shadow-sm" : "text-ink/50"}`}
            >
              ورود با موبایل
            </button>
          </div>

          {mode === "password" ? (
            <form onSubmit={submitPassword} className="mt-6 space-y-4">
              <label className="block">
                <span className="label">ایمیل یا شماره موبایل</span>
                <span className="relative block">
                  <Mail className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />
                  <input
                    className="input pr-11"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="you@example.com"
                    dir="ltr"
                    required
                  />
                </span>
              </label>
              <label className="block">
                <span className="label">رمز عبور</span>
                <span className="relative block">
                  <KeyRound className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />
                  <input
                    type="password"
                    className="input pr-11"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    dir="ltr"
                    required
                  />
                </span>
              </label>
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? "در حال ورود..." : "ورود به حساب"}
                {!loading && <ArrowLeft className="h-4 w-4" />}
              </button>
            </form>
          ) : (
            <form onSubmit={otpSent ? verifyOtp : requestOtp} className="mt-6 space-y-4">
              <label className="block">
                <span className="label">شماره موبایل</span>
                <span className="relative block">
                  <Phone className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />
                  <input
                    className="input pr-11"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="09121234567"
                    dir="ltr"
                    required
                  />
                </span>
              </label>
              {otpSent && (
                <label className="block">
                  <span className="label">کد تأیید</span>
                  <input
                    className="input text-center font-mono tracking-[0.4em]"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="------"
                    dir="ltr"
                    required
                  />
                </label>
              )}
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? "لطفاً صبر کنید..." : otpSent ? "تأیید و ورود" : "ارسال کد تأیید"}
              </button>
              {otpSent && (
                <button type="button" onClick={() => setOtpSent(false)} className="btn-ghost w-full !py-2 !text-xs">
                  تغییر شماره موبایل
                </button>
              )}
            </form>
          )}

          <p className="mt-6 text-center text-xs text-ink/45">
            حساب نداری؟{" "}
            <Link href="/register" className="font-bold text-brand-800 hover:underline">
              ثبت‌نام رایگان
            </Link>
          </p>

          <div className="mt-8 rounded-2xl border border-dashed border-brand-700/20 bg-brand-50/50 p-4">
            <div className="mb-3 flex items-center gap-1.5 text-xs font-bold text-brand-800">
              <Sparkles className="h-3.5 w-3.5" />
              ورود سریع با حساب‌های نمایشی
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {demos.map((demo) => (
                <button
                  key={demo.identifier}
                  type="button"
                  onClick={() => {
                    setIdentifier(demo.identifier);
                    setPassword(demo.password);
                    setMode("password");
                    toast.info(`اطلاعات ${demo.label} پر شد.`);
                  }}
                  className={`rounded-xl px-2 py-2 text-[11px] font-bold transition hover:opacity-80 ${demo.tone}`}
                >
                  {demo.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-brand-950 lg:block">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1526772662000-3f88f10405ff?auto=format&fit=crop&w=1600&q=80')] bg-cover bg-center opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-950 via-brand-950/50 to-brand-900/30" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Compass className="h-5 w-5 text-sand-300" />
            سیر، همراه هوشمند سفر
          </div>
          <div>
            <div className="mb-6 flex -space-x-2 space-x-reverse">
              {[1, 2, 3, 4].map((i) => (
                <span key={i} className="grid h-10 w-10 place-items-center rounded-full border-2 border-brand-950 bg-brand-700 text-xs font-bold">
                  ✈
                </span>
              ))}
            </div>
            <blockquote className="text-2xl font-bold leading-relaxed">
              «با سیر سه روزه شیراز رو چیدم؛ از صبحانه تا شب‌گردی، همه‌چیز دقیق و بدون
              استرس بود.»
            </blockquote>
            <div className="mt-4 text-sm text-white/50">سارا محمدی · مسافر شیراز</div>
          </div>
          <div className="grid grid-cols-3 gap-3 border-t border-white/10 pt-6 text-center">
            {[
              { value: "۹۸٪", label: "رضایت مسافران" },
              { value: "+۱۲۰", label: "مقصد و تجربه" },
              { value: "۲۴/۷", label: "پشتیبانی" },
            ].map((item) => (
              <div key={item.label}>
                <div className="text-lg font-black text-sand-200">{item.value}</div>
                <div className="mt-1 text-[10px] text-white/40">{item.label}</div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-white/40">
            <ShieldCheck className="h-4 w-4" />
            اطلاعات شما با استانداردهای امنیتی محافظت می‌شود.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="container-app py-20 text-center text-sm text-ink/50">در حال بارگذاری...</div>}>
      <LoginForm />
    </Suspense>
  );
}
