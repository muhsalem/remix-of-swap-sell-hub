import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const SAR_PER_DI = 5;

export type LedgerEntry = {
  id: string;
  entry_type: string;
  amount_di: number;
  balance_after: number;
  reference_offer: string | null;
  note: string | null;
  created_at: string;
};

/** DI wallet backed 1:1 by public.wallet_ledger — no in-memory estimation. */
export const getWalletStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [profileRes, offersRes, reviewsRes, listingsRes, balanceRes, statementRes] = await Promise.all([
      supabase.from("profiles").select("display_name,avatar_url,bio,rating,trades_count,created_at,account_type,company_name,company_verified").eq("id", userId).maybeSingle(),
      supabase.from("trade_offers").select("id,status,cash_balance,from_user,to_user,created_at").or(`from_user.eq.${userId},to_user.eq.${userId}`),
      supabase.from("reviews").select("id,rating,comment,created_at,reviewer_id").eq("reviewed_user", userId).order("created_at", { ascending: false }).limit(10),
      supabase.from("listings").select("id,status").eq("owner_id", userId),
      supabase.rpc("di_balance", { _user_id: userId }),
      supabase.rpc("di_statement", { _user_id: userId, _limit: 100 }),
    ]);

    const profile = profileRes.data;
    const offers = offersRes.data ?? [];
    const reviews = reviewsRes.data ?? [];
    const listings = listingsRes.data ?? [];

    const completed = offers.filter((o) => o.status === "completed");
    const pending = offers.filter((o) => o.status === "pending");
    const activeListings = listings.filter((l) => l.status === "active").length;

    const statement = ((statementRes.data ?? []) as LedgerEntry[]).map((e) => ({
      ...e,
      amount_di: Number(e.amount_di),
      balance_after: Number(e.balance_after),
    }));

    // Ledger is the single source of truth.
    const diBalance = Math.round(Number(balanceRes.data ?? 0) * 100) / 100;

    // Accounting proof: credits + debits must reconcile to the reported balance.
    const credits = statement.filter((e) => e.amount_di > 0).reduce((s, e) => s + e.amount_di, 0);
    const debits = statement.filter((e) => e.amount_di < 0).reduce((s, e) => s + e.amount_di, 0);
    const statementSum = Math.round((credits + debits) * 100) / 100;
    const truncated = statement.length >= 100;
    const reconciled = truncated || Math.abs(statementSum - diBalance) < 0.01;

    const byType = statement.reduce<Record<string, { count: number; total: number }>>((acc, e) => {
      const row = acc[e.entry_type] ?? { count: 0, total: 0 };
      row.count += 1;
      row.total = Math.round((row.total + e.amount_di) * 100) / 100;
      acc[e.entry_type] = row;
      return acc;
    }, {});

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
      diValueSar: Math.round(diBalance * SAR_PER_DI * 100) / 100,
      ledger: {
        entries: statement,
        credits: Math.round(credits * 100) / 100,
        debits: Math.round(debits * 100) / 100,
        byType,
        reconciled,
        truncated,
      },
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
