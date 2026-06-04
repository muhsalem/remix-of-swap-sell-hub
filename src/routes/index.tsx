import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Search, Sparkles, ArrowLeftRight, Loader2, Repeat2, Star } from "lucide-react";
import { MatchFinder } from "@/components/MatchFinder";
import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { ListingImage } from "@/components/ListingImage";
import { listActiveListings, matchListings } from "@/lib/listings.functions";

const listingsQuery = queryOptions({
  queryKey: ["active-listings"],
  queryFn: () => listActiveListings(),
});

const POPULAR = ["هواتف", "حواسيب", "ساعات", "مجوهرات", "ذهب", "أثاث", "كتب", "خدمات مهنية"];

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(listingsQuery),
  head: () => ({
    meta: [
      { title: "بادل — منصة المقايضة الذكية بالذكاء الاصطناعي" },
      { name: "description", content: "بيع، اشترِ، أو قايض بعدالة عبر محرك تسعير ذكي مدعوم بالذكاء الاصطناعي." },
      { property: "og:title", content: "بادل — منصة المقايضة الذكية" },
      { property: "og:description", content: "بيع واشترِ وقايض بثقة وعدالة." },
    ],
  }),
  component: Index,
});


function Index() {
  const { data } = useSuspenseQuery(listingsQuery);
  const listings = data?.listings ?? [];

  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = listings.map((l) => {
      const text = `${l.title} ${l.category} ${l.wants ?? ""}`.toLowerCase();
      let score = 0;
      if (q) {
        if (l.title.toLowerCase().includes(q)) score += 5;
        if (l.category.toLowerCase().includes(q)) score += 3;
        if (text.includes(q)) score += 1;
      }
      if (activeCat && l.category === activeCat) score += 4;
      return { l, score };
    });
    const hasFilter = !!q || !!activeCat;
    return hasFilter
      ? list.filter((x) => x.score > 0).sort((a, b) => b.score - a.score)
      : list;
  }, [listings, query, activeCat]);

  const sectionTitle = query || activeCat ? "نتائج البحث" : "أحدث العروض في السوق";

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground font-body">
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800&family=Tajawal:wght@400;500&family=JetBrains+Mono&display=swap" rel="stylesheet" />

      <Nav />
      <Hero />

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Discover bar */}
        <section className="mb-10">
          <div className="bg-card rounded-3xl ring-1 ring-black/5 p-6 md:p-8 shadow-sm space-y-4">
            <div>
              <h2 className="font-display text-xl md:text-2xl font-extrabold">ابحث في السوق</h2>
              <p className="text-sm text-muted-foreground mt-1">اعثر على ما تريد مقايضته أو شراءه — أو انزل لمحرك التسعير لتقدير قيمة ممتلكاتك.</p>
            </div>
            <div className="relative">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="مثال: آيفون 14، ساعة سمارت، استشارة قانونية..."
                className="w-full pr-12 pl-4 py-4 bg-stone-soft rounded-2xl border border-border outline-none focus:ring-2 ring-primary/30 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <CatChip active={!activeCat} onClick={() => setActiveCat(null)}>كل الفئات</CatChip>
              {POPULAR.map((c) => (
                <CatChip key={c} active={activeCat === c} onClick={() => setActiveCat(activeCat === c ? null : c)}>
                  {c}
                </CatChip>
              ))}
            </div>
          </div>
        </section>


        {/* السوق */}
        <section id="market" className="mb-16">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display text-2xl md:text-3xl font-extrabold flex items-center gap-3">
                {(query || activeCat) && <Sparkles className="size-5 text-primary" />}
                {sectionTitle}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {(query || activeCat)
                  ? `${filtered.length} نتيجة مطابقة`
                  : `${listings.length} عرض نشط`}
              </p>
            </div>
            <Link to="/new-listing" className="hidden sm:inline-flex px-5 py-2.5 bg-foreground text-background rounded-full text-sm font-bold hover:bg-primary transition-all">
              أضف عرضك
            </Link>
          </div>

          {filtered.length === 0 ? (
            <div className="bg-card rounded-3xl p-16 text-center ring-1 ring-black/5">
              <p className="text-muted-foreground mb-4">
                {query || activeCat ? "لا توجد نتائج. جرّب كلمة بحث أخرى." : "لا توجد عروض بعد. كن أول من ينشر!"}
              </p>
              <Link to="/new-listing" className="inline-flex px-5 py-2.5 bg-primary text-primary-foreground rounded-full text-sm font-bold">
                أضف عرضك الأول
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {filtered.map(({ l, score }) => (
                <Link
                  key={l.id}
                  to="/listings/$id"
                  params={{ id: l.id }}
                  className="group bg-card rounded-3xl p-4 ring-1 ring-black/5 hover:shadow-xl hover:-translate-y-1 transition-all duration-500 relative"
                >
                  {(query || activeCat) && score >= 5 && (
                    <div className="absolute top-2 right-2 z-10 px-2 py-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center gap-1 shadow-lg">
                      <Sparkles className="size-3" /> مطابق لاهتمامك
                    </div>
                  )}
                  <div className="relative overflow-hidden rounded-2xl mb-4 aspect-[3/4] bg-stone-soft">
                    <ListingImage path={l.images?.[0]} alt={l.title} />
                    <div className="absolute top-3 left-3 px-3 py-1 bg-card/90 backdrop-blur text-[10px] font-bold rounded-full">
                      {l.condition}
                    </div>
                  </div>
                  <h3 className="font-bold mb-1 truncate">{l.title}</h3>
                  <p className="text-xs text-muted-foreground mb-4 line-clamp-1">مطلوب مقابله: {l.wants}</p>
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <span className="text-sm font-bold">{Number(l.market_price).toLocaleString()} ر.س</span>
                    <span className="text-primary text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity">قيّم ←</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* محرك التسعير + باحث المطابقات (مدمجان) */}
        <div id="engine" className="scroll-mt-20">
          <MatchFinder />
        </div>


        <section id="how" className="mt-24">
          <h2 className="font-display text-2xl md:text-3xl font-extrabold mb-8">كيف تعمل المنصة؟</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { n: "01", t: "حدّد نيتك", d: "بيع، شراء، أو مقايضة — اختر ما يناسبك." },
              { n: "02", t: "حلّل المقايضة", d: "محرك التسعير الذكي يحسب العدالة ويقترح موازنة." },
              { n: "03", t: "أتمم الصفقة", d: "تواصل مع الطرف الآخر بثقة وأنت تعرف القيمة الحقيقية." },
            ].map((s) => (
              <div key={s.n} className="bg-card rounded-3xl p-6 ring-1 ring-black/5">
                <div className="font-mono text-primary text-sm mb-3">{s.n}</div>
                <h3 className="font-display font-bold text-lg mb-2">{s.t}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="py-12 border-t border-border mt-16 bg-card">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <span className="font-display text-xl font-extrabold tracking-tighter opacity-40">بادل</span>
          <div className="text-xs text-muted-foreground font-mono">© 2026 بادل AI ENGINE</div>
        </div>
      </footer>
    </div>
  );
}


function CatChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${
        active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:border-primary/40"
      }`}
    >
      {children}
    </button>
  );
}

