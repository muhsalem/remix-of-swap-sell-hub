import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { checkIsAdmin } from "@/lib/admin.functions";
import {
  listAllPayments,
  listMyPaymentsHistory,
} from "@/lib/payments/sandbox.functions";

export const Route = createFileRoute("/_authenticated/payments")({
  component: PaymentsDashboard,
  errorComponent: ({ error }) => (
    <div dir="rtl" className="p-8 text-destructive">
      {error.message}
    </div>
  ),
});

const STATUSES = ["all", "paid", "pending", "failed", "expired", "refunded"] as const;
const STATUS_LABEL: Record<string, string> = {
  all: "الكل",
  paid: "مدفوعة",
  pending: "معلّقة",
  failed: "فاشلة",
  expired: "منتهية",
  refunded: "مستردّة",
};
const STATUS_STYLE: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-800 border-emerald-300",
  pending: "bg-amber-100 text-amber-800 border-amber-300",
  failed: "bg-rose-100 text-rose-800 border-rose-300",
  expired: "bg-stone-200 text-stone-700 border-stone-300",
  refunded: "bg-sky-100 text-sky-800 border-sky-300",
};
const PURPOSES = [
  "verify_individual",
  "verify_company",
  "listing_featured_7d",
  "listing_featured_30d",
  "listing_pinned_7d",
  "listing_boost",
  "sub_merchant_month",
  "sub_store_month",
];

const PAGE_SIZE = 25;

function PaymentsDashboard() {
  const isAdminFn = useServerFn(checkIsAdmin);
  const listAll = useServerFn(listAllPayments);
  const listMine = useServerFn(listMyPaymentsHistory);
  const qc = useQueryClient();

  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [status, setStatus] = useState<string>("all");
  const [purpose, setPurpose] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const adminQ = useQuery({ queryKey: ["is-admin"], queryFn: () => isAdminFn() });
  const isAdmin = !!adminQ.data?.isAdmin;

  useEffect(() => {
    if (!isAdmin && scope === "all") setScope("mine");
  }, [isAdmin, scope]);

  useEffect(() => {
    setPage(0);
  }, [scope, status, purpose, search]);

  const queryKey = ["payments-dash", scope, status, purpose, search, page] as const;
  const payload = {
    status: status === "all" ? undefined : (status as never),
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  };
  const dataQ = useQuery({
    queryKey,
    queryFn: async () => {
      if (scope === "all") {
        return listAll({
          data: {
            ...payload,
            purpose: purpose === "all" ? undefined : purpose,
            search: search.trim() || undefined,
          },
        });
      }
      return listMine({ data: payload });
    },
    enabled: scope === "mine" || isAdmin,
  });

  // Live updates
  useEffect(() => {
    const ch = supabase
      .channel("payments-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments" },
        () => qc.invalidateQueries({ queryKey: ["payments-dash"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const rows = dataQ.data?.rows ?? [];
  const counts = dataQ.data?.counts ?? {};
  const total = dataQ.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div dir="rtl" className="min-h-screen bg-background p-6 max-w-6xl mx-auto font-body">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <div>
          <h1 className="font-display text-3xl font-extrabold">لوحة المدفوعات</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {scope === "mine" ? "سجل مدفوعاتي" : "جميع المدفوعات على المنصة"}
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Link to="/admin/payments-sandbox" className="text-primary text-sm font-bold hover:underline">
              مختبر المدفوعات →
            </Link>
          )}
        </div>
      </div>

      {/* Scope tabs */}
      <div className="flex gap-2 mb-6">
        <Tab active={scope === "mine"} onClick={() => setScope("mine")}>
          مدفوعاتي
        </Tab>
        {isAdmin && (
          <Tab active={scope === "all"} onClick={() => setScope("all")}>
            كل المستخدمين
          </Tab>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {(["paid", "pending", "failed", "expired", "refunded"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(status === s ? "all" : s)}
            className={`p-3 rounded-2xl border text-right transition ${
              status === s
                ? "border-primary bg-primary/10"
                : "border-border bg-card hover:bg-stone-soft/40"
            }`}
          >
            <div className="text-[11px] uppercase tracking-widest font-bold text-muted-foreground">
              {STATUS_LABEL[s]}
            </div>
            <div className="font-display text-2xl font-extrabold mt-1">
              {counts[s] ?? 0}
            </div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="p-4 rounded-2xl border border-border bg-card mb-6 grid md:grid-cols-4 gap-3">
        <label className="text-xs">
          الحالة
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        {scope === "all" && (
          <>
            <label className="text-xs">
              الغرض
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background"
              >
                <option value="all">الكل</option>
                {PURPOSES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs md:col-span-2">
              بحث (رقم فاتورة أو UUID دفعة)
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="INV-… أو UUID"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background font-mono text-xs"
              />
            </label>
          </>
        )}
      </div>

      {/* Table */}
      <section className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-soft/60 text-[11px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-right font-bold">الحالة</th>
                <th className="px-3 py-2 text-right font-bold">الغرض</th>
                <th className="px-3 py-2 text-right font-bold">المبلغ</th>
                <th className="px-3 py-2 text-right font-bold">الفاتورة</th>
                {scope === "all" && (
                  <th className="px-3 py-2 text-right font-bold">المستخدم</th>
                )}
                <th className="px-3 py-2 text-right font-bold">التاريخ</th>
                <th className="px-3 py-2 text-right font-bold"></th>
              </tr>
            </thead>
            <tbody>
              {dataQ.isLoading && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    جارٍ التحميل…
                  </td>
                </tr>
              )}
              {!dataQ.isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    لا توجد نتائج مطابقة.
                  </td>
                </tr>
              )}
              {rows.map((r: any) => (
                <tr key={r.id} className="border-t border-border hover:bg-stone-soft/30">
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-0.5 rounded-full border text-[11px] font-bold ${
                        STATUS_STYLE[r.status] ?? "bg-stone-100 border-stone-300"
                      }`}
                    >
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px]">{r.purpose}</td>
                  <td className="px-3 py-2 font-bold">
                    {Number(r.amount).toLocaleString("ar")} {r.currency}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                    {r.provider_invoice_id ?? "—"}
                  </td>
                  {scope === "all" && (
                    <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                      {r.user_id?.slice(0, 8)}…
                    </td>
                  )}
                  <td className="px-3 py-2 text-[11px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("ar")}
                    {r.paid_at && (
                      <div className="text-emerald-700">
                        دُفعت: {new Date(r.paid_at).toLocaleString("ar")}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.checkout_url && r.status === "pending" && (
                      <a
                        href={r.checkout_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary text-xs font-bold hover:underline"
                      >
                        إكمال ↗
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between p-3 border-t border-border bg-stone-soft/40 text-xs">
            <span>
              الصفحة {page + 1} من {pageCount} · إجمالي {total}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-border bg-background disabled:opacity-40 font-bold"
              >
                السابق
              </button>
              <button
                disabled={page + 1 >= pageCount}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-border bg-background disabled:opacity-40 font-bold"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-xl text-sm font-bold border transition ${
        active
          ? "bg-foreground text-background border-foreground"
          : "bg-card border-border hover:bg-stone-soft/40"
      }`}
    >
      {children}
    </button>
  );
}
