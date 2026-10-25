"use client";

import Link from "next/link";
import { useState } from "react";
import { KeyRound, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";

import { AccountShell } from "@/components/account-shell";
import { RequireAuth } from "@/components/require-auth";
import { Badge } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { date } from "@/lib/format";
import type { User } from "@/lib/types";

function ProfileContent() {
  const user = useAuth((state) => state.user);
  const setUser = useAuth((state) => state.setUser);
  const clear = useAuth((state) => state.clear);
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [city, setCity] = useState(user?.city ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? "");
  const [locale, setLocale] = useState(user?.locale ?? "fa");
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changing, setChanging] = useState(false);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const updated = await api.patch<User>(
        "/users/me",
        { full_name: fullName, city: city || null, avatar_url: avatarUrl || null, locale },
        true,
      );
      setUser(updated);
      toast.success("پروفایل به‌روزرسانی شد.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "ذخیره انجام نشد.");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    setChanging(true);
    try {
      await api.post("/auth/change-password", { current_password: currentPassword, new_password: newPassword }, true);
      setCurrentPassword("");
      setNewPassword("");
      toast.success("رمز عبور تغییر کرد.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "تغییر رمز انجام نشد.");
    } finally {
      setChanging(false);
    }
  }

  async function deactivate() {
    if (!window.confirm("حساب شما غیرفعال شود؟ برای فعال‌سازی مجدد با پشتیبانی تماس بگیرید.")) return;
    try {
      await api.delete("/users/me", undefined, true);
      clear();
      toast.success("حساب غیرفعال شد.");
      window.location.href = "/";
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "انجام نشد.");
    }
  }

  return (
    <AccountShell title="پروفایل و امنیت" description="اطلاعات شخصی، زبان و امنیت حساب خود را مدیریت کنید.">
      <div className="grid gap-5 lg:grid-cols-2">
        <form onSubmit={saveProfile} className="card p-5">
          <h2 className="flex items-center gap-2 font-black text-ink"><UserRound className="h-4 w-4 text-brand-700" /> اطلاعات شخصی</h2>
          <div className="mt-4 space-y-3">
            <label className="block"><span className="label">نام و نام خانوادگی</span><input className="input" value={fullName} onChange={(event) => setFullName(event.target.value)} required minLength={2} /></label>
            <label className="block"><span className="label">شهر</span><input className="input" value={city} onChange={(event) => setCity(event.target.value)} placeholder="مثلاً شیراز" /></label>
            <label className="block"><span className="label">آدرس تصویر پروفایل</span><input className="input" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} placeholder="https://..." /></label>
            <label className="block">
              <span className="label">زبان</span>
              <select className="input" value={locale} onChange={(event) => setLocale(event.target.value)}>
                <option value="fa">فارسی</option>
                <option value="en">English</option>
                <option value="ar">العربية</option>
                <option value="tr">Türkçe</option>
              </select>
            </label>
            <div className="flex items-center gap-2 text-[11px] text-ink/45">
              <span>ایمیل: {user?.email || "—"}</span>
              {user?.is_verified ? <Badge tone="emerald">تأیید شده</Badge> : <Badge tone="amber">تأیید نشده</Badge>}
            </div>
            <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? "در حال ذخیره..." : "ذخیره تغییرات"}</button>
          </div>
        </form>

        <div className="space-y-5">
          <form onSubmit={changePassword} className="card p-5">
            <h2 className="flex items-center gap-2 font-black text-ink"><KeyRound className="h-4 w-4 text-brand-700" /> تغییر رمز عبور</h2>
            <div className="mt-4 space-y-3">
              <label className="block"><span className="label">رمز فعلی</span><input type="password" className="input" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>
              <label className="block"><span className="label">رمز جدید</span><input type="password" className="input" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={8} placeholder="حداقل ۸ کاراکتر شامل حرف و رقم" /></label>
              <button type="submit" disabled={changing} className="btn-secondary w-full">{changing ? "در حال تغییر..." : "تغییر رمز"}</button>
            </div>
          </form>

          <div className="card p-5">
            <h2 className="flex items-center gap-2 font-black text-ink"><ShieldCheck className="h-4 w-4 text-emerald-600" /> امنیت حساب</h2>
            <dl className="mt-3 space-y-2 text-[11px]">
              <div className="flex justify-between border-b border-black/5 pb-2"><dt className="text-ink/45">عضویت از</dt><dd className="font-semibold text-ink">{date(user?.created_at)}</dd></div>
              <div className="flex justify-between border-b border-black/5 pb-2"><dt className="text-ink/45">آخرین ورود</dt><dd className="font-semibold text-ink">{date(user?.last_login_at)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink/45">نقش</dt><dd className="font-semibold text-ink">{user?.role}</dd></div>
            </dl>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => { clear(); window.location.href = "/"; }} className="btn-ghost !rounded-xl !px-3 !py-2 !text-xs"><LogOut className="h-3.5 w-3.5" /> خروج</button>
              <button type="button" onClick={deactivate} className="btn !rounded-xl border border-rose-200 bg-white !px-3 !py-2 !text-xs !text-rose-600 hover:bg-rose-50">غیرفعال‌سازی حساب</button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 card p-5">
        <h2 className="font-black text-ink">ترجیحات سفر</h2>
        <p className="mt-1 text-xs text-ink/45">برای دریافت پیشنهادهای دقیق‌تر، علاقه‌مندی و سبک سفر خود را تنظیم کنید.</p>
        <Link href="/account/preferences" className="btn-secondary mt-3 !rounded-xl !px-4 !py-2 !text-xs">تنظیم ترجیحات</Link>
      </div>
    </AccountShell>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileContent />
    </RequireAuth>
  );
}
