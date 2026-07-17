// Admin-only helpers to inspect payment webhook activity and trigger sandbox invoices.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("forbidden: admin only");
}

export const listRecentPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ limit: z.number().int().min(1).max(100).default(30) })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: rows, error } = await supabase
      .from("payments")
      .select(
        "id, user_id, provider, provider_invoice_id, provider_invoice_key, purpose, target_id, amount, currency, status, checkout_url, raw_request, raw_callback, paid_at, created_at, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getFawaterakMode = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    return {
      mode: process.env.FAWATERAK_MODE ?? "sandbox",
      hasApiKey: !!process.env.FAWATERAK_API_KEY,
      hasVendorKey: !!process.env.FAWATERAK_VENDOR_KEY,
    };
  });
