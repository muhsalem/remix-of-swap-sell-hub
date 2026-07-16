import { describe, it, expect } from "vitest";
import { formatArabicCountdown } from "./format-arabic-duration";

describe("formatArabicCountdown", () => {
  it("returns null when input is null", () => {
    expect(formatArabicCountdown(null)).toBeNull();
  });
  it("shows 'الآن…' at or below zero", () => {
    expect(formatArabicCountdown(0)).toBe("الآن…");
    expect(formatArabicCountdown(-5)).toBe("الآن…");
  });
  it("uses singular for 1s", () => {
    expect(formatArabicCountdown(1)).toBe("1 ثانية");
  });
  it("uses dual for 2s", () => {
    expect(formatArabicCountdown(2)).toBe("2 ثانيتان");
  });
  it("uses plural of paucity for 3-10s", () => {
    expect(formatArabicCountdown(3)).toBe("3 ثوانٍ");
    expect(formatArabicCountdown(10)).toBe("10 ثوانٍ");
  });
  it("uses singular accusative for 11+s", () => {
    expect(formatArabicCountdown(11)).toBe("11 ثانية");
    expect(formatArabicCountdown(45)).toBe("45 ثانية");
  });
  it("formats whole minutes", () => {
    expect(formatArabicCountdown(60)).toBe("1 دقيقة");
    expect(formatArabicCountdown(120)).toBe("2 دقيقتان");
    expect(formatArabicCountdown(180)).toBe("3 دقائق");
    expect(formatArabicCountdown(660)).toBe("11 دقيقة");
  });
  it("combines minutes and seconds with proper forms", () => {
    expect(formatArabicCountdown(65)).toBe("1 دقيقة و 5 ثوانٍ");
    expect(formatArabicCountdown(122)).toBe("2 دقيقتان و 2 ثانيتان");
    expect(formatArabicCountdown(671)).toBe("11 دقيقة و 11 ثانية");
  });
  it("still matches numeric parsers used in e2e tests", () => {
    // /\d+\s*ث/ and /\d+\s*د/ must keep matching so existing tests are stable.
    for (const s of [1, 2, 3, 10, 11, 45, 59]) {
      expect(formatArabicCountdown(s)).toMatch(/\d+\s*ث/);
    }
    for (const s of [60, 120, 180, 660]) {
      expect(formatArabicCountdown(s)).toMatch(/\d+\s*د/);
    }
  });
});
