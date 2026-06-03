import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { Nav } from "@/components/Nav";
import { AlertTriangle } from "lucide-react";

const listMyDisputes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: offers } = await supabase
      .from("trade_offers")
      .select("id")
      .or(`from_user.eq.${userId},to_user.eq.${userId}`);
    const ids = (offers ?? []).map((o: any) => o.id);
    if (ids.length === 0) return { disputes: [] };
    const { data, error } = await supabase
      .from("disputes")
      .select("*")
      .in("offer_id", ids)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { disputes: data ?? [] };
  });

const q = queryOptions({ queryKey: ["my-disputes"], queryFn: () => listMyDisputes() });

export const Route = createFileRoute("/_authenticated/disputes")({
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  head: () => ({ meta: [{ title: "النزاعات — بادل بادل" }] }),
  errorComponent: ({ error }) => <div className="p-12 text-center">{error.message}</div>,
  notFoundComponent: () => <div className="p-12 text-center">غير موجود</div>,
  component: DisputesPage,
});

function DisputesPage() {
  const { data } = useSuspenseQuery(q);
  return (
    <div dir="rtl" className="min-h-screen bg-background font-body">
      <Nav />
      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-extrabold mb-6 flex items-center gap-2">
          <AlertTriangle className="text-destructive" /> النزاعات والضمان
        </h1>
        {data.disputes.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">لا توجد نزاعات.</p>
        ) : (
          <ul className="space-y-3">
            {data.disputes.map((d: any) => (
              <li key={d.id} className="bg-card ring-1 ring-black/5 rounded-2xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                    d.status === "resolved" ? "bg-primary/10 text-primary" :
                    d.status === "rejected" ? "bg-muted text-muted-foreground" :
                    "bg-destructive/10 text-destructive"
                  }`}>{d.status}</span>
                  <Link to="/offers/$id" params={{ id: d.offer_id }} className="text-xs text-primary hover:underline">
                    فتح الصفقة ←
                  </Link>
                </div>
                <p className="text-sm font-bold">{d.reason}</p>
                {d.evidence && <p className="text-xs text-muted-foreground mt-1">{d.evidence}</p>}
                {d.resolution && <p className="text-xs mt-2 p-2 bg-primary/5 rounded-lg">القرار: {d.resolution}</p>}
                <div className="text-[10px] text-muted-foreground mt-2">{new Date(d.created_at).toLocaleString("ar")}</div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
