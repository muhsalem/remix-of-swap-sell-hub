import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Search, Star, SlidersHorizontal, ImageIcon, LayoutGrid, Rows3, MapPin, Clock, X, Loader2 } from "lucide-react";
import { listActiveListings } from "@/lib/listings.functions";
import { searchListingsByImage } from "@/lib/image-search.functions";
import { computeImageHash } from "@/lib/image-hash";
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
          "استعرض كل إعلانات المقايضة النشطة على بدل: سلع وخدمات بأسعار سوق مرجعية، بحث بالوصف وبالصورة، وفلترة بالفئة والمدينة والحالة مع حماية الضمان.",
      },
      { property: "og:title", content: "تصفّح إعلانات المقايضة والخدمات | بدل" },
      {
        property: "og:description",
        content: "كل الإعلانات النشطة للمقايضة في مكان واحد — بحث بالوصف وبالصورة وسعر سوق مرجعي.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BrowseListings,
});

type Sort = "newest" | "price_asc" | "price_desc";

const CONDITION_AR: Record<string, string> = {
  new: "جديد",
  "like-new": "شبه جديد",
  excellent: "ممتاز",
  good: "جيد",
  fair: "مقبول",
};

function ageLabel(months: number | null | undefined) {
  const m = Number(months ?? 0);
  if (!m) return "جديد";
  if (m < 12) return `${m} شهر`;
  const y = Math.floor(m / 12);
  const rem = m % 12;
  return rem ? `${y} سنة و${rem} شهر` : `${y} سنة`;
}

function BrowseListings() {
  const { data } = useSuspenseQuery(listingsQuery);
  const listings = (data?.listings ?? []) as any[];

  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [city, setCity] = useState("");
  const [type, setType] = useState<"" | "item" | "service">("");
  const [sort, setSort] = useState<Sort>("newest");
  const [view, setView] = useState<"grid" | "list">("grid");

  // البحث بالصورة
  const fileRef = useRef<HTMLInputElement>(null);
  const [imgBusy, setImgBusy] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);
  const [imgMatches, setImgMatches] = useState<any[] | null>(null);
  const [imgPreview, setImgPreview] = useState<string | null>(null);

  const onPickImage = async (file: File | undefined) => {
    if (!file) return;
    setImgError(null);
    setImgBusy(true);
    try {
      const phash = await computeImageHash(file);
      if (!phash) throw new Error("تعذّر قراءة الصورة — جرّب صورة أخرى.");
      setImgPreview(URL.createObjectURL(file));
      const res = await searchListingsByImage({ data: { phash, maxDistance: 12 } });
      setImgMatches(res.matches ?? []);
    } catch (e: any) {
      setImgMatches(null);
      setImgError(e?.message ?? "تعذّر البحث بالصورة.");
    } finally {
      setImgBusy(false);
    }
  };

  const clearImage = () => {
    setImgMatches(null);
    setImgPreview(null);
    setImgError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const categories = useMemo(
    () => Array.from(new Set(listings.map((l) => l.category).filter(Boolean))).sort(),
    [listings],
  );
  const cities = useMemo(
    () => Array.from(new Set(listings.map((l) => l.city).filter(Boolean))).sort(),
    [listings],
  );

  const source = imgMatches ?? listings;

  const results = useMemo(() => {
    const nq = arNormalize(q.trim());
    let out = source.filter((l) => {
      if (cat && l.category !== cat) return false;
      if (city && l.city !== city) return false;
      if (type && (l.listing_type ?? "item") !== type) return false;
      if (!nq) return true;
      // البحث يشمل الوصف الكامل وليس اسم الفئة فقط
      const hay = arNormalize(
        `${l.title ?? ""} ${l.description ?? ""} ${l.wants ?? ""} ${l.category ?? ""} ${l.city ?? ""}`,
      );
      return nq.split(/\s+/).every((t) => hay.includes(t));
    });
    if (imgMatches) return out; // مرتّبة مسبقاً حسب تشابه الصورة
    out = [...out].sort((a, b) => {
      if (sort === "price_asc") return Number(a.market_price) - Number(b.market_price);
      if (sort === "price_desc") return Number(b.market_price) - Number(a.market_price);
      return String(b.created_at).localeCompare(String(a.created_at));
    });
    return out;
  }, [source, imgMatches, q, cat, city, type, sort]);

  const selectCls =
    "px-3 py-2 rounded-full bg-card ring-1 ring-black/5 text-sm min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  return (
    <main className="max-w-7xl mx-auto px-4 py-10 md:py-14">
      <header className="mb-8">
        <h1 className="font-display font-extrabold text-2xl md:text-3xl mb-2">تصفّح كل الإعلانات</h1>
        <p className="text-sm text-muted-foreground">
          {listings.length} إعلان نشط — ابحث بالوصف أو ارفع صورة للعثور على ما يشبهها.
        </p>
      </header>

      <section aria-label="فلاتر البحث" className="mb-8 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث في الاسم والوصف وما تريده مقابله…"
              aria-label="بحث في الإعلانات"
              className="w-full pr-11 pl-4 py-3 min-h-12 rounded-full bg-card ring-1 ring-black/5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => void onPickImage(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={imgBusy}
            className="inline-flex items-center justify-center gap-2 px-5 min-h-12 rounded-full bg-card ring-1 ring-black/5 text-sm font-bold hover:ring-primary disabled:opacity-60"
          >
            {imgBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ImageIcon className="size-4" aria-hidden />}
            بحث بالصورة
          </button>
        </div>

        {imgError && <p className="text-xs text-destructive">{imgError}</p>}

        {imgMatches && (
          <div className="flex items-center gap-3 bg-card rounded-2xl p-3 ring-1 ring-black/5">
            {imgPreview && <img src={imgPreview} alt="الصورة المستخدمة في البحث" className="size-12 rounded-xl object-cover" />}
            <p className="text-xs text-muted-foreground flex-1">
              نتائج البحث بالصورة: {imgMatches.length} إعلان مشابه.
            </p>
            <button
              type="button"
              onClick={clearImage}
              className="inline-flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-full bg-stone-soft"
            >
              <X className="size-3.5" aria-hidden /> إلغاء
            </button>
          </div>
        )}

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

          <div className="ms-auto inline-flex rounded-full bg-card ring-1 ring-black/5 p-1">
            <button
              type="button"
              onClick={() => setView("grid")}
              aria-pressed={view === "grid"}
              aria-label="عرض شبكي"
              className={`p-2 rounded-full ${view === "grid" ? "bg-primary text-primary-foreground" : ""}`}
            >
              <LayoutGrid className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
              aria-label="عرض قائمة"
              className={`p-2 rounded-full ${view === "list" ? "bg-primary text-primary-foreground" : ""}`}
            >
              <Rows3 className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      </section>

      {results.length === 0 ? (
        <div className="bg-card rounded-3xl p-12 text-center ring-1 ring-black/5">
          <Search className="size-10 mx-auto mb-4 opacity-30 text-muted-foreground" aria-hidden />
          <h2 className="font-display font-extrabold text-lg mb-2">لا توجد نتائج مطابقة</h2>
          <p className="text-sm text-muted-foreground mb-5">جرّب كلمات أقل، أو ارفع صورة، أو أزل بعض الفلاتر.</p>
          <Link to="/new-listing" className="inline-flex px-5 py-2.5 bg-primary text-primary-foreground rounded-full text-sm font-bold">
            أنشئ إعلانك
          </Link>
        </div>
      ) : view === "list" ? (
        <ul className="space-y-4">
          {results.map((l) => (
            <li key={l.id}>
              <Link
                to="/listings/$id"
                params={{ id: l.id }}
                className="flex gap-4 bg-card rounded-3xl p-4 ring-1 ring-black/5 hover:shadow-lg transition-all duration-300"
              >
                <div className="relative overflow-hidden rounded-2xl size-28 sm:size-36 shrink-0 bg-stone-soft">
                  <ListingImage path={l.images?.[0]} alt={l.title} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-bold truncate">{l.title}</h2>
                    <span className="text-sm font-bold whitespace-nowrap"><LocalPrice sar={l.market_price} /></span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {l.description || `يريد مقابله: ${l.wants}`}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-3 text-[11px] text-muted-foreground">
                    <span className="px-2 py-1 rounded-full bg-stone-soft font-bold">
                      {(l.listing_type ?? "item") === "service" ? "خدمة" : "سلعة"}
                    </span>
                    <span className="px-2 py-1 rounded-full bg-stone-soft">{CONDITION_AR[l.condition] ?? l.condition}</span>
                    <span className="inline-flex items-center gap-1"><Clock className="size-3" aria-hidden />{ageLabel(l.age_months)}</span>
                    {l.city && <span className="inline-flex items-center gap-1"><MapPin className="size-3" aria-hidden />{l.city}</span>}
                    <span className="inline-flex items-center gap-1">
                      <Star className="size-3 fill-accent text-accent" aria-hidden />
                      {Number(l.profiles?.rating ?? 0).toFixed(1)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2 line-clamp-1">يريد مقابله: {l.wants}</p>
                  <FairValueTag
                    referenceSar={l.price_reference_sar}
                    source={l.price_source}
                    deviationPct={l.price_deviation_pct}
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
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
                  {CONDITION_AR[l.condition] ?? l.condition}
                </div>
                {(l.listing_type ?? "item") === "service" && (
                  <div className="absolute top-3 right-3 px-3 py-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full">
                    خدمة
                  </div>
                )}
              </div>
              <h2 className="font-bold mb-1 truncate">{l.title}</h2>
              <p className="text-xs text-muted-foreground mb-2 line-clamp-2 min-h-8">
                {l.description || `يريد مقابله: ${l.wants}`}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground mb-3">
                <span className="inline-flex items-center gap-1"><Clock className="size-3" aria-hidden />{ageLabel(l.age_months)}</span>
                {l.city && <span className="inline-flex items-center gap-1"><MapPin className="size-3" aria-hidden />{l.city}</span>}
              </div>
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
