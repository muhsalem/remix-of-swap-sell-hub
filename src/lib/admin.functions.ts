import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    return { isAdmin: !!data };
  });

export const listAllDisputes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Verify admin
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("غير مصرّح: صلاحية المشرف مطلوبة");

    const { data, error } = await supabase
      .from("disputes")
      .select("*, trade_offers:offer_id(from_user,to_user,offered_listing,requested_listing)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { disputes: data ?? [] };
  });

export const resolveDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["resolved", "rejected"]),
      resolution: z.string().min(3).max(1000),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("غير مصرّح");

    const { data: row, error } = await supabase
      .from("disputes")
      .update({ status: data.status, resolution: data.resolution })
      .eq("id", data.id)
      .select("offer_id")
      .single();
    if (error) throw new Error(error.message);

    // Unlock escrow on resolution
    if (data.status === "resolved" || data.status === "rejected") {
      await supabase
        .from("trade_offers")
        .update({ escrow_locked: false, escrow_released_at: new Date().toISOString() })
        .eq("id", row.offer_id);
    }

    // Notify both parties
    const { data: offer } = await supabase
      .from("trade_offers")
      .select("from_user,to_user")
      .eq("id", row.offer_id)
      .maybeSingle();
    if (offer) {
      const recipients = [offer.from_user, offer.to_user].filter(Boolean) as string[];
      for (const uid of recipients) {
        await supabase.from("notifications").insert({
          user_id: uid,
          type: "dispute_resolved",
          title: `تم ${data.status === "resolved" ? "حل" : "رفض"} النزاع`,
          body: data.resolution.slice(0, 140),
          link: `/offers/${row.offer_id}`,
        });
      }
    }
    return { ok: true };
  });

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("غير مصرّح: صلاحية المشرف مطلوبة");
}

export const getAdminKPIs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const [{ count: users }, { count: listings }, { count: offers }, { data: completed }, { data: fees }, { count: openDisputes }, { count: pendingKyc }] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("listings").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("trade_offers").select("*", { count: "exact", head: true }),
      supabase.from("trade_offers").select("cash_balance,created_at").eq("status", "completed"),
      supabase.from("platform_fees").select("amount_sar,status,created_at"),
      supabase.from("disputes").select("*", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("company_kyc_status", "pending"),
    ]);

    const gmv = (completed ?? []).reduce((s: number, o: any) => s + Number(o.cash_balance ?? 0), 0);
    const totalFees = (fees ?? []).reduce((s: number, f: any) => s + Number(f.amount_sar ?? 0), 0);
    const dueFees = (fees ?? []).filter((f: any) => f.status === "due").reduce((s: number, f: any) => s + Number(f.amount_sar ?? 0), 0);
    const completionRate = offers ? Math.round(((completed?.length ?? 0) / offers) * 100) : 0;

    // Trend last 30 days
    const thirtyDaysAgo = Date.now() - 30 * 24 * 3600 * 1000;
    const recent = (completed ?? []).filter((o: any) => new Date(o.created_at).getTime() > thirtyDaysAgo).length;

    return {
      kpis: {
        totalUsers: users ?? 0,
        activeListings: listings ?? 0,
        totalOffers: offers ?? 0,
        completedOffers: completed?.length ?? 0,
        completionRate,
        gmvSAR: Math.round(gmv),
        totalFeesSAR: Math.round(totalFees),
        dueFeesSAR: Math.round(dueFees),
        openDisputes: openDisputes ?? 0,
        pendingKyc: pendingKyc ?? 0,
        completedLast30Days: recent,
      },
    };
  });

export const listPendingKyc = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("profiles")
      .select("id,display_name,company_name,commercial_register,company_kyc_status,company_kyc_doc_url,company_kyc_notes,created_at")
      .eq("account_type", "company")
      .in("company_kyc_status", ["pending", "rejected"])
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { profiles: data ?? [] };
  });

export const reviewKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      profile_id: z.string().uuid(),
      decision: z.enum(["verified", "rejected"]),
      notes: z.string().max(500).optional().default(""),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("profiles")
      .update({
        company_kyc_status: data.decision,
        company_kyc_notes: data.notes,
        company_verified: data.decision === "verified",
      } as never)
      .eq("id", data.profile_id);
    if (error) throw new Error(error.message);
    await supabase.from("notifications").insert({
      user_id: data.profile_id,
      type: "kyc_decision",
      title: data.decision === "verified" ? "تم توثيق شركتك ✓" : "تم رفض طلب التوثيق",
      body: data.notes || (data.decision === "verified" ? "مبروك! حسابك الآن موثّق." : "يرجى مراجعة الملاحظات وإعادة الإرسال."),
      link: "/profile",
    });
    return { ok: true };
  });

export const listErrorLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("error_logs")
      .select("id,created_at,message,fn_name,route,severity,user_id")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { logs: data ?? [] };
  });

export const listEscrowHolds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("escrow_holds")
      .select("id,offer_id,payer_id,payee_id,amount_sar,status,held_at,released_at")
      .order("held_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const totals = (data ?? []).reduce(
      (acc: { held: number; released: number; refunded: number }, h: any) => {
        const amt = Number(h.amount_sar ?? 0);
        if (h.status === "held") acc.held += amt;
        else if (h.status === "released") acc.released += amt;
        else if (h.status === "refunded") acc.refunded += amt;
        return acc;
      },
      { held: 0, released: 0, refunded: 0 },
    );
    return { holds: data ?? [], totals };
  });
