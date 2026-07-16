"""
E2E — زر "إعادة المحاولة" داخل مودال CountryDetectedBanner.

يتحقق من ثلاث حالات:
  1) فشل الخادم → يظهر زر "إعادة المحاولة"، وعند رفع الاعتراض والنقر تُصبح
     الحالة "تمّت المزامنة بنجاح".
  2) أوفلاين → الحالة "أنت غير متصل حالياً" مع الزر ظاهراً؛ عند عودة الاتصال
     والنقر على الزر تُصبح الحالة "تمّت المزامنة بنجاح".
  3) الطابور: بعد أول فشل شبكة ثم استعادة الاتصال، النقر على الزر يُفرغ
     الطابور ويحوّل الحالة إلى "تمّت المزامنة بنجاح".

يعتمد على متغيرات جلسة Lovable المُحقنة (LOVABLE_BROWSER_AUTH_STATUS=injected).
التشغيل:  python3 tests/e2e/currency-sync-retry.spec.py
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

OUT = Path("/tmp/browser/currency-sync-retry")
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

    await page.evaluate("""() => {
      localStorage.removeItem('badel:country');
      localStorage.removeItem('badel:country-banner-dismissed');
      localStorage.removeItem('badel:country-confirmed');
      localStorage.removeItem('badel:pref-sync-queue');
    }""")


async def _open_modal(page):
    banner = page.get_by_role("region").filter(has_text=re.compile("اكتشفنا موقعك"))
    await banner.wait_for(state="visible", timeout=15_000)
    await banner.get_by_role("button", name=re.compile("تأكيد أو تغيير")).click()
    dialog = page.get_by_role("dialog")
    await dialog.wait_for(state="visible", timeout=5_000)
    return dialog


async def _click_save(dialog):
    await dialog.get_by_role("button", name=re.compile("^حفظ")).click()


def _retry_button(dialog):
    return dialog.get_by_role("button", name=re.compile("إعادة محاولة مزامنة"))


async def _test_retry_after_server_error(browser):
    ctx = await browser.new_context(viewport={"width": 1280, "height": 1800}, locale="ar-SA")
    page = await ctx.new_page()
    await _restore_session(ctx, page)

    fail_mode = {"on": True}

    async def maybe_fail(route: Route):
        url = route.request.url
        if "setPreferredCountry" in url and fail_mode["on"]:
            await route.fulfill(
                status=500,
                content_type="application/json",
                body=json.dumps({"error": "forced_failure_for_test"}),
            )
        else:
            await route.continue_()

    await ctx.route("**/*setPreferredCountry*", maybe_fail)
    await page.reload(wait_until="domcontentloaded")

    dialog = await _open_modal(page)
    await _click_save(dialog)

    status = dialog.locator("[role=status]")
    await expect(status).to_contain_text(re.compile("تعذّر حفظ التفضيل"), timeout=10_000)

    retry_btn = _retry_button(dialog)
    await expect(retry_btn).to_be_visible()
    await page.screenshot(path=str(OUT / "err_01_retry_visible.png"))

    # Recover: stop failing, click retry.
    fail_mode["on"] = False
    await retry_btn.click()

    await expect(status).to_contain_text("تمّت المزامنة بنجاح", timeout=10_000)
    await expect(status.locator("time[datetime]")).to_be_visible()
    await page.screenshot(path=str(OUT / "err_02_saved_after_retry.png"))

    await ctx.close()
    print("✓ Retry after server error: error → saved")


async def _test_retry_after_offline(browser):
    ctx = await browser.new_context(viewport={"width": 1280, "height": 1800}, locale="ar-SA")
    page = await ctx.new_page()
    await _restore_session(ctx, page)
    await page.reload(wait_until="domcontentloaded")

    dialog = await _open_modal(page)

    # Go offline before saving so the queue path triggers.
    await ctx.set_offline(True)
    await _click_save(dialog)

    status = dialog.locator("[role=status]")
    # Either "offline" or "queued" copy is acceptable — both indicate the
    # local-save-with-queue path and both surface the retry button.
    await expect(status).to_contain_text(
        re.compile("غير متصل|طابور المزامنة"), timeout=10_000
    )
    retry_btn = _retry_button(dialog)
    await expect(retry_btn).to_be_visible()
    await page.screenshot(path=str(OUT / "off_01_offline_queued.png"))

    # Back online, click retry → should drain the queue and land on saved.
    await ctx.set_offline(False)
    await retry_btn.click()

    await expect(status).to_contain_text("تمّت المزامنة بنجاح", timeout=15_000)
    await expect(status.locator("time[datetime]")).to_be_visible()
    await page.screenshot(path=str(OUT / "off_02_saved_after_retry.png"))

    await ctx.close()
    print("✓ Retry after offline: offline/queued → saved")


async def _test_attempts_exhausted(browser):
    """يحقن طابور مزامنة مستنفَد (attempts=MAX, بدون nextRetryAt) ويتحقق:
      - عرض "استنفدت المحاولات التلقائية".
      - عرض عدّاد المحاولات 5 / 5.
      - عدم عرض "الإعادة القادمة خلال" (الإعادة التلقائية موقوفة).
    """
    ctx = await browser.new_context(viewport={"width": 1280, "height": 1800}, locale="ar-SA")
    page = await ctx.new_page()
    await _restore_session(ctx, page)
    await page.reload(wait_until="domcontentloaded")

    dialog = await _open_modal(page)

    # Inject an exhausted queue entry directly, then notify the banner.
    await page.evaluate(
        """() => {
          const entry = {
            country: 'EGP',
            queuedAt: new Date(Date.now() - 60_000).toISOString(),
            attempts: 5,
            lastError: 'network_unreachable',
            // no nextRetryAt → exhausted branch
          };
          localStorage.setItem('badel:pref-sync-queue', JSON.stringify(entry));
          window.dispatchEvent(new CustomEvent('badel:pref-sync', {
            detail: { status: 'failed', country: 'EGP', error: 'network_unreachable' }
          }));
        }"""
    )

    # Exhausted copy + attempts counter (5 / 5).
    exhausted = dialog.get_by_text(re.compile("استنفدت المحاولات التلقائية"))
    await expect(exhausted).to_be_visible(timeout=5_000)

    attempts_row = dialog.get_by_text(re.compile("المحاولات:"))
    await expect(attempts_row).to_contain_text(re.compile(r"5\s*/\s*5"))

    # Automatic retry must NOT be scheduled: no countdown / next-retry line.
    await expect(dialog.get_by_text(re.compile("الإعادة القادمة خلال"))).to_have_count(0)
    await expect(dialog.get_by_text(re.compile("^\\s*وقت الإعادة القادمة"))).to_have_count(0)

    await page.screenshot(path=str(OUT / "exhausted_01_state.png"))

    # Clicking retry after exhaustion must NOT re-arm an automatic schedule:
    # since the server is unreachable-by-design here (nothing routed), the
    # attempt should either stay in the exhausted state or bump attempts,
    # but never show a fresh countdown/nextRetry line.
    await ctx.route(
        "**/*setPreferredCountry*",
        lambda route: route.fulfill(status=500, content_type="application/json", body='{"error":"still_failing"}'),
    )
    retry_btn = _retry_button(dialog)
    if await retry_btn.count() > 0:
        await retry_btn.click()
        # Give the UI a moment to react; assert no countdown appears.
        await page.wait_for_timeout(1500)
        await expect(dialog.get_by_text(re.compile("الإعادة القادمة خلال"))).to_have_count(0)
        await page.screenshot(path=str(OUT / "exhausted_02_after_manual_click.png"))

    await ctx.close()
    print("✓ Attempts exhausted: 5/5 message shown, no automatic retry re-armed")


async def main():
    _require_auth()
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        try:
            await _test_retry_after_server_error(browser)
            await _test_retry_after_offline(browser)
            await _test_attempts_exhausted(browser)
        finally:
            await browser.close()
    print("\nALL PASS — retry button behavior verified in error + offline/queue + exhausted states.")


if __name__ == "__main__":
    asyncio.run(main())
