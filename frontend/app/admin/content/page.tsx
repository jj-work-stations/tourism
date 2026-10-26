"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Compass, PlusCircle, Save } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { Badge, EmptyState, SmartImage, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { number, toman } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks";
import { cn } from "@/lib/utils";

type EntityKey = "attractions" | "accommodations" | "destinations" | "restaurants" | "experiences";

const TAB: { key: EntityKey; label: string }[] = [
  { key: "destinations", label: "مقصدها" },
  { key: "accommodations", label: "اقامتگاه‌ها" },
  { key: "attractions", label: "جاذبه‌ها" },
  { key: "experiences", label: "تجربه‌ها" },
  { key: "restaurants", label: "رستوران‌ها" },
];

const CATEGORIES = [
  { value: "historical", label: "تاریخی" },
  { value: "natural", label: "طبیعی" },
  { value: "cultural", label: "فرهنگی" },
  { value: "entertainment", label: "تفریحی" },
  { value: "religious", label: "مذهبی" },
  { value: "shopping", label: "خرید" },
];

const EXP_CATEGORIES = [
  { value: "city_tour", label: "تور شهری" },
  { value: "food", label: "غذا" },
  { value: "nature", label: "طبیعت‌گردی" },
  { value: "photography", label: "عکاسی" },
  { value: "adventure", label: "ماجراجویی" },
  { value: "craft", label: "صنایع دستی" },
];

const ACC_TYPES = ["hotel", "apartment_hotel", "hostel", "villa", "homestay", "apartment", "camp", "heritage"];

interface Row {
  id: string;
  name: string;
  slug?: string;
  destination_name?: string | null;
  type?: string;
  category?: string;
  cuisine?: string;
  image_url?: string | null;
  images?: string[] | null;
  rating?: number | null;
  review_count?: number | null;
  price?: number | null;
  base_price?: number | null;
  ticket_price?: number | null;
  average_price?: number | null;
  star_rating?: number | null;
  guest_rating?: number | null;
  is_active?: boolean;
  is_featured?: boolean;
}

const PRICE_FIELD: Partial<Record<EntityKey, keyof Row & string>> = {
  accommodations: "base_price",
  attractions: "ticket_price",
  experiences: "price",
  restaurants: "average_price",
};

export default function AdminContentPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<EntityKey>("attractions");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<Record<string, string>>({ name: "", destination_id: "", category: "", type: "" });
  const [editing, setEditing] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = useApiQuery<{ items: Row[]; total: number }>(
    ["admin", "content", tab, search],
    `/admin/${tab}`,
    { q: search || undefined, page_size: 25 },
  );
  const destinations = useApiQuery<{ items: Row[] }>(["admin", "content", "destinations"], "/admin/destinations", { page_size: 100 });

  const priceField = PRICE_FIELD[tab];

  async function save() {
    if (!form.name.trim()) { toast.error("نام الزامی است."); return; }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        destination_id: form.destination_id || undefined,
      };
      if (form.category) payload.category = form.category;
      if (tab === "accommodations") payload.type = form.type || "hotel";
      if (form.description) payload.description = form.description;
      if (form.image_url) payload[tab === "accommodations" ? "images" : "image_url"] = form.image_url;
      if (editing) payload.id = editing.id;
      await api.post(`/admin/${tab}`, payload, true);
      toast.success(editing ? "ویرایش ذخیره شد." : "مورد جدید ایجاد شد.");
      setForm({ name: "", destination_id: "", category: "", type: "", description: "", image_url: "" });
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "content", tab] });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "ذخیره انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(row: Row) {
    try {
      await api.post(`/admin/${tab}`, { id: row.id, is_active: !row.is_active }, true);
      await queryClient.invalidateQueries({ queryKey: ["admin", "content", tab] });
      toast.success(row.is_active ? "غیرفعال شد." : "فعال شد.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "عملیات انجام نشد.");
    }
  }

  async function toggleFeatured(row: Row) {
    try {
      await api.post(`/admin/${tab}`, { id: row.id, is_featured: !row.is_featured }, true);
      await queryClient.invalidateQueries({ queryKey: ["admin", "content", tab] });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "عملیات انجام نشد.");
    }
  }

  function startEdit(row: Row) {
    setEditing(row);
    setForm({
      name: row.name,
      destination_id: "",
      category: row.category ?? "",
      type: row.type ?? "",
      description: "",
      image_url: row.image_url || (row.images?.[0] ?? ""),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <DashboardShell
      portal="admin"
      title="مدیریت محتوا"
      subtitle="ایجاد و ویرایش مقصدها، اقامتگاه‌ها، جاذبه‌ها، تجربه‌ها و رستوران‌ها."
    >
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          <div className="dash-card p-2">
            <div className="flex gap-1 overflow-x-auto no-scrollbar">
              {TAB.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => { setTab(item.key); setSearch(""); }}
                  className={cn(
                    "shrink-0 rounded-2xl px-4 py-2 text-[12px] font-bold transition",
                    tab === item.key ? "bg-brand-700 text-white shadow-soft" : "text-ink/50 hover:bg-black/[0.04] hover:text-ink",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <input
            className="field-sm"
            placeholder="جستجو بر اساس نام..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <div className="dash-card overflow-x-auto">
            {rows.isLoading ? (
              <div className="grid place-items-center py-16"><Spinner className="h-7 w-7" /></div>
            ) : (rows.data?.items ?? []).length === 0 ? (
              <EmptyState icon={<Compass className="h-6 w-6" />} title="موردی پیدا نشد" description={editing ? "در حال ویرایش موردی دیگر هستید." : undefined} />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>نام</th>
                    <th>مقصد</th>
                    <th>دسته/نوع</th>
                    <th>قیمت</th>
                    <th>امتیاز</th>
                    <th className="text-left">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {(rows.data?.items ?? []).map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <SmartImage src={row.image_url || row.images?.[0]} alt={row.name} className="h-9 w-9 shrink-0 rounded-xl" />
                          <div className="min-w-0">
                            <div className="truncate font-bold text-ink">{row.name}</div>
                            {row.is_active === false && <Badge tone="rose" className="!py-0 !text-[8.5px]">غیرفعال</Badge>}
                          </div>
                        </div>
                      </td>
                      <td className="text-ink/55">{row.destination_name ?? "—"}</td>
                      <td className="text-ink/55">
                        {row.category ? (CATEGORIES.find((c) => c.value === row.category)?.label ?? row.category)
                          : row.type ? ({ hotel: "هتل" }[row.type] ?? row.type)
                          : row.cuisine ?? "—"}
                      </td>
                      <td className="font-bold text-brand-800">{priceField ? toman(Number(row[priceField] ?? 0), true) : "—"}</td>
                      <td>{row.rating ? row.rating.toFixed(1) : "—"}</td>
                      <td>
                        <div className="flex justify-end gap-1.5">
                          <button type="button" onClick={() => toggleFeatured(row)} className={cn(row.is_featured ? "btn-xs-primary" : "btn-xs-soft")}>
                            {row.is_featured ? "★ ویژه" : "ویژه"}
                          </button>
                          <button type="button" onClick={() => startEdit(row)} className="btn-xs-soft">ویرایش</button>
                          <button type="button" onClick={() => toggleActive(row)} className={row.is_active === false ? "btn-xs-primary" : "btn-xs-danger"}>
                            {row.is_active === false ? "فعال" : "غیرفعال"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {rows.data && <div className="text-center text-[10.5px] text-ink/35">{number(rows.data.total)} مورد ثبت‌شده</div>}
        </div>

        {/* Side form */}
        <div className="dash-card h-fit p-5 xl:sticky xl:top-6">
          <h2 className="flex items-center gap-1.5 text-sm font-black text-ink">
            <PlusCircle className="h-4 w-4 text-brand-700" />
            {editing ? `ویرایش: ${editing.name}` : "ایجاد مورد جدید"}
          </h2>
          <p className="mt-1 text-[10.5px] text-ink/40">
            {TAB.find((t) => t.key === tab)?.label}
          </p>
          <div className="mt-4 grid gap-3">
            <input className="field-sm" placeholder="نام (فارسی) *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select className="field-sm" value={form.destination_id} onChange={(e) => setForm({ ...form, destination_id: e.target.value })}>
              <option value="">مقصد را انتخاب کنید...</option>
              {(destinations.data?.items ?? []).map((dest) => (
                <option key={dest.id} value={dest.id}>{dest.name}</option>
              ))}
            </select>
            {(tab === "attractions" || tab === "experiences") && (
              <select className="field-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">دسته‌بندی...</option>
                {(tab === "attractions" ? CATEGORIES : EXP_CATEGORIES).map((cat) => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            )}
            {tab === "accommodations" && (
              <select className="field-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="hotel">نوع اقامتگاه: هتل</option>
                {ACC_TYPES.map((type) => <option key={type} value={type}>{ACC_TYPE_LABEL[type] ?? type}</option>)}
              </select>
            )}
            <textarea className="field-sm min-h-[90px]" placeholder="توضیحات" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <input className="field-sm" placeholder="آدرس تصویر" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={save} className="btn-primary flex-1 !py-2.5 !text-xs">
                <Save className="h-4 w-4" /> {editing ? "ذخیره ویرایش" : "ایجاد"}
              </button>
              {editing && (
                <button type="button" onClick={() => { setEditing(null); setForm({ name: "", destination_id: "", category: "", type: "", description: "", image_url: "" }); }} className="btn-secondary !py-2.5 !text-xs">
                  انصراف
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

const ACC_TYPE_LABEL: Record<string, string> = {
  hotel: "هتل",
  apartment_hotel: "هتل‌آپارتمان",
  hostel: "هاستل",
  villa: "ویلا",
  homestay: "بوم‌گردی",
  apartment: "آپارتمان",
  camp: "کمپ",
  heritage: "بنای تاریخی",
};
