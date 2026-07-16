import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Read the signed-in user's preferred country ('SAR' | 'EGP') from their profile. */
export const getPreferredCountry = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("preferred_country")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw error;
    return { country: (data?.preferred_country ?? null) as "SAR" | "EGP" | null };
  });

/** Persist the signed-in user's preferred country onto their profile. */
export const setPreferredCountry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ country: z.enum(["SAR", "EGP"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ preferred_country: data.country })
      .eq("id", context.userId);
    if (error) throw error;
    return { ok: true };
  });
