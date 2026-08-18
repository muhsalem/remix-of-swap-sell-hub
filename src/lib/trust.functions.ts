import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase as anonClient } from "@/integrations/supabase/client";
import { computeTrustScore } from "@/lib/trust-score";

export const getTrustScore = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { data: p, error } = await anonClient
      .from("profiles")
      .select(
        "id,rating,trades_count,verified_badge,company_verified,company_kyc_status,created_at,is_suspended",
      )
      .eq("id", data.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!p) return { trust: null };

    const ageDays = Math.max(
      0,
      Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86_400_000),
    );

    return {
      trust: computeTrustScore({
        rating: p.rating,
        tradesCount: p.trades_count,
        verifiedBadge: !!p.verified_badge,
        companyVerified: !!p.company_verified,
        kycVerified: p.company_kyc_status === "verified",
        accountAgeDays: ageDays,
        isSuspended: !!p.is_suspended,
      }),
    };
  });
