// درجة الثقة الموحّدة (0..100) — حساب خالص بلا آثار جانبية.
export type TrustInput = {
  rating: number | null;
  tradesCount: number | null;
  verifiedBadge: boolean;
  companyVerified: boolean;
  kycVerified: boolean;
  accountAgeDays: number;
  isSuspended: boolean;
};

export type TrustBreakdown = {
  score: number;
  level: "جديد" | "مقبول" | "موثوق" | "ممتاز";
  parts: { key: string; label: string; earned: number; max: number }[];
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function computeTrustScore(i: TrustInput): TrustBreakdown {
  const ratingPts = i.rating && i.tradesCount ? clamp((Number(i.rating) / 5) * 30, 0, 30) : 0;
  const tradesPts = clamp(Math.log10((i.tradesCount ?? 0) + 1) * 22, 0, 25);
  const verifyPts = (i.verifiedBadge ? 15 : 0) + (i.kycVerified || i.companyVerified ? 15 : 0);
  const agePts = clamp((i.accountAgeDays / 180) * 15, 0, 15);

  const parts = [
    { key: "rating", label: "تقييمات المستخدمين", earned: Math.round(ratingPts), max: 30 },
    { key: "trades", label: "عدد الصفقات المكتملة", earned: Math.round(tradesPts), max: 25 },
    { key: "verify", label: "التوثيق والهوية", earned: Math.round(verifyPts), max: 30 },
    { key: "age", label: "أقدمية الحساب", earned: Math.round(agePts), max: 15 },
  ];

  let score = parts.reduce((a, p) => a + p.earned, 0);
  if (i.isSuspended) score = 0;
  score = clamp(Math.round(score), 0, 100);

  const level: TrustBreakdown["level"] =
    score >= 80 ? "ممتاز" : score >= 60 ? "موثوق" : score >= 35 ? "مقبول" : "جديد";

  return { score, level, parts };
}
