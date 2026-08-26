import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Nav } from "@/components/Nav";
import {
  CATEGORIES,
  COUNTRIES,
  MULTIPLIERS,
  valueGood,
  getCountryPrice,
  fmtUSD,
  fmtLocal,
} from "@/lib/barter-engine";

const TITLE = "أدلة أسعار المستعمل 2026 — تقييم السلع في مصر والسعودية | بادل";
const DESC =
  "دليل أسعار مرجعي للسلع المستعملة في مصر والسعودية: هواتف، حواسيب، سيارات، أثاث وأكثر — بحسب الحالة والعمر مع الرسوم الجمركية والقوة الشرائية.";
const URL = "https://badelbarter.lovable.app/seo-prices";

const AGES = [0, 1, 2, 3];
const CONDITIONS = ["new", "like_new", "excellent", "good", "fair"] as const;

export const Route = createFileRoute("/seo-prices")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "كيف يتم حساب سعر السلعة المستعملة في بادل؟",
              acceptedAnswer: {
                "@type": "Answer",
                text: "يعتمد المحرك على السعر المرجعي للفئة، ثم يطبّق التضخم حسب العمر، ومعدل الإهلاك، ومعامل الحالة، ومستوى الطلب، ثم يحوّل الناتج لعملة البلد مع الرسوم الجمركية ومؤشر تكلفة المعيشة.",
              },
            },
            {
              "@type": "Question",
              name: "لماذا يختلف السعر بين مصر والسعودية؟",
              acceptedAnswer: {
                "@type": "Answer",
                text: "لاختلاف سعر الصرف والرسوم الجمركية ومؤشر تكلفة المعيشة والقوة الشرائية بين البلدين، لذلك نعرض السعرين جنباً إلى جنب مع نسبة الفارق.",
              },
            },
          ],
        }),
      },
    ],
  }),
  component: SeoPrices,
});

function SeoPrices() {
  const catKeys = useMemo(
    () => Object.keys(CATEGORIES).filter((k) => Object.keys(CATEGORIES[k]?.subcategories ?? {}).length > 0),
    [],
  );
  const [cat, setCat] = useState<string>(catKeys[0] ?? "electronics");

  const subs = Object.entries(CATEGORIES[cat]?.subcategories ?? {});

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground font-body">
      <Nav />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-10">
        <header className="space-y-3">
          <h1 className="font-display text-3xl md:text-4xl font-black">أدلة أسعار المستعمل 2026</h1>
          <p className="text-muted-foreground leading-relaxed max-w-3xl">
            أسعار مرجعية تقديرية للسلع المستعملة في {COUNTRIES.EG?.nameAr} و{COUNTRIES.SA?.nameAr}، محسوبة
            بمحرك تسعير بادل بحسب الحالة والعمر ومعدل الإهلاك، وتشمل الرسوم الجمركية ومؤشر تكلفة المعيشة.
          </p>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link to="/pricing-engine" className="px-4 py-2 rounded-full bg-primary text-primary-foreground font-bold">
              جرّب محرك التسعير التفاعلي
            </Link>
            <Link to="/" className="px-4 py-2 rounded-full border border-border font-bold">
              تصفّح الإعلانات
            </Link>
          </div>
        </header>

        <nav aria-label="الفئات" className="flex flex-wrap gap-2">
          {catKeys.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setCat(k)}
              className={`px-3 py-1.5 rounded-full text-sm border transition ${
                k === cat
                  ? "bg-primary text-primary-foreground border-transparent font-bold"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {CATEGORIES[k]?.labelAr ?? k}
            </button>
          ))}
        </nav>

        {subs.map(([subKey, sub]) => (
          <section key={subKey} className="space-y-3">
            <h2 className="font-display text-xl font-bold">
              أسعار {sub.labelAr} المستعملة — {CATEGORIES[cat]?.labelAr}
            </h2>
            <p className="text-sm text-muted-foreground">
              السعر المرجعي الجديد: {fmtUSD(sub.basePrice ?? 0)} · معدل الإهلاك السنوي:{" "}
              {Math.round((sub.deprRate ?? 0) * 100)}% · سيولة السوق: {Math.round((sub.liquidity ?? 0) * 100)}%
            </p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <caption className="sr-only">جدول أسعار {sub.labelAr} حسب الحالة والعمر</caption>
                <thead className="bg-muted/50">
                  <tr>
                    <th scope="col" className="text-right p-3 font-bold">الحالة</th>
                    {AGES.map((a) => (
                      <th key={a} scope="col" className="text-right p-3 font-bold whitespace-nowrap">
                        {a === 0 ? "جديد" : `بعد ${a} سنة`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CONDITIONS.map((c) => (
                    <tr key={c} className="border-t border-border">
                      <th scope="row" className="text-right p-3 font-medium whitespace-nowrap">
                        {MULTIPLIERS.condition[c]?.labelAr ?? c}
                      </th>
                      {AGES.map((age) => {
                        const usd = valueGood({
                          basePrice: sub.basePrice ?? 0,
                          ageYears: age,
                          deprRate: sub.deprRate ?? 0.1,
                          conditionKey: c,
                          demandKey: "normal",
                          inflationRate: COUNTRIES.SA?.inflationRate ?? 0.025,
                        }).finalValue;
                        const eg = getCountryPrice(usd, "EG", cat);
                        const sa = getCountryPrice(usd, "SA", cat);
                        return (
                          <td key={age} className="p-3 align-top">
                            <div className="font-bold tabular-nums">{fmtLocal(sa.local, "SA")}</div>
                            <div className="text-muted-foreground tabular-nums">{fmtLocal(eg.local, "EG")}</div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              السطر الأول بالريال السعودي، والثاني بالجنيه المصري. القيم تقديرية لأغراض المقايضة العادلة.
            </p>
          </section>
        ))}

        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold">أسئلة شائعة</h2>
          <details className="rounded-xl border border-border p-4">
            <summary className="font-bold cursor-pointer">كيف يتم حساب سعر السلعة المستعملة؟</summary>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              السعر المرجعي للفئة يُعدّل بالتضخم حسب عمر السلعة، ثم يُطبَّق الإهلاك ومعامل الحالة ومستوى
              الطلب، ثم يُحوَّل لعملة البلد مع الرسوم الجمركية ومؤشر تكلفة المعيشة.
            </p>
          </details>
          <details className="rounded-xl border border-border p-4">
            <summary className="font-bold cursor-pointer">لماذا يختلف السعر بين مصر والسعودية؟</summary>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              بسبب اختلاف سعر الصرف والرسوم الجمركية وتكلفة المعيشة ومتوسط الدخل، لذا نعرض السعرين معاً حتى
              تكون المقايضة عبر الحدود عادلة للطرفين.
            </p>
          </details>
        </section>
      </main>
    </div>
  );
}
