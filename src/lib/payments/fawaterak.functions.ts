// Public-safe server functions for payment flows through Fawaterak.
// The .server.ts helper is imported lazily inside handlers only.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const PURPOSE = z.enum([
  "verify_individual",
  "verify_company",
  "listing_featured_7d",
  "listing_featured_30d",
  "listing_pinned_7d",
  "listing_boost",
  "sub_merchant_month",
  "sub_store_month",
]);

const CreatePaymentInput = z.object({
  purpose: PURPOSE,
  targetId: z.string().uuid().optional(),
  country: z.enum(["SA", "EG"]).default("SA"),
});

const PURPOSE_LABEL: Record<z.infer<typeof PURPOSE>, string> = {
  verify_individual: "توثيق الحساب (فرد) لمدة سنة",
  verify_company: "توثيق حساب شركة/متجر لمدة سنة",
  listing_featured_7d: "إعلان مميز لمدة 7 أيام",
  listing_featured_30d: "إعلان مميز لمدة 30 يوماً",
  listing_pinned_7d: "تثبيت الإعلان في الأعلى (7 أيام)",
  listing_boost: "تعزيز ظهور الإعلان",
  sub_merchant_month: "اشتراك التاجر الشهري",
  sub_store_month: "اشتراك المتجر الشهري",
};

// Requires target_id
const NEEDS_LISTING = new Set([
  "listing_featured_7d",
  "listing_featured_30d",
  "listing_pinned_7d",
  "listing_boost",
]);

const PRICING_KEY_MAP: Record<z.infer<typeof PURPOSE>, string> = {
  verify_individual: "verify_individual",
  verify_company: "verify_company",
  listing_featured_7d: "listing_featured_7d",
  listing_featured_30d: "listing_featured_30d",
  listing_pinned_7d: "listing_pinned_7d",
  listing_boost: "listing_boost",
  sub_merchant_month: "sub_merchant_month",
  sub_store_month: "sub_store_month",
};

// Simple SAR → target currency conversion (kept conservative; real FX is client-side too).
async function convertSarTo(amountSar: number, target: "SAR" | "EGP"): Promise<number> {
  if (target === "SAR") return amountSar;
  const rate = Number(process.env.FX_SAR_TO_EGP ?? 13); // fallback if fx unavailable
  return Math.round(amountSar * rate * 100) / 100;
}

export const createPaymentIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreatePaymentInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { purpose, targetId, country } = data;

    const { enforceRateLimit } = await import("@/lib/rate-limit.server");
    await enforceRateLimit(userId, {
      action: "create_payment_intent",
      limit: 8,
      windowSec: 600,
      failClosed: true,
    });

    if (NEEDS_LISTING.has(purpose) && !targetId) {
      throw new Error("target_id_required");
    }


    // Fetch pricing from platform_config.cash_pricing (SAR base).
    const { data: cfg } = await supabase
      .from("platform_config")
      .select("value")
      .eq("key", "cash_pricing")
      .maybeSingle();
    const pricing = (cfg?.value as Record<string, number> | null) ?? {};
    const priceSar = Number(pricing[PRICING_KEY_MAP[purpose]] ?? 0);
    if (!priceSar || priceSar <= 0) throw new Error("pricing_not_configured");

    const currency: "SAR" | "EGP" = country === "EG" ? "EGP" : "SAR";
    const amount = await convertSarTo(priceSar, currency);

    // Load customer profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, account_type, company_name")
      .eq("id", userId)
      .maybeSingle();
    const { data: userRes } = await supabase.auth.getUser();
    const email = userRes.user?.email ?? "no-reply@badel.app";
    const firstName = (profile?.display_name ?? profile?.company_name ?? "عميل").split(" ")[0] ?? "عميل";
    const lastName = (profile?.display_name ?? "").split(" ").slice(1).join(" ") || "بدل";

    // Insert pending payment row first so we can pass its id as invoiceNumber.
    const { data: paymentRow, error: insErr } = await supabase
      .from("payments")
      .insert({
        user_id: userId,
        provider: "fawaterak",
        purpose,
        target_id: targetId ?? null,
        amount,
        currency,
        status: "pending",
      })
      .select("id")
      .single();
    if (insErr || !paymentRow) throw new Error(`payment_insert_failed: ${insErr?.message}`);

    // Base URL for redirect endpoints. Prefer explicit env; otherwise use request origin.
    const origin =
      process.env.PUBLIC_APP_URL ??
      process.env.VITE_PUBLIC_APP_URL ??
      "https://project--8ce47409-26c6-41e5-a080-08c28d264225.lovable.app";

    const { createFawaterakInvoice } = await import("./fawaterak.server");
    let invoice;
    try {
      invoice = await createFawaterakInvoice({
        paymentId: paymentRow.id,
        amount,
        currency,
        itemName: PURPOSE_LABEL[purpose],
        customer: {
          first_name: firstName,
          last_name: lastName,
          email,
        },
        successUrl: `${origin}/payments/callback?pid=${paymentRow.id}&result=success`,
        failUrl: `${origin}/payments/callback?pid=${paymentRow.id}&result=fail`,
        pendingUrl: `${origin}/payments/callback?pid=${paymentRow.id}&result=pending`,
        metadata: { purpose, targetId },
      });
    } catch (err) {
      // Mark the pending row as failed for observability.
      await supabase
        .from("payments")
        .update({ status: "failed", raw_callback: { init_error: String(err) } })
        .eq("id", paymentRow.id);
      throw err;
    }

    await supabase
      .from("payments")
      .update({
        provider_invoice_id: invoice.invoiceId,
        provider_invoice_key: invoice.invoiceKey,
        checkout_url: invoice.url,
        raw_request: invoice.raw as never,
      })
      .eq("id", paymentRow.id);

    return {
      paymentId: paymentRow.id,
      checkoutUrl: invoice.url,
      amount,
      currency,
      label: PURPOSE_LABEL[purpose],
    };
  });

export const getPaymentStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ paymentId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("payments")
      .select("id, status, purpose, amount, currency, checkout_url, paid_at, created_at")
      .eq("id", data.paymentId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!row) throw new Error("payment_not_found");
    return row;
  });

export const listMyPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("payments")
      .select("id, purpose, amount, currency, status, checkout_url, paid_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });
