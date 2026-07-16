/**
 * Offline-tolerant sync queue for the user's preferred country.
 *
 * Behavior:
 *  - `queuePreferredCountry(country)` always persists locally (via saveCountry),
 *    then attempts an immediate server sync when signed-in and online.
 *  - On failure or offline, the pending value is stored in localStorage and
 *    replayed automatically when the browser fires `online`, on visibility
 *    change, or on next app load. Retries use exponential backoff (max 5).
 *  - Emits `badel:pref-sync` CustomEvents with { status, country, error? }
 *    so UIs can reflect queued / syncing / synced / failed states.
 *  - Observability: each stage is tracked via analytics `track()`.
 */
import { saveCountry } from "@/lib/currency-fx";
import { setPreferredCountry } from "@/lib/currency-pref.functions";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";

const QUEUE_KEY = "badel:pref-sync-queue";
const EVENT = "badel:pref-sync";

export type SyncCountry = "SAR" | "EGP";
export type SyncStatus = "queued" | "syncing" | "synced" | "failed" | "offline";

export const MAX_PREF_SYNC_ATTEMPTS = 5;

export type QueueEntry = {
  country: SyncCountry;
  queuedAt: string; // ISO
  attempts: number;
  lastError?: string;
  nextRetryAt?: string; // ISO — when the next automatic retry is scheduled
};

function readQueue(): QueueEntry | null {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as QueueEntry;
  } catch {
    return null;
  }
}

function writeQueue(entry: QueueEntry | null) {
  try {
    if (!entry) localStorage.removeItem(QUEUE_KEY);
    else localStorage.setItem(QUEUE_KEY, JSON.stringify(entry));
  } catch { /* ignore */ }
}

function emit(detail: { status: SyncStatus; country: SyncCountry; error?: string; lastSyncedAt?: string }) {
  try {
    window.dispatchEvent(new CustomEvent(EVENT, { detail }));
  } catch { /* ignore */ }
}

export function getPendingPrefSync(): QueueEntry | null {
  if (typeof window === "undefined") return null;
  return readQueue();
}

let flushing = false;
let backoffTimer: number | null = null;

async function isSignedIn(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getUser();
    return !!data.user;
  } catch {
    return false;
  }
}

/** Attempt to drain the queue. Safe to call anytime; no-ops when empty. */
export async function flushPrefSyncQueue(reason: string = "manual"): Promise<void> {
  if (typeof window === "undefined") return;
  if (flushing) return;
  const entry = readQueue();
  if (!entry) return;

  flushing = true;
  const t0 = performance.now();
  try {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      void track("pref_sync_flush", { stage: "offline", country: entry.country, reason });
      emit({ status: "offline", country: entry.country });
      return;
    }
    if (!(await isSignedIn())) {
      // Nothing we can do until they sign in — keep the entry.
      void track("pref_sync_flush", { stage: "guest", country: entry.country, reason });
      return;
    }

    emit({ status: "syncing", country: entry.country });
    void track("pref_sync_flush", { stage: "start", country: entry.country, reason, attempt: entry.attempts + 1 });

    await setPreferredCountry({ data: { country: entry.country } });

    const now = new Date().toISOString();
    writeQueue(null);
    emit({ status: "synced", country: entry.country, lastSyncedAt: now });
    void track("pref_sync_flush", {
      stage: "success",
      country: entry.country,
      reason,
      attempts: entry.attempts + 1,
      duration_ms: Math.round(performance.now() - t0),
    });
  } catch (err) {
    const message = (err as Error)?.message?.slice(0, 200) ?? "unknown";
    const attempts = entry.attempts + 1;
    writeQueue({ ...entry, attempts, lastError: message });
    emit({ status: "failed", country: entry.country, error: message });
    void track("pref_sync_flush", {
      stage: "error",
      country: entry.country,
      reason,
      attempts,
      error: message,
      duration_ms: Math.round(performance.now() - t0),
    });

    // Exponential backoff: 5s, 15s, 45s, 2m, 6m (capped at 5 retries here).
    if (attempts <= 5) {
      const delay = Math.min(5_000 * Math.pow(3, attempts - 1), 6 * 60_000);
      if (backoffTimer) window.clearTimeout(backoffTimer);
      backoffTimer = window.setTimeout(() => {
        backoffTimer = null;
        void flushPrefSyncQueue(`backoff_attempt_${attempts + 1}`);
      }, delay);
    }
  } finally {
    flushing = false;
  }
}

/**
 * Save the user's preferred country locally, and queue a server sync.
 * Always resolves — offline callers still get the local write.
 */
export async function queuePreferredCountry(country: SyncCountry): Promise<{ localSaved: true; synced: boolean }> {
  saveCountry(country);

  if (typeof window === "undefined") {
    return { localSaved: true, synced: false };
  }

  const entry: QueueEntry = {
    country,
    queuedAt: new Date().toISOString(),
    attempts: 0,
  };
  writeQueue(entry);
  emit({ status: "queued", country });
  void track("pref_sync_queue", { stage: "queued", country, online: navigator.onLine });

  await flushPrefSyncQueue("queue");
  return { localSaved: true, synced: readQueue() === null };
}

/** Wire retry triggers: browser online, tab focus, visibility change. */
export function initPrefSyncQueue() {
  if (typeof window === "undefined") return;
  const onOnline = () => { void flushPrefSyncQueue("online"); };
  const onVisible = () => {
    if (document.visibilityState === "visible") void flushPrefSyncQueue("visible");
  };
  const onFocus = () => { void flushPrefSyncQueue("focus"); };
  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onFocus);

  // Drain any leftover queue from a previous session.
  void flushPrefSyncQueue("boot");
}
