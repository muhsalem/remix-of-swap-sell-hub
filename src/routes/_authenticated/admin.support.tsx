import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listAllTickets } from "@/lib/support.functions";

export const Route = createFileRoute("/_authenticated/admin/support")({
  component: AdminSupport,
  errorComponent: ({ error }) => (
    <div dir="rtl" className="p-8 text-destructive">
      {error.message}
    </div>
  ),
});

const STATUSES = ["all", "open", "pending", "waiting_user", "resolved", "closed"] as const;
const STATUS_LABEL: Record<string, string> = {
  all: "الكل",
  open: "مفتوحة",
  pending: "قيد الرد",
  waiting_user: "بانتظار المستخدم",
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
const PRIORITY_STYLE: Record<string, string> = {
  urgent: "bg-rose-100 text-rose-800 border-rose-300",
  high: "bg-orange-100 text-orange-800 border-orange-300",
  normal: "bg-stone-100 text-stone-700 border-stone-300",
  low: "bg-stone-50 text-stone-500 border-stone-200",
};

function AdminSupport() {
  const listFn = useServerFn(listAllTickets);
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("open");

  const q = useQuery({
    queryKey: ["admin-tickets", status],
    queryFn: () =>
      listFn({
        data: { status: status === "all" ? undefined : (status as never), limit: 100 },
      }),
  });

  useEffect(() => {
    const ch = supabase
      .channel("admin-tickets")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_tickets" },
        () => qc.invalidateQueries({ queryKey: ["admin-tickets"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const counts = q.data?.counts ?? {};

  return (
    <div dir="rtl" className="min-h-screen bg-background p-6 max-w-6xl mx-auto font-body">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="font-display text-3xl font-extrabold">تذاكر الدعم</h1>
        <Link to="/admin" className="text-primary text-sm font-bold hover:underline">
          ← لوحة المشرف
        </Link>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mb-6">
        {STATUSES.slice(1).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(status === s ? "all" : s)}
            className={`p-3 rounded-2xl border text-right transition ${
              status === s ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-stone-soft/40"
            }`}
          >
            <div className="text-[11px] font-bold text-muted-foreground">{STATUS_LABEL[s]}</div>
            <div className="font-display text-2xl font-extrabold mt-1">{counts[s] ?? 0}</div>
          </button>
        ))}
      </div>

      <div className="mb-4 flex gap-2 flex-wrap">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-full border text-xs font-bold ${
              status === s ? "bg-foreground text-background border-foreground" : "bg-card border-border"
            }`}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-soft/60 text-[11px] uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-right">SLA</th>
              <th className="px-3 py-2 text-right">الأولوية</th>
              <th className="px-3 py-2 text-right">الحالة</th>
              <th className="px-3 py-2 text-right">الموضوع</th>
              <th className="px-3 py-2 text-right">الفئة</th>
              <th className="px-3 py-2 text-right">آخر تحديث</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  جارٍ التحميل…
                </td>
              </tr>
            )}
            {q.data?.rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  لا توجد نتائج.
                </td>
              </tr>
            )}
            {q.data?.rows.map((t: any) => {
              const dueMs = new Date(t.sla_due_at).getTime() - Date.now();
              const overdue = dueMs < 0 && !t.first_response_at;
              const hrs = Math.round(Math.abs(dueMs) / 3_600_000);
              return (
                <tr
                  key={t.id}
                  className="border-t border-border hover:bg-stone-soft/30 cursor-pointer"
                  onClick={() => {
                    window.location.href = `/support/${t.id}`;
                  }}
                >
                  <td className="px-3 py-2">
                    {t.first_response_at ? (
                      <span className="text-[11px] text-emerald-700 font-bold">✓ مُستَجاب</span>
                    ) : (
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                          overdue
                            ? "bg-rose-100 text-rose-800 border-rose-300"
                            : "bg-amber-50 text-amber-800 border-amber-300"
                        }`}
                      >
                        {overdue ? `متأخرة ${hrs}س` : `تبقّى ${hrs}س`}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                        PRIORITY_STYLE[t.priority]
                      }`}
                    >
                      {t.priority}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                        STATUS_STYLE[t.status]
                      }`}
                    >
                      {STATUS_LABEL[t.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-bold truncate max-w-[280px]">{t.subject}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{t.category}</td>
                  <td className="px-3 py-2 text-[11px] text-muted-foreground">
                    {new Date(t.updated_at).toLocaleString("ar")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
