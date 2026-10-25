"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Heart, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AccountShell } from "@/components/account-shell";
import { RequireAuth } from "@/components/require-auth";
import { EmptyState, LoadingCards, SmartImage } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useApiQuery } from "@/lib/hooks";
import { toman } from "@/lib/format";
import type { Favorite, Page } from "@/lib/types";

function FavoritesContent() {
  const queryClient = useQueryClient();
  const favorites = useApiQuery<Page<Favorite>>(["account", "favorites"], "/favorites", { page_size: 50 });

  async function remove(favorite: Favorite) {
    try {
      await api.delete(`/favorites/${favorite.entity_type}/${favorite.entity_id}`, undefined, true);
      toast.success("از علاقه‌مندی‌ها حذف شد.");
      await queryClient.invalidateQueries({ queryKey: ["account", "favorites"] });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "حذف انجام نشد.");
    }
  }

  return (
    <AccountShell title="علاقه‌مندی‌ها" description="مقصدها، اقامتگاه‌ها و تجربه‌هایی که ذخیره کرده‌اید.">
      {favorites.isLoading ? (
        <LoadingCards count={3} />
      ) : favorites.data && favorites.data.items.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {favorites.data.items.map((favorite) => (
            <div key={favorite.id} className="card group flex gap-3 p-3">
              <SmartImage src={favorite.image_url} alt={favorite.title} className="h-24 w-24 shrink-0 rounded-2xl" fallbackClassName="h-24 w-24 shrink-0 rounded-2xl" />
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-brand-700">{favorite.entity_type}</div>
                <Link href={favorite.url || "#"} className="mt-0.5 line-clamp-1 text-sm font-extrabold text-ink hover:text-brand-800">{favorite.title}</Link>
                <div className="mt-0.5 line-clamp-1 text-[10px] text-ink/45">{favorite.subtitle}</div>
                <div className="mt-auto flex items-center justify-between pt-2">
                  <span className="text-[11px] font-bold text-brand-800">{favorite.price ? toman(favorite.price, true) : ""}</span>
                  <button type="button" onClick={() => remove(favorite)} className="grid h-8 w-8 place-items-center rounded-lg text-ink/25 transition hover:bg-rose-50 hover:text-rose-500" aria-label="حذف">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Heart className="h-6 w-6" />}
          title="لیست علاقه‌مندی‌ها خالی است"
          description="در صفحه مقصدها و اقامتگاه‌ها، موارد مورد علاقه‌ات را ذخیره کن."
          action={<Link href="/destinations" className="btn-primary mt-2">کشف مقصدها</Link>}
        />
      )}
    </AccountShell>
  );
}

export default function FavoritesPage() {
  return (
    <RequireAuth>
      <FavoritesContent />
    </RequireAuth>
  );
}
