// Shared between PricingEngine and digital-currency page
// 1 DI = 5 SAR baseline. FX values are units of local currency per 1 SAR.
export const DI_TO_SAR = 5;

export type FxEntry = { label: string; symbol: string; perSAR: number; flag: string };

export const FX_VS_SAR: Record<string, FxEntry> = {
  SAR: { label: "السعودية",  symbol: "ر.س",  perSAR: 1.00,   flag: "🇸🇦" },
  AED: { label: "الإمارات",  symbol: "د.إ",  perSAR: 0.98,   flag: "🇦🇪" },
  KWD: { label: "الكويت",    symbol: "د.ك",  perSAR: 0.082,  flag: "🇰🇼" },
  QAR: { label: "قطر",       symbol: "ر.ق",  perSAR: 0.97,   flag: "🇶🇦" },
  BHD: { label: "البحرين",   symbol: "د.ب",  perSAR: 0.100,  flag: "🇧🇭" },
  OMR: { label: "عُمان",      symbol: "ر.ع",  perSAR: 0.103,  flag: "🇴🇲" },
  EGP: { label: "مصر",       symbol: "ج.م",  perSAR: 13.20,  flag: "🇪🇬" },
  JOD: { label: "الأردن",    symbol: "د.أ",  perSAR: 0.189,  flag: "🇯🇴" },
  MAD: { label: "المغرب",    symbol: "د.م",  perSAR: 2.65,   flag: "🇲🇦" },
  TND: { label: "تونس",      symbol: "د.ت",  perSAR: 0.84,   flag: "🇹🇳" },
  USD: { label: "الولايات المتحدة", symbol: "$", perSAR: 0.267, flag: "🇺🇸" },
  EUR: { label: "أوروبا",    symbol: "€",    perSAR: 0.247,  flag: "🇪🇺" },
  GBP: { label: "بريطانيا",  symbol: "£",    perSAR: 0.211,  flag: "🇬🇧" },
};

// ---------- Live FX overlay (24h client cache) ----------
const FX_CACHE_KEY = "badel:fx-live";
const FX_TTL_MS = 24 * 60 * 60 * 1000;

/** Apply live perSAR rates onto FX_VS_SAR in-place. Safe to call repeatedly. */
export function applyLiveFx(perSAR: Record<string, number>) {
  for (const [code, rate] of Object.entries(perSAR)) {
    if (FX_VS_SAR[code] && Number(rate) > 0) FX_VS_SAR[code].perSAR = Number(rate);
  }
}
export function loadCachedFx(): { perSAR: Record<string, number>; fetchedAt: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(FX_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.fetchedAt || Date.now() - parsed.fetchedAt > FX_TTL_MS) return null;
    return parsed;
  } catch { return null; }
}
export function saveCachedFx(perSAR: Record<string, number>, fetchedAt: number) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(FX_CACHE_KEY, JSON.stringify({ perSAR, fetchedAt })); } catch { /* ignore */ }
}

/** Fire a same-tab event so subscribed price components re-render. */
export function notifyFxUpdated(meta: { source: string; fetchedAt: number }) {
  if (typeof window === "undefined") return;
  try { window.dispatchEvent(new CustomEvent("badel:fx-updated", { detail: meta })); } catch { /* ignore */ }
}


export const COUNTRY_STORAGE_KEY = "badel:country";

export function detectCountry(): string {
  if (typeof navigator === "undefined") return "SAR";
  const langs = [
    navigator.language || "",
    ...(Array.isArray((navigator as any).languages) ? (navigator as any).languages : []),
  ].join(",").toLowerCase();
  // Launch scope: Saudi Arabia + Egypt only. Everything else defaults to SAR.
  if (/(^|[,\-_])eg([,\-_]|$)|ar-eg|egypt/i.test(langs)) return "EGP";
  // Timezone hint (Cairo / Africa/Cairo)
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (/cairo/i.test(tz)) return "EGP";
  } catch { /* ignore */ }
  return "SAR";
}

export function hasSavedCountry(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const saved = localStorage.getItem(COUNTRY_STORAGE_KEY);
    return saved === "SAR" || saved === "EGP";
  } catch { return false; }
}

export function loadCountry(): string {
  if (typeof window === "undefined") return "SAR";
  try {
    const saved = localStorage.getItem(COUNTRY_STORAGE_KEY);
    if (saved === "SAR" || saved === "EGP") return saved;
  } catch { /* ignore */ }
  return detectCountry();
}

export function saveCountry(code: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(COUNTRY_STORAGE_KEY, code);
    // Same-tab listeners (LocalPrice, filters) — 'storage' only fires in *other* tabs.
    window.dispatchEvent(new CustomEvent("badel:country-changed", { detail: code }));
  } catch { /* ignore */ }
}


export function diToLocal(di: number, code: string): number {
  const fx = FX_VS_SAR[code] ?? FX_VS_SAR.SAR;
  return di * DI_TO_SAR * fx.perSAR;
}

export function sarToLocal(sar: number, code: string): number {
  const fx = FX_VS_SAR[code] ?? FX_VS_SAR.SAR;
  return sar * fx.perSAR;
}
