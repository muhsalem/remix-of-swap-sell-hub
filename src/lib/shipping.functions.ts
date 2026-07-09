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
const CITY_ZONES: Record<string, { country: "SA" | "EG"; zone: number; name_ar: string; region_ar: string }> = {
  // ═══════════════ SAUDI ARABIA — 13 مناطق إدارية ═══════════════
  // Zone 1 = مركزية (الرياض)، Zone 2 = مدن رئيسية، Zone 3 = أطراف
  // منطقة الرياض
  RUH: { country: "SA", zone: 1, name_ar: "الرياض", region_ar: "الرياض" },
  DIR: { country: "SA", zone: 2, name_ar: "الدرعية", region_ar: "الرياض" },
  KHR: { country: "SA", zone: 2, name_ar: "الخرج", region_ar: "الرياض" },
  MJM: { country: "SA", zone: 3, name_ar: "المجمعة", region_ar: "الرياض" },
  DWD: { country: "SA", zone: 3, name_ar: "الدوادمي", region_ar: "الرياض" },
  // منطقة مكة المكرمة
  MKK: { country: "SA", zone: 2, name_ar: "مكة المكرمة", region_ar: "مكة المكرمة" },
  JED: { country: "SA", zone: 2, name_ar: "جدة", region_ar: "مكة المكرمة" },
  TIF: { country: "SA", zone: 2, name_ar: "الطائف", region_ar: "مكة المكرمة" },
  RAB: { country: "SA", zone: 3, name_ar: "رابغ", region_ar: "مكة المكرمة" },
  QUN: { country: "SA", zone: 3, name_ar: "القنفذة", region_ar: "مكة المكرمة" },
  // منطقة المدينة المنورة
  MED: { country: "SA", zone: 2, name_ar: "المدينة المنورة", region_ar: "المدينة المنورة" },
  YNB: { country: "SA", zone: 3, name_ar: "ينبع", region_ar: "المدينة المنورة" },
  ULA: { country: "SA", zone: 3, name_ar: "العُلا", region_ar: "المدينة المنورة" },
  BDR: { country: "SA", zone: 3, name_ar: "بدر", region_ar: "المدينة المنورة" },
  // المنطقة الشرقية
  DMM: { country: "SA", zone: 2, name_ar: "الدمام", region_ar: "الشرقية" },
  KHO: { country: "SA", zone: 2, name_ar: "الخبر", region_ar: "الشرقية" },
  DHR: { country: "SA", zone: 2, name_ar: "الظهران", region_ar: "الشرقية" },
  JUB: { country: "SA", zone: 3, name_ar: "الجبيل", region_ar: "الشرقية" },
  AHS: { country: "SA", zone: 3, name_ar: "الأحساء", region_ar: "الشرقية" },
  QTF: { country: "SA", zone: 3, name_ar: "القطيف", region_ar: "الشرقية" },
  HFR: { country: "SA", zone: 3, name_ar: "حفر الباطن", region_ar: "الشرقية" },
  // منطقة القصيم
  BUR: { country: "SA", zone: 3, name_ar: "بريدة", region_ar: "القصيم" },
  UNZ: { country: "SA", zone: 3, name_ar: "عنيزة", region_ar: "القصيم" },
  RSS: { country: "SA", zone: 3, name_ar: "الرس", region_ar: "القصيم" },
  // منطقة عسير
  ABH: { country: "SA", zone: 3, name_ar: "أبها", region_ar: "عسير" },
  KMS: { country: "SA", zone: 3, name_ar: "خميس مشيط", region_ar: "عسير" },
  NMS: { country: "SA", zone: 3, name_ar: "النماص", region_ar: "عسير" },
  BSH: { country: "SA", zone: 3, name_ar: "بيشة", region_ar: "عسير" },
  // منطقة تبوك
  TBK: { country: "SA", zone: 3, name_ar: "تبوك", region_ar: "تبوك" },
  DBA: { country: "SA", zone: 3, name_ar: "ضباء", region_ar: "تبوك" },
  NEO: { country: "SA", zone: 3, name_ar: "نيوم", region_ar: "تبوك" },
  // منطقة حائل
  HAL: { country: "SA", zone: 3, name_ar: "حائل", region_ar: "حائل" },
  BQA: { country: "SA", zone: 3, name_ar: "بقعاء", region_ar: "حائل" },
  // منطقة الحدود الشمالية
  ARR: { country: "SA", zone: 3, name_ar: "عرعر", region_ar: "الحدود الشمالية" },
  RFH: { country: "SA", zone: 3, name_ar: "رفحاء", region_ar: "الحدود الشمالية" },
  // منطقة جازان
  JZN: { country: "SA", zone: 3, name_ar: "جازان", region_ar: "جازان" },
  SBY: { country: "SA", zone: 3, name_ar: "صبيا", region_ar: "جازان" },
  // منطقة نجران
  NJR: { country: "SA", zone: 3, name_ar: "نجران", region_ar: "نجران" },
  SHR: { country: "SA", zone: 3, name_ar: "شرورة", region_ar: "نجران" },
  // منطقة الباحة
  BHA: { country: "SA", zone: 3, name_ar: "الباحة", region_ar: "الباحة" },
  BLJ: { country: "SA", zone: 3, name_ar: "بلجرشي", region_ar: "الباحة" },
  // منطقة الجوف
  SKK: { country: "SA", zone: 3, name_ar: "سكاكا", region_ar: "الجوف" },
  QRT: { country: "SA", zone: 3, name_ar: "القريات", region_ar: "الجوف" },

  // ═══════════════ EGYPT — 27 محافظة ═══════════════
  // القاهرة الكبرى (Zone 1)
  CAI: { country: "EG", zone: 1, name_ar: "القاهرة", region_ar: "القاهرة" },
  GIZ: { country: "EG", zone: 1, name_ar: "الجيزة", region_ar: "الجيزة" },
  QLY: { country: "EG", zone: 1, name_ar: "بنها", region_ar: "القليوبية" },
  SXO: { country: "EG", zone: 1, name_ar: "السادس من أكتوبر", region_ar: "الجيزة" },
  // الإسكندرية والدلتا (Zone 2)
  ALX: { country: "EG", zone: 2, name_ar: "الإسكندرية", region_ar: "الإسكندرية" },
  MNS: { country: "EG", zone: 2, name_ar: "المنصورة", region_ar: "الدقهلية" },
  TNT: { country: "EG", zone: 2, name_ar: "طنطا", region_ar: "الغربية" },
  MHL: { country: "EG", zone: 2, name_ar: "المحلة الكبرى", region_ar: "الغربية" },
  ZAG: { country: "EG", zone: 2, name_ar: "الزقازيق", region_ar: "الشرقية" },
  DAM: { country: "EG", zone: 2, name_ar: "دمنهور", region_ar: "البحيرة" },
  KFS: { country: "EG", zone: 2, name_ar: "كفر الشيخ", region_ar: "كفر الشيخ" },
  SHB: { country: "EG", zone: 2, name_ar: "شبين الكوم", region_ar: "المنوفية" },
  DMT: { country: "EG", zone: 2, name_ar: "دمياط", region_ar: "دمياط" },
  // قناة السويس (Zone 2)
  PSD: { country: "EG", zone: 2, name_ar: "بورسعيد", region_ar: "بورسعيد" },
  ISM: { country: "EG", zone: 2, name_ar: "الإسماعيلية", region_ar: "الإسماعيلية" },
  SUZ: { country: "EG", zone: 2, name_ar: "السويس", region_ar: "السويس" },
  // سيناء (Zone 3)
  ARS: { country: "EG", zone: 3, name_ar: "العريش", region_ar: "شمال سيناء" },
  SSH: { country: "EG", zone: 3, name_ar: "شرم الشيخ", region_ar: "جنوب سيناء" },
  // الصعيد (Zone 3)
  BNS: { country: "EG", zone: 3, name_ar: "بني سويف", region_ar: "بني سويف" },
  FYM: { country: "EG", zone: 3, name_ar: "الفيوم", region_ar: "الفيوم" },
  MNY: { country: "EG", zone: 3, name_ar: "المنيا", region_ar: "المنيا" },
  ASY: { country: "EG", zone: 3, name_ar: "أسيوط", region_ar: "أسيوط" },
  SHG: { country: "EG", zone: 3, name_ar: "سوهاج", region_ar: "سوهاج" },
  QNA: { country: "EG", zone: 3, name_ar: "قنا", region_ar: "قنا" },
  LXR: { country: "EG", zone: 3, name_ar: "الأقصر", region_ar: "الأقصر" },
  ASW: { country: "EG", zone: 3, name_ar: "أسوان", region_ar: "أسوان" },
  // البحر الأحمر والصحراء (Zone 3)
  HRG: { country: "EG", zone: 3, name_ar: "الغردقة", region_ar: "البحر الأحمر" },
  KHA: { country: "EG", zone: 3, name_ar: "الخارجة", region_ar: "الوادي الجديد" },
  MRS: { country: "EG", zone: 3, name_ar: "مرسى مطروح", region_ar: "مطروح" },
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
