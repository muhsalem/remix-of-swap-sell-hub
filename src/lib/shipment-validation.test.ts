import { describe, it, expect } from "vitest";
import {
  validateShipmentInput,
  WEIGHT_MAX_KG,
  DECLARED_MAX_SAR,
  type ShipmentCity,
} from "./shipment-validation";

const CITIES: ShipmentCity[] = [
  { code: "SA-RUH", name_ar: "الرياض", region_ar: "منطقة الرياض", country: "SA" },
  { code: "SA-JED", name_ar: "جدة", region_ar: "منطقة مكة", country: "SA" },
  { code: "SA-DMM", name_ar: "الدمام", region_ar: "المنطقة الشرقية", country: "SA" },
  { code: "SA-MED", name_ar: "المدينة", region_ar: "منطقة المدينة", country: "SA" },
  { code: "SA-ABH", name_ar: "أبها", region_ar: "منطقة عسير", country: "SA" },
  { code: "EG-CAI", name_ar: "القاهرة", region_ar: "محافظة القاهرة", country: "EG" },
  { code: "EG-ALX", name_ar: "الإسكندرية", region_ar: "محافظة الإسكندرية", country: "EG" },
];

const base = { weight: 5, declared: 1000, cities: CITIES };

describe("validateShipmentInput — invalid city / region selections", () => {
  it("flags no_from when origin is empty and disables the calculate button", () => {
    const r = validateShipmentInput({ ...base, from: "", to: "SA-JED" });
    expect(r.issue?.code).toBe("no_from");
    expect(r.issue?.msg).toContain("اختر مدينة المنشأ");
    expect(r.canCalculate).toBe(false);
  });

  it("flags no_to when destination is empty", () => {
    const r = validateShipmentInput({ ...base, from: "SA-RUH", to: "" });
    expect(r.issue?.code).toBe("no_to");
    expect(r.canCalculate).toBe(false);
  });

  it("flags bad_from when the origin code is not in the cities list", () => {
    const r = validateShipmentInput({ ...base, from: "SA-XXX", to: "SA-JED" });
    expect(r.issue?.code).toBe("bad_from");
    expect(r.issue?.msg).toContain("SA-XXX");
    expect(r.issue?.msg).toContain("غير مدعوم");
    expect(r.canCalculate).toBe(false);
  });

  it("flags bad_to when the destination code is unknown", () => {
    const r = validateShipmentInput({ ...base, from: "SA-RUH", to: "EG-ZZZ" });
    expect(r.issue?.code).toBe("bad_to");
    expect(r.issue?.msg).toContain("EG-ZZZ");
    expect(r.canCalculate).toBe(false);
  });

  it("flags a stale region_ar-style choice (city was disabled/removed) as bad_to", () => {
    // Simulates an admin disabling a city while a stale value is still in state.
    const stale: ShipmentCity[] = CITIES.filter((c) => c.code !== "SA-ABH");
    const r = validateShipmentInput({
      ...base,
      cities: stale,
      from: "SA-RUH",
      to: "SA-ABH",
    });
    expect(r.issue?.code).toBe("bad_to");
    expect(r.canCalculate).toBe(false);
  });

  it("flags same_city and disables the calculate button", () => {
    const r = validateShipmentInput({ ...base, from: "SA-RUH", to: "SA-RUH" });
    expect(r.issue?.code).toBe("same_city");
    expect(r.canCalculate).toBe(false);
  });

  it("flags cross_border and suggests up to 4 alternatives inside the origin country", () => {
    const r = validateShipmentInput({ ...base, from: "SA-RUH", to: "EG-CAI" });
    expect(r.issue?.code).toBe("cross_border");
    expect(r.canCalculate).toBe(false);
    expect(r.issue?.suggest).toBeDefined();
    expect(r.issue!.suggest!.length).toBeGreaterThan(0);
    expect(r.issue!.suggest!.length).toBeLessThanOrEqual(4);
    // Every suggestion must live in the SAME country as the origin.
    for (const s of r.issue!.suggest!) {
      const match = CITIES.find((c) => c.code === s.code)!;
      expect(match.country).toBe("SA");
      expect(s.code).not.toBe("SA-RUH"); // never suggest the origin itself
    }
  });

  it("cross_border from EG suggests only EG cities", () => {
    const r = validateShipmentInput({ ...base, from: "EG-CAI", to: "SA-RUH" });
    expect(r.issue?.code).toBe("cross_border");
    for (const s of r.issue!.suggest!) {
      expect(CITIES.find((c) => c.code === s.code)!.country).toBe("EG");
    }
  });
});

describe("validateShipmentInput — weight & declared bounds", () => {
  it("rejects zero / negative weight", () => {
    expect(
      validateShipmentInput({ ...base, from: "SA-RUH", to: "SA-JED", weight: 0 }).issue?.code,
    ).toBe("bad_weight");
    expect(
      validateShipmentInput({ ...base, from: "SA-RUH", to: "SA-JED", weight: -3 }).issue?.code,
    ).toBe("bad_weight");
  });

  it("rejects weight above the platform maximum", () => {
    const r = validateShipmentInput({
      ...base,
      from: "SA-RUH",
      to: "SA-JED",
      weight: WEIGHT_MAX_KG + 0.1,
    });
    expect(r.issue?.code).toBe("bad_weight");
    expect(r.issue?.msg).toContain(String(WEIGHT_MAX_KG));
  });

  it("rejects negative declared value", () => {
    const r = validateShipmentInput({
      ...base,
      from: "SA-RUH",
      to: "SA-JED",
      declared: -1,
    });
    expect(r.issue?.code).toBe("bad_value");
  });

  it("rejects declared value above the platform maximum", () => {
    const r = validateShipmentInput({
      ...base,
      from: "SA-RUH",
      to: "SA-JED",
      declared: DECLARED_MAX_SAR + 1,
    });
    expect(r.issue?.code).toBe("bad_value");
  });
});

describe("validateShipmentInput — happy path", () => {
  it("returns no issue and enables the calculate button for a valid domestic quote", () => {
    const r = validateShipmentInput({
      ...base,
      from: "SA-RUH",
      to: "SA-JED",
    });
    expect(r.issue).toBeNull();
    expect(r.canCalculate).toBe(true);
    expect(r.fromCity?.country).toBe("SA");
    expect(r.toCity?.country).toBe("SA");
  });

  it("accepts declared value of 0", () => {
    const r = validateShipmentInput({
      ...base,
      from: "EG-CAI",
      to: "EG-ALX",
      declared: 0,
    });
    expect(r.canCalculate).toBe(true);
  });
});
