"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BellRing, Headset, SendHorizonal } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { Badge, EmptyState, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { date, number, relative } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks";
import { cn } from "@/lib/utils";

interface TicketRow {
  id: string;
  user_name: string;
  subject: string;
  category: string;
  message: string;
  status: string;
  priority: string;
  response: string | null;
  created_at: string;
}

const STATUS_META: Record<string, { label: string; tone: string }> = {
  open: { label: "باز", tone: "amber" },
  answered: { label: "پاسخ داده", tone: "emerald" },
  in_progress: { label: "در حال بررسی", tone: "sky" },
  resolved: { label: "حل شده", tone: "emerald" },
  closed: { label: "بسته", tone: "slate" },
};

const STATUS_CHIPS = [
  { value: "", label: "همه" },
  { value: "open", label: "باز" },
  { value: "answered", label: "پاسخ داده" },
  { value: "in_progress", label: "در بررسی" },
  { value: "resolved", label: "حل شده" },
  { value: "closed", label: "بسته" },
];

const CATEGORY_LABEL: Record<string, string> = {
  general: "عمومی",
  booking: "رزرو",
  payment: "پرداخت",
  refund: "بازگشت وجه",
  technical: "فنی",
  suggestion: "پیشنهاد",
};

export default function AdminSupportPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [broadcast, setBroadcast] = useState({ title: "", body: "", role: "", notification_type: "system" });
  const [sending, setSending] = useState(false);

  const tickets = useApiQuery<{ items: TicketRow[]; total: number }>(
    ["admin", "support", status],
    "/admin/support",
    { status: status || undefined, page_size: 20 },
  );
  const stats = useApiQuery<{ by_status: Record<string, number> }>(["admin", "support", "stats"], "/admin/support/stats");

  async function respond(ticket: TicketRow) {
    const response = drafts[ticket.id];
    if (!response || !response.trim()) { toast.error("متن پاسخ را وارد کنید."); return; }
    setBusyId(ticket.id);
    try {
      await api.patch(`/admin/support/${ticket.id}`, { response }, true);
      toast.success("پاسخ ارسال شد.");
      setDrafts((prev) => ({ ...prev, [ticket.id]: "" }));
      await queryClient.invalidateQueries({ queryKey: ["admin", "support"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "support", "stats"] });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "ارسال انجام نشد.");
    } finally {
      setBusyId(null);
    }
  }

  async function changeStatus(ticket: TicketRow, value: string) {
    setBusyId(ticket.id);
    try {
      await api.patch(`/admin/support/${ticket.id}`, { status: value }, true);
      toast.success("وضعیت تیکت تغییر کرد.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "support"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "support", "stats"] });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "عملیات انجام نشد.");
    } finally {
      setBusyId(null);
    }
  }

  async function sendBroadcast() {
    if (!broadcast.title.trim() || !broadcast.body.trim()) { toast.error("عنوان و متن اعلان الزامی است."); return; }
    setSending(true);
    try {
      const result = await api.post<{ message: string }>("/admin/notifications/broadcast", broadcast, true);
      toast.success(result.message || "اعلان ارسال شد.");
      setBroadcast({ title: "", body: "", role: "", notification_type: "system" });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "ارسال انجام نشد.");
    } finally {
      setSending(false);
    }
  }

  return (
    <DashboardShell
      portal="admin"
      title="پشتیبانی و اعلان‌ها"
      subtitle="مدیریت تیکت‌های کاربران و ارسال اعلان گروهی به مسافران."
    >
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-4">
            {["open", "in_progress", "answered", "closed"].map((value) => (
              <div key={value} className="kpi !p-4 text-center">
                <div className="text-xl font-black text-ink">{number(stats.data?.by_status?.[value] ?? 0)}</div>
                <div className="text-[10px] text-ink/45">{STATUS_META[value]?.label ?? value}</div>
              </div>
            ))}
          </div>

          <div className="dash-card mb-1 flex flex-wrap gap-2 p-3">
            {STATUS_CHIPS.map((chip) => (
              <button
                key={chip.value}
                type="button"
                onClick={() => setStatus(chip.value)}
                className={cn(
                  "rounded-xl border px-3 py-1.5 text-[11px] font-bold transition",
                  status === chip.value ? "border-brand-700 bg-brand-700 text-white" : "border-black/[0.07] bg-white text-ink/55 hover:text-ink",
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {tickets.isLoading ? (
              <div className="dash-card grid place-items-center py-16"><Spinner className="h-7 w-7" /></div>
            ) : (tickets.data?.items ?? []).length === 0 ? (
              <EmptyState icon={<Headset className="h-6 w-6" />} title="تیکتی ثبت نشده است" />
            ) : (
              (tickets.data?.items ?? []).map((ticket) => {
                const meta = STATUS_META[ticket.status] ?? { label: ticket.status, tone: "slate" };
                return (
                  <div key={ticket.id} className="dash-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs font-black text-ink">{ticket.subject}
                          <Badge tone={meta.tone} className="!py-0.5 !text-[9.5px]">{meta.label}</Badge>
                        </div>
                        <div className="mt-0.5 text-[10px] text-ink/35">
                          {ticket.user_name} · {CATEGORY_LABEL[ticket.category] || ticket.category} · {relative(ticket.created_at)} ({date(ticket.created_at)})
                        </div>
                      </div>
                      <select
                        value={ticket.status}
                        disabled={busyId === ticket.id}
                        onChange={(event) => changeStatus(ticket, event.target.value)}
                        className="rounded-lg border border-black/10 bg-white px-2 py-1 text-[10.5px] font-semibold outline-none focus:border-brand-600"
                      >
                        {["open", "in_progress", "answered", "resolved", "closed"].map((value) => (
                          <option key={value} value={value}>{STATUS_META[value]?.label ?? value}</option>
                        ))}
                      </select>
                    </div>
                    <p className="mt-2 rounded-2xl bg-black/[0.025] p-3 text-xs leading-6 text-ink/70">{ticket.message}</p>
                    {ticket.response && (
                      <p className="mt-2 rounded-2xl border border-emerald-200/50 bg-emerald-50/70 p-3 text-xs leading-6 text-emerald-900">
                        ✓ پاسخ پشتیبانی: {ticket.response}
                      </p>
                    )}
                    <div className="mt-3 flex gap-2">
                      <textarea
                        className="field-sm min-h-[64px] flex-1"
                        placeholder="پاسخ شما..."
                        value={drafts[ticket.id] ?? ""}
                        onChange={(event) => setDrafts((prev) => ({ ...prev, [ticket.id]: event.target.value }))}
                      />
                      <button type="button" disabled={busyId === ticket.id} onClick={() => respond(ticket)} className="btn-primary !h-fit self-end !px-3 !py-2.5 !text-xs shrink-0">
                        <SendHorizonal className="h-4 w-4" /> ارسال
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div>
          <div className="panel-gold p-5">
            <h2 className="flex items-center gap-1.5 text-sm font-black text-ink"><BellRing className="h-4 w-4 text-gold-600" /> اعلان گروهی</h2>
            <p className="mt-1 text-[11px] leading-5 text-ink/50">اعلان مستقیم به اپ کاربران هدف ارسال می‌شود.</p>
            <div className="mt-4 grid gap-3">
              <input className="field-sm" placeholder="عنوان اعلان *" value={broadcast.title} onChange={(e) => setBroadcast({ ...broadcast, title: e.target.value })} />
              <textarea className="field-sm min-h-[100px]" placeholder="متن اعلان *" value={broadcast.body} onChange={(e) => setBroadcast({ ...broadcast, body: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <select className="field-sm" value={broadcast.role} onChange={(e) => setBroadcast({ ...broadcast, role: e.target.value })}>
                  <option value="">همه کاربران</option>
                  <option value="traveler">فقط مسافران</option>
                  <option value="provider">فقط ارائه‌دهندگان</option>
                </select>
                <select className="field-sm" value={broadcast.notification_type} onChange={(e) => setBroadcast({ ...broadcast, notification_type: e.target.value })}>
                  <option value="system">سیستمی</option>
                  <option value="discount">تخفیف</option>
                  <option value="price_drop">کاهش قیمت</option>
                  <option value="trip_reminder">یادآوری سفر</option>
                  <option value="weather">آب‌وهوا</option>
                </select>
              </div>
              <button type="button" disabled={sending} onClick={sendBroadcast} className="btn-primary !py-2.5 !text-xs">ارسال اعلان</button>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
