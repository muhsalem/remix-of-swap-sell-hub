import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ============================================================
// Universal Reference Value (URV) — داخلي
// ============================================================
export const URV_IN_SAR = 50;
export const DI_PER_URV = 10;
export const SAR_PER_DI = URV_IN_SAR / DI_PER_URV;
const toDI = (sar: number) => Math.round((sar / SAR_PER_DI) * 100) / 100;

const FX_TO_SAR: Record<string, number> = {
  SAR: 1, USD: 3.75, EUR: 4.05, AED: 1.02, EGP: 0.077, GBP: 4.75, KWD: 12.2, QAR: 1.03,
};

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

const ProductSchema = z.object({
  name: z.string().min(1).max(120),
  category: z.string().min(1).max(60),
  itemType: z.enum([
    "good","service","labor_hours","real_estate","vehicle","gold","silver","currency","commodity",
  ]),
  unit: z.string().min(1).max(20).default("قطعة"),
  quantity: z.number().min(0.0001).max(1_000_000).default(1),
  condition: z.enum(["new","like-new","excellent","good","fair"]).default("good"),
  ageMonths: z.number().min(0).max(1200).default(0),
  marketPricePerUnit: z.number().min(0.01).max(50_000_000),
  currency: z.string().min(3).max(5).default("SAR"),
  quality: z.number().min(1).max(10).default(7),
  scarcity: z.enum(["abundant","normal","high","scarce"]).default("normal"),
  locationTier: z.enum(["tier1","tier2","tier3","rural"]).default("tier2"),
  riskLevel: z.enum(["low","medium","high"]).default("low"),
  deliveryDays: z.number().min(0).max(365).default(0),
  distanceKm: z.number().min(0).max(20000).default(0),
  brandTier: z.enum(["premium","standard","generic","unknown"]).default("unknown"),
  seasonality: z.enum(["peak","normal","off"]).default("normal"),
});

const InputSchema = z.object({
  sideA: z.array(ProductSchema).min(1).max(5),
  sideB: z.array(ProductSchema).min(1).max(5),
  shariahMode: z.boolean().optional().default(true),
  serviceBarter: z.boolean().optional().default(false),
});

export type Product = z.infer<typeof ProductSchema>;
export type PricingInput = z.infer<typeof InputSchema>;

export type ValueBreakdown = {
  base: number; baseSAR: number;
  conditionFactor: number; ageFactor: number; qualityFactor: number;
  scarcityFactor: number; locationFactor: number; riskFactor: number;
  timeFactor: number; categoryFactor: number;
  finalSAR: number; finalURV: number;
};

export type ShariahAnalysis = {
  ribawiA: boolean; ribawiB: boolean; sameRibawiType: boolean;
  level: "safe" | "warning" | "forbidden";
  rule: string; notes: string[];
};

export type PricingResult = {
  valueA: number; valueB: number;
  urvA: number; urvB: number;
  diA: number; diB: number;
  fairness: number;
  gap: number; gapURV: number; gapDI: number;
  inFavorOf: "A" | "B" | "balanced";
  cashBalance: number; cashBalanceDI: number;
  recommendation: string; rationale: string;
  breakdownA: ValueBreakdown; breakdownB: ValueBreakdown;
  shariah: ShariahAnalysis;
  equivalence: string;
  itemsA: { name: string; sar: number; di: number }[];
  itemsB: { name: string; sar: number; di: number }[];
};

const CONDITION_FACTOR: Record<string, number> = {
  "new":1.0,"like-new":0.92,"excellent":0.82,"good":0.68,"fair":0.5,
};
const CATEGORY_PROFILE: Record<string, { monthlyDecay: number; floor: number; demand: number }> = {
  "إلكترونيات":{monthlyDecay:0.018,floor:0.25,demand:1.0},
  "هواتف":{monthlyDecay:0.022,floor:0.2,demand:1.05},
  "أجهزة لوحية":{monthlyDecay:0.018,floor:0.25,demand:0.95},
  "حواسيب":{monthlyDecay:0.015,floor:0.3,demand:1.0},
  "صوتيات":{monthlyDecay:0.012,floor:0.35,demand:0.9},
  "كاميرات":{monthlyDecay:0.01,floor:0.4,demand:0.95},
  "ساعات":{monthlyDecay:0.005,floor:0.6,demand:1.1},
  "مجوهرات":{monthlyDecay:0.001,floor:0.85,demand:1.0},
  "وسائل تنقل":{monthlyDecay:0.013,floor:0.3,demand:1.0},
  "أثاث":{monthlyDecay:0.008,floor:0.35,demand:0.85},
  "كتب":{monthlyDecay:0.004,floor:0.5,demand:0.8},
  "ملابس":{monthlyDecay:0.025,floor:0.15,demand:0.7},
  "خدمات مهنية":{monthlyDecay:0,floor:1,demand:1.1},
  "خدمات يدوية":{monthlyDecay:0,floor:1,demand:0.95},
  "عقارات سكنية":{monthlyDecay:0,floor:1,demand:1.05},
  "عقارات تجارية":{monthlyDecay:0,floor:1,demand:1.15},
  "أراضي":{monthlyDecay:0,floor:1,demand:1.1},
  "ذهب":{monthlyDecay:0,floor:1,demand:1.0},
  "فضة":{monthlyDecay:0,floor:1,demand:0.95},
  "عملات":{monthlyDecay:0,floor:1,demand:1.0},
  "حبوب وأغذية":{monthlyDecay:0.05,floor:0.1,demand:1.0},
  "أخرى":{monthlyDecay:0.012,floor:0.3,demand:0.9},
};
const SCARCITY_FACTOR: Record<string, number> = { abundant:0.85, normal:1.0, high:1.15, scarce:1.35 };
const LOCATION_FACTOR: Record<string, number> = { tier1:1.15, tier2:1.0, tier3:0.9, rural:0.8 };
const RISK_FACTOR: Record<string, number> = { low:1.0, medium:0.92, high:0.8 };
const NON_DEPRECIATING = new Set(["real_estate","gold","silver","currency"]);

const RIBAWI_KEYWORDS: { type: string; keywords: string[] }[] = [
  { type: "ذهب", keywords: ["ذهب","gold","سبيكة","جنيه ذهب"] },
  { type: "فضة", keywords: ["فضة","silver"] },
  { type: "نقود", keywords: ["ريال","دولار","يورو","درهم","جنيه","عملة","نقود","كاش","cash"] },
  { type: "قمح", keywords: ["قمح","دقيق","wheat"] },
  { type: "شعير", keywords: ["شعير","barley"] },
  { type: "تمر", keywords: ["تمر","بلح","dates"] },
  { type: "ملح", keywords: ["ملح","salt"] },
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

export function quickShariahCheckByText(
  a: { title: string; category: string },
  b: { title: string; category: string },
  cashBalance: number,
): ShariahAnalysis {
  const fake = (x: { title: string; category: string }): Product => ({
    name: x.title, category: x.category, itemType: "good",
    unit: "قطعة", quantity: 1, condition: "good", ageMonths: 0,
    marketPricePerUnit: 1, currency: "SAR", quality: 7,
    scarcity: "normal", locationTier: "tier2", riskLevel: "low", deliveryDays: 0, distanceKm: 0,
    brandTier: "unknown", seasonality: "normal",
  });
  return analyzeShariahPair(fake(a), fake(b), cashBalance);
}

function analyzeShariahPair(a: Product, b: Product, cashBalance: number): ShariahAnalysis {
  const ribA = detectRibawi(a);
  const ribB = detectRibawi(b);
  const notes: string[] = [];
  let level: ShariahAnalysis["level"] = "safe";
  let rule = "المقايضة جائزة شرعاً بإذن الله.";
  if (ribA && ribB && ribA === ribB) {
    level = "forbidden";
    rule = `تبادل صنف ربوي واحد (${ribA} بـ ${ribA}) يجب أن يكون مثلاً بمثل ويداً بيد؛ أي تفاوت = ربا الفضل.`;
    notes.push("اجعل الكمية متساوية تماماً.");
    notes.push("التقابض في نفس المجلس دون تأخير.");
    if (cashBalance !== 0) notes.push("لا يجوز إضافة مبلغ نقدي للموازنة.");
  } else if (ribA && ribB && ribA !== ribB) {
    level = "warning";
    rule = `تبادل صنفين ربويين مختلفين (${ribA} بـ ${ribB}) — يجوز التفاضل لكن يجب التقابض في نفس المجلس.`;
    notes.push("التسليم والاستلام في نفس اللقاء شرط للصحة.");
    if (a.deliveryDays > 0 || b.deliveryDays > 0)
      notes.push("⚠️ التأجيل غير جائز في هذه الصفقة.");
  } else if (ribA || ribB) {
    level = "warning";
    rule = `أحد طرفي المقايضة صنف ربوي (${ribA ?? ribB}) — يجب التقابض الفوري للطرف الربوي.`;
    notes.push("لا يجوز تأجيل تسليم الطرف الربوي.");
  }
  return { ribawiA: !!ribA, ribawiB: !!ribB, sameRibawiType: !!(ribA && ribB && ribA === ribB), level, rule, notes };
}

// أعلى مستوى تشدد بين سلسلة سلع — حدّد المعاملة الأشد قيداً
function analyzeShariahMulti(
  sideA: Product[], sideB: Product[], cashBalance: number, serviceBarter: boolean,
): ShariahAnalysis {
  let worst: ShariahAnalysis = {
    ribawiA: false, ribawiB: false, sameRibawiType: false,
    level: "safe", rule: "المقايضة جائزة شرعاً بإذن الله.", notes: [],
  };
  const levelRank = { safe: 0, warning: 1, forbidden: 2 } as const;
  for (const a of sideA) for (const b of sideB) {
    const r = analyzeShariahPair(a, b, cashBalance);
    if (levelRank[r.level] > levelRank[worst.level]) worst = r;
  }

  // قواعد إضافية لمقايضة الخدمة بالخدمة (إجارة بإجارة)
  if (serviceBarter) {
    const allServices = [...sideA, ...sideB].every(
      (p) => p.itemType === "service" || p.itemType === "labor_hours",
    );
    const serviceNotes: string[] = [];
    let serviceLevel: ShariahAnalysis["level"] = worst.level;

    if (!allServices) {
      serviceLevel = "forbidden";
      serviceNotes.push("في وضع مقايضة الخدمات: يجب أن تكون كل العناصر من نوع خدمة أو ساعات عمل.");
    } else {
      // 1) تحديد المنفعة: اسم واضح ≥ 3 أحرف وفئة محددة
      const vague = [...sideA, ...sideB].find((p) => p.name.trim().length < 3);
      if (vague) {
        serviceLevel = "forbidden";
        serviceNotes.push(`المنفعة غير محددة بوضوح في "${vague.name}" — يلزم وصف دقيق للخدمة.`);
      }
      // 2) أجل معلوم: deliveryDays > 0 (تاريخ التنفيذ معلوم)
      const noTerm = [...sideA, ...sideB].find((p) => p.deliveryDays <= 0);
      if (noTerm) {
        serviceLevel = serviceLevel === "forbidden" ? "forbidden" : "warning";
        serviceNotes.push(`الأجل غير معلوم في "${noTerm.name}" — حدّد تاريخ/مدة تنفيذ الخدمة لتفادي الغرر.`);
      }
      // 3) التماثل في الزمن/القيمة
      const totalHoursA = sideA.reduce((s, p) => s + p.quantity, 0);
      const totalHoursB = sideB.reduce((s, p) => s + p.quantity, 0);
      const timeGap = Math.abs(totalHoursA - totalHoursB) / Math.max(totalHoursA, totalHoursB, 1);
      if (timeGap > 0.25) {
        serviceLevel = serviceLevel === "forbidden" ? "forbidden" : "warning";
        serviceNotes.push(`تفاوت كبير في زمن الخدمتين (${totalHoursA} مقابل ${totalHoursB}) — يُستحب التماثل أو التقارب.`);
      }
    }

    if (levelRank[serviceLevel] >= levelRank[worst.level]) {
      worst = {
        ...worst,
        level: serviceLevel,
        rule:
          serviceLevel === "safe"
            ? "مقايضة خدمة بخدمة صحيحة: المنفعة محددة، الأجل معلوم، والتماثل قائم."
            : "مقايضة خدمة بخدمة — راجع الشروط:",
        notes: [...worst.notes, ...serviceNotes],
      };
    }
  }
  return worst;
}

function valueWithBreakdown(p: Product): ValueBreakdown {
  const fx = FX_TO_SAR[p.currency.toUpperCase()] ?? 1;
  const baseSAR = p.marketPricePerUnit * p.quantity * fx;
  const isDurable = !NON_DEPRECIATING.has(p.itemType);
  const profile = CATEGORY_PROFILE[p.category] ?? CATEGORY_PROFILE["أخرى"];
  const cond = isDurable ? (CONDITION_FACTOR[p.condition] ?? 0.6) : 1;
  const ageFactor = isDurable ? Math.max(profile.floor, 1 - p.ageMonths * profile.monthlyDecay) : 1;
  const qualityFactor = 0.5 + (p.quality / 10) * 0.75;
  const scarcityFactor = SCARCITY_FACTOR[p.scarcity];
  const locationFactor = LOCATION_FACTOR[p.locationTier];
  const riskFactor = RISK_FACTOR[p.riskLevel];
  const timeFactor = Math.max(0.85, 1 - p.deliveryDays * 0.004);
  // خصم تكلفة الشحن التقديرية حسب المسافة (~ 0.5 ر.س/كم، يبدأ بعد 50 كم، حد أقصى 15% من القيمة)
  const shippingSAR = p.distanceKm > 50 ? Math.min(baseSAR * 0.15, (p.distanceKm - 50) * 0.5) : 0;
  const shippingFactor = baseSAR > 0 ? Math.max(0.85, 1 - shippingSAR / baseSAR) : 1;
  // علامة تجارية: premium يرفع 20%، standard محايد، generic يخفض 10%
  const BRAND_FACTOR: Record<string, number> = { premium: 1.2, standard: 1.0, generic: 0.9, unknown: 1.0 };
  // موسمية: peak +15%، normal محايد، off -10%
  const SEASON_FACTOR: Record<string, number> = { peak: 1.15, normal: 1.0, off: 0.9 };
  const brandFactor = BRAND_FACTOR[p.brandTier];
  const seasonFactor = SEASON_FACTOR[p.seasonality];
  const finalSAR = Math.round(
    baseSAR * cond * ageFactor * qualityFactor * scarcityFactor *
      locationFactor * riskFactor * timeFactor * shippingFactor * profile.demand *
      brandFactor * seasonFactor,
  );
  return {
    base: p.marketPricePerUnit,
    baseSAR: Math.round(baseSAR),
    conditionFactor: cond,
    ageFactor: Math.round(ageFactor * 100) / 100,
    qualityFactor: Math.round(qualityFactor * 100) / 100,
    scarcityFactor, locationFactor, riskFactor,
    timeFactor: Math.round(timeFactor * 100) / 100,
    categoryFactor: profile.demand,
    finalSAR,
    finalURV: Math.round((finalSAR / URV_IN_SAR) * 100) / 100,
  };
}

// تجميع breakdowns لعدّة سلع
function aggregateBreakdown(items: { product: Product; b: ValueBreakdown }[]): ValueBreakdown {
  const sumSAR = items.reduce((s, x) => s + x.b.finalSAR, 0);
  const sumBaseSAR = items.reduce((s, x) => s + x.b.baseSAR, 0);
  // متوسط مرجح بالقيمة النهائية
  const weighted = (sel: (b: ValueBreakdown) => number) => {
    const totalW = items.reduce((s, x) => s + x.b.finalSAR, 0) || 1;
    return Math.round((items.reduce((s, x) => s + sel(x.b) * x.b.finalSAR, 0) / totalW) * 100) / 100;
  };
  return {
    base: weighted((b) => b.base),
    baseSAR: sumBaseSAR,
    conditionFactor: weighted((b) => b.conditionFactor),
    ageFactor: weighted((b) => b.ageFactor),
    qualityFactor: weighted((b) => b.qualityFactor),
    scarcityFactor: weighted((b) => b.scarcityFactor),
    locationFactor: weighted((b) => b.locationFactor),
    riskFactor: weighted((b) => b.riskFactor),
    timeFactor: weighted((b) => b.timeFactor),
    categoryFactor: weighted((b) => b.categoryFactor),
    finalSAR: sumSAR,
    finalURV: Math.round((sumSAR / URV_IN_SAR) * 100) / 100,
  };
}

function buildEquivalence(sar: number): string {
  const wheatPerKg = 5, goldPerGram = 280, consultHour = 250, codingHour = 120, paintM2 = 35, laborHour = 30;
  return [
    `${(sar / consultHour).toFixed(2)} ساعة استشارة قانونية`,
    `${(sar / codingHour).toFixed(2)} ساعة برمجة`,
    `${(sar / wheatPerKg).toFixed(1)} كجم قمح`,
    `${(sar / paintM2).toFixed(1)} م² دهان`,
    `${(sar / goldPerGram).toFixed(3)} جرام ذهب`,
    `${(sar / laborHour).toFixed(1)} ساعة عمل عادي`,
  ].join(" = ");
}

export const calculateBarter = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<PricingResult> => {
    const { sideA, sideB, shariahMode, serviceBarter } = data;
    const itemsA = sideA.map((p) => ({ product: p, b: valueWithBreakdown(p) }));
    const itemsB = sideB.map((p) => ({ product: p, b: valueWithBreakdown(p) }));
    const breakdownA = aggregateBreakdown(itemsA);
    const breakdownB = aggregateBreakdown(itemsB);
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
    const shariah = analyzeShariahMulti(sideA, sideB, cashBalance, serviceBarter);
    const equivalence = buildEquivalence(Math.min(valueA, valueB));

    let recommendation =
      cashBalance < avg * 0.03
        ? "الصفقة متوازنة — يمكن إتمامها مباشرة."
        : `يُنصح بإضافة ${cashBalance.toLocaleString()} ر.س (${Math.abs(gapURV)} URV) من صاحب (${inFavorOf === "A" ? "ب" : "أ"}) لموازنة القيمة.`;
    let rationale =
      "التقييم يأخذ السعر السوقي، الحالة، العمر، الجودة، الندرة، الموقع، المخاطرة، وزمن التسليم لكل سلعة في الطرفين.";

    if (shariahMode && shariah.level === "forbidden") {
      recommendation = "🚫 لا تُتم هذه الصفقة بهذا الشكل — مخالفة شرعية.";
    } else if (shariahMode && shariah.level === "warning") {
      recommendation = `⚠️ ${shariah.rule}`;
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (apiKey && shariah.level !== "forbidden") {
      try {
        const summarize = (xs: Product[]) =>
          xs.map((p) => `${p.name} [${p.itemType}] × ${p.quantity} ${p.unit}`).join(" + ");
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: "أنت خبير اقتصادي ومحرك تسعير للمقايضة. أجب بالعربية بإيجاز (سطر أو سطرين) بصيغة JSON." },
              { role: "user", content: `قيّم عدالة المقايضة:
- (أ) ${summarize(sideA)} → ${valueA} ر.س (${urvA} URV)
- (ب) ${summarize(sideB)} → ${valueB} ر.س (${urvB} URV)
- الفجوة: ${gap} ر.س | عدالة ${fairness}%
${shariahMode ? `- شرعي: ${shariah.rule}` : ""}
${serviceBarter ? "- وضع: مقايضة خدمة بخدمة" : ""}
أعد JSON فقط: {"recommendation":"...","rationale":"..."}` },
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
      itemsA: itemsA.map((x) => ({ name: x.product.name, sar: x.b.finalSAR, di: toDI(x.b.finalSAR) })),
      itemsB: itemsB.map((x) => ({ name: x.product.name, sar: x.b.finalSAR, di: toDI(x.b.finalSAR) })),
    };
  });
