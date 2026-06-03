import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const setShipping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      offer_id: z.string().uuid(),
      shipping_carrier: z.string().min(1).max(60),
      tracking_number: z.string().min(3).max(80),
      expected_delivery: z.string().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: offer } = await supabase
      .from("trade_offers").select("from_user,to_user,status").eq("id", data.offer_id).maybeSingle();
    if (!offer) throw new Error("الصفقة غير موجودة");
    if (offer.from_user !== userId && offer.to_user !== userId) throw new Error("غير مصرّح");
    if (offer.status !== "accepted") throw new Error("لا يمكن إضافة شحن إلا بعد قبول العرض");

    const { error } = await supabase
      .from("trade_offers")
      .update({
        shipping_carrier: data.shipping_carrier,
        tracking_number: data.tracking_number,
        expected_delivery: data.expected_delivery || null,
      })
      .eq("id", data.offer_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const confirmDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ offer_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: offer } = await supabase
      .from("trade_offers")
      .select("from_user,to_user,delivery_confirmed_by_from,delivery_confirmed_by_to,status")
      .eq("id", data.offer_id).maybeSingle();
    if (!offer) throw new Error("الصفقة غير موجودة");

    const isFrom = offer.from_user === userId;
    const isTo = offer.to_user === userId;
    if (!isFrom && !isTo) throw new Error("غير مصرّح");

    const updates: Record<string, unknown> = {};
    if (isFrom) updates.delivery_confirmed_by_from = true;
    if (isTo) updates.delivery_confirmed_by_to = true;

    const bothConfirmed =
      (isFrom || offer.delivery_confirmed_by_from) &&
      (isTo || offer.delivery_confirmed_by_to);

    if (bothConfirmed && offer.status === "accepted") {
      updates.status = "completed";
    }

    const { error } = await supabase.from("trade_offers").update(updates as never).eq("id", data.offer_id);
    if (error) throw new Error(error.message);
    return { ok: true, completed: bothConfirmed };
  });
