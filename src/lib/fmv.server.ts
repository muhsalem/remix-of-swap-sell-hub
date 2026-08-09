/**
 * Fair Market Value (FMV) guard.
 * يمنع تضخيم السعر التاريخي عبر تقييد مدخل المستخدم داخل نطاق مرجعي.
 */

export type PriceSource = "user" | "user_clamped" | "fmv_reference" | "ai_estimate";

export type FmvResult = {
  price: number;
  input: number;
  reference: number | null;
  source: PriceSource;
  deviationPct: number | null;
  clamped: boolean;
  note: string | null;
};

/** الحد الأقصى المسموح للانحراف عن المرجع */
export const FMV_MAX_ABOVE = 1.5; // 150% من المرجع
export const FMV_MIN_BELOW = 0.4; // 40% من المرجع

export function normalizeTitleKey(title: string) {
  return title.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 180);
}

function median(nums: number[]) {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** يزيل القيم الشاذّة (خارج 1.5×IQR) حتى لا تُستخدم أسعار متضخّمة كمرجع */
function robust(nums: number[]) {
  if (nums.length < 4) return nums;
  const s = [...nums].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))];
  const q1 = q(0.25), q3 = q(0.75);
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr, hi = q3 + 1.5 * iqr;
  const kept = s.filter((n) => n >= lo && n <= hi);
  return kept.length >= 3 ? kept : s;
}

type Db = {
  from: (t: string) => any;
};

/**
 * يحسب المرجع من: market_price_cache (تقدير حيّ) ثم price_history ثم إعلانات نشطة مشابهة.
 */
export async function resolveFmvReference(
  db: Db,
  opts: { category: string; title: string; country?: string },
): Promise<{ reference: number | null; refSource: string | null }> {
  const key = normalizeTitleKey(opts.title);

  try {
    const { data } = await db
      .from("market_price_cache")
      .select("price_sar")
      .eq("category", opts.category)
      .eq("title_key", key)
      .eq("country", opts.country ?? "SA")
      .maybeSingle();
    const p = Number(data?.price_sar);
    if (Number.isFinite(p) && p > 0) return { reference: p, refSource: "market_price_cache" };
  } catch { /* ignore */ }

  try {
    const { data } = await db
      .from("price_history")
      .select("price")
      .eq("category", opts.category)
      .eq("title_key", key)
      .order("recorded_at", { ascending: false })
      .limit(30);
    const prices = robust((data ?? []).map((r: any) => Number(r.price)).filter((n: number) => n > 0));
    if (prices.length >= 3) return { reference: median(prices), refSource: "price_history" };
  } catch { /* ignore */ }

  try {
    const { data } = await db
      .from("listings")
      .select("market_price")
      .eq("category", opts.category)
      .eq("status", "active")
      .limit(50);
    const prices = robust((data ?? []).map((r: any) => Number(r.market_price)).filter((n: number) => n > 0));
    if (prices.length >= 5) return { reference: median(prices), refSource: "category_median" };
  } catch { /* ignore */ }

  return { reference: null, refSource: null };
}

/** يطبّق حدود التحقق والتطبيع على السعر المدخل */
export function applyFmvGuard(input: number, reference: number | null): FmvResult {
  const price = Math.round(input);
  if (!reference || reference <= 0) {
    return {
      price,
      input: price,
      reference: null,
      source: "user",
      deviationPct: null,
      clamped: false,
      note: "لا يوجد مرجع سوقي كافٍ — سُجّل السعر كمدخل مستخدم غير مُتحقَّق.",
    };
  }

  const ref = Math.round(reference);
  const deviationPct = Math.round(((price - ref) / ref) * 100);
  const max = Math.round(ref * FMV_MAX_ABOVE);
  const min = Math.round(ref * FMV_MIN_BELOW);

  if (price > max) {
    return {
      price: max,
      input: price,
      reference: ref,
      source: "user_clamped",
      deviationPct,
      clamped: true,
      note: `السعر المدخل (${price} ر.س) يتجاوز مرجع السوق (${ref} ر.س) بأكثر من ${Math.round((FMV_MAX_ABOVE - 1) * 100)}% — عُدِّل إلى ${max} ر.س.`,
    };
  }
  if (price < min) {
    return {
      price: min,
      input: price,
      reference: ref,
      source: "user_clamped",
      deviationPct,
      clamped: true,
      note: `السعر المدخل (${price} ر.س) أقل من الحد الأدنى المقبول مقارنة بمرجع السوق (${ref} ر.س) — عُدِّل إلى ${min} ر.س.`,
    };
  }

  return {
    price,
    input: price,
    reference: ref,
    source: "user",
    deviationPct,
    clamped: false,
    note: null,
  };
}
