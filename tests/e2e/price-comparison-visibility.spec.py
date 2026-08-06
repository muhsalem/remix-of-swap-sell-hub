"""
E2E — بطاقة «مقارنة الأسعار بين البلدان» في /pricing-engine

يتحقق من قاعدتين لكل الحالات:
  1) البطاقة تظهر فقط عندما يكون بلد السلعة/الخدمة المختارة مختلفاً عن بلدك.
  2) عند ظهورها تكون دائماً **أسفل** بطاقة «مختبر توافق المقايضات» في ترتيب DOM/الصفحة.

يغطي: بدون اختيار، عنصر محلي، عنصر أجنبي، إلغاء الاختيار،
وتبديل «بلدك» بحيث ينقلب نفس العنصر من محلي إلى أجنبي والعكس.

التشغيل:
    python3 tests/e2e/price-comparison-visibility.spec.py
"""
import asyncio
import os
import shutil
from pathlib import Path

from playwright.async_api import async_playwright, expect

BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:8080")
OUT = Path("/tmp/browser/price-comparison")
if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True, exist_ok=True)

COUNTRIES = ["EG", "SA"]


async def compare_visible(page) -> bool:
    return await page.get_by_test_id("country-compare").count() > 0


async def assert_below_compat(page, label: str):
    """البطاقة موجودة و y الخاص بها أكبر من نهاية مختبر التوافق."""
    compat = page.get_by_test_id("compat-lab")
    compare = page.get_by_test_id("country-compare")
    await expect(compare).to_be_visible()
    cb = await compat.bounding_box()
    xb = await compare.bounding_box()
    assert cb and xb, f"[{label}] bounding boxes missing"
    assert xb["y"] >= cb["y"] + cb["height"] - 1, (
        f"[{label}] بطاقة المقارنة ليست أسفل مختبر التوافق: "
        f"compat_bottom={cb['y'] + cb['height']:.0f} compare_top={xb['y']:.0f}"
    )
    # ترتيب DOM أيضاً
    order = await page.evaluate(
        """() => {
          const a = document.querySelector('[data-testid="compat-lab"]');
          const b = document.querySelector('[data-testid="country-compare"]');
          return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? 'after' : 'before';
        }"""
    )
    assert order == "after", f"[{label}] ترتيب DOM خاطئ: {order}"


async def set_my_country(page, code: str):
    """ضبط «بلدك» مع تثبيته (قد يعيد اكتشاف الدولة ضبطه بعد الترطيب)."""
    for _ in range(5):
        await page.get_by_label("بلدك").select_option(code)
        await page.wait_for_timeout(400)
        if await page.get_by_label("بلدك").input_value() == code:
            return
    raise AssertionError(f"تعذّر تثبيت بلدك على {code}")


async def pick_item(page, item_id: str):
    await page.locator(f'[data-testid="inventory-item"][data-item-id="{item_id}"]').first.click()
    await page.wait_for_timeout(250)


async def run_for_country(page, my_country: str):
    print(f"\n=== بلدك = {my_country} ===")
    await page.goto(f"{BASE_URL}/pricing-engine", wait_until="domcontentloaded")
    await page.wait_for_selector('[data-testid="inventory-item"]', timeout=20_000)
    await page.wait_for_timeout(1200)  # انتظار اكتشاف الدولة قبل الضبط اليدوي
    await set_my_country(page, my_country)

    # 1) بدون اختيار → البطاقة مخفية
    assert not await compare_visible(page), f"[{my_country}] ظهرت البطاقة بدون اختيار عنصر"
    print("  ✓ مخفية بدون اختيار")

    items = await page.evaluate(
        """() => [...document.querySelectorAll('[data-testid="inventory-item"]')]
              .map(e => ({ id: e.dataset.itemId, country: e.dataset.country }))"""
    )
    local = [i for i in items if i["country"] == my_country]
    foreign = [i for i in items if i["country"] != my_country]
    assert local and foreign, f"[{my_country}] المخزون لا يحتوي عناصر محلية وأجنبية معاً"

    # 2) كل العناصر المحلية → مخفية
    for it in local:
        await pick_item(page, it["id"])
        assert not await compare_visible(page), (
            f"[{my_country}] البطاقة ظهرت لعنصر محلي {it['id']}"
        )
        await pick_item(page, it["id"])  # إلغاء الاختيار
    print(f"  ✓ مخفية لكل العناصر المحلية ({len(local)})")

    # 3) كل العناصر الأجنبية → ظاهرة وأسفل مختبر التوافق
    for it in foreign:
        await pick_item(page, it["id"])
        await assert_below_compat(page, f"{my_country}/{it['id']}")
        await pick_item(page, it["id"])
        assert not await compare_visible(page), (
            f"[{my_country}] البطاقة بقيت بعد إلغاء اختيار {it['id']}"
        )
    print(f"  ✓ ظاهرة وأسفل مختبر التوافق لكل العناصر الأجنبية ({len(foreign)})")

    # 4) تبديل بلدك أثناء اختيار عنصر أجنبي → تختفي عندما يتطابق البلدان
    target = foreign[0]
    await pick_item(page, target["id"])
    await assert_below_compat(page, f"{my_country}/switch-before")
    await page.screenshot(path=str(OUT / f"{my_country}_cross_border.png"))
    await set_my_country(page, target["country"])
    assert not await compare_visible(page), (
        f"[{my_country}] البطاقة بقيت بعد جعل بلدك = بلد العرض"
    )
    # ثم العودة → تظهر مجدداً أسفل المختبر
    await set_my_country(page, my_country)
    await assert_below_compat(page, f"{my_country}/switch-back")
    print("  ✓ تتفاعل بشكل صحيح مع تبديل بلدك ذهاباً وإياباً")


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        # تخطّي الجولة التعريفية وبانر الدولة حتى لا يحجبا النقرات
        await page.goto(BASE_URL, wait_until="domcontentloaded")
        await page.evaluate(
            """() => { localStorage.setItem('badel_onboarding_v1','1');
                       localStorage.setItem('badel:country','EGP'); }"""
        )
        for c in COUNTRIES:
            await run_for_country(page, c)
        await browser.close()
    print("\n✅ كل حالات بطاقة مقارنة الأسعار نجحت")


asyncio.run(main())
