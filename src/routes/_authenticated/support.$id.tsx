import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getTicketThread,
  postTicketMessage,
  closeMyTicket,
  listTemplates,
  adminUpdateTicket,
} from "@/lib/support.functions";

export const Route = createFileRoute("/_authenticated/support/$id")({
  component: TicketThread,
  errorComponent: ({ error }) => (
    <div dir="rtl" className="p-8 text-destructive">
      {error.message}
    </div>
  ),
});

const STATUS_LABEL: Record<string, string> = {
  open: "مفتوحة",
  pending: "قيد الرد",
  waiting_user: "بانتظارك",
  resolved: "محلولة",
  closed: "مغلقة",
};

function TicketThread() {
  const { id } = Route.useParams();
  const load = useServerFn(getTicketThread);
  const post = useServerFn(postTicketMessage);
  const close = useServerFn(closeMyTicket);
  const templatesFn = useServerFn(listTemplates);
  const adminUpdate = useServerFn(adminUpdateTicket);
  const qc = useQueryClient();

  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);

  const q = useQuery({ queryKey: ["ticket", id], queryFn: () => load({ data: { ticketId: id } }) });

  // Realtime updates on messages of this ticket
  useEffect(() => {
    const ch = supabase
      .channel(`ticket:${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_ticket_messages", filter: `ticket_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["ticket", id] }),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "support_tickets", filter: `id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["ticket", id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, qc]);

  const isAdmin = !!q.data?.isAdmin;
  const templatesQ = useQuery({
    queryKey: ["support-templates"],
    queryFn: () => templatesFn(),
    enabled: isAdmin,
  });

  const send = useMutation({
    mutationFn: (payload: { templateKey?: string }) =>
      post({
        data: {
          ticketId: id,
          body,
          isInternal: internal,
          templateKey: payload.templateKey,
        },
      }),
    onSuccess: () => {
      setBody("");
      setInternal(false);
      qc.invalidateQueries({ queryKey: ["ticket", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: (status: string) =>
      adminUpdate({ data: { ticketId: id, status: status as never } }),
    onSuccess: () => {
      toast.success("تم تحديث الحالة");
      qc.invalidateQueries({ queryKey: ["ticket", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assignSelf = useMutation({
    mutationFn: () => adminUpdate({ data: { ticketId: id, assignSelf: true } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ticket", id] }),
  });

  const closeMine = useMutation({
    mutationFn: () => close({ data: { ticketId: id } }),
    onSuccess: () => {
      toast.success("تم إغلاق التذكرة");
      qc.invalidateQueries({ queryKey: ["ticket", id] });
    },
  });

  if (q.isLoading) return <div dir="rtl" className="p-8">جارٍ التحميل…</div>;
  if (!q.data) return <div dir="rtl" className="p-8">التذكرة غير موجودة.</div>;

  const t = q.data.ticket;
  const closed = t.status === "closed" || t.status === "resolved";

  return (
    <div dir="rtl" className="min-h-screen bg-background p-6 max-w-3xl mx-auto font-body">
      <Link to="/support" className="text-primary text-sm font-bold hover:underline">
        ← تذاكري
      </Link>

      <header className="mt-4 mb-6 p-5 rounded-2xl border border-border bg-card">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display text-2xl font-extrabold">{t.subject}</h1>
            <div className="text-xs text-muted-foreground mt-1">
              {t.category} · أولوية {t.priority} · {STATUS_LABEL[t.status]}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              SLA: {new Date(t.sla_due_at).toLocaleString("ar")}
              {t.first_response_at && ` · أول رد: ${new Date(t.first_response_at).toLocaleString("ar")}`}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {isAdmin && !t.assigned_admin && (
              <button
                onClick={() => assignSelf.mutate()}
                className="px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-bold"
              >
                استلام
              </button>
            )}
            {isAdmin && !closed && (
              <>
                <button
                  onClick={() => setStatus.mutate("resolved")}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold"
                >
                  حل التذكرة
                </button>
                <button
                  onClick={() => setStatus.mutate("waiting_user")}
                  className="px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-bold"
                >
                  بانتظار المستخدم
                </button>
              </>
            )}
            {!isAdmin && !closed && (
              <button
                onClick={() => closeMine.mutate()}
                className="px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-bold"
              >
                إغلاق
              </button>
            )}
          </div>
        </div>
      </header>

      <section className="space-y-3 mb-6">
        {q.data.messages.map((m: any) => (
          <div
            key={m.id}
            className={`p-4 rounded-2xl border ${
              m.is_internal
                ? "border-amber-300 bg-amber-50"
                : m.sender_id === t.user_id
                ? "border-border bg-card"
                : "border-primary/30 bg-primary/5"
            }`}
          >
            <div className="text-[11px] text-muted-foreground mb-2 flex items-center gap-2">
              <span className="font-bold">
                {m.sender_id === t.user_id ? "المستخدم" : "الدعم"}
              </span>
              {m.is_internal && <span className="text-amber-700 font-bold">· ملاحظة داخلية</span>}
              {m.template_key && <span>· قالب: {m.template_key}</span>}
              <span>· {new Date(m.created_at).toLocaleString("ar")}</span>
            </div>
            <div className="text-sm whitespace-pre-wrap">{m.body}</div>
          </div>
        ))}
      </section>

      {!closed && (
        <section className="p-4 rounded-2xl border border-border bg-card">
          {isAdmin && templatesQ.data && templatesQ.data.length > 0 && (
            <div className="mb-3">
              <div className="text-[11px] uppercase tracking-widest font-bold text-muted-foreground mb-2">
                قوالب الرد الجاهزة
              </div>
              <div className="flex gap-2 flex-wrap">
                {templatesQ.data.map((tpl: any) => (
                  <button
                    key={tpl.id}
                    onClick={() => setBody(tpl.body)}
                    title={tpl.body}
                    className="px-3 py-1.5 rounded-full border border-border bg-stone-soft/40 text-xs hover:bg-stone-soft"
                  >
                    {tpl.title}
                  </button>
                ))}
              </div>
            </div>
          )}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            maxLength={4000}
            placeholder={internal ? "ملاحظة داخلية (غير مرئية للمستخدم)…" : "اكتب ردك…"}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          />
          <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
            {isAdmin && (
              <label className="text-xs flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={internal}
                  onChange={(e) => setInternal(e.target.checked)}
                />
                ملاحظة داخلية
              </label>
            )}
            <button
              onClick={() => send.mutate({})}
              disabled={send.isPending || body.trim().length === 0}
              className="px-5 py-2 rounded-xl bg-foreground text-background font-bold text-sm disabled:opacity-50 mr-auto"
            >
              {send.isPending ? "جارٍ الإرسال…" : "إرسال"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
