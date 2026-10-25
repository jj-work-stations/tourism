import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function destinationName(item: { name: string; name_local?: string | null }): string {
  return item.name_local || item.name;
}
