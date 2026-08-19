import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Nav } from "@/components/Nav";
import { listMyRefundRequests } from "@/lib/refunds.functions";
import { RotateCcw, ShieldCheck, Clock, CheckCircle2, Ban, Plus } from "lucide-react";

const refundsQuery = queryOptions({
  queryKey: ["my-refunds"],
  queryFn: () => listMyRefundRequests(),
});

export const Route = createFileRoute("/_authenticated/refunds")({
  loader: ({ context }) => context.queryClient.ensureQueryData(refundsQuery),
  head: () => ({
    meta: [
      { title: "طلبات الاسترداد — بادل" },
      { name: "description", content: "ابدأ طلب استرداد خلال 72 ساعة من الاستلام وتابع حالته والمستندات المطلوبة حتى الإغلاق." },
      { property: "og:title", content: "طلبات الاسترداد — بادل" },
      { property: "og:description", content: "تتبع طلبات الاسترداد المحمية بضمان بادل خلال نافذة 72 ساعة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error }) => <div className="p-12 text-center">{error.message}</div>,
  notFoundComponent: () => <div className="p-12 text-center">غير موجود</div>,
  component: RefundsPage,
});

const STATUS_META: Record<string, { label: string; cls: string; Icon: typeof Clock }> = {
  open: { label: "قيد الاستلام", cls: "bg-destructive/10 text-destructive", Icon: Clock },
  under_review: { label: "قيد المراجعة", cls: "bg-amber-500/10 text-amber-600", Icon: Clock },
  resolved: { label: "تمت الموافقة/الحسم", cls: "bg-primary/10 text-primary", Icon: CheckCircle2 },
  rejected: { label: "مرفوض", cls: "bg-muted text-muted-foreground", Icon: Ban },
};

function RefundsPage() {
  const { data } = useSuspenseQuery(refundsQuery);

  return (
    <div dir="rtl" className="min-h-screen bg-background font-body">
      <Nav />
      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <RotateCcw className="text-primary" /> طلبات الاسترداد
          </h1>
          <Link
            to="/refunds/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-foreground text-background text-sm font-bold hover:bg-primary transition-colors"
          >
            <Plus className="size-4" /> طلب استرداد جديد
          </Link>
        </div>

        <div className="mb-6 rounded-2xl bg-emerald-500/5 ring-1 ring-emerald-500/20 p-4 text-xs leading-relaxed flex gap-2">
          <ShieldCheck className="size-4 shrink-0 text-emerald-600 mt-0.5" />
          <p>
            كل صفقة محمية بضمان بَدِّل: لديك <b>72 ساعة</b> من الاستلام لفحص الغرض وفتح طلب استرداد.
            يبقى فارق القيمة محجوزاً في الضمان حتى صدور القرار — أول رد خلال 24 ساعة.
          </p>
        </div>

        {data.requests.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="mb-3">لا توجد طلبات استرداد.</p>
            <Link to="/refunds/new" className="text-primary font-bold hover:underline">ابدأ طلباً جديداً ←</Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {data.requests.map((r) => {
              const meta = STATUS_META[r.status] ?? STATUS_META.open!;
              const Icon = meta.Icon;
              return (
                <li key={r.id} className="bg-card ring-1 ring-black/5 rounded-2xl p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-bold ${meta.cls}`}>
                      <Icon className="size-3.5" /> {meta.label}
                    </span>
                    <div className="flex gap-3">
                      <Link to="/disputes/$id" params={{ id: r.id }} className="text-xs text-primary font-bold hover:underline">
                        متابعة الطلب ←
                      </Link>
                      <Link to="/offers/$id" params={{ id: r.offer_id }} className="text-xs text-muted-foreground hover:underline">
                        الصفقة
                      </Link>
                    </div>
                  </div>
                  <p className="text-sm font-bold">{r.reason}</p>
                  {r.evidence && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.evidence}</p>}
                  <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground mt-2">
                    <span>المبلغ المحجوز: {r.amount.toLocaleString("ar-EG")} ر.س</span>
                    <span>{new Date(r.created_at).toLocaleString("ar")}</span>
                    {!r.mine && <span className="text-amber-600 font-bold">طلب من الطرف الآخر</span>}
                  </div>
                  {r.resolution && (
                    <p className="text-xs mt-2 p-2 bg-primary/5 rounded-lg">القرار: {r.resolution}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
