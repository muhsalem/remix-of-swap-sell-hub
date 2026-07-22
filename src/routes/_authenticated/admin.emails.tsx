import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listEmailQueue, cancelQueuedEmail, enqueueEmail } from "@/lib/email-queue.functions";

export const Route = createFileRoute("/_authenticated/admin/emails")({
  component: EmailsPage,
  errorComponent: ({ error }) => <div className="p-8 text-destructive" dir="rtl">{error.message}</div>,
});

const TEMPLATES = [
  "welcome","listing_created","offer_received","offer_accepted",
  "kyc_approved","abandoned_listing","reactivation_7d",
  "waitlist_confirmed","referral_success",
];

const STATUS_LABEL: Record<string, string> = {
  pending: "🕐 معلّق", sent: "✅ مُرسل", failed: "❌ فشل", cancelled: "🚫 ملغى",
};

function EmailsPage() {
  const list = useServerFn(listEmailQueue);
  const cancel = useServerFn(cancelQueuedEmail);
  const enqueue = useServerFn(enqueueEmail);
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [testTo, setTestTo] = useState("");
  const [testTemplate, setTestTemplate] = useState<string>("welcome");

  const { data } = useQuery({
    queryKey: ["email-queue", statusFilter],
    queryFn: () => list({ data: { status: statusFilter as any, limit: 200 } }),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => cancel({ data: { id } }),
    onSuccess: () => { toast.success("تم الإلغاء"); qc.invalidateQueries({ queryKey: ["email-queue"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendMut = useMutation({
    mutationFn: () => enqueue({ data: { to_email: testTo, template: testTemplate as any, variables: { name: "مستخدم تجريبي" } } }),
    onSuccess: () => { toast.success("تم إضافة الإيميل إلى الطابور"); qc.invalidateQueries({ queryKey: ["email-queue"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div dir="rtl" className="min-h-screen bg-background font-body p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="font-display text-3xl font-extrabold">طابور البريد الإلكتروني</h1>
        <Link to="/admin" className="text-primary font-bold hover:underline text-sm">← لوحة المشرف</Link>
      </div>

      <section className="mb-6 p-4 rounded-2xl border border-border bg-card">
        <h2 className="font-bold mb-3">إرسال بريد اختباري</h2>
        <div className="flex gap-2 flex-wrap items-center">
          <input type="email" placeholder="البريد الإلكتروني" value={testTo} onChange={(e) => setTestTo(e.target.value)}
            className="px-3 py-2 rounded-lg bg-stone-soft border border-border text-sm flex-1 min-w-[200px]" />
          <select value={testTemplate} onChange={(e) => setTestTemplate(e.target.value)}
            className="px-3 py-2 rounded-lg bg-stone-soft border border-border text-sm">
            {TEMPLATES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button onClick={() => sendMut.mutate()} disabled={!testTo || sendMut.isPending}
            className="px-4 py-2 bg-foreground text-background rounded-lg text-sm font-bold disabled:opacity-50">
            إضافة إلى الطابور
          </button>
        </div>
      </section>

      <div className="flex gap-2 mb-4 flex-wrap">
        {["all","pending","sent","failed","cancelled"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>
            {s === "all" ? "الكل" : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {data?.emails.map((e: any) => (
          <div key={e.id} className="p-4 rounded-xl border border-border bg-card text-sm">
            <div className="flex justify-between items-start gap-3 flex-wrap">
              <div>
                <div className="font-bold">{e.subject}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  إلى: {e.to_email} · قالب: {e.template} · {STATUS_LABEL[e.status] || e.status}
                </div>
                <div className="text-xs text-muted-foreground">
                  مجدول: {new Date(e.scheduled_at).toLocaleString("ar-EG")}
                  {e.sent_at && ` · مُرسل: ${new Date(e.sent_at).toLocaleString("ar-EG")}`}
                </div>
                {e.error && <div className="text-xs text-destructive mt-1">خطأ: {e.error}</div>}
              </div>
              {e.status === "pending" && (
                <button onClick={() => cancelMut.mutate(e.id)}
                  className="px-3 py-1.5 bg-destructive text-destructive-foreground rounded-lg text-xs font-bold">
                  إلغاء
                </button>
              )}
            </div>
          </div>
        ))}
        {data?.emails.length === 0 && <p className="text-sm text-muted-foreground">لا توجد رسائل.</p>}
      </div>
    </div>
  );
}
