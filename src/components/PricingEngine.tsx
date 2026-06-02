import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { calculateBarter, type PricingResult, ITEM_TYPES, URV_IN_SAR } from "@/lib/pricing.functions";
import { Loader2, Sparkles, ArrowLeftRight, ShieldCheck, AlertTriangle, Ban, Scale, ChevronDown } from "lucide-react";
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
  { value: "new", label: "جديد" },
  { value: "like-new", label: "كالجديد" },
  { value: "excellent", label: "ممتاز" },
  { value: "good", label: "جيد" },
  { value: "fair", label: "مقبول" },
] as const;

const CATEGORIES = [
  "إلكترونيات", "هواتف", "أجهزة لوحية", "حواسيب", "صوتيات", "كاميرات",
  "ساعات", "مجوهرات", "وسائل تنقل", "أثاث", "كتب", "ملابس",
  "خدمات مهنية", "خدمات يدوية", "عقارات سكنية", "عقارات تجارية", "أراضي",
  "ذهب", "فضة", "عملات", "حبوب وأغذية", "أخرى",
];

const CURRENCIES = ["SAR", "USD", "EUR", "AED", "EGP", "GBP", "KWD", "QAR"];
const SCARCITY = [
  { value: "abundant", label: "وفرة" },
  { value: "normal", label: "طبيعي" },
  { value: "high", label: "طلب مرتفع" },
  { value: "scarce", label: "نادر" },
] as const;
const LOCATIONS = [
  { value: "tier1", label: "مدينة رئيسية" },
  { value: "tier2", label: "مدينة متوسطة" },
  { value: "tier3", label: "مدينة صغيرة" },
  { value: "rural", label: "ريفي" },
] as const;
const RISKS = [
  { value: "low", label: "منخفض" },
  { value: "medium", label: "متوسط" },
  { value: "high", label: "مرتفع" },
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

export function PricingEngine() {
  const [productA, setProductA] = useState<Product>(DEFAULT_A);
  const [productB, setProductB] = useState<Product>(DEFAULT_B);
  const [result, setResult] = useState<PricingResult | null>(null);
  const [shariahMode, setShariahMode] = useState(false);

  const fn = useServerFn(calculateBarter);
  const mutation = useMutation({
    mutationFn: () => fn({ data: { productA, productB, shariahMode } }),
    onSuccess: setResult,
  });

  const fairness = result?.fairness ?? 0;
  const fairnessColor =
    fairness >= 85 ? "text-primary" : fairness >= 65 ? "text-accent" : "text-destructive";

  return (
    <section className="animate-in bg-card rounded-3xl ring-1 ring-black/5 shadow-2xl overflow-hidden mb-16">
      <div className="p-8 md:p-12 border-b border-border bg-gradient-to-b from-stone-soft to-card">
        <div className="flex flex-col md:flex-row justify-between items-end gap-6">
          <div className="max-w-xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-mono rounded-full uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="size-3" /> AI Engine v3.0 — URV
              </span>
              <span className="size-2 bg-primary rounded-full animate-pulse" />
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight text-balance leading-[1.15]">
              محرك التسعير الاقتصادي للمقايضة العادلة
            </h1>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
              يقيّم السلع والخدمات وساعات العمل والعقارات والذهب والعملات بـ <b>وحدة قيمة مرجعية موحّدة (URV)</b> = {URV_IN_SAR} ر.س،
              مع معاملات الإهلاك، الجودة، الندرة، الموقع، المخاطرة وزمن التسليم.
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none px-3 py-2 bg-card border border-border rounded-full text-xs font-bold hover:border-primary/40 transition-colors">
              <input
                type="checkbox"
                checked={shariahMode}
                onChange={(e) => setShariahMode(e.target.checked)}
                className="accent-primary size-4"
              />
              <Scale className="size-3.5" />
              الوضع الشرعي
            </label>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="px-6 py-3 bg-foreground text-background rounded-full text-sm font-bold hover:bg-primary transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <ArrowLeftRight className="size-4" />}
              {mutation.isPending ? "جاري التحليل..." : "حلّل المقايضة"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12">
        <ProductCard label="الطرف (أ)" letter="أ" img={phoneImg} product={productA} setProduct={setProductA} result={result?.valueA} urv={result?.urvA} />

        <div className="lg:col-span-4 p-8 bg-stone-soft border-y lg:border-y-0 lg:border-x border-border flex flex-col items-center justify-center text-center">
          <div className="animate-balance mb-6 relative" key={fairness}>
            <div className="size-44 rounded-full border-[12px] border-card shadow-xl flex flex-col items-center justify-center bg-card relative z-10">
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
                      {result.gap === 0 ? "متوازن" : `${Math.abs(result.gap).toLocaleString()} ر.س`}
                    </span>
                    {result.inFavorOf !== "balanced" && (
                      <span className="text-sm">لصالح {result.inFavorOf === "A" ? "(أ)" : "(ب)"}</span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    {Math.abs(result.gapURV)} URV
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

            {result?.shariah && shariahMode && (
              <div
                className={`p-4 rounded-2xl text-right border ${
                  result.shariah.level === "forbidden"
                    ? "bg-destructive/10 border-destructive/30 text-destructive"
                    : result.shariah.level === "warning"
                    ? "bg-accent/10 border-accent/30 text-accent-foreground"
                    : "bg-primary/5 border-primary/20"
                }`}
              >
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
          </div>
        </div>

        <ProductCard label="الطرف (ب)" letter="ب" img={headphonesImg} product={productB} setProduct={setProductB} result={result?.valueB} urv={result?.urvB} />
      </div>

      {result && (
        <div className="border-t border-border p-6 md:p-10 bg-stone-soft/40">
          <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> تفصيل العوامل الاقتصادية
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
                <Row label="معامل الحالة" a={result.breakdownA.conditionFactor} b={result.breakdownB.conditionFactor} />
                <Row label="معامل العمر/الإهلاك" a={result.breakdownA.ageFactor} b={result.breakdownB.ageFactor} />
                <Row label="معامل الجودة" a={result.breakdownA.qualityFactor} b={result.breakdownB.qualityFactor} />
                <Row label="معامل الندرة" a={result.breakdownA.scarcityFactor} b={result.breakdownB.scarcityFactor} />
                <Row label="معامل الموقع" a={result.breakdownA.locationFactor} b={result.breakdownB.locationFactor} />
                <Row label="معامل المخاطرة" a={result.breakdownA.riskFactor} b={result.breakdownB.riskFactor} />
                <Row label="معامل الزمن (تسليم)" a={result.breakdownA.timeFactor} b={result.breakdownB.timeFactor} />
                <Row label="معامل الفئة/الطلب" a={result.breakdownA.categoryFactor} b={result.breakdownB.categoryFactor} />
                <tr className="border-t-2 border-primary/30 font-bold">
                  <td className="py-3 px-3">القيمة النهائية</td>
                  <td className="py-3 px-3 text-primary">{result.valueA.toLocaleString()} ر.س · {result.urvA} URV</td>
                  <td className="py-3 px-3 text-primary">{result.valueB.toLocaleString()} ر.س · {result.urvB} URV</td>
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

function ProductCard({
  label, letter, img, product, setProduct, result, urv,
}: {
  label: string; letter: string; img: string;
  product: Product; setProduct: (p: Product) => void;
  result?: number; urv?: number;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  return (
    <div className="lg:col-span-4 p-6 bg-card">
      <div className="space-y-4">
        <div className="flex items-center gap-3 border-b border-border pb-3">
          <div className="size-10 rounded-xl bg-stone-soft grid place-items-center font-display font-bold">{letter}</div>
          <h3 className="font-bold">{label}</h3>
        </div>

        <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-stone-soft">
          <img src={img} alt={product.name} className="w-full h-full object-cover" loading="lazy" width={512} height={384} />
        </div>

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
              <Field label="تسليم بعد (يوم)">
                <input type="number" min={0} max={365} value={product.deliveryDays}
                  onChange={(e) => setProduct({ ...product, deliveryDays: Number(e.target.value) || 0 })}
                  className="w-full px-2 py-2 rounded-xl bg-card border border-border text-sm outline-none" />
              </Field>
            </div>
          </div>
        )}

        <div className="flex flex-col items-end px-4 py-3 bg-primary/5 rounded-2xl border border-primary/10">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest">القيمة المقدّرة</span>
          <span className="font-mono font-bold text-lg text-primary">
            {result ? `${result.toLocaleString()} ر.س` : "—"}
          </span>
          {urv !== undefined && (
            <span className="text-[11px] text-muted-foreground font-mono">{urv} URV</span>
          )}
        </div>
      </div>
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
