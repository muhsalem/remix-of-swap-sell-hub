import { Link } from "@tanstack/react-router";
import { Play, ArrowLeftRight, Sparkles, ShieldCheck } from "lucide-react";
import { useState } from "react";

const STEPS = [
  { icon: Sparkles, title: "١ — أضف عرضك", desc: "التقط صورة، ومحرك الـ AI يقترح الفئة والسعر العادل تلقائياً." },
  { icon: ArrowLeftRight, title: "٢ — طابق أو تفاوض", desc: "ابحث عن ما يقايضك، أو دع المطابق الذكي يقترح لك عروضاً موازية." },
  { icon: ShieldCheck, title: "٣ — أتمم بأمان", desc: "الضمان (Escrow) يحمي الطرفين حتى استلام السلعة أو الخدمة." },
];

export function VideoDemo() {
  const [playing, setPlaying] = useState(false);

  return (
    <section className="py-16 md:py-20" id="how">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-accent/10 text-accent-foreground text-xs font-mono rounded-full uppercase tracking-wider mb-4">
              <Play className="size-3 fill-current" />
              كيف تعمل بدِّل؟
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-extrabold mb-4">
              ثلاث خطوات فقط. صفقة عادلة وموثوقة.
            </h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              شاهد كيف تحوّل ما تملكه إلى ما تحتاجه في أقل من ٦٠ ثانية — بلا رسوم نشر، بلا ربا، وبتقييم ذكي عادل.
            </p>

            <ol className="space-y-4 mb-8">
              {STEPS.map((s) => {
                const Icon = s.icon;
                return (
                  <li key={s.title} className="flex gap-3">
                    <div className="shrink-0 size-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <div className="font-bold text-sm">{s.title}</div>
                      <div className="text-sm text-muted-foreground leading-relaxed">{s.desc}</div>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="flex flex-wrap gap-3">
              <Link
                to="/new-listing"
                className="px-6 py-3 bg-foreground text-background rounded-full text-sm font-bold hover:bg-primary transition-all inline-flex items-center gap-2"
              >
                جرّب الآن مجاناً <ArrowLeftRight className="size-4" />
              </Link>
              <Link
                to="/pricing-engine"
                className="px-6 py-3 bg-card border border-border rounded-full text-sm font-bold hover:bg-stone-soft transition-all"
              >
                جرّب محرك التسعير
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="relative aspect-video rounded-3xl overflow-hidden ring-1 ring-black/10 shadow-2xl bg-gradient-to-br from-primary/20 via-accent/10 to-primary/5">
              {!playing ? (
                <button
                  type="button"
                  onClick={() => setPlaying(true)}
                  className="absolute inset-0 w-full h-full flex items-center justify-center group"
                  aria-label="تشغيل فيديو شرح بدّل"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-stone-soft to-primary/10" />
                  <div className="relative z-10 flex flex-col items-center gap-4">
                    <div className="size-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                      <Play className="size-8 fill-current translate-x-0.5" />
                    </div>
                    <div className="px-4 py-1.5 rounded-full bg-background/80 backdrop-blur text-xs font-bold">
                      شاهد شرح ٦٠ ثانية
                    </div>
                  </div>
                </button>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-stone-soft text-center p-8">
                  <div className="max-w-sm">
                    <div className="size-14 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
                      <Play className="size-6" />
                    </div>
                    <p className="text-sm font-bold mb-1">الفيديو التعريفي قيد الإنتاج</p>
                    <p className="text-xs text-muted-foreground">
                      نعمل حالياً على إنتاج فيديو احترافي يشرح المنصة. حتى ذلك الحين، جرّب المنصة مباشرة —
                      التسجيل مجاني وبدون رسوم نشر.
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="absolute -bottom-4 -left-4 hidden md:flex items-center gap-1.5 px-3 py-2 bg-accent text-accent-foreground rounded-full shadow-lg text-xs font-bold">
              <ShieldCheck className="size-4" /> صفقات مضمونة
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
