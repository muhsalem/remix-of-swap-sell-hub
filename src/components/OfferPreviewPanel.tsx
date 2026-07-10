import { ArrowLeftRight, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { LocalPrice } from "@/components/LocalPrice";
import { formatSAR } from "@/lib/format-price";

type Item = {
  title: string;
  market_price: number | string;
  images?: string[];
} | null | undefined;

export function OfferPreviewPanel({
  mine,
  target,
  cash,
}: {
  mine: Item;
  target: Item;
  cash: number;
}) {
  if (!mine || !target) return null;
  const myVal = Number(mine.market_price) || 0;
  const tgtVal = Number(target.market_price) || 0;
  const myTotal = myVal + (Number(cash) || 0);
  const diff = myTotal - tgtVal;
  const pct = tgtVal > 0 ? (myTotal / tgtVal) * 100 : 0;
  const fairness = Math.max(0, Math.min(100, Math.round(100 - Math.abs(100 - pct))));
  const tone =
    fairness >= 90
      ? { cls: "bg-emerald-500/10 ring-emerald-500/30 text-emerald-700", icon: CheckCircle2, label: "صفقة عادلة" }
      : fairness >= 70
        ? { cls: "bg-amber-500/10 ring-amber-500/30 text-amber-700", icon: AlertTriangle, label: "اختلال طفيف" }
        : { cls: "bg-rose-500/10 ring-rose-500/30 text-rose-700", icon: AlertTriangle, label: "اختلال كبير" };
  const Icon = tone.icon;

  const suggestion =
    diff < 0
      ? `أضف نقداً للموازنة: ≈ ${Math.abs(diff).toLocaleString()} ر.س`
      : diff > 0
        ? `أنت تدفع زيادة بقيمة ≈ ${diff.toLocaleString()} ر.س — يمكنك تقليل النقد أو طلب موازنة من الطرف الآخر`
        : `التوازن مثالي — يمكنك الإرسال مباشرة`;

  return (
    <div className="bg-card rounded-3xl ring-1 ring-black/5 p-6 mb-6 space-y-4">
      <div className="flex items-center gap-2">
        <ArrowLeftRight className="size-4 text-primary" />
        <h2 className="font-bold">معاينة عدالة المقايضة (تسعير AI)</h2>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <Stat label="قيمة عرضك" value={<LocalPrice sar={myVal} />} />
        <Stat label="نقد للموازنة" value={`${(Number(cash) || 0).toLocaleString()} ر.س`} />
        <Stat label="قيمة الطرف الآخر" value={<LocalPrice sar={tgtVal} />} />
      </div>

      <div className={`p-4 rounded-2xl ring-1 ${tone.cls} flex items-start gap-3`}>
        <Icon className="size-5 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="font-extrabold text-sm flex items-center gap-2">
            {tone.label}
            <span className="font-mono text-xs opacity-80">عدالة {fairness}%</span>
          </div>
          <div className="text-xs mt-1 opacity-90 font-bold">
            الفرق: {diff >= 0 ? "+" : ""}{diff.toLocaleString()} ر.س ({pct.toFixed(0)}% من قيمة الطرف الآخر)
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-stone-soft p-3 rounded-xl">
        <Info className="size-3.5 shrink-0 mt-0.5" />
        <span>{suggestion}</span>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="p-3 rounded-xl bg-stone-soft">
      <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">{label}</div>
      <div className="font-display text-sm font-extrabold mt-1">{value}</div>
    </div>
  );
}
