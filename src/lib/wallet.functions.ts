import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const WELCOME_BONUS_DI = 100;
const PER_TRADE_DI = 50;

export const getWalletStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [profileRes, offersRes, reviewsRes, listingsRes] = await Promise.all([
      supabase.from("profiles").select("display_name,avatar_url,bio,rating,trades_count,created_at,account_type,company_name,company_verified").eq("id", userId).maybeSingle(),
      supabase.from("trade_offers").select("id,status,cash_balance,from_user,to_user,created_at").or(`from_user.eq.${userId},to_user.eq.${userId}`),
      supabase.from("reviews").select("id,rating,comment,created_at,reviewer_id").eq("reviewed_user", userId).order("created_at", { ascending: false }).limit(10),
      supabase.from("listings").select("id,status").eq("owner_id", userId),
    ]);

    const profile = profileRes.data;
    const offers = offersRes.data ?? [];
    const reviews = reviewsRes.data ?? [];
    const listings = listingsRes.data ?? [];

    const completed = offers.filter((o) => o.status === "completed");
    const pending = offers.filter((o) => o.status === "pending");
    const activeListings = listings.filter((l) => l.status === "active").length;

    // DI Balance (افتراضي): مكافأة ترحيب + 50 DI لكل صفقة مكتملة - الرصيد النقدي المدفوع
    const earned = WELCOME_BONUS_DI + completed.length * PER_TRADE_DI;
    const cashFlow = completed.reduce((acc, o) => {
      const amt = Number(o.cash_balance ?? 0);
      // إذا كان المستخدم الدافع (from_user عادةً يدفع الفرق) نخصم، وإلا نضيف
      return acc + (o.from_user === userId ? -amt : amt);
    }, 0);
    const diBalance = Math.max(0, Math.round((earned + cashFlow / 5) * 100) / 100); // 1 DI ≈ 5 ر.س

    const rating = Number(profile?.rating ?? 0);
    const tradesCount = Number(profile?.trades_count ?? completed.length);

    const reputationScore = Math.min(100, Math.round(rating * 20));
    const impactScore = Math.min(
      100,
      Math.round(tradesCount * 8 + reviews.length * 4 + activeListings * 2)
    );
    const trustLevel =
      reputationScore >= 80 ? "موثوق ذهبي" : reputationScore >= 60 ? "موثوق" : reputationScore >= 30 ? "جديد واعد" : "جديد";

    return {
      profile,
      diBalance,
      reputationScore,
      impactScore,
      trustLevel,
      stats: {
        completedTrades: completed.length,
        pendingOffers: pending.length,
        activeListings,
        totalReviews: reviews.length,
        averageRating: rating,
      },
      recentReviews: reviews,
    };
  });
