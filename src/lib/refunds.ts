export const REFUND_WINDOW_HOURS = 72;
export const REFUND_TAG = "[استرداد]";

export const REFUND_REASONS = [
  { value: "not_as_described", label: "الغرض غير مطابق للوصف" },
  { value: "damaged", label: "وصل تالفاً أو به عيب غير معلن" },
  { value: "not_delivered", label: "لم يصل الغرض / لم يتم التسليم" },
  { value: "counterfeit", label: "الغرض مقلّد أو غير أصلي" },
  { value: "missing_parts", label: "نواقص أو ملحقات مفقودة" },
  { value: "other", label: "سبب آخر" },
] as const;

export type RefundReasonCode = (typeof REFUND_REASONS)[number]["value"];

export const REQUIRED_DOCS: Record<RefundReasonCode, string[]> = {
  not_as_described: ["صور واضحة للغرض من عدة زوايا", "لقطة من وصف الإعلان الأصلي"],
  damaged: ["صور للضرر", "صورة لغلاف الشحنة عند الاستلام"],
  not_delivered: ["إيصال الشحن أو رقم التتبع", "لقطة من آخر حالة تتبع"],
  counterfeit: ["صور للرقم التسلسلي/الملصقات", "أي تقرير فحص أو مقارنة بالأصلي"],
  missing_parts: ["صورة لمحتويات الشحنة كما وصلت", "لقطة من الملحقات المذكورة في الإعلان"],
  other: ["أي مستندات أو صور تدعم طلبك"],
};

export function refundDeadline(offer: { updated_at?: string | null; created_at: string }) {
  const base = new Date(offer.updated_at ?? offer.created_at).getTime();
  return base + REFUND_WINDOW_HOURS * 3600_000;
}

export function remainingLabel(deadlineIso: string, now = Date.now()) {
  const ms = new Date(deadlineIso).getTime() - now;
  if (ms <= 0) return "انتهت المهلة";
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  return h >= 1 ? `متبقٍ ${h} ساعة و${m} دقيقة` : `متبقٍ ${m} دقيقة`;
}
