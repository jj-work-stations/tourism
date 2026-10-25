"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Save, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { AccountShell } from "@/components/account-shell";
import { RequireAuth } from "@/components/require-auth";
import { Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useApiQuery } from "@/lib/hooks";
import { cn } from "@/lib/utils";

interface Preferences {
  interests: string[];
  budget_level: string;
  travel_style: string;
  preferred_transport?: string | null;
  preferred_accommodation?: string | null;
  dietary_preferences: string[];
  accessibility_needs: string[];
  marketing_opt_in: boolean;
}

const INTERESTS = [
  { value: "history", label: "تاریخ و فرهنگ" },
  { value: "nature", label: "طبیعت‌گردی" },
  { value: "food", label: "غذا و کافه" },
  { value: "adventure", label: "ماجراجویی" },
  { value: "shopping", label: "خرید" },
  { value: "photography", label: "عکاسی" },
  { value: "family", label: "سفر خانوادگی" },
  { value: "religion", label: "زیارت" },
];

function PreferencesContent() {
  const queryClient = useQueryClient();
  const preferences = useApiQuery<Preferences>(["account", "preferences"], "/users/me/preferences");
  const [form, setForm] = useState<Preferences>({
    interests: [],
    budget_level: "mid",
    travel_style: "balanced",
    preferred_transport: "",
    preferred_accommodation: "",
    dietary_preferences: [],
    accessibility_needs: [],
    marketing_opt_in: true,
  });
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (preferences.data && !loaded) {
      setForm({ ...preferences.data, preferred_transport: preferences.data.preferred_transport ?? "", preferred_accommodation: preferences.data.preferred_accommodation ?? "" });
      setLoaded(true);
    }
  }, [preferences.data, loaded]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.put("/users/me/preferences", form, true);
      toast.success("ترجیحات سفر ذخیره شد.");
      await queryClient.invalidateQueries({ queryKey: ["account", "preferences"] });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "ذخیره انجام نشد.");
    } finally {
      setSaving(false);
    }
  }

  if (preferences.isLoading || !loaded) {
    return (
      <AccountShell title="ترجیحات سفر">
        <div className="grid place-items-center py-20"><Spinner /></div>
      </AccountShell>
    );
  }

  return (
    <AccountShell title="ترجیحات سفر" description="با این تنظیمات، پیشنهادها و برنامه‌های هوشمند دقیق‌تری دریافت می‌کنید.">
      <form onSubmit={save} className="space-y-5">
        <div className="card p-5">
          <h2 className="flex items-center gap-2 font-black text-ink"><Settings2 className="h-4 w-4 text-brand-700" /> علاقه‌مندی‌ها</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {INTERESTS.map((item) => {
              const active = form.interests.includes(item.value);
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, interests: active ? current.interests.filter((value) => value !== item.value) : [...current.interests, item.value] }))}
                  className={cn("rounded-full px-3.5 py-2 text-xs font-semibold transition", active ? "bg-brand-700 text-white" : "bg-black/[0.04] text-ink/55 hover:bg-black/[0.07]")}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="card p-5">
            <span className="label">سطح بودجه</span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "budget", label: "اقتصادی" },
                { value: "mid", label: "متعادل" },
                { value: "luxury", label: "لوکس" },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, budget_level: item.value }))}
                  className={cn("rounded-xl border px-2 py-2.5 text-xs font-semibold transition", form.budget_level === item.value ? "border-brand-700 bg-brand-50 text-brand-800" : "border-black/10 text-ink/50 hover:bg-black/[0.03]")}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <span className="label">سبک سفر</span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "relaxed", label: "آرام" },
                { value: "balanced", label: "متعادل" },
                { value: "packed", label: "فشرده" },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, travel_style: item.value }))}
                  className={cn("rounded-xl border px-2 py-2.5 text-xs font-semibold transition", form.travel_style === item.value ? "border-brand-700 bg-brand-50 text-brand-800" : "border-black/10 text-ink/50 hover:bg-black/[0.03]")}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <label className="card block p-5">
            <span className="label">وسیله سفر ترجیحی</span>
            <select className="input" value={form.preferred_transport ?? ""} onChange={(event) => setForm((current) => ({ ...current, preferred_transport: event.target.value }))}>
              <option value="">بدون ترجیح</option>
              <option value="flight">هواپیما</option>
              <option value="train">قطار</option>
              <option value="bus">اتوبوس</option>
            </select>
          </label>

          <label className="card block p-5">
            <span className="label">نوع اقامتگاه ترجیحی</span>
            <select className="input" value={form.preferred_accommodation ?? ""} onChange={(event) => setForm((current) => ({ ...current, preferred_accommodation: event.target.value }))}>
              <option value="">بدون ترجیح</option>
              <option value="hotel">هتل</option>
              <option value="apartment">آپارتمان</option>
              <option value="villa">ویلا</option>
              <option value="hostel">هاستل</option>
              <option value="eco_lodge">اقامتگاه بوم‌گردی</option>
            </select>
          </label>
        </div>

        <div className="card p-5">
          <label className="flex items-center justify-between gap-3">
            <span>
              <span className="block text-sm font-bold text-ink">دریافت پیشنهادهای بازاریابی</span>
              <span className="mt-0.5 block text-[11px] text-ink/45">تخفیف‌ها و پیشنهادهای ویژه سیر را دریافت کنید.</span>
            </span>
            <input type="checkbox" className="h-5 w-5 accent-brand-700" checked={form.marketing_opt_in} onChange={(event) => setForm((current) => ({ ...current, marketing_opt_in: event.target.checked }))} />
          </label>
        </div>

        <button type="submit" disabled={saving} className="btn-primary">
          <Save className="h-4 w-4" /> {saving ? "در حال ذخیره..." : "ذخیره ترجیحات"}
        </button>
      </form>
    </AccountShell>
  );
}

export default function PreferencesPage() {
  return (
    <RequireAuth>
      <PreferencesContent />
    </RequireAuth>
  );
}
