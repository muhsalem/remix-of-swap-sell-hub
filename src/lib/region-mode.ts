// Cash-only mode: hides DI / digital currency UI for users in legally restricted regions.
// Source of truth (server): public.region_settings table.
// Client convenience: localStorage override so users can opt-in/out manually.
import { FX_VS_SAR } from "@/lib/currency-fx";

const KEY = "badel:cashOnly";
export const RESTRICTED_COUNTRIES = new Set(["EGP", "JOD", "TND", "MAD"]);

export function isRestrictedCountry(code: string): boolean {
  return RESTRICTED_COUNTRIES.has(code);
}

export function loadCashOnly(country: string): boolean {
  if (typeof window === "undefined") return isRestrictedCountry(country);
  try {
    const v = localStorage.getItem(KEY);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch { /* ignore */ }
  return isRestrictedCountry(country);
}

export function saveCashOnly(on: boolean) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* ignore */ }
}

export function countryLabel(code: string): string {
  return FX_VS_SAR[code]?.label ?? code;
}
