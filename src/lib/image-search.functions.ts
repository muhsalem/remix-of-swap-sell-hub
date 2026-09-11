import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase as anonClient } from "@/integrations/supabase/client";
import { combinedSimilarity } from "./image-hash";

const Input = z.object({
  phash: z.string().regex(/^[0-9a-f]{16}$/),
  csig: z.string().regex(/^[0-9a-f]{96}$/).optional(),
  esig: z.string().regex(/^[0-9a-f]{16}$/).optional(),
  /** أقل درجة تشابه مقبولة (0..1) — الافتراضي 0.72 */
  minScore: z.number().min(0.4).max(1).optional().default(0.72),
});

/**
 * بحث بالصورة: يقارن بصمة البنية + الألوان + الأنماط للصورة المرفوعة
 * ببصمات صور الإعلانات، ويعيد الإعلانات النشطة مرتبة حسب درجة التشابه.
 */
export const searchListingsByImage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("listing_image_hashes")
      .select("listing_id,phash,csig,esig")
      .limit(5000);
    if (error) throw new Error(error.message);

    type Row = { listing_id: string; phash: string; csig: string | null; esig: string | null };
    const best = new Map<string, { score: number; structure: number; color: number | null; pattern: number | null }>();
    for (const r of (rows ?? []) as Row[]) {
      const sim = combinedSimilarity(data, r);
      if (sim.score < data.minScore) continue;
      const prev = best.get(r.listing_id);
      if (!prev || sim.score > prev.score) best.set(r.listing_id, sim);
    }
    if (best.size === 0) return { matches: [] as any[] };

    const ids = [...best.keys()].slice(0, 60);
    const { data: listings, error: lErr } = await anonClient
      .from("listings")
      .select(
        "id,title,description,category,condition,age_months,area_sqm,market_price,wants,images,status,city,listing_type,created_at,price_reference_sar,price_source,price_deviation_pct,profiles:owner_id(display_name,avatar_url,rating,trades_count)",
      )
      .in("id", ids)
      .eq("status", "active");
    if (lErr) throw new Error(lErr.message);

    const matches = (listings ?? [])
      .map((l: any) => {
        const s = best.get(l.id)!;
        return {
          ...l,
          _score: s.score,
          _similarity: Math.round(s.score * 100),
          _colorMatch: s.color === null ? null : Math.round(s.color * 100),
          _patternMatch: s.pattern === null ? null : Math.round(s.pattern * 100),
          _structureMatch: Math.round(s.structure * 100),
        };
      })
      .sort((a: any, b: any) => b._score - a._score)
      .slice(0, 24);

    return { matches };
  });
