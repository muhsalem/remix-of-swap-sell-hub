import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  adminListListings,
  adminUpdateListing,
  adminDeleteListing,
} from "@/lib/listings-admin.functions";

export const Route = createFileRoute("/_authenticated/admin/listings")({
  component: AdminListings,
  head: () => ({
    meta: [
      { title: "إدارة الإعلانات | لوحة المشرف" },
      { name: "description", content: "تعديل وحذف إعلانات السوق من لوحة المشرفين." },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive" dir="rtl">
      {error.message}
    </div>
  ),
});

const STATUSES = ["all", "active", "pending", "traded", "closed"] as const;
const LABEL: Record<string, string> = {
  all: "الكل",
  active: "نشط",
  pending: "قيد المراجعة",
  traded: "تمت المقايضة",
  closed: "مغلق",
};

function AdminListings() {
  const list = useServerFn(adminListListings);
  const update = useServerFn(adminUpdateListing);
  const remove = useServerFn(adminDeleteListing);
  const qc = useQueryClient();

  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<any | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-listings", status, q],
    queryFn: () => list({ data: { status, q: q || undefined } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-listings"] });

  const saveM = useMutation({
    mutationFn: (v: any) => update({ data: v }),
    onSuccess: () => {
      toast.success("تم حفظ التعديلات");
      setEditing(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delM = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("تم حذف الإعلان");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div dir="rtl" className="min-h-screen bg-background font-body p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <h1 className="font-display text-3xl font-extrabold">إدارة الإعلانات</h1>
        <Link to="/admin" className="text-primary text-sm font-bold hover:underline">
          ← لوحة المشرف
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
              status === s
                ? "bg-foreground text-background border-foreground"
                : "bg-card border-border text-muted-foreground"
            }`}
          >
            {LABEL[s]}
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="بحث بالعنوان…"
          className="px-3 py-2 rounded-lg bg-stone-soft border border-border text-xs ms-auto"
        />
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>}
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
      {data && data.listings.length === 0 && (
        <p className="text-sm text-muted-foreground">لا توجد إعلانات مطابقة.</p>
      )}

      <div className="space-y-3">
        {data?.listings.map((l: any) => (
          <div key={l.id} className="p-4 rounded-2xl border border-border bg-card">
            <div className="flex flex-wrap items-start gap-4">
              {l.images?.[0] && (
                <img
                  src={l.images[0]}
                  alt={l.title}
                  loading="lazy"
                  className="size-16 rounded-xl object-cover ring-1 ring-black/5"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="font-bold truncate">{l.title}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {l.category} · {l.city || "—"} · {Number(l.market_price).toLocaleString()} ر.س ·{" "}
                  <b>{LABEL[l.status] ?? l.status}</b>
                  {l.is_featured && <span className="text-primary"> · مميّز</span>}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  المالك: {l.owner?.display_name ?? "—"}
                  {l.owner?.is_suspended && <span className="text-destructive"> (معلّق)</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <Link
                  to="/listings/$id"
                  params={{ id: l.id }}
                  className="px-3 py-2 rounded-lg text-xs font-bold bg-stone-soft border border-border"
                >
                  عرض
                </Link>
                <button
                  onClick={() => setEditing(l)}
                  className="px-3 py-2 rounded-lg text-xs font-bold bg-foreground text-background"
                >
                  تعديل
                </button>
                <button
                  disabled={delM.isPending}
                  onClick={() => {
                    if (confirm(`حذف الإعلان "${l.title}" نهائياً؟`)) delM.mutate(l.id);
                  }}
                  className="px-3 py-2 rounded-lg text-xs font-bold bg-destructive text-destructive-foreground disabled:opacity-50"
                >
                  حذف
                </button>
              </div>
            </div>

            {editing?.id === l.id && (
              <form
                className="mt-4 grid sm:grid-cols-2 gap-2 border-t border-border pt-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget as HTMLFormElement);
                  saveM.mutate({
                    id: l.id,
                    title: String(f.get("title") || "").trim(),
                    category: String(f.get("category") || "").trim(),
                    city: String(f.get("city") || "").trim(),
                    market_price: Number(f.get("market_price")),
                    status: String(f.get("status")) as any,
                    is_featured: f.get("is_featured") === "on",
                  });
                }}
              >
                <input name="title" defaultValue={l.title} className="px-3 py-2 rounded-lg bg-stone-soft border border-border text-xs" />
                <input name="category" defaultValue={l.category} className="px-3 py-2 rounded-lg bg-stone-soft border border-border text-xs" />
                <input name="city" defaultValue={l.city ?? ""} placeholder="المدينة" className="px-3 py-2 rounded-lg bg-stone-soft border border-border text-xs" />
                <input name="market_price" type="number" step="0.01" defaultValue={l.market_price} className="px-3 py-2 rounded-lg bg-stone-soft border border-border text-xs" />
                <select name="status" defaultValue={l.status} className="px-3 py-2 rounded-lg bg-stone-soft border border-border text-xs">
                  {STATUSES.filter((s) => s !== "all").map((s) => (
                    <option key={s} value={s}>{LABEL[s]}</option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" name="is_featured" defaultChecked={l.is_featured} /> إعلان مميّز
                </label>
                <div className="flex gap-2 sm:col-span-2">
                  <button disabled={saveM.isPending} className="px-4 py-2 rounded-lg text-xs font-bold bg-foreground text-background disabled:opacity-50">
                    {saveM.isPending ? "جارٍ الحفظ…" : "حفظ"}
                  </button>
                  <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg text-xs font-bold bg-stone-soft border border-border">
                    إلغاء
                  </button>
                </div>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
