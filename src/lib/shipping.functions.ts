import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ==========================================================================
 * MOCK SHIPPING PROVIDER — Egypt & Saudi Arabia
 * --------------------------------------------------------------------------
 *  Provider: "BadelShip Sandbox"
 *  - Quotation based on origin/destination city + weight + declared value
 *  - Auto-generates a tracking number on booking
 *  - Emits deterministic tracking events (created → picked_up → in_transit →
 *    out_for_delivery → delivered) based on elapsed time since booking
 *  Replace with real Aramex/SMSA/Bosta API in phase 2.
 * ========================================================================== */

// SAR base pricing; UI converts via LocalPrice.
const CITY_ZONES: Record<string, { country: "SA" | "EG"; zone: number; name_ar: string }> = {
  // Saudi Arabia (SAR base)
  RUH: { country: "SA", zone: 1, name_ar: "الرياض" },
  JED: { country: "SA", zone: 2, name_ar: "جدة" },
  DMM: { country: "SA", zone: 2, name_ar: "الدمام" },
  MKK: { country: "SA", zone: 2, name_ar: "مكة المكرمة" },
  MED: { country: "SA", zone: 2, name_ar: "المدينة المنورة" },
  ABH: { country: "SA", zone: 3, name_ar: "أبها" },
  TBK: { country: "SA", zone: 3, name_ar: "تبوك" },
  // Egypt (EGP → converted via ~ 1 SAR = 13 EGP; we store in SAR)
  CAI: { country: "EG", zone: 1, name_ar: "القاهرة" },
  GIZ: { country: "EG", zone: 1, name_ar: "الجيزة" },
  ALX: { country: "EG", zone: 2, name_ar: "الإسكندرية" },
  MNS: { country: "EG", zone: 2, name_ar: "المنصورة" },
  ASW: { country: "EG", zone: 3, name_ar: "أسوان" },
  LXR: { country: "EG", zone: 3, name_ar: "الأقصر" },
};

export const listShippingCities = createServerFn({ method: "GET" }).handler(async () => {
  return Object.entries(CITY_ZONES).map(([code, v]) => ({ code, ...v }));
});

function calcCost(params: {
  from: string;
  to: string;
  weightKg: number;
  declaredValueSar: number;
}) {
  const from = CITY_ZONES[params.from];
  const to = CITY_ZONES[params.to];
  if (!from || !to) throw new Error("مدينة غير مدعومة");
  if (from.country !== to.country) {
    throw new Error("الشحن الدولي غير مفعّل — الإطلاق الحالي لمصر والسعودية فقط داخل نفس البلد.");
  }
  const kg = Math.max(0.5, params.weightKg);
  const perKg = from.country === "SA" ? 6.5 : 3.2; // SAR/kg (EG base cheaper)
  const base = from.country === "SA" ? 22 : 12; // SAR
  const zoneDiff = Math.abs(from.zone - to.zone);
  const zoneFee = zoneDiff * (from.country === "SA" ? 10 : 5);
  const sameCity = from === to;
  const intercityFee = sameCity ? 0 : from.country === "SA" ? 15 : 8;
  const insurance = Math.min(50, params.declaredValueSar * 0.005); // 0.5% cap 50
  const subtotal = base + perKg * kg + zoneFee + intercityFee + insurance;
  const vat = from.country === "SA" ? subtotal * 0.15 : subtotal * 0.14;
  const total = Math.round((subtotal + vat) * 100) / 100;
  const etaHours = sameCity ? 24 : from.country === "SA" ? 48 : 72;
  return {
    provider: "BadelShip Sandbox",
    country: from.country,
    from_city: from.name_ar,
    to_city: to.name_ar,
    base_sar: Math.round(base * 100) / 100,
    per_kg_sar: perKg,
    zone_fee_sar: zoneFee,
    intercity_fee_sar: intercityFee,
    insurance_sar: Math.round(insurance * 100) / 100,
    vat_sar: Math.round(vat * 100) / 100,
    total_sar: total,
    eta_hours: etaHours,
    weight_kg: kg,
  };
}

export const quoteShipping = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      from_city: z.string().min(2).max(8),
      to_city: z.string().min(2).max(8),
      weight_kg: z.number().min(0.1).max(200),
      declared_value_sar: z.number().min(0).max(500000),
    }).parse(i),
  )
  .handler(async ({ data }) =>
    calcCost({
      from: data.from_city,
      to: data.to_city,
      weightKg: data.weight_kg,
      declaredValueSar: data.declared_value_sar,
    }),
  );

function genTracking(country: "SA" | "EG") {
  const prefix = country === "SA" ? "BSA" : "BEG";
  const n = Math.floor(Math.random() * 9_000_000_000) + 1_000_000_000;
  return `${prefix}${n}`;
}

export const bookShipment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      offer_id: z.string().uuid(),
      from_city: z.string().min(2).max(8),
      to_city: z.string().min(2).max(8),
      weight_kg: z.number().min(0.1).max(200),
      declared_value_sar: z.number().min(0).max(500000),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: offer } = await supabase
      .from("trade_offers")
      .select("from_user,to_user,status,tracking_number")
      .eq("id", data.offer_id)
      .maybeSingle();
    if (!offer) throw new Error("الصفقة غير موجودة");
    if (offer.from_user !== userId && offer.to_user !== userId) throw new Error("غير مصرّح");
    if (offer.status !== "accepted") throw new Error("لا يمكن حجز الشحن إلا بعد قبول العرض");
    if (offer.tracking_number) throw new Error("تم حجز الشحن مسبقاً لهذه الصفقة");

    const quote = calcCost({
      from: data.from_city,
      to: data.to_city,
      weightKg: data.weight_kg,
      declaredValueSar: data.declared_value_sar,
    });
    const tracking = genTracking(quote.country);
    const bookedAt = new Date();
    const expected = new Date(bookedAt.getTime() + quote.eta_hours * 3600 * 1000)
      .toISOString().slice(0, 10);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: upErr } = await supabaseAdmin
      .from("trade_offers")
      .update({
        shipping_carrier: quote.provider,
        shipping_provider: quote.provider,
        tracking_number: tracking,
        expected_delivery: expected,
        shipment_weight_kg: quote.weight_kg,
        from_city: quote.from_city,
        to_city: quote.to_city,
        country_code: quote.country,
        shipping_cost_sar: quote.total_sar,
        shipment_booked_at: bookedAt.toISOString(),
      } as never)
      .eq("id", data.offer_id);
    if (upErr) throw new Error(upErr.message);

    await supabaseAdmin.from("shipment_events").insert({
      offer_id: data.offer_id,
      status: "created",
      description: `تم إنشاء الشحنة عبر ${quote.provider}`,
      location: quote.from_city,
      event_at: bookedAt.toISOString(),
    } as never);

    return { ok: true, tracking_number: tracking, quote, expected_delivery: expected };
  });

/** Deterministic mock progression based on elapsed time since booking. */
function computeSyntheticEvents(bookedAt: string, etaHours: number, from: string, to: string) {
  const start = new Date(bookedAt).getTime();
  const now = Date.now();
  const elapsedH = (now - start) / 3_600_000;
  const p = Math.min(1, elapsedH / etaHours);
  const steps: Array<{ status: string; label: string; at: number; loc: string }> = [
    { status: "created", label: "تم إنشاء الشحنة", at: 0.0, loc: from },
    { status: "picked_up", label: "استُلمت الشحنة من المرسِل", at: 0.12, loc: from },
    { status: "in_transit", label: "في مركز الفرز", at: 0.35, loc: from },
    { status: "in_transit_out", label: "في الطريق إلى مدينة الوجهة", at: 0.55, loc: `${from} → ${to}` },
    { status: "out_for_delivery", label: "خرجت للتسليم", at: 0.85, loc: to },
    { status: "delivered", label: "تم التسليم للمستلم", at: 1.0, loc: to },
  ];
  return steps
    .filter((s) => s.at <= p)
    .map((s) => ({
      status: s.status,
      description: s.label,
      location: s.loc,
      event_at: new Date(start + s.at * etaHours * 3_600_000).toISOString(),
    }));
}

export const getShipmentTracking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ offer_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: offer } = await supabase
      .from("trade_offers")
      .select("from_user,to_user,tracking_number,shipment_booked_at,expected_delivery,from_city,to_city,country_code,shipping_cost_sar,shipment_weight_kg,shipping_provider")
      .eq("id", data.offer_id)
      .maybeSingle();
    if (!offer) throw new Error("الصفقة غير موجودة");
    if (offer.from_user !== userId && offer.to_user !== userId) throw new Error("غير مصرّح");
    if (!offer.tracking_number || !offer.shipment_booked_at) {
      return { tracking_number: null, events: [], offer };
    }
    const etaHours = offer.expected_delivery
      ? Math.max(
          12,
          (new Date(offer.expected_delivery).getTime() -
            new Date(offer.shipment_booked_at).getTime()) / 3_600_000,
        )
      : 48;
    const events = computeSyntheticEvents(
      offer.shipment_booked_at,
      etaHours,
      offer.from_city ?? "—",
      offer.to_city ?? "—",
    );
    return { tracking_number: offer.tracking_number, events, offer };
  });
