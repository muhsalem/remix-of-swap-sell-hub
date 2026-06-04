import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Coins, ArrowLeftRight, ShieldCheck, TrendingUp, Wallet, Gift, Info, ArrowRight, Check, Vault, Ban, Crown } from "lucide-react";
import { Nav } from "@/components/Nav";
import { FX_VS_SAR, DI_TO_SAR, loadCountry, saveCountry } from "@/lib/currency-fx";
import { getLatestReserveSnapshot } from "@/lib/reserve.functions";
import { loadCashOnly, saveCashOnly, isRestrictedCountry } from "@/lib/region-mode";

export const Route = createFileRoute("/digital-currency")({
  head: () => ({
    meta: [
      { title: "العملة الرقمية الداخلية DI — بادل" },
      { name: "description", content: "تعرّف على كيفية عمل عملة بادل الرقمية الداخلية (DI)، ربطها بعملتك المحلية، ومصادر اكتسابها واستخدامها." },
    ],
  }),
  component: DigitalCurrencyPage,
});

function DigitalCurrencyPage() {
  const [country, setCountry] = useState<string>("SAR");
  const [di, setDi] = useState<number>(10);
  const [saved, setSaved] = useState(false);
  const [cashOnly, setCashOnly] = useState<boolean>(false);

  // Hydrate from localStorage on mount (avoids SSR hydration mismatch)
  useEffect(() => {
    const c = loadCountry();
    setCountry(c);
    setCashOnly(loadCashOnly(c));
  }, []);

  const changeCountry = (c: string) => {
    setCountry(c);
    saveCountry(c);
    setCashOnly(loadCashOnly(c));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };

  const toggleCashOnly = (on: boolean) => {
    setCashOnly(on);
    saveCashOnly(on);
  };

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
        {/* Regional / cash-only banner */}
        {(cashOnly || isRestrictedCountry(country)) && (
          <div className="mb-4 rounded-2xl ring-1 ring-amber-200 bg-amber-50 p-4 flex items-start gap-3">
            <div className="size-9 rounded-xl grid place-items-center bg-amber-100 text-amber-700 shrink-0">
              <Ban className="size-5" />
            </div>
            <div className="flex-1 text-sm">
              <div className="font-extrabold text-amber-900 mb-0.5">
                {isRestrictedCountry(country) ? "العملة الرقمية مقيدة في بلدك" : "الوضع النقدي مفعّل يدوياً"}
              </div>
              <p className="font-bold text-amber-800/90 leading-relaxed">
                نقوم بإخفاء ميزات الـ DI تلقائياً للالتزام بالأنظمة المحلية. يمكنك المقايضة بشكل كامل
                بالعملة المحلية، والوصول لكل المزايا الإضافية عبر <Link to="/premium" className="underline font-black inline-flex items-center gap-1"><Crown className="size-3.5" /> اشتراك Premium</Link>.
              </p>
            </div>
            <button
              onClick={() => toggleCashOnly(!cashOnly)}
              className="text-xs font-extrabold px-3 py-1.5 rounded-full bg-white ring-1 ring-amber-300 text-amber-900 hover:bg-amber-100 shrink-0"
            >
              {cashOnly ? "تعطيل الوضع النقدي" : "تفعيل الوضع النقدي"}
            </button>
          </div>
        )}


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
              <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 font-extrabold flex items-center gap-2">
                بلدك / عملتك
                {saved && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-primary normal-case tracking-normal">
                    <Check className="size-3" /> تم الحفظ
                  </span>
                )}
              </label>
              <select
                value={country}
                onChange={(e) => changeCountry(e.target.value)}
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

        {/* Proof of Reserve */}
        <ProofOfReserve />

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

function ProofOfReserve() {
  const fetchSnap = useServerFn(getLatestReserveSnapshot);
  const { data, isLoading } = useQuery({
    queryKey: ["reserve-snapshot"],
    queryFn: () => fetchSnap(),
    staleTime: 60_000,
  });
  const snap = data?.snapshot;
  const ratio = snap ? Number(snap.reserve_ratio) : 1;
  const ratioPct = Math.round(ratio * 100);
  const healthy = ratio >= 1;
  const date = snap ? new Date(snap.recorded_at).toLocaleDateString("ar-SA") : "—";

  return (
    <section className="mt-10 rounded-3xl ring-1 ring-black/5 bg-gradient-to-br from-card via-card to-stone-soft/40 p-6 md:p-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="size-11 rounded-2xl grid place-items-center bg-emerald-100 text-emerald-700">
          <Vault className="size-6" />
        </div>
        <div>
          <h2 className="font-extrabold text-xl">إثبات الاحتياطي (Proof of Reserve)</h2>
          <p className="text-xs text-muted-foreground font-bold">شفافية كاملة حول الدعم النقدي لكل DI مُصدَر.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground font-bold py-6 text-center">جاري تحميل آخر لقطة...</div>
      ) : !snap ? (
        <div className="text-sm text-muted-foreground font-bold py-6 text-center">لا توجد بيانات احتياطي بعد.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div className="rounded-2xl bg-background ring-1 ring-border p-4">
              <div className="text-[11px] uppercase tracking-wider font-extrabold text-muted-foreground mb-1">DI مُصدَر متداول</div>
              <div className="font-display font-black text-2xl tabular-nums">{Number(snap.total_di_outstanding).toLocaleString()}</div>
              <div className="text-[11px] text-muted-foreground font-bold mt-1">DI</div>
            </div>
            <div className="rounded-2xl bg-background ring-1 ring-border p-4">
              <div className="text-[11px] uppercase tracking-wider font-extrabold text-muted-foreground mb-1">احتياطي نقدي</div>
              <div className="font-display font-black text-2xl tabular-nums">{Number(snap.reserve_sar).toLocaleString()}</div>
              <div className="text-[11px] text-muted-foreground font-bold mt-1">ر.س</div>
            </div>
            <div className={`rounded-2xl p-4 ring-1 ${healthy ? "bg-emerald-50 ring-emerald-200" : "bg-amber-50 ring-amber-200"}`}>
              <div className="text-[11px] uppercase tracking-wider font-extrabold text-muted-foreground mb-1">نسبة التغطية</div>
              <div className={`font-display font-black text-2xl tabular-nums ${healthy ? "text-emerald-700" : "text-amber-700"}`}>
                {ratioPct}%
              </div>
              <div className="text-[11px] font-bold mt-1">
                {healthy ? "✅ مغطّى بالكامل" : "⚠️ تغطية جزئية"}
              </div>
            </div>
          </div>
          {snap.note && (
            <div className="text-xs text-muted-foreground font-bold leading-relaxed bg-stone-soft/50 p-3 rounded-xl">
              📝 {snap.note}
            </div>
          )}
          <div className="text-[11px] text-muted-foreground font-bold mt-3 text-end">
            آخر تحديث: {date}
          </div>
        </>
      )}
    </section>
  );
}
