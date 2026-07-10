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

describe("edge cases", () => {
  it("formats very large numbers with correct grouping", () => {
    expect(formatAmount(1_000_000_000)).toBe("1,000,000,000");
    expect(formatAmount(9_999_999_999_999)).toBe("9,999,999,999,999");
    expect(formatSAR(1_234_567_890)).toBe("1,234,567,890 ر.س");
  });

  it("formats very large negatives with sign preserved", () => {
    expect(formatAmount(-1_000_000)).toBe("-1,000,000");
    expect(formatAmount(-9_876_543_210)).toBe("-9,876,543,210");
    expect(formatSAR(-1_000_000_000)).toBe("-1,000,000,000 ر.س");
  });

  it("handles very small decimals below the 2-digit threshold", () => {
    // priceDigits stays at 2 for < 10, so tiny values round to 2 decimals
    expect(formatAmount(0.001)).toBe("0.00");
    expect(formatAmount(0.009)).toBe("0.01");
    expect(formatAmount(-0.004)).toBe("-0.00");
  });

  it("respects extreme explicit fractionDigits overrides", () => {
    expect(formatAmount(1.23456789, 6)).toBe("1.234568");
    expect(formatAmount(0.000001, 8)).toBe("0.00000100");
    expect(formatAmount(1234.5, 4)).toBe("1,234.5000");
  });

  it("handles JS numeric boundaries without throwing", () => {
    expect(() => formatAmount(Number.MAX_SAFE_INTEGER)).not.toThrow();
    expect(formatAmount(Number.MAX_SAFE_INTEGER)).toBe(
      Number.MAX_SAFE_INTEGER.toLocaleString("en-US", { maximumFractionDigits: 0 }),
    );
    expect(formatAmount(Number.MIN_SAFE_INTEGER)).toBe(
      Number.MIN_SAFE_INTEGER.toLocaleString("en-US", { maximumFractionDigits: 0 }),
    );
  });

  it("coerces non-finite values (NaN / Infinity) to 0", () => {
    expect(formatAmount(NaN)).toBe("0");
    expect(formatAmount(Infinity)).toBe("0");
    expect(formatAmount(-Infinity)).toBe("0");
    expect(formatSAR(NaN)).toBe("0 ر.س");
  });

  it("handles numeric strings with decimals and whitespace-ish inputs", () => {
    expect(formatAmount("1234.5")).toBe("1,235"); // rounded, ≥10 → 0 digits
    expect(formatAmount("0.5")).toBe("0.50");
    expect(formatAmount("")).toBe("0");
  });
});
