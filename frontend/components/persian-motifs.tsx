"use client";

import { cn } from "@/lib/utils";

/**
 * Persian ornamental motifs inspired by Eslimi (arabesque), Boteh (paisley),
 * and traditional Persian architectural decoration.
 *
 * All vectors are pure-SVG so they render crisply at any scale and stay
 * lightweight compared to image assets.
 */

const motifStroke = "currentColor";

/** Symmetric Eslimi corner flourish — used as a card corner decoration. */
export function EslimiCorner({
  className,
  flip = false,
  flipY = false,
}: {
  className?: string;
  flip?: boolean;
  flipY?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      stroke={motifStroke}
      strokeWidth="2"
      className={cn("h-24 w-24", className)}
      style={{ overflow: "visible" }}
    >
      <g
        style={{
          transform: `${flip ? "scaleX(-1)" : ""} ${flipY ? "scaleY(-1)" : ""}`,
          transformOrigin: "center",
        }}
      >
        <path d="M8 8 H40 Q56 8 56 24 V40 Q56 56 40 56 H24 Q8 56 8 40 Z" />
        <path d="M24 16 Q32 12 38 16" />
        <path d="M16 24 Q12 32 16 38" />
        <path d="M24 24 Q32 32 24 40" />
        <path d="M32 24 Q40 32 32 40" />
        <path d="M24 32 Q28 36 32 32" />
        <path d="M8 80 H40 Q56 80 56 96 V112 Q56 112 40 112 H24 Q8 112 8 96 Z" />
        <path d="M24 88 Q32 84 38 88" />
        <path d="M16 96 Q12 104 16 110" />
        <path d="M24 96 Q32 104 24 112" />
        <path d="M32 96 Q40 104 32 112" />
        <path d="M24 104 Q28 108 32 104" />
      </g>
    </svg>
  );
}

/** Boteh / paisley tear-drop motif. */
export function BotehMotif({
  className,
  size = 48,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 100 120"
      fill="none"
      stroke={motifStroke}
      strokeWidth="2.5"
      className={cn("h-12 w-12", className)}
      style={{ width: size, height: size, overflow: "visible" }}
    >
      <path d="M50 8 C70 8 92 24 92 48 C92 76 64 100 50 114 C36 100 8 76 8 48 C8 24 30 8 50 8 Z" />
      <path d="M50 22 C64 22 78 32 78 46 C78 66 58 82 50 94" />
      <path d="M50 36 C58 36 64 42 64 48" />
      <circle cx="50" cy="46" r="3" fill={motifStroke} />
      <path d="M34 48 C40 44 46 44 50 48" />
    </svg>
  );
}

/** Persian arch (Iwan-style) silhouette. */
export function PersianArch({
  className,
  size = 64,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 64 80"
      fill="none"
      stroke={motifStroke}
      strokeWidth="2"
      className={cn("h-16 w-16", className)}
      style={{ width: size, height: size, overflow: "visible" }}
    >
      <path d="M4 80 V28 Q4 4 32 4 Q60 4 60 28 V80" />
      <path d="M12 80 V30 Q12 14 32 14 Q52 14 52 30 V80" />
      <path d="M20 80 V32 Q20 22 32 22 Q44 22 44 32 V80" />
      <path d="M32 60 V30" />
      <path d="M24 50 H40" />
    </svg>
  );}
