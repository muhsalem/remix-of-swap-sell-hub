import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const REFUND_WINDOW_HOURS = 72;
export const REFUND_TAG = "[استرداد]";

export const REFUND_REASONS = [
  { value: "not_as_described", label: "الغرض غير مطابق للوصف" },
  { value: "damaged", label: "وصل تالفاً أو به عيب غير معلن" },
  { value: "not_delivered", label: "لم يصل الغرض / لم يتم التسليم" },
  { value: "counterfeit", label: "الغرض مقلّد أو غير أصلي" },
  { value: "missing_parts", label: "نواقص أو ملحقات مفقودة" },
  { value: "other", label: "سبب آخر" },
] as const;

export const REQUIRED_DOCS: Record<string, string[]> = {
  not_as_described: ["صور واضحة للغرض من عدة زوايا", "لقطة من وصف الإعلان الأصلي"],
  damaged: ["صور للضرر", "صورة لغلاف الشحنة عند الاستلام"],
  not_delivered: ["إيصال الشحن أو رقم التتبع", "لقطة من آخر حالة تتبع"],
  counterfeit: ["صور للرقم التسلسلي/الملصقات", "أي تقرير فحص أو مقارنة بالأصلي"],
  missing_parts: ["صورة لمحتويات الشحنة كما وصلت", "لقطة من الملحقات المذكورة في الإعلان"],
  other: ["أي مستندات أو صور تدعم طلبك"],
};

function windowStart(offer: { updated_at: string; created_at: string }) {
  return new Date(offer.updated_at ?? offer.created_at).getTime();
}

function deadlineOf(offer: { updated_at: string; created_at: string }) {
  return windowStart(offer) + REFUND_WINDOW_HOURS * 3600_000;
}

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
      offers: (offers ?? []).map((o: any) => ({
        id: o.id,
        status: o.status,
        cash_balance: o.cash_balance ?? 0,
        deadline: new Date(deadlineOf(o)).toISOString(),
        expired: deadlineOf(o) < now,
        hasRequest: withDispute.has(o.id),
      })),
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
    if (deadlineOf(offer as any) < Date.now())
      throw new Error("انتهت نافذة الاسترداد (72 ساعة من الاستلام)");

    const { data: existing } = await supabase
      .from("disputes")
      .select("id, status")
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
          id: d.id,
          offer_id: d.offer_id,
          reason: d.reason,
          evidence: d.evidence,
          status: d.status,
          resolution: d.resolution,
          created_at: d.created_at,
          updated_at: d.updated_at,
          amount: byOffer.get(d.offer_id)?.cash_balance ?? 0,
          mine: d.opened_by === userId,
        })),
    };
  });
