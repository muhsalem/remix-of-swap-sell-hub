import { describe, it, expect } from "vitest";
import { formatAmount, formatSAR, priceDigits } from "./format-price";

describe("priceDigits", () => {
  it("returns 0 for zero", () => expect(priceDigits(0)).toBe(0));
  it("returns 2 for small amounts (< 10)", () => {
    expect(priceDigits(0.5)).toBe(2);
    expect(priceDigits(9.99)).toBe(2);
  });
  it("returns 0 for ≥ 10", () => {
    expect(priceDigits(10)).toBe(0);
    expect(priceDigits(1234)).toBe(0);
    expect(priceDigits(1_000_000)).toBe(0);
  });
  it("uses absolute value for negatives", () => {
    expect(priceDigits(-5)).toBe(2);
    expect(priceDigits(-500)).toBe(0);
  });
});

describe("formatAmount", () => {
  it("groups thousands with commas", () => {
    expect(formatAmount(1234)).toBe("1,234");
    expect(formatAmount(1_234_567)).toBe("1,234,567");
  });
  it("shows 2 fraction digits for small amounts", () => {
    expect(formatAmount(3.5)).toBe("3.50");
    expect(formatAmount(0.1)).toBe("0.10");
  });
  it("hides decimals for whole large amounts", () => {
    expect(formatAmount(1500.4)).toBe("1,500");
    expect(formatAmount(999.9)).toBe("1,000"); // rounded to 0 digits
  });
  it("respects an explicit fractionDigits override", () => {
    expect(formatAmount(1500, 2)).toBe("1,500.00");
    expect(formatAmount(3.5, 0)).toBe("4");
  });
  it("coerces strings and invalid values to 0", () => {
    expect(formatAmount("1234")).toBe("1,234");
    expect(formatAmount("abc")).toBe("0");
  });
});

describe("formatSAR", () => {
  it("appends the ر.س suffix", () => {
    expect(formatSAR(1500)).toBe("1,500 ر.س");
    expect(formatSAR(3.5)).toBe("3.50 ر.س");
  });
  it("handles zero and negatives consistently", () => {
    expect(formatSAR(0)).toBe("0 ر.س");
    expect(formatSAR(-1234)).toBe("-1,234 ر.س");
  });
});
