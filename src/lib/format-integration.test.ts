// Integration test: LocalPrice, OfferPreviewPanel and PostMatchPanel MUST
// render identical price strings for the same input, because they all funnel
// through the shared format-price helpers. We don't mount React here — we
// exercise the exact formatting expressions each component uses and assert
// they agree across SAR and EGP.

import { describe, it, expect } from "vitest";
import { formatAmount, formatSAR, formatLocal } from "./format-price";
import { FX_VS_SAR, sarToLocal } from "./currency-fx";
import { computeFee, fmtLocal, profileFromCurrency } from "./tax-config";

// --- Mirrors of the price expressions used inside each component ---

/** <LocalPrice sar={n} /> visible text: `${amount} ${symbol}` */
function renderLocalPrice(sar: number, country: string, fractionDigits?: number) {
  const fx = FX_VS_SAR[country] ?? FX_VS_SAR.SAR;
  return `${formatAmount(sar * fx.perSAR, fractionDigits)} ${fx.symbol}`;
}

/** OfferPreviewPanel stats: value cells + diff line */
function renderOfferPreview(myVal: number, tgtVal: number, cash: number, country: string) {
  const diff = (myVal + cash) - tgtVal;
  return {
    mine: renderLocalPrice(myVal, country),
    cash: formatSAR(cash),
    target: renderLocalPrice(tgtVal, country),
    diff: `${diff >= 0 ? "+" : ""}${formatSAR(diff)}`,
  };
}

/** PostMatchPanel FeeBlock: the localized fee lines */
function renderFeeBlock(dealSar: number, country: string) {
  const fee = computeFee(dealSar, country);
  return {
    base: fmtLocal(fee.baseLocal, fee.profile),
    vat: fmtLocal(fee.vatLocal, fee.profile),
    total: fmtLocal(fee.totalLocal, fee.profile),
    sarEquiv: formatSAR(fee.totalSar),
  };
}

describe("price formatting integration across components", () => {
  const cases = [
    { country: "SAR", label: "Saudi Arabia" },
    { country: "EGP", label: "Egypt" },
  ];

  for (const { country, label } of cases) {
    describe(label, () => {
      const symbol = FX_VS_SAR[country].symbol;

      it("LocalPrice matches formatLocal for whole amounts", () => {
        for (const sar of [50, 500, 1500, 100_000]) {
          const lp = renderLocalPrice(sar, country);
          const local = sarToLocal(sar, country);
          expect(lp).toBe(`${formatAmount(local)} ${symbol}`);
          expect(lp).toBe(formatLocal(sar, country));
        }
      });

      it("LocalPrice matches formatLocal for sub-10 amounts (2 fraction digits)", () => {
        for (const sar of [0.5, 3.5, 9.99]) {
          const lp = renderLocalPrice(sar, country);
          const local = sarToLocal(sar, country);
          // sub-10 local values must show 2 digits
          if (local < 10) {
            expect(lp.split(" ")[0]).toMatch(/\.\d{2}$/);
          }
          expect(lp).toBe(formatLocal(sar, country));
        }
      });

      it("OfferPreviewPanel value cells match LocalPrice on the same inputs", () => {
        const preview = renderOfferPreview(1500, 1200, 300, country);
        expect(preview.mine).toBe(renderLocalPrice(1500, country));
        expect(preview.target).toBe(renderLocalPrice(1200, country));
        // cash + diff are SAR-denominated in the panel, formatted via formatSAR
        expect(preview.cash).toBe("300 ر.س");
        expect(preview.diff).toBe("+600 ر.س");
      });

      it("OfferPreviewPanel diff line preserves sign for negative deltas", () => {
        const p = renderOfferPreview(800, 1200, 100, country);
        // 800 + 100 - 1200 = -300
        expect(p.diff).toBe("-300 ر.س");
      });

      it("PostMatchPanel FeeBlock lines match the shared formatter", () => {
        const fb = renderFeeBlock(1000, country);
        const profile = profileFromCurrency(country);
        const fee = computeFee(1000, country);
        expect(fb.base).toBe(`${formatAmount(fee.baseLocal)} ${profile.symbol}`);
        expect(fb.vat).toBe(`${formatAmount(fee.vatLocal)} ${profile.symbol}`);
        expect(fb.total).toBe(`${formatAmount(fee.totalLocal)} ${profile.symbol}`);
        // grouped, no stray decimals for whole totals
        expect(fb.total).not.toMatch(/\.\d0\b/);
      });

      it("FeeBlock ≈ SAR equivalence uses formatSAR", () => {
        const fb = renderFeeBlock(1000, country);
        const totalSar = computeFee(1000, country).totalSar;
        expect(fb.sarEquiv).toBe(formatSAR(totalSar));
      });
    });
  }

  it("switching country only changes the symbol/rate, never the digit style", () => {
    const sar = 1500;
    const sa = renderLocalPrice(sar, "SAR");
    const eg = renderLocalPrice(sar, "EGP");
    // Both must end in a Latin-digit block with comma grouping, no decimals
    expect(sa).toMatch(/^\d{1,3}(,\d{3})* ر\.س$/);
    expect(eg).toMatch(/^\d{1,3}(,\d{3})* ج\.م$/);
  });

  it("edge values stay consistent across the three call sites", () => {
    for (const country of ["SAR", "EGP"]) {
      for (const sar of [0, 1, 9.99, 10, 1_000_000]) {
        const lp = renderLocalPrice(sar, country);
        const fl = formatLocal(sar, country);
        expect(lp).toBe(fl);
        // Fee formatter on the SAME local number must produce the SAME left side
        const profile = profileFromCurrency(country);
        const local = sarToLocal(sar, country);
        expect(fmtLocal(local, profile)).toBe(lp);
      }
    }
  });
});
