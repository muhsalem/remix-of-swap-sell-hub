import { Fragment, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Camera, Loader2, Scale, Globe2, X, Lightbulb, Search } from "lucide-react";
import {
  CATEGORIES, COUNTRIES, COUNTRY_CODES, INVENTORY, MULTIPLIERS, TAX_BY_COUNTRY,
  catLabel, subLabel, clamp, fmtLocal, fmtUSD, getCountryPrice, compareCountries,
  checkSharia, solveCompatibility, valueGood, valueService, inventoryLiquidity, proximityScore,
} from "@/lib/barter-engine";


import { analyzeProductImage } from "@/lib/vision.functions";

const GOOD_CATS = Object.keys(CATEGORIES).filter((k) => !CATEGORIES[k].isService);
const SERVICE_CATS = Object.keys(CATEGORIES).filter((k) => CATEGORIES[k].isService);
const ALL_CATS = Object.keys(CATEGORIES);
const SUB_COUNT = ALL_CATS.reduce((n, c) => n + Object.keys(CATEGORIES[c].subcategories).length, 0);

function Select({ value, onChange, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      value={value}
      onChange={onChange}
      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/40"
      {...rest}
    >
      {children}
    </select>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex-1 min-w-0">
      <label className="mb-1.5 block text-[0.72rem] font-bold text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
function NumInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="number"
      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold text-foreground tabular-nums outline-none focus:ring-2 focus:ring-primary/40"
      {...props}
    />
  );
}
function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="text"
      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/40"
      {...props}
    />
  );
}
function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 md:p-5 shadow-sm">
      <header className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-sm font-extrabold text-foreground">{title}</h3>
        {icon}
      </header>
      {children}
    </section>
  );
}

export function BarterPricingEngine({ embedded = false }: { embedded?: boolean }) {
  // ── الحالة العامة ──
  const [country, setCountry] = useState("EG");
  const [compareA, setCompareA] = useState("EG");
  const [compareB, setCompareB] = useState("SA");
  const [showTips, setShowTips] = useState(true);
  const [activeType, setActiveType] = useState<"good" | "service">("good");
  const [settlement, setSettlement] = useState<"cash" | "credits">("cash");

  // ── نموذج السلع ──
  const [goodTitle, setGoodTitle] = useState("iPhone 14 Pro Max");
  const [goodCat, setGoodCat] = useState("electronics");
  const [goodSub, setGoodSub] = useState("laptops");
  const [goodBase, setGoodBase] = useState(1200);
  const [goodAge, setGoodAge] = useState(2);
  const [goodCondition, setGoodCondition] = useState("like_new");
  const [goodDemand, setGoodDemand] = useState("normal");

  // ── نموذج الخدمات ──
  const [svcTitle, setSvcTitle] = useState("Web Development");
  const [svcCat, setSvcCat] = useState("services");
  const [svcSub, setSvcSub] = useState("development");
  const [svcRate, setSvcRate] = useState(50);
  const [svcHours, setSvcHours] = useState(12);
  const [svcComplexity, setSvcComplexity] = useState("medium");
  const [svcExperience, setSvcExperience] = useState("mid");

  const [desiredCategory, setDesiredCategory] = useState("");
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filterCat, setFilterCat] = useState("");

  // ── ماسح الصور بالذكاء الاصطناعي ──
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const analyze = useServerFn(analyzeProductImage);
  const aiMut = useMutation({
    mutationFn: (imageBase64: string) => analyze({ data: { imageBase64 } }),
    onSuccess: (r) => {
      setActiveType(r.itemType === "service" ? "service" : "good");
      if (r.itemType === "service") setSvcTitle(r.name);
      else {
        setGoodTitle(r.name);
        setGoodBase(Math.max(0, Math.round((r.marketPriceSAR || 0) / 3.75)));
        setGoodAge(Math.round(((r.estimatedAgeMonths || 0) / 12) * 2) / 2);
        const map: Record<string, string> = {
          "new": "new", "like-new": "like_new", excellent: "excellent", good: "good", fair: "fair",
        };
        setGoodCondition(map[r.condition] ?? "good");
      }
      setAiNote(`تم التعرف: ${r.name} · ${r.category}`);
    },
    onError: (e: Error) => setAiNote(e.message),
  });

  function onFile(f: File | undefined) {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      setPreview(url);
      setAiNote(null);
      aiMut.mutate(url.split(",")[1] ?? "");
    };
    reader.readAsDataURL(f);
  }

  // ── التقييم ──
  const valuation = useMemo(() => {
    if (activeType === "good") {
      const sub = CATEGORIES[goodCat]?.subcategories?.[goodSub];
      const v = valueGood({
        basePrice: clamp(goodBase, 0, 10_000_000),
        ageYears: clamp(goodAge, 0, 100),
        deprRate: sub?.deprRate ?? 0.1,
        conditionKey: goodCondition,
        demandKey: goodDemand,
        inflationRate: COUNTRIES[country]?.inflationRate ?? 0.03,
      });
      return {
        usd: v.finalValue,
        categoryKey: goodCat,
        subcategory: goodSub,
        liquidity: sub?.liquidity ?? 0.6,
        name: goodTitle.trim() || subLabel(goodCat, goodSub),
        categoryLabel: `${catLabel(goodCat)} ➔ ${subLabel(goodCat, goodSub)}`,
        detail: `الأساس: ${fmtUSD(v.inflationAdjustedBase)} · الحالة: ${v.conditionFactor}x · الطلب: ${v.demandFactor}x`,
        deprModel: v.deprModel,
      };
    }
    const sub = CATEGORIES[svcCat]?.subcategories?.[svcSub];
    const v = valueService({
      hourlyRate: clamp(svcRate, 0, 1000),
      hours: clamp(svcHours, 0, 10_000),
      complexityKey: svcComplexity,
      experienceKey: svcExperience,
    });
    return {
      usd: v.finalValue,
      categoryKey: svcCat,
      subcategory: svcSub,
      liquidity: sub?.liquidity ?? 0.5,
      name: svcTitle.trim() || subLabel(svcCat, svcSub),
      categoryLabel: `${catLabel(svcCat)} ➔ ${subLabel(svcCat, svcSub)}`,
      detail: `الأساس: ${fmtUSD(v.baseCost)} · التعقيد: ${v.complexityFactor}x · الخبرة: ${v.experienceFactor}x`,
      deprModel: "declining_balance" as const,
    };
  }, [activeType, goodCat, goodSub, goodBase, goodAge, goodCondition, goodDemand, goodTitle,
      svcCat, svcSub, svcRate, svcHours, svcComplexity, svcExperience, svcTitle, country]);

  const cp = getCountryPrice(valuation.usd, country, valuation.categoryKey);
  const tax = TAX_BY_COUNTRY[country] ?? { vat: 0, fee: 0.03, auth: "—" };
  const feeLocal = cp.local * tax.fee;
  const vatLocal = feeLocal * tax.vat;
  const totalWithVat = cp.local + feeLocal + vatLocal;

  const modelLabel =
    valuation.deprModel === "appreciation" ? "📈 ارتفاع القيمة"
      : valuation.deprModel === "rapid_decay" ? "📉⚡ تلف سريع" : "📉 إهلاك";
  const dutyText = cp.dutyFactor > 1 ? ` · رسوم ${Math.round((cp.dutyFactor - 1) * 100)}%` : "";

  // ── مقارنة الدول ──
  const cmp = compareCountries(valuation.usd, compareA, compareB, valuation.categoryKey);
  const absDiff = Math.abs(cmp.diffPct);
  const betterCode = cmp.betterDeal === "equal" ? null : cmp.betterDeal;
  const worseCode = betterCode ? (betterCode === compareA ? compareB : compareA) : null;

  // ── المطابقة ──
  const target = INVENTORY.find((i) => i.id === selectedTargetId) ?? null;
  // المقارنة بين البلدان تظهر فقط عندما تكون السلعة/الخدمة المعروضة من بلد آخر
  const crossBorder = !!target && target.countryCode !== country;

  const userAsset = {
    type: activeType,
    name: valuation.name,
    category: valuation.categoryKey,
    subcategory: valuation.subcategory,
    value: cp.usd,
    liquidity: valuation.liquidity,
    desiredCategory: desiredCategory || undefined,
    countryCode: country,
  } as const;

  const match = target
    ? solveCompatibility(userAsset, {
        type: target.type,
        name: target.nameAr,
        nameEn: target.nameEn,
        nameAr: target.nameAr,
        category: target.category,
        subcategory: target.subcategory,
        value: target.value,
        liquidity: inventoryLiquidity(target),
        desiredCategory: target.desiredCategory,
        countryCode: target.countryCode,
      })
    : null;

  const sharia = target
    ? checkSharia(
        { type: userAsset.type, subcategory: userAsset.subcategory, value: userAsset.value },
        { type: target.type, subcategory: target.subcategory, value: target.value },
      )
    : null;

  const rate = COUNTRIES[country]?.exchangeRate ?? 1;
  const score = match?.totalScore ?? 0;
  const gaugeColor = score >= 70 ? "hsl(145 80% 40%)" : score >= 45 ? "hsl(45 90% 45%)" : "hsl(355 80% 55%)";

  const liqLabel = (l: number) => (l >= 0.8 ? "مرتفع" : l < 0.55 ? "منخفض" : "متوسط");

  // ── المخزون ──
  // ── المخزون: فلترة + ترتيب ذكي (القرب الجغرافي ثم درجة التوافق) ──
  const PROX_LABELS: Record<number, string> = {
    0: "📍 نفس البلد",
    1: "🌐 نفس المنطقة",
    2: "🌍 منطقة قريبة",
    3: "✈️ دولي",
  };

  const inventory = INVENTORY.filter((i) => {
    const q = query.trim().toLowerCase();
    const okQ = !q || i.nameAr.toLowerCase().includes(q) || i.nameEn.toLowerCase().includes(q);
    const okC = !filterCat || i.category === filterCat;
    return okQ && okC;
  })
    .map((item) => {
      const comp = solveCompatibility(userAsset, {
        type: item.type,
        name: item.nameAr,
        nameEn: item.nameEn,
        nameAr: item.nameAr,
        category: item.category,
        subcategory: item.subcategory,
        value: item.value,
        liquidity: inventoryLiquidity(item),
        desiredCategory: item.desiredCategory,
        countryCode: item.countryCode,
      });
      return { item, score: comp.totalScore, shippingFee: comp.shippingFee, prox: proximityScore(country, item.countryCode) };
    })
    .sort((a, b) => (a.prox !== b.prox ? a.prox - b.prox : b.score - a.score));

  // ── اقتراحات قريبة من قيمة التقييم (±25%، أقرب 3) ──
  const suggestions = INVENTORY
    .filter((l) => cp.usd > 0 && l.value >= cp.usd * 0.75 && l.value <= cp.usd * 1.25)
    .sort((a, b) => Math.abs(a.value - cp.usd) - Math.abs(b.value - cp.usd))
    .slice(0, 3);


  return (
    <div dir="rtl" className={embedded ? "space-y-4" : "space-y-4 p-4 md:p-6"}>
      {/* شريط الإحصائيات */}
      <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-card p-4 md:grid-cols-4">
        {[
          { n: String(COUNTRY_CODES.length), l: "سوق الإطلاق (مصر · السعودية)" },
          { n: String(ALL_CATS.length), l: "تصنيف" },
          { n: `+${SUB_COUNT}`, l: "تصنيف فرعي" },
          { n: "✅", l: "متوافق شرعياً" },
        ].map((s) => (
          <div key={s.l} className="text-center">
            <div className="text-xl font-extrabold text-primary">{s.n}</div>
            <div className="text-[0.7rem] font-semibold text-muted-foreground">{s.l}</div>
          </div>
        ))}
      </div>

      {/* بانر الشرح */}
      {showTips && (
        <div className="flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <Lightbulb className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div className="flex-1">
            <strong className="block text-sm font-extrabold text-primary">كيف يعمل المحرك؟</strong>
            <p className="mt-1 text-xs text-muted-foreground">
              1. اختر نوع السلعة أو الخدمة ← 2. حدد التفاصيل ← 3. قارن الأسعار بين البلدان ← 4. اعثر على مقايضات متوافقة
            </p>
          </div>
          <button onClick={() => setShowTips(false)} aria-label="إغلاق" className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* ══ مختبر التقييم ══ */}
        <Card title="مختبر التقييم" icon={<Scale className="size-4 text-primary" aria-hidden />}>
          {/* ماسح المنتجات */}
          <div className="mb-4">
            <div className="mb-2 text-xs font-extrabold text-primary">🤖 ماسح المنتجات بالذكاء الاصطناعي</div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center transition hover:border-primary/60"
            >
              {aiMut.isPending ? (
                <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
              ) : preview ? (
                <img src={preview} alt="معاينة المنتج" className="mx-auto max-h-28 rounded-lg object-contain" />
              ) : (
                <Camera className="size-6 text-muted-foreground" aria-hidden />
              )}
              <span className="text-xs font-bold text-foreground">اسحب صورة المنتج هنا أو اضغط لرفعها</span>
              <span className="text-[0.68rem] text-muted-foreground">الذكاء الاصطناعي سيكتشف التصنيف والسعر تلقائياً</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            {aiNote && <p className="mt-2 text-[0.7rem] font-semibold text-muted-foreground">{aiNote}</p>}
          </div>

          {/* التبديل بين سلعة/خدمة */}
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            {(["good", "service"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveType(t)}
                className={`rounded-lg px-3 py-2 text-xs font-extrabold transition ${
                  activeType === t ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
                }`}
              >
                {t === "good" ? "سلعة (Good)" : "خدمة (Service)"}
              </button>
            ))}
          </div>

          {activeType === "good" ? (
            <div className="space-y-3">
              <Field label="اسم المنتج / الموديل">
                <TextInput value={goodTitle} onChange={(e) => setGoodTitle(e.target.value)} />
              </Field>
              <div className="flex gap-3">
                <Field label="التصنيف">
                  <Select
                    value={goodCat}
                    onChange={(e) => {
                      const c = e.target.value;
                      setGoodCat(c);
                      setGoodSub(Object.keys(CATEGORIES[c].subcategories)[0]);
                    }}
                  >
                    {GOOD_CATS.map((c) => (
                      <option key={c} value={c}>{CATEGORIES[c].icon} {CATEGORIES[c].labelAr}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="التصنيف الفرعي">
                  <Select value={goodSub} onChange={(e) => setGoodSub(e.target.value)}>
                    {Object.keys(CATEGORIES[goodCat].subcategories).map((s) => (
                      <option key={s} value={s}>{CATEGORIES[goodCat].subcategories[s].labelAr}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="flex gap-3">
                <Field label="السعر الأصلي ($)">
                  <NumInput value={goodBase} min={0} step={10} onChange={(e) => setGoodBase(Number(e.target.value))} />
                </Field>
                <Field label="العمر (سنوات)">
                  <NumInput value={goodAge} min={0} step={0.5} onChange={(e) => setGoodAge(Number(e.target.value))} />
                </Field>
              </div>
              <div className="flex gap-3">
                <Field label="حالة السلعة">
                  <Select value={goodCondition} onChange={(e) => setGoodCondition(e.target.value)}>
                    {Object.entries(MULTIPLIERS.condition).map(([k, v]) => (
                      <option key={k} value={k}>{v.labelAr}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="مستوى الطلب">
                  <Select value={goodDemand} onChange={(e) => setGoodDemand(e.target.value)}>
                    {Object.entries(MULTIPLIERS.demand).map(([k, v]) => (
                      <option key={k} value={k}>{v.labelAr}</option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Field label="اسم الخدمة / التخصص">
                <TextInput value={svcTitle} onChange={(e) => setSvcTitle(e.target.value)} />
              </Field>
              <div className="flex gap-3">
                <Field label="مجال الخدمة">
                  <Select
                    value={svcCat}
                    onChange={(e) => {
                      const c = e.target.value;
                      setSvcCat(c);
                      setSvcSub(Object.keys(CATEGORIES[c].subcategories)[0]);
                    }}
                  >
                    {SERVICE_CATS.map((c) => (
                      <option key={c} value={c}>{CATEGORIES[c].icon} {CATEGORIES[c].labelAr}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="نوع الخدمة">
                  <Select value={svcSub} onChange={(e) => setSvcSub(e.target.value)}>
                    {Object.keys(CATEGORIES[svcCat].subcategories).map((s) => (
                      <option key={s} value={s}>{CATEGORIES[svcCat].subcategories[s].labelAr}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="flex gap-3">
                <Field label="سعر الساعة ($)">
                  <NumInput value={svcRate} min={0} step={5} onChange={(e) => setSvcRate(Number(e.target.value))} />
                </Field>
                <Field label="الساعات التقديرية">
                  <NumInput value={svcHours} min={1} step={1} onChange={(e) => setSvcHours(Number(e.target.value))} />
                </Field>
              </div>
              <div className="flex gap-3">
                <Field label="مستوى التعقيد">
                  <Select value={svcComplexity} onChange={(e) => setSvcComplexity(e.target.value)}>
                    {Object.entries(MULTIPLIERS.complexity).map(([k, v]) => (
                      <option key={k} value={k}>{v.labelAr}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="مستوى الخبرة">
                  <Select value={svcExperience} onChange={(e) => setSvcExperience(e.target.value)}>
                    {Object.entries(MULTIPLIERS.experience).map(([k, v]) => (
                      <option key={k} value={k}>{v.labelAr}</option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>
          )}

          <div className="mt-4 border-t border-dashed border-border pt-4">
            <Field label="التصنيف المرغوب للمقايضة">
              <Select value={desiredCategory} onChange={(e) => setDesiredCategory(e.target.value)}>
                <option value="">أي تصنيف</option>
                {ALL_CATS.map((c) => (
                  <option key={c} value={c}>{CATEGORIES[c].icon} {CATEGORIES[c].labelAr}</option>
                ))}
              </Select>
            </Field>
          </div>

          {/* نتيجة التقييم */}
          <div className="mt-4 rounded-2xl border border-border bg-muted/40 p-4 text-center">
            <div className="text-2xl">{COUNTRIES[country]?.flag}</div>
            <div className="mt-1 text-2xl font-extrabold tabular-nums text-primary">{fmtLocal(cp.local, country)}</div>
            <div className="text-xs font-semibold text-muted-foreground">≈ {fmtUSD(cp.usd)}</div>
            <div className="mt-2 inline-block rounded-full bg-card px-3 py-1 text-[0.7rem] font-bold text-foreground">
              {modelLabel}{dutyText}
            </div>
            <p className="mt-2 text-[0.7rem] leading-relaxed text-muted-foreground">
              {valuation.detail}
              {tax.vat > 0
                ? ` · العمولة ${Math.round(tax.fee * 100)}% + VAT ${Math.round(tax.vat * 100)}% (${tax.auth}) = ${fmtLocal(totalWithVat, country)}`
                : ` · العمولة ${Math.round(tax.fee * 100)}% (بدون VAT) = ${fmtLocal(cp.local + feeLocal, country)}`}
            </p>
            <div className="mt-3">
              <Select value={country} onChange={(e) => setCountry(e.target.value)} aria-label="بلدك">
                {COUNTRY_CODES.map((c) => (
                  <option key={c} value={c}>{COUNTRIES[c].flag} {COUNTRIES[c].nameAr} ({COUNTRIES[c].currency})</option>
                ))}
              </Select>
            </div>
          </div>

          {/* اقتراحات مقايضة قريبة من قيمتك */}
          {suggestions.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-xs font-extrabold text-foreground">⇄ عروض قريبة من قيمتك</div>
              <div className="space-y-2">
                {suggestions.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setSelectedTargetId(l.id)}
                    className={`flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-right transition hover:border-primary/60 ${
                      selectedTargetId === l.id ? "border-primary bg-primary/5" : "border-border bg-background"
                    }`}
                  >
                    <span className="text-lg">📦</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold text-foreground">{l.nameAr}</span>
                      <span className="block truncate text-[0.68rem] text-muted-foreground">
                        {catLabel(l.category)} · <b>{fmtLocal(getCountryPrice(l.value, country, l.category).local, country)}</b>
                      </span>
                    </span>
                    <span className="text-sm font-extrabold text-primary">⇄</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>


        {/* ══ العمود الأيسر ══ */}
        <div className="space-y-4">

          {/* مختبر توافق المقايضات */}
          <Card
            title="مختبر توافق المقايضات"
            icon={
              match ? (
                <span
                  className={`rounded-full px-2.5 py-1 text-[0.68rem] font-extrabold ${
                    match.feasibility === "high"
                      ? "bg-emerald-500/10 text-emerald-600"
                      : match.feasibility === "moderate"
                        ? "bg-amber-500/10 text-amber-600"
                        : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {match.feasibility === "high" ? "جدوى مرتفعة" : match.feasibility === "moderate" ? "جدوى متوسطة" : "جدوى منخفضة"}
                </span>
              ) : undefined
            }
          >
            <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
              <div className="rounded-2xl border border-primary/40 bg-primary/5 p-3 text-center">
                <div className="text-[0.65rem] font-extrabold text-primary">عرضك</div>
                <div className="mt-1 truncate text-sm font-bold text-foreground">{valuation.name}</div>
                <div className="truncate text-[0.68rem] text-muted-foreground">{valuation.categoryLabel}</div>
                <div className="mt-1 text-sm font-extrabold tabular-nums text-foreground">{fmtLocal(cp.local, country)}</div>
                <div className="text-[0.65rem] text-muted-foreground">
                  السيولة: {liqLabel(valuation.liquidity)} ({Math.round(valuation.liquidity * 100)}%)
                </div>
              </div>

              <div className="mx-auto grid size-24 place-items-center rounded-full"
                style={{
                  background: `radial-gradient(closest-side, var(--card, #fff) 80%, transparent 81%), conic-gradient(${gaugeColor} 0% ${score}%, color-mix(in oklab, currentColor 12%, transparent) ${score}% 100%)`,
                }}
              >
                <div className="text-center">
                  <div className="text-base font-extrabold text-foreground">{match ? `${score}%` : "—"}</div>
                  <div className="text-[0.6rem] text-muted-foreground">توافق</div>
                </div>
              </div>

              <div className={`rounded-2xl border p-3 text-center ${target ? "border-primary/40 bg-primary/5" : "border-border bg-muted/30"}`}>
                <div className="text-[0.65rem] font-extrabold text-muted-foreground">العرض المقابل</div>
                <div className="mt-1 truncate text-sm font-bold text-foreground">{target ? target.nameAr : "لم يتم الاختيار"}</div>
                <div className="truncate text-[0.68rem] text-muted-foreground">
                  {target ? `${catLabel(target.category)} ➔ ${subLabel(target.category, target.subcategory)}` : "اختر من القائمة بالأسفل"}
                </div>
                <div className="mt-1 text-sm font-extrabold tabular-nums text-foreground">
                  {target ? fmtLocal(target.value * rate, country) : fmtUSD(0)}
                </div>
                {target && (
                  <div className="text-[0.65rem] text-muted-foreground">
                    السيولة: {liqLabel(inventoryLiquidity(target))} ({Math.round(inventoryLiquidity(target) * 100)}%)
                  </div>
                )}
              </div>
            </div>

            {/* تحليلات */}
            <div className="mt-4 rounded-2xl border border-border bg-muted/30 p-4">
              <div className="mb-2 text-xs font-extrabold text-foreground">تحليلات المقايضة</div>
              {!match || !target ? (
                <p className="text-xs text-muted-foreground">اختر عنصراً من القائمة لتحليل التوافق.</p>
              ) : (
                <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
                  {match.isIdenticalModel && (
                    <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2 font-bold text-emerald-600">
                      ⇄ مقايضة منتج متطابق: كلا العرضين من نفس الموديل — تم ضبط توافق القيمة إلى 100%.
                    </div>
                  )}
                  <div>
                    {score >= 75
                      ? `توافق مرتفع (${score}%) — سيولة ${match.velocity} ومقايضة قابلة للتنفيذ سريعاً.`
                      : score >= 45
                        ? `توافق متوسط (${score}%) — سيولة ${match.velocity}، قد تحتاج تسوية فارق.`
                        : `توافق منخفض (${score}%) — سيولة ${match.velocity}، يُفضّل البحث عن عرض أقرب في القيمة.`}
                  </div>
                  <div>
                    {match.cashOffset === 0
                      ? "المقايضة متعادلة القيمة — لا حاجة لتعويض نقدي."
                      : settlement === "credits"
                        ? `يجب على ${match.offsetPayer === "A" ? "أنت (الطرف أ)" : "المقايض (ب)"} تحويل ${Math.round(match.cashOffset).toLocaleString("en-US")} نقطة ائتمانية لتسوية الفارق.`
                        : `يجب على ${match.offsetPayer === "A" ? "أنت (الطرف أ)" : "المقايض (ب)"} دفع تعويض ${fmtLocal(match.cashOffset * rate, country)} لتسوية فارق المقايضة.`}
                  </div>
                  {userAsset.countryCode !== target.countryCode && (
                    <div className="text-amber-600">
                      ✈️ مقايضة دولية: تتطلب الشحن من {COUNTRIES[target.countryCode].nameAr}. تُطبق الرسوم الجمركية وتكاليف النقل.
                    </div>
                  )}
                  <div>
                    {match.categoryMatchA && match.categoryMatchB
                      ? "✅ تطابق كامل في التصنيفات المرغوبة."
                      : match.categoryMatchA || match.categoryMatchB
                        ? "◐ تطابق جزئي في التصنيفات المرغوبة."
                        : "لا يوجد تطابق في التصنيفات المرغوبة."}
                  </div>
                </div>
              )}

              {/* التوافق الشرعي */}
              {sharia && (
                <div className="mt-3 rounded-xl border border-border bg-card p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-extrabold">
                    <span
                      className={`rounded-full px-2 py-0.5 ${
                        sharia.rating === "halal"
                          ? "bg-emerald-500/10 text-emerald-600"
                          : sharia.rating === "halal_with_conditions"
                            ? "bg-amber-500/10 text-amber-600"
                            : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {sharia.rating === "halal" ? "✅ حلال" : sharia.rating === "halal_with_conditions" ? "⚠️ حلال بشروط" : "⛔ يحتاج مراجعة"}
                    </span>
                    <span className="text-foreground">التوافق الشرعي</span>
                  </div>
                  <ul className="space-y-1.5">
                    {sharia.warnings.map((w) => (
                      <li key={w.type} className="rounded-lg bg-muted/50 p-2 text-[0.7rem] leading-relaxed text-muted-foreground">
                        {w.text}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* التسوية والرسوم */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[0.7rem] font-bold text-muted-foreground">التسوية عبر</span>
                  <select
                    value={settlement}
                    onChange={(e) => setSettlement(e.target.value as "cash" | "credits")}
                    className="rounded-lg border border-border bg-background px-2 py-1 text-xs font-bold text-foreground"
                  >
                    <option value="cash">نقد 💵</option>
                    <option value="credits">نقاط 🪙</option>
                  </select>
                </div>
                <div className="text-left text-[0.7rem]">
                  <div>
                    <span className="text-muted-foreground">رسوم المنصة (1.5%): </span>
                    <span className="font-extrabold tabular-nums text-foreground">
                      {fmtLocal((match?.transactionFee ?? 0) * rate, country)}
                    </span>
                  </div>
                  {match && match.shippingFee > 0 && (
                    <div>
                      <span className="text-muted-foreground">الشحن والنقل: </span>
                      <span className="font-extrabold tabular-nums text-amber-600">
                        {fmtLocal(match.shippingFee * rate, country)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* النقاط */}
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  { l: "توافق القيمة", v: match ? `${match.valueScore}%` : "—" },
                  { l: "تطابق التصنيف", v: match ? `${match.categoryScore}%` : "—" },
                  { l: "السيولة", v: match ? `${match.avgLiquidity}%` : "—" },
                ].map((s) => (
                  <div key={s.l} className="rounded-xl border border-border bg-card p-2 text-center">
                    <div className="text-[0.65rem] text-muted-foreground">{s.l}</div>
                    <div className="text-sm font-extrabold tabular-nums text-foreground">{s.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* مقارنة الأسعار — تظهر فقط عندما تكون السلعة/الخدمة من بلد آخر */}
          {crossBorder && (
            <Card title="مقارنة الأسعار بين البلدان" icon={<Globe2 className="size-4 text-primary" aria-hidden />}>
              <div className="mb-4 flex gap-3">
                <Field label="البلد الأول">
                  <Select value={compareA} onChange={(e) => setCompareA(e.target.value)}>
                    {COUNTRY_CODES.map((c) => (
                      <option key={c} value={c}>{COUNTRIES[c].nameAr} ({COUNTRIES[c].currency})</option>
                    ))}
                  </Select>
                </Field>
                <Field label="البلد الثاني">
                  <Select value={compareB} onChange={(e) => setCompareB(e.target.value)}>
                    {COUNTRY_CODES.map((c) => (
                      <option key={c} value={c}>{COUNTRIES[c].nameAr} ({COUNTRIES[c].currency})</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="flex items-center gap-3">
                {[{ code: compareA, r: cmp.a }, { code: compareB, r: cmp.b }].map((s, i) => (
                  <div key={s.code + i} className="flex-1 rounded-2xl border border-border bg-muted/30 p-4 text-center">
                    <div className="text-xl font-extrabold text-foreground">{COUNTRIES[s.code].flag}</div>
                    <div className="text-xs font-bold text-muted-foreground">{COUNTRIES[s.code].nameAr}</div>
                    <div className="mt-1 text-lg font-extrabold tabular-nums text-primary">{fmtLocal(s.r.local, s.code)}</div>
                    <div className="text-[0.68rem] text-muted-foreground">{s.r.affordability}% من الدخل الشهري</div>
                    {betterCode === s.code && absDiff >= 2 && (
                      <div className="mt-1.5 inline-block rounded-full bg-emerald-500/10 px-2 py-0.5 text-[0.62rem] font-extrabold text-emerald-600">
                        أرخص بـ {absDiff}%
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 text-center">
                <span
                  className={`inline-block rounded-full px-3 py-1 text-xs font-extrabold ${
                    absDiff < 2 ? "bg-muted text-muted-foreground" : "bg-emerald-500/10 text-emerald-600"
                  }`}
                >
                  {absDiff < 2
                    ? "≈ صفقة متكافئة"
                    : `${COUNTRIES[cmp.diffPct > 0 ? compareA : compareB].nameAr} ${absDiff}% أرخص`}
                </span>
              </div>
              <p className="mt-2 text-center text-xs leading-relaxed text-muted-foreground">
                {betterCode && worseCode
                  ? `قيمة المقايضة أقل بنسبة ${absDiff}% في ${COUNTRIES[betterCode].nameAr} مقارنة بـ ${COUNTRIES[worseCode].nameAr} — مما يجعلها صفقة أفضل للمشتري في ${COUNTRIES[betterCode].nameAr}.`
                  : "القيمة متكافئة بين البلدين."}
              </p>
            </Card>
          )}



          {/* المخزون */}
          <Card
            title="السلع والخدمات المتاحة للمقايضة"
            icon={<span className="rounded-full bg-muted px-2 py-0.5 text-xs font-extrabold text-muted-foreground">{inventory.length}</span>}
          >
            <div className="mb-3 flex flex-wrap gap-2">
              <div className="relative min-w-[180px] flex-1">
                <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="ابحث عن سلعة أو خدمة..."
                  className="w-full rounded-xl border border-border bg-background py-2.5 pr-9 pl-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="min-w-[160px]">
                <Select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
                  <option value="">كل التصنيفات</option>
                  {ALL_CATS.map((c) => (
                    <option key={c} value={c}>{CATEGORIES[c].icon} {CATEGORIES[c].labelAr}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {inventory.map(({ item, score, shippingFee, prox }, idx) => {
                const active = item.id === selectedTargetId;
                const showHeader = idx === 0 || inventory[idx - 1].prox !== prox;
                const local = getCountryPrice(item.value, country, item.category);
                return (
                  <Fragment key={item.id}>
                    {showHeader && (
                      <div className="col-span-full mt-1 text-[0.7rem] font-extrabold text-muted-foreground">
                        {PROX_LABELS[prox]}
                      </div>
                    )}
                    <button
                      onClick={() => setSelectedTargetId(active ? null : item.id)}
                      className={`rounded-2xl border p-3 text-right transition hover:border-primary/60 ${
                        active ? "border-primary bg-primary/5" : "border-border bg-card"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-lg">{CATEGORIES[item.category]?.icon}</span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[0.6rem] font-bold text-muted-foreground">
                          {item.type === "good" ? "سلعة" : "خدمة"} · {COUNTRIES[item.countryCode]?.flag}
                          {prox === 0 ? " 📍" : ""}
                        </span>
                      </div>
                      <div className="truncate text-xs font-bold text-foreground">{item.nameAr}</div>
                      <div className="truncate text-[0.65rem] text-muted-foreground">
                        {catLabel(item.category)} ➔ {subLabel(item.category, item.subcategory)}
                      </div>
                      <div className="mt-1 text-sm font-extrabold tabular-nums text-primary">
                        {fmtLocal(local.local, country)}
                        <span className="ms-1 text-[0.62rem] font-semibold text-muted-foreground">{fmtUSD(item.value)}</span>
                      </div>
                      {shippingFee > 0 && item.countryCode !== country && (
                        <div className="text-[0.62rem] font-semibold text-amber-600">
                          ✈️ + {fmtLocal(shippingFee * rate, country)} شحن ونقل
                        </div>
                      )}
                      <div className="text-[0.62rem] text-muted-foreground">
                        يرغب في: {catLabel(item.desiredCategory)}
                      </div>
                      <div className="mt-1.5 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[0.62rem] font-extrabold text-primary">
                        {score}% توافق
                      </div>
                    </button>
                  </Fragment>
                );

              })}
              {inventory.length === 0 && (
                <p className="col-span-full py-8 text-center text-xs text-muted-foreground">لا توجد نتائج مطابقة.</p>
              )}
            </div>

          </Card>
        </div>
      </div>
    </div>
  );
}
