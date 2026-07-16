"""
E2E — عرض حالة المزامنة داخل مودال CountryDetectedBanner.

يتحقق من:
  1) حالة النجاح: بعد الضغط على "حفظ" تظهر شارة "تمّت المزامنة بنجاح"
     مع طابع زمني لآخر مزامنة (<time datetime=...>).
  2) حالة الفشل: عند اعتراض استدعاء setPreferredCountry بخطأ 500
     تظهر رسالة "تعذّر حفظ التفضيل" الحمراء.

يعتمد على متغيرات جلسة Lovable المُحقنة (LOVABLE_BROWSER_AUTH_STATUS=injected).
التشغيل:  python3 tests/e2e/currency-sync-status.spec.py
"""
import asyncio
import json
import os
import re
import shutil
import sys
from pathlib import Path

from playwright.async_api import async_playwright, expect, BrowserContext, Route

BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:8080")

OUT = Path("/tmp/browser/currency-sync-status")
if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True, exist_ok=True)


def _require_auth():
    status = os.environ.get("LOVABLE_BROWSER_AUTH_STATUS", "no_supabase")
    if status != "injected":
        print(f"skip: no injected Supabase session (LOVABLE_BROWSER_AUTH_STATUS={status})")
        sys.exit(0)


async def _restore_session(context: BrowserContext, page):
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

    # Ensure the banner will show on the next load (clear dismiss/confirm keys).
    await page.evaluate("""() => {
      localStorage.removeItem('badel:country');
      localStorage.removeItem('badel:country-banner-dismissed');
      localStorage.removeItem('badel:country-confirmed');
    }""")


async def _open_modal(page):
    """Open the CountryDetectedBanner confirmation modal."""
    banner = page.get_by_role("region").filter(has_text=re.compile("اكتشفنا موقعك"))
    await banner.wait_for(state="visible", timeout=15_000)
    await banner.get_by_role("button", name=re.compile("تأكيد أو تغيير")).click()
    dialog = page.get_by_role("dialog")
    await dialog.wait_for(state="visible", timeout=5_000)
    return dialog


async def _click_save(dialog):
    await dialog.get_by_role("button", name=re.compile("^حفظ")).click()


async def _test_success(browser):
    ctx = await browser.new_context(viewport={"width": 1280, "height": 1800}, locale="ar-SA")
    page = await ctx.new_page()
    await _restore_session(ctx, page)
    await page.reload(wait_until="domcontentloaded")

    dialog = await _open_modal(page)
    await page.screenshot(path=str(OUT / "success_01_modal_open.png"))

    # Baseline sync-status region exists with role=status.
    status = dialog.locator("[role=status]")
    await expect(status).to_be_visible()

    await _click_save(dialog)

    # Success badge + last-synced <time datetime="..."> must appear.
    await expect(status).to_contain_text("تمّت المزامنة بنجاح", timeout=10_000)
    time_el = status.locator("time[datetime]")
    await expect(time_el).to_be_visible()
    dt = await time_el.get_attribute("datetime")
    assert dt and "T" in dt, f"expected ISO datetime on <time>, got {dt!r}"
    await page.screenshot(path=str(OUT / "success_02_saved_with_time.png"))

    await ctx.close()
    print("✓ Success: modal shows 'تمّت المزامنة بنجاح' + last-synced <time>")


async def _test_failure(browser):
    ctx = await browser.new_context(viewport={"width": 1280, "height": 1800}, locale="ar-SA")
    page = await ctx.new_page()
    await _restore_session(ctx, page)

    # Force setPreferredCountry to fail. TanStack Start exposes server fns via
    # a query param ?_serverFn=... — we match on the function name in the URL.
    async def fail_pref(route: Route):
        url = route.request.url
        if "setPreferredCountry" in url:
            await route.fulfill(
                status=500,
                content_type="application/json",
                body=json.dumps({"error": "forced_failure_for_test"}),
            )
        else:
            await route.continue_()

    await ctx.route("**/*setPreferredCountry*", fail_pref)
    await page.reload(wait_until="domcontentloaded")

    dialog = await _open_modal(page)
    await _click_save(dialog)

    status = dialog.locator("[role=status]")
    await expect(status).to_contain_text(
        re.compile("تعذّر حفظ التفضيل"),
        timeout=10_000,
    )
    await page.screenshot(path=str(OUT / "failure_01_error_shown.png"))

    # Modal stays open so user sees the failure (does not auto-close).
    await expect(dialog).to_be_visible()

    await ctx.close()
    print("✓ Failure: modal shows 'تعذّر حفظ التفضيل' and stays open")


async def main():
    _require_auth()
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        try:
            await _test_success(browser)
            await _test_failure(browser)
        finally:
            await browser.close()
    print("\nALL PASS — sync status (success + failure) rendered inside the modal.")


if __name__ == "__main__":
    asyncio.run(main())
