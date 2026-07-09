import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  adminListShippingCities,
  adminUpsertShippingCity,
  adminToggleShippingCity,
  adminDeleteShippingCity,
} from "@/lib/shipping-admin.functions";

export const Route = createFileRoute("/_authenticated/admin/shipping-cities")({
  component: ShippingCitiesAdmin,
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive" dir="rtl">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8" dir="rtl">الصفحة غير موجودة</div>,
});

type City = {
  id: string;
  code: string;
  country: "SA" | "EG";
  region_ar: string;
  name_ar: string;
  zone: number;
  active: boolean;
  updated_at: string;
};

const empty = { code: "", country: "SA" as "SA" | "EG", region_ar: "", name_ar: "", zone: 2, active: true };

function ShippingCitiesAdmin() {
  const list = useServerFn(adminListShippingCities);
  const upsert = useServerFn(adminUpsertShippingCity);
  const toggle = useServerFn(adminToggleShippingCity);
  const del = useServerFn(adminDeleteShippingCity);
  const qc = useQueryClient();

  const { data: cities, isLoading } = useQuery({
    queryKey: ["admin-shipping-cities"],
    queryFn: () => list() as Promise<City[]>,
  });

  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "SA" | "EG">("ALL");

  const save = useMutation({
    mutationFn: (v: typeof empty) => upsert({ data: v }),
    onSuccess: () => {
      toast.success(editing ? "تم التحديث" : "تمت الإضافة");
      setForm(empty); setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin-shipping-cities"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const flip = useMutation({
    mutationFn: (v: { code: string; active: boolean }) => toggle({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-shipping-cities"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (code: string) => del({ data: { code } }),
    onSuccess: () => {
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["admin-shipping-cities"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (cities ?? []).filter((c) => filter === "ALL" || c.country === filter);
  const grouped: Record<string, City[]> = {};
  for (const c of filtered) {
    const key = `${c.country} — ${c.region_ar}`;
    (grouped[key] ??= []).push(c);
  }

  return (
    <div dir="rtl" className="min-h-screen bg-background font-body p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="font-display text-3xl font-extrabold">إدارة مدن ومناطق الشحن</h1>
        <Link to="/admin" className="text-primary font-bold hover:underline text-sm">
          ← عودة للوحة المشرف
        </Link>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        كل المدن هنا تُستخدم فوراً في محرك تسعير الشحن وواجهة العرض. Zone 1 = مركزية،
        Zone 2 = رئيسية، Zone 3 = أطراف (تؤثر على فرق المنطقة في السعر).
      </p>

      {/* Form */}
      <section className="p-5 rounded-2xl border border-border bg-card mb-8">
        <h2 className="font-display text-lg font-extrabold mb-4">
          {editing ? `تعديل: ${editing}` : "إضافة مدينة جديدة"}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <input
            placeholder="الرمز (مثل RUH)"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            disabled={!!editing}
            className="px-3 py-2 rounded-lg bg-stone-soft border border-border text-sm disabled:opacity-60"
          />
          <select
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value as "SA" | "EG" })}
            className="px-3 py-2 rounded-lg bg-stone-soft border border-border text-sm"
          >
            <option value="SA">🇸🇦 السعودية</option>
            <option value="EG">🇪🇬 مصر</option>
          </select>
          <input
            placeholder="المنطقة/المحافظة"
            value={form.region_ar}
            onChange={(e) => setForm({ ...form, region_ar: e.target.value })}
            className="px-3 py-2 rounded-lg bg-stone-soft border border-border text-sm col-span-2"
          />
          <input
            placeholder="اسم المدينة"
            value={form.name_ar}
            onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
            className="px-3 py-2 rounded-lg bg-stone-soft border border-border text-sm"
          />
          <select
            value={form.zone}
            onChange={(e) => setForm({ ...form, zone: Number(e.target.value) })}
            className="px-3 py-2 rounded-lg bg-stone-soft border border-border text-sm"
          >
            <option value={1}>Zone 1 · مركزية</option>
            <option value={2}>Zone 2 · رئيسية</option>
            <option value={3}>Zone 3 · أطراف</option>
            <option value={4}>Zone 4</option>
            <option value={5}>Zone 5</option>
          </select>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            نشطة
          </label>
          <button
            disabled={save.isPending || !form.code || !form.name_ar || !form.region_ar}
            onClick={() => save.mutate(form)}
            className="px-4 py-2 bg-foreground text-background rounded-lg text-sm font-bold disabled:opacity-50"
          >
            {editing ? "حفظ التعديل" : "إضافة"}
          </button>
          {editing && (
            <button
              onClick={() => { setForm(empty); setEditing(null); }}
              className="px-4 py-2 border border-border rounded-lg text-sm"
            >
              إلغاء
            </button>
          )}
        </div>
      </section>

      {/* Filter */}
      <div className="flex gap-2 mb-4 text-sm">
        {(["ALL", "SA", "EG"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-full border ${filter === k ? "bg-foreground text-background border-foreground" : "border-border"}`}
          >
            {k === "ALL" ? `الكل (${cities?.length ?? 0})` : k === "SA" ? "🇸🇦 السعودية" : "🇪🇬 مصر"}
          </button>
        ))}
      </div>

      {/* Grouped list */}
      {isLoading && <p className="text-sm text-muted-foreground">جارِ التحميل…</p>}
      <div className="space-y-6">
        {Object.entries(grouped).map(([region, rows]) => (
          <section key={region}>
            <h3 className="font-bold text-sm mb-2 text-muted-foreground">
              {region} <span className="opacity-60">({rows.length})</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {rows.map((c) => (
                <div
                  key={c.id}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${c.active ? "bg-card border-border" : "bg-muted/30 border-border opacity-70"}`}
                >
                  <div className="min-w-0">
                    <div className="font-bold text-sm">{c.name_ar}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {c.code} · Zone {c.zone} {!c.active && "· موقوفة"}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setEditing(c.code);
                        setForm({
                          code: c.code, country: c.country, region_ar: c.region_ar,
                          name_ar: c.name_ar, zone: c.zone, active: c.active,
                        });
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="px-2 py-1 text-xs border border-border rounded-md"
                    >تعديل</button>
                    <button
                      onClick={() => flip.mutate({ code: c.code, active: !c.active })}
                      className="px-2 py-1 text-xs border border-border rounded-md"
                    >{c.active ? "إيقاف" : "تفعيل"}</button>
                    <button
                      onClick={() => {
                        if (confirm(`حذف ${c.name_ar}؟`)) remove.mutate(c.code);
                      }}
                      className="px-2 py-1 text-xs bg-destructive/10 text-destructive border border-destructive/30 rounded-md"
                    >حذف</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
