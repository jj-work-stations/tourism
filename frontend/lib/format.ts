export function toman(value: number | null | undefined, compact = false): string {
  if (value === null || value === undefined) return "—";
  if (compact) {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} میلیارد تومان`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} میلیون تومان`;
    if (value >= 1_000) return `${Math.round(value / 1_000)} هزار تومان`;
  }
  return `${new Intl.NumberFormat("fa-IR").format(value)} تومان`;
}

export function number(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("fa-IR").format(value);
}

const persianDate = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const persianShortDate = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  month: "short",
  day: "numeric",
});

export function date(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return persianDate.format(parsed);
}

export function shortDate(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return persianShortDate.format(parsed);
}

export function time(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(parsed);
}

export function dateInput(offsetDays = 0): string {
  const dateValue = new Date();
  dateValue.setDate(dateValue.getDate() + offsetDays);
  return dateValue.toISOString().slice(0, 10);
}

export function duration(minutes: number | null | undefined): string {
  if (!minutes) return "—";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${number(mins)} دقیقه`;
  return mins ? `${number(hours)} ساعت و ${number(mins)} دقیقه` : `${number(hours)} ساعت`;
}

export function relative(value: string | null | undefined): string {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "همین حالا";
  if (minutes < 60) return `${number(minutes)} دقیقه پیش`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${number(hours)} ساعت پیش`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${number(days)} روز پیش`;
  return date(value);
}

export const bookingStatus: Record<string, { label: string; tone: string }> = {
  pending: { label: "در انتظار پرداخت", tone: "amber" },
  confirmed: { label: "تأیید شده", tone: "emerald" },
  cancelled: { label: "لغو شده", tone: "rose" },
  completed: { label: "تکمیل شده", tone: "sky" },
  refunded: { label: "بازگشت وجه", tone: "slate" },
};

export const bookingType: Record<string, string> = {
  transport: "حمل‌ونقل",
  accommodation: "اقامتگاه",
  experience: "تجربه",
};

export const transportType: Record<string, string> = {
  flight: "هواپیما",
  train: "قطار",
  bus: "اتوبوس",
  car: "خودرو",
  taxi: "تاکسی",
};

export const levelLabel: Record<string, string> = {
  bronze: "برنز",
  silver: "نقره‌ای",
  gold: "طلایی",
  platinum: "پلاتینیوم",
};

export const tripStatus: Record<string, string> = {
  upcoming: "پیش‌رو",
  ongoing: "در حال سفر",
  completed: "تکمیل شده",
  cancelled: "لغو شده",
  draft: "پیش‌نویس",
};

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
