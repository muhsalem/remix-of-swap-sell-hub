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

export const adminListListings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        status: z.enum(["all", "active", "pending", "traded", "closed"]).default("all"),
        q: z.string().trim().max(80).optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    let query = supabase
      .from("listings")
      .select(
        "id,title,description,category,condition,market_price,age_months,area_sqm,status,images,city,listing_type,owner_id,is_featured,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(300);

    if (data.status !== "all") query = query.eq("status", data.status);
    if (data.q) query = query.ilike("title", `%${data.q}%`);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    const listings = rows ?? [];

    const ownerIds = [...new Set(listings.map((l: any) => l.owner_id))] as string[];
    const { data: profiles } = ownerIds.length
      ? await supabase.from("profiles").select("id,display_name,is_suspended").in("id", ownerIds)
      : { data: [] as any[] };
    const pMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    return {
      listings: listings.map((l: any) => ({ ...l, owner: pMap.get(l.owner_id) ?? null })),
      counts: {
        total: listings.length,
        active: listings.filter((l: any) => l.status === "active").length,
      },
    };
  });

export const adminUpdateListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().trim().min(3).max(120).optional(),
        description: z.string().trim().max(2000).optional(),
        category: z.string().trim().min(1).max(60).optional(),
        city: z.string().trim().max(60).optional(),
        market_price: z.number().positive().max(10_000_000).optional(),
        age_months: z.number().int().min(0).max(1200).optional(),
        area_sqm: z.number().positive().max(1_000_000).optional(),
        status: z.enum(["active", "pending", "traded", "closed"]).optional(),
        is_featured: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { id, ...patch } = data;
    const updates = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (Object.keys(updates).length === 0) throw new Error("لا توجد تغييرات");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("listings").update(updates as never).eq("id", id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      action: "admin_update_listing",
      entity_type: "listing",
      entity_id: id,
      metadata: updates,
    } as never);

    return { ok: true };
  });

export const adminDeleteListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), reason: z.string().trim().max(300).optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("listings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      action: "admin_delete_listing",
      entity_type: "listing",
      entity_id: data.id,
      metadata: { reason: data.reason ?? null },
    } as never);

    return { ok: true };
  });
