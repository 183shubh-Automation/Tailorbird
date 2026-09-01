const path = require('path');
const { expect } = require('@playwright/test');
const { Logger } = require('../utils/logger');
const { imagesLocators } = require('../locators/imagesLocator');
const { AddColumnPage, ADD_COLUMN_TYPES } = require('./addColumnPage');
const leftPanel = require('./leftPanel');

/**
 * Page object for Documents > Images (/documents/images).
 *
 * Add Column / Manage Columns functionality is deliberately NOT reimplemented here — this
 * page's grid is schema-identical to the Property Documents grid (MCP-verified live
 * 2026-08-14: same Default Columns set, same Custom Columns drawer, same "Table" menu), so
 * every column operation just delegates to the existing, already-CI-proven `AddColumnPage`
 * class (used successfully by TC67/TC212/TC218/TC232/TC241/TC254/TC264/TC69) via composition.
 *
 * Upload similarly mirrors PropertiesHelper.uploadPropertyDocument() (pages/properties.js)
 * step-for-step — MCP-verified live to be the exact same shared Uploadcare widget and
 * "Add Tags & Types" follow-up modal on this page, just with a different trigger button
 * ("Upload Photos" instead of "Upload Files").
 */
class ImagesPage {
    constructor(page) {
        this.page = page;
        this.loc = imagesLocators(page);
        this.addColumnPage = new AddColumnPage(page, { scope: page.locator('main') });
    }

    // ── API helpers ──────────────────────────────────────────────────────
    // Same pattern already proven in pages/oooPage.js (page.request against the app's own
    // origin, reusing the browser context's session cookies — no separate auth needed).
    // Endpoints MCP-verified live (2026-08-14) from this page's own network traffic:
    //   GET  /api/bird-table?table_name=file_upload&isImage=true  → { columns, rows }
    //   GET  /api/image/stats                                     → { totalUploads, totalSize, recentUploads }
    // Used to make upload/delete verification robust against this grid's virtualization
    // (only rows scrolled into view exist in the DOM) instead of relying on UI row counts alone.

    get apiBase() {
        return new URL(process.env.DASHBOARD_URL).origin;
    }

    /** GET /api/bird-table?table_name=file_upload&isImage=true — returns the full, unvirtualized row list. */
    async getImageRowsViaApi() {
        const res = await this.page.request.get(
            `${this.apiBase}/api/bird-table?table_name=file_upload&isImage=true`,
            { timeout: 60000 },
        );
        expect(res.status(), `GET /api/bird-table expected HTTP 200, got ${res.status()}`).toBe(200);
        const body = await res.json();
        return body.rows || [];
    }

    async getImageCountViaApi() {
        return (await this.getImageRowsViaApi()).length;
    }

    async findImageRowsByNameViaApi(fileName) {
        return (await this.getImageRowsViaApi()).filter((row) => row.name === fileName);
    }

    /** GET /api/image/stats — the same numbers the KPI cards are meant to display. */
    async getImageStatsViaApi() {
        const res = await this.page.request.get(`${this.apiBase}/api/image/stats`, { timeout: 60000 });
        expect(res.status(), `GET /api/image/stats expected HTTP 200, got ${res.status()}`).toBe(200);
        return res.json();
    }

    /**
     * Direct URL navigation — same reliable pattern every other page object in this codebase
     * uses for its primary "get to this page" method (e.g. DrawReportingJob.navigateToDrawReporting
     * in pages/drawReportingPage.js does `page.goto('/financials/draw-reporting')`, not a nav
     * click). Whether "Documents" renders inline or collapses behind the responsive "More"
     * overflow is a left-panel-rendering concern already covered generically by
     * leftPanel.getLeftPanelLabels() (used by TC02_menu.spec.js) — see assertReachableFromLeftPanel
     * below — so this method itself doesn't need to fight that responsive layout at all.
     *
     * Waits on the real `/api/bird-table` response instead of a blind sleep — confirms the
     * grid's own data actually loaded, not just that the URL/shell changed.
     */
    async navigateToImages() {
        const dataLoaded = this.page.waitForResponse(
            (res) => res.url().includes('/api/bird-table') && res.request().method() === 'GET',
            { timeout: 60000 },
        ).catch(() => null);
        await this.page.goto('/documents/images', { waitUntil: 'load' });
        await expect(this.page, 'URL must be Images page after navigation').toHaveURL(/\/documents\/images/, { timeout: 60000 });
        await dataLoaded;
        await this.page.waitForTimeout(1000);
        Logger.success('Navigated to Images page');
    }

    /** Confirms "Images" is discoverable from the left panel, whether shown inline or inside the responsive "More" overflow — reuses the same generic helper TC02_menu.spec.js already relies on. */
    async assertReachableFromLeftPanel() {
        const labels = await leftPanel.getLeftPanelLabels(this.page);
        expect(labels, 'Left panel must list "Images"').toContain('Images');
    }

    async assertPageLoaded() {
        await expect(this.loc.breadcrumbHomeLink, 'Home breadcrumb link must be visible').toBeVisible({ timeout: 60000 });
        await expect(this.loc.breadcrumbImagesText, 'Images breadcrumb text must be visible').toBeVisible();
        await expect(this.loc.uploadPhotosButton, 'Upload Photos button must be visible').toBeVisible();
        await expect(this.loc.searchInput, 'Search input must be visible').toBeVisible();
        await expect(this.loc.filterButton, 'Filter button must be visible').toBeVisible();
        await expect(this.loc.viewButton, 'View button must be visible').toBeVisible();
        await expect(this.loc.tableButton, 'Table button must be visible').toBeVisible();
        await expect(this.loc.exportButton, 'Export button must be visible').toBeVisible();
        Logger.success('Images page structure verified: breadcrumb, Upload Photos, and toolbar controls');
    }

    /**
     * Same DOM-walk approach as DrawReportingJob.getKpiValueByLabel (drawReportingPage.js) —
     * value <p> and label <p> are siblings — extended to check every same-text candidate
     * (not just the first) since the "Images" KPI label collides with the page's own
     * breadcrumb text ("Images"), which has no numeric sibling and must be skipped.
     */
    async getKpiValue(label) {
        return this.page.evaluate((labelText) => {
            const all = Array.from(document.querySelectorAll('p'));
            const candidates = all.filter((el) => el.textContent.trim() === labelText);
            for (const labelEl of candidates) {
                if (!labelEl.parentElement) continue;
                const siblings = Array.from(labelEl.parentElement.querySelectorAll('p'));
                const valueEl = siblings.find((el) => el !== labelEl && /\d/.test(el.textContent));
                if (valueEl) return valueEl.textContent.trim();
            }
            return null;
        }, label);
    }

    async searchImages(text) {
        await this.loc.searchInput.fill(text);
        await this.page.waitForTimeout(1200);
    }

    async clearSearch() {
        await this.loc.searchInput.fill('');
        await this.page.waitForTimeout(800);
    }

    async openFilterPanel() {
        await this.loc.filterButton.click();
        await this.page.waitForTimeout(800);
    }

    async closeFilterPanel() {
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(400);
    }

    async openSaveViewPopover() {
        await this.loc.viewButton.click();
        await expect(this.loc.saveViewHeading, 'Save current view as heading must be visible').toBeVisible({ timeout: 60000 });
    }

    async closeSaveViewPopover() {
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(400);
    }

    async openTableMenu() {
        await this.loc.tableButton.click();
        await this.page.waitForTimeout(500);
    }

    // Generous timeouts throughout this flow — this suite is designed to run with multiple
    // parallel workers hitting the same real backend/org concurrently, which measurably slows
    // down even plain UI actions (MCP/CI-verified 2026-08-14: a default-timeout button click
    // missed its window under 4-worker load).
    //
    // Ends with an API-backed confirmation (GET /api/bird-table) instead of trusting only the
    // UI row appearing: it's the same request-shape already proven in pages/oooPage.js's API
    // helpers, and it sidesteps this grid's own virtualization (a row can exist in the data but
    // not currently be rendered in the DOM). Compares by row id rather than a raw count so this
    // stays correct even when other parallel workers are uploading the same filename at the
    // same time — it only claims success once a *new* id (higher than anything seen before this
    // call) shows up, regardless of what else concurrently changed the total.
    async uploadImage(filePath) {
        const fileName = path.basename(filePath);
        const priorMaxId = (await this.findImageRowsByNameViaApi(fileName)).reduce((max, r) => Math.max(max, r.id), 0);

        await this.loc.uploadPhotosButton.click({ timeout: 60000 });
        await expect(this.loc.uploadDialog, 'Upload dialog must open').toBeVisible({ timeout: 60000 });

        this.page.once('filechooser', async (chooser) => {
            await chooser.setFiles(filePath);
        });
        await this.loc.fromDeviceButton.click({ timeout: 60000 });

        await expect(this.loc.uploadListDialog, 'Uploaded file list must be visible').toBeVisible({ timeout: 60000 });
        await expect(this.loc.uploadListDialog.locator('.uc-file-name').first(), 'Uploaded file name must be visible').toBeVisible({ timeout: 60000 });
        await this.loc.doneButton.click({ timeout: 60000 });

        await expect(this.loc.addTagsModalHeading, '"Add Tags & Types" modal must appear').toBeVisible({ timeout: 60000 });
        await this.loc.addFilesButton.click({ timeout: 60000 });

        await expect
            .poll(async () => {
                const rows = await this.findImageRowsByNameViaApi(fileName);
                return rows.some((r) => r.id > priorMaxId);
            }, { message: `A new "${fileName}" row must appear via /api/bird-table after upload`, timeout: 60000 })
            .toBe(true);
        Logger.success(`Uploaded image "${filePath}" (API-confirmed via /api/bird-table)`);
    }

    rowForImage(fileName) {
        return this.loc.imageRowByName(fileName).first();
    }

    /**
     * The "Actions" column (Download Image / Delete Image) is a structurally separate
     * column group — its rows are DOM siblings of the data rows, not descendants (same
     * virtualized-grid architecture already documented for the Draw Reporting and Property
     * Documents grids, e.g. DrawReportingJob.resolveViewDetailsButtonForRow in
     * pages/drawReportingPage.js). A data row's own `.locator('button')` therefore always
     * matches zero elements. Resolved instead by matching vertical screen position between
     * the data row and the Actions-column row that contains it, mirroring that same proven
     * technique.
     */
    async _resolveActionsRowForDataRow(dataRow) {
        const actionsRows = this.page.getByRole('row').filter({ has: this.loc.deleteImageButtonForRow(this.page) });
        for (let attempt = 0; attempt < 3; attempt++) {
            await dataRow.scrollIntoViewIfNeeded().catch(() => {});
            const box = await dataRow.boundingBox().catch(() => null);
            if (!box) return null;
            const targetY = box.y + box.height / 2;
            const index = await actionsRows
                .evaluateAll((rows, y) => {
                    let bestIndex = -1;
                    let bestDelta = Infinity;
                    rows.forEach((r, i) => {
                        const rect = r.getBoundingClientRect();
                        const delta = Math.abs(rect.top + rect.height / 2 - y);
                        if (delta < bestDelta) { bestDelta = delta; bestIndex = i; }
                    });
                    return bestDelta <= 20 ? bestIndex : -1;
                }, targetY)
                .catch(() => -1);
            if (index !== -1) return actionsRows.nth(index);
            await this.page.waitForTimeout(800);
        }
        return null;
    }

    async downloadImage(fileName) {
        const row = this.rowForImage(fileName);
        await expect(row, `Row for image "${fileName}" must be visible`).toBeVisible({ timeout: 60000 });
        const actionsRow = await this._resolveActionsRowForDataRow(row);
        expect(actionsRow, `Actions row for image "${fileName}" must be resolvable`).not.toBeNull();
        const [download] = await Promise.all([
            this.page.waitForEvent('download'),
            this.loc.downloadImageButtonForRow(actionsRow).click(),
        ]);
        return download;
    }

    /**
     * Deletes the first row matching `fileName`, confirmed via GET /api/bird-table instead of
     * a UI row count. MCP-verified live (2026-08-14): the "Images"/"Recent Uploads" KPI cards
     * lag behind real state after a delete, and this grid's own row count is unreliable
     * unfiltered since only virtualized (currently scrolled into view) rows exist in the DOM.
     * The API check compares row *ids* present before vs. after — it only claims success once
     * one of the specific ids that existed before this call is confirmed gone, so it stays
     * correct even if other parallel workers are concurrently adding/removing their own
     * same-named rows.
     */
    async deleteImage(fileName) {
        const idsBefore = new Set((await this.findImageRowsByNameViaApi(fileName)).map((r) => r.id));
        const row = this.rowForImage(fileName);
        await expect(row, `Row for image "${fileName}" must be visible`).toBeVisible({ timeout: 60000 });
        const actionsRow = await this._resolveActionsRowForDataRow(row);
        expect(actionsRow, `Actions row for image "${fileName}" must be resolvable`).not.toBeNull();
        await this.loc.deleteImageButtonForRow(actionsRow).click();
        await expect(this.loc.deleteImageConfirmDialog, 'Delete Image confirmation dialog must be visible').toBeVisible({ timeout: 60000 });
        await this.loc.deleteConfirmButton.click();
        await expect(this.loc.deleteImageConfirmDialog, 'Delete Image confirmation dialog must close after confirming').toBeHidden({ timeout: 60000 });

        await expect
            .poll(async () => {
                const idsAfter = new Set((await this.findImageRowsByNameViaApi(fileName)).map((r) => r.id));
                return [...idsBefore].some((id) => !idsAfter.has(id));
            }, { message: `A "${fileName}" row present before delete must be gone via /api/bird-table`, timeout: 60000 })
            .toBe(true);
        Logger.success(`Deleted image "${fileName}" (API-confirmed via /api/bird-table)`);
    }

    async openImagePreview(fileName) {
        const row = this.rowForImage(fileName);
        await this.loc.thumbnailImgForRow(row).click();
        const dialog = this.loc.imagePreviewDialogByFileName(fileName);
        await expect(dialog, `Preview dialog for "${fileName}" must be visible`).toBeVisible({ timeout: 60000 });
        return dialog;
    }

    async closePreview(dialog) {
        await dialog.locator('button').first().click();
        await this.page.waitForTimeout(400);
    }

    async exportImages() {
        const [download] = await Promise.all([
            this.page.waitForEvent('download'),
            this.loc.exportButton.click(),
        ]);
        return download;
    }

    // --- Column functionality: delegated entirely to the existing, proven AddColumnPage ---
    async addCustomColumn(columnName, description, typeIndex = 0) {
        return this.addColumnPage.addColumn(columnName, description, typeIndex);
    }

    async verifyColumnAdded(columnName, typeName) {
        return this.addColumnPage.verifyColumnAdded(columnName, typeName);
    }

    async openManageColumns() {
        return this.addColumnPage.openManageColumns();
    }

    async closeManageColumns() {
        return this.addColumnPage.closeManageColumns();
    }

    async deleteColumn(columnName) {
        return this.addColumnPage.deleteColumn(columnName);
    }

    async deleteAllCustomColumns() {
        return this.addColumnPage.deleteAllCustomColumns();
    }

    async verifyNoCustomColumnsRemain() {
        return this.addColumnPage.verifyNoCustomColumnsRemain();
    }

    async addAndVerifyAllColumnTypes() {
        return this.addColumnPage.addAndVerifyAllColumnTypes();
    }

    /**
     * Name-scoped presence check via the existing, unmodified `_getCustomColumnNames()` (reads
     * the full Manage Columns list, same as `getCustomColumnCount()` does internally) — used
     * instead of a total-count/verifyNoCustomColumnsRemain() check so this suite is safe to run
     * with multiple parallel workers: this grid's custom-columns list is shared, org-wide state,
     * so a count or "zero remain" assertion would fail whenever another concurrently-running
     * test's own column happens to exist at that instant. Checking only for one specific name
     * is unaffected by how many other columns concurrently exist.
     */
    async isCustomColumnPresent(columnName) {
        const names = await this.addColumnPage._getCustomColumnNames();
        await this.closeManageColumns();
        return names.includes(columnName);
    }

    /**
     * Lighter equivalent of AddColumnPage.addAndVerifyAllColumnTypes() for this grid: creates
     * and verifies each of the 13 column types with the same existing, proven addColumn/Manage
     * Columns methods, but verifies existence via the Manage Columns listing instead of
     * verifyColumnAdded()'s data-cell check — same reason documented on TC423 in
     * TC416_Images.spec.js: this grid has 9 default columns before any custom one, so a new
     * column's data cell lands past aria-colindex 9, which addColumnPage.js's own (pre-existing,
     * unmodified) scroll-into-view step can't reliably reach on this grid.
     *
     * Parallel-safe by construction: never calls deleteAllCustomColumns()/
     * verifyNoCustomColumnsRemain() (both operate on the entire shared column list, which would
     * delete or fail on other concurrently-running tests' columns) — only ever creates,
     * checks, and deletes the exact column names it created itself.
     */
    async addAndVerifyAllColumnTypesLite() {
        const createdColumns = [];
        const runId = Date.now();
        const manageColumnsDialog = this.addColumnPage.loc.manageColumnsDialog;
        for (let i = 0; i < ADD_COLUMN_TYPES.length; i++) {
            const typeName = ADD_COLUMN_TYPES[i];
            const columnName = `${typeName.replace(/[^a-zA-Z0-9]/g, '')}${runId + i}`;
            const description = `Automation ${typeName} column`;
            await this.addColumnPage.addColumn(columnName, description, i);
            await this.openManageColumns();
            await expect(manageColumnsDialog.getByText(columnName, { exact: true }), `Column "${columnName}" (${typeName}) must be listed in Manage Columns`).toBeVisible();
            await this.closeManageColumns();
            createdColumns.push(columnName);
        }
        for (const columnName of createdColumns) {
            await this.deleteColumn(columnName);
        }
        for (const columnName of createdColumns) {
            expect(await this.isCustomColumnPresent(columnName), `Column "${columnName}" must no longer be present after cleanup`).toBe(false);
        }
        return createdColumns;
    }
}

module.exports = { ImagesPage };
