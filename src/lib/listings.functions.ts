import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase as anonClient } from "@/integrations/supabase/client";

const ConditionEnum = z.enum(["new", "like-new", "excellent", "good", "fair"]);

const ListingInput = z.object({
  title: z.string().min(3).max(120),
  description: z.string().max(2000).optional().default(""),
  category: z.string().min(1).max(60),
  condition: ConditionEnum,
  age_months: z.number().int().min(0).max(360),
  market_price: z.number().positive().max(10_000_000),
  wants: z.string().min(2).max(200),
  images: z.array(z.string().min(1).max(500)).max(8).default([]),
  is_ribawi: z.boolean().default(false),
});

export const listActiveListings = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await anonClient
    .from("listings")
    .select("id,title,category,condition,age_months,market_price,wants,images,status,is_ribawi,created_at,owner_id,profiles:owner_id(display_name,avatar_url,rating)")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) throw new Error(error.message);
  return { listings: data ?? [] };
});

export const getListing = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: listing, error } = await anonClient
      .from("listings")
      .select("*,profiles:owner_id(display_name,avatar_url,rating,trades_count,bio)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { listing };
  });

export const myListings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { listings: data ?? [] };
  });

export const createListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListingInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("listings")
      .insert({ ...data, owner_id: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // Price Oracle auto-alert: warn owner if price deviates >30% from market avg
    try {
      const key = data.title.toLowerCase().trim();
      const { data: history } = await supabase
        .from("price_history")
        .select("price")
        .eq("category", data.category)
        .eq("title_key", key)
        .order("recorded_at", { ascending: false })
        .limit(30);
      const prices = (history ?? []).map((r: any) => Number(r.price)).filter((n) => n > 0);
      if (prices.length >= 3) {
        const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
        const dev = Math.abs(data.market_price - avg) / avg;
        if (dev > 0.3) {
          const direction = data.market_price > avg ? "أعلى" : "أقل";
          await supabase.from("notifications").insert({
            user_id: userId,
            type: "price_alert",
            title: "تنبيه: سعر منتجك خارج المتوسط",
            body: `سعرك (${data.market_price} ر.س) ${direction} من متوسط السوق (${Math.round(avg)} ر.س) بنسبة ${Math.round(dev * 100)}%.`,
            link: `/listings/${row.id}`,
          });
        }
      }
    } catch { /* non-blocking */ }

    return { id: row.id };
  });

export const deleteListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("listings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// مطابقة المقايضة: ابحث عن إعلانات تطابق ما يريده المستخدم
// وتنتمي لأصحاب يبحثون عن ما يملكه المستخدم
export const matchListings = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      have: z.string().trim().min(2).max(200),
      want: z.string().trim().min(2).max(200),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const tokens = (s: string) =>
      s.toLowerCase().split(/[\s,،.\-_/]+/).filter((t) => t.length >= 2).slice(0, 6);
    const wantTokens = tokens(data.want);
    const haveTokens = tokens(data.have);

    // ابحث عن إعلانات تطابق "ما أريد" في العنوان/الفئة
    const wantOr = wantTokens.flatMap((t) => [
      `title.ilike.%${t}%`, `category.ilike.%${t}%`, `description.ilike.%${t}%`,
    ]).join(",");

    const { data: candidates, error } = await anonClient
      .from("listings")
      .select("id,title,category,condition,market_price,wants,images,owner_id,profiles:owner_id(display_name,avatar_url,rating)")
      .eq("status", "active")
      .or(wantOr || "title.ilike.%%")
      .limit(40);
    if (error) throw new Error(error.message);

    // رتّب: ضاعف النقاط إذا كان "wants" الخاص بصاحب الإعلان يطابق "ما أملك"
    const scored = (candidates ?? []).map((l: any) => {
      const wantsLower = (l.wants ?? "").toLowerCase();
      const titleLower = (l.title ?? "").toLowerCase();
      const catLower = (l.category ?? "").toLowerCase();
      const haveMatch = haveTokens.filter((t) => wantsLower.includes(t)).length;
      const wantMatch = wantTokens.filter((t) => titleLower.includes(t) || catLower.includes(t)).length;
      const score = wantMatch * 2 + haveMatch * 3;
      return { ...l, _score: score, _mutual: haveMatch > 0 };
    }).filter((x) => x._score > 0).sort((a, b) => b._score - a._score).slice(0, 12);

    return { matches: scored };
  });
