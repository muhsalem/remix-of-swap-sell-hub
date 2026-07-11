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
      .select("id,display_name,company_name,company_kyc_status,created_at,profiles_private(commercial_register,company_kyc_doc_url,company_kyc_notes)")
      .eq("account_type", "company")
      .in("company_kyc_status", ["pending", "rejected"])
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    // Flatten the private-data embed so the admin UI keeps its flat shape
    const profiles = (data ?? []).map((row: any) => {
      const { profiles_private, ...rest } = row;
      const priv = Array.isArray(profiles_private) ? profiles_private[0] : profiles_private;
      return { ...rest, ...(priv ?? {}) };
    });
    return { profiles };
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
    // Privileged columns (company_kyc_status, company_verified) are locked at the
    // grant level to the user role — use admin client to write them.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        company_kyc_status: data.decision,
        company_verified: data.decision === "verified",
      } as never)
      .eq("id", data.profile_id);
    if (error) throw new Error(error.message);
    const { error: privErr } = await supabaseAdmin
      .from("profiles_private")
      .upsert({ user_id: data.profile_id, company_kyc_notes: data.notes } as never, { onConflict: "user_id" });
    if (privErr) throw new Error(privErr.message);
    await supabaseAdmin.from("notifications").insert({
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

export const getFinanceMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const now = Date.now();
    const d30 = new Date(now - 30 * 24 * 3600 * 1000).toISOString();
    const d60 = new Date(now - 60 * 24 * 3600 * 1000).toISOString();

    const [{ data: subs }, { data: fees }, { data: completed }, { data: allOffers }, { data: disputes }] = await Promise.all([
      supabase.from("subscriptions").select("tier,status,price_sar,started_at,canceled_at,renews_at"),
      supabase.from("platform_fees").select("amount_sar,status,paid_at,created_at"),
      supabase.from("trade_offers").select("cash_balance,updated_at,created_at").eq("status", "completed"),
      supabase.from("trade_offers").select("id,status,created_at"),
      supabase.from("disputes").select("status,created_at,updated_at"),
    ]);

    // MRR — active subscriptions monthly price
    const activeSubs = (subs ?? []).filter((s: any) => s.status === "active");
    const mrr = activeSubs.reduce((sum: number, s: any) => sum + Number(s.price_sar ?? 0), 0);
    const merchantSubs = activeSubs.filter((s: any) => s.tier === "merchant").length;
    const storeSubs = activeSubs.filter((s: any) => s.tier === "store").length;

    // GMV
    const gmvAll = (completed ?? []).reduce((s: number, o: any) => s + Number(o.cash_balance ?? 0), 0);
    const gmv30 = (completed ?? []).filter((o: any) => o.updated_at >= d30).reduce((s: number, o: any) => s + Number(o.cash_balance ?? 0), 0);
    const gmvPrev30 = (completed ?? []).filter((o: any) => o.updated_at >= d60 && o.updated_at < d30).reduce((s: number, o: any) => s + Number(o.cash_balance ?? 0), 0);
    const gmvGrowth = gmvPrev30 > 0 ? Math.round(((gmv30 - gmvPrev30) / gmvPrev30) * 100) : null;

    // Fees / take rate
    const feesAll = (fees ?? []).reduce((s: number, f: any) => s + Number(f.amount_sar ?? 0), 0);
    const feesPaid = (fees ?? []).filter((f: any) => f.status === "paid").reduce((s: number, f: any) => s + Number(f.amount_sar ?? 0), 0);
    const feesDue = (fees ?? []).filter((f: any) => f.status === "due").reduce((s: number, f: any) => s + Number(f.amount_sar ?? 0), 0);
    const fees30 = (fees ?? []).filter((f: any) => f.status === "paid" && f.paid_at && f.paid_at >= d30).reduce((s: number, f: any) => s + Number(f.amount_sar ?? 0), 0);
    const takeRate = gmvAll > 0 ? +((feesAll / gmvAll) * 100).toFixed(2) : 0;
    const takeRate30 = gmv30 > 0 ? +((fees30 / gmv30) * 100).toFixed(2) : 0;

    // Disputes
    const dOpen = (disputes ?? []).filter((d: any) => d.status === "open").length;
    const dResolved = (disputes ?? []).filter((d: any) => d.status === "resolved").length;
    const dRejected = (disputes ?? []).filter((d: any) => d.status === "rejected").length;
    const closed = (disputes ?? []).filter((d: any) => d.status !== "open" && d.updated_at && d.created_at);
    const avgResolutionHrs = closed.length
      ? Math.round(
          closed.reduce((sum: number, d: any) => sum + (new Date(d.updated_at).getTime() - new Date(d.created_at).getTime()), 0)
            / closed.length / 3600000
        )
      : 0;
    const offersCount = allOffers?.length ?? 0;
    const disputeRate = offersCount > 0 ? +(((disputes?.length ?? 0) / offersCount) * 100).toFixed(2) : 0;

    // Daily trend last 30d
    const trend: { date: string; gmv: number; fees: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const day = new Date(now - i * 24 * 3600 * 1000);
      const key = day.toISOString().slice(0, 10);
      const dayGmv = (completed ?? []).filter((o: any) => o.updated_at?.slice(0, 10) === key).reduce((s: number, o: any) => s + Number(o.cash_balance ?? 0), 0);
      const dayFees = (fees ?? []).filter((f: any) => f.paid_at?.slice(0, 10) === key).reduce((s: number, f: any) => s + Number(f.amount_sar ?? 0), 0);
      trend.push({ date: key, gmv: Math.round(dayGmv), fees: Math.round(dayFees) });
    }

    return {
      mrr: Math.round(mrr),
      arr: Math.round(mrr * 12),
      activeSubs: activeSubs.length,
      merchantSubs,
      storeSubs,
      gmvAll: Math.round(gmvAll),
      gmv30: Math.round(gmv30),
      gmvGrowth,
      feesAll: Math.round(feesAll),
      feesPaid: Math.round(feesPaid),
      feesDue: Math.round(feesDue),
      fees30: Math.round(fees30),
      takeRate,
      takeRate30,
      disputes: {
        open: dOpen,
        resolved: dResolved,
        rejected: dRejected,
        total: disputes?.length ?? 0,
        avgResolutionHrs,
        disputeRate,
      },
      trend,
    };
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
