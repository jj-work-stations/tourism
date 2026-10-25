"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Compass, Eye, EyeOff, LockKeyhole, Mail, MapPin, Phone, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Brand } from "@/components/site-header";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import type { AuthResponse } from "@/lib/types";

export default function RegisterPage() {
  const router = useRouter();
  const setSession = useAuth((state) => state.setSession);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", city: "تهران", password: "" });
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  function update(key: keyof typeof form, value: string) {
    setForm((state) => ({ ...state, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await api.post<AuthResponse>("/auth/register", {
        ...form,
        phone: form.phone || null,
      });
      setSession(result.user, result.tokens);
      toast.success("حساب شما ساخته شد. به سیر خوش آمدید!");
      router.push("/account");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "ثبت‌نام انجام نشد.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-[calc(100vh-72px)] lg:grid-cols-[1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-brand-950 lg:block">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1519817650390-64a93db51149?auto=format&fit=crop&w=1600&q=80')] bg-cover bg-center opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-950 via-brand-950/60 to-brand-900/30" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Compass className="h-5 w-5 text-sand-300" />
            سیر، سوپراپ سفر ایران
          </div>
          <div>
            <h2 className="text-3xl font-black leading-snug">
              پاسپورت سفرت را
              <br />
              از همین‌جا بساز.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-8 text-white/55">
              با هر سفر، مهر تازه‌ای در پاسپورتت ثبت می‌شود؛ امتیاز می‌گیری، سطحت
              ارتقا پیدا می‌کند و پیشنهادهای اختصاصی دریافت می‌کنی.
            </p>
            <div className="mt-8 grid gap-3">
              {[
                "برنامه‌ریزی هوشمند سفر با هوش مصنوعی",
                "رزرو یکپارچه بلیت، هتل و تجربه",
                "کیف پول و بازگشت وجه سریع",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs">
                  <span className="grid h-6 w-6 place-items-center rounded-lg bg-brand-500/25 text-brand-200">✓</span>
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="text-[11px] text-white/35">
            با ثبت‌نام، قوانین و حریم خصوصی سیر را می‌پذیرید.
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-7 inline-flex">
            <Brand />
          </Link>
          <h1 className="text-3xl font-black text-ink">ساخت حساب جدید</h1>
          <p className="mt-2 text-sm text-ink/50">در کمتر از یک دقیقه به خانواده سیر بپیوند.</p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <label className="block">
              <span className="label">نام و نام خانوادگی</span>
              <span className="relative block">
                <UserRound className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />
                <input className="input pr-11" value={form.full_name} onChange={(e) => update("full_name", e.target.value)} placeholder="مثلاً سارا محمدی" required />
              </span>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="label">ایمیل</span>
                <span className="relative block">
                  <Mail className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />
                  <input type="email" className="input pr-11" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="you@example.com" dir="ltr" required />
                </span>
              </label>
              <label className="block">
                <span className="label">موبایل (اختیاری)</span>
                <span className="relative block">
                  <Phone className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />
                  <input className="input pr-11" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="09121234567" dir="ltr" />
                </span>
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="label">شهر</span>
                <span className="relative block">
                  <MapPin className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />
                  <input className="input pr-11" value={form.city} onChange={(e) => update("city", e.target.value)} placeholder="تهران" />
                </span>
              </label>
              <label className="block">
                <span className="label">رمز عبور</span>
                <span className="relative block">
                  <LockKeyhole className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />
                  <input
                    type={show ? "text" : "password"}
                    className="input px-11"
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                    placeholder="حداقل ۸ کاراکتر"
                    dir="ltr"
                    minLength={8}
                    required
                  />
                  <button type="button" onClick={() => setShow((v) => !v)} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/30">
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </span>
              </label>
            </div>

            <label className="flex items-start gap-2 rounded-2xl bg-black/[0.025] p-3 text-[11px] leading-5 text-ink/50">
              <input type="checkbox" required className="mt-0.5 h-4 w-4 rounded accent-brand-700" />
              <span>
                قوانین و مقررات و سیاست حریم خصوصی سیر را خوانده‌ام و می‌پذیرم.
              </span>
            </label>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "در حال ساخت حساب..." : "ساخت حساب و شروع سفر"}
              {!loading && <ArrowLeft className="h-4 w-4" />}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-ink/45">
            قبلاً ثبت‌نام کرده‌ای؟{" "}
            <Link href="/login" className="font-bold text-brand-800 hover:underline">
              ورود به حساب
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
