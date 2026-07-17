import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function genCode(seed: string) {
  const base = seed.replace(/-/g, "").toUpperCase();
  return "BD-" + base.slice(0, 4) + base.slice(-2);
}

export const getOrCreateMyReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("referrals")
      .select("*")
      .eq("referrer_id", userId)
      .is("referred_user", null)
      .maybeSingle();
    if (existing) return { code: existing.code, reward_di: existing.reward_di };

    const code = genCode(userId);
    const { error } = await supabase
      .from("referrals")
      .insert({ referrer_id: userId, code });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { code, reward_di: 25 };
  });

/**
 * Redeem a referral code. During the trial period this grants an immediate
 * welcome coupon (10% off first promotion) to the referred user, and marks
 * the referral as pending so both parties earn the 7-day featured coupon
 * once the referred user completes their first trade.
 */
export const redeemReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ code: z.string().min(3).max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const code = data.code.trim().toUpperCase();
    const { data: ref } = await supabase
      .from("referrals")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    if (!ref) return { ok: false, message: "كود غير صالح" };
    if (ref.referrer_id === userId) return { ok: false, message: "لا يمكنك استخدام كودك" };
    if (ref.referred_user) return { ok: false, message: "تم استخدام هذا الكود مسبقاً" };

    const { error } = await supabase
      .from("referrals")
      .update({ referred_user: userId, reward_pending: true } as never)
      .eq("id", ref.id);
    if (error) throw new Error(error.message);

    // grant immediate welcome coupon (idempotent inside the fn)
    await supabase.rpc("grant_welcome_referral_coupon" as never, { _referral_id: ref.id } as never);

    return {
      ok: true,
      message: "تم ربط الإحالة! حصلت على خصم ترحيبي 10%، وستحصل أنت والمُحيل على إعلان مميز 7 أيام بعد أول صفقة.",
    };
  });

export const getMyReferralSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [{ data: myRef }, { count: invitedCount }, { count: convertedCount }, { data: rewards }] =
      await Promise.all([
        supabase.from("referrals").select("*").eq("referrer_id", userId).maybeSingle(),
        supabase.from("referrals").select("id", { count: "exact", head: true })
          .eq("referrer_id", userId).not("referred_user", "is", null),
        supabase.from("referrals").select("id", { count: "exact", head: true })
          .eq("referrer_id", userId).eq("rewarded", true),
        supabase.from("referral_rewards").select("*").eq("user_id", userId)
          .order("granted_at", { ascending: false }).limit(50),
      ]);

    return {
      code: myRef?.code ?? null,
      invited: invitedCount ?? 0,
      converted: convertedCount ?? 0,
      rewards: rewards ?? [],
    };
  });

export const redeemFeaturedCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    reward_id: z.string().uuid(),
    listing_id: z.string().uuid(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: reward, error: rErr } = await supabase
      .from("referral_rewards")
      .select("*")
      .eq("id", data.reward_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!reward) return { ok: false, message: "المكافأة غير موجودة" };
    if (reward.status !== "active") return { ok: false, message: "المكافأة مُستخدمة أو منتهية" };
    if (reward.reward_type !== "free_featured_7d") return { ok: false, message: "نوع المكافأة غير متوافق" };
    if (reward.expires_at && new Date(reward.expires_at) < new Date()) {
      return { ok: false, message: "المكافأة منتهية الصلاحية" };
    }

    const { data: listing } = await supabase
      .from("listings")
      .select("id, owner_id, featured_until")
      .eq("id", data.listing_id)
      .maybeSingle();
    if (!listing || listing.owner_id !== userId) {
      return { ok: false, message: "لست مالك هذا الإعلان" };
    }

    const base = listing.featured_until && new Date(listing.featured_until) > new Date()
      ? new Date(listing.featured_until)
      : new Date();
    const newUntil = new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // admin path for privileged listing/reward updates (bypasses promotion guard)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: uErr } = await supabaseAdmin
      .from("listings")
      .update({ is_featured: true, featured_until: newUntil })
      .eq("id", data.listing_id);
    if (uErr) throw new Error(uErr.message);

    await supabaseAdmin
      .from("referral_rewards")
      .update({ status: "used", used_at: new Date().toISOString(), used_on_listing: data.listing_id })
      .eq("id", data.reward_id);

    return { ok: true, featured_until: newUntil, message: "تم تفعيل الإعلان المميز لمدة 7 أيام!" };
  });
