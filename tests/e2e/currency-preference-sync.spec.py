"""
E2E — مزامنة تفضيل العملة عبر الأجهزة للمستخدم المسجّل.

السيناريو:
  1) على "الجهاز A" — سجّل الدخول، غيّر العملة إلى EGP عبر CountrySwitcher.
     هذا يُطلق `badel:country-changed` ويُحفظ التفضيل على profiles.preferred_country.
  2) افتح "جهازاً جديداً" (سياق نظيف بلا localStorage للعملة) مع نفس جلسة Supabase.
     يجب أن تُحمَّل الأسعار بالعملة المفضّلة (EGP) فوراً بدون أي نقرة.
  3) بدّل إلى SAR على الجهاز الجديد → الأسعار تتحدث وتُحفظ للملف.
  4) افتح سياقاً ثالثاً نظيفاً → SAR مسترجعة من الحساب بدون نقرة.

يعتمد على متغيرات جلسة Lovable المُحقنة (LOVABLE_BROWSER_AUTH_STATUS=injected).
التشغيل:  python3 tests/e2e/currency-preference-sync.spec.py
"""
import asyncio
import json
import os
import shutil
import sys
from pathlib import Path

from playwright.async_api import async_playwright, expect, BrowserContext

BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:8080")

OUT = Path("/tmp/browser/currency-pref")
if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True, exist_ok=True)


def _require_auth():
    status = os.environ.get("LOVABLE_BROWSER_AUTH_STATUS", "no_supabase")
    if status != "injected":
        print(f"skip: no injected Supabase session (LOVABLE_BROWSER_AUTH_STATUS={status})")
        sys.exit(0)


async def _restore_session(context: BrowserContext, page):
    """Restore Supabase cookies + localStorage session so the app treats us as signed in."""
    cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")
    if cookies_json:
        cookies = json.loads(cookies_json)
        for c in cookies:
            c["url"] = BASE_URL
        await context.add_cookies(cookies)

    await page.goto(BASE_URL, wait_until="domcontentloaded")

    storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    if storage_key and session_json:
        await page.evaluate(
            f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
        )


async def _fresh_signed_in_context(browser):
    """New browser context = 'new device': no leftover badel:country in localStorage,
    but the Supabase session is restored so the app knows who we are."""
    ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
    page = await ctx.new_page()
    await _restore_session(ctx, page)
    # Belt & suspenders: nuke any local currency choice that might have been auto-detected
    # during the priming goto(). We want the app to lean on the profile preference only.
    await page.evaluate("""() => {
      localStorage.removeItem('badel:country');
      localStorage.removeItem('badel:country-banner-dismissed');
      localStorage.removeItem('badel:country-confirmed');
    }""")
    return ctx, page


async def _first_price_currency(page) -> str:
    await page.wait_for_selector('[data-testid="local-price"]', timeout=15_000)
    return await page.get_by_test_id("local-price").first.get_attribute("data-currency")


async def _switch_to(page, code: str):
    switcher = page.locator("[role=group][aria-label='عملة العرض']")
    await switcher.wait_for(state="visible", timeout=10_000)
    symbol = "ج.م" if code == "EGP" else "ر.س"
    await switcher.get_by_role("button", name=lambda n: symbol in (n or "")).click()


async def _wait_prices_currency(page, expected: str, tag: str):
    """Poll first LocalPrice until its data-currency flips to `expected`."""
    locator = page.get_by_test_id("local-price").first
    await expect(locator).to_have_attribute("data-currency", expected, timeout=15_000)
    await page.screenshot(path=str(OUT / f"{tag}.png"))


async def main():
    _require_auth()

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)

        # === Step 1 — Device A: sign in, prime preference to EGP ===
        ctx_a = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page_a = await ctx_a.new_page()
        await _restore_session(ctx_a, page_a)
        await page_a.goto(BASE_URL, wait_until="domcontentloaded")
        # Wait for hydration + AuthListener syncCountry() to finish
        await page_a.wait_for_selector('[data-testid="local-price"]', timeout=15_000)
        await _switch_to(page_a, "EGP")
        await _wait_prices_currency(page_a, "EGP", "01_deviceA_egp")
        # Give setPreferredCountry a beat to hit the server
        await page_a.wait_for_timeout(1500)
        await ctx_a.close()
        print("✓ Device A: preference saved to profile as EGP")

        # === Step 2 — New device: fresh context, no local currency, session only ===
        ctx_b, page_b = await _fresh_signed_in_context(browser)
        await page_b.goto(BASE_URL, wait_until="domcontentloaded")
        await _wait_prices_currency(page_b, "EGP", "02_deviceB_restored_egp")
        # And CountrySwitcher reflects EGP as pressed without any user click
        pressed = page_b.locator("[role=group][aria-label='عملة العرض'] [aria-pressed=true]")
        await expect(pressed).to_contain_text("ج.م")
        print("✓ Device B: EGP restored from profile with zero clicks")

        # === Step 3 — Switch to SAR on the new device, expect live update + resync ===
        await _switch_to(page_b, "SAR")
        await _wait_prices_currency(page_b, "SAR", "03_deviceB_switched_sar")
        await page_b.wait_for_timeout(1500)  # let setPreferredCountry land
        await ctx_b.close()
        print("✓ Device B: switch to SAR updated prices and persisted to profile")

        # === Step 4 — Yet another fresh device: expect SAR restored automatically ===
        ctx_c, page_c = await _fresh_signed_in_context(browser)
        await page_c.goto(BASE_URL, wait_until="domcontentloaded")
        await _wait_prices_currency(page_c, "SAR", "04_deviceC_restored_sar")
        pressed_c = page_c.locator("[role=group][aria-label='عملة العرض'] [aria-pressed=true]")
        await expect(pressed_c).to_contain_text("ر.س")
        await ctx_c.close()
        print("✓ Device C: SAR restored from profile with zero clicks")

        await browser.close()
        print("\nALL PASS — currency preference syncs across devices via profile.")


if __name__ == "__main__":
    asyncio.run(main())
