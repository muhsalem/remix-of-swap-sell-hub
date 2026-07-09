// Single source of truth for country-specific taxes & platform economics.
// Used by the checkout FeeBlock, the pricing engine, and any receipt UI.

export type TaxCountry = "SA" | "EG" | "AE" | "KW" | "QA" | "BH" | "OM" | "JO" | "OTHER";

export interface TaxProfile {
  code: TaxCountry;
  label: string;
  flag: string;
  /** Local currency ISO code */
  currency: string;
  /** Short symbol shown next to numbers */
  symbol: string;
  /** VAT rate applied on platform commission (0 = no VAT) */
  vatRate: number;
  /** Platform commission rate on the deal (base) */
  feeRate: number;
  /** Minimum commission in local currency (charged if percentage < min) */
  feeMinLocal: number;
  /** FX rate: local units per 1 SAR (used to convert internal SAR ledger to local) */
  perSAR: number;
  /** Regulator / tax authority label shown on receipts */
  taxAuthority: string;
  /** e-Invoice / VAT compliance note */
  einvoiceNote: string;
}

export const TAX_PROFILES: Record<TaxCountry, TaxProfile> = {
  SA: {
    code: "SA",
    label: "السعودية",
    flag: "🇸🇦",
    currency: "SAR",
    symbol: "ر.س",
    vatRate: 0.15,
    feeRate: 0.03,
    feeMinLocal: 1.5,
    perSAR: 1.0,
    taxAuthority: "هيئة الزكاة والضريبة والجمارك (ZATCA)",
    einvoiceNote: "فاتورة ضريبية متوافقة مع منظومة فوترة (ZATCA)",
  },
  EG: {
    code: "EG",
    label: "مصر",
    flag: "🇪🇬",
    currency: "EGP",
    symbol: "ج.م",
    vatRate: 0.14,
    feeRate: 0.03,
    feeMinLocal: 5,
    perSAR: 13.2,
    taxAuthority: "مصلحة الضرائب المصرية (ETA)",
    einvoiceNote: "فاتورة ضريبية متوافقة مع منظومة الفاتورة الإلكترونية المصرية",
  },
  AE: { code: "AE", label: "الإمارات", flag: "🇦🇪", currency: "AED", symbol: "د.إ", vatRate: 0.05, feeRate: 0.03, feeMinLocal: 1.5, perSAR: 0.98, taxAuthority: "الهيئة الاتحادية للضرائب (FTA)", einvoiceNote: "فاتورة ضريبية وفق نظام VAT الإماراتي" },
  KW: { code: "KW", label: "الكويت", flag: "🇰🇼", currency: "KWD", symbol: "د.ك", vatRate: 0.0, feeRate: 0.03, feeMinLocal: 0.1, perSAR: 0.082, taxAuthority: "وزارة المالية الكويتية", einvoiceNote: "لا تُطبَّق ضريبة قيمة مضافة حالياً" },
  QA: { code: "QA", label: "قطر", flag: "🇶🇦", currency: "QAR", symbol: "ر.ق", vatRate: 0.0, feeRate: 0.03, feeMinLocal: 1.5, perSAR: 0.97, taxAuthority: "الهيئة العامة للضرائب القطرية", einvoiceNote: "لا تُطبَّق VAT حالياً" },
  BH: { code: "BH", label: "البحرين", flag: "🇧🇭", currency: "BHD", symbol: "د.ب", vatRate: 0.10, feeRate: 0.03, feeMinLocal: 0.1, perSAR: 0.100, taxAuthority: "الجهاز الوطني للإيرادات (NBR)", einvoiceNote: "فاتورة ضريبية وفق VAT البحريني" },
  OM: { code: "OM", label: "عُمان", flag: "🇴🇲", currency: "OMR", symbol: "ر.ع", vatRate: 0.05, feeRate: 0.03, feeMinLocal: 0.1, perSAR: 0.103, taxAuthority: "جهاز الضرائب العُماني", einvoiceNote: "فاتورة ضريبية وفق VAT العُماني" },
  JO: { code: "JO", label: "الأردن", flag: "🇯🇴", currency: "JOD", symbol: "د.أ", vatRate: 0.16, feeRate: 0.03, feeMinLocal: 0.2, perSAR: 0.189, taxAuthority: "دائرة ضريبة الدخل والمبيعات الأردنية", einvoiceNote: "ضريبة المبيعات العامة الأردنية" },
  OTHER: { code: "OTHER", label: "دولي", flag: "🌍", currency: "USD", symbol: "$", vatRate: 0.0, feeRate: 0.03, feeMinLocal: 0.5, perSAR: 0.267, taxAuthority: "—", einvoiceNote: "لا تُطبَّق ضريبة محلية" },
};

/** Map an FX currency code (badel:country storage) to a tax profile. */
export function profileFromCurrency(currency: string | undefined | null): TaxProfile {
  switch ((currency || "").toUpperCase()) {
    case "SAR": return TAX_PROFILES.SA;
    case "EGP": return TAX_PROFILES.EG;
    case "AED": return TAX_PROFILES.AE;
    case "KWD": return TAX_PROFILES.KW;
    case "QAR": return TAX_PROFILES.QA;
    case "BHD": return TAX_PROFILES.BH;
    case "OMR": return TAX_PROFILES.OM;
    case "JOD": return TAX_PROFILES.JO;
    default: return TAX_PROFILES.OTHER;
  }
}

export interface FeeBreakdown {
  profile: TaxProfile;
  baseLocal: number;       // taxable base (commission before VAT) in local currency
  vatLocal: number;        // VAT amount in local currency
  totalLocal: number;      // base + VAT
  baseSar: number;         // internal SAR ledger value
  totalSar: number;        // internal SAR ledger value including VAT
}

/**
 * Compute the tax-inclusive platform fee for a deal.
 * @param dealValueSar internal deal value used to compute commission (SAR)
 * @param currency user's saved currency code (from `loadCountry()`)
 */
export function computeFee(dealValueSar: number, currency: string | null | undefined): FeeBreakdown {
  const profile = profileFromCurrency(currency);
  const baseSar = Math.max(0, Number(dealValueSar) || 0) * profile.feeRate;
  const vatSar = baseSar * profile.vatRate;
  const totalSar = baseSar + vatSar;
  const baseLocal = Math.max(baseSar * profile.perSAR, profile.feeMinLocal);
  const vatLocal = baseLocal * profile.vatRate;
  const totalLocal = baseLocal + vatLocal;
  return {
    profile,
    baseLocal: round2(baseLocal),
    vatLocal: round2(vatLocal),
    totalLocal: round2(totalLocal),
    baseSar: round2(baseSar),
    totalSar: round2(totalSar),
  };
}

function round2(n: number) { return Math.round(n * 100) / 100; }

export function fmtLocal(n: number, profile: TaxProfile): string {
  const digits = n < 10 ? 2 : 0;
  return `${n.toLocaleString(undefined, { maximumFractionDigits: digits })} ${profile.symbol}`;
}
