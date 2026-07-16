import { createServerFn } from "@tanstack/react-start";

const WANTED = ["SAR","AED","KWD","QAR","BHD","OMR","EGP","JOD","MAD","TND","USD","EUR","GBP"] as const;

async function fromOpenErApi(): Promise<{ perSAR: Record<string, number>; fetchedAt: number } | null> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/SAR", {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      result?: string;
      rates?: Record<string, number>;
      time_last_update_unix?: number;
    };
    if (json.result !== "success" || !json.rates) return null;
    const perSAR: Record<string, number> = {};
    for (const c of WANTED) {
      const v = Number(json.rates[c]);
      if (v > 0) perSAR[c] = v;
    }
    if (Object.keys(perSAR).length < 3) return null;
    return { perSAR, fetchedAt: (json.time_last_update_unix ?? Math.floor(Date.now() / 1000)) * 1000 };
  } catch { return null; }
}

async function fromFrankfurter(): Promise<{ perSAR: Record<string, number>; fetchedAt: number } | null> {
  // Frankfurter (ECB-backed) — no SAR base, so ask USD→{SAR,...} then rebase to SAR.
  try {
    const symbols = WANTED.filter((c) => c !== "USD").join(",");
    const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=USD&symbols=${symbols},USD`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { date?: string; rates?: Record<string, number> };
    const usdRates = json.rates ?? {};
    const usdPerSar = Number(usdRates["SAR"]);
    if (!(usdPerSar > 0)) return null;
    const perSAR: Record<string, number> = { SAR: 1 };
    for (const c of WANTED) {
      if (c === "SAR") continue;
      const usd = c === "USD" ? 1 : Number(usdRates[c]);
      if (usd > 0) perSAR[c] = usd / usdPerSar;
    }
    if (Object.keys(perSAR).length < 3) return null;
    const fetchedAt = json.date ? Date.parse(json.date) : Date.now();
    return { perSAR, fetchedAt };
  } catch { return null; }
}

/**
 * Live FX rates relative to SAR, with automatic fallback across providers.
 * Providers tried in order: open.er-api.com → frankfurter.dev (ECB).
 * On total outage returns { source: "fallback", perSAR: {} } and the caller
 * keeps its cached / static defaults.
 */
export const getLiveFx = createServerFn({ method: "GET" }).handler(async () => {
  const providers: Array<{ name: string; run: () => Promise<{ perSAR: Record<string, number>; fetchedAt: number } | null> }> = [
    { name: "open.er-api.com", run: fromOpenErApi },
    { name: "frankfurter.dev", run: fromFrankfurter },
  ];
  for (const p of providers) {
    const r = await p.run();
    if (r && Object.keys(r.perSAR).length >= 3) {
      return { perSAR: r.perSAR, source: p.name, fetchedAt: r.fetchedAt };
    }
  }
  return { perSAR: {} as Record<string, number>, source: "fallback", fetchedAt: Date.now(), error: "all providers unavailable" };
});
