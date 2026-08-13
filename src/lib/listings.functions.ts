import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase as anonClient } from "@/integrations/supabase/client";
import { checkHaram } from "./haram-filter";
import { arNormalize, arTokens } from "./ar-normalize";

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
  city: z.string().trim().min(2).max(60).optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
  listing_type: z.enum(["item", "service"]).optional().default("item"),
  image_hashes: z.array(z.string().regex(/^[0-9a-f]{16}$/)).max(8).optional().default([]),
});

export const listActiveListings = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await anonClient
    .from("listings")
    .select("id,title,category,condition,age_months,market_price,wants,images,status,is_ribawi,created_at,owner_id,city,listing_type,profiles:owner_id(display_name,avatar_url,rating,trades_count)")
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

    const { enforceRateLimit } = await import("./rate-limit.server");
    await enforceRateLimit(userId, { action: "create_listing", limit: 15, windowSec: 3600 });


    // فحص شرعي/قانوني للسلع المحرّمة قبل الإدراج
    const haram = checkHaram({
      title: data.title,
      description: data.description,
      category: data.category,
      wants: data.wants,
    });
    if (!haram.allowed) {
      throw new Error(
        `لا يمكن نشر هذا الإعلان — تصنيف محظور: ${haram.category}. ${haram.reason}`,
      );
    }

    // كشف الاحتيال (المرحلة 1): صور مكرّرة عبر الحسابات + سقف قيمة حسب الثقة
    const { screenImageHashes, persistImageHashes, enforceTrustValueCap } = await import("./fraud.server");
    const { image_hashes: imageHashes, ...listingFields } = data;
    const screen = await screenImageHashes(userId, imageHashes);
    if (screen.blocked) throw new Error(screen.reason ?? "🚫 تعذّر نشر الإعلان لأسباب أمنية.");
    await enforceTrustValueCap(userId, data.market_price);

    // تقييد السعر بمرجع Fair Market Value وتسجيل مصدر السعر
    const { resolveFmvReference, applyFmvGuard } = await import("./fmv.server");
    const { reference, refSource } = await resolveFmvReference(supabase as never, {
      category: data.category,
      title: data.title,
    });
    const fmv = applyFmvGuard(data.market_price, reference);

    const { data: row, error } = await supabase
      .from("listings")
      .insert({
        ...listingFields,
        market_price: fmv.price,
        price_input_sar: fmv.input,
        price_reference_sar: fmv.reference,
        price_source: fmv.source,
        price_deviation_pct: fmv.deviationPct,
        owner_id: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await persistImageHashes(row.id, userId, imageHashes);

    // إشعار المالك عند تعديل السعر أو انحرافه الكبير عن المرجع
    try {
      if (fmv.clamped) {
        await supabase.from("notifications").insert({
          user_id: userId,
          type: "price_alert",
          title: "تم تعديل سعر إعلانك وفق مرجع السوق",
          body: fmv.note,
          link: `/listings/${row.id}`,
        });
      } else if (fmv.deviationPct !== null && Math.abs(fmv.deviationPct) > 30) {
        const direction = fmv.deviationPct > 0 ? "أعلى" : "أقل";
        await supabase.from("notifications").insert({
          user_id: userId,
          type: "price_alert",
          title: "تنبيه: سعر منتجك خارج المتوسط",
          body: `سعرك (${fmv.price} ر.س) ${direction} من مرجع السوق (${fmv.reference} ر.س) بنسبة ${Math.abs(fmv.deviationPct)}% (المصدر: ${refSource}).`,
          link: `/listings/${row.id}`,
        });
      }
    } catch { /* non-blocking */ }

    return { id: row.id, price: fmv.price, priceSource: fmv.source, reference: fmv.reference, note: fmv.note };
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
    const wantTokens = arTokens(data.want);
    const haveTokens = arTokens(data.have);

    // بحث مُطبَّع عربياً على مستوى قاعدة البيانات (pg_trgm)
    const { data: rpcRows, error: rpcErr } = await (anonClient as any).rpc("search_listings_ar", {
      _q: data.want,
      _limit: 40,
    });
    if (rpcErr) throw new Error(rpcErr.message);
    const ids = ((rpcRows ?? []) as Array<{ id: string }>).map((r) => r.id);
    if (ids.length === 0) return { matches: [] as any[] };

    const { data: candidates, error } = await anonClient
      .from("listings")
      .select("id,title,category,condition,market_price,wants,images,owner_id,city,profiles:owner_id(display_name,avatar_url,rating,trades_count)")
      .in("id", ids);
    if (error) throw new Error(error.message);

    // رتّب: ضاعف النقاط إذا كان "wants" الخاص بصاحب الإعلان يطابق "ما أملك"
    const scored = (candidates ?? []).map((l: any) => {
      const wantsNorm = arNormalize(l.wants ?? "");
      const titleNorm = arNormalize(l.title ?? "");
      const catNorm = arNormalize(l.category ?? "");
      const haveMatch = haveTokens.filter((t) => wantsNorm.includes(t)).length;
      const wantMatch = wantTokens.filter((t) => titleNorm.includes(t) || catNorm.includes(t)).length;
      const rank = Math.max(0, ids.length - ids.indexOf(l.id)) / Math.max(1, ids.length);
      const score = wantMatch * 2 + haveMatch * 3 + rank;
      return { ...l, _score: score, _mutual: haveMatch > 0 };
    }).sort((a, b) => b._score - a._score).slice(0, 12);

    return { matches: scored };
  });
