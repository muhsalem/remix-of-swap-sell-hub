import { Link } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeftRight, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getPublicStats, getMyStats } from "@/lib/stats.functions";
import { LocalPrice } from "@/components/LocalPrice";
import { MiniPricingEngine } from "@/components/MiniPricingEngine";

const publicStatsQ = queryOptions({
  queryKey: ["public-stats"],
  queryFn: () => getPublicStats(),
  staleTime: 60_000,
});

export function Hero() {
  const { user, loading } = useAuth();
  const isGuest = !loading && !user;
  const firstName =
    (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ||
    (user?.email ? user.email.split("@")[0] : "");

  const fetchPublic = useServerFn(getPublicStats);
  const { data: pub } = useQuery({ ...publicStatsQ, queryFn: () => fetchPublic() });
  const fetchMine = useServerFn(getMyStats);
  const { data: mine } = useQuery({
    queryKey: ["my-stats"],
    queryFn: () => fetchMine(),
    enabled: !!user,
  });

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-stone-soft via-background to-background py-20 md:py-28">
      <div className="absolute inset-0 -z-10 opacity-40">
        <div className="absolute top-20 right-1/4 size-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-10 left-1/4 size-96 rounded-full bg-accent/10 blur-3xl" />
      </div>
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary text-xs font-mono rounded-full uppercase tracking-wider mb-6">
              <Sparkles className="size-3" />
              {isGuest ? "أول منصة مقايضة ذكية في العالم العربي" : `مرحباً بعودتك${firstName ? `، ${firstName}` : ""}`}
            </div>
            <h1 className="font-display text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6">
              {isGuest ? (
                <>
                  بدّل ما تملك<br />بما تحتاج{" "}
                  <span className="relative inline-block text-primary">
                    بسهولة
                    <span className="absolute -bottom-1 left-0 right-0 h-2.5 bg-accent/40 -z-10 rounded-full" />
                  </span>.
                </>
              ) : (
                <>
                  جاهز لصفقتك<br />
                  <span className="relative inline-block text-primary">
                    التالية
                    <span className="absolute -bottom-1 left-0 right-0 h-2.5 bg-accent/40 -z-10 rounded-full" />
                  </span>؟
                </>
              )}
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg">
              {isGuest ? (
                <>منصة <strong className="text-foreground">بادل</strong> تحوّل ممتلكاتك الراكدة إلى صفقات عادلة عبر محرك تسعير ذكي يقيس قيمة كل سلعة وعدالة كل مقايضة.</>
              ) : (
                <>انشر عرضاً جديداً، تابع صفقاتك، أو ابحث عن مطابقات ذكية في السوق.</>
              )}
            </p>
            <div className="flex flex-wrap gap-3 mb-10">
              <Link to="/new-listing" className="px-6 py-3.5 bg-foreground text-background rounded-full text-sm font-bold hover:bg-primary transition-all inline-flex items-center gap-2">
                {isGuest ? "اعرض منتجك مجاناً" : "أضف عرضاً جديداً"} <ArrowLeftRight className="size-4" />
              </Link>
              <Link
                to={isGuest ? "/pricing-engine" : "/pricing-engine"}
                className="px-6 py-3.5 bg-card border border-border rounded-full text-sm font-bold hover:bg-stone-soft transition-all inline-flex items-center gap-2"
              >
                🧮 {isGuest ? "احسب ما يعادل منتجك" : "محرك التسعير العادل"}
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-6 max-w-lg pt-8 border-t border-border">
              {isGuest ? (
                <>
                  <Stat n={fmt(pub?.count)} t="عرض نشط الآن" />
                  <StatLocal sar={pub?.avgPriceSAR ?? 0} t="متوسط قيمة العروض" />
                  <StatHighlight n={<>0 <span className="opacity-80">رسوم</span></>} t="رسوم نشر العروض" />
                </>
              ) : (
                <>
                  <Stat n={fmt(mine?.activeListings)} t="إعلاناتي النشطة" />
                  <Stat n={fmt(mine?.completedDeals)} t="صفقات مكتملة" />
                  <StatHighlight
                    n={<LocalPrice sar={mine?.savedSAR ?? 0} />}
                    t="توفيرك التقديري"
                  />
                </>
              )}
            </div>
          </div>

          <div className="hidden lg:block relative">
            <MiniPricingEngine />
            <div className="absolute -top-3 -right-3 flex items-center gap-1.5 px-3 py-2 bg-accent text-accent-foreground rounded-full shadow-lg text-xs font-bold">
              <Sparkles className="size-4" /> تسعير عادل بالـ AI
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

function fmt(n: number | undefined | null) {
  if (n === undefined || n === null) return "—";
  return Number(n).toLocaleString();
}

function Stat({ n, t }: { n: React.ReactNode; t: string }) {
  return (
    <div>
      <div className="font-display text-2xl font-extrabold text-primary tabular-nums">{n}</div>
      <div className="text-[11px] text-muted-foreground mt-1 leading-snug">{t}</div>
    </div>
  );
}

function StatLocal({ sar, t }: { sar: number; t: string }) {
  return (
    <div>
      <div className="font-display text-2xl font-extrabold text-primary tabular-nums">
        {sar > 0 ? <LocalPrice sar={sar} /> : "—"}
      </div>
      <div className="text-[11px] text-muted-foreground mt-1 leading-snug">{t}</div>
    </div>
  );
}

function StatHighlight({ n, t }: { n: React.ReactNode; t: string }) {
  return (
    <div className="relative -mt-2 -mb-2 px-3 py-2 rounded-2xl bg-primary/5 ring-1 ring-primary/20">
      <div className="font-display text-2xl font-extrabold text-primary leading-none tabular-nums">{n}</div>
      <div className="text-[11px] text-foreground/80 mt-1 leading-snug font-bold">{t}</div>
    </div>
  );
}

