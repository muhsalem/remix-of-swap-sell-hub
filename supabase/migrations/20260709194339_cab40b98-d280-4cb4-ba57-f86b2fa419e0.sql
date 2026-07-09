
CREATE TABLE public.shipping_cities (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  country text not null check (country in ('SA','EG')),
  region_ar text not null,
  name_ar text not null,
  zone int not null check (zone between 1 and 5),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT ON public.shipping_cities TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.shipping_cities TO authenticated;
GRANT ALL ON public.shipping_cities TO service_role;
ALTER TABLE public.shipping_cities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cities_read_all" ON public.shipping_cities FOR SELECT USING (true);
CREATE POLICY "cities_admin_insert" ON public.shipping_cities FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "cities_admin_update" ON public.shipping_cities FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "cities_admin_delete" ON public.shipping_cities FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_shipping_cities_updated
  BEFORE UPDATE ON public.shipping_cities
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.shipping_cities (code, country, region_ar, name_ar, zone) VALUES
-- Saudi Arabia
('RUH','SA','الرياض','الرياض',1),
('DIR','SA','الرياض','الدرعية',2),
('KHR','SA','الرياض','الخرج',2),
('MJM','SA','الرياض','المجمعة',3),
('DWD','SA','الرياض','الدوادمي',3),
('MKK','SA','مكة المكرمة','مكة المكرمة',2),
('JED','SA','مكة المكرمة','جدة',2),
('TIF','SA','مكة المكرمة','الطائف',2),
('RAB','SA','مكة المكرمة','رابغ',3),
('QUN','SA','مكة المكرمة','القنفذة',3),
('MED','SA','المدينة المنورة','المدينة المنورة',2),
('YNB','SA','المدينة المنورة','ينبع',3),
('ULA','SA','المدينة المنورة','العُلا',3),
('BDR','SA','المدينة المنورة','بدر',3),
('DMM','SA','الشرقية','الدمام',2),
('KHO','SA','الشرقية','الخبر',2),
('DHR','SA','الشرقية','الظهران',2),
('JUB','SA','الشرقية','الجبيل',3),
('AHS','SA','الشرقية','الأحساء',3),
('QTF','SA','الشرقية','القطيف',3),
('HFR','SA','الشرقية','حفر الباطن',3),
('BUR','SA','القصيم','بريدة',3),
('UNZ','SA','القصيم','عنيزة',3),
('RSS','SA','القصيم','الرس',3),
('ABH','SA','عسير','أبها',3),
('KMS','SA','عسير','خميس مشيط',3),
('NMS','SA','عسير','النماص',3),
('BSH','SA','عسير','بيشة',3),
('TBK','SA','تبوك','تبوك',3),
('DBA','SA','تبوك','ضباء',3),
('NEO','SA','تبوك','نيوم',3),
('HAL','SA','حائل','حائل',3),
('BQA','SA','حائل','بقعاء',3),
('ARR','SA','الحدود الشمالية','عرعر',3),
('RFH','SA','الحدود الشمالية','رفحاء',3),
('JZN','SA','جازان','جازان',3),
('SBY','SA','جازان','صبيا',3),
('NJR','SA','نجران','نجران',3),
('SHR','SA','نجران','شرورة',3),
('BHA','SA','الباحة','الباحة',3),
('BLJ','SA','الباحة','بلجرشي',3),
('SKK','SA','الجوف','سكاكا',3),
('QRT','SA','الجوف','القريات',3),
-- Egypt
('CAI','EG','القاهرة','القاهرة',1),
('GIZ','EG','الجيزة','الجيزة',1),
('QLY','EG','القليوبية','بنها',1),
('SXO','EG','الجيزة','السادس من أكتوبر',1),
('ALX','EG','الإسكندرية','الإسكندرية',2),
('MNS','EG','الدقهلية','المنصورة',2),
('TNT','EG','الغربية','طنطا',2),
('MHL','EG','الغربية','المحلة الكبرى',2),
('ZAG','EG','الشرقية','الزقازيق',2),
('DAM','EG','البحيرة','دمنهور',2),
('KFS','EG','كفر الشيخ','كفر الشيخ',2),
('SHB','EG','المنوفية','شبين الكوم',2),
('DMT','EG','دمياط','دمياط',2),
('PSD','EG','بورسعيد','بورسعيد',2),
('ISM','EG','الإسماعيلية','الإسماعيلية',2),
('SUZ','EG','السويس','السويس',2),
('ARS','EG','شمال سيناء','العريش',3),
('SSH','EG','جنوب سيناء','شرم الشيخ',3),
('BNS','EG','بني سويف','بني سويف',3),
('FYM','EG','الفيوم','الفيوم',3),
('MNY','EG','المنيا','المنيا',3),
('ASY','EG','أسيوط','أسيوط',3),
('SHG','EG','سوهاج','سوهاج',3),
('QNA','EG','قنا','قنا',3),
('LXR','EG','الأقصر','الأقصر',3),
('ASW','EG','أسوان','أسوان',3),
('HRG','EG','البحر الأحمر','الغردقة',3),
('KHA','EG','الوادي الجديد','الخارجة',3),
('MRS','EG','مطروح','مرسى مطروح',3);
