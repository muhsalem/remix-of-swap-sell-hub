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
  const HIDDEN_CCY_KEY = "badel:finance-charts:hidden-currencies";
  const [hiddenCurrencies, setHiddenCurrencies] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = window.localStorage.getItem(HIDDEN_CCY_KEY);
      const arr = raw ? (JSON.parse(raw) as unknown) : null;
      return Array.isArray(arr) ? new Set(arr.filter((x): x is string => typeof x === "string")) : new Set();
    } catch {
      return new Set();
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(HIDDEN_CCY_KEY, JSON.stringify(Array.from(hiddenCurrencies)));
    } catch {}
  }, [hiddenCurrencies]);
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
  const tooltipTrigger: "hover" | "click" = isMobile ? "click" : "hover";
  const visibleCurrencies = currencies.filter((c) => !hiddenCurrencies.has(c));
  const toggleCurrency = (c: string) => {
    setHiddenCurrencies((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  // Long-press on mobile: hold ~350ms on a bar/dot to open the tooltip immediately.
  const longPress = useMemo(
    () => ({ id: 0 as any, x: 0, y: 0, moved: false }),
    [],
  );
  const startLongPress = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobile) return;
    const t = e.touches[0];
    if (!t) return;
    longPress.x = t.clientX;
    longPress.y = t.clientY;
    longPress.moved = false;
    clearTimeout(longPress.id);
    longPress.id = setTimeout(() => {
      if (longPress.moved) return;
      const node = document.elementFromPoint(longPress.x, longPress.y) as HTMLElement | null;
      if (!node) return;
      const opts: MouseEventInit = {
        bubbles: true,
        cancelable: true,
        clientX: longPress.x,
        clientY: longPress.y,
      };
      node.dispatchEvent(new MouseEvent("mouseover", opts));
      node.dispatchEvent(new MouseEvent("mousemove", opts));
      node.dispatchEvent(new MouseEvent("click", opts));
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try { (navigator as any).vibrate?.(15); } catch {}
      }
    }, 350);
  };
  const moveLongPress = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    if (!t) return;
    if (Math.hypot(t.clientX - longPress.x, t.clientY - longPress.y) > 8) {
      longPress.moved = true;
      clearTimeout(longPress.id);
    }
  };
  const endLongPress = () => clearTimeout(longPress.id);
  const touchHandlers = {
    onTouchStart: startLongPress,
    onTouchMove: moveLongPress,
    onTouchEnd: endLongPress,
    onTouchCancel: endLongPress,
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
    const cols = visibleCurrencies;
    const header = ["الفترة", "التاريخ", ...cols.map((c) => `الإيراد (${c})`)];
    const rows: (string | number)[][] = [header];
    for (const d of aggregated) {
      const vals = cols.map(
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
      <div className="p-3 sm:p-4 rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between mb-1 gap-2">
          <h3 className="font-display text-sm sm:text-base font-extrabold min-w-0 truncate">
            توزيع الحالات {granLabel[granularity]}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <ExportBtn onClick={exportStatusCsv} label="تصدير بيانات المخطط CSV" />
            {GranularityToggle}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          عدد العمليات لكل حالة عبر {granUnit[granularity]} الفترة المختارة — اضغط شريحة لفلترة الجدول
        </p>
        <div className={chartHeight} dir="ltr" {...touchHandlers} style={{ touchAction: "pan-y" }}>
          {empty ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              لا توجد بيانات في هذه الفترة
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: tickFontSize }} interval="preserveStartEnd" minTickGap={isMobile ? 12 : 4} />
                <YAxis tick={{ fontSize: tickFontSize }} allowDecimals={false} width={isMobile ? 28 : 40} />
                <Tooltip
                  trigger={tooltipTrigger}
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.35 }}
                  content={<StatusTooltip shortToFull={shortToFull} granularity={granularity} />}
                />


                <Legend
                  wrapperStyle={{ fontSize: legendFontSize, direction: "rtl", cursor: "pointer" }}
                  iconSize={isMobile ? 8 : 12}
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

      <div className="p-3 sm:p-4 rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between mb-1 gap-2">
          <h3 className="font-display text-sm sm:text-base font-extrabold min-w-0 truncate">
            إجمالي الإيرادات {granLabel[granularity]}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <ExportBtn onClick={exportRevenueCsv} label="تصدير بيانات المخطط CSV" />
            <span className="text-[10px] text-muted-foreground hidden sm:inline">
              اضغط نقطة لفلترة الجدول
            </span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          الإيرادات المُحصّلة (حالة «مدفوعة») لكل عملة، مُجمَّعة حسب {granUnit[granularity]} الفترة
        </p>
        {currencies.length > 0 && (
          <div
            className="flex flex-wrap items-center gap-1.5 mb-3"
            role="group"
            aria-label="إظهار/إخفاء العملات"
          >
            {currencies.map((c, i) => {
              const hidden = hiddenCurrencies.has(c);
              const color = CURRENCY_COLORS[i % CURRENCY_COLORS.length];
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCurrency(c)}
                  aria-pressed={!hidden}
                  className={
                    "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] sm:text-[11px] transition " +
                    (hidden
                      ? "border-border bg-background text-muted-foreground line-through opacity-60"
                      : "border-border bg-muted/50 text-foreground font-semibold")
                  }
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: hidden ? "transparent" : color, borderColor: color, borderWidth: 1 }}
                  />
                  {c}
                </button>
              );
            })}
            {hiddenCurrencies.size > 0 && (
              <button
                type="button"
                onClick={() => setHiddenCurrencies(new Set())}
                className="text-[10px] text-primary underline mx-1"
              >
                إظهار الكل
              </button>
            )}
          </div>
        )}
        <div className={chartHeight} dir="ltr" {...touchHandlers} style={{ touchAction: "pan-y" }}>
          {empty || visibleCurrencies.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              {currencies.length === 0
                ? "لا توجد إيرادات في هذه الفترة"
                : "لا توجد عملات مُختارة للعرض"}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: tickFontSize }} interval="preserveStartEnd" minTickGap={isMobile ? 12 : 4} />
                <YAxis
                  tick={{ fontSize: tickFontSize }}
                  tickFormatter={(v) => formatAmount(Number(v))}
                  width={isMobile ? 44 : 60}
                />
                <Tooltip
                  trigger={tooltipTrigger}
                  cursor={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.35 }}
                  content={<RevenueTooltip shortToFull={shortToFull} granularity={granularity} />}
                />

                <Legend
                  wrapperStyle={{ fontSize: legendFontSize, cursor: "pointer" }}
                  iconSize={isMobile ? 8 : 12}
                  onClick={(o: any) =>
                    onSelect && o?.value && onSelect({ kind: "currency", key: String(o.value) })
                  }
                />
                {visibleCurrencies.map((c) => {
                  const i = currencies.indexOf(c);
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
                      dot={{ r: isMobile ? 2 : 3, style: { cursor: "pointer" } }}
                      activeDot={{
                        r: isMobile ? 5 : 6,
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
