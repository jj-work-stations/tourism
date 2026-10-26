"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BedDouble, Plane, PlusCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { Badge, EmptyState, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { date, number, time, toman } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks";
import { cn } from "@/lib/utils";

interface AccRow { id: string; name: string; type: string; base_price: number; rating: number; is_active: boolean }
interface TrRow { id: string; code: string; type: string; origin: string; destination: string; price: number; seats_available: number; departure_at: string }

interface Services {
  accommodations: AccRow[];
  transport: TrRow[];
}

const ACC_TYPES: { value: string; label: string }[] = [
  { value: "hotel", label: "هتل" },
  { value: "apartment_hotel", label: "هتل‌آپارتمان" },
  { value: "hostel", label: "هاستل" },
  { value: "villa", label: "ویلا" },
  { value: "homestay", label: "بوم‌گردی" },
  { value: "apartment", label: "آپارتمان" },
  { value: "camp", label: "کمپ/طبیعت" },
  { value: "heritage", label: "بنای تاریخی" },
];

const TRANSPORT_TYPES: { value: string; label: string }[] = [
  { value: "flight", label: "هواپیما" },
  { value: "train", label: "قطار" },
  { value: "bus", label: "اتوبوس" },
  { value: "car", label: "خودرو" },
  { value: "taxi", label: "تاکسی" },
];

const emptyAcc = { name: "", type: "hotel", base_price: "", star_rating: "", description: "", address: "" };
const emptyTr = { type: "bus", origin: "", destination: "", price: "", seats_available: "", departure_at: "" };

export default function ProviderServicesPage() {
  const queryClient = useQueryClient();
  const [accForm, setAccForm] = useState<typeof emptyAcc & Record<string, string>>(emptyAcc);
  const [trForm, setTrForm] = useState<typeof emptyTr & Record<string, string>>(emptyTr);
  const [editingAcc, setEditingAcc] = useState<AccRow | null>(null);
  const [busy, setBusy] = useState(false);

  const services = useApiQuery<Services>(["provider", "services"], "/provider/services");
  const destinations = useApiQuery<{ items: { id: string; name: string }[] }>(["provider", "destinations"], "/admin/destinations", { page_size: 100 }, { enabled: false });

  async function refreshServices() {
    await queryClient.invalidateQueries({ queryKey: ["provider", "services"] });
    await queryClient.invalidateQueries({ queryKey: ["provider", "dashboard"] });
  }

  async function saveAccommodation() {
    if (!accForm.name.trim()) { toast.error("نام اقامتگاه الزامی است."); return; }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        name: accForm.name,
        type: accForm.type,
        base_price: Number(accForm.base_price || 0),
        star_rating: Number(accForm.star_rating || 0),
        description: accForm.description || undefined,
        address: accForm.address || undefined,
        is_active: true,
      };
      if (accForm.destination_id) payload.destination_id = accForm.destination_id;
      if (editingAcc) {
        await api.patch(`/provider/services/accommodations/${editingAcc.id}`, {
          base_price: Number(accForm.base_price || 0),
          star_rating: Number(accForm.star_rating || 0),
          description: accForm.description || undefined,
        }, true);
      } else {
        await api.post("/provider/services/accommodations", payload, true);
      }
      toast.success(editingAcc ? "اقامتگاه ویرایش شد." : "اقامتگاه ایجاد شد.");
      setAccForm(emptyAcc);
      setEditingAcc(null);
      await refreshServices();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "ذخیره انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  async function saveTransport() {
    if (!trForm.origin || !trForm.destination || !trForm.departure_at) { toast.error("مبدأ، مقصد و زمان حرکت الزامی است."); return; }
    setBusy(true);
    try {
      await api.post("/provider/services/transport", {
        type: trForm.type,
        origin: trForm.origin,
        destination: trForm.destination,
        price: Number(trForm.price || 0),
        seats_available: Number(trForm.seats_available || 10),
        departure_at: trForm.departure_at.includes("T") ? trForm.departure_at : `2026-01-01T${trForm.departure_at}:00`,
      }, true);
      toast.success("سفر جدید ثبت شد.");
      setTrForm(emptyTr);
      await refreshServices();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "ذخیره انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleAcc(row: AccRow) {
    try {
      await api.patch(`/provider/services/accommodations/${row.id}`, { is_active: !row.is_active }, true);
      await refreshServices();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "عملیات انجام نشد.");
    }
  }

  async function deleteAcc(row: AccRow) {
    if (!window.confirm(`«${row.name}» حذف شود؟`)) return;
    try {
      await api.delete(`/provider/services/accommodations/${row.id}`, undefined, true);
      await refreshServices();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "حذف انجام نشد.");
    }
  }

  async function updateSeats(row: TrRow, seats: number) {
    try {
      await api.patch(`/provider/services/transport/${row.id}`, { seats_available: seats }, true);
      await refreshServices();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "به‌روزرسانی انجام نشد.");
    }
  }

  async function updatePrice(row: AccRow, price: number) {
    try {
      await api.patch(`/provider/services/accommodations/${row.id}`, { base_price: price }, true);
      await refreshServices();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "به‌روزرسانی انجام نشد.");
    }
  }

  async function deleteTr(row: TrRow) {
    if (!window.confirm(`سفر ${row.code} حذف شود؟`)) return;
    try {
      await api.delete(`/provider/services/transport/${row.id}`, undefined, true);
      await refreshServices();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "حذف انجام نشد.");
    }
  }

  return (
    <DashboardShell
      portal="provider"
      title="مدیریت خدمات"
      subtitle="ثبت و ویرایش اقامتگاه‌ها و سفرهای حمل‌ونقل، تعیین قیمت و مدیریت ظرفیت."
    >
      <div className="grid gap-5 xl:grid-cols-2">
        {/* Accommodations */}
        <div className="space-y-4">
          <div className="dash-card p-5">
            <h2 className="flex items-center gap-1.5 text-sm font-black text-ink">
              {editingAcc ? `ویرایش: ${editingAcc.name}` : <><PlusCircle className="h-4 w-4 text-brand-700" /> اقامتگاه جدید</>}
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input className="field-sm sm:col-span-2" placeholder="نام اقامتگاه *" value={accForm.name} onChange={(e) => setAccForm({ ...accForm, name: e.target.value })} disabled={Boolean(editingAcc)} />
              <select className="field-sm" value={accForm.type} onChange={(e) => setAccForm({ ...accForm, type: e.target.value })}>
                {ACC_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
              <input className="field-sm" placeholder="قیمت پایه (تومان)" type="number" value={accForm.base_price} onChange={(e) => setAccForm({ ...accForm, base_price: e.target.value })} />
              <input className="field-sm" placeholder="ستاره (۱ تا ۵)" type="number" max={5} value={accForm.star_rating} onChange={(e) => setAccForm({ ...accForm, star_rating: e.target.value })} />
              <input className="field-sm" placeholder="آدرس" value={accForm.address} onChange={(e) => setAccForm({ ...accForm, address: e.target.value })} />
              <textarea className="field-sm min-h-[70px] sm:col-span-2" placeholder="توضیحات" value={accForm.description} onChange={(e) => setAccForm({ ...accForm, description: e.target.value })} />
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" disabled={busy} onClick={saveAccommodation} className="btn-primary flex-1 !py-2.5 !text-xs">{editingAcc ? "ذخیره ویرایش" : "ثبت اقامتگاه"}</button>
              {editingAcc && <button type="button" onClick={() => { setEditingAcc(null); setAccForm(emptyAcc); }} className="btn-secondary !py-2.5 !text-xs">انصراف</button>}
            </div>
          </div>

          <div className="dash-card overflow-hidden">
            <div className="border-b border-black/[0.05] px-5 py-3.5"><h2 className="text-sm font-black text-ink">اقامتگاه‌های من ({number(services.data?.accommodations.length ?? 0)})</h2></div>
            {(services.data?.accommodations ?? []).length === 0 ? (
              <EmptyState icon={<BedDouble className="h-6 w-6" />} title="اقامتگاهی ثبت نشده است" />
            ) : (
              <div className="section-list">
                {(services.data?.accommodations ?? []).map((row) => (
                  <div key={row.id} className="flex items-center justify-between gap-3 px-5 py-3 text-xs">
                    <div className="min-w-0">
                      <div className="truncate font-bold text-ink">{row.name}</div>
                      <div className="text-[10px] text-ink/35">{ACC_TYPES.find((t) => t.value === row.type)?.label ?? row.type} · امتیاز {row.rating ? row.rating.toFixed(1) : "—"}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <label className="flex items-center gap-1 rounded-xl bg-black/[0.03] px-2 py-1">
                        <input type="number" defaultValue={row.base_price} min={0} className="w-20 bg-transparent text-center text-[11px] font-black text-ink outline-none" onBlur={(e) => Number(e.target.value) !== row.base_price && updatePrice(row, Number(e.target.value))} />
                        <span className="text-[9px] text-ink/40">تومان</span>
                      </label>
                      <button type="button" onClick={() => { setEditingAcc(row); setAccForm({ name: row.name, type: row.type, base_price: String(row.base_price), star_rating: "", description: "", address: "" }); }} className="btn-xs-soft">ویرایش</button>
                      <button type="button" onClick={() => toggleAcc(row)} className={cn(row.is_active ? "btn-xs-primary" : "btn-xs-soft")}>{row.is_active ? "فعال" : "غیرفعال"}</button>
                      <button type="button" onClick={() => deleteAcc(row)} className="grid h-7 w-7 place-items-center rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100" aria-label="حذف"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Transport */}
        <div className="space-y-4">
          <div className="dash-card p-5">
            <h2 className="flex items-center gap-1.5 text-sm font-black text-ink"><PlusCircle className="h-4 w-4 text-brand-700" /> سفر جدید</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <select className="field-sm" value={trForm.type} onChange={(e) => setTrForm({ ...trForm, type: e.target.value })}>
                {TRANSPORT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
              <input className="field-sm" placeholder="قیمت (تومان)" type="number" value={trForm.price} onChange={(e) => setTrForm({ ...trForm, price: e.target.value })} />
              <input className="field-sm" placeholder="مبدأ *" value={trForm.origin} onChange={(e) => setTrForm({ ...trForm, origin: e.target.value })} />
              <input className="field-sm" placeholder="مقصد *" value={trForm.destination} onChange={(e) => setTrForm({ ...trForm, destination: e.target.value })} />
              <input className="field-sm" placeholder="ظرفیت صندلی" type="number" value={trForm.seats_available} onChange={(e) => setTrForm({ ...trForm, seats_available: e.target.value })} />
              <input className="field-sm" placeholder="زمان حرکت (مثلاً 2026-05-20T07:30)" value={trForm.departure_at} onChange={(e) => setTrForm({ ...trForm, departure_at: e.target.value })} />
            </div>
            <button type="button" disabled={busy} onClick={saveTransport} className="btn-primary mt-4 !py-2.5 !text-xs">ثبت سفر</button>
          </div>

          <div className="dash-card overflow-hidden">
            <div className="border-b border-black/[0.05] px-5 py-3.5"><h2 className="text-sm font-black text-ink">سفرهای من ({number(services.data?.transport.length ?? 0)})</h2></div>
            {(services.data?.transport ?? []).length === 0 ? (
              <EmptyState icon={<Plane className="h-6 w-6" />} title="سفری ثبت نشده است" />
            ) : (
              <div className="section-list">
                {(services.data?.transport ?? []).map((row) => (
                  <div key={row.id} className="flex items-center justify-between gap-3 px-5 py-3 text-xs">
                    <div className="min-w-0">
                      <div className="truncate font-bold text-ink">{row.origin} → {row.destination}</div>
                      <div className="text-[10px] text-ink/35">{row.code} · {TRANSPORT_TYPES.find((t) => t.value === row.type)?.label ?? row.type} · {date(row.departure_at)} {time(row.departure_at)}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <div className="text-left">
                        <div className="font-black text-brand-800">{toman(row.price, true)}</div>
                        <label className="flex items-center gap-1 text-[9px] text-ink/40">
                          صندلی:
                          <input type="number" defaultValue={row.seats_available} min={0} className="w-12 rounded-lg border border-black/10 px-1.5 py-0.5 text-center text-[10px] outline-none focus:border-brand-600" onBlur={(e) => Number(e.target.value) !== row.seats_available && updateSeats(row, Number(e.target.value))} />
                        </label>
                      </div>
                      <button type="button" onClick={() => deleteTr(row)} className="grid h-7 w-7 place-items-center rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100" aria-label="حذف"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
