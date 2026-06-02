import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ProductSchema = z.object({
  name: z.string().min(1).max(120),
  category: z.string().min(1).max(60),
  condition: z.enum(["new", "like-new", "excellent", "good", "fair"]),
  ageMonths: z.number().min(0).max(360),
  marketPrice: z.number().min(1).max(10_000_000),
});

const InputSchema = z.object({
  productA: ProductSchema,
  productB: ProductSchema,
  shariahMode: z.boolean().optional().default(false),
});

export type PricingInput = z.infer<typeof InputSchema>;
export type Product = z.infer<typeof ProductSchema>;

export type ShariahAnalysis = {
  ribawiA: boolean;
  ribawiB: boolean;
  sameRibawiType: boolean;
  level: "safe" | "warning" | "forbidden";
  rule: string;
  notes: string[];
};

export type PricingResult = {
  valueA: number;
  valueB: number;
  fairness: number;
  gap: number;
  inFavorOf: "A" | "B" | "balanced";
  cashBalance: number;
  recommendation: string;
  rationale: string;
  breakdownA: ValueBreakdown;
  breakdownB: ValueBreakdown;
  shariah: ShariahAnalysis;
};

export type ValueBreakdown = {
  base: number;
  conditionFactor: number;
  ageFactor: number;
  categoryFactor: number;
  demandFactor: number;
  final: number;
};

const CONDITION_FACTOR: Record<string, number> = {
  "new": 1.0,
  "like-new": 0.92,
  "excellent": 0.82,
  "good": 0.68,
  "fair": 0.5,
};

// شهرية الإهلاك حسب الفئة + معامل القيمة الباقية بعد سنة
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
  "أخرى": { monthlyDecay: 0.012, floor: 0.3, demand: 0.9 },
};

// الأصناف الربوية الستة + النقود
const RIBAWI_KEYWORDS: { type: string; keywords: string[] }[] = [
  { type: "ذهب", keywords: ["ذهب", "gold", "سبيكة", "جنيه ذهب"] },
  { type: "فضة", keywords: ["فضة", "silver"] },
  { type: "نقود", keywords: ["ريال", "دولار", "يورو", "درهم", "جنيه", "عملة", "نقود", "كاش", "cash"] },
  { type: "قمح", keywords: ["قمح", "دقيق", "wheat"] },
  { type: "شعير", keywords: ["شعير", "barley"] },
  { type: "تمر", keywords: ["تمر", "بلح", "dates"] },
  { type: "ملح", keywords: ["ملح", "salt"] },
];

function detectRibawi(name: string, category: string): string | null {
  const txt = `${name} ${category}`.toLowerCase();
  for (const r of RIBAWI_KEYWORDS) {
    if (r.keywords.some((k) => txt.includes(k.toLowerCase()))) return r.type;
  }
  return null;
}

function analyzeShariah(a: Product, b: Product, cashBalance: number): ShariahAnalysis {
  const ribA = detectRibawi(a.name, a.category);
  const ribB = detectRibawi(b.name, b.category);
  const notes: string[] = [];
  let level: ShariahAnalysis["level"] = "safe";
  let rule = "المقايضة جائزة شرعاً بإذن الله — الأصناف غير ربوية.";

  if (ribA && ribB && ribA === ribB) {
    level = "forbidden";
    rule = `تبادل صنف ربوي واحد (${ribA} بـ ${ribA}) يجب أن يكون مثلاً بمثل ويداً بيد، وأي تفاوت في الكمية أو القيمة = ربا الفضل.`;
    notes.push("اجعل الكمية متساوية تماماً.");
    notes.push("يتم التقابض في نفس المجلس دون تأخير.");
    if (cashBalance !== 0) notes.push("لا يجوز إضافة مبلغ نقدي لموازنة الصفقة.");
  } else if (ribA && ribB && ribA !== ribB) {
    level = "warning";
    rule = `تبادل صنفين ربويين مختلفين (${ribA} بـ ${ribB}) — يجوز التفاضل لكن يجب التقابض في نفس المجلس (يداً بيد).`;
    notes.push("التسليم والاستلام في نفس اللقاء شرط للصحة.");
  } else if (ribA || ribB) {
    level = "warning";
    const r = ribA ?? ribB;
    rule = `أحد طرفي المقايضة صنف ربوي (${r}) — يجب أن يتم التقابض في نفس المجلس.`;
    notes.push("التسليم الفوري شرط لصحة العقد.");
    notes.push("لا يجوز تأجيل تسليم الطرف الربوي.");
  }

  return {
    ribawiA: !!ribA,
    ribawiB: !!ribB,
    sameRibawiType: !!(ribA && ribB && ribA === ribB),
    level,
    rule,
    notes,
  };
}

function valueWithBreakdown(p: Product): ValueBreakdown {
  const cond = CONDITION_FACTOR[p.condition] ?? 0.6;
  const profile = CATEGORY_PROFILE[p.category] ?? CATEGORY_PROFILE["أخرى"];
  const ageFactor = Math.max(profile.floor, 1 - p.ageMonths * profile.monthlyDecay);
  const final = Math.round(p.marketPrice * cond * ageFactor * profile.demand);
  return {
    base: p.marketPrice,
    conditionFactor: cond,
    ageFactor: Math.round(ageFactor * 100) / 100,
    categoryFactor: profile.demand,
    demandFactor: profile.demand,
    final,
  };
}

export const calculateBarter = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<PricingResult> => {
    const { productA, productB, shariahMode } = data;
    const breakdownA = valueWithBreakdown(productA);
    const breakdownB = valueWithBreakdown(productB);
    const valueA = breakdownA.final;
    const valueB = breakdownB.final;
    const gap = valueA - valueB;
    const avg = (valueA + valueB) / 2;
    const fairness = Math.max(0, Math.round(100 - (Math.abs(gap) / avg) * 100));
    const inFavorOf: "A" | "B" | "balanced" =
      Math.abs(gap) / avg < 0.03 ? "balanced" : gap > 0 ? "B" : "A";
    const cashBalance = Math.abs(gap);
    const shariah = analyzeShariah(productA, productB, cashBalance);

    let recommendation =
      cashBalance < avg * 0.03
        ? "الصفقة متوازنة — يمكن إتمامها مباشرة."
        : `يُنصح بإضافة ${cashBalance.toLocaleString()} ر.س من صاحب (${inFavorOf === "A" ? "ب" : "أ"}) لموازنة القيمة.`;
    let rationale = "تقييم مبني على السعر السوقي والحالة والعمر ومعامل الفئة والطلب.";

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
                content:
                  "أنت محرك تسعير ذكي للمقايضة. أجب بالعربية بإيجاز شديد (سطر أو سطرين). قدّم توصية عملية وتحليلًا منطقيًا.",
              },
              {
                role: "user",
                content: `قيّم عدالة هذه المقايضة:
- المنتج (أ): ${productA.name} | ${productA.category} | ${productA.condition} | ${productA.ageMonths} شهر | سوق ${productA.marketPrice} ر.س | محسوبة ${valueA} ر.س
- المنتج (ب): ${productB.name} | ${productB.category} | ${productB.condition} | ${productB.ageMonths} شهر | سوق ${productB.marketPrice} ر.س | محسوبة ${valueB} ر.س
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
                recommendation = String(parsed.recommendation).slice(0, 240);
              if (parsed.rationale) rationale = String(parsed.rationale).slice(0, 240);
            } catch {
              // keep defaults
            }
          }
        } else if (res.status === 429) {
          rationale = "تم تجاوز الحد المسموح من طلبات الذكاء الاصطناعي مؤقتاً.";
        } else if (res.status === 402) {
          rationale = "نفد رصيد الذكاء الاصطناعي.";
        }
      } catch (err) {
        console.error("AI gateway failed", err);
      }
    }

    return {
      valueA,
      valueB,
      fairness,
      gap,
      inFavorOf,
      cashBalance,
      recommendation,
      rationale,
      breakdownA,
      breakdownB,
      shariah,
    };
  });
