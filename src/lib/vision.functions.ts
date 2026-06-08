import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DAILY_LIMIT = 30;

const InputSchema = z.object({
  imageBase64: z.string().min(50).max(8_000_000),
  hint: z.string().max(200).optional(),
});

export type VisionAttrs = {
  name: string;
  category: string;
  mainCategory: string;
  tags: string[];
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

// 6 فئات رئيسية لتبسيط التصفّح
const MAIN_CATS = [
  "هواتف وأجهزة",
  "حواسيب وألعاب",
  "وسائل تنقل",
  "أثاث ومنزل",
  "ساعات ومجوهرات",
  "خدمات وأعمال",
  "أخرى",
] as const;

function mapToMain(cat: string): string {
  if (["هواتف","أجهزة لوحية","إلكترونيات","صوتيات","كاميرات"].includes(cat)) return "هواتف وأجهزة";
  if (["حواسيب"].includes(cat)) return "حواسيب وألعاب";
  if (["وسائل تنقل"].includes(cat)) return "وسائل تنقل";
  if (["أثاث","كتب","ملابس"].includes(cat)) return "أثاث ومنزل";
  if (["ساعات","مجوهرات","ذهب","فضة"].includes(cat)) return "ساعات ومجوهرات";
  if (["خدمات مهنية","خدمات يدوية"].includes(cat)) return "خدمات وأعمال";
  return "أخرى";
}

export const analyzeProductImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }): Promise<VisionAttrs> => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI غير مهيأ — اتصل بالدعم");

    // ===== Per-user daily quota (rate limit) =====
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("vision_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", todayStart.toISOString());

    if ((count ?? 0) >= DAILY_LIMIT) {
      throw new Error(`تجاوزت الحد اليومي (${DAILY_LIMIT} صورة/يوم). جرّب غداً أو أدخل البيانات يدوياً.`);
    }

    const dataUrl = data.imageBase64.startsWith("data:")
      ? data.imageBase64
      : `data:image/jpeg;base64,${data.imageBase64}`;

    const prompt = `حلّل صورة المنتج وأخرج JSON بالعربية بالحقول التالية فقط:
- name: اسم المنتج المختصر
- category: واحد من [${ALLOWED_CATS.join(" | ")}]
- mainCategory: واحد من [${MAIN_CATS.join(" | ")}]
- tags: مصفوفة من 3 إلى 6 وسوم قصيرة (كلمة أو كلمتين) تصف الماركة والموديل والميزة واللون
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

    // Log usage (only after a successful AI call so failures don't burn quota)
    await supabase.from("vision_usage").insert({ user_id: userId });

    const j = await res.json();
    const txt = j?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(txt); } catch { parsed = {}; }

    const category = ALLOWED_CATS.includes(parsed.category) ? parsed.category : "أخرى";
    const mainCategory = (MAIN_CATS as readonly string[]).includes(parsed.mainCategory) ? parsed.mainCategory : mapToMain(category);
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags
          .filter((t: unknown) => typeof t === "string")
          .map((t: string) => t.trim().slice(0, 24))
          .filter((t: string) => t.length > 0)
          .slice(0, 6)
      : [];

    return {
      name: String(parsed.name || "منتج").slice(0, 80),
      category,
      mainCategory,
      tags,
      itemType: ["good","service","commodity"].includes(parsed.itemType) ? parsed.itemType : "good",
      condition: ["new","like-new","excellent","good","fair"].includes(parsed.condition) ? parsed.condition : "good",
      estimatedAgeMonths: Math.max(0, Math.min(1200, Number(parsed.estimatedAgeMonths) || 0)),
      marketPriceSAR: Math.max(0, Math.min(50_000_000, Number(parsed.marketPriceSAR) || 0)),
      notes: String(parsed.notes || "").slice(0, 200),
    };
  });
