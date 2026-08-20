import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Nav } from "@/components/Nav";
import { listRefundsAdmin } from "@/lib/refunds-admin.functions";
import { resolveDispute } from "@/lib/admin.functions";
import { getDisputeAttachmentUrl } from "@/lib/storage";
import { RotateCcw, Paperclip, Loader2, Check, X, Clock } from "lucide-react";

const refundsQuery = (status: string) =>
  queryOptions({
    queryKey: ["admin", "refunds", status],
    queryFn: () => listRefundsAdmin({ data: { status } }),
  });

export const Route = createFileRoute("/_authenticated/admin/refunds")({
  head: () => ({
    meta: [
      { title: "إدارة طلبات الاسترداد — بادل" },
      { name: "description", content: "لوحة المشرفين لطلبات الاسترداد: فلترة حسب الحالة ومراجعة الوثائق والمرفقات وإصدار القرار." },
      { property: "og:title", content: "إدارة طلبات الاسترداد — بادل" },
      { property: "og:description", content: "فلترة طلبات الاسترداد ومراجعة المرفقات وإصدار القرارات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error }) => <div className="p-12 text-center text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-12 text-center">غير موجود</div>,
  component: AdminRefundsPage,
});

const TABS = [
  { key: "all", label: "الكل" },
  { key: "open", label: "جديدة" },
  { key: "under_review", label: "قيد المراجعة" },
  { key: "resolved", label: "مقبولة" },
  { key: "rejected", label: "مرفوضة" },
] as const;

const STATUS_CLS: Record<string, string> = {
  open: "bg-destructive/10 text-destructive",
  under_review: "bg-amber-500/10 text-amber-600",
  resolved: "bg-primary/10 text-primary",
  rejected: "bg-muted text-muted-foreground",
};

function AdminRefundsPage() {
  const [status, setStatus] = useState<string>("all");
  const { data, isLoading, error } = useQuery(refundsQuery(status));

  return (
    <div dir="rtl" className="min-h-screen bg-background font-body">
      <Nav />
      <main className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-extrabold mb-2 flex items-center gap-2">
          <RotateCcw className="text-primary" /> إدارة طلبات الاسترداد
        </h1>
        <p className="text-sm text-muted-foreground mb-6">مراجعة الوثائق والمرفقات وإصدار القرار لكل طلب.</p>

        <div className="flex flex-wrap gap-2 mb-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatus(t.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
                status === t.key ? "bg-foreground text-background" : "bg-stone-soft text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              {data?.counts?.[t.key] != null && <span className="opacity-70"> ({data.counts[t.key]})</span>}
            </button>
          ))}
        </div>

        {error && <p className="text-destructive text-sm">{(error as Error).message}</p>}
        {isLoading && <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> جارٍ التحميل…</p>}

        {data && data.refunds.length === 0 && !isLoading && (
          <div className="bg-card ring-1 ring-black/5 rounded-2xl p-12 text-center text-muted-foreground">
            لا توجد طلبات في هذه الحالة.
          </div>
        )}

        <ul className="space-y-4">
          {(data?.refunds ?? []).map((r) => (
            <RefundRow key={r.id} r={r} statusKey={status} />
          ))}
        </ul>
      </main>
    </div>
  );
}

function RefundRow({ r, statusKey }: { r: any; statusKey: string }) {
  const qc = useQueryClient();
  const resolve = useServerFn(resolveDispute);
  const [resolution, setResolution] = useState("");
  const [busy, setBusy] = useState<"resolved" | "rejected" | null>(null);
  const [open, setOpen] = useState(false);
  const closed = r.status === "resolved" || r.status === "rejected";

  const submit = async (next: "resolved" | "rejected") => {
    if (resolution.trim().length < 3) {
      toast.error("اكتب نص القرار (3 أحرف على الأقل).");
      return;
    }
    setBusy(next);
    try {
      await resolve({ data: { id: r.id, status: next, resolution } });
      toast.success("تم تحديث الطلب");
      qc.invalidateQueries({ queryKey: ["admin", "refunds", statusKey] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التحديث");
    } finally {
      setBusy(null);
    }
  };

  return (
    <li className="bg-card ring-1 ring-black/5 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
        <div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${STATUS_CLS[r.status] ?? STATUS_CLS.open}`}>
            {r.status}
          </span>
          <p className="text-sm font-bold mt-2">{r.reason}</p>
          {r.evidence && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{r.evidence}</p>}
        </div>
        <div className="flex flex-col items-end gap-1 whitespace-nowrap">
          <Link to="/disputes/$id" params={{ id: r.id }} className="text-xs text-primary font-bold hover:underline">
            سجل الطلب ←
          </Link>
          <Link to="/offers/$id" params={{ id: r.offer_id }} className="text-xs text-muted-foreground hover:underline">
            فتح الصفقة ←
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground mb-3">
        <span>المبلغ: {r.amount.toLocaleString("ar-EG")} ر.س</span>
        <span>{r.escrow_locked ? "الضمان محجوز" : "الضمان غير محجوز"}</span>
        <span>حالة الصفقة: {r.offer_status}</span>
        <span>{r.attachments.length} مرفق</span>
        <span className="flex items-center gap-1"><Clock className="size-3" /> {new Date(r.created_at).toLocaleString("ar")}</span>
      </div>

      <button onClick={() => setOpen((v) => !v)} className="text-xs font-bold text-primary hover:underline mb-2">
        {open ? "إخفاء الوثائق" : `عرض الوثائق والمرفقات (${r.docs.length})`}
      </button>

      {open && (
        <ul className="space-y-2 mb-3">
          {r.docs.length === 0 && <li className="text-xs text-muted-foreground">لا توجد وثائق مرفوعة.</li>}
          {r.docs.map((d: any) => (
            <li key={d.id} className="rounded-xl bg-stone-soft p-3">
              <div className="text-[10px] text-muted-foreground mb-1">
                {d.is_admin ? "الإدارة" : "المستخدم"} · {new Date(d.created_at).toLocaleString("ar")}
              </div>
              {d.body && <p className="text-xs whitespace-pre-wrap">{d.body}</p>}
              {d.attachments.length > 0 && (
                <div className="mt-1.5 space-y-1">
                  {d.attachments.map((p: string) => <Attachment key={p} path={p} />)}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {r.resolution && <p className="text-xs p-2 bg-primary/5 rounded-lg mb-3">القرار: {r.resolution}</p>}

      {!closed && (
        <div className="border-t border-border pt-3 space-y-2">
          <textarea
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="اكتب نص القرار (سبب القبول أو الرفض)…"
            rows={2}
            maxLength={1000}
            className="w-full px-3 py-2 rounded-xl bg-stone-soft border border-border text-sm outline-none focus:ring-2 ring-primary/30 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => submit("resolved")}
              disabled={busy !== null}
              className="flex-1 px-3 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {busy === "resolved" ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              قبول الاسترداد
            </button>
            <button
              onClick={() => submit("rejected")}
              disabled={busy !== null}
              className="flex-1 px-3 py-2 bg-muted text-foreground rounded-xl text-xs font-bold hover:bg-stone-soft disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {busy === "rejected" ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
              رفض الطلب
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function Attachment({ path }: { path: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let cancelled = false;
    getDisputeAttachmentUrl(path).then((u) => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; };
  }, [path]);
  const name = path.split("/").pop() ?? "مرفق";
  if (!url) return <span className="text-[11px] text-muted-foreground">جارٍ تحميل المرفق…</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11px] text-primary underline">
      <Paperclip className="size-3" /> {name}
    </a>
  );
}
