"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bot,
  CalendarDays,
  Compass,
  Loader2,
  MapPin,
  Send,
  Sparkles,
  UserRound,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Badge, SmartImage, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { date, time, toman } from "@/lib/format";
import type { AssistantResponse, TripPlan } from "@/lib/types";
import { cn } from "@/lib/utils";

const PROMPTS = [
  "سه روز می‌خوام برم شیراز، بودجه ۱۵ میلیون و به غذا علاقه دارم",
  "یک سفر خانوادگی چهار روزه به اصفهان با بودجه ۲۰ میلیون",
  "پنج روز طبیعت‌گردی در کردستان با هزینه متوسط",
  "سلام، یه سفر خوب پیشنهاد بده",
];

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  response?: AssistantResponse;
}

function AssistantContent() {
  const params = useSearchParams();
  const router = useRouter();
  const user = useAuth((state) => state.user);
  const tokens = useAuth((state) => state.tokens);
  const initialDestination = params.get("destination") ?? undefined;
  const bottomRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "سلام! من دستیار سفر سیر هستم ✈️\nبگو کجا می‌خواهی بروی، چند روز و با چه بودجه‌ای؛ برنامه روزبه‌روز با جاذبه، غذا و زمان‌بندی واقعی برایت می‌چینم.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || sending) return;
    setInput("");
    setMessages((current) => [...current, { id: `u-${Date.now()}`, role: "user", text: message }]);
    setSending(true);
    try {
      const response = await api.post<AssistantResponse>(
        "/ai/travel-assistant",
        { message, destination_id: initialDestination || undefined, travelers: 2 },
        Boolean(tokens?.access_token),
      );
      setMessages((current) => [
        ...current,
        { id: `a-${Date.now()}`, role: "assistant", text: response.reply, response },
      ]);
    } catch (error) {
      const text = error instanceof ApiError ? error.message : "ارتباط با دستیار برقرار نشد.";
      toast.error(text);
      setMessages((current) => [...current, { id: `e-${Date.now()}`, role: "assistant", text }]);
    } finally {
      setSending(false);
    }
  }

  async function savePlan(plan: TripPlan) {
    if (!tokens?.access_token) {
      toast.error("برای ذخیره برنامه ابتدا وارد حساب شوید.");
      router.push("/login?next=/assistant");
      return;
    }
    setSaving(true);
    try {
      const start = plan.days[0]?.date ?? new Date().toISOString().slice(0, 10);
      const end = plan.days[plan.days.length - 1]?.date ?? start;
      const trip = await api.post<{ id: string }>(
        "/trips",
        {
          destination_id: plan.destination.id,
          title: plan.title,
          start_date: start,
          end_date: end,
          travelers: 2,
          budget: plan.budget || plan.estimated_total,
          interests: [],
        },
        true,
      );
      await api.post(`/trips/${trip.id}/auto-plan`, { pace: "balanced", replace_existing: true }, true);
      toast.success("برنامه در سفرهای شما ذخیره شد.");
      router.push(`/account/trips/${trip.id}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "ذخیره برنامه انجام نشد.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container-app py-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex min-h-[70vh] flex-col overflow-hidden rounded-3xl border border-black/5 bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-black/5 bg-gradient-to-l from-brand-800 to-brand-600 px-5 py-4 text-white">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/15">
                <Bot className="h-5 w-5" />
              </span>
              <div>
                <div className="text-sm font-black">دستیار سفر سیر</div>
                <div className="flex items-center gap-1.5 text-[10px] text-white/60">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> آنلاین · برنامه‌ریز هوشمند
                </div>
              </div>
            </div>
            <Badge tone="sand" className="bg-white/10 text-sand-100">AI</Badge>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
            {messages.map((message) => (
              <div key={message.id} className={cn("flex gap-2.5", message.role === "user" ? "flex-row-reverse" : "")}>
                <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-xl", message.role === "user" ? "bg-brand-700 text-white" : "bg-brand-50 text-brand-700")}>
                  {message.role === "user" ? <UserRound className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </span>
                <div className={cn("max-w-[85%] space-y-3", message.role === "user" ? "items-end" : "")}>
                  <div className={cn("whitespace-pre-line rounded-2xl px-4 py-3 text-sm leading-7", message.role === "user" ? "rounded-tr-sm bg-brand-700 text-white" : "rounded-tl-sm bg-black/[0.035] text-ink/80")}>
                    {message.text}
                  </div>

                  {message.response?.plan && (
                    <PlanPreview plan={message.response.plan} onSave={() => savePlan(message.response!.plan!)} saving={saving} />
                  )}

                  {message.response?.suggestions && message.response.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {message.response.suggestions.map((suggestion, index) => {
                        const item = suggestion as Record<string, unknown>;
                        const href =
                          typeof item.url === "string"
                            ? item.url
                            : typeof item.slug === "string"
                              ? `/destinations/${item.slug}`
                              : "#";
                        return (
                          <Link key={index} href={href} className="flex items-center gap-2 rounded-xl border border-brand-700/15 bg-brand-50/50 px-3 py-2 text-[11px] font-bold text-brand-800 hover:bg-brand-50">
                            <Compass className="h-3.5 w-3.5" />
                            {String(item.name ?? item.title ?? "پیشنهاد سیر")}
                            <ArrowLeft className="h-3 w-3" />
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  {message.response?.follow_up_questions && message.response.follow_up_questions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {message.response.follow_up_questions.map((question) => (
                        <button key={question} type="button" onClick={() => send(question)} className="rounded-full bg-white px-3 py-1.5 text-[10px] text-ink/55 ring-1 ring-black/10 transition hover:bg-brand-50 hover:text-brand-800">
                          {question}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-50 text-brand-700"><Bot className="h-4 w-4" /></span>
                <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-black/[0.035] px-4 py-3 text-xs text-ink/45">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> در حال چیدن برنامه...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-black/5 p-3 sm:p-4">
            <div className="mb-2 flex gap-1.5 overflow-x-auto no-scrollbar">
              {PROMPTS.slice(0, 3).map((prompt) => (
                <button key={prompt} type="button" onClick={() => send(prompt)} disabled={sending} className="shrink-0 rounded-full bg-black/[0.035] px-3 py-1.5 text-[10px] text-ink/55 transition hover:bg-brand-50 hover:text-brand-800">
                  {prompt}
                </button>
              ))}
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                send(input);
              }}
              className="flex items-end gap-2"
            >
              <textarea
                className="input min-h-[46px] flex-1 resize-none !py-3"
                rows={1}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    send(input);
                  }
                }}
                placeholder="مثلاً: چهار روز می‌خوام برم کیش، بودجه ۲۵ میلیون، هتل ساحلی..."
              />
              <button type="submit" disabled={sending || !input.trim()} className="btn-primary !h-[46px] !rounded-2xl !px-4">
                <Send className="h-4 w-4" />
              </button>
            </form>
            <div className="mt-1.5 text-center text-[9px] text-ink/30">دستیار سیر ممکن است اشتباه کند؛ قیمت‌ها و ظرفیت نهایی هنگام رزرو تأیید می‌شود.</div>
          </div>
        </div>

        <aside className="h-fit space-y-4">
          <div className="card p-5">
            <h2 className="flex items-center gap-2 font-black text-ink"><Sparkles className="h-4 w-4 text-brand-700" /> دستیار چه می‌کند؟</h2>
            <ul className="mt-3 space-y-2 text-[11px] leading-6 text-ink/55">
              <li>• برنامه روزبه‌روز با زمان‌بندی واقعی می‌سازد.</li>
              <li>• بودجه، علاقه و سبک سفر را در نظر می‌گیرد.</li>
              <li>• هتل و وسیله سفر پیشنهاد می‌دهد.</li>
              <li>• می‌توانی برنامه را در سفرهایت ذخیره کنی.</li>
            </ul>
          </div>
          <div className="rounded-3xl bg-brand-900 p-5 text-white">
            <h2 className="font-black">دستیار چندمدلی</h2>
            <p className="mt-2 text-[11px] leading-6 text-white/55">
              سیر از مدل‌های OpenAI، Claude و Gemini پشتیبانی می‌کند و در نبود کلید API، برنامه‌ریز قطعی داخلی پاسخ می‌دهد.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5 text-[9px]">
              {["OpenAI", "Claude", "Gemini", "Offline Planner"].map((item) => (
                <span key={item} className="rounded-full bg-white/10 px-2 py-1">{item}</span>
              ))}
            </div>
          </div>
          <div className="card p-4">
            <div className="text-[11px] font-bold text-ink">می‌خواهی برنامه را با دوستانت به اشتراک بگذاری؟</div>
            <p className="mt-1 text-[10px] leading-5 text-ink/45">برنامه را ذخیره کن و از صفحه سفر، لینک عمومی بساز.</p>
            <Link href="/account/trips" className="btn-secondary mt-3 w-full !py-2 !text-xs">سفرهای من</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function PlanPreview({ plan, onSave, saving }: { plan: TripPlan; onSave: () => void; saving: boolean }) {
  const hotel = plan.suggested_hotel as Record<string, unknown> | null;
  return (
    <div className="overflow-hidden rounded-2xl border border-brand-700/15 bg-white shadow-sm">
      <div className="bg-brand-50/60 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs font-black text-ink">{plan.title}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-ink/45">
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {plan.destination.name_local || plan.destination.name}</span>
              <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {new Intl.NumberFormat("fa-IR").format(plan.days.length)} روز</span>
            </div>
          </div>
          <div className="text-left">
            <div className="text-[9px] text-ink/40">برآورد کل</div>
            <div className="text-xs font-black text-brand-800">{toman(plan.estimated_total, true)}</div>
          </div>
        </div>
        {plan.budget > 0 && (
          <div className={cn("mt-2 rounded-lg px-2 py-1 text-[9px]", plan.budget_remaining >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
            {plan.budget_remaining >= 0
              ? `${toman(plan.budget_remaining, true)} از بودجه باقی می‌ماند`
              : `${toman(Math.abs(plan.budget_remaining), true)} بیش از بودجه`}
          </div>
        )}
      </div>
      <div className="max-h-[340px] space-y-2 overflow-y-auto p-3">
        {plan.days.map((day) => (
          <div key={day.day_number} className="rounded-xl bg-black/[0.02] p-2.5">
            <div className="flex items-center justify-between text-[10px] font-bold text-ink">
              <span>روز {new Intl.NumberFormat("fa-IR").format(day.day_number)} · {day.title}</span>
              <span className="text-ink/35">{date(day.date)}</span>
            </div>
            <div className="mt-1.5 space-y-1">
              {day.activities.slice(0, 5).map((activity, index) => (
                <div key={index} className="flex items-start gap-2 text-[10px]">
                  <span className="w-9 shrink-0 font-mono text-ink/35">{activity.time}</span>
                  <span className="flex-1 text-ink/65">{activity.title}</span>
                  {activity.cost ? <span className="shrink-0 text-ink/30">{toman(activity.cost, true)}</span> : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-black/5 px-3 py-2.5">
        <button type="button" onClick={onSave} disabled={saving} className="btn-primary !rounded-xl !px-3 !py-2 !text-[10px]">
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wallet className="h-3 w-3" />} ذخیره در سفرهای من
        </button>
        {hotel && typeof hotel.slug === "string" && (
          <Link href={`/stays/${hotel.slug}`} className="btn-secondary !rounded-xl !px-3 !py-2 !text-[10px]">
            <MapPin className="h-3 w-3" /> هتل پیشنهادی
          </Link>
        )}
        {typeof hotel?.name === "string" && (
          <span className="text-[9px] text-ink/40">{String(hotel.name)} · {toman(Number(hotel.price ?? 0), true)}</span>
        )}
      </div>
    </div>
  );
}

export default function AssistantPage() {
  return (
    <Suspense
      fallback={
        <div className="container-app grid min-h-[60vh] place-items-center">
          <Spinner className="h-8 w-8" />
        </div>
      }
    >
      <AssistantContent />
    </Suspense>
  );
}
