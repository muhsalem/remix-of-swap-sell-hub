import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatAmount } from "@/lib/format-price";

type DailyRow = {
  date: string;
  revenueByCurrency: Record<string, number>;
  countsByStatus: Record<string, number>;
};

const STATUS_LABEL: Record<string, string> = {
  paid: "مدفوعة",
  pending: "قيد الانتظار",
  failed: "فاشلة",
  cancelled: "ملغاة",
  refunded: "مستردّة",
  expired: "منتهية",
  unknown: "غير معروف",
};

const STATUS_COLORS: Record<string, string> = {
  paid: "#10b981",
  pending: "#f59e0b",
  failed: "#ef4444",
  cancelled: "#9ca3af",
  refunded: "#3b82f6",
  expired: "#6b7280",
  unknown: "#a1a1aa",
};

const CURRENCY_COLORS = ["#6366f1", "#ec4899", "#14b8a6", "#f97316", "#8b5cf6", "#0ea5e9"];

type Granularity = "day" | "week" | "month";

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function parseISO(d: string) {
  return new Date(d + "T00:00:00");
}

function isoDate(dt: Date) {
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

// Week starts on Saturday (Arabic locale)
function weekStart(dt: Date) {
  const copy = new Date(dt);
  const dow = copy.getDay(); // 0=Sun..6=Sat
  const diff = (dow - 6 + 7) % 7; // days since Saturday
  copy.setDate(copy.getDate() - diff);
  return copy;
}

function bucketKey(iso: string, g: Granularity) {
  const dt = parseISO(iso);
  if (g === "day") return iso;
  if (g === "month") return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-01`;
  return isoDate(weekStart(dt));
}

function shortDate(d: string, g: Granularity = "day") {
  if (!d || d.length < 10) return d;
  if (g === "month") return d.slice(0, 7); // yyyy-mm
  return d.slice(5); // mm-dd
}

function formatFullDate(iso?: string, g: Granularity = "day") {
  if (!iso) return "";
  try {
    const dt = parseISO(iso);
    if (g === "month") {
      return dt.toLocaleDateString("ar", { year: "numeric", month: "long" });
    }
    if (g === "week") {
      const end = new Date(dt);
      end.setDate(end.getDate() + 6);
      const fmt = (x: Date) =>
        x.toLocaleDateString("ar", { day: "numeric", month: "short" });
      return `الأسبوع ${fmt(dt)} — ${fmt(end)}`;
    }
    return dt.toLocaleDateString("ar", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function StatusTooltip({ active, payload, label, shortToFull, granularity }: any) {
  if (!active || !payload || !payload.length) return null;
  const full = shortToFull.get(label) || label;
  const rows = payload.filter((p: any) => Number(p.value) > 0);
  const total = rows.reduce((a: number, r: any) => a + Number(r.value || 0), 0);
  return (
    <div
      dir="rtl"
      className="rounded-xl border border-border bg-popover/95 backdrop-blur px-3 py-2 shadow-lg text-xs min-w-[190px]"
    >
      <div className="font-bold mb-1">{formatFullDate(full, granularity)}</div>
      <div className="text-[10px] text-muted-foreground mb-2">
        إجمالي العمليات: <span className="tabular-nums font-semibold">{total}</span>
      </div>
      {rows.length === 0 ? (
        <div className="text-muted-foreground">لا توجد عمليات</div>
      ) : (
        <ul className="space-y-1">
          {rows.map((r: any) => {
            const k = r.dataKey as string;
            const pct = total ? Math.round((Number(r.value) / total) * 100) : 0;
            return (
              <li key={k} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm"
                    style={{ background: r.color || STATUS_COLORS[k] }}
                  />
                  {STATUS_LABEL[k] || k}
                </span>
                <span className="font-semibold tabular-nums">
                  {r.value} <span className="text-muted-foreground">({pct}%)</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function RevenueTooltip({ active, payload, label, shortToFull, granularity }: any) {
  if (!active || !payload || !payload.length) return null;
  const full = shortToFull.get(label) || label;
  const rows = payload.filter((p: any) => Number(p.value) > 0);
  return (
    <div
      dir="rtl"
      className="rounded-xl border border-border bg-popover/95 backdrop-blur px-3 py-2 shadow-lg text-xs min-w-[210px]"
    >
      <div className="font-bold mb-1">{formatFullDate(full, granularity)}</div>
      <div className="text-[10px] text-muted-foreground mb-2">
        الإيرادات المُحصّلة (حالة «مدفوعة»)
      </div>
      {rows.length === 0 ? (
        <div className="text-muted-foreground">لا إيرادات في هذا اليوم</div>
      ) : (
        <ul className="space-y-1">
          {rows.map((r: any) => (
            <li key={r.dataKey} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ background: r.color }}
                />
                {r.dataKey}
              </span>
              <span className="font-semibold tabular-nums">
                {formatAmount(Number(r.value))} {r.dataKey}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type ChartSelection = {
  kind: "status" | "currency";
  key: string; // status name or currency code
  date?: string; // full yyyy-mm-dd
};

export function FinanceCharts({
  daily,
  currencies,
  onSelect,
  active,
}: {
  daily: DailyRow[];
  currencies: string[];
  onSelect?: (sel: ChartSelection) => void;
  active?: ChartSelection | null;
}) {
  const statusKeys = Object.keys(STATUS_LABEL);
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [hiddenCurrencies, setHiddenCurrencies] = useState<Set<string>>(new Set());
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  const tickFontSize = isMobile ? 9 : 11;
  const legendFontSize = isMobile ? 10 : 11;
  const chartHeight = isMobile ? "h-56" : "h-72";
  const visibleCurrencies = currencies.filter((c) => !hiddenCurrencies.has(c));
  const toggleCurrency = (c: string) => {
    setHiddenCurrencies((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  const aggregated = useMemo<DailyRow[]>(() => {
    if (granularity === "day") return daily;
    const map = new Map<string, DailyRow>();
    for (const d of daily) {
      const key = bucketKey(d.date, granularity);
      let row = map.get(key);
      if (!row) {
        row = { date: key, revenueByCurrency: {}, countsByStatus: {} };
        map.set(key, row);
      }
      for (const [c, v] of Object.entries(d.revenueByCurrency || {})) {
        row.revenueByCurrency[c] = (row.revenueByCurrency[c] || 0) + (v || 0);
      }
      for (const [s, v] of Object.entries(d.countsByStatus || {})) {
        row.countsByStatus[s] = (row.countsByStatus[s] || 0) + (v || 0);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [daily, granularity]);

  const shortToFull = useMemo(
    () => new Map(aggregated.map((d) => [shortDate(d.date, granularity), d.date])),
    [aggregated, granularity],
  );

  const barData = aggregated.map((d) => {
    const row: Record<string, number | string> = { date: shortDate(d.date, granularity) };
    for (const s of statusKeys) row[s] = d.countsByStatus[s] || 0;
    return row;
  });

  const lineData = aggregated.map((d) => {
    const row: Record<string, number | string> = { date: shortDate(d.date, granularity) };
    for (const c of currencies) row[c] = Math.round((d.revenueByCurrency[c] || 0) * 100) / 100;
    return row;
  });

  const empty = aggregated.length === 0;

  const handleBarClick = (statusKey: string) => (payload: any) => {
    if (!onSelect || !payload) return;
    // Only pass a date filter in daily mode; buckets don't map to exact dates.
    const shortD = payload?.payload?.date as string | undefined;
    const full = granularity === "day" && shortD ? shortToFull.get(shortD) : undefined;
    onSelect({ kind: "status", key: statusKey, date: full });
  };

  const handleDotClick = (currency: string) => (payload: any) => {
    if (!onSelect || !payload) return;
    const shortD = payload?.payload?.date as string | undefined;
    const full = granularity === "day" && shortD ? shortToFull.get(shortD) : undefined;
    onSelect({ kind: "currency", key: currency, date: full });
  };

  const granLabel: Record<Granularity, string> = {
    day: "يومياً",
    week: "أسبوعياً",
    month: "شهرياً",
  };
  const granUnit: Record<Granularity, string> = {
    day: "أيام",
    week: "أسابيع",
    month: "أشهر",
  };

  const GranularityToggle = (
    <div
      role="tablist"
      aria-label="تجميع البيانات"
      className="inline-flex items-center rounded-lg border border-border bg-background p-0.5 text-[11px]"
    >
      {(["day", "week", "month"] as Granularity[]).map((g) => (
        <button
          key={g}
          role="tab"
          aria-selected={granularity === g}
          onClick={() => setGranularity(g)}
          className={
            "px-2.5 py-1 rounded-md transition " +
            (granularity === g
              ? "bg-primary text-primary-foreground font-bold"
              : "text-muted-foreground hover:bg-muted")
          }
        >
          {granLabel[g]}
        </button>
      ))}
    </div>
  );

  const csvEscape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const downloadCsv = (filename: string, rows: (string | number)[][]) => {
    const body = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  const stamp = () => new Date().toISOString().slice(0, 10);

  const exportStatusCsv = () => {
    const header = ["الفترة", "التاريخ", ...statusKeys.map((s) => STATUS_LABEL[s]), "الإجمالي"];
    const rows: (string | number)[][] = [header];
    for (const d of aggregated) {
      const counts = statusKeys.map((s) => d.countsByStatus[s] || 0);
      const total = counts.reduce((a, b) => a + b, 0);
      rows.push([granLabel[granularity], formatFullDate(d.date, granularity), ...counts, total]);
    }
    downloadCsv(`charts-statuses-${granularity}-${stamp()}.csv`, rows);
  };

  const exportRevenueCsv = () => {
    const header = ["الفترة", "التاريخ", ...currencies.map((c) => `الإيراد (${c})`)];
    const rows: (string | number)[][] = [header];
    for (const d of aggregated) {
      const vals = currencies.map(
        (c) => Math.round((d.revenueByCurrency[c] || 0) * 100) / 100,
      );
      rows.push([granLabel[granularity], formatFullDate(d.date, granularity), ...vals]);
    }
    downloadCsv(`charts-revenue-${granularity}-${stamp()}.csv`, rows);
  };

  const ExportBtn = ({ onClick, label }: { onClick: () => void; label: string }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={empty}
      className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-semibold hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
      aria-label={label}
      title={label}
    >
      ⬇ CSV
    </button>
  );

  return (
    <section className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="p-4 rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between mb-1 gap-2">
          <h3 className="font-display text-base font-extrabold">توزيع الحالات {granLabel[granularity]}</h3>
          <div className="flex items-center gap-2">
            <ExportBtn onClick={exportStatusCsv} label="تصدير بيانات المخطط CSV" />
            {GranularityToggle}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          عدد العمليات لكل حالة عبر {granUnit[granularity]} الفترة المختارة — اضغط شريحة لفلترة الجدول
        </p>
        <div className="h-72" dir="ltr">
          {empty ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              لا توجد بيانات في هذه الفترة
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.35 }}
                  content={<StatusTooltip shortToFull={shortToFull} granularity={granularity} />}
                />

                <Legend
                  wrapperStyle={{ fontSize: 11, direction: "rtl", cursor: "pointer" }}
                  formatter={(v) => STATUS_LABEL[v as string] || v}
                  onClick={(o: any) =>
                    onSelect && o?.value && onSelect({ kind: "status", key: String(o.value) })
                  }
                />
                {statusKeys.map((s) => {
                  const dim =
                    active && active.kind === "status" && active.key !== s ? 0.25 : 1;
                  return (
                    <Bar
                      key={s}
                      dataKey={s}
                      stackId="a"
                      fill={STATUS_COLORS[s]}
                      fillOpacity={dim}
                      onClick={handleBarClick(s)}
                      style={{ cursor: "pointer" }}
                    />
                  );
                })}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="p-4 rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between mb-1 gap-2">
          <h3 className="font-display text-base font-extrabold">إجمالي الإيرادات {granLabel[granularity]}</h3>
          <div className="flex items-center gap-2">
            <ExportBtn onClick={exportRevenueCsv} label="تصدير بيانات المخطط CSV" />
            <span className="text-[10px] text-muted-foreground">اضغط نقطة لفلترة الجدول</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          الإيرادات المُحصّلة (حالة «مدفوعة») لكل عملة، مُجمَّعة حسب {granUnit[granularity]} الفترة
        </p>
        <div className="h-72" dir="ltr">
          {empty || currencies.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              لا توجد إيرادات في هذه الفترة
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatAmount(Number(v))} />
                <Tooltip
                  cursor={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.35 }}
                  content={<RevenueTooltip shortToFull={shortToFull} granularity={granularity} />}
                />

                <Legend
                  wrapperStyle={{ fontSize: 11, cursor: "pointer" }}
                  onClick={(o: any) =>
                    onSelect && o?.value && onSelect({ kind: "currency", key: String(o.value) })
                  }
                />
                {currencies.map((c, i) => {
                  const dim =
                    active && active.kind === "currency" && active.key !== c ? 0.2 : 1;
                  return (
                    <Line
                      key={c}
                      type="monotone"
                      dataKey={c}
                      stroke={CURRENCY_COLORS[i % CURRENCY_COLORS.length]}
                      strokeOpacity={dim}
                      strokeWidth={2}
                      dot={{ r: 3, style: { cursor: "pointer" } }}
                      activeDot={{
                        r: 6,
                        style: { cursor: "pointer" },
                        onClick: (_: any, payload: any) => handleDotClick(c)(payload),
                      }}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </section>
  );
}
