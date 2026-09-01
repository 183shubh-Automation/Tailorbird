/**
 * columnResizeHelper.js
 *
 * Verifies that RevoGrid table column values (currency, numeric, date) do NOT
 * wrap onto a second line after the column is narrowed via the resize handle.
 *
 * Assertion strategy — three independent proofs of single-line rendering:
 *
 *   1. Range.getClientRects().length === 1
 *      The browser produces one DOMRect per rendered line for a text node.
 *      Single-line text always returns 1 rect; a wrapping value returns N rects.
 *      This is the gold-standard DOM-level proof and is zoom-safe.
 *
 *   2. inner div getBoundingClientRect().height ≤ lineHeight + 4px
 *      The content box for a single-line cell equals exactly one line-height.
 *      Multi-line content grows the inner div proportionally.
 *
 *   3. CSS white-space:nowrap / overflow:hidden on the inner content div
 *      Confirms the browser-level CSS rule that prevents line-breaking.
 *
 * Why NOT scrollHeight vs clientHeight:
 *   RevoGrid fixes every cell in a row to the same height (e.g. 116 px) so
 *   scrollHeight === clientHeight regardless of whether content wraps — useless.
 *
 * Usage:
 *   const { verifyColumnContentDoesNotWrap } = require('../utils/columnResizeHelper');
 *   await verifyColumnContentDoesNotWrap({ page, columnName: 'Budget Variance', dragByPx: 50 });
 */
require('dotenv').config();
const { expect } = require('@playwright/test');
const { Logger }  = require('./logger');

/**
 * Narrows a RevoGrid column by dragging its resize handle, asserts every visible
 * cell value stays on exactly one line, then restores the column to its original
 * width.
 *
 * @param {object} opts
 * @param {import('@playwright/test').Page} opts.page
 * @param {string}  opts.columnName       Exact text of the column header
 * @param {number}  [opts.dragByPx=50]    Viewport px to drag the handle leftward
 * @param {number}  [opts.minCellsToCheck=1]  Minimum cells that must be present
 * @returns {Promise<{columnName, widthStart, widthBefore, widthAfter, widthRestored, cellCount, cellsChecked}>}
 */
/**
 * Forces a revo-grid to a large width so it mounts every column instead of virtualizing
 * rightmost ones out of the DOM at narrower effective render widths. MCP-verified live
 * (2026-07-28): at a 1280px viewport the Properties table grid renders only 9 of its 14
 * columns — "Budget Variance" and everything after "Fund" is dropped entirely — while at
 * 1920px all 14 render, so this threshold shifts with viewport/font metrics exactly like
 * every other revo-grid in this app. Purely visual — does not change any data, selection,
 * or interaction behavior.
 */
async function forceGridFullWidth(page) {
    const grid = page.locator('revo-grid').first();
    if (await grid.count().catch(() => 0)) {
        await grid.evaluate((g) => {
            g.style.setProperty('width', '3000px', 'important');
            g.style.setProperty('min-width', '3000px', 'important');
        }).catch(() => {});
        await page.waitForTimeout(400);
    }
}

async function verifyColumnContentDoesNotWrap({ page, columnName, dragByPx = 50, minCellsToCheck = 1 }) {
    Logger.step(`[ColumnResize] "${columnName}" — verifying values stay single-line after narrowing`);

    // ── 1. Locate header ──────────────────────────────────────────────────────
    await forceGridFullWidth(page);
    const header = page.locator('[role="columnheader"]').filter({ hasText: columnName }).first();
    await header.waitFor({ state: 'visible', timeout: 15000 });
    await header.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    const colIndex = await header.getAttribute('aria-colindex');
    expect(colIndex, `"${columnName}" header must carry an aria-colindex`).toBeTruthy();

    const resizeHandle = header.locator('.resizable.resizable-r').first();
    await resizeHandle.waitFor({ state: 'attached', timeout: 8000 });

    // ── 2. Record the width at call time (viewport px — accounts for CSS zoom) ─
    const widthStart = await header.evaluate(el => Math.round(el.getBoundingClientRect().width));
    Logger.info(`[ColumnResize] "${columnName}" width at start: ${widthStart}px  (colIndex: ${colIndex})`);

    // ── 3. Pre-widen if the column is already narrow (e.g. left narrow by a prior run)
    let handleBox = await resizeHandle.boundingBox();
    if (widthStart < 80) {
        const expandBy = (80 - widthStart) + 30;
        Logger.info(`[ColumnResize] "${columnName}" is narrow (${widthStart}px) — pre-widening by ${expandBy}px`);
        await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(80);
        await page.mouse.move(handleBox.x + handleBox.width / 2 + expandBy, handleBox.y + handleBox.height / 2, { steps: 15 });
        await page.waitForTimeout(80);
        await page.mouse.up();
        await page.waitForTimeout(500);
        // Widening a column can push total column width past the grid's own visible width —
        // confirmed live via MCP browser this grid allows real horizontal overflow (unlike the
        // CapEx/Retainage grids, which drop columns instead), so the column/handle just dragged
        // can end up scrolled out of the currently-visible viewport. Re-scroll it back into view
        // before measuring again instead of assuming its position is unchanged — CI (headless
        // Linux) renders this column noticeably narrower to start with than local (different OS
        // font metrics), so it hits this pre-widen branch there when it doesn't locally.
        await header.scrollIntoViewIfNeeded().catch(() => {});
        handleBox = await resizeHandle.boundingBox();
        const widthExpanded = await header.evaluate(el => Math.round(el.getBoundingClientRect().width));
        Logger.info(`[ColumnResize] "${columnName}" pre-widen complete: ${widthStart}px → ${widthExpanded}px`);
    }

    const widthBefore = await header.evaluate(el => Math.round(el.getBoundingClientRect().width));
    Logger.info(`[ColumnResize] "${columnName}" width before narrowing: ${widthBefore}px`);

    // ── 4. Drag resize handle leftward to narrow ──────────────────────────────
    await header.scrollIntoViewIfNeeded().catch(() => {});
    handleBox = await resizeHandle.boundingBox();
    expect(handleBox, `Resize handle for "${columnName}" must have a bounding box`).toBeTruthy();

    const hcX = handleBox.x + handleBox.width / 2;
    const hcY = handleBox.y + handleBox.height / 2;

    await page.mouse.move(hcX, hcY);
    await page.mouse.down();
    await page.waitForTimeout(80);
    await page.mouse.move(hcX - dragByPx, hcY, { steps: 15 });
    await page.waitForTimeout(80);
    await page.mouse.up();
    await page.waitForTimeout(500);

    const widthAfter = await header.evaluate(el => Math.round(el.getBoundingClientRect().width));
    Logger.info(`[ColumnResize] "${columnName}" narrowed: ${widthBefore}px → ${widthAfter}px (delta: ${widthBefore - widthAfter}px)`);
    expect(
        widthAfter,
        `"${columnName}" column must become narrower after dragging resize handle ${dragByPx}px leftward`
    ).toBeLessThan(widthBefore);

    // ── 5. Assert every visible cell stays on a single line ───────────────────
    const cells     = page.locator(`[role="gridcell"][aria-colindex="${colIndex}"]`);
    const cellCount = await cells.count();
    Logger.info(`[ColumnResize] "${columnName}" — ${cellCount} cell(s) found, asserting each`);
    expect(cellCount, `At least ${minCellsToCheck} "${columnName}" cell(s) must be present`).toBeGreaterThanOrEqual(minCellsToCheck);

    let checkedCount = 0;

    for (let i = 0; i < cellCount; i++) {
        const cell = cells.nth(i);
        if (!(await cell.isVisible().catch(() => false))) continue;

        const r = await cell.evaluate((cellEl) => {
            // Walk to the first non-empty text node
            const walker   = document.createTreeWalker(cellEl, NodeFilter.SHOW_TEXT);
            const textNode = walker.nextNode();

            // Range.getClientRects — one rect per rendered line
            let rects = [];
            if (textNode && textNode.textContent.trim()) {
                const range = document.createRange();
                range.selectNode(textNode);
                rects = Array.from(range.getClientRects()).map(rc => ({
                    top: Math.round(rc.top), height: Math.round(rc.height), width: Math.round(rc.width)
                }));
            }
            const tops      = rects.map(rc => rc.top);
            const topSpread = tops.length > 1 ? Math.max(...tops) - Math.min(...tops) : 0;

            // Inner content div — holds the rendered value
            const inner      = cellEl.firstElementChild;
            const innerStyle = inner ? window.getComputedStyle(inner) : null;
            const innerBCR   = inner ? inner.getBoundingClientRect()  : null;

            return {
                text:           cellEl.innerText?.trim().substring(0, 30) || '(empty)',
                rangeLineCount: rects.length,
                topSpread,
                rects,
                innerHeight:    innerBCR  ? Math.round(innerBCR.height)       : null,
                lineHeight:     innerStyle ? parseFloat(innerStyle.lineHeight) : null,
                whiteSpace:     innerStyle?.whiteSpace ?? null,
                overflow:       innerStyle?.overflow   ?? null,
            };
        });

        Logger.info(
            `[ColumnResize] Cell[${i}] "${r.text}"` +
            `  rangeLines=${r.rangeLineCount}  topSpread=${r.topSpread}px` +
            `  innerH=${r.innerHeight}px  lineH=${r.lineHeight}px` +
            `  white-space:${r.whiteSpace}  overflow:${r.overflow}`
        );

        if (r.rangeLineCount === 0) continue; // empty cell — nothing to assert

        // Assertion 1 — Range.getClientRects: exactly 1 line fragment (gold standard)
        expect(
            r.rangeLineCount,
            `Cell[${i}] "${r.text}": Range.getClientRects() must be 1 (got ${r.rangeLineCount}) — ` +
            `text is rendering on ${r.rangeLineCount} line(s). Rects: ${JSON.stringify(r.rects)}`
        ).toBe(1);

        // Assertion 2 — all rect tops equal (same horizontal line)
        expect(
            r.topSpread,
            `Cell[${i}] "${r.text}": all Range rects must share the same top (got ${r.topSpread}px spread)`
        ).toBe(0);

        // Assertion 3 — inner div height ≈ 1 lineHeight (4px tolerance for zoom rounding)
        if (r.innerHeight !== null && r.lineHeight !== null) {
            expect(
                r.innerHeight,
                `Cell[${i}] "${r.text}": inner div height (${r.innerHeight}px) must be ≤ 1 lineHeight (${r.lineHeight}px) + 4px`
            ).toBeLessThanOrEqual(r.lineHeight + 4);
        }

        // Assertion 4 — CSS white-space:nowrap prevents line-breaking entirely
        if (r.whiteSpace !== null) {
            expect(
                r.whiteSpace,
                `Cell[${i}] "${r.text}": inner div white-space must be "nowrap" (got "${r.whiteSpace}")`
            ).toBe('nowrap');
        }

        // Assertion 5 — CSS overflow:hidden: content clips instead of expanding
        if (r.overflow !== null) {
            expect(
                r.overflow,
                `Cell[${i}] "${r.text}": inner div overflow must be "hidden" (got "${r.overflow}")`
            ).toBe('hidden');
        }

        checkedCount++;
    }

    Logger.success(`[ColumnResize] "${columnName}" ✓ — ${checkedCount}/${cellCount} cells verified single-line after narrowing`);

    // ── 6. Restore column to its original width ───────────────────────────────
    // widthStart was recorded before any pre-widen or narrowing.
    // Current width is widthAfter. Delta = widthStart − widthAfter.
    // All values are in viewport px (same coordinate space as mouse drag), so
    // dragging by exactly that delta restores the column.
    const restoreDelta = widthStart - widthAfter;
    Logger.info(
        `[ColumnResize] Restoring "${columnName}": ${widthAfter}px → target ${widthStart}px ` +
        `(drag ${restoreDelta >= 0 ? 'right' : 'left'} ${Math.abs(restoreDelta)}px)`
    );

    await header.scrollIntoViewIfNeeded().catch(() => {});
    handleBox = await resizeHandle.boundingBox();
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(80);
    await page.mouse.move(handleBox.x + handleBox.width / 2 + restoreDelta, handleBox.y + handleBox.height / 2, { steps: 15 });
    await page.waitForTimeout(80);
    await page.mouse.up();
    await page.waitForTimeout(500);

    let widthRestored = await header.evaluate(el => Math.round(el.getBoundingClientRect().width));
    Logger.info(`[ColumnResize] "${columnName}" restored to ${widthRestored}px (target ${widthStart}px, delta ${Math.abs(widthRestored - widthStart)}px)`);
    // MCP/test-run-verified (2026-07-28): a single mouse-drag can leave the width a few px off
    // target (sub-pixel rounding/snapping in the drag-to-width mapping) — observed live as an
    // 11px miss on one run, just outside the ±5px tolerance below. Nudge with the remaining
    // delta, up to 3 attempts, before the unchanged assertion — pure precision improvement,
    // never changes what is asserted or its tolerance.
    for (let correctAttempt = 0; correctAttempt < 3 && Math.abs(widthRestored - widthStart) > 5; correctAttempt++) {
        const correctiveDelta = widthStart - widthRestored;
        const correctiveHandleBox = await resizeHandle.boundingBox();
        await page.mouse.move(correctiveHandleBox.x + correctiveHandleBox.width / 2, correctiveHandleBox.y + correctiveHandleBox.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(80);
        await page.mouse.move(correctiveHandleBox.x + correctiveHandleBox.width / 2 + correctiveDelta, correctiveHandleBox.y + correctiveHandleBox.height / 2, { steps: 15 });
        await page.waitForTimeout(80);
        await page.mouse.up();
        await page.waitForTimeout(500);
        widthRestored = await header.evaluate(el => Math.round(el.getBoundingClientRect().width));
        Logger.info(`[ColumnResize] "${columnName}" corrective restore attempt ${correctAttempt + 1}: now ${widthRestored}px (target ${widthStart}px)`);
    }
    expect(
        Math.abs(widthRestored - widthStart),
        `"${columnName}" must be restored to ~${widthStart}px (±5px). Got ${widthRestored}px.`
    ).toBeLessThanOrEqual(5);

    return { columnName, widthStart, widthBefore, widthAfter, widthRestored, cellCount, cellsChecked: checkedCount };
}

module.exports = { verifyColumnContentDoesNotWrap, forceGridFullWidth };
