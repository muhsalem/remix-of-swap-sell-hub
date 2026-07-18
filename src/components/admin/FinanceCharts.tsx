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

function shortDate(d: string) {
  return d.length >= 10 ? d.slice(5) : d;
}

function formatFullDate(iso?: string) {
  if (!iso) return "";
  try {
    const dt = new Date(iso + "T00:00:00");
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

function StatusTooltip({ active, payload, label, shortToFull }: any) {
  if (!active || !payload || !payload.length) return null;
  const full = shortToFull.get(label) || label;
  const rows = payload.filter((p: any) => Number(p.value) > 0);
  const total = rows.reduce((a: number, r: any) => a + Number(r.value || 0), 0);
  return (
    <div
      dir="rtl"
      className="rounded-xl border border-border bg-popover/95 backdrop-blur px-3 py-2 shadow-lg text-xs min-w-[190px]"
    >
      <div className="font-bold mb-1">{formatFullDate(full)}</div>
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

function RevenueTooltip({ active, payload, label, shortToFull }: any) {
  if (!active || !payload || !payload.length) return null;
  const full = shortToFull.get(label) || label;
  const rows = payload.filter((p: any) => Number(p.value) > 0);
  return (
    <div
      dir="rtl"
      className="rounded-xl border border-border bg-popover/95 backdrop-blur px-3 py-2 shadow-lg text-xs min-w-[210px]"
    >
      <div className="font-bold mb-1">{formatFullDate(full)}</div>
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
  const shortToFull = new Map(daily.map((d) => [shortDate(d.date), d.date]));

  const barData = daily.map((d) => {
    const row: Record<string, number | string> = { date: shortDate(d.date) };
    for (const s of statusKeys) row[s] = d.countsByStatus[s] || 0;
    return row;
  });

  const lineData = daily.map((d) => {
    const row: Record<string, number | string> = { date: shortDate(d.date) };
    for (const c of currencies) row[c] = Math.round((d.revenueByCurrency[c] || 0) * 100) / 100;
    return row;
  });

  const empty = daily.length === 0;

  const handleBarClick = (statusKey: string) => (payload: any) => {
    if (!onSelect || !payload) return;
    const shortD = payload?.payload?.date as string | undefined;
    const full = shortD ? shortToFull.get(shortD) : undefined;
    onSelect({ kind: "status", key: statusKey, date: full });
  };

  const handleDotClick = (currency: string) => (payload: any) => {
    if (!onSelect || !payload) return;
    const shortD = payload?.payload?.date as string | undefined;
    const full = shortD ? shortToFull.get(shortD) : undefined;
    onSelect({ kind: "currency", key: currency, date: full });
  };

  return (
    <section className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="p-4 rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between mb-1 gap-2">
          <h3 className="font-display text-base font-extrabold">توزيع الحالات يومياً</h3>
          <span className="text-[10px] text-muted-foreground">اضغط شريحة لفلترة الجدول</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          عدد العمليات لكل حالة عبر أيام الفترة المختارة (مخطط أعمدة مكدّس)
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
                  content={<StatusTooltip shortToFull={shortToFull} />}
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
          <h3 className="font-display text-base font-extrabold">إجمالي الإيرادات يومياً</h3>
          <span className="text-[10px] text-muted-foreground">اضغط نقطة لفلترة الجدول</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          الإيرادات المُحصّلة (حالة «مدفوعة») حسب اليوم لكل عملة (مخطط خطي)
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
                  contentStyle={{ fontSize: 12, direction: "rtl" }}
                  formatter={(v: any, k: any) => [`${formatAmount(Number(v))} ${k}`, k]}
                  labelFormatter={(l) => `اليوم: ${l}`}
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
