import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { RotateCcw, CheckCircle2, Ban, ShieldCheck } from "lucide-react";
import { getMyRefundReport } from "@/lib/refunds.functions";

export function RefundReportCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-refund-report"],
    queryFn: () => getMyRefundReport(),
  });

  if (isLoading) {
    return <div className="rounded-2xl border border-border bg-card p-6 h-32 animate-pulse" />;
  }
  if (!data || data.total === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <h2 className="font-bold flex items-center gap-2">
        <RotateCcw className="size-4 text-primary" /> تقرير طلبات الاسترداد
        <Link to="/refunds" className="mr-auto text-xs text-primary font-bold hover:underline">كل الطلبات ←</Link>
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div className="rounded-xl bg-stone-soft p-3">
          <div className="text-2xl font-extrabold">{data.total}</div>
          <div className="text-[11px] text-muted-foreground">إجمالي الطلبات</div>
        </div>
        <div className="rounded-xl bg-primary/5 p-3">
          <div className="text-2xl font-extrabold text-primary">{data.approvalRate}%</div>
          <div className="text-[11px] text-muted-foreground">نسبة القبول</div>
        </div>
        <div className="rounded-xl bg-emerald-500/5 p-3">
          <div className="text-2xl font-extrabold text-emerald-600">{data.refundedSAR.toLocaleString("ar-EG")}</div>
          <div className="text-[11px] text-muted-foreground">ضمان مسترد (ر.س)</div>
        </div>
        <div className="rounded-xl bg-amber-500/5 p-3">
          <div className="text-2xl font-extrabold text-amber-600">{data.heldSAR.toLocaleString("ar-EG")}</div>
          <div className="text-[11px] text-muted-foreground">محجوز قيد المراجعة (ر.س)</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><CheckCircle2 className="size-3.5 text-primary" /> مقبولة: {data.resolved}</span>
        <span className="flex items-center gap-1"><Ban className="size-3.5" /> مرفوضة: {data.rejected}</span>
        <span className="flex items-center gap-1"><ShieldCheck className="size-3.5 text-amber-600" /> قيد المراجعة: {data.pending}</span>
      </div>

      {data.topRejectionReasons.length > 0 && (
        <div>
          <div className="text-xs font-bold mb-1.5">أبرز أسباب الرفض</div>
          <ul className="space-y-1">
            {data.topRejectionReasons.map((r) => (
              <li key={r.reason} className="text-xs text-muted-foreground flex justify-between gap-3 bg-stone-soft rounded-lg px-3 py-1.5">
                <span className="line-clamp-1">{r.reason}</span>
                <span className="font-bold shrink-0">×{r.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
