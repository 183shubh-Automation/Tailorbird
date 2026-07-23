const fs = require('fs');
const { Logger } = require('./logger');

/**
 * Captures the currently rendered Draw Reporting UI (Overview tab of a
 * selected property) into a plain, JSON-serialisable structure: tabs,
 * headings, buttons, and all visible text labels. Only captures elements that
 * actually exist in the DOM — it never invents entries for UI the current
 * feature does not render.
 *
 * Dynamic per-run values (e.g. the property name shown in the breadcrumb)
 * are excluded via `excludeTexts` so the resulting snapshot only reflects
 * static UI copy — labels, headings, and buttons that should stay stable
 * across runs regardless of which property was created.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string[]} [excludeTexts]
 * @returns {Promise<object>}
 */
async function captureDrawReportingUi(page, excludeTexts = []) {
    return page.evaluate((exclude) => {
        const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
        const isVisible = (el) => {
            const r = el.getBoundingClientRect();
            const cs = window.getComputedStyle(el);
            return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
        };
        const hasDirectText = (el) =>
            Array.from(el.childNodes).some((n) => n.nodeType === 3 && norm(n.textContent).length > 0);

        const tabs = Array.from(document.querySelectorAll('[role="tab"]'))
            .filter(isVisible)
            .map((el) => norm(el.textContent));

        const headings = Array.from(document.querySelectorAll('h1,h2,h3,[role="heading"]'))
            .filter(isVisible)
            .map((el) => norm(el.textContent))
            .filter(Boolean);

        const buttons = Array.from(document.querySelectorAll('button,[role="button"]'))
            .filter(isVisible)
            .map((el) => norm(el.textContent) || norm(el.getAttribute('aria-label')))
            .filter(Boolean);

        const textNodes = Array.from(document.querySelectorAll('main *'))
            .filter((el) => isVisible(el) && hasDirectText(el))
            .map((el) => norm(el.textContent))
            .filter(Boolean);

        const isDynamic = (text) => exclude.some((dynamicValue) => dynamicValue && text.includes(dynamicValue));

        return {
            tabs,
            headings: [...new Set(headings)].filter((t) => !isDynamic(t)),
            buttons: [...new Set(buttons)].filter((t) => !isDynamic(t)),
            textLabels: [...new Set(textNodes)].filter((t) => !isDynamic(t)).sort(),
        };
    }, excludeTexts);
}

/**
 * Compares a freshly captured UI snapshot against a committed baseline JSON
 * file. If the baseline does not exist yet, it is bootstrapped from the live
 * capture and the comparison is skipped for that run (mirrors this repo's
 * existing `committed_ui_snapshots` bootstrap-then-commit workflow for visual
 * regression). On every subsequent run the comparison is real.
 *
 * @param {object} params
 * @param {string} params.baselinePath absolute path to the committed baseline JSON
 * @param {object} params.liveSnapshot result of captureDrawReportingUi()
 * @param {import('@playwright/test').Expect<{}>} params.expect Playwright's expect
 */
function compareUiSnapshotToBaseline({ baselinePath, liveSnapshot, expect }) {
    if (!fs.existsSync(baselinePath)) {
        fs.writeFileSync(baselinePath, JSON.stringify(liveSnapshot, null, 2));
        Logger.info(`UI baseline did not exist — bootstrapped it at ${baselinePath}. Re-run for a real diff.`);
        return;
    }
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
    expect(liveSnapshot, 'Live Draw Reporting UI must match the committed baseline JSON exactly').toEqual(baseline);
}

module.exports = { captureDrawReportingUi, compareUiSnapshotToBaseline };
