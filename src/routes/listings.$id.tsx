import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getListing } from "@/lib/listings.functions";
import { Nav } from "@/components/Nav";
import { ListingImage } from "@/components/ListingImage";
import { ShareListing } from "@/components/ShareListing";
import { PromotionPanel } from "@/components/PromotionPanel";
import { FollowButton } from "@/components/FollowButton";
import { useAuth } from "@/lib/auth";
import { ArrowLeftRight, Calendar, Tag, Star, Sparkles, Pin } from "lucide-react";
import { LocalPrice } from "@/components/LocalPrice";
import { formatSAR } from "@/lib/format-price";
import { CountrySwitcher } from "@/components/CountrySwitcher";
import { MarketReferencePrice } from "@/components/MarketReferencePrice";
import { TrustScoreCard } from "@/components/TrustScoreCard";

import { supabase } from "@/integrations/supabase/client";

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
  head: ({ loaderData, params }) => {
    const l = loaderData?.listing;
    if (!l) return { meta: [{ title: "عرض غير موجود — بادل" }] };
    const desc = `للمقايضة: ${l.title} — مطلوب: ${l.wants} — السعر السوقي ${formatSAR(Number(l.market_price))}.`;
    const ogImagePath = l.images?.[0];
    const ogImage = ogImagePath
      ? supabase.storage.from("listing-images").getPublicUrl(ogImagePath).data.publicUrl
      : undefined;
    const url = `/listings/${params.id}`;
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: l.title,
      description: desc,
      category: l.category,
      ...(ogImage ? { image: ogImage } : {}),
      offers: {
        "@type": "Offer",
        priceCurrency: "SAR",
        price: Number(l.market_price ?? 0),
        availability: "https://schema.org/InStock",
        url,
      },
    };
    return {
      meta: [
        { title: `${l.title} — بادل` },
        { name: "description", content: desc },
        { property: "og:title", content: l.title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "product" },
        { property: "og:url", content: url },
        ...(ogImage ? [
          { property: "og:image", content: ogImage },
          { name: "twitter:image", content: ogImage },
          { name: "twitter:card", content: "summary_large_image" },
        ] : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(jsonLd) },
      ],
    };
  },
  errorComponent: ({ error }) => <div className="p-12 text-center">{error.message}</div>,
  notFoundComponent: () => <div className="p-12 text-center">العرض غير موجود</div>,
  component: ListingPage,
});

function ListingPage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(listingQuery(id));
  const l = data.listing!;
  const { user } = useAuth();
  const profile = (l as { profiles?: { display_name: string; avatar_url: string | null; rating: number; trades_count: number; bio: string | null } }).profiles;
  const isFeatured = (l as { is_featured?: boolean; featured_until?: string }).is_featured && new Date((l as { featured_until?: string }).featured_until ?? 0) > new Date();
  const isPinned = (l as { is_pinned?: boolean; pinned_until?: string }).is_pinned && new Date((l as { pinned_until?: string }).pinned_until ?? 0) > new Date();

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
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary font-mono rounded-full">{l.category}</span>
                {l.is_ribawi && <span className="text-xs px-2 py-0.5 bg-accent/20 text-accent-foreground font-bold rounded-full">صنف ربوي</span>}
                {isFeatured && <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 font-bold rounded-full inline-flex items-center gap-1"><Sparkles className="size-3" /> مميز</span>}
                {isPinned && <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 font-bold rounded-full inline-flex items-center gap-1"><Pin className="size-3" /> مثبّت</span>}
              </div>
              <h1 className="font-display text-3xl font-extrabold mb-3">{l.title}</h1>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Tag className="size-3" /> {l.condition}</span>
                <span className="flex items-center gap-1"><Calendar className="size-3" /> {l.age_months} شهر</span>
              </div>
            </div>

            {l.description && <p className="text-sm text-muted-foreground leading-relaxed">{l.description}</p>}

            <div className="bg-card rounded-2xl p-5 ring-1 ring-black/5">
              <div className="flex items-center justify-between gap-3 mb-1">
                <span className="text-xs text-muted-foreground">السعر السوقي (وفق بلدك)</span>
                <CountrySwitcher />
              </div>
              <div className="font-display text-3xl font-extrabold text-primary">
                <LocalPrice sar={l.market_price} showOriginal />
              </div>
              <MarketReferencePrice
                category={l.category}
                title={l.title}
                listingPriceSar={Number(l.market_price)}
              />
            </div>


            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <ArrowLeftRight className="size-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-primary">مطلوب للمقايضة</span>
              </div>
              <p className="font-bold">{l.wants}</p>
            </div>

            {profile && (
              <div className="bg-card rounded-2xl p-4 ring-1 ring-black/5">
                <div className="flex items-center gap-3">
                  <div className="size-12 rounded-full bg-stone-soft grid place-items-center font-bold text-primary">
                    {profile.display_name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{profile.display_name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <Star className="size-3 fill-accent text-accent" /> {Number(profile.rating).toFixed(1)} · {profile.trades_count} صفقة
                    </div>
                  </div>
                  <FollowButton userId={l.owner_id} currentUserId={user?.id ?? null} />
                </div>
              </div>
            )}

            {l.owner_id && (
              <TrustScoreCard userId={l.owner_id} />
            )}

            <Link
              to="/offer/$listingId"
              params={{ listingId: l.id }}
              className="w-full px-6 py-3.5 bg-foreground text-background rounded-xl font-bold hover:bg-primary transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeftRight className="size-4" aria-hidden /> اقترح مقايضة
            </Link>

            <ShareListing title={l.title} wants={l.wants} />

            <PromotionPanel listingId={l.id} ownerId={l.owner_id} currentUserId={user?.id ?? null} />
          </div>
        </div>
      </main>
    </div>
  );
}
