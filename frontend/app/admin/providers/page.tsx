"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ShoppingBag, Star } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { Badge, EmptyState, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { number } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks";
import { cn } from "@/lib/utils";

interface ProviderRow {
  id: string;
  name: string;
  slug: string;
  type: string;
  rating: number;
  is_verified: boolean;
  is_active: boolean;
  commission_rate: number;
}

const TYPE_LABEL: Record<string, string> = {
  hotel: "هتل",
  accommodation: "اقامتگاه",
  accommodation_provider: "اقامتگاه",
  transport: "حمل‌ونقل",
  transportation: "حمل‌ونقل",
  tour: "آژانس/تور",
  agency: "آژانس/تور",
  restaurant: "رستوران",
  experience: "تجربه",
  guide: "راهنمای گردشگری",
};

export default function AdminProvidersPage() {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const providers = useApiQuery<ProviderRow[]>(["admin", "providers"], "/admin/providers");

  async function update(provider: ProviderRow, payload: Record<string, unknown>) {
    setBusyId(provider.id);
    try {
      await api.patch(`/admin/providers/${provider.id}`, payload, true);
      toast.success("ارائه‌دهنده به‌روزرسانی شد.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "providers"] });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "عملیات انجام نشد.");
    } finally {
      setBusyId(null);
    }
  }

  const rows = providers.data ?? [];

  return (
    <DashboardShell
      portal="admin"
      title="ارائه‌دهندگان خدمات"
      subtitle="تأیید هویت ارائه‌دهندگان، فعال/غیرفعال‌سازی و تعیین نرخ کمیسیون."
    >
      {providers.isLoading ? (
        <div className="dash-card grid place-items-center py-16"><Spinner className="h-7 w-7" /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<ShoppingBag className="h-6 w-6" />} title="ارائه‌دهنده‌ای ثبت نشده است" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((provider) => (
            <div key={provider.id} className="dash-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-ink">{provider.name}</div>
                  <div className="mt-0.5 text-[10px] text-ink/40">@{provider.slug}</div>
                </div>
                <Badge tone={provider.is_verified ? "emerald" : "amber"}>
                  {provider.is_verified ? "تأیید شده" : "در انتظار تأیید"}
                </Badge>
              </div>
              <div className="mt-2 text-[11px] text-ink/45">{TYPE_LABEL[provider.type] || provider.type}</div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-center text-[10px]">
                <div className="rounded-2xl bg-black/[0.025] p-2.5">
                  <span className="flex items-center justify-center gap-1 text-ink/45">امتیاز</span>
                  <div className="mt-0.5 flex items-center justify-center gap-1 font-black text-ink">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {provider.rating.toFixed(1)}
                  </div>
                </div>
                <div className="rounded-2xl bg-black/[0.025] p-2.5">
                  <div className="text-ink/45">وضعیت</div>
                  <div className={cn("mt-0.5 font-black", provider.is_active ? "text-emerald-600" : "text-rose-500")}>
                    {provider.is_active ? "فعال" : "غیرفعال"}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <label className="flex flex-1 items-center gap-2 rounded-2xl bg-black/[0.025] px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={provider.commission_rate}
                    disabled={busyId === provider.id}
                    onChange={(event) => update(provider, { commission_rate: Number(event.target.value) })}
                    className="w-12 bg-transparent text-center text-[12px] font-black text-ink outline-none"
                  />
                  <span className="text-[10px] text-ink/45">٪ کمیسیون</span>
                </label>
                <button
                  type="button"
                  disabled={busyId === provider.id}
                  onClick={() => update(provider, { is_verified: !provider.is_verified })}
                  className="btn-xs-primary"
                >
                  {provider.is_verified ? "لغو تأیید" : "تأیید"}
                </button>
                <button
                  type="button"
                  disabled={busyId === provider.id}
                  onClick={() => update(provider, { is_active: !provider.is_active })}
                  className={cn("btn-xs-danger", provider.is_active && "bg-emerald-50 text-emerald-600 hover:bg-emerald-100")}
                >
                  {provider.is_active ? "غیرفعال" : "فعال"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
