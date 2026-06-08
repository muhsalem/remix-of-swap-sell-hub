import { createFileRoute, Link } from "@tanstack/react-router";
import { Calculator, Sparkles, ArrowLeft, Repeat2, Scale } from "lucide-react";
import { Nav } from "@/components/Nav";
import { PricingEngine } from "@/components/PricingEngine";

export const Route = createFileRoute("/pricing-engine")({
  head: () => ({
    meta: [
      { title: "محرك التسعير العادل — احسب ما يعادل سلعتك بسلع وخدمات | بادل" },
      { name: "description", content: "احسب القيمة السوقية العادلة لأي سلعة أو خدمة، وشاهد ما يعادلها من سلع وخدمات أخرى على منصة بادل بعملتك المحلية." },
      { property: "og:title", content: "محرك التسعير العادل — بادل" },
      { property: "og:description", content: "احسب القيمة العادلة لأي سلعة وشاهد ما يعادلها من السوق بسلع وخدمات حقيقية." },
    ],
  }),
  component: PricingEnginePage,
});

function PricingEnginePage() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="container max-w-6xl mx-auto px-4 py-10">
        <nav className="text-xs text-muted-foreground mb-4 flex items-center gap-2">
          <Link to="/" className="hover:text-primary inline-flex items-center gap-1">
            <ArrowLeft className="size-3" /> الرئيسية
          </Link>
          <span>/</span>
          <span className="text-foreground">محرك التسعير العادل</span>
        </nav>

        <header className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-3">
            <Sparkles className="size-3.5" /> مدعوم بالذكاء الاصطناعي
          </div>
          <h1 className="font-display text-3xl md:text-5xl font-extrabold tracking-tight mb-3 flex items-center gap-3">
            <Calculator className="size-8 text-primary" />
            محرك التسعير العادل
          </h1>
          <p className="text-muted-foreground max-w-3xl leading-relaxed">
            احسب القيمة السوقية العادلة لأي سلعة أو خدمة، وشاهد <strong className="text-foreground">ما يعادلها فعلياً</strong> من سلع وخدمات منشورة على المنصة — معروضة بعملتك المحلية حسب بلدك.
          </p>
        </header>

        <div className="grid md:grid-cols-3 gap-3 mb-8">
          <Feature icon={<Scale className="size-5" />} title="عدالة قائمة على السوق" desc="نقارن سعرك بمتوسط السوق الفعلي للمنتجات المماثلة." />
          <Feature icon={<Repeat2 className="size-5" />} title="ما يعادلها بسلع وخدمات" desc="نقترح أقرب البدائل من السوق التي تساوي قيمة منتجك." />
          <Feature icon={<Sparkles className="size-5" />} title="بعملتك المحلية" desc="القيم تُعرض تلقائياً بعملة بلدك مع الحفاظ على المرجع." />
        </div>

        <section id="engine" className="rounded-3xl border border-border bg-card p-4 md:p-6 shadow-sm">
          <PricingEngine />
        </section>

        <p className="text-center text-xs text-muted-foreground mt-6">
          النتائج إرشادية — السعر النهائي يتحدد بالتفاوض بين الطرفين.
        </p>
      </main>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="size-9 rounded-xl bg-primary/10 text-primary grid place-items-center mb-2">{icon}</div>
      <div className="font-bold text-sm mb-1">{title}</div>
      <div className="text-xs text-muted-foreground leading-relaxed">{desc}</div>
    </div>
  );
}
