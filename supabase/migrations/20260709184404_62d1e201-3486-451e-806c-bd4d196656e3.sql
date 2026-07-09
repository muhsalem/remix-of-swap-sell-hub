
DO $$
DECLARE
  _owner uuid;
BEGIN
  SELECT id INTO _owner FROM public.profiles ORDER BY created_at ASC LIMIT 1;
  IF _owner IS NULL THEN RAISE NOTICE 'no owner — skipping'; RETURN; END IF;

  INSERT INTO public.listings (owner_id, title, description, category, condition, age_months, market_price, wants, images, listing_type, city, status, is_ribawi) VALUES
  (_owner, 'آيفون 15 برو ماكس 256 جيجا', 'حالة ممتازة، مع العلبة والملحقات الأصلية، بطارية 98%', 'electronics', 'excellent', 6, 4500, 'لابتوب MacBook أو ساعة Apple Watch Ultra', ARRAY[]::text[], 'item', 'الرياض', 'active', false),
  (_owner, 'لابتوب Dell XPS 15 (2024)', 'معالج i9، رام 32GB، SSD 1TB، شاشة 4K OLED', 'electronics', 'like-new', 4, 6200, 'آيماك 24 بوصة أو مقايضة + فرق', ARRAY[]::text[], 'item', 'جدة', 'active', false),
  (_owner, 'ساعة رولكس Submariner (مقلدة درجة أولى)', 'حالة جديدة لم تُلبس، مع العلبة', 'watches', 'new', 2, 1200, 'ساعة أوميغا أو أي كاميرا احترافية', ARRAY[]::text[], 'item', 'الدمام', 'active', false),
  (_owner, 'سيارة كامري 2020 فل كامل', 'ماشية 80 ألف كم، ضمان الوكالة ساري', 'vehicles', 'good', 60, 78000, 'سيارة SUV أو مقايضة جزئية + كاش', ARRAY[]::text[], 'item', 'الرياض', 'active', false),
  (_owner, 'دراجة نارية هوندا CBR 650', 'موديل 2022، حالة ممتازة، صيانة منتظمة', 'vehicles', 'excellent', 24, 32000, 'سيارة صغيرة أو أي عرض جاد', ARRAY[]::text[], 'item', 'مكة', 'active', false),
  (_owner, 'أثاث غرفة نوم كامل (7 قطع)', 'خشب زان طبيعي، تصميم مودرن، استخدام سنة واحدة', 'furniture', 'excellent', 12, 8500, 'غرفة سفرة أو أثاث مكتب', ARRAY[]::text[], 'item', 'الرياض', 'active', false),
  (_owner, 'كنب زاوية جلد إيطالي', 'لون بيج، 6 مقاعد، بحالة الجديد', 'furniture', 'like-new', 8, 4200, 'طاولة طعام رخام + كراسي', ARRAY[]::text[], 'item', 'جدة', 'active', false),
  (_owner, 'دراجة هوائية جبلية Trek X-Caliber', 'مقاس 29 بوصة، 21 سرعة، حالة ممتازة', 'sports', 'good', 18, 2800, 'ساعة رياضية Garmin أو معدات كمال أجسام', ARRAY[]::text[], 'item', 'الخبر', 'active', false),
  (_owner, 'معدات جيم منزلي (بار + أوزان 100كجم)', 'كامل مع بنش قابل للتعديل', 'sports', 'good', 24, 1800, 'دراجة هوائية أو تجديف كهربائي', ARRAY[]::text[], 'item', 'الرياض', 'active', false),
  (_owner, 'كاميرا Sony A7 IV + عدسة 24-70', 'شاتر أقل من 5000، مع بطاريتين وحقيبة', 'electronics', 'excellent', 10, 12500, 'كاميرا سينمائية أو درون DJI Mavic 3', ARRAY[]::text[], 'item', 'الرياض', 'active', false),
  (_owner, 'درون DJI Mini 4 Pro مع كومبو Fly More', 'استخدام خفيف، جميع الملحقات', 'electronics', 'like-new', 3, 4800, 'كاميرا Sony ZV-E10 أو iPad Pro', ARRAY[]::text[], 'item', 'المدينة', 'active', false),
  (_owner, 'مكتبة كتب إسلامية (200 كتاب)', 'مجموعة تفاسير وفقه وسيرة، بحالة ممتازة', 'books', 'good', 48, 3500, 'مكتبة أدبية أو تاريخية مشابهة', ARRAY[]::text[], 'item', 'مكة', 'active', false),
  (_owner, 'ملابس أطفال (0-3 سنوات) - 50 قطعة', 'ماركات أوروبية، جودة عالية، بحالة الجديد', 'kids', 'like-new', 6, 800, 'ألعاب تعليمية أو عربية أطفال', ARRAY[]::text[], 'item', 'الرياض', 'active', false),
  (_owner, 'عربية أطفال Cybex Priam', 'ثلاثية الوظائف، لون رمادي، استخدام 6 أشهر', 'kids', 'excellent', 6, 2200, 'كرسي سيارة أطفال أو مقايضة + كاش', ARRAY[]::text[], 'item', 'جدة', 'active', false),
  (_owner, 'PlayStation 5 + 3 ألعاب أصلية', 'مع تحكمين وشحن أصلي', 'electronics', 'excellent', 12, 2400, 'Xbox Series X أو Nintendo Switch OLED', ARRAY[]::text[], 'item', 'الدمام', 'active', false),
  (_owner, 'ماكينة قهوة Delonghi Magnifica', 'أوتوماتيكية بالكامل، مع مطحنة مدمجة', 'appliances', 'good', 18, 1800, 'خلاط Vitamix أو فرن كهربائي احترافي', ARRAY[]::text[], 'item', 'الرياض', 'active', false),
  (_owner, 'ثلاجة LG سايد باي سايد', 'انفرتر، 27 قدم، لون فضي', 'appliances', 'good', 30, 3200, 'غسالة أوتوماتيك 15 كجم + مجفف', ARRAY[]::text[], 'item', 'جدة', 'active', false),

  (_owner, 'خدمة تصميم هوية بصرية احترافية', 'شعار + دليل هوية + بطاقات + ملفات مصدرية', 'services', 'new', 0, 1500, 'تصوير احترافي أو خدمة تسويق رقمي', ARRAY[]::text[], 'service', 'الرياض', 'active', false),
  (_owner, 'تصوير منتجات احترافي (20 صورة)', 'ستوديو مجهز، إضاءة احترافية، تعديل كامل', 'services', 'new', 0, 900, 'تصميم موقع إلكتروني أو إعلانات ممولة', ARRAY[]::text[], 'service', 'جدة', 'active', false),
  (_owner, 'برمجة موقع إلكتروني متكامل', 'React + Backend، تصميم متجاوب، لوحة تحكم', 'services', 'new', 0, 5500, 'تصميم هوية أو حملة تسويق كاملة', ARRAY[]::text[], 'service', 'الرياض', 'active', false),
  (_owner, 'دروس خصوصية رياضيات (شهر كامل)', 'مدرس معتمد، 12 حصة، ثانوي ومتوسط', 'services', 'new', 0, 800, 'دروس لغة إنجليزية أو مواد علمية أخرى', ARRAY[]::text[], 'service', 'مكة', 'active', false),
  (_owner, 'حصص لغة إنجليزية (IELTS)', 'مدرب معتمد بريطاني، 20 ساعة تحضير', 'services', 'new', 0, 1800, 'دروس عربي للأجانب أو مواد اختبارات', ARRAY[]::text[], 'service', 'الرياض', 'active', false),
  (_owner, 'استشارة تسويق رقمي (5 جلسات)', 'خبرة 10 سنوات، تحليل ووضع استراتيجية', 'services', 'new', 0, 2500, 'تصميم مواقع أو محتوى سوشيال ميديا', ARRAY[]::text[], 'service', 'جدة', 'active', false),
  (_owner, 'خدمة نقل عفش داخل الرياض', 'فك وتركيب + تغليف + تأمين، فريق محترف', 'services', 'new', 0, 1200, 'أثاث مستعمل بحالة جيدة أو أجهزة كهربائية', ARRAY[]::text[], 'service', 'الرياض', 'active', false),
  (_owner, 'مصمم جرافيك (10 تصاميم سوشيال)', 'تصاميم احترافية جاهزة للنشر، تسليم 3 أيام', 'services', 'new', 0, 600, 'كتابة محتوى أو تصوير فيديو قصير', ARRAY[]::text[], 'service', 'الدمام', 'active', false),
  (_owner, 'كتابة محتوى SEO (20 مقال)', 'مقالات محسّنة لمحركات البحث، 800 كلمة لكل مقال', 'services', 'new', 0, 1400, 'تصميم جرافيك أو حملة إعلانية', ARRAY[]::text[], 'service', 'الرياض', 'active', false),
  (_owner, 'مونتاج فيديو احترافي (5 فيديوهات)', 'مونتاج + مؤثرات + موشن جرافيك بسيط', 'services', 'new', 0, 1600, 'تصوير أو تصميم شعارات', ARRAY[]::text[], 'service', 'جدة', 'active', false),
  (_owner, 'خدمة استشارة شرعية للمعاملات المالية', '3 جلسات مع باحث شرعي مختص', 'services', 'new', 0, 900, 'دروس فقهية أو مكتبة كتب إسلامية', ARRAY[]::text[], 'service', 'مكة', 'active', false),
  (_owner, 'خط عربي (10 لوحات مخطوطة يدوياً)', 'خطاط محترف، أنواع خطوط متعددة', 'art', 'new', 0, 2200, 'لوحات فنية أو أعمال ديكور', ARRAY[]::text[], 'item', 'المدينة', 'active', false),
  (_owner, 'لوحة زيتية أصلية (100×70 سم)', 'فن تجريدي معاصر، توقيع الفنان، إطار خشب', 'art', 'new', 3, 1800, 'قطع ديكور فاخرة أو سجاد فارسي', ARRAY[]::text[], 'item', 'الرياض', 'active', false);

END $$;
