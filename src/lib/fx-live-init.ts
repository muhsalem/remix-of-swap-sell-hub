// Client-side orchestrator: hydrate FX from cache, refresh from server,
// retry with backoff on outage, refresh periodically + on focus/online,
// and broadcast a `badel:fx-updated` event so subscribed components re-render.

import {
  applyLiveFx,
  loadCachedFx,
  saveCachedFx,
  notifyFxUpdated,
} from "@/lib/currency-fx";
import { getLiveFx } from "@/lib/fx-live.functions";

const REFRESH_MS = 60 * 60 * 1000;      // background refresh every 1h
const STALE_MS   = 12 * 60 * 60 * 1000; // consider cache stale after 12h → refresh sooner
const MAX_BACKOFF_MS = 30 * 60 * 1000;  // cap retry backoff at 30min

let started = false;
let timer: number | undefined;
let backoff = 30_000; // 30s initial retry

async function refreshOnce(): Promise<boolean> {
  try {
    const r = await getLiveFx();
    if (r.source !== "fallback" && r.perSAR && Object.keys(r.perSAR).length >= 3) {
      applyLiveFx(r.perSAR);
      saveCachedFx(r.perSAR, r.fetchedAt);
      notifyFxUpdated({ source: r.source, fetchedAt: r.fetchedAt });
      backoff = 30_000;
      return true;
    }
  } catch { /* fall through to retry */ }
  return false;
}

function scheduleNext(ms: number) {
  if (typeof window === "undefined") return;
  window.clearTimeout(timer);
  timer = window.setTimeout(async () => {
    const ok = await refreshOnce();
    if (ok) scheduleNext(REFRESH_MS);
    else {
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
      scheduleNext(backoff);
    }
  }, ms) as unknown as number;
}

/** Idempotent — safe to call from root effect. */
export function initFxLive() {
  if (started || typeof window === "undefined") return;
  started = true;

  // 1) Hydrate synchronously from cache so first paint uses last-known rates.
  const cached = loadCachedFx();
  if (cached) {
    applyLiveFx(cached.perSAR);
    notifyFxUpdated({ source: "cache", fetchedAt: cached.fetchedAt });
  }

  // 2) Kick off first refresh: immediate if cache missing/stale, else in 5s.
  const age = cached ? Date.now() - cached.fetchedAt : Infinity;
  const initialDelay = age > STALE_MS ? 0 : 5_000;
  scheduleNext(initialDelay);

  // 3) Re-check when the tab regains focus or the network returns.
  const kick = () => scheduleNext(0);
  window.addEventListener("focus", kick);
  window.addEventListener("online", kick);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") kick();
  });
}
