import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Nav } from "@/components/Nav";
import { listAllDisputes, resolveDispute } from "@/lib/admin.functions";
import { ShieldAlert, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";

const q = queryOptions({ queryKey: ["admin", "disputes"], queryFn: () => listAllDisputes() });

export const Route = createFileRoute("/_authenticated/admin/disputes")({
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  head: () => ({ meta: [{ title: "لوحة النزاعات (مشرف) — بادل بادل" }] }),
  errorComponent: ({ error }) => (
    <div dir="rtl" className="min-h-screen bg-background"><Nav />
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <ShieldAlert className="size-12 mx-auto text-destructive mb-4" />
        <p className="text-destructive font-bold">{error.message}</p>
      </div>
    </div>
  ),
  notFoundComponent: () => <div className="p-12 text-center">غير موجود</div>,
  component: AdminDisputesPage,
});

function AdminDisputesPage() {
  const { data } = useSuspenseQuery(q);
  return (
    <div dir="rtl" className="min-h-screen bg-background font-body">
      <Nav />
      <main className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-extrabold mb-2 flex items-center gap-2">
          <ShieldAlert className="text-destructive" /> لوحة إدارة النزاعات
        </h1>
        <p className="text-sm text-muted-foreground mb-8">جميع النزاعات المفتوحة والمُحلولة.</p>
        {data.disputes.length === 0 ? (
          <div className="bg-card ring-1 ring-black/5 rounded-2xl p-12 text-center text-muted-foreground">
            لا توجد نزاعات حالياً.
          </div>
        ) : (
          <ul className="space-y-4">
            {data.disputes.map((d: any) => <DisputeRow key={d.id} d={d} />)}
          </ul>
        )}
      </main>
    </div>
  );
}

function DisputeRow({ d }: { d: any }) {
  const qc = useQueryClient();
  const resolve = useServerFn(resolveDispute);
  const [resolution, setResolution] = useState("");
  const [busy, setBusy] = useState<"resolved" | "rejected" | null>(null);
  const isOpen = d.status === "open";

  const submit = async (status: "resolved" | "rejected") => {
    if (!resolution.trim() || resolution.length < 3) {
      toast.error("اكتب نص القرار (3 أحرف على الأقل).");
      return;
    }
    setBusy(status);
    try {
      await resolve({ data: { id: d.id, status, resolution } });
      toast.success("تم تحديث النزاع");
      qc.invalidateQueries({ queryKey: ["admin", "disputes"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التحديث");
    } finally {
      setBusy(null);
    }
  };

  return (
    <li className="bg-card ring-1 ring-black/5 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3 gap-3">
        <div>
          <span className={`text-xs px-2 py-1 rounded-full font-bold ${
            d.status === "resolved" ? "bg-primary/10 text-primary" :
            d.status === "rejected" ? "bg-muted text-muted-foreground" :
            "bg-destructive/10 text-destructive"
          }`}>{d.status}</span>
          <p className="text-sm font-bold mt-2">{d.reason}</p>
          {d.evidence && <p className="text-xs text-muted-foreground mt-1">دليل: {d.evidence}</p>}
        </div>
        <div className="flex flex-col items-end gap-1 whitespace-nowrap">
          <Link to="/disputes/$id" params={{ id: d.id }} className="text-xs text-primary font-bold hover:underline">
            سجل النزاع والمرفقات ←
          </Link>
          <Link to="/offers/$id" params={{ id: d.offer_id }} className="text-xs text-muted-foreground hover:underline">
            فتح الصفقة ←
          </Link>
        </div>
      </div>

      {d.resolution && (
        <p className="text-xs p-2 bg-primary/5 rounded-lg mb-3">القرار: {d.resolution}</p>
      )}

      {isOpen && (
        <div className="border-t border-border pt-3 space-y-2">
          <textarea
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="اكتب نص القرار الرسمي..."
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
              قبول وحل
            </button>
            <button
              onClick={() => submit("rejected")}
              disabled={busy !== null}
              className="flex-1 px-3 py-2 bg-muted text-foreground rounded-xl text-xs font-bold hover:bg-stone-soft disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {busy === "rejected" ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
              رفض النزاع
            </button>
          </div>
        </div>
      )}
      <div className="text-[10px] text-muted-foreground mt-3">{new Date(d.created_at).toLocaleString("ar")}</div>
    </li>
  );
}
