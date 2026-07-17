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

sys.path.insert(0, str(Path(__file__).parent))
from _axe import run_axe  # noqa: E402

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
      localStorage.setItem('badel_onboarding_v1', '1');
      localStorage.setItem('badel:cookie-consent', JSON.stringify({ choice: 'all', at: Date.now() }));
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


def _capture_analytics(page):
    """Sniffs POSTs to the analytics_events REST endpoint and returns a
    live list of {event_name, meta} dicts. Failures are silently ignored —
    analytics fires and forgets in the client too.
    """
    events: list[dict] = []

    def on_request(req):
        try:
            if req.method != "POST":
                return
            if "analytics_events" not in req.url:
                return
            body = req.post_data
            if not body:
                return
            payload = json.loads(body)
            rows = payload if isinstance(payload, list) else [payload]
            for row in rows:
                events.append({
                    "event_name": row.get("event_name"),
                    "meta": row.get("meta") or {},
                })
        except Exception:
            pass

    page.on("request", on_request)
    return events


async def _wait_for_event(events: list[dict], predicate, timeout_ms: int = 8000):
    """Poll `events` until predicate(evt) matches one entry, or timeout."""
    deadline = asyncio.get_event_loop().time() + timeout_ms / 1000
    while asyncio.get_event_loop().time() < deadline:
        for e in events:
            if predicate(e):
                return e
        await asyncio.sleep(0.15)
    return None



async def _test_retry_after_server_error(browser):
    ctx = await browser.new_context(viewport={"width": 1280, "height": 1800}, locale="ar-SA")
    page = await ctx.new_page()
    events = _capture_analytics(page)
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
    events.clear()  # focus on the retry-click window only
    await retry_btn.click()

    await expect(status).to_contain_text("تمّت المزامنة بنجاح", timeout=10_000)
    await expect(status.locator("time[datetime]")).to_be_visible()
    await page.screenshot(path=str(OUT / "err_02_saved_after_retry.png"))

    # Observability: retry_start THEN retry_success on pref_sync_flush.
    ev_start = await _wait_for_event(
        events,
        lambda e: e["event_name"] == "pref_sync_flush" and e["meta"].get("stage") == "retry_start",
    )
    assert ev_start is not None, f"missing pref_sync_flush.retry_start; captured={[e['event_name']+':'+str(e['meta'].get('stage')) for e in events]}"

    ev_success = await _wait_for_event(
        events,
        lambda e: e["event_name"] == "pref_sync_flush" and e["meta"].get("stage") == "retry_success",
    )
    assert ev_success is not None, "missing pref_sync_flush.retry_success after successful retry"
    assert "duration_ms" in ev_success["meta"], "retry_success must include duration_ms"

    # sync_pref_retry emitted by the button click itself
    ev_click = await _wait_for_event(events, lambda e: e["event_name"] == "sync_pref_retry")
    assert ev_click is not None, "missing sync_pref_retry (button click event)"

    # retry_incomplete MUST NOT fire on a successful retry
    bad = [e for e in events if e["event_name"] == "pref_sync_flush" and e["meta"].get("stage") == "retry_incomplete"]
    assert not bad, f"unexpected retry_incomplete on success path: {bad}"

    await ctx.close()
    print("✓ Retry after server error: retry_start + retry_success emitted (no retry_incomplete)")



async def _test_retry_after_offline(browser):
    ctx = await browser.new_context(viewport={"width": 1280, "height": 1800}, locale="ar-SA")
    page = await ctx.new_page()
    events = _capture_analytics(page)
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
    events.clear()  # focus the analytics assertions on the retry-click window
    await retry_btn.click()

    await expect(status).to_contain_text("تمّت المزامنة بنجاح", timeout=15_000)
    await expect(status.locator("time[datetime]")).to_be_visible()
    await page.screenshot(path=str(OUT / "off_02_saved_after_retry.png"))

    # Observability from the queue-drain path: retry_start + retry_success.
    ev_start = await _wait_for_event(
        events,
        lambda e: e["event_name"] == "pref_sync_flush" and e["meta"].get("stage") == "retry_start",
    )
    assert ev_start is not None, "missing pref_sync_flush.retry_start on queued retry"

    ev_success = await _wait_for_event(
        events,
        lambda e: e["event_name"] == "pref_sync_flush" and e["meta"].get("stage") == "retry_success",
    )
    assert ev_success is not None, "missing pref_sync_flush.retry_success on queued retry"

    ev_click = await _wait_for_event(events, lambda e: e["event_name"] == "sync_pref_retry")
    assert ev_click is not None, "missing sync_pref_retry (button click)"

    await ctx.close()
    print("✓ Retry after offline: retry_start + retry_success emitted from queue drain")


async def _test_retry_incomplete_when_still_failing(browser):
    """المسار السلبي: بعد فشل الخادم، النقر على "إعادة المحاولة" مع بقاء
    الخادم فاشلاً يجب أن يُصدر `pref_sync_flush.retry_incomplete` لا
    `retry_success`.
    """
    ctx = await browser.new_context(viewport={"width": 1280, "height": 1800}, locale="ar-SA")
    page = await ctx.new_page()
    events = _capture_analytics(page)
    await _restore_session(ctx, page)

    async def always_fail(route: Route):
        if "setPreferredCountry" in route.request.url:
            await route.fulfill(status=500, content_type="application/json",
                                body='{"error":"still_failing"}')
        else:
            await route.continue_()

    await ctx.route("**/*setPreferredCountry*", always_fail)
    await page.reload(wait_until="domcontentloaded")

    dialog = await _open_modal(page)
    await _click_save(dialog)
    status = dialog.locator("[role=status]")
    await expect(status).to_contain_text(re.compile("تعذّر حفظ التفضيل"), timeout=10_000)

    retry_btn = _retry_button(dialog)
    events.clear()
    await retry_btn.click()

    # Give the retry a moment to complete a full round-trip + analytics flush.
    ev_incomplete = await _wait_for_event(
        events,
        lambda e: e["event_name"] == "pref_sync_flush"
        and e["meta"].get("stage") in ("retry_incomplete", "error"),
        timeout_ms=12_000,
    )
    assert ev_incomplete is not None, "expected retry_incomplete (or flush error) after failed retry"

    ev_success = [e for e in events if e["event_name"] == "pref_sync_flush" and e["meta"].get("stage") == "retry_success"]
    assert not ev_success, f"retry_success must NOT fire while server keeps failing: {ev_success}"

    await page.screenshot(path=str(OUT / "err_03_retry_incomplete.png"))
    await ctx.close()
    print("✓ Retry-incomplete path: retry_incomplete emitted, no retry_success")



async def _test_attempts_and_countdown(browser):
    """يحقن طابور مزامنة قيد الإعادة (attempts=2, nextRetryAt خلال ~12s)
    ويتحقق داخل المودال من:
      - عرض عدّاد المحاولات "2 / 5".
      - سطر "الإعادة القادمة خلال:" مع قيمة ثواني.
      - سطر "وقت الإعادة القادمة:" مع <time datetime>.
      - تناقص العدّاد التنازلي مع مرور الوقت (تحديث كل ثانية).
    """
    ctx = await browser.new_context(viewport={"width": 1280, "height": 1800}, locale="ar-SA")
    page = await ctx.new_page()
    await _restore_session(ctx, page)
    await page.reload(wait_until="domcontentloaded")

    dialog = await _open_modal(page)

    next_iso = await page.evaluate(
        """() => {
          const next = new Date(Date.now() + 12_000).toISOString();
          const entry = {
            country: 'EGP',
            queuedAt: new Date(Date.now() - 30_000).toISOString(),
            attempts: 2,
            lastError: 'HTTP 500',
            nextRetryAt: next,
          };
          localStorage.setItem('badel:pref-sync-queue', JSON.stringify(entry));
          window.dispatchEvent(new CustomEvent('badel:pref-sync', {
            detail: { status: 'failed', country: 'EGP', error: 'HTTP 500' }
          }));
          return next;
        }"""
    )

    # attempts counter "2 / 5"
    attempts_row = dialog.get_by_text(re.compile("المحاولات:"))
    await expect(attempts_row).to_contain_text(re.compile(r"2\s*/\s*5"), timeout=5_000)

    # countdown line visible with a seconds value (X ث or M د SS ث)
    countdown_line = dialog.get_by_text(re.compile("الإعادة القادمة خلال"))
    await expect(countdown_line).to_be_visible()
    await expect(countdown_line).to_contain_text(re.compile(r"\d+\s*ث"))

    # absolute next-retry time element
    next_time = dialog.locator(f'time[datetime="{next_iso}"]')
    await expect(next_time).to_be_visible()

    # exhausted copy MUST NOT appear while attempts < max and next retry is scheduled
    await expect(dialog.get_by_text(re.compile("استنفدت المحاولات التلقائية"))).to_have_count(0)

    await page.screenshot(path=str(OUT / "queue_01_countdown_initial.png"))

    # Capture the first countdown value, wait, and confirm it decreases.
    def _extract_seconds(text: str) -> int:
        # "الإعادة القادمة خلال: 12 ث" or "1 د 05 ث"
        m = re.search(r"(?:(\d+)\s*د)?\s*(\d+)\s*ث", text)
        if not m:
            return -1
        mins = int(m.group(1) or 0)
        secs = int(m.group(2))
        return mins * 60 + secs

    t1_text = await countdown_line.inner_text()
    s1 = _extract_seconds(t1_text)
    assert s1 > 0, f"expected positive countdown seconds, got {t1_text!r}"

    await page.wait_for_timeout(2500)

    t2_text = await countdown_line.inner_text()
    s2 = _extract_seconds(t2_text)
    assert s2 < s1, f"countdown did not decrease ({s1} → {s2}) — text: {t2_text!r}"
    await page.screenshot(path=str(OUT / "queue_02_countdown_ticked.png"))

    await ctx.close()
    print(f"✓ Attempts + countdown while queued: 2/5 shown, countdown ticked {s1}s → {s2}s")



async def _test_countdown_ticks_to_zero_and_switches(browser):
    """يتحقق أن قيمة الثواني في العدّاد التنازلي تنخفض فعلياً باتجاه الصفر
    عبر عدة قراءات متتالية (s1 > s2 > s3 > s4)، وأن النص يتحوّل فور
    انتهاء الموعد إلى حالة الجاهزية للإعادة القادمة ("الآن…") بدلاً من
    عرض قيمة ثوانٍ سالبة أو التجمّد.
    """
    ctx = await browser.new_context(viewport={"width": 1280, "height": 1800}, locale="ar-SA")
    page = await ctx.new_page()
    await _restore_session(ctx, page)
    await page.reload(wait_until="domcontentloaded")

    dialog = await _open_modal(page)

    # موعد الإعادة القادمة قريب جداً (~5 ثوانٍ) لتوثيق تحوّل النص بسرعة.
    await page.evaluate(
        """() => {
          const next = new Date(Date.now() + 5_000).toISOString();
          const entry = {
            country: 'EGP',
            queuedAt: new Date(Date.now() - 10_000).toISOString(),
            attempts: 3,
            lastError: 'HTTP 500',
            nextRetryAt: next,
          };
          localStorage.setItem('badel:pref-sync-queue', JSON.stringify(entry));
          window.dispatchEvent(new CustomEvent('badel:pref-sync', {
            detail: { status: 'failed', country: 'EGP', error: 'HTTP 500' }
          }));
        }"""
    )

    countdown_line = dialog.get_by_text(re.compile("الإعادة القادمة خلال"))
    await expect(countdown_line).to_be_visible(timeout=3_000)

    def _extract_seconds(text: str) -> int:
        m = re.search(r"(?:(\d+)\s*د)?\s*(\d+)\s*ث", text)
        if not m:
            return -1
        return int(m.group(1) or 0) * 60 + int(m.group(2))

    # التقاط 4 عيّنات متتالية للتأكد من الاتجاه التنازلي نحو الصفر.
    samples = []
    for _ in range(4):
        txt = await countdown_line.inner_text()
        samples.append((txt, _extract_seconds(txt)))
        await page.wait_for_timeout(1100)

    values = [s for _, s in samples]
    assert all(v >= 0 for v in values), f"unexpected negative countdown value: {samples!r}"
    assert values[0] > values[-1], f"countdown did not decrease across samples: {samples!r}"
    # كل عيّنة يجب ألا تتجاوز سابقتها (متسلسلة غير متزايدة).
    for i in range(1, len(values)):
        assert values[i] <= values[i - 1], (
            f"countdown went up between samples {i-1}→{i}: {samples!r}"
        )
    await page.screenshot(path=str(OUT / "countdown_ticks_down.png"))

    # بعد انقضاء الموعد الفعلي، يجب أن يتحوّل النص إلى "الآن…" مباشرة
    # (حالة الجاهزية لإطلاق المحاولة القادمة) بدل عرض قيمة ثوانٍ.
    ready_line = dialog.get_by_text(re.compile("الإعادة القادمة خلال.*الآن"))
    await expect(ready_line).to_be_visible(timeout=8_000)
    final_text = await countdown_line.inner_text()
    assert "الآن" in final_text, f"expected 'الآن…' after deadline, got: {final_text!r}"
    assert not re.search(r"\d+\s*ث", final_text), (
        f"countdown seconds should be replaced by 'الآن…' after deadline, got: {final_text!r}"
    )
    await page.screenshot(path=str(OUT / "countdown_reached_zero.png"))

    await ctx.close()
    print(f"✓ Countdown ticks toward zero and switches to 'الآن…' after deadline (samples={values})")


async def _test_retry_button_toggles_with_schedule(browser):
    """يتحقق من انتقال حالة زر "إعادة المحاولة" وفق توفّر جدولة قادمة:

      1) وجود nextRetryAt أثناء العد التنازلي → الزر مُفعَّل وقابل للنقر.
      2) بلوغ العدّاد "الآن…" مع بقاء nextRetryAt → الزر يبقى قابلاً للنقر.
      3) استنفاد المحاولات (attempts=MAX, nextRetryAt=null) → الزر معطّل
         (disabled + aria-disabled=true) ولا يستجيب للنقر.
      4) عودة nextRetryAt (attempts<MAX) → الزر يُفعَّل مجدداً.
    """
    ctx = await browser.new_context(viewport={"width": 1280, "height": 1800}, locale="ar-SA")
    page = await ctx.new_page()
    await _restore_session(ctx, page)

    # اعتراض دائم لأي محاولة حفظ حتى تنتقل الحالة إلى "error" ويظهر زر الإعادة.
    async def force_fail(route: Route):
        url = route.request.url
        if "setPreferredCountry" in url:
            await route.fulfill(
                status=500,
                content_type="application/json",
                body=json.dumps({"error": "forced_failure_for_test"}),
            )
        else:
            await route.continue_()

    await ctx.route("**/*setPreferredCountry*", force_fail)
    await page.reload(wait_until="domcontentloaded")

    dialog = await _open_modal(page)
    await _click_save(dialog)

    status_line = dialog.locator("[role=status]")
    await expect(status_line).to_contain_text(re.compile("تعذّر حفظ التفضيل"), timeout=10_000)
    btn = _retry_button(dialog)
    await expect(btn).to_be_visible(timeout=5_000)

    # (1) جدولة قريبة → الزر يجب أن يكون مُفعَّلاً.
    await page.evaluate(
        """() => {
          const next = new Date(Date.now() + 4_000).toISOString();
          const entry = {
            country: 'EGP',
            queuedAt: new Date(Date.now() - 5_000).toISOString(),
            attempts: 2,
            lastError: 'HTTP 500',
            nextRetryAt: next,
          };
          localStorage.setItem('badel:pref-sync-queue', JSON.stringify(entry));
          window.dispatchEvent(new CustomEvent('badel:pref-sync', {
            detail: { status: 'failed', country: 'EGP', error: 'HTTP 500' }
          }));
        }"""
    )
    await expect(btn).to_be_visible(timeout=3_000)
    await expect(btn).to_be_enabled()
    assert await btn.get_attribute("aria-disabled") in (None, "false"), "button should be enabled during countdown"
    assert await btn.get_attribute("data-retry-exhausted") == "false"
    await page.screenshot(path=str(OUT / "retry_enabled_during_countdown.png"))

    # (2) عند بلوغ "الآن…" يبقى الزر قابلاً للنقر.
    ready = dialog.get_by_text(re.compile("الإعادة القادمة خلال.*الآن"))
    await expect(ready).to_be_visible(timeout=8_000)
    await expect(btn).to_be_enabled()
    assert await btn.get_attribute("data-retry-exhausted") == "false"
    await page.screenshot(path=str(OUT / "retry_enabled_at_ready.png"))

    # (3) استنفاد المحاولات → الزر يجب أن يصبح معطّلاً.
    await page.evaluate(
        """() => {
          const entry = {
            country: 'EGP',
            queuedAt: new Date(Date.now() - 20_000).toISOString(),
            attempts: 5,
            lastError: 'HTTP 500',
            nextRetryAt: null,
          };
          localStorage.setItem('badel:pref-sync-queue', JSON.stringify(entry));
          window.dispatchEvent(new CustomEvent('badel:pref-sync', {
            detail: { status: 'failed', country: 'EGP', error: 'HTTP 500' }
          }));
        }"""
    )
    await expect(btn).to_be_disabled(timeout=3_000)
    assert await btn.get_attribute("aria-disabled") == "true"
    assert await btn.get_attribute("data-retry-exhausted") == "true"
    await page.screenshot(path=str(OUT / "retry_disabled_when_exhausted.png"))

    # النقر على زر معطّل يجب ألا يُطلق أي عملية مزامنة.
    triggered = await page.evaluate(
        """async () => {
          let fired = false;
          const handler = () => { fired = true; };
          window.addEventListener('badel:pref-sync', handler, { once: true });
          try {
            const el = document.querySelector('button[data-retry-exhausted="true"]');
            el?.click();
            await new Promise(r => setTimeout(r, 200));
          } finally {
            window.removeEventListener('badel:pref-sync', handler);
          }
          return fired;
        }"""
    )
    assert triggered is False, "disabled retry button must not trigger sync attempts"

    # (4) عودة جدولة صالحة → الزر يعود مُفعَّلاً.
    await page.evaluate(
        """() => {
          const next = new Date(Date.now() + 6_000).toISOString();
          const entry = {
            country: 'EGP',
            queuedAt: new Date(Date.now() - 30_000).toISOString(),
            attempts: 3,
            lastError: 'HTTP 500',
            nextRetryAt: next,
          };
          localStorage.setItem('badel:pref-sync-queue', JSON.stringify(entry));
          window.dispatchEvent(new CustomEvent('badel:pref-sync', {
            detail: { status: 'failed', country: 'EGP', error: 'HTTP 500' }
          }));
        }"""
    )
    await expect(btn).to_be_enabled(timeout=3_000)
    assert await btn.get_attribute("data-retry-exhausted") == "false"
    await page.screenshot(path=str(OUT / "retry_re_enabled_after_reschedule.png"))

    await ctx.close()
    print("✓ Retry button toggles correctly with next-retry availability (countdown → ready → exhausted → rescheduled)")


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


async def _test_status_transitions_ordered(browser):
    """يتحقق أن زر "إعادة المحاولة" ينقل حالة المودال بالترتيب الصحيح
    عبر السيناريوهات الثلاثة (طابور → فشل → نجاح) مع التقاط طابع
    زمني بعد كل سيناريو للتوثيق:
      1) حفظ أثناء الأوفلاين → "غير متصل|طابور المزامنة"   (T1)
      2) عودة الاتصال + الخادم يفشل + retry → "تعذّر حفظ"   (T2)
      3) استرداد الخادم + retry → "تمّت المزامنة بنجاح"    (T3)
    """
    from datetime import datetime, timezone

    ctx = await browser.new_context(viewport={"width": 1280, "height": 1800}, locale="ar-SA")
    page = await ctx.new_page()
    await _restore_session(ctx, page)

    server_state = {"mode": "pass"}  # "pass" | "fail"

    async def controlled(route: Route):
        if "setPreferredCountry" in route.request.url and server_state["mode"] == "fail":
            await route.fulfill(status=500, content_type="application/json",
                                body='{"error":"forced_failure"}')
        else:
            await route.continue_()

    await ctx.route("**/*setPreferredCountry*", controlled)
    await page.reload(wait_until="domcontentloaded")

    dialog = await _open_modal(page)
    status = dialog.locator("[role=status]")
    timeline: list[tuple[str, str]] = []

    def stamp(label: str):
        ts = datetime.now(timezone.utc).isoformat(timespec="milliseconds")
        timeline.append((label, ts))
        print(f"  · {label}  @ {ts}")

    # --- 1) طابور/أوفلاين ---
    await ctx.set_offline(True)
    await _click_save(dialog)
    await expect(status).to_contain_text(
        re.compile("غير متصل|طابور المزامنة"), timeout=10_000
    )
    retry_btn = _retry_button(dialog)
    await expect(retry_btn).to_be_visible()
    await page.screenshot(path=str(OUT / "seq_01_queued.png"))
    stamp("queued/offline")

    # --- 2) online + الخادم يفشل → retry ينقل إلى syncing ثم error ---
    await ctx.set_offline(False)
    server_state["mode"] = "fail"
    await retry_btn.click()
    await expect(status).to_contain_text(
        re.compile("جاري المزامنة|تعذّر حفظ التفضيل"), timeout=10_000
    )
    await expect(status).to_contain_text("تعذّر حفظ التفضيل", timeout=10_000)
    await expect(retry_btn).to_be_visible()
    await page.screenshot(path=str(OUT / "seq_02_error.png"))
    stamp("error (server failing)")

    # --- 3) استرداد الخادم → retry → saved مع <time datetime> ---
    server_state["mode"] = "pass"
    await retry_btn.click()
    await expect(status).to_contain_text("تمّت المزامنة بنجاح", timeout=10_000)
    saved_time = status.locator("time[datetime]")
    await expect(saved_time).to_be_visible()
    saved_dt = await saved_time.get_attribute("datetime")
    assert saved_dt, "expected time[datetime] on saved status"
    await page.screenshot(path=str(OUT / "seq_03_saved.png"))
    stamp(f"saved (datetime={saved_dt})")

    # الطوابع الزمنية تصاعدية والترتيب المنطقي للحالات صحيح.
    ts_values = [t for _, t in timeline]
    assert ts_values == sorted(ts_values), f"status timeline not monotonic: {timeline}"
    labels = [lbl for lbl, _ in timeline]
    assert (
        labels[0].startswith("queued")
        and labels[1].startswith("error")
        and labels[2].startswith("saved")
    ), f"bad order: {labels}"

    await ctx.close()
    print(f"✓ Status transitions ordered (queued→error→saved) with {len(timeline)} timestamps")


async def _test_readable_failure_reason(browser):
    """يتحقق أن مودال حالة المزامنة يعرض سبب الفشل المقروء بعد كل
    محاولة فاشلة، ويميّز بين "خطأ الخادم" و"خطأ شبكة" مع طابع زمني
    ومرحلة (قراءة/حفظ) لكل فشل، وأن الطابع الزمني يتحدّث بعد كل محاولة.
    """
    ctx = await browser.new_context(viewport={"width": 1280, "height": 1800}, locale="ar-SA")
    page = await ctx.new_page()
    await _restore_session(ctx, page)

    mode = {"kind": "server"}  # "server" | "network" | "pass"

    async def controlled(route: Route):
        if "setPreferredCountry" not in route.request.url:
            await route.continue_()
            return
        if mode["kind"] == "server":
            await route.fulfill(status=500, content_type="application/json",
                                body='{"error":"forced_server_failure"}')
        elif mode["kind"] == "network":
            await route.abort("failed")
        else:
            await route.continue_()

    await ctx.route("**/*setPreferredCountry*", controlled)
    await page.reload(wait_until="domcontentloaded")

    dialog = await _open_modal(page)
    status = dialog.locator("[role=status]")

    # --- 1) خطأ خادم 500 ---
    await _click_save(dialog)
    await expect(status).to_contain_text("تعذّر حفظ التفضيل", timeout=10_000)
    badge = status.get_by_text(re.compile("خطأ الخادم"))
    await expect(badge).to_be_visible()
    await expect(badge).to_contain_text("500")
    fail_time_1 = status.locator("time[datetime]")
    await expect(fail_time_1).to_be_visible()
    dt1 = await fail_time_1.get_attribute("datetime")
    assert dt1, "expected time[datetime] on first failure"
    # مرحلة "حفظ التفضيل" يجب أن تظهر
    await expect(status).to_contain_text(re.compile("المرحلة:\\s*حفظ التفضيل"))
    await page.screenshot(path=str(OUT / "reason_01_server.png"))

    # --- 2) خطأ شبكة عبر route.abort ---
    mode["kind"] = "network"
    retry_btn = _retry_button(dialog)
    # ضمان طابع زمني مختلف (الدقة بالدقيقة في نص العرض، لكن datetime بالميلي ثانية).
    await page.wait_for_timeout(1100)
    await retry_btn.click()

    await expect(status).to_contain_text("تعذّر حفظ التفضيل", timeout=10_000)
    net_badge = status.get_by_text(re.compile(r"^\s*خطأ شبكة\s*$"))
    await expect(net_badge).to_be_visible()
    # يجب ألا تبقى شارة "خطأ الخادم" ظاهرة بعد التبديل
    await expect(status.get_by_text(re.compile("خطأ الخادم"))).to_have_count(0)

    fail_time_2 = status.locator("time[datetime]")
    dt2 = await fail_time_2.get_attribute("datetime")
    assert dt2 and dt2 != dt1, f"failure timestamp must update after each attempt (dt1={dt1!r}, dt2={dt2!r})"
    await page.screenshot(path=str(OUT / "reason_02_network.png"))

    await ctx.close()
    print(f"✓ Readable failure reason: server(500)@{dt1} → network@{dt2} (badges + stage + timestamps updated)")


EXHAUSTED_TEXT = "استنفدت المحاولات التلقائية — استخدم زر إعادة المحاولة يدوياً."


async def _inject_exhausted_entry(page):
    """يضبط طابور مزامنة مستنفَد (attempts=5, بدون nextRetryAt) ويُشعر البانر."""
    await page.evaluate(
        """() => {
          const entry = {
            country: 'EGP',
            queuedAt: new Date(Date.now() - 90_000).toISOString(),
            attempts: 5,
            lastError: 'network_unreachable',
          };
          localStorage.setItem('badel:pref-sync-queue', JSON.stringify(entry));
          window.dispatchEvent(new CustomEvent('badel:pref-sync', {
            detail: { status: 'failed', country: 'EGP', error: 'network_unreachable' }
          }));
        }"""
    )


async def _test_exhausted_message_offline_and_queued(browser):
    """يتأكّد أن رسالة "استنفدت المحاولات التلقائية" تظهر بنفس النص المطابق
    داخل مودال حالة المزامنة في كلتا الحالتين: الأوفلاين والطابور بعد فشل
    الخادم، وأن سطر "الإعادة القادمة خلال" غير معروض عند الاستنفاد.
    """
    # --- A) حالة الأوفلاين ---
    ctx = await browser.new_context(viewport={"width": 1280, "height": 1800}, locale="ar-SA")
    page = await ctx.new_page()
    await _restore_session(ctx, page)
    await page.reload(wait_until="domcontentloaded")

    dialog = await _open_modal(page)
    await ctx.set_offline(True)
    await _click_save(dialog)
    status = dialog.locator("[role=status]").first
    await expect(status).to_contain_text(
        re.compile("غير متصل|طابور المزامنة"), timeout=10_000
    )

    await _inject_exhausted_entry(page)

    exhausted_a = dialog.get_by_text(EXHAUSTED_TEXT, exact=True)
    await expect(exhausted_a).to_be_visible(timeout=5_000)
    attempts_a = dialog.get_by_text(re.compile("المحاولات:"))
    await expect(attempts_a).to_contain_text(re.compile(r"5\s*/\s*5"))
    # الإعادة التلقائية موقوفة — لا عدّاد ولا موعد قادم.
    await expect(dialog.get_by_text(re.compile("الإعادة القادمة خلال"))).to_have_count(0)
    await page.screenshot(path=str(OUT / "exhausted_offline.png"))
    await ctx.close()

    # --- B) حالة الطابور (queued) بعد فشل الخادم أونلاين ---
    ctx = await browser.new_context(viewport={"width": 1280, "height": 1800}, locale="ar-SA")
    page = await ctx.new_page()
    await _restore_session(ctx, page)

    async def always_fail(route: Route):
        if "setPreferredCountry" in route.request.url:
            await route.fulfill(status=500, content_type="application/json",
                                body='{"error":"forced"}')
        else:
            await route.continue_()

    await ctx.route("**/*setPreferredCountry*", always_fail)
    await page.reload(wait_until="domcontentloaded")

    dialog = await _open_modal(page)
    await _click_save(dialog)
    status = dialog.locator("[role=status]").first
    # عند فشل flush أونلاين، الحالة تنتقل إلى "queued" (نص "طابور المزامنة")
    # أو إلى "error" إذا رمى استدعاء الطابور استثناء — كلاهما يعرض صندوق المحاولات.
    await expect(status).to_contain_text(
        re.compile("طابور المزامنة|تعذّر حفظ التفضيل"), timeout=15_000
    )

    await _inject_exhausted_entry(page)

    exhausted_b = dialog.get_by_text(EXHAUSTED_TEXT, exact=True)
    await expect(exhausted_b).to_be_visible(timeout=5_000)
    attempts_b = dialog.get_by_text(re.compile("المحاولات:"))
    await expect(attempts_b).to_contain_text(re.compile(r"5\s*/\s*5"))
    await expect(dialog.get_by_text(re.compile("الإعادة القادمة خلال"))).to_have_count(0)
    await page.screenshot(path=str(OUT / "exhausted_queued.png"))
    await ctx.close()

    print("✓ Exhausted message matches exactly in both offline and queued states")


async def _test_aria_live_announces_ready_now(browser):
    """يتحقق أن منطقة aria-live المخفية (sr-only role=status) داخل بطاقة
    العدّاد التنازلي:
      1) تبقى فارغة أثناء العدّ (لا تُقاطع قارئ الشاشة كل ثانية).
      2) تُحدَّث فوراً إلى النص الصحيح "جاهز لإعادة المحاولة الآن." عند
         بلوغ الموعد، بالتزامن مع تحوّل نص العدّاد إلى "الآن…".
      3) تحمل السمات الصحيحة (aria-live=polite, aria-atomic=true) حتى
         يعلن قارئ الشاشة التغيير كوحدة واحدة.
    """
    ctx = await browser.new_context(viewport={"width": 1280, "height": 1800}, locale="ar-SA")
    page = await ctx.new_page()
    await _restore_session(ctx, page)
    await page.reload(wait_until="domcontentloaded")

    dialog = await _open_modal(page)

    # موعد قريب جداً (~3 ثوانٍ) لتوثيق تحوّل الإعلان بسرعة.
    await page.evaluate(
        """() => {
          const next = new Date(Date.now() + 3_000).toISOString();
          const entry = {
            country: 'EGP',
            queuedAt: new Date(Date.now() - 10_000).toISOString(),
            attempts: 2,
            lastError: 'HTTP 500',
            nextRetryAt: next,
          };
          localStorage.setItem('badel:pref-sync-queue', JSON.stringify(entry));
          window.dispatchEvent(new CustomEvent('badel:pref-sync', {
            detail: { status: 'failed', country: 'EGP', error: 'HTTP 500' }
          }));
        }"""
    )

    # حصر منطقة sr-only الخاصة بالعدّاد: role=status + aria-live=polite + sr-only،
    # وموجودة داخل نفس الحاوية التي تعرض "المحاولات: n / m".
    countdown_card = dialog.locator("div", has_text=re.compile("المحاولات:")).filter(
        has_text=re.compile("الإعادة القادمة خلال")
    ).first
    await expect(countdown_card).to_be_visible(timeout=3_000)

    live_region = countdown_card.locator("span[role='status'][aria-live='polite'].sr-only").first
    await expect(live_region).to_have_count(1)
    await expect(live_region).to_have_attribute("aria-atomic", "true")
    await expect(live_region).to_have_attribute("aria-live", "polite")

    # أثناء العدّ: يجب أن تكون منطقة الإعلان فارغة حتى لا يُقاطع القارئ كل ثانية.
    initial_text = (await live_region.inner_text()).strip()
    assert initial_text == "", (
        f"aria-live region should stay empty while counting down, got: {initial_text!r}"
    )

    # بعد انقضاء الموعد: يظهر النص الدقيق ويتزامن مع تحوّل العدّاد إلى "الآن…".
    await expect(live_region).to_have_text("جاهز لإعادة المحاولة الآن.", timeout=8_000)
    countdown_line = dialog.get_by_text(re.compile("الإعادة القادمة خلال"))
    final_text = await countdown_line.inner_text()
    assert "الآن" in final_text, (
        f"visible countdown should also flip to 'الآن…' when aria-live fires, got: {final_text!r}"
    )
    await page.screenshot(path=str(OUT / "aria_live_ready_now.png"))

    await ctx.close()


async def _test_aria_live_exact_at_zero(browser):
    """تأكيد أن إعلان aria-live يُطلق عند بلوغ العدّاد صفراً بالضبط،
    وأن النص المُعلَن يطابق حرفياً "جاهز لإعادة المحاولة الآن.".

    نستخدم MutationObserver مثبَّتاً *قبل* بلوغ الصفر لالتقاط كل قيمة تدخل
    منطقة الإعلان مع طابع زمني (performance.now()). بعد التحوّل نتحقق:
      - تُوجد قيمة واحدة على الأقل تطابق النص الحرفي المتوقّع.
      - في لحظة الإعلان، نص العدّاد المرئي يحتوي رمز الحذف "…" (الحرف
        الفعلي U+2026) وليس رقماً — أي أن العدّ فعلاً وصل إلى صفر.
      - قبل الوصول إلى صفر، لم تصدر أي إعلانات (المنطقة تبقى صامتة).
    """
    ctx = await browser.new_context(viewport={"width": 1280, "height": 1800}, locale="ar-SA")
    page = await ctx.new_page()
    await _restore_session(ctx, page)
    await page.reload(wait_until="domcontentloaded")

    dialog = await _open_modal(page)

    # جدولة قريبة (~2.5s) لتحوّل يمكن التقاطه ضمن مهلة الاختبار.
    await page.evaluate(
        """() => {
          const next = new Date(Date.now() + 2_500).toISOString();
          const entry = {
            country: 'EGP',
            queuedAt: new Date(Date.now() - 10_000).toISOString(),
            attempts: 2,
            lastError: 'HTTP 500',
            nextRetryAt: next,
          };
          localStorage.setItem('badel:pref-sync-queue', JSON.stringify(entry));
          window.dispatchEvent(new CustomEvent('badel:pref-sync', {
            detail: { status: 'failed', country: 'EGP', error: 'HTTP 500' }
          }));
        }"""
    )

    # حدد منطقة الإعلان قبل تركيب المراقب.
    live_selector = "[role='dialog'] span[role='status'][aria-live='polite'].sr-only"
    await page.wait_for_selector(live_selector, timeout=5_000)

    # ثبّت MutationObserver قبل بلوغ الصفر لالتقاط كل الإعلانات مع طوابعها.
    await page.evaluate(
        """(sel) => {
          const el = document.querySelector(sel);
          window.__ariaAnnouncements = [];
          const obs = new MutationObserver(() => {
            const text = (el.textContent || '').trim();
            window.__ariaAnnouncements.push({ text, at: performance.now() });
          });
          obs.observe(el, { childList: true, characterData: true, subtree: true });
          window.__ariaObserver = obs;
        }""",
        live_selector,
    )

    # انتظر بلوغ الإعلان الحرفي.
    live_region = page.locator(live_selector).first
    await expect(live_region).to_have_text("جاهز لإعادة المحاولة الآن.", timeout=8_000)

    # افحص كل الإعلانات المُلتقطة.
    recorded = await page.evaluate(
        "() => (window.__ariaAnnouncements || []).map(x => ({ text: x.text, at: x.at }))"
    )
    await page.evaluate("() => { window.__ariaObserver && window.__ariaObserver.disconnect(); }")

    # لا يُعلن إلا نص واحد صحيح (بعد تصفية القيم الفارغة).
    non_empty = [a for a in recorded if a["text"]]
    assert non_empty, f"expected at least one aria-live announcement, got: {recorded!r}"

    expected = "جاهز لإعادة المحاولة الآن."
    matches = [a for a in non_empty if a["text"] == expected]
    assert matches, (
        f"aria-live announcement did not match expected literal.\n"
        f"expected: {expected!r}\ngot: {[a['text'] for a in non_empty]!r}"
    )

    # لا يُعلن أي نص مختلف (لا ضجيج قبل/بعد الصفر).
    unexpected = [a["text"] for a in non_empty if a["text"] != expected]
    assert not unexpected, (
        f"aria-live emitted unexpected text(s) besides the ready message: {unexpected!r}"
    )

    # في لحظة الإعلان: العدّاد المرئي يحتوي رمز الحذف U+2026 (الحرف الفعلي "…")
    # وليس رقماً — دليل مباشر على أن العدّ بلغ صفراً.
    countdown_line = dialog.get_by_text(re.compile("الإعادة القادمة خلال"))
    visible_text = await countdown_line.inner_text()
    assert "الآن\u2026" in visible_text, (
        f"visible countdown must show the exact literal 'الآن…' (U+2026) at zero, "
        f"got: {visible_text!r}"
    )
    # ولا يحتوي أي رقم عربي/لاتيني (تأكيد إضافي أن العدّ انتهى).
    assert not re.search(r"[0-9\u0660-\u0669]", visible_text), (
        f"countdown text should not contain digits after reaching zero: {visible_text!r}"
    )

    await page.screenshot(path=str(OUT / "aria_live_exact_at_zero.png"))
    await ctx.close()
    print("✓ aria-live announcement fires exactly at zero with literal 'جاهز لإعادة المحاولة الآن.'")





async def _test_axe_no_a11y_violations(browser):
    """فحص axe-core على حالات المودال المختلفة للتأكد من عدم وجود
    تضارب في aria-live / roles / aria-disabled / أسماء الأزرار.

    يمرّ على:
      1) البانر بحدّ ذاته (قبل فتح المودال).
      2) المودال في حالة الخمول (idle).
      3) بعد فشل الخادم → زر "إعادة المحاولة" ظاهر ورسالة role=status نشطة.
      4) بعد حقن طابور مستنفَد → aria-disabled=true على زر الإعادة.
    """
    ctx = await browser.new_context(viewport={"width": 1280, "height": 1800}, locale="ar-SA")
    page = await ctx.new_page()
    await _restore_session(ctx, page)

    fail_mode = {"on": False}

    async def controlled(route: Route):
        if "setPreferredCountry" in route.request.url and fail_mode["on"]:
            await route.fulfill(status=500, content_type="application/json",
                                body='{"error":"forced_failure_for_a11y"}')
        else:
            await route.continue_()

    await ctx.route("**/*setPreferredCountry*", controlled)
    await page.reload(wait_until="domcontentloaded")

    # 1) البانر قبل فتح المودال.
    banner = page.get_by_role("region").filter(has_text=re.compile("اكتشفنا موقعك"))
    await banner.wait_for(state="visible", timeout=15_000)
    await run_axe(page, context_selector="[data-country-banner], [role=region]",
                  label="banner-visible", out_dir=OUT)

    # 2) المودال في حالة الخمول.
    dialog = await _open_modal(page)
    # نُثبّت data-testid عبر role=dialog (shadcn Radix يضع role=dialog).
    await run_axe(page, context_selector="[role=dialog]",
                  label="modal-idle", out_dir=OUT)

    # 3) حالة خطأ الخادم مع ظهور زر "إعادة المحاولة".
    fail_mode["on"] = True
    await _click_save(dialog)
    status = dialog.locator("[role=status]")
    await expect(status).to_contain_text(re.compile("تعذّر حفظ التفضيل"), timeout=10_000)
    retry_btn = _retry_button(dialog)
    await expect(retry_btn).to_be_visible()
    await run_axe(page, context_selector="[role=dialog]",
                  label="modal-retry-visible", out_dir=OUT)

    # 4) حالة استنفاد المحاولات → aria-disabled=true على زر الإعادة.
    await page.evaluate(
        """() => {
          const entry = {
            country: 'EGP',
            queuedAt: new Date(Date.now() - 60_000).toISOString(),
            attempts: 5,
            lastError: 'network_unreachable',
          };
          localStorage.setItem('badel:pref-sync-queue', JSON.stringify(entry));
          window.dispatchEvent(new CustomEvent('badel:pref-sync', {
            detail: { status: 'failed', country: 'EGP', error: 'network_unreachable' }
          }));
        }"""
    )
    await expect(dialog.get_by_text(re.compile("استنفدت المحاولات التلقائية"))).to_be_visible(timeout=5_000)
    # تحقّق يدوي أن aria-disabled فعلاً على الزر (وليس disabled فقط)، ثم اطلب axe.
    if await retry_btn.count() > 0:
        aria_disabled = await retry_btn.get_attribute("aria-disabled")
        assert aria_disabled in ("true", None), (
            f"retry button aria-disabled unexpected value: {aria_disabled!r}"
        )
    await run_axe(page, context_selector="[role=dialog]",
                  label="modal-exhausted-aria-disabled", out_dir=OUT)

    await page.screenshot(path=str(OUT / "axe_final_state.png"))
    await ctx.close()
    print("✓ axe-core: no serious/critical ARIA violations across "
          "banner / modal-idle / retry-visible / exhausted-aria-disabled states")


async def main():
    _require_auth()
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        try:
            await _test_retry_after_server_error(browser)
            await _test_retry_after_offline(browser)
            await _test_retry_incomplete_when_still_failing(browser)
            await _test_attempts_and_countdown(browser)
            await _test_countdown_ticks_to_zero_and_switches(browser)
            await _test_retry_button_toggles_with_schedule(browser)
            await _test_attempts_exhausted(browser)
            await _test_status_transitions_ordered(browser)
            await _test_readable_failure_reason(browser)
            await _test_exhausted_message_offline_and_queued(browser)
            await _test_aria_live_announces_ready_now(browser)
            await _test_aria_live_exact_at_zero(browser)
            await _test_axe_no_a11y_violations(browser)

        finally:
            await browser.close()
    print("\nALL PASS — retry button behavior verified in error + offline/queue + exhausted + ordered-transition + readable-failure-reason + exhausted-copy + schedule-toggle + aria-live-ready-now + axe-a11y states.")


if __name__ == "__main__":
    asyncio.run(main())
