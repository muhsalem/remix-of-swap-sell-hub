import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const TERMS_VERSION = "1.1.0";

type Country = "SA" | "EG";

const COUNTRY_META: Record<Country, {
  label: string;
  flag: string;
  law_privacy: string;
  regulator: string;
  regulator_email: string;
  vat: string;
  currency: string;
  courts: string;
  ecommerce_law: string;
  consumer_law: string;
  min_age: string;
  retention_tax_years: number;
}> = {
  SA: {
    label: "المملكة العربية السعودية",
    flag: "🇸🇦",
    law_privacy: "نظام حماية البيانات الشخصية السعودي (PDPL) الصادر بالمرسوم الملكي م/19 لعام 1443هـ ولوائحه التنفيذية",
    regulator: "الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا)",
    regulator_email: "https://sdaia.gov.sa",
    vat: "15%",
    currency: "الريال السعودي (ر.س)",
    courts: "المحاكم المختصة بمدينة الرياض",
    ecommerce_law: "نظام التجارة الإلكترونية السعودي (م/126) ولائحته التنفيذية",
    consumer_law: "نظام مكافحة الغش التجاري ونظام حماية المستهلك السعودي",
    min_age: "18 سنة ميلادية (سن الرشد النظامي)",
    retention_tax_years: 10,
  },
  EG: {
    label: "جمهورية مصر العربية",
    flag: "🇪🇬",
    law_privacy: "قانون حماية البيانات الشخصية المصري رقم 151 لسنة 2020 ولائحته التنفيذية",
    regulator: "المركز المصري لحماية البيانات الشخصية (DPC)",
    regulator_email: "https://dpc.gov.eg",
    vat: "14%",
    currency: "الجنيه المصري (ج.م)",
    courts: "المحاكم المصرية المختصة (محكمة القاهرة الاقتصادية)",
    ecommerce_law: "قانون تنظيم الاتصالات رقم 10 لسنة 2003 وقانون مكافحة جرائم تقنية المعلومات رقم 175 لسنة 2018",
    consumer_law: "قانون حماية المستهلك المصري رقم 181 لسنة 2018 ولائحته التنفيذية",
    min_age: "21 سنة ميلادية (سن الرشد المدني) — يجوز للقاصر المأذون بالتجارة الاستخدام بموافقة الولي",
    retention_tax_years: 5,
  },
};

function buildDocs(country: Country): Record<string, { title: string; html: string }> {
  const c = COUNTRY_META[country];

  return {
    terms: {
      title: `شروط الاستخدام — بادل بادل (${c.label})`,
      html: `
        <div class="country-banner">🌐 هذه الصياغة مُطبَّقة على المستخدمين في <b>${c.flag} ${c.label}</b>. غيّر الدولة من أعلى الصفحة لعرض الصياغة الأخرى.</div>

        <h2>1. التعريف</h2>
        <p>بادل (بادل) منصة وساطة إلكترونية لتسهيل مقايضة السلع والخدمات بين الأفراد والشركات. المنصة ليست طرفًا في الصفقات ولا تملك المعروضات، وتخضع في ${c.label} لأحكام ${c.ecommerce_law}.</p>

        <h2>2. أهلية الاستخدام</h2>
        <p>يُشترط أن يكون المستخدم بالغًا (${c.min_age}) كامل الأهلية القانونية. حسابات الشركات تتطلب توثيق ${country === "SA" ? "السجل التجاري السعودي والرقم الضريبي (VAT)" : "السجل التجاري المصري والبطاقة الضريبية والرقم القومي للممثل"}.</p>

        <h2>3. مسؤولية المستخدم</h2>
        <ul>
          <li>صحة بيانات العرض (الوصف، الصور، السعر، الحالة).</li>
          <li>الالتزام بأنظمة ${c.label} بما فيها ${c.consumer_law}.</li>
          <li>عدم عرض سلع محظورة شرعًا أو نظامًا (مخدرات، أسلحة، مسروقات، عملات مقلدة، منتجات تتطلب ترخيصًا…).</li>
          ${country === "EG"
            ? `<li>الالتزام بأحكام <b>قانون مكافحة جرائم تقنية المعلومات رقم 175 لسنة 2018</b>.</li>`
            : `<li>الالتزام بأحكام <b>نظام مكافحة جرائم المعلوماتية</b> الصادر بالمرسوم الملكي م/17.</li>`}
        </ul>

        <h2>4. حدود مسؤولية المنصة</h2>
        <p>المنصة تقدم أدوات تقييم (محرك بادل) ولكنها لا تضمن نتائج الصفقات. المستخدم يتحمل مخاطر التبادل بشكل كامل، مع احتفاظه بحقوقه المقررة في ${c.consumer_law}.</p>

        <h2>5. الرسوم والعمولات</h2>
        <p>قد تُفرض عمولة (3-5%) على الصفقات المكتملة بعملة ${c.currency}. تُضاف ضريبة القيمة المضافة بواقع <b>${c.vat}</b> على مبلغ العمولة فقط، ولا تُفرض على قيمة السلعة المتبادلة. تُعلن كل الرسوم بوضوح قبل إتمام الصفقة.</p>

        <h2>6. إنهاء الحساب</h2>
        <p>يحق لبادل تعليق أو إغلاق أي حساب ينتهك هذه الشروط، مع منح المستخدم مهلة استرداد بياناته لمدة 30 يومًا وفق ${c.law_privacy}.</p>

        <h2>7. القانون الحاكم والاختصاص القضائي</h2>
        <p>تخضع هذه الشروط لأنظمة وقوانين <b>${c.label}</b>، وأي نزاع يتعذّر حلّه وديًا عبر نظام النزاعات الداخلي يُحال إلى <b>${c.courts}</b>. يوافق الطرفان صراحةً على هذا الاختصاص القضائي الحصري.</p>

        <p class="meta">الإصدار ${TERMS_VERSION} — الدولة: ${c.flag} ${c.label} — آخر تحديث: 2026/07/09</p>
      `,
    },

    privacy: {
      title: `سياسة الخصوصية — بادل بادل (${c.label})`,
      html: `
        <div class="country-banner">🌐 الصياغة الحالية وفق قانون <b>${c.flag} ${c.label}</b>.</div>

        <p>تُوضّح هذه السياسة كيف تجمع منصة <b>بادل</b> بياناتك الشخصية وتستخدمها وتحميها، وفقًا لـ <b>${c.law_privacy}</b>. باستخدامك للمنصة فأنت تؤكد قراءتك وقبولك لهذه السياسة.</p>

        <h2>1. البيانات التي نجمعها والغرض من كل نوع</h2>
        <table>
          <thead><tr><th>نوع البيانات</th><th>أمثلة</th><th>الغرض</th><th>الأساس القانوني</th></tr></thead>
          <tbody>
            <tr><td>بيانات الحساب</td><td>الاسم، البريد، كلمة المرور (مُجزّأة)</td><td>إنشاء الحساب</td><td>تنفيذ العقد</td></tr>
            <tr><td>بيانات التواصل</td><td>رقم الجوال، المدينة</td><td>إشعارات الصفقات والتسليم</td><td>الموافقة</td></tr>
            <tr><td>بيانات الشركات</td><td>${country === "SA" ? "السجل التجاري، الرقم الضريبي (VAT)" : "السجل التجاري، البطاقة الضريبية، الرقم القومي"}</td><td>توثيق الحسابات التجارية</td><td>التزام نظامي</td></tr>
            <tr><td>محتوى المستخدم</td><td>صور العروض، الأوصاف، الرسائل</td><td>عرض الإعلانات وتسهيل المقايضة</td><td>تنفيذ العقد</td></tr>
            <tr><td>بيانات المعاملات</td><td>العروض، التقييمات، سجل المحفظة</td><td>إتمام الصفقات وحماية الحقوق</td><td>تنفيذ العقد + التزام محاسبي/ضريبي</td></tr>
            <tr><td>بيانات تقنية</td><td>IP، نوع المتصفح، الجهاز، الكوكيز الضرورية</td><td>الأمان ومكافحة الاحتيال</td><td>المصلحة المشروعة</td></tr>
            <tr><td>بيانات تحليلية</td><td>الصفحات الأكثر زيارة</td><td>تحسين المنصة (مجهولة الهوية)</td><td>الموافقة</td></tr>
          </tbody>
        </table>

        <h2>2. مَن يصل لبياناتك؟</h2>
        <ul>
          <li><b>طرف المقايضة الآخر</b>: يرى الاسم الظاهر والتقييم ومحتوى الرسائل — لا يرى البريد أو الجوال إلا بعد قبول الصفقة.</li>
          <li><b>مزوّدو الخدمة</b>: استضافة سحابية، شركات الشحن، بوابات الدفع — بموجب اتفاقيات سرية ونقل بيانات متوافقة مع ${c.law_privacy}.</li>
          <li><b>الجهات الحكومية في ${c.label}</b>: فقط بأمر قضائي أو طلب نظامي رسمي.</li>
          <li><b>لا نبيع بياناتك ولا نشاركها لأغراض تسويقية لجهات خارجية.</b></li>
        </ul>

        <h2>3. مدة الاحتفاظ بالبيانات</h2>
        <ul>
          <li>بيانات الحساب: طوال نشاط الحساب + 90 يومًا بعد الإغلاق.</li>
          <li>سجل المعاملات: <b>${c.retention_tax_years} سنوات</b> (التزام محاسبي وضريبي في ${c.label}).</li>
          <li>الرسائل: 24 شهرًا ثم تُحذف تلقائيًا.</li>
          <li>السجلات الأمنية (audit_log): 5 سنوات للحماية من الاحتيال.</li>
        </ul>

        <h2>4. الكوكيز</h2>
        <ul>
          <li><b>ضرورية</b>: للجلسة والأمان — لا يمكن إيقافها.</li>
          <li><b>تحليلية</b>: تُفعَّل بموافقتك الصريحة فقط.</li>
          <li><b>تسويقية</b>: غير مُفعّلة حاليًا.</li>
        </ul>

        <h2>5. حقوقك القانونية</h2>
        <p>بموجب <b>${c.law_privacy}</b> تتمتع بالحقوق التالية:</p>
        <ul>
          <li>الحق في العلم بمعالجة بياناتك والاطلاع عليها والحصول على نسخة منها.</li>
          <li>الحق في التصحيح والتحديث والحذف ("الحق في النسيان") عدا ما يلزم حفظه نظامًا.</li>
          <li>الحق في تقييد المعالجة أو الاعتراض عليها.</li>
          <li>الحق في نقل بياناتك إلى مزوّد آخر بصيغة منظمة (Data Portability).</li>
          <li>الحق في سحب الموافقة في أي وقت دون التأثير على معالجة سابقة.</li>
          <li>الحق في تقديم شكوى لدى <b>${c.regulator}</b> (${c.regulator_email}).</li>
        </ul>

        <h2>6. إدارة الموافقة</h2>
        <ul>
          <li><a href="/profile">صفحة "حسابي"</a> ← قسم <b>"الخصوصية والموافقات"</b>.</li>
          <li>زر <b>"تنزيل بياناتي"</b>: ملف JSON شامل بكل بياناتك.</li>
          <li>زر <b>"حذف حسابي"</b>: طلب حذف نهائي خلال 30 يومًا.</li>
          <li>بريد المسؤول عن حماية البيانات (DPO): <b>dpo@badel.app</b>.</li>
        </ul>

        <h2>7. الأمان</h2>
        <p>نطبّق: تشفير الاتصال (TLS 1.3)، تجزئة كلمات المرور (bcrypt)، صلاحيات قاعدة بيانات صارمة (RLS لكل صف)، سجل تدقيق غير قابل للتعديل، ومراقبة استباقية للسلوك المشبوه.</p>

        <h2>8. نقل البيانات عبر الحدود</h2>
        <p>${country === "SA"
          ? "تُستضاف البيانات على بنية سحابية متوافقة مع PDPL. أي نقل خارج المملكة يتم عبر ضمانات تعاقدية معتمدة من سدايا (Standard Contractual Clauses)."
          : "يتم نقل البيانات خارج جمهورية مصر العربية عبر ضمانات تعاقدية معتمدة وفقًا للمادة 14 من قانون 151/2020 وبعد الحصول على تصريح المركز المصري لحماية البيانات عند اللزوم."}</p>

        <h2>9. الأطفال</h2>
        <p>المنصة غير مخصصة للقاصرين. عند اكتشاف حساب لقاصر يُغلق فورًا وتُحذف بياناته.</p>

        <h2>10. تعديل السياسة</h2>
        <p>عند أي تعديل جوهري نُشعرك بالبريد قبل 30 يومًا من السريان، ونطلب إعادة الموافقة.</p>

        <h2>11. التواصل</h2>
        <p>المسؤول عن حماية البيانات (DPO): <b>dpo@badel.app</b> — استفسارات عامة: <b>privacy@badel.app</b>.</p>

        <p class="meta">الإصدار ${TERMS_VERSION} — الدولة: ${c.flag} ${c.label} — آخر تحديث: 2026/07/09</p>
      `,
    },

    "barter-agreement": {
      title: `اتفاقية المقايضة — بادل بادل (${c.label})`,
      html: `
        <div class="country-banner">🌐 وفق أحكام <b>${c.flag} ${c.label}</b>.</div>
        <h2>1. طبيعة العقد</h2>
        <p>المقايضة عبر بادل عقد ثنائي مباشر بين الطرفين، تطبق عليه ${country === "SA"
          ? "أحكام عقد البيع في نظام المعاملات المدنية السعودي وأحكام الفقه الإسلامي"
          : "أحكام عقد المقايضة في المواد 482 إلى 486 من القانون المدني المصري (مع تطبيق أحكام البيع فيما لم يرد فيه نص خاص) وأحكام الفقه الإسلامي"}.</p>

        <h2>2. أركان العقد</h2>
        <ul>
          <li>الإيجاب والقبول (عبر قبول العرض في المنصة).</li>
          <li>المعقود عليه (السلعتان أو السلعة + الفرق النقدي بعملة ${c.currency}).</li>
          <li>التراضي بدون إكراه.</li>
        </ul>

        <h2>3. التسليم</h2>
        <p>يلتزم الطرفان بالتسليم في الوقت والمكان المتفق عليهما داخل ${c.label}. تأخر أحد الطرفين يعطي الآخر حق الفسخ وفق القواعد العامة.</p>

        <h2>4. الضمان (خيار العيب)</h2>
        <p>كل طرف يضمن خلو سلعته من العيوب الخفية. اكتشاف عيب مخفي خلال <b>7 أيام</b> من التسليم يعطي حق الرد. ${country === "EG"
          ? "يُطبَّق أيضًا خيار العيب المقرر في المواد 447 وما بعدها من القانون المدني المصري."
          : "تُطبَّق أحكام خيار العيب في الفقه الإسلامي المعمول به أمام المحاكم السعودية."}</p>

        <h2>5. النزاعات</h2>
        <p>أي نزاع يُحل أولًا عبر نظام النزاعات في بادل (تحكيم داخلي غير ملزم)، ثم أمام <b>${c.courts}</b> إن لم يُحسم وديًا.</p>

        <h2>6. الإلغاء</h2>
        <p>يحق إلغاء الصفقة قبل قبولها. بعد القبول يلزم اتفاق الطرفين أو قرار من فريق الوساطة.</p>
      `,
    },

    "anti-riba": {
      title: "سياسة مكافحة الربا — بادل بادل",
      html: `
        <div class="country-banner">🌐 هذه السياسة موحّدة على مستوى المنصة (السعودية ومصر) ولا تختلف بين البلدين.</div>
        <h2>المبدأ</h2>
        <p>بادل منصة شرعية تلتزم بأحكام البيع والصرف في الفقه الإسلامي، وتمنع تقنيًا أي معاملة تقع في الربا (فضل/نسيئة).</p>
        <h2>الأصناف الربوية</h2>
        <p>الذهب، الفضة، النقود (بكل عملاتها)، القمح، الشعير، التمر، الملح.</p>
        <h2>القواعد المُطبّقة آليًا</h2>
        <ul>
          <li><b>صنف ربوي بنفسه</b> (ذهب بذهب، ${country === "SA" ? "ريال بريال" : "جنيه بجنيه"}): يجب التماثل التام والتقابض الفوري. أي تفاوت أو فرق نقدي = <b>رفض تلقائي</b>.</li>
          <li><b>ربوي بربوي مختلف</b> (ذهب بفضة، ${country === "SA" ? "ريال بدولار" : "جنيه بدولار"}): يجوز التفاضل لكن يجب التقابض الفوري.</li>
          <li><b>ربوي بسلعة + فرق نقدي</b>: يُسمح فقط مع التقابض الفوري وعدم التأجيل.</li>
        </ul>
        <h2>محرك الفحص</h2>
        <p>يُشغّل المحرك على كل عرض قبل إنشائه، ويرفض المعاملات المخالفة برسالة واضحة.</p>
        <h2>الإشراف الشرعي</h2>
        <p>تخضع قواعد المحرك لمراجعة دورية من مستشار شرعي معتمد.</p>
      `,
    },

    "refund-policy": {
      title: `سياسة الاسترداد — بادل بادل (${c.label})`,
      html: `
        <div class="country-banner">🌐 وفق ${c.consumer_law}.</div>
        <h2>1. نافذة الاسترداد</h2>
        <p>يحق لأي طرف طلب الاسترداد خلال <b>${country === "EG" ? "14 يومًا" : "7 أيام"}</b> من تأكيد التسليم${country === "EG" ? " (وفق المادة 47 من قانون حماية المستهلك 181/2018 الخاصة بالبيع عن بُعد)" : ""} في حال:</p>
        <ul>
          <li>اكتشاف عيب جوهري غير مذكور في الوصف.</li>
          <li>عدم مطابقة السلعة للصور أو المواصفات المعلنة.</li>
          <li>تلف الشحنة أثناء النقل.</li>
        </ul>
        <h2>2. آلية الطلب</h2>
        <p>يُقدَّم الطلب عبر صفحة الصفقة مع صور/فيديو يُثبت السبب. يُحال للمراجعة خلال 48 ساعة.</p>
        <h2>3. نتائج المراجعة</h2>
        <ul>
          <li><b>قبول الاسترداد</b>: إعادة السلعة + استرداد الفرق النقدي بعملة ${c.currency}.</li>
          <li><b>رفض الاسترداد</b>: يمكن التصعيد لنظام النزاعات ثم إلى ${c.courts}.</li>
        </ul>
        <h2>4. تكاليف الشحن العكسي</h2>
        <p>يتحمّلها الطرف المُتسبّب في الخلل. عند الخلاف يُقسّم مناصفة.</p>
        <h2>5. الاستثناءات</h2>
        <p>السلع القابلة للتلف، السلع المخصّصة، والأصناف الربوية بعد التقابض الفوري لا تخضع للاسترداد. ${country === "EG" ? "كما يستثنى ما ورد في المادة 8 من اللائحة التنفيذية لقانون حماية المستهلك." : ""}</p>
      `,
    },

    fees: {
      title: `شفافية الرسوم — بادل بادل (${c.label})`,
      html: `
        <div class="country-banner">🌐 الأسعار وضريبة القيمة المضافة وفق نظام <b>${c.flag} ${c.label}</b>.</div>
        <h2>عمولة الصفقات</h2>
        <ul>
          <li><b>المرحلة الحالية</b>: <span style="color:hsl(var(--primary));font-weight:800">مجانية بالكامل</span> — لا عمولة على الصفقات المكتملة.</li>
          <li><b>بعد الوصول لـ 100 ألف مستخدم</b>: 3% من قيمة الصفقة (حد أدنى ${country === "SA" ? "1.5 ر.س" : "5 ج.م"}).</li>
        </ul>
        <h2>ضريبة القيمة المضافة</h2>
        <p>تُضاف ضريبة <b>${c.vat}</b> على مبلغ العمولة فقط — لا على قيمة السلعة المتبادلة. الفواتير الضريبية تُصدَر ${country === "SA" ? "متوافقة مع فوترة (ZATCA) للبائعين المسجلين ضريبيًا" : "متوافقة مع منظومة الفاتورة الإلكترونية للمصلحة العامة للضرائب"}.</p>
        <h2>مصادر إيرادات المرحلة الأولى</h2>
        <ul>
          <li>ترويج الإعلانات (Featured / Pinned / Boost).</li>
          <li>توثيق الحسابات (Verified Badge).</li>
          <li>اشتراكات التجار والمحلات (Merchant / Store).</li>
        </ul>
        <h2>سحب الرسوم</h2>
        <p>تُحوَّل من رصيد المنصة بعد إكمال الصفقة وتُسجَّل في سجل المحفظة بشفافية كاملة بعملة ${c.currency}.</p>
      `,
    },

    sla: {
      title: `اتفاقية مستوى الخدمة (SLA) — بادل بادل (${c.label})`,
      html: `
        <div class="country-banner">🌐 قنوات الدعم والاختصاص القضائي وفق <b>${c.flag} ${c.label}</b>.</div>
        <p>تُحدّد هذه الوثيقة التزامات المنصة تجاه مستخدميها من حيث أوقات الاستجابة وحلّ النزاعات وتوافر الخدمة.</p>
        <h2>1. توافر المنصة</h2>
        <ul>
          <li><b>Uptime مستهدف:</b> 99.5% شهرياً.</li>
          <li>الصيانة المجدولة يُعلَن عنها قبل 24 ساعة على الأقل.</li>
        </ul>
        <h2>2. أوقات الاستجابة للدعم</h2>
        <table>
          <thead><tr><th>القناة</th><th>أول رد</th><th>الحل المستهدف</th></tr></thead>
          <tbody>
            <tr><td>دعم عام (بريد)</td><td>خلال 24 ساعة عمل</td><td>3 أيام عمل</td></tr>
            <tr><td>مشكلة دفع/محفظة</td><td>خلال 8 ساعات عمل</td><td>48 ساعة</td></tr>
            <tr><td>بلاغ احتيال</td><td>خلال 4 ساعات</td><td>تعليق فوري ثم تحقيق ≤ 72 ساعة</td></tr>
          </tbody>
        </table>
        <h2>3. حلّ النزاعات</h2>
        <ul>
          <li>فتح النزاع: خلال 7 أيام من تأكيد التسليم.</li>
          <li>أول رد من فريق الوساطة: خلال <b>24 ساعة</b>.</li>
          <li>قرار ابتدائي: خلال <b>72 ساعة</b>.</li>
          <li>قرار نهائي بعد الاستئناف: خلال <b>7 أيام عمل</b>.</li>
          <li>أثناء النزاع يُجمَّد المبلغ في حساب الضمان (Escrow).</li>
          <li>الاختصاص القضائي عند التصعيد: <b>${c.courts}</b>.</li>
        </ul>
        <h2>4. توثيق الحسابات (KYC)</h2>
        <ul>
          <li>توثيق الأفراد: خلال 24 ساعة من رفع ${country === "SA" ? "الهوية الوطنية / الإقامة" : "الرقم القومي أو جواز السفر"}.</li>
          <li>توثيق الشركات: خلال 3 أيام عمل من رفع ${country === "SA" ? "السجل التجاري + شهادة VAT" : "السجل التجاري + البطاقة الضريبية"}.</li>
        </ul>
        <h2>5. حدود المسؤولية</h2>
        <p>التعويض الأقصى عن إخلال المنصة بهذه الاتفاقية هو إعفاء من العمولات لمدة شهر أو رصيد مكافئ بعملة ${c.currency}، ولا يشمل أضرار غير مباشرة أو فوات منفعة.</p>
        <h2>6. التواصل</h2>
        <p>support@badel.app · بلاغات الاحتيال: abuse@badel.app</p>
        <p class="meta">الإصدار ${TERMS_VERSION} — الدولة: ${c.flag} ${c.label} — آخر تحديث: 2026/07/09</p>
      `,
    },
  };
}

// Loader is country-agnostic (validates the slug only). Country toggling happens client-side.
export const Route = createFileRoute("/legal/$doc")({
  loader: ({ params }) => {
    const stub = buildDocs("SA");
    if (!stub[params.doc]) throw notFound();
    return { slug: params.doc };
  },
  head: ({ loaderData, params }) => {
    const doc = loaderData ? buildDocs("SA")[loaderData.slug] : null;
    return {
      meta: [
        { title: doc?.title ?? "وثيقة قانونية — بادل" },
        { name: "description", content: `${doc?.title ?? "وثيقة قانونية"} — منصة بادل للمقايضة العادلة (مصر والسعودية).` },
        { property: "og:title", content: doc?.title ?? "وثيقة قانونية — بادل" },
        { property: "og:url", content: `https://badelbarter.lovable.app/legal/${params.doc}` },
        { property: "og:type", content: "article" },
      ],
      links: [{ rel: "canonical", href: `https://badelbarter.lovable.app/legal/${params.doc}` }],
    };
  },
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

function useCountry(): [Country, (c: Country) => void] {
  const [country, setCountryState] = useState<Country>("SA");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("badel-legal-country");
      if (saved === "SA" || saved === "EG") setCountryState(saved);
      else {
        // Auto-detect from browser language once
        const lang = navigator.language.toLowerCase();
        if (lang.includes("eg")) setCountryState("EG");
      }
    } catch { /* noop */ }
  }, []);
  const set = (c: Country) => {
    setCountryState(c);
    try { localStorage.setItem("badel-legal-country", c); } catch { /* noop */ }
  };
  return [country, set];
}

function LegalDoc() {
  const { slug } = Route.useLoaderData();
  const [country, setCountry] = useCountry();
  const doc = buildDocs(country)[slug];

  return (
    <div dir="rtl" className="min-h-screen bg-background font-body">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between gap-4 flex-wrap">
          <Link to="/" className="font-display text-2xl font-extrabold text-primary">بادل بادل</Link>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">الدولة:</span>
            <div className="inline-flex bg-stone-soft rounded-full p-1 ring-1 ring-border">
              {(["SA", "EG"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setCountry(k)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                    country === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {COUNTRY_META[k].flag} {k === "SA" ? "السعودية" : "مصر"}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-6 pb-4">
          <nav className="flex gap-3 text-xs text-muted-foreground flex-wrap">
            <Link to="/legal/$doc" params={{ doc: "terms" }} activeProps={{ className: "text-primary font-bold" }} className="hover:text-foreground">الشروط</Link>
            <Link to="/legal/$doc" params={{ doc: "privacy" }} activeProps={{ className: "text-primary font-bold" }} className="hover:text-foreground">الخصوصية</Link>
            <Link to="/legal/$doc" params={{ doc: "barter-agreement" }} activeProps={{ className: "text-primary font-bold" }} className="hover:text-foreground">المقايضة</Link>
            <Link to="/legal/$doc" params={{ doc: "anti-riba" }} activeProps={{ className: "text-primary font-bold" }} className="hover:text-foreground">مكافحة الربا</Link>
            <Link to="/legal/$doc" params={{ doc: "refund-policy" }} activeProps={{ className: "text-primary font-bold" }} className="hover:text-foreground">الاسترداد</Link>
            <Link to="/legal/$doc" params={{ doc: "fees" }} activeProps={{ className: "text-primary font-bold" }} className="hover:text-foreground">الرسوم</Link>
            <Link to="/legal/$doc" params={{ doc: "sla" }} activeProps={{ className: "text-primary font-bold" }} className="hover:text-foreground">مستوى الخدمة</Link>
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
        .prose-legal a { color: hsl(var(--primary)); text-decoration: underline; }
        .prose-legal table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.875rem; }
        .prose-legal th, .prose-legal td { border: 1px solid hsl(var(--border)); padding: 0.5rem 0.75rem; text-align: start; vertical-align: top; }
        .prose-legal th { background: hsl(var(--muted)); font-weight: 700; }
        .prose-legal .meta { font-size: 0.75rem; color: hsl(var(--muted-foreground)); margin-top: 2rem; }
        .prose-legal .country-banner {
          background: hsl(var(--primary) / 0.06);
          border: 1px solid hsl(var(--primary) / 0.15);
          color: hsl(var(--foreground));
          border-radius: 0.75rem;
          padding: 0.65rem 0.9rem;
          font-size: 0.8rem;
          margin-bottom: 1rem;
        }
      `}</style>
    </div>
  );
}
