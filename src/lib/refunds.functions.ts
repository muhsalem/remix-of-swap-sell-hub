import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { REFUND_REASONS, REFUND_TAG, refundDeadline } from "@/lib/refunds";

/** الصفقات المؤهلة لفتح طلب استرداد خلال نافذة 72 ساعة. */
export const listRefundableOffers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: offers, error } = await supabase
      .from("trade_offers")
      .select("id, status, cash_balance, from_user, to_user, created_at, updated_at")
      .or(`from_user.eq.${userId},to_user.eq.${userId}`)
      .in("status", ["accepted", "completed"])
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    const ids = (offers ?? []).map((o: any) => o.id);
    let withDispute = new Set<string>();
    if (ids.length) {
      const { data: ds } = await supabase.from("disputes").select("offer_id").in("offer_id", ids);
      withDispute = new Set((ds ?? []).map((d: any) => d.offer_id));
    }

    const now = Date.now();
    return {
      offers: (offers ?? []).map((o: any) => {
        const dl = refundDeadline(o);
        return {
          id: o.id as string,
          status: o.status as string,
          cash_balance: Number(o.cash_balance ?? 0),
          deadline: new Date(dl).toISOString(),
          expired: dl < now,
          hasRequest: withDispute.has(o.id),
        };
      }),
    };
  });

/** فتح طلب استرداد (يُسجَّل كنزاع موسوم بـ [استرداد] مع حجز الضمان). */
export const createRefundRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        offer_id: z.string().uuid(),
        reason_code: z.enum([
          "not_as_described",
          "damaged",
          "not_delivered",
          "counterfeit",
          "missing_parts",
          "other",
        ]),
        details: z.string().trim().min(10).max(2000),
        attachments: z.array(z.string().max(400)).min(1).max(10),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: offer, error: offerErr } = await supabase
      .from("trade_offers")
      .select("id, from_user, to_user, status, created_at, updated_at")
      .eq("id", data.offer_id)
      .maybeSingle();
    if (offerErr) throw new Error(offerErr.message);
    if (!offer) throw new Error("الصفقة غير موجودة");
    if (offer.from_user !== userId && offer.to_user !== userId)
      throw new Error("غير مصرّح لك بطلب استرداد على هذه الصفقة");
    if (offer.status !== "accepted" && offer.status !== "completed")
      throw new Error("لا يمكن طلب الاسترداد إلا بعد قبول الصفقة");
    if (refundDeadline(offer as any) < Date.now())
      throw new Error("انتهت نافذة الاسترداد (72 ساعة من الاستلام)");

    const { data: existing } = await supabase
      .from("disputes")
      .select("id")
      .eq("offer_id", data.offer_id)
      .in("status", ["open", "under_review"])
      .maybeSingle();
    if (existing) throw new Error("يوجد طلب مفتوح على هذه الصفقة بالفعل");

    const label = REFUND_REASONS.find((r) => r.value === data.reason_code)?.label ?? "طلب استرداد";
    const reason = `${REFUND_TAG} ${label}`;

    const { data: created, error } = await supabase
      .from("disputes")
      .insert({
        offer_id: data.offer_id,
        opened_by: userId,
        reason,
        evidence: data.details,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { error: msgErr } = await supabase.from("dispute_messages").insert({
      dispute_id: created.id,
      sender_id: userId,
      body: `${reason}\n\n${data.details}`,
      attachments: data.attachments,
    });
    if (msgErr) console.error("[refunds] first message failed", msgErr);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: lockErr } = await supabaseAdmin
      .from("trade_offers")
      .update({ escrow_locked: true })
      .eq("id", data.offer_id);
    if (lockErr) console.error("[refunds] escrow lock failed", lockErr);

    return { ok: true, dispute_id: created.id as string };
  });

/** كل طلبات الاسترداد الخاصة بالمستخدم مع حالتها. */
export const listMyRefundRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: offers } = await supabase
      .from("trade_offers")
      .select("id, cash_balance, status")
      .or(`from_user.eq.${userId},to_user.eq.${userId}`);
    const ids = (offers ?? []).map((o: any) => o.id);
    if (!ids.length) return { requests: [] };

    const { data, error } = await supabase
      .from("disputes")
      .select("*")
      .in("offer_id", ids)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);

    const byOffer = new Map((offers ?? []).map((o: any) => [o.id, o]));
    return {
      requests: (data ?? [])
        .filter((d: any) => String(d.reason ?? "").startsWith(REFUND_TAG))
        .map((d: any) => ({
          id: d.id as string,
          offer_id: d.offer_id as string,
          reason: d.reason as string,
          evidence: d.evidence as string | null,
          status: d.status as string,
          resolution: d.resolution as string | null,
          created_at: d.created_at as string,
          updated_at: d.updated_at as string,
          amount: Number(byOffer.get(d.offer_id)?.cash_balance ?? 0),
          mine: d.opened_by === userId,
        })),
    };
  });
