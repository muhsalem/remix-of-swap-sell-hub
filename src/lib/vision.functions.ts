import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  imageBase64: z.string().min(50).max(8_000_000), // data URL or base64
  hint: z.string().max(200).optional(),
});

export type VisionAttrs = {
  name: string;
  category: string;
  itemType: "good" | "service" | "commodity";
  condition: "new" | "like-new" | "excellent" | "good" | "fair";
  estimatedAgeMonths: number;
  marketPriceSAR: number;
  notes: string;
};

const ALLOWED_CATS = [
  "إلكترونيات","هواتف","أجهزة لوحية","حواسيب","صوتيات","كاميرات","ساعات","مجوهرات",
  "وسائل تنقل","أثاث","كتب","ملابس","خدمات مهنية","خدمات يدوية",
  "ذهب","فضة","حبوب وأغذية","أخرى",
];

export const analyzeProductImage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<VisionAttrs> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI غير مهيأ — اتصل بالدعم");

    const dataUrl = data.imageBase64.startsWith("data:")
      ? data.imageBase64
      : `data:image/jpeg;base64,${data.imageBase64}`;

    const prompt = `حلّل صورة المنتج وأخرج JSON بالعربية بالحقول التالية فقط:
- name: اسم المنتج المختصر
- category: واحد من [${ALLOWED_CATS.join(" | ")}]
- itemType: "good" أو "service" أو "commodity"
- condition: واحد من ["new","like-new","excellent","good","fair"]
- estimatedAgeMonths: عدد (0 إذا جديد)
- marketPriceSAR: سعر تقديري في السوق السعودي بالريال (رقم فقط)
- notes: ملاحظة قصيرة (سطر واحد)
${data.hint ? `\nتلميح من المستخدم: ${data.hint}` : ""}
أعِد JSON فقط بدون أي شرح.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        }],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) throw new Error("تم تجاوز الحد — حاول لاحقاً");
    if (res.status === 402) throw new Error("الرصيد منتهي — أضف رصيد للذكاء الاصطناعي");
    if (!res.ok) throw new Error(`فشل التحليل (${res.status})`);

    const j = await res.json();
    const txt = j?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(txt); } catch { parsed = {}; }

    return {
      name: String(parsed.name || "منتج").slice(0, 80),
      category: ALLOWED_CATS.includes(parsed.category) ? parsed.category : "أخرى",
      itemType: ["good","service","commodity"].includes(parsed.itemType) ? parsed.itemType : "good",
      condition: ["new","like-new","excellent","good","fair"].includes(parsed.condition) ? parsed.condition : "good",
      estimatedAgeMonths: Math.max(0, Math.min(1200, Number(parsed.estimatedAgeMonths) || 0)),
      marketPriceSAR: Math.max(0, Math.min(50_000_000, Number(parsed.marketPriceSAR) || 0)),
      notes: String(parsed.notes || "").slice(0, 200),
    };
  });
