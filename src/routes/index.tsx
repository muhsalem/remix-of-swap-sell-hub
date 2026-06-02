import { createFileRoute } from "@tanstack/react-router";
import { PricingEngine } from "@/components/PricingEngine";
import cameraImg from "@/assets/product-camera.jpg";
import keyboardImg from "@/assets/product-keyboard.jpg";
import scooterImg from "@/assets/product-scooter.jpg";
import watchImg from "@/assets/product-watch.jpg";

export const Route = createFileRoute("/")({
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

type Listing = {
  title: string;
  wants: string;
  price: number;
  condition: string;
  img: string;
};

const LISTINGS: Listing[] = [
  { title: "كاميرا كانون M50", wants: "لاب توب أو عدسة 35mm", price: 5200, condition: "حالة ممتازة", img: cameraImg },
  { title: "لوحة مفاتيح ميكانيكية", wants: "شاشة ألعاب 24 بوصة", price: 850, condition: "جديد تقريباً", img: keyboardImg },
  { title: "سكوتر كهربائي", wants: "تابلت أو ساعة ذكية", price: 1400, condition: "مستعمل خفيف", img: scooterImg },
  { title: "ساعة كلاسيكية", wants: "عرض مناسب (إلكترونيات)", price: 2100, condition: "مغلّفة", img: watchImg },
];

function Index() {
  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground font-body">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800&family=Tajawal:wght@400;500&family=JetBrains+Mono&display=swap"
        rel="stylesheet"
      />

      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <span className="font-display text-2xl font-extrabold tracking-tighter text-primary">
              إيكال <span className="text-foreground">EQAL</span>
            </span>
            <div className="hidden md:flex gap-6 text-sm font-medium">
              <a href="#engine" className="text-primary">المقايضة</a>
              <a href="#market" className="hover:text-primary transition-colors">السوق</a>
              <a href="#how" className="hover:text-primary transition-colors">كيف يعمل؟</a>
            </div>
          </div>
          <button className="px-6 py-2.5 bg-foreground text-background rounded-full text-sm font-bold hover:bg-primary transition-all">
            ابدأ مقايضة جديدة
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div id="engine">
          <PricingEngine />
        </div>

        <section id="market">
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-display text-2xl font-extrabold">أحدث العروض المتاحة للمقايضة</h2>
            <div className="flex gap-2">
              <button className="px-4 py-2 rounded-lg border border-border hover:bg-stone-soft text-sm">فلاتر</button>
              <button className="px-4 py-2 rounded-lg border border-border hover:bg-stone-soft text-sm">ترتيب</button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {LISTINGS.map((l) => (
              <article
                key={l.title}
                className="group bg-card rounded-3xl p-4 ring-1 ring-black/5 hover:shadow-xl transition-all duration-500"
              >
                <div className="relative overflow-hidden rounded-2xl mb-4 aspect-[3/4] bg-stone-soft">
                  <img
                    src={l.img}
                    alt={l.title}
                    loading="lazy"
                    width={512}
                    height={640}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute top-3 right-3 px-3 py-1 bg-card/90 backdrop-blur text-[10px] font-bold rounded-full">
                    {l.condition}
                  </div>
                </div>
                <h3 className="font-bold mb-1">{l.title}</h3>
                <p className="text-xs text-muted-foreground mb-4">مطلوب: {l.wants}</p>
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <span className="text-sm font-bold">{l.price.toLocaleString()} ر.س</span>
                  <button className="text-primary text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                    قيّم للمقايضة ←
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="how" className="mt-24">
          <h2 className="font-display text-2xl font-extrabold mb-8">كيف تعمل المنصة؟</h2>
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
          <div className="flex gap-8 text-sm font-medium text-muted-foreground">
            <a href="#">سياسة الخصوصية</a>
            <a href="#">شروط الاستخدام</a>
            <a href="#">تواصل معنا</a>
          </div>
          <div className="text-xs text-muted-foreground font-mono">© 2026 EQAL AI ENGINE</div>
        </div>
      </footer>
    </div>
  );
}
