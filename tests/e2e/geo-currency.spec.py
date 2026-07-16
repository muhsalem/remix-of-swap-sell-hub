"""
E2E — كشف الدولة تلقائياً عبر رؤوس Edge (cf-ipcountry / x-vercel-ip-country)
والتحقق أن الأسعار تظهر فوراً بالعملة الصحيحة (EGP أو SAR) بدون أي نقرة
من المستخدم على CountrySwitcher.

التشغيل:
    python3 tests/e2e/geo-currency.spec.py
"""
import asyncio
import os
import shutil
from pathlib import Path

from playwright.async_api import async_playwright, expect

BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:8080")

OUT = Path("/tmp/browser/geo-currency")
if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True, exist_ok=True)


CASES = [
    # (label, header_name, iso, expected currency code, expected symbol, banner label)
    ("eg_cf",       "cf-ipcountry",         "EG", "EGP", "ج.م", "مصر"),
    ("sa_cf",       "cf-ipcountry",         "SA", "SAR", "ر.س", "السعودية"),
    ("eg_vercel",   "x-vercel-ip-country",  "EG", "EGP", "ج.م", "مصر"),
    ("sa_vercel",   "x-vercel-ip-country",  "SA", "SAR", "ر.س", "السعودية"),
]


async def run_case(browser, label: str, header: str, iso: str,
                   currency: str, symbol: str, banner_label: str):
    print(f"\n→ [{label}] header={header}: {iso}  expect={currency} ({symbol})")
    ctx = await browser.new_context(
        viewport={"width": 1280, "height": 1800},
        extra_http_headers={header: iso},
    )
    page = await ctx.new_page()
    # لا يوجد اختيار محفوظ → التطبيق يجب أن يعتمد على الرأس فقط
    await page.goto(BASE_URL, wait_until="domcontentloaded")

    # 1) لافتة الاكتشاف ظهرت بالدولة الصحيحة (بدون أي نقرة)
    banner = page.get_by_role("dialog", name="تأكيد الدولة والعملة")
    await expect(banner).to_be_visible(timeout=10_000)
    await expect(banner).to_contain_text(banner_label)
    await page.screenshot(path=str(OUT / f"{label}_01_banner.png"))

    # 2) العملة المحفوظة في localStorage تعكس الرأس (تحدّث بواسطة detectCountryServer)
    saved = await page.evaluate("() => localStorage.getItem('badel:country')")
    assert saved == currency, f"[{label}] expected localStorage=badel:country={currency}, got {saved!r}"

    # 3) كل عناصر <LocalPrice /> تعرض العملة الصحيحة فوراً
    prices = page.get_by_test_id("local-price")
    count = await prices.count()
    assert count > 0, f"[{label}] no <LocalPrice /> nodes found on homepage"
    # أول عنصر — تحقّق من data-currency وdata-symbol
    first = prices.first
    await expect(first).to_have_attribute("data-currency", currency)
    await expect(first).to_have_attribute("data-symbol", symbol)
    # كل العناصر يجب أن تستخدم نفس العملة (لا يوجد تفلّت جزئي)
    currencies = await prices.evaluate_all("els => els.map(e => e.dataset.currency)")
    mismatch = [c for c in currencies if c != currency]
    assert not mismatch, f"[{label}] mismatched LocalPrice currencies: {mismatch}"

    await page.screenshot(path=str(OUT / f"{label}_02_prices.png"))

    # 4) شريط الترويسة (CountrySwitcher) يعكس الاختيار كـ aria-pressed
    switcher_btn = page.locator(
        f"[role=group][aria-label='عملة العرض'] [aria-pressed=true]"
    )
    await expect(switcher_btn).to_contain_text(symbol)

    print(f"  ✓ [{label}] banner + {count} price nodes + localStorage all show {currency}")
    await ctx.close()


async def main():
    fail: list[str] = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        try:
            for case in CASES:
                try:
                    await run_case(browser, *case)
                except AssertionError as e:
                    fail.append(f"{case[0]}: {e}")
                    print(f"  ✗ FAIL: {e}")
                except Exception as e:
                    fail.append(f"{case[0]}: {type(e).__name__}: {e}")
                    print(f"  ✗ ERROR: {type(e).__name__}: {e}")
        finally:
            await browser.close()

    print("\n" + "=" * 60)
    if fail:
        print(f"❌ {len(fail)}/{len(CASES)} cases failed:")
        for f in fail:
            print(f"  - {f}")
        raise SystemExit(1)
    print(f"✅ all {len(CASES)} geo-currency cases passed")
    print(f"   screenshots: {OUT}")


if __name__ == "__main__":
    asyncio.run(main())
