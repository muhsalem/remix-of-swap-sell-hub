import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Tier = "free" | "plus" | "pro";

export const TIERS: Record<Tier, { name: string; priceSAR: number; perks: string[] }> = {
  free: {
    name: "مجاني",
    priceSAR: 0,
    perks: [
      "3 إعلانات نشطة",
      "عمولة 3% على الصفقات",
      "تنبيهات الرغبات الأساسية",
    ],
  },
  plus: {
    name: "Plus",
    priceSAR: 29,
    perks: [
      "إعلانات غير محدودة",
      "خفض العمولة إلى 2%",
      "إبراز إعلانك لـ 24 ساعة أسبوعياً",
      "تنبيهات رغبات غير محدودة",
      "شارة «موثّق» على الملف الشخصي",
    ],
  },
  pro: {
    name: "Pro (تجار وشركات)",
    priceSAR: 99,
    perks: [
      "كل مزايا Plus",
      "خفض العمولة إلى 1%",
      "5 عمليات إبراز شهرياً",
      "لوحة تحليلات (مشاهدات، عروض، نسبة تحويل)",
      "أولوية الدعم وحل النزاعات",
      "API للوصول الآلي (قريباً)",
    ],
  },
};

export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    return { subscription: data, tier: (data?.tier ?? "free") as Tier };
  });

/**
 * Client-callable subscription change.
 * Only the free tier (downgrade/cancel) is allowed from the client.
 * Paid tier upgrades MUST be granted by a verified payment webhook
 * using the service-role client — never by the user themselves.
 */
export const upgradeSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ tier: z.enum(["free"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const tier = data.tier as Tier;
    // Service role is required because client RLS no longer permits subscription writes.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          tier,
          status: "active",
          price_sar: 0,
          renews_at: null,
        },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true, tier };
  });

