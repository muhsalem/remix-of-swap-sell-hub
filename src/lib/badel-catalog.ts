// كتالوج التصنيف الرباعي لبادل — مستوحى من تصنيفات Nice / HS / BEC
// 4 مستويات: نوع أساسي (سلعة/خدمة) ← تصنيف فرعي ← عائلة ← صنف محدد

export type FamilyEntry = {
  n: string;
  type: "good" | "service";
  sub: string;
  nice: string;
  dep?: number;
  bec?: string;
  mkt?: "conv" | "shop" | "spec" | "uns";
  itemType: "good" | "service" | "commodity" | "digital" | "real-estate";
  category: string;
  defaultUnit: string;
};

export const MKT_LIQUIDITY = {
  conv: { label: "ميسّرة", liq: 1.0 },
  shop: { label: "تسوّقية", liq: 0.92 },
  spec: { label: "تخصصية", liq: 0.82 },
  uns:  { label: "غير مطلوبة", liq: 0.70 },
} as const;

export const FAMILIES: Record<string, FamilyEntry> = {
  g1:  { n: "أغذية ومشروبات", type: "good", sub: "مواد استهلاكية وخام", nice: "29", bec: "استهلاكية", mkt: "conv", itemType: "commodity", category: "حبوب وأغذية", defaultUnit: "كجم" },
  g2:  { n: "منتجات زراعية وحيوانية", type: "good", sub: "مواد استهلاكية وخام", nice: "31", bec: "وسيطة", mkt: "conv", itemType: "commodity", category: "حبوب وأغذية", defaultUnit: "كجم" },
  g3:  { n: "مواد خام وموارد طبيعية", type: "good", sub: "مواد استهلاكية وخام", nice: "1", bec: "وسيطة", mkt: "shop", itemType: "commodity", category: "أخرى", defaultUnit: "طن" },
  g4:  { n: "منتجات كيميائية وصناعية", type: "good", sub: "مواد استهلاكية وخام", nice: "1", bec: "وسيطة", mkt: "spec", itemType: "commodity", category: "أخرى", defaultUnit: "لتر" },
  g5:  { n: "مواد ومستلزمات بناء", type: "good", sub: "مواد استهلاكية وخام", nice: "19", bec: "وسيطة", mkt: "conv", itemType: "commodity", category: "أخرى", defaultUnit: "وحدة" },
  g6:  { n: "منتجات صحية ودوائية وتجميل", type: "good", sub: "مواد استهلاكية وخام", nice: "5", bec: "استهلاكية", mkt: "shop", itemType: "commodity", category: "أخرى", defaultUnit: "علبة" },
  g7:  { n: "إلكترونيات وأجهزة رقمية", type: "good", sub: "سلع معمّرة", nice: "9", dep: 0.25, bec: "استهلاكية", mkt: "shop", itemType: "good", category: "إلكترونيات", defaultUnit: "قطعة" },
  g8:  { n: "أجهزة منزلية وكهربائية", type: "good", sub: "سلع معمّرة", nice: "11", dep: 0.15, bec: "استهلاكية", mkt: "shop", itemType: "good", category: "إلكترونيات", defaultUnit: "قطعة" },
  g9:  { n: "أثاث ومفروشات", type: "good", sub: "سلع معمّرة", nice: "20", dep: 0.10, bec: "استهلاكية", mkt: "shop", itemType: "good", category: "أثاث", defaultUnit: "قطعة" },
  g10: { n: "مركبات ووسائل نقل", type: "good", sub: "سلع معمّرة", nice: "12", dep: 0.15, bec: "استهلاكية", mkt: "shop", itemType: "good", category: "وسائل تنقل", defaultUnit: "قطعة" },
  g11: { n: "معدات وآلات وأدوات", type: "good", sub: "سلع معمّرة", nice: "7", dep: 0.08, bec: "رأسمالية", mkt: "spec", itemType: "good", category: "أخرى", defaultUnit: "قطعة" },
  g12: { n: "ملابس ومنسوجات", type: "good", sub: "سلع معمّرة", nice: "25", dep: 0.30, bec: "استهلاكية", mkt: "shop", itemType: "good", category: "ملابس", defaultUnit: "قطعة" },
  g13: { n: "كتب وقرطاسية", type: "good", sub: "سلع معمّرة", nice: "16", dep: 0.12, bec: "استهلاكية", mkt: "shop", itemType: "good", category: "كتب", defaultUnit: "قطعة" },
  g14: { n: "رياضية وألعاب وآلات", type: "good", sub: "سلع معمّرة", nice: "28", dep: 0.18, bec: "استهلاكية", mkt: "shop", itemType: "good", category: "أخرى", defaultUnit: "قطعة" },
  g15: { n: "منتجات رقمية وأصول افتراضية", type: "good", sub: "منتجات رقمية", nice: "9", bec: "استهلاكية", mkt: "shop", itemType: "digital", category: "أخرى", defaultUnit: "ترخيص" },
  g16: { n: "معادن نفيسة ومجوهرات", type: "good", sub: "أصول خاصة التقييم", nice: "14", bec: "استهلاكية", mkt: "shop", itemType: "good", category: "ذهب", defaultUnit: "جرام" },
  g17: { n: "تحف ومقتنيات وأعمال فنية", type: "good", sub: "أصول خاصة التقييم", nice: "20", bec: "استهلاكية", mkt: "spec", itemType: "good", category: "أخرى", defaultUnit: "قطعة" },
  g18: { n: "عقارات وأراضٍ (تملّك)", type: "good", sub: "أصول خاصة التقييم", nice: "36", bec: "رأسمالية", mkt: "spec", itemType: "real-estate", category: "عقارات سكنية", defaultUnit: "م²" },
  s1:  { n: "خدمات مهنية واستشارية", type: "service", sub: "خدمات", nice: "35", itemType: "service", category: "خدمات مهنية", defaultUnit: "ساعة" },
  s2:  { n: "تعليم وتدريب", type: "service", sub: "خدمات", nice: "41", itemType: "service", category: "خدمات مهنية", defaultUnit: "ساعة" },
  s3:  { n: "خدمات صحية وطبية", type: "service", sub: "خدمات", nice: "44", itemType: "service", category: "خدمات مهنية", defaultUnit: "جلسة" },
  s4:  { n: "خدمات مالية ومصرفية", type: "service", sub: "خدمات", nice: "36", itemType: "service", category: "خدمات مهنية", defaultUnit: "ساعة" },
  s5:  { n: "تقنية معلومات وبرمجة", type: "service", sub: "خدمات", nice: "42", itemType: "service", category: "خدمات مهنية", defaultUnit: "ساعة" },
  s6:  { n: "إبداعية وتصميم وإعلام", type: "service", sub: "خدمات", nice: "42", itemType: "service", category: "خدمات مهنية", defaultUnit: "مشروع" },
  s7:  { n: "تسويق وإعلان", type: "service", sub: "خدمات", nice: "35", itemType: "service", category: "خدمات مهنية", defaultUnit: "مشروع" },
  s8:  { n: "نقل وشحن ولوجستيات", type: "service", sub: "خدمات", nice: "39", itemType: "service", category: "خدمات يدوية", defaultUnit: "رحلة" },
  s9:  { n: "صيانة وإصلاح وتركيب", type: "service", sub: "خدمات", nice: "37", itemType: "service", category: "خدمات يدوية", defaultUnit: "زيارة" },
  s10: { n: "ضيافة ومطاعم وسياحة", type: "service", sub: "خدمات", nice: "43", itemType: "service", category: "خدمات يدوية", defaultUnit: "حدث" },
  s11: { n: "تجميل ورياضة ورعاية", type: "service", sub: "خدمات", nice: "44", itemType: "service", category: "خدمات يدوية", defaultUnit: "جلسة" },
  s12: { n: "خدمات منزلية", type: "service", sub: "خدمات", nice: "37", itemType: "service", category: "خدمات يدوية", defaultUnit: "زيارة" },
  s13: { n: "بناء ومقاولات", type: "service", sub: "خدمات", nice: "37", itemType: "service", category: "خدمات يدوية", defaultUnit: "مشروع" },
  s17: { n: "ترفيهية وثقافية", type: "service", sub: "خدمات", nice: "41", itemType: "service", category: "خدمات يدوية", defaultUnit: "حدث" },
  r1:  { n: "تأجير عقار / مساحة", type: "service", sub: "تأجير وحقوق انتفاع", nice: "36", itemType: "real-estate", category: "عقارات تجارية", defaultUnit: "شهر" },
  r2:  { n: "تأجير معدات / أدوات", type: "service", sub: "تأجير وحقوق انتفاع", nice: "37", itemType: "service", category: "خدمات يدوية", defaultUnit: "يوم" },
};

export const ITEMS: Record<string, string[]> = {
  g1: ["حبوب وأرز","لحوم ودواجن","أسماك","خضروات وفواكه","ألبان وأجبان","مخبوزات","مشروبات","معلبات"],
  g2: ["محاصيل حقلية","خضروات طازجة","فواكه","ماشية","دواجن","عسل","بذور"],
  g3: ["حديد","نحاس","أخشاب","رمل","أحجار","نفط","غاز"],
  g4: ["أسمدة","مبيدات","دهانات","بلاستيك","لاصقات","منظّفات"],
  g5: ["أسمنت","حديد تسليح","طوب","سيراميك","أنابيب","عوازل"],
  g6: ["أدوية","مكمّلات","تجميل","عناية شخصية","مستلزمات طبية"],
  g7: ["هواتف ذكية","حواسيب محمولة","حواسيب مكتبية","أجهزة لوحية","كاميرات","شاشات","سماعات","إكسسوارات"],
  g8: ["ثلاجات","غسالات","مكيّفات","أفران","مكانس","أجهزة مطبخ","سخّانات"],
  g9: ["أسرّة","كنب","طاولات","كراسي","خزائن","سجاد","ستائر","إضاءة"],
  g10: ["سيارات","دراجات نارية","دراجات هوائية","شاحنات","قوارب","قطع غيار"],
  g11: ["آلات صناعية","معدّات زراعية","عُدد كهربائية","عُدد يدوية","معدّات ورش"],
  g12: ["رجالية","نسائية","أطفال","أحذية","حقائب","أقمشة","ساعات"],
  g13: ["كتب","مجلات","قرطاسية","دفاتر","مطبوعات"],
  g14: ["معدّات رياضية","دراجات رياضة","ألعاب أطفال","ألعاب لوحية","آلات موسيقية","تخييم"],
  g15: ["برمجيات","قوالب","كتب إلكترونية","محتوى رقمي","NFT","نطاقات"],
  g16: ["ذهب","فضة","بلاتين","مجوهرات","أحجار كريمة","سبائك"],
  g17: ["لوحات","منحوتات","أنتيكات","طوابع نادرة","مقتنيات"],
  g18: ["شقة","فيلا","محل","مكتب","أرض","مخزن","مزرعة"],
  s1: ["قانونية","محاسبة","إدارية","هندسية","ترجمة","تدقيق"],
  s2: ["دروس خصوصية","دورات","لغات","مهني","إرشاد"],
  s3: ["كشف طبي","تمريض","علاج طبيعي","تغذية","نفسية","أسنان"],
  s4: ["تمويل","استثمار","تأمين","تخطيط مالي","صرافة"],
  s5: ["تطوير مواقع","تطبيقات","شبكات","دعم فني","أمن سيبراني","استضافة"],
  s6: ["جرافيك","تصوير","مونتاج","كتابة","صوتي"],
  s7: ["سوشيال ميديا","إعلانات","SEO","علاقات عامة","محتوى"],
  s8: ["توصيل","شحن","ركاب","تخزين","تخليص"],
  s9: ["سباكة","كهرباء","نجارة","صيانة أجهزة","تكييف","تركيبات"],
  s10: ["إقامة","تموين","إرشاد سياحي","رحلات","فعاليات"],
  s11: ["قص شعر","تدريب رياضي","رعاية مسنين","رعاية أطفال","بشرة"],
  s12: ["تنظيف","طهي منزلي","جليسة أطفال","بستنة","مكافحة حشرات"],
  s13: ["تشييد","ترميم","تشطيبات","تصميم داخلي","خرسانة"],
  s17: ["حفلات","عروض فنية","موسيقي","ورش","فعاليات"],
  r1: ["شقة","محل","مكتب","قاعة","مخزن","أرض"],
  r2: ["معدّات بناء","عُدد","أجهزة","مركبات","فعاليات"],
};

export function familiesByType(type: "good" | "service") {
  const groups: Record<string, Array<{ id: string; entry: FamilyEntry }>> = {};
  for (const [id, entry] of Object.entries(FAMILIES)) {
    if (entry.type !== type) continue;
    (groups[entry.sub] = groups[entry.sub] || []).push({ id, entry });
  }
  return groups;
}
