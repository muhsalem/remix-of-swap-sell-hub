import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const adminListWaitlist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: role } = await supabase
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!role) throw new Error("غير مصرّح");

    const { data, error } = await supabase
      .from("waitlist_signups")
      .select("id,email,phone,country,city,role,interest,referral_code,utm_source,utm_medium,utm_campaign,confirmed,invited_at,created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as any[];
    const byCampaign: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    const byCountry: Record<string, number> = {};
    const byRole: Record<string, number> = {};
    let invited = 0;
    for (const r of rows) {
      byCampaign[r.utm_campaign || "direct"] = (byCampaign[r.utm_campaign || "direct"] || 0) + 1;
      bySource[r.utm_source || "direct"] = (bySource[r.utm_source || "direct"] || 0) + 1;
      byCountry[r.country || "?"] = (byCountry[r.country || "?"] || 0) + 1;
      byRole[r.role || "user"] = (byRole[r.role || "user"] || 0) + 1;
      if (r.invited_at) invited += 1;
    }
    return {
      rows,
      total: rows.length,
      invited,
      byCampaign,
      bySource,
      byCountry,
      byRole,
    };
  });
