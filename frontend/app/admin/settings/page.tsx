"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ScrollText, Settings } from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { Badge, EmptyState, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { date, relative } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks";
import { toast } from "sonner";

interface SystemSettingsState {
  site_name: string;
  site_tagline: string;
  support_phone: string;
  support_email: string;
  default_currency: string;
  default_locale: string;
  booking_hold_minutes: number;
  cancellation_window_hours: number;
  commission_rate: number;
  maintenance_mode: boolean;
  registration_open: boolean;
}

const DEFAULTS: SystemSettingsState = {
  site_name: "سیر",
  site_tagline: "سوپراپ سفر ایران",
  support_phone: "۰۲۱-۱۲۳۴۵۶۷۸",
  support_email: "support@seir.ir",
  default_currency: "IRT",
  default_locale: "fa",
  booking_hold_minutes: 15,
  cancellation_window_hours: 48,
  commission_rate: 15,
  maintenance_mode: false,
  registration_open: true,
};

interface AuditRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  user_id: string | null;
  data: Record<string, unknown>;
  created_at: string;
}

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SystemSettingsState | null>(null);
  const [saving, setSaving] = useState(false);
  const [auditFilter, setAuditFilter] = useState("");

  const settings = useApiQuery<SystemSettingsState>(["admin", "settings"], "/admin/settings", undefined, {
    // show anything when data arrives and no local edits yet
  });
  const audit = useApiQuery<{ items: AuditRow[]; total: number }>(
    ["admin", "audit", auditFilter],
    "/admin/audit",
    { action: auditFilter || undefined, page_size: 25 },
  );

  if (settings.data && form === null) setForm(settings.data);

  if (settings.isLoading || (form === null && !settings.error)) {
    return (
      <DashboardShell portal="admin" title="تنظیمات سیستم">
        <div className="dash-card grid place-items-center py-16"><Spinner className="h-7 w-7" /></div>
      </DashboardShell>
    );
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      await api.put("/admin/settings", form, true);
      toast.success("تنظیمات ذخیره شد.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "audit"] });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "ذخیره انجام نشد.");
    } finally {
      setSaving(false);
    }
  }

  const view = form ?? DEFAULTS;
  const update = <K extends keyof SystemSettingsState>(key: K, value: SystemSettingsState[K]) =>
    setForm((prev) => ({ ...(prev ?? DEFAULTS), [key]: value }));

  return (
    <DashboardShell
      portal="admin"
      title="تنظیمات سیستم"
      subtitle="پیکربندی سایت، خط‌مشی رزرو و مشاهده لاگ فعالیت مدیران."
    >
      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="dash-card p-5">
          <h2 className="flex items-center gap-1.5 text-sm font-black text-ink"><Settings className="h-4 w-4 text-brand-700" /> پیکربندی عمومی</h2>
          <div className="mt-4 grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">نام سایت</label><input className="field-sm" value={view.site_name} onChange={(e) => update("site_name", e.target.value)} /></div>
              <div><label className="label">شعار سایت</label><input className="field-sm" value={view.site_tagline} onChange={(e) => update("site_tagline", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">تلفن پشتیبانی</label><input className="field-sm" value={view.support_phone} onChange={(e) => update("support_phone", e.target.value)} /></div>
              <div><label className="label">ایمیل پشتیبانی</label><input className="field-sm" value={view.support_email} onChange={(e) => update("support_email", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">واحد پول پیش‌فرض</label>
                <select className="field-sm" value={view.default_currency} onChange={(e) => update("default_currency", e.target.value)}>
                  <option value="IRT">تومان (IRT)</option>
                  <option value="IRR">ریال (IRR)</option>
                </select>
              </div>
              <div><label className="label">زبان پیش‌فرض</label>
                <select className="field-sm" value={view.default_locale} onChange={(e) => update("default_locale", e.target.value)}>
                  <option value="fa">فارسی</option>
                  <option value="en">انگلیسی</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label">نگه‌داشت رزرو (دقیقه)</label><input className="field-sm" type="number" value={view.booking_hold_minutes} onChange={(e) => update("booking_hold_minutes", Number(e.target.value))} /></div>
              <div><label className="label">پنجره لغو (ساعت)</label><input className="field-sm" type="number" value={view.cancellation_window_hours} onChange={(e) => update("cancellation_window_hours", Number(e.target.value))} /></div>
              <div><label className="label">کمیسیون (٪)</label><input className="field-sm" type="number" value={view.commission_rate} onChange={(e) => update("commission_rate", Number(e.target.value))} /></div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex cursor-pointer items-center justify-between rounded-2xl bg-black/[0.03] px-4 py-3 text-xs font-bold text-ink/70">
                حالت تعمیر و نگهداری
                <input type="checkbox" checked={view.maintenance_mode} onChange={(e) => update("maintenance_mode", e.target.checked)} className="h-4 w-4 accent-brand-700" />
              </label>
              <label className="flex cursor-pointer items-center justify-between rounded-2xl bg-black/[0.03] px-4 py-3 text-xs font-bold text-ink/70">
                ثبت‌نام باز باشد
                <input type="checkbox" checked={view.registration_open} onChange={(e) => update("registration_open", e.target.checked)} className="h-4 w-4 accent-brand-700" />
              </label>
            </div>
            <button type="button" disabled={saving} onClick={save} className="btn-primary !py-2.5 !text-xs">ذخیره تنظیمات</button>
          </div>
        </div>

        <div className="dash-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-black/[0.05] px-5 py-3.5">
            <h2 className="flex items-center gap-1.5 text-sm font-black text-ink"><ScrollText className="h-4 w-4 text-brand-700" /> لاگ فعالیت مدیران</h2>
            <select className="field-sm w-auto" value={auditFilter} onChange={(e) => setAuditFilter(e.target.value)}>
              <option value="">همه اکشن‌ها</option>
              <option value="booking.status_change">تغییر وضعیت رزرو</option>
              <option value="booking.refund">بازگشت وجه</option>
            </select>
          </div>
          {audit.isLoading ? (
            <div className="grid place-items-center py-12"><Spinner /></div>
          ) : (audit.data?.items ?? []).length === 0 ? (
            <EmptyState icon={<ScrollText className="h-6 w-6" />} title="لاگی ثبت نشده است" description="عملیات‌های مدیریتی در اینجا ثبت می‌شوند." />
          ) : (
            <div className="section-list max-h-[560px] overflow-y-auto">
              {audit.data!.items.map((row) => (
                <div key={row.id} className="flex items-start justify-between gap-3 px-5 py-3 text-xs">
                  <div>
                    <div className="font-black text-ink">{row.action}</div>
                    <div className="text-[10px] text-ink/35">{row.entity_type}{row.data && Object.keys(row.data).length ? ` · ${JSON.stringify(row.data).slice(0, 60)}` : ""}</div>
                  </div>
                  <div className="shrink-0 text-left">
                    <Badge tone="slate" className="!px-2 !py-0.5 !text-[9px]">{relative(row.created_at)}</Badge>
                    <div className="mt-1 text-[9px] text-ink/30">{date(row.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
