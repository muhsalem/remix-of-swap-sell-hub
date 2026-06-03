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
