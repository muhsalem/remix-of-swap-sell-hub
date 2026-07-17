"""
مساعد فحص وصولية (axe-core) داخل اختبارات Playwright.

يحقن axe-core من CDN، ثم يشغّل axe.run() مع مرشّح للقواعد المرتبطة بـ
ARIA و roles و aria-disabled و aria-live، ويرفع Assertion عند وجود
انتهاكات بمستوى serious أو critical.

الاستخدام:
    from _axe import run_axe
    violations = await run_axe(page, context_selector="[role=dialog]",
                               label="modal-idle")
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable

AXE_CDN = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js"

# القواعد التي نهتم بها لهذه الميزة تحديداً (aria-live / roles / aria-disabled).
# نتركها فارغة → نُشغّل كل قواعد axe الافتراضية، ثم نُصفّي النتائج بعد ذلك.
_INTERESTING_RULE_IDS = {
    "aria-allowed-attr",
    "aria-allowed-role",
    "aria-hidden-focus",
    "aria-required-attr",
    "aria-required-children",
    "aria-required-parent",
    "aria-roles",
    "aria-valid-attr",
    "aria-valid-attr-value",
    "aria-toggle-field-name",
    "aria-command-name",
    "aria-input-field-name",
    "aria-progressbar-name",
    "aria-tooltip-name",
    "aria-dialog-name",
    "button-name",
    "duplicate-id-aria",
    "role-img-alt",
    "presentation-role-conflict",
    # aria-live / status
    "aria-text",
    # aria-disabled — لا توجد قاعدة axe مباشرة، لكن presentation-role-conflict
    # و aria-allowed-attr تلتقط أشهر تضاربات "زر معطّل + aria-disabled".
}

_MIN_IMPACT_TO_FAIL = {"serious", "critical"}


async def _ensure_axe_injected(page) -> None:
    """يحقن axe-core مرة واحدة لكل صفحة."""
    has_axe = await page.evaluate("() => typeof window.axe !== 'undefined'")
    if not has_axe:
        await page.add_script_tag(url=AXE_CDN)
        await page.wait_for_function("() => typeof window.axe !== 'undefined'", timeout=15_000)


async def run_axe(
    page,
    *,
    context_selector: str | None = None,
    label: str,
    out_dir: Path | None = None,
    extra_rules: Iterable[str] = (),
) -> list[dict]:
    """
    يشغّل axe.run() على الصفحة (أو داخل عنصر محدد) ويعيد قائمة الانتهاكات
    ذات الأهمية serious/critical والمرتبطة بقواعد ARIA. يرفع AssertionError
    عند وجود أي انتهاك.
    """
    await _ensure_axe_injected(page)

    js = """
    async ({ selector }) => {
      const ctx = selector ? document.querySelector(selector) : document;
      if (selector && !ctx) return { error: 'context-not-found', selector };
      const results = await window.axe.run(ctx, {
        resultTypes: ['violations'],
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
      });
      return { violations: results.violations };
    }
    """
    result = await page.evaluate(js, {"selector": context_selector})
    if result.get("error"):
        raise AssertionError(f"axe: {result['error']} → {result.get('selector')!r}")

    violations = result.get("violations", []) or []
    relevant_rule_ids = _INTERESTING_RULE_IDS | set(extra_rules)
    filtered = [
        v for v in violations
        if v.get("id") in relevant_rule_ids
        and (v.get("impact") or "").lower() in _MIN_IMPACT_TO_FAIL
    ]

    # سجّل النتيجة الكاملة (للتحقيق) — حتى الانتهاكات غير المُصنّفة.
    if out_dir is not None:
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / f"axe-{label}.json").write_text(
            json.dumps(
                {"label": label, "context": context_selector,
                 "all_violations": violations, "filtered": filtered},
                ensure_ascii=False, indent=2,
            ),
            encoding="utf-8",
        )

    if filtered:
        summary = "\n".join(
            f"  · [{v.get('impact')}] {v.get('id')}: {v.get('help')} — "
            f"{len(v.get('nodes', []))} node(s); first target="
            f"{(v.get('nodes') or [{}])[0].get('target')}"
            for v in filtered
        )
        raise AssertionError(
            f"axe found {len(filtered)} a11y violation(s) in state {label!r}:\n{summary}"
        )

    return filtered
