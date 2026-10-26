"use client";

import { cn } from "@/lib/utils";
import { EslimiCorner, BotehMotif, PersianArch } from "./persian-motifs";

/** Horizontal ornamental divider used between sections. */
export function PersianDivider({
  className,
  tone = "brand",
}: {
  className?: string;
  tone?: "brand" | "sand" | "ink";
}) {
  const toneClass = {
    brand: "text-brand-700/40",
    sand: "text-sand-500/50",
    ink: "text-ink/20",
  }[tone];
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className={cn("h-px flex-1", toneClass.replace("text-", "bg-"))} />
      <BotehMotif className={cn("h-5 w-5 shrink-0", toneClass)} size={20} />
      <span className={cn("h-px flex-1", toneClass.replace("text-", "bg-"))} />
    </div>
  );
}

/** A framed panel with Persian corner motifs — for dashboard hero cards. */
export function OrnamentalPanel({
  children,
  className,
  tone = "brand",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "brand" | "sand" | "ink";
}) {
  const toneClass = {
    brand: "text-brand-700",
    sand: "text-sand-600",
    ink: "text-ink/60",
  }[tone];
  return (
    <div className={cn("relative", className)}>
      <div className={cn("absolute -left-3 -top-3 h-8 w-8", toneClass)}>
        <EslimiCorner className="h-8 w-8" />
      </div>
      <div className={cn("absolute -right-3 -top-3 h-8 w-8", toneClass)}>
        <EslimiCorner className="h-8 w-8" flip />
      </div>
      <div className={cn("absolute -bottom-3 -left-3 h-8 w-8", toneClass)}>
        <EslimiCorner className="h-8 w-8" flipY />
      </div>
      <div className={cn("absolute -bottom-3 -right-3 h-8 w-8", toneClass)}>
        <EslimiCorner className="h-8 w-8" flip flipY />
      </div>
      <div className="relative rounded-3xl border border-black/5 bg-white p-5 shadow-card">
        {children}
      </div>
    </div>
  );
}

/** Persian arch header for dashboard sections. */
export function ArchHeader({
  title,
  subtitle,
  className,
  tone = "brand",
}: {
  title: string;
  subtitle?: string;
  className?: string;
  tone?: "brand" | "sand" | "ink";
}) {
  const toneClass = {
    brand: "text-brand-700",
    sand: "text-sand-600",
    ink: "text-ink/60",
  }[tone];
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <PersianArch className={cn("h-12 w-12 shrink-0", toneClass)} size={48} />
      <div>
        <h3 className={cn("text-lg font-black text-ink", toneClass)}>{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-ink/45">{subtitle}</p>}
      </div>
    </div>
  );
}