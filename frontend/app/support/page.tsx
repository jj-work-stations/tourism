"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  Headphones,
  LifeBuoy,
  MessageSquarePlus,
  Phone,
  Send,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";

import { PageHero, Badge, EmptyState, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { useApiQuery } from "@/lib/hooks";
import { relative } from "@/lib/format";
import type { Page, SupportTicket } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FAQ {
  question: string;
  answer: string;
}

const CATEGORIES = [
  { value: "booking", label: "رزرو و بلیت" },
  { value: "payment", label: "پرداخت و بازگشت وجه" },
  { value: "account", label: "حساب کاربری" },
  { value: "provider", label: "ارائه‌دهنده" },
  { value: "general", label: "سایر موارد" },
];

const STATUS: Record<string, { label: string; tone: string }> = {
  open: { label: "باز", tone: "amber" },
  in_progress: { label: "در حال بررسی", tone: "sky" },
  closed: { label: "بسته", tone: "slate" },
};

export default function SupportPage() {
  const user = useAuth((state) => state.user);
  const hydrated = useAuth((state) => state.hydrated);
  const queryClient = useQueryClient();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("booking");
  const [priority, setPriority] = useState("normal");
  const [sending, setSending] = useState(false);

  const faq = useQuery({
    queryKey: ["support", "faq"],
    queryFn: () => api.get<FAQ[]>("/support/faq"),
  });
  const tickets = useApiQuery<Page<SupportTicket>>(["support", "tickets"], "/support/tickets", { page_size: 20 });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) {
      toast.error("برای ثبت تیکت وارد حساب شوید.");
      return;
    }
    setSending(true);
    try {
      await api.post("/support/tickets", { subject, message, category, priority }, true);
      toast.success("تیکت شما ثبت شد. تیم پشتیبانی به‌زودی پاسخ می‌دهد.");
      setSubject("");
      setMessage("");
      await queryClient.invalidateQueries({ queryKey: ["support", "tickets"] });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "ثبت تیکت انجام نشد.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <PageHero
        title="پشتیبانی سیر"
        description="۲۴ ساعت شبانه‌روز در کنار شما هستیم؛ از سؤال درباره رزرو تا کمک فوری در سفر."
        badge={
          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-[11px] font-bold text-brand-800">
            <Headphones className="h-3.5 w-3.5" /> تیم پشتیبانی آنلاین
          </span>
        }
      >
        <div className="flex flex-wrap gap-2">
          <a href="tel:02112345678" className="btn-primary !py-2.5 !text-xs"><Phone className="h-4 w-4" /> ۰۲۱-۱۲۳۴۵۶۷۸</a>
          <span className="btn-secondary !py-2.5 !text-xs">پاسخ‌گویی: ۲۴/۷</span>
        </div>
      </PageHero>

      <div className="container-app grid gap-6 py-8 lg:grid-cols-[1.1fr_.9fr]">
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-black text-ink"><LifeBuoy className="h-5 w-5 text-brand-700" /> سوالات متداول</h2>
          {faq.isLoading ? (
            <div className="grid place-items-center py-10"><Spinner /></div>
          ) : (
            <div className="space-y-2">
              {(faq.data ?? []).map((item, index) => (
                <div key={item.question} className="card overflow-hidden">
                  <button type="button" onClick={() => setOpenFaq(openFaq === index ? null : index)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right">
                    <span className="text-xs font-bold text-ink">{item.question}</span>
                    <ChevronDown className={cn("h-4 w-4 shrink-0 text-ink/30 transition", openFaq === index && "rotate-180")} />
                  </button>
                  {openFaq === index && <p className="border-t border-black/5 px-4 py-3 text-[11px] leading-6 text-ink/55">{item.answer}</p>}
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
              <div className="text-xs font-black text-rose-700">شماره‌های اضطراری</div>
              <div className="mt-2 space-y-1 text-[11px] text-rose-700/80">
                <div className="flex justify-between"><span>اورژانس</span><b>۱۱۵</b></div>
                <div className="flex justify-between"><span>پلیس</span><b>۱۱۰</b></div>
                <div className="flex justify-between"><span>آتش‌نشانی</span><b>۱۲۵</b></div>
              </div>
            </div>
            <div className="rounded-2xl border border-black/5 bg-white p-4">
              <div className="text-xs font-black text-ink">در سفر مشکلی پیش آمد؟</div>
              <p className="mt-1 text-[10px] leading-5 text-ink/45">با شماره پشتیبانی تماس بگیرید یا تیکت فوری ثبت کنید. تیم ما در تمام ساعات پاسخ‌گوست.</p>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <form onSubmit={submit} className="card p-5">
            <h2 className="flex items-center gap-2 font-black text-ink"><MessageSquarePlus className="h-4 w-4 text-brand-700" /> ثبت تیکت جدید</h2>
            {hydrated && !user && (
              <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-700">برای ثبت تیکت ابتدا وارد حساب خود شوید.</p>
            )}
            <div className="mt-3 space-y-3">
              <label className="block"><span className="label">موضوع</span><input className="input" value={subject} onChange={(event) => setSubject(event.target.value)} required minLength={3} placeholder="مثلاً مشکل در پرداخت رزرو" /></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="label">دسته‌بندی</span>
                  <select className="input" value={category} onChange={(event) => setCategory(event.target.value)}>
                    {CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="label">اولویت</span>
                  <select className="input" value={priority} onChange={(event) => setPriority(event.target.value)}>
                    <option value="low">کم</option>
                    <option value="normal">معمولی</option>
                    <option value="high">بالا</option>
                    <option value="urgent">فوری</option>
                  </select>
                </label>
              </div>
              <label className="block"><span className="label">توضیحات</span><textarea className="input min-h-[110px]" value={message} onChange={(event) => setMessage(event.target.value)} required minLength={5} placeholder="جزئیات مشکل یا سؤال خود را بنویسید..." /></label>
              <button type="submit" disabled={sending || !user} className="btn-primary w-full"><Send className="h-4 w-4" /> {sending ? "در حال ارسال..." : "ارسال تیکت"}</button>
            </div>
          </form>

          {user && (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
                <h2 className="flex items-center gap-2 text-sm font-black text-ink"><Ticket className="h-4 w-4 text-brand-700" /> تیکت‌های من</h2>
                <span className="text-[10px] text-ink/40">{new Intl.NumberFormat("fa-IR").format(tickets.data?.total ?? 0)} تیکت</span>
              </div>
              <div className="divide-y divide-black/[0.04]">
                {(tickets.data?.items ?? []).map((ticket) => {
                  const status = STATUS[ticket.status] ?? { label: ticket.status, tone: "slate" };
                  return (
                    <div key={ticket.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-bold text-ink">{ticket.subject}</div>
                          <div className="mt-0.5 text-[10px] text-ink/40">{relative(ticket.created_at)} · {ticket.category}</div>
                        </div>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </div>
                      {ticket.response && <p className="mt-2 rounded-lg bg-brand-50/60 px-2.5 py-2 text-[10px] leading-5 text-brand-900">{ticket.response}</p>}
                    </div>
                  );
                })}
                {tickets.data && tickets.data.items.length === 0 && (
                  <div className="px-4 py-8 text-center text-xs text-ink/40">تیکتی ثبت نکرده‌اید.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
