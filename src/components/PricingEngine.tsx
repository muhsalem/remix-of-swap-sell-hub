import { useState, useEffect, useMemo, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { calculateBarter, type PricingResult, ITEM_TYPES } from "@/lib/pricing.functions";
import { getReferencePrice } from "@/lib/price-oracle.functions";
import {
  Loader2, Sparkles, ShieldCheck, AlertTriangle, Ban,
  ChevronDown, Plus, X, TrendingUp, Zap, Coins, Package2, ArrowLeftRight,
} from "lucide-react";
import { CatalogPicker, type CatalogPick } from "@/components/CatalogPicker";
import { ITEMS as CATALOG_ITEMS } from "@/lib/badel-catalog";

// ============================================================
// Types
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

const DEFAULT_ITEM: Product = {
  name: "", category: "إلكترونيات", itemType: "good",
  unit: "قطعة", quantity: 1, condition: "like-new", ageMonths: 6,
  marketPricePerUnit: 0, currency: "SAR", quality: 9,
  scarcity: "normal", locationTier: "tier1", riskLevel: "low", deliveryDays: 1, distanceKm: 0,
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
// Main component — single-side valuation (the user's own items)
// ============================================================
export function PricingEngine({ embedded = false }: { embedded?: boolean }) {
  const defaultCurrency = typeof window !== "undefined" ? detectCurrency() : "SAR";
  const [items, setItems] = useState<Product[]>([{ ...DEFAULT_ITEM, currency: defaultCurrency }]);
  const [result, setResult] = useState<PricingResult | null>(null);
  const [autoCalc, setAutoCalc] = useState(true);

  const fn = useServerFn(calculateBarter);
  // We reuse calculateBarter by mirroring items as sideB to satisfy the schema,
  // and we only surface side A's valuation in the UI.
  const mutation = useMutation({
    mutationFn: () => fn({ data: { sideA: items, sideB: items, shariahMode: true, serviceBarter: false } }),
    onSuccess: (r) => {
      setResult(r);
      try {
        sessionStorage.setItem("lastValuation", JSON.stringify({
          at: Date.now(), valueSAR: r.valueA, valueDI: r.diA, items: r.itemsA,
          shariahLevel: r.shariah.level,
        }));
      } catch { /* ignore */ }
    },
  });

  const stateKey = useMemo(() => JSON.stringify(items), [items]);
  const firstRun = useRef(true);
  useEffect(() => {
    if (!autoCalc) return;
    const allValid = items.every(
      (p) => p.name.trim().length > 0 && p.marketPricePerUnit > 0 && p.quantity > 0,
    );
    if (!allValid) return;
    const delay = firstRun.current ? 100 : 600;
    firstRun.current = false;
    const t = setTimeout(() => mutation.mutate(), delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateKey, autoCalc]);

  const addItem = () => setItems([...items, { ...DEFAULT_ITEM, name: "", currency: defaultCurrency }]);
  const removeItem = (idx: number) => { if (items.length > 1) setItems(items.filter((_, i) => i !== idx)); };
  const updateItem = (idx: number, p: Product) => setItems(items.map((x, i) => i === idx ? p : x));

  const onCatalogPick = (pick: CatalogPick) => {
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
    if (items.length === 1 && !items[0].name.trim() && items[0].marketPricePerUnit === 0) {
      setItems([product]);
    } else {
      setItems([...items, product]);
    }
  };

  const [wantsByIdx, setWantsByIdx] = useState<Record<number, string>>({});
  const setWant = (idx: number, v: string) => setWantsByIdx({ ...wantsByIdx, [idx]: v });
  const triggerBarter = (have: string, want: string) => {
    if (!have.trim() || !want.trim()) return;
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("badel:match", { detail: { have, want } }));
      const el = document.getElementById("match-finder-search");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const valueSAR = result?.valueA ?? 0;
  const valueDI = result?.diA ?? 0;
  const shariah = result?.shariah;

  return (
    <section
      className={
        embedded
          ? "rounded-3xl border border-border bg-gradient-to-br from-card via-card to-stone-soft/40 overflow-hidden"
          : "animate-in bg-card rounded-3xl ring-1 ring-black/5 shadow-2xl overflow-hidden mb-16"
      }
    >
      {/* ============ Hero header ============ */}
      <div className="relative px-5 md:px-8 pt-6 pb-5 border-b border-border bg-gradient-to-br from-primary/8 via-card to-accent/5 overflow-hidden">
        <div className="absolute -top-12 -left-12 size-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 size-48 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 bg-primary/10 text-primary text-[10px] font-mono rounded-full uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="size-3" /> قيّم ممتلكاتك
              </span>
              {mutation.isPending && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Loader2 className="size-3 animate-spin" /> يحسب القيمة...
                </span>
              )}
            </div>
            <h3 className="font-display text-xl md:text-2xl font-extrabold tracking-tight leading-tight">
              محرّك التسعير العادل
            </h3>
            <p className="text-muted-foreground mt-1 text-xs md:text-sm">
              ابدأ من الكتالوج، اضبط القيمة، اعرف ما تملكه يساوي كم.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs bg-card/70 backdrop-blur px-3 py-2 rounded-xl border border-border cursor-pointer shadow-sm">
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

      {/* ============ Hero value display ============ */}
      <div className="relative px-5 md:px-8 py-6 bg-gradient-to-br from-primary/95 via-primary to-primary/85 text-primary-foreground overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 80%, white 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />
        <div className="relative grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div className="md:col-span-7">
            <div className="text-[11px] uppercase tracking-[0.2em] opacity-80 font-extrabold mb-1">القيمة الإجمالية المقدّرة</div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="font-display text-4xl md:text-5xl font-extrabold tabular-nums leading-none">
                {result ? valueSAR.toLocaleString() : "—"}
              </span>
              <span className="text-sm opacity-80 font-bold">ر.س</span>
              <span className="text-xs opacity-60 mx-2">•</span>
              <span className="flex items-center gap-1.5 font-mono font-bold text-base opacity-95">
                <Coins className="size-4" />
                {result ? valueDI.toLocaleString() : "0"} <span className="text-xs opacity-70">DI</span>
              </span>
            </div>
            {result && items.length > 1 && (
              <p className="text-xs opacity-80 mt-2">
                مجموع <b>{items.length}</b> عناصر — متوسط {Math.round(valueSAR / items.length).toLocaleString()} ر.س/عنصر
              </p>
            )}
          </div>
          <div className="md:col-span-5 flex items-center gap-2">
            {shariah ? (
              <div className={`flex-1 px-3 py-2.5 rounded-2xl text-xs font-bold flex items-start gap-2 backdrop-blur ${
                shariah.level === "forbidden" ? "bg-destructive/30 ring-1 ring-destructive/50" :
                shariah.level === "warning" ? "bg-accent/30 ring-1 ring-accent/50" :
                "bg-white/15 ring-1 ring-white/20"
              }`}>
                {shariah.level === "forbidden" ? <Ban className="size-3.5 shrink-0 mt-0.5" />
                  : shariah.level === "warning" ? <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                  : <ShieldCheck className="size-3.5 shrink-0 mt-0.5" />}
                <span className="leading-snug line-clamp-2">{shariah.rule}</span>
              </div>
            ) : (
              <div className="flex-1 px-3 py-2.5 rounded-2xl text-xs bg-white/10 backdrop-blur opacity-70">
                أكمل البيانات لرؤية التقييم الشرعي
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============ Items list ============ */}
      <div className="p-5 md:p-7 bg-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-xl grid place-items-center bg-primary/10 text-primary">
              <Package2 className="size-4" />
            </div>
            <h4 className="font-bold text-sm">ممتلكاتك ({items.length})</h4>
          </div>
          {!autoCalc && (
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="px-4 py-2 rounded-xl text-xs font-bold text-primary-foreground bg-primary hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-60"
            >
              {mutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              احسب القيمة
            </button>
          )}
        </div>

        <div className="space-y-2">
          {items.map((p, i) => (
            <ItemRow
              key={i}
              index={i}
              product={p}
              onUpdate={(np) => updateItem(i, np)}
              onRemove={items.length > 1 ? () => removeItem(i) : undefined}
            />
          ))}

          <button
            type="button" onClick={addItem} disabled={items.length >= 5}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-border hover:border-primary hover:bg-primary/5 text-xs font-bold transition-all disabled:opacity-50"
          >
            <Plus className="size-3.5" /> أضف عنصر آخر ({items.length}/5)
          </button>
        </div>
      </div>

      {/* ============ Breakdown ============ */}
      {result && (
        <details className="border-t border-border bg-stone-soft/40">
          <summary className="px-6 md:px-10 py-4 cursor-pointer font-bold text-sm flex items-center gap-2 hover:bg-stone-soft transition-colors">
            <ChevronDown className="size-4" />
            تفصيل العوامل الاقتصادية المؤثرة في التقييم
          </summary>
          <div className="px-6 md:px-10 pb-6 overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse">
              <tbody className="font-mono">
                <Row label="القيمة السوقية الأولية" v={`${result.breakdownA.baseSAR.toLocaleString()} ر.س`} />
                <Row label="معامل الحالة" v={result.breakdownA.conditionFactor} />
                <Row label="معامل العمر/الإهلاك" v={result.breakdownA.ageFactor} />
                <Row label="معامل الجودة" v={result.breakdownA.qualityFactor} />
                <Row label="معامل الندرة" v={result.breakdownA.scarcityFactor} />
                <Row label="معامل الموقع" v={result.breakdownA.locationFactor} />
                <Row label="معامل المخاطرة" v={result.breakdownA.riskFactor} />
                <Row label="معامل زمن التسليم" v={result.breakdownA.timeFactor} />
                <Row label="معامل الفئة/الطلب" v={result.breakdownA.categoryFactor} />
                <tr className="border-t-2 border-primary/30 font-bold">
                  <td className="py-3 px-3">القيمة النهائية</td>
                  <td className="py-3 px-3 text-primary text-left">
                    {result.diA.toLocaleString()} DI · {result.valueA.toLocaleString()} ر.س
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}

function Row({ label, v }: { label: string; v: number | string }) {
  return (
    <tr className="border-b border-border/50">
      <td className="py-2 px-3 text-muted-foreground font-sans">{label}</td>
      <td className="py-2 px-3 text-left">{v}</td>
    </tr>
  );
}

// ============================================================
// Item row — compact inline, expands details
// ============================================================
function ItemRow({
  index, product, onUpdate, onRemove,
}: {
  index: number;
  product: Product;
  onUpdate: (p: Product) => void;
  onRemove?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(index === 0);
  const subtotal = (product.marketPricePerUnit || 0) * (product.quantity || 0);

  return (
    <div className={`rounded-2xl border transition-all ${isOpen ? "border-primary/40 shadow-sm bg-card" : "border-border hover:border-primary/20 bg-card"}`}>
      {/* Compact row */}
      <div className="p-3 flex items-center gap-2 flex-wrap md:flex-nowrap">
        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
          #{index + 1}
        </span>

        <input
          type="text" value={product.name}
          onChange={(e) => onUpdate({ ...product, name: e.target.value })}
          placeholder="اسم العنصر"
          className="flex-1 min-w-[120px] px-2 py-1.5 rounded-lg bg-stone-soft border border-transparent focus:border-primary text-sm outline-none"
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
          placeholder="السعر"
          title="السعر/وحدة"
        />
        <span className="text-[10px] text-muted-foreground">{product.currency}</span>

        <button
          type="button" onClick={() => setIsOpen(!isOpen)}
          className="size-7 grid place-items-center rounded-lg hover:bg-primary/10 transition-colors"
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

      {/* Subtotal + condition pill */}
      <div className="px-3 pb-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>
          إجمالي: <span className="font-mono font-bold text-foreground">{subtotal.toLocaleString()} {product.currency}</span>
        </span>
        <ConditionPill product={product} onUpdate={onUpdate} />
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
