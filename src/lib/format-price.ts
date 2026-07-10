// Unified money/number formatting used across market, listing, and match views.
// Keep Latin digits + comma grouping everywhere for a consistent price look,
// regardless of the user's browser locale.

import { FX_VS_SAR, sarToLocal } from "./currency-fx";

const LOCALE = "en-US"; // stable grouping (1,234,567) across environments

/** Adaptive fraction digits: 0 for ≥10, 2 for small amounts, 0 for exact zero. */
export function priceDigits(n: number): number {
  const abs = Math.abs(n);
  if (abs === 0) return 0;
  if (abs >= 10) return 0;
  return 2;
}

/** Plain grouped number, no currency symbol. */
export function formatAmount(n: number | string, fractionDigits?: number): string {
  const raw = Number(n);
  const v = Number.isFinite(raw) ? raw : 0;
  const digits = fractionDigits ?? priceDigits(v);
  return v.toLocaleString(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** SAR amount rendered as plain string with the ر.س suffix. */
export function formatSAR(sar: number | string, fractionDigits?: number): string {
  return `${formatAmount(sar, fractionDigits)} ر.س`;
}

/** Convert a SAR amount to the user's currency and format it with the symbol. */
export function formatLocal(sar: number | string, countryCode: string, fractionDigits?: number): string {
  const local = sarToLocal(Number(sar) || 0, countryCode);
  const fx = FX_VS_SAR[countryCode] ?? FX_VS_SAR.SAR;
  return `${formatAmount(local, fractionDigits)} ${fx.symbol}`;
}
