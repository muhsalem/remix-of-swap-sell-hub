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

export const upgradeSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ tier: z.enum(["free", "plus", "pro"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tier = data.tier as Tier;
    const price = TIERS[tier].priceSAR;
    const renews = new Date();
    renews.setMonth(renews.getMonth() + 1);
    const { error } = await supabase
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          tier,
          status: "active",
          price_sar: price,
          renews_at: tier === "free" ? null : renews.toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    // Audit
    await supabase.from("audit_log").insert({
      entity_type: "subscription",
      action: tier === "free" ? "cancel" : "upgrade",
      actor_id: userId,
      metadata: { tier, price_sar: price },
    });
    return { ok: true, tier };
  });
