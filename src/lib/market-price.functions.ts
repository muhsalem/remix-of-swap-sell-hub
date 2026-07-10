import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Live market reference price with DB-backed cache.
 * - Returns cached row if fetched within TTL (default 24h).
 * - Otherwise queries Lovable AI Gateway for a market estimate and upserts.
 * Response includes `source` ("LIVE" | "CACHE") and `fetched_at` timestamp
 * so the UI can show freshness.
 */

const InputSchema = z.object({
  category: z.string().min(1).max(120),
  title: z.string().min(2).max(255),
  country: z.enum(["SA", "EG"]).default("SA"),
  ttlMinutes: z.number().int().min(15).max(10080).default(1440),
});

export type MarketPriceResult = {
  price_sar: number;
  price_min_sar: number | null;
  price_max_sar: number | null;
  source: "LIVE" | "CACHE";
  fetched_at: string;
  age_minutes: number;
  cached: boolean;
};

function normalizeKey(title: string) {
  return title.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 180);
}

export const getMarketPrice = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => InputSchema.parse(i))
  .handler(async ({ data }): Promise<MarketPriceResult> => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseUrl = process.env.SUPABASE_URL!;
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const key = normalizeKey(data.title);
    const nowMs = Date.now();

    // 1) look up cache
    const { data: cached } = await admin
      .from("market_price_cache")
      .select("price_sar, price_min_sar, price_max_sar, fetched_at, ttl_minutes")
      .eq("category", data.category)
      .eq("title_key", key)
      .eq("country", data.country)
      .maybeSingle();

    if (cached) {
      const ageMin = Math.floor(
        (nowMs - new Date(cached.fetched_at).getTime()) / 60000,
      );
      if (ageMin < (cached.ttl_minutes ?? data.ttlMinutes)) {
        return {
          price_sar: Number(cached.price_sar),
          price_min_sar: cached.price_min_sar != null ? Number(cached.price_min_sar) : null,
          price_max_sar: cached.price_max_sar != null ? Number(cached.price_max_sar) : null,
          source: "CACHE",
          fetched_at: cached.fetched_at,
          age_minutes: ageMin,
          cached: true,
        };
      }
    }

    // 2) fetch a fresh estimate from AI Gateway
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      if (cached) {
        // fall back to stale cache rather than fail
        const ageMin = Math.floor(
          (nowMs - new Date(cached.fetched_at).getTime()) / 60000,
        );
        return {
          price_sar: Number(cached.price_sar),
          price_min_sar: cached.price_min_sar != null ? Number(cached.price_min_sar) : null,
          price_max_sar: cached.price_max_sar != null ? Number(cached.price_max_sar) : null,
          source: "CACHE",
          fetched_at: cached.fetched_at,
          age_minutes: ageMin,
          cached: true,
        };
      }
      throw new Error("AI غير مهيأ");
    }

    const marketLabel = data.country === "EG" ? "السوق المصري" : "السوق السعودي";
    const prompt = `قدّر السعر السوقي الحالي في ${marketLabel} للسلعة التالية بالريال السعودي (SAR).
- التصنيف: ${data.category}
- الاسم: ${data.title}
أعد JSON فقط بهذا الشكل: {"price_sar": <متوسط>, "min_sar": <أدنى>, "max_sar": <أعلى>}
كن واقعياً بالاعتماد على متوسط أسعار مواقع البيع الشهيرة في المنطقة.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      if (cached) {
        const ageMin = Math.floor(
          (nowMs - new Date(cached.fetched_at).getTime()) / 60000,
        );
        return {
          price_sar: Number(cached.price_sar),
          price_min_sar: cached.price_min_sar != null ? Number(cached.price_min_sar) : null,
          price_max_sar: cached.price_max_sar != null ? Number(cached.price_max_sar) : null,
          source: "CACHE",
          fetched_at: cached.fetched_at,
          age_minutes: ageMin,
          cached: true,
        };
      }
      throw new Error(`فشل جلب السعر (${res.status})`);
    }

    const j = await res.json();
    const txt = j?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { price_sar?: number; min_sar?: number; max_sar?: number } = {};
    try {
      parsed = JSON.parse(txt);
    } catch {
      parsed = {};
    }

    const price = Number(parsed.price_sar);
    if (!Number.isFinite(price) || price <= 0) {
      if (cached) {
        const ageMin = Math.floor(
          (nowMs - new Date(cached.fetched_at).getTime()) / 60000,
        );
        return {
          price_sar: Number(cached.price_sar),
          price_min_sar: cached.price_min_sar != null ? Number(cached.price_min_sar) : null,
          price_max_sar: cached.price_max_sar != null ? Number(cached.price_max_sar) : null,
          source: "CACHE",
          fetched_at: cached.fetched_at,
          age_minutes: ageMin,
          cached: true,
        };
      }
      throw new Error("تعذر استخراج سعر صالح");
    }

    const minSar = Number.isFinite(Number(parsed.min_sar)) && Number(parsed.min_sar) > 0
      ? Number(parsed.min_sar)
      : null;
    const maxSar = Number.isFinite(Number(parsed.max_sar)) && Number(parsed.max_sar) > 0
      ? Number(parsed.max_sar)
      : null;

    const fetchedAt = new Date().toISOString();
    await admin.from("market_price_cache").upsert(
      {
        category: data.category,
        title_key: key,
        country: data.country,
        price_sar: Math.round(price),
        price_min_sar: minSar,
        price_max_sar: maxSar,
        source: "ai-gateway",
        fetched_at: fetchedAt,
        ttl_minutes: data.ttlMinutes,
      },
      { onConflict: "category,title_key,country" },
    );

    return {
      price_sar: Math.round(price),
      price_min_sar: minSar,
      price_max_sar: maxSar,
      source: "LIVE",
      fetched_at: fetchedAt,
      age_minutes: 0,
      cached: false,
    };
  });
