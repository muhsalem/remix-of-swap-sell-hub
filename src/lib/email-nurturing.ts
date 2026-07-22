// Arabic email templates for nurturing users through the funnel
export type EmailTemplate =
  | "welcome"
  | "listing_created"
  | "offer_received"
  | "offer_accepted"
  | "kyc_approved"
  | "abandoned_listing"
  | "reactivation_7d"
  | "waitlist_confirmed"
  | "referral_success";

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

const brand = {
  name: "بادِل",
  url: "https://badelbarter.lovable.app",
  color: "#0f3460",
};

function wrap(inner: string): string {
  return `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:560px;margin:0 auto;background:#faf7f2;padding:32px;border-radius:16px;color:#222">
    <h1 style="color:${brand.color};font-size:22px;margin:0 0 16px">${brand.name}</h1>
    ${inner}
    <hr style="border:none;border-top:1px solid #ddd;margin:24px 0"/>
    <p style="font-size:12px;color:#888">أنت تتلقى هذه الرسالة لأنك مسجل في منصة ${brand.name}. <a href="${brand.url}">فتح المنصة</a></p>
  </div>`;
}

export function renderEmail(template: EmailTemplate, vars: Record<string, string> = {}): EmailContent {
  const v = (k: string) => vars[k] ?? "";
  switch (template) {
    case "welcome":
      return {
        subject: `مرحباً بك في ${brand.name} — ابدأ أول مقايضة`,
        text: `أهلاً ${v("name") || "بك"}!\n\nمرحباً بك في بادِل، أول منصة مقايضة ذكية بلا وسطاء.\n\nخطواتك التالية:\n1. أضف أول عرض\n2. تصفح ما يناسبك\n3. أرسل عرض المقايضة\n\nابدأ الآن: ${brand.url}`,
        html: wrap(`
          <p>أهلاً <b>${v("name") || "بك"}</b>! 👋</p>
          <p>مرحباً بك في <b>${brand.name}</b> — أول منصة مقايضة ذكية في مصر والسعودية بدون رسوم.</p>
          <h3 style="color:${brand.color}">خطواتك الأولى:</h3>
          <ol>
            <li>أضف أول عرض (يستغرق دقيقتين)</li>
            <li>تصفح العروض المتاحة</li>
            <li>أرسل عرض المقايضة الأول</li>
          </ol>
          <p><a href="${brand.url}/new-listing" style="display:inline-block;background:${brand.color};color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">إضافة أول عرض</a></p>
        `),
      };
    case "listing_created":
      return {
        subject: `تم نشر عرضك: ${v("title")}`,
        text: `تم نشر عرضك "${v("title")}" بنجاح.\nتابع الاهتمام والعروض: ${brand.url}/my-listings`,
        html: wrap(`
          <p>🎉 تم نشر عرضك بنجاح!</p>
          <p><b>${v("title")}</b></p>
          <p><a href="${brand.url}/my-listings" style="color:${brand.color}">تابع عروضك ←</a></p>
        `),
      };
    case "offer_received":
      return {
        subject: `📥 عرض مقايضة جديد على "${v("listing")}"`,
        text: `تلقيت عرض مقايضة جديد على "${v("listing")}".\nراجعه الآن: ${brand.url}/offers`,
        html: wrap(`
          <p>📥 لديك عرض مقايضة جديد!</p>
          <p>على عرضك: <b>${v("listing")}</b></p>
          <p><a href="${brand.url}/offers" style="display:inline-block;background:${brand.color};color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">مراجعة العرض</a></p>
        `),
      };
    case "offer_accepted":
      return {
        subject: `✅ تم قبول عرضك على "${v("listing")}"`,
        text: `تم قبول عرض المقايضة الخاص بك!\nأكمل الخطوات: ${brand.url}/offers`,
        html: wrap(`
          <p>✅ <b>تم قبول عرضك!</b></p>
          <p>الخطوة التالية: تنسيق التسليم مع الطرف الآخر.</p>
          <p><a href="${brand.url}/offers" style="color:${brand.color}">فتح الصفقة ←</a></p>
        `),
      };
    case "kyc_approved":
      return {
        subject: `🛡️ تم توثيق حسابك — شارة موثّق مفعّلة`,
        text: `تم توثيق حسابك بنجاح. الآن ستظهر شارة "موثّق" على عروضك.`,
        html: wrap(`
          <p>🛡️ <b>تهانينا — تم توثيق حسابك.</b></p>
          <p>الآن ستظهر شارة "موثّق ✓" على جميع عروضك، مما يزيد ثقة المستخدمين ومعدل قبول عروضك.</p>
        `),
      };
    case "abandoned_listing":
      return {
        subject: `أكمل نشر عرضك — دقيقتان فقط`,
        text: `بدأت إضافة عرض لكن لم تكمله. تابع من حيث توقفت: ${brand.url}/new-listing`,
        html: wrap(`
          <p>لاحظنا أنك بدأت إضافة عرض لكن لم تكمله.</p>
          <p>يستغرق الأمر دقيقتين فقط، والذكاء الاصطناعي سيسعّر لك تلقائياً.</p>
          <p><a href="${brand.url}/new-listing" style="display:inline-block;background:${brand.color};color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">إكمال العرض</a></p>
        `),
      };
    case "reactivation_7d":
      return {
        subject: `عروض جديدة قد تعجبك في بادِل`,
        text: `أضاف المستخدمون ${v("count") || "عشرات"} من العروض الجديدة هذا الأسبوع.\nتصفح الآن: ${brand.url}`,
        html: wrap(`
          <p>لم نرك منذ فترة! 👋</p>
          <p>أضاف المستخدمون <b>${v("count") || "عشرات"}</b> من العروض الجديدة هذا الأسبوع.</p>
          <p><a href="${brand.url}" style="color:${brand.color}">تصفح ما هو جديد ←</a></p>
        `),
      };
    case "waitlist_confirmed":
      return {
        subject: `✨ أنت في قائمة الانتظار — مقعدك #${v("position") || "?"}`,
        text: `تم تسجيلك في قائمة الانتظار. مقعدك رقم ${v("position") || "-"}.\nشارك رابط الإحالة للتقدم أسرع.`,
        html: wrap(`
          <p>✨ <b>مرحباً بك في قائمة الانتظار!</b></p>
          <p>مقعدك الحالي: <b style="font-size:24px;color:${brand.color}">#${v("position") || "-"}</b></p>
          <p>شارك رابط الإحالة الخاص بك للتقدم أسرع وفتح مزايا حصرية:</p>
          <p><a href="${brand.url}/referrals" style="color:${brand.color}">رابط الإحالة ←</a></p>
        `),
      };
    case "referral_success":
      return {
        subject: `🎁 صديقك ${v("friend") || ""} انضم عبر رابطك`,
        text: `تم تسجيل ${v("friend") || "مستخدم جديد"} عبر رابط الإحالة الخاص بك. مكافأتك مضافة.`,
        html: wrap(`
          <p>🎁 <b>مكافأة إحالة جديدة!</b></p>
          <p>انضم <b>${v("friend") || "مستخدم جديد"}</b> عبر رابطك.</p>
          <p><a href="${brand.url}/referrals" style="color:${brand.color}">عرض إحصائيات الإحالة ←</a></p>
        `),
      };
  }
}
