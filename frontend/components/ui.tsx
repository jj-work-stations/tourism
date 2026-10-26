"use client";

import Link from "next/link";
import { useState } from "react";
import { ImageOff, Star } from "lucide-react";

import { cn } from "@/lib/utils";

export function SmartImage({
  src,
  alt,
  className,
  fallbackClassName,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        className={cn(
          "grid place-items-center bg-gradient-to-br from-brand-100 via-sand-100 to-brand-50 text-brand-800/30",
          className,
          fallbackClassName,
        )}
      >
        <ImageOff className="h-8 w-8" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("object-cover", className)}
    />
  );
}

export function Rating({
  value,
  count,
  size = "md",
  className,
}: {
  value?: number | null;
  count?: number | null;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 font-bold text-ink", className)}>
      <Star
        className={cn("fill-amber-400 text-amber-400", size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")}
      />
      <span className={size === "sm" ? "text-xs" : "text-sm"}>{value ? value.toFixed(1) : "—"}</span>
      {count !== undefined && count !== null && (
        <span className="text-[11px] font-normal text-ink/40">({new Intl.NumberFormat("fa-IR").format(count)})</span>
      )}
    </span>
  );
}

const tones: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  rose: "bg-rose-50 text-rose-700",
  sky: "bg-sky-50 text-sky-700",
  slate: "bg-slate-100 text-slate-600",
  brand: "bg-brand-50 text-brand-800",
  sand: "bg-sand-100 text-sand-800",
  gold: "bg-gold-100 text-gold-700",
};

export function Badge({
  children,
  tone = "brand",
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof tones | string;
  className?: string;
}) {
  return <span className={cn("chip", tones[tone] || tones.brand, className)}>{children}</span>;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  href,
  linkLabel = "مشاهده همه",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <span className="eyebrow">{eyebrow}</span>
        )}
        <h2 className="section-title">{title}</h2>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/55">{description}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className="group inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-brand-800 transition hover:bg-brand-50"
        >
          {linkLabel}
          <span className="transition group-hover:-translate-x-0.5">←</span>
        </Link>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card-ornamental flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-700">
        {icon}
      </span>
      <h3 className="text-base font-bold text-ink">{title}</h3>
      {description && <p className="max-w-sm text-sm leading-6 text-ink/50">{description}</p>}
      {action}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-700/20 border-t-brand-700",
        className,
      )}
    />
  );
}

export function LoadingCards({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="card overflow-hidden">
          <div className="skeleton h-44 rounded-none" />
          <div className="space-y-3 p-5">
            <div className="skeleton h-5 w-2/3" />
            <div className="skeleton h-4 w-1/2" />
            <div className="skeleton h-10 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  icon,
  tone = "brand",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "brand" | "sand" | "sky" | "rose" | "gold";
}) {
  const toneClass = {
    brand: "bg-brand-50 text-brand-700",
    sand: "bg-sand-100 text-sand-700",
    sky: "bg-sky-50 text-sky-600",
    rose: "bg-rose-50 text-rose-600",
    gold: "bg-gold-100 text-gold-700",
  }[tone];
  return (
    <div className="card card-hover p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-ink/45">{label}</div>
          <div className="mt-2 text-2xl font-black tracking-tight text-ink">{value}</div>
          {hint && <div className="mt-1 text-[11px] text-ink/40">{hint}</div>}
        </div>
        {icon && <span className={cn("grid h-11 w-11 place-items-center rounded-2xl", toneClass)}>{icon}</span>}
      </div>
    </div>
  );
}

/**
 * High-end Persian page hero: iwan-arch silhouettes, girih tile lattice and
 * gold light wash. Shared by all listing screens.
 */
export function PageHero({
  title,
  description,
  children,
  badge,
  ornament = true,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  badge?: React.ReactNode;
  ornament?: boolean;
}) {
  return (
    <section className="relative overflow-hidden border-b border-black/5 bg-white/70">
      {ornament && (
        <>
          <div className="girih pointer-events-none absolute inset-0 opacity-[0.35]" />
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-200/40 blur-3xl" />
          <div className="pointer-events-none absolute -right-16 bottom-0 h-56 w-56 rounded-full bg-sand-200/50 blur-3xl" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-transparent via-gold-500/50 to-transparent" />
          <svg
            viewBox="0 0 64 80"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            className="pointer-events-none absolute -left-6 -top-10 h-52 w-44 text-brand-700/10"
            aria-hidden
          >
            <path d="M4 80 V28 Q4 4 32 4 Q60 4 60 28 V80" />
            <path d="M12 80 V30 Q12 14 32 14 Q52 14 52 30 V80" />
            <path d="M20 80 V32 Q20 22 32 22 Q44 22 44 32 V80" />
          </svg>
        </>
      )}
      <div className="container-app relative py-10 sm:py-14">
        {badge}
        <h1 className="text-3xl font-black tracking-tight text-ink sm:text-4xl">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-sm leading-7 text-ink/55 sm:text-base">{description}</p>}
        {children && <div className="mt-7">{children}</div>}
      </div>
    </section>
  );
}

/** Toggleable filter pill used across listing pages. */
export function ChipFilter({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("filter-pill", active && "filter-pill-active")}
    >
      {children}
    </button>
  );
}
