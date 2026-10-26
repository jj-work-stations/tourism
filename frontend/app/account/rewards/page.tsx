"use client";

import Link from "next/link";
import { Award, Compass, Crown, Flag, Trophy } from "lucide-react";

import { AccountShell } from "@/components/account-shell";
import { Badge, EmptyState, SmartImage, Spinner } from "@/components/ui";
import { useApiQuery } from "@/lib/hooks";
import { levelLabel, number } from "@/lib/format";
import type { Gamification } from "@/lib/types";
import { cn } from "@/lib/utils";

interface LeaderRow {
  rank: number;
  name: string;
  avatar_url?: string | null;
  xp: number;
  level: string;
  points: number;
}

export default function RewardsPage() {
  const profile = useApiQuery<Gamification>(["account", "gamification", "rewards"], "/gamification/profile");
  const leaderboard = useApiQuery<LeaderRow[]>(["account", "leaderboard"], "/gamification/leaderboard");

  if (profile.isLoading) {
    return <AccountShell title="جایزه‌ها و پاسپورت"><div className="dash-card grid place-items-center py-16"><Spinner className="h-7 w-7" /></div></AccountShell>;
  }
  if (profile.error || !profile.data) {
    return (
      <AccountShell title="جایزه‌ها و پاسپورت">
        <EmptyState icon={<Trophy className="h-6 w-6" />} title="اطلاعات در دسترس نیست" />
      </AccountShell>
    );
  }

  const data = profile.data;
  const unlocked = data.achievements.filter((a) => a.unlocked);

  return (
    <AccountShell
      title="جایزه‌ها و پاسپورت سفر"
      description="سطح مسافری، دستاوردها، پاسپورت دیجیتال شهرها و چالش‌های فعال شما."
    >
      <div className="space-y-5">
        {/* Level */}
        <div className="dash-card relative overflow-hidden p-5">
          <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-gold-200/40 blur-3xl" />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-gold-400/25 to-gold-600/10 text-gold-600 shadow-gold">
                <Crown className="h-8 w-8" />
              </span>
              <div>
                <div className="text-[11px] font-bold text-gold-600">مسافر {levelLabel[data.level] ?? data.level}</div>
                <div className="mt-1 text-2xl font-black text-ink">{number(data.xp)} XP</div>
                <div className="text-[11px] text-ink/45">{number(data.xp_to_next_level)} XP تا سطح {levelLabel[data.next_level ?? ""] ?? data.next_level ?? "بالی"}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center text-[11px]">
              <div className="rounded-2xl bg-brand-50 p-3"><div className="text-base font-black text-ink">{number(data.stamps.length)}</div><div className="text-ink/45">مُهر شهر</div></div>
              <div className="rounded-2xl bg-gold-100/70 p-3"><div className="text-base font-black text-ink">{number(unlocked.length)}</div><div className="text-ink/45">دستاورد</div></div>
              <div className="rounded-2xl bg-sky-50 p-3"><div className="text-base font-black text-ink">{number(data.points)}</div><div className="text-ink/45">امتیاز کیف</div></div>
            </div>
          </div>
          <div className="relative mt-4 h-2.5 overflow-hidden rounded-full bg-black/[0.06]">
            <div className="h-full rounded-full bg-gradient-to-l from-gold-400 via-gold-500 to-brand-600 transition-all" style={{ width: `${Math.max(3, Math.round(data.level_progress * 100))}%` }} />
          </div>
        </div>

        {/* Digital passport */}
        <div className="dash-card overflow-hidden">
          <div className="border-b border-black/[0.05] px-5 py-3.5">
            <h2 className="flex items-center gap-1.5 text-sm font-black text-ink"><Flag className="h-4 w-4 text-brand-700" /> پاسپورت دیجیتال</h2>
            <p className="mt-0.5 text-[10.5px] text-ink/40">هر شهری که بازدید کنید، سنگ پاسپورت شما می‌شود.</p>
          </div>
          {data.stamps.length === 0 ? (
            <EmptyState icon={<Compass className="h-6 w-6" />} title="هنوز مُهری ثبت نشده" description="اولین سفر خود را کامل کنید تا سنگ مقصد در پاسپورت شما بخورد." />
          ) : (
            <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 md:grid-cols-4">
              {data.stamps.map((stamp) => (
                <Link key={stamp.destination_id} href={`/destinations/${stamp.slug}`} className="group">
                  <div className="relative overflow-hidden rounded-2xl">
                    <SmartImage src={stamp.image_url} alt={stamp.name} className="aspect-[4/3] w-full transition group-hover:scale-105" />
                    <span className="absolute inset-2 grid place-items-center rounded-xl border-2 border-dashed border-white/40 text-[10px] font-black tracking-widest text-white/85 opacity-0 transition group-hover:opacity-100">
                      {stamp.name}
                    </span>
                    <span className="absolute bottom-2 right-2 rounded-xl bg-black/55 px-2 py-1 text-[10px] font-bold text-white">{stamp.name}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Achievements */}
        <div className="dash-card p-5">
          <h2 className="flex items-center gap-1.5 text-sm font-black text-ink"><Trophy className="h-4 w-4 text-gold-600" /> دستاوردها</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.achievements.map((achievement) => (
              <div key={achievement.id} className={cn("flex items-center gap-3 rounded-2xl border p-3 transition", achievement.unlocked ? "border-gold-500/25 bg-gold-50/60" : "border-black/[0.05] bg-black/[0.02] opacity-60")}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-xl shadow-sm">{achievement.unlocked ? achievement.icon : "🔒"}</span>
                <div className="min-w-0">
                  <div className="truncate text-xs font-black text-ink">{achievement.title}</div>
                  <div className="truncate text-[10px] text-ink/45">{achievement.description}</div>
                </div>
                {achievement.unlocked && <Badge tone="sand" className="mr-auto shrink-0 !py-0 !text-[9px]">+{number(achievement.xp_reward)} XP</Badge>}
              </div>
            ))}
            {data.achievements.length === 0 && <div className="py-6 text-center text-xs text-ink/40" style={{ gridColumn: "1/-1" }}>دستاوردی تعریف نشده است.</div>}
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          {/* Challenges */}
          <div className="dash-card overflow-hidden">
            <div className="border-b border-black/[0.05] px-5 py-3.5">
              <h2 className="flex items-center gap-1.5 text-sm font-black text-ink"><Award className="h-4 w-4 text-brand-700" /> چالش‌های سفر</h2>
            </div>
            <div className="section-list">
              {data.challenges.map((challenge) => (
                <div key={challenge.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 font-bold text-ink">
                      <span>{challenge.icon}</span> {challenge.title}
                      {challenge.completed && <Badge tone="emerald" className="!py-0 !text-[9px]">کامل شد</Badge>}
                    </div>
                    <span className="text-[10px] font-bold text-gold-600">+{number(challenge.xp_reward)} XP</span>
                  </div>
                  <p className="mt-1 text-[10.5px] text-ink/50">{challenge.description}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.05]">
                      <div className="h-full rounded-full bg-gradient-to-l from-brand-400 to-brand-700" style={{ width: `${Math.min(100, (challenge.progress / Math.max(challenge.target, 1)) * 100)}%` }} />
                    </div>
                    <span className="text-[10px] text-ink/45">{number(challenge.progress)}/{number(challenge.target)}</span>
                  </div>
                </div>
              ))}
              {data.challenges.length === 0 && <div className="py-10 text-center text-xs text-ink/40">چالش فعالی وجود ندارد.</div>}
            </div>
          </div>

          {/* Leaderboard */}
          <div className="dash-card overflow-hidden">
            <div className="border-b border-black/[0.05] px-5 py-3.5">
              <h2 className="flex items-center gap-1.5 text-sm font-black text-ink"><Crown className="h-4 w-4 text-gold-600" /> جدول مسافران برتر</h2>
            </div>
            <div className="section-list">
              {(leaderboard.data ?? []).slice(0, 8).map((row) => (
                <div key={row.rank} className="flex items-center justify-between gap-2 px-5 py-2.5 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className={cn("grid h-7 w-7 place-items-center rounded-xl text-[11px] font-black", row.rank === 1 ? "bg-gold-100 text-gold-600" : row.rank === 2 ? "bg-slate-100 text-slate-500" : row.rank === 3 ? "bg-amber-50 text-amber-600" : "bg-black/[0.04] text-ink/50")}>
                      {number(row.rank)}
                    </span>
                    <span className="truncate font-bold text-ink">{row.name}</span>
                  </div>
                  <span className="font-black text-brand-800">{number(row.xp)} XP</span>
                </div>
              ))}
              {(leaderboard.data ?? []).length === 0 && <div className="py-10 text-center text-xs text-ink/40">هنوز رتبه‌بندی ثبت نشده.</div>}
            </div>
          </div>
        </div>
      </div>
    </AccountShell>
  );
}
