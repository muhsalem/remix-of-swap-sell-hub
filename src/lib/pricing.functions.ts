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
});

export type PricingInput = z.infer<typeof InputSchema>;

export type PricingResult = {
  valueA: number;
  valueB: number;
  fairness: number; // 0-100
  gap: number; // valueA - valueB
  inFavorOf: "A" | "B" | "balanced";
  recommendation: string;
  rationale: string;
};

const CONDITION_FACTOR: Record<string, number> = {
  "new": 1.0,
  "like-new": 0.9,
  "excellent": 0.8,
  "good": 0.65,
  "fair": 0.45,
};

function heuristicValue(p: z.infer<typeof ProductSchema>): number {
  const cond = CONDITION_FACTOR[p.condition] ?? 0.6;
  // depreciation ~ 1.2% per month, floor 25%
  const ageFactor = Math.max(0.25, 1 - p.ageMonths * 0.012);
  return Math.round(p.marketPrice * cond * ageFactor);
}

export const calculateBarter = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<PricingResult> => {
    const { productA, productB } = data;
    const valueA = heuristicValue(productA);
    const valueB = heuristicValue(productB);
    const gap = valueA - valueB;
    const avg = (valueA + valueB) / 2;
    const fairness = Math.max(0, Math.round(100 - (Math.abs(gap) / avg) * 100));
    const inFavorOf: "A" | "B" | "balanced" =
      Math.abs(gap) / avg < 0.03 ? "balanced" : gap > 0 ? "B" : "A";

    let recommendation = "الصفقة متوازنة، يمكن إتمامها مباشرة.";
    let rationale = "تقييم تقريبي بناءً على السعر السوقي والحالة والعمر.";

    const apiKey = process.env.LOVABLE_API_KEY;
    if (apiKey) {
      try {
        const res = await fetch(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
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
- المنتج (أ): ${productA.name} | فئة ${productA.category} | حالة ${productA.condition} | عمر ${productA.ageMonths} شهر | سعر سوقي ${productA.marketPrice} ر.س | قيمة محسوبة ${valueA} ر.س
- المنتج (ب): ${productB.name} | فئة ${productB.category} | حالة ${productB.condition} | عمر ${productB.ageMonths} شهر | سعر سوقي ${productB.marketPrice} ر.س | قيمة محسوبة ${valueB} ر.س
- فجوة القيمة: ${gap} ر.س لصالح ${gap > 0 ? "صاحب (ب)" : gap < 0 ? "صاحب (أ)" : "متوازن"}
- نسبة العدالة: ${fairness}%

أعد JSON صرف بهذا الشكل فقط:
{"recommendation":"...","rationale":"..."}`,
                },
              ],
              response_format: { type: "json_object" },
            }),
          }
        );
        if (res.ok) {
          const json = await res.json();
          const content = json?.choices?.[0]?.message?.content;
          if (content) {
            try {
              const parsed = JSON.parse(content);
              if (parsed.recommendation) recommendation = String(parsed.recommendation).slice(0, 240);
              if (parsed.rationale) rationale = String(parsed.rationale).slice(0, 240);
            } catch {
              // keep defaults
            }
          }
        } else if (res.status === 429) {
          rationale = "تم تجاوز الحد المسموح من طلبات الذكاء الاصطناعي مؤقتاً.";
        } else if (res.status === 402) {
          rationale = "نفدت رصيد الذكاء الاصطناعي. يرجى إضافة رصيد للاستمرار.";
        }
      } catch (err) {
        console.error("AI gateway failed", err);
      }
    }

    return { valueA, valueB, fairness, gap, inFavorOf, recommendation, rationale };
  });
