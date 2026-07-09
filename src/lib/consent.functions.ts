import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const CURRENT_DOC_VERSION = "2026-07";

const schema = z.object({
  country_code: z.enum(["SA", "EG"]),
  context: z.enum(["create_offer", "complete_order", "payment", "listing", "signup"]),
  docs: z.array(z.enum(["terms", "privacy", "barter", "refund", "fees", "sla", "riba"])).min(1),
  offer_id: z.string().uuid().optional().nullable(),
  listing_id: z.string().uuid().optional().nullable(),
  user_agent: z.string().max(500).optional().nullable(),
});

export const logConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof schema>) => schema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const rows = data.docs.map((doc_type) => ({
      user_id: userId,
      country_code: data.country_code,
      doc_type,
      doc_version: `${CURRENT_DOC_VERSION}-${data.country_code}`,
      context: data.context,
      offer_id: data.offer_id ?? null,
      listing_id: data.listing_id ?? null,
      user_agent: data.user_agent ?? null,
    }));
    const { error } = await supabase.from("consent_log").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true, count: rows.length };
  });
