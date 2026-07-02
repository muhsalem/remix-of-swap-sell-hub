import { Link } from "@tanstack/react-router";
import { Sparkles, ArrowLeftRight, ShieldCheck } from "lucide-react";
import { LocalPrice, useUserCurrency } from "@/components/LocalPrice";
import { FX_VS_SAR } from "@/lib/currency-fx";

/**
 * Mini preview of the standalone Pricing Engine, embedded in the homepage Hero.
 * Uses the site's light visual identity: glass surface, cyan→violet gradient
 * accents, amber price tones. All prices honor the visitor's currency.
 */
export function MiniPricingEngine() {
  const { country } = useUserCurrency();
  const flag = FX_VS_SAR[country]?.flag ?? "🇸🇦";

  const offerSAR = 4200;
  const counterSAR = 1850;
  const gapSAR = offerSAR - counterSAR;
  const match = 94;

  return (
    <div
      dir="rtl"
      className="glass-strong relative rounded-3xl p-5 overflow-hidden ring-glow-cyan"
    >
      {/* glow accents */}
      <div className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 size-48 rounded-full bg-accent/15 blur-3xl" />

      {/* header */}
      <div className="relative flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-xl flex items-center justify-center text-primary-foreground font-extrabold text-lg bg-gradient-engine shadow-lg">
            ⇅
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono">Pricing Engine</div>
            <div className="text-sm font-bold text-foreground">محرك التسعير العادل</div>
          </div>
        </div>
        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/30 dark:text-emerald-400">
          LIVE
        </span>
      </div>

      {/* swap slots + gauge */}
      <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-2.5">
        <SlotCard label="عرضك" name="آيفون 14 برو" cat="إلكترونيات" sar={offerSAR} accent="cyan" />
        <Gauge value={match} />
        <SlotCard label="العرض المقابل" name="سماعات Sony" cat="إكسسوارات" sar={counterSAR} accent="violet" />
      </div>

      {/* diagnostics */}
      <div className="relative mt-4 rounded-xl bg-stone-soft/70 border border-border p-3">
        <div className="flex items-center justify-between text-[11px] mb-2">
          <span className="text-muted-foreground flex items-center gap-1">
            <ShieldCheck className="size-3 text-emerald-600" /> متوافق شرعياً
          </span>
          <span className="text-muted-foreground inline-flex items-center gap-1">
            <span>{flag}</span>
            <span className="font-mono">{country}</span>
          </span>
        </div>
        <div className="text-[12px] text-foreground leading-relaxed">
          فرق التسوية:{" "}
          <span className="font-bold text-amber-600 font-mono tabular-nums">
            <LocalPrice sar={gapSAR} />
          </span>
          <span className="text-muted-foreground"> · يدفعها الطرف الأقل قيمة</span>
        </div>
      </div>

      {/* AI hint */}
      <div className="relative mt-3 p-3 rounded-xl text-[12px] text-primary-foreground flex items-start gap-2 bg-gradient-engine">
        <Sparkles className="size-4 shrink-0 mt-0.5" />
        <div>
          <strong className="font-bold">توصية AI:</strong> أضف{" "}
          <LocalPrice sar={950} className="font-bold tabular-nums" /> لموازنة الصفقة بعدالة.
        </div>
      </div>

      {/* CTA */}
      <Link
        to="/pricing-engine"
        className="relative mt-4 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-bold text-primary-foreground bg-gradient-engine hover:opacity-90 transition-all"
      >
        افتح محرك التسعير الكامل <ArrowLeftRight className="size-4" />
      </Link>
    </div>
  );
}

function SlotCard({
  label, name, cat, sar, accent,
}: { label: string; name: string; cat: string; sar: number; accent: "cyan" | "violet" }) {
  const ring = accent === "cyan" ? "ring-primary/40" : "ring-accent/40";
  const txt = accent === "cyan" ? "text-primary" : "text-accent";
  return (
    <div className={`rounded-xl bg-card ring-1 ${ring} p-3 text-center shadow-sm`}>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold mb-1">{label}</div>
      <div className="text-[13px] font-bold text-foreground truncate">{name}</div>
      <div className="text-[10px] text-muted-foreground mb-2">{cat}</div>
      <div className={`text-sm font-extrabold font-mono tabular-nums ${txt}`}>
        <LocalPrice sar={sar} />
      </div>
    </div>
  );
}

function Gauge({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="flex flex-col items-center">
      <div
        className="size-[78px] rounded-full flex items-center justify-center ring-glow-violet"
        style={{
          background: `radial-gradient(closest-side, hsl(0 0% 100%) 70%, transparent 71%), conic-gradient(hsl(262 70% 55%) ${pct}%, hsl(215 20% 88%) 0)`,
        }}
      >
        <div className="text-center">
          <div className="text-lg font-extrabold text-foreground font-mono leading-none">{pct}%</div>
          <div className="text-[8px] uppercase tracking-wider text-muted-foreground mt-0.5">توافق</div>
        </div>
      </div>
    </div>
  );
}
