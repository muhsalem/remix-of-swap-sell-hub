import { createServerFn } from "@tanstack/react-start";

/**
 * Live FX rates relative to SAR.
 * Returns { perSAR: { USD: 0.267, EUR: 0.247, ... }, source, fetchedAt }.
 *
 * Uses open.er-api.com (free, no API key). If the network fetch fails,
 * the client keeps its static defaults from `currency-fx.ts`.
 */
export const getLiveFx = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/SAR", {
      headers: { "accept": "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as {
      result: string;
      rates: Record<string, number>;
      time_last_update_unix?: number;
    };
    if (json.result !== "success" || !json.rates) {
      throw new Error("invalid response");
    }
    // Pick only the currencies the UI knows about
    const wanted = ["SAR","AED","KWD","QAR","BHD","OMR","EGP","JOD","MAD","TND","USD","EUR","GBP"] as const;
    const perSAR: Record<string, number> = {};
    for (const c of wanted) {
      const v = Number(json.rates[c]);
      if (v > 0) perSAR[c] = v;
    }
    return {
      perSAR,
      source: "open.er-api.com",
      fetchedAt: (json.time_last_update_unix ?? Math.floor(Date.now() / 1000)) * 1000,
    };
  } catch (e: any) {
    return { perSAR: {} as Record<string, number>, source: "fallback", fetchedAt: Date.now(), error: String(e?.message ?? e) };
  }
});
