import { useState, useEffect, useMemo, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { calculateBarter, type PricingResult, ITEM_TYPES } from "@/lib/pricing.functions";
import { getReferencePrice } from "@/lib/price-oracle.functions";
import {
  Loader2, Sparkles, ArrowLeftRight, ShieldCheck, AlertTriangle, Ban,
  ChevronDown, Plus, X, TrendingUp, Zap,
} from "lucide-react";
import { CatalogPicker, type CatalogPick } from "@/components/CatalogPicker";

// ============================================================
// Types & constants
// ============================================================
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
  distanceKm: number;
};

const CONDITION_TO_QUALITY: Record<Product["condition"], number> = {
  "new": 10, "like-new": 9, "excellent": 8, "good": 6, "fair": 4,
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
  scarcity: "high", locationTier: "tier1", riskLevel: "low", deliveryDays: 1, distanceKm: 0,
};
const DEFAULT_B: Product = {
  name: "قمح بلدي", category: "حبوب وأغذية", itemType: "commodity",
  unit: "كجم", quantity: 100, condition: "new", ageMonths: 0,
  marketPricePerUnit: 5, currency: "SAR", quality: 8,
  scarcity: "normal", locationTier: "tier2", riskLevel: "low", deliveryDays: 0, distanceKm: 0,
};

function detectCurrency(): string {
  if (typeof navigator === "undefined") return "SAR";
  const lang = (navigator.language || "ar-SA").toLowerCase();
  if (lang.includes("-eg")) return "EGP";
  if (lang.includes("-ae")) return "AED";
  if (lang.includes("-kw")) return "KWD";
  if (lang.includes("-qa")) return "QAR";
  if (lang.includes("-gb")) return "GBP";
  if (lang.includes("-us")) return "USD";
  if (lang.startsWith("fr") || lang.startsWith("de") || lang.startsWith("es") || lang.startsWith("it")) return "EUR";
  return "SAR";
}

// ============================================================
// Main component — compact, auto-calc, single-source layout
// ============================================================
export function PricingEngine() {
  const defaultCurrency = typeof window !== "undefined" ? detectCurrency() : "SAR";
  const [sideA, setSideA] = useState<Product[]>([{ ...DEFAULT_A, currency: defaultCurrency }]);
  const [sideB, setSideB] = useState<Product[]>([{ ...DEFAULT_B, currency: defaultCurrency }]);
  const [result, setResult] = useState<PricingResult | null>(null);
  const [autoCalc, setAutoCalc] = useState(true);

  const fn = useServerFn(calculateBarter);
  const mutation = useMutation({
    mutationFn: () => fn({ data: { sideA, sideB, shariahMode: true, serviceBarter: false } }),
    onSuccess: (r) => {
      setResult(r);
      try {
        sessionStorage.setItem("lastAnalysis", JSON.stringify({
          at: Date.now(), fairness: r.fairness, diA: r.diA, diB: r.diB,
          itemsA: r.itemsA, itemsB: r.itemsB,
          recommendation: r.recommendation,
          shariahLevel: r.shariah.level, shariahRule: r.shariah.rule,
        }));
      } catch { /* ignore */ }
    },
  });

  // Auto-calc with debounce when inputs are valid
  const stateKey = useMemo(() => JSON.stringify({ sideA, sideB }), [sideA, sideB]);
  const firstRun = useRef(true);
  useEffect(() => {
    if (!autoCalc) return;
    const allValid = [...sideA, ...sideB].every(
      (p) => p.name.trim().length > 0 && p.marketPricePerUnit > 0 && p.quantity > 0,
    );
    if (!allValid) return;
    const delay = firstRun.current ? 100 : 700;
    firstRun.current = false;
    const t = setTimeout(() => mutation.mutate(), delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateKey, autoCalc]);

  // Sides operations
  const addToSide = (side: "A" | "B") => {
    const def = { ...DEFAULT_B, name: "سلعة جديدة", currency: defaultCurrency };
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

  const onCatalogPick = (side: "A" | "B", pick: CatalogPick) => {
    const f = pick.family;
    const product: Product = {
      name: pick.itemName,
      category: f.category,
      itemType: (f.itemType === "real-estate" ? "good" : f.itemType) as Product["itemType"],
      unit: f.defaultUnit,
      quantity: 1,
      condition: f.dep ? "good" : "new",
      ageMonths: f.dep ? 12 : 0,
      marketPricePerUnit: 0,
      currency: defaultCurrency,
      quality: 8,
      scarcity: f.mkt === "spec" ? "high" : f.mkt === "uns" ? "abundant" : "normal",
      locationTier: "tier1",
      riskLevel: f.dep ? "medium" : "low",
      deliveryDays: f.type === "service" ? 1 : 3,
      distanceKm: 0,
    };
    if (side === "A") setSideA([product]); else setSideB([product]);
  };

  const fairness = result?.fairness ?? 0;
  const fairnessColor =
    fairness >= 85 ? "text-primary" : fairness >= 65 ? "text-accent" : "text-destructive";
  const fairnessBg =
    fairness >= 85 ? "from-primary/15 to-primary/5" : fairness >= 65 ? "from-accent/15 to-accent/5" : "from-destructive/15 to-destructive/5";

  return (
    <section className="animate-in bg-card rounded-3xl ring-1 ring-black/5 shadow-2xl overflow-hidden mb-16">
      {/* ============ Header ============ */}
      <div className="px-6 md:px-10 pt-8 pb-6 border-b border-border bg-gradient-to-b from-stone-soft to-card">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 bg-primary/10 text-primary text-[10px] font-mono rounded-full uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="size-3" /> Pricing Engine v4
              </span>
              {mutation.isPending && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Loader2 className="size-3 animate-spin" /> يحسب...
                </span>
              )}
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight leading-tight">
              محرّك التسعير العادل
            </h1>
            <p className="text-muted-foreground mt-1 text-xs md:text-sm">
              ابدأ من الكتالوج، اضبط القيمة، النتيجة تظهر فورًا.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs bg-stone-soft px-3 py-2 rounded-xl border border-border cursor-pointer">
            <input
              type="checkbox" checked={autoCalc}
              onChange={(e) => setAutoCalc(e.target.checked)}
              className="accent-primary"
            />
            <Zap className="size-3.5 text-primary" />
            حساب تلقائي
          </label>
        </div>
        <CatalogPicker defaultCurrency={defaultCurrency} onPick={onCatalogPick} />
      </div>

      {/* ============ Result bar (sticky-ish) ============ */}
      <div className={`px-6 md:px-10 py-5 bg-gradient-to-r ${fairnessBg} border-b border-border`}>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Fairness gauge */}
          <div className="md:col-span-3 flex items-center gap-4">
            <div className="relative size-20 shrink-0">
              <svg viewBox="0 0 36 36" className="size-20 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3" className="text-border" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none" strokeWidth="3" strokeLinecap="round"
                  strokeDasharray={`${fairness}, 100`}
                  className={`transition-all duration-700 ${fairnessColor}`} stroke="currentColor"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-lg font-display font-extrabold ${fairnessColor}`}>
                  {result ? `${fairness}%` : "—"}
                </span>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">معدّل التوافق</div>
              <div className="text-sm font-bold mt-0.5">
                {!result ? "أكمل البيانات" :
                  fairness >= 85 ? "صفقة عادلة" :
                  fairness >= 65 ? "تحتاج موازنة" : "فجوة كبيرة"}
              </div>
            </div>
          </div>

          {/* Gap */}
          <div className="md:col-span-3 px-4 py-3 bg-card/70 rounded-2xl border border-border">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">الفجوة</div>
            {result ? (
              <div className="flex items-baseline gap-2">
                <span className="font-display font-bold text-xl text-accent">
                  {result.gap === 0 ? "متوازن" : `${result.cashBalanceDI.toLocaleString()} DI`}
                </span>
                {result.inFavorOf !== "balanced" && (
                  <span className="text-xs text-muted-foreground">
                    لصالح ({result.inFavorOf === "A" ? "أ" : "ب"})
                  </span>
                )}
              </div>
            ) : <span className="text-sm text-muted-foreground">—</span>}
            {result && result.gap !== 0 && (
              <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                ≈ {Math.abs(result.gap).toLocaleString()} ر.س
              </div>
            )}
          </div>

          {/* Shariah */}
          <div className="md:col-span-3 px-4 py-3 bg-card/70 rounded-2xl border border-border">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">التحليل الشرعي</div>
            {result?.shariah ? (
              <div className={`text-xs font-bold flex items-start gap-1.5 ${
                result.shariah.level === "forbidden" ? "text-destructive" :
                result.shariah.level === "warning" ? "text-accent-foreground" : "text-primary"
              }`}>
                {result.shariah.level === "forbidden" ? <Ban className="size-3.5 shrink-0 mt-0.5" />
                  : result.shariah.level === "warning" ? <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                  : <ShieldCheck className="size-3.5 shrink-0 mt-0.5" />}
                <span className="leading-snug line-clamp-2">{result.shariah.rule}</span>
              </div>
            ) : <span className="text-xs text-muted-foreground">—</span>}
          </div>

          {/* Action */}
          <div className="md:col-span-3">
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="w-full px-4 py-3 rounded-2xl text-sm font-bold text-primary-foreground bg-gradient-to-br from-primary to-accent shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <ArrowLeftRight className="size-4" />}
              {mutation.isPending ? "..." : autoCalc ? "إعادة الحساب" : "احسب الآن"}
            </button>
          </div>
        </div>

        {/* Expert advice — single concise line */}
        {result && <ExpertAdviceLine result={result} />}
      </div>

      {/* ============ Two compact sides ============ */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border rtl:md:divide-x-reverse">
        <SidePanel
          side="A" label="الطرف (أ) — يعرض" total={result?.valueA} totalDI={result?.diA}
          products={sideA}
          onUpdate={(i, p) => updateProduct("A", i, p)}
          onRemove={(i) => removeFromSide("A", i)}
          onAdd={() => addToSide("A")}
        />
        <SidePanel
          side="B" label="الطرف (ب) — يطلب" total={result?.valueB} totalDI={result?.diB}
          products={sideB}
          onUpdate={(i, p) => updateProduct("B", i, p)}
          onRemove={(i) => removeFromSide("B", i)}
          onAdd={() => addToSide("B")}
        />
      </div>

      {/* ============ Optional factors table ============ */}
      {result && (
        <details className="border-t border-border bg-stone-soft/40">
          <summary className="px-6 md:px-10 py-4 cursor-pointer font-bold text-sm flex items-center gap-2 hover:bg-stone-soft transition-colors">
            <ChevronDown className="size-4" />
            تفصيل العوامل الاقتصادية
          </summary>
          <div className="px-6 md:px-10 pb-6 overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-2 px-3 font-bold">العامل</th>
                  <th className="py-2 px-3 font-bold">(أ)</th>
                  <th className="py-2 px-3 font-bold">(ب)</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                <Row label="القيمة السوقية (ر.س)" a={result.breakdownA.baseSAR.toLocaleString()} b={result.breakdownB.baseSAR.toLocaleString()} />
                <Row label="الحالة" a={result.breakdownA.conditionFactor} b={result.breakdownB.conditionFactor} />
                <Row label="العمر/الإهلاك" a={result.breakdownA.ageFactor} b={result.breakdownB.ageFactor} />
                <Row label="الجودة" a={result.breakdownA.qualityFactor} b={result.breakdownB.qualityFactor} />
                <Row label="الندرة" a={result.breakdownA.scarcityFactor} b={result.breakdownB.scarcityFactor} />
                <Row label="الموقع" a={result.breakdownA.locationFactor} b={result.breakdownB.locationFactor} />
                <Row label="المخاطرة" a={result.breakdownA.riskFactor} b={result.breakdownB.riskFactor} />
                <Row label="زمن التسليم" a={result.breakdownA.timeFactor} b={result.breakdownB.timeFactor} />
                <Row label="الفئة/الطلب" a={result.breakdownA.categoryFactor} b={result.breakdownB.categoryFactor} />
                <tr className="border-t-2 border-primary/30 font-bold">
                  <td className="py-3 px-3">القيمة الإجمالية</td>
                  <td className="py-3 px-3 text-primary">{result.diA.toLocaleString()} DI</td>
                  <td className="py-3 px-3 text-primary">{result.diB.toLocaleString()} DI</td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}

// ============================================================
// Expert advice — one concise sentence per side
// ============================================================
function ExpertAdviceLine({ result }: { result: PricingResult }) {
  const fair = result.fairness;
  const stronger = result.inFavorOf;
  const cash = result.cashBalanceDI;

  let toA = "", toB = "";
  if (fair >= 85) {
    toA = "السعر عادل — أتمم الصفقة قبل أن تتغير قيمتها.";
    toB = "تكسب وقتاً وتتجنب عمولة البيع — صفقة موفقة.";
  } else if (fair >= 65) {
    toA = stronger === "A"
      ? `أنت الأقوى — اطلب ${cash} DI إضافية أو سلعة مكافئة.`
      : `أضف ${cash} DI لإقفال الصفقة بسرعة.`;
    toB = stronger === "B"
      ? `أنت الأقوى — اطلب ${cash} DI إضافية لتعديل التوازن.`
      : `الفارق ${cash} DI صغير — مكسبك في السرعة.`;
  } else {
    toA = "الفجوة كبيرة — أعد التفاوض أو ابحث عن عرض أفضل.";
    toB = "الطرف الآخر سيرفض غالباً — خفّض المطلوب.";
  }

  return (
    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
      <div className="px-3 py-2 bg-card/60 rounded-lg border border-border flex gap-2">
        <TrendingUp className="size-3.5 text-primary shrink-0 mt-0.5" />
        <span><b className="text-primary">إلى (أ): </b>{toA}</span>
      </div>
      <div className="px-3 py-2 bg-card/60 rounded-lg border border-border flex gap-2">
        <TrendingUp className="size-3.5 text-accent shrink-0 mt-0.5" />
        <span><b className="text-accent">إلى (ب): </b>{toB}</span>
      </div>
    </div>
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

// ============================================================
// Side panel — compact list of item rows
// ============================================================
function SidePanel({
  side, label, products, onUpdate, onRemove, onAdd, total, totalDI,
}: {
  side: "A" | "B"; label: string;
  products: Product[];
  onUpdate: (i: number, p: Product) => void;
  onRemove: (i: number) => void;
  onAdd: () => void;
  total?: number; totalDI?: number;
}) {
  const [expanded, setExpanded] = useState<number | null>(0);
  const accent = side === "A" ? "primary" : "accent";

  return (
    <div className="p-5 md:p-6 bg-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`size-8 rounded-lg grid place-items-center text-sm font-display font-bold ${
            side === "A" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"
          }`}>{side === "A" ? "أ" : "ب"}</div>
          <h3 className="font-bold text-sm">{label}</h3>
        </div>
        {totalDI != null && (
          <div className="text-right">
            <div className={`font-mono font-bold text-base ${side === "A" ? "text-primary" : "text-accent"}`}>
              {totalDI.toLocaleString()} DI
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">
              ≈ {total?.toLocaleString()} ر.س
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {products.map((p, i) => (
          <ItemRow
            key={i}
            index={i} side={side}
            product={p}
            isOpen={expanded === i}
            onToggle={() => setExpanded(expanded === i ? null : i)}
            onUpdate={(np) => onUpdate(i, np)}
            onRemove={products.length > 1 ? () => onRemove(i) : undefined}
            accent={accent}
          />
        ))}

        <button
          type="button" onClick={onAdd} disabled={products.length >= 5}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-border hover:border-primary hover:bg-primary/5 text-[11px] font-bold transition-all disabled:opacity-50"
        >
          <Plus className="size-3" /> أضف عنصر ({products.length}/5)
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Item row — compact inline, expands details
// ============================================================
function ItemRow({
  index, side, product, isOpen, onToggle, onUpdate, onRemove, accent,
}: {
  index: number; side: "A" | "B";
  product: Product; isOpen: boolean;
  onToggle: () => void;
  onUpdate: (p: Product) => void;
  onRemove?: () => void;
  accent: string;
}) {
  const subtotal = (product.marketPricePerUnit || 0) * (product.quantity || 0);

  return (
    <div className={`rounded-2xl border transition-all ${isOpen ? "border-primary/40 shadow-sm" : "border-border hover:border-primary/20"}`}>
      {/* Compact row */}
      <div className="p-3 flex items-center gap-2">
        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
          side === "A" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"
        }`}>{side}{index + 1}</span>

        <input
          type="text" value={product.name}
          onChange={(e) => onUpdate({ ...product, name: e.target.value })}
          placeholder="اسم العنصر"
          className="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-stone-soft border border-transparent focus:border-primary text-sm outline-none"
        />

        <input
          type="number" min={0.01} step={0.01} value={product.quantity}
          onChange={(e) => onUpdate({ ...product, quantity: Number(e.target.value) || 0 })}
          className="w-14 px-2 py-1.5 rounded-lg bg-stone-soft border border-transparent focus:border-primary text-sm text-center outline-none"
          title="الكمية"
        />
        <span className="text-[10px] text-muted-foreground w-10 truncate" title={product.unit}>{product.unit}</span>

        <input
          type="number" min={0.01} step={0.01} value={product.marketPricePerUnit}
          onChange={(e) => onUpdate({ ...product, marketPricePerUnit: Number(e.target.value) || 0 })}
          className="w-20 px-2 py-1.5 rounded-lg bg-stone-soft border border-transparent focus:border-primary text-sm text-center outline-none"
          title="السعر/وحدة"
        />
        <span className="text-[10px] text-muted-foreground">{product.currency}</span>

        <button
          type="button" onClick={onToggle}
          className={`size-7 grid place-items-center rounded-lg hover:bg-primary/10 transition-colors`}
          title="تفاصيل متقدمة"
        >
          <ChevronDown className={`size-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {onRemove && (
          <button
            type="button" onClick={onRemove}
            className="size-7 grid place-items-center rounded-lg hover:bg-destructive/10 text-destructive"
            title="حذف"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Subtotal + condition pill (always visible compact line) */}
      <div className="px-3 pb-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>
          الإجمالي: <span className="font-mono font-bold text-foreground">{subtotal.toLocaleString()} {product.currency}</span>
        </span>
        <span className="flex items-center gap-2">
          <ConditionPill product={product} onUpdate={onUpdate} />
        </span>
      </div>

      {/* Expanded advanced section */}
      {isOpen && (
        <div className="border-t border-border p-3 space-y-3 bg-stone-soft/40 rounded-b-2xl">
          <PriceOracleWarning category={product.category} title={product.name} price={product.marketPricePerUnit} />

          <div className="grid grid-cols-3 gap-2">
            <Field label="النوع">
              <select value={product.itemType}
                onChange={(e) => onUpdate({ ...product, itemType: e.target.value as Product["itemType"] })}
                className="w-full px-2 py-1.5 rounded-lg bg-card border border-border text-xs outline-none">
                {ITEM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="الفئة">
              <select value={product.category}
                onChange={(e) => onUpdate({ ...product, category: e.target.value })}
                className="w-full px-2 py-1.5 rounded-lg bg-card border border-border text-xs outline-none">
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="العملة">
              <select value={product.currency}
                onChange={(e) => onUpdate({ ...product, currency: e.target.value })}
                className="w-full px-2 py-1.5 rounded-lg bg-card border border-border text-xs outline-none">
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Field label="الحالة">
              <select value={product.condition}
                onChange={(e) => {
                  const c = e.target.value as Product["condition"];
                  onUpdate({ ...product, condition: c, quality: CONDITION_TO_QUALITY[c] });
                }}
                className="w-full px-2 py-1.5 rounded-lg bg-card border border-border text-xs outline-none">
                {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="العمر (شهر)">
              <input type="number" min={0} value={product.ageMonths}
                onChange={(e) => onUpdate({ ...product, ageMonths: Number(e.target.value) || 0 })}
                className="w-full px-2 py-1.5 rounded-lg bg-card border border-border text-xs outline-none" />
            </Field>
            <Field label={`الجودة ${product.quality}/10`}>
              <input type="range" min={1} max={10} value={product.quality}
                onChange={(e) => onUpdate({ ...product, quality: Number(e.target.value) })}
                className="w-full accent-primary" />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Field label="الندرة">
              <select value={product.scarcity}
                onChange={(e) => onUpdate({ ...product, scarcity: e.target.value as Product["scarcity"] })}
                className="w-full px-2 py-1.5 rounded-lg bg-card border border-border text-xs outline-none">
                {SCARCITY.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="الموقع">
              <select value={product.locationTier}
                onChange={(e) => onUpdate({ ...product, locationTier: e.target.value as Product["locationTier"] })}
                className="w-full px-2 py-1.5 rounded-lg bg-card border border-border text-xs outline-none">
                {LOCATIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </Field>
            <Field label="المخاطرة">
              <select value={product.riskLevel}
                onChange={(e) => onUpdate({ ...product, riskLevel: e.target.value as Product["riskLevel"] })}
                className="w-full px-2 py-1.5 rounded-lg bg-card border border-border text-xs outline-none">
                {RISKS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="التسليم (يوم)">
              <input type="number" min={0} max={365} value={product.deliveryDays}
                onChange={(e) => onUpdate({ ...product, deliveryDays: Number(e.target.value) || 0 })}
                className="w-full px-2 py-1.5 rounded-lg bg-card border border-border text-xs outline-none" />
            </Field>
            <Field label={`المسافة ${product.distanceKm} كم${product.distanceKm > 50 ? " (شحن)" : ""}`}>
              <input type="number" min={0} max={5000} step={10} value={product.distanceKm}
                onChange={(e) => onUpdate({ ...product, distanceKm: Number(e.target.value) || 0 })}
                className="w-full px-2 py-1.5 rounded-lg bg-card border border-border text-xs outline-none" />
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}

function ConditionPill({ product, onUpdate }: { product: Product; onUpdate: (p: Product) => void }) {
  const c = CONDITIONS.find((x) => x.value === product.condition);
  const colors: Record<Product["condition"], string> = {
    "new": "bg-primary/10 text-primary",
    "like-new": "bg-primary/10 text-primary",
    "excellent": "bg-accent/10 text-accent",
    "good": "bg-muted text-muted-foreground",
    "fair": "bg-destructive/10 text-destructive",
  };
  return (
    <select
      value={product.condition}
      onChange={(e) => {
        const v = e.target.value as Product["condition"];
        onUpdate({ ...product, condition: v, quality: CONDITION_TO_QUALITY[v] });
      }}
      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border-0 outline-none cursor-pointer ${colors[product.condition]}`}
      title={`الحالة: ${c?.label}`}
    >
      {CONDITIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
    </select>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[9px] uppercase tracking-widest text-muted-foreground block mb-1 font-bold">
        {label}
      </label>
      {children}
    </div>
  );
}

// ============================================================
// Price oracle warning
// ============================================================
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
    <div className={`text-[10px] p-2 rounded-lg border flex items-start gap-2 ${abnormal ? "bg-destructive/5 border-destructive/30 text-destructive" : "bg-primary/5 border-primary/20"}`}>
      <TrendingUp className="size-3 mt-0.5 shrink-0" />
      <div className="flex-1">
        <div className="font-bold">مرجع السوق ({ref.count} عرض) — المتوسط {ref.avg.toLocaleString()}</div>
        {abnormal && (
          <div className="mt-0.5">
            ⚠ سعرك {diff > 0 ? "أعلى" : "أقل"} {Math.abs(diff).toFixed(0)}% — السعر المقترح: <b>{Math.round(ref.avg).toLocaleString()}</b>
          </div>
        )}
      </div>
    </div>
  );
}
