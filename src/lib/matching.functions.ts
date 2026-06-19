import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Three-way barter matching engine.
 * Given the user's listing X and what they want (target category/keyword),
 * find chains: someone has the target (Y), wants Z; someone else has Z, wants X.
 *
 * Simple heuristic: category-based two-hop search across active listings.
 */
export const findThreeWayMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      myListingId: z.string().uuid(),
      desiredCategory: z.string().min(1).max(80),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1) Get my listing's category (what others might want)
    const { data: mine, error: e1 } = await supabase
      .from("listings")
      .select("id, title, category, owner_id")
      .eq("id", data.myListingId)
      .maybeSingle();
    if (e1) throw e1;
    if (!mine || mine.owner_id !== userId) throw new Error("not_owner");

    const myCat = (mine.category ?? "").toLowerCase();
    const wantCat = data.desiredCategory.toLowerCase();

    // 2) Find user B: has what I want (wantCat)
    const { data: hops1 } = await supabase
      .from("listings")
      .select("id, title, category, owner_id, profiles!listings_owner_id_fkey(display_name, rating, trades_count)")
      .eq("status", "active")
      .ilike("category", `%${wantCat}%`)
      .neq("owner_id", userId)
      .limit(20);

    if (!hops1 || hops1.length === 0) {
      return { chains: [] as Array<{ b: typeof mine; c: typeof mine; intermediateCategory: string }> };
    }

    const chains: Array<{
      bListing: { id: string; title: string; category: string; owner: string };
      cListing: { id: string; title: string; category: string; owner: string };
      intermediateCategory: string;
    }> = [];

    // 3) For each B, pick a plausible "intermediate" category they might want
    //    Then find C who has that intermediate and wants myCat.
    //    Heuristic: use B's own other listings' categories as proxies,
    //    or just look for any listing whose category overlaps with myCat where
    //    the owner is a third party.
    const seen = new Set<string>();
    for (const b of hops1) {
      const { data: hops2 } = await supabase
        .from("listings")
        .select("id, title, category, owner_id")
        .eq("status", "active")
        .ilike("category", `%${myCat}%`)
        .neq("owner_id", userId)
        .neq("owner_id", b.owner_id)
        .limit(5);

      for (const c of hops2 ?? []) {
        const key = `${b.id}-${c.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        chains.push({
          bListing: { id: b.id, title: b.title, category: b.category ?? "", owner: b.owner_id },
          cListing: { id: c.id, title: c.title, category: c.category ?? "", owner: c.owner_id },
          intermediateCategory: c.category ?? "",
        });
        if (chains.length >= 10) break;
      }
      if (chains.length >= 10) break;
    }

    return { chains };
  });
