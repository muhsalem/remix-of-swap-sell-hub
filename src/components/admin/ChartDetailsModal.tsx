import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { listRecentPayments } from "@/lib/payments/sandbox.functions";
import { formatAmount } from "@/lib/format-price";
import type { ChartSelection } from "./FinanceCharts";

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
  expired: "bg-neutral-100 text-neutral-600 border-neutral-300",
  unknown: "bg-neutral-100 text-neutral-600 border-neutral-300",
};

type ApiStatus = "pending" | "paid" | "failed" | "expired" | "refunded";
const API_STATUSES: readonly ApiStatus[] = ["pending", "paid", "failed", "expired", "refunded"] as const;

export function ChartDetailsModal({
  selection,
  onClose,
}: {
  selection: ChartSelection | null;
  onClose: () => void;
}) {
  const open = !!(selection && selection.date);
  const list = useServerFn(listRecentPayments);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const { from, to, statusArg, currencyArg } = (() => {
    if (!selection?.date) return { from: undefined, to: undefined, statusArg: undefined, currencyArg: undefined };
    const from = new Date(`${selection.date}T00:00:00.000Z`).toISOString();
    const to = new Date(`${selection.date}T23:59:59.999Z`).toISOString();
    let statusArg: ApiStatus | undefined;
    let currencyArg: string | undefined;
    if (selection.kind === "status" && (API_STATUSES as readonly string[]).includes(selection.key)) {
      statusArg = selection.key as ApiStatus;
    } else if (selection.kind === "currency") {
      currencyArg = selection.key.toUpperCase();
    }
    return { from, to, statusArg, currencyArg };
  })();

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: [
      "chart-details",
      selection?.kind,
      selection?.key,
      selection?.date,
    ],
    queryFn: () =>
      list({
        data: {
          limit: 50,
          offset: 0,
          from,
          to,
          status: statusArg,
          currency: currencyArg,
        },
      }),
    enabled: open,
  });

  if (!open || !selection) return null;

  const rows: any[] = (data as any)?.rows ?? [];
  const total: number = (data as any)?.total ?? 0;

  const [sortBy, setSortBy] = useState<"date" | "amount" | "status">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const STATUS_ORDER: Record<string, number> = {
    paid: 1, pending: 2, failed: 3, refunded: 4, expired: 5, cancelled: 6, unknown: 7,
  };

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "date") {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortBy === "amount") {
        cmp = Number(a.amount || 0) - Number(b.amount || 0);
      } else {
        const sa = STATUS_ORDER[String(a.status || "unknown")] ?? 99;
        const sb = STATUS_ORDER[String(b.status || "unknown")] ?? 99;
        cmp = sa - sb;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortBy, sortDir]);

  const title =
    selection.kind === "status"
      ? `الحالة: ${STATUS_LABEL[selection.key] || selection.key}`
      : `العملة: ${selection.key}`;

  const paymentsHref = {
    to: "/payments" as const,
    search: {
      ...(statusArg ? { status: statusArg } : {}),
      ...(currencyArg ? { currency: currencyArg } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    },
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="chart-details-title"
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl bg-background border border-border shadow-2xl overflow-hidden">
        <header className="flex items-start justify-between gap-3 p-4 border-b border-border">
          <div>
            <h2 id="chart-details-title" className="font-display text-lg font-extrabold">
              تفاصيل السجلات
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {title} · {selection.date} ·{" "}
              <span className="font-bold text-foreground">{total}</span> عملية
              {isFetching && <span className="mr-2 text-primary">· يُحدَّث…</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              className="text-xs rounded-lg border border-border px-2.5 py-1 font-bold hover:bg-muted"
            >
              تحديث
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center text-lg"
            >
              ×
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4">
          {isLoading && <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>}
          {error && (
            <p className="text-sm text-destructive">{(error as Error).message}</p>
          )}
          {!isLoading && !error && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">
              لا توجد سجلات لهذا اليوم بالفلتر المحدد.
            </p>
          )}
          {rows.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2 mb-3 text-[11px]">
                <span className="text-muted-foreground font-bold">فرز حسب:</span>
                {([
                  ["date", "التاريخ"],
                  ["amount", "المبلغ"],
                  ["status", "الحالة"],
                ] as const).map(([k, lbl]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSortBy(k)}
                    className={`px-2 py-1 rounded-lg border font-bold ${
                      sortBy === k
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
                <span className="mx-1 h-4 w-px bg-border" />
                <button
                  type="button"
                  onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                  aria-label="تبديل اتجاه الفرز"
                  className="px-2 py-1 rounded-lg border border-border font-bold hover:bg-muted"
                >
                  {sortDir === "asc" ? "تصاعدي ↑" : "تنازلي ↓"}
                </button>
              </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="text-right border-b border-border">
                    <th className="py-2 px-2 font-bold">الوقت</th>
                    <th className="py-2 px-2 font-bold">الغرض</th>
                    <th className="py-2 px-2 font-bold">المبلغ</th>
                    <th className="py-2 px-2 font-bold">الحالة</th>
                    <th className="py-2 px-2 font-bold">المعرّف</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((r) => {
                    const st = String(r.status || "unknown");
                    return (
                      <tr key={r.id} className="border-b border-border/60 last:border-0">
                        <td className="py-2 px-2 whitespace-nowrap tabular-nums">
                          {new Date(r.created_at).toLocaleTimeString("ar", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-2 px-2">{r.purpose || "—"}</td>
                        <td className="py-2 px-2 font-bold tabular-nums">
                          {formatAmount(Number(r.amount || 0))} {String(r.currency || "SAR").toUpperCase()}
                        </td>
                        <td className="py-2 px-2">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                              STATUS_STYLES[st] || STATUS_STYLES.unknown
                            }`}
                          >
                            {STATUS_LABEL[st] || st}
                          </span>
                        </td>
                        <td className="py-2 px-2 font-mono text-[10px] text-muted-foreground">
                          {r.provider_invoice_id || String(r.id).slice(0, 8)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>

        <footer className="flex items-center justify-between gap-2 p-3 border-t border-border bg-muted/30">
          <p className="text-[11px] text-muted-foreground">
            يعرض حتى ٥٠ سجلاً. لعرض القائمة الكاملة استخدم صفحة المدفوعات.
          </p>
          <div className="flex items-center gap-2">
            <Link
              to={paymentsHref.to}
              search={paymentsHref.search as any}
              className="text-xs rounded-lg bg-primary text-primary-foreground px-3 py-1.5 font-bold hover:opacity-90"
            >
              فتح في /payments
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="text-xs rounded-lg border border-border px-3 py-1.5 font-bold hover:bg-muted"
            >
              إغلاق
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
