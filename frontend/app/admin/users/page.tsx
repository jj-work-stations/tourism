"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Users } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { Badge, EmptyState, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { date, number, toman } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks";
import type { AdminUser, Page } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROLES = [
  { value: "traveler", label: "مسافر" },
  { value: "provider", label: "ارائه‌دهنده" },
  { value: "support_agent", label: "پشتیبانی" },
  { value: "content_manager", label: "مدیر محتوا" },
  { value: "marketing_manager", label: "بازاریابی" },
  { value: "admin", label: "مدیر سیستم" },
];

const ROLE_NUM: Record<string, string> = {};
ROLES.forEach((role, index) => { ROLE_NUM[role.value] = `${index + 1}`; });

const ROLE_BADGE: Record<string, { label: string; tone: string }> = {
  admin: { label: "مدیر سیستم", tone: "rose" },
  content_manager: { label: "مدیر محتوا", tone: "sand" },
  marketing_manager: { label: "بازاریابی", tone: "sky" },
  support_agent: { label: "پشتیبانی", tone: "amber" },
  provider: { label: "ارائه‌دهنده", tone: "brand" },
  traveler: { label: "مسافر", tone: "emerald" },
};

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);

  const users = useApiQuery<Page<AdminUser>>(
    ["admin", "users", search, roleFilter, page],
    "/admin/users",
    { q: search || undefined, role: roleFilter || undefined, page, page_size: 25 },
  );

  async function patchUser(id: string, payload: Record<string, unknown>) {
    try {
      await api.patch(`/admin/users/${id}`, payload, true);
      toast.success("کاربر به‌روزرسانی شد.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "به‌روزرسانی انجام نشد.");
    }
  }

  const items = users.data?.items ?? [];
  const total = users.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 25));

  return (
    <DashboardShell
      portal="admin"
      title="کاربران و دسترسی‌ها"
      subtitle="مدیریت نقش‌ها، فعال/غیرفعال‌سازی حساب و اطلاعات فعالیت کاربران."
    >
      <div className="space-y-4">
        <div className="dash-card flex flex-wrap items-center gap-3 p-4">
          <label className="relative min-w-[240px] flex-1">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />
            <input
              className="field-sm pr-9"
              placeholder="جستجوی نام، ایمیل یا موبایل..."
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            />
          </label>
          <select className="field-sm w-auto" value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setPage(1); }}>
            <option value="">همه نقش‌ها</option>
            {ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
          </select>
        </div>

        <div className="dash-card overflow-x-auto">
          {users.isLoading ? (
            <div className="grid place-items-center py-16"><Spinner className="h-7 w-7" /></div>
          ) : items.length === 0 ? (
            <EmptyState icon={<Users className="h-6 w-6" />} title="کاربری پیدا نشد" />
          ) : (
            <>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>کاربر</th>
                    <th>نقش</th>
                    <th>رزروها</th>
                    <th>مجموع خرید</th>
                    <th>عضویت</th>
                    <th>آخرین ورود</th>
                    <th className="text-left">کنترل حساب</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="font-bold text-ink">{item.full_name}</div>
                        <div className="text-[9.5px] text-ink/35">{item.email || item.phone || "—"}</div>
                      </td>
                      <td>
                        <select
                          value={item.role}
                          onChange={(event) => patchUser(item.id, { role: event.target.value })}
                          className="rounded-lg border border-black/10 bg-white px-2 py-1 text-[10.5px] font-semibold outline-none focus:border-brand-600"
                        >
                          {ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                        </select>
                      </td>
                      <td>{number(item.bookings_count)}</td>
                      <td className="font-bold text-brand-800">{toman(item.total_spent, true)}</td>
                      <td className="text-[10.5px] text-ink/45">{date(item.created_at)}</td>
                      <td className="text-[10.5px] text-ink/45">{item.last_login_at ? date(item.last_login_at) : "—"}</td>
                      <td>
                        <div className="flex items-center justify-end gap-1.5">
                          <Badge tone={(ROLE_BADGE[item.role] ?? ROLE_BADGE.traveler).tone} className="!px-2 !py-0.5 !text-[9.5px]">
                            {(ROLE_BADGE[item.role] ?? ROLE_BADGE.traveler).label}
                          </Badge>
                          <button
                            type="button"
                            onClick={() => patchUser(item.id, { is_active: !item.is_active })}
                            className={cn("rounded-lg px-2.5 py-1 text-[10px] font-bold transition", item.is_active ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" : "bg-rose-50 text-rose-600 hover:bg-rose-100")}
                          >
                            {item.is_active ? "متقاضی فعال" : "غیرفعال"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pages > 1 && (
                <div className="flex items-center justify-between border-t border-black/[0.05] px-5 py-3 text-[11px] text-ink/50">
                  <button type="button" className="btn-xs-soft" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>صفحه قبل</button>
                  <span className="font-bold text-ink">{number(page)} از {number(pages)}</span>
                  <button type="button" className="btn-xs-soft" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>صفحه بعد</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
