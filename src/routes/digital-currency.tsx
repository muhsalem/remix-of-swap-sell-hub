import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Coins, ArrowLeftRight, ShieldCheck, TrendingUp, Wallet, Gift, Info, ArrowRight } from "lucide-react";
import { Nav } from "@/components/Nav";

export const Route = createFileRoute("/digital-currency")({
  head: () => ({
    meta: [
      { title: "العملة الرقمية الداخلية DI — بادل" },
      { name: "description", content: "تعرّف على كيفية عمل عملة بادل الرقمية الداخلية (DI)، ربطها بعملتك المحلية، ومصادر اكتسابها واستخدامها." },
    ],
  }),
  component: DigitalCurrencyPage,
});

// 1 DI = 5 SAR baseline. FX rates approx (relative to SAR).
// SAR is the anchor; rates show how many local units equal 1 SAR.
const FX_VS_SAR: Record<string, { label: string; symbol: string; perSAR: number; flag: string }> = {
  SAR: { label: "السعودية",  symbol: "ر.س",  perSAR: 1.00,   flag: "🇸🇦" },
  AED: { label: "الإمارات",  symbol: "د.إ",  perSAR: 0.98,   flag: "🇦🇪" },
  KWD: { label: "الكويت",    symbol: "د.ك",  perSAR: 0.082,  flag: "🇰🇼" },
  QAR: { label: "قطر",       symbol: "ر.ق",  perSAR: 0.97,   flag: "🇶🇦" },
  BHD: { label: "البحرين",   symbol: "د.ب",  perSAR: 0.100,  flag: "🇧🇭" },
  OMR: { label: "عُمان",      symbol: "ر.ع",  perSAR: 0.103,  flag: "🇴🇲" },
  EGP: { label: "مصر",       symbol: "ج.م",  perSAR: 13.20,  flag: "🇪🇬" },
  JOD: { label: "الأردن",    symbol: "د.أ",  perSAR: 0.189,  flag: "🇯🇴" },
  MAD: { label: "المغرب",    symbol: "د.م",  perSAR: 2.65,   flag: "🇲🇦" },
  TND: { label: "تونس",      symbol: "د.ت",  perSAR: 0.84,   flag: "🇹🇳" },
  USD: { label: "الولايات المتحدة", symbol: "$", perSAR: 0.267, flag: "🇺🇸" },
  EUR: { label: "أوروبا",    symbol: "€",    perSAR: 0.247,  flag: "🇪🇺" },
  GBP: { label: "بريطانيا",  symbol: "£",    perSAR: 0.211,  flag: "🇬🇧" },
};
const DI_TO_SAR = 5;

function detectCountry(): string {
  if (typeof navigator === "undefined") return "SAR";
  const lang = (navigator.language || "ar-SA").toLowerCase();
  if (lang.includes("-eg")) return "EGP";
  if (lang.includes("-ae")) return "AED";
  if (lang.includes("-kw")) return "KWD";
  if (lang.includes("-qa")) return "QAR";
  if (lang.includes("-bh")) return "BHD";
  if (lang.includes("-om")) return "OMR";
  if (lang.includes("-jo")) return "JOD";
  if (lang.includes("-ma")) return "MAD";
  if (lang.includes("-tn")) return "TND";
  if (lang.includes("-gb")) return "GBP";
  if (lang.includes("-us")) return "USD";
  if (lang.startsWith("fr") || lang.startsWith("de") || lang.startsWith("es") || lang.startsWith("it")) return "EUR";
  return "SAR";
}

function DigitalCurrencyPage() {
  const [country, setCountry] = useState<string>(() => (typeof window !== "undefined" ? detectCountry() : "SAR"));
  const [di, setDi] = useState<number>(10);

  const fx = FX_VS_SAR[country] ?? FX_VS_SAR.SAR;
  const localValue = useMemo(() => di * DI_TO_SAR * fx.perSAR, [di, fx.perSAR]);
  const oneDiLocal = DI_TO_SAR * fx.perSAR;

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground font-body">
      <Nav />

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* breadcrumb */}
        <div className="text-xs font-bold text-muted-foreground mb-3 flex items-center gap-1">
          <Link to="/" className="hover:text-primary">الرئيسية</Link>
          <ArrowRight className="size-3 rotate-180" />
          <span className="text-foreground">العملة الرقمية الداخلية</span>
        </div>

        {/* Hero */}
        <section className="rounded-3xl overflow-hidden ring-1 ring-black/5 bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground p-8 md:p-12 relative">
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 80%, white 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }} />
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur text-xs font-extrabold">
              <Coins className="size-4" /> DIGITAL INTERNAL · DI
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-black mt-4 leading-tight">
              عملة بادل الرقمية الداخلية
            </h1>
            <p className="mt-3 text-base md:text-lg font-bold opacity-95 max-w-3xl">
              وحدة حساب ثابتة تقيس عدالة المقايضة بمعزل عن تقلّب العملات — مرتبطة بسلّة الصفقات
              المُتمّة داخل المنصة، وليست عملة تداول خارجي.
            </p>
            <div className="mt-6 inline-flex items-center gap-3 bg-white/15 backdrop-blur px-5 py-3 rounded-2xl font-mono font-black text-xl">
              1 DI <ArrowLeftRight className="size-5 opacity-80" /> {DI_TO_SAR} ر.س
            </div>
          </div>
        </section>

        {/* Local-currency converter */}
        <section className="mt-8 rounded-3xl bg-card ring-1 ring-black/5 p-6 md:p-8">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="size-5 text-primary" />
            <h2 className="font-display text-2xl font-extrabold">القيمة بعملتك المحلية</h2>
          </div>
          <p className="text-sm text-muted-foreground font-bold mb-5">
            اختر بلدك لرؤية قيمة الـ DI مقابل عملتك. الأسعار إرشادية وتُحدَّث دورياً.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground block mb-1.5 font-extrabold">
                بلدك / عملتك
              </label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full px-3 py-3 rounded-xl bg-stone-soft border border-border text-base font-bold outline-none focus:ring-2 ring-primary/30"
              >
                {Object.entries(FX_VS_SAR).map(([code, v]) => (
                  <option key={code} value={code}>{v.flag} {v.label} ({code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground block mb-1.5 font-extrabold">
                المبلغ بالـ DI
              </label>
              <input
                type="number" min={0} step={1} value={di}
                onChange={(e) => setDi(Math.max(0, Number(e.target.value) || 0))}
                className="w-full px-3 py-3 rounded-xl bg-stone-soft border border-border text-base font-bold outline-none focus:ring-2 ring-primary/30"
              />
            </div>
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
              <div className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground mb-1">
                يساوي بعملتك
              </div>
              <div className="font-display text-2xl md:text-3xl font-black tabular-nums">
                {localValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-base font-extrabold opacity-70">{fx.symbol}</span>
              </div>
              <div className="text-[11px] text-muted-foreground font-bold mt-1">
                1 DI ≈ {oneDiLocal.toLocaleString(undefined, { maximumFractionDigits: 3 })} {fx.symbol}
              </div>
            </div>
          </div>

          {/* Quick reference table */}
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm text-right">
              <thead className="bg-stone-soft text-xs uppercase tracking-wider font-extrabold">
                <tr>
                  <th className="px-4 py-3">العملة</th>
                  <th className="px-4 py-3">1 DI</th>
                  <th className="px-4 py-3">10 DI</th>
                  <th className="px-4 py-3">100 DI</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {Object.entries(FX_VS_SAR).map(([code, v]) => {
                  const one = DI_TO_SAR * v.perSAR;
                  return (
                    <tr key={code} className={`border-t border-border ${code === country ? "bg-primary/5 font-extrabold" : ""}`}>
                      <td className="px-4 py-2.5 font-sans font-extrabold">{v.flag} {v.label} <span className="text-muted-foreground">({code})</span></td>
                      <td className="px-4 py-2.5">{one.toLocaleString(undefined, { maximumFractionDigits: 3 })} {v.symbol}</td>
                      <td className="px-4 py-2.5">{(one * 10).toLocaleString(undefined, { maximumFractionDigits: 2 })} {v.symbol}</td>
                      <td className="px-4 py-2.5">{(one * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })} {v.symbol}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* How it works */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          <Card icon={<Gift className="size-5" />} title="كيف تكتسب DI؟">
            <ul className="list-disc pr-5 space-y-1.5 font-bold text-sm">
              <li>مكافأة ترحيب 100 DI عند التسجيل وتفعيل الحساب.</li>
              <li>50 DI لكل صفقة مقايضة مُتمّة بنجاح.</li>
              <li>تقييمات إيجابية متراكمة ترفع الحدّ الأقصى الشهري للمكافآت.</li>
            </ul>
          </Card>
          <Card icon={<TrendingUp className="size-5" />} title="كيف تستخدم DI؟">
            <ul className="list-disc pr-5 space-y-1.5 font-bold text-sm">
              <li>موازنة الفروقات بين عرضين غير متكافئين دون الحاجة لنقد.</li>
              <li>دفع عمولة المنصة (3%) من قيمة الصفقة.</li>
              <li>الوصول إلى عروض مميّزة وعمليات إبراز للقوائم.</li>
            </ul>
          </Card>
          <Card icon={<ShieldCheck className="size-5" />} title="ضوابط شرعية واقتصادية">
            <ul className="list-disc pr-5 space-y-1.5 font-bold text-sm">
              <li>ليست عملة استثمارية ولا تُتداول خارج المنصة.</li>
              <li>سعر صرف ثابت داخلي (1 DI = 5 ر.س) لمنع المضاربة.</li>
              <li>مدعومة بسلّة الصفقات المُتمّة كوحدة مرجعية للقيمة (URV).</li>
            </ul>
          </Card>
          <Card icon={<Info className="size-5" />} title="نموذج الربط بالعملات">
            <p className="text-sm font-bold leading-relaxed">
              الـ DI مُسعّرة داخلياً بالريال السعودي. عند عرض القيمة بعملة أخرى نستخدم
              سعر صرف مرجعي يتم تحديثه دورياً، بحيث يظل العرض المحلي قابلاً للفهم
              لكل مستخدم في بلده.
            </p>
          </Card>
        </section>

        <div className="mt-10 flex items-center justify-between bg-card ring-1 ring-black/5 rounded-3xl p-5">
          <div>
            <div className="font-extrabold text-base">جاهز تجرّب؟</div>
            <div className="text-sm text-muted-foreground font-bold">قيّم ممتلكاتك واحسب قيمتها بالـ DI خلال ثوانٍ.</div>
          </div>
          <Link to="/" hash="engine" className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-extrabold hover:opacity-90">
            افتح محرّك التسعير
          </Link>
        </div>
      </main>
    </div>
  );
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card ring-1 ring-black/5 p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="size-9 rounded-xl grid place-items-center bg-primary/10 text-primary">{icon}</div>
        <h3 className="font-extrabold text-lg">{title}</h3>
      </div>
      <div className="text-foreground/85">{children}</div>
    </div>
  );
}
