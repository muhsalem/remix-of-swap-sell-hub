import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListWaitlist } from "@/lib/waitlist-admin.functions";

export const Route = createFileRoute("/_authenticated/admin/waitlist")({
  component: AdminWaitlist,
  errorComponent: ({ error }) => (
    <div dir="rtl" className="p-8 text-destructive font-body">{error.message}</div>
  ),
});

function AdminWaitlist() {
  const fn = useServerFn(adminListWaitlist);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-waitlist"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
  });

  return (
    <div dir="rtl" className="min-h-screen bg-background font-body p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold">قائمة الانتظار</h1>
          <p className="text-sm text-muted-foreground mt-1">
            المشتركون في البيتا مع مصادر الحملات والتحويلات
          </p>
        </div>
        <Link to="/admin" className="text-primary font-bold hover:underline text-sm">
          ← لوحة المشرف
        </Link>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <Kpi label="إجمالي" value={data.total} accent />
            <Kpi label="مصر" value={data.byCountry["EG"] || 0} />
            <Kpi label="السعودية" value={data.byCountry["SA"] || 0} />
            <Kpi label="تمّت دعوتهم" value={data.invited} />
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <Breakdown title="حسب الحملة" items={data.byCampaign} />
            <Breakdown title="حسب المصدر" items={data.bySource} />
          </div>

          <div className="rounded-2xl border border-border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-start p-3 font-bold">التاريخ</th>
                  <th className="text-start p-3 font-bold">البريد</th>
                  <th className="text-start p-3 font-bold">الدولة</th>
                  <th className="text-start p-3 font-bold">الدور</th>
                  <th className="text-start p-3 font-bold">الحملة</th>
                  <th className="text-start p-3 font-bold">المصدر</th>
                  <th className="text-start p-3 font-bold">إحالة</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r: any) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString("ar")}
                    </td>
                    <td className="p-3 font-mono text-xs">{r.email}</td>
                    <td className="p-3">{r.country || "—"}</td>
                    <td className="p-3">{r.role || "—"}</td>
                    <td className="p-3">{r.utm_campaign || "—"}</td>
                    <td className="p-3">{r.utm_source || "—"}</td>
                    <td className="p-3">{r.referral_code || "—"}</td>
                  </tr>
                ))}
                {data.rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-muted-foreground">
                      لا توجد تسجيلات بعد.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
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
      <div className="font-display text-2xl font-extrabold">{value}</div>
    </div>
  );
}

function Breakdown({ title, items }: { title: string; items: Record<string, number> }) {
  const entries = Object.entries(items).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = entries[0]?.[1] || 1;
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-bold mb-3">{title}</h3>
      {entries.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
      <div className="space-y-2">
        {entries.map(([k, v]) => (
          <div key={k}>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium">{k}</span>
              <span className="text-muted-foreground">{v}</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary"
                style={{ width: `${(v / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
