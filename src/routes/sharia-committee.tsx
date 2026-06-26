import { createFileRoute } from "@tanstack/react-router";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/sharia-committee")({
  head: () => ({
    meta: [
      { title: "الهيئة الشرعية — منصة بدِّل" },
      { name: "description", content: "ضوابط الإشراف الشرعي على عمليات المقايضة في منصة بدِّل ومنع الربا والغرر والمحرمات." },
      { property: "og:title", content: "الهيئة الشرعية — منصة بدِّل" },
      { property: "og:description", content: "آلية الإشراف الشرعي والامتثال لأحكام المعاملات." },
    ],
  }),
  component: ShariaPage,
});

function ShariaPage() {
  return (
    <div className="min-h-dvh bg-background">
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-extrabold mb-3">⚖️ الهيئة الشرعية</h1>
        <p className="text-muted-foreground mb-10 text-lg">
          الإشراف الشرعي على عمليات المقايضة وضمان خلوّها من الربا والغرر.
        </p>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-3">المبادئ الحاكمة</h2>
          <ul className="space-y-2 list-disc pr-5 leading-relaxed">
            <li><strong>منع الربا:</strong> لا فوائد على فروقات الأسعار، فروقات نقدية ثابتة وقت الاتفاق فقط.</li>
            <li><strong>منع الغرر:</strong> إلزام بوصف دقيق للسلعة وحالتها وصورها الحقيقية.</li>
            <li><strong>تثبيت السعر (Anchor):</strong> السعر الذي يُتفق عليه يُثبَّت 24 ساعة دون تأثر بتقلب العملات.</li>
            <li><strong>منع السلع المحرّمة:</strong> فلتر آلي يرفض الخمور، التبغ، أدوات القمار، ومنتجات المحرمات.</li>
            <li><strong>الضمان (Escrow):</strong> حفظ المقابل النقدي لدى المنصة حتى يستلم الطرفان السلعة.</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-3">الفلتر الشرعي الآلي</h2>
          <p className="leading-relaxed">
            يفحص كل إعلان قبل النشر باستخدام الذكاء الاصطناعي ومرجعية شرعية ثابتة (قوائم AAOIFI المعتمدة). الإعلانات المخالفة تُرفض تلقائياً وتُعرض على المراجع الشرعي.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-3">تشكيل الهيئة (قيد الاستكمال)</h2>
          <p className="leading-relaxed">
            تعمل المنصة على استقطاب مستشارين شرعيين معتمدين من <strong>AAOIFI</strong> و<strong>هيئة كبار العلماء</strong>. سيُعلَن عن أعضاء الهيئة فور اكتمال التشكيل، مع نشر فتاوى المعاملات الرئيسية.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-3">آلية الاستفتاء</h2>
          <p className="leading-relaxed">
            لأي استفسار شرعي حول صفقة قائمة، يمكن للمستخدم فتح طلب فتوى من صفحة الصفقة، ويُرد عليه خلال 72 ساعة عمل.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
