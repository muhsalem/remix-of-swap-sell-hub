import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listErrorLogs, listEscrowHolds } from "@/lib/admin.functions";
import { AlertTriangle, ShieldCheck, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/monitoring")({
  component: MonitoringPage,
  errorComponent: ({ error }) => <div className="p-8 text-destructive" dir="rtl">{error.message}</div>,
});

function MonitoringPage() {
  const errFn = useServerFn(listErrorLogs);
  const escFn = useServerFn(listEscrowHolds);
  const { data: errs } = useQuery({ queryKey: ["admin-errors"], queryFn: () => errFn() });
  const { data: esc } = useQuery({ queryKey: ["admin-escrow"], queryFn: () => escFn() });

  return (
    <div dir="rtl" className="min-h-screen bg-background font-body p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl font-extrabold flex items-center gap-2">
          <ShieldCheck className="size-7 text-primary" /> المراقبة والضمان
        </h1>
        <Link to="/admin" className="text-sm text-primary font-bold hover:underline flex items-center gap-1">
          <ArrowLeft className="size-4" /> لوحة المشرف
        </Link>
      </div>

      <section className="mb-10">
        <h2 className="font-display text-xl font-extrabold mb-4">حسابات الضمان (Escrow)</h2>
        {esc && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Stat label="محجوز حالياً" value={`${Math.round(esc.totals.held).toLocaleString()} ر.س`} highlight />
            <Stat label="مُحرَّر" value={`${Math.round(esc.totals.released).toLocaleString()} ر.س`} />
            <Stat label="مُسترَد" value={`${Math.round(esc.totals.refunded).toLocaleString()} ر.س`} />
          </div>
        )}
        <div className="bg-card rounded-2xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-stone-soft">
              <tr>
                <th className="p-2 text-right">العرض</th>
                <th className="p-2 text-right">المبلغ</th>
                <th className="p-2 text-right">الحالة</th>
                <th className="p-2 text-right">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {(esc?.holds ?? []).map((h: any) => (
                <tr key={h.id} className="border-t border-border">
                  <td className="p-2 font-mono text-xs">{h.offer_id.slice(0, 8)}…</td>
                  <td className="p-2 font-bold">{Number(h.amount_sar).toLocaleString()} ر.س</td>
                  <td className="p-2"><StatusBadge status={h.status} /></td>
                  <td className="p-2 text-xs text-muted-foreground">{new Date(h.held_at).toLocaleString("ar")}</td>
                </tr>
              ))}
              {esc?.holds.length === 0 && (
                <tr><td colSpan={4} className="p-6 text-center text-muted-foreground text-sm">لا توجد حجوزات ضمان حالياً.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl font-extrabold mb-4 flex items-center gap-2">
          <AlertTriangle className="size-5 text-destructive" /> سجل الأخطاء (آخر 100)
        </h2>
        <div className="bg-card rounded-2xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-stone-soft">
              <tr>
                <th className="p-2 text-right">الوقت</th>
                <th className="p-2 text-right">الدالة/المسار</th>
                <th className="p-2 text-right">الرسالة</th>
              </tr>
            </thead>
            <tbody>
              {(errs?.logs ?? []).map((l: any) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="p-2 text-xs text-muted-foreground whitespace-nowrap">{new Date(l.created_at).toLocaleString("ar")}</td>
                  <td className="p-2 text-xs font-mono">{l.fn_name ?? l.route ?? "—"}</td>
                  <td className="p-2 text-xs">{l.message}</td>
                </tr>
              ))}
              {errs?.logs.length === 0 && (
                <tr><td colSpan={3} className="p-6 text-center text-muted-foreground text-sm">لا توجد أخطاء مسجّلة. 🎉</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-4 rounded-2xl border ${highlight ? "bg-primary/10 border-primary/30" : "bg-card border-border"}`}>
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold mb-1">{label}</div>
      <div className="font-display text-xl font-extrabold">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    held: "bg-emerald-100 text-emerald-700",
    released: "bg-blue-100 text-blue-700",
    refunded: "bg-amber-100 text-amber-700",
  };
  const label: Record<string, string> = { held: "محجوز", released: "مُحرَّر", refunded: "مُسترَد" };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${map[status] ?? "bg-muted"}`}>{label[status] ?? status}</span>;
}
