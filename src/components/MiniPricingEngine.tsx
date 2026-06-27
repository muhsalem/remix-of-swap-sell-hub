import { Link } from "@tanstack/react-router";
import { Sparkles, ArrowLeftRight, ShieldCheck } from "lucide-react";
import { LocalPrice, useUserCurrency } from "@/components/LocalPrice";
import { FX_VS_SAR } from "@/lib/currency-fx";

/**
 * Mini preview of the standalone Pricing Engine, embedded in the homepage Hero.
 * Visual identity mirrors /pricing-engine: dark glass surface, cyan→violet
 * gradient accents, amber price tones, animated match gauge. All prices honor
 * the visitor's selected country via LocalPrice.
 */
export function MiniPricingEngine() {
  const { country, fx } = useUserCurrency();
  const flag = FX_VS_SAR[country]?.flag ?? "🇸🇦";

  // Sample swap (SAR base — auto-converted by <LocalPrice />)
  const offerSAR = 4200;
  const counterSAR = 1850;
  const gapSAR = offerSAR - counterSAR;
  const match = 94;

  return (
    <div
      dir="rtl"
      className="relative rounded-3xl p-5 shadow-2xl ring-1 ring-white/10 overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, hsl(225 28% 8%) 0%, hsl(225 28% 6%) 100%)",
        backdropFilter: "blur(14px)",
      }}
    >
      {/* glow accents */}
      <div className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 size-48 rounded-full bg-violet-500/20 blur-3xl" />

      {/* header */}
      <div className="relative flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-xl flex items-center justify-center text-white font-extrabold text-lg shadow-lg shadow-cyan-500/30"
               style={{ background: "linear-gradient(135deg, hsl(190 95% 46%), hsl(262 80% 64%))" }}>
            ⇅
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-mono">Pricing Engine</div>
            <div className="text-sm font-bold text-slate-100">محرك التسعير العادل</div>
          </div>
        </div>
        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
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
      <div className="relative mt-4 rounded-xl bg-black/40 ring-1 ring-white/5 p-3">
        <div className="flex items-center justify-between text-[11px] mb-2">
          <span className="text-slate-400 flex items-center gap-1">
            <ShieldCheck className="size-3 text-emerald-400" /> متوافق شرعياً
          </span>
          <span className="text-slate-400 inline-flex items-center gap-1">
            <span>{flag}</span>
            <span className="font-mono">{country}</span>
          </span>
        </div>
        <div className="text-[12px] text-slate-200 leading-relaxed">
          فرق التسوية:{" "}
          <span className="font-bold text-amber-400 font-mono tabular-nums">
            <LocalPrice sar={gapSAR} />
          </span>
          <span className="text-slate-500"> · يدفعها الطرف الأقل قيمة</span>
        </div>
      </div>

      {/* AI hint */}
      <div className="relative mt-3 p-3 rounded-xl text-[12px] text-white flex items-start gap-2"
           style={{ background: "linear-gradient(135deg, hsl(190 95% 36%), hsl(262 70% 50%))" }}>
        <Sparkles className="size-4 shrink-0 mt-0.5" />
        <div>
          <strong className="font-bold">توصية AI:</strong> أضف{" "}
          <LocalPrice sar={950} className="font-bold tabular-nums" /> لموازنة الصفقة بعدالة.
        </div>
      </div>

      {/* CTA */}
      <Link
        to="/pricing-engine"
        className="relative mt-4 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-bold text-slate-900 bg-gradient-to-r from-cyan-300 to-violet-300 hover:from-cyan-200 hover:to-violet-200 transition-all"
      >
        افتح محرك التسعير الكامل <ArrowLeftRight className="size-4" />
      </Link>
    </div>
  );
}

function SlotCard({
  label, name, cat, sar, accent,
}: { label: string; name: string; cat: string; sar: number; accent: "cyan" | "violet" }) {
  const ring = accent === "cyan" ? "ring-cyan-500/40 shadow-cyan-500/10" : "ring-violet-500/40 shadow-violet-500/10";
  const txt = accent === "cyan" ? "text-cyan-300" : "text-violet-300";
  return (
    <div className={`rounded-xl bg-white/[0.03] ring-1 ${ring} p-3 text-center shadow-lg`}>
      <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-1">{label}</div>
      <div className="text-[13px] font-bold text-slate-100 truncate">{name}</div>
      <div className="text-[10px] text-slate-500 mb-2">{cat}</div>
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
        className="size-[78px] rounded-full flex items-center justify-center shadow-[0_0_22px_rgba(139,92,246,0.35)]"
        style={{
          background: `radial-gradient(closest-side, hsl(225 28% 8%) 70%, transparent 71%), conic-gradient(hsl(262 80% 64%) ${pct}%, hsl(225 20% 18%) 0)`,
        }}
      >
        <div className="text-center">
          <div className="text-lg font-extrabold text-white font-mono leading-none">{pct}%</div>
          <div className="text-[8px] uppercase tracking-wider text-slate-400 mt-0.5">توافق</div>
        </div>
      </div>
    </div>
  );
}
