import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase as anonClient } from "@/integrations/supabase/client";
import { quickShariahCheckByText } from "@/lib/pricing.functions";

const CreateOfferInput = z.object({
  requested_listing: z.string().uuid(),
  offered_listing: z.string().uuid(),
  message: z.string().max(1000).optional().default(""),
  cash_balance: z.number().min(0).max(10_000_000).default(0),
  fairness_score: z.number().int().min(0).max(100).optional(),
});

export const createOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CreateOfferInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { enforceRateLimit } = await import("@/lib/rate-limit.server");
    await enforceRateLimit(userId, { action: "create_offer", limit: 10, windowSec: 600 });

    // التحقق من أن العرض المطلوب موجود ومن مالك آخر
    const { data: requested, error: e1 } = await supabase
      .from("listings")
      .select("id,owner_id,status,title,category")
      .eq("id", data.requested_listing)
      .maybeSingle();
    if (e1 || !requested) throw new Error("العرض المطلوب غير موجود");
    if (requested.owner_id === userId) throw new Error("لا يمكنك مقايضة عرضك نفسه");
    if (requested.status !== "active") throw new Error("العرض غير متاح");

    // التحقق من ملكية العرض المعروض
    const { data: offered, error: e2 } = await supabase
      .from("listings")
      .select("id,owner_id,title,category")
      .eq("id", data.offered_listing)
      .maybeSingle();
    if (e2 || !offered) throw new Error("عرضك غير موجود");
    if (offered.owner_id !== userId) throw new Error("لا تملك هذا العرض");

    // الوضع الشرعي مُفعّل تلقائياً لكل المعاملات
    const shariah = quickShariahCheckByText(
      { title: offered.title, category: offered.category },
      { title: requested.title, category: requested.category },
      data.cash_balance,
    );
    if (shariah.level === "forbidden") {
      throw new Error(`🚫 معاملة غير شرعية — ${shariah.rule}`);
    }
    // قاعدة إضافية: أي صنف ربوي + فرق نقدي = نسيئة محتملة، يُرفض
    if ((shariah.ribawiA || shariah.ribawiB) && data.cash_balance > 0) {
      throw new Error(
        "🚫 لا يجوز إضافة فرق نقدي عند وجود صنف ربوي (ذهب/فضة/نقد) — راجع سياسة مكافحة الربا.",
      );
    }



    const { data: row, error } = await supabase
      .from("trade_offers")
      .insert({
        requested_listing: data.requested_listing,
        offered_listing: data.offered_listing,
        from_user: userId,
        to_user: requested.owner_id,
        message: data.message,
        cash_balance: data.cash_balance,
        fairness_score: data.fairness_score ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const listMyOffers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("trade_offers")
      .select(`
        *,
        requested:requested_listing(id,title,images,market_price),
        offered:offered_listing(id,title,images,market_price)
      `)
      .or(`from_user.eq.${userId},to_user.eq.${userId}`)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { offers: data ?? [], userId };
  });

export const getOffer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: offer, error } = await supabase
      .from("trade_offers")
      .select(`
        *,
        requested:requested_listing(id,title,images,market_price,owner_id),
        offered:offered_listing(id,title,images,market_price,owner_id),
        from_profile:from_user(display_name,avatar_url,rating),
        to_profile:to_user(display_name,avatar_url,rating)
      `)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!offer) throw new Error("العرض غير موجود");

    const { data: msgs } = await supabase
      .from("messages")
      .select("id,sender_id,body,created_at")
      .eq("offer_id", data.id)
      .order("created_at", { ascending: true });

    const { data: review } = await supabase
      .from("reviews")
      .select("id,rating,comment")
      .eq("offer_id", data.id)
      .eq("reviewer_id", userId)
      .maybeSingle();

    return { offer, messages: msgs ?? [], userId, myReview: review };
  });

export const respondToOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      action: z.enum(["accept", "reject", "complete", "cancel"]),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: offer } = await supabase
      .from("trade_offers")
      .select("id,from_user,to_user,status")
      .eq("id", data.id)
      .maybeSingle();
    if (!offer) throw new Error("العرض غير موجود");

    const isReceiver = offer.to_user === userId;
    const isSender = offer.from_user === userId;
    if (!isReceiver && !isSender) throw new Error("غير مصرّح");

    type OfferStatus = "pending" | "accepted" | "rejected" | "cancelled" | "completed";
    let nextStatus: OfferStatus;
    if (data.action === "accept" && isReceiver) nextStatus = "accepted";
    else if (data.action === "reject" && isReceiver) nextStatus = "rejected";
    else if (data.action === "cancel" && isSender) nextStatus = "cancelled";
    else if (data.action === "complete" && offer.status === "accepted") nextStatus = "completed";
    else throw new Error("إجراء غير مسموح");

    const { error } = await supabase
      .from("trade_offers")
      .update({ status: nextStatus })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, status: nextStatus };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      offer_id: z.string().uuid(),
      body: z.string().min(1).max(2000),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("messages").insert({
      offer_id: data.offer_id,
      sender_id: userId,
      body: data.body,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const submitReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      offer_id: z.string().uuid(),
      reviewed_user: z.string().uuid(),
      rating: z.number().int().min(1).max(5),
      comment: z.string().max(500).optional().default(""),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("reviews").insert({
      offer_id: data.offer_id,
      reviewer_id: userId,
      reviewed_user: data.reviewed_user,
      rating: data.rating,
      comment: data.comment,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyListingsForOffer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("listings")
      .select("id,title,images,market_price")
      .eq("owner_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { listings: data ?? [] };
  });

export const getListingForOffer = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { data: listing, error } = await anonClient
      .from("listings")
      .select("id,title,images,market_price,owner_id,profiles:owner_id(display_name)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { listing };
  });
