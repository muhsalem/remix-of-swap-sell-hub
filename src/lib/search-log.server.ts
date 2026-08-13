// تسجيل استعلامات البحث العربي المُطبَّع في analytics_events (غير معطّل للتدفق).
import { supabase as anonClient } from "@/integrations/supabase/client";
import { arNormalize } from "./ar-normalize";

export type SearchLog = {
  q: string;
  source: "match" | "wishlist" | "mcp";
  results: number;
  ms: number;
  error?: string | null;
};

export async function logArSearch(input: SearchLog) {
  try {
    await anonClient.from("analytics_events").insert({
      event_name: "ar_search",
      path: `/search/${input.source}`,
      meta: {
        q: input.q.slice(0, 120),
        normalized: arNormalize(input.q).slice(0, 120),
        source: input.source,
        results: input.results,
        ms: Math.round(input.ms),
        error: input.error ? String(input.error).slice(0, 300) : null,
      } as never,
    } as never);
  } catch {
    // لا يجب أن يفشل البحث بسبب التتبع
  }
}
