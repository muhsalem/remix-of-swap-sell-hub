import { createServerFn } from "@tanstack/react-start";
import { supabase as anonClient } from "@/integrations/supabase/client";

export const getLatestReserveSnapshot = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await anonClient
    .from("reserve_snapshots")
    .select("total_di_outstanding, reserve_sar, reserve_ratio, note, recorded_at")
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("reserve snapshot fetch failed", error);
    return { snapshot: null as null | {
      total_di_outstanding: number; reserve_sar: number; reserve_ratio: number; note: string | null; recorded_at: string;
    } };
  }
  return { snapshot: data };
});
