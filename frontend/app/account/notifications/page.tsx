"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";

import { AccountShell } from "@/components/account-shell";
import { RequireAuth } from "@/components/require-auth";
import { Badge, EmptyState, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useApiQuery } from "@/lib/hooks";
import { relative } from "@/lib/format";
import type { Notification, Page } from "@/lib/types";
import { cn } from "@/lib/utils";

function NotificationsContent() {
  const queryClient = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const notifications = useApiQuery<Page<Notification>>(
    ["account", "notifications", unreadOnly],
    "/notifications",
    { unread_only: unreadOnly || undefined, page_size: 50 },
  );

  async function markAll() {
    try {
      await api.post("/notifications/read", {}, true);
      toast.success("همه اعلان‌ها خوانده شدند.");
      await queryClient.invalidateQueries({ queryKey: ["account", "notifications"] });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "انجام نشد.");
    }
  }

  async function markOne(notification: Notification) {
    if (notification.is_read) return;
    try {
      await api.patch(`/notifications/${notification.id}/read`, undefined, true);
      await queryClient.invalidateQueries({ queryKey: ["account", "notifications"] });
    } catch {
      /* non-blocking */
    }
  }

  return (
    <AccountShell
      title="اعلان‌ها"
      description="پرداخت‌ها، تغییر وضعیت رزرو و پیشنهادهای سفر شما."
      action={
        <button type="button" onClick={markAll} className="btn-secondary !py-2.5 !text-xs">
          <CheckCheck className="h-4 w-4" /> خواندن همه
        </button>
      }
    >
      <div className="mb-4 flex gap-1 rounded-2xl bg-black/[0.035] p-1">
        {[
          { value: false, label: "همه" },
          { value: true, label: "خوانده‌نشده" },
        ].map((item) => (
          <button
            key={String(item.value)}
            type="button"
            onClick={() => setUnreadOnly(item.value)}
            className={cn("rounded-xl px-3.5 py-2 text-xs font-bold transition", unreadOnly === item.value ? "bg-white text-brand-800 shadow-sm" : "text-ink/50 hover:text-ink")}
          >
            {item.label}
          </button>
        ))}
      </div>

      {notifications.isLoading ? (
        <div className="grid place-items-center py-16"><Spinner /></div>
      ) : notifications.data && notifications.data.items.length > 0 ? (
        <div className="space-y-2">
          {notifications.data.items.map((notification) => (
            <button
              key={notification.id}
              type="button"
              onClick={() => markOne(notification)}
              className={cn(
                "card flex w-full items-start gap-3 p-4 text-right transition hover:shadow-soft",
                !notification.is_read && "border-brand-700/15 bg-brand-50/30",
              )}
            >
              <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", notification.is_read ? "bg-black/[0.04] text-ink/40" : "bg-brand-50 text-brand-700")}>
                <Bell className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-ink">{notification.title}</span>
                  {!notification.is_read && <Badge tone="brand">جدید</Badge>}
                </div>
                <p className="mt-1 text-[11px] leading-6 text-ink/50">{notification.body}</p>
                <div className="mt-1 text-[10px] text-ink/30">{relative(notification.created_at)}</div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Bell className="h-6 w-6" />}
          title={unreadOnly ? "اعلان خوانده‌نشده‌ای ندارید" : "هنوز اعلانی ندارید"}
          description="با ثبت اولین رزرو، اعلان‌های سفر شما اینجا نمایش داده می‌شود."
        />
      )}
    </AccountShell>
  );
}

export default function NotificationsPage() {
  return (
    <RequireAuth>
      <NotificationsContent />
    </RequireAuth>
  );
}
