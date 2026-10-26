"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BadgePercent, Megaphone, PlusCircle } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { Badge, EmptyState, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { date, number, toman } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks";
import { cn } from "@/lib/utils";

interface Campaign {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  badge: string | null;
  placement: string;
  is_active: boolean;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
}

interface CouponRow {
  id: string;
  code: string;
  title: string;
  coupon_type: string;
  value: number;
  min_amount: number;
  max_discount: number | null;
  usage_limit: number;
  used_count: number;
  per_user_limit: number;
  valid_from: string | null;
  valid_to: string | null;
  is_active: boolean;
}

const emptyCampaign = { title: "", subtitle: "", badge: "", placement: "home_hero", cta_label: "", cta_url: "", image_url: "", sort_order: 0 };

export default function AdminMarketingPage() {
  const queryClient = useQueryClient();
  const [campaignForm, setCampaignForm] = useState<typeof emptyCampaign & { id?: string }>(emptyCampaign);
  const [couponForm, setCouponForm] = useState({ code: "", title: "", coupon_type: "percent", value: "", min_amount: "", valid_to: "" });
  const [couponBusy, setCouponBusy] = useState(false);

  const campaigns = useApiQuery<Campaign[]>(["admin", "campaigns"], "/admin/campaigns");
  const coupons = useApiQuery<CouponRow[]>(["admin", "coupons"], "/admin/coupons");

  async function saveCampaign() {
    if (!campaignForm.title.trim()) { toast.error("عنوان کمپین الزامی است."); return; }
    try {
      await api.post("/admin/campaigns", campaignForm, true);
      toast.success("کمپین ذخیره شد.");
      setCampaignForm(emptyCampaign);
      await queryClient.invalidateQueries({ queryKey: ["admin", "campaigns"] });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "ذخیره انجام نشد.");
    }
  }

  async function toggleCampaign(campaign: Campaign) {
    try {
      await api.post("/admin/campaigns", { id: campaign.id, is_active: !campaign.is_active }, true);
      await queryClient.invalidateQueries({ queryKey: ["admin", "campaigns"] });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "عملیات انجام نشد.");
    }
  }

  async function saveCoupon() {
    if (!couponForm.code.trim() || !couponForm.value) { toast.error("کد و مقدار تخفیف الزامی است."); return; }
    setCouponBusy(true);
    try {
      await api.post(
        "/admin/coupons",
        {
          code: couponForm.code.toUpperCase(),
          title: couponForm.title || undefined,
          coupon_type: couponForm.coupon_type,
          value: Number(couponForm.value),
          min_amount: couponForm.min_amount ? Number(couponForm.min_amount) : undefined,
          valid_to: couponForm.valid_to || undefined,
        },
        true,
      );
      toast.success("کد تخفیف ایجاد شد.");
      setCouponForm({ code: "", title: "", coupon_type: "percent", value: "", min_amount: "", valid_to: "" });
      await queryClient.invalidateQueries({ queryKey: ["admin", "coupons"] });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "ایجاد انجام نشد.");
    } finally {
      setCouponBusy(false);
    }
  }

  async function toggleCoupon(coupon: CouponRow) {
    try {
      await api.patch(`/admin/coupons/${coupon.id}`, { is_active: !coupon.is_active }, true);
      await queryClient.invalidateQueries({ queryKey: ["admin", "coupons"] });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "عملیات انجام نشد.");
    }
  }

  return (
    <DashboardShell
      portal="admin"
      title="کمپین‌ها و کدهای تخفیف"
      subtitle="مدیریت بنرهای سایت، کمپین‌های ویژه و کدهای تخفیف مسافران."
    >
      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        {/* Campaigns */}
        <div className="space-y-4">
          <div className="dash-card p-5">
            <h2 className="flex items-center gap-1.5 text-sm font-black text-ink"><PlusCircle className="h-4 w-4 text-brand-700" /> {campaignForm.id ? "ویرایش کمپین" : "کمپین جدید"}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input className="field-sm" placeholder="عنوان *" value={campaignForm.title} onChange={(e) => setCampaignForm({ ...campaignForm, title: e.target.value })} />
              <input className="field-sm" placeholder="برچسب (مثلاً تابستانی)" value={campaignForm.badge} onChange={(e) => setCampaignForm({ ...campaignForm, badge: e.target.value })} />
              <input className="field-sm sm:col-span-2" placeholder="زیرعنوان" value={campaignForm.subtitle} onChange={(e) => setCampaignForm({ ...campaignForm, subtitle: e.target.value })} />
              <input className="field-sm sm:col-span-2" placeholder="آدرس تصویر" value={campaignForm.image_url} onChange={(e) => setCampaignForm({ ...campaignForm, image_url: e.target.value })} />
              <input className="field-sm" placeholder="متن دکمه" value={campaignForm.cta_label} onChange={(e) => setCampaignForm({ ...campaignForm, cta_label: e.target.value })} />
              <input className="field-sm" placeholder="لینک دکمه" value={campaignForm.cta_url} onChange={(e) => setCampaignForm({ ...campaignForm, cta_url: e.target.value })} />
              <select className="field-sm" value={campaignForm.placement} onChange={(e) => setCampaignForm({ ...campaignForm, placement: e.target.value })}>
                <option value="home_hero">هیرو صفحه اصلی</option>
                <option value="home_banner">بنر میانی خانه</option>
                <option value="sidebar">ستون کنار</option>
              </select>
              <input className="field-sm" placeholder="ترتیب نمایش" type="number" value={campaignForm.sort_order} onChange={(e) => setCampaignForm({ ...campaignForm, sort_order: Number(e.target.value) })} />
            </div>
            <button type="button" onClick={saveCampaign} className="btn-primary mt-4 !py-2.5 !text-xs">ذخیره کمپین</button>
          </div>

          <div className="dash-card overflow-hidden">
            <div className="border-b border-black/[0.05] px-5 py-3.5"><h2 className="flex items-center gap-1.5 text-sm font-black text-ink"><Megaphone className="h-4 w-4 text-brand-700" /> کمپین‌ها</h2></div>
            {campaigns.isLoading ? (
              <div className="grid place-items-center py-10"><Spinner /></div>
            ) : (campaigns.data ?? []).length === 0 ? (
              <EmptyState icon={<Megaphone className="h-6 w-6" />} title="کمپینی ثبت نشده است" />
            ) : (
              <div className="section-list">
                {(campaigns.data ?? []).map((campaign) => (
                  <div key={campaign.id} className="flex items-center justify-between gap-3 px-5 py-3 text-xs">
                    <div className="min-w-0">
                      <div className="truncate font-black text-ink">{campaign.title}</div>
                      <div className="text-[10px] text-ink/35">{campaign.placement} · {campaign.starts_at ? date(campaign.starts_at) : "—"}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleCampaign(campaign)}
                      className={cn(campaign.is_active ? "btn-xs-primary" : "btn-xs-soft")}
                    >
                      {campaign.is_active ? "فعال" : "غیرفعال"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Coupons */}
        <div className="space-y-4">
          <div className="panel-gold p-5">
            <h2 className="flex items-center gap-1.5 text-sm font-black text-ink"><BadgePercent className="h-4 w-4 text-gold-600" /> کد تخفیف جدید</h2>
            <div className="mt-4 grid gap-3">
              <input className="field-sm" placeholder="کد (مثلاً NOWRUZ1405) *" value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })} />
              <input className="field-sm" placeholder="عنوان" value={couponForm.title} onChange={(e) => setCouponForm({ ...couponForm, title: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <select className="field-sm" value={couponForm.coupon_type} onChange={(e) => setCouponForm({ ...couponForm, coupon_type: e.target.value })}>
                  <option value="percent">درصدی</option>
                  <option value="fixed">مبلغ ثابت</option>
                </select>
                <input className="field-sm" placeholder={couponForm.coupon_type === "percent" ? "درصد تخفیف *" : "مبلغ (تومان) *"} type="number" value={couponForm.value} onChange={(e) => setCouponForm({ ...couponForm, value: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input className="field-sm" placeholder="حداقل سبد خرید" type="number" value={couponForm.min_amount} onChange={(e) => setCouponForm({ ...couponForm, min_amount: e.target.value })} />
                <input className="field-sm" placeholder="تا تاریخ" type="date" value={couponForm.valid_to} onChange={(e) => setCouponForm({ ...couponForm, valid_to: e.target.value })} />
              </div>
              <button type="button" disabled={couponBusy} onClick={saveCoupon} className="btn-primary !py-2.5 !text-xs">ایجاد کد تخفیف</button>
            </div>
          </div>

          <div className="dash-card overflow-hidden">
            {coupons.isLoading ? (
              <div className="grid place-items-center py-10"><Spinner /></div>
            ) : (coupons.data ?? []).length === 0 ? (
              <EmptyState icon={<BadgePercent className="h-6 w-6" />} title="کد تخفیفی ثبت نشده است" />
            ) : (
              <div className="section-list">
                {(coupons.data ?? []).map((coupon) => (
                  <div key={coupon.id} className="flex items-center justify-between gap-3 px-5 py-3 text-xs">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 font-mono font-black text-ink">{coupon.code}
                        <Badge tone={coupon.coupon_type === "percent" ? "sand" : "brand"} className="!py-0 !text-[9px]">
                          {coupon.coupon_type === "percent" ? `${number(coupon.value)}٪` : toman(coupon.value)}
                        </Badge>
                      </div>
                      <div className="text-[10px] text-ink/35">استفاده: {number(coupon.used_count)}/{number(coupon.usage_limit)} · {coupon.valid_to ? date(coupon.valid_to) : "بدون انقضا"}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleCoupon(coupon)}
                      className={cn(coupon.is_active ? "btn-xs-primary" : "btn-xs-soft")}
                    >
                      {coupon.is_active ? "فعال" : "غیرفعال"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
