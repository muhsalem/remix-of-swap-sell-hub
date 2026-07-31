import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Sparkles, Star, Repeat2 } from "lucide-react";
import { matchListings } from "@/lib/listings.functions";
import { ListingImage } from "@/components/ListingImage";
import { LocalPrice } from "@/components/LocalPrice";
import { BarterPricingEngine } from "@/components/BarterPricingEngine";

export function MatchFinder() {
  const fn = useServerFn(matchListings);
  const m = useMutation({
    mutationFn: (vars: { have: string; want: string }) => fn({ data: vars }),
  });
  const [meta, setMeta] = useState<{ have: string; want: string } | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ have: string; want: string }>).detail;
      if (!detail) return;
      setMeta(detail);
      m.mutate(detail);
    };
    window.addEventListener("badel:match", handler);
    return () => window.removeEventListener("badel:match", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const matches = m.data?.matches ?? [];

  return (
    <section className="space-y-8 mb-16">
      {/* ===== Pricing engine ===== */}
      <div id="match-finder-search" className="bg-card rounded-3xl ring-1 ring-black/5 shadow-xl overflow-hidden scroll-mt-20">
        <div className="p-4 md:p-6 bg-stone-soft/30">
          <BarterPricingEngine embedded />
        </div>
      </div>

      {/* ===== Matches (rendered only when search triggered) ===== */}
      {(m.isPending || m.isSuccess || m.isError) && (
        <div className="bg-card rounded-3xl ring-1 ring-black/5 shadow-xl overflow-hidden">
          <div className="p-6 md:p-10 min-h-[160px]">
            {meta && (
              <div className="text-xs text-muted-foreground font-bold mb-3">
                نتائج المقايضة: تملك «{meta.have}» وتبحث عن «{meta.want}»
              </div>
            )}
            {m.isError && <p className="text-center text-destructive text-sm">{(m.error as Error).message}</p>}
            {m.isSuccess && matches.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Sparkles className="size-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">لم نجد إعلانات مطابقة الآن — جرّب كلمات مختلفة أو اعرض إعلانك حتى يجدك آخرون.</p>
                <Link to="/new-listing" className="inline-block mt-4 px-5 py-2.5 bg-primary text-primary-foreground rounded-full text-sm font-bold">
                  أنشئ إعلانك
                </Link>
              </div>
            )}
            {matches.length > 0 && (
              <>
                <h3 className="font-display font-bold text-lg mb-4">
                  {matches.length} مطابقة محتملة
                  <span className="text-muted-foreground text-sm font-normal mr-2">— الأعلى نقاطاً الأكثر ملاءمة</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {matches.map((l: any) => (
                    <Link
                      key={l.id}
                      to="/listings/$id"
                      params={{ id: l.id }}
                      className="bg-card rounded-2xl ring-1 ring-black/5 overflow-hidden hover:ring-primary/40 hover:-translate-y-0.5 transition-all"
                    >
                      <div className="aspect-[4/3] overflow-hidden">
                        <ListingImage path={l.images?.[0]} alt={l.title} />
                      </div>
                      <div className="p-4 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] px-2 py-0.5 bg-stone-soft rounded-full">{l.category}</span>
                          {l._mutual && (
                            <span className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full font-bold flex items-center gap-1">
                              <Repeat2 className="size-3" /> مطابقة متبادلة
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-sm truncate">{l.title}</h4>
                        <p className="text-xs text-muted-foreground truncate">
                          <span className="opacity-70">يريد:</span> {l.wants}
                        </p>
                        <div className="flex items-center justify-between pt-2 border-t border-border">
                          <span className="text-xs font-bold text-primary"><LocalPrice sar={l.market_price} /></span>
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Star className="size-3 fill-accent text-accent" />
                            {Number(l.profiles?.rating ?? 0).toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
