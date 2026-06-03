import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Search, Loader2, ArrowLeftRight, Sparkles, Star, Repeat2 } from "lucide-react";
import { matchListings } from "@/lib/listings.functions";
import { ListingImage } from "@/components/ListingImage";
import { PricingEngine } from "@/components/PricingEngine";

export function MatchFinder() {
  const [have, setHave] = useState("");
  const [want, setWant] = useState("");
  const fn = useServerFn(matchListings);
  const m = useMutation({
    mutationFn: () => fn({ data: { have, want } }),
  });

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ have: string; want: string }>).detail;
      if (!detail) return;
      setHave(detail.have);
      setWant(detail.want);
      setTimeout(() => m.mutate(), 50);
    };
    window.addEventListener("badel:match", handler);
    return () => window.removeEventListener("badel:match", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const matches = m.data?.matches ?? [];

  return (
    <section className="space-y-8 mb-16">
      {/* ===== Search bar ===== */}
      <div id="match-finder-search" className="bg-card rounded-3xl ring-1 ring-black/5 shadow-xl overflow-hidden scroll-mt-20">
        <div className="p-6 md:p-8 bg-gradient-to-br from-primary/8 via-card to-accent/5 border-b border-border">
          <div className="flex items-center gap-3 mb-3">
            <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-mono rounded-full uppercase tracking-wider flex items-center gap-1.5">
              <Repeat2 className="size-3" /> أُقايض / أبحث عن
            </span>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl">
            اكتب ما تملكه وما تبحث عنه، قيّم ممتلكاتك بمحرّك التسعير، وسنطابقك مع من يريد ما لديك.
          </p>

          <form
            onSubmit={(e) => { e.preventDefault(); if (have.trim() && want.trim()) m.mutate(); }}
            className="mt-5 grid md:grid-cols-[1fr_auto_1fr_auto] gap-3 items-stretch"
            dir="rtl"
          >
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">أملك</span>
              <input
                value={have}
                onChange={(e) => setHave(e.target.value)}
                maxLength={200}
                placeholder="مثال: آيفون 13 برو، 256GB"
                className="px-4 py-3 rounded-2xl bg-card border border-border text-sm outline-none focus:ring-2 ring-primary/30"
              />
            </label>
            <div className="hidden md:flex items-end justify-center pb-3">
              <ArrowLeftRight className="size-5 text-muted-foreground" />
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">وأبحث عن</span>
              <input
                value={want}
                onChange={(e) => setWant(e.target.value)}
                maxLength={200}
                placeholder="مثال: لابتوب ماك بوك"
                className="px-4 py-3 rounded-2xl bg-card border border-border text-sm outline-none focus:ring-2 ring-primary/30"
              />
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={!have.trim() || !want.trim() || m.isPending}
                className="w-full md:w-auto px-6 py-3 bg-primary text-primary-foreground rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50"
              >
                {m.isPending ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                ابحث
              </button>
            </div>
          </form>
        </div>

        {/* ===== Embedded pricing engine ===== */}
        <div className="p-4 md:p-6 bg-stone-soft/30">
          <PricingEngine embedded />
        </div>
      </div>

      {/* ===== Matches ===== */}
      <div className="bg-card rounded-3xl ring-1 ring-black/5 shadow-xl overflow-hidden">
        <div className="p-6 md:p-10 min-h-[160px]">
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
                        <span className="text-xs font-bold text-primary">{Number(l.market_price).toLocaleString()} ر.س</span>
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
          {!m.isSuccess && !m.isPending && !m.isError && (
            <p className="text-center text-sm text-muted-foreground py-8">
              اكتب ما تملكه وما تبحث عنه أعلاه ثم اضغط «ابحث» لعرض المطابقات.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
