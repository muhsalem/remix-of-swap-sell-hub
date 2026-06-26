import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X, Sparkles, Search, Handshake, ShieldCheck } from "lucide-react";

const KEY = "badel_onboarding_v1";

export function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) {
        const t = setTimeout(() => setOpen(true), 1200);
        return () => clearTimeout(t);
      }
    } catch {}
  }, []);

  function close() {
    try { localStorage.setItem(KEY, "1"); } catch {}
    setOpen(false);
  }

  if (!open) return null;

  const steps = [
    { icon: Sparkles, title: "أهلاً بك في بدِّل", body: "منصة مقايضة ذكية متوافقة شرعياً. بدّل ما تملكه بما تحتاجه دون ربا ودون هدر." },
    { icon: Search, title: "ابحث وقايِض", body: "تصفّح آلاف العروض، استخدم الفلاتر والفئات، أو ابحث بالصورة. كل ذلك مجاناً." },
    { icon: Handshake, title: "تفاوض بذكاء", body: "محرك تسعير عادل + مفاوض AI يقترح أفضل صفقة، مع تثبيت السعر 24 ساعة." },
    { icon: ShieldCheck, title: "اطمئن", body: "نظام Escrow يحفظ حقك، ضمانات للنزاعات، وهيئة شرعية للاستفتاء." },
  ];
  const S = steps[step];
  const Icon = S.icon;
  const isLast = step === steps.length - 1;

  return (
    <div role="dialog" aria-modal="true" aria-label="جولة تعريفية" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative bg-background border border-border rounded-3xl max-w-md w-full p-8 shadow-2xl">
        <button onClick={close} aria-label="إغلاق الجولة التعريفية" className="absolute top-4 left-4 p-1 rounded-full hover:bg-stone-soft">
          <X className="size-5" />
        </button>
        <div className="flex justify-center mb-5">
          <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="size-8 text-primary" aria-hidden />
          </div>
        </div>
        <h2 className="text-2xl font-extrabold text-center mb-3">{S.title}</h2>
        <p className="text-center text-muted-foreground leading-relaxed mb-6">{S.body}</p>
        <div className="flex justify-center gap-1.5 mb-6" aria-hidden>
          {steps.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-primary" : "w-1.5 bg-border"}`} />
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={close}
            className="flex-1 px-4 py-2.5 rounded-full text-sm font-medium border border-border hover:bg-stone-soft"
          >
            تخطّي
          </button>
          {isLast ? (
            <Link
              to="/"
              onClick={close}
              className="flex-1 px-4 py-2.5 rounded-full text-sm font-bold bg-foreground text-background hover:bg-primary text-center"
            >
              ابدأ الآن
            </Link>
          ) : (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="flex-1 px-4 py-2.5 rounded-full text-sm font-bold bg-foreground text-background hover:bg-primary"
            >
              التالي ({step + 1}/{steps.length})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
