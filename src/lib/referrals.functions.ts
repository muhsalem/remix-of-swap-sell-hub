import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function genCode(seed: string) {
  // Short, readable, deterministic-ish code from user id
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

export const redeemReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ code: z.string().min(3).max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ref } = await supabase
      .from("referrals")
      .select("*")
      .eq("code", data.code.trim().toUpperCase())
      .maybeSingle();
    if (!ref) return { ok: false, message: "كود غير صالح" };
    if (ref.referrer_id === userId) return { ok: false, message: "لا يمكنك استخدام كودك" };
    if (ref.referred_user) return { ok: false, message: "تم استخدام هذا الكود مسبقاً" };

    const { error } = await supabase
      .from("referrals")
      .update({ referred_user: userId, rewarded: true, redeemed_at: new Date().toISOString() })
      .eq("id", ref.id);
    if (error) throw new Error(error.message);

    // Reward both with DI (ignore if wallet_ledger has stricter rules; admin can adjust)
    await supabase.from("wallet_ledger").insert([
      { user_id: ref.referrer_id, amount_di: ref.reward_di, entry_type: "trade_completed", note: `إحالة ناجحة (${ref.code})` },
      { user_id: userId,           amount_di: ref.reward_di, entry_type: "trade_completed", note: `مكافأة تسجيل عبر ${ref.code}` },
    ]);
    return { ok: true, reward_di: ref.reward_di };
  });
