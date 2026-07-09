import { describe, it, expect } from "vitest";
import { calcCostSync, CITY_ZONES_FALLBACK as ZONES } from "./shipping.functions";

const codes = Object.keys(ZONES);
const saCodes = codes.filter((c) => ZONES[c].country === "SA");
const egCodes = codes.filter((c) => ZONES[c].country === "EG");

describe("Shipping coverage — every city has a valid zone", () => {
  it("SA + EG cities are both populated", () => {
    expect(saCodes.length).toBeGreaterThanOrEqual(40);
    expect(egCodes.length).toBeGreaterThanOrEqual(27);
  });

  it.each(codes)("%s has a valid country/zone/region/name", (code) => {
    const z = ZONES[code];
    expect(["SA", "EG"]).toContain(z.country);
    expect(z.zone).toBeGreaterThanOrEqual(1);
    expect(z.zone).toBeLessThanOrEqual(5);
    expect(z.name_ar.length).toBeGreaterThan(0);
    expect(z.region_ar.length).toBeGreaterThan(0);
  });
});

describe("Pricing — every city can quote to its country capital", () => {
  it.each(saCodes)("SA: %s → RUH quotes a positive total with 15%% VAT", (code) => {
    const q = calcCostSync(ZONES, { from: code, to: "RUH", weightKg: 2, declaredValueSar: 1000 });
    expect(q.country).toBe("SA");
    expect(q.total_sar).toBeGreaterThan(0);
    const subtotal = q.base_sar + q.per_kg_sar * q.weight_kg + q.zone_fee_sar + q.intercity_fee_sar + q.insurance_sar;
    expect(q.vat_sar).toBeCloseTo(Math.round(subtotal * 0.15 * 100) / 100, 1);
  });

  it.each(egCodes)("EG: %s → CAI quotes a positive total with 14%% VAT", (code) => {
    const q = calcCostSync(ZONES, { from: code, to: "CAI", weightKg: 2, declaredValueSar: 1000 });
    expect(q.country).toBe("EG");
    expect(q.total_sar).toBeGreaterThan(0);
    const subtotal = q.base_sar + q.per_kg_sar * q.weight_kg + q.zone_fee_sar + q.intercity_fee_sar + q.insurance_sar;
    expect(q.vat_sar).toBeCloseTo(Math.round(subtotal * 0.14 * 100) / 100, 1);
  });
});

describe("Zone/intercity fee rules", () => {
  it("same-city (RUH→RUH) has no intercity fee and no zone diff", () => {
    const q = calcCostSync(ZONES, { from: "RUH", to: "RUH", weightKg: 1, declaredValueSar: 500 });
    expect(q.intercity_fee_sar).toBe(0);
    expect(q.zone_fee_sar).toBe(0);
    expect(q.eta_hours).toBe(24);
  });

  it("SA intercity charges 15 SAR + 10 SAR per zone step (RUH z1 → ABH z3 = 15+20)", () => {
    const q = calcCostSync(ZONES, { from: "RUH", to: "ABH", weightKg: 1, declaredValueSar: 100 });
    expect(q.intercity_fee_sar).toBe(15);
    expect(q.zone_fee_sar).toBe(20);
  });

  it("EG intercity charges 8 EGP-equivalent + 5 per zone step (CAI z1 → ASW z3 = 8+10)", () => {
    const q = calcCostSync(ZONES, { from: "CAI", to: "ASW", weightKg: 1, declaredValueSar: 100 });
    expect(q.intercity_fee_sar).toBe(8);
    expect(q.zone_fee_sar).toBe(10);
  });
});

describe("Insurance cap and validation", () => {
  it("insurance is 0.5% of declared value, capped at 50 SAR", () => {
    const low = calcCostSync(ZONES, { from: "RUH", to: "JED", weightKg: 1, declaredValueSar: 2000 });
    expect(low.insurance_sar).toBeCloseTo(10, 2);
    const high = calcCostSync(ZONES, { from: "RUH", to: "JED", weightKg: 1, declaredValueSar: 50000 });
    expect(high.insurance_sar).toBe(50);
  });

  it("cross-border SA→EG is blocked", () => {
    expect(() => calcCostSync(ZONES, { from: "RUH", to: "CAI", weightKg: 1, declaredValueSar: 100 })).toThrow();
  });

  it("unknown city code throws", () => {
    expect(() => calcCostSync(ZONES, { from: "XXX", to: "RUH", weightKg: 1, declaredValueSar: 100 })).toThrow();
  });
});

describe("Every SA region and every EG governorate is represented", () => {
  const saRegions = [
    "الرياض", "مكة المكرمة", "المدينة المنورة", "الشرقية", "القصيم",
    "عسير", "تبوك", "حائل", "الحدود الشمالية", "جازان", "نجران", "الباحة", "الجوف",
  ];
  it.each(saRegions)("SA region %s has at least one city", (region) => {
    expect(saCodes.some((c) => ZONES[c].region_ar === region)).toBe(true);
  });

  const egGovs = [
    "القاهرة", "الجيزة", "القليوبية", "الإسكندرية", "الدقهلية", "الغربية", "الشرقية",
    "البحيرة", "كفر الشيخ", "المنوفية", "دمياط", "بورسعيد", "الإسماعيلية", "السويس",
    "شمال سيناء", "جنوب سيناء", "بني سويف", "الفيوم", "المنيا", "أسيوط", "سوهاج",
    "قنا", "الأقصر", "أسوان", "البحر الأحمر", "الوادي الجديد", "مطروح",
  ];
  it.each(egGovs)("EG governorate %s has at least one city", (gov) => {
    expect(egCodes.some((c) => ZONES[c].region_ar === gov)).toBe(true);
  });
});
