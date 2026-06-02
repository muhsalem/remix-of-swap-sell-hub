import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { PricingEngine } from "@/components/PricingEngine";
import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { ListingImage } from "@/components/ListingImage";
import { listActiveListings } from "@/lib/listings.functions";


const listingsQuery = queryOptions({
  queryKey: ["active-listings"],
  queryFn: () => listActiveListings(),
});

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(listingsQuery),
  head: () => ({
    meta: [
      { title: "إيكال EQAL — منصة المقايضة الذكية بالذكاء الاصطناعي" },
      { name: "description", content: "روّج لمنتجاتك وقايضها بعدالة عبر محرك تسعير ذكي مدعوم بالذكاء الاصطناعي." },
      { property: "og:title", content: "إيكال EQAL — منصة المقايضة الذكية" },
      { property: "og:description", content: "محرك تسعير للمقايضة بالذكاء الاصطناعي." },
    ],
  }),
  component: Index,
});

function Index() {
  const { data } = useSuspenseQuery(listingsQuery);
  const listings = data?.listings ?? [];

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground font-body">
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800&family=Tajawal:wght@400;500&family=JetBrains+Mono&display=swap" rel="stylesheet" />

      <Nav />
      <Hero />

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div id="engine">
          <PricingEngine />
        </div>

        <section id="market">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-display text-2xl md:text-3xl font-extrabold">أحدث العروض المتاحة للمقايضة</h2>
              <p className="text-sm text-muted-foreground mt-1">{listings.length} عرض نشط</p>
            </div>
            <Link to="/new-listing" className="hidden sm:inline-flex px-5 py-2.5 bg-foreground text-background rounded-full text-sm font-bold hover:bg-primary transition-all">
              أضف عرضك
            </Link>
          </div>

          {listings.length === 0 ? (
            <div className="bg-card rounded-3xl p-16 text-center ring-1 ring-black/5">
              <p className="text-muted-foreground mb-4">لا توجد عروض بعد. كن أول من ينشر!</p>
              <Link to="/new-listing" className="inline-flex px-5 py-2.5 bg-primary text-primary-foreground rounded-full text-sm font-bold">
                أضف عرضك الأول
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {listings.map((l) => (
                <Link
                  key={l.id}
                  to="/listings/$id"
                  params={{ id: l.id }}
                  className="group bg-card rounded-3xl p-4 ring-1 ring-black/5 hover:shadow-xl transition-all duration-500"
                >
                  <div className="relative overflow-hidden rounded-2xl mb-4 aspect-[3/4] bg-stone-soft">
                    <ListingImage path={l.images?.[0]} alt={l.title} />
                    <div className="absolute top-3 right-3 px-3 py-1 bg-card/90 backdrop-blur text-[10px] font-bold rounded-full">
                      {l.condition}
                    </div>
                  </div>
                  <h3 className="font-bold mb-1 truncate">{l.title}</h3>
                  <p className="text-xs text-muted-foreground mb-4 line-clamp-1">مطلوب: {l.wants}</p>
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <span className="text-sm font-bold">{Number(l.market_price).toLocaleString()} ر.س</span>
                    <span className="text-primary text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity">قيّم ←</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section id="how" className="mt-24">
          <h2 className="font-display text-2xl md:text-3xl font-extrabold mb-8">كيف تعمل المنصة؟</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { n: "01", t: "اعرض منتجك", d: "أضف صوراً ووصفاً وسعراً سوقياً تقديرياً." },
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
          <span className="font-display text-xl font-extrabold tracking-tighter opacity-40">EQAL</span>
          <div className="text-xs text-muted-foreground font-mono">© 2026 EQAL AI ENGINE</div>
        </div>
      </footer>
    </div>
  );
}
