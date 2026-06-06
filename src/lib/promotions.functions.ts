import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PromoKind = "featured" | "pinned" | "boost";

export const getPricing = createServerFn({ method: "GET" }).handler(async () => {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase
    .from("platform_config")
    .select("value")
    .eq("key", "pricing")
    .maybeSingle();
  const { data: flag } = await supabase
    .from("platform_config")
    .select("value")
    .eq("key", "commission_enabled")
    .maybeSingle();
  return {
    pricing: (data?.value ?? {}) as Record<string, number>,
    commissionEnabled: Boolean(flag?.value),
  };
});

export const getMyDiBalance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("wallet_ledger")
      .select("amount_di")
      .eq("user_id", userId);
    const balance = (data ?? []).reduce((s, r) => s + Number(r.amount_di || 0), 0);
    return { balance };
  });

export const purchaseListingPromotion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        listingId: z.string().uuid(),
        kind: z.enum(["featured", "pinned", "boost"]),
        durationDays: z.number().int().positive().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: res, error } = await supabase.rpc("purchase_listing_promotion", {
      _listing_id: data.listingId,
      _kind: data.kind,
      _duration_days: (data.durationDays ?? undefined) as number | undefined,
    });
    if (error) throw new Error(error.message);
    return res as { ok: boolean; cost_di: number; ends_at: string | null };
  });

export const purchaseVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase.rpc("purchase_verification");
    if (error) throw new Error(error.message);
    return data as { ok: boolean; cost_di: number; ends_at: string };
  });

export const purchaseMerchantSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ tier: z.enum(["merchant", "store"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: res, error } = await supabase.rpc("purchase_subscription", {
      _tier: data.tier,
    });
    if (error) throw new Error(error.message);
    return res as { ok: boolean; cost_di: number; ends_at: string };
  });

export const setCommissionEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("unauthorized");
    const { error } = await supabase
      .from("platform_config")
      .update({ value: data.enabled, updated_at: new Date().toISOString() })
      .eq("key", "commission_enabled");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
