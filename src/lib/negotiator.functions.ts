import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * AI Negotiator: suggests a fair counter-offer message and price band
 * for a barter trade using Lovable AI Gateway (free Gemini model).
 */
export const suggestNegotiation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      myItem: z.string().min(2).max(200),
      myItemValue: z.number().nonnegative().optional(),
      theirItem: z.string().min(2).max(200),
      theirItemValue: z.number().nonnegative().optional(),
      context: z.string().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("missing_ai_key");

    const sys = `أنت مفاوض خبير في منصة مقايضة عربية إسلامية. اقترح رسالة تفاوض مهذبة وعادلة، وحدد:
- هل الصفقة عادلة؟ (نعم/لا/قريبة)
- فجوة القيمة التقريبية (٪)
- رسالة تفاوض جاهزة للإرسال (3-4 أسطر، عربية فصحى ودودة)
- 3 نقاط لتقوية موقفك
أرجع JSON فقط: {"fairness":"...","gapPct":0,"message":"...","tips":["..."]}`;

    const user = `لدي: ${data.myItem}${data.myItemValue ? ` (~${data.myItemValue} ر.س)` : ""}
يطلب: ${data.theirItem}${data.theirItemValue ? ` (~${data.theirItemValue} ر.س)` : ""}
${data.context ? `سياق: ${data.context}` : ""}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`ai_error_${res.status}`);
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content ?? "{}";
    try {
      return JSON.parse(content) as {
        fairness: string;
        gapPct: number;
        message: string;
        tips: string[];
      };
    } catch {
      return { fairness: "غير محدد", gapPct: 0, message: content, tips: [] };
    }
  });
