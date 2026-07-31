// محرك تسعير المقايضة — منطق مشترك (منقول من النسخة المستقلة إلى React)
import {
  COUNTRIES as RAW_COUNTRIES,
  BARTER_CATEGORIES as RAW_CATEGORIES,
  IMPORT_DUTIES as RAW_DUTIES,
  MULTIPLIERS as RAW_MULTIPLIERS,
  SAMPLE_INVENTORY as RAW_INVENTORY,
} from "./barter-engine-data";

export interface CountryInfo {
  code: string; nameEn: string; nameAr: string; currency: string; symbol: string;
  exchangeRate: number; pppFactor: number; costOfLivingIndex: number;
  avgMonthlyIncome: number; inflationRate: number; flag: string;
}
export interface SubcategoryInfo {
  labelEn: string; labelAr: string;
  basePrice?: number; deprRate?: number; hourlyRate?: number; liquidity: number;
}
export interface CategoryInfo {
  labelEn: string; labelAr: string; icon: string; globalFactor: number;
  isService?: boolean; subcategories: Record<string, SubcategoryInfo>;
}

export const COUNTRIES = RAW_COUNTRIES as unknown as Record<string, CountryInfo>;
export const CATEGORIES = RAW_CATEGORIES as unknown as Record<string, CategoryInfo>;
const DUTIES = RAW_DUTIES as unknown as Record<string, Record<string, number>>;
export const MULTIPLIERS = RAW_MULTIPLIERS as unknown as {
  condition: Record<string, { labelAr: string; val: number }>;
  demand: Record<string, { labelAr: string; val: number }>;
  complexity: Record<string, { labelAr: string; val: number }>;
  experience: Record<string, { labelAr: string; val: number }>;
};

export type ConditionKey = "new" | "like_new" | "excellent" | "good" | "fair";
export type DemandKey = "low" | "normal" | "high";
export type ComplexityKey = "simple" | "medium" | "complex" | "expert";
export type ExperienceKey = "junior" | "mid" | "expert";

export interface InventoryItem {
  id: string; type: "good" | "service"; category: string; subcategory: string;
  nameEn: string; nameAr: string; countryCode: string;
  basePrice?: number; ageYears?: number; conditionKey?: ConditionKey; demandKey?: DemandKey;
  hourlyRate?: number; hours?: number; complexityKey?: ComplexityKey; experienceKey?: ExperienceKey;
  desiredCategory: string; value: number;
}

export const COUNTRY_CODES = Object.keys(COUNTRIES);

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export function catLabel(key: string): string {
  return CATEGORIES[key]?.labelAr ?? key;
}
export function subLabel(cat: string, sub: string): string {
  return CATEGORIES[cat]?.subcategories?.[sub]?.labelAr ?? sub;
}

const NUM = "en-US";
export function fmtUSD(v: number): string {
  return `$${(Number(v) || 0).toLocaleString(NUM, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
export function fmtLocal(v: number, code: string): string {
  const c = COUNTRIES[code];
  const n = (Number(v) || 0).toLocaleString(NUM, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return c ? `${n} ${c.symbol}` : `$${n}`;
}

// ── تطبيع أسماء الموديلات لاكتشاف المقايضات المتطابقة ──
function normalizeModelName(name: string): string {
  return (name || "")
    .toLowerCase()
    .replace(/[()\-_,،]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
export function areIdenticalModels(a: string, b: string): boolean {
  const na = normalizeModelName(a);
  const nb = normalizeModelName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const ta = na.split(" ").filter((w) => w.length > 2);
  const tb = nb.split(" ").filter((w) => w.length > 2);
  if (ta.length < 2 || tb.length < 2) return false;
  const shared = ta.filter((w) => tb.includes(w)).length;
  return shared / Math.min(ta.length, tb.length) >= 0.8;
}

// ── القرب الجغرافي ──
const REGIONS: Record<string, string[]> = { gulf: ["SA"], north_africa: ["EG"] };
const ADJACENCY: Record<string, string[]> = { gulf: ["north_africa"], north_africa: ["gulf"] };
function regionOf(code: string): string {
  for (const r in REGIONS) if (REGIONS[r].includes(code)) return r;
  return "others";
}
export function proximityScore(a: string, b: string): number {
  if (a === b) return 0;
  const ra = regionOf(a);
  const rb = regionOf(b);
  if (ra === rb) return 1;
  if (ADJACENCY[ra]?.includes(rb)) return 2;
  return 3;
}

// ── تقييم السلع ──
export interface GoodValuation {
  inflationAdjustedBase: number; depreciatedValue: number;
  conditionFactor: number; demandFactor: number;
  deprModel: "appreciation" | "rapid_decay" | "declining_balance";
  finalValue: number;
}
export function valueGood(p: {
  basePrice: number; ageYears: number; deprRate: number;
  conditionKey: string; demandKey: string; inflationRate: number;
}): GoodValuation {
  const base = Number(p.basePrice) || 0;
  const age = Number(p.ageYears) || 0;
  const depr = Number(p.deprRate) || 0.1;
  const infl = Number(p.inflationRate) || 0;
  const cond = MULTIPLIERS.condition[p.conditionKey]?.val ?? 1;
  const demand = MULTIPLIERS.demand[p.demandKey]?.val ?? 1;

  const inflAdj = base * Math.pow(1 + infl, age);
  let deprVal: number;
  let model: GoodValuation["deprModel"];
  if (depr < 0) {
    model = "appreciation";
    const effAge = Math.min(age, 30);
    deprVal = inflAdj * Math.pow(1 + Math.abs(depr), effAge);
    if (deprVal > inflAdj * 4) deprVal = inflAdj * 4;
  } else if (depr > 0.5) {
    model = "rapid_decay";
    deprVal = inflAdj * Math.exp(-depr * age * 12);
    if (deprVal < inflAdj * 0.01) deprVal = inflAdj * 0.01;
  } else {
    model = "declining_balance";
    deprVal = inflAdj * Math.pow(1 - depr, age);
    if (deprVal < inflAdj * 0.1) deprVal = inflAdj * 0.1;
  }
  return {
    inflationAdjustedBase: inflAdj,
    depreciatedValue: deprVal,
    conditionFactor: cond,
    demandFactor: demand,
    deprModel: model,
    finalValue: Math.round(deprVal * cond * demand * 100) / 100,
  };
}

// ── تقييم الخدمات ──
export function valueService(p: {
  hourlyRate: number; hours: number; complexityKey: string; experienceKey: string;
}) {
  const rate = Number(p.hourlyRate) || 30;
  const hours = Number(p.hours) || 10;
  const comp = MULTIPLIERS.complexity[p.complexityKey]?.val ?? 1;
  const exp = MULTIPLIERS.experience[p.experienceKey]?.val ?? 1;
  const baseCost = rate * hours;
  return {
    baseCost,
    complexityFactor: comp,
    experienceFactor: exp,
    finalValue: Math.round(baseCost * comp * exp * 100) / 100,
  };
}

// ── السعر المحلي مع الرسوم الجمركية ──
export interface CountryPrice {
  local: number; usd: number; affordability: number;
  exchangeRate: number; currency: string; symbol: string; dutyFactor: number;
}
export function getCountryPrice(usdValue: number, countryCode: string, categoryKey: string): CountryPrice {
  const c = COUNTRIES[countryCode];
  if (!c) {
    return { local: usdValue, usd: usdValue, affordability: 0, exchangeRate: 1, currency: "USD", symbol: "$", dutyFactor: 1 };
  }
  const gf = CATEGORIES[categoryKey]?.globalFactor ?? 0.5;
  const duty = DUTIES[categoryKey]?.[countryCode] ?? DUTIES[categoryKey]?._default ?? 1;
  const colAdj = c.costOfLivingIndex / 100;
  const adjustedUSD = usdValue * (gf + (1 - gf) * colAdj) * duty;
  return {
    local: Math.round(adjustedUSD * c.exchangeRate * 100) / 100,
    usd: Math.round(adjustedUSD * 100) / 100,
    affordability: c.avgMonthlyIncome > 0 ? Math.round((adjustedUSD / c.avgMonthlyIncome) * 1000) / 10 : 0,
    exchangeRate: c.exchangeRate,
    currency: c.currency,
    symbol: c.symbol,
    dutyFactor: duty,
  };
}

export function compareCountries(usdValue: number, codeA: string, codeB: string, categoryKey: string) {
  const a = getCountryPrice(usdValue, codeA, categoryKey);
  const b = getCountryPrice(usdValue, codeB, categoryKey);
  const diffPct = a.usd > 0 ? ((b.usd - a.usd) / a.usd) * 100 : 0;
  return {
    a, b,
    diffPct: Math.round(diffPct * 10) / 10,
    betterDeal: diffPct < 0 ? codeB : diffPct > 0 ? codeA : "equal",
  };
}

// ── التوافق الشرعي ──
export type ShariaSeverity = "high" | "medium" | "info";
export interface ShariaWarning { type: string; severity: ShariaSeverity; text: string }
export function checkSharia(
  a: { type: string; subcategory: string; value: number },
  b: { type: string; subcategory: string; value: number },
) {
  const warnings: ShariaWarning[] = [];
  const ribawi = ["jewelry", "grains", "dairy", "gold", "silver"];
  const perishable = ["dairy", "produce", "grains"];
  const rA = ribawi.includes(a.subcategory);
  const rB = ribawi.includes(b.subcategory);

  if (rA && rB && a.subcategory === b.subcategory) {
    warnings.push({ type: "ribawi_same", severity: "high", text: "⚠️ أصناف ربوية متماثلة: يجب التساوي في الوزن/الكيل والتقابض الفوري (يداً بيد)." });
  } else if (rA && rB) {
    warnings.push({ type: "ribawi_cross", severity: "medium", text: "ℹ️ أصناف ربوية مختلفة: يجوز التفاضل لكن يشترط التقابض الفوري." });
  }
  if (a.type === "service" || b.type === "service") {
    warnings.push({ type: "gharar", severity: "info", text: "📋 مقايضة خدمات: حدّد نطاق الخدمة والمخرجات والجدول الزمني بوضوح لتجنب الغرر." });
  }
  if (perishable.includes(a.subcategory) || perishable.includes(b.subcategory)) {
    warnings.push({ type: "perishable", severity: "medium", text: "🕐 سلع قابلة للتلف: يجب التسليم الفوري لتجنب التلف وضمان العدالة." });
  }
  if (a.value !== b.value) {
    warnings.push({ type: "settlement", severity: "info", text: "💰 التسوية النقدية يجب أن تتم وقت التبادل — لا تأجيل لتجنب شبهة الربا." });
  }
  const hasHigh = warnings.some((w) => w.severity === "high");
  const hasMedium = warnings.some((w) => w.severity === "medium");
  return {
    isCompliant: !hasHigh,
    rating: hasHigh ? "needs_review" : hasMedium ? "halal_with_conditions" : "halal",
    warnings,
  } as const;
}

// ── حاسبة التوافق ──
export interface MatchAsset {
  type: "good" | "service"; name: string; category: string; subcategory: string;
  value: number; liquidity: number; desiredCategory?: string; countryCode: string;
  nameEn?: string; nameAr?: string;
}
export function solveCompatibility(assetA: MatchAsset, assetB: MatchAsset) {
  const valA = Number(assetA.value) || 0;
  const valB = Number(assetB.value) || 0;
  const liqA = Number(assetA.liquidity) || 0.6;
  const liqB = Number(assetB.liquidity) || 0.6;

  let isIdenticalModel = false;
  if (assetA.type === "good" && assetB.type === "good") {
    const nameA = assetA.name || "";
    isIdenticalModel =
      areIdenticalModels(nameA, assetB.nameEn || assetB.name || "") ||
      areIdenticalModels(nameA, assetB.nameAr || assetB.name || "");
  }

  let valueScore = 100;
  if (!isIdenticalModel && (valA > 0 || valB > 0)) {
    const maxV = Math.max(valA, valB);
    valueScore = Math.max(0, 100 - (Math.abs(valA - valB) / maxV) * 100);
  }

  let categoryScore = 100;
  let catMatchA = false;
  let catMatchB = false;
  if (assetA.desiredCategory || assetB.desiredCategory) {
    categoryScore = 0;
    if (!assetA.desiredCategory || assetB.category === assetA.desiredCategory) { categoryScore += 50; catMatchA = true; }
    if (!assetB.desiredCategory || assetA.category === assetB.desiredCategory) { categoryScore += 50; catMatchB = true; }
  }

  const totalScore = valueScore * 0.7 + categoryScore * 0.3;
  const cashOffset = Math.abs(valA - valB);
  const offsetPayer = valA > valB ? "B" : valB > valA ? "A" : null;
  const txFee = Math.max(valA, valB) * 0.015;

  let shippingFee = 0;
  if (assetA.countryCode && assetB.countryCode && assetA.countryCode !== assetB.countryCode) {
    const p = proximityScore(assetA.countryCode, assetB.countryCode);
    if (p > 0) {
      const baseRates = assetB.type === "good" ? [0, 30, 60, 100] : [0, 50, 100, 200];
      const pctRates = assetB.type === "good" ? [0, 0.02, 0.04, 0.06] : [0, 0.01, 0.02, 0.03];
      shippingFee = baseRates[p] + valB * pctRates[p];
    }
  }

  const avgLiq = (liqA + liqB) / 2;
  const velocity = avgLiq >= 0.8 ? "سريعة" : avgLiq < 0.55 ? "بطيئة" : "متوسطة";
  const maxV = Math.max(valA, valB);
  const oRatio = maxV > 0 ? cashOffset / maxV : 0;
  const feasibility: "high" | "moderate" | "low" = oRatio > 0.4 ? "low" : oRatio > 0.15 ? "moderate" : "high";

  return {
    valueScore: Math.round(valueScore),
    categoryScore: Math.round(categoryScore),
    totalScore: Math.round(totalScore),
    cashOffset: Math.round(cashOffset * 100) / 100,
    offsetPayer,
    categoryMatchA: catMatchA,
    categoryMatchB: catMatchB,
    feasibility,
    transactionFee: Math.round(txFee * 100) / 100,
    shippingFee: Math.round(shippingFee * 100) / 100,
    avgLiquidity: Math.round(avgLiq * 100),
    velocity,
    isIdenticalModel,
  };
}

// ── ضرائب/عمولة حسب الدولة ──
export const TAX_BY_COUNTRY: Record<string, { vat: number; fee: number; auth: string }> = {
  SA: { vat: 0.15, fee: 0.03, auth: "ZATCA" },
  EG: { vat: 0.14, fee: 0.03, auth: "ETA" },
  AE: { vat: 0.05, fee: 0.03, auth: "FTA" },
  KW: { vat: 0, fee: 0.03, auth: "MOF-KW" },
  QA: { vat: 0, fee: 0.03, auth: "GTA-QA" },
  BH: { vat: 0.1, fee: 0.03, auth: "NBR-BH" },
  OM: { vat: 0.05, fee: 0.03, auth: "TA-OM" },
  JO: { vat: 0.16, fee: 0.03, auth: "ISTD-JO" },
};

// ── المخزون التجريبي مع القيم المحسوبة ──
export const INVENTORY: InventoryItem[] = (RAW_INVENTORY as unknown as InventoryItem[]).map((item) => {
  const sub = CATEGORIES[item.category]?.subcategories?.[item.subcategory];
  const value =
    item.type === "good"
      ? valueGood({
          basePrice: item.basePrice ?? 0,
          ageYears: item.ageYears ?? 0,
          deprRate: sub?.deprRate ?? 0.1,
          conditionKey: item.conditionKey ?? "good",
          demandKey: item.demandKey ?? "normal",
          inflationRate: 0.03,
        }).finalValue
      : valueService({
          hourlyRate: item.hourlyRate ?? 30,
          hours: item.hours ?? 10,
          complexityKey: item.complexityKey ?? "medium",
          experienceKey: item.experienceKey ?? "mid",
        }).finalValue;
  return { ...item, value, liquidity: sub?.liquidity ?? 0.6 } as InventoryItem;
});

export function inventoryLiquidity(item: InventoryItem): number {
  return CATEGORIES[item.category]?.subcategories?.[item.subcategory]?.liquidity ?? 0.6;
}
