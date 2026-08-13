import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getSearchAnalytics } from "@/lib/search-analytics.functions";

export const Route = createFileRoute("/_authenticated/admin/search-analytics")({
  component: SearchAnalyticsPage,
  head: () => ({
    meta: [
      { title: "إحصاءات البحث العربي | لوحة الإدارة" },
      { name: "description", content: "استعلامات البحث العربي المطبّع، نسبة النتائج، والاستعلامات الفاشلة في pg_trgm." },
      { property: "og:title", content: "إحصاءات البحث العربي | لوحة الإدارة" },
      { property: "og:description", content: "تحليل أداء البحث العربي المطبّع داخل منصة بدّل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error }) => <div className="p-8 text-destructive" dir="rtl">{error.message}</div>,
});

function SearchAnalyticsPage() {
  const fetchStats = useServerFn(getSearchAnalytics);
  const [days, setDays] = useState(30);
  const { data, isLoading, error } = useQuery({
    queryKey: ["search-analytics", days],
    queryFn: () => fetchStats({ data: { days } }),
  });

  return (
    <div dir="rtl" className="min-h-screen bg-background font-body p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <h1 className="font-display text-3xl font-extrabold">إحصاءات البحث العربي</h1>
        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-2 rounded-lg bg-stone-soft border border-border text-sm"
          >
            <option value={7}>آخر 7 أيام</option>
            <option value={30}>آخر 30 يوماً</option>
            <option value={90}>آخر 90 يوماً</option>
          </select>
          <Link to="/admin" className="text-primary font-bold hover:underline text-sm">← لوحة المشرف</Link>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>}
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}

      {data && (
        <>
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <Kpi label="إجمالي عمليات البحث" value={data.kpis.total} />
            <Kpi label="نسبة النتائج الناجحة" value={`${data.kpis.hitRate}%`} />
            <Kpi label="بحث بلا نتائج" value={`${data.kpis.zeroRate}%`} highlight={data.kpis.zeroRate > 40} />
            <Kpi label="أخطاء المطابقة" value={`${data.kpis.errors} (${data.kpis.errorRate}%)`} highlight={data.kpis.errors > 0} />
            <Kpi label="متوسط عدد النتائج" value={data.kpis.avgResults} />
            <Kpi label="متوسط زمن الاستجابة" value={`${data.kpis.avgMs} مللي`} />
            <Kpi label="مصادر البحث" value={data.bySource.length} />
            <Kpi label="استعلامات فريدة" value={data.topQueries.length} />
          </section>

          {data.kpis.total === 0 && (
            <p className="text-sm text-muted-foreground mb-8">
              لا توجد بيانات بحث مسجّلة بعد في هذه الفترة — ستظهر تلقائياً مع أول عمليات بحث.
            </p>
          )}

          <Section title="أكثر الاستعلامات شيوعاً (بعد التطبيع)">
            <Table
              head={["الاستعلام المطبّع", "النص الأصلي", "عدد المرات", "متوسط النتائج", "نسبة بلا نتائج"]}
              rows={data.topQueries.map((q) => [q.normalized, q.raw, q.count, q.avgResults, `${q.zeroRate}%`])}
            />
          </Section>

          <Section title="استعلامات بلا نتائج (فجوات المخزون أو التطبيع)">
            <Table
              head={["الاستعلام المطبّع", "النص الأصلي", "عدد المرات"]}
              rows={data.zeroQueries.map((q) => [q.normalized, q.raw, q.count])}
            />
          </Section>

          <Section title="حسب المصدر">
            <Table
              head={["المصدر", "عدد عمليات البحث", "نسبة بلا نتائج"]}
              rows={data.bySource.map((s) => [s.source, s.count, `${s.zeroRate}%`])}
            />
          </Section>

          <Section title="التوزيع اليومي">
            <Table
              head={["اليوم", "عمليات البحث", "نسبة بلا نتائج"]}
              rows={data.daily.map((d) => [d.day, d.count, `${d.zeroRate}%`])}
            />
          </Section>

          <Section title="أخطاء مطابقة pg_trgm">
            <Table
              head={["الاستعلام", "الخطأ", "التاريخ"]}
              rows={data.errorSamples.map((e) => [e.q, e.error, new Date(e.at).toLocaleString("ar")])}
            />
          </Section>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`p-4 rounded-2xl border ${highlight ? "bg-primary/10 border-primary/30" : "bg-card border-border"}`}>
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold mb-1">{label}</div>
      <div className="font-display text-2xl font-extrabold">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="font-display text-xl font-extrabold mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: Array<Array<string | number>> }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">لا توجد بيانات.</p>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-stone-soft/60">
            {head.map((h) => (
              <th key={h} className="text-right px-3 py-2 text-xs font-bold text-muted-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border">
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2 align-top">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
