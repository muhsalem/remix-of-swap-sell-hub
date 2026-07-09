import { describe, it, expect } from "vitest";
import { computeFee, profileFromCurrency, TAX_PROFILES, fmtLocal } from "./tax-config";

const approx = (a: number, b: number, tol = 0.02) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

describe("tax-config: profile resolution", () => {
  it("maps SAR → SA (VAT 15%)", () => {
    const p = profileFromCurrency("SAR");
    expect(p.code).toBe("SA");
    expect(p.vatRate).toBe(0.15);
    expect(p.currency).toBe("SAR");
    expect(p.taxAuthority).toContain("ZATCA");
  });
  it("maps EGP → EG (VAT 14%)", () => {
    const p = profileFromCurrency("EGP");
    expect(p.code).toBe("EG");
    expect(p.vatRate).toBe(0.14);
    expect(p.currency).toBe("EGP");
    expect(p.taxAuthority).toContain("ETA");
  });
  it("falls back to OTHER for unknown/empty currency", () => {
    expect(profileFromCurrency(null).code).toBe("OTHER");
    expect(profileFromCurrency("").code).toBe("OTHER");
    expect(profileFromCurrency("ZZZ").code).toBe("OTHER");
  });
});

describe("tax-config: Saudi Arabia (VAT 15%)", () => {
  it("1,000 SAR deal → fee 30 SAR + VAT 4.50 SAR = 34.50 SAR", () => {
    const f = computeFee(1000, "SAR");
    expect(f.profile.code).toBe("SA");
    approx(f.baseSar, 30);
    approx(f.baseLocal, 30);
    approx(f.vatLocal, 4.5);
    approx(f.totalLocal, 34.5);
    approx(f.totalSar, 34.5);
  });
  it("50 SAR floor applies (minimum base = 1.5 SAR)", () => {
    const f = computeFee(10, "SAR");
    expect(f.baseLocal).toBeGreaterThanOrEqual(TAX_PROFILES.SA.feeMinLocal);
  });
  it("VAT is always exactly 15% of base", () => {
    for (const v of [500, 1500, 9999]) {
      const f = computeFee(v, "SAR");
      approx(f.vatLocal / f.baseLocal, 0.15, 0.001);
    }
  });
});

describe("tax-config: Egypt (VAT 14%)", () => {
  it("converts SAR ledger to EGP at perSAR rate", () => {
    // 1,000 SAR × 3% = 30 SAR base × 13.2 = 396 EGP base
    const f = computeFee(1000, "EGP");
    expect(f.profile.code).toBe("EG");
    approx(f.baseSar, 30);
    approx(f.baseLocal, 30 * TAX_PROFILES.EG.perSAR);
    approx(f.vatLocal, f.baseLocal * 0.14);
    approx(f.totalLocal, f.baseLocal * 1.14);
  });
  it("VAT is exactly 14% of the local base", () => {
    for (const v of [200, 2500, 50000]) {
      const f = computeFee(v, "EGP");
      approx(f.vatLocal / f.baseLocal, 0.14, 0.001);
      approx(f.totalLocal, f.baseLocal + f.vatLocal, 0.01);
    }
  });
  it("enforces EGP fee floor for tiny deals", () => {
    const f = computeFee(1, "EGP"); // 0.03 SAR × 13.2 ≈ 0.4 EGP → below floor 5 EGP
    expect(f.baseLocal).toBe(TAX_PROFILES.EG.feeMinLocal);
    approx(f.vatLocal, TAX_PROFILES.EG.feeMinLocal * 0.14);
  });
});

describe("tax-config: SA vs EG parity check", () => {
  it("same deal value yields different totals per country", () => {
    const sa = computeFee(2000, "SAR");
    const eg = computeFee(2000, "EGP");
    // SA: 2000 × 3% × 1.15 = 69 SAR
    approx(sa.totalLocal, 69);
    // EG: 2000 × 3% × 13.2 × 1.14 = 903.12 EGP
    approx(eg.totalLocal, 60 * 13.2 * 1.14, 0.5);
    expect(sa.profile.currency).not.toBe(eg.profile.currency);
  });
});

describe("tax-config: safety & edge cases", () => {
  it("rejects negative/NaN deal values gracefully", () => {
    expect(computeFee(-500, "SAR").baseLocal).toBe(TAX_PROFILES.SA.feeMinLocal);
    expect(computeFee(NaN, "EGP").baseLocal).toBe(TAX_PROFILES.EG.feeMinLocal);
  });
  it("fmtLocal appends the correct currency symbol", () => {
    expect(fmtLocal(34.5, TAX_PROFILES.SA)).toContain("ر.س");
    expect(fmtLocal(903, TAX_PROFILES.EG)).toContain("ج.م");
  });
});
