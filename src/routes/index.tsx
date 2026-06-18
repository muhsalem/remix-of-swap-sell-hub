import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Search, Sparkles, ArrowLeftRight, Loader2, Repeat2, Star, SlidersHorizontal, MapPin, BellPlus } from "lucide-react";
import { toast } from "sonner";
import { MatchFinder } from "@/components/MatchFinder";
import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { CategoryQuickBar } from "@/components/CategoryQuickBar";
import { QuickSearchBar } from "@/components/QuickSearchBar";
import { ListingImage } from "@/components/ListingImage";
import { ListingsGridSkeleton } from "@/components/ListingSkeleton";
import { LocalPrice, useUserCurrency } from "@/components/LocalPrice";
import { listActiveListings, matchListings } from "@/lib/listings.functions";
import { addWishlistAlert } from "@/lib/wishlist.functions";
import { supabase } from "@/integrations/supabase/client";

const listingsQuery = queryOptions({
  queryKey: ["active-listings"],
  queryFn: () => listActiveListings(),
});

const POPULAR = ["هواتف", "حواسيب", "ساعات", "مجوهرات", "ذهب", "أثاث", "كتب", "خدمات مهنية"];

const searchSchema = z.object({
  q: z.string().optional().default(""),
  cat: z.string().optional().default(""),
  cond: z.string().optional().default(""),
  city: z.string().optional().default(""),
  min: z.string().optional().default(""),
  max: z.string().optional().default(""),
  type: z.enum(["", "item", "service"]).optional().default(""),
  sort: z.enum(["newest", "price-asc", "price-desc"]).optional().default("newest"),
});

export const Route = createFileRoute("/")({
  validateSearch: (input) => searchSchema.parse(input),
  loader: ({ context }) => context.queryClient.ensureQueryData(listingsQuery),
  head: () => ({
    meta: [
      { title: "بادل — منصة المقايضة الذكية بالذكاء الاصطناعي" },
      { name: "description", content: "بيع، اشترِ، أو قايض بعدالة عبر محرك تسعير ذكي مدعوم بالذكاء الاصطناعي." },
      { property: "og:title", content: "بادل — منصة المقايضة الذكية" },
      { property: "og:description", content: "بيع واشترِ وقايض بثقة وعدالة." },
      { property: "og:type", content: "website" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: "بادل",
              alternateName: "Badel",
              url: "/",
              description: "منصة سعودية للمقايضة العادلة بين الأفراد والشركات.",
            },
            {
              "@type": "WebSite",
              name: "بادل",
              url: "/",
              inLanguage: "ar",
              potentialAction: {
                "@type": "SearchAction",
                target: "/?q={search_term_string}",
                "query-input": "required name=search_term_string",
              },
            },
          ],
        }),
      },
    ],
  }),
  component: Index,
});


function Index() {
  const { data } = useSuspenseQuery(listingsQuery);
  const listings = data?.listings ?? [];
  const urlSearch = Route.useSearch();
  const navigate = useNavigate({ from: "/" });

  const [query, setQuery] = useState(urlSearch.q || "");
  const [have, setHave] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(urlSearch.cat || null);
  const [minPrice, setMinPrice] = useState<string>(urlSearch.min || "");
  const [maxPrice, setMaxPrice] = useState<string>(urlSearch.max || "");
  const [condFilter, setCondFilter] = useState<string>(urlSearch.cond || "");
  const [cityFilter, setCityFilter] = useState<string>(urlSearch.city || "");
  const [typeFilter, setTypeFilter] = useState<"" | "item" | "service">(urlSearch.type || "");
  const [sortBy, setSortBy] = useState<"newest" | "price-asc" | "price-desc">(urlSearch.sort || "newest");
  const [showFilters, setShowFilters] = useState(false);

  // Sync URL → local filter state (CategoryQuickBar / QuickSearchBar drive URL)
  useEffect(() => {
    setQuery(urlSearch.q || "");
    setActiveCat(urlSearch.cat || null);
    setCondFilter(urlSearch.cond || "");
    setCityFilter(urlSearch.city || "");
    setMinPrice(urlSearch.min || "");
    setMaxPrice(urlSearch.max || "");
    setTypeFilter(urlSearch.type || "");
    setSortBy(urlSearch.sort || "newest");
  }, [urlSearch.q, urlSearch.cat, urlSearch.cond, urlSearch.city, urlSearch.min, urlSearch.max, urlSearch.type, urlSearch.sort]);

  // Debounced sync: local filter state → URL (keeps shareable links accurate)
  useEffect(() => {
    const t = setTimeout(() => {
      navigate({
        search: (prev: any) => ({
          ...prev,
          q: query || undefined,
          cat: activeCat || undefined,
          cond: condFilter || undefined,
          city: cityFilter || undefined,
          min: minPrice || undefined,
          max: maxPrice || undefined,
          type: typeFilter || undefined,
          sort: sortBy === "newest" ? undefined : sortBy,
        }),
        replace: true,
      });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, activeCat, condFilter, cityFilter, minPrice, maxPrice, typeFilter, sortBy]);

  // Available cities (from active listings)
  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const l of listings) if ((l as any).city) set.add(String((l as any).city));
    return Array.from(set).sort();
  }, [listings]);

  // Save-search alert
  const addAlertFn = useServerFn(addWishlistAlert);
  const saveSearchM = useMutation({
    mutationFn: (term: string) => addAlertFn({ data: { searchTerm: term } }),
    onSuccess: (r) => toast.success(r.duplicate ? "تنبيه مفعّل مسبقاً" : "تم تفعيل التنبيه — سنُعلمك فور توفّر ما يطابق بحثك"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر حفظ البحث"),
  });
  const handleSaveSearch = async () => {
    const term = (query || activeCat || "").trim();
    if (term.length < 2) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("سجّل دخولك أولاً لحفظ البحث"); return; }
    saveSearchM.mutate(term);
  };

  // Match mode — when user provides both "have" and "want"
  const matchFn = useServerFn(matchListings);
  const matchM = useMutation({
    mutationFn: (vars: { have: string; want: string }) => matchFn({ data: vars }),
  });
  const matchResults = matchM.data?.matches ?? [];
  const matchMode = matchM.isSuccess || matchM.isPending || matchM.isError;

  const { fx } = useUserCurrency();
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Inputs are in user's local currency; convert back to SAR for filtering
    const min = minPrice ? Number(minPrice) / (fx.perSAR || 1) : null;
    const max = maxPrice ? Number(maxPrice) / (fx.perSAR || 1) : null;
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
    if (cityFilter) out = out.filter((x) => (x.l as any).city === cityFilter);
    if (typeFilter) out = out.filter((x) => ((x.l as any).listing_type || "item") === typeFilter);
    if (sortBy === "price-asc") out = [...out].sort((a, b) => Number(a.l.market_price) - Number(b.l.market_price));
    else if (sortBy === "price-desc") out = [...out].sort((a, b) => Number(b.l.market_price) - Number(a.l.market_price));
    else if (hasTextOrCat) out = [...out].sort((a, b) => b.score - a.score);
    return out;
  }, [listings, query, activeCat, minPrice, maxPrice, condFilter, cityFilter, typeFilter, sortBy, fx.perSAR]);

  const hasAnyFilter = !!(query || activeCat || minPrice || maxPrice || condFilter || cityFilter || typeFilter);
  const resetFilters = () => {
    setQuery(""); setActiveCat(null); setMinPrice(""); setMaxPrice(""); setCondFilter(""); setCityFilter(""); setTypeFilter(""); setSortBy("newest");
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
      <CategoryQuickBar active={activeCat ?? undefined} />
      <QuickSearchBar q={query} cat={activeCat ?? ""} cond={condFilter} sort={sortBy} />

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
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">سعر أدنى ({fx.symbol})</span>
                  <input type="number" inputMode="numeric" min={0} value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-stone-soft border border-border text-sm outline-none focus:ring-2 ring-primary/30" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">سعر أعلى ({fx.symbol})</span>
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
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">المدينة</span>
                  <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-stone-soft border border-border text-sm outline-none focus:ring-2 ring-primary/30">
                    <option value="">كل المدن</option>
                    {cities.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">النوع</span>
                  <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
                    className="px-3 py-2 rounded-xl bg-stone-soft border border-border text-sm outline-none focus:ring-2 ring-primary/30">
                    <option value="">الكل</option>
                    <option value="item">سلعة</option>
                    <option value="service">خدمة</option>
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
            <div className="flex items-center gap-2">
              {(query || activeCat) && !matchMode && (
                <button
                  type="button"
                  onClick={handleSaveSearch}
                  disabled={saveSearchM.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold border border-primary/40 text-primary hover:bg-primary/5 transition disabled:opacity-50"
                  title="أبلغني عند توفّر سلعة تطابق هذا البحث"
                >
                  {saveSearchM.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <BellPlus className="size-3.5" />}
                  أبلغني
                </button>
              )}
              <Link to="/new-listing" className="hidden sm:inline-flex px-5 py-2.5 bg-foreground text-background rounded-full text-sm font-bold hover:bg-primary transition-all">
                أضف عرضك
              </Link>
            </div>
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
            <div className="bg-card rounded-3xl p-12 md:p-16 text-center ring-1 ring-black/5">
              <Search className="size-10 mx-auto mb-4 opacity-30 text-muted-foreground" aria-hidden />
              <h3 className="font-display font-extrabold text-lg mb-2">
                {query || activeCat ? "لا توجد نتائج تطابق بحثك" : "لا توجد عروض بعد"}
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                {query || activeCat
                  ? "جرّب كلمة بحث مختلفة، أو فعّل التنبيه لنُعلمك فور توفّر ما تبحث عنه."
                  : "كن أول من ينشر عرضاً وابدأ صفقتك الأولى اليوم."}
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                {(query || activeCat) && (
                  <button
                    type="button"
                    onClick={handleSaveSearch}
                    disabled={saveSearchM.isPending}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold border border-primary/40 text-primary hover:bg-primary/5 transition disabled:opacity-50"
                  >
                    {saveSearchM.isPending ? <Loader2 className="size-4 animate-spin" /> : <BellPlus className="size-4" />}
                    فعّل التنبيه
                  </button>
                )}
                <Link to="/new-listing" className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-full text-sm font-bold hover:opacity-90 transition">
                  <Sparkles className="size-4" /> أنشئ عرضك الأول
                </Link>
                {hasAnyFilter && (
                  <button onClick={resetFilters} className="inline-flex items-center px-4 py-2.5 rounded-full text-sm font-bold text-muted-foreground hover:text-foreground">
                    مسح الفلاتر
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {filtered.map(({ l, score }) => {
                const isService = /خدم|استشار|تعليم|تدريب/i.test(l.category || "");
                return (
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
                    <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
                      <span className="px-3 py-1 bg-card/90 backdrop-blur text-[10px] font-bold rounded-full">
                        {conditionLabel(l.condition)}
                      </span>
                      <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full backdrop-blur ${isService ? "bg-accent/90 text-accent-foreground" : "bg-primary/15 text-primary"}`}>
                        {isService ? "خدمة" : "سلعة"}
                      </span>
                    </div>
                    {(l as any).city && (
                      <div className="absolute bottom-3 right-3 px-2.5 py-1 bg-foreground/80 text-background text-[10px] font-bold rounded-full flex items-center gap-1 backdrop-blur">
                        <MapPin className="size-3" /> {(l as any).city}
                      </div>
                    )}
                  </div>
                  <h3 className="font-bold mb-1 truncate">{l.title}</h3>
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-1">مطلوب مقابله: {l.wants}</p>
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <span className="text-sm font-bold"><LocalPrice sar={l.market_price} /></span>
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground" title={`${(l as any).profiles?.trades_count ?? 0} صفقة مكتملة`}>
                      <Star className="size-3 fill-accent text-accent" />
                      {Number((l as any).profiles?.rating ?? 0).toFixed(1)}
                      <span className="opacity-60">({(l as any).profiles?.trades_count ?? 0})</span>
                    </span>
                  </div>
                </Link>
                );
              })}
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


function conditionLabel(c: string | null | undefined) {
  const map: Record<string, string> = {
    new: "جديد",
    "like-new": "شبه جديد",
    good: "جيد",
    fair: "مقبول",
    poor: "مستعمل",
  };
  return (c && map[c]) || c || "—";
}
