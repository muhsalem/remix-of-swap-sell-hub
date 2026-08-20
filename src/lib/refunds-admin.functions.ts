import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { REFUND_TAG } from "@/lib/refunds";

/** كل طلبات الاسترداد للمشرفين مع المرفقات وتفاصيل الوثائق. */
export const listRefundsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({ status: z.string().optional().default("all") })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("غير مصرّح: صلاحية المشرف مطلوبة");

    const { data: rows, error } = await supabase
      .from("disputes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);

    const refunds = (rows ?? []).filter((d: any) => String(d.reason ?? "").startsWith(REFUND_TAG));
    const filtered =
      data.status && data.status !== "all"
        ? refunds.filter((d: any) => d.status === data.status)
        : refunds;

    const ids = filtered.map((d: any) => d.id);
    const offerIds = [...new Set(filtered.map((d: any) => d.offer_id))];

    let msgs: any[] = [];
    if (ids.length) {
      const { data: m } = await supabase
        .from("dispute_messages")
        .select("id, dispute_id, body, attachments, created_at, is_admin, is_system")
        .in("dispute_id", ids)
        .order("created_at", { ascending: true });
      msgs = m ?? [];
    }

    let offers: any[] = [];
    if (offerIds.length) {
      const { data: o } = await supabase
        .from("trade_offers")
        .select("id, cash_balance, status, escrow_locked, from_user, to_user")
        .in("id", offerIds);
      offers = o ?? [];
    }
    const byOffer = new Map(offers.map((o: any) => [o.id, o]));

    const counts: Record<string, number> = { all: refunds.length };
    for (const d of refunds) counts[d.status] = (counts[d.status] ?? 0) + 1;

    return {
      counts,
      refunds: filtered.map((d: any) => {
        const mine = msgs.filter((m) => m.dispute_id === d.id);
        return {
          id: d.id as string,
          offer_id: d.offer_id as string,
          reason: d.reason as string,
          evidence: d.evidence as string | null,
          status: d.status as string,
          resolution: d.resolution as string | null,
          created_at: d.created_at as string,
          updated_at: d.updated_at as string,
          opened_by: d.opened_by as string,
          amount: Number(byOffer.get(d.offer_id)?.cash_balance ?? 0),
          escrow_locked: Boolean(byOffer.get(d.offer_id)?.escrow_locked),
          offer_status: (byOffer.get(d.offer_id)?.status ?? "—") as string,
          messages_count: mine.length,
          attachments: mine.flatMap((m) => (m.attachments ?? []) as string[]),
          docs: mine
            .filter((m) => !m.is_system)
            .map((m) => ({
              id: m.id as string,
              body: m.body as string,
              is_admin: Boolean(m.is_admin),
              created_at: m.created_at as string,
              attachments: (m.attachments ?? []) as string[],
            })),
        };
      }),
    };
  });
