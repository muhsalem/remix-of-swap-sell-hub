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

const STATUS = z.enum(["pending", "paid", "failed", "expired", "refunded"]);

export const listAllPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        status: STATUS.optional(),
        purpose: z.string().optional(),
        userId: z.string().uuid().optional(),
        search: z.string().trim().max(200).optional(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    let q = supabase
      .from("payments")
      .select(
        "id, user_id, provider, provider_invoice_id, purpose, target_id, amount, currency, status, checkout_url, paid_at, created_at, updated_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);

    if (data.status) q = q.eq("status", data.status);
    if (data.purpose) q = q.eq("purpose", data.purpose as never);
    if (data.userId) q = q.eq("user_id", data.userId);
    if (data.search) {
      const s = data.search;
      q = q.or(`provider_invoice_id.ilike.%${s}%,id.eq.${isUuid(s) ? s : "00000000-0000-0000-0000-000000000000"}`);
    }

    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);

    // Aggregate counts by status (unaffected by pagination)
    const { data: agg } = await supabase
      .from("payments")
      .select("status");
    const counts: Record<string, number> = { paid: 0, pending: 0, failed: 0, expired: 0, refunded: 0 };
    for (const r of agg ?? []) counts[r.status as string] = (counts[r.status as string] ?? 0) + 1;

    return { rows: rows ?? [], total: count ?? 0, counts };
  });

export const listMyPaymentsHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        status: STATUS.optional(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("payments")
      .select(
        "id, provider, provider_invoice_id, purpose, amount, currency, status, checkout_url, paid_at, created_at",
        { count: "exact" },
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);

    const { data: agg } = await supabase.from("payments").select("status").eq("user_id", userId);
    const counts: Record<string, number> = { paid: 0, pending: 0, failed: 0, expired: 0, refunded: 0 };
    for (const r of agg ?? []) counts[r.status as string] = (counts[r.status as string] ?? 0) + 1;

    return { rows: rows ?? [], total: count ?? 0, counts };
  });

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
