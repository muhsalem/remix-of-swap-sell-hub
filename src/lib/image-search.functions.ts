import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase as anonClient } from "@/integrations/supabase/client";
import { hammingDistance } from "./image-hash";

const Input = z.object({
  phash: z.string().regex(/^[0-9a-f]{16}$/),
  maxDistance: z.number().int().min(0).max(24).optional().default(12),
});

/**
 * بحث بالصورة: يقارن بصمة الصورة المرفوعة (dHash) ببصمات صور الإعلانات
 * ويعيد الإعلانات النشطة الأقرب شبهاً مرتبة حسب التطابق.
 */
export const searchListingsByImage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("listing_image_hashes")
      .select("listing_id,phash")
      .limit(5000);
    if (error) throw new Error(error.message);

    const best = new Map<string, number>();
    for (const r of (rows ?? []) as Array<{ listing_id: string; phash: string }>) {
      const d = hammingDistance(data.phash, r.phash);
      if (d > data.maxDistance) continue;
      const prev = best.get(r.listing_id);
      if (prev === undefined || d < prev) best.set(r.listing_id, d);
    }
    if (best.size === 0) return { matches: [] as any[] };

    const ids = [...best.keys()].slice(0, 60);
    const { data: listings, error: lErr } = await anonClient
      .from("listings")
      .select(
        "id,title,description,category,condition,age_months,market_price,wants,images,status,city,listing_type,created_at,price_reference_sar,price_source,price_deviation_pct,profiles:owner_id(display_name,avatar_url,rating,trades_count)",
      )
      .in("id", ids)
      .eq("status", "active");
    if (lErr) throw new Error(lErr.message);

    const matches = (listings ?? [])
      .map((l: any) => ({ ...l, _distance: best.get(l.id) ?? 64 }))
      .sort((a: any, b: any) => a._distance - b._distance)
      .slice(0, 24);

    return { matches };
  });
