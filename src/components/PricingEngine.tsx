import { useState, useEffect, useMemo, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { calculateBarter, type PricingResult, ITEM_TYPES } from "@/lib/pricing.functions";
import { getReferencePrice } from "@/lib/price-oracle.functions";
import { analyzeProductImage } from "@/lib/vision.functions";
import {
  Loader2, Sparkles, ShieldCheck, AlertTriangle, Ban,
  ChevronDown, Plus, X, TrendingUp, Zap, Coins, Package2, ArrowLeftRight,
  Camera, Wrench, Package, Info, ArrowLeft,
  Briefcase, GraduationCap, Stethoscope, Banknote, Code2,
} from "lucide-react";
import { FAMILIES, ITEMS as CATALOG_ITEMS, familiesByType, type FamilyEntry } from "@/lib/badel-catalog";
import { FX_VS_SAR, DI_TO_SAR, loadCountry, saveCountry, sarToLocal } from "@/lib/currency-fx";

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
  // catalog wiring
  baseType: "good" | "service";
  familyId: string;
};

const CONDITION_TO_QUALITY: Record<Product["condition"], number> = {
  "new": 10, "like-new": 9, "excellent": 8, "good": 6, "fair": 4,
};

const CONDITIONS = [
  { value: "new", label: "جديد" }, { value: "like-new", label: "كالجديد" },
  { value: "excellent", label: "ممتاز" }, { value: "good", label: "جيد" }, { value: "fair", label: "مقبول" },
] as const;
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

function defaultItem(currency = "SAR"): Product {
  const f = FAMILIES["g7"]; // إلكترونيات
  const firstItem = CATALOG_ITEMS["g7"]?.[0] || "";
  return {
    name: firstItem,
    category: f.category,
    itemType: "good",
    baseType: "good",
    familyId: "g7",
    unit: f.defaultUnit,
    quantity: 1,
    condition: "like-new",
    ageMonths: 6,
    marketPricePerUnit: 0,
    currency,
    quality: 9,
    scarcity: "normal",
    locationTier: "tier1",
    riskLevel: "low",
    deliveryDays: 1,
    distanceKm: 0,
  };
}

function detectCurrency(): string {
  return loadCountry();
}

// ============================================================
// Main component
// ============================================================
export function PricingEngine({ embedded = false }: { embedded?: boolean }) {
  const defaultCurrency = typeof window !== "undefined" ? detectCurrency() : "SAR";
  const [items, setItems] = useState<Product[]>([defaultItem(defaultCurrency)]);
  const [result, setResult] = useState<PricingResult | null>(null);
  const [autoCalc, setAutoCalc] = useState(true);
  const [country, setCountry] = useState<string>(defaultCurrency);
  const changeCountry = (c: string) => { setCountry(c); saveCountry(c); };

  const fn = useServerFn(calculateBarter);
  const sanitized = useMemo(
    () => items.map((p) => ({ ...p, marketPricePerUnit: Math.max(Number(p.marketPricePerUnit) || 0, 0.01) })),
    [items],
  );
  const mutation = useMutation({
    mutationFn: () => fn({ data: { sideA: sanitized, sideB: sanitized, shariahMode: true, serviceBarter: false } }),
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

  const addItem = () => setItems([...items, defaultItem(defaultCurrency)]);
  const removeItem = (idx: number) => { if (items.length > 1) setItems(items.filter((_, i) => i !== idx)); };
  const updateItem = (idx: number, p: Product) => setItems(items.map((x, i) => i === idx ? p : x));

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

  // Confidence Score — data completeness signal
  const confidence = useMemo(() => {
    if (items.length === 0) return 0;
    const scores = items.map((p) => {
      let s = 0;
      if (p.name.trim()) s += 20;
      if (p.marketPricePerUnit > 0) s += 25;
      if (p.quantity > 0) s += 10;
      if (p.ageMonths >= 0 && p.condition) s += 15;
      if (p.quality >= 5) s += 10;
      if (p.locationTier && p.scarcity) s += 10;
      if (p.deliveryDays > 0 || p.baseType === "service") s += 10;
      return Math.min(100, s);
    });
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }, [items]);
  const confTone =
    confidence >= 80 ? { label: "عالية", cls: "bg-emerald-500/20 ring-emerald-300/40 text-emerald-50" }
    : confidence >= 50 ? { label: "متوسطة", cls: "bg-amber-500/20 ring-amber-300/40 text-amber-50" }
    : { label: "منخفضة", cls: "bg-rose-500/20 ring-rose-300/40 text-rose-50" };


  return (
    <section
      className={
        embedded
          ? "rounded-3xl border border-border bg-gradient-to-br from-card via-card to-stone-soft/40 overflow-hidden"
          : "animate-in bg-card rounded-3xl ring-1 ring-black/5 shadow-2xl overflow-hidden mb-16"
      }
    >
      {/* ============ Hero header ============ */}
      <div className="relative px-6 md:px-8 pt-7 pb-6 border-b border-border bg-gradient-to-br from-primary/8 via-card to-accent/5 overflow-hidden">
        <div className="absolute -top-12 -left-12 size-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 size-48 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1.5 bg-primary/10 text-primary text-sm font-mono rounded-full uppercase tracking-wider flex items-center gap-1.5 font-extrabold">
                <Sparkles className="size-4" /> قيّم ما تريد مقايضته
              </span>
              {mutation.isPending && (
                <span className="text-sm text-muted-foreground flex items-center gap-1 font-bold">
                  <Loader2 className="size-4 animate-spin" /> يحسب القيمة...
                </span>
              )}
            </div>
            <h3 className="font-display text-3xl md:text-4xl font-black tracking-tight leading-tight">
              محرّك التسعير العادل
            </h3>
            <p className="text-foreground/80 mt-2 text-base md:text-lg font-bold">
              اختر النوع والفئة، أضف الصورة أو الخصائص، واحصل على قيمة شفافة بالعملة الرقمية الداخلية (DI).
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm font-extrabold bg-card/70 backdrop-blur px-4 py-2.5 rounded-xl border border-border cursor-pointer shadow-sm">
            <input
              type="checkbox" checked={autoCalc}
              onChange={(e) => setAutoCalc(e.target.checked)}
              className="accent-primary size-4"
            />
            <Zap className="size-4 text-primary" />
            حساب تلقائي
          </label>
        </div>
      </div>

      {/* ============ TWO COLUMNS side-by-side ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
        {/* ===== LEFT: Inputs ===== */}
        <div className="p-5 md:p-7 bg-card space-y-5 lg:border-l border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-10 rounded-xl grid place-items-center bg-primary/10 text-primary">
                <Package2 className="size-5" />
              </div>
              <h4 className="font-extrabold text-lg md:text-xl">ما أريد مقايضته ({items.length})</h4>
            </div>
            {!autoCalc && (
              <button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
                className="px-4 py-2.5 rounded-xl text-sm font-extrabold text-primary-foreground bg-primary hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-60"
              >
                {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                احسب القيمة
              </button>
            )}
          </div>

          <div className="space-y-3">
            {items.map((p, i) => (
              <ItemCard
                key={i}
                index={i}
                product={p}
                wantValue={wantsByIdx[i] || ""}
                onWantChange={(v) => setWant(i, v)}
                onBarter={() => triggerBarter(p.name, wantsByIdx[i] || "")}
                onUpdate={(np) => updateItem(i, np)}
                onRemove={items.length > 1 ? () => removeItem(i) : undefined}
              />
            ))}

            <button
              type="button" onClick={addItem} disabled={items.length >= 5}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 text-base font-extrabold transition-all disabled:opacity-50"
            >
              <Plus className="size-5" /> أضف عنصراً ({items.length}/5)
            </button>
          </div>
        </div>

        {/* ===== RIGHT: Value + Breakdown + DI Info ===== */}
        <div className="bg-gradient-to-br from-stone-soft/30 via-card to-stone-soft/20">
          {/* Value display */}
          <div className="relative px-6 md:px-8 py-7 bg-gradient-to-br from-primary/95 via-primary to-primary/85 text-primary-foreground overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 80%, white 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }} />
            <div className="relative" aria-live="polite" aria-atomic="true">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-sm uppercase tracking-[0.2em] opacity-90 font-extrabold">القيمة الإجمالية المقدّرة</div>
                <span
                  className={`shrink-0 text-[11px] font-extrabold px-2.5 py-1 rounded-full ring-1 backdrop-blur ${confTone.cls}`}
                  title={`نسبة اكتمال البيانات: ${confidence}%`}
                  aria-label={`درجة الثقة في التقييم ${confidence} بالمئة، ${confTone.label}`}
                >
                  ثقة {confidence}% · {confTone.label}
                </span>
              </div>
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="font-display text-5xl md:text-6xl font-black tabular-nums leading-none">
                  {result ? valueSAR.toLocaleString() : "—"}
                </span>
                <span className="text-lg opacity-90 font-extrabold">ر.س</span>
              </div>
              <div className="flex items-center gap-2 mt-3 font-mono font-extrabold text-xl">
                <Coins className="size-5" />
                {result ? valueDI.toLocaleString() : "0"} <span className="text-sm opacity-80">DI (عملة بادل الرقمية)</span>
              </div>

              {/* ===== Inline live currency converter ===== */}
              <div className="mt-4 p-3 rounded-2xl bg-white/12 backdrop-blur ring-1 ring-white/20">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="text-xs uppercase tracking-wider font-extrabold opacity-90">
                    بعملتك المحلية
                  </div>
                  <select
                    value={country}
                    onChange={(e) => changeCountry(e.target.value)}
                    aria-label="اختر عملتك المحلية"
                    className="text-xs font-extrabold bg-white/15 hover:bg-white/25 transition rounded-lg px-2 py-1 outline-none ring-1 ring-white/20 text-primary-foreground [&>option]:text-foreground"
                  >
                    {Object.entries(FX_VS_SAR).map(([code, v]) => (
                      <option key={code} value={code}>{v.flag} {code}</option>
                    ))}
                  </select>
                </div>
                <div className="mt-1.5 flex items-baseline gap-2 flex-wrap">
                  <span className="font-display text-2xl md:text-3xl font-black tabular-nums">
                    {result ? sarToLocal(valueSAR, country).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}
                  </span>
                  <span className="text-sm font-extrabold opacity-90">{FX_VS_SAR[country]?.symbol}</span>
                  <span className="text-[11px] opacity-75 font-bold">
                    · 1 DI ≈ {(DI_TO_SAR * (FX_VS_SAR[country]?.perSAR ?? 1)).toLocaleString(undefined, { maximumFractionDigits: 3 })} {FX_VS_SAR[country]?.symbol}
                  </span>
                </div>
              </div>

              {result && items.length > 1 && (
                <p className="text-sm opacity-90 mt-3 font-bold">
                  مجموع <b>{items.length}</b> عناصر — متوسط {Math.round(valueSAR / items.length).toLocaleString()} ر.س/عنصر
                </p>
              )}

              <div className="mt-4">
                {shariah ? (
                  <div className={`px-4 py-3 rounded-2xl text-sm font-extrabold flex items-start gap-2 backdrop-blur ${
                    shariah.level === "forbidden" ? "bg-destructive/30 ring-1 ring-destructive/50" :
                    shariah.level === "warning" ? "bg-accent/30 ring-1 ring-accent/50" :
                    "bg-white/15 ring-1 ring-white/20"
                  }`}>
                    {shariah.level === "forbidden" ? <Ban className="size-4 shrink-0 mt-0.5" />
                      : shariah.level === "warning" ? <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                      : <ShieldCheck className="size-4 shrink-0 mt-0.5" />}
                    <span className="leading-snug">{shariah.rule}</span>
                  </div>
                ) : (
                  <div className="px-4 py-3 rounded-2xl text-sm bg-white/10 backdrop-blur opacity-80 font-bold">
                    أكمل البيانات لرؤية التقييم الشرعي
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Breakdown */}
          {result && (
            <details className="border-t border-border">
              <summary className="px-6 md:px-8 py-4 cursor-pointer font-extrabold text-base flex items-center gap-2 hover:bg-stone-soft transition-colors">
                <ChevronDown className="size-5" />
                تفصيل العوامل الاقتصادية المؤثرة
              </summary>
              <div className="px-6 md:px-8 pb-6 overflow-x-auto">
                <table className="w-full text-sm text-right border-collapse">
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
                    <tr className="border-t-2 border-primary/30 font-extrabold">
                      <td className="py-3 px-3 text-base">القيمة النهائية</td>
                      <td className="py-3 px-3 text-primary text-left text-base">
                        {result.diA.toLocaleString()} DI · {result.valueA.toLocaleString()} ر.س
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </div>
      </div>

    </section>
  );
}

function Row({ label, v }: { label: string; v: number | string }) {
  return (
    <tr className="border-b border-border/50">
      <td className="py-2.5 px-3 text-muted-foreground font-sans font-bold">{label}</td>
      <td className="py-2.5 px-3 text-left font-extrabold">{v}</td>
    </tr>
  );
}

// ============================================================
// DI Link Card — points to /digital-currency
// ============================================================
function DiLinkCard({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <Link
        to="/digital-currency"
        className="flex flex-col justify-between rounded-xl border border-primary/30 bg-gradient-to-bl from-primary/10 via-primary/5 to-transparent p-3 hover:from-primary/15 transition-colors min-w-[180px] md:max-w-[220px]"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="size-8 rounded-xl grid place-items-center bg-primary/15 text-primary shrink-0">
            <Coins className="size-4" />
          </div>
          <span className="text-sm font-extrabold leading-tight">العملة الرقمية (DI)</span>
        </div>
        <div className="text-[11px] text-muted-foreground font-bold leading-snug mb-2">
          كيف تكتسبها وقيمتها بعملتك المحلية
        </div>
        <span className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-extrabold">
          افتح الصفحة <ArrowLeft className="size-3.5" />
        </span>
      </Link>
    );
  }
  return (
    <Link
      to="/digital-currency"
      className="block border-t border-border bg-gradient-to-l from-primary/5 via-stone-soft/40 to-transparent hover:from-primary/10 transition-colors"
    >
      <div className="px-6 md:px-8 py-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-2xl grid place-items-center bg-primary/10 text-primary shrink-0">
            <Coins className="size-6" />
          </div>
          <div>
            <div className="font-extrabold text-base md:text-lg">كيف تعمل العملة الرقمية الداخلية (DI)؟</div>
            <div className="text-xs md:text-sm text-muted-foreground font-bold mt-0.5">
              اكتسابها، استخدامها، وقيمتها بعملتك المحلية حسب بلدك.
            </div>
          </div>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-extrabold whitespace-nowrap">
          افتح الصفحة <ArrowLeft className="size-4" />
        </span>
      </div>
    </Link>
  );
}

// ============================================================
// Item Card — type tabs, catalog-driven category, AI photo
// ============================================================
function ItemCard({
  index, product, onUpdate, onRemove, wantValue, onWantChange, onBarter,
}: {
  index: number;
  product: Product;
  onUpdate: (p: Product) => void;
  onRemove?: () => void;
  wantValue: string;
  onWantChange: (v: string) => void;
  onBarter: () => void;
}) {
  const [advOpen, setAdvOpen] = useState(false);
  const subtotal = (product.marketPricePerUnit || 0) * (product.quantity || 0);

  const groupedFamilies = useMemo(() => familiesByType(product.baseType), [product.baseType]);
  const family: FamilyEntry = FAMILIES[product.familyId] ?? FAMILIES["g7"];
  const itemNames = CATALOG_ITEMS[product.familyId] || [];

  const switchType = (t: "good" | "service") => {
    const firstFamId = Object.values(familiesByType(t))[0]?.[0]?.id || (t === "good" ? "g7" : "s1");
    const f = FAMILIES[firstFamId];
    const first = CATALOG_ITEMS[firstFamId]?.[0] || f.n;
    onUpdate({
      ...product,
      baseType: t,
      familyId: firstFamId,
      itemType: (f.itemType === "real-estate" ? "good" : f.itemType) as Product["itemType"],
      category: f.category,
      unit: f.defaultUnit,
      name: first,
    });
  };

  const switchFamily = (id: string) => {
    const f = FAMILIES[id];
    const first = CATALOG_ITEMS[id]?.[0] || f.n;
    onUpdate({
      ...product,
      familyId: id,
      itemType: (f.itemType === "real-estate" ? "good" : f.itemType) as Product["itemType"],
      category: f.category,
      unit: f.defaultUnit,
      name: first,
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header strip */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-stone-soft/60 border-b border-border">
        <span className="text-sm font-extrabold text-foreground flex items-center gap-2">
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/10 text-primary">#{index + 1}</span>
          عنصر للمقايضة
        </span>
        {onRemove && (
          <button onClick={onRemove} aria-label={`حذف العنصر رقم ${index + 1}`} className="size-7 grid place-items-center rounded-lg hover:bg-destructive/10 text-destructive" title="حذف">
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* BIG type tabs (سلعة / خدمة) */}
        <div role="tablist" aria-label="نوع العنصر" className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-stone-soft border border-border">
          <TypeTab
            active={product.baseType === "good"}
            onClick={() => switchType("good")}
            icon={<Package className="size-6" />}
            label="سلعة"
            desc="منتج مادي يتم تسليمه"
          />
          <TypeTab
            active={product.baseType === "service"}
            onClick={() => switchType("service")}
            icon={<Wrench className="size-6" />}
            label="خدمة"
            desc="مهارة أو وقت تقدّمه"
          />
        </div>

        {/* Category (catalog family) + specific item */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <LabeledSelect label="الفئة" value={product.familyId} onChange={switchFamily}>
            {Object.entries(groupedFamilies).map(([sub, arr]) => (
              <optgroup key={sub} label={sub}>
                {arr.map((f) => <option key={f.id} value={f.id}>{f.entry.n}</option>)}
              </optgroup>
            ))}
          </LabeledSelect>

          <LabeledSelect label="الصنف" value={product.name} onChange={(v) => onUpdate({ ...product, name: v })}>
            {itemNames.length === 0 && <option value="">— لا يوجد —</option>}
            {itemNames.map((n) => <option key={n} value={n}>{n}</option>)}
            <option value="__custom__">+ اسم آخر…</option>
          </LabeledSelect>
        </div>

        {product.name === "__custom__" && (
          <input
            autoFocus type="text" defaultValue=""
            onBlur={(e) => onUpdate({ ...product, name: e.target.value || itemNames[0] || "عنصر" })}
            placeholder="اكتب اسم الصنف..."
            className="w-full px-3 py-2.5 rounded-xl bg-stone-soft border border-border text-base font-bold outline-none focus:ring-2 ring-primary/30"
          />
        )}

        {/* Service icon OR AI photo (good only) */}
        {product.baseType === "service" ? (
          <ServiceIconPanel familyId={product.familyId} family={family} />
        ) : (
          <AiPhotoOrManual product={product} onApply={(patch) => onUpdate({ ...product, ...patch })} />
        )}

        {/* Qty + price */}
        <div className="grid grid-cols-2 gap-2">
          <LabeledInput
            label={`الكمية (${product.unit})`}
            type="number" min={0.01} step={0.01} value={product.quantity}
            onChange={(v) => onUpdate({ ...product, quantity: Number(v) || 0 })}
          />
          <LabeledInput
            label={`السعر/الوحدة (${product.currency})`}
            type="number" min={0.01} step={0.01} value={product.marketPricePerUnit}
            onChange={(v) => onUpdate({ ...product, marketPricePerUnit: Number(v) || 0 })}
          />
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground font-bold">الإجمالي:</span>
          <span className="font-mono font-extrabold text-foreground text-base">
            {subtotal.toLocaleString()} {product.currency}
          </span>
        </div>

        <PriceOracleWarning category={product.category} title={product.name} price={product.marketPricePerUnit} />

        {/* Advanced toggle */}
        <button
          type="button" onClick={() => setAdvOpen(!advOpen)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-stone-soft/60 text-sm font-extrabold hover:bg-stone-soft"
        >
          <span>الخصائص المتقدمة (الحالة، الجودة، الموقع، الشحن)</span>
          <ChevronDown className={`size-4 transition-transform ${advOpen ? "rotate-180" : ""}`} />
        </button>

        {advOpen && (
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-2">
              <LabeledSelect label="الحالة" value={product.condition}
                onChange={(v) => onUpdate({ ...product, condition: v as Product["condition"], quality: CONDITION_TO_QUALITY[v as Product["condition"]] })}>
                {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </LabeledSelect>
              <LabeledInput label="العمر (شهر)" type="number" min={0} value={product.ageMonths}
                onChange={(v) => onUpdate({ ...product, ageMonths: Number(v) || 0 })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <LabeledSelect label="العملة" value={product.currency} onChange={(v) => onUpdate({ ...product, currency: v })}>
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </LabeledSelect>
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground block mb-1 font-extrabold">
                  الجودة {product.quality}/10
                </label>
                <input type="range" min={1} max={10} value={product.quality}
                  onChange={(e) => onUpdate({ ...product, quality: Number(e.target.value) })}
                  className="w-full accent-primary" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <LabeledSelect label="الندرة" value={product.scarcity}
                onChange={(v) => onUpdate({ ...product, scarcity: v as Product["scarcity"] })}>
                {SCARCITY.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </LabeledSelect>
              <LabeledSelect label="الموقع" value={product.locationTier}
                onChange={(v) => onUpdate({ ...product, locationTier: v as Product["locationTier"] })}>
                {LOCATIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </LabeledSelect>
              <LabeledSelect label="المخاطرة" value={product.riskLevel}
                onChange={(v) => onUpdate({ ...product, riskLevel: v as Product["riskLevel"] })}>
                {RISKS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </LabeledSelect>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <LabeledInput label="التسليم (يوم)" type="number" min={0} max={365} value={product.deliveryDays}
                onChange={(v) => onUpdate({ ...product, deliveryDays: Number(v) || 0 })} />
              <LabeledInput label={`المسافة (كم)${product.distanceKm > 50 ? " — شحن" : ""}`} type="number" min={0} max={5000} step={10} value={product.distanceKm}
                onChange={(v) => onUpdate({ ...product, distanceKm: Number(v) || 0 })} />
            </div>
          </div>
        )}

        {/* Barter bar + DI link side by side */}
        <div className="grid md:grid-cols-[1fr_auto] gap-3 items-stretch">
          <BarterBar
            product={product}
            wantValue={wantValue}
            onWantChange={onWantChange}
            onBarter={onBarter}
          />
          <DiLinkCard compact />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// AI Photo / Manual entry
// ============================================================
function AiPhotoOrManual({
  product, onApply,
}: {
  product: Product;
  onApply: (patch: Partial<Product>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const analyzeFn = useServerFn(analyzeProductImage);
  const m = useMutation({
    mutationFn: (b64: string) => analyzeFn({ data: { imageBase64: b64, hint: product.name } }),
    onSuccess: (r) => {
      onApply({
        name: r.name,
        category: r.category,
        condition: r.condition,
        ageMonths: r.estimatedAgeMonths,
        marketPricePerUnit: r.marketPriceSAR || product.marketPricePerUnit,
        quality: CONDITION_TO_QUALITY[r.condition],
      });
    },
    onError: (e: any) => setError(e?.message || "فشل التحليل"),
  });

  const onPick = async (f: File) => {
    setError(null);
    if (f.size > 4_000_000) { setError("الحجم يجب أن يكون أقل من 4MB"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || "");
      setPreview(url);
      m.mutate(url);
    };
    reader.readAsDataURL(f);
  };

  return (
    <div className="rounded-xl border border-dashed border-border bg-gradient-to-br from-accent/5 to-transparent p-3">
      <div className="flex gap-3 items-stretch">
        {/* LEFT: preview thumbnail / placeholder */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={m.isPending}
            className="relative size-24 md:size-28 rounded-xl overflow-hidden ring-1 ring-border bg-stone-soft grid place-items-center hover:ring-accent transition disabled:opacity-50"
          >
            {preview ? (
              <img src={preview} alt="معاينة" className="absolute inset-0 size-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-1 text-muted-foreground">
                <Camera className="size-6" />
                <span className="text-[10px] font-extrabold">إضافة صورة</span>
              </div>
            )}
            {m.isPending && (
              <div className="absolute inset-0 grid place-items-center bg-black/40 text-white">
                <Loader2 className="size-5 animate-spin" />
              </div>
            )}
          </button>
        </div>

        {/* RIGHT: text + actions */}
        <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
          <div>
            <div className="text-sm font-extrabold flex items-center gap-1.5">
              <Sparkles className="size-4 text-accent" />
              صوّر السلعة — الذكاء الاصطناعي يستخرج الخصائص تلقائياً
            </div>
            <div className="text-xs text-muted-foreground font-bold mt-1 flex items-center gap-1">
              <Info className="size-3" /> أو اكتب الخصائص يدوياً أسفل
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={m.isPending}
              className="px-3 py-2 rounded-lg bg-accent text-accent-foreground text-xs font-extrabold flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50"
            >
              {m.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
              {m.isPending ? "يحلّل..." : preview ? "صورة أخرى" : "اختر/التقط صورة"}
            </button>
            {m.isSuccess && (
              <span className="text-[11px] font-extrabold text-accent">✓ تم التحليل</span>
            )}
          </div>
          <input
            ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); }}
          />
        </div>
      </div>

      {m.isSuccess && m.data?.notes && (
        <div className="mt-2 text-xs text-muted-foreground font-bold leading-snug">{m.data.notes}</div>
      )}

      {error && (
        <div className="mt-2 text-xs text-destructive font-bold flex items-center gap-1">
          <AlertTriangle className="size-3" /> {error}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Service icon panel — symbolic representation when baseType=service
// ============================================================
const SERVICE_ICONS: Record<string, { Icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  s1: { Icon: Briefcase,     tone: "from-sky-500/15 to-sky-500/5 text-sky-600" },
  s2: { Icon: GraduationCap, tone: "from-violet-500/15 to-violet-500/5 text-violet-600" },
  s3: { Icon: Stethoscope,   tone: "from-rose-500/15 to-rose-500/5 text-rose-600" },
  s4: { Icon: Banknote,      tone: "from-emerald-500/15 to-emerald-500/5 text-emerald-600" },
  s5: { Icon: Code2,         tone: "from-amber-500/15 to-amber-500/5 text-amber-600" },
};

function ServiceIconPanel({ familyId, family }: { familyId: string; family: FamilyEntry }) {
  const meta = SERVICE_ICONS[familyId] ?? { Icon: Wrench, tone: "from-primary/10 to-primary/5 text-primary" };
  const Icon = meta.Icon;
  return (
    <div className={`rounded-xl border border-border bg-gradient-to-l ${meta.tone} p-3`}>
      <div className="flex gap-3 items-center">
        <div className="shrink-0 size-24 md:size-28 rounded-xl bg-card ring-1 ring-border grid place-items-center">
          <Icon className="size-12" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-extrabold flex items-center gap-1.5">
            <Wrench className="size-4" />
            خدمة — {family.n}
          </div>
          <div className="text-xs text-muted-foreground font-bold mt-1 leading-snug">
            الخدمات لا تتطلب صورة سلعة. الرمز أعلاه تمثيل مرئي لفئة الخدمة لتسهيل اكتشافها.
          </div>
          <div className="text-[11px] text-muted-foreground font-bold mt-1">
            وحدة افتراضية: <span className="font-mono text-foreground">{family.defaultUnit}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Small inputs
// ============================================================
function TypeTab({
  active, onClick, icon, label, desc,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; desc: string }) {
  return (
    <button
      type="button" onClick={onClick}
      role="tab"
      aria-selected={active}
      aria-label={`${label} — ${desc}`}
      className={`flex flex-col items-center gap-1 py-4 px-3 rounded-xl transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
        active
          ? "bg-primary text-primary-foreground shadow-lg scale-[1.02]"
          : "bg-card text-foreground hover:bg-stone-soft border border-border"
      }`}
    >
      <div className={active ? "" : "text-primary"}>{icon}</div>
      <span className="text-lg font-black">{label}</span>
      <span className={`text-[11px] font-bold ${active ? "opacity-90" : "text-muted-foreground"}`}>{desc}</span>
    </button>
  );
}

function LabeledSelect({
  label, value, onChange, children,
}: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-muted-foreground block mb-1 font-extrabold">{label}</label>
      <select
        value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-xl bg-stone-soft border border-border text-base font-bold text-foreground outline-none focus:ring-2 focus:ring-primary/30"
      >
        {children}
      </select>
    </div>
  );
}

function LabeledInput({
  label, value, onChange, ...rest
}: {
  label: string;
  value: number | string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-muted-foreground block mb-1 font-extrabold">{label}</label>
      <input
        value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-xl bg-stone-soft border border-border text-base font-bold text-foreground outline-none focus:ring-2 focus:ring-primary/30"
        {...rest}
      />
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
    <div className={`text-xs p-2.5 rounded-lg border flex items-start gap-2 font-bold ${abnormal ? "bg-destructive/5 border-destructive/30 text-destructive" : "bg-primary/5 border-primary/20"}`}>
      <TrendingUp className="size-4 mt-0.5 shrink-0" />
      <div className="flex-1">
        <div>مرجع السوق ({ref.count} عرض) — المتوسط {ref.avg.toLocaleString()}</div>
        {abnormal && (
          <div className="mt-0.5">
            ⚠ سعرك {diff > 0 ? "أعلى" : "أقل"} {Math.abs(diff).toFixed(0)}% — المقترح: <b>{Math.round(ref.avg).toLocaleString()}</b>
          </div>
        )}
      </div>
    </div>
  );
}

// Suggestions pool by item type
function suggestFor(product: Product): string[] {
  const pool: string[] = [];
  if (product.itemType === "service") {
    pool.push(...(CATALOG_ITEMS.g7 || []), ...(CATALOG_ITEMS.g12 || []), ...(CATALOG_ITEMS.g1 || []));
  } else {
    pool.push(...(CATALOG_ITEMS.s5 || []), ...(CATALOG_ITEMS.s1 || []), ...(CATALOG_ITEMS.g7 || []));
  }
  return Array.from(new Set(pool)).slice(0, 5);
}

function BarterBar({
  product, wantValue, onWantChange, onBarter,
}: {
  product: Product;
  wantValue: string;
  onWantChange: (v: string) => void;
  onBarter: () => void;
}) {
  const suggestions = useMemo(() => suggestFor(product), [product.itemType, product.category]);
  const canBarter = product.name.trim().length > 0 && wantValue.trim().length > 0;

  // Full catalog autocomplete pool — everything the user could want in exchange
  const allCatalog = useMemo(() => {
    const all = Object.values(CATALOG_ITEMS).flat();
    return Array.from(new Set(all)).sort();
  }, []);
  const listId = `barter-want-list-${product.familyId}`;

  return (
    <div className="rounded-xl border border-accent/30 bg-gradient-to-l from-accent/10 to-transparent p-3">
      <div className="flex items-center gap-2 mb-2">
        <ArrowLeftRight className="size-4 text-accent" aria-hidden="true" />
        <label htmlFor={`barter-want-${product.familyId}`} className="text-sm font-extrabold text-foreground">قايض بـ</label>
      </div>
      <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
        <input
          id={`barter-want-${product.familyId}`}
          type="text" value={wantValue}
          onChange={(e) => onWantChange(e.target.value)}
          placeholder="اكتب أو اختر ما تريده مقابل هذا العنصر..."
          list={listId}
          autoComplete="off"
          aria-label="ما تريد الحصول عليه بالمقايضة"
          className="flex-1 min-w-[160px] px-3 py-2.5 rounded-xl bg-card border border-border focus:border-accent text-base font-bold outline-none"
        />
        <datalist id={listId}>
          {allCatalog.map((n) => <option key={n} value={n} />)}
        </datalist>
        <button
          type="button" onClick={onBarter} disabled={!canBarter}
          aria-label="ابدأ المقايضة"
          className="px-5 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-extrabold flex items-center gap-1.5 hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ArrowLeftRight className="size-4" aria-hidden="true" /> قايض
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2.5">
        <span className="text-xs text-muted-foreground font-bold pt-1">اقتراحات:</span>
        {suggestions.map((s) => (
          <button
            key={s} type="button" onClick={() => onWantChange(s)}
            className="text-xs font-extrabold px-3 py-1 rounded-full bg-card border border-border hover:border-accent hover:bg-accent/5 transition"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
