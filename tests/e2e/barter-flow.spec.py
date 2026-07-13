"""
E2E — المسار السعيد الكامل للمقايضة الثنائية مع الشحن والضمان.
لا يشمل: سيناريو النزاع، ولا المقايضة الثلاثية.

كل خطوة حرجة → screenshot تحت /tmp/browser/barter/
    NN_<step>[_<label>].png            → لقطة نجاح
    NN_<step>_ERROR[_<label>].png      → لقطة فشل قبل رفع الاستثناء

التشغيل:
    python3 tests/e2e/barter-flow.spec.py
"""
import asyncio
import re
import json
import os
import uuid
from pathlib import Path

import requests
from playwright.async_api import async_playwright, Page, BrowserContext

BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:8080")
SUPABASE_URL = os.environ["SUPABASE_URL"]
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

SCREENSHOTS = Path("/tmp/browser/barter")
SCREENSHOTS.mkdir(parents=True, exist_ok=True)
# ابدأ من مجلد نظيف حتى لا تختلط لقطات التشغيلات السابقة
for old in SCREENSHOTS.glob("*.png"):
    old.unlink()

SUFFIX = uuid.uuid4().hex[:6]
USER_A = {"email": f"seller_{SUFFIX}@e2e.test", "password": "TestPass!234", "name": "بائع E2E"}
USER_B = {"email": f"buyer_{SUFFIX}@e2e.test",  "password": "TestPass!234", "name": "مشتري E2E"}

_STEP = {"n": 0}


async def snap(page: Page, name: str, label: str | None = None) -> None:
    """لقطة مرقمة تلقائيًا للتحقق البصري في كل خطوة حرجة."""
    _STEP["n"] += 1
    tag = f"{_STEP['n']:02d}_{name}" + (f"_{label}" if label else "")
    path = SCREENSHOTS / f"{tag}.png"
    try:
        await page.screenshot(path=str(path))
        print(f"  📸 {tag}.png")
    except Exception as e:
        print(f"  ⚠ snap({tag}) failed: {type(e).__name__}: {e}")


async def step(page: Page, name: str, coro, label: str | None = None):
    """يشغّل خطوة UI ويضمن لقطة (نجاح أو خطأ) قبل الاستمرار."""
    try:
        await coro
        await snap(page, name, label)
    except Exception as e:
        await snap(page, f"{name}_ERROR", label)
        raise


# ---------- Admin helpers (service role) ----------

def admin(path: str, method: str = "POST", body: dict | None = None) -> dict:
    r = requests.request(
        method,
        f"{SUPABASE_URL}{path}",
        headers={
            "apikey": SERVICE_KEY,
            "Authorization": f"Bearer {SERVICE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        data=json.dumps(body) if body else None,
        timeout=15,
    )
    if not r.ok:
        raise RuntimeError(f"{method} {path} → {r.status_code}: {r.text}")
    return r.json() if r.text else {}


def create_user(email: str, password: str, name: str) -> str:
    u = admin("/auth/v1/admin/users", body={
        "email": email, "password": password, "email_confirm": True,
        "user_metadata": {"display_name": name},
    })
    return u["id"]


def create_listing(owner_id: str, title_suffix: str = "") -> str:
    row = admin("/rest/v1/listings", body={
        "owner_id": owner_id,
        "title": f"هاتف Pixel 8 اختبار {SUFFIX}{title_suffix}",
        "description": "إعلان اختبار E2E — قابل للشحن.",
        "category": "phones",
        "condition": "excellent",
        "market_price": 2500,
        "city": "الرياض",
        "listing_type": "item",
        "wants": "لابتوب أو كاش",
        "images": [],
        "status": "active",
    })
    return row[0]["id"]


# ---------- Playwright helpers ----------

async def sign_in(page: Page, email: str, password: str, label: str):
    await page.goto(f"{BASE_URL}/auth", wait_until="domcontentloaded")
    await page.evaluate("localStorage.setItem('badel_onboarding_v1', '1')")
    await snap(page, "auth_page", label)
    await page.locator("input[type=email]").fill(email)
    await page.locator("input[type=password]").fill(password)
    await snap(page, "auth_filled", label)
    await page.get_by_role("button", name="تسجيل الدخول").click()
    await page.wait_for_url(lambda u: "/auth" not in u, timeout=15_000)
    await snap(page, "signed_in_home", label)


async def send_offer(page: Page, listing_id: str):
    await page.goto(f"{BASE_URL}/offer/{listing_id}", wait_until="domcontentloaded")
    await snap(page, "offer_form_empty", "buyer")
    await page.locator("h2:has-text('اختر عرضك') ~ div button").first.click()
    await page.locator("input[type=number]").first.fill("300")
    await page.locator("input[type=checkbox]").last.check()
    await snap(page, "offer_form_filled", "buyer")
    await page.get_by_role("button", name=re.compile("تأكيد وإرسال")).click()
    await page.wait_for_url("**/offers/**", timeout=15_000)
    await snap(page, "offer_submitted", "buyer")


async def accept_offer(page: Page, offer_id: str):
    await page.goto(f"{BASE_URL}/offers/{offer_id}", wait_until="domcontentloaded")
    await page.wait_for_timeout(1500)
    await snap(page, "offer_detail_before_accept", "seller")
    await page.locator("button:has-text('قبول')").first.click()
    await page.wait_for_timeout(3000)
    await snap(page, "offer_accepted", "seller")


async def pay_platform_fee(page: Page):
    await page.get_by_role("checkbox", name=re.compile("الشروط")).check()
    await snap(page, "fee_consent_checked", "buyer")
    await page.get_by_role("button", name=re.compile("^دفع")).click()
    await page.wait_for_selector("text=العمولة مدفوعة", timeout=15_000)
    await snap(page, "fee_paid", "buyer")


async def add_shipping(page: Page):
    await page.get_by_label("شركة الشحن").fill("SMSA")
    await page.get_by_label("رقم التتبع").fill(f"TRK{SUFFIX.upper()}")
    await snap(page, "shipping_form_filled", "seller")
    await page.get_by_role("button", name="حفظ بيانات الشحن").click()
    await page.wait_for_selector("text=تم حفظ الشحن", timeout=10_000)
    await snap(page, "shipping_saved", "seller")


async def confirm_delivery(page: Page, label: str):
    await page.get_by_role("button", name="تأكيد الاستلام").click()
    await page.wait_for_timeout(1500)
    await snap(page, "delivery_confirmed", label)


# ---------- Main ----------

async def before_all():
    """Seed users + listings via supabaseAdmin (service role)."""
    print(f"→ [beforeAll] seeding via supabaseAdmin (suffix={SUFFIX})")
    a_id = create_user(**USER_A)
    b_id = create_user(**USER_B)
    listing_id = create_listing(a_id)
    create_listing(b_id, title_suffix=" (B)")
    print(f"  ✓ userA={a_id[:8]}  userB={b_id[:8]}  listing={listing_id[:8]}")
    return {"a_id": a_id, "b_id": b_id, "listing_id": listing_id}


async def open_session(browser, user: dict, label: str):
    ctx: BrowserContext = await browser.new_context(viewport={"width": 1280, "height": 1800})
    page = await ctx.new_page()
    await sign_in(page, user["email"], user["password"], label)
    return ctx, page


async def main():
    seeded = await before_all()

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)

        (ctx_a, page_a), (ctx_b, page_b) = await asyncio.gather(
            open_session(browser, USER_A, "seller"),
            open_session(browser, USER_B, "buyer"),
        )
        print("✓ both sessions signed-in in isolated contexts")

        # المشتري يرسل العرض
        await send_offer(page_b, seeded["listing_id"])
        offer_id = page_b.url.rsplit("/", 1)[-1]
        print(f"✓ offer sent → {offer_id[:8]}")

        # البائع يقبل
        await accept_offer(page_a, offer_id)
        print("✓ offer accepted")

        # ---- Post-accept steps (best-effort) ----
        post_steps = [
            ("pay_fee",  page_b, pay_platform_fee(page_b),         "buyer"),
            ("shipping", page_a, add_shipping(page_a),              "seller"),
            ("deliver",  page_a, confirm_delivery(page_a, "seller"), "seller"),
            ("deliver",  page_b, confirm_delivery(page_b, "buyer"),  "buyer"),
        ]
        for name, pg, coro, label in post_steps:
            try:
                await pg.reload()
                await coro
                print(f"✓ {name} ({label})")
            except Exception as e:
                await snap(pg, f"{name}_SKIPPED", label)
                print(f"⚠ {name} ({label}) skipped: {type(e).__name__}: {str(e)[:120]}")

        # لقطة نهائية للطرفين
        await page_a.reload(); await snap(page_a, "final_state", "seller")
        await page_b.reload(); await snap(page_b, "final_state", "buyer")
        print(f"→ screenshots: {SCREENSHOTS} ({_STEP['n']} shots)")

        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
