import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

/**
 * Price Oracle: returns moving average for similar listings (same category + fuzzy title).
 * Used to detect manipulated/abnormal prices.
 */
export const getReferencePrice = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) =>
    z.object({
      category: z.string().min(1).max(100),
      title: z.string().min(1).max(255),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const key = data.title.toLowerCase().trim();
    const { data: rows, error } = await supabase
      .from("price_history")
      .select("price,recorded_at")
      .eq("category", data.category)
      .eq("title_key", key)
      .order("recorded_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    const prices = (rows ?? []).map((r: any) => Number(r.price)).filter((n) => n > 0);
    if (prices.length === 0) return { avg: null, count: 0, min: null, max: null };
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    return {
      avg: Math.round(avg),
      count: prices.length,
      min: Math.min(...prices),
      max: Math.max(...prices),
    };
  });
