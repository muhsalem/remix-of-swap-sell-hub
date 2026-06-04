import { useState, useEffect, useMemo, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { calculateBarter, type PricingResult, ITEM_TYPES } from "@/lib/pricing.functions";
import { getReferencePrice } from "@/lib/price-oracle.functions";
import { analyzeProductImage } from "@/lib/vision.functions";
import { searchPlatformItems, addWishlistAlert } from "@/lib/wishlist.functions";
import {
  Loader2, Sparkles, ShieldCheck, AlertTriangle, Ban,
  ChevronDown, Plus, X, TrendingUp, Zap, Coins, Package2, ArrowLeftRight,
  Camera, Wrench, Package, Info, ArrowLeft, Bell, Check,
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
  ageUnit: "days" | "months";
  marketPricePerUnit: number;
  currency: string;
  quality: number;
  scarcity: "abundant" | "normal" | "high" | "scarce";
  locationTier: "tier1" | "tier2" | "tier3" | "rural";
  riskLevel: "low" | "medium" | "high";
  deliveryDays: number;
  distanceKm: number;
  brandTier: "premium" | "standard" | "generic" | "unknown";
  seasonality: "peak" | "normal" | "off";
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
    ageUnit: "months",
    marketPricePerUnit: 0,
    currency,
    quality: 9,
    scarcity: "normal",
    locationTier: "tier1",
    riskLevel: "low",
    deliveryDays: 1,
    distanceKm: 0,
    brandTier: "unknown",
    seasonality: "normal",
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
      (p) => p.name.trim().length > 0 && p.marketPricePerUnit >= 0.01 && p.quantity > 0,
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

  const [wantValue, setWantValue] = useState("");
  const primaryItem = items[0];
  const triggerBarter = (have: string, want: string) => {
    if (!have.trim() || !want.trim()) return;
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("badel:match", { detail: { have, want } }));
      const el = document.getElementById("market-search");
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
              {/* DI framed card inside the value panel */}
              <div className="mt-3 flex items-center gap-3 p-3 rounded-2xl bg-white/15 backdrop-blur ring-1 ring-white/25">
                <div className="size-10 shrink-0 rounded-xl grid place-items-center bg-white/20 ring-1 ring-white/30">
                  <Coins className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-mono font-black text-2xl tabular-nums">
                      {result ? valueDI.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "0.00"}
                    </span>
                    <span className="text-sm font-extrabold opacity-90">DI</span>
                    <span className="text-[10px] opacity-75 font-bold">عملة بادل الرقمية</span>
                  </div>
                  <div className="text-[11px] font-bold opacity-80 mt-0.5">
                    سعر مرجعي: 1 DI = {DI_TO_SAR} ر.س · ≈ {(DI_TO_SAR * (FX_VS_SAR[country]?.perSAR ?? 1)).toLocaleString(undefined, { maximumFractionDigits: 3 })} {FX_VS_SAR[country]?.symbol}
                  </div>
                </div>
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

              {/* ===== Embedded Barter bar (inside value tab) ===== */}
              <div className="mt-4">
                <BarterBar
                  embedded
                  product={primaryItem}
                  wantValue={wantValue}
                  onWantChange={setWantValue}
                  onBarter={() => triggerBarter(primaryItem.name, wantValue)}
                  valueSAR={valueSAR}
                />
              </div>
            </div>
          </div>


          {/* DI link — full framed card */}
          <DiLinkCard />


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
  index, product, onUpdate, onRemove,
}: {
  index: number;
  product: Product;
  onUpdate: (p: Product) => void;
  onRemove?: () => void;
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
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground block mb-1 font-extrabold">
                  العمر
                </label>
                <div className="flex gap-1">
                  <input
                    type="number" min={0}
                    value={product.ageUnit === "days" ? Math.round(product.ageMonths * 30) : product.ageMonths}
                    onChange={(v) => {
                      const n = Number(v.target.value) || 0;
                      const months = product.ageUnit === "days" ? n / 30 : n;
                      onUpdate({ ...product, ageMonths: months });
                    }}
                    className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-card border border-border text-sm font-bold outline-none focus:border-primary"
                  />
                  <select
                    value={product.ageUnit}
                    onChange={(e) => onUpdate({ ...product, ageUnit: e.target.value as "days" | "months" })}
                    aria-label="وحدة العمر"
                    className="px-2 py-2 rounded-lg bg-card border border-border text-xs font-extrabold outline-none focus:border-primary"
                  >
                    <option value="days">يوم</option>
                    <option value="months">شهر</option>
                  </select>
                </div>
              </div>
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
              <LabeledSelect label="العلامة التجارية" value={product.brandTier}
                onChange={(v) => onUpdate({ ...product, brandTier: v as Product["brandTier"] })}>
                <option value="unknown">غير محدّد</option>
                <option value="premium">فاخرة (+20%)</option>
                <option value="standard">قياسية</option>
                <option value="generic">عامة (−10%)</option>
              </LabeledSelect>
              <LabeledSelect label="الموسمية" value={product.seasonality}
                onChange={(v) => onUpdate({ ...product, seasonality: v as Product["seasonality"] })}>
                <option value="peak">ذروة الطلب (+15%)</option>
                <option value="normal">طبيعي</option>
                <option value="off">خارج الموسم (−10%)</option>
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

      </div>
    </div>
  );
}

// (footer wrapper closed)

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
              className="px-4 py-2.5 rounded-xl bg-gradient-to-l from-primary to-primary/80 text-primary-foreground text-xs font-extrabold flex items-center gap-1.5 shadow-md hover:shadow-lg hover:from-primary/90 transition-all disabled:opacity-50 ring-1 ring-primary/30"
            >
              {m.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
              {m.isPending ? "يحلّل..." : preview ? "صورة أخرى" : "اختر/التقط صورة"}
            </button>
            {m.isSuccess && (
              <span className="text-[11px] font-extrabold text-emerald-600">✓ تم التحليل</span>
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
  product, wantValue, onWantChange, onBarter, valueSAR = 0, embedded = false,
}: {
  product: Product;
  wantValue: string;
  onWantChange: (v: string) => void;
  onBarter: () => void;
  valueSAR?: number;
  embedded?: boolean;
}) {
  const suggestions = useMemo(() => suggestFor(product), [product.itemType, product.category]);
  const canBarter = product.name.trim().length > 0 && wantValue.trim().length > 0;

  const allCatalog = useMemo(() => {
    const all = Object.values(CATALOG_ITEMS).flat();
    return Array.from(new Set(all)).sort();
  }, []);
  const listId = `barter-want-list-${product.familyId}`;

  // ── Platform-listing suggestions (debounced) ──
  const searchFn = useServerFn(searchPlatformItems);
  const alertFn = useServerFn(addWishlistAlert);
  const [platformItems, setPlatformItems] = useState<Array<{ id: string; title: string; category: string; market_price: number }>>([]);
  const [searching, setSearching] = useState(false);
  const [alertState, setAlertState] = useState<"idle" | "saving" | "saved" | "auth" | "error">("idle");

  useEffect(() => {
    const q = wantValue.trim();
    if (q.length < 2) { setPlatformItems([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await searchFn({ data: { q } });
        setPlatformItems(r.items);
      } catch { setPlatformItems([]); }
      finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [wantValue, searchFn]);

  const notifyMe = async () => {
    setAlertState("saving");
    try {
      await alertFn({ data: { searchTerm: wantValue.trim() } });
      setAlertState("saved");
    } catch (e: any) {
      const msg = String(e?.message || "");
      setAlertState(msg.toLowerCase().includes("unauth") ? "auth" : "error");
    }
  };

  const hasQuery = wantValue.trim().length >= 2;
  const noMatches = hasQuery && !searching && platformItems.length === 0;

  // ── Compatibility score vs best platform match ──
  const bestMatch = platformItems[0];
  const bestPrice = bestMatch ? Number(bestMatch.market_price) || 0 : 0;
  const priceDiff = bestPrice - valueSAR; // + = you owe, − = you gain
  const matchPct = (valueSAR > 0 && bestPrice > 0)
    ? Math.round(Math.max(0, 100 - (Math.abs(priceDiff) / Math.max(valueSAR, bestPrice)) * 100))
    : 0;
  const matchTone = matchPct >= 85 ? "emerald" : matchPct >= 65 ? "amber" : "rose";

  return (
    <div className={
      embedded
        ? "rounded-2xl bg-white/12 backdrop-blur ring-1 ring-white/20 p-4 text-primary-foreground"
        : "rounded-2xl border-2 border-accent/40 bg-gradient-to-bl from-accent/10 via-accent/5 to-transparent p-4 shadow-sm"
    }>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className={`size-8 rounded-xl grid place-items-center ${embedded ? "bg-white/15" : "bg-accent/15 text-accent"}`}>
            <ArrowLeftRight className="size-4" aria-hidden="true" />
          </div>
          <label htmlFor={`barter-want-${product.familyId}`} className={`text-sm font-extrabold ${embedded ? "" : "text-foreground"}`}>
            قايض «{product.name || "—"}» بـ
          </label>
        </div>
        {searching && <Loader2 className={`size-4 animate-spin ${embedded ? "opacity-80" : "text-muted-foreground"}`} />}
      </div>

      {/* ===== Compatibility panel ===== */}
      {bestMatch && valueSAR > 0 && (
        <div className={`mb-3 p-3 rounded-xl ${embedded ? "bg-white/10 ring-1 ring-white/20" : "bg-card border border-border"}`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex flex-col">
              <span className={`text-[10px] uppercase tracking-wider font-extrabold ${embedded ? "opacity-80" : "text-muted-foreground"}`}>نسبة التوافق</span>
              <span className={`font-display text-2xl font-black tabular-nums ${
                embedded ? "" :
                matchTone === "emerald" ? "text-emerald-600" :
                matchTone === "amber" ? "text-amber-600" : "text-rose-600"
              }`}>
                {matchPct}%
              </span>
            </div>
            <div className="flex flex-col text-end">
              <span className={`text-[10px] uppercase tracking-wider font-extrabold ${embedded ? "opacity-80" : "text-muted-foreground"}`}>فرق السعر</span>
              <span className="font-mono text-base font-extrabold tabular-nums">
                {priceDiff === 0 ? "متعادل" : (priceDiff > 0 ? `+${priceDiff.toLocaleString()}` : priceDiff.toLocaleString())}
                <span className={`text-[10px] mr-1 ${embedded ? "opacity-80" : "text-muted-foreground"}`}>ر.س</span>
              </span>
              <span className={`text-[10px] font-bold mt-0.5 ${embedded ? "opacity-80" : "text-muted-foreground"}`}>
                {priceDiff > 0 ? "تدفع فرقاً نقدياً" : priceDiff < 0 ? "تستلم فرقاً" : "مقايضة عادلة"}
              </span>
            </div>
          </div>
          <div className={`mt-2 h-2 rounded-full overflow-hidden ${embedded ? "bg-white/20" : "bg-muted"}`}>
            <div
              className={`h-full transition-all ${
                embedded ? "bg-white" :
                matchTone === "emerald" ? "bg-emerald-500" :
                matchTone === "amber" ? "bg-amber-500" : "bg-rose-500"
              }`}
              style={{ width: `${matchPct}%` }}
            />
          </div>

          {/* Smart auto-generated settlement options */}
          {(() => {
            const absDiff = Math.abs(priceDiff);
            const pctDiff = bestPrice > 0 ? (absDiff / bestPrice) * 100 : 0;
            const condFactor = CONDITION_TO_QUALITY[product.condition] / 10; // 0.4..1
            const condBonus = Math.round(absDiff * (1 - condFactor) * 0.5); // older = larger negotiation margin
            const fairBand = bestPrice * 0.05;
            const inFairBand = absDiff <= fairBand;
            const diEquiv = (absDiff / DI_TO_SAR).toFixed(2);

            type Opt = { tone: "ok" | "pay" | "gain" | "swap"; text: React.ReactNode };
            const opts: Opt[] = [];

            if (inFairBand) {
              opts.push({ tone: "ok", text: <>✅ <b>أتمم الصفقة كما هي</b> — الفرق ({absDiff.toLocaleString()} ر.س ≈ {pctDiff.toFixed(1)}%) ضمن هامش العدالة (≤5%).</> });
            }
            if (priceDiff > 0) {
              opts.push({ tone: "pay", text: <>💰 <b>طابق القيمة:</b> ادفع <b>{absDiff.toLocaleString()} ر.س</b> ({diEquiv} DI) نقداً للطرف الآخر.</> });
              if (condBonus > 50) {
                opts.push({ tone: "swap", text: <>📉 <b>تفاوض بسبب الحالة ({product.condition}):</b> اعرض خصماً قدره <b>{condBonus.toLocaleString()} ر.س</b> فقط بدل المبلغ الكامل.</> });
              }
              opts.push({ tone: "swap", text: <>➕ <b>أضف عنصراً تكميلياً</b> من جهتك بقيمة تقارب <b>{absDiff.toLocaleString()} ر.س</b> لإلغاء الفرق نقدياً.</> });
            } else if (priceDiff < 0) {
              opts.push({ tone: "gain", text: <>💵 <b>اطلب فرقاً لصالحك:</b> <b>{absDiff.toLocaleString()} ر.س</b> ({diEquiv} DI) نقداً أو كرصيد DI.</> });
              if (condBonus > 50) {
                opts.push({ tone: "swap", text: <>📈 <b>زيادة بسبب الحالة:</b> اطلب علاوة <b>+{condBonus.toLocaleString()} ر.س</b> أعلى من الفرق الأساسي لتعويض جودة سلعتك.</> });
              }
              opts.push({ tone: "swap", text: <>➕ <b>اطلب عنصراً مكمّلاً</b> من الطرف الآخر بقيمة قريبة من <b>{absDiff.toLocaleString()} ر.س</b>.</> });
            }

            if (opts.length === 0) return null;
            const toneCls = (t: Opt["tone"]) => embedded
              ? "bg-white/10 ring-1 ring-white/20"
              : t === "ok" ? "bg-emerald-50 ring-1 ring-emerald-200"
              : t === "pay" ? "bg-amber-50 ring-1 ring-amber-200"
              : t === "gain" ? "bg-sky-50 ring-1 ring-sky-200"
              : "bg-stone-soft ring-1 ring-border";

            return (
              <div className={`mt-3 pt-3 border-t ${embedded ? "border-white/20" : "border-border"}`}>
                <div className={`text-[11px] font-extrabold mb-2 ${embedded ? "opacity-90" : "text-muted-foreground"}`}>
                  💡 خيارات تسوية مقترحة تلقائياً (بناءً على السوق والحالة):
                </div>
                <ul className="space-y-1.5">
                  {opts.map((o, idx) => (
                    <li key={idx} className={`text-xs font-bold leading-relaxed px-2.5 py-1.5 rounded-lg ${toneCls(o.tone)}`}>
                      {o.text}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}
        </div>
      )}

      {/* Closest market equivalents (within ±15% of your value) */}
      {valueSAR > 0 && platformItems.length > 0 && (() => {
        const close = platformItems
          .map((it) => ({ ...it, diff: Math.abs((Number(it.market_price) || 0) - valueSAR) }))
          .filter((it) => valueSAR > 0 && it.diff / valueSAR <= 0.15)
          .sort((a, b) => a.diff - b.diff)
          .slice(0, 3);
        if (close.length === 0) return null;
        return (
          <div className={`mb-3 p-3 rounded-xl ${embedded ? "bg-white/10 ring-1 ring-white/20" : "bg-emerald-50 border border-emerald-200"}`}>
            <div className={`text-[11px] font-extrabold mb-2 ${embedded ? "opacity-90" : "text-emerald-700"}`}>
              🎯 أقرب ما يعادل قيمتك ({valueSAR.toLocaleString()} ر.س) في السوق:
            </div>
            <div className="space-y-1">
              {close.map((it) => (
                <Link
                  key={it.id} to="/listings/$id" params={{ id: it.id }}
                  className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg transition ${
                    embedded ? "bg-white/15 hover:bg-white/25" : "bg-white hover:bg-emerald-100/50"
                  }`}
                >
                  <span className="text-xs font-extrabold truncate flex-1">{it.title}</span>
                  <span className={`text-[11px] font-mono font-extrabold shrink-0 ${embedded ? "" : "text-emerald-700"}`}>
                    {Number(it.market_price).toLocaleString()} ر.س
                  </span>
                </Link>
              ))}
            </div>
          </div>
        );
      })()}


      <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
        <input
          id={`barter-want-${product.familyId}`}
          type="text" value={wantValue}
          onChange={(e) => onWantChange(e.target.value)}
          placeholder="اكتب أو اختر سلعة من المنصة..."
          list={listId}
          autoComplete="off"
          aria-label="ما تريد الحصول عليه بالمقايضة"
          className={`flex-1 min-w-[160px] px-3 py-2.5 rounded-xl text-base font-bold outline-none ${
            embedded
              ? "bg-white text-foreground border border-white placeholder:text-muted-foreground focus:ring-2 focus:ring-white/50"
              : "bg-card border border-border focus:border-accent"
          }`}
        />
        <datalist id={listId}>
          {allCatalog.map((n) => <option key={n} value={n} />)}
        </datalist>
        <button
          type="button" onClick={onBarter} disabled={!canBarter}
          aria-label="ابدأ المقايضة"
          className="px-5 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-500 text-white text-sm font-extrabold flex items-center gap-1.5 shadow-md hover:shadow-lg hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed ring-1 ring-amber-400/40"
        >
          <ArrowLeftRight className="size-4" aria-hidden="true" /> قايض
        </button>
      </div>

      {/* Platform matches */}
      {platformItems.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <div className={`text-xs font-extrabold ${embedded ? "opacity-90" : "text-muted-foreground"}`}>عروض مطابقة من المنصة:</div>
          <div className="space-y-1">
            {platformItems.slice(0, 4).map((it) => (
              <Link
                key={it.id} to="/listings/$id" params={{ id: it.id }}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg transition ${
                  embedded
                    ? "bg-white/15 ring-1 ring-white/20 hover:bg-white/25"
                    : "bg-card border border-border hover:border-accent hover:bg-accent/5"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-extrabold truncate">{it.title}</div>
                  <div className={`text-[11px] font-bold ${embedded ? "opacity-80" : "text-muted-foreground"}`}>{it.category}</div>
                </div>
                <span className={`shrink-0 text-xs font-mono font-extrabold ${embedded ? "" : "text-primary"}`}>
                  {Number(it.market_price).toLocaleString()} ر.س
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Not found — wishlist alert */}
      {noMatches && (
        <div className={`mt-3 px-3 py-2.5 rounded-xl border border-dashed ${
          embedded ? "bg-white/10 border-white/30" : "bg-stone-soft/70 border-border"
        }`}>
          <div className={`text-xs font-bold mb-2 ${embedded ? "opacity-95" : "text-muted-foreground"}`}>
            لم نجد «{wantValue.trim()}» في المنصة حالياً. سجّل اهتمامك وسننبهك عند توفّره.
          </div>
          {alertState === "saved" ? (
            <div className={`text-xs font-extrabold flex items-center gap-1 ${embedded ? "" : "text-emerald-600"}`}>
              <Check className="size-3.5" /> تم — ستصلك إشعار عند توفّره
            </div>
          ) : alertState === "auth" ? (
            <Link to="/auth" className={`text-xs font-extrabold underline ${embedded ? "" : "text-primary"}`}>
              سجّل الدخول لتفعيل التنبيه
            </Link>
          ) : (
            <button
              type="button" onClick={notifyMe} disabled={alertState === "saving"}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold inline-flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50 ${
                embedded ? "bg-white text-primary" : "bg-primary text-primary-foreground"
              }`}
            >
              {alertState === "saving" ? <Loader2 className="size-3.5 animate-spin" /> : <Bell className="size-3.5" />}
              نبّهني عند توفّره
            </button>
          )}
          {alertState === "error" && (
            <div className={`mt-1 text-[11px] font-bold ${embedded ? "" : "text-destructive"}`}>تعذّر الحفظ، حاول لاحقاً.</div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 mt-3 items-center">
        <span className={`text-xs font-extrabold pt-1 ${embedded ? "opacity-90" : "text-muted-foreground"}`}>اقتراحات:</span>
        {suggestions.map((s) => (
          <button
            key={s} type="button" onClick={() => onWantChange(s)}
            className={`text-xs font-extrabold px-3 py-1 rounded-full transition ${
              embedded
                ? "bg-white text-foreground hover:bg-white/90 ring-1 ring-white/40"
                : "bg-card border border-border hover:border-accent hover:bg-accent/5"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

