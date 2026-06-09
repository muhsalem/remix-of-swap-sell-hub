// كاشف السلع/الخدمات المحرّمة شرعاً — يُستخدم قبل إنشاء أي إعلان
// المرجعية: السلع المنهي عن بيعها في الفقه الإسلامي (إجماعاً أو راجح المذاهب).

export type HaramCheckResult = {
  allowed: boolean;
  category?: string;
  reason?: string;
  matched?: string;
};

type Rule = { category: string; reason: string; keywords: string[] };

const RULES: Rule[] = [
  {
    category: "خمور ومسكرات",
    reason: "بيع الخمر وما في حكمه من المسكرات محرّم بالنص.",
    keywords: [
      "خمر", "خمور", "نبيذ", "بيرة", "ويسكي", "فودكا", "شامبانيا", "كحول للشرب",
      "wine", "beer", "whisky", "whiskey", "vodka", "champagne", "alcohol drink", "liquor",
    ],
  },
  {
    category: "لحم خنزير ومشتقاته",
    reason: "الخنزير ومشتقاته محرّم بالنص.",
    keywords: [
      "خنزير", "لحم خنزير", "بيكون", "هام", "لارد", "شحم خنزير", "جيلاتين خنزير",
      "pork", "bacon", "ham", "lard", "pig meat",
    ],
  },
  {
    category: "ميتة ودم",
    reason: "بيع الميتة والدم محرّم بالنص.",
    keywords: ["ميتة", "دم مسفوح", "blood for sale"],
  },
  {
    category: "مخدرات ومواد محظورة",
    reason: "بيع المخدرات والمواد المسكرة المخدرة محرّم وممنوع قانوناً.",
    keywords: [
      "حشيش", "ماريجوانا", "كوكايين", "هيروين", "كبتاجون", "شبو", "أفيون", "ترامادول للبيع",
      "cannabis", "marijuana", "weed", "cocaine", "heroin", "meth", "opium", "lsd", "ecstasy",
    ],
  },
  {
    category: "أصنام وتماثيل عبادة",
    reason: "صناعة وبيع الأصنام والتماثيل التي تُعبد من دون الله محرّم.",
    keywords: ["صنم", "تمثال للعبادة", "بوذا للعبادة", "صليب للعبادة"],
  },
  {
    category: "أدوات قمار ومراهنات",
    reason: "القمار والميسر محرّم، وبيع أدواته من إعانة على الإثم.",
    keywords: [
      "طاولة قمار", "ماكينة قمار", "روليت", "كازينو", "بطاقات يانصيب", "مراهنة",
      "casino table", "roulette", "slot machine", "gambling",
    ],
  },
  {
    category: "أسلحة غير مرخّصة",
    reason: "بيع الأسلحة دون ترخيص نظامي ممنوع ويُفضي لإيذاء محرّم.",
    keywords: ["مسدس بدون ترخيص", "سلاح بدون رخصة", "ذخيرة غير مرخصة", "unlicensed firearm"],
  },
  {
    category: "وثائق ومستندات مزورة",
    reason: "بيع الوثائق المزورة غش وكذب وأكل للمال بالباطل.",
    keywords: [
      "شهادة مزورة", "جواز مزور", "هوية مزورة", "رخصة مزورة", "بطاقة شخصية مزورة",
      "fake passport", "fake id", "fake diploma", "fake certificate",
    ],
  },
  {
    category: "ربا ومعاملات ربوية صريحة",
    reason: "بيع القروض الربوية أو خدمات الربا محرّم.",
    keywords: ["قرض بفائدة", "قرض ربوي", "loan with interest", "interest loan"],
  },
  {
    category: "محتوى إباحي / خادش للحياء",
    reason: "بيع المواد الإباحية والخادشة للحياء محرّم.",
    keywords: ["إباحي", "بورنو", "porn", "xxx", "nude photos"],
  },
  {
    category: "أعضاء بشرية",
    reason: "بيع أعضاء الإنسان محرّم وممنوع نظاماً.",
    keywords: ["كلية للبيع", "كبد للبيع", "قرنية للبيع", "kidney for sale", "human organ"],
  },
  {
    category: "سحر وشعوذة",
    reason: "السحر والكهانة والتنجيم محرّم.",
    keywords: ["سحر للبيع", "تعويذة", "طلسم", "كشف بختك", "ابطال سحر", "fortune telling"],
  },
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[إأآا]/g, "ا")
    .replace(/[ىي]/g, "ي")
    .replace(/[ةه]/g, "ه")
    .replace(/\s+/g, " ")
    .trim();

export function checkHaram(input: {
  title?: string;
  description?: string;
  category?: string;
  wants?: string;
}): HaramCheckResult {
  const haystack = norm(
    [input.title, input.description, input.category, input.wants].filter(Boolean).join(" | "),
  );
  if (!haystack) return { allowed: true };

  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      const k = norm(kw);
      if (!k) continue;
      // ضمان حدود كلمات تقريبية بإضافة فراغات
      if (haystack.includes(k)) {
        return {
          allowed: false,
          category: rule.category,
          reason: rule.reason,
          matched: kw,
        };
      }
    }
  }
  return { allowed: true };
}
