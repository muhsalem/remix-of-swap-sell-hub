import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { quickShariahCheckByText, SAR_PER_DI } from "@/lib/pricing.functions";
import { History, CheckCircle2, XCircle, Clock, AlertTriangle, Ban, ShieldCheck, ArrowLeftRight } from "lucide-react";

const STATUS_LABEL: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  pending: { label: "قيد الانتظار", color: "bg-amber-100 text-amber-800 border-amber-200", Icon: Clock },
  accepted: { label: "مقبولة", color: "bg-emerald-100 text-emerald-800 border-emerald-200", Icon: CheckCircle2 },
  rejected: { label: "مرفوضة", color: "bg-rose-100 text-rose-800 border-rose-200", Icon: XCircle },
  completed: { label: "مكتملة", color: "bg-primary/10 text-primary border-primary/20", Icon: CheckCircle2 },
  cancelled: { label: "ملغاة", color: "bg-stone-200 text-stone-700 border-stone-300", Icon: XCircle },
};

type TxRow = {
  id: string;
  status: string;
  created_at: string;
  cash_balance: number | null;
  fairness_score: number | null;
  message: string | null;
  direction: "outgoing" | "incoming";
  offered: { id: string; title: string; category: string } | null;
  requested: { id: string; title: string; category: string } | null;
  shariah: { level: "safe" | "warning" | "forbidden"; rule: string } | null;
};

const getMyTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TxRow[]> => {
    const { supabase, userId } = context;
    const { data: offers } = await supabase
      .from("trade_offers")
      .select("id,status,created_at,cash_balance,fairness_score,message,from_user,to_user,offered_listing,requested_listing")
      .or(`from_user.eq.${userId},to_user.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (!offers || offers.length === 0) return [];
    const ids = Array.from(new Set(offers.flatMap((o) => [o.offered_listing, o.requested_listing]).filter(Boolean)));
    const { data: listings } = await supabase
      .from("listings")
      .select("id,title,category")
      .in("id", ids);
    const map = new Map((listings ?? []).map((l) => [l.id, l]));

    return offers.map((o) => {
      const offered = map.get(o.offered_listing) ?? null;
      const requested = map.get(o.requested_listing) ?? null;
      const shariah = (offered && requested)
        ? quickShariahCheckByText(
            { title: offered.title, category: offered.category },
            { title: requested.title, category: requested.category },
            Number(o.cash_balance ?? 0),
          )
        : null;
      return {
        id: o.id, status: o.status, created_at: o.created_at,
        cash_balance: o.cash_balance == null ? null : Number(o.cash_balance),
        fairness_score: o.fairness_score, message: o.message,
        direction: o.from_user === userId ? "outgoing" as const : "incoming" as const,
        offered: offered ? { id: offered.id, title: offered.title, category: offered.category } : null,
        requested: requested ? { id: requested.id, title: requested.title, category: requested.category } : null,
        shariah: shariah ? { level: shariah.level, rule: shariah.rule } : null,
      };
    });
  });

const txQO = queryOptions({ queryKey: ["my-transactions"], queryFn: () => getMyTransactions() });

export const Route = createFileRoute("/_authenticated/transactions")({
  loader: ({ context }) => context.queryClient.ensureQueryData(txQO),
  component: TransactionsPage,
  errorComponent: ({ error }) => (
    <div className="max-w-2xl mx-auto p-8 text-center text-destructive">تعذّر التحميل: {error.message}</div>
  ),
});

function TransactionsPage() {
  const { data: rows } = useSuspenseQuery(txQO);

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <History className="size-5 text-primary" /> سجل المعاملات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">جميع عمليات الشراء والبيع والمقايضة (DI Credit) مع الحالة والتقييم الشرعي.</p>
        </div>
        <Link to="/profile" className="text-sm text-primary hover:underline">← العودة للبروفايل</Link>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-16 rounded-3xl border border-dashed border-border bg-card">
          <ArrowLeftRight className="size-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">لا توجد معاملات بعد. ابدأ بإنشاء عرض أو قبول مقايضة.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const st = STATUS_LABEL[r.status] ?? STATUS_LABEL.pending;
            const StIcon = st.Icon;
            const ShIcon = r.shariah?.level === "forbidden" ? Ban : r.shariah?.level === "warning" ? AlertTriangle : ShieldCheck;
            return (
              <div key={r.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${st.color}`}>
                    <StIcon className="size-3.5" /> {st.label}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-stone-soft text-foreground/70">
                    {r.direction === "outgoing" ? "صادر مني" : "وارد إليّ"}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {new Date(r.created_at).toLocaleString("ar", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                  {r.fairness_score != null && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                      عدالة {r.fairness_score}%
                    </span>
                  )}
                  <Link to="/offers/$id" params={{ id: r.id }} className="ms-auto text-xs text-primary hover:underline">
                    تفاصيل ←
                  </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm">
                  <div className="rounded-xl bg-stone-soft p-3">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">المعروض</div>
                    <div className="font-bold truncate">{r.offered?.title ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.offered?.category ?? ""}</div>
                  </div>
                  <ArrowLeftRight className="size-5 text-primary mx-auto" />
                  <div className="rounded-xl bg-stone-soft p-3">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">المطلوب</div>
                    <div className="font-bold truncate">{r.requested?.title ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.requested?.category ?? ""}</div>
                  </div>
                </div>

                {(r.cash_balance && r.cash_balance > 0) && (
                  <div className="mt-3 text-xs text-muted-foreground">
                    موازنة نقدية: <b className="text-foreground">{(r.cash_balance / SAR_PER_DI).toFixed(2)} DI</b> ({r.cash_balance.toLocaleString()} ر.س)
                  </div>
                )}

                {r.shariah && (
                  <div className={`mt-3 p-3 rounded-xl text-xs flex items-start gap-2 border ${
                    r.shariah.level === "forbidden" ? "bg-destructive/10 border-destructive/30 text-destructive"
                    : r.shariah.level === "warning" ? "bg-accent/10 border-accent/30"
                    : "bg-primary/5 border-primary/20"
                  }`}>
                    <ShIcon className="size-4 mt-0.5 shrink-0" />
                    <div>
                      <div className="font-bold mb-0.5">الفحص الشرعي</div>
                      <div className="opacity-90">{r.shariah.rule}</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
