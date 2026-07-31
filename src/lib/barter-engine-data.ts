// Data ported from public/pricing-engine/app.js (محرك تسعير المقايضة v2.5)
/* eslint-disable */
export const COUNTRIES = {
  // ── Launch Markets (Phase 1) ──
  EG: { code:'EG', nameEn:'Egypt', nameAr:'مصر', currency:'EGP', symbol:'ج.م', exchangeRate:48.5, pppFactor:0.25, costOfLivingIndex:22, avgMonthlyIncome:250, inflationRate:0.28, flag:'🇪🇬' },
  SA: { code:'SA', nameEn:'Saudi Arabia', nameAr:'السعودية', currency:'SAR', symbol:'ر.س', exchangeRate:3.75, pppFactor:0.65, costOfLivingIndex:42, avgMonthlyIncome:2500, inflationRate:0.025, flag:'🇸🇦' },
};

export const BARTER_CATEGORIES = {
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
    labelEn:'Vehicles', labelAr:'مركبات', icon:'🚗', globalFactor:0.75,
    subcategories: {
      cars:         { labelEn:'Cars',        labelAr:'سيارات',       basePrice:22000, deprRate:0.08, liquidity:0.75 },
      motorcycles:  { labelEn:'Motorcycles', labelAr:'دراجات نارية', basePrice:3500,  deprRate:0.10, liquidity:0.65 },
      bicycles:     { labelEn:'Bicycles',    labelAr:'دراجات هوائية',basePrice:450,   deprRate:0.05, liquidity:0.80 },
    }
  },
  real_estate: {
    labelEn:'Real Estate', labelAr:'عقارات', icon:'🏗️', globalFactor:1.00,
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
      antiques:   { labelEn:'Antiques',         labelAr:'تحف وأنتيكات',    basePrice:400,  deprRate:-0.06, liquidity:0.20 },
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
    labelEn:'Professional Services', labelAr:'خدمات مهنية', icon:'🛠️', globalFactor:0.65, isService:true,
    subcategories: {
      development:  { labelEn:'Software Dev',       labelAr:'برمجة وتطوير',     hourlyRate:50, liquidity:0.50 },
      design:       { labelEn:'Graphic Design',      labelAr:'تصميم غرافيك',     hourlyRate:35, liquidity:0.60 },
      writing:      { labelEn:'Content Writing',     labelAr:'كتابة محتوى',      hourlyRate:20, liquidity:0.55 },
      marketing:    { labelEn:'Digital Marketing',   labelAr:'تسويق إلكتروني',   hourlyRate:25, liquidity:0.45 },
      consulting:   { labelEn:'Consulting',          labelAr:'استشارات أعمال',    hourlyRate:75, liquidity:0.40 },
    }
  },
  home_services: {
    labelEn:'Home Services', labelAr:'خدمات منزلية', icon:'🔧', globalFactor:0.15, isService:true,
    subcategories: {
      plumbing:    { labelEn:'Plumbing',       labelAr:'سباكة',           hourlyRate:25, liquidity:0.75 },
      electrical:  { labelEn:'Electrical',     labelAr:'كهرباء',          hourlyRate:30, liquidity:0.70 },
      painting:    { labelEn:'Painting',       labelAr:'نقاشة ودهانات',   hourlyRate:20, liquidity:0.72 },
      cleaning:    { labelEn:'Cleaning',       labelAr:'تنظيف',           hourlyRate:20, liquidity:0.85 },
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
    labelEn:'Health & Beauty', labelAr:'صحة وجمال', icon:'💊', globalFactor:0.35, isService:true,
    subcategories: {
      medical_svc:  { labelEn:'Medical Services',  labelAr:'خدمات طبية',    hourlyRate:60, liquidity:0.35 },
      beauty_svc:   { labelEn:'Beauty Services',   labelAr:'خدمات تجميل',   hourlyRate:25, liquidity:0.70 },
      fitness:      { labelEn:'Fitness Training',   labelAr:'تدريب رياضي',   hourlyRate:30, liquidity:0.60 },
    }
  },
};

export const IMPORT_DUTIES = {
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

export const MULTIPLIERS = {
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

export const SAMPLE_INVENTORY = [
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
