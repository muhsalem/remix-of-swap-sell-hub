import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getSearchAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ days: z.number().int().min(1).max(90).optional().default(30) }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("غير مصرّح: صلاحية المشرف مطلوبة");

    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();
    const { data: rows, error } = await supabase
      .from("analytics_events")
      .select("meta,created_at")
      .eq("event_name", "ar_search")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);

    const { summarizeSearchEvents } = await import("./search-analytics.server");
    return summarizeSearchEvents((rows ?? []) as never[], data.days);
  });
