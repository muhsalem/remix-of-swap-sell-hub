import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Heart, X, ArrowLeftRight, Loader2, RotateCcw } from "lucide-react";
import { listActiveListings } from "@/lib/listings.functions";
import { Nav } from "@/components/Nav";
import { ListingImage } from "@/components/ListingImage";
import { LocalPrice } from "@/components/LocalPrice";
import { TrustScoreCard } from "@/components/TrustScoreCard";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/swipe")({
  component: SwipePage,
  head: () => ({
    meta: [
      { title: "المقايضة السريعة — تصفّح واسحب | بدِّل" },
      {
        name: "description",
        content: "تصفّح الإعلانات بأسلوب البطاقات: أعجبني أو تخطّي، وابدأ مقايضة فوراً عند الإعجاب.",
      },
      { property: "og:title", content: "المقايضة السريعة — بدِّل" },
      { property: "og:description", content: "بطاقات سريعة: أعجبني أو تخطّي وابدأ المقايضة فوراً." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="p-6 text-center">
        <p className="text-destructive mb-3">حدث خطأ: {error.message}</p>
        <Button onClick={() => { reset(); router.invalidate(); }}>إعادة المحاولة</Button>
      </div>
    );
  },
  notFoundComponent: () => <div className="p-6">الصفحة غير موجودة</div>,
});

function SwipePage() {
  const q = useQuery({ queryKey: ["swipe-listings"], queryFn: () => listActiveListings() });
  const [i, setI] = useState(0);
  const [liked, setLiked] = useState<string[]>([]);

  const deck = useMemo(() => (q.data?.listings ?? []) as any[], [q.data]);
  const card = deck[i];

  const next = () => setI((v) => v + 1);
  const like = () => {
    if (card) setLiked((l) => [card.id, ...l].slice(0, 12));
    next();
  };

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="container max-w-2xl mx-auto px-4 py-8">
        <header className="mb-6 text-center">
          <h1 className="font-display text-2xl font-bold">المقايضة السريعة</h1>
          <p className="text-sm text-muted-foreground mt-1">
            بطاقة واحدة في كل مرة: أعجبني لبدء المقايضة، أو تخطّي للتالي.
          </p>
        </header>

        {q.isPending && (
          <div className="py-24 text-center text-muted-foreground">
            <Loader2 className="size-6 animate-spin mx-auto" />
          </div>
        )}

        {q.isSuccess && !card && (
          <div className="bg-card rounded-3xl ring-1 ring-black/5 p-10 text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              {deck.length === 0 ? "لا توجد إعلانات نشطة الآن." : "انتهت البطاقات — أعد الجولة أو تصفّح السوق."}
            </p>
            <div className="flex justify-center gap-2">
              <Button variant="secondary" onClick={() => setI(0)}>
                <RotateCcw className="size-4 ml-1" /> إعادة الجولة
              </Button>
              <Link to="/" className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-bold">
                تصفّح السوق
              </Link>
            </div>
          </div>
        )}

        {card && (
          <div className="bg-card rounded-3xl ring-1 ring-black/5 shadow-xl overflow-hidden">
            <div className="aspect-[4/3] overflow-hidden bg-stone-soft">
              <ListingImage path={card.images?.[0]} alt={card.title} />
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] px-2 py-0.5 bg-stone-soft rounded-full">{card.category}</span>
                <span className="text-sm font-bold text-primary"><LocalPrice sar={card.market_price} /></span>
              </div>
              <h2 className="font-bold text-lg">{card.title}</h2>
              <p className="text-sm text-muted-foreground">
                <span className="opacity-70">يريد:</span> {card.wants}
              </p>
              <TrustScoreCard userId={card.owner_id} />

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={next}
                  className="py-3 rounded-xl ring-1 ring-border font-bold text-sm flex items-center justify-center gap-2 hover:bg-stone-soft transition"
                >
                  <X className="size-4" /> تخطّي
                </button>
                <button
                  onClick={like}
                  className="py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition"
                >
                  <Heart className="size-4" /> أعجبني
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Link
                  to="/listings/$id"
                  params={{ id: card.id }}
                  className="text-center py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground"
                >
                  عرض التفاصيل
                </Link>
                <Link
                  to="/offer/$listingId"
                  params={{ listingId: card.id }}
                  className="text-center py-2.5 rounded-xl bg-foreground text-background text-xs font-bold flex items-center justify-center gap-2"
                >
                  <ArrowLeftRight className="size-3.5" /> اقترح مقايضة
                </Link>
              </div>
              <p className="text-[10px] text-center text-muted-foreground">
                البطاقة {Math.min(i + 1, deck.length)} من {deck.length}
              </p>
            </div>
          </div>
        )}

        {liked.length > 0 && (
          <section className="mt-8">
            <h3 className="font-bold text-sm mb-3">أعجبتك ({liked.length})</h3>
            <div className="flex flex-wrap gap-2">
              {liked.map((id) => {
                const l = deck.find((d) => d.id === id);
                if (!l) return null;
                return (
                  <Link
                    key={id}
                    to="/offer/$listingId"
                    params={{ listingId: id }}
                    className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold"
                  >
                    {l.title}
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
