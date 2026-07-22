import { Star, Quote } from "lucide-react";

const ITEMS = [
  {
    name: "أحمد المطيري",
    role: "تاجر إلكترونيات — الرياض",
    text: "بدّلت لابتوبي القديم بجوال حديث + مبلغ نقدي بسيط. محرك التسعير أظهر لي الفرق بالضبط والصفقة تمت خلال يومين.",
    rating: 5,
  },
  {
    name: "منى إبراهيم",
    role: "مصممة داخلية — القاهرة",
    text: "استخدمت المنصة لمقايضة أثاث مكتبي مقابل خدمات تصوير. عدالة الصفقة كانت واضحة، والدعم رد خلال ساعة.",
    rating: 5,
  },
  {
    name: "خالد الغامدي",
    role: "مستخدم عادي — جدة",
    text: "أول مرة أستخدم منصة مقايضة عربية بهذا المستوى. التوثيق الشرعي أعطاني ثقة كاملة قبل إتمام الصفقة.",
    rating: 5,
  },
];

export function Testimonials() {
  return (
    <section className="py-16 md:py-20 bg-stone-soft/50" id="testimonials">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary text-xs font-mono rounded-full uppercase tracking-wider mb-4">
            <Star className="size-3 fill-current" />
            آراء المستخدمين
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-extrabold">
            صفقات حقيقية. رضا حقيقي.
          </h2>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
            آلاف المستخدمين وثقوا ببدِّل لتحويل ما يملكونه إلى ما يحتاجونه — بعدالة وشفافية.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {ITEMS.map((t) => (
            <article
              key={t.name}
              className="bg-card rounded-3xl ring-1 ring-black/5 p-6 flex flex-col gap-4 hover:shadow-lg transition-shadow"
            >
              <Quote className="size-6 text-primary/40" />
              <p className="text-sm leading-relaxed text-foreground flex-1">{t.text}</p>
              <div className="flex items-center gap-1">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star key={i} className="size-4 fill-accent text-accent" />
                ))}
              </div>
              <div className="pt-3 border-t border-border">
                <div className="font-bold text-sm">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.role}</div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
