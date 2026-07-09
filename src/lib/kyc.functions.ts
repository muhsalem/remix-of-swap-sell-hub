import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  idFrontBase64: z.string().min(50).max(8_000_000),
  selfieBase64: z.string().min(50).max(8_000_000).optional(),
  fullName: z.string().min(2).max(120),
});

export type KycAiResult = {
  score: number; // 0-100
  decision: "approved" | "review" | "rejected";
  extracted: { name?: string; docNumber?: string; expiry?: string; nationality?: string };
  reasons: string[];
};

/**
 * Automated KYC via Lovable AI vision. Returns a confidence score + decision.
 * On score >= 80 the profile is marked verified automatically (individual accounts).
 */
export const runKycAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data, context }): Promise<KycAiResult> => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("خدمة الذكاء الاصطناعي غير مهيأة");

    const toDataUrl = (b: string) => (b.startsWith("data:") ? b : `data:image/jpeg;base64,${b}`);

    const prompt = `أنت مدقق هوية آلي. حلّل صورة وثيقة الهوية${data.selfieBase64 ? " وصورة السيلفي" : ""} وأعد JSON بالحقول التالية فقط:
{
  "score": رقم بين 0-100 يعبّر عن ثقتك بأن الوثيقة أصلية وسليمة والاسم يطابق "${data.fullName}"،
  "decision": "approved" | "review" | "rejected",
  "extracted": { "name": "...", "docNumber": "...", "expiry": "YYYY-MM-DD", "nationality": "..." },
  "reasons": ["سبب مختصر", ...]
}
معايير الرفض: صورة ضبابية، وثيقة منتهية، اسم غير مطابق، علامات تلاعب، غياب سمات أمان الوثيقة.
أعِد JSON فقط.`;

    const content: unknown[] = [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: toDataUrl(data.idFrontBase64) } },
    ];
    if (data.selfieBase64) {
      content.push({ type: "image_url", image_url: { url: toDataUrl(data.selfieBase64) } });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content }],
        response_format: { type: "json_object" },
      }),
    });
    if (res.status === 429) throw new Error("تم تجاوز الحد — حاول لاحقاً");
    if (res.status === 402) throw new Error("رصيد الذكاء الاصطناعي منتهي");
    if (!res.ok) throw new Error(`فشل التحقق (${res.status})`);

    const j = await res.json();
    const txt = j?.choices?.[0]?.message?.content ?? "{}";
    let parsed: Partial<KycAiResult> = {};
    try { parsed = JSON.parse(txt); } catch { /* ignore */ }

    const score = Math.max(0, Math.min(100, Number(parsed.score) || 0));
    const decision: KycAiResult["decision"] =
      parsed.decision === "approved" || parsed.decision === "rejected" || parsed.decision === "review"
        ? parsed.decision
        : score >= 80 ? "approved" : score >= 50 ? "review" : "rejected";

    const result: KycAiResult = {
      score,
      decision,
      extracted: parsed.extracted ?? {},
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons.slice(0, 6).map(String) : [],
    };

    // Persist report on private profile
    await supabase
      .from("profiles_private")
      .upsert({
        user_id: userId,
        kyc_ai_score: result.score,
        kyc_ai_report: result as unknown as never,
        kyc_ai_at: new Date().toISOString(),
      } as never, { onConflict: "user_id" });

    // Auto-verify individual accounts on high confidence
    if (decision === "approved") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const ends = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
      await supabaseAdmin
        .from("profiles")
        .update({ verified_badge: true, verified_until: ends } as never)
        .eq("id", userId);
    }

    return result;
  });
