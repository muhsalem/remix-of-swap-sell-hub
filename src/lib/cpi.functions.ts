import { createServerFn } from "@tanstack/react-start";
import { supabase as anonClient } from "@/integrations/supabase/client";

export const getLatestCPI = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await anonClient
    .from("economic_indicators")
    .select("value, period, country_code, source")
    .eq("country_code", "SA")
    .eq("indicator", "CPI")
    .order("period", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("CPI fetch failed", error);
    return { cpi: 1, period: null as string | null };
  }
  return { cpi: Number(data?.value ?? 1), period: data?.period ?? null };
});

/** Apply CPI adjustment to a SAR amount. */
export function adjustForCPI(amountSAR: number, cpi: number): number {
  if (!cpi || cpi <= 0) return amountSAR;
  return Math.round(amountSAR * cpi);
}
