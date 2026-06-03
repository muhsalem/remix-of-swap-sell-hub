import { Link } from "@tanstack/react-router";
import { ArrowLeftRight, Shield, Sparkles, TrendingUp } from "lucide-react";

export function Hero() {
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
              <Sparkles className="size-3" /> أول منصة مقايضة ذكية في العالم العربي
            </div>
            <h1 className="font-display text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6">
              بدّل ما تملك
              <br />
              بما تحتاج{" "}
              <span className="relative inline-block text-primary">
                بسهولة
                <span className="absolute -bottom-1 left-0 right-0 h-2.5 bg-accent/40 -z-10 rounded-full" />
              </span>
              .
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg">
              منصة <strong className="text-foreground">بادل</strong> تحوّل ممتلكاتك الراكدة إلى صفقات عادلة عبر محرك تسعير ذكي يقيس قيمة كل سلعة وعدالة كل مقايضة بأربعة مستويات تصنيف دولية.
            </p>
            <div className="flex flex-wrap gap-3 mb-10">
              <Link
                to="/new-listing"
                className="px-6 py-3.5 bg-foreground text-background rounded-full text-sm font-bold hover:bg-primary transition-all inline-flex items-center gap-2"
              >
                اعرض منتجك مجاناً <ArrowLeftRight className="size-4" />
              </Link>
              <Link
                to="/"
                hash="engine"
                className="px-6 py-3.5 bg-card border border-border rounded-full text-sm font-bold hover:bg-stone-soft transition-all"
              >
                جرّب محرك التسعير
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-6 max-w-lg pt-8 border-t border-border">
              <Stat n="80%" t="من المستعمل يُباع بأقل من قيمته" />
              <Stat n="100%" t="تقييم مدعوم بالذكاء الاصطناعي" />
              <Stat n="0 ر.س" t="رسوم نشر العروض" />
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
            <Badge icon={<TrendingUp className="size-4" />} label="قيم متطورة" cls="-bottom-3 -left-3 bg-primary text-primary-foreground" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ n, t }: { n: string; t: string }) {
  return (
    <div>
      <div className="font-display text-2xl font-extrabold text-primary">{n}</div>
      <div className="text-[11px] text-muted-foreground mt-1 leading-snug">{t}</div>
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
