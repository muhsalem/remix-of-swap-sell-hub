import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { createTicket, listMyTickets } from "@/lib/support.functions";

export const Route = createFileRoute("/_authenticated/support")({
  component: SupportPage,
  errorComponent: ({ error }) => (
    <div dir="rtl" className="p-8 text-destructive">
      {error.message}
    </div>
  ),
});

const CATEGORIES = [
  ["payment", "دفع/فوترة"],
  ["listing", "إعلان"],
  ["dispute", "نزاع"],
  ["account", "حساب/توثيق"],
  ["shipping", "شحن"],
  ["technical", "تقني"],
  ["other", "أخرى"],
] as const;

const PRIORITIES = [
  ["low", "منخفضة"],
  ["normal", "عادية"],
  ["high", "مرتفعة"],
  ["urgent", "عاجلة"],
] as const;

const STATUS_LABEL: Record<string, string> = {
  open: "مفتوحة",
  pending: "قيد الرد",
  waiting_user: "بانتظارك",
  resolved: "محلولة",
  closed: "مغلقة",
};

const STATUS_STYLE: Record<string, string> = {
  open: "bg-amber-100 text-amber-800 border-amber-300",
  pending: "bg-sky-100 text-sky-800 border-sky-300",
  waiting_user: "bg-violet-100 text-violet-800 border-violet-300",
  resolved: "bg-emerald-100 text-emerald-800 border-emerald-300",
  closed: "bg-stone-200 text-stone-700 border-stone-300",
};

function SupportPage() {
  const create = useServerFn(createTicket);
  const list = useServerFn(listMyTickets);
  const qc = useQueryClient();

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("other");
  const [priority, setPriority] = useState("normal");

  const q = useQuery({ queryKey: ["my-tickets"], queryFn: () => list() });

  const submit = useMutation({
    mutationFn: () =>
      create({
        data: {
          subject,
          body,
          category: category as never,
          priority: priority as never,
        },
      }),
    onSuccess: () => {
      toast.success("تم إنشاء التذكرة");
      setSubject("");
      setBody("");
      qc.invalidateQueries({ queryKey: ["my-tickets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div dir="rtl" className="min-h-screen bg-background p-6 max-w-4xl mx-auto font-body">
      <h1 className="font-display text-3xl font-extrabold mb-2">الدعم الفني</h1>
      <p className="text-sm text-muted-foreground mb-6">
        أرسل تذكرة وسنعود إليك ضمن مدة اتفاقية الخدمة (SLA): عاجل ٢ ساعة · مرتفع ٨
        ساعات · عادي ٢٤ ساعة · منخفض ٧٢ ساعة.
      </p>

      <section className="p-5 rounded-2xl border border-border bg-card mb-8">
        <h2 className="font-display text-lg font-extrabold mb-4">تذكرة جديدة</h2>
        <div className="grid gap-3">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="الموضوع"
            maxLength={160}
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
            >
              {CATEGORIES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
            >
              {PRIORITIES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="اشرح المشكلة بتفصيل مفيد…"
            rows={5}
            maxLength={4000}
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
          />
          <button
            onClick={() => submit.mutate()}
            disabled={submit.isPending || subject.trim().length < 3 || body.trim().length < 5}
            className="px-5 py-2.5 rounded-xl bg-foreground text-background font-bold text-sm disabled:opacity-50 w-fit"
          >
            {submit.isPending ? "جارٍ الإرسال…" : "إرسال التذكرة"}
          </button>
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-extrabold mb-4">تذاكري</h2>
        {q.isLoading && <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>}
        {q.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">لا توجد تذاكر بعد.</p>
        )}
        <div className="space-y-3">
          {q.data?.map((t: any) => (
            <Link
              key={t.id}
              to="/support/$id"
              params={{ id: t.id }}
              className="block p-4 rounded-2xl border border-border bg-card hover:bg-stone-soft/40 transition"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span
                      className={`px-2 py-0.5 rounded-full border text-[11px] font-bold ${
                        STATUS_STYLE[t.status]
                      }`}
                    >
                      {STATUS_LABEL[t.status]}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{t.category}</span>
                    <span className="text-[11px] text-muted-foreground">· {t.priority}</span>
                  </div>
                  <div className="font-bold truncate">{t.subject}</div>
                </div>
                <SlaBadge dueAt={t.sla_due_at} firstResp={t.first_response_at} status={t.status} />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function SlaBadge({
  dueAt,
  firstResp,
  status,
}: {
  dueAt: string;
  firstResp: string | null;
  status: string;
}) {
  if (firstResp || status === "resolved" || status === "closed") {
    return (
      <span className="text-[11px] text-emerald-700 font-bold">✓ تم الرد الأول</span>
    );
  }
  const ms = new Date(dueAt).getTime() - Date.now();
  const overdue = ms < 0;
  const hrs = Math.round(Math.abs(ms) / 3_600_000);
  return (
    <span
      className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
        overdue
          ? "bg-rose-100 text-rose-800 border-rose-300"
          : "bg-amber-50 text-amber-800 border-amber-300"
      }`}
    >
      {overdue ? `متأخرة ${hrs} س` : `تبقّى ${hrs} س`}
    </span>
  );
}
