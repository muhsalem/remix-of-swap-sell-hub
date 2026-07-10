import { describe, it, expect, beforeEach, vi } from "vitest";

// Minimal window/localStorage stub so currency-fx thinks it's in a browser.
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}

const target = new EventTarget();
(globalThis as any).window = Object.assign(target, {
  addEventListener: target.addEventListener.bind(target),
  removeEventListener: target.removeEventListener.bind(target),
  dispatchEvent: target.dispatchEvent.bind(target),
});
(globalThis as any).localStorage = new MemStorage();
const navStub = { language: "ar-SA" };
Object.defineProperty(globalThis, "navigator", { value: navStub, configurable: true, writable: true });
const setLang = (l: string) => { navStub.language = l; };

import {
  FX_VS_SAR,
  sarToLocal,
  diToLocal,
  DI_TO_SAR,
  saveCountry,
  loadCountry,
  detectCountry,
  applyLiveFx,
  COUNTRY_STORAGE_KEY,
} from "./currency-fx";

beforeEach(() => {
  (globalThis as any).localStorage.clear();
});

describe("currency conversion SAR ↔ EGP", () => {
  it("sarToLocal returns the same value for SAR", () => {
    expect(sarToLocal(100, "SAR")).toBeCloseTo(100, 5);
  });

  it("sarToLocal converts SAR → EGP using perSAR rate", () => {
    const rate = FX_VS_SAR.EGP.perSAR;
    expect(sarToLocal(100, "EGP")).toBeCloseTo(100 * rate, 5);
  });

  it("diToLocal converts DI → SAR (1 DI = 5 SAR)", () => {
    expect(diToLocal(2, "SAR")).toBeCloseTo(2 * DI_TO_SAR, 5);
  });

  it("diToLocal converts DI → EGP", () => {
    const rate = FX_VS_SAR.EGP.perSAR;
    expect(diToLocal(3, "EGP")).toBeCloseTo(3 * DI_TO_SAR * rate, 5);
  });

  it("falls back to SAR for unknown currency codes", () => {
    expect(sarToLocal(50, "ZZZ")).toBeCloseTo(50, 5);
    expect(diToLocal(1, "ZZZ")).toBeCloseTo(DI_TO_SAR, 5);
  });

  it("applyLiveFx overrides rates and reflects in conversions", () => {
    const original = FX_VS_SAR.EGP.perSAR;
    try {
      applyLiveFx({ EGP: 20 });
      expect(FX_VS_SAR.EGP.perSAR).toBe(20);
      expect(sarToLocal(10, "EGP")).toBeCloseTo(200, 5);
    } finally {
      applyLiveFx({ EGP: original });
    }
  });

  it("applyLiveFx ignores invalid / zero rates", () => {
    const original = FX_VS_SAR.EGP.perSAR;
    applyLiveFx({ EGP: 0, UNKNOWN: 999 } as any);
    expect(FX_VS_SAR.EGP.perSAR).toBe(original);
    expect(FX_VS_SAR).not.toHaveProperty("UNKNOWN");
  });
});

describe("country persistence", () => {
  it("detectCountry defaults to SAR for ar-SA", () => {
    (globalThis as any).navigator.language = "ar-SA";
    expect(detectCountry()).toBe("SAR");
  });

  it("detectCountry returns EGP for ar-EG locale", () => {
    (globalThis as any).navigator.language = "ar-EG";
    expect(detectCountry()).toBe("EGP");
  });

  it("saveCountry / loadCountry roundtrip via localStorage", () => {
    saveCountry("EGP");
    expect(localStorage.getItem(COUNTRY_STORAGE_KEY)).toBe("EGP");
    expect(loadCountry()).toBe("EGP");

    saveCountry("SAR");
    expect(loadCountry()).toBe("SAR");
  });

  it("loadCountry ignores invalid stored values and falls back to detection", () => {
    localStorage.setItem(COUNTRY_STORAGE_KEY, "USD");
    (globalThis as any).navigator.language = "ar-SA";
    expect(loadCountry()).toBe("SAR");
  });
});

describe("badel:country-changed event", () => {
  it("saveCountry dispatches badel:country-changed with the new code", () => {
    const spy = vi.fn();
    window.addEventListener("badel:country-changed", spy as EventListener);
    saveCountry("EGP");
    expect(spy).toHaveBeenCalledTimes(1);
    const evt = spy.mock.calls[0][0] as CustomEvent;
    expect(evt.type).toBe("badel:country-changed");
    expect(evt.detail).toBe("EGP");
    window.removeEventListener("badel:country-changed", spy as EventListener);
  });

  it("listeners re-read country via loadCountry on event (simulates re-render)", () => {
    const reads: string[] = [];
    const listener = () => { reads.push(loadCountry()); };
    window.addEventListener("badel:country-changed", listener as EventListener);

    saveCountry("EGP");
    saveCountry("SAR");
    saveCountry("EGP");

    expect(reads).toEqual(["EGP", "SAR", "EGP"]);
    window.removeEventListener("badel:country-changed", listener as EventListener);
  });

  it("switching country changes what sarToLocal renders (price re-computation)", () => {
    const renderPrice = () => sarToLocal(100, loadCountry());
    const seen: number[] = [];
    const listener = () => { seen.push(renderPrice()); };
    window.addEventListener("badel:country-changed", listener as EventListener);

    saveCountry("SAR");
    saveCountry("EGP");

    expect(seen[0]).toBeCloseTo(100, 5);
    expect(seen[1]).toBeCloseTo(100 * FX_VS_SAR.EGP.perSAR, 5);
    window.removeEventListener("badel:country-changed", listener as EventListener);
  });

  it("removing the listener stops further updates (cleanup contract)", () => {
    const spy = vi.fn();
    window.addEventListener("badel:country-changed", spy as EventListener);
    saveCountry("EGP");
    window.removeEventListener("badel:country-changed", spy as EventListener);
    saveCountry("SAR");
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
