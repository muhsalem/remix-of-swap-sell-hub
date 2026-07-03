import { Link } from "@tanstack/react-router";
import { Sparkles, ShieldCheck, Package, Wrench, Zap, ArrowLeftRight } from "lucide-react";
import { LocalPrice, useUserCurrency } from "@/components/LocalPrice";
import { FX_VS_SAR } from "@/lib/currency-fx";

/**
 * Mini preview of the standalone Pricing Engine.
 * Visually mirrors the full /pricing-engine "Valuation Sandbox":
 * big teal estimate panel, LIVE badge, local-currency line, confidence
 * chip, and the same Sharia disclaimer footer.
 */
export function MiniPricingEngine() {
  const { country } = useUserCurrency();
  const meta = FX_VS_SAR[country] ?? FX_VS_SAR.SAR;

  const estimateSAR = 4200;
  const confidence = 75;

  return (
    <div
      dir="rtl"
      className="glass-strong relative rounded-3xl p-4 sm:p-5 overflow-hidden"
    >
      {/* soft engine glow (identity accents) */}
      <div className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 size-48 rounded-full bg-accent/15 blur-3xl" />

      {/* header row — matches the full engine */}
      <div className="relative flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-xl flex items-center justify-center text-primary-foreground font-extrabold text-lg bg-gradient-engine shadow-lg">
            ⇅
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono">
              Pricing Engine
            </div>
            <div className="text-sm font-bold text-foreground">محرك التسعير العادل</div>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-primary/10 text-primary ring-1 ring-primary/25">
          <Zap className="size-3" /> حساب تلقائي
        </span>
      </div>

      {/* type toggle preview (سلعة / خدمة) */}
      <div className="relative grid grid-cols-2 gap-2 mb-3">
        <TypeChip icon={<Package className="size-4" />} label="سلعة" sub="منتج مادي" active />
        <TypeChip icon={<Wrench className="size-4" />} label="خدمة" sub="مهارة أو وقت" />
      </div>

      {/* estimate hero — teal panel identical in spirit to full engine */}
      <div className="relative rounded-2xl p-4 bg-gradient-engine text-primary-foreground overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-30"
             style={{ background: "radial-gradient(ellipse at 30% 20%, rgba(255,255,255,.35), transparent 60%)" }} />
        <div className="relative flex items-start justify-between mb-1">
          <span className="text-[11px] opacity-90">القيمة الإجمالية المقدّرة</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/15 ring-1 ring-white/30">
            ثقة {confidence}% · متوسطة
          </span>
        </div>

        <div className="relative flex items-baseline gap-2 mt-1">
          <div className="font-mono tabular-nums font-extrabold text-3xl leading-none">
            {estimateSAR.toLocaleString()}
          </div>
          <div className="text-sm opacity-90">ر.س</div>
        </div>

        <div className="relative mt-3 flex items-center justify-between rounded-xl bg-white/10 ring-1 ring-white/20 px-3 py-2 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <span className="text-base leading-none">{meta.flag}</span>
            <span className="opacity-90">بعملتك المحلية</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-400/90 text-emerald-950">
              <span className="size-1.5 rounded-full bg-emerald-800 animate-pulse" /> LIVE
            </span>
            <span className="font-mono tabular-nums font-bold">
              <LocalPrice sar={estimateSAR} />
            </span>
          </span>
        </div>
      </div>

      {/* diagnostics footer — sharia + disclaimer */}
      <div className="relative mt-3 rounded-xl bg-stone-soft/70 border border-border p-3 text-[11px] leading-relaxed text-muted-foreground">
        <div className="flex items-center gap-1.5 mb-1 text-emerald-700 dark:text-emerald-400 font-bold">
          <ShieldCheck className="size-3.5" /> متوافق شرعياً · لا ربا ولا غرر
        </div>
        هذا التقييم إرشادي يعتمد على بيانات السوق ومحرك ذكاء اصطناعي، ولا يُعدّ تقييماً معتمداً.
        السعر النهائي يتحدد بتراضي الطرفين.
      </div>

      {/* AI hint */}
      <div className="relative mt-3 p-3 rounded-xl text-[12px] text-primary-foreground flex items-start gap-2 bg-gradient-engine">
        <Sparkles className="size-4 shrink-0 mt-0.5" />
        <div>
          <strong className="font-bold">توصية AI:</strong> لموازنة صفقة مقابلة قيمتها{" "}
          <LocalPrice sar={3250} className="font-bold tabular-nums" />، أضف{" "}
          <LocalPrice sar={950} className="font-bold tabular-nums" />.
        </div>
      </div>

      {/* CTA */}
      <Link
        to="/pricing-engine"
        className="relative mt-3 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-bold text-primary-foreground bg-foreground hover:bg-primary transition-all"
      >
        افتح محرك التسعير الكامل <ArrowLeftRight className="size-4" />
      </Link>
    </div>
  );
}

function TypeChip({
  icon, label, sub, active = false,
}: { icon: React.ReactNode; label: string; sub: string; active?: boolean }) {
  return (
    <div
      className={
        "rounded-xl px-3 py-2.5 text-center transition-all " +
        (active
          ? "bg-gradient-engine text-primary-foreground ring-1 ring-primary/40 shadow-md"
          : "bg-card text-foreground ring-1 ring-border")
      }
    >
      <div className="flex items-center justify-center gap-1.5 mb-0.5">
        {icon}
        <span className="text-sm font-bold">{label}</span>
      </div>
      <div className={"text-[10px] " + (active ? "opacity-90" : "text-muted-foreground")}>{sub}</div>
    </div>
  );
}
