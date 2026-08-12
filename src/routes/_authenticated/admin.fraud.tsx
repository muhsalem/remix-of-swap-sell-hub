import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Nav } from "@/components/Nav";
import {
  listFraudSignals,
  reviewFraudSignal,
  setAccountSuspension,
} from "@/lib/fraud-admin.functions";
import { ShieldAlert, Loader2, Ban, Check, RotateCcw, HelpCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type Status = "all" | "pending" | "cleared" | "confirmed_fraud" | "needs_info";

const TABS: { key: Status; label: string }[] = [
  { key: "pending", label: "قيد المراجعة" },
  { key: "needs_info", label: "بحاجة لمعلومات" },
  { key: "confirmed_fraud", label: "احتيال مؤكد" },
  { key: "cleared", label: "مقبولة" },
  { key: "all", label: "الكل" },
];

const SEV: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive",
  high: "bg-destructive/10 text-destructive",
  medium: "bg-amber-500/15 text-amber-600",
  low: "bg-muted text-muted-foreground",
};

export const Route = createFileRoute("/_authenticated/admin/fraud")({
  head: () => ({
    meta: [
      { title: "لوحة إشارات الاحتيال (مشرف) — بادل بادل" },
      { name: "description", content: "مراجعة إشارات الاحتيال لكل إعلان وعزل الحسابات المشبوهة." },
      { property: "og:title", content: "لوحة إشارات الاحتيال — بادل بادل" },
      { property: "og:description", content: "مراجعة إشارات الاحتيال وعزل الحسابات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div dir="rtl" className="min-h-screen bg-background">
      <Nav />
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <ShieldAlert className="size-12 mx-auto text-destructive mb-4" />
        <p className="text-destructive font-bold">{error.message}</p>
      </div>
    </div>
  ),
  notFoundComponent: () => <div className="p-12 text-center">غير موجود</div>,
  component: AdminFraudPage,
});

function AdminFraudPage() {
  const [status, setStatus] = useState<Status>("pending");
  const fetchSignals = useServerFn(listFraudSignals);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "fraud", status],
    queryFn: () => fetchSignals({ data: { status } }),
  });

  return (
    <div dir="rtl" className="min-h-screen bg-background font-body">
      <Nav />
      <main className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-extrabold mb-2 flex items-center gap-2">
          <ShieldAlert className="text-destructive" /> إشارات الاحتيال
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          مراجعة الإشارات المرصودة لكل إعلان/حساب، مع إمكانية عزل الحساب أو تحويله لمراجعة يدوية.
        </p>

        <div className="flex flex-wrap gap-2 mb-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatus(t.key)}
              className={`text-xs px-3 py-1.5 rounded-full font-bold ring-1 ring-black/5 transition ${
                status === t.key ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="bg-destructive/5 ring-1 ring-destructive/20 rounded-2xl p-6 text-destructive text-sm">
            {error instanceof Error ? error.message : "تعذّر تحميل الإشارات"}
          </div>
        ) : (data?.signals.length ?? 0) === 0 ? (
          <div className="bg-card ring-1 ring-black/5 rounded-2xl p-12 text-center text-muted-foreground">
            لا توجد إشارات في هذا التصنيف.
          </div>
        ) : (
          <ul className="space-y-4">
            {data!.signals.map((s: any) => (
              <SignalCard key={s.id} s={s} statusKey={status} />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function SignalCard({ s, statusKey }: { s: any; statusKey: Status }) {
  const qc = useQueryClient();
  const review = useServerFn(reviewFraudSignal);
  const suspend = useServerFn(setAccountSuspension);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const suspended = !!s.profile?.is_suspended;

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "fraud"] });

  const act = async (review_status: "cleared" | "confirmed_fraud" | "needs_info") => {
    setBusy(review_status);
    try {
      await review({ data: { id: s.id, review_status, note: note.trim() || undefined } });
      toast.success("تم تحديث حالة الإشارة");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التحديث");
    } finally {
      setBusy(null);
    }
  };

  const toggleSuspend = async () => {
    if (!s.user_id) return;
    setBusy("suspend");
    try {
      await suspend({
        data: { user_id: s.user_id, suspend: !suspended, reason: suspended ? undefined : reason.trim() },
      });
      toast.success(suspended ? "تم رفع العزل عن الحساب" : "تم عزل الحساب");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل تنفيذ الإجراء");
    } finally {
      setBusy(null);
    }
  };

  return (
    <li className="bg-card ring-1 ring-black/5 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] px-2 py-1 rounded-full font-bold ${SEV[s.severity] ?? SEV.low}`}>
              {s.severity}
            </span>
            <span className="text-xs px-2 py-1 rounded-full bg-muted font-bold">{s.kind}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(s.created_at).toLocaleString("ar-EG")}
            </span>
            {suspended && (
              <span className="text-[11px] px-2 py-1 rounded-full bg-destructive/15 text-destructive font-bold">
                حساب معزول
              </span>
            )}
          </div>
          <p className="text-sm font-bold mt-2 truncate">
            {s.listing?.title ?? "بدون إعلان مرتبط"}
            {s.listing?.market_price ? (
              <span className="text-muted-foreground font-normal"> — {Number(s.listing.market_price).toLocaleString("ar-EG")} ر.س</span>
            ) : null}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            الحساب: {s.profile?.display_name ?? s.user_id ?? "—"}
            {s.profile?.verified_badge ? " • موثّق" : ""}
          </p>
        </div>
        {s.listing_id && (
          <Link
            to="/listings/$id"
            params={{ id: s.listing_id }}
            className="text-xs text-primary hover:underline whitespace-nowrap flex items-center gap-1"
          >
            فتح الإعلان <ExternalLink className="size-3" />
          </Link>
        )}
      </div>

      {s.details && Object.keys(s.details).length > 0 && (
        <pre className="text-[11px] bg-muted/50 rounded-xl p-3 overflow-x-auto mb-3 leading-5" dir="ltr">
          {JSON.stringify(s.details, null, 2)}
        </pre>
      )}

      {s.review_note && (
        <p className="text-xs text-muted-foreground mb-3">ملاحظة سابقة: {s.review_note}</p>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ملاحظة المراجعة (اختياري)"
            className="w-full text-sm bg-background ring-1 ring-black/10 rounded-xl px-3 py-2 mb-2"
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => act("cleared")}
              disabled={!!busy}
              className="text-xs font-bold px-3 py-2 rounded-xl bg-primary/10 text-primary disabled:opacity-50 flex items-center gap-1"
            >
              {busy === "cleared" ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />} إشارة سليمة
            </button>
            <button
              onClick={() => act("needs_info")}
              disabled={!!busy}
              className="text-xs font-bold px-3 py-2 rounded-xl bg-muted text-foreground disabled:opacity-50 flex items-center gap-1"
            >
              {busy === "needs_info" ? <Loader2 className="size-3 animate-spin" /> : <HelpCircle className="size-3" />} مراجعة يدوية
            </button>
            <button
              onClick={() => act("confirmed_fraud")}
              disabled={!!busy}
              className="text-xs font-bold px-3 py-2 rounded-xl bg-destructive/10 text-destructive disabled:opacity-50 flex items-center gap-1"
            >
              {busy === "confirmed_fraud" ? <Loader2 className="size-3 animate-spin" /> : <ShieldAlert className="size-3" />} احتيال مؤكد
            </button>
          </div>
        </div>

        <div className="md:border-r md:pr-3 border-black/5">
          {!suspended && (
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="سبب عزل الحساب"
              className="w-full text-sm bg-background ring-1 ring-black/10 rounded-xl px-3 py-2 mb-2"
            />
          )}
          {suspended && s.profile?.suspension_reason && (
            <p className="text-xs text-muted-foreground mb-2">سبب العزل: {s.profile.suspension_reason}</p>
          )}
          <button
            onClick={toggleSuspend}
            disabled={!!busy || !s.user_id}
            className={`text-xs font-bold px-3 py-2 rounded-xl disabled:opacity-50 flex items-center gap-1 ${
              suspended ? "bg-primary/10 text-primary" : "bg-destructive text-destructive-foreground"
            }`}
          >
            {busy === "suspend" ? (
              <Loader2 className="size-3 animate-spin" />
            ) : suspended ? (
              <RotateCcw className="size-3" />
            ) : (
              <Ban className="size-3" />
            )}
            {suspended ? "رفع العزل" : "عزل الحساب وإغلاق إعلاناته"}
          </button>
          <p className="text-[11px] text-muted-foreground mt-2">
            العزل يوقف نشر إعلانات جديدة ويُغلق الإعلانات النشطة للحساب.
          </p>
        </div>
      </div>
      {statusKey === "all" && (
        <p className="text-[11px] text-muted-foreground mt-3">الحالة الحالية: {s.review_status}</p>
      )}
    </li>
  );
}
