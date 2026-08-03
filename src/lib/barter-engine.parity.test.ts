// Differential parity suite: the React pricing engine (src/lib/barter-engine.ts)
// MUST produce byte-identical numbers to the reference standalone engine
// (public/pricing-engine/app.js — the one shown in the design reference).
//
// We load the reference file's pure logic (data tables + BarterEngine class +
// model-name helpers) into a Node VM and run thousands of randomized and
// hand-picked cases through both implementations.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

import {
  COUNTRIES,
  CATEGORIES,
  MULTIPLIERS,
  COUNTRY_CODES,
  INVENTORY,
  valueGood,
  valueService,
  getCountryPrice,
  compareCountries,
  checkSharia,
  solveCompatibility,
  proximityScore,
  areIdenticalModels,
} from "./barter-engine";

// ── Load the reference engine ───────────────────────────────────────────────
const src = readFileSync(resolve(process.cwd(), "public/pricing-engine/app.js"), "utf8");
const lines = src.split("\n");
// 1..629 = data tables + BarterEngine + inventory valuation loop
// 817..856 = normalizeModelName / areIdenticalModels (used by solveCompatibility)
const logic = [...lines.slice(816, 856), ...lines.slice(0, 629)].join("\n");

const sandbox: any = { window: {}, console };
vm.createContext(sandbox);
vm.runInContext(
  `${logic}
  globalThis.__ref = { BarterEngine, COUNTRIES, BARTER_CATEGORIES, IMPORT_DUTIES, MULTIPLIERS, SAMPLE_INVENTORY, getProximityScore, areIdenticalModels };`,
  sandbox,
);
const ref = sandbox.__ref;

// ── Deterministic PRNG so failures are reproducible ─────────────────────────
let seed = 1337;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
const between = (a: number, b: number) => a + rnd() * (b - a);

const conditionKeys = Object.keys(MULTIPLIERS.condition);
const demandKeys = Object.keys(MULTIPLIERS.demand);
const complexityKeys = Object.keys(MULTIPLIERS.complexity);
const experienceKeys = Object.keys(MULTIPLIERS.experience);
const categoryKeys = Object.keys(CATEGORIES);
const subKeysOf = (cat: string) => Object.keys(CATEGORIES[cat]?.subcategories ?? {});

// ── 1. Data tables must be identical ────────────────────────────────────────
describe("reference data parity", () => {
  it("countries table matches the reference exactly", () => {
    expect(COUNTRIES).toEqual(ref.COUNTRIES);
    expect(COUNTRY_CODES).toEqual(Object.keys(ref.COUNTRIES));
  });

  it("categories, subcategories, depreciation rates and liquidity match", () => {
    expect(CATEGORIES).toEqual(ref.BARTER_CATEGORIES);
  });

  it("multiplier tables (condition/demand/complexity/experience) match", () => {
    expect(MULTIPLIERS).toEqual(ref.MULTIPLIERS);
  });

  it("every category has an import-duty entry consistent with the reference", () => {
    for (const cat of categoryKeys) {
      for (const code of COUNTRY_CODES) {
        expect(getCountryPrice(1000, code, cat).dutyFactor).toBe(
          ref.BarterEngine.getCountryPrice(1000, code, cat).dutyFactor,
        );
      }
    }
  });

  it("sample inventory values match the reference (post-valuation)", () => {
    expect(INVENTORY.length).toBe(ref.SAMPLE_INVENTORY.length);
    for (let i = 0; i < INVENTORY.length; i++) {
      const mine = INVENTORY[i] as any;
      const theirs = ref.SAMPLE_INVENTORY[i];
      expect(mine.id).toBe(theirs.id);
      expect(mine.value).toBe(theirs.value);
      const sub = ref.BARTER_CATEGORIES[theirs.category]?.subcategories?.[theirs.subcategory];
      expect(mine.liquidity).toBe(sub?.liquidity ?? 0.6);
    }
  });
});

// ── 2. Goods valuation (all 3 depreciation models) ──────────────────────────
describe("valueGood parity", () => {
  it("matches across 3000 randomized goods (all categories/conditions/demands)", () => {
    for (let i = 0; i < 3000; i++) {
      const cat = pick(categoryKeys);
      const subs = subKeysOf(cat);
      if (!subs.length) continue;
      const sub = pick(subs);
      const p = {
        basePrice: Math.round(between(0, 250_000)),
        ageYears: Math.round(between(0, 60) * 10) / 10,
        deprRate: (CATEGORIES[cat].subcategories as any)[sub].deprRate,
        conditionKey: pick(conditionKeys),
        demandKey: pick(demandKeys),
        inflationRate: between(0, 0.4),
      };
      const mine = valueGood(p);
      const theirs = ref.BarterEngine.valueGood(p);
      expect(mine.finalValue, JSON.stringify(p)).toBe(theirs.finalValue);
      expect(mine.deprModel).toBe(theirs.deprModel);
      expect(mine.inflationAdjustedBase).toBe(theirs.inflationAdjustedBase);
      expect(mine.depreciatedValue).toBe(theirs.depreciatedValue);
      expect(mine.conditionFactor).toBe(theirs.conditionFactor);
      expect(mine.demandFactor).toBe(theirs.demandFactor);
    }
  });

  it("hits every depreciation model explicitly (appreciation / rapid decay / declining)", () => {
    const cases = [
      { deprRate: -0.05, label: "appreciation" },
      { deprRate: -0.5, label: "appreciation" }, // 4× cap territory
      { deprRate: 0.9, label: "rapid_decay" }, // 1% floor territory
      { deprRate: 0.25, label: "declining_balance" }, // 10% floor territory
    ];
    for (const c of cases) {
      for (const age of [0, 0.5, 1, 5, 15, 30, 45, 100]) {
        const p = {
          basePrice: 10_000,
          ageYears: age,
          deprRate: c.deprRate,
          conditionKey: "good",
          demandKey: "normal",
          inflationRate: 0.03,
        };
        const mine = valueGood(p);
        expect(mine.deprModel).toBe(c.label);
        expect(mine.finalValue).toBe(ref.BarterEngine.valueGood(p).finalValue);
      }
    }
  });

  it("degenerate inputs (0 / NaN / missing keys) behave identically", () => {
    const cases = [
      { basePrice: 0, ageYears: 0, deprRate: 0, conditionKey: "x", demandKey: "y", inflationRate: 0 },
      { basePrice: NaN, ageYears: NaN, deprRate: NaN, conditionKey: "", demandKey: "", inflationRate: NaN },
      { basePrice: 1, ageYears: 0, deprRate: 0.5, conditionKey: "new", demandKey: "high", inflationRate: 0 },
    ] as any[];
    for (const p of cases) {
      expect(valueGood(p).finalValue).toBe(ref.BarterEngine.valueGood(p).finalValue);
      expect(valueGood(p).deprModel).toBe(ref.BarterEngine.valueGood(p).deprModel);
    }
  });
});

// ── 3. Services valuation ───────────────────────────────────────────────────
describe("valueService parity", () => {
  it("matches across 2000 randomized services", () => {
    for (let i = 0; i < 2000; i++) {
      const p = {
        hourlyRate: Math.round(between(0, 500)),
        hours: Math.round(between(0, 2000)),
        complexityKey: pick(complexityKeys),
        experienceKey: pick(experienceKeys),
      };
      const mine = valueService(p);
      const theirs = ref.BarterEngine.valueService(p);
      expect(mine.finalValue, JSON.stringify(p)).toBe(theirs.finalValue);
      expect(mine.baseCost).toBe(theirs.baseCost);
      expect(mine.complexityFactor).toBe(theirs.complexityFactor);
      expect(mine.experienceFactor).toBe(theirs.experienceFactor);
    }
  });

  it("falls back to 30/hr × 10h and 1.0 multipliers like the reference", () => {
    const p = { hourlyRate: 0, hours: 0, complexityKey: "nope", experienceKey: "nope" } as any;
    expect(valueService(p).finalValue).toBe(ref.BarterEngine.valueService(p).finalValue);
    expect(valueService(p).finalValue).toBe(300);
  });
});

// ── 4. Country pricing & comparison ─────────────────────────────────────────
describe("country pricing parity", () => {
  it("matches for every country × category over a value sweep", () => {
    const values = [0, 1, 99.99, 500, 1234.56, 100_000];
    for (const code of COUNTRY_CODES) {
      for (const cat of categoryKeys) {
        for (const v of values) {
          const mine = getCountryPrice(v, code, cat);
          const theirs = ref.BarterEngine.getCountryPrice(v, code, cat);
          expect(mine.local, `${code}/${cat}/${v}`).toBe(theirs.local);
          expect(mine.usd).toBe(theirs.usd);
          expect(mine.affordability).toBe(theirs.affordability);
          expect(mine.exchangeRate).toBe(theirs.exchangeRate);
          expect(mine.currency).toBe(theirs.currency);
          expect(mine.symbol).toBe(theirs.symbol);
          expect(mine.dutyFactor).toBe(theirs.dutyFactor);
        }
      }
    }
  });

  it("unknown country falls back identically", () => {
    const mine = getCountryPrice(500, "ZZ", "electronics");
    const theirs = ref.BarterEngine.getCountryPrice(500, "ZZ", "electronics");
    expect(mine.local).toBe(theirs.local);
    expect(mine.usd).toBe(theirs.usd);
    expect(mine.currency).toBe(theirs.currency);
  });

  it("EG vs SA comparison (the reference's headline pair) matches for all categories", () => {
    for (const cat of categoryKeys) {
      for (const v of [200, 1500, 9000]) {
        const mine = compareCountries(v, "EG", "SA", cat);
        const theirs = ref.BarterEngine.compareCountries(v, "EG", "SA", cat);
        expect(mine.diffPct, `${cat}/${v}`).toBe(theirs.diffPct);
        expect(mine.betterDeal).toBe(theirs.betterDeal);
        expect(mine.a.local).toBe(theirs.a.local);
        expect(mine.b.local).toBe(theirs.b.local);
      }
    }
  });

  it("every country pair comparison matches", () => {
    for (const a of COUNTRY_CODES) {
      for (const b of COUNTRY_CODES) {
        const mine = compareCountries(2500, a, b, "electronics");
        const theirs = ref.BarterEngine.compareCountries(2500, a, b, "electronics");
        expect(mine.diffPct, `${a}->${b}`).toBe(theirs.diffPct);
        expect(mine.betterDeal).toBe(theirs.betterDeal);
      }
    }
  });

  it("zero value comparison yields diff 0 / equal in both engines", () => {
    const mine = compareCountries(0, "EG", "SA", "electronics");
    const theirs = ref.BarterEngine.compareCountries(0, "EG", "SA", "electronics");
    expect(mine.diffPct).toBe(theirs.diffPct);
    expect(mine.betterDeal).toBe(theirs.betterDeal);
  });
});

// ── 5. Sharia compliance ────────────────────────────────────────────────────
describe("sharia compliance parity", () => {
  const allSubs: { cat: string; sub: string }[] = [];
  for (const cat of categoryKeys) for (const sub of subKeysOf(cat)) allSubs.push({ cat, sub });

  it("rating + warning types match for every subcategory pair", () => {
    for (const A of allSubs) {
      for (const B of allSubs) {
        for (const [tA, tB] of [
          ["good", "good"],
          ["good", "service"],
          ["service", "service"],
        ] as const) {
          for (const [vA, vB] of [
            [1000, 1000],
            [1000, 1500],
          ]) {
            const a = { type: tA, subcategory: A.sub, value: vA };
            const b = { type: tB, subcategory: B.sub, value: vB };
            const mine = checkSharia(a, b);
            const theirs = ref.BarterEngine.checkShariaCompliance(a, b);
            const label = `${A.sub}/${B.sub}/${tA}-${tB}/${vA}-${vB}`;
            expect(mine.isCompliant, label).toBe(theirs.isCompliant);
            expect(mine.rating, label).toBe(theirs.rating);
            expect(mine.warnings.map((w) => w.type), label).toEqual(
              theirs.warnings.map((w: any) => w.type),
            );
            expect(mine.warnings.map((w) => w.severity), label).toEqual(
              theirs.warnings.map((w: any) => w.severity),
            );
          }
        }
      }
    }
  });

  it("Arabic warning text matches the reference textAr strings", () => {
    const a = { type: "good", subcategory: "jewelry", value: 1000 };
    const b = { type: "good", subcategory: "jewelry", value: 1200 };
    const mine = checkSharia(a, b);
    const theirs = ref.BarterEngine.checkShariaCompliance(a, b);
    expect(mine.warnings.map((w) => w.text)).toEqual(theirs.warnings.map((w: any) => w.textAr));
  });

  it("known cases: gold↔gold = needs_review, gold↔dairy = conditions, phone↔laptop = halal", () => {
    expect(checkSharia(
      { type: "good", subcategory: "jewelry", value: 100 },
      { type: "good", subcategory: "jewelry", value: 100 },
    ).rating).toBe("needs_review");
    expect(checkSharia(
      { type: "good", subcategory: "jewelry", value: 100 },
      { type: "good", subcategory: "dairy", value: 100 },
    ).rating).toBe("halal_with_conditions");
    expect(checkSharia(
      { type: "good", subcategory: "phones", value: 100 },
      { type: "good", subcategory: "laptops", value: 100 },
    ).rating).toBe("halal");
  });
});

// ── 6. Compatibility solver ─────────────────────────────────────────────────
describe("compatibility solver parity", () => {
  const mkAsset = (i: number) => {
    const cat = pick(categoryKeys);
    const subs = subKeysOf(cat);
    const sub = subs.length ? pick(subs) : "";
    return {
      type: (rnd() > 0.3 ? "good" : "service") as "good" | "service",
      name: pick(["iPhone 15 Pro Max 256GB", "ايفون 15 برو ماكس 256 جيجا", `Item-${i}`, "Toyota Corolla"]),
      category: cat,
      subcategory: sub,
      value: Math.round(between(0, 80_000)),
      liquidity: Math.round(between(0.2, 1) * 100) / 100,
      desiredCategory: rnd() > 0.5 ? pick(categoryKeys) : "",
      countryCode: pick([...COUNTRY_CODES, ""]),
    };
  };

  it("matches across 3000 randomized asset pairs", () => {
    for (let i = 0; i < 3000; i++) {
      const A = mkAsset(i);
      const B = mkAsset(i + 1);
      const mine = solveCompatibility(A as any, B as any);
      const theirs = ref.BarterEngine.solveCompatibility(A, B);
      const label = JSON.stringify({ A, B });
      expect(mine.valueScore, label).toBe(theirs.valueScore);
      expect(mine.categoryScore, label).toBe(theirs.categoryScore);
      expect(mine.totalScore, label).toBe(theirs.totalScore);
      expect(mine.cashOffset, label).toBe(theirs.cashOffset);
      expect(mine.offsetPayer, label).toBe(theirs.offsetPayer);
      expect(mine.categoryMatchA, label).toBe(theirs.categoryMatchA);
      expect(mine.categoryMatchB, label).toBe(theirs.categoryMatchB);
      expect(mine.feasibility, label).toBe(theirs.feasibility);
      expect(mine.transactionFee, label).toBe(theirs.transactionFee);
      expect(mine.shippingFee, label).toBe(theirs.shippingFee);
      expect(mine.avgLiquidity, label).toBe(theirs.avgLiquidity);
      expect(mine.isIdenticalModel, label).toBe(theirs.isIdenticalModel);
    }
  });

  it("velocity label maps to the reference's fast/moderate/slow buckets", () => {
    const cases = [
      { liq: 0.95, ar: "سريعة", en: "fast" },
      { liq: 0.8, ar: "سريعة", en: "fast" },
      { liq: 0.7, ar: "متوسطة", en: "moderate" },
      { liq: 0.55, ar: "متوسطة", en: "moderate" },
      { liq: 0.4, ar: "بطيئة", en: "slow" },
    ];
    for (const c of cases) {
      const A: any = { type: "good", name: "A", category: "electronics", subcategory: "phones", value: 1000, liquidity: c.liq, countryCode: "EG" };
      const B: any = { ...A, name: "B", liquidity: c.liq };
      expect(solveCompatibility(A, B).velocity).toBe(c.ar);
      expect(ref.BarterEngine.solveCompatibility(A, B).velocity).toBe(c.en);
    }
  });

  it("identical-model detection (EN/AR variants) matches the reference", () => {
    const pairs: [string, string][] = [
      ["iPhone 15 Pro Max 256GB", "ايفون 15 برو ماكس 256 جيجا"],
      ["iPhone 15 Pro", "iPhone 15 Pro 512GB"],
      ["iPhone 15", "iPhone 14"],
      ["Samsung S24", "سامسونج S24"],
      ["", "iPhone 15"],
    ];
    for (const [x, y] of pairs) {
      expect(areIdenticalModels(x, y), `${x} vs ${y}`).toBe(ref.areIdenticalModels(x, y));
    }
  });

  it("cross-border shipping fees match for every country pair and both asset types", () => {
    for (const ca of COUNTRY_CODES) {
      for (const cb of COUNTRY_CODES) {
        for (const type of ["good", "service"] as const) {
          const A: any = { type: "good", name: "A", category: "electronics", subcategory: "phones", value: 2000, liquidity: 0.7, countryCode: ca };
          const B: any = { type, name: "B", category: "electronics", subcategory: "phones", value: 3000, liquidity: 0.7, countryCode: cb };
          expect(solveCompatibility(A, B).shippingFee, `${ca}->${cb}/${type}`).toBe(
            ref.BarterEngine.solveCompatibility(A, B).shippingFee,
          );
          expect(proximityScore(ca, cb)).toBe(ref.getProximityScore(ca, cb));
        }
      }
    }
  });

  it("zero-value pair does not divide by zero in either engine", () => {
    const A: any = { type: "good", name: "A", category: "electronics", subcategory: "phones", value: 0, liquidity: 0.6, countryCode: "EG" };
    const B: any = { ...A, name: "B" };
    const mine = solveCompatibility(A, B);
    const theirs = ref.BarterEngine.solveCompatibility(A, B);
    expect(mine.totalScore).toBe(theirs.totalScore);
    expect(mine.feasibility).toBe(theirs.feasibility);
    expect(mine.cashOffset).toBe(0);
  });
});

// ── 7. End-to-end flows exactly as the UI runs them ─────────────────────────
describe("end-to-end pricing flows parity", () => {
  it("valuate → country compare → match, for every inventory item against every other", () => {
    const items = ref.SAMPLE_INVENTORY;
    for (let i = 0; i < items.length; i++) {
      for (let j = 0; j < items.length; j++) {
        const A = items[i];
        const B = items[j];
        const mineA = INVENTORY[i] as any;
        const mineB = INVENTORY[j] as any;

        // 1) valuation parity already asserted; re-check via country pricing
        for (const code of ["EG", "SA"]) {
          expect(getCountryPrice(mineA.value, code, mineA.category).local).toBe(
            ref.BarterEngine.getCountryPrice(A.value, code, A.category).local,
          );
        }

        // 2) compatibility parity on the real inventory
        const buildA = { ...A, liquidity: mineA.liquidity, countryCode: "EG" };
        const buildB = { ...B, liquidity: mineB.liquidity, countryCode: "SA" };
        const mine = solveCompatibility(buildA as any, buildB as any);
        const theirs = ref.BarterEngine.solveCompatibility(buildA, buildB);
        expect(mine.totalScore, `${A.id} <-> ${B.id}`).toBe(theirs.totalScore);
        expect(mine.cashOffset).toBe(theirs.cashOffset);
        expect(mine.transactionFee).toBe(theirs.transactionFee);
        expect(mine.shippingFee).toBe(theirs.shippingFee);

        // 3) sharia parity on the real inventory
        const sMine = checkSharia(A as any, B as any);
        const sRef = ref.BarterEngine.checkShariaCompliance(A, B);
        expect(sMine.rating).toBe(sRef.rating);
      }
    }
  });
});
