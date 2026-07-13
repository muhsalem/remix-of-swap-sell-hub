# E2E — Barter Happy Path (with Shipping + Escrow)

يغطي هذا الاختبار المسار السعيد الكامل للمقايضة **ثنائية الطرف** مع الشحن والضمان (Escrow) — **بدون** سيناريو نزاع و**بدون** المقايضة الثلاثية.

## المتطلبات

- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` في البيئة (لإنشاء المستخدمين seeded).
- الخادم يعمل على `http://localhost:8080`.
- Playwright Python متوفر بالفعل في السّاندبوكس.

## التشغيل

```bash
python3 tests/e2e/barter-flow.spec.py
```

الـ screenshots تُحفظ في `/tmp/browser/barter/`.

## الخطوات المُغطاة

1. Seed مستخدم A (البائع) + مستخدم B (المشتري) عبر Admin API.
2. A ينشر إعلانًا (سلعة قابلة للشحن، مدينة الرياض).
3. B يتصفح ويرسل عرض مقايضة نقدي جزئي.
4. A يقبل العرض → إنشاء `trade_offer` بحالة `accepted`.
5. B يدفع رسوم المنصة (Escrow يُقفل المبلغ).
6. A يضيف بيانات الشحن (`carrier` + `tracking_number`).
7. الطرفان يؤكدان الاستلام → الحالة تصبح `completed`.
8. لقطة أخيرة تتحقق من ظهور "تم إكمال الصفقة".
