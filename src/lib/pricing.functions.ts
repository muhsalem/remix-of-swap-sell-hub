import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ============================================================
// Universal Reference Value (URV)
// 1 URV ≈ قيمة ساعة عمل ماهر = 50 ر.س = 10 كجم قمح ≈ 0.18 جرام ذهب
// ============================================================
export const URV_IN_SAR = 50;
// عملة المنصة الظاهرة للمستخدم: 1 URV = 10 DI Credit (1 DI ≈ 5 ر.س)
export const DI_PER_URV = 10;
export const SAR_PER_DI = URV_IN_SAR / DI_PER_URV;
const toDI = (sar: number) => Math.round((sar / SAR_PER_DI) * 100) / 100;

// أسعار صرف ثابتة (تقريبية) — تُستخدم لتحويل أي عملة إلى ر.س ثم إلى URV
const FX_TO_SAR: Record<string, number> = {
  SAR: 1,
  USD: 3.75,
  EUR: 4.05,
  AED: 1.02,
  EGP: 0.077,
  GBP: 4.75,
  KWD: 12.2,
  QAR: 1.03,
};

// ============================================================
// أنواع العناصر القابلة للتقييم
// ============================================================
export const ITEM_TYPES = [
  { value: "good", label: "سلعة" },
  { value: "service", label: "خدمة" },
  { value: "labor_hours", label: "ساعات عمل" },
  { value: "real_estate", label: "أصل عقاري" },
  { value: "vehicle", label: "مركبة" },
  { value: "gold", label: "ذهب" },
  { value: "silver", label: "فضة" },
  { value: "currency", label: "عملة" },
  { value: "commodity", label: "سلعة أساسية" },
] as const;

// ============================================================
// مخططات (Schemas)
// ============================================================
const ProductSchema = z.object({
  name: z.string().min(1).max(120),
  category: z.string().min(1).max(60),
  itemType: z.enum([
    "good", "service", "labor_hours", "real_estate",
    "vehicle", "gold", "silver", "currency", "commodity",
  ]),
  unit: z.string().min(1).max(20).default("قطعة"),
  quantity: z.number().min(0.0001).max(1_000_000).default(1),
  condition: z.enum(["new", "like-new", "excellent", "good", "fair"]).default("good"),
  ageMonths: z.number().min(0).max(1200).default(0),
  marketPricePerUnit: z.number().min(0.01).max(50_000_000),
  currency: z.string().min(3).max(5).default("SAR"),
  quality: z.number().min(1).max(10).default(7),
  scarcity: z.enum(["abundant", "normal", "high", "scarce"]).default("normal"),
  locationTier: z.enum(["tier1", "tier2", "tier3", "rural"]).default("tier2"),
  riskLevel: z.enum(["low", "medium", "high"]).default("low"),
  deliveryDays: z.number().min(0).max(365).default(0),
});

const InputSchema = z.object({
  productA: ProductSchema,
  productB: ProductSchema,
  shariahMode: z.boolean().optional().default(false),
});

export type Product = z.infer<typeof ProductSchema>;
export type PricingInput = z.infer<typeof InputSchema>;

// ============================================================
// أنواع المخرجات
// ============================================================
export type ValueBreakdown = {
  base: number;           // السعر السوقي للوحدة بعملته الأصلية
  baseSAR: number;        // الإجمالي بالـ ر.س قبل المعاملات
  conditionFactor: number;
  ageFactor: number;
  qualityFactor: number;
  scarcityFactor: number;
  locationFactor: number;
  riskFactor: number;
  timeFactor: number;
  categoryFactor: number;
  finalSAR: number;
  finalURV: number;
};

export type ShariahAnalysis = {
  ribawiA: boolean;
  ribawiB: boolean;
  sameRibawiType: boolean;
  level: "safe" | "warning" | "forbidden";
  rule: string;
  notes: string[];
};

export type PricingResult = {
  valueA: number; valueB: number;          // SAR (داخلي)
  urvA: number; urvB: number;              // URV (داخلي)
  diA: number; diB: number;                // DI Credit — يُعرض للمستخدم
  fairness: number;
  gap: number; gapURV: number; gapDI: number;
  inFavorOf: "A" | "B" | "balanced";
  cashBalance: number;                     // SAR (داخلي)
  cashBalanceDI: number;                   // DI Credit للموازنة
  recommendation: string;
  rationale: string;
  breakdownA: ValueBreakdown;
  breakdownB: ValueBreakdown;
  shariah: ShariahAnalysis;
  equivalence: string;
};

// ============================================================
// المعاملات
// ============================================================
const CONDITION_FACTOR: Record<string, number> = {
  "new": 1.0, "like-new": 0.92, "excellent": 0.82, "good": 0.68, "fair": 0.5,
};

const CATEGORY_PROFILE: Record<string, { monthlyDecay: number; floor: number; demand: number }> = {
  "إلكترونيات": { monthlyDecay: 0.018, floor: 0.25, demand: 1.0 },
  "هواتف": { monthlyDecay: 0.022, floor: 0.2, demand: 1.05 },
  "أجهزة لوحية": { monthlyDecay: 0.018, floor: 0.25, demand: 0.95 },
  "حواسيب": { monthlyDecay: 0.015, floor: 0.3, demand: 1.0 },
  "صوتيات": { monthlyDecay: 0.012, floor: 0.35, demand: 0.9 },
  "كاميرات": { monthlyDecay: 0.01, floor: 0.4, demand: 0.95 },
  "ساعات": { monthlyDecay: 0.005, floor: 0.6, demand: 1.1 },
  "مجوهرات": { monthlyDecay: 0.001, floor: 0.85, demand: 1.0 },
  "وسائل تنقل": { monthlyDecay: 0.013, floor: 0.3, demand: 1.0 },
  "أثاث": { monthlyDecay: 0.008, floor: 0.35, demand: 0.85 },
  "كتب": { monthlyDecay: 0.004, floor: 0.5, demand: 0.8 },
  "ملابس": { monthlyDecay: 0.025, floor: 0.15, demand: 0.7 },
  "خدمات مهنية": { monthlyDecay: 0, floor: 1, demand: 1.1 },
  "خدمات يدوية": { monthlyDecay: 0, floor: 1, demand: 0.95 },
  "عقارات سكنية": { monthlyDecay: 0, floor: 1, demand: 1.05 },
  "عقارات تجارية": { monthlyDecay: 0, floor: 1, demand: 1.15 },
  "أراضي": { monthlyDecay: 0, floor: 1, demand: 1.1 },
  "ذهب": { monthlyDecay: 0, floor: 1, demand: 1.0 },
  "فضة": { monthlyDecay: 0, floor: 1, demand: 0.95 },
  "عملات": { monthlyDecay: 0, floor: 1, demand: 1.0 },
  "حبوب وأغذية": { monthlyDecay: 0.05, floor: 0.1, demand: 1.0 },
  "أخرى": { monthlyDecay: 0.012, floor: 0.3, demand: 0.9 },
};

const SCARCITY_FACTOR: Record<string, number> = {
  abundant: 0.85, normal: 1.0, high: 1.15, scarce: 1.35,
};
const LOCATION_FACTOR: Record<string, number> = {
  tier1: 1.15, tier2: 1.0, tier3: 0.9, rural: 0.8,
};
const RISK_FACTOR: Record<string, number> = {
  low: 1.0, medium: 0.92, high: 0.8,
};

// الأنواع التي لا تخضع للإهلاك أو الحالة
const NON_DEPRECIATING = new Set(["real_estate", "gold", "silver", "currency"]);

// ============================================================
// تحليل ربوي (الذهب، الفضة، النقود + الأصناف الأربعة)
// ============================================================
const RIBAWI_KEYWORDS: { type: string; keywords: string[] }[] = [
  { type: "ذهب", keywords: ["ذهب", "gold", "سبيكة", "جنيه ذهب"] },
  { type: "فضة", keywords: ["فضة", "silver"] },
  { type: "نقود", keywords: ["ريال", "دولار", "يورو", "درهم", "جنيه", "عملة", "نقود", "كاش", "cash"] },
  { type: "قمح", keywords: ["قمح", "دقيق", "wheat"] },
  { type: "شعير", keywords: ["شعير", "barley"] },
  { type: "تمر", keywords: ["تمر", "بلح", "dates"] },
  { type: "ملح", keywords: ["ملح", "salt"] },
];

function detectRibawi(p: Product): string | null {
  if (p.itemType === "gold") return "ذهب";
  if (p.itemType === "silver") return "فضة";
  if (p.itemType === "currency") return "نقود";
  const txt = `${p.name} ${p.category}`.toLowerCase();
  for (const r of RIBAWI_KEYWORDS) {
    if (r.keywords.some((k) => txt.includes(k.toLowerCase()))) return r.type;
  }
  return null;
}

// فحص شرعي خفيف يعتمد على العنوان والفئة فقط — يُستخدم لمنع المعاملات قبل إنشائها
export function quickShariahCheckByText(
  a: { title: string; category: string },
  b: { title: string; category: string },
  cashBalance: number,
): ShariahAnalysis {
  const fake = (x: { title: string; category: string }): Product => ({
    name: x.title, category: x.category, itemType: "good",
    unit: "قطعة", quantity: 1, condition: "good", ageMonths: 0,
    marketPricePerUnit: 1, currency: "SAR", quality: 7,
    scarcity: "normal", locationTier: "tier2", riskLevel: "low", deliveryDays: 0,
  });
  return analyzeShariah(fake(a), fake(b), cashBalance);
}

function analyzeShariah(a: Product, b: Product, cashBalance: number): ShariahAnalysis {
  const ribA = detectRibawi(a);
  const ribB = detectRibawi(b);
  const notes: string[] = [];
  let level: ShariahAnalysis["level"] = "safe";
  let rule = "المقايضة جائزة شرعاً بإذن الله — الأصناف غير ربوية.";

  if (ribA && ribB && ribA === ribB) {
    level = "forbidden";
    rule = `تبادل صنف ربوي واحد (${ribA} بـ ${ribA}) يجب أن يكون مثلاً بمثل ويداً بيد، وأي تفاوت في الكمية أو القيمة = ربا الفضل.`;
    notes.push("اجعل الكمية متساوية تماماً.");
    notes.push("التقابض في نفس المجلس دون تأخير.");
    if (cashBalance !== 0) notes.push("لا يجوز إضافة مبلغ نقدي لموازنة الصفقة.");
  } else if (ribA && ribB && ribA !== ribB) {
    level = "warning";
    rule = `تبادل صنفين ربويين مختلفين (${ribA} بـ ${ribB}) — يجوز التفاضل لكن يجب التقابض في نفس المجلس.`;
    notes.push("التسليم والاستلام في نفس اللقاء شرط للصحة.");
    if (a.deliveryDays > 0 || b.deliveryDays > 0)
      notes.push("⚠️ التأجيل غير جائز في هذه الصفقة.");
  } else if (ribA || ribB) {
    level = "warning";
    const r = ribA ?? ribB;
    rule = `أحد طرفي المقايضة صنف ربوي (${r}) — يجب التقابض الفوري لطرف الذهب/الفضة/النقود.`;
    notes.push("لا يجوز تأجيل تسليم الطرف الربوي.");
  }

  return { ribawiA: !!ribA, ribawiB: !!ribB, sameRibawiType: !!(ribA && ribB && ribA === ribB), level, rule, notes };
}

// ============================================================
// الحساب الأساسي
// ============================================================
function valueWithBreakdown(p: Product): ValueBreakdown {
  const fx = FX_TO_SAR[p.currency.toUpperCase()] ?? 1;
  const baseSAR = p.marketPricePerUnit * p.quantity * fx;

  const isDurable = !NON_DEPRECIATING.has(p.itemType);
  const profile = CATEGORY_PROFILE[p.category] ?? CATEGORY_PROFILE["أخرى"];

  const cond = isDurable ? (CONDITION_FACTOR[p.condition] ?? 0.6) : 1;
  const ageFactor = isDurable
    ? Math.max(profile.floor, 1 - p.ageMonths * profile.monthlyDecay)
    : 1;
  const qualityFactor = 0.5 + (p.quality / 10) * 0.75; // 1→0.575, 10→1.25
  const scarcityFactor = SCARCITY_FACTOR[p.scarcity];
  const locationFactor = LOCATION_FACTOR[p.locationTier];
  const riskFactor = RISK_FACTOR[p.riskLevel];
  // كل يوم تأجيل يخصم 0.4% بحد أدنى 0.85
  const timeFactor = Math.max(0.85, 1 - p.deliveryDays * 0.004);

  const finalSAR = Math.round(
    baseSAR * cond * ageFactor * qualityFactor * scarcityFactor *
      locationFactor * riskFactor * timeFactor * profile.demand
  );
  const finalURV = Math.round((finalSAR / URV_IN_SAR) * 100) / 100;

  return {
    base: p.marketPricePerUnit,
    baseSAR: Math.round(baseSAR),
    conditionFactor: cond,
    ageFactor: Math.round(ageFactor * 100) / 100,
    qualityFactor: Math.round(qualityFactor * 100) / 100,
    scarcityFactor,
    locationFactor,
    riskFactor,
    timeFactor: Math.round(timeFactor * 100) / 100,
    categoryFactor: profile.demand,
    finalSAR,
    finalURV,
  };
}

// مكافئات شائعة لقيمة معينة بالـ SAR
function buildEquivalence(sar: number): string {
  const wheatPerKg = 5;       // ر.س/كجم قمح تقريباً
  const goldPerGram = 280;    // ر.س/جرام ذهب
  const consultHour = 250;    // ر.س لساعة استشارة قانونية
  const codingHour = 120;     // ر.س لساعة برمجة
  const paintM2 = 35;         // ر.س لمتر دهان
  const laborHour = 30;       // ساعة عمل غير ماهر

  return [
    `${(sar / consultHour).toFixed(2)} ساعة استشارة قانونية`,
    `${(sar / codingHour).toFixed(2)} ساعة برمجة`,
    `${(sar / wheatPerKg).toFixed(1)} كجم قمح`,
    `${(sar / paintM2).toFixed(1)} م² دهان`,
    `${(sar / goldPerGram).toFixed(3)} جرام ذهب`,
    `${(sar / laborHour).toFixed(1)} ساعة عمل عادي`,
  ].join(" = ");
}

// ============================================================
// Server function
// ============================================================
export const calculateBarter = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<PricingResult> => {
    const { productA, productB, shariahMode } = data;
    const breakdownA = valueWithBreakdown(productA);
    const breakdownB = valueWithBreakdown(productB);
    const valueA = breakdownA.finalSAR;
    const valueB = breakdownB.finalSAR;
    const urvA = breakdownA.finalURV;
    const urvB = breakdownB.finalURV;
    const gap = valueA - valueB;
    const gapURV = Math.round((gap / URV_IN_SAR) * 100) / 100;
    const avg = (valueA + valueB) / 2 || 1;
    const fairness = Math.max(0, Math.round(100 - (Math.abs(gap) / avg) * 100));
    const inFavorOf: "A" | "B" | "balanced" =
      Math.abs(gap) / avg < 0.03 ? "balanced" : gap > 0 ? "B" : "A";
    const cashBalance = Math.abs(gap);
    const shariah = analyzeShariah(productA, productB, cashBalance);
    const equivalence = buildEquivalence(Math.min(valueA, valueB));

    let recommendation =
      cashBalance < avg * 0.03
        ? "الصفقة متوازنة — يمكن إتمامها مباشرة."
        : `يُنصح بإضافة ${cashBalance.toLocaleString()} ر.س (${Math.abs(gapURV)} URV) من صاحب (${inFavorOf === "A" ? "ب" : "أ"}) لموازنة القيمة.`;
    let rationale =
      "التقييم يأخذ بالحسبان: السعر السوقي، الحالة، العمر، الجودة، الندرة، الموقع، المخاطرة، وزمن التسليم.";

    if (shariahMode && shariah.level === "forbidden") {
      recommendation = "🚫 لا تُتم هذه الصفقة بهذا الشكل — تقع في ربا الفضل.";
    } else if (shariahMode && shariah.level === "warning") {
      recommendation = `⚠️ ${shariah.rule}`;
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (apiKey && shariah.level !== "forbidden") {
      try {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content: "أنت خبير اقتصادي ومحرك تسعير للمقايضة. أجب بالعربية بإيجاز (سطر أو سطرين) بصيغة JSON.",
              },
              {
                role: "user",
                content: `قيّم عدالة هذه المقايضة:
- (أ) ${productA.name} [${productA.itemType}] × ${productA.quantity} ${productA.unit} | جودة ${productA.quality}/10 | ندرة ${productA.scarcity} | موقع ${productA.locationTier} | مخاطر ${productA.riskLevel} | تسليم بعد ${productA.deliveryDays} يوم → ${valueA} ر.س (${urvA} URV)
- (ب) ${productB.name} [${productB.itemType}] × ${productB.quantity} ${productB.unit} | جودة ${productB.quality}/10 | ندرة ${productB.scarcity} | موقع ${productB.locationTier} | مخاطر ${productB.riskLevel} | تسليم بعد ${productB.deliveryDays} يوم → ${valueB} ر.س (${urvB} URV)
- الفجوة: ${gap} ر.س | عدالة ${fairness}%
${shariahMode ? `- وضع شرعي: ${shariah.rule}` : ""}

أعد JSON فقط: {"recommendation":"...","rationale":"..."}`,
              },
            ],
            response_format: { type: "json_object" },
          }),
        });
        if (res.ok) {
          const json = await res.json();
          const content = json?.choices?.[0]?.message?.content;
          if (content) {
            try {
              const parsed = JSON.parse(content);
              if (parsed.recommendation && shariah.level === "safe")
                recommendation = String(parsed.recommendation).slice(0, 280);
              if (parsed.rationale) rationale = String(parsed.rationale).slice(0, 280);
            } catch { /* keep defaults */ }
          }
        } else if (res.status === 429) {
          rationale = "تم تجاوز حد طلبات الذكاء الاصطناعي مؤقتاً.";
        } else if (res.status === 402) {
          rationale = "نفد رصيد الذكاء الاصطناعي.";
        }
      } catch (err) {
        console.error("AI gateway failed", err);
      }
    }

    return {
      valueA, valueB, urvA, urvB,
      diA: toDI(valueA), diB: toDI(valueB),
      fairness, gap, gapURV, gapDI: toDI(Math.abs(gap)),
      inFavorOf, cashBalance, cashBalanceDI: toDI(cashBalance),
      recommendation, rationale,
      breakdownA, breakdownB, shariah, equivalence,
    };
  });
