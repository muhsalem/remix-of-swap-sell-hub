// Capture and persist UTM/referrer data on landing so form submissions can attribute correctly.
const KEY = "bd_utm";
const KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "referral_code"] as const;

export type UtmData = Partial<Record<(typeof KEYS)[number], string>> & {
  landing_path?: string;
  captured_at?: string;
};

export function captureUtm(): UtmData {
  if (typeof window === "undefined") return {};
  try {
    const sp = new URLSearchParams(window.location.search);
    const captured: UtmData = {};
    for (const k of KEYS) {
      const v = sp.get(k) || sp.get(k.replace("utm_", ""));
      if (v) captured[k] = v.slice(0, 60);
    }
    // "ref" or "r" shortcuts for referral code
    const ref = sp.get("ref") || sp.get("r");
    if (ref && !captured.referral_code) captured.referral_code = ref.slice(0, 60);
    captured.landing_path = window.location.pathname;
    captured.captured_at = new Date().toISOString();

    const existing = readUtm();
    // Persist only if new params arrived — first-touch attribution wins
    if (!existing.captured_at || Object.keys(captured).some((k) => k.startsWith("utm_") && captured[k as keyof UtmData])) {
      sessionStorage.setItem(KEY, JSON.stringify(captured));
      return captured;
    }
    return existing;
  } catch {
    return {};
  }
}

export function readUtm(): UtmData {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as UtmData) : {};
  } catch {
    return {};
  }
}
