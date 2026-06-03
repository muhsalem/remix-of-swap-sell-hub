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
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Lock escrow on the offer when a dispute opens
    await supabase.from("trade_offers").update({ escrow_locked: true }).eq("id", data.offer_id);
    const { error } = await supabase.from("disputes").insert({
      offer_id: data.offer_id,
      opened_by: userId,
      reason: data.reason,
      evidence: data.evidence,
    });
    if (error) throw new Error(error.message);
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
