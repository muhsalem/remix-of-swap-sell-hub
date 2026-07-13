"""
E2E — المسار السعيد الكامل للمقايضة الثنائية مع الشحن والضمان.
لا يشمل: سيناريو النزاع، ولا المقايضة الثلاثية.

التشغيل:
    python3 tests/e2e/barter-flow.spec.py
"""
import asyncio
import re
import json
import os
import time
import uuid
from pathlib import Path

import requests
from playwright.async_api import async_playwright, Page, BrowserContext

BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:8080")
SUPABASE_URL = os.environ["SUPABASE_URL"]
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

SCREENSHOTS = Path("/tmp/browser/barter")
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

SUFFIX = uuid.uuid4().hex[:6]
USER_A = {"email": f"seller_{SUFFIX}@e2e.test", "password": "TestPass!234", "name": "بائع E2E"}
USER_B = {"email": f"buyer_{SUFFIX}@e2e.test",  "password": "TestPass!234", "name": "مشتري E2E"}


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
    await page.locator("input[type=email]").fill(email)
    await page.locator("input[type=password]").fill(password)
    await page.get_by_role("button", name="تسجيل الدخول").click()
    await page.wait_for_url(lambda u: "/auth" not in u, timeout=15_000)
    await page.screenshot(path=str(SCREENSHOTS / f"01_signin_{label}.png"))


async def send_offer(page: Page, listing_id: str):
    await page.goto(f"{BASE_URL}/offer/{listing_id}", wait_until="domcontentloaded")
    # select buyer's own listing (first card)
    await page.locator("h2:has-text('اختر عرضك') ~ div button").first.click()
    await page.locator("input[type=number]").first.fill("300")
    # accept consent checkbox
    await page.locator("input[type=checkbox]").last.check()
    await page.screenshot(path=str(SCREENSHOTS / "02_offer_form.png"))
    await page.get_by_role("button", name=re.compile("تأكيد وإرسال")).click()
    await page.wait_for_url("**/offers/**", timeout=15_000)


async def accept_offer(page: Page, offer_id: str):
    await page.goto(f"{BASE_URL}/offers/{offer_id}", wait_until="domcontentloaded")
    await page.get_by_role("button", name=re.compile(r"^\s*قبول\s*$")).click()
    await page.wait_for_selector("text=مراحل ما بعد القبول", timeout=15_000)
    await page.screenshot(path=str(SCREENSHOTS / "03_accepted.png"))


async def pay_platform_fee(page: Page):
    # buyer pays fee → escrow
    await page.get_by_role("checkbox", name=re.compile("الشروط")).check()
    await page.get_by_role("button", name=re.compile("^دفع")).click()
    await page.wait_for_selector("text=العمولة مدفوعة", timeout=15_000)
    await page.screenshot(path=str(SCREENSHOTS / "04_fee_paid.png"))


async def add_shipping(page: Page):
    await page.get_by_label("شركة الشحن").fill("SMSA")
    await page.get_by_label("رقم التتبع").fill(f"TRK{SUFFIX.upper()}")
    await page.get_by_role("button", name="حفظ بيانات الشحن").click()
    await page.wait_for_selector("text=تم حفظ الشحن", timeout=10_000)
    await page.screenshot(path=str(SCREENSHOTS / "05_shipping_added.png"))


async def confirm_delivery(page: Page, label: str):
    await page.get_by_role("button", name="تأكيد الاستلام").click()
    await page.wait_for_timeout(1500)
    await page.screenshot(path=str(SCREENSHOTS / f"06_delivery_{label}.png"))


# ---------- Main ----------

async def main():
    print(f"→ seeding users (suffix={SUFFIX})")
    a_id = create_user(**USER_A)
    b_id = create_user(**USER_B)
    listing_id = create_listing(a_id)
    create_listing(b_id, title_suffix=" (B)")  # buyer needs a listing to offer
    print(f"  A={a_id[:8]}  B={b_id[:8]}  listing={listing_id[:8]}")

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)

        # ---- Buyer (B) session ----
        ctx_b: BrowserContext = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page_b = await ctx_b.new_page()
        await sign_in(page_b, USER_B["email"], USER_B["password"], "buyer")
        await send_offer(page_b, listing_id)
        print("✓ offer sent")

        # ---- Seller (A) session ----
        ctx_a = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page_a = await ctx_a.new_page()
        await sign_in(page_a, USER_A["email"], USER_A["password"], "seller")
        await accept_offer(page_a)
        print("✓ offer accepted")

        # ---- Buyer pays escrow ----
        await page_b.reload()
        await pay_platform_fee(page_b)
        print("✓ platform fee paid (escrow locked)")

        # ---- Seller adds shipping ----
        await page_a.reload()
        await add_shipping(page_a)
        print("✓ shipping info added")

        # ---- Both confirm delivery ----
        await confirm_delivery(page_a, "seller")
        await page_b.reload()
        await confirm_delivery(page_b, "buyer")

        # ---- Final state ----
        await page_b.reload()
        content = await page_b.content()
        assert "completed" in content.lower() or "مكتمل" in content or "إكمال" in content, \
            "Expected trade to reach completed state"
        await page_b.screenshot(path=str(SCREENSHOTS / "07_completed.png"))
        print("✅ trade completed end-to-end")

        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
