import { Link } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeftRight, Shield, Sparkles, TrendingUp, BadgeCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getPublicStats, getMyStats } from "@/lib/stats.functions";

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
                to={isGuest ? "/" : "/offers"}
                hash={isGuest ? "engine" : undefined}
                className="px-6 py-3.5 bg-card border border-border rounded-full text-sm font-bold hover:bg-stone-soft transition-all"
              >
                {isGuest ? "جرّب محرك التسعير" : "صفقاتي"}
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-6 max-w-lg pt-8 border-t border-border">
              {isGuest ? (
                <>
                  <Stat n={fmt(pub?.count)} t="عرض نشط الآن" />
                  <Stat n={pub?.avgPriceSAR ? `${fmt(pub.avgPriceSAR)} ر.س` : "—"} t="متوسط قيمة العروض" />
                  <StatHighlight n="0 ر.س" t="رسوم نشر العروض" />
                </>
              ) : (
                <>
                  <Stat n={fmt(mine?.activeListings)} t="إعلاناتي النشطة" />
                  <Stat n={fmt(mine?.completedDeals)} t="صفقات مكتملة" />
                  <StatHighlight
                    n={mine?.savedSAR ? `${fmt(mine.savedSAR)} ر.س` : "0 ر.س"}
                    t="توفيرك التقديري"
                  />
                </>
              )}
            </div>
          </div>

          <div className="hidden lg:block relative">
            <div className="relative bg-card rounded-3xl p-6 shadow-2xl ring-1 ring-black/5 rotate-2 hover:rotate-0 transition-transform duration-700">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono text-muted-foreground">مقايضة #2847</span>
                <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full">عادلة 94%</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Card title="آيفون 14 برو" price="4,200" />
                <Card title="سماعات Sony" price="1,850" />
              </div>
              <div className="mt-4 p-3 bg-primary text-primary-foreground rounded-2xl text-xs">
                <strong>توصية AI:</strong> أضف مبلغ 950 ر.س لموازنة الصفقة.
              </div>
            </div>
            <Badge icon={<Shield className="size-4" />} label="مقايضات موثّقة" cls="-top-3 -right-3 bg-accent" />
            <Badge
              icon={isGuest ? <TrendingUp className="size-4" /> : <BadgeCheck className="size-4" />}
              label={isGuest ? "قيم متطورة" : "حسابك جاهز"}
              cls="-bottom-3 -left-3 bg-primary text-primary-foreground"
            />
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

function Stat({ n, t }: { n: string; t: string }) {
  return (
    <div>
      <div className="font-display text-2xl font-extrabold text-primary tabular-nums">{n}</div>
      <div className="text-[11px] text-muted-foreground mt-1 leading-snug">{t}</div>
    </div>
  );
}

function StatHighlight({ n, t }: { n: string; t: string }) {
  return (
    <div className="relative -mt-2 -mb-2 px-3 py-2 rounded-2xl bg-primary/5 ring-1 ring-primary/20">
      <div className="font-display text-2xl font-extrabold text-primary leading-none tabular-nums">{n}</div>
      <div className="text-[11px] text-foreground/80 mt-1 leading-snug font-bold">{t}</div>
    </div>
  );
}

function Card({ title, price }: { title: string; price: string }) {
  return (
    <div className="bg-stone-soft rounded-2xl p-3">
      <div className="aspect-square bg-card rounded-xl mb-2" />
      <div className="text-xs font-bold truncate">{title}</div>
      <div className="text-[10px] text-muted-foreground">{price} ر.س</div>
    </div>
  );
}

function Badge({ icon, label, cls }: { icon: React.ReactNode; label: string; cls: string }) {
  return (
    <div className={`absolute ${cls} flex items-center gap-1.5 px-3 py-2 bg-card rounded-full shadow-lg text-xs font-bold`}>
      {icon} {label}
    </div>
  );
}
