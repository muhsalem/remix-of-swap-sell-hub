import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Search, Sparkles, ArrowLeftRight, Loader2, Repeat2, Star, SlidersHorizontal } from "lucide-react";
import { MatchFinder } from "@/components/MatchFinder";
import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { CategoryQuickBar } from "@/components/CategoryQuickBar";
import { ListingImage } from "@/components/ListingImage";
import { ListingsGridSkeleton } from "@/components/ListingSkeleton";
import { LocalPrice } from "@/components/LocalPrice";
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
  const [have, setHave] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [condFilter, setCondFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<"newest" | "price-asc" | "price-desc">("newest");
  const [showFilters, setShowFilters] = useState(false);

  // Match mode — when user provides both "have" and "want"
  const matchFn = useServerFn(matchListings);
  const matchM = useMutation({
    mutationFn: (vars: { have: string; want: string }) => matchFn({ data: vars }),
  });
  const matchResults = matchM.data?.matches ?? [];
  const matchMode = matchM.isSuccess || matchM.isPending || matchM.isError;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = minPrice ? Number(minPrice) : null;
    const max = maxPrice ? Number(maxPrice) : null;
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
    const hasTextOrCat = !!q || !!activeCat;
    let out = hasTextOrCat ? list.filter((x) => x.score > 0) : list;
    if (min !== null) out = out.filter((x) => Number(x.l.market_price) >= min);
    if (max !== null) out = out.filter((x) => Number(x.l.market_price) <= max);
    if (condFilter) out = out.filter((x) => x.l.condition === condFilter);
    if (sortBy === "price-asc") out = [...out].sort((a, b) => Number(a.l.market_price) - Number(b.l.market_price));
    else if (sortBy === "price-desc") out = [...out].sort((a, b) => Number(b.l.market_price) - Number(a.l.market_price));
    else if (hasTextOrCat) out = [...out].sort((a, b) => b.score - a.score);
    return out;
  }, [listings, query, activeCat, minPrice, maxPrice, condFilter, sortBy]);

  const hasAnyFilter = !!(query || activeCat || minPrice || maxPrice || condFilter);
  const resetFilters = () => {
    setQuery(""); setActiveCat(null); setMinPrice(""); setMaxPrice(""); setCondFilter(""); setSortBy("newest");
  };

  const sectionTitle = matchMode
    ? "مطابقات المقايضة"
    : query || activeCat ? "نتائج البحث" : "أحدث العروض في السوق";

  const onSubmitMatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (have.trim().length >= 2 && query.trim().length >= 2) {
      matchM.mutate({ have: have.trim(), want: query.trim() });
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground font-body">
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800&family=Tajawal:wght@400;500&family=JetBrains+Mono&display=swap" rel="stylesheet" />

      <Nav />
      <Hero />
      <CategoryQuickBar />

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Discover + match — merged */}
        <section id="market-search" className="mb-10 scroll-mt-20">
          <div className="bg-card rounded-3xl ring-1 ring-black/5 p-6 md:p-8 shadow-sm space-y-4">
            <div>
              <h2 className="font-display text-xl md:text-2xl font-extrabold flex items-center gap-2">
                <Repeat2 className="size-5 text-primary" />
                ابحث أو قايض في السوق
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                ابحث بسرعة في الإعلانات، أو اكتب ما تملكه وما تبحث عنه لمطابقتك مع من يريد العكس.
              </p>
            </div>

            <form onSubmit={onSubmitMatch} className="grid md:grid-cols-[1fr_auto_1fr_auto] gap-3 items-stretch">
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">أملك (اختياري — للمطابقة)</span>
                <input
                  value={have}
                  onChange={(e) => setHave(e.target.value)}
                  maxLength={200}
                  placeholder="مثال: آيفون 13 برو"
                  className="px-4 py-3 rounded-2xl bg-stone-soft border border-border text-sm outline-none focus:ring-2 ring-primary/30"
                />
              </label>
              <div className="hidden md:flex items-end justify-center pb-3">
                <ArrowLeftRight className="size-5 text-muted-foreground" />
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">أبحث عن / كلمة بحث</span>
                <div className="relative">
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="مثال: لابتوب ماك بوك، استشارة قانونية..."
                    className="w-full pr-10 pl-4 py-3 bg-stone-soft rounded-2xl border border-border outline-none focus:ring-2 ring-primary/30 text-sm"
                  />
                </div>
              </label>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={have.trim().length < 2 || query.trim().length < 2 || matchM.isPending}
                  className="w-full md:w-auto px-6 py-3 bg-primary text-primary-foreground rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-40"
                  title="املأ الحقلين لتشغيل المطابقة الذكية"
                >
                  {matchM.isPending ? <Loader2 className="size-4 animate-spin" /> : <ArrowLeftRight className="size-4" />}
                  طابقني
                </button>
              </div>
            </form>

            <div className="flex flex-wrap items-center gap-2">
              <CatChip active={!activeCat} onClick={() => setActiveCat(null)}>كل الفئات</CatChip>
              {POPULAR.map((c) => (
                <CatChip key={c} active={activeCat === c} onClick={() => setActiveCat(activeCat === c ? null : c)}>
                  {c}
                </CatChip>
              ))}
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                aria-expanded={showFilters}
                aria-controls="market-filters"
                className="ms-auto inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border border-border hover:border-primary/40 transition"
              >
                <SlidersHorizontal className="size-3.5" aria-hidden /> فلاتر متقدمة
              </button>
              {matchMode && (
                <button
                  onClick={() => matchM.reset()}
                  className="text-xs font-bold text-muted-foreground hover:text-foreground underline"
                >
                  مسح نتائج المطابقة
                </button>
              )}
            </div>

            {showFilters && (
              <div id="market-filters" className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-border">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">سعر أدنى (ر.س)</span>
                  <input type="number" inputMode="numeric" min={0} value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-stone-soft border border-border text-sm outline-none focus:ring-2 ring-primary/30" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">سعر أعلى (ر.س)</span>
                  <input type="number" inputMode="numeric" min={0} value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-stone-soft border border-border text-sm outline-none focus:ring-2 ring-primary/30" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">الحالة</span>
                  <select value={condFilter} onChange={(e) => setCondFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-stone-soft border border-border text-sm outline-none focus:ring-2 ring-primary/30">
                    <option value="">الكل</option>
                    <option value="new">جديد</option>
                    <option value="like-new">شبه جديد</option>
                    <option value="good">جيد</option>
                    <option value="fair">مقبول</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">الترتيب</span>
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="px-3 py-2 rounded-xl bg-stone-soft border border-border text-sm outline-none focus:ring-2 ring-primary/30">
                    <option value="newest">الأحدث</option>
                    <option value="price-asc">السعر: من الأقل</option>
                    <option value="price-desc">السعر: من الأعلى</option>
                  </select>
                </label>
                {hasAnyFilter && (
                  <button onClick={resetFilters} className="col-span-2 md:col-span-4 text-xs font-bold text-muted-foreground hover:text-foreground underline justify-self-end">
                    مسح كل الفلاتر
                  </button>
                )}
              </div>
            )}
          </div>
        </section>


        {/* السوق */}
        <section id="market" className="mb-16">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display text-2xl md:text-3xl font-extrabold flex items-center gap-3">
                {(query || activeCat || matchMode) && <Sparkles className="size-5 text-primary" />}
                {sectionTitle}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {matchMode
                  ? matchM.isPending ? "يبحث عن مطابقات..." : `${matchResults.length} مطابقة محتملة`
                  : (query || activeCat)
                    ? `${filtered.length} نتيجة مطابقة`
                    : `${listings.length} عرض نشط`}
              </p>
            </div>
            <Link to="/new-listing" className="hidden sm:inline-flex px-5 py-2.5 bg-foreground text-background rounded-full text-sm font-bold hover:bg-primary transition-all">
              أضف عرضك
            </Link>
          </div>

          {matchMode ? (
            matchM.isPending ? (
              <ListingsGridSkeleton count={4} />
            ) : matchResults.length === 0 ? (
              <div className="bg-card rounded-3xl p-12 text-center ring-1 ring-black/5">
                <Sparkles className="size-10 mx-auto mb-3 opacity-40 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-4">لم نجد مطابقات الآن — جرّب كلمات مختلفة أو انشر إعلانك ليجدك آخرون.</p>
                <Link to="/new-listing" className="inline-flex px-5 py-2.5 bg-primary text-primary-foreground rounded-full text-sm font-bold">
                  أنشئ إعلانك
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {matchResults.map((l: any) => (
                  <Link
                    key={l.id} to="/listings/$id" params={{ id: l.id }}
                    className="group bg-card rounded-3xl p-4 ring-1 ring-black/5 hover:shadow-xl hover:-translate-y-1 transition-all duration-500 relative"
                  >
                    {l._mutual && (
                      <div className="absolute top-2 right-2 z-10 px-2 py-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center gap-1 shadow-lg">
                        <Repeat2 className="size-3" /> مطابقة متبادلة
                      </div>
                    )}
                    <div className="relative overflow-hidden rounded-2xl mb-4 aspect-[3/4] bg-stone-soft">
                      <ListingImage path={l.images?.[0]} alt={l.title} />
                      <div className="absolute top-3 left-3 px-3 py-1 bg-card/90 backdrop-blur text-[10px] font-bold rounded-full">
                        {l.condition}
                      </div>
                    </div>
                    <h3 className="font-bold mb-1 truncate">{l.title}</h3>
                    <p className="text-xs text-muted-foreground mb-4 line-clamp-1">يريد مقابله: {l.wants}</p>
                    <div className="flex items-center justify-between pt-4 border-t border-border">
                      <span className="text-sm font-bold"><LocalPrice sar={l.market_price} /></span>
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Star className="size-3 fill-accent text-accent" />
                        {Number(l.profiles?.rating ?? 0).toFixed(1)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )
          ) : filtered.length === 0 ? (
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
                    <span className="text-sm font-bold"><LocalPrice sar={l.market_price} /></span>
                    <span className="text-primary text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity">قيّم ←</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* محرك التسعير (مع باحث المطابقات الحدثي) */}
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

