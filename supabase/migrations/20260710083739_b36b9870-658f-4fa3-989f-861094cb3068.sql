
DO $$
DECLARE
  _img_base text := 'https://loremflickr.com/800/1000/';
BEGIN
  UPDATE public.listings SET images = ARRAY[_img_base || 'iphone,pro?lock=1'] WHERE title ILIKE '%آيفون%' AND (images IS NULL OR array_length(images,1) IS NULL);
  UPDATE public.listings SET images = ARRAY[_img_base || 'laptop,dell?lock=2'] WHERE title ILIKE '%Dell%' AND (images IS NULL OR array_length(images,1) IS NULL);
  UPDATE public.listings SET images = ARRAY[_img_base || 'rolex,watch?lock=3'] WHERE title ILIKE '%رولكس%' AND (images IS NULL OR array_length(images,1) IS NULL);
  UPDATE public.listings SET images = ARRAY[_img_base || 'toyota,camry?lock=4'] WHERE title ILIKE '%كامري%' AND (images IS NULL OR array_length(images,1) IS NULL);
  UPDATE public.listings SET images = ARRAY[_img_base || 'motorcycle,honda?lock=5'] WHERE title ILIKE '%دراجة نارية%' AND (images IS NULL OR array_length(images,1) IS NULL);
  UPDATE public.listings SET images = ARRAY[_img_base || 'bedroom,furniture?lock=6'] WHERE title ILIKE '%غرفة نوم%' AND (images IS NULL OR array_length(images,1) IS NULL);
  UPDATE public.listings SET images = ARRAY[_img_base || 'leather,sofa?lock=7'] WHERE title ILIKE '%كنب%' AND (images IS NULL OR array_length(images,1) IS NULL);
  UPDATE public.listings SET images = ARRAY[_img_base || 'mountain,bike?lock=8'] WHERE title ILIKE '%دراجة هوائية%' AND (images IS NULL OR array_length(images,1) IS NULL);
  UPDATE public.listings SET images = ARRAY[_img_base || 'gym,weights?lock=9'] WHERE title ILIKE '%جيم%' AND (images IS NULL OR array_length(images,1) IS NULL);
  UPDATE public.listings SET images = ARRAY[_img_base || 'sony,camera?lock=10'] WHERE title ILIKE '%Sony A7%' AND (images IS NULL OR array_length(images,1) IS NULL);
  UPDATE public.listings SET images = ARRAY[_img_base || 'drone,dji?lock=11'] WHERE title ILIKE '%درون%' AND (images IS NULL OR array_length(images,1) IS NULL);
  UPDATE public.listings SET images = ARRAY[_img_base || 'islamic,books?lock=12'] WHERE title ILIKE '%كتب إسلامية%' AND (images IS NULL OR array_length(images,1) IS NULL);
  UPDATE public.listings SET images = ARRAY[_img_base || 'baby,clothes?lock=13'] WHERE title ILIKE '%ملابس أطفال%' AND (images IS NULL OR array_length(images,1) IS NULL);
  UPDATE public.listings SET images = ARRAY[_img_base || 'stroller,baby?lock=14'] WHERE title ILIKE '%عربية أطفال%' AND (images IS NULL OR array_length(images,1) IS NULL);
  UPDATE public.listings SET images = ARRAY[_img_base || 'playstation,ps5?lock=15'] WHERE title ILIKE '%PlayStation%' AND (images IS NULL OR array_length(images,1) IS NULL);
  UPDATE public.listings SET images = ARRAY[_img_base || 'coffee,machine?lock=16'] WHERE title ILIKE '%ماكينة قهوة%' AND (images IS NULL OR array_length(images,1) IS NULL);
  UPDATE public.listings SET images = ARRAY[_img_base || 'refrigerator,lg?lock=17'] WHERE title ILIKE '%ثلاجة%' AND (images IS NULL OR array_length(images,1) IS NULL);
  UPDATE public.listings SET images = ARRAY[_img_base || 'branding,logo?lock=18'] WHERE title ILIKE '%هوية بصرية%' AND (images IS NULL OR array_length(images,1) IS NULL);
  UPDATE public.listings SET images = ARRAY[_img_base || 'product,photography?lock=19'] WHERE title ILIKE '%تصوير منتجات%' AND (images IS NULL OR array_length(images,1) IS NULL);
  UPDATE public.listings SET images = ARRAY[_img_base || 'web,developer?lock=20'] WHERE title ILIKE '%برمجة موقع%' AND (images IS NULL OR array_length(images,1) IS NULL);
  UPDATE public.listings SET images = ARRAY[_img_base || 'math,tutor?lock=21'] WHERE title ILIKE '%رياضيات%' AND (images IS NULL OR array_length(images,1) IS NULL);
  UPDATE public.listings SET images = ARRAY[_img_base || 'english,ielts?lock=22'] WHERE title ILIKE '%IELTS%' AND (images IS NULL OR array_length(images,1) IS NULL);
  UPDATE public.listings SET images = ARRAY[_img_base || 'marketing,strategy?lock=23'] WHERE title ILIKE '%تسويق رقمي%' AND (images IS NULL OR array_length(images,1) IS NULL);
  UPDATE public.listings SET images = ARRAY[_img_base || 'moving,truck?lock=24'] WHERE title ILIKE '%نقل عفش%' AND (images IS NULL OR array_length(images,1) IS NULL);
  UPDATE public.listings SET images = ARRAY[_img_base || 'graphic,design?lock=25'] WHERE title ILIKE '%مصمم جرافيك%' AND (images IS NULL OR array_length(images,1) IS NULL);
  UPDATE public.listings SET images = ARRAY[_img_base || 'writing,seo?lock=26'] WHERE title ILIKE '%محتوى SEO%' AND (images IS NULL OR array_length(images,1) IS NULL);
  UPDATE public.listings SET images = ARRAY[_img_base || 'video,editing?lock=27'] WHERE title ILIKE '%مونتاج%' AND (images IS NULL OR array_length(images,1) IS NULL);
  UPDATE public.listings SET images = ARRAY[_img_base || 'mosque,islamic?lock=28'] WHERE title ILIKE '%استشارة شرعية%' AND (images IS NULL OR array_length(images,1) IS NULL);
  UPDATE public.listings SET images = ARRAY[_img_base || 'arabic,calligraphy?lock=29'] WHERE title ILIKE '%خط عربي%' AND (images IS NULL OR array_length(images,1) IS NULL);
  UPDATE public.listings SET images = ARRAY[_img_base || 'oil,painting?lock=30'] WHERE title ILIKE '%لوحة زيتية%' AND (images IS NULL OR array_length(images,1) IS NULL);

  -- Fallback for anything still empty (generic product image)
  UPDATE public.listings
    SET images = ARRAY[_img_base || 'product?lock=' || (abs(hashtext(id::text)) % 500)::text]
    WHERE images IS NULL OR array_length(images,1) IS NULL;
END $$;
