"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Award,
  Coins,
  Gift,
  Plus,
  Sparkles,
  Target,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { AccountShell } from "@/components/account-shell";
import { RequireAuth } from "@/components/require-auth";
import { Badge, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useApiQuery } from "@/lib/hooks";
import { date, levelLabel, number, relative, toman } from "@/lib/format";
import type { Gamification, Page, Wallet as WalletType, WalletTransaction } from "@/lib/types";
import { cn } from "@/lib/utils";

const TX_LABELS: Record<string, string> = {
  topup: "شارژ کیف پول",
  payment: "پرداخت رزرو",
  refund: "بازگشت وجه",
  reward: "پاداش",
  withdrawal: "برداشت",
  cashback: "کش‌بک",
};

function WalletContent() {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(500_000);
  const [busy, setBusy] = useState(false);

  const wallet = useApiQuery<WalletType>(["account", "wallet"], "/wallet");
  const transactions = useApiQuery<Page<WalletTransaction>>(["account", "wallet", "transactions"], "/wallet/transactions", { page_size: 30 });
  const gamification = useApiQuery<Gamification>(["account", "gamification"], "/gamification/profile");

  async function topUp(value: number) {
    setBusy(true);
    try {
      await api.post("/wallet/top-up", { amount: value }, true);
      toast.success("کیف پول شارژ شد.");
      await queryClient.invalidateQueries({ queryKey: ["account", "wallet"] });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "شارژ کیف پول انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  const progress = gamification.data?.level_progress ?? 0;

  return (
    <AccountShell title="کیف پول و پاسپورت سفر" description="موجودی، تراکنش‌ها، امتیازها و دستاوردهای سفر شما.">
      <div className="grid gap-4 md:grid-cols-[1.1fr_.9fr]">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-brand-900 to-brand-700 p-6 text-white">
          <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full border-[24px] border-white/5" />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs text-white/60"><Wallet className="h-4 w-4" /> موجودی کیف پول</div>
            <div className="mt-2 text-3xl font-black">{toman(wallet.data?.balance ?? 0)}</div>
            <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
              <span className="rounded-full bg-white/10 px-2.5 py-1">{number(wallet.data?.points ?? 0)} امتیاز</span>
              <span className="rounded-full bg-white/10 px-2.5 py-1">{number(wallet.data?.xp ?? 0)} XP</span>
              <span className="rounded-full bg-white/10 px-2.5 py-1">سطح {levelLabel[wallet.data?.level ?? "bronze"] ?? wallet.data?.level}</span>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {[200_000, 500_000, 1_000_000].map((value) => (
                <button key={value} type="button" disabled={busy} onClick={() => topUp(value)} className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-[11px] font-bold transition hover:bg-white/20">
                  <Plus className="mb-0.5 ml-1 inline h-3 w-3" /> {toman(value, true)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-black text-ink"><Coins className="h-4 w-4 text-amber-500" /> پاسپورت سفر</h2>
            <Badge tone="sand">{levelLabel[gamification.data?.level ?? "bronze"] ?? "برنز"}</Badge>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/[0.06]">
            <div className="h-full rounded-full bg-gradient-to-l from-brand-700 to-brand-400" style={{ width: `${Math.min(100, Math.round(progress * 100))}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-ink/45">
            <span>{number(gamification.data?.xp ?? 0)} XP</span>
            <span>{number(gamification.data?.xp_to_next_level ?? 0)} XP تا سطح بعد</span>
          </div>
          <div className="mt-4 flex gap-2">
            <label className="block flex-1">
              <span className="label">مبلغ شارژ دلخواه</span>
              <input type="number" min={10_000} step={10_000} className="input" value={amount} onChange={(event) => setAmount(Number(event.target.value))} />
            </label>
            <button type="button" disabled={busy || amount < 10_000} onClick={() => topUp(amount)} className="btn-primary mt-6 !rounded-xl !px-4 !text-xs">
              شارژ
            </button>
          </div>
          <p className="mt-2 text-[10px] leading-5 text-ink/35">این پرداخت در حالت سندباکس است و از درگاه واقعی استفاده نمی‌شود.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-black/5 px-5 py-3">
            <h2 className="text-sm font-black text-ink">تراکنش‌های اخیر</h2>
            <span className="text-[10px] text-ink/40">{number(transactions.data?.total ?? 0)} تراکنش</span>
          </div>
          <div className="divide-y divide-black/[0.04]">
            {(transactions.data?.items ?? []).map((item) => {
              const positive = item.amount >= 0;
              return (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <span className={cn("grid h-9 w-9 place-items-center rounded-xl", positive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
                    {positive ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-ink">{TX_LABELS[item.transaction_type] ?? (item.description || item.transaction_type)}</div>
                    <div className="mt-0.5 text-[10px] text-ink/40">{relative(item.created_at)} · مانده {toman(item.balance_after, true)}</div>
                  </div>
                  <div className={cn("text-xs font-black", positive ? "text-emerald-600" : "text-rose-600")}>
                    {positive ? "+" : "−"} {toman(Math.abs(item.amount), true)}
                  </div>
                </div>
              );
            })}
            {transactions.data && transactions.data.items.length === 0 && (
              <div className="px-4 py-10 text-center text-xs text-ink/40">تراکنشی ثبت نشده است.</div>
            )}
            {transactions.isLoading && <div className="grid place-items-center py-10"><Spinner /></div>}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="flex items-center gap-2 font-black text-ink"><Award className="h-4 w-4 text-amber-500" /> دستاوردها</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(gamification.data?.achievements ?? []).slice(0, 6).map((item) => (
                <div key={item.id} className={cn("rounded-2xl border p-3", item.unlocked ? "border-amber-200 bg-amber-50/70" : "border-black/5 bg-black/[0.015] opacity-60")}>
                  <div className="text-xl">{item.icon}</div>
                  <div className="mt-1 text-[11px] font-bold text-ink">{item.title}</div>
                  <div className="mt-0.5 text-[9px] leading-4 text-ink/40">{item.description}</div>
                  <div className="mt-1 text-[9px] font-bold text-amber-600">+{number(item.xp_reward)} XP</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="flex items-center gap-2 font-black text-ink"><Target className="h-4 w-4 text-brand-700" /> چالش‌های فعال</h2>
            <div className="mt-3 space-y-3">
              {(gamification.data?.challenges ?? []).map((challenge) => (
                <div key={challenge.id}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-ink">{challenge.icon} {challenge.title}</span>
                    <span className="text-ink/40">{number(challenge.progress)} / {number(challenge.target)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
                    <div className={cn("h-full rounded-full", challenge.completed ? "bg-emerald-500" : "bg-brand-500")} style={{ width: `${Math.min(100, (challenge.progress / Math.max(1, challenge.target)) * 100)}%` }} />
                  </div>
                  <div className="mt-1 text-[9px] text-ink/35">پاداش {number(challenge.xp_reward)} XP</div>
                </div>
              ))}
              {(gamification.data?.challenges ?? []).length === 0 && <div className="text-xs text-ink/40">چالشی در حال حاضر فعال نیست.</div>}
            </div>
          </div>
        </div>
      </div>

      {(gamification.data?.stamps ?? []).length > 0 && (
        <div className="card mt-5 p-5">
          <h2 className="flex items-center gap-2 font-black text-ink"><Gift className="h-4 w-4 text-brand-700" /> مهرهای سفر</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {(gamification.data?.stamps ?? []).map((stamp) => (
              <div key={stamp.destination_id} className="flex items-center gap-2 rounded-2xl border border-black/5 bg-white px-3 py-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-50 text-brand-700"><Sparkles className="h-3.5 w-3.5" /></span>
                <div>
                  <div className="text-[11px] font-bold text-ink">{stamp.name}</div>
                  <div className="text-[9px] text-ink/35">{date(stamp.visited_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </AccountShell>
  );
}

export default function WalletPage() {
  return (
    <RequireAuth>
      <WalletContent />
    </RequireAuth>
  );
}
