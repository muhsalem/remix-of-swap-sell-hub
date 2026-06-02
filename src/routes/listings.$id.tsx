import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getListing } from "@/lib/listings.functions";
import { Nav } from "@/components/Nav";
import { ListingImage } from "@/components/ListingImage";
import { ArrowLeftRight, Calendar, Tag, Star } from "lucide-react";

const listingQuery = (id: string) => queryOptions({
  queryKey: ["listing", id],
  queryFn: () => getListing({ data: { id } }),
});

export const Route = createFileRoute("/listings/$id")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(listingQuery(params.id));
    if (!data.listing) throw notFound();
    return data;
  },
  head: ({ loaderData }) => ({
    meta: loaderData?.listing
      ? [
          { title: `${loaderData.listing.title} — إيكال EQAL` },
          { name: "description", content: `للمقايضة: ${loaderData.listing.title}. مطلوب: ${loaderData.listing.wants}` },
          { property: "og:title", content: loaderData.listing.title },
          { property: "og:description", content: `للمقايضة بـ ${loaderData.listing.wants}` },
        ]
      : [{ title: "عرض غير موجود" }],
  }),
  errorComponent: ({ error }) => <div className="p-12 text-center">{error.message}</div>,
  notFoundComponent: () => <div className="p-12 text-center">العرض غير موجود</div>,
  component: ListingPage,
});

function ListingPage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(listingQuery(id));
  const l = data.listing!;
  const profile = (l as { profiles?: { display_name: string; avatar_url: string | null; rating: number; trades_count: number; bio: string | null } }).profiles;

  return (
    <div dir="rtl" className="min-h-screen bg-background font-body">
      <Nav />
      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3">
            <div className="aspect-[4/3] bg-stone-soft rounded-3xl overflow-hidden mb-3">
              <ListingImage path={l.images?.[0]} alt={l.title} />
            </div>
            {l.images && l.images.length > 1 && (
              <div className="grid grid-cols-5 gap-2">
                {l.images.slice(1, 6).map((p) => (
                  <div key={p} className="aspect-square bg-stone-soft rounded-xl overflow-hidden">
                    <ListingImage path={p} alt="" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary font-mono rounded-full">{l.category}</span>
                {l.is_ribawi && <span className="text-xs px-2 py-0.5 bg-accent/20 text-accent-foreground font-bold rounded-full">صنف ربوي</span>}
              </div>
              <h1 className="font-display text-3xl font-extrabold mb-3">{l.title}</h1>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Tag className="size-3" /> {l.condition}</span>
                <span className="flex items-center gap-1"><Calendar className="size-3" /> {l.age_months} شهر</span>
              </div>
            </div>

            {l.description && <p className="text-sm text-muted-foreground leading-relaxed">{l.description}</p>}

            <div className="bg-card rounded-2xl p-5 ring-1 ring-black/5">
              <div className="text-xs text-muted-foreground mb-1">السعر السوقي</div>
              <div className="font-display text-3xl font-extrabold text-primary">{Number(l.market_price).toLocaleString()} ر.س</div>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <ArrowLeftRight className="size-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-primary">مطلوب للمقايضة</span>
              </div>
              <p className="font-bold">{l.wants}</p>
            </div>

            {profile && (
              <Link to="/" className="block bg-card rounded-2xl p-4 ring-1 ring-black/5 hover:ring-primary/30 transition-all">
                <div className="flex items-center gap-3">
                  <div className="size-12 rounded-full bg-stone-soft grid place-items-center font-bold text-primary">
                    {profile.display_name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-sm">{profile.display_name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <Star className="size-3 fill-accent text-accent" /> {Number(profile.rating).toFixed(1)} · {profile.trades_count} صفقة
                    </div>
                  </div>
                </div>
              </Link>
            )}

            <Link
              to="/auth"
              className="w-full px-6 py-3.5 bg-foreground text-background rounded-xl font-bold hover:bg-primary transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeftRight className="size-4" /> اقترح مقايضة
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
