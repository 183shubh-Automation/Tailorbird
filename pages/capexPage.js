const { expect } = require('@playwright/test');
const { capexLocators } = require('../locators/capexLocator');
const { Logger } = require('../utils/logger');

// Financial columns used for formula validation and data extraction
const FINANCIAL_COLS = [
    'Original Budget',
    'Budget Revision',
    'Current Budget',
    'Budget Remaining',
    'Original Contract Amount',
    'Approved Change Orders',
    'Current Contract Amount',
    'Remaining Contract Amount',
    'Invoiced Amount',
];

class CapexPage {
    constructor(page) {
        this.page = page;
        this.l = capexLocators(page);
    }

    // ─── Navigation ────────────────────────────────────────────────────────────

    async goto() {
        const base = process.env.BASE_URL || 'https://beta.tailorbird.com';
        await this.page.goto(`${base}/financials/capex`, { waitUntil: 'domcontentloaded' });
        await this.waitForShellReady();
    }

    async waitForShellReady() {
        await this.page.waitForLoadState('domcontentloaded');
        await expect(this.page.locator('main')).toBeVisible({ timeout: 15000 });
        await expect(this.l.columnHeaders.first()).toBeVisible({ timeout: 40000 });
        // Wait for financial rows to render (middle pane has 8–9 cells per row)
        await this.page.waitForFunction(
            () => {
                const rows = Array.from(document.querySelectorAll('[role="row"]'))
                    .filter(r => r.querySelectorAll('[role="gridcell"]').length >= 7);
                return rows.length > 1;
            },
            { timeout: 25000 }
        ).catch(() => { });
        await this.page.waitForTimeout(600);
    }

    // ─── Year selector ──────────────────────────────────────────────────────────

    async selectYear(year) {
        await this.l.yearSelect.click();
        await this.page.waitForTimeout(400);
        await this.page.locator(`[role="option"]:has-text("${year}")`).first().click();
        await this.page.waitForTimeout(1800);
        Logger.info(`Year changed to ${year}`);
    }

    async getSelectedYear() {
        return (await this.l.yearSelect.inputValue()).trim();
    }

    // ─── Tabs ───────────────────────────────────────────────────────────────────

    async clickTab(name) {
        const dimension = name.toLowerCase();
        const apiPromise = this.page.waitForResponse(
            resp => resp.url().includes('/api/bird-table') &&
                resp.url().includes(`dimension=${dimension}`) &&
                resp.status() >= 200 && resp.status() < 300,
            { timeout: 30000 }
        ).catch(() => null);
        await this.page.locator('.mantine-SegmentedControl-label').filter({ hasText: name }).click();
        await apiPromise;
        // GHA: revo-grid renders columns progressively — the tab-name column (index 0) appears
        // before the financial columns. Waiting for only 2 headers allows getColumnHeaders()
        // to be called before 'Original Budget' and other financial columns are in the DOM.
        // We wait for 'Original Budget' specifically as it is the first financial column and
        // its presence guarantees all earlier columns are rendered.
        await this.page.waitForFunction(
            (tabName) => {
                const headers = Array.from(document.querySelectorAll('[role="columnheader"]'));
                if (headers.length < 2) return false;
                if (headers[0].textContent.trim() !== tabName) return false;
                return headers.some(h => h.textContent.trim() === 'Original Budget');
            },
            name,
            { timeout: 20000 }
        ).catch(() => { });
        Logger.info(`Tab switched to: ${name}`);
    }

    async getActiveTabName() {
        return (await this.page.locator('.mantine-SegmentedControl-label[data-active="true"]')
            .textContent({ timeout: 5000 }).catch(() => '')).trim();
    }

    // ─── Portfolio filter ────────────────────────────────────────────────────────

    async openPortfolioFilter() {
        await this.l.portfolioFilterBtn.click();
        await this.page.waitForTimeout(700);
    }

    async closePortfolioFilter() {
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(800);
    }

    // Returns the locator scoped to the open portfolio dropdown container
    getPortfolioDropdown() {
        return this.page.locator('[class*="Combobox-dropdown"]')
            .filter({ has: this.page.locator('input[type="checkbox"]') })
            .last();
    }

    async getPortfolioFilterBtnText() {
        return (await this.l.portfolioFilterBtn.textContent()).trim();
    }

    // ─── KPI cards ──────────────────────────────────────────────────────────────

    async getKpiValues() {
        return await this.page.evaluate(() => {
            const paras = Array.from(document.querySelectorAll('p'));
            const findValue = (label) => {
                for (let i = 0; i < paras.length; i++) {
                    if (paras[i].textContent.trim() === label) {
                        for (let j = i + 1; j < Math.min(i + 6, paras.length); j++) {
                            const txt = (paras[j].textContent || '').trim();
                            if (txt && txt !== label) return txt;
                        }
                    }
                }
                return null;
            };
            return {
                properties: findValue('Properties'),
                remainingBudget: findValue('Remaining Budget'),
                currentCommitted: findValue('Current Committed'),
            };
        });
    }

    // ─── Grid helpers ────────────────────────────────────────────────────────────

    async getColumnHeaders() {
        const texts = await this.l.columnHeaders.allTextContents();
        return texts.map(t => t.trim()).filter(Boolean);
    }

    async getDataRowCount() {
        // Count middle-pane rows (8–9 cells) excluding Total row.
        // Threshold >= 7 covers both 8-cell (post-sort) and 9-cell (initial) renders.
        return await this.page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('[role="row"]'))
                .filter(r => r.querySelectorAll('[role="gridcell"]').length >= 7);
            return Math.max(0, rows.length - 1);
        });
    }

    async getFirstDataRowText() {
        const rows = this.l.gridRows;
        const count = await rows.count();
        if (count === 0) return '';
        return ((await rows.first().textContent()) || '').trim();
    }

    // Returns structured data for every row (including Total)
    async getAllGridRowData() {
        return await this.page.evaluate((cols) => {
            const allHeaderEls = Array.from(document.querySelectorAll('[role="columnheader"]'));
            const allHeaderTexts = allHeaderEls.map(h => (h.textContent || '').trim());
            const idxMap = {};
            cols.forEach(c => { idxMap[c] = allHeaderTexts.indexOf(c); });

            const parseMoney = (v) => {
                const s = String(v || '').trim();
                if (!s || s === '—') return null;
                const neg = s.startsWith('-');
                const n = parseFloat(s.replace(/[$,\-]/g, ''));
                return isNaN(n) ? null : (neg ? -n : n);
            };

            // Only use financial pane rows (9 cells). These are the unique per-row cells
            // that contain financial column values. Left/Actions panes are excluded.
            const rows = Array.from(document.querySelectorAll('[role="row"]'))
                .filter(r => r.querySelectorAll('[role="gridcell"]').length >= 7);

            return rows.map((row, idx) => {
                const cells = Array.from(row.querySelectorAll('[role="gridcell"]'))
                    .map(c => (c.textContent || '').trim());
                // Financial rows exclude the left-pane Property column, so shift by -1
                // relative to the full header index array.
                const shift = allHeaderTexts.length > cells.length ? -1 : 0;
                const isTotal = idx === rows.length - 1; // Total row is always last

                const data = { rowLabel: cells[0] || '', isTotal };
                cols.forEach(c => {
                    const effective = idxMap[c] + shift;
                    const raw = (effective >= 0 && effective < cells.length) ? cells[effective] : '';
                    data[c] = { raw, value: parseMoney(raw) };
                });
                return data;
            });
        }, FINANCIAL_COLS);
    }

    async getTotalRowValues() {
        return await this.page.evaluate((cols) => {
            const allHeaderEls = Array.from(document.querySelectorAll('[role="columnheader"]'));
            const allHeaderTexts = allHeaderEls.map(h => (h.textContent || '').trim());
            const idxMap = {};
            cols.forEach(c => { idxMap[c] = allHeaderTexts.indexOf(c); });

            const parseMoney = (v) => {
                const s = String(v || '').trim();
                if (!s || s === '—') return null;
                const n = parseFloat(s.replace(/[$,]/g, ''));
                return isNaN(n) ? null : n;
            };

            // Financial rows only (9 cells = full financial column set).
            // The Total row is always the last financial row.
            const financialRows = Array.from(document.querySelectorAll('[role="row"]'))
                .filter(r => r.querySelectorAll('[role="gridcell"]').length >= 7);

            if (!financialRows.length) return null;
            const totalRow = financialRows[financialRows.length - 1];
            const cells = Array.from(totalRow.querySelectorAll('[role="gridcell"]'))
                .map(c => (c.textContent || '').trim());

            const shift = allHeaderTexts.length > cells.length ? -1 : 0;
            const result = {};
            cols.forEach(c => {
                const effective = idxMap[c] + shift;
                const raw = (effective >= 0 && effective < cells.length) ? cells[effective] : '';
                result[c] = { raw, value: parseMoney(raw) };
            });
            return result;
        }, FINANCIAL_COLS);
    }

    parseMoney(value) {
        const s = String(value || '').trim();
        if (!s || s === '—') return NaN;
        const n = parseFloat(s.replace(/[$,]/g, ''));
        return isNaN(n) ? NaN : n;
    }

    // ─── Formula validation ──────────────────────────────────────────────────────

    async validateFormulas() {
        const rows = await this.getAllGridRowData();
        const errors = [];

        for (const row of rows) {
            if (row.isTotal) continue;

            const ob = row['Original Budget'].value;
            const br = row['Budget Revision'].value;
            const cb = row['Current Budget'].value;
            const rem = row['Budget Remaining'].value;
            const oc = row['Original Contract Amount'].value;
            const aco = row['Approved Change Orders'].value;
            const cc = row['Current Contract Amount'].value;
            const rc = row['Remaining Contract Amount'].value;
            const inv = row['Invoiced Amount'].value;

            if (ob !== null && br !== null && cb !== null && cb !== 0) {
                if (Math.abs(cb - (ob + br)) > 0.11) {
                    errors.push({ row: row.rowLabel, formula: 'CB=OB+BR', expected: ob + br, got: cb });
                }
            }
            if (oc !== null && aco !== null && cc !== null && cc !== 0) {
                if (Math.abs(cc - (oc + aco)) > 0.11) {
                    errors.push({ row: row.rowLabel, formula: 'CC=OC+ACO', expected: oc + aco, got: cc });
                }
            }
            if (cb !== null && cc !== null && rem !== null && rem !== 0) {
                if (Math.abs(rem - (cb - cc)) > 0.11) {
                    errors.push({ row: row.rowLabel, formula: 'Rem=CB-CC', expected: cb - cc, got: rem });
                }
            }
            if (cc !== null && inv !== null && rc !== null && rc !== 0) {
                if (Math.abs(rc - (cc - inv)) > 0.11) {
                    errors.push({ row: row.rowLabel, formula: 'RC=CC-Inv', expected: cc - inv, got: rc });
                }
            }
        }
        return errors;
    }

    // ─── Search ──────────────────────────────────────────────────────────────────

    async search(term) {
        await this.l.searchInput.waitFor({ state: 'visible', timeout: 30000 });
        await this.l.searchInput.fill(term);
        await this.page.waitForTimeout(1100);
    }

    async clearSearch() {
        await this.l.searchInput.fill('');
        await this.page.waitForTimeout(1000);
    }

    // ─── Sort ────────────────────────────────────────────────────────────────────

    async clickColumnHeader(headerLocator) {
        await headerLocator.click();
        // Sort triggers a grid re-render; wait for middle-pane rows (7+ cells) to reappear.
        await this.page.waitForFunction(
            () => Array.from(document.querySelectorAll('[role="row"]'))
                .filter(r => r.querySelectorAll('[role="gridcell"]').length >= 7).length > 0,
            { timeout: 6000 }
        ).catch(() => { });
        await this.page.waitForTimeout(400);
    }

    // ─── Tree expand / collapse ──────────────────────────────────────────────────

    async expandRow(index) {
        const btns = this.l.treeExpandBtns;
        if ((await btns.count()) <= index) return false;
        await btns.nth(index).click();
        await this.page.waitForTimeout(800);
        return true;
    }

    async expandToLeafRow() {
        // Expand first top-level row
        await this.expandRow(0);
        // Expand the first child row that appears
        const afterFirst = await this.l.treeExpandBtns.count();
        if (afterFirst > 1) {
            await this.expandRow(1);
        }
        await this.page.waitForTimeout(400);
    }

    // ─── View (save view) ────────────────────────────────────────────────────────

    async openViewPopover() {
        await this.l.viewBtn.click();
        await this.page.waitForTimeout(500);
    }

    async closeViewPopover() {
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(400);
    }

    // ─── Manage Columns ──────────────────────────────────────────────────────────

    async openManageColumnsDrawer() {
        await this.l.tableBtn.click();
        await this.page.waitForTimeout(400);
        // Use button-specific locator to avoid matching multiple elements
        const hideShowBtn = this.page.locator('button').filter({ hasText: 'Hide / show columns' }).first();
        if (await hideShowBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await hideShowBtn.click();
        }
        // Wait for the Manage Columns dialog to actually appear
        await this.page.locator('[role="dialog"]').filter({ hasText: 'Manage Columns' }).first()
            .waitFor({ state: 'visible', timeout: 5000 }).catch(() => { });
        await this.page.waitForTimeout(400);
    }

    async closeManageColumnsDrawer() {
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(500);
    }

    async toggleColumnInDrawer(columnName) {
        const drawer = this.l.manageColumnsDrawer;
        const drawerVisible = await drawer.isVisible({ timeout: 4000 }).catch(() => false);
        if (!drawerVisible) return false;

        // Find the checkbox associated with this column name
        const item = drawer.locator(`label, [class*="Group"], [class*="item"]`).filter({ hasText: columnName }).first();
        const checkbox = item.locator('input[type="checkbox"]').first();

        if (!(await checkbox.isVisible({ timeout: 2000 }).catch(() => false))) return false;
        await checkbox.click();
        await this.page.waitForTimeout(600);
        return true;
    }

    // ─── Export ──────────────────────────────────────────────────────────────────

    async clickExport() {
        const [download] = await Promise.all([
            this.page.waitForEvent('download', { timeout: 12000 }),
            this.l.exportBtn.click(),
        ]);
        return download;
    }

    // ─── Budget Revision modal ───────────────────────────────────────────────────

    async openRevisionModal() {
        await this.expandToLeafRow();
        await this.page.waitForTimeout(400);

        const pencil = this.l.editPencilBtn;
        const visible = await pencil.isVisible({ timeout: 5000 }).catch(() => false);
        if (!visible) return false;

        await pencil.click();
        // Wait for the modal badge to confirm the drawer is fully rendered.
        await this.l.revisionDraftBadge.waitFor({ state: 'visible', timeout: 8000 }).catch(() => { });
        await this.page.waitForTimeout(300);
        return true;
    }

    async isRevisionModalOpen() {
        return await this.page.locator('[role="dialog"]').isVisible().catch(() => false);
    }

    async closeRevisionModal() {
        // Escape is intercepted when a search input inside the modal has focus.
        // Click the X close button directly instead.
        await this.page.evaluate(() => {
            const dialog = document.querySelector('[role="dialog"]');
            if (!dialog) return;
            const btns = Array.from(dialog.querySelectorAll('button'));
            const closeBtn = btns.find(b => !b.textContent.trim() && (b.querySelector('img') || b.querySelector('svg')));
            if (closeBtn) closeBtn.click();
        });
        await this.page.waitForTimeout(800);
        await this.page.locator('[role="dialog"]').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => { });
        await this.page.waitForTimeout(400);
    }

    async getRevisionModalKpiValues() {
        return await this.page.evaluate(() => {
            const paras = Array.from(document.querySelectorAll('p'));
            const LABELS = [
                'Original Total', 'Current Budget Total', 'Total Increase',
                'Total Decrease', 'Total Reallocated', 'Adjusted Total', 'Net Change',
            ];
            const findValue = (label) => {
                for (let i = 0; i < paras.length; i++) {
                    if (paras[i].textContent.trim() === label) {
                        for (let j = i + 1; j < Math.min(i + 5, paras.length); j++) {
                            const txt = (paras[j].textContent || '').trim();
                            if (txt && txt !== label) return txt;
                        }
                    }
                }
                return null;
            };
            const result = {};
            LABELS.forEach(l => { result[l] = findValue(l); });
            return result;
        });
    }

    async getRevisionModalColumnHeaders() {
        return await this.page.evaluate(() => {
            const headers = Array.from(document.querySelectorAll('[role="columnheader"]'));
            return headers.map(h => (h.textContent || '').trim()).filter(Boolean);
        });
    }

    // ─── Color inspection ────────────────────────────────────────────────────────

    async getBudgetRemainingCellColors() {
        return await this.page.evaluate(() => {
            const allHeaders = Array.from(document.querySelectorAll('[role="columnheader"]'));
            const allTexts = allHeaders.map(h => (h.textContent || '').trim());
            const brIdx = allTexts.indexOf('Budget Remaining');
            if (brIdx < 0) return [];

            const rows = Array.from(document.querySelectorAll('[role="row"]'))
                .filter(r => r.querySelectorAll('[role="gridcell"]').length > 0);

            return rows.slice(0, 15).map(row => {
                const cells = Array.from(row.querySelectorAll('[role="gridcell"]'));
                // Consistent shift logic: financial rows omit Property+Actions panes
                const shift = allTexts.length > cells.length ? -1 : 0;
                const idx = brIdx + shift;
                const cell = cells[idx];
                if (!cell) return null;
                const text = (cell.textContent || '').trim();
                // Color is applied to an inner div/span, fall back to the cell itself
                const colorEl = cell.querySelector('div, span') || cell;
                const color = window.getComputedStyle(colorEl).color;
                return { text, color };
            }).filter(Boolean);
        });
    }

    // ─── Currency format check ────────────────────────────────────────────────────

    async getAllCurrencyCellValues() {
        return await this.page.evaluate(() => {
            const cells = Array.from(document.querySelectorAll('[role="gridcell"]'));
            return cells.slice(0, 200).map(c => (c.textContent || '').trim()).filter(Boolean);
        });
    }

    // ─── Horizontal scroll detection ─────────────────────────────────────────────

    async getGridScrollInfo() {
        return await this.page.evaluate(() => {
            const grid = document.querySelector('[role="treegrid"], [role="grid"]');
            if (!grid) return null;
            const scrollable = grid.querySelector('[style*="overflow"]') || grid;
            return {
                scrollWidth: scrollable.scrollWidth,
                clientWidth: scrollable.clientWidth,
                isScrollable: scrollable.scrollWidth > scrollable.clientWidth + 5,
            };
        });
    }

    // ─── Column order check ───────────────────────────────────────────────────────

    async getColumnOrder() {
        return await this.page.evaluate(() => {
            return Array.from(document.querySelectorAll('[role="columnheader"]'))
                .map(h => (h.textContent || '').trim())
                .filter(Boolean);
        });
    }

    // ─── Composite helpers (used by consolidated test cases) ─────────────────────

    /** Returns ms taken to reload the page until column headers are visible. */
    async measureReloadTimeMs() {
        const t0 = Date.now();
        await this.page.reload({ waitUntil: 'domcontentloaded' });
        await this.page.waitForLoadState('domcontentloaded');
        await expect(this.page.locator('main')).toBeVisible({ timeout: 15000 });
        await expect(this.l.columnHeaders.first()).toBeVisible({ timeout: 20000 });
        return Date.now() - t0;
    }

    /**
     * Asserts all 3 tabs visible. Returns { tabsVisible: true, activeTab }.
     */
    async verifyTabBar() {
        await expect(this.l.tabProperties).toBeVisible({ timeout: 8000 });
        await expect(this.l.tabFund).toBeVisible({ timeout: 5000 });
        await expect(this.l.tabRegion).toBeVisible({ timeout: 5000 });
        const activeTab = await this.getActiveTabName();
        return { tabsVisible: true, activeTab };
    }

    /**
     * Checks all expected year options are present inside the open year dropdown.
     * Opens and closes the dropdown internally.
     */
    async verifyYearOptions(years) {
        await this.l.yearSelect.click();
        await this.page.waitForTimeout(600);
        const results = {};
        for (const yr of years) {
            results[yr] = await this.page.locator(`[role="option"]:has-text("${yr}")`).first()
                .isVisible({ timeout: 2000 }).catch(() => false);
        }
        await this.page.keyboard.press('Escape');
        return results;
    }

    /**
     * Deselects all properties via the master toggle.
     * Mantine Checkbox inputs have pointer-events:none — must click the Combobox option wrapper.
     */
    async deselectAllProperties() {
        await this.openPortfolioFilter();
        const dd = this.getPortfolioDropdown();
        const master = dd.locator('input[type="checkbox"]').first();
        if (await master.isChecked()) {
            await dd.locator('.mantine-Combobox-option').first().click();
        }
        await this.closePortfolioFilter();
        await this.page.waitForTimeout(1800);
    }

    /** Restores all properties by checking the master toggle. */
    async restoreAllProperties() {
        await this.openPortfolioFilter();
        const dd = this.getPortfolioDropdown();
        const master = dd.locator('input[type="checkbox"]').first();
        if (!(await master.isChecked())) {
            await dd.locator('.mantine-Combobox-option').first().click();
        }
        await this.closePortfolioFilter();
        // Wait until the grid has re-populated with multiple rows before returning.
        // Threshold > 10 distinguishes a fully-restored portfolio from an empty or partial state.
        await this.page.waitForFunction(
            () => Array.from(document.querySelectorAll('[role="row"]'))
                .filter(r => r.querySelectorAll('[role="gridcell"]').length >= 7).length > 10,
            { timeout: 12000 }
        ).catch(() => { });
        await this.page.waitForTimeout(600);
    }

    /** Unchecks the first individual property (index 1, skipping master). */
    // async deselectFirstProperty() {
    //     await this.openPortfolioFilter();
    //     const dd = this.getPortfolioDropdown();
    //     const options = dd.locator('.mantine-Combobox-option');
    //     if ((await options.count()) > 1) {
    //         await options.nth(1).click();
    //     }
    //     await this.closePortfolioFilter();
    //     await this.page.waitForTimeout(1800);


    // }

    async deselectFirstProperty() {
        await this.openPortfolioFilter();
        const dd = this.getPortfolioDropdown();
        const options = dd.locator('.mantine-Combobox-option');

        const responsePromise = this.page.waitForResponse(response =>
            response.url().includes('/api/bird-table') &&
            response.url().includes('table_name=capex_tracker') &&
            response.request().method() === 'GET' &&
            response.status() === 200,
            { timeout: 30000 }
        );

        if ((await options.count()) > 1) {
            await options.nth(1).click();
        }

        await this.closePortfolioFilter();

        // Wait for API
        const response = await responsePromise;
        const body = await response.json();

        // Check property data
        const propertyRows = body.rows?.filter(row => row.level === 'property') ?? [];

        if (propertyRows.length === 0) {
            Logger.error('No property data found in bird-table API response.');
            throw new Error('No property data found in bird-table API response.');
        }

        Logger.success(`Property data loaded successfully. Found ${propertyRows.length} properties.`);
        await expect(this.l.searchInput).toBeVisible({ timeout: 10000 });
    }

    /** Re-checks the first individual property if it was unchecked. */
    async restoreFirstProperty() {
        await this.openPortfolioFilter();
        const dd = this.getPortfolioDropdown();
        const inputs = dd.locator('input[type="checkbox"]');
        const options = dd.locator('.mantine-Combobox-option');
        if ((await inputs.count()) > 1 && !(await inputs.nth(1).isChecked())) {
            await options.nth(1).click();
        }
        await this.closePortfolioFilter();
        // Wait for the grid to re-render with the restored property before returning
        await this.page.waitForFunction(
            () => Array.from(document.querySelectorAll('[role="row"]'))
                .filter(r => r.querySelectorAll('[role="gridcell"]').length >= 7).length > 1,
            { timeout: 12000 }
        ).catch(() => { });
        // GHA: the Properties KPI card updates asynchronously after the filter change.
        // Grid rows appear before the KPI re-renders, so we wait for a valid numeric
        // value to avoid reading null or a loading placeholder that parses to NaN.
        await this.page.waitForFunction(
            () => {
                const paras = Array.from(document.querySelectorAll('p'));
                for (let i = 0; i < paras.length; i++) {
                    if (paras[i].textContent.trim() === 'Properties') {
                        for (let j = i + 1; j < Math.min(i + 6, paras.length); j++) {
                            const txt = (paras[j].textContent || '').trim();
                            if (txt && txt !== 'Properties' && /^\d+$/.test(txt)) return true;
                        }
                    }
                }
                return false;
            },
            { timeout: 10000 }
        ).catch(() => { });
        await this.page.waitForTimeout(600);
    }

    /**
     * Switches to tabName, checks first column matches colPattern, checks expand buttons
     * and top-level row pencil count, then returns the raw numbers.
     * Leaves the browser on that tab.
     */
    async verifyTabGrouping(tabName, colPattern) {
        await this.clickTab(tabName);
        const activeTab = await this.getActiveTabName();
        const headers = await this.getColumnHeaders();
        const rowCount = await this.getDataRowCount();
        const expandBtns = await this.l.treeExpandBtns.count();
        const topRowPencils = await this.page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('[role="row"]'))
                .filter(r => r.querySelectorAll('[role="gridcell"]').length > 0);
            if (!rows.length) return 0;
            return rows[0].querySelectorAll('button.mantine-ActionIcon-root:not(.bird-table-search-btn)').length;
        });
        return { activeTab, firstCol: headers[0] || '', rowCount, expandBtns, topRowPencils };
    }

    /**
     * Opens the scope filter dropdown on the currently active tab and returns its state.
     * Closes the dropdown before returning.
     */
    async getDropdownInfo() {
        await this.openPortfolioFilter();
        const dd = this.getPortfolioDropdown();
        const cbs = dd.locator('input[type="checkbox"]');
        const optionCount = await cbs.count();
        const masterChecked = optionCount > 0 ? await cbs.first().isChecked() : false;
        const dropdownText = await dd.evaluate(el => el.textContent || '');
        await this.closePortfolioFilter();
        return { masterChecked, optionCount, dropdownText: dropdownText.trim().slice(0, 200) };
    }

    /**
     * Scans visible grid cells for an uncategorized "—" bucket entry.
     * Returns { found: boolean, rowCount: number }.
     */
    async verifyFundBucket() {
        const rowCount = await this.getDataRowCount();
        const gridText = await this.page.evaluate(() =>
            Array.from(document.querySelectorAll('[role="gridcell"]'))
                .map(c => (c.textContent || '').trim()).join('|')
        );
        const found = gridText.includes('—') || gridText.includes('--') || gridText.includes('Uncategorized');
        return { found, rowCount };
    }

    /**
     * Reads the Original Budget total from the current tab's Total row,
     * then compares across Properties, Fund, and Region tabs.
     * Returns { propOb, fundOb, regionOb, maxDiff }.
     * Ends on Properties tab.
     */
    async verifyCrossTabTotals() {
        const propTotal = await this.getTotalRowValues();
        const propOb = propTotal?.['Original Budget']?.value ?? null;

        await this.clickTab('Fund');
        const fundTotal = await this.getTotalRowValues();
        const fundOb = fundTotal?.['Original Budget']?.value ?? null;

        await this.clickTab('Region');
        const regionTotal = await this.getTotalRowValues();
        const regionOb = regionTotal?.['Original Budget']?.value ?? null;

        await this.clickTab('Properties');

        const diffs = [
            propOb !== null && fundOb !== null ? Math.abs(fundOb - propOb) : 0,
            propOb !== null && regionOb !== null ? Math.abs(regionOb - propOb) : 0,
        ];
        return { propOb, fundOb, regionOb, maxDiff: Math.max(...diffs) };
    }

    /**
     * Opens Manage Columns drawer, checks each column is visible as a paragraph
     * inside the Manage Columns dialog, then closes. Returns { col, visible }[].
     */
    async verifyManageColumns(cols) {
        await this.openManageColumnsDrawer();
        const dialog = this.page.locator('[role="dialog"]').filter({ hasText: 'Manage Columns' }).first();
        const results = [];
        for (const col of cols) {
            // Use evaluate to do exact text match (avoids Playwright regex hasText edge cases)
            const visible = await dialog.locator('p').evaluateAll(
                (els, c) => els.some(el => el.textContent.trim() === c), col
            ).catch(() => false);
            results.push({ col, visible });
        }
        await this.closeManageColumnsDrawer();
        return results;
    }

    /**
     * Clicks the column name paragraph inside the open Manage Columns dialog.
     * The paragraph is the click target for its parent toggle row.
     */
    async toggleColumn(columnName) {
        const dialog = this.page.locator('[role="dialog"]').filter({ hasText: 'Manage Columns' }).first();
        // Click the <p> whose trimmed text exactly matches the column name
        await dialog.locator('p').filter({ hasText: columnName }).first().click();
        await this.page.waitForTimeout(700);
    }

    /**
     * Clicks Export, waits for download, reads the file, and returns metadata.
     * Returns { filename, sizeBytes, headerLine, dataRowCount, content }.
     */
    async validateAndDownloadExport() {
        const fs = require('fs');
        const dl = await this.clickExport();
        const filename = dl.suggestedFilename();
        const dlPath = await dl.path();
        const content = dlPath ? fs.readFileSync(dlPath, 'utf-8') : '';
        const lines = content.split('\n').filter(l => l.trim());
        const headerLine = lines[0] || '';
        const dataRowCount = Math.max(0, lines.length - 1);
        const sizeBytes = dlPath ? fs.statSync(dlPath).size : 0;
        return { filename, sizeBytes, headerLine, dataRowCount, content };
    }

    /**
     * Fully validates the Budget Revision modal:
     *   - DRAFT badge visible
     *   - At least minKpis KPI card values populated
     *   - Budget + Documents tabs switchable without closing modal
     *   - Modal grid contains at least one of the expected column names
     *   - Save as Draft button is enabled
     * Returns { opened, draftBadge, kpiCount, tabsSwitched, saveEnabled }.
     */
    async verifyRevisionModal(minKpis = 4) {
        const opened = await this.openRevisionModal();
        if (!opened) return { opened: false };

        const draftBadge = await this.l.revisionDraftBadge.isVisible({ timeout: 5000 }).catch(() => false);
        const kpi = await this.getRevisionModalKpiValues();
        const kpiCount = Object.values(kpi).filter(v => v !== null).length;

        // Switch tabs
        await this.l.revisionTabDocuments.click();
        await this.page.waitForTimeout(700);
        const tabsSwitched = await this.isRevisionModalOpen();
        await this.l.revisionTabBudget.click();
        await this.page.waitForTimeout(400);

        const cols = await this.getRevisionModalColumnHeaders();
        const saveEnabled = await this.l.revisionSaveDraftBtn.isEnabled({ timeout: 3000 }).catch(() => false);

        // Test modal search
        if (await this.l.revisionSearchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await this.l.revisionSearchInput.fill('test');
            await this.page.waitForTimeout(400);
            await this.l.revisionSearchInput.fill('');
        }

        await this.closeRevisionModal();
        return { opened, draftBadge, kpiCount, tabsSwitched, cols, saveEnabled };
    }

    /**
     * Returns the number of pencil action buttons on the topmost visible grid row.
     * Used to assert no pencil on group-level / top-level rows.
     */
    async getTopRowPencilCount() {
        return await this.page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('[role="row"]'))
                .filter(r => r.querySelectorAll('[role="gridcell"]').length > 0);
            if (!rows.length) return 0;
            return rows[0].querySelectorAll('button.mantine-ActionIcon-root:not(.bird-table-search-btn)').length;
        });
    }

    /**
     * Returns a snapshot of the current tab's page state:
     * column headers, filter button text, KPI card values, row count, expand button count,
     * top-row pencil count.  Used by Fund / Region tab tests.
     */
    async getTabPageInfo() {
        const headers = await this.getColumnHeaders();
        const filterBtnText = await this.getPortfolioFilterBtnText();
        const kpi = await this.getKpiValues();
        const rowCount = await this.getDataRowCount();
        const expandBtns = await this.l.treeExpandBtns.count();
        const topRowPencils = await this.getTopRowPencilCount();
        return { headers, filterBtnText, kpi, rowCount, expandBtns, topRowPencils };
    }
    async unselectAllDefaultFinancialColumns() {
        await this.openManageColumnsDrawer();
        await expect(this._manageColumnsDialog()).toBeVisible({ timeout: 8000 });

        const checkedColumns = await this.getCheckedManageColumnNames();
        for (const col of checkedColumns) {
            await this.toggleColumn(col);
        }

        await this.closeManageColumnsDrawer();
        await this.page.waitForTimeout(800);
        return checkedColumns;
    }

    async selectAllDefaultFinancialColumns() {
        await this.openManageColumnsDrawer();
        await expect(this._manageColumnsDialog()).toBeVisible({ timeout: 8000 });

        const checkedColumns = await this.getCheckedManageColumnNames();
        const checkedSet = new Set(checkedColumns);

        const dialog = this._manageColumnsDialog();
        for (const col of FINANCIAL_COLS) {
            if (checkedSet.has(col)) continue;
            // Only toggle when the column toggle row exists to avoid hard failures on UI changes.
            const exists = await dialog.locator('p').filter({ hasText: col }).first()
                .isVisible({ timeout: 2000 }).catch(() => false);
            if (exists) {
                await this.toggleColumn(col);
            }
        }

        await this.closeManageColumnsDrawer();
        await this.page.waitForTimeout(800);
    }

    async getPropertyColumnValues() {
        const waitTimeoutMs = 20000;

        await this.page.waitForFunction(
            () => {
                if (document.querySelectorAll('button.tree-toggle').length > 0) return true;

                const viewport = document.querySelector('revogr-viewport-scroll.colPinStart');
                if (viewport) {
                    const dataPane = viewport.querySelector('revogr-data[col-type="colPinStart"][type="rgRow"]');
                    const row = dataPane?.querySelector('[role="row"][data-rgrow] button.tree-toggle');
                    if (row) return true;
                }

                const rows = Array.from(document.querySelectorAll('[role="row"]'));
                return rows.some((row) => {
                    const rect = row.getBoundingClientRect();
                    if (!rect || rect.width === 0 || rect.height === 0) return false;
                    const cells = row.querySelectorAll('[role="gridcell"]');
                    return cells.length === 1 && cells[0].textContent.trim();
                });
            },
            { timeout: waitTimeoutMs }
        ).catch(() => { });

        await this._resetPinnedPropertyPaneScroll();

        const allValues = [];
        const seen = new Set();
        let stableRounds = 0;

        for (let round = 0; round < 40 && stableRounds < 3; round++) {
            const batch = await this._readPropertyColumnFromDom();
            let added = 0;

            for (const value of batch) {
                if (seen.has(value)) continue;
                seen.add(value);
                allValues.push(value);
                added++;
            }

            stableRounds = added === 0 ? stableRounds + 1 : 0;
            const scrolled = await this._scrollPinnedPropertyPane();
            if (!scrolled) stableRounds++;
            await this.page.waitForTimeout(250);
        }

        await this._resetPinnedPropertyPaneScroll();

        if (allValues.length) return allValues;
        return this._readPropertyColumnFromDom();
    }

    async _resetPinnedPropertyPaneScroll() {
        await this.page.evaluate(() => {
            const viewport = document.querySelector('revogr-viewport-scroll.colPinStart');
            const scrollEl = viewport?.querySelector('.vertical-inner') || viewport;
            if (scrollEl) scrollEl.scrollTop = 0;
        });
    }

    _readPropertyColumnFromDom() {
        return this.page.evaluate(() => {
            const normalize = (value) => String(value || '').trim().replace(/^›\s*/, '').trim();
            const isPropertyName = (value) => {
                const name = normalize(value);
                return name && name !== '—' && !/^Total$/i.test(name) && !/^-?\$/.test(name);
            };
            const readCellPropertyLabel = (cell) => {
                const wrapper = cell.querySelector('.cell-wrapper');
                if (wrapper) {
                    const clone = wrapper.cloneNode(true);
                    clone.querySelectorAll('button.tree-toggle').forEach((btn) => btn.remove());
                    return normalize(clone.textContent);
                }
                return normalize(cell.textContent);
            };

            const readPinnedPropertyPane = () => {
                const viewport = document.querySelector('revogr-viewport-scroll.colPinStart');
                if (!viewport) return [];

                const dataPane = viewport.querySelector('revogr-data[col-type="colPinStart"][type="rgRow"]');
                if (!dataPane) return [];

                const rows = Array.from(dataPane.querySelectorAll('[role="row"][data-rgrow]'))
                    .filter((row) => row.querySelector('button.tree-toggle'))
                    .sort((a, b) => Number(a.getAttribute('data-rgrow')) - Number(b.getAttribute('data-rgrow')));

                const values = [];
                for (const row of rows) {
                    const cell = row.querySelector('[role="gridcell"][data-rgcol="0"], [role="gridcell"]');
                    if (!cell) continue;
                    const label = readCellPropertyLabel(cell);
                    if (isPropertyName(label)) values.push(label);
                }
                return values;
            };

            const readTreegridPropertyRows = () => {
                const values = [];
                const rows = document.querySelectorAll('[role="treegrid"] [role="row"]');
                for (const row of rows) {
                    if (!row.querySelector('button.tree-toggle')) continue;
                    const cell = row.querySelector('[role="gridcell"]');
                    if (!cell) continue;
                    const label = readCellPropertyLabel(cell);
                    if (isPropertyName(label)) values.push(label);
                }
                return values;
            };

            const pinnedValues = readPinnedPropertyPane();
            if (pinnedValues.length) return pinnedValues;

            const treegridValues = readTreegridPropertyRows();
            if (treegridValues.length) return treegridValues;

            const values = [];
            const seenValues = new Set();
            const addValue = (raw) => {
                const name = normalize(raw);
                if (!isPropertyName(name) || seenValues.has(name)) return;
                seenValues.add(name);
                values.push(name);
            };

            const visibleRows = Array.from(document.querySelectorAll('[role="row"]')).filter((row) => {
                const rect = row.getBoundingClientRect();
                return rect && rect.width > 0 && rect.height > 0;
            });

            for (const row of visibleRows) {
                const cells = Array.from(row.querySelectorAll('[role="gridcell"]'));
                if (cells.length === 1) addValue(cells[0].textContent);
            }

            if (values.length) return values;

            const seenIdxCounts = new Map();
            for (const row of visibleRows) {
                const cells = Array.from(row.querySelectorAll('[role="gridcell"]'))
                    .map((cell) => normalize(cell.textContent));
                const idx = cells.findIndex(isPropertyName);
                if (idx < 0) continue;
                seenIdxCounts.set(idx, (seenIdxCounts.get(idx) || 0) + 1);
            }

            let dominantIdx = -1;
            let max = -1;
            for (const [idx, count] of seenIdxCounts.entries()) {
                if (count > max) {
                    dominantIdx = idx;
                    max = count;
                }
            }

            if (dominantIdx < 0) return [];

            for (const row of visibleRows) {
                const cells = Array.from(row.querySelectorAll('[role="gridcell"]'))
                    .map((cell) => normalize(cell.textContent));
                addValue(cells[dominantIdx] || '');
            }

            return values;
        });
    }

    async _scrollPinnedPropertyPane(stepPx = 180) {
        return this.page.evaluate((px) => {
            const viewport = document.querySelector('revogr-viewport-scroll.colPinStart');
            const scrollEl = viewport?.querySelector('.vertical-inner') || viewport;
            if (!scrollEl) return false;
            const prev = scrollEl.scrollTop;
            scrollEl.scrollTop = Math.min(scrollEl.scrollTop + px, scrollEl.scrollHeight);
            return scrollEl.scrollTop > prev;
        }, stepPx);
    }

    async _resetPinnedPropertyPaneScroll() {
        await this.page.evaluate(() => {
            const viewport = document.querySelector('revogr-viewport-scroll.colPinStart');
            const scrollEl = viewport?.querySelector('.vertical-inner') || viewport;
            if (scrollEl) scrollEl.scrollTop = 0;
        });
    }


    /**
     * Clicks the column name paragraph inside the open Manage Columns dialog.
     * The paragraph is the click target for its parent toggle row.
     */
    async toggleColumn(columnName) {
        const dialog = this.page.locator('[role="dialog"]').filter({ hasText: 'Manage Columns' }).first();
        // Click the <p> whose trimmed text exactly matches the column name
        await dialog.locator('p').filter({ hasText: columnName }).first().click();
        await this.page.waitForTimeout(700);
    }

    _manageColumnsDialog() {
        return this.page.locator('[role="dialog"]').filter({ hasText: 'Manage Columns' }).first();
    }

    async getCheckedManageColumnNames() {
        const dialog = this._manageColumnsDialog();
        return await dialog.evaluate((el, cols) => {
            const checked = [];
            for (const col of cols) {
                const label = Array.from(el.querySelectorAll('p')).find((p) => p.textContent.trim() === col);
                if (!label) continue;
                let row = label.parentElement;
                while (row && row !== el) {
                    const checkbox = row.querySelector('input[type="checkbox"]');
                    if (checkbox) {
                        if (checkbox.checked) checked.push(col);
                        break;
                    }
                    row = row.parentElement;
                }
            }
            return checked;
        }, FINANCIAL_COLS);
    }


    /**
     * Returns the number of pencil action buttons on the topmost visible grid row.
     * Used to assert no pencil on group-level / top-level rows.
     */
    async getTopRowPencilCount() {
        return await this.page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('[role="row"]'))
                .filter(r => r.querySelectorAll('[role="gridcell"]').length > 0);
            if (!rows.length) return 0;
            return rows[0].querySelectorAll('button.mantine-ActionIcon-root:not(.bird-table-search-btn)').length;
        });
    }

    /**
     * Returns a snapshot of the current tab's page state:
     * column headers, filter button text, KPI card values, row count, expand button count,
     * top-row pencil count.  Used by Fund / Region tab tests.
     */
    async getTabPageInfo() {
        const headers = await this.getColumnHeaders();
        const filterBtnText = await this.getPortfolioFilterBtnText();
        const kpi = await this.getKpiValues();
        const rowCount = await this.getDataRowCount();
        const expandBtns = await this.l.treeExpandBtns.count();
        const topRowPencils = await this.getTopRowPencilCount();
        await this.page.waitForTimeout(4000);
        return { headers, filterBtnText, kpi, rowCount, expandBtns, topRowPencils };
    }

    async getUiPropertyCount() {
        const kpi = await this.getKpiValues();
        return parseInt(String(kpi.properties || '0').replace(/,/g, ''), 10);
    }

    async getExportRowCount() {
        const download = await this.clickExport();
        const downloadPath = await download.path();
        const content = downloadPath ? fs.readFileSync(downloadPath, 'utf-8') : '';
        const lines = content.split(/\r?\n/).filter((line) => line.trim());
        return Math.max(0, lines.length - 1);
    }

    async refreshCapexPage() {
        // App limitation: when ALL financial columns are hidden, REVO-GRID renders 0
        // data rows in the pinned property pane after a full page reload.
        // Work around it by enabling one column BEFORE reloading so the post-reload
        // grid state is always valid.  The caller's finally block restores all columns.
        await this.openManageColumnsDrawer().catch(() => { });
        const dialog = this._manageColumnsDialog();
        if (await dialog.isVisible({ timeout: 5000 }).catch(() => false)) {
            const checked = await this.getCheckedManageColumnNames().catch(() => []);
            if (checked.length === 0 && FINANCIAL_COLS.length > 0) {
                await this.toggleColumn(FINANCIAL_COLS[0]).catch(() => { });
            }
            await this.closeManageColumnsDrawer().catch(() => { });
            await this.page.waitForTimeout(600);
        } else {
            await this.closeManageColumnsDrawer().catch(() => { });
        }

        await this.page.reload({ waitUntil: 'domcontentloaded' });
        await this.waitForShellReady();
        await this.page.waitForFunction(
            () => document.querySelectorAll('button.tree-toggle').length > 0,
            { timeout: 30000 }
        ).catch(() => { });
        await this.page.waitForTimeout(1000);
    }

}

module.exports = { CapexPage };
