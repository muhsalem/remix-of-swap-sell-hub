import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { calculateBarter, type PricingResult } from "@/lib/pricing.functions";
import { Loader2, Sparkles, ArrowLeftRight, ShieldCheck, AlertTriangle, Ban, Scale } from "lucide-react";
import phoneImg from "@/assets/product-phone.jpg";
import headphonesImg from "@/assets/product-headphones.jpg";

type Product = {
  name: string;
  category: string;
  condition: "new" | "like-new" | "excellent" | "good" | "fair";
  ageMonths: number;
  marketPrice: number;
};

const CONDITIONS = [
  { value: "new", label: "جديد" },
  { value: "like-new", label: "كالجديد" },
  { value: "excellent", label: "ممتاز" },
  { value: "good", label: "جيد" },
  { value: "fair", label: "مقبول" },
] as const;

const CATEGORIES = ["إلكترونيات", "هواتف", "أجهزة لوحية", "حواسيب", "صوتيات", "كاميرات", "ساعات", "مجوهرات", "وسائل تنقل", "أثاث", "كتب", "ملابس", "أخرى"];

export function PricingEngine() {
  const [productA, setProductA] = useState<Product>({
    name: "iPhone 14 Pro",
    category: "إلكترونيات",
    condition: "excellent",
    ageMonths: 12,
    marketPrice: 4200,
  });
  const [productB, setProductB] = useState<Product>({
    name: "سماعات Sony WH-1000XM5",
    category: "صوتيات",
    condition: "like-new",
    ageMonths: 6,
    marketPrice: 1850,
  });
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
                <Sparkles className="size-3" /> AI Engine v2.4
              </span>
              <span className="size-2 bg-primary rounded-full animate-pulse" />
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight text-balance leading-[1.15]">
              محرك التسعير الذكي للمقايضة العادلة
            </h1>
            <p className="text-muted-foreground mt-3 text-sm">
              أدخل بيانات منتجين وسيُحلّل الذكاء الاصطناعي مدى عدالة الصفقة ويقترح موازنتها.
            </p>
          </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-12">
        <ProductCard label="منتجك المعروض" letter="أ" img={phoneImg} product={productA} setProduct={setProductA} computed={result?.valueA} />

        <div className="lg:col-span-4 p-8 bg-stone-soft border-y lg:border-y-0 lg:border-x border-border flex flex-col items-center justify-center text-center">
          <div className="animate-balance mb-8 relative" key={fairness}>
            <div className="size-48 rounded-full border-[12px] border-card shadow-xl flex flex-col items-center justify-center bg-card relative z-10">
              <span className={`text-5xl font-display font-extrabold ${fairnessColor}`}>
                {result ? `${fairness}%` : "—"}
              </span>
              <span className="text-[10px] uppercase font-bold text-muted-foreground mt-1 tracking-widest">
                معدل التوافق
              </span>
            </div>
            <div className="absolute -inset-4 border-2 border-dashed border-primary/20 rounded-full animate-[spin_20s_linear_infinite]" />
          </div>

          <div className="space-y-4 w-full">
            <div className="p-4 bg-card rounded-2xl border border-border shadow-sm">
              <p className="text-xs text-muted-foreground mb-2">تحليل الفجوة السعرية</p>
              {result ? (
                <div className="flex items-center justify-center gap-2">
                  <span className="text-accent font-bold font-display text-xl">
                    {result.gap === 0 ? "متوازن" : `${Math.abs(result.gap).toLocaleString()} ر.س`}
                  </span>
                  {result.inFavorOf !== "balanced" && (
                    <span className="text-sm">لصالح {result.inFavorOf === "A" ? "(أ)" : "(ب)"}</span>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">اضغط حلّل المقايضة</p>
              )}
            </div>
            <div className="p-4 bg-primary text-primary-foreground rounded-2xl shadow-lg shadow-primary/20 text-right">
              <p className="text-sm font-bold mb-1">توصية الذكاء الاصطناعي</p>
              <p className="text-xs opacity-90 leading-relaxed">
                {result?.recommendation ?? "أدخل بيانات المنتجين ثم اضغط الزر لتحليل عدالة المقايضة."}
              </p>
              {result?.rationale && (
                <p className="text-[11px] opacity-70 mt-2 border-t border-primary-foreground/20 pt-2">
                  {result.rationale}
                </p>
              )}
            </div>
          </div>
        </div>

        <ProductCard label="المنتج المقابل" letter="ب" img={headphonesImg} product={productB} setProduct={setProductB} computed={result?.valueB} />
      </div>
    </section>
  );
}

function ProductCard({
  label,
  letter,
  img,
  product,
  setProduct,
  computed,
}: {
  label: string;
  letter: string;
  img: string;
  product: Product;
  setProduct: (p: Product) => void;
  computed?: number;
}) {
  return (
    <div className="lg:col-span-4 p-8 bg-card">
      <div className="space-y-5">
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <div className="size-10 rounded-xl bg-stone-soft grid place-items-center font-display font-bold">
            {letter}
          </div>
          <h3 className="font-bold">{label}</h3>
        </div>

        <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-stone-soft">
          <img src={img} alt={product.name} className="w-full h-full object-cover" loading="lazy" width={512} height={384} />
        </div>

        <Field label="اسم المنتج">
          <input
            type="text"
            value={product.name}
            onChange={(e) => setProduct({ ...product, name: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl bg-stone-soft border border-border text-sm focus:ring-2 ring-primary/30 outline-none"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="الفئة">
            <select
              value={product.category}
              onChange={(e) => setProduct({ ...product, category: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl bg-stone-soft border border-border text-sm outline-none"
            >
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="الحالة">
            <select
              value={product.condition}
              onChange={(e) => setProduct({ ...product, condition: e.target.value as Product["condition"] })}
              className="w-full px-3 py-2.5 rounded-xl bg-stone-soft border border-border text-sm outline-none"
            >
              {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="العمر (شهر)">
            <input
              type="number"
              min={0}
              value={product.ageMonths}
              onChange={(e) => setProduct({ ...product, ageMonths: Number(e.target.value) || 0 })}
              className="w-full px-3 py-2.5 rounded-xl bg-stone-soft border border-border text-sm outline-none"
            />
          </Field>
          <Field label="السعر السوقي (ر.س)">
            <input
              type="number"
              min={1}
              value={product.marketPrice}
              onChange={(e) => setProduct({ ...product, marketPrice: Number(e.target.value) || 0 })}
              className="w-full px-3 py-2.5 rounded-xl bg-stone-soft border border-border text-sm outline-none"
            />
          </Field>
        </div>

        <div className="flex justify-between items-center px-4 py-4 bg-primary/5 rounded-2xl border border-primary/10">
          <span className="text-sm text-muted-foreground">القيمة المقدّرة</span>
          <span className="font-mono font-bold text-lg text-primary">
            {computed ? `${computed.toLocaleString()} ر.س` : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1.5 font-bold">
        {label}
      </label>
      {children}
    </div>
  );
}
