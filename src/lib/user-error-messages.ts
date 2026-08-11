// تحويل أخطاء الخادم إلى رسائل عربية واضحة للمستخدم
// خاصة أخطاء حدود الاستخدام (rate limit) وأخطاء بدء الدفع.

export type FriendlyError = {
  title: string;
  description?: string;
  isRateLimit: boolean;
};

function rawMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "";
}

export function isRateLimitError(err: unknown): boolean {
  const m = rawMessage(err);
  return m.includes("🚦") || /rate.?limit|too many requests|429/i.test(m);
}

const CODE_MAP: Record<string, FriendlyError> = {
  target_id_required: {
    title: "تعذّر بدء الدفع",
    description: "لم يتم تحديد الإعلان المطلوب ترقيته. أعد المحاولة من صفحة الإعلان.",
    isRateLimit: false,
  },
  pricing_not_configured: {
    title: "الخدمة غير متاحة حالياً",
    description: "لم يتم ضبط سعر هذه الخدمة بعد. تواصل مع الدعم أو حاول لاحقاً.",
    isRateLimit: false,
  },
  no_checkout_url: {
    title: "تعذّر فتح صفحة الدفع",
    description: "لم يستجب مزوّد الدفع برابط صالح. حاول مرة أخرى بعد قليل.",
    isRateLimit: false,
  },
  payment_not_found: {
    title: "لم يتم العثور على عملية الدفع",
    description: "قد تكون العملية أُلغيت أو تخص حساباً آخر.",
    isRateLimit: false,
  },
};

/** رسالة واضحة لفشل بدء الدفع (بما فيها الحظر بسبب حدود الاستخدام). */
export function paymentErrorMessage(err: unknown): FriendlyError {
  const m = rawMessage(err);

  if (isRateLimitError(err)) {
    return {
      title: "تم إيقاف عمليات الدفع مؤقتاً",
      description:
        m.replace("🚦", "").trim() ||
        "تجاوزت الحد المسموح من محاولات الدفع خلال فترة قصيرة. انتظر بضع دقائق ثم أعد المحاولة.",
      isRateLimit: true,
    };
  }

  for (const [code, friendly] of Object.entries(CODE_MAP)) {
    if (m.includes(code)) return friendly;
  }

  if (m.startsWith("payment_insert_failed")) {
    return {
      title: "تعذّر إنشاء عملية الدفع",
      description: "حدث خطأ أثناء تسجيل العملية. حاول مرة أخرى، وإن تكرر تواصل مع الدعم.",
      isRateLimit: false,
    };
  }

  return {
    title: "تعذّر بدء عملية الدفع",
    description: m && m.length < 200 ? m : "حاول مرة أخرى بعد قليل.",
    isRateLimit: false,
  };
}

/** رسالة واضحة لفشل نشر الإعلان (بما فيها الحظر بسبب حدود الاستخدام). */
export function listingErrorMessage(err: unknown): FriendlyError {
  const m = rawMessage(err);

  if (isRateLimitError(err)) {
    return {
      title: "تجاوزت حد نشر الإعلانات",
      description:
        m.replace("🚦", "").trim() ||
        "يمكنك نشر 15 إعلاناً كحد أقصى كل ساعة. انتظر قليلاً ثم أعد المحاولة — لم يتم فقدان بيانات إعلانك.",
      isRateLimit: true,
    };
  }

  if (m.includes("تصنيف محظور")) {
    return { title: "لا يمكن نشر هذا الإعلان", description: m, isRateLimit: false };
  }

  return {
    title: "فشل نشر الإعلان",
    description: m && m.length < 300 ? m : "حاول مرة أخرى بعد قليل.",
    isRateLimit: false,
  };
}
