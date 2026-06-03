import { createFileRoute, Link, notFound } from "@tanstack/react-router";

export const TERMS_VERSION = "1.0.0";

const DOCS: Record<string, { title: string; html: string }> = {
  terms: {
    title: "شروط الاستخدام — بادل بادل",
    html: `
      <h2>1. التعريف</h2>
      <p>بادل (بادل) منصة وساطة إلكترونية لتسهيل مقايضة السلع والخدمات بين الأفراد والشركات. المنصة ليست طرفًا في الصفقات ولا تملك المعروضات.</p>
      <h2>2. أهلية الاستخدام</h2>
      <p>يُشترط أن يكون المستخدم بالغًا (18+) كامل الأهلية القانونية. حسابات الشركات تتطلب توثيق السجل التجاري.</p>
      <h2>3. مسؤولية المستخدم</h2>
      <ul>
        <li>صحة بيانات العرض (الوصف، الصور، السعر، الحالة).</li>
        <li>الالتزام بأنظمة المملكة العربية السعودية والدول التي يستخدم منها المنصة.</li>
        <li>عدم عرض سلع محظورة شرعًا أو نظامًا (مخدرات، أسلحة، مسروقات…).</li>
      </ul>
      <h2>4. حدود مسؤولية المنصة</h2>
      <p>المنصة تقدم أدوات تقييم (محرك بادل) ولكنها لا تضمن نتائج الصفقات. المستخدم يتحمل مخاطر التبادل بشكل كامل.</p>
      <h2>5. الرسوم والعمولات</h2>
      <p>قد تُفرض عمولة (3-5%) على الصفقات المكتملة. تُعلن الرسوم بوضوح قبل إتمام الصفقة.</p>
      <h2>6. إنهاء الحساب</h2>
      <p>يحق لبادل تعليق أو إغلاق أي حساب ينتهك هذه الشروط دون إشعار مسبق.</p>
      <h2>7. القانون الحاكم</h2>
      <p>تخضع هذه الشروط لأنظمة المملكة العربية السعودية، وأي نزاع يُحال للمحاكم المختصة بالرياض.</p>
      <p class="meta">الإصدار ${TERMS_VERSION} — آخر تحديث: 2026/06/03</p>
    `,
  },
  privacy: {
    title: "سياسة الخصوصية — بادل بادل",
    html: `
      <h2>1. البيانات التي نجمعها</h2>
      <ul>
        <li>بيانات الحساب: الاسم، البريد، رقم الجوال (اختياري).</li>
        <li>بيانات الشركات: السجل التجاري، اسم المنشأة.</li>
        <li>بيانات الاستخدام: العروض، الرسائل، التقييمات.</li>
      </ul>
      <h2>2. الاستخدام</h2>
      <p>نستخدم بياناتك لتشغيل المنصة، مطابقة العروض، تحسين الأداء، والامتثال للأنظمة.</p>
      <h2>3. الإفصاح</h2>
      <p>لا نبيع بياناتك. قد نُفصح للجهات الحكومية بأمر قضائي فقط.</p>
      <h2>4. حقوقك (وفق نظام حماية البيانات الشخصية السعودي PDPL)</h2>
      <ul>
        <li>الاطلاع على بياناتك وتعديلها.</li>
        <li>طلب حذف حسابك.</li>
        <li>سحب الموافقة على المعالجة.</li>
      </ul>
      <h2>5. الأمان</h2>
      <p>نستخدم تشفير HTTPS، صلاحيات صارمة على قاعدة البيانات (RLS)، ومراقبة مستمرة.</p>
      <h2>6. الاتصال</h2>
      <p>للاستفسارات: privacy@eqal.app</p>
      <p class="meta">الإصدار ${TERMS_VERSION}</p>
    `,
  },
  "barter-agreement": {
    title: "اتفاقية المقايضة — بادل بادل",
    html: `
      <h2>1. طبيعة العقد</h2>
      <p>المقايضة عبر بادل عقد ثنائي مباشر بين الطرفين (أ) و(ب)، تطبق عليه أحكام عقد البيع في النظام السعودي وأحكام الفقه الإسلامي.</p>
      <h2>2. أركان العقد</h2>
      <ul>
        <li>الإيجاب والقبول (عبر قبول العرض في المنصة).</li>
        <li>المعقود عليه (السلعتان أو السلعة + الفرق النقدي).</li>
        <li>التراضي بدون إكراه.</li>
      </ul>
      <h2>3. التسليم</h2>
      <p>يلتزم الطرفان بالتسليم في الوقت والمكان المتفق عليهما. تأخر أحد الطرفين يعطي الآخر حق الفسخ.</p>
      <h2>4. الضمان</h2>
      <p>كل طرف يضمن خلو سلعته من العيوب المُخفاة. اكتشاف عيب مخفي خلال 7 أيام يعطي حق الرد.</p>
      <h2>5. النزاعات</h2>
      <p>أي نزاع يُحل أولًا عبر نظام النزاعات في بادل (تحكيم داخلي)، ثم القضاء السعودي إن لم يُحسم.</p>
      <h2>6. الإلغاء</h2>
      <p>يحق إلغاء الصفقة قبل قبولها. بعد القبول، يلزم اتفاق الطرفين أو حكم تحكيم.</p>
    `,
  },
  "anti-riba": {
    title: "سياسة مكافحة الربا — بادل بادل",
    html: `
      <h2>المبدأ</h2>
      <p>بادل منصة شرعية تلتزم بأحكام البيع والصرف في الفقه الإسلامي، وتمنع تقنيًا أي معاملة تقع في الربا (فضل/نسيئة).</p>
      <h2>الأصناف الربوية</h2>
      <p>الذهب، الفضة، النقود (بكل عملاتها)، القمح، الشعير، التمر، الملح.</p>
      <h2>القواعد المُطبّقة آليًا</h2>
      <ul>
        <li><b>صنف ربوي بنفسه</b> (ذهب بذهب، ريال بريال): يجب التماثل التام والتقابض الفوري. أي تفاوت أو فرق نقدي = <b>رفض تلقائي</b>.</li>
        <li><b>ربوي بربوي مختلف</b> (ذهب بفضة، ريال بدولار): يجوز التفاضل لكن يجب التقابض الفوري — أي تأجيل تسليم = رفض تلقائي.</li>
        <li><b>ربوي بسلعة + فرق نقدي</b>: يُسمح فقط مع التقابض الفوري وعدم التأجيل.</li>
      </ul>
      <h2>محرك الفحص</h2>
      <p>يُشغّل المحرك على كل عرض قبل إنشائه، ويرفض المعاملات التي تخالف القواعد أعلاه برسالة واضحة للمستخدم.</p>
      <h2>الإشراف الشرعي</h2>
      <p>تخضع قواعد المحرك لمراجعة دورية من مستشار شرعي معتمد.</p>
    `,
  },
};

export const Route = createFileRoute("/legal/$doc")({
  loader: ({ params }) => {
    const d = DOCS[params.doc];
    if (!d) throw notFound();
    return { doc: d, slug: params.doc };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.doc.title ?? "وثيقة قانونية — بادل" },
      { name: "description", content: `${loaderData?.doc.title ?? "وثيقة قانونية"} — منصة بادل للمقايضة العادلة.` },
    ],
  }),
  component: LegalDoc,
  notFoundComponent: () => (
    <div dir="rtl" className="min-h-screen flex items-center justify-center">
      <p>الوثيقة غير موجودة. <Link to="/" className="text-primary underline">العودة</Link></p>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div dir="rtl" className="min-h-screen flex items-center justify-center p-8">
      <p className="text-destructive">خطأ: {error.message}</p>
    </div>
  ),
});

function LegalDoc() {
  const { doc } = Route.useLoaderData();
  return (
    <div dir="rtl" className="min-h-screen bg-background font-body">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/" className="font-display text-2xl font-extrabold text-primary">بادل بادل</Link>
          <nav className="flex gap-4 text-xs text-muted-foreground">
            <Link to="/legal/$doc" params={{ doc: "terms" }} className="hover:text-foreground">الشروط</Link>
            <Link to="/legal/$doc" params={{ doc: "privacy" }} className="hover:text-foreground">الخصوصية</Link>
            <Link to="/legal/$doc" params={{ doc: "barter-agreement" }} className="hover:text-foreground">اتفاقية المقايضة</Link>
            <Link to="/legal/$doc" params={{ doc: "anti-riba" }} className="hover:text-foreground">مكافحة الربا</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="font-display text-4xl font-extrabold mb-8">{doc.title}</h1>
        <article
          className="prose-legal space-y-4 leading-loose text-foreground/90"
          dangerouslySetInnerHTML={{ __html: doc.html }}
        />
      </main>
      <style>{`
        .prose-legal h2 { font-weight: 800; font-size: 1.25rem; margin-top: 2rem; color: hsl(var(--primary)); }
        .prose-legal ul { list-style: disc; padding-inline-start: 1.5rem; }
        .prose-legal .meta { font-size: 0.75rem; color: hsl(var(--muted-foreground)); margin-top: 2rem; }
      `}</style>
    </div>
  );
}
