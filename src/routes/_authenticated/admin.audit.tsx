import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listAuditLogs } from "@/lib/audit.functions";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  component: AuditPage,
  errorComponent: ({ error }) => <div className="p-8 text-destructive" dir="rtl">{error.message}</div>,
});

function AuditPage() {
  const fetchLogs = useServerFn(listAuditLogs);
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", action, entityType],
    queryFn: () => fetchLogs({ data: { action: action || undefined, entity_type: entityType || undefined, limit: 200 } }),
  });

  return (
    <div dir="rtl" className="min-h-screen bg-background font-body p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="font-display text-3xl font-extrabold">سجل التدقيق (Audit Log)</h1>
        <Link to="/admin" className="text-primary font-bold hover:underline text-sm">← لوحة المشرف</Link>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        <input placeholder="فلترة بالإجراء" value={action} onChange={(e) => setAction(e.target.value)}
          className="px-3 py-2 rounded-lg bg-stone-soft border border-border text-sm" />
        <input placeholder="فلترة بنوع الكيان" value={entityType} onChange={(e) => setEntityType(e.target.value)}
          className="px-3 py-2 rounded-lg bg-stone-soft border border-border text-sm" />
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>}
      {data?.logs.length === 0 && <p className="text-sm text-muted-foreground">لا توجد سجلات.</p>}

      <div className="space-y-2">
        {data?.logs.map((log: any) => (
          <div key={log.id} className="p-4 rounded-xl border border-border bg-card text-sm">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <span className="font-bold text-primary">{log.action}</span>
                <span className="text-muted-foreground"> · </span>
                <span>{log.entity_type}</span>
                {log.entity_id && <span className="text-muted-foreground"> #{String(log.entity_id).slice(0, 8)}</span>}
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(log.created_at).toLocaleString("ar-EG")}
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              المنفّذ: <code>{String(log.actor_id).slice(0, 8)}</code>
            </div>
            {log.metadata && Object.keys(log.metadata).length > 0 && (
              <pre className="mt-2 p-2 bg-stone-soft rounded text-[11px] overflow-auto max-h-40">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
