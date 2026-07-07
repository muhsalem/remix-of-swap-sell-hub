import { createFileRoute, Link } from "@tanstack/react-router";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "من نحن — منصة بدِّل" },
      { name: "description", content: "رؤية ورسالة منصة بدِّل: اقتصاد مقايضة عادل ومتوافق شرعياً يربط الأفراد والشركات في الشرق الأوسط." },
      { property: "og:title", content: "من نحن — منصة بدِّل" },
      { property: "og:description", content: "رؤية ورسالة منصة بدِّل لاقتصاد مقايضة عادل وذكي." },
      { property: "og:url", content: "https://badelbarter.lovable.app/about" },
      { property: "og:type", content: "article" },
    ],
    links: [{ rel: "canonical", href: "https://badelbarter.lovable.app/about" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "AboutPage",
        name: "من نحن — بدِّل",
        url: "https://badelbarter.lovable.app/about",
        inLanguage: "ar",
      }),
    }],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="min-h-dvh bg-background">
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-extrabold mb-3">من نحن</h1>
        <p className="text-muted-foreground mb-10 text-lg">
          بدِّل — اقتصاد مقايضة ذكي وعادل، مبني على قيم الشريعة الإسلامية.
        </p>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-3">رؤيتنا</h2>
          <p className="leading-relaxed">
            أن نكون المنصة الأولى عالمياً للمقايضة الذكية المتوافقة شرعياً، تمكّن كل فرد ومنشأة من تحويل ما يملكه إلى ما يحتاجه دون ربا ودون هدر.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-3">رسالتنا</h2>
          <p className="leading-relaxed">
            تمكين الاقتصاد الدائري في الشرق الأوسط من خلال أدوات ذكية للتسعير والمطابقة وضمان الصفقة، مع التزام كامل بالشفافية وحماية المستخدم.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-3">قيمنا</h2>
          <ul className="space-y-2 list-disc pr-5 leading-relaxed">
            <li><strong>الشرعية:</strong> منع الربا، الغرر، والسلع المحرّمة.</li>
            <li><strong>العدل:</strong> تسعير شفاف وضمان للطرفين عبر الـ Escrow.</li>
            <li><strong>الاستدامة:</strong> كل مقايضة تُقلل النفايات وتحفظ الموارد.</li>
            <li><strong>الخصوصية:</strong> بياناتك ملكك، لا تُباع لطرف ثالث.</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-3">المشكلة التي نحلّها</h2>
          <p className="leading-relaxed">
            أكثر من 40% من الأسر تملك سلعاً غير مستخدمة بقيمة مليارات، في حين يضطر آخرون لقروض بفائدة لشراء ما يحتاجونه. نُقدّم بديلاً عادلاً: قايِض بدل أن تقترض.
          </p>
        </section>

        <section className="mb-10 grid sm:grid-cols-2 gap-4">
          <Link to="/sharia-committee" className="block p-5 border rounded-2xl hover:bg-stone-soft transition">
            <h3 className="font-bold mb-1">⚖️ الهيئة الشرعية</h3>
            <p className="text-sm text-muted-foreground">آلية الإشراف الشرعي على المنصة.</p>
          </Link>
          <Link to="/legal/$doc" params={{ doc: "sla" }} className="block p-5 border rounded-2xl hover:bg-stone-soft transition">
            <h3 className="font-bold mb-1">📜 اتفاقية مستوى الخدمة</h3>
            <p className="text-sm text-muted-foreground">التزاماتنا تجاهك في الدعم وحل النزاعات.</p>
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
