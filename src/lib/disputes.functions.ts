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
    const { error } = await supabase.from("disputes").insert({
      offer_id: data.offer_id,
      opened_by: userId,
      reason: data.reason,
      evidence: data.evidence,
    });
    if (error) throw new Error(error.message);

    // 3) Only after the dispute row exists, lock escrow via admin client.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: lockErr } = await supabaseAdmin
      .from("trade_offers")
      .update({ escrow_locked: true })
      .eq("id", data.offer_id);
    if (lockErr) console.error("[disputes] escrow lock failed", lockErr);

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
