import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("غير مصرّح: صلاحية المشرف مطلوبة");
}

export const listFraudSignals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        status: z.enum(["all", "pending", "cleared", "confirmed_fraud", "needs_info"]).default("pending"),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    let q = supabase
      .from("fraud_signals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.status !== "all") q = q.eq("review_status", data.status);

    const { data: signals, error } = await q;
    if (error) throw new Error(error.message);
    const rows = signals ?? [];

    const userIds = [...new Set(rows.map((r: any) => r.user_id).filter(Boolean))] as string[];
    const listingIds = [...new Set(rows.map((r: any) => r.listing_id).filter(Boolean))] as string[];

    const [{ data: profiles }, { data: listings }] = await Promise.all([
      userIds.length
        ? supabase
            .from("profiles")
            .select("id,display_name,account_type,verified_badge,is_suspended,suspension_reason,suspended_at")
            .in("id", userIds)
        : Promise.resolve({ data: [] as any[] }),
      listingIds.length
        ? supabase.from("listings").select("id,title,market_price,status,images,owner_id").in("id", listingIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const pMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const lMap = new Map((listings ?? []).map((l: any) => [l.id, l]));

    return {
      signals: rows.map((r: any) => ({
        ...r,
        profile: r.user_id ? pMap.get(r.user_id) ?? null : null,
        listing: r.listing_id ? lMap.get(r.listing_id) ?? null : null,
      })),
      counts: {
        pending: rows.filter((r: any) => r.review_status === "pending").length,
        total: rows.length,
      },
    };
  });

export const reviewFraudSignal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        review_status: z.enum(["pending", "cleared", "confirmed_fraud", "needs_info"]),
        note: z.string().max(1000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { error } = await supabase
      .from("fraud_signals")
      .update({
        review_status: data.review_status,
        review_note: data.note ?? null,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        resolved: data.review_status !== "pending" && data.review_status !== "needs_info",
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: `fraud_signal_${data.review_status}`,
      entity_type: "fraud_signal",
      entity_id: data.id,
      metadata: { note: data.note ?? null },
    });

    return { ok: true };
  });

export const setAccountSuspension = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        suspend: z.boolean(),
        reason: z.string().max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (data.user_id === userId) throw new Error("لا يمكنك تعليق حسابك الخاص");
    if (data.suspend && (!data.reason || data.reason.trim().length < 3)) {
      throw new Error("اكتب سبب التعليق (3 أحرف على الأقل)");
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        is_suspended: data.suspend,
        suspended_at: data.suspend ? new Date().toISOString() : null,
        suspension_reason: data.suspend ? data.reason!.trim() : null,
        suspended_by: data.suspend ? userId : null,
      })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);

    if (data.suspend) {
      await supabase.from("listings").update({ status: "closed" }).eq("owner_id", data.user_id).eq("status", "active");
    }

    await supabase.from("notifications").insert({
      user_id: data.user_id,
      type: data.suspend ? "account_suspended" : "account_restored",
      title: data.suspend ? "تم تعليق حسابك مؤقتاً" : "تم رفع التعليق عن حسابك",
      body: data.suspend ? data.reason!.trim().slice(0, 140) : "يمكنك استئناف النشاط على المنصة.",
      link: "/profile",
    });

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: data.suspend ? "account_suspend" : "account_unsuspend",
      entity_type: "profile",
      entity_id: data.user_id,
      metadata: { reason: data.reason ?? null },
    });

    return { ok: true };
  });
