import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getFinanceMetrics } from "@/lib/admin.functions";
import { formatAmount } from "@/lib/format-price";

export const Route = createFileRoute("/_authenticated/admin/finance")({
  component: FinanceDashboard,
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive" dir="rtl">{error.message}</div>
  ),
});

function FinanceDashboard() {
  const fetchMetrics = useServerFn(getFinanceMetrics);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-finance"],
    queryFn: () => fetchMetrics(),
    refetchInterval: 60_000,
  });

  const sar = (n: number) => `${formatAmount(n)} ر.س`;
  const maxTrend = data ? Math.max(1, ...data.trend.map((t) => t.gmv)) : 1;

  return (
    <div dir="rtl" className="min-h-screen bg-background font-body p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold">لوحة المالية</h1>
          <p className="text-sm text-muted-foreground mt-1">MRR · GMV · Take Rate · النزاعات — يُحدَّث كل دقيقة</p>
        </div>
        <Link to="/admin" className="text-primary font-bold hover:underline text-sm">← لوحة المشرف</Link>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>}

      {data && (
        <>
          {/* Revenue */}
          <Section title="الإيرادات المتكررة">
            <Grid>
              <Kpi label="MRR" value={sar(data.mrr)} hint={`${data.activeSubs} اشتراك نشط`} accent />
              <Kpi label="ARR (متوقّع)" value={sar(data.arr)} />
              <Kpi label="اشتراكات تجّار" value={data.merchantSubs} />
              <Kpi label="اشتراكات محلات" value={data.storeSubs} />
            </Grid>
          </Section>

          {/* GMV */}
          <Section title="حجم البضاعة (GMV)">
            <Grid>
              <Kpi label="GMV إجمالي" value={sar(data.gmvAll)} accent />
              <Kpi
                label="GMV آخر 30 يوم"
                value={sar(data.gmv30)}
                hint={data.gmvGrowth !== null ? `${data.gmvGrowth >= 0 ? "▲" : "▼"} ${Math.abs(data.gmvGrowth)}% مقارنة بـ 30 يوم سابقة` : undefined}
                trendUp={data.gmvGrowth !== null && data.gmvGrowth >= 0}
              />
              <Kpi label="Take Rate" value={`${data.takeRate}%`} hint="عمولات ÷ GMV" />
              <Kpi label="Take Rate (30ي)" value={`${data.takeRate30}%`} />
            </Grid>
          </Section>

          {/* Fees */}
          <Section title="العمولات">
            <Grid>
              <Kpi label="عمولات مُحصّلة" value={sar(data.feesPaid)} accent />
              <Kpi label="عمولات مستحقة" value={sar(data.feesDue)} highlight={data.feesDue > 0} />
              <Kpi label="عمولات 30 يوم" value={sar(data.fees30)} />
              <Kpi label="إجمالي مُسجّل" value={sar(data.feesAll)} />
            </Grid>
          </Section>

          {/* Disputes */}
          <Section title="النزاعات">
            <Grid>
              <Kpi label="مفتوحة" value={data.disputes.open} highlight={data.disputes.open > 0} />
              <Kpi label="محلولة" value={data.disputes.resolved} />
              <Kpi label="مرفوضة" value={data.disputes.rejected} />
              <Kpi label="نسبة النزاع" value={`${data.disputes.disputeRate}%`} hint="من إجمالي الصفقات" />
              <Kpi label="متوسط زمن الحل" value={`${data.disputes.avgResolutionHrs} س`} />
              <Kpi label="إجمالي" value={data.disputes.total} />
            </Grid>
          </Section>

          {/* Trend chart */}
          <Section title="اتجاه GMV آخر 30 يوم">
            <div className="p-4 rounded-2xl border border-border bg-card">
              <div className="flex items-end gap-1 h-40">
                {data.trend.map((t) => (
                  <div key={t.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div
                      className="w-full bg-gradient-to-t from-primary to-primary/40 rounded-t transition-all"
                      style={{ height: `${(t.gmv / maxTrend) * 100}%`, minHeight: t.gmv > 0 ? "2px" : "0" }}
                    />
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-8 text-[10px] bg-foreground text-background px-2 py-1 rounded whitespace-nowrap pointer-events-none">
                      {t.date}: {sar(t.gmv)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
                <span>{data.trend[0]?.date}</span>
                <span>{data.trend[data.trend.length - 1]?.date}</span>
              </div>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="font-display text-lg font-extrabold mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{children}</div>;
}

function Kpi({
  label, value, hint, highlight, accent, trendUp,
}: {
  label: string; value: string | number; hint?: string;
  highlight?: boolean; accent?: boolean; trendUp?: boolean;
}) {
  return (
    <div
      className={`p-4 rounded-2xl border ${
        accent
          ? "bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30"
          : highlight
          ? "bg-destructive/5 border-destructive/30"
          : "bg-card border-border"
      }`}
    >
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold mb-1">{label}</div>
      <div className="font-display text-2xl font-extrabold">{value}</div>
      {hint && (
        <div className={`text-[11px] mt-1 ${trendUp === true ? "text-emerald-600" : trendUp === false ? "text-destructive" : "text-muted-foreground"}`}>
          {hint}
        </div>
      )}
    </div>
  );
}
