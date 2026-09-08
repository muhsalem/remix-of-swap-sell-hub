import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, Star, SlidersHorizontal } from "lucide-react";
import { listActiveListings } from "@/lib/listings.functions";
import { ListingImage } from "@/components/ListingImage";
import { LocalPrice } from "@/components/LocalPrice";
import { FairValueTag } from "@/components/FairValueTag";
import { EscrowBadge } from "@/components/EscrowBadge";
import { ListingsGridSkeleton } from "@/components/ListingSkeleton";
import { arNormalize } from "@/lib/ar-normalize";

const listingsQuery = queryOptions({
  queryKey: ["public-listings"],
  queryFn: () => listActiveListings(),
});

export const Route = createFileRoute("/listings/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(listingsQuery),
  pendingComponent: () => (
    <main className="max-w-7xl mx-auto px-4 py-12">
      <ListingsGridSkeleton count={8} />
    </main>
  ),
  errorComponent: () => (
    <main className="max-w-3xl mx-auto px-4 py-20 text-center">
      <h1 className="font-display font-extrabold text-xl mb-2">تعذّر تحميل الإعلانات</h1>
      <p className="text-sm text-muted-foreground">حدّث الصفحة بعد لحظات أو عد للرئيسية.</p>
    </main>
  ),
  notFoundComponent: () => (
    <main className="max-w-3xl mx-auto px-4 py-20 text-center">
      <p className="text-sm text-muted-foreground">الصفحة غير موجودة.</p>
    </main>
  ),
  head: () => ({
    meta: [
      { title: "تصفّح إعلانات المقايضة والخدمات | بدل" },
      {
        name: "description",
        content:
          "استعرض كل إعلانات المقايضة النشطة على بدل: سلع وخدمات بأسعار سوق مرجعية، فلترة بالفئة والمدينة والحالة، مع حماية الضمان.",
      },
      { property: "og:title", content: "تصفّح إعلانات المقايضة والخدمات | بدل" },
      {
        property: "og:description",
        content: "كل الإعلانات النشطة للمقايضة في مكان واحد — فلترة بالفئة والمدينة وسعر السوق المرجعي.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BrowseListings,
});

type Sort = "newest" | "price_asc" | "price_desc";

function BrowseListings() {
  const { data } = useSuspenseQuery(listingsQuery);
  const listings = (data?.listings ?? []) as any[];

  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [city, setCity] = useState("");
  const [type, setType] = useState<"" | "item" | "service">("");
  const [sort, setSort] = useState<Sort>("newest");

  const categories = useMemo(
    () => Array.from(new Set(listings.map((l) => l.category).filter(Boolean))).sort(),
    [listings],
  );
  const cities = useMemo(
    () => Array.from(new Set(listings.map((l) => l.city).filter(Boolean))).sort(),
    [listings],
  );

  const results = useMemo(() => {
    const nq = arNormalize(q.trim());
    let out = listings.filter((l) => {
      if (cat && l.category !== cat) return false;
      if (city && l.city !== city) return false;
      if (type && (l.listing_type ?? "item") !== type) return false;
      if (!nq) return true;
      const hay = arNormalize(`${l.title ?? ""} ${l.wants ?? ""} ${l.category ?? ""}`);
      return nq.split(/\s+/).every((t) => hay.includes(t));
    });
    out = [...out].sort((a, b) => {
      if (sort === "price_asc") return Number(a.market_price) - Number(b.market_price);
      if (sort === "price_desc") return Number(b.market_price) - Number(a.market_price);
      return String(b.created_at).localeCompare(String(a.created_at));
    });
    return out;
  }, [listings, q, cat, city, type, sort]);

  const selectCls =
    "px-3 py-2 rounded-full bg-card ring-1 ring-black/5 text-sm min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  return (
    <main className="max-w-7xl mx-auto px-4 py-10 md:py-14">
      <header className="mb-8">
        <h1 className="font-display font-extrabold text-2xl md:text-3xl mb-2">تصفّح كل الإعلانات</h1>
        <p className="text-sm text-muted-foreground">
          {listings.length} إعلان نشط — سلع وخدمات قابلة للمقايضة بأسعار سوق مرجعية.
        </p>
      </header>

      <section aria-label="فلاتر البحث" className="mb-8 space-y-3">
        <div className="relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث بالاسم أو ما تريده مقابله…"
            aria-label="بحث في الإعلانات"
            className="w-full pr-11 pl-4 py-3 min-h-12 rounded-full bg-card ring-1 ring-black/5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden />
          <select className={selectCls} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="الفئة">
            <option value="">كل الفئات</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select className={selectCls} value={city} onChange={(e) => setCity(e.target.value)} aria-label="المدينة">
            <option value="">كل المدن</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            className={selectCls}
            value={type}
            onChange={(e) => setType(e.target.value as "" | "item" | "service")}
            aria-label="النوع"
          >
            <option value="">سلع وخدمات</option>
            <option value="item">سلع</option>
            <option value="service">خدمات</option>
          </select>
          <select className={selectCls} value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="الترتيب">
            <option value="newest">الأحدث</option>
            <option value="price_asc">السعر: الأقل أولاً</option>
            <option value="price_desc">السعر: الأعلى أولاً</option>
          </select>
        </div>
      </section>

      {results.length === 0 ? (
        <div className="bg-card rounded-3xl p-12 text-center ring-1 ring-black/5">
          <Search className="size-10 mx-auto mb-4 opacity-30 text-muted-foreground" aria-hidden />
          <h2 className="font-display font-extrabold text-lg mb-2">لا توجد نتائج مطابقة</h2>
          <p className="text-sm text-muted-foreground mb-5">جرّب كلمات أقل أو أزل بعض الفلاتر.</p>
          <Link to="/new-listing" className="inline-flex px-5 py-2.5 bg-primary text-primary-foreground rounded-full text-sm font-bold">
            أنشئ إعلانك
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {results.map((l) => (
            <Link
              key={l.id}
              to="/listings/$id"
              params={{ id: l.id }}
              className="group bg-card rounded-3xl p-4 ring-1 ring-black/5 hover:shadow-xl hover:-translate-y-1 transition-all duration-500"
            >
              <div className="relative overflow-hidden rounded-2xl mb-4 aspect-[3/4] bg-stone-soft">
                <ListingImage path={l.images?.[0]} alt={l.title} />
                <div className="absolute top-3 left-3 px-3 py-1 bg-card/90 backdrop-blur text-[10px] font-bold rounded-full">
                  {l.condition}
                </div>
              </div>
              <h2 className="font-bold mb-1 truncate">{l.title}</h2>
              <p className="text-xs text-muted-foreground mb-4 line-clamp-1">يريد مقابله: {l.wants}</p>
              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold"><LocalPrice sar={l.market_price} /></span>
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Star className="size-3 fill-accent text-accent" aria-hidden />
                    {Number(l.profiles?.rating ?? 0).toFixed(1)}
                  </span>
                </div>
                <FairValueTag
                  referenceSar={l.price_reference_sar}
                  source={l.price_source}
                  deviationPct={l.price_deviation_pct}
                />
                <div className="mt-2"><EscrowBadge compact /></div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
