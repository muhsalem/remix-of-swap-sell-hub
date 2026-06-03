import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { calculateBarter, type PricingResult, ITEM_TYPES, SAR_PER_DI } from "@/lib/pricing.functions";
import { getReferencePrice } from "@/lib/price-oracle.functions";
import { Loader2, Sparkles, ArrowLeftRight, ShieldCheck, AlertTriangle, Ban, ChevronDown, Plus, X, Briefcase, Check, XCircle, TrendingUp } from "lucide-react";
import phoneImg from "@/assets/product-phone.jpg";
import headphonesImg from "@/assets/product-headphones.jpg";

type Product = {
  name: string;
  category: string;
  itemType: typeof ITEM_TYPES[number]["value"];
  unit: string;
  quantity: number;
  condition: "new" | "like-new" | "excellent" | "good" | "fair";
  ageMonths: number;
  marketPricePerUnit: number;
  currency: string;
  quality: number;
  scarcity: "abundant" | "normal" | "high" | "scarce";
  locationTier: "tier1" | "tier2" | "tier3" | "rural";
  riskLevel: "low" | "medium" | "high";
  deliveryDays: number;
};

const CONDITIONS = [
  { value: "new", label: "جديد" }, { value: "like-new", label: "كالجديد" },
  { value: "excellent", label: "ممتاز" }, { value: "good", label: "جيد" }, { value: "fair", label: "مقبول" },
] as const;
const CATEGORIES = [
  "إلكترونيات","هواتف","أجهزة لوحية","حواسيب","صوتيات","كاميرات","ساعات","مجوهرات",
  "وسائل تنقل","أثاث","كتب","ملابس","خدمات مهنية","خدمات يدوية","عقارات سكنية",
  "عقارات تجارية","أراضي","ذهب","فضة","عملات","حبوب وأغذية","أخرى",
];
const CURRENCIES = ["SAR","USD","EUR","AED","EGP","GBP","KWD","QAR"];
const SCARCITY = [
  { value: "abundant", label: "وفرة" }, { value: "normal", label: "طبيعي" },
  { value: "high", label: "طلب مرتفع" }, { value: "scarce", label: "نادر" },
] as const;
const LOCATIONS = [
  { value: "tier1", label: "مدينة رئيسية" }, { value: "tier2", label: "مدينة متوسطة" },
  { value: "tier3", label: "مدينة صغيرة" }, { value: "rural", label: "ريفي" },
] as const;
const RISKS = [
  { value: "low", label: "منخفض" }, { value: "medium", label: "متوسط" }, { value: "high", label: "مرتفع" },
] as const;

const DEFAULT_A: Product = {
  name: "ساعة استشارة قانونية", category: "خدمات مهنية", itemType: "service",
  unit: "ساعة", quantity: 2, condition: "new", ageMonths: 0,
  marketPricePerUnit: 250, currency: "SAR", quality: 9,
  scarcity: "high", locationTier: "tier1", riskLevel: "low", deliveryDays: 1,
};
const DEFAULT_B: Product = {
  name: "قمح بلدي", category: "حبوب وأغذية", itemType: "commodity",
  unit: "كجم", quantity: 100, condition: "new", ageMonths: 0,
  marketPricePerUnit: 5, currency: "SAR", quality: 8,
  scarcity: "normal", locationTier: "tier2", riskLevel: "low", deliveryDays: 0,
};
const DEFAULT_SERVICE: Product = {
  name: "تصميم شعار احترافي", category: "خدمات مهنية", itemType: "service",
  unit: "ساعة", quantity: 5, condition: "new", ageMonths: 0,
  marketPricePerUnit: 150, currency: "SAR", quality: 9,
  scarcity: "normal", locationTier: "tier2", riskLevel: "low", deliveryDays: 3,
};

const SHARIAH_MODE = true; // مفعّل تلقائياً — لا يُعرض للمستخدم

export function PricingEngine() {
  const [sideA, setSideA] = useState<Product[]>([DEFAULT_A]);
  const [sideB, setSideB] = useState<Product[]>([DEFAULT_B]);
  const [serviceBarter, setServiceBarter] = useState(false);
  const [result, setResult] = useState<PricingResult | null>(null);

  const fn = useServerFn(calculateBarter);
  const mutation = useMutation({
    mutationFn: () => fn({ data: { sideA, sideB, shariahMode: SHARIAH_MODE, serviceBarter } }),
    onSuccess: (r) => {
      setResult(r);
      // ربط النتيجة بصفحة البروفايل
      try {
        sessionStorage.setItem("lastAnalysis", JSON.stringify({
          at: Date.now(),
          fairness: r.fairness,
          diA: r.diA, diB: r.diB,
          itemsA: r.itemsA, itemsB: r.itemsB,
          recommendation: r.recommendation,
          shariahLevel: r.shariah.level,
          shariahRule: r.shariah.rule,
          serviceBarter,
        }));
      } catch { /* ignore */ }
    },
  });

  const fairness = result?.fairness ?? 0;
  const fairnessColor =
    fairness >= 85 ? "text-primary" : fairness >= 65 ? "text-accent" : "text-destructive";

  // شروط صحة مقايضة الخدمات — تُحسب لحظياً
  const serviceChecks = (() => {
    const all = [...sideA, ...sideB];
    const allServices = all.every((p) => p.itemType === "service" || p.itemType === "labor_hours");
    const benefitDefined = all.every((p) => p.name.trim().length >= 3 && p.category.startsWith("خدمات"));
    const termKnown = all.every((p) => p.deliveryDays > 0);
    const hoursA = sideA.reduce((s, p) => s + p.quantity, 0);
    const hoursB = sideB.reduce((s, p) => s + p.quantity, 0);
    const gap = Math.abs(hoursA - hoursB) / Math.max(hoursA, hoursB, 1);
    const timeBalanced = gap <= 0.25;
    return { allServices, benefitDefined, termKnown, timeBalanced, hoursA, hoursB, gap };
  })();

  const addToSide = (side: "A" | "B") => {
    const def = serviceBarter ? DEFAULT_SERVICE : { ...DEFAULT_B, name: "سلعة إضافية" };
    if (side === "A") setSideA([...sideA, def]); else setSideB([...sideB, def]);
  };
  const removeFromSide = (side: "A" | "B", idx: number) => {
    if (side === "A" && sideA.length > 1) setSideA(sideA.filter((_, i) => i !== idx));
    if (side === "B" && sideB.length > 1) setSideB(sideB.filter((_, i) => i !== idx));
  };
  const updateProduct = (side: "A" | "B", idx: number, p: Product) => {
    if (side === "A") setSideA(sideA.map((x, i) => i === idx ? p : x));
    else setSideB(sideB.map((x, i) => i === idx ? p : x));
  };

  // تطبيق وضع الخدمات تلقائياً — يحول كل العناصر إلى خدمة
  const toggleServiceBarter = () => {
    const next = !serviceBarter;
    setServiceBarter(next);
    if (next) {
      const asService = (p: Product): Product => ({
        ...p, itemType: "service", category: p.category.startsWith("خدمات") ? p.category : "خدمات مهنية",
        unit: p.unit === "قطعة" ? "ساعة" : p.unit, deliveryDays: Math.max(1, p.deliveryDays),
      });
      setSideA(sideA.map(asService));
      setSideB(sideB.map(asService));
    }
  };

  return (
    <section className="animate-in bg-card rounded-3xl ring-1 ring-black/5 shadow-2xl overflow-hidden mb-16">
      <div className="p-8 md:p-12 border-b border-border bg-gradient-to-b from-stone-soft to-card">
        <div className="flex flex-col md:flex-row justify-between items-start gap-6">
          <div className="max-w-xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-mono rounded-full uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="size-3" /> AI Engine v3.1 — DI Credit
              </span>
              <span className="size-2 bg-primary rounded-full animate-pulse" />
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight text-balance leading-[1.15]">
              محرك التسعير الاقتصادي للمقايضة العادلة
            </h1>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
              قارن سلعة بسلعة، أو سلعة بسلعتين، أو أي تركيبة. يدعم أيضاً مقايضة خدمة بخدمة وفق شروط الإجارة (المنفعة، الأجل، التماثل).
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 min-w-[220px]">
            <button
              type="button"
              onClick={toggleServiceBarter}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold border transition-all ${
                serviceBarter
                  ? "bg-accent text-accent-foreground border-accent shadow-md"
                  : "bg-card border-border hover:border-accent/40"
              }`}
            >
              <Briefcase className="size-3.5" />
              مقايضة خدمة بخدمة {serviceBarter ? "(مُفعّل)" : ""}
            </button>
          </div>
        </div>
      </div>

      {/* الطرفان مع الزر في المنتصف */}
      <div className="grid grid-cols-1 lg:grid-cols-12">
        <SideColumn
          label="الطرف (أ)" letter="أ" img={phoneImg}
          products={sideA}
          onUpdate={(i, p) => updateProduct("A", i, p)}
          onRemove={(i) => removeFromSide("A", i)}
          onAdd={() => addToSide("A")}
          items={result?.itemsA}
          total={result?.valueA}
          totalDI={result?.diA}
        />

        {/* العمود الأوسط — الزر + نتيجة العدالة */}
        <div className="lg:col-span-4 p-6 bg-stone-soft border-y lg:border-y-0 lg:border-x border-border flex flex-col items-center text-center gap-5">
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="group relative w-full px-6 py-5 rounded-3xl text-sm md:text-base font-bold text-primary-foreground bg-gradient-to-br from-primary via-primary to-accent shadow-[0_15px_50px_-15px_hsl(var(--primary)/0.7)] hover:shadow-[0_25px_70px_-15px_hsl(var(--primary)/0.9)] hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2.5 disabled:opacity-60 disabled:cursor-not-allowed overflow-hidden"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            {mutation.isPending ? <Loader2 className="size-5 animate-spin relative z-10" /> : <Sparkles className="size-5 relative z-10 animate-pulse" />}
            <span className="relative z-10">{mutation.isPending ? "جاري التحليل..." : "حلّل توافق المقايضة"}</span>
            {!mutation.isPending && <ArrowLeftRight className="size-4 relative z-10 opacity-80" />}
          </button>

          <div className="animate-balance relative" key={fairness}>
            <div className="size-40 rounded-full border-[10px] border-card shadow-xl flex flex-col items-center justify-center bg-card relative z-10">
              <span className={`text-5xl font-display font-extrabold ${fairnessColor}`}>
                {result ? `${fairness}%` : "—"}
              </span>
              <span className="text-[10px] uppercase font-bold text-muted-foreground mt-1 tracking-widest">
                معدل التوافق
              </span>
            </div>
            <div className="absolute -inset-4 border-2 border-dashed border-primary/20 rounded-full animate-[spin_20s_linear_infinite]" />
          </div>

          <div className="space-y-3 w-full">
            <div className="p-4 bg-card rounded-2xl border border-border shadow-sm">
              <p className="text-xs text-muted-foreground mb-2">الفجوة السعرية</p>
              {result ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-accent font-bold font-display text-xl">
                      {result.gap === 0 ? "متوازن" : `${result.cashBalanceDI.toLocaleString()} DI`}
                    </span>
                    {result.inFavorOf !== "balanced" && (
                      <span className="text-sm">لصالح {result.inFavorOf === "A" ? "(أ)" : "(ب)"}</span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    ≈ {Math.abs(result.gap).toLocaleString()} ر.س
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">اضغط حلّل المقايضة</p>
              )}
            </div>

            <div className="p-4 bg-primary text-primary-foreground rounded-2xl shadow-lg shadow-primary/20 text-right">
              <p className="text-sm font-bold mb-1">توصية الذكاء الاصطناعي</p>
              <p className="text-xs opacity-90 leading-relaxed">
                {result?.recommendation ?? "أدخل بيانات الطرفين ثم اضغط الزر لتحليل عدالة المقايضة."}
              </p>
              {result?.rationale && (
                <p className="text-[11px] opacity-70 mt-2 border-t border-primary-foreground/20 pt-2">
                  {result.rationale}
                </p>
              )}
            </div>

            {result?.equivalence && (
              <div className="p-3 bg-accent/10 border border-accent/20 rounded-2xl text-right">
                <p className="text-[10px] uppercase tracking-widest font-bold text-accent mb-1">معادلة القيمة</p>
                <p className="text-[11px] leading-relaxed font-mono">{result.equivalence}</p>
              </div>
            )}

            {result?.shariah && (
              <div className={`p-4 rounded-2xl text-right border ${
                result.shariah.level === "forbidden"
                  ? "bg-destructive/10 border-destructive/30 text-destructive"
                  : result.shariah.level === "warning"
                  ? "bg-accent/10 border-accent/30 text-accent-foreground"
                  : "bg-primary/5 border-primary/20"
              }`}>
                <p className="text-sm font-bold mb-1 flex items-center gap-2">
                  {result.shariah.level === "forbidden" ? <Ban className="size-4" />
                    : result.shariah.level === "warning" ? <AlertTriangle className="size-4" />
                    : <ShieldCheck className="size-4 text-primary" />}
                  التحليل الشرعي
                </p>
                <p className="text-xs leading-relaxed">{result.shariah.rule}</p>
                {result.shariah.notes.length > 0 && (
                  <ul className="text-[11px] mt-2 space-y-1 list-disc pr-4 opacity-90">
                    {result.shariah.notes.map((n, i) => <li key={i}>{n}</li>)}
                  </ul>
                )}
              </div>
            )}

            {serviceBarter && (
              <div className="p-4 bg-card rounded-2xl border border-accent/30 text-right">
                <p className="text-sm font-bold mb-3 flex items-center gap-2">
                  <Briefcase className="size-4 text-accent" />
                  شروط صحة مقايضة الخدمات (إجارة بإجارة)
                </p>
                <ul className="space-y-2 text-xs">
                  <ServiceStep
                    ok={serviceChecks.allServices}
                    title="١. النوع: كل العناصر خدمات"
                    okMsg="كل عنصر مُصنّف كخدمة أو ساعات عمل."
                    failMsg="بعض العناصر ليست خدمة — حوّل النوع إلى «خدمة» في الطرفين."
                  />
                  <ServiceStep
                    ok={serviceChecks.benefitDefined}
                    title="٢. المنفعة محددة"
                    okMsg="اسم وفئة كل خدمة واضحان (لا غرر)."
                    failMsg="اكتب اسماً دقيقاً (≥3 أحرف) واختر فئة «خدمات مهنية/يدوية»."
                  />
                  <ServiceStep
                    ok={serviceChecks.termKnown}
                    title="٣. الأجل/المدة معلومة"
                    okMsg="مدة التنفيذ محددة لكل طرف."
                    failMsg="حدّد «أيام التسليم» > 0 لكل خدمة لتفادي التأجيل المفتوح."
                  />
                  <ServiceStep
                    ok={serviceChecks.timeBalanced}
                    title="٤. التماثل في الزمن/القيمة"
                    okMsg={`متوازن — (أ) ${serviceChecks.hoursA}س مقابل (ب) ${serviceChecks.hoursB}س.`}
                    failMsg={`تفاوت ${(serviceChecks.gap * 100).toFixed(0)}% بين زمن الطرفين (${serviceChecks.hoursA}س / ${serviceChecks.hoursB}س) — يُستحب التقارب.`}
                  />
                </ul>
                <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed border-t border-border pt-2">
                  لا تُقبل المقايضة شرعياً إلا إذا تحققت الشروط الأربعة. يُغلق زر إتمام الصفقة تلقائياً عند الإخلال.
                </p>
              </div>
            )}
          </div>
        </div>

        <SideColumn
          label="الطرف (ب)" letter="ب" img={headphonesImg}
          products={sideB}
          onUpdate={(i, p) => updateProduct("B", i, p)}
          onRemove={(i) => removeFromSide("B", i)}
          onAdd={() => addToSide("B")}
          items={result?.itemsB}
          total={result?.valueB}
          totalDI={result?.diB}
        />
      </div>

      {result && (
        <div className="border-t border-border p-6 md:p-10 bg-stone-soft/40">
          <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> تفصيل العوامل الاقتصادية (إجمالي الطرفين)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-2 px-3 font-bold">العامل</th>
                  <th className="py-2 px-3 font-bold">الطرف (أ)</th>
                  <th className="py-2 px-3 font-bold">الطرف (ب)</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                <Row label="القيمة السوقية (ر.س)" a={result.breakdownA.baseSAR.toLocaleString()} b={result.breakdownB.baseSAR.toLocaleString()} />
                <Row label="معامل الحالة (مرجح)" a={result.breakdownA.conditionFactor} b={result.breakdownB.conditionFactor} />
                <Row label="معامل العمر/الإهلاك" a={result.breakdownA.ageFactor} b={result.breakdownB.ageFactor} />
                <Row label="معامل الجودة" a={result.breakdownA.qualityFactor} b={result.breakdownB.qualityFactor} />
                <Row label="معامل الندرة" a={result.breakdownA.scarcityFactor} b={result.breakdownB.scarcityFactor} />
                <Row label="معامل الموقع" a={result.breakdownA.locationFactor} b={result.breakdownB.locationFactor} />
                <Row label="معامل المخاطرة" a={result.breakdownA.riskFactor} b={result.breakdownB.riskFactor} />
                <Row label="معامل الزمن (تسليم)" a={result.breakdownA.timeFactor} b={result.breakdownB.timeFactor} />
                <Row label="معامل الفئة/الطلب" a={result.breakdownA.categoryFactor} b={result.breakdownB.categoryFactor} />
                <tr className="border-t-2 border-primary/30 font-bold">
                  <td className="py-3 px-3">القيمة الإجمالية</td>
                  <td className="py-3 px-3 text-primary">{result.diA.toLocaleString()} DI <span className="opacity-50 text-[10px]">({result.valueA.toLocaleString()} ر.س)</span></td>
                  <td className="py-3 px-3 text-primary">{result.diB.toLocaleString()} DI <span className="opacity-50 text-[10px]">({result.valueB.toLocaleString()} ر.س)</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function Row({ label, a, b }: { label: string; a: number | string; b: number | string }) {
  return (
    <tr className="border-b border-border/50">
      <td className="py-2 px-3 text-muted-foreground font-sans">{label}</td>
      <td className="py-2 px-3">{a}</td>
      <td className="py-2 px-3">{b}</td>
    </tr>
  );
}

function SideColumn({
  label, letter, img, products, onUpdate, onRemove, onAdd, items, total, totalDI,
}: {
  label: string; letter: string; img: string;
  products: Product[];
  onUpdate: (i: number, p: Product) => void;
  onRemove: (i: number) => void;
  onAdd: () => void;
  items?: { name: string; sar: number; di: number }[];
  total?: number; totalDI?: number;
}) {
  return (
    <div className="lg:col-span-4 p-6 bg-card">
      <div className="flex items-center gap-3 border-b border-border pb-3 mb-4">
        <div className="size-10 rounded-xl bg-stone-soft grid place-items-center font-display font-bold">{letter}</div>
        <h3 className="font-bold flex-1">{label}</h3>
        <span className="text-[10px] text-muted-foreground">{products.length} عنصر</span>
      </div>

      <div className="space-y-4">
        {products.map((p, i) => (
          <ProductCard
            key={i}
            img={i === 0 ? img : undefined}
            product={p}
            setProduct={(np) => onUpdate(i, np)}
            onRemove={products.length > 1 ? () => onRemove(i) : undefined}
            indexLabel={products.length > 1 ? `${letter}${i + 1}` : undefined}
          />
        ))}

        <button
          type="button"
          onClick={onAdd}
          disabled={products.length >= 5}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 text-xs font-bold transition-all disabled:opacity-50"
        >
          <Plus className="size-3.5" /> أضف سلعة/خدمة إلى هذا الطرف
        </button>

        {items && items.length > 0 && (
          <div className="px-4 py-3 bg-primary/5 rounded-2xl border border-primary/10 space-y-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest block">إجمالي الطرف</span>
            <div className="flex items-baseline justify-between">
              <span className="font-mono font-bold text-lg text-primary">
                {totalDI?.toLocaleString()} DI
              </span>
              <span className="text-[11px] text-muted-foreground font-mono">≈ {total?.toLocaleString()} ر.س</span>
            </div>
            {items.length > 1 && (
              <ul className="text-[11px] space-y-1 border-t border-primary/10 pt-2">
                {items.map((it, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="truncate">{it.name}</span>
                    <span className="font-mono text-muted-foreground">{it.di} DI</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ProductCard({
  img, product, setProduct, onRemove, indexLabel,
}: {
  img?: string;
  product: Product;
  setProduct: (p: Product) => void;
  onRemove?: () => void;
  indexLabel?: string;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  return (
    <div className="rounded-2xl border border-border p-4 space-y-3 relative">
      {indexLabel && (
        <span className="absolute top-2 right-2 text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
          {indexLabel}
        </span>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-2 left-2 size-6 grid place-items-center rounded-full hover:bg-destructive/10 text-destructive"
          title="إزالة"
        >
          <X className="size-3.5" />
        </button>
      )}
      {img && (
        <div className="aspect-[4/3] rounded-xl overflow-hidden bg-stone-soft">
          <img src={img} alt={product.name} className="w-full h-full object-cover" loading="lazy" width={512} height={384} />
        </div>
      )}

      <Field label="الاسم">
        <input type="text" value={product.name}
          onChange={(e) => setProduct({ ...product, name: e.target.value })}
          className="w-full px-3 py-2 rounded-xl bg-stone-soft border border-border text-sm outline-none" />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="النوع">
          <select value={product.itemType}
            onChange={(e) => setProduct({ ...product, itemType: e.target.value as Product["itemType"] })}
            className="w-full px-2 py-2 rounded-xl bg-stone-soft border border-border text-sm outline-none">
            {ITEM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="الفئة">
          <select value={product.category}
            onChange={(e) => setProduct({ ...product, category: e.target.value })}
            className="w-full px-2 py-2 rounded-xl bg-stone-soft border border-border text-sm outline-none">
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Field label="الكمية">
          <input type="number" min={0.01} step={0.01} value={product.quantity}
            onChange={(e) => setProduct({ ...product, quantity: Number(e.target.value) || 0 })}
            className="w-full px-2 py-2 rounded-xl bg-stone-soft border border-border text-sm outline-none" />
        </Field>
        <Field label="الوحدة">
          <input type="text" value={product.unit}
            onChange={(e) => setProduct({ ...product, unit: e.target.value })}
            className="w-full px-2 py-2 rounded-xl bg-stone-soft border border-border text-sm outline-none" />
        </Field>
        <Field label="العملة">
          <select value={product.currency}
            onChange={(e) => setProduct({ ...product, currency: e.target.value })}
            className="w-full px-2 py-2 rounded-xl bg-stone-soft border border-border text-sm outline-none">
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
      </div>

      <Field label="السعر للوحدة">
        <input type="number" min={0.01} step={0.01} value={product.marketPricePerUnit}
          onChange={(e) => setProduct({ ...product, marketPricePerUnit: Number(e.target.value) || 0 })}
          className="w-full px-3 py-2 rounded-xl bg-stone-soft border border-border text-sm outline-none" />
      </Field>
      <PriceOracleWarning category={product.category} title={product.name} price={product.marketPricePerUnit} />


      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-stone-soft hover:bg-primary/5 rounded-xl text-xs font-bold border border-border transition-colors"
      >
        <span>عوامل اقتصادية متقدمة</span>
        <ChevronDown className={`size-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
      </button>

      {showAdvanced && (
        <div className="space-y-3 p-3 bg-stone-soft/50 rounded-xl border border-dashed border-border">
          <div className="grid grid-cols-2 gap-2">
            <Field label="الحالة">
              <select value={product.condition}
                onChange={(e) => setProduct({ ...product, condition: e.target.value as Product["condition"] })}
                className="w-full px-2 py-2 rounded-xl bg-card border border-border text-sm outline-none">
                {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="العمر (شهر)">
              <input type="number" min={0} value={product.ageMonths}
                onChange={(e) => setProduct({ ...product, ageMonths: Number(e.target.value) || 0 })}
                className="w-full px-2 py-2 rounded-xl bg-card border border-border text-sm outline-none" />
            </Field>
          </div>
          <Field label={`الجودة: ${product.quality}/10`}>
            <input type="range" min={1} max={10} value={product.quality}
              onChange={(e) => setProduct({ ...product, quality: Number(e.target.value) })}
              className="w-full accent-primary" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="الندرة/الطلب">
              <select value={product.scarcity}
                onChange={(e) => setProduct({ ...product, scarcity: e.target.value as Product["scarcity"] })}
                className="w-full px-2 py-2 rounded-xl bg-card border border-border text-sm outline-none">
                {SCARCITY.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="الموقع">
              <select value={product.locationTier}
                onChange={(e) => setProduct({ ...product, locationTier: e.target.value as Product["locationTier"] })}
                className="w-full px-2 py-2 rounded-xl bg-card border border-border text-sm outline-none">
                {LOCATIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="المخاطرة">
              <select value={product.riskLevel}
                onChange={(e) => setProduct({ ...product, riskLevel: e.target.value as Product["riskLevel"] })}
                className="w-full px-2 py-2 rounded-xl bg-card border border-border text-sm outline-none">
                {RISKS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </Field>
            <Field label="تسليم/أجل (يوم)">
              <input type="number" min={0} max={365} value={product.deliveryDays}
                onChange={(e) => setProduct({ ...product, deliveryDays: Number(e.target.value) || 0 })}
                className="w-full px-2 py-2 rounded-xl bg-card border border-border text-sm outline-none" />
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1 font-bold">
        {label}
      </label>
      {children}
    </div>
  );
}

function ServiceStep({ ok, title, okMsg, failMsg }: { ok: boolean; title: string; okMsg: string; failMsg: string }) {
  return (
    <li className={`flex items-start gap-2 p-2 rounded-lg border ${ok ? "bg-primary/5 border-primary/20" : "bg-destructive/5 border-destructive/30"}`}>
      <span className={`shrink-0 mt-0.5 size-5 rounded-full grid place-items-center ${ok ? "bg-primary text-primary-foreground" : "bg-destructive text-destructive-foreground"}`}>
        {ok ? <Check className="size-3" /> : <XCircle className="size-3" />}
      </span>
      <div className="flex-1">
        <div className="font-bold text-[12px]">{title}</div>
        <div className={`text-[11px] leading-relaxed ${ok ? "text-foreground/70" : "text-destructive"}`}>
          {ok ? okMsg : failMsg}
        </div>
      </div>
    </li>
  );
}

function PriceOracleWarning({ category, title, price }: { category: string; title: string; price: number }) {
  const fetchFn = useServerFn(getReferencePrice);
  const [ref, setRef] = useState<{ avg: number | null; count: number; min: number | null; max: number | null } | null>(null);

  useEffect(() => {
    if (!category || title.trim().length < 3 || price <= 0) { setRef(null); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetchFn({ data: { category, title } });
        setRef(r);
      } catch { /* ignore */ }
    }, 400);
    return () => clearTimeout(t);
  }, [category, title, price, fetchFn]);

  if (!ref || !ref.avg || ref.count < 2) return null;
  const diff = ((price - ref.avg) / ref.avg) * 100;
  const abnormal = Math.abs(diff) > 30;

  return (
    <div className={`text-[11px] p-2 rounded-lg border flex items-start gap-2 ${abnormal ? "bg-destructive/5 border-destructive/30 text-destructive" : "bg-primary/5 border-primary/20"}`}>
      <TrendingUp className="size-3.5 mt-0.5 shrink-0" />
      <div className="flex-1">
        <div className="font-bold">مرجع السوق ({ref.count} عرض)</div>
        <div>المتوسط: {ref.avg.toLocaleString()} — المدى: {ref.min?.toLocaleString()} ~ {ref.max?.toLocaleString()}</div>
        {abnormal && <div className="font-bold mt-0.5">⚠ سعرك يختلف بنسبة {diff.toFixed(0)}% عن السوق</div>}
      </div>
    </div>
  );
}
