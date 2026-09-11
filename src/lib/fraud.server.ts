// طبقة كشف الاحتيال (المرحلة 1) — خادم فقط.
// 1) بصمات الصور (pHash) لكشف الصور المكرّرة/المسروقة وتعدّد الحسابات.
// 2) سقف قيمة الإعلان حسب مستوى ثقة الحساب.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { hammingDistance } from "./image-hash";

const NEAR_DUPLICATE_DISTANCE = 6; // ≤6 بت اختلاف = نفس الصورة عملياً
const CANDIDATE_WINDOW = 4000;

export type ImageScreenResult = {
  blocked: boolean;
  reason?: string;
  duplicateOfOwner?: string | null;
  selfDuplicate: boolean;
};

export async function recordFraudSignal(input: {
  userId: string | null;
  listingId?: string | null;
  kind: string;
  severity?: "low" | "medium" | "high" | "critical";
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await supabaseAdmin.from("fraud_signals").insert({
      user_id: input.userId,
      listing_id: input.listingId ?? null,
      kind: input.kind,
      severity: input.severity ?? "medium",
      details: (input.details ?? {}) as never,
    });
  } catch (e) {
    console.error("[fraud] signal insert failed", e);
  }
}

/** يفحص بصمات صور جديدة مقابل البصمات المخزّنة. */
export async function screenImageHashes(
  userId: string,
  hashes: string[],
): Promise<ImageScreenResult> {
  const clean = hashes.filter((h) => /^[0-9a-f]{16}$/.test(h));
  if (!clean.length) return { blocked: false, selfDuplicate: false };

  const { data, error } = await supabaseAdmin
    .from("listing_image_hashes")
    .select("phash,owner_id,listing_id")
    .order("created_at", { ascending: false })
    .limit(CANDIDATE_WINDOW);

  if (error) {
    console.error("[fraud] hash lookup failed", error);
    return { blocked: false, selfDuplicate: false };
  }

  let selfDuplicate = false;
  for (const h of clean) {
    for (const row of data ?? []) {
      if (hammingDistance(h, row.phash) > NEAR_DUPLICATE_DISTANCE) continue;
      if (row.owner_id === userId) {
        selfDuplicate = true;
        continue;
      }
      await recordFraudSignal({
        userId,
        kind: "duplicate_image_cross_account",
        severity: "high",
        details: { phash: h, matched_listing: row.listing_id, matched_owner: row.owner_id },
      });
      return {
        blocked: true,
        reason:
          "🚫 هذه الصورة منشورة بالفعل في إعلان لحساب آخر. استخدم صوراً حقيقية للسلعة التي تملكها.",
        duplicateOfOwner: row.owner_id,
        selfDuplicate,
      };
    }
  }

  if (selfDuplicate) {
    await recordFraudSignal({
      userId,
      kind: "duplicate_image_same_account",
      severity: "low",
      details: { count: clean.length },
    });
  }

  return { blocked: false, selfDuplicate };
}

export async function persistImageHashes(
  listingId: string,
  ownerId: string,
  hashes: string[],
  signatures: Array<{ phash: string; csig?: string; esig?: string }> = [],
): Promise<void> {
  const sigMap = new Map(signatures.map((s) => [s.phash, s]));
  const rows = hashes
    .filter((h) => /^[0-9a-f]{16}$/.test(h))
    .map((phash) => ({
      listing_id: listingId,
      owner_id: ownerId,
      phash,
      csig: sigMap.get(phash)?.csig ?? null,
      esig: sigMap.get(phash)?.esig ?? null,
    }));
  if (!rows.length) return;
  try {
    await supabaseAdmin.from("listing_image_hashes").insert(rows);
  } catch (e) {
    console.error("[fraud] hash insert failed", e);
  }
}

export type TrustTier = { tier: string; capSar: number };

/** سقف قيمة الإعلان حسب التوثيق وعدد الصفقات المكتملة. */
export function trustValueCap(p: {
  verified_badge?: boolean | null;
  company_verified?: boolean | null;
  trades_count?: number | null;
}): TrustTier {
  const trades = p.trades_count ?? 0;
  if (p.company_verified) return { tier: "company_verified", capSar: 2_000_000 };
  if (p.verified_badge) return { tier: "verified", capSar: 500_000 };
  if (trades >= 5) return { tier: "established", capSar: 150_000 };
  if (trades >= 1) return { tier: "starter", capSar: 50_000 };
  return { tier: "new", capSar: 20_000 };
}

export async function enforceTrustValueCap(userId: string, priceSar: number): Promise<void> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("verified_badge,company_verified,trades_count")
    .eq("id", userId)
    .maybeSingle();

  const cap = trustValueCap(data ?? {});
  if (priceSar <= cap.capSar) return;

  await recordFraudSignal({
    userId,
    kind: "value_cap_exceeded",
    severity: "medium",
    details: { price_sar: priceSar, cap_sar: cap.capSar, tier: cap.tier },
  });

  throw new Error(
    `🔒 قيمة هذا الإعلان (${priceSar.toLocaleString("ar")} ر.س) تتجاوز الحد المسموح لحسابك (${cap.capSar.toLocaleString("ar")} ر.س). وثّق حسابك أو أكمل صفقات ناجحة لرفع الحد.`,
  );
}
