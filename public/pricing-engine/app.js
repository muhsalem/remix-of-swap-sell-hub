/**
 * ═══════════════════════════════════════════════════════════════════
 *  Barter Pricing Engine v2.5 — محرك تسعير المقايضة
 *  14 Categories · 30 Countries · Sharia Compliance · Import Duties
 *  Multi-Depreciation · Input Validation · Country Comparison
 * ═══════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────
//  1. COUNTRY DATABASE (30 Countries)
// ─────────────────────────────────────────────────────
const COUNTRIES = {
  // ── Launch Markets (Phase 1) ──
  EG: { code:'EG', nameEn:'Egypt', nameAr:'مصر', currency:'EGP', symbol:'ج.م', exchangeRate:48.5, pppFactor:0.25, costOfLivingIndex:22, avgMonthlyIncome:250, inflationRate:0.28, flag:'🇪🇬' },
  SA: { code:'SA', nameEn:'Saudi Arabia', nameAr:'السعودية', currency:'SAR', symbol:'ر.س', exchangeRate:3.75, pppFactor:0.65, costOfLivingIndex:42, avgMonthlyIncome:2500, inflationRate:0.025, flag:'🇸🇦' },
};

// ─────────────────────────────────────────────────────
//  2. CATEGORY & SUBCATEGORY METADATA (14 Categories)
// ─────────────────────────────────────────────────────
const BARTER_CATEGORIES = {
  electronics: {
    labelEn:'Electronics', labelAr:'إلكترونيات', icon:'💻', globalFactor:0.85,
    subcategories: {
      laptops:      { labelEn:'Laptops',         labelAr:'حواسيب محمولة',  basePrice:1200, deprRate:0.15, liquidity:0.85 },
      smartphones:  { labelEn:'Smartphones',     labelAr:'هواتف ذكية',     basePrice:800,  deprRate:0.20, liquidity:0.95 },
      consoles:     { labelEn:'Gaming Consoles', labelAr:'أجهزة ألعاب',    basePrice:500,  deprRate:0.12, liquidity:0.80 },
      cameras:      { labelEn:'Cameras',         labelAr:'كاميرات',        basePrice:1000, deprRate:0.10, liquidity:0.70 },
      tablets:      { labelEn:'Tablets',          labelAr:'أجهزة لوحية',    basePrice:600,  deprRate:0.18, liquidity:0.82 },
    }
  },
  vehicles: {
    labelEn:'Vehicles', labelAr:'مركبات', icon:'🚗', globalFactor:0.55,
    subcategories: {
      cars:         { labelEn:'Cars',        labelAr:'سيارات',       basePrice:22000, deprRate:0.08, liquidity:0.75 },
      motorcycles:  { labelEn:'Motorcycles', labelAr:'دراجات نارية', basePrice:3500,  deprRate:0.10, liquidity:0.65 },
      bicycles:     { labelEn:'Bicycles',    labelAr:'دراجات هوائية',basePrice:450,   deprRate:0.05, liquidity:0.80 },
    }
  },
  real_estate: {
    labelEn:'Real Estate', labelAr:'عقارات', icon:'🏗️', globalFactor:0.15,
    subcategories: {
      apartments:  { labelEn:'Apartments',  labelAr:'شقق سكنية',    basePrice:50000, deprRate:-0.03, liquidity:0.30 },
      land:        { labelEn:'Land',         labelAr:'أراضي',        basePrice:30000, deprRate:-0.05, liquidity:0.20 },
      shops:       { labelEn:'Commercial',   labelAr:'محلات تجارية', basePrice:80000, deprRate:-0.02, liquidity:0.25 },
    }
  },
  home_garden: {
    labelEn:'Home & Furniture', labelAr:'أثاث ومنزل', icon:'🏠', globalFactor:0.35,
    subcategories: {
      furniture:   { labelEn:'Furniture',        labelAr:'أثاث منزلي',    basePrice:700, deprRate:0.07, liquidity:0.50 },
      appliances:  { labelEn:'Home Appliances',  labelAr:'أجهزة منزلية',  basePrice:600, deprRate:0.09, liquidity:0.60 },
      decor:       { labelEn:'Home Décor',       labelAr:'ديكور منزلي',   basePrice:200, deprRate:0.05, liquidity:0.45 },
    }
  },
  fashion: {
    labelEn:'Fashion & Accessories', labelAr:'أزياء وإكسسوارات', icon:'👔', globalFactor:0.50,
    subcategories: {
      clothing:  { labelEn:'Clothing',  labelAr:'ملابس',   basePrice:150, deprRate:0.25, liquidity:0.70 },
      watches:   { labelEn:'Watches',   labelAr:'ساعات',   basePrice:500, deprRate:0.08, liquidity:0.60 },
      jewelry:   { labelEn:'Jewelry',   labelAr:'مجوهرات', basePrice:800, deprRate:-0.03, liquidity:0.55 },
    }
  },
  food_agri: {
    labelEn:'Food & Agriculture', labelAr:'أغذية وزراعة', icon:'🌾', globalFactor:0.20,
    subcategories: {
      grains:    { labelEn:'Grains & Crops',   labelAr:'حبوب ومحاصيل',   basePrice:200, deprRate:0.40, liquidity:0.90 },
      livestock: { labelEn:'Livestock',         labelAr:'ماشية وأغنام',   basePrice:500, deprRate:-0.05, liquidity:0.65 },
      dairy:     { labelEn:'Dairy Products',    labelAr:'ألبان ومنتجات',  basePrice:50,  deprRate:0.80, liquidity:0.95 },
      produce:   { labelEn:'Fresh Produce',     labelAr:'خضروات وفواكه',  basePrice:30,  deprRate:0.90, liquidity:0.95 },
    }
  },
  industrial: {
    labelEn:'Industrial & Equipment', labelAr:'معدات صناعية', icon:'⚙️', globalFactor:0.60,
    subcategories: {
      tools:          { labelEn:'Power Tools',     labelAr:'عدد كهربائية', basePrice:400,  deprRate:0.08, liquidity:0.55 },
      machinery:      { labelEn:'Machinery',       labelAr:'ماكينات',     basePrice:5000, deprRate:0.06, liquidity:0.30 },
      raw_materials:  { labelEn:'Raw Materials',   labelAr:'مواد خام',    basePrice:300,  deprRate:0.05, liquidity:0.65 },
    }
  },
  arts_crafts: {
    labelEn:'Arts & Crafts', labelAr:'فنون وحرف يدوية', icon:'🎨', globalFactor:0.30,
    subcategories: {
      paintings:  { labelEn:'Paintings',        labelAr:'لوحات فنية',       basePrice:500,  deprRate:-0.05, liquidity:0.25 },
      handmade:   { labelEn:'Handmade Crafts',  labelAr:'مصنوعات يدوية',   basePrice:100,  deprRate:0.10, liquidity:0.50 },
      antiques:   { labelEn:'Antiques',         labelAr:'تحف وأنتيكات',    basePrice:1000, deprRate:-0.08, liquidity:0.20 },
    }
  },
  digital: {
    labelEn:'Digital Products', labelAr:'منتجات رقمية', icon:'💾', globalFactor:0.90,
    subcategories: {
      domains:       { labelEn:'Domains & Hosting',   labelAr:'دومينات واستضافة',   basePrice:200, deprRate:0.15, liquidity:0.50 },
      software_lic:  { labelEn:'Software Licenses',   labelAr:'تراخيص برمجيات',     basePrice:300, deprRate:0.30, liquidity:0.55 },
      courses:       { labelEn:'Online Courses',      labelAr:'دورات أونلاين',      basePrice:150, deprRate:0.25, liquidity:0.60 },
    }
  },
  // ── SERVICE-TYPE CATEGORIES ──
  services: {
    labelEn:'Professional Services', labelAr:'خدمات مهنية', icon:'🛠️', globalFactor:0.20, isService:true,
    subcategories: {
      development:  { labelEn:'Software Dev',       labelAr:'برمجة وتطوير',     hourlyRate:50, liquidity:0.50 },
      design:       { labelEn:'Graphic Design',      labelAr:'تصميم غرافيك',     hourlyRate:35, liquidity:0.60 },
      writing:      { labelEn:'Content Writing',     labelAr:'كتابة محتوى',      hourlyRate:20, liquidity:0.55 },
      marketing:    { labelEn:'Digital Marketing',   labelAr:'تسويق إلكتروني',   hourlyRate:25, liquidity:0.45 },
      consulting:   { labelEn:'Consulting',          labelAr:'استشارات أعمال',    hourlyRate:75, liquidity:0.40 },
    }
  },
  home_services: {
    labelEn:'Home Services', labelAr:'خدمات منزلية', icon:'🔧', globalFactor:0.10, isService:true,
    subcategories: {
      plumbing:    { labelEn:'Plumbing',       labelAr:'سباكة',           hourlyRate:25, liquidity:0.75 },
      electrical:  { labelEn:'Electrical',     labelAr:'كهرباء',          hourlyRate:30, liquidity:0.70 },
      painting:    { labelEn:'Painting',       labelAr:'نقاشة ودهانات',   hourlyRate:20, liquidity:0.72 },
      cleaning:    { labelEn:'Cleaning',       labelAr:'تنظيف',           hourlyRate:15, liquidity:0.85 },
      ac_repair:   { labelEn:'AC Repair',      labelAr:'صيانة تكييف',     hourlyRate:35, liquidity:0.68 },
    }
  },
  education: {
    labelEn:'Education & Training', labelAr:'تعليم وتدريب', icon:'🎓', globalFactor:0.15, isService:true,
    subcategories: {
      academic:      { labelEn:'Academic Tutoring',      labelAr:'دروس أكاديمية',  hourlyRate:25, liquidity:0.70 },
      languages:     { labelEn:'Language Classes',       labelAr:'دورات لغات',     hourlyRate:30, liquidity:0.75 },
      professional:  { labelEn:'Professional Training',  labelAr:'تدريب مهني',     hourlyRate:45, liquidity:0.55 },
    }
  },
  health_beauty: {
    labelEn:'Health & Beauty', labelAr:'صحة وجمال', icon:'💊', globalFactor:0.40, isService:true,
    subcategories: {
      medical_svc:  { labelEn:'Medical Services',  labelAr:'خدمات طبية',    hourlyRate:60, liquidity:0.35 },
      beauty_svc:   { labelEn:'Beauty Services',   labelAr:'خدمات تجميل',   hourlyRate:25, liquidity:0.70 },
      fitness:      { labelEn:'Fitness Training',   labelAr:'تدريب رياضي',   hourlyRate:30, liquidity:0.60 },
    }
  },
};

// ─────────────────────────────────────────────────────
//  3. IMPORT DUTIES PER CATEGORY × COUNTRY
// ─────────────────────────────────────────────────────
const IMPORT_DUTIES = {
  electronics:   { EG:1.30, SA:1.05, AE:1.00, KW:1.05, SY:1.25, _default:1.10 },
  vehicles:      { EG:1.40, SA:1.05, AE:1.00, SY:1.30, _default:1.15 },
  real_estate:   { _default:1.00 },
  home_garden:   { EG:1.10, _default:1.05 },
  fashion:       { EG:1.20, SY:1.15, _default:1.08 },
  food_agri:     { EG:1.05, SA:1.00, AE:1.00, _default:1.05 },
  industrial:    { EG:1.15, SY:1.20, _default:1.08 },
  arts_crafts:   { _default:1.05 },
  digital:       { _default:1.00 },
  services:      { _default:1.00 },
  home_services: { _default:1.00 },
  education:     { _default:1.00 },
  health_beauty: { _default:1.02 },
};

// ─────────────────────────────────────────────────────
//  3b. COUNTRY PROXIMITY REGIONS
// ─────────────────────────────────────────────────────
const COUNTRY_REGIONS = {
  gulf:        ['SA'],
  north_africa:['EG'],
};

// adjacency: which regions are "close" to each other
const REGION_ADJACENCY = {
  gulf:        ['north_africa'],
  north_africa:['gulf'],
};

function getCountryRegion(code) {
  for (const r in COUNTRY_REGIONS) {
    if (COUNTRY_REGIONS[r].includes(code)) return r;
  }
  return 'others';
}

function getProximityScore(codeA, codeB) {
  if (codeA === codeB) return 0; // same country
  const regionA = getCountryRegion(codeA);
  const regionB = getCountryRegion(codeB);
  if (regionA === regionB) return 1; // same region
  if (REGION_ADJACENCY[regionA]?.includes(regionB)) return 2; // neighbor region
  return 3; // far
}

// ─────────────────────────────────────────────────────
//  3c. AI IMAGE ANALYSIS — Keyword Database
// ─────────────────────────────────────────────────────
const IMAGE_AI_KEYWORDS = {
  electronics: {
    keywords: ['phone','iphone','samsung','galaxy','laptop','dell','hp','lenovo','macbook','mac','ipad','tablet','ps5','playstation','xbox','switch','nintendo','camera','canon','nikon','sony','airpods','headphone','earbuds','monitor','screen','tv','television','keyboard','mouse','speaker','router','printer','gopro','drone','pixel','huawei','oppo','xiaomi','realme','redmi'],
    subcategoryMap: {
      'phone|iphone|samsung|galaxy|pixel|huawei|oppo|xiaomi|realme|redmi': 'smartphones',
      'laptop|macbook|dell|hp|lenovo|thinkpad|asus|acer': 'laptops',
      'ps5|playstation|xbox|switch|nintendo|console|gaming': 'consoles',
      'camera|canon|nikon|gopro|drone': 'cameras',
      'ipad|tablet|tab': 'tablets',
    }
  },
  vehicles: {
    keywords: ['car','toyota','honda','bmw','mercedes','audi','ford','chevrolet','hyundai','kia','nissan','truck','suv','sedan','motorcycle','bike','bicycle','vespa','harley','ducati','yamaha','suzuki','kawasaki','scooter'],
    subcategoryMap: {
      'car|toyota|honda|bmw|mercedes|audi|ford|chevrolet|hyundai|kia|nissan|truck|suv|sedan': 'cars',
      'motorcycle|harley|ducati|yamaha|suzuki|kawasaki|scooter|vespa': 'motorcycles',
      'bicycle|bike|trek|giant|specialized': 'bicycles',
    }
  },
  real_estate: {
    keywords: ['apartment','flat','house','villa','land','shop','office','building','condo','penthouse','studio','room','property','real estate'],
    subcategoryMap: {
      'apartment|flat|condo|penthouse|studio|room|شقة': 'apartments',
      'land|أرض|ارض': 'land',
      'shop|office|building|محل|مكتب': 'shops',
    }
  },
  home_garden: {
    keywords: ['sofa','couch','table','chair','bed','desk','wardrobe','shelf','cabinet','fridge','refrigerator','washer','dryer','microwave','oven','dishwasher','blender','vacuum','curtain','lamp','vase','mirror','rug','carpet'],
    subcategoryMap: {
      'sofa|couch|table|chair|bed|desk|wardrobe|shelf|cabinet|أثاث': 'furniture',
      'fridge|refrigerator|washer|dryer|microwave|oven|dishwasher|blender|vacuum|جهاز': 'appliances',
      'curtain|lamp|vase|mirror|rug|carpet|ديكور': 'decor',
    }
  },
  fashion: {
    keywords: ['dress','shirt','jacket','coat','jeans','shoes','sneakers','boots','bag','handbag','watch','rolex','omega|seiko','casio','ring','necklace','bracelet','gold','silver','diamond','earring','sunglasses','hat','suit','tie'],
    subcategoryMap: {
      'dress|shirt|jacket|coat|jeans|shoes|sneakers|boots|bag|handbag|suit|tie|ملابس': 'clothing',
      'watch|rolex|omega|seiko|casio|ساعة': 'watches',
      'ring|necklace|bracelet|gold|silver|diamond|earring|مجوهرات|ذهب': 'jewelry',
    }
  },
  food_agri: {
    keywords: ['wheat','rice','corn','grain','crop','sheep','cow','goat','camel','chicken','milk','cheese','yogurt','butter','egg','vegetable','fruit','tomato','potato','onion','apple','orange','mango','dates','olive','honey'],
    subcategoryMap: {
      'wheat|rice|corn|grain|crop|قمح|أرز|حبوب': 'grains',
      'sheep|cow|goat|camel|chicken|غنم|بقر|ماعز|ماشية': 'livestock',
      'milk|cheese|yogurt|butter|egg|ألبان|جبن': 'dairy',
      'vegetable|fruit|tomato|potato|onion|apple|orange|mango|dates|olive|خضار|فواكه': 'produce',
    }
  },
  industrial: {
    keywords: ['drill','saw','welding','wrench','hammer','screwdriver','machine','generator','pump','compressor','motor','steel','iron','copper','wood','cement','brick','pipe','cable','wire'],
    subcategoryMap: {
      'drill|saw|wrench|hammer|screwdriver|عدة|عدد': 'tools',
      'machine|generator|pump|compressor|motor|ماكينة': 'machinery',
      'steel|iron|copper|wood|cement|brick|pipe|cable|wire|مواد|خام': 'raw_materials',
    }
  },
  arts_crafts: {
    keywords: ['painting|art|canvas|sculpture|handmade|pottery|ceramic|antique|vintage|brass|copper|calligraphy|embroidery|crochet|knitting'],
    subcategoryMap: {
      'painting|art|canvas|sculpture|لوحة|فن': 'paintings',
      'handmade|pottery|ceramic|embroidery|crochet|knitting|يدوي|حرف': 'handmade',
      'antique|vintage|brass|أثري|أنتيكات|تحف': 'antiques',
    }
  },
  digital: {
    keywords: ['domain','hosting','website','software','license','adobe','microsoft|office','course|udemy|coursera'],
    subcategoryMap: {
      'domain|hosting|website|server|دومين|استضافة': 'domains',
      'software|license|adobe|microsoft|office|تراخيص': 'software_lic',
      'course|udemy|coursera|tutorial|دورة': 'courses',
    }
  },
};

function analyzeImageAI(fileName, imgWidth, imgHeight, fileSize) {
  const name = fileName.toLowerCase().replace(/[_\-\.]/g, ' ');
  let bestCategory = null;
  let bestSubcategory = null;
  let confidence = 0;
  let detectedKeywords = [];

  // Pass 1: keyword matching
  for (const catKey in IMAGE_AI_KEYWORDS) {
    const catData = IMAGE_AI_KEYWORDS[catKey];
    const kws = catData.keywords.join('|').split('|');
    let hits = 0;
    let matchedKws = [];
    for (const kw of kws) {
      if (name.includes(kw.toLowerCase())) {
        hits++;
        matchedKws.push(kw);
      }
    }
    if (hits > 0 && hits > confidence) {
      confidence = hits;
      bestCategory = catKey;
      detectedKeywords = matchedKws;
    }
  }

  // Pass 2: subcategory matching
  if (bestCategory && IMAGE_AI_KEYWORDS[bestCategory]?.subcategoryMap) {
    for (const pattern in IMAGE_AI_KEYWORDS[bestCategory].subcategoryMap) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(name)) {
        bestSubcategory = IMAGE_AI_KEYWORDS[bestCategory].subcategoryMap[pattern];
        break;
      }
    }
  }

  // Heuristic fallbacks from image properties
  let hints = [];
  if (imgWidth && imgHeight) {
    const ratio = imgWidth / imgHeight;
    if (ratio > 2.5) hints.push({ en:'Panoramic image — possibly real estate or landscape', ar:'صورة بانورامية — قد تكون عقارات أو أراضي' });
    if (imgWidth > 3000 || imgHeight > 3000) hints.push({ en:'High-resolution photo — professional quality', ar:'صورة عالية الدقة — جودة احترافية' });
  }
  if (fileSize > 5 * 1024 * 1024) hints.push({ en:'Large file — likely a detailed product photo', ar:'ملف كبير — غالباً صورة منتج تفصيلية' });

  // Confidence score
  const confPct = Math.min(95, 30 + confidence * 20);

  // Suggested base price based on category average
  let suggestedPrice = 500;
  if (bestCategory && bestSubcategory) {
    suggestedPrice = BARTER_CATEGORIES[bestCategory]?.subcategories[bestSubcategory]?.basePrice || 500;
  } else if (bestCategory) {
    const subs = BARTER_CATEGORIES[bestCategory]?.subcategories;
    if (subs) {
      const prices = Object.values(subs).filter(s => s.basePrice).map(s => s.basePrice);
      if (prices.length) suggestedPrice = prices.reduce((a,b) => a+b, 0) / prices.length;
    }
  }

  return {
    category: bestCategory,
    subcategory: bestSubcategory,
    confidence: confPct,
    keywords: detectedKeywords,
    hints,
    suggestedPrice: Math.round(suggestedPrice),
    dimensions: imgWidth && imgHeight ? `${imgWidth}×${imgHeight}` : null,
    fileSize: fileSize ? (fileSize / 1024 / 1024).toFixed(1) + ' MB' : null,
  };
}

// ─────────────────────────────────────────────────────
//  4. MULTIPLIERS
// ─────────────────────────────────────────────────────
const MULTIPLIERS = {
  condition: {
    new:       { labelEn:'Brand New',   labelAr:'جديد تماماً',  val:1.00 },
    like_new:  { labelEn:'Like New',    labelAr:'كالجديد',      val:0.90 },
    excellent: { labelEn:'Excellent',   labelAr:'ممتاز',        val:0.80 },
    good:      { labelEn:'Good',        labelAr:'جيد',          val:0.70 },
    fair:      { labelEn:'Fair',        labelAr:'مقبول',        val:0.50 },
  },
  demand: {
    low:    { labelEn:'Low Demand',    labelAr:'طلب منخفض',  val:0.85 },
    normal: { labelEn:'Normal Demand', labelAr:'طلب طبيعي',  val:1.0 },
    high:   { labelEn:'High Demand',   labelAr:'طلب مرتفع',  val:1.15 },
  },
  complexity: {
    simple:  { labelEn:'Simple',          labelAr:'بسيط',           val:0.9 },
    medium:  { labelEn:'Medium',          labelAr:'متوسط التعقيد',  val:1.0 },
    complex: { labelEn:'Complex',         labelAr:'عالي التعقيد',   val:1.3 },
    expert:  { labelEn:'Expert / Niche',  labelAr:'استشارات نادرة', val:1.6 },
  },
  experience: {
    junior: { labelEn:'Junior',       labelAr:'مبتدئ',        val:0.8 },
    mid:    { labelEn:'Mid-Level',    labelAr:'متوسط الخبرة', val:1.0 },
    expert: { labelEn:'Senior Expert',labelAr:'خبير أول',     val:1.3 },
  }
};

// ─────────────────────────────────────────────────────
//  5. SAMPLE INVENTORY (16 items)
// ─────────────────────────────────────────────────────
const SAMPLE_INVENTORY = [
  { id:'inv-1',  type:'good',    category:'electronics', subcategory:'laptops',      nameEn:'Dell XPS 13 (2024)',                  nameAr:'لابتوب Dell XPS 13 (2024)',          basePrice:1300, ageYears:1,   conditionKey:'like_new',  demandKey:'high',   desiredCategory:'services',    countryCode:'SA', value:0 },
  { id:'inv-2',  type:'good',    category:'electronics', subcategory:'smartphones',  nameEn:'iPhone 15 Pro Max (256GB)',            nameAr:'آيفون 15 برو ماكس (256 جيجا)',       basePrice:1100, ageYears:0.5, conditionKey:'excellent', demandKey:'high',   desiredCategory:'electronics', countryCode:'SA', value:0 },
  { id:'inv-3',  type:'good',    category:'vehicles',    subcategory:'bicycles',     nameEn:'Specialized Hybrid Bike',              nameAr:'دراجة هوائية هجينة Specialized',     basePrice:500,  ageYears:1,   conditionKey:'like_new',  demandKey:'normal', desiredCategory:'home_garden', countryCode:'EG', value:0 },
  { id:'inv-4',  type:'service', category:'services',    subcategory:'development',  nameEn:'E-commerce Website (React + Node)',     nameAr:'برمجة متجر إلكتروني (React + Node)', hourlyRate:50,  hours:20, complexityKey:'complex', experienceKey:'mid',    desiredCategory:'electronics', countryCode:'EG', value:0 },
  { id:'inv-5',  type:'service', category:'services',    subcategory:'design',       nameEn:'Brand Identity & Logo Package',         nameAr:'تصميم هوية بصرية وشعار كامل',       hourlyRate:35,  hours:10, complexityKey:'medium',  experienceKey:'expert', desiredCategory:'services',    countryCode:'SA', value:0 },
  { id:'inv-6',  type:'good',    category:'home_garden', subcategory:'furniture',    nameEn:'Modern L-Shape Sectional Sofa',         nameAr:'أريكة زاوية حديثة L-Shape',          basePrice:900,  ageYears:2,   conditionKey:'good',     demandKey:'normal', desiredCategory:'vehicles',    countryCode:'EG', value:0 },
  { id:'inv-7',  type:'good',    category:'electronics', subcategory:'consoles',     nameEn:'Sony PlayStation 5 + 3 Games',          nameAr:'بلايستيشن 5 سوني + 3 ألعاب',        basePrice:550,  ageYears:1,   conditionKey:'excellent', demandKey:'high',  desiredCategory:'electronics', countryCode:'SA', value:0 },
  { id:'inv-8',  type:'service', category:'education',   subcategory:'languages',    nameEn:'Private English Lessons (30h Package)',  nameAr:'دروس إنجليزي خصوصي (باقة 30 ساعة)', hourlyRate:30,  hours:30, complexityKey:'simple',  experienceKey:'expert', desiredCategory:'electronics', countryCode:'EG', value:0 },
  { id:'inv-9',  type:'good',    category:'fashion',     subcategory:'watches',      nameEn:'Seiko Presage Automatic Watch',          nameAr:'ساعة سيكو بريساج أوتوماتيك',        basePrice:450,  ageYears:1.5, conditionKey:'excellent', demandKey:'normal',desiredCategory:'services',    countryCode:'SA', value:0 },
  { id:'inv-10', type:'service', category:'services',    subcategory:'marketing',    nameEn:'Social Media Management (3 months)',     nameAr:'إدارة سوشيال ميديا (3 أشهر)',       hourlyRate:25,  hours:60, complexityKey:'medium',  experienceKey:'mid',    desiredCategory:'fashion',     countryCode:'EG', value:0 },
  // ── New items for new categories ──
  { id:'inv-11', type:'good',    category:'real_estate', subcategory:'apartments',   nameEn:'2BR Apartment Downtown Cairo',           nameAr:'شقة غرفتين وسط القاهرة',            basePrice:45000, ageYears:5,  conditionKey:'good',     demandKey:'high',   desiredCategory:'vehicles',    countryCode:'EG', value:0 },
  { id:'inv-12', type:'service', category:'home_services', subcategory:'painting',   nameEn:'Full Apartment Painting (3BR)',           nameAr:'نقاشة شقة كاملة (3 غرف)',           hourlyRate:20,  hours:40, complexityKey:'medium',  experienceKey:'mid',    desiredCategory:'electronics', countryCode:'EG', value:0 },
  { id:'inv-13', type:'good',    category:'food_agri',   subcategory:'livestock',    nameEn:'5 Sheep (Awassi Breed)',                  nameAr:'5 رؤوس غنم (سلالة عواسي)',          basePrice:2500, ageYears:0.5, conditionKey:'excellent', demandKey:'high',  desiredCategory:'home_garden', countryCode:'SA', value:0 },
  { id:'inv-14', type:'service', category:'education',   subcategory:'languages',    nameEn:'Arabic for Beginners (20h)',               nameAr:'تعليم عربي للمبتدئين (20 ساعة)',     hourlyRate:30,  hours:20, complexityKey:'medium',  experienceKey:'expert', desiredCategory:'digital',     countryCode:'EG', value:0 },
  { id:'inv-15', type:'good',    category:'arts_crafts', subcategory:'antiques',     nameEn:'Ottoman-era Brass Coffee Set',             nameAr:'طقم قهوة نحاسي عثماني أثري',        basePrice:1200, ageYears:80, conditionKey:'good',     demandKey:'normal', desiredCategory:'fashion',     countryCode:'EG', value:0 },
  { id:'inv-16', type:'good',    category:'industrial',  subcategory:'tools',        nameEn:'DeWalt Power Drill Kit',                   nameAr:'شنيور ديوالت مع طقم سنون',          basePrice:350,  ageYears:1,  conditionKey:'like_new',  demandKey:'normal', desiredCategory:'home_services', countryCode:'SA', value:0 },
];

// ─────────────────────────────────────────────────────
//  6. BARTER PRICING ENGINE
// ─────────────────────────────────────────────────────
class BarterEngine {

  /** Value a physical good — supports 3 depreciation models */
  static valueGood(p) {
    const base   = parseFloat(p.basePrice) || 0;
    const age    = parseFloat(p.ageYears)  || 0;
    const depr   = parseFloat(p.deprRate)  || 0.10;
    const infl   = parseFloat(p.inflationRate) || 0;
    const cond   = MULTIPLIERS.condition[p.conditionKey]?.val || 1.0;
    const demand = MULTIPLIERS.demand[p.demandKey]?.val       || 1.0;

    const inflAdj = base * Math.pow(1 + infl, age);
    let deprVal;

    if (depr < 0) {
      // APPRECIATION model (real estate, antiques, art, jewelry, livestock)
      deprVal = inflAdj * Math.pow(1 + Math.abs(depr), age);
    } else if (depr > 0.5) {
      // RAPID DECAY model (perishables, dairy, produce)
      deprVal = inflAdj * Math.exp(-depr * age * 12); // monthly decay
      const floor = inflAdj * 0.01;
      if (deprVal < floor) deprVal = floor;
    } else {
      // STANDARD declining balance (electronics, vehicles, furniture)
      deprVal = inflAdj * Math.pow(1 - depr, age);
      const floor = inflAdj * 0.10;
      if (deprVal < floor) deprVal = floor;
    }

    const final = deprVal * cond * demand;
    return {
      basePrice: base, inflationAdjustedBase: inflAdj, depreciatedValue: deprVal,
      conditionFactor: cond, demandFactor: demand,
      deprModel: depr < 0 ? 'appreciation' : (depr > 0.5 ? 'rapid_decay' : 'declining_balance'),
      finalValue: Math.round(final * 100) / 100
    };
  }

  /** Value a professional service */
  static valueService(p) {
    const rate    = parseFloat(p.hourlyRate) || 30;
    const hours   = parseFloat(p.hours)     || 10;
    const compMul = MULTIPLIERS.complexity[p.complexityKey]?.val  || 1.0;
    const expMul  = MULTIPLIERS.experience[p.experienceKey]?.val || 1.0;
    const baseCost = rate * hours;
    const final    = baseCost * compMul * expMul;
    return {
      baseCost, complexityFactor: compMul, experienceFactor: expMul,
      finalValue: Math.round(final * 100) / 100
    };
  }

  /**
   * Convert USD barter value → country-local price with import duties.
   */
  static getCountryPrice(usdValue, countryCode, categoryKey) {
    const c = COUNTRIES[countryCode];
    if (!c) return { local: usdValue, usd: usdValue, affordability:0, exchangeRate:1, currency:'USD', symbol:'$' };
    const gf = BARTER_CATEGORIES[categoryKey]?.globalFactor ?? 0.5;
    const duty = IMPORT_DUTIES[categoryKey]?.[countryCode] || IMPORT_DUTIES[categoryKey]?._default || 1.0;
    const colAdj = c.costOfLivingIndex / 100;
    const adjustedUSD = usdValue * (gf + (1 - gf) * colAdj) * duty;
    const localVal = adjustedUSD * c.exchangeRate;
    const affordability = c.avgMonthlyIncome > 0 ? (adjustedUSD / c.avgMonthlyIncome) * 100 : 0;
    return {
      local:  Math.round(localVal * 100) / 100,
      usd:    Math.round(adjustedUSD * 100) / 100,
      affordability: Math.round(affordability * 10) / 10,
      exchangeRate: c.exchangeRate,
      currency: c.currency,
      symbol: c.symbol,
      dutyFactor: duty
    };
  }

  /** Compare barter value across two countries */
  static compareCountries(usdValue, codeA, codeB, categoryKey) {
    const a = BarterEngine.getCountryPrice(usdValue, codeA, categoryKey);
    const b = BarterEngine.getCountryPrice(usdValue, codeB, categoryKey);
    const diffPct = a.usd > 0 ? ((b.usd - a.usd) / a.usd) * 100 : 0;
    const betterDeal = diffPct < 0 ? codeB : (diffPct > 0 ? codeA : 'equal');
    return { a, b, diffPct: Math.round(diffPct * 10) / 10, betterDeal };
  }

  /** Sharia Compliance Checker */
  static checkShariaCompliance(assetA, assetB) {
    const warnings = [];
    const ribawiSubs = ['jewelry','grains','dairy','gold','silver'];
    const perishableSubs = ['dairy','produce','grains'];
    const isRibawiA = ribawiSubs.includes(assetA.subcategory);
    const isRibawiB = ribawiSubs.includes(assetB.subcategory);
    const isPerishableA = perishableSubs.includes(assetA.subcategory);
    const isPerishableB = perishableSubs.includes(assetB.subcategory);

    // Same ribawi type → must be equal & hand-to-hand
    if (isRibawiA && isRibawiB && assetA.subcategory === assetB.subcategory) {
      warnings.push({
        type:'ribawi_same', severity:'high',
        textEn:'⚠️ Same ribawi items: Must be equal weight/measure and exchanged immediately (hand-to-hand).',
        textAr:'⚠️ أصناف ربوية متماثلة: يجب التساوي في الوزن/الكيل والتقابض الفوري (يداً بيد).'
      });
    }
    // Different ribawi types → can differ but must be immediate
    else if (isRibawiA && isRibawiB) {
      warnings.push({
        type:'ribawi_cross', severity:'medium',
        textEn:'ℹ️ Different ribawi items: Amounts may differ but exchange must be immediate.',
        textAr:'ℹ️ أصناف ربوية مختلفة: يجوز التفاضل لكن يشترط التقابض الفوري.'
      });
    }

    // Service → warn about gharar
    if (assetA.type === 'service' || assetB.type === 'service') {
      warnings.push({
        type:'gharar', severity:'info',
        textEn:'📋 Service barter: Ensure the scope, deliverables, and timeline are clearly defined to avoid gharar (uncertainty).',
        textAr:'📋 مقايضة خدمات: تأكد من تحديد نطاق الخدمة والمخرجات والجدول الزمني بوضوح لتجنب الغرر.'
      });
    }

    // Perishable → immediate delivery required
    if (isPerishableA || isPerishableB) {
      warnings.push({
        type:'perishable', severity:'medium',
        textEn:'🕐 Perishable items: Delivery must be prompt to avoid spoilage and ensure fairness.',
        textAr:'🕐 سلع قابلة للتلف: يجب التسليم الفوري لتجنب التلف وضمان العدالة.'
      });
    }

    // Cash settlement + delayed delivery warning
    if (assetA.value !== assetB.value) {
      warnings.push({
        type:'settlement', severity:'info',
        textEn:'💰 Cash settlement must be paid at the time of exchange — no deferment to avoid riba implications.',
        textAr:'💰 التسوية النقدية يجب أن تتم وقت التبادل — لا تأجيل لتجنب شبهة الربا.'
      });
    }

    const hasHigh = warnings.some(w => w.severity === 'high');
    const hasMedium = warnings.some(w => w.severity === 'medium');
    const rating = hasHigh ? 'needs_review' : (hasMedium ? 'halal_with_conditions' : 'halal');

    return { isCompliant: !hasHigh, rating, warnings };
  }

  /** Compatibility solver between two assets */
  static solveCompatibility(assetA, assetB) {
    const valA = parseFloat(assetA.value) || 0;
    const valB = parseFloat(assetB.value) || 0;
    const liqA = parseFloat(assetA.liquidity) || 0.60;
    const liqB = parseFloat(assetB.liquidity) || 0.60;

    let isIdenticalModel = false;
    if (assetA.type === 'good' && assetB.type === 'good') {
      const nameA = assetA.name || '';
      const nameBEn = assetB.nameEn || assetB.name || '';
      const nameBAr = assetB.nameAr || assetB.name || '';
      if (areIdenticalModels(nameA, nameBEn) || areIdenticalModels(nameA, nameBAr)) {
        isIdenticalModel = true;
      }
    }

    let valueScore = 100;
    if (isIdenticalModel) {
      valueScore = 100;
    } else if (valA > 0 || valB > 0) {
      const maxV = Math.max(valA, valB);
      valueScore = Math.max(0, 100 - (Math.abs(valA - valB) / maxV) * 100);
    }

    let categoryScore = 100, catMatchA = false, catMatchB = false;
    if (assetA.desiredCategory || assetB.desiredCategory) {
      categoryScore = 0;
      if (!assetA.desiredCategory || assetB.category === assetA.desiredCategory) { categoryScore += 50; catMatchA = true; }
      if (!assetB.desiredCategory || assetA.category === assetB.desiredCategory) { categoryScore += 50; catMatchB = true; }
    }

    const totalScore = valueScore * 0.70 + categoryScore * 0.30;
    const cashOffset = Math.abs(valA - valB);
    const offsetPayer = valA > valB ? 'B' : (valB > valA ? 'A' : null);
    const txFee = Math.max(valA, valB) * 0.015;

    let shippingFee = 0;
    if (assetA.countryCode && assetB.countryCode && assetA.countryCode !== assetB.countryCode) {
      const proximity = getProximityScore(assetA.countryCode, assetB.countryCode);
      if (proximity > 0) {
        if (assetB.type === 'good') {
          const baseRates = [0, 30, 60, 100];
          const pctRates = [0, 0.02, 0.04, 0.06];
          shippingFee = baseRates[proximity] + valB * pctRates[proximity];
        } else {
          const baseRates = [0, 50, 100, 200];
          const pctRates = [0, 0.01, 0.02, 0.03];
          shippingFee = baseRates[proximity] + valB * pctRates[proximity];
        }
      }
    }

    const avgLiq = (liqA + liqB) / 2;
    const velocity = avgLiq >= 0.80 ? 'fast' : (avgLiq < 0.55 ? 'slow' : 'moderate');
    const maxV = Math.max(valA, valB);
    const oRatio = maxV > 0 ? cashOffset / maxV : 0;
    const feasibility = oRatio > 0.40 ? 'low' : (oRatio > 0.15 ? 'moderate' : 'high');

    return {
      valueScore: Math.round(valueScore), categoryScore: Math.round(categoryScore),
      totalScore: Math.round(totalScore),
      cashOffset: Math.round(cashOffset * 100) / 100, offsetPayer,
      categoryMatchA: catMatchA, categoryMatchB: catMatchB,
      feasibility, transactionFee: Math.round(txFee * 100) / 100,
      shippingFee: Math.round(shippingFee * 100) / 100,
      avgLiquidity: Math.round(avgLiq * 100), velocity,
      isIdenticalModel
    };
  }
}

// Calculate inventory values
SAMPLE_INVENTORY.forEach(item => {
  if (item.type === 'good') {
    const sub = BARTER_CATEGORIES[item.category]?.subcategories[item.subcategory];
    item.value = BarterEngine.valueGood({
      basePrice: item.basePrice, ageYears: item.ageYears, deprRate: sub?.deprRate || 0.10,
      conditionKey: item.conditionKey, demandKey: item.demandKey, inflationRate: 0.03
    }).finalValue;
  } else {
    item.value = BarterEngine.valueService({
      hourlyRate: item.hourlyRate, hours: item.hours,
      complexityKey: item.complexityKey, experienceKey: item.experienceKey
    }).finalValue;
  }
});

// ─────────────────────────────────────────────────────
//  7. DICTIONARY (EN / AR)
// ─────────────────────────────────────────────────────
const DICT = {
  ar: {
    Good:'سلعة', Service:'خدمة',
    'HIGH FEASIBILITY':'جدوى مرتفعة', 'MODERATE FEASIBILITY':'جدوى متوسطة', 'LOW FEASIBILITY':'جدوى منخفضة',
    unselected:'اختر عنصراً من القائمة بالأسفل لتحليل توافق المقايضة.',
    pays:'يجب على <b>الطرف {payer}</b> دفع تعويض <b>{offset}</b> لتسوية فارق المقايضة.',
    pays_credits:'يجب على <b>الطرف {payer}</b> تحويل <b>{offset} نقطة ائتمانية</b> لتسوية الفارق.',
    even:'مقايضة متوازنة تماماً! لا حاجة لدفع فارق.',
    high_desc:'<b>توافق مرتفع ({total}%)!</b> تطابق ممتاز. السرعة المتوقعة: <b>{vel}</b>.',
    mod_desc:'<b>توافق متوسط ({total}%)،</b> يحتاج تسوية بسيطة. السرعة: <b>{vel}</b>.',
    low_desc:'<b>جدوى منخفضة ({total}%)،</b> فارق السعر كبير. السرعة: <b>{vel}</b>.',
    cat_match:'كلا الطرفين يحصل على التصنيف المرغوب!',
    cat_partial:'أحد الطرفين يحصل على تصنيفه المرغوب.',
    cat_none:'لا تطابق مباشر في تفضيلات التصنيف.',
    fast:'سريع جداً (1-3 أيام) ⚡', moderate:'متوسط (1-2 أسبوع) ⏱️', slow:'بطيء (3-4 أسابيع) 🐢',
    liquidity:'السيولة', Credits:'نقطة',
    better_deal:'الصفقة أفضل في', equal_deal:'الأسعار متساوية تقريباً',
    of_income:'من الدخل الشهري', cheaper:'أرخص', more_expensive:'أغلى',
    vs:'مقابل', no_item:'لم يتم اختيار عنصر', select_item:'اختر من القائمة',
    items_available:'عناصر متاحة', match:'توافق', test_swap:'اختبر المقايضة',
    your_offer:'عرضك', counter_offer:'العرض المقابل',
    sharia_halal:'✅ متوافق شرعاً', sharia_conditions:'⚠️ جائز بشروط', sharia_review:'🔍 يحتاج مراجعة شرعية',
    appreciation:'تقدير', declining:'إهلاك', rapid_decay:'تلف سريع',
    duty_label:'شامل الجمارك',
  },
  en: {
    Good:'Good', Service:'Service',
    'HIGH FEASIBILITY':'HIGH FEASIBILITY', 'MODERATE FEASIBILITY':'MODERATE FEASIBILITY', 'LOW FEASIBILITY':'LOW FEASIBILITY',
    unselected:'Select an item from the inventory below to test swap compatibility.',
    pays:'<b>Party {payer}</b> must pay <b>{offset}</b> cash compensation to settle the value gap.',
    pays_credits:'<b>Party {payer}</b> must transfer <b>{offset} Trade Credits</b> to balance the swap.',
    even:'This swap is perfectly balanced! No cash adjustments needed.',
    high_desc:'<b>High Compatibility ({total}%)!</b> Excellent match. Est. velocity: <b>{vel}</b>.',
    mod_desc:'<b>Moderate Compatibility ({total}%),</b> needs minor balancing. Velocity: <b>{vel}</b>.',
    low_desc:'<b>Low Feasibility ({total}%),</b> value gap is too wide. Velocity: <b>{vel}</b>.',
    cat_match:'Both parties get their desired category!',
    cat_partial:'One party gets their preferred category.',
    cat_none:'No direct category preference match.',
    fast:'Fast (1-3 Days) ⚡', moderate:'Moderate (1-2 Weeks) ⏱️', slow:'Slow (3-4 Weeks) 🐢',
    liquidity:'Liquidity', Credits:'Credits',
    better_deal:'Better deal in', equal_deal:'Prices are roughly equal',
    of_income:'of monthly income', cheaper:'cheaper', more_expensive:'more expensive',
    vs:'vs', no_item:'No Item Selected', select_item:'Select from inventory',
    items_available:'items available', match:'Match', test_swap:'Test Swap',
    your_offer:'Your Offer', counter_offer:'Counter Offer',
    sharia_halal:'✅ Sharia Compliant', sharia_conditions:'⚠️ Permissible with Conditions', sharia_review:'🔍 Needs Sharia Review',
    appreciation:'Appreciation', declining:'Depreciation', rapid_decay:'Rapid Decay',
    duty_label:'incl. duties',
  }
};

// ─────────────────────────────────────────────────────
//  8. APP STATE
// ─────────────────────────────────────────────────────
const state = {
  lang: 'ar',
  country: 'EG',
  compareA: 'EG',
  compareB: 'SA',
  activeType: 'good',
  userAsset: null,
  selectedTarget: null,
  searchQuery: '',
  categoryFilter: '',
};

// ─────────────────────────────────────────────────────
//  9. UI ELEMENT REFS
// ─────────────────────────────────────────────────────
let el = {};

function cacheElements() {
  el = {
    btnEn: document.getElementById('btnEn'),
    btnAr: document.getElementById('btnAr'),
    countrySelect: document.getElementById('countrySelect'),
    typeGoodBtn: document.getElementById('typeGoodBtn'),
    typeServiceBtn: document.getElementById('typeServiceBtn'),
    goodsForm: document.getElementById('goodsForm'),
    servicesForm: document.getElementById('servicesForm'),
    goodTitle: document.getElementById('goodTitle'),
    goodCategory: document.getElementById('goodCategory'),
    goodSubcategory: document.getElementById('goodSubcategory'),
    goodBasePrice: document.getElementById('goodBasePrice'),
    goodAge: document.getElementById('goodAge'),
    goodCondition: document.getElementById('goodCondition'),
    goodDemand: document.getElementById('goodDemand'),
    serviceTitle: document.getElementById('serviceTitle'),
    serviceCategory: document.getElementById('serviceCategory'),
    serviceSubcategory: document.getElementById('serviceSubcategory'),
    serviceHourlyRate: document.getElementById('serviceHourlyRate'),
    serviceHours: document.getElementById('serviceHours'),
    serviceComplexity: document.getElementById('serviceComplexity'),
    serviceExperience: document.getElementById('serviceExperience'),
    desiredCategory: document.getElementById('desiredCategory'),
    valResultAmount: document.getElementById('valResultAmount'),
    valResultUsd: document.getElementById('valResultUsd'),
    valResultDetail: document.getElementById('valResultDetail'),
    valDeprModel: document.getElementById('valDeprModel'),
    valCountryFlag: document.getElementById('valCountryFlag'),
    compareCountryA: document.getElementById('compareCountryA'),
    compareCountryB: document.getElementById('compareCountryB'),
    compAFlag: document.getElementById('compAFlag'),
    compAName: document.getElementById('compAName'),
    compAPrice: document.getElementById('compAPrice'),
    compAPower: document.getElementById('compAPower'),
    compBFlag: document.getElementById('compBFlag'),
    compBName: document.getElementById('compBName'),
    compBPrice: document.getElementById('compBPrice'),
    compBPower: document.getElementById('compBPower'),
    compDiffBadge: document.getElementById('compDiffBadge'),
    compAnalysis: document.getElementById('compAnalysis'),
    feasibilityBadge: document.getElementById('feasibilityBadge'),
    slotAName: document.getElementById('slotAName'),
    slotACat: document.getElementById('slotACat'),
    slotAPrice: document.getElementById('slotAPrice'),
    slotALiq: document.getElementById('slotALiq'),
    compGauge: document.getElementById('compGauge'),
    compValue: document.getElementById('compValue'),
    slotB: document.getElementById('slotB'),
    slotBName: document.getElementById('slotBName'),
    slotBCat: document.getElementById('slotBCat'),
    slotBPrice: document.getElementById('slotBPrice'),
    slotBLiq: document.getElementById('slotBLiq'),
    diagSummary: document.getElementById('diagSummary'),
    settlementMode: document.getElementById('settlementMode'),
    diagFee: document.getElementById('diagFee'),
    shippingFeeContainer: document.getElementById('shippingFeeContainer'),
    shippingFee: document.getElementById('shippingFee'),
    scoreValueAlign: document.getElementById('scoreValueAlign'),
    scorePrefMatch: document.getElementById('scorePrefMatch'),
    scoreLiquidity: document.getElementById('scoreLiquidity'),
    shariaPanel: document.getElementById('shariaPanel'),
    shariaBadge: document.getElementById('shariaBadge'),
    shariaWarnings: document.getElementById('shariaWarnings'),
    searchInventory: document.getElementById('searchInventory'),
    filterCategory: document.getElementById('filterCategory'),
    inventoryGrid: document.getElementById('inventoryGrid'),
    inventoryCount: document.getElementById('inventoryCount'),
  };
}

// ─────────────────────────────────────────────────────
//  10. HELPERS
// ─────────────────────────────────────────────────────
function t(key) {
  if (DICT[state.lang]?.[key]) return DICT[state.lang][key];
  for (const ck in BARTER_CATEGORIES) {
    const cat = BARTER_CATEGORIES[ck];
    if (ck === key) return state.lang === 'en' ? cat.labelEn : cat.labelAr;
    for (const sk in cat.subcategories) {
      if (sk === key) return state.lang === 'en' ? cat.subcategories[sk].labelEn : cat.subcategories[sk].labelAr;
    }
  }
  return key;
}

function countryName(code) {
  const c = COUNTRIES[code];
  return c ? (state.lang === 'en' ? c.nameEn : c.nameAr) : code;
}

function fmtLocal(val, code) {
  const c = COUNTRIES[code] || COUNTRIES.EG;
  const decimals = c.exchangeRate > 100 ? 0 : 2;
  const numStr = val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  if (state.lang === 'ar') return numStr + ' ' + c.symbol;
  return c.symbol + numStr;
}

function fmtUSD(val) {
  return '$' + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

function validateInput(input, min, max) {
  const val = parseFloat(input.value);
  if (isNaN(val) || val < min) { input.value = min; input.classList.add('input-error'); }
  else if (val > max) { input.value = max; input.classList.add('input-error'); }
  else { input.classList.remove('input-error'); }
}

function normalizeModelName(name) {
  if (!name) return '';
  let s = name.toLowerCase().trim();
  const arNums = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];
  for (let i = 0; i < 10; i++) {
    s = s.replace(arNums[i], i.toString());
  }
  s = s.replace(/[أإآ]/g, 'ا');
  s = s.replace(/ى/g, 'ي');
  s = s.replace(/ة/g, 'ه');
  s = s.replace(/ايفون/g, 'iphone');
  s = s.replace(/سامسونج/g, 'samsung');
  s = s.replace(/شاومي/g, 'xiaomi');
  s = s.replace(/برو ماكس/g, 'pro max');
  s = s.replace(/برو/g, 'pro');
  s = s.replace(/ماكس/g, 'max');
  s = s.replace(/بلس/g, 'plus');
  s = s.replace(/جيجا/g, 'gb');
  s = s.replace(/تيرا/g, 'tb');
  s = s.replace(/[\-_,\(\)\{\}\[\]\.\/\\]/g, ' ');
  s = s.replace(/\s+/g, ' ');
  return s.trim();
}

function areIdenticalModels(name1, name2) {
  const n1 = normalizeModelName(name1);
  const n2 = normalizeModelName(name2);
  if (!n1 || !n2) return false;
  if (n1 === n2) return true;
  const clean = (str) => {
    return str
      .replace(/\b\d+\s*(gb|tb|mb|جيجا|تيرا)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };
  const c1 = clean(n1);
  const c2 = clean(n2);
  if (c1 && c2 && c1 === c2) return true;
  return false;
}

// ─────────────────────────────────────────────────────
//  11. POPULATE SELECTORS
// ─────────────────────────────────────────────────────
function populateCountrySelect(selectEl, selectedCode) {
  selectEl.innerHTML = '';
  const regions = [
    { label: state.lang === 'en' ? '── Arab Countries ──' : '── الدول العربية ──', codes: ['EG','SA','AE','KW','QA','BH','OM','JO','LB','IQ','LY','TN','MA','DZ','SD'] },
    { label: state.lang === 'en' ? '── Western Countries ──' : '── الدول الغربية ──', codes: ['US','GB','DE','FR','ES'] },
    { label: state.lang === 'en' ? '── Other Economies ──' : '── اقتصادات أخرى ──', codes: ['TR','IN','CN','JP','BR','NG','ZA','MX','RU','PK'] },
  ];
  regions.forEach(r => {
    const grp = document.createElement('optgroup');
    grp.label = r.label;
    r.codes.forEach(code => {
      const c = COUNTRIES[code]; if (!c) return;
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = `${c.flag} ${state.lang === 'en' ? c.nameEn : c.nameAr} (${c.currency})`;
      if (code === selectedCode) opt.selected = true;
      grp.appendChild(opt);
    });
    selectEl.appendChild(grp);
  });
}

function populateFormSelectors() {
  // Goods categories (all that have basePrice subcategories)
  el.goodCategory.innerHTML = '';
  for (const k in BARTER_CATEGORIES) {
    const cat = BARTER_CATEGORIES[k];
    if (cat.isService) continue;
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = `${cat.icon} ${state.lang === 'en' ? cat.labelEn : cat.labelAr}`;
    el.goodCategory.appendChild(opt);
  }

  // Service category selector
  if (el.serviceCategory) {
    el.serviceCategory.innerHTML = '';
    for (const k in BARTER_CATEGORIES) {
      const cat = BARTER_CATEGORIES[k];
      if (!cat.isService) continue;
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = `${cat.icon} ${state.lang === 'en' ? cat.labelEn : cat.labelAr}`;
      el.serviceCategory.appendChild(opt);
    }
  }

  // Condition
  el.goodCondition.innerHTML = '';
  for (const k in MULTIPLIERS.condition) {
    const m = MULTIPLIERS.condition[k];
    const opt = document.createElement('option');
    opt.value = k; opt.textContent = state.lang === 'en' ? m.labelEn : m.labelAr;
    if (k === 'excellent') opt.selected = true;
    el.goodCondition.appendChild(opt);
  }

  // Demand
  el.goodDemand.innerHTML = '';
  for (const k in MULTIPLIERS.demand) {
    const m = MULTIPLIERS.demand[k];
    const opt = document.createElement('option');
    opt.value = k; opt.textContent = state.lang === 'en' ? m.labelEn : m.labelAr;
    if (k === 'normal') opt.selected = true;
    el.goodDemand.appendChild(opt);
  }

  // Service subcategories (from selected service category)
  updateServiceSubcategories();

  // Complexity
  el.serviceComplexity.innerHTML = '';
  for (const k in MULTIPLIERS.complexity) {
    const m = MULTIPLIERS.complexity[k];
    const opt = document.createElement('option');
    opt.value = k; opt.textContent = state.lang === 'en' ? m.labelEn : m.labelAr;
    if (k === 'medium') opt.selected = true;
    el.serviceComplexity.appendChild(opt);
  }

  // Experience
  el.serviceExperience.innerHTML = '';
  for (const k in MULTIPLIERS.experience) {
    const m = MULTIPLIERS.experience[k];
    const opt = document.createElement('option');
    opt.value = k; opt.textContent = state.lang === 'en' ? m.labelEn : m.labelAr;
    if (k === 'mid') opt.selected = true;
    el.serviceExperience.appendChild(opt);
  }

  // Desired category (all categories)
  el.desiredCategory.innerHTML = '';
  const anyOpt = document.createElement('option');
  anyOpt.value = '';
  anyOpt.textContent = state.lang === 'en' ? 'Any Category' : 'أي تصنيف (مفتوح)';
  el.desiredCategory.appendChild(anyOpt);
  for (const k in BARTER_CATEGORIES) {
    const cat = BARTER_CATEGORIES[k];
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = `${cat.icon} ${state.lang === 'en' ? cat.labelEn : cat.labelAr}`;
    el.desiredCategory.appendChild(opt);
  }

  // Filter categories
  el.filterCategory.innerHTML = '';
  const allOpt = document.createElement('option');
  allOpt.value = '';
  allOpt.textContent = state.lang === 'en' ? 'All Categories' : 'جميع التصنيفات';
  el.filterCategory.appendChild(allOpt);
  for (const k in BARTER_CATEGORIES) {
    const cat = BARTER_CATEGORIES[k];
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = `${cat.icon} ${state.lang === 'en' ? cat.labelEn : cat.labelAr}`;
    el.filterCategory.appendChild(opt);
  }

  updateGoodSubcategories();
}

function updateGoodSubcategories() {
  const catKey = el.goodCategory.value;
  if (!catKey) return;
  el.goodSubcategory.innerHTML = '';
  const subcats = BARTER_CATEGORIES[catKey]?.subcategories || {};
  for (const k in subcats) {
    const s = subcats[k];
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = state.lang === 'en' ? s.labelEn : s.labelAr;
    el.goodSubcategory.appendChild(opt);
  }
  onSubcategoryChange();
}

function updateServiceSubcategories() {
  const catKey = el.serviceCategory ? el.serviceCategory.value : 'services';
  el.serviceSubcategory.innerHTML = '';
  const cat = BARTER_CATEGORIES[catKey];
  if (!cat) return;
  for (const k in cat.subcategories) {
    const s = cat.subcategories[k];
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = state.lang === 'en' ? s.labelEn : s.labelAr;
    el.serviceSubcategory.appendChild(opt);
  }
  onServiceSubcategoryChange();
}

function onSubcategoryChange() {
  const catKey = el.goodCategory.value;
  const subKey = el.goodSubcategory.value;
  if (catKey && subKey) {
    const sub = BARTER_CATEGORIES[catKey]?.subcategories[subKey];
    if (sub?.basePrice) el.goodBasePrice.value = sub.basePrice;
  }
  calculateValuation();
}

function onServiceSubcategoryChange() {
  const catKey = el.serviceCategory ? el.serviceCategory.value : 'services';
  const subKey = el.serviceSubcategory.value;
  if (subKey) {
    const sub = BARTER_CATEGORIES[catKey]?.subcategories[subKey];
    if (sub?.hourlyRate) el.serviceHourlyRate.value = sub.hourlyRate;
  }
  calculateValuation();
}

// ─────────────────────────────────────────────────────
//  12. CORE CALCULATIONS
// ─────────────────────────────────────────────────────
function calculateValuation() {
  let valUSD = 0;
  let detailText = '';
  let assetName = '';
  let assetCategory = '';
  let liquidityValue = 0.60;
  let categoryKey = 'electronics';
  let deprModel = 'declining_balance';

  if (state.activeType === 'good') {
    const cat = el.goodCategory.value;
    const sub = el.goodSubcategory.value;
    categoryKey = cat;
    const baseVal = clamp(parseFloat(el.goodBasePrice.value) || 0, 0, 10000000);
    const subData = BARTER_CATEGORIES[cat]?.subcategories[sub];
    const depr = subData?.deprRate || 0.10;
    liquidityValue = subData?.liquidity || 0.60;
    const countryInfl = COUNTRIES[state.country]?.inflationRate || 0.03;

    const v = BarterEngine.valueGood({
      basePrice: baseVal, ageYears: clamp(parseFloat(el.goodAge.value) || 0, 0, 100),
      deprRate: depr, conditionKey: el.goodCondition.value,
      demandKey: el.goodDemand.value, inflationRate: countryInfl
    });
    valUSD = v.finalValue;
    deprModel = v.deprModel;
    const modelLabel = t(deprModel === 'appreciation' ? 'appreciation' : (deprModel === 'rapid_decay' ? 'rapid_decay' : 'declining'));
    detailText = state.lang === 'en'
      ? `Base: ${fmtUSD(v.inflationAdjustedBase)} · ${v.deprModel}: ${v.conditionFactor}x · Demand: ${v.demandFactor}x`
      : `الأساس: ${fmtUSD(v.inflationAdjustedBase)} · ${modelLabel}: ${v.conditionFactor}x · الطلب: ${v.demandFactor}x`;
    assetName = el.goodTitle?.value?.trim() || t(sub);
    assetCategory = `${t(cat)} ➔ ${t(sub)}`;
  } else {
    const serviceCatKey = el.serviceCategory ? el.serviceCategory.value : 'services';
    categoryKey = serviceCatKey;
    const sub = el.serviceSubcategory.value;
    liquidityValue = BARTER_CATEGORIES[serviceCatKey]?.subcategories[sub]?.liquidity || 0.50;
    const v = BarterEngine.valueService({
      hourlyRate: clamp(parseFloat(el.serviceHourlyRate.value) || 0, 0, 1000),
      hours: clamp(parseFloat(el.serviceHours.value) || 0, 0, 10000),
      complexityKey: el.serviceComplexity.value,
      experienceKey: el.serviceExperience.value
    });
    valUSD = v.finalValue;
    detailText = state.lang === 'en'
      ? `Base: ${fmtUSD(v.baseCost)} · Complexity: ${v.complexityFactor}x · Exp: ${v.experienceFactor}x`
      : `الأساس: ${fmtUSD(v.baseCost)} · التعقيد: ${v.complexityFactor}x · الخبرة: ${v.experienceFactor}x`;
    assetName = el.serviceTitle?.value?.trim() || t(sub);
    assetCategory = `${t(categoryKey)} ➔ ${t(sub)}`;
  }

  // Country-adjusted price
  const cp = BarterEngine.getCountryPrice(valUSD, state.country, categoryKey);

  // Update result UI
  el.valResultAmount.textContent = fmtLocal(cp.local, state.country);
  el.valResultUsd.textContent = `≈ ${fmtUSD(cp.usd)}`;
  el.valResultDetail.textContent = detailText;
  el.valCountryFlag.textContent = COUNTRIES[state.country]?.flag || '🌍';
  if (el.valDeprModel) {
    const modelIcon = deprModel === 'appreciation' ? '📈' : (deprModel === 'rapid_decay' ? '📉⚡' : '📉');
    const dutyText = cp.dutyFactor > 1.0 ? ` · ${t('duty_label')} ${Math.round((cp.dutyFactor-1)*100)}%` : '';
    el.valDeprModel.textContent = `${modelIcon} ${t(deprModel === 'appreciation' ? 'appreciation' : (deprModel === 'rapid_decay' ? 'rapid_decay' : 'declining'))}${dutyText}`;
  }

  // Sync user asset
  state.userAsset = {
    type: state.activeType, category: categoryKey,
    subcategory: state.activeType === 'good' ? el.goodSubcategory.value : el.serviceSubcategory.value,
    name: assetName, categoryLabel: assetCategory,
    value: cp.usd, valueLocal: cp.local, liquidity: liquidityValue,
    desiredCategory: el.desiredCategory.value, countryCode: state.country
  };

  // Sync slot A
  el.slotAName.textContent = assetName;
  el.slotACat.textContent = assetCategory;
  el.slotAPrice.textContent = fmtLocal(cp.local, state.country);
  const liqLabel = liquidityValue >= 0.80 ? (state.lang==='en'?'High':'مرتفع') : (liquidityValue < 0.55 ? (state.lang==='en'?'Low':'منخفض') : (state.lang==='en'?'Med':'متوسط'));
  el.slotALiq.textContent = `${t('liquidity')}: ${liqLabel} (${Math.round(liquidityValue*100)}%)`;

  updateCountryComparison(valUSD, categoryKey);
  runMatching();
  renderValuationSuggestions(cp.usd);
}

function renderValuationSuggestions(evaluatedUsd) {
  const box = document.getElementById('valSuggestionsBox');
  const list = document.getElementById('valSuggestionsList');
  if (!box || !list) return;

  if (!evaluatedUsd) {
    box.style.display = 'none';
    return;
  }

  // Filter listings within +/- 25% value range from SAMPLE_INVENTORY
  const tolerance = 0.25;
  const minVal = evaluatedUsd * (1 - tolerance);
  const maxVal = evaluatedUsd * (1 + tolerance);

  const matched = SAMPLE_INVENTORY.filter(l => l.value >= minVal && l.value <= maxVal);

  // Sort matched listings by closeness to evaluatedUsd
  matched.sort((a, b) => Math.abs(a.value - evaluatedUsd) - Math.abs(b.value - evaluatedUsd));

  const suggestions = matched.slice(0, 3);

  if (suggestions.length === 0) {
    box.style.display = 'none';
    return;
  }

  box.style.display = 'block';
  list.innerHTML = suggestions.map(l => {
    const titleText = state.lang === 'en' ? l.nameEn : l.nameAr;
    const localPrice = BarterEngine.getCountryPrice(l.value, state.country, l.category);
    const valueText = fmtLocal(localPrice.local, state.country);
    
    return `
      <div class="val-suggestion-item" onclick="selectSuggestionListing('${l.id}')" style="display: flex; align-items: center; gap: 10px; background: var(--bg-input); border: 1px solid var(--border); border-radius: var(--r-sm); padding: 8px 12px; cursor: pointer; transition: var(--transition);">
        <span style="font-size: 1.2rem;">📦</span>
        <div style="flex: 1; text-align: right;">
          <div style="font-size: 0.8rem; font-weight: 600; color: var(--text);">${titleText}</div>
          <div style="font-size: 0.72rem; color: var(--text-3);">${t(l.category)} · <b>${valueText}</b></div>
        </div>
        <span style="color: var(--cyan); font-weight: 700; font-size: 0.9rem;">⇄</span>
      </div>
    `;
  }).join('');
}

function selectSuggestionListing(id) {
  const item = SAMPLE_INVENTORY.find(i => i.id === id);
  if (item) {
    state.selectedTarget = item;
    calculateValuation();
    renderInventory();
    document.querySelector('.match-panel').scrollIntoView({ behavior: 'smooth' });
    if (typeof Toast !== 'undefined') {
      Toast.show(state.lang === 'en' ? `Selected ${item.nameEn} for swap test!` : `تم اختيار ${item.nameAr} لمختبر التوافق!`, 'info');
    }
  }
}

window.selectSuggestionListing = selectSuggestionListing;

function updateCountryComparison(usdValue, categoryKey) {
  if (!usdValue && state.userAsset) usdValue = state.userAsset.value;
  if (!categoryKey && state.userAsset) categoryKey = state.userAsset.category;
  if (!usdValue) return;

  const cA = state.compareA;
  const cB = state.compareB;
  const result = BarterEngine.compareCountries(usdValue, cA, cB, categoryKey);
  const countA = COUNTRIES[cA];
  const countB = COUNTRIES[cB];

  el.compAFlag.textContent = countA.flag;
  el.compAName.textContent = countryName(cA);
  el.compAPrice.textContent = fmtLocal(result.a.local, cA);
  el.compAPower.textContent = `${result.a.affordability}% ${t('of_income')}`;

  el.compBFlag.textContent = countB.flag;
  el.compBName.textContent = countryName(cB);
  el.compBPrice.textContent = fmtLocal(result.b.local, cB);
  el.compBPower.textContent = `${result.b.affordability}% ${t('of_income')}`;

  const absDiff = Math.abs(result.diffPct);
  if (absDiff < 2) {
    el.compDiffBadge.textContent = `≈ ${t('equal_deal')}`;
    el.compDiffBadge.className = 'comp-diff-badge neutral';
  } else if (result.diffPct > 0) {
    el.compDiffBadge.textContent = `${countryName(cA)} ${absDiff}% ${t('cheaper')}`;
    el.compDiffBadge.className = 'comp-diff-badge positive';
  } else {
    el.compDiffBadge.textContent = `${countryName(cB)} ${absDiff}% ${t('cheaper')}`;
    el.compDiffBadge.className = 'comp-diff-badge positive';
  }

  const betterCode = result.betterDeal;
  if (betterCode === 'equal') {
    el.compAnalysis.textContent = t('equal_deal');
  } else {
    const betterName = countryName(betterCode);
    const worseCode = betterCode === cA ? cB : cA;
    const worseName = countryName(worseCode);
    el.compAnalysis.innerHTML = state.lang === 'en'
      ? `The barter value is <b>${absDiff}% lower</b> in <b>${betterName}</b> compared to <b>${worseName}</b> — making it a better deal for the buyer in <b>${betterName}</b>.`
      : `قيمة المقايضة <b>أقل بنسبة ${absDiff}%</b> في <b>${betterName}</b> مقارنة بـ <b>${worseName}</b> — مما يجعلها صفقة أفضل للمشتري في <b>${betterName}</b>.`;
  }
}

function runMatching() {
  if (!state.selectedTarget || !state.userAsset) {
    el.compValue.textContent = '—';
    el.compGauge.style.background = `radial-gradient(closest-side, var(--bg) 82%, transparent 83%), conic-gradient(hsl(224,20%,15%) 0%)`;
    el.slotBName.textContent = t('no_item');
    el.slotBCat.textContent = t('select_item');
    el.slotBPrice.textContent = fmtLocal(0, state.country);
    el.slotBLiq.textContent = '';
    el.diagSummary.innerHTML = t('unselected');
    el.diagFee.textContent = fmtLocal(0, state.country);
    if (el.shippingFeeContainer) el.shippingFeeContainer.style.display = 'none';
    if (el.shippingFee) el.shippingFee.textContent = fmtLocal(0, state.country);
    el.scoreValueAlign.textContent = '—';
    el.scorePrefMatch.textContent = '—';
    el.scoreLiquidity.textContent = '—';
    el.feasibilityBadge.style.display = 'none';
    if (el.shariaPanel) el.shariaPanel.style.display = 'none';
    return;
  }

  const target = state.selectedTarget;
  const targetCatKey = target.category;
  let targetLiq = 0.60;
  const catData = BARTER_CATEGORIES[targetCatKey];
  if (catData?.subcategories[target.subcategory]) {
    targetLiq = catData.subcategories[target.subcategory].liquidity || 0.60;
  }

  const assetB = {
    value: target.value,
    category: target.category,
    desiredCategory: target.desiredCategory,
    liquidity: targetLiq,
    countryCode: target.countryCode,
    type: target.type,
    nameEn: target.nameEn,
    nameAr: target.nameAr
  };
  const match = BarterEngine.solveCompatibility(state.userAsset, assetB);

  // Slot B
  el.slotBName.textContent = state.lang === 'en' ? target.nameEn : target.nameAr;
  el.slotBCat.textContent = `${t(target.category)} ➔ ${t(target.subcategory)}`;
  const targetLocal = BarterEngine.getCountryPrice(target.value, state.country, target.category);
  el.slotBPrice.textContent = fmtLocal(targetLocal.local, state.country);
  const tLiqLabel = targetLiq >= 0.80 ? (state.lang==='en'?'High':'مرتفع') : (targetLiq < 0.55 ? (state.lang==='en'?'Low':'منخفض') : (state.lang==='en'?'Med':'متوسط'));
  el.slotBLiq.textContent = `${t('liquidity')}: ${tLiqLabel} (${Math.round(targetLiq*100)}%)`;
  el.slotB.classList.add('active');

  // Gauge
  const score = match.totalScore;
  el.compValue.textContent = `${score}%`;
  const hue = score >= 70 ? 145 : (score >= 45 ? 45 : 355);
  el.compGauge.style.background = `radial-gradient(closest-side, var(--bg) 82%, transparent 83%), conic-gradient(hsl(${hue},80%,50%) 0% ${score}%, hsl(224,20%,15%) ${score}% 100%)`;

  // Feasibility badge
  el.feasibilityBadge.style.display = 'inline-block';
  el.feasibilityBadge.textContent = t(match.feasibility === 'high' ? 'HIGH FEASIBILITY' : (match.feasibility === 'moderate' ? 'MODERATE FEASIBILITY' : 'LOW FEASIBILITY'));
  el.feasibilityBadge.className = `badge-feasibility ${match.feasibility}`;

  // Diagnostics
  const isCredits = el.settlementMode.value === 'credits';
  let offsetText = '';
  if (match.cashOffset === 0) {
    offsetText = t('even');
  } else {
    const payerName = match.offsetPayer === 'A'
      ? (state.lang==='en' ? 'You (A)' : 'أنت (الطرف أ)')
      : (state.lang==='en' ? 'Counter (B)' : 'المقايض (ب)');
    if (isCredits) {
      offsetText = t('pays_credits').replace('{payer}', payerName).replace('{offset}', Math.round(match.cashOffset).toLocaleString());
    } else {
      const userCountryData = COUNTRIES[state.country] || COUNTRIES.EG;
      offsetText = t('pays').replace('{payer}', payerName).replace('{offset}', fmtLocal(match.cashOffset * userCountryData.exchangeRate, state.country));
    }
  }

  const vel = t(match.velocity);
  let qualityText = '';
  if (score >= 75) qualityText = t('high_desc').replace('{total}', score).replace('{vel}', vel);
  else if (score >= 45) qualityText = t('mod_desc').replace('{total}', score).replace('{vel}', vel);
  else qualityText = t('low_desc').replace('{total}', score).replace('{vel}', vel);

  let prefText = '';
  if (match.categoryMatchA && match.categoryMatchB) prefText = `<span class="hl-green">${t('cat_match')}</span>`;
  else if (match.categoryMatchA || match.categoryMatchB) prefText = `<span class="hl-green">${t('cat_partial')}</span>`;
  else prefText = t('cat_none');

  let borderHint = '';
  if (state.userAsset.countryCode !== target.countryCode) {
    const targetCountryName = countryName(target.countryCode);
    borderHint = state.lang === 'en'
      ? `<div style="margin-top:8px; color:var(--amber); font-size:0.82rem;">✈️ International Swap: Requires shipping from <b>${targetCountryName}</b>. Custom duties and delivery charges apply.</div>`
      : `<div style="margin-top:8px; color:var(--amber); font-size:0.82rem;">✈️ مقايضة دولية: تتطلب الشحن من <b>${targetCountryName}</b>. تُطبق الرسوم الجمركية وتكاليف النقل.</div>`;
  }

  let identicalNoticeHtml = '';
  if (match.isIdenticalModel) {
    const userCountryData = COUNTRIES[state.country] || COUNTRIES.EG;
    const formattedOffset = fmtLocal(match.cashOffset * userCountryData.exchangeRate, state.country);
    identicalNoticeHtml = state.lang === 'en'
      ? `<div class="identical-swap-notice" style="background: rgba(16, 185, 129, 0.15); border: 1px solid var(--emerald); padding: 10px; border-radius: var(--r-sm); margin-bottom: 12px; color: var(--emerald); font-weight: 600; font-size: 0.85rem;">
           ⇄ Identical Product Swap: Both offers are the same model/specifications!
           <br><span style="font-weight: normal; font-size: 0.78rem; color: var(--text-2);">Value match set to 100% (pricing differences are just due to local currency rates, duties, or inflation). You can waive the cash offset of <b>${formattedOffset}</b>.</span>
         </div>`
      : `<div class="identical-swap-notice" style="background: rgba(16, 185, 129, 0.15); border: 1px solid var(--emerald); padding: 10px; border-radius: var(--r-sm); margin-bottom: 12px; color: var(--emerald); font-weight: 600; font-size: 0.85rem; text-align: right;">
           ⇄ مقايضة منتج متطابق: كلا العرضين من نفس الموديل والمواصفات!
           <br><span style="font-weight: normal; font-size: 0.78rem; color: var(--text-2);">تم ضبط توافق القيمة إلى 100% (اختلاف السعر يعود لرسوم الجمارك أو سعر الصرف). نوصي بالتنازل عن الفارق النقدي البالغ <b>${formattedOffset}</b>.</span>
         </div>`;
  }

  el.diagSummary.innerHTML = `
    ${identicalNoticeHtml}
    <div style="margin-bottom:8px">${qualityText}</div>
    <div style="margin-bottom:8px">${offsetText}</div>
    ${borderHint}
    <div style="font-size:0.82rem;color:var(--text-3);margin-top:8px">${prefText}</div>
  `;

  el.scoreValueAlign.textContent = `${match.valueScore}%`;
  el.scorePrefMatch.textContent = `${match.categoryScore}%`;
  el.scoreLiquidity.textContent = `${match.avgLiquidity}%`;
  const userCountryData = COUNTRIES[state.country] || COUNTRIES.EG;
  el.diagFee.textContent = fmtLocal(match.transactionFee * userCountryData.exchangeRate, state.country);

  if (el.shippingFeeContainer && el.shippingFee) {
    if (match.shippingFee > 0) {
      el.shippingFee.textContent = fmtLocal(match.shippingFee * userCountryData.exchangeRate, state.country);
      el.shippingFeeContainer.style.display = 'flex';
      const labelEl = document.getElementById('shippingFeeLabel');
      if (labelEl) {
        labelEl.textContent = state.lang === 'en' ? 'Shipping & Transport: ' : 'الشحن والنقل: ';
      }
    } else {
      el.shippingFeeContainer.style.display = 'none';
    }
  }

  // Sharia compliance
  if (el.shariaPanel) {
    const targetAsset = {
      type: target.type, subcategory: target.subcategory,
      category: target.category, value: target.value
    };
    const sharia = BarterEngine.checkShariaCompliance(state.userAsset, targetAsset);
    el.shariaPanel.style.display = 'block';

    const ratingText = t(sharia.rating === 'halal' ? 'sharia_halal' : (sharia.rating === 'halal_with_conditions' ? 'sharia_conditions' : 'sharia_review'));
    el.shariaBadge.textContent = ratingText;
    el.shariaBadge.className = `sharia-badge ${sharia.rating === 'halal' ? '' : (sharia.rating === 'halal_with_conditions' ? 'conditions' : 'review')}`;

    el.shariaWarnings.innerHTML = sharia.warnings.map(w =>
      `<div class="sharia-warn-item ${w.severity}">${state.lang === 'en' ? w.textEn : w.textAr}</div>`
    ).join('');
  }
}

// ─────────────────────────────────────────────────────
//  13. RENDER INVENTORY
// ─────────────────────────────────────────────────────
function renderInventory() {
  el.inventoryGrid.innerHTML = '';
  let filtered = SAMPLE_INVENTORY.filter(item => {
    if (state.categoryFilter && item.category !== state.categoryFilter) return false;
    if (state.searchQuery) {
      const name = (state.lang === 'en' ? item.nameEn : item.nameAr).toLowerCase();
      if (!name.includes(state.searchQuery.toLowerCase())) return false;
    }
    return true;
  });

  // ── Smart Sorting: Country proximity + Compatibility score ──
  const userCountry = state.country;
  filtered = filtered.map(item => {
    const assetB = {
      value: item.value,
      category: item.category,
      desiredCategory: item.desiredCategory,
      liquidity: 0.6,
      countryCode: item.countryCode,
      type: item.type,
      nameEn: item.nameEn,
      nameAr: item.nameAr
    };
    const comp = state.userAsset ? BarterEngine.solveCompatibility(state.userAsset, assetB) : { totalScore: 0 };
    const proximity = getProximityScore(userCountry, item.countryCode);
    return { ...item, _score: comp.totalScore, _proximity: proximity };
  });

  // Sort: proximity ASC first (same country → same region → near → far), then score DESC
  filtered.sort((a, b) => {
    if (a._proximity !== b._proximity) return a._proximity - b._proximity;
    return b._score - a._score;
  });

  el.inventoryCount.textContent = `${filtered.length} ${t('items_available')}`;

  // Proximity labels for section headers
  const proxLabels = {
    0: { en:'📍 Same Country', ar:'📍 نفس البلد' },
    1: { en:'🌐 Same Region', ar:'🌐 نفس المنطقة' },
    2: { en:'🌍 Nearby Region', ar:'🌍 منطقة قريبة' },
    3: { en:'✈️ International', ar:'✈️ دولي' },
  };
  let lastProx = -1;

  filtered.forEach(item => {
    // Insert section header when proximity changes
    if (item._proximity !== lastProx) {
      lastProx = item._proximity;
      const header = document.createElement('div');
      header.className = 'inv-section-header';
      header.textContent = state.lang === 'en' ? proxLabels[lastProx].en : proxLabels[lastProx].ar;
      el.inventoryGrid.appendChild(header);
    }

    const score = item._score;
    const itemCountry = COUNTRIES[item.countryCode];

    const card = document.createElement('div');
    card.className = `product-card ${state.selectedTarget?.id === item.id ? 'selected' : ''} prox-${item._proximity}`;

    const localPrice = BarterEngine.getCountryPrice(item.value, state.country, item.category);

    const proxBadge = item._proximity === 0 ? '<span class="prox-badge local">📍</span>' : '';

    let shippingInfoHtml = '';
    if (item.countryCode !== state.country) {
      const tempAssetA = { value: localPrice.usd, countryCode: state.country, type: 'good' };
      const tempAssetB = { value: item.value, countryCode: item.countryCode, type: item.type };
      const comp = BarterEngine.solveCompatibility(tempAssetA, tempAssetB);
      if (comp.shippingFee > 0) {
        const localShipping = comp.shippingFee * (COUNTRIES[state.country]?.exchangeRate || 1);
        const shippingText = fmtLocal(localShipping, state.country);
        shippingInfoHtml = `<div class="product-shipping" style="font-size: 0.72rem; color: var(--amber); margin-top: 4px; font-weight: 500;">✈️ + ${shippingText} ${state.lang==='en'?'shipping':'شحن ونقل'}</div>`;
      }
    }

    card.innerHTML = `
      <div class="product-card-top">
        <span class="product-tag ${item.type}">${t(item.type==='good'?'Good':'Service')}</span>
        <span class="product-country-badge">${itemCountry?.flag || '🌍'} ${proxBadge}</span>
      </div>
      <div class="product-title">${state.lang === 'en' ? item.nameEn : item.nameAr}</div>
      <div class="product-cat">${t(item.category)} ➔ ${t(item.subcategory)}</div>
      <div class="product-prices">
        <span class="product-price-local">${fmtLocal(localPrice.local, state.country)}</span>
        <span class="product-price-usd">${fmtUSD(item.value)}</span>
        ${shippingInfoHtml}
      </div>
      <div class="product-bottom">
        <span class="match-badge">${score}% ${t('match')}</span>
        <button class="btn-test-swap" data-id="${item.id}">${t('test_swap')}</button>
      </div>
    `;

    card.addEventListener('click', () => selectInventoryItem(item.id));
    el.inventoryGrid.appendChild(card);
  });
}

function selectInventoryItem(id) {
  state.selectedTarget = SAMPLE_INVENTORY.find(i => i.id === id) || null;
  calculateValuation();
  renderInventory();
}

// ─────────────────────────────────────────────────────
//  14. LANGUAGE & COUNTRY
// ─────────────────────────────────────────────────────
function setLanguage(lang) {
  state.lang = lang;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  el.btnEn.classList.toggle('active', lang === 'en');
  el.btnAr.classList.toggle('active', lang === 'ar');

  document.querySelectorAll('[data-en]').forEach(node => {
    const txt = node.getAttribute(`data-${lang}`);
    if (!txt) return;
    if (node.tagName === 'INPUT' && node.type === 'text') node.placeholder = txt;
    else node.textContent = txt;
  });

  const saved = {
    gc: el.goodCategory.value, gs: el.goodSubcategory.value,
    cond: el.goodCondition.value, dem: el.goodDemand.value,
    sc_cat: el.serviceCategory ? el.serviceCategory.value : 'services',
    ss: el.serviceSubcategory.value, sc: el.serviceComplexity.value, se: el.serviceExperience.value,
    dc: el.desiredCategory.value, fc: el.filterCategory.value
  };

  populateCountrySelect(el.countrySelect, state.country);
  populateCountrySelect(el.compareCountryA, state.compareA);
  populateCountrySelect(el.compareCountryB, state.compareB);
  populateFormSelectors();

  if (saved.gc) el.goodCategory.value = saved.gc;
  updateGoodSubcategories();
  if (saved.gs) el.goodSubcategory.value = saved.gs;
  if (saved.cond) el.goodCondition.value = saved.cond;
  if (saved.dem) el.goodDemand.value = saved.dem;
  if (el.serviceCategory && saved.sc_cat) el.serviceCategory.value = saved.sc_cat;
  updateServiceSubcategories();
  if (saved.ss) el.serviceSubcategory.value = saved.ss;
  if (saved.sc) el.serviceComplexity.value = saved.sc;
  if (saved.se) el.serviceExperience.value = saved.se;
  if (saved.dc) el.desiredCategory.value = saved.dc;
  if (saved.fc) el.filterCategory.value = saved.fc;

  calculateValuation();
  renderInventory();
}

function setCountry(code) {
  state.country = code;
  calculateValuation();
  renderInventory();
}

// ─────────────────────────────────────────────────────
//  15. EVENTS
// ─────────────────────────────────────────────────────
function setupEvents() {
  el.btnEn.addEventListener('click', () => setLanguage('en'));
  el.btnAr.addEventListener('click', () => setLanguage('ar'));

  el.countrySelect.addEventListener('change', (e) => setCountry(e.target.value));

  el.typeGoodBtn.addEventListener('click', () => {
    el.typeGoodBtn.classList.add('active');
    el.typeServiceBtn.classList.remove('active');
    el.goodsForm.style.display = 'block';
    el.servicesForm.style.display = 'none';
    state.activeType = 'good';
    calculateValuation();
  });

  el.typeServiceBtn.addEventListener('click', () => {
    el.typeServiceBtn.classList.add('active');
    el.typeGoodBtn.classList.remove('active');
    el.goodsForm.style.display = 'none';
    el.servicesForm.style.display = 'block';
    state.activeType = 'service';
    calculateValuation();
  });

  // Input validation
  el.goodBasePrice.addEventListener('blur', () => validateInput(el.goodBasePrice, 0, 10000000));
  el.goodAge.addEventListener('blur', () => validateInput(el.goodAge, 0, 100));
  el.serviceHourlyRate.addEventListener('blur', () => validateInput(el.serviceHourlyRate, 0, 1000));
  el.serviceHours.addEventListener('blur', () => validateInput(el.serviceHours, 0, 10000));

  [el.goodTitle, el.goodBasePrice, el.goodAge, el.goodCondition, el.goodDemand,
   el.serviceTitle, el.serviceHourlyRate, el.serviceHours, el.serviceComplexity, el.serviceExperience,
   el.desiredCategory, el.settlementMode
  ].forEach(inp => {
    if (!inp) return;
    inp.addEventListener('change', calculateValuation);
    inp.addEventListener('input', calculateValuation);
  });

  el.goodCategory.addEventListener('change', updateGoodSubcategories);
  el.goodSubcategory.addEventListener('change', onSubcategoryChange);
  if (el.serviceCategory) {
    el.serviceCategory.addEventListener('change', updateServiceSubcategories);
  }
  el.serviceSubcategory.addEventListener('change', onServiceSubcategoryChange);

  el.compareCountryA.addEventListener('change', (e) => {
    state.compareA = e.target.value;
    updateCountryComparison();
  });
  el.compareCountryB.addEventListener('change', (e) => {
    state.compareB = e.target.value;
    updateCountryComparison();
  });

  el.searchInventory.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderInventory();
  });
  el.filterCategory.addEventListener('change', (e) => {
    state.categoryFilter = e.target.value;
    renderInventory();
  });
}

// ─────────────────────────────────────────────────────
//  16. AI IMAGE UPLOAD & ANALYSIS
// ─────────────────────────────────────────────────────
function setupImageUpload() {
  const dropzone = document.getElementById('imageDropzone');
  const fileInput = document.getElementById('imageFileInput');
  const previewWrap = document.getElementById('imagePreviewWrap');
  const previewImg = document.getElementById('imagePreview');
  const resultsPanel = document.getElementById('aiResultsPanel');
  if (!dropzone || !fileInput) return;

  // Click to upload
  dropzone.addEventListener('click', () => fileInput.click());

  // Drag & drop
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleImageFile(e.dataTransfer.files[0]);
  });

  // File input change
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleImageFile(e.target.files[0]);
  });
}

function handleImageFile(file) {
  if (!file.type.startsWith('image/')) return;

  const previewWrap = document.getElementById('imagePreviewWrap');
  const previewImg = document.getElementById('imagePreview');
  const resultsPanel = document.getElementById('aiResultsPanel');
  const dropzone = document.getElementById('imageDropzone');

  // Show preview
  const reader = new FileReader();
  reader.onload = (e) => {
    previewImg.src = e.target.result;
    previewWrap.style.display = 'block';
    dropzone.style.display = 'none';

    // Get image dimensions
    const img = new Image();
    img.onload = () => {
      runAIAnalysis(file.name, img.width, img.height, file.size);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function runAIAnalysis(fileName, width, height, fileSize) {
  const resultsPanel = document.getElementById('aiResultsPanel');
  const resultsContent = document.getElementById('aiResultsContent');
  if (!resultsPanel) return;

  // Show loading
  resultsPanel.style.display = 'block';
  resultsContent.innerHTML = `<div class="ai-loading"><span class="ai-spinner"></span> ${state.lang === 'en' ? 'Analyzing image with AI...' : 'جاري تحليل الصورة بالذكاء الاصطناعي...'}</div>`;

  // Simulate processing time
  setTimeout(() => {
    const result = analyzeImageAI(fileName, width, height, fileSize);
    displayAIResults(result);
  }, 1200);
}

function displayAIResults(result) {
  const resultsContent = document.getElementById('aiResultsContent');
  if (!resultsContent) return;

  const lang = state.lang;
  const catLabel = result.category ? (lang === 'en' ? BARTER_CATEGORIES[result.category]?.labelEn : BARTER_CATEGORIES[result.category]?.labelAr) : (lang === 'en' ? 'Unknown' : 'غير محدد');
  const subLabel = result.subcategory && result.category ? (lang === 'en' ? BARTER_CATEGORIES[result.category]?.subcategories[result.subcategory]?.labelEn : BARTER_CATEGORIES[result.category]?.subcategories[result.subcategory]?.labelAr) : '';
  const confColor = result.confidence >= 70 ? 'var(--emerald)' : (result.confidence >= 40 ? 'var(--amber)' : 'var(--rose)');

  let hintsHtml = result.hints.map(h => `<div class="ai-hint">${lang === 'en' ? h.en : h.ar}</div>`).join('');
  let kwHtml = result.keywords.length ? `<div class="ai-keywords">${result.keywords.map(k => `<span class="ai-kw">${k}</span>`).join('')}</div>` : '';

  const cp = BarterEngine.getCountryPrice(result.suggestedPrice, state.country, result.category || 'other');

  resultsContent.innerHTML = `
    <div class="ai-result-header">
      <span class="ai-icon">🤖</span>
      <span class="ai-title">${lang === 'en' ? 'AI Analysis Result' : 'نتيجة تحليل الذكاء الاصطناعي'}</span>
      <span class="ai-conf" style="color:${confColor}">${result.confidence}% ${lang === 'en' ? 'confidence' : 'ثقة'}</span>
    </div>
    <div class="ai-result-body">
      <div class="ai-field">
        <span class="ai-field-label">${lang === 'en' ? 'Detected Category' : 'التصنيف المكتشف'}</span>
        <span class="ai-field-val">${BARTER_CATEGORIES[result.category]?.icon || '❓'} ${catLabel}${subLabel ? ' ➔ ' + subLabel : ''}</span>
      </div>
      <div class="ai-field">
        <span class="ai-field-label">${lang === 'en' ? 'Suggested Price' : 'السعر المقترح'}</span>
        <span class="ai-field-val">${fmtLocal(cp.local, state.country)} (≈ ${fmtUSD(result.suggestedPrice)})</span>
      </div>
      ${result.dimensions ? `<div class="ai-field"><span class="ai-field-label">${lang === 'en' ? 'Image' : 'الصورة'}</span><span class="ai-field-val">${result.dimensions} · ${result.fileSize}</span></div>` : ''}
      ${kwHtml}
      ${hintsHtml}
    </div>
    <div class="ai-actions">
      <button class="btn-ai-apply" onclick="applyAIResult('${result.category}','${result.subcategory}',${result.suggestedPrice})">${lang === 'en' ? '✅ Apply to Form' : '✅ طبّق على النموذج'}</button>
      <button class="btn-ai-reset" onclick="resetImageUpload()">${lang === 'en' ? '🔄 Upload Again' : '🔄 صورة أخرى'}</button>
    </div>
  `;
}

function applyAIResult(category, subcategory, price) {
  if (!category) return;

  // Check if it's a goods category
  const cat = BARTER_CATEGORIES[category];
  if (!cat) return;

  if (cat.isService) {
    // Switch to service mode
    el.typeServiceBtn.click();
    if (el.serviceCategory) {
      el.serviceCategory.value = category;
      updateServiceSubcategories();
      if (subcategory) el.serviceSubcategory.value = subcategory;
      onServiceSubcategoryChange();
    }
  } else {
    // Switch to good mode
    el.typeGoodBtn.click();
    el.goodCategory.value = category;
    updateGoodSubcategories();
    if (subcategory) el.goodSubcategory.value = subcategory;
    el.goodBasePrice.value = price;
    onSubcategoryChange();
  }

  // Animate success
  const panel = document.getElementById('aiResultsPanel');
  if (panel) {
    panel.classList.add('ai-applied');
    setTimeout(() => panel.classList.remove('ai-applied'), 1000);
  }
}

function resetImageUpload() {
  const previewWrap = document.getElementById('imagePreviewWrap');
  const dropzone = document.getElementById('imageDropzone');
  const resultsPanel = document.getElementById('aiResultsPanel');
  const fileInput = document.getElementById('imageFileInput');

  if (previewWrap) previewWrap.style.display = 'none';
  if (dropzone) dropzone.style.display = 'flex';
  if (resultsPanel) resultsPanel.style.display = 'none';
  if (fileInput) fileInput.value = '';
}

// ─────────────────────────────────────────────────────
//  17. INIT
// ─────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  cacheElements();
  populateCountrySelect(el.countrySelect, state.country);
  populateCountrySelect(el.compareCountryA, state.compareA);
  populateCountrySelect(el.compareCountryB, state.compareB);
  populateFormSelectors();
  setupEvents();
  setupImageUpload();
  setLanguage(state.lang);

  // Onboarding
  const closeBtnOB = document.getElementById('closeOnboarding');
  if (closeBtnOB) {
    closeBtnOB.addEventListener('click', () => {
      document.getElementById('onboardingBanner').style.display = 'none';
      localStorage.setItem('barterOnboardingDismissed', 'true');
    });
  }
  if (localStorage.getItem('barterOnboardingDismissed') === 'true') {
    const ob = document.getElementById('onboardingBanner');
    if (ob) ob.style.display = 'none';
  }
});
