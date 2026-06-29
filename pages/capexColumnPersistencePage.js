const { expect } = require('@playwright/test');
const { capexColPersistenceLocators } = require('../locators/capexColumnPersistenceLocator');
const { Logger } = require('../utils/logger');

class CapexColumnPersistencePage {
    constructor(page) {
        this.page = page;
        this.l = capexColPersistenceLocators(page);
    }

    // ─── Navigation ────────────────────────────────────────────────────────────

    async goto() {
        const base = process.env.BASE_URL || 'https://beta.tailorbird.com';
        await this.page.goto(`${base}/financials/capex`, { waitUntil: 'domcontentloaded' });
        await this.waitForGridReady();
    }

    async waitForGridReady() {
        await this.page.waitForLoadState('domcontentloaded');
        await expect(this.page.locator('main')).toBeVisible({ timeout: 15000 });
        await expect(this.l.columnHeaders.first()).toBeVisible({ timeout: 40000 });
        await this.page.waitForFunction(
            () => {
                const rows = Array.from(document.querySelectorAll('[role="row"]'))
                    .filter(r => r.querySelectorAll('[role="gridcell"]').length >= 7);
                return rows.length > 1;
            },
            { timeout: 25000 }
        ).catch(() => {});
        await this.page.waitForTimeout(700);
    }

    async reloadAndWaitForGrid() {
        await this.page.reload({ waitUntil: 'domcontentloaded' });
        await this.waitForGridReady();
    }

    // ─── Manage Columns drawer ────────────────────────────────────────────────

    async openManageColumnsDrawer() {
        await this.l.tableToolbarBtn.click();
        await this.page.waitForTimeout(400);
        if (await this.l.hideShowColumnsMenuItem.isVisible({ timeout: 3000 }).catch(() => false)) {
            await this.l.hideShowColumnsMenuItem.click();
        }
        await this.l.manageColumnsDialog
            .waitFor({ state: 'visible', timeout: 5000 })
            .catch(() => {});
        await this.page.waitForTimeout(400);
    }

    async closeManageColumnsDrawer() {
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(500);
    }

    // Returns true if the column is currently checked (visible) in the drawer.
    // Drawer must already be open before calling this.
    // Uses JS evaluate to walk up from the <p> text to its sibling checkbox —
    // avoids the multi-level div ambiguity that causes locator().first() to pick
    // the wrong checkbox from an outer wrapper element.
    async isColumnCheckedInDrawer(columnName) {
        return this.page.evaluate((name) => {
            const dialog = document.querySelector('[role="dialog"]');
            if (!dialog) return false;
            const para = Array.from(dialog.querySelectorAll('p'))
                .find(p => p.textContent.trim() === name);
            if (!para) return false;
            // <p> is a direct child of the row div; the checkbox lives in a sibling wrapper.
            const rowDiv = para.parentElement;
            const cb = rowDiv ? rowDiv.querySelector('input[type="checkbox"]') : null;
            return cb ? cb.checked : false;
        }, columnName);
    }

    // Hides a column. Uses the grid header as ground truth for current state
    // (more reliable than reading the drawer checkbox which may hydrate slowly).
    // No-op if column is already hidden. Waits for header to vanish before returning.
    async hideColumn(columnName) {
        const visibleNow = await this.isColumnVisibleInGrid(columnName);
        if (!visibleNow) {
            Logger.info(`hideColumn: "${columnName}" was already hidden — no change`);
            return;
        }
        await this.openManageColumnsDrawer();
        const dialog = this.l.manageColumnsDialog;
        // Register before the click so we don't miss a fast response. Column visibility
        // is persisted via PUT /api/table-view-config. Without awaiting this, the method
        // can return before the server saves the change, leaving hidden state cross-session.
        const savePromise = this.page.waitForResponse(
            r => r.url().includes('/api/table-view-config') &&
                 r.request().method() === 'PUT' &&
                 r.status() >= 200 && r.status() < 300,
            { timeout: 10000 }
        ).catch(() => null);
        await dialog.locator('p').filter({ hasText: columnName }).first().click();
        await this.page.waitForTimeout(700);
        await this.closeManageColumnsDrawer();
        await savePromise;
        await this.l.columnHeaders.filter({ hasText: columnName }).first()
            .waitFor({ state: 'hidden', timeout: 6000 })
            .catch(() => {});
        await this.page.waitForTimeout(300);
        Logger.info(`hideColumn: "${columnName}" hidden`);
    }

    // Shows a column. Uses the grid header as ground truth for current state.
    // No-op if column is already visible. Waits for header to appear before returning.
    async showColumn(columnName) {
        const visibleNow = await this.isColumnVisibleInGrid(columnName);
        if (visibleNow) {
            Logger.info(`showColumn: "${columnName}" was already visible — no change`);
            return;
        }
        await this.openManageColumnsDrawer();
        const dialog = this.l.manageColumnsDialog;
        // Same PUT wait as hideColumn — ensures the restore is persisted server-side
        // before the method returns. Without this, TC301 S4 cleanup logs "shown" but the
        // server retains the hidden state, breaking TC287/TC288/TC291 in the next session.
        const savePromise = this.page.waitForResponse(
            r => r.url().includes('/api/table-view-config') &&
                 r.request().method() === 'PUT' &&
                 r.status() >= 200 && r.status() < 300,
            { timeout: 10000 }
        ).catch(() => null);
        await dialog.locator('p').filter({ hasText: columnName }).first().click();
        await this.page.waitForTimeout(700);
        await this.closeManageColumnsDrawer();
        await savePromise;
        await this.l.columnHeaders.filter({ hasText: columnName }).first()
            .waitFor({ state: 'visible', timeout: 6000 })
            .catch(() => {});
        await this.page.waitForTimeout(300);
        Logger.info(`showColumn: "${columnName}" shown`);
    }

    // ─── Column visibility in grid ────────────────────────────────────────────

    // Instant DOM query — safe to call right after showColumn/hideColumn which
    // already waited for the grid to update before returning.
    async isColumnVisibleInGrid(columnName) {
        return this.page.evaluate((name) => {
            return Array.from(document.querySelectorAll('[role="columnheader"]'))
                .some(h => h.textContent.trim() === name);
        }, columnName);
    }

    // ─── Sorting ──────────────────────────────────────────────────────────────

    /**
     * Clicks the .sort-btn inside a column header to cycle the sort state.
     * Hovers the header first so any hover-only button becomes clickable,
     * then uses JS click as reliable fallback for the internal button.
     *
     * GHA: the sort is persisted via PUT /api/table-view-config. If we return before
     * that request completes, a fast page.reload() will load the pre-save state and the
     * sort will appear as 'sort-off'. We register a waitForResponse BEFORE the click so
     * we catch the request even if it fires synchronously in the click handler.
     */
    async clickColumnSortButton(columnName) {
        const header = this.l.columnHeaders
            .filter({ has: this.page.getByText(columnName, { exact: true }) })
            .first();
        await header.hover().catch(() => {});
        await this.page.waitForTimeout(300);
        // Register before the click to avoid a race where the PUT fires before we set up the listener.
        const savePromise = this.page.waitForResponse(
            resp => resp.url().includes('/api/table-view-config') &&
                    resp.request().method() === 'PUT' &&
                    resp.status() >= 200 && resp.status() < 300,
            { timeout: 15000 }
        ).catch(() => null);
        // The .sort-btn lives inside .header-actions-panel which has pointer-events:none
        // at rest; hovering the header switches it to pointer-events:auto via React's
        // onMouseEnter handler. Click without force so Playwright waits for that state.
        const sortBtn = header.locator('.sort-btn').first();
        await sortBtn.click();
        await this.page.waitForFunction(
            () => Array.from(document.querySelectorAll('[role="row"]'))
                .filter(r => r.querySelectorAll('[role="gridcell"]').length >= 7).length > 0,
            { timeout: 6000 }
        ).catch(() => {});
        // Wait for server-side persistence before returning; without this, a fast reload
        // (TC301) will race the PUT and load the un-sorted config from the server.
        await savePromise;
        await this.page.waitForTimeout(300);
    }

    /**
     * Returns the sort state of a column header by reading the .sort-active-indicator
     * SVG path (the live DOM indicator used by this custom revo-grid header).
     * The .sort-indicator i class is decorative and never changes; only
     * .sort-active-indicator reflects current sort state.
     *
     * Returns 'sort-asc', 'sort-desc', or 'sort-off'.
     * Cycle: off → asc (chevron-up "m18 15...") → desc (chevron-down "m6 9...") → off.
     */
    async getColumnSortState(columnName) {
        return this.page.evaluate((name) => {
            const header = Array.from(document.querySelectorAll('[role="columnheader"]'))
                .find(h => h.textContent.trim() === name);
            if (!header) return null;
            const ind = header.querySelector('.sort-active-indicator');
            if (!ind) return 'sort-off';
            const path = ind.querySelector('path')?.getAttribute('d') || '';
            // chevron-up "m18 15-6-6-6 6" = ascending; chevron-down "m6 9 6 6 6-6" = descending
            return path.startsWith('m18') ? 'sort-asc' : 'sort-desc';
        }, columnName);
    }

    /**
     * Clears the sort on a column by clicking until state returns to 'sort-off'.
     * Guards against infinite loops — max 4 clicks.
     */
    async clearColumnSort(columnName) {
        for (let i = 0; i < 4; i++) {
            const state = await this.getColumnSortState(columnName);
            if (!state || state === 'sort-off' || state === 'none') break;
            await this.clickColumnSortButton(columnName);
        }
    }

    // ─── Column width ─────────────────────────────────────────────────────────

    /**
     * Returns the current pixel width of a column header as a number,
     * read from its inline style (revo-grid sets width via style attribute).
     * Returns null if header not found.
     */
    async getColumnWidthPx(columnName) {
        return this.page.evaluate((name) => {
            const header = Array.from(document.querySelectorAll('[role="columnheader"]'))
                .find(h => h.textContent.trim() === name);
            if (!header) return null;
            const styleWidth = parseInt(header.style.width, 10);
            if (!isNaN(styleWidth)) return styleWidth;
            return Math.round(header.getBoundingClientRect().width);
        }, columnName);
    }

    /**
     * Resizes a column by dragging its right-edge resize handle (class .resizable-r)
     * by deltaX pixels. Positive deltaX widens; negative narrows.
     * Uses page.mouse for real OS-level pointer events that revo-grid responds to.
     * Returns the new width after resize, or null if the header was not found.
     */
    async resizeColumn(columnName, deltaX) {
        const header = this.l.columnHeaders
            .filter({ has: this.page.getByText(columnName, { exact: true }) })
            .first();
        const box = await header.boundingBox();
        if (!box) {
            Logger.error(`resizeColumn: column "${columnName}" bounding box not found`);
            return null;
        }
        // The .resizable-r handle sits at the very right edge of the header (6 px wide).
        const resizerX = box.x + box.width - 3;
        const resizerY = box.y + box.height / 2;
        await this.page.mouse.move(resizerX, resizerY);
        await this.page.mouse.down();
        await this.page.mouse.move(resizerX + deltaX, resizerY, { steps: 8 });
        await this.page.mouse.up();
        // Wait for revo-grid to commit the resize and the API to save it
        await this.page.waitForTimeout(1200);
        return this.getColumnWidthPx(columnName);
    }

    // ─── Grouping observation ─────────────────────────────────────────────────

    /**
     * Checks whether any grouping UI control is present on the page.
     * (The API stores a 'grouping' field but the UI may not expose it.)
     * Returns true if a grouping control is found, false otherwise.
     */
    async hasGroupingUI() {
        const candidates = [
            this.page.locator('button').filter({ hasText: /group\s*by/i }).first(),
            this.page.locator('[aria-label*="group" i]').first(),
            this.page.locator('[data-testid*="group" i]').first(),
        ];
        for (const c of candidates) {
            if (await c.isVisible({ timeout: 800 }).catch(() => false)) return true;
        }
        return false;
    }

    // ─── State capture helpers ────────────────────────────────────────────────

    /**
     * Captures the sort state of all sortable column headers.
     * Returns { columnName: 'sort-asc' | 'sort-desc' | 'sort-off' }.
     */
    async getAllColumnSortStates() {
        return this.page.evaluate(() => {
            const headers = Array.from(document.querySelectorAll('[role="columnheader"]'));
            const result = {};
            for (const h of headers) {
                const name = h.textContent.trim();
                if (!name) continue;
                const ind = h.querySelector('.sort-active-indicator');
                if (!ind) { result[name] = 'sort-off'; continue; }
                const path = ind.querySelector('path')?.getAttribute('d') || '';
                result[name] = path.startsWith('m18') ? 'sort-asc' : 'sort-desc';
            }
            return result;
        });
    }

    /**
     * Returns the ordered list of visible column header names from the grid.
     */
    async getVisibleColumnOrder() {
        const texts = await this.l.columnHeaders.allTextContents();
        return texts.map(t => t.trim()).filter(Boolean);
    }
}

module.exports = { CapexColumnPersistencePage };
