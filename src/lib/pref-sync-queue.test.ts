// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mocks must be declared before importing the module under test.
const setPreferredCountryMock = vi.fn();
vi.mock("@/lib/currency-pref.functions", () => ({
  setPreferredCountry: (args: unknown) => setPreferredCountryMock(args),
}));
vi.mock("@/lib/currency-fx", () => ({ saveCountry: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: async () => ({ data: { user: { id: "u1" } }, error: null }),
    },
  },
}));

import {
  queuePreferredCountry,
  flushPrefSyncQueue,
  getPendingPrefSync,
  MAX_PREF_SYNC_ATTEMPTS,
} from "./pref-sync-queue";

describe("pref-sync-queue: reset on success", () => {
  beforeEach(() => {
    localStorage.clear();
    setPreferredCountryMock.mockReset();
    vi.useFakeTimers();
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  });

  it("keeps attempts/nextRetryAt after a failed sync", async () => {
    setPreferredCountryMock.mockRejectedValueOnce(new Error("server 500"));
    await queuePreferredCountry("SAR");
    const entry = getPendingPrefSync();
    expect(entry).not.toBeNull();
    expect(entry!.attempts).toBe(1);
    expect(entry!.nextRetryAt).toBeTruthy();
    expect(entry!.lastError).toContain("server 500");
    expect(entry!.attempts).toBeLessThanOrEqual(MAX_PREF_SYNC_ATTEMPTS);
  });

  it("clears the entry (attempts=0, nextRetryAt=undefined) after success", async () => {
    // First attempt fails, second succeeds.
    setPreferredCountryMock.mockRejectedValueOnce(new Error("boom"));
    await queuePreferredCountry("SAR");
    let entry = getPendingPrefSync();
    expect(entry?.attempts).toBe(1);
    expect(entry?.nextRetryAt).toBeTruthy();

    setPreferredCountryMock.mockResolvedValueOnce(undefined);
    await flushPrefSyncQueue("test_retry");

    // On success the whole queue entry is removed → counters are back to
    // the initial state.
    expect(getPendingPrefSync()).toBeNull();
  });

  it("a new queuePreferredCountry after success starts fresh at attempts=0", async () => {
    setPreferredCountryMock.mockRejectedValueOnce(new Error("boom"));
    await queuePreferredCountry("SAR");
    expect(getPendingPrefSync()?.attempts).toBe(1);

    setPreferredCountryMock.mockResolvedValueOnce(undefined);
    await flushPrefSyncQueue("recover");
    expect(getPendingPrefSync()).toBeNull();

    // Next queue starts clean.
    setPreferredCountryMock.mockRejectedValueOnce(new Error("later"));
    await queuePreferredCountry("EGP");
    const entry = getPendingPrefSync();
    expect(entry?.country).toBe("EGP");
    expect(entry?.attempts).toBe(1); // first failure of the fresh cycle, not 2
  });
});
