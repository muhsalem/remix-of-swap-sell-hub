import { Scale } from "lucide-react";
import { LocalPrice } from "@/components/LocalPrice";

const SOURCE_LABEL: Record<string, string> = {
  user: "سعر المُعلن (بدون مرجع)",
  catalog: "كتالوج بَدِّل المرجعي",
  market: "متوسط السوق الحيّ",
  cache: "متوسط السوق (مخزّن)",
  ai: "تقدير الذكاء الاصطناعي",
  fallback: "تقدير تقريبي للفئة",
};

/** التقييم الحيّ داخل بطاقة الإعلان: القيمة العادلة + مصدرها + انحراف السعر. */
export function FairValueTag({
  referenceSar,
  source,
  deviationPct,
}: {
  referenceSar?: number | null;
  source?: string | null;
  deviationPct?: number | null;
}) {
  if (!referenceSar || Number(referenceSar) <= 0) return null;

  const pct = deviationPct == null ? null : Math.round(Number(deviationPct));
  const fair = pct == null ? true : Math.abs(pct) <= 10;
  const label = SOURCE_LABEL[String(source ?? "")] ?? "مرجع سوقي";

  return (
    <div
      className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-stone-soft/70 px-2.5 py-1.5 text-[11px]"
      title={`القيمة العادلة المرجعية · المصدر: ${label}`}
    >
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Scale className="size-3" /> القيمة العادلة
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="font-bold">
          <LocalPrice sar={Number(referenceSar)} />
        </span>
        {pct != null && (
          <span
            className={`font-mono font-bold ${
              fair ? "text-emerald-600" : pct > 0 ? "text-amber-600" : "text-primary"
            }`}
          >
            {pct > 0 ? "+" : ""}
            {pct}%
          </span>
        )}
      </span>
    </div>
  );
}
