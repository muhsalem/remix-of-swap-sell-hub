import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { findCycles, type ChainNode, type TradeCycle } from "@/lib/chain-graph";

export type DiscoveredChain = {
  score: number;
  maxGapPct: number;
  steps: {
    listingId: string;
    title: string;
    category: string;
    ownerId: string;
    price: number | null;
    isMine: boolean;
  }[];
};

/**
 * محرك اكتشاف سلاسل المقايضة الآلي (A→B→C→A).
 * يفحص كل إعلانات المستخدم النشطة مقابل السوق ويعيد أفضل الدورات.
 */
export const discoverMyChains = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        listingId: z.string().uuid().optional(),
        maxLen: z.number().int().min(3).max(4).optional(),
        notify: z.boolean().optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: pool, error } = await supabase
      .from("listings")
      .select("id, owner_id, title, category, wants, market_price, is_ribawi")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(800);
    if (error) throw new Error(error.message);

    const nodes = (pool ?? []) as ChainNode[];
    const mine = nodes.filter(
      (l) => l.owner_id === userId && (!data.listingId || l.id === data.listingId),
    );
    if (mine.length === 0) return { chains: [] as DiscoveredChain[], scanned: nodes.length };

    const cycles: TradeCycle[] = [];
    for (const m of mine) {
      cycles.push(
        ...findCycles(nodes, m.id, { maxLen: data.maxLen ?? 4, limit: 6 }),
      );
    }

    const chains: DiscoveredChain[] = cycles
      .sort((a, b) => b.score - a.score || a.maxGapPct - b.maxGapPct)
      .slice(0, 10)
      .map((c) => ({
        score: Math.round(c.score * 100),
        maxGapPct: c.maxGapPct,
        steps: c.nodes.map((n) => ({
          listingId: n.id,
          title: n.title,
          category: n.category ?? "",
          ownerId: n.owner_id,
          price: n.market_price === null ? null : Number(n.market_price),
          isMine: n.owner_id === userId,
        })),
      }));

    if (data.notify && chains.length > 0) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("notifications").insert({
          user_id: userId,
          type: "trade_chain",
          title: `وجدنا لك ${chains.length} سلسلة مقايضة محتملة`,
          body: `أفضل سلسلة بنسبة توافق ${chains[0]!.score}% وفارق قيمة ${chains[0]!.maxGapPct}%.`,
          link: "/three-way",
        });
      } catch (e) {
        console.error("chain notify failed", e);
      }
    }

    return { chains, scanned: nodes.length };
  });
