import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { getAdminKPIs, listPendingKyc, reviewKyc } from "@/lib/admin.functions";
import { CommissionToggle } from "@/components/CommissionToggle";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminDashboard,
  errorComponent: ({ error }) => <div className="p-8 text-destructive" dir="rtl">{error.message}</div>,
});

function AdminDashboard() {
  const fetchKpis = useServerFn(getAdminKPIs);
  const fetchKyc = useServerFn(listPendingKyc);
  const review = useServerFn(reviewKyc);
  const qc = useQueryClient();

  const { data: kpis } = useQuery({ queryKey: ["admin-kpis"], queryFn: () => fetchKpis() });
  const { data: kyc } = useQuery({ queryKey: ["admin-kyc"], queryFn: () => fetchKyc() });

  const decide = useMutation({
    mutationFn: (v: { profile_id: string; decision: "verified" | "rejected"; notes: string }) =>
      review({ data: v }),
    onSuccess: () => {
      toast.success("تم التحديث");
      qc.invalidateQueries({ queryKey: ["admin-kyc"] });
      qc.invalidateQueries({ queryKey: ["admin-kpis"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div dir="rtl" className="min-h-screen bg-background font-body p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-2">
        <h1 className="font-display text-3xl font-extrabold">لوحة المشرف</h1>
        <div className="flex gap-3 text-sm">
          <Link to="/admin/finance" className="text-primary font-bold hover:underline">لوحة المالية →</Link>
          <Link to="/admin/payments-finance" className="text-primary font-bold hover:underline">مالية المدفوعات →</Link>
          <Link to="/admin/waitlist" className="text-primary font-bold hover:underline">قائمة الانتظار →</Link>
          <Link to="/admin/monitoring" className="text-primary font-bold hover:underline">المراقبة والضمان →</Link>
          <Link to="/admin/disputes" className="text-primary font-bold hover:underline">النزاعات →</Link>
          <Link to="/admin/refunds" className="text-primary font-bold hover:underline">طلبات الاسترداد →</Link>
          <Link to="/admin/fraud" className="text-primary font-bold hover:underline">إشارات الاحتيال →</Link>
          <Link to="/admin/listings" className="text-primary font-bold hover:underline">إدارة الإعلانات →</Link>
          <Link to="/admin/search-analytics" className="text-primary font-bold hover:underline">إحصاءات البحث →</Link>


          <Link to="/admin/shipping-cities" className="text-primary font-bold hover:underline">مدن الشحن →</Link>
          <Link to="/admin/payments-sandbox" className="text-primary font-bold hover:underline">مختبر المدفوعات →</Link>
          <Link to="/admin/audit" className="text-primary font-bold hover:underline">سجل التدقيق →</Link>
          <Link to="/admin/emails" className="text-primary font-bold hover:underline">طابور البريد →</Link>
        </div>
      </div>

      {kpis && (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          <Kpi label="مستخدمون" value={kpis.kpis.totalUsers} />
          <Kpi label="عروض نشطة" value={kpis.kpis.activeListings} />
          <Kpi label="إجمالي الصفقات" value={kpis.kpis.totalOffers} />
          <Kpi label="صفقات مكتملة" value={kpis.kpis.completedOffers} />
          <Kpi label="معدل الإكمال" value={`${kpis.kpis.completionRate}%`} />
          <Kpi label="GMV (ر.س)" value={kpis.kpis.gmvSAR.toLocaleString()} />
          <Kpi label="إجمالي العمولات" value={`${kpis.kpis.totalFeesSAR.toLocaleString()} ر.س`} />
          <Kpi label="عمولات مستحقة" value={`${kpis.kpis.dueFeesSAR.toLocaleString()} ر.س`} highlight />
          <Kpi label="نزاعات مفتوحة" value={kpis.kpis.openDisputes} highlight={kpis.kpis.openDisputes > 0} />
          <Kpi label="توثيقات معلّقة" value={kpis.kpis.pendingKyc} highlight={kpis.kpis.pendingKyc > 0} />
          <Kpi label="مكتمل ٣٠ يوم" value={kpis.kpis.completedLast30Days} />
        </section>
      )}

      <section className="mb-10">
        <h2 className="font-display text-xl font-extrabold mb-4">نموذج الأعمال</h2>
        <CommissionToggle />
      </section>


      <section>
        <h2 className="font-display text-xl font-extrabold mb-4">توثيق الشركات</h2>
        {kyc?.profiles.length === 0 && (
          <p className="text-sm text-muted-foreground">لا توجد طلبات توثيق حالياً.</p>
        )}
        <div className="space-y-3">
          {kyc?.profiles.map((p: any) => (
            <KycRow key={p.id} p={p} onDecide={decide.mutate} loading={decide.isPending} />
          ))}
        </div>
      </section>
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

function KycRow({ p, onDecide, loading }: { p: any; onDecide: (v: any) => void; loading: boolean }) {
  const [notes, setNotes] = useState("");
  return (
    <div className="p-4 rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-bold">{p.company_name || p.display_name}</div>
          <div className="text-xs text-muted-foreground mt-1">
            سجل تجاري: {p.commercial_register || "غير مُدخل"} · الحالة: <b>{p.company_kyc_status}</b>
          </div>
          {p.company_kyc_doc_url && (
            <a href={p.company_kyc_doc_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">عرض الوثيقة</a>
          )}
        </div>
        <div className="flex flex-col gap-2 w-full sm:w-auto">
          <input
            placeholder="ملاحظات (اختياري)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="px-3 py-2 rounded-lg bg-stone-soft border border-border text-xs"
          />
          <div className="flex gap-2">
            <button
              disabled={loading}
              onClick={() => onDecide({ profile_id: p.id, decision: "verified", notes })}
              className="px-3 py-2 bg-foreground text-background rounded-lg text-xs font-bold disabled:opacity-50"
            >توثيق ✓</button>
            <button
              disabled={loading}
              onClick={() => onDecide({ profile_id: p.id, decision: "rejected", notes })}
              className="px-3 py-2 bg-destructive text-destructive-foreground rounded-lg text-xs font-bold disabled:opacity-50"
            >رفض</button>
          </div>
        </div>
      </div>
    </div>
  );
}
