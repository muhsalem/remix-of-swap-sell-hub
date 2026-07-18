import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { getPaymentsBreakdown } from "@/lib/admin.functions";
import { formatAmount } from "@/lib/format-price";
import { FinanceCharts, type ChartSelection } from "@/components/admin/FinanceCharts";

export const Route = createFileRoute("/_authenticated/admin/payments-finance")({
  component: PaymentsFinanceDashboard,
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive" dir="rtl">{error.message}</div>
  ),
});

const STATUS_LABEL: Record<string, string> = {
  paid: "مدفوعة",
  pending: "قيد الانتظار",
  failed: "فاشلة",
  cancelled: "ملغاة",
  refunded: "مستردّة",
  expired: "منتهية",
  unknown: "غير معروف",
};

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700 border-emerald-300",
  pending: "bg-amber-100 text-amber-700 border-amber-300",
  failed: "bg-red-100 text-red-700 border-red-300",
  cancelled: "bg-neutral-100 text-neutral-600 border-neutral-300",
  refunded: "bg-blue-100 text-blue-700 border-blue-300",
  expired: "bg-neutral-100 text-neutral-500 border-neutral-300",
};

const PURPOSE_LABEL: Record<string, string> = {
  verify_individual: "توثيق حساب فرد",
  verify_company: "توثيق شركة",
  listing_featured_7d: "إعلان مميّز (٧ أيام)",
  listing_featured_30d: "إعلان مميّز (٣٠ يوم)",
  listing_pinned_7d: "تثبيت إعلان",
  listing_boost: "تعزيز إعلان",
  sub_merchant_month: "اشتراك تاجر",
  sub_store_month: "اشتراك محل",
  other: "أخرى",
};

function fmtMoney(n: number, cur: string) {
  return `${formatAmount(n)} ${cur === "SAR" ? "ر.س" : cur === "EGP" ? "ج.م" : cur}`;
}

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildFinanceCsv(data: any): (string | number)[][] {
  const rows: (string | number)[][] = [];
  rows.push([`تقرير المدفوعات المالية — مُصدَّر في ${new Date().toLocaleString("ar")}`]);
  rows.push([]);

  rows.push(["ملخص عام"]);
  rows.push(["المؤشر", "القيمة"]);
  rows.push(["إجمالي العمليات", data.totalCount ?? 0]);
  rows.push(["عمليات ناجحة", data.paidCount ?? 0]);
  rows.push(["نسبة النجاح %", data.successRate ?? 0]);
  rows.push(["عدد العملات", Object.keys(data.byCurrency || {}).length]);
  rows.push([]);

  rows.push(["الإيرادات المُحصّلة حسب العملة"]);
  rows.push(["العملة", "إجمالي مدفوع", "آخر ٣٠ يوم"]);
  for (const [cur, total] of Object.entries(data.paidTotalByCurrency || {})) {
    rows.push([cur, Number(total), Number((data.paid30ByCurrency || {})[cur] || 0)]);
  }
  rows.push([]);

  const statusKeys = Object.keys(STATUS_LABEL);
  rows.push(["تفصيل حسب العملة × الحالة"]);
  rows.push([
    "العملة",
    ...statusKeys.flatMap((s) => [`${STATUS_LABEL[s]} — مبلغ`, `${STATUS_LABEL[s]} — عدد`]),
    "الإجمالي — مبلغ",
    "الإجمالي — عدد",
  ]);
  for (const [cur, statuses] of Object.entries(data.byCurrencyStatus || {})) {
    const row: (string | number)[] = [cur];
    for (const s of statusKeys) {
      const b = (statuses as any)[s];
      row.push(b ? Number(b.total) : 0, b ? Number(b.count) : 0);
    }
    row.push(
      Number((data.byCurrency || {})[cur]?.total || 0),
      Number((data.byCurrency || {})[cur]?.count || 0),
    );
    rows.push(row);
  }
  rows.push([]);

  rows.push(["توزيع الحالات"]);
  rows.push(["الحالة", "عدد العمليات", "النسبة %"]);
  for (const [st, b] of Object.entries(data.byStatus || {})) {
    const count = (b as any).count || 0;
    const pct = data.totalCount ? Math.round((count / data.totalCount) * 100) : 0;
    rows.push([STATUS_LABEL[st] || st, count, pct]);
  }
  rows.push([]);

  rows.push(["حسب الغرض"]);
  rows.push(["الغرض", "عدد العمليات", "الإجمالي"]);
  for (const [p, b] of Object.entries(data.byPurpose || {})) {
    rows.push([PURPOSE_LABEL[p] || p, (b as any).count || 0, Number((b as any).total || 0)]);
  }
  rows.push([]);

  rows.push(["أحدث العمليات"]);
  rows.push(["التاريخ", "الغرض", "العملة", "المبلغ", "الحالة"]);
  for (const r of data.recent || []) {
    rows.push([
      new Date(r.created_at).toISOString(),
      PURPOSE_LABEL[r.purpose] || r.purpose || "",
      (r.currency || "SAR").toUpperCase(),
      Number(r.amount || 0),
      STATUS_LABEL[r.status] || r.status || "",
    ]);
  }

  return rows;
}

const PRESETS: { key: string; label: string; days: number | null }[] = [
  { key: "7d", label: "٧ أيام", days: 7 },
  { key: "30d", label: "٣٠ يوم", days: 30 },
  { key: "90d", label: "٩٠ يوم", days: 90 },
  { key: "all", label: "الكل", days: null },
];

function toDateInput(iso: string): string {
  return iso ? iso.slice(0, 10) : "";
}

function PaymentsFinanceDashboard() {
  const fetchData = useServerFn(getPaymentsBreakdown);
  const [preset, setPreset] = useState<string>("30d");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [selection, setSelection] = useState<ChartSelection | null>(null);

  const handleSelect = (sel: ChartSelection) => {
    setSelection((prev) =>
      prev && prev.kind === sel.kind && prev.key === sel.key && prev.date === sel.date
        ? null
        : sel,
    );
  };

  const range = useMemo(() => {
    if (preset === "custom") {
      return {
        from: fromDate ? new Date(fromDate + "T00:00:00Z").toISOString() : undefined,
        to: toDate ? new Date(toDate + "T23:59:59Z").toISOString() : undefined,
        label:
          fromDate || toDate
            ? `${fromDate || "…"} → ${toDate || "…"}`
            : "الكل",
      };
    }
    const p = PRESETS.find((x) => x.key === preset);
    if (!p || p.days == null) return { from: undefined, to: undefined, label: "الكل" };
    const from = new Date(Date.now() - p.days * 86400_000).toISOString();
    return { from, to: undefined, label: `آخر ${p.label}` };
  }, [preset, fromDate, toDate]);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-payments-finance", range.from ?? "-", range.to ?? "-"],
    queryFn: () => fetchData({ data: { from: range.from, to: range.to } }),
    refetchInterval: 60_000,
  });

  return (
    <div dir="rtl" className="min-h-screen bg-background font-body p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold">لوحة تحكم المدفوعات المالية</h1>
          <p className="text-sm text-muted-foreground mt-1">
            إجمالي المدفوعات والإيرادات حسب العملة وحالة كل عملية — يُحدَّث كل دقيقة
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => refetch()}
            className="text-xs px-3 py-2 rounded-lg border border-border hover:bg-muted"
            disabled={isFetching}
          >
            {isFetching ? "جارٍ التحديث…" : "تحديث"}
          </button>
          <button
            onClick={() => {
              if (!data) return;
              const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
              const rows = buildFinanceCsv(data);
              rows.splice(1, 0, [`النطاق الزمني: ${range.label}`]);
              downloadCsv(`payments-finance-${stamp}.csv`, rows);
            }}
            disabled={!data}
            className="text-xs px-3 py-2 rounded-lg border border-primary/40 bg-primary/10 text-primary font-bold hover:bg-primary/20 disabled:opacity-50"
            title="تصدير التقرير الحالي إلى CSV"
          >
            ⬇ تصدير CSV
          </button>
          <Link to="/admin" className="text-primary font-bold hover:underline text-sm">
            ← لوحة المشرف
          </Link>
        </div>
      </div>

      {/* Date range filter */}
      <div className="mb-6 p-4 rounded-2xl border border-border bg-card flex flex-wrap gap-3 items-end">
        <div className="flex gap-1 flex-wrap">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => {
                setPreset(p.key);
                setFromDate("");
                setToDate("");
              }}
              className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                preset === p.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-muted"
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => {
              setPreset("custom");
              if (!fromDate)
                setFromDate(toDateInput(new Date(Date.now() - 30 * 86400_000).toISOString()));
              if (!toDate) setToDate(toDateInput(new Date().toISOString()));
            }}
            className={`text-xs px-3 py-1.5 rounded-lg border transition ${
              preset === "custom"
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-muted"
            }`}
          >
            مخصّص
          </button>
        </div>

        {preset === "custom" && (
          <div className="flex gap-2 items-end flex-wrap">
            <label className="text-xs">
              من
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="mt-1 block px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
              />
            </label>
            <label className="text-xs">
              إلى
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="mt-1 block px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
              />
            </label>
          </div>
        )}

        <div className="text-xs text-muted-foreground ms-auto">
          الفترة الحالية: <span className="font-bold text-foreground">{range.label}</span>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>}
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}


      {data && (
        <>
          {/* Charts */}
          <FinanceCharts
            daily={(data as any).daily ?? []}
            currencies={(data as any).currencies ?? Object.keys(data.byCurrency)}
            onSelect={handleSelect}
            active={selection}
          />

          {selection && (
            <div className="mb-4 flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">فلتر نشط من المخطط:</span>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary font-bold">
                {selection.kind === "status"
                  ? `الحالة: ${STATUS_LABEL[selection.key] || selection.key}`
                  : `العملة: ${selection.key}`}
                {selection.date && ` · ${selection.date}`}
                <button
                  onClick={() => setSelection(null)}
                  className="w-5 h-5 rounded-full bg-primary/20 hover:bg-primary/30 flex items-center justify-center"
                  aria-label="إلغاء الفلتر"
                >
                  ×
                </button>
              </span>
            </div>
          )}

          {/* Summary */}
          <section className="mb-8">
            <h2 className="font-display text-lg font-extrabold mb-3">ملخص عام</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="إجمالي العمليات" value={data.totalCount} accent />
              <Kpi label="عمليات ناجحة" value={data.paidCount} />
              <Kpi label="نسبة النجاح" value={`${data.successRate}%`} trendUp={data.successRate >= 70} />
              <Kpi label="عملات مستخدمة" value={Object.keys(data.byCurrency).length} />
            </div>
          </section>

          {/* Revenue paid by currency */}
          <section className="mb-8">
            <h2 className="font-display text-lg font-extrabold mb-3">الإيرادات المُحصّلة حسب العملة</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(data.paidTotalByCurrency).length === 0 && (
                <p className="text-sm text-muted-foreground">لا توجد مدفوعات ناجحة بعد.</p>
              )}
              {Object.entries(data.paidTotalByCurrency).map(([cur, total]) => (
                <div
                  key={cur}
                  className="p-4 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5"
                >
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold mb-1">
                    إجمالي — {cur}
                  </div>
                  <div className="font-display text-2xl font-extrabold">
                    {fmtMoney(Number(total), cur)}
                  </div>
                  <div className="text-[11px] mt-1 text-muted-foreground">
                    آخر ٣٠ يوم: {fmtMoney(Number(data.paid30ByCurrency[cur] || 0), cur)}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Currency × Status matrix */}
          <section className="mb-8">
            <h2 className="font-display text-lg font-extrabold mb-3">تفصيل حسب العملة × الحالة</h2>
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-start p-3 font-bold">العملة</th>
                    {Object.keys(STATUS_LABEL).map((s) => (
                      <th key={s} className="text-start p-3 font-bold whitespace-nowrap">
                        {STATUS_LABEL[s]}
                      </th>
                    ))}
                    <th className="text-start p-3 font-bold">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.byCurrencyStatus).map(([cur, statuses]) => (
                    <tr key={cur} className="border-t border-border">
                      <td className="p-3 font-bold">
                        <Link
                          to="/payments"
                          search={{
                            scope: "all",
                            status: "all",
                            currency: cur,
                            purpose: "all",
                            q: "",
                          }}
                          className="text-primary hover:underline"
                          title={`عرض كل عمليات ${cur}`}
                        >
                          {cur}
                        </Link>
                      </td>
                      {Object.keys(STATUS_LABEL).map((s) => {
                        const b = statuses[s];
                        return (
                          <td key={s} className="p-3">
                            {b ? (
                              <Link
                                to="/payments"
                                search={{
                                  scope: "all",
                                  status: s,
                                  currency: cur,
                                  purpose: "all",
                                  q: "",
                                }}
                                className="block group hover:bg-primary/5 rounded-lg -m-1 p-1 transition"
                                title={`عرض ${STATUS_LABEL[s] || s} · ${cur}`}
                              >
                                <div className="font-bold group-hover:text-primary">
                                  {fmtMoney(b.total, cur)}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {b.count} عملية · فتح ↗
                                </div>
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="p-3 font-bold">
                        <Link
                          to="/payments"
                          search={{
                            scope: "all",
                            status: "all",
                            currency: cur,
                            purpose: "all",
                            q: "",
                          }}
                          className="hover:text-primary hover:underline"
                        >
                          {fmtMoney(data.byCurrency[cur]?.total || 0, cur)}
                          <div className="text-[10px] text-muted-foreground font-normal">
                            {data.byCurrency[cur]?.count || 0} عملية
                          </div>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Status breakdown */}
          <section className="mb-8">
            <h2 className="font-display text-lg font-extrabold mb-3">توزيع الحالات</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.entries(data.byStatus).map(([st, b]) => (
                <div
                  key={st}
                  className={`p-4 rounded-2xl border ${STATUS_STYLES[st] || "bg-card border-border"}`}
                >
                  <div className="text-[11px] uppercase tracking-widest font-bold mb-1">
                    {STATUS_LABEL[st] || st}
                  </div>
                  <div className="font-display text-2xl font-extrabold">{b.count}</div>
                  <div className="text-[11px] mt-1 opacity-80">
                    نسبة: {data.totalCount ? Math.round((b.count / data.totalCount) * 100) : 0}%
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Purpose */}
          <section className="mb-8">
            <h2 className="font-display text-lg font-extrabold mb-3">حسب الغرض</h2>
            <div className="rounded-2xl border border-border bg-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-start p-3 font-bold">الغرض</th>
                    <th className="text-start p-3 font-bold">عدد العمليات</th>
                    <th className="text-start p-3 font-bold">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.byPurpose)
                    .sort((a, b) => b[1].total - a[1].total)
                    .map(([p, b]) => (
                      <tr key={p} className="border-t border-border">
                        <td className="p-3">{PURPOSE_LABEL[p] || p}</td>
                        <td className="p-3">{b.count}</td>
                        <td className="p-3 font-bold">{formatAmount(b.total)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Recent */}
          <section className="mb-8">
            <h2 className="font-display text-lg font-extrabold mb-3">أحدث العمليات</h2>
            <div className="rounded-2xl border border-border bg-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-start p-3 font-bold">التاريخ</th>
                    <th className="text-start p-3 font-bold">الغرض</th>
                    <th className="text-start p-3 font-bold">المبلغ</th>
                    <th className="text-start p-3 font-bold">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((r: any, i: number) => (
                    <tr key={i} className="border-t border-border">
                      <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString("ar")}
                      </td>
                      <td className="p-3">{PURPOSE_LABEL[r.purpose] || r.purpose || "—"}</td>
                      <td className="p-3 font-bold">
                        {fmtMoney(Number(r.amount || 0), (r.currency || "SAR").toUpperCase())}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-1 rounded-full text-[11px] border ${
                            STATUS_STYLES[r.status] || "bg-muted border-border"
                          }`}
                        >
                          {STATUS_LABEL[r.status] || r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {data.recent.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-muted-foreground">
                        لا توجد عمليات بعد.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  accent,
  trendUp,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
  trendUp?: boolean;
}) {
  return (
    <div
      className={`p-4 rounded-2xl border ${
        accent
          ? "bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30"
          : "bg-card border-border"
      }`}
    >
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold mb-1">
        {label}
      </div>
      <div
        className={`font-display text-2xl font-extrabold ${
          trendUp === true ? "text-emerald-600" : trendUp === false ? "text-destructive" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
