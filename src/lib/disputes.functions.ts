import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const openDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      offer_id: z.string().uuid(),
      reason: z.string().min(5).max(500),
      evidence: z.string().max(2000).optional().default(""),
      attachments: z.array(z.string().max(400)).max(10).optional().default([]),
    }).parse(i),
  )

  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1) Verify caller is a party to the offer (RLS-scoped read).
    const { data: offer, error: offerErr } = await supabase
      .from("trade_offers")
      .select("from_user, to_user")
      .eq("id", data.offer_id)
      .maybeSingle();
    if (offerErr) throw new Error(offerErr.message);
    if (!offer) throw new Error("العرض غير موجود");
    if (offer.from_user !== userId && offer.to_user !== userId) {
      throw new Error("غير مصرّح لك بفتح نزاع على هذا العرض");
    }

    // 2) Insert dispute under user-scoped RLS.
    const { data: created, error } = await supabase
      .from("disputes")
      .insert({
        offer_id: data.offer_id,
        opened_by: userId,
        reason: data.reason,
        evidence: data.evidence,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // 2b) First message carries the reason + any attachments.
    const { error: msgErr } = await supabase.from("dispute_messages").insert({
      dispute_id: created.id,
      sender_id: userId,
      body: data.evidence ? `${data.reason}\n\n${data.evidence}` : data.reason,
      attachments: data.attachments,
    });
    if (msgErr) console.error("[disputes] first message failed", msgErr);

    // 3) Only after the dispute row exists, lock escrow via admin client.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: lockErr } = await supabaseAdmin
      .from("trade_offers")
      .update({ escrow_locked: true })
      .eq("id", data.offer_id);
    if (lockErr) console.error("[disputes] escrow lock failed", lockErr);

    return { ok: true, dispute_id: created.id as string };
  });

export const getDispute = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: dispute, error } = await supabase
      .from("disputes")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!dispute) throw new Error("النزاع غير موجود");

    const { data: offer } = await supabase
      .from("trade_offers")
      .select("id, status, from_user, to_user, cash_balance, escrow_locked, created_at")
      .eq("id", dispute.offer_id)
      .maybeSingle();

    const { data: messages, error: mErr } = await supabase
      .from("dispute_messages")
      .select("*")
      .eq("dispute_id", data.id)
      .order("created_at", { ascending: true });
    if (mErr) throw new Error(mErr.message);

    return { dispute, offer, messages: messages ?? [], userId };
  });

export const sendDisputeMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      dispute_id: z.string().uuid(),
      body: z.string().max(2000).optional().default(""),
      attachments: z.array(z.string().max(400)).max(10).optional().default([]),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.body.trim() && data.attachments.length === 0) {
      throw new Error("اكتب رسالة أو أرفق ملفاً");
    }
    const { error } = await supabase.from("dispute_messages").insert({
      dispute_id: data.dispute_id,
      sender_id: userId,
      body: data.body.trim(),
      attachments: data.attachments,
    });
    if (error) throw new Error("تعذّر إرسال الرسالة — قد يكون النزاع مغلقاً.");
    return { ok: true };
  });


export const listOfferDisputes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ offer_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("disputes")
      .select("*")
      .eq("offer_id", data.offer_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { disputes: rows ?? [] };
  });
