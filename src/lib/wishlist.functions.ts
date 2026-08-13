import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase as anonClient } from "@/integrations/supabase/client";
import { arTokens } from "./ar-normalize";

// Search active listings for "I want this in barter" suggestions.
export const searchPlatformItems = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ q: z.string().trim().min(2).max(100) }).parse(i),
  )
  .handler(async ({ data }) => {
    type Item = { id: string; title: string; category: string; market_price: number };
    if (arTokens(data.q, 4).length === 0) return { items: [] as Item[] };
    const { data: rows, error } = await (anonClient as any).rpc("search_listings_ar", {
      _q: data.q,
      _limit: 8,
    });
    if (error) throw new Error(error.message);
    const items: Item[] = ((rows ?? []) as any[]).map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      market_price: Number(r.market_price ?? 0),
    }));
    return { items };
  });

// Register a "notify me when available" alert.
export const addWishlistAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ searchTerm: z.string().trim().min(2).max(200) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const normalized = data.searchTerm.toLowerCase().trim();
    // Prevent duplicates per user.
    const { data: existing } = await supabase
      .from("wishlist_alerts")
      .select("id")
      .eq("user_id", userId)
      .eq("normalized", normalized)
      .eq("fulfilled", false)
      .maybeSingle();
    if (existing) return { id: existing.id, duplicate: true };
    const { data: row, error } = await supabase
      .from("wishlist_alerts")
      .insert({ user_id: userId, search_term: data.searchTerm, normalized })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, duplicate: false };
  });
