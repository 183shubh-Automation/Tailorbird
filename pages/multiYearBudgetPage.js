const { expect } = require('@playwright/test');
const { Logger } = require('../utils/logger');
const { multiYearBudgetLocators } = require('../locators/multiYearBudgetLocator');

let myb;

/**
 * Page object for the Multi-Year Budget module (Financials > Multi-Year Budget).
 * This is a brand-new module with no prior page object in the framework, so it is
 * created fresh here per the "only if absolutely necessary" rule. All property and
 * single-year budget setup is delegated to the existing ApprovalJob/BudgetJob
 * classes rather than duplicated here.
 *
 * The table is a virtualized revo-grid treegrid: pinned columns (Category, Budget
 * Item) and scrollable year columns render as separate [role="row"] groups, so a
 * plain text-filtered row locator cannot line up a year's Planned/Current/Variance
 * cell with its item row. Reading a specific cell therefore intersects the target
 * column header's bounding box with the item row's bounding box and resolves the
 * element at that point, mirroring the pattern already proven for this same grid
 * library in pages/budgetPage.js (enterRevisionAdjustmentByItemNameV2).
 */
exports.MultiYearBudgetJob = class MultiYearBudgetJob {
    constructor(page) {
        this.page = page;
        myb = multiYearBudgetLocators(page);
    }

    // ===================== Navigation =====================

    async navigateToMultiYearBudget() {
        await this.page.goto('/financials/multi-year-budget', { waitUntil: 'load' });
        await this.page.waitForTimeout(4000);
        await this.page.waitForURL('**/financials/multi-year-budget**', { timeout: 45000 }).catch(() => { });
        Logger.success('Navigated to Multi-Year Budget');
    }

    async selectPropertyByName(propertyName) {
        await myb.propertySwitcherButton.click();
        await this.page.waitForTimeout(800);
        // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp -- propertyName's regex metacharacters are escaped inline before construction, so this can only ever match the literal `propertyName` substring (no ReDoS surface); it's also a test-helper parameter, not attacker-controlled input.
        const option = this.page.getByRole('menuitem', { name: new RegExp(propertyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first();
        await expect(option, `Property "${propertyName}" must appear in the property switcher`).toBeVisible({ timeout: 10000 });
        await option.click();
        await this.page.waitForTimeout(3000);
        Logger.success(`Selected property: ${propertyName}`);
    }

    // ===================== Empty state / Initialization =====================

    async verifyEmptyStateBeforePlan() {
        await expect(myb.createPlanHeading).toBeVisible({ timeout: 15000 });
        await expect(myb.createPlanBtn).toBeVisible();
        Logger.success('Multi-Year Budget empty state ("Create Your Multi-Year Budget") verified');
    }

    /**
     * Distinct from the pre-plan empty state (verifyEmptyStateBeforePlan): a plan that was
     * created with zero budget items selected is a valid, backend-accepted state (MCP-verified
     * live 2026-08-11 — no client or server validation blocks it) that renders its own
     * "no details yet" copy instead of the "Create Your Multi-Year Budget" CTA.
     */
    async verifyZeroItemPlanEmptyState() {
        await expect(myb.noDetailsHeading).toBeVisible({ timeout: 15000 });
        await expect(myb.noDetailsSubtext).toBeVisible();
        Logger.success('Zero-item multi-year budget plan empty state ("No multi year budget details added yet") verified');
    }

    async openInitializationDialog() {
        await myb.createPlanBtn.click();
        await expect(myb.initDialog).toBeVisible({ timeout: 10000 });
        Logger.success('Multi-Year Budget initialization dialog opened');
    }

    async verifyInitializationDefaults(expectedStartYear, expectedEndYear) {
        await expect(myb.holdPeriodStartYear).toHaveValue(String(expectedStartYear));
        await expect(myb.holdPeriodEndYear).toHaveValue(String(expectedEndYear));
        Logger.success(`Initialization defaults verified: ${expectedStartYear}-${expectedEndYear}`);
    }

    async selectBudgetItemInInitDialog(itemLabelPattern) {
        const checkbox = myb.itemCheckbox(itemLabelPattern);
        await expect(checkbox, `Budget item matching "${itemLabelPattern}" must be selectable`).toBeVisible({ timeout: 10000 });
        await checkbox.check();
        await expect(checkbox).toBeChecked();
        Logger.success(`Selected budget item "${itemLabelPattern}" in initialization dialog`);
    }

    async submitInitializationDialog() {
        await expect(myb.initSubmitBtn).toBeEnabled({ timeout: 10000 });
        await myb.initSubmitBtn.click();
        await expect(myb.initDialog).not.toBeVisible({ timeout: 15000 });
        await expect(myb.treegrid.first()).toBeVisible({ timeout: 20000 });
        Logger.success('Multi-year budget plan created — table view now visible');
    }

    /**
     * Submitting with zero budget items selected is accepted by both client and server
     * (MCP-verified live 2026-08-11 — the "Create Multi-Year Budget" submit button is never
     * disabled by an empty selection), but it produces no treegrid at all — only the
     * "No multi year budget details added yet" empty-content state — so this cannot reuse
     * submitInitializationDialog()'s wait for myb.treegrid.
     */
    async submitInitializationDialogExpectingZeroItems() {
        await expect(myb.initSubmitBtn).toBeEnabled({ timeout: 10000 });
        await myb.initSubmitBtn.click();
        await expect(myb.initDialog).not.toBeVisible({ timeout: 15000 });
        const createdToast = this.page.getByText('Multi-year budget created');
        await expect(createdToast).toBeVisible({ timeout: 15000 });
        Logger.success('Multi-year budget plan created with zero budget items selected');
    }

    // ===================== Plan Table View =====================

    async verifyPlanTableStructure(itemName) {
        await expect(myb.categoryColumnHeader).toBeVisible({ timeout: 15000 });
        await expect(myb.budgetItemColumnHeader).toBeVisible();
        await expect(this.page.getByRole('gridcell', { name: itemName })).toBeVisible({ timeout: 15000 });
        await expect(myb.totalRow.first()).toBeVisible();
        const plannedHeaders = await myb.plannedBudgetColumnHeaders.count();
        const currentHeaders = await myb.currentBudgetColumnHeaders.count();
        const varianceHeaders = await myb.varianceColumnHeaders.count();
        expect(plannedHeaders, 'Every hold-period year must have a Planned Budget column').toBeGreaterThan(0);
        expect(currentHeaders, 'Only the current year should have a Current Budget column').toBeGreaterThanOrEqual(1);
        expect(varianceHeaders, 'Only the current year should have a Variance column').toBeGreaterThanOrEqual(1);
        Logger.success(`Plan table structure verified for item "${itemName}" — Category/Budget Item rows, Total row, and year columns present`);
        return { plannedHeaders, currentHeaders, varianceHeaders };
    }

    async verifyYearVisible(year) {
        await expect(myb.yearGroupHeader(year).first()).toBeVisible({ timeout: 10000 });
    }

    /**
     * A year several columns past the current one (e.g. 2032 when the visible viewport only
     * ever showed 2026/2027) isn't merely scrolled off-screen — revo-grid virtualizes it out
     * of the DOM entirely, so Playwright's scrollIntoViewIfNeeded() has nothing to find and
     * times out (MCP-verified live 2026-08-11: confirmed via direct DOM inspection that the
     * grid's own `revogr-scroll-virtual.horizontal` element mounts/unmounts a year's column as
     * its scrollLeft changes, and that setting scrollLeft directly — not just visually
     * scrolling — is what drives that mount/unmount, independent of any Playwright API).
     * Walking scrollLeft in fixed steps and dispatching a 'scroll' event after each one
     * (the component listens for that, not a Playwright-specific signal) brings the target
     * year's column into the mounted DOM range so the rest of _headerForYear's existing
     * precise scrollIntoViewIfNeeded()-based lookup can then find it normally. A no-op when
     * the year is already mounted (e.g. 2026/2027, reachable without any of this).
     */
    async _ensureYearMountedInGrid(year) {
        const yearLabel = myb.yearGroupHeader(year).first();
        // A generous wait here (rather than a single-shot isVisible check) matters even for
        // already-close years like 2026/2027: right after navigation the grid can still be
        // mid-render, and a single-shot check racing that render was itself the cause of one
        // regression already (MCP-verified 2026-08-11).
        const alreadyVisible = await yearLabel.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
        if (alreadyVisible) return;

        const scrollContainer = this.page.locator('revogr-scroll-virtual.horizontal').first();
        if (await scrollContainer.count() === 0) return;

        // MCP-verified live 2026-08-11 via direct DOM inspection: setting scrollLeft on this
        // exact element (a Stencil/revo-grid custom element, not a plain overflow container)
        // and dispatching a plain 'scroll' event after it is what drives which year-column the
        // grid mounts — a synthetic WheelEvent dispatched at the treegrid has no effect at all
        // (confirmed: scrollLeft never moved across 8 attempts), so this is not a fallback for
        // a "nicer" native gesture, it is the only mechanism that works. Runs up to two full
        // sweeps of the container's scroll range because a single step's post-scroll settle
        // time can occasionally race the grid's own re-render (MCP-verified: the same target
        // scrollLeft can take 350-500ms to actually mount its column).
        const scrollWidth = await scrollContainer.evaluate((el) => el.scrollWidth).catch(() => 0);
        const step = 200;
        for (let attempt = 0; attempt < 2; attempt++) {
            for (let target = 0; target <= scrollWidth; target += step) {
                await scrollContainer.evaluate((el, left) => {
                    el.scrollLeft = left;
                    el.dispatchEvent(new Event('scroll', { bubbles: true }));
                }, target).catch(() => {});
                const found = await yearLabel.waitFor({ state: 'visible', timeout: 500 }).then(() => true).catch(() => false);
                if (found) return;
            }
        }
        Logger.info(`[MultiYearBudgetJob] Could not mount year ${year} in the grid after scanning scrollLeft 0-${scrollWidth} twice; the caller's own lookup will surface the failure.`);
    }

    /**
     * The plan table is a virtualized revo-grid: columns for years scrolled out of
     * view are not just visually hidden but entirely unmounted from the DOM, and
     * scrolling shifts which "Planned Budget"/"Current Budget"/"Variance" header
     * ends up at a given nth() position (MCP-verified: after enough horizontal
     * scroll, plannedBudgetColumnHeaders.nth(1) silently resolved to the Total
     * group's header instead of the intended future year). Locating a header by
     * its geometric alignment under that year's own label — after scrolling the
     * label into view — is immune to that, unlike a positional nth() index.
     */
    async _headerForYear(headersLocator, year) {
        await this._ensureYearMountedInGrid(year);
        const yearLabel = myb.yearGroupHeader(year).first();
        await yearLabel.scrollIntoViewIfNeeded();
        await expect(yearLabel).toBeVisible({ timeout: 15000 });
        const yearBox = await yearLabel.boundingBox();
        if (!yearBox) throw new Error(`Bounding box not available for year label: ${year}`);

        const count = await headersLocator.count();
        for (let i = 0; i < count; i++) {
            const box = await headersLocator.nth(i).boundingBox();
            if (!box) continue;
            const centerX = box.x + box.width / 2;
            if (centerX >= yearBox.x - 2 && centerX <= yearBox.x + yearBox.width + 2) {
                return headersLocator.nth(i);
            }
        }
        throw new Error(`Could not find a header aligned under year ${year} (checked ${count} candidates)`);
    }

    /**
     * Reads the text of the cell at the intersection of a given column header
     * and the single budget item's row, using the same bounding-box +
     * elementFromPoint technique already relied on elsewhere in this framework
     * for this exact virtualized grid.
     */
    async _readCellByHeaderAndItemRow(headerLocator, itemName) {
        await expect(headerLocator).toBeVisible({ timeout: 15000 });
        const headerBox = await headerLocator.boundingBox();
        if (!headerBox) throw new Error('Column header bounding box not available');

        const itemCell = this.page.getByRole('gridcell', { name: itemName }).first();
        await expect(itemCell).toBeVisible({ timeout: 15000 });
        const itemBox = await itemCell.boundingBox();
        if (!itemBox) throw new Error(`Bounding box not available for item row: "${itemName}"`);

        const x = headerBox.x + headerBox.width / 2;
        const y = itemBox.y + Math.min(itemBox.height / 2, 15);

        return this.page.evaluate(({ x, y }) => {
            const el = document.elementFromPoint(x, y);
            if (!el) return null;
            const cell = el.closest('[role="gridcell"]');
            return cell ? cell.textContent.trim() : null;
        }, { x, y });
    }

    async getCurrentYearRowValues(itemName, currentYear) {
        const plannedHeader = await this._headerForYear(myb.plannedBudgetColumnHeaders, currentYear);
        const currentHeader = await this._headerForYear(myb.currentBudgetColumnHeaders, currentYear);
        const varianceHeader = await this._headerForYear(myb.varianceColumnHeaders, currentYear);
        const planned = await this._readCellByHeaderAndItemRow(plannedHeader, itemName);
        const current = await this._readCellByHeaderAndItemRow(currentHeader, itemName);
        const variance = await this._readCellByHeaderAndItemRow(varianceHeader, itemName);
        return { planned, current, variance };
    }

    async getFutureYearPlannedValue(itemName, year) {
        const plannedHeader = await this._headerForYear(myb.plannedBudgetColumnHeaders, year);
        return this._readCellByHeaderAndItemRow(plannedHeader, itemName);
    }

    /**
     * Classifies the health-indicator colour of the Variance cell for the given
     * year by reading the computed CSS colour of the coloured text node at that
     * cell, rather than hardcoding a theme's exact RGB values.
     */
    async getVarianceColorCategory(itemName, year) {
        const headerLocator = await this._headerForYear(myb.varianceColumnHeaders, year);
        const headerBox = await headerLocator.boundingBox();
        const itemCell = this.page.getByRole('gridcell', { name: itemName }).first();
        const itemBox = await itemCell.boundingBox();
        const x = headerBox.x + headerBox.width / 2;
        const y = itemBox.y + Math.min(itemBox.height / 2, 15);

        // The health colour is applied to a specific descendant text node, not
        // necessarily the first child, and the default (uncoloured) text renders in a
        // neutral near-black (MCP-verified: rgb(33, 37, 41)). Scanning every descendant
        // for the first one whose colour differs from that default reliably finds the
        // actual coloured node regardless of exactly how deep it is nested.
        const NEUTRAL_TEXT_COLOR = 'rgb(33, 37, 41)';
        const color = await this.page.evaluate(({ x, y, neutral }) => {
            const el = document.elementFromPoint(x, y);
            if (!el) return null;
            const cell = el.closest('[role="gridcell"]');
            if (!cell) return null;
            const candidates = [cell, ...cell.querySelectorAll('*')];
            for (const node of candidates) {
                const c = window.getComputedStyle(node).color;
                if (c && c !== neutral) return c;
            }
            return window.getComputedStyle(cell).color;
        }, { x, y, neutral: NEUTRAL_TEXT_COLOR });

        if (!color) return 'unknown';
        const match = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(color);
        if (!match) return 'unknown';
        const [, r, g, b] = match.map(Number);
        if (g > r && g > b) return 'green';
        if (r > g && r > b && g < 100) return 'red';
        if (r > b && g > b) return 'orange';
        return 'neutral';
    }

    // ===================== Editing a Planned Budget cell =====================

    async openEditPlannedBudgetDialog(itemName, year) {
        const headerLocator = await this._headerForYear(myb.plannedBudgetColumnHeaders, year);
        const headerBox = await headerLocator.boundingBox();
        const itemCell = this.page.getByRole('gridcell', { name: itemName }).first();
        const itemBox = await itemCell.boundingBox();
        const x = headerBox.x + headerBox.width / 2;
        const y = itemBox.y + Math.min(itemBox.height / 2, 15);

        await this.page.mouse.dblclick(x, y);
        await expect(myb.editPlannedBudgetDialog).toBeVisible({ timeout: 10000 });
        Logger.success(`Opened "Edit planned budget" dialog for "${itemName}" (year ${year})`);
    }

    async setPlannedBudgetAmount(amount, reason) {
        // The underlying radio input is visually hidden by the Mantine SegmentedControl
        // styling, so it must be selected by clicking its visible label text instead of
        // the (non-actionable) input element itself.
        await myb.editPlannedBudgetDialog.getByText('Set amount', { exact: true }).click();
        await myb.plannedBudgetAmountInput.fill(String(amount));
        await myb.editReasonInput.fill(reason);
        await expect(myb.editSaveBtn).toBeEnabled({ timeout: 5000 });
        await myb.editSaveBtn.click();
        await expect(myb.editPlannedBudgetDialog).not.toBeVisible({ timeout: 10000 });
        const savedToast = this.page.getByText('Planned budget saved');
        await expect(savedToast).toBeVisible({ timeout: 10000 });
        // Let the toast auto-dismiss before returning — while visible it can overlap and
        // absorb clicks/dblclicks aimed at table cells underneath it (MCP-verified).
        await expect(savedToast).not.toBeVisible({ timeout: 15000 }).catch(() => { });
        Logger.success(`Set planned budget to ${amount} (reason: "${reason}")`);
    }

    async reallocatePlannedBudget(sourceLabelPattern, amount, reason) {
        // "Reallocate" is the dialog's default selection, but clicking its visible label
        // (rather than checking the visually-hidden radio input, see setPlannedBudgetAmount
        // above) keeps this correct even if "Set amount" was left selected from a prior edit.
        await myb.editPlannedBudgetDialog.getByText('Reallocate', { exact: true }).click();
        await myb.reallocateFromInput.click();
        await myb.reallocateFromOption(sourceLabelPattern).first().click();
        await myb.amountToReallocateInput.fill(String(amount));
        await myb.editReasonInput.fill(reason);
        await expect(myb.editSaveBtn).toBeEnabled({ timeout: 5000 });
        await myb.editSaveBtn.click();
        await expect(myb.editPlannedBudgetDialog).not.toBeVisible({ timeout: 10000 });
        const savedToast = this.page.getByText('Reallocation saved');
        await expect(savedToast).toBeVisible({ timeout: 10000 });
        await expect(savedToast).not.toBeVisible({ timeout: 15000 }).catch(() => { });
        Logger.success(`Reallocated ${amount} from "${sourceLabelPattern}" (reason: "${reason}")`);
    }

    /**
     * Attempts a reallocation that is expected to be rejected server-side (e.g. the source
     * year has insufficient Planned Budget — MCP-verified live: the "Reallocate from" dropdown
     * does not filter out zero-balance years client-side, so this only surfaces as an error
     * toast on Save, not a disabled Save button). Leaves the dialog open on failure, matching
     * live behaviour, and dismisses the error toast via its own alert-scoped button — unlike
     * the success toasts, error toasts do not auto-dismiss and will intercept clicks on
     * anything underneath them (MCP-verified) if left alone.
     */
    async attemptReallocationExpectingFailure(sourceLabelPattern, amount, reason, expectedErrorText) {
        await myb.editPlannedBudgetDialog.getByText('Reallocate', { exact: true }).click();
        await myb.reallocateFromInput.click();
        await myb.reallocateFromOption(sourceLabelPattern).first().click();
        await myb.amountToReallocateInput.fill(String(amount));
        await myb.editReasonInput.fill(reason);
        await expect(myb.editSaveBtn).toBeEnabled({ timeout: 5000 });
        await myb.editSaveBtn.click();
        const errorAlert = this.page.getByRole('alert').filter({ hasText: expectedErrorText });
        await expect(errorAlert, `Expected error toast containing "${expectedErrorText}"`).toBeVisible({ timeout: 10000 });
        await expect(myb.editPlannedBudgetDialog, 'Dialog must stay open after a failed save').toBeVisible();
        await errorAlert.getByRole('button').first().click().catch(() => { });
        Logger.success(`Reallocation correctly rejected: "${expectedErrorText}"`);
    }

    /** Opens the "Reallocate from" dropdown and returns every listed option's accessible text. */
    async getReallocateFromOptionTexts() {
        await myb.reallocateFromInput.click();
        await expect(myb.reallocateFromOptionsList.first()).toBeVisible({ timeout: 10000 });
        return myb.reallocateFromOptionsList.allTextContents();
    }

    /** Fills the "Set amount" field and returns its displayed value without saving — used to
     * observe client-side formatting/clamping (e.g. negative input) in isolation. */
    async fillPlannedBudgetAmountAndReadDisplayed(amount) {
        await myb.editPlannedBudgetDialog.getByText('Set amount', { exact: true }).click();
        await myb.plannedBudgetAmountInput.fill(String(amount));
        // The clamp (e.g. a negative amount -> $0.00) is not applied on the fill/input event
        // itself — MCP-verified live 2026-08-11: immediately after fill('-5000') the field
        // still read "-$5,000.00"; it only became "$0.00" once focus moved to the next field.
        // Blurring here reproduces that same trigger before reading the corrected value back.
        await myb.plannedBudgetAmountInput.blur();
        return (await myb.plannedBudgetAmountInput.inputValue()).trim();
    }

    async assertEditSaveDisabled() {
        await expect(myb.editSaveBtn).toBeDisabled();
    }

    /** Fills only the "Set amount" field, leaving Reason empty — used to verify Save stays
     * disabled until Reason is provided (the amount alone is not sufficient). */
    async fillSetAmountFieldOnly(amount) {
        await myb.editPlannedBudgetDialog.getByText('Set amount', { exact: true }).click();
        await myb.plannedBudgetAmountInput.fill(String(amount));
    }

    /** Fills only the Reallocate source + amount fields, leaving Reason empty — used to verify
     * Save stays disabled until Reason is provided. */
    async fillReallocateFieldsOnly(sourceLabelPattern, amount) {
        await myb.editPlannedBudgetDialog.getByText('Reallocate', { exact: true }).click();
        await myb.reallocateFromInput.click();
        await myb.reallocateFromOption(sourceLabelPattern).first().click();
        await myb.amountToReallocateInput.fill(String(amount));
    }

    async cancelEditPlannedBudgetDialog() {
        await myb.editCancelBtn.click();
        await expect(myb.editPlannedBudgetDialog).not.toBeVisible({ timeout: 5000 });
    }

    // ===================== Toolbar: CSV Upload / Export =====================

    async openUploadCsvDialog() {
        await myb.uploadCsvBtn.click();
        await expect(myb.uploadCsvDialog).toBeVisible({ timeout: 10000 });
        Logger.success('Upload CSV dialog opened');
    }

    async downloadCsvTemplate(downloadsDir = './downloads') {
        const path = require('path');
        const [download] = await Promise.all([
            this.page.waitForEvent('download'),
            myb.downloadTemplateBtn.click(),
        ]);
        // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal -- suggestedFilename() comes from Playwright's own Download API for a file downloaded from our own test app during an automated test run, not externally attacker-controlled input; downloadsDir defaults to a fixed literal test folder.
        const savePath = path.join(downloadsDir, await download.suggestedFilename());
        await download.saveAs(savePath);
        Logger.success(`Downloaded CSV template to ${savePath}`);
        return savePath;
    }

    async closeDialog() {
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(500);
    }

    /**
     * Uploads a local file through the Upload CSV dialog's Uploadcare "From device" picker.
     * Uploadcare stages the file first (shows "1 file uploaded" + a Done button) before the
     * app itself parses/validates it — Done must be clicked to trigger that validation.
     */
    /**
     * page.waitForEvent('filechooser') after clicking "From device" works locally but is
     * not reliably supported by GitHub Actions' headless CI runner for this Uploadcare
     * widget (confirmed: TC409/TC410 fail on that exact wait in CI while passing locally).
     * The same class of problem was already solved for the Budget revision CSV upload
     * (pages/budgetPage.js's uploadFileInRevision / tryDirectFileInput, exercised by the
     * @mandatory-tagged TC71, which is green in CI) by bypassing the native file-chooser
     * dialog entirely and setting the file directly on Uploadcare's own hidden
     * `<input type="file">`, which it mounts transiently once a "From device"-style trigger
     * is clicked. Copied here verbatim (candidate list + polling loop, unchanged from
     * budgetPage.js) and scoped to this dialog instead of budgetPage.js's revision-upload
     * root, without modifying budgetPage.js itself — that already-passing @mandatory case
     * is untouched. Two extra candidates are added (uc-file-uploader-inline) because this
     * dialog's Uploadcare widget runs in "inline" mode rather than the "regular" modal mode
     * budgetPage.js's own upload uses (MCP-verified live 2026-08-11); every original
     * candidate is kept.
     */
    async uploadCsvFile(filePath) {
        const path = require('path');
        // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal -- filePath is always a hard-coded test-fixture path passed by our own spec files (e.g. TC26_MultiYearBudget.spec.js), never external/user-controlled input.
        const fullPath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

        const tryDirectFileInput = async (maxMs = 20000) => {
            const deadline = Date.now() + maxMs;
            const buildCandidates = () => [
                myb.uploadCsvDialog.locator('input[type="file"]'),
                this.page.locator('uc-file-uploader-regular input[type="file"]'),
                this.page.locator('uc-file-uploader-regular').locator('input[type="file"]'),
                this.page.locator('uc-file-uploader-inline input[type="file"]'),
                this.page.locator('uc-file-uploader-inline').locator('input[type="file"]'),
                this.page.locator('.mantine-FileButton-root input[type="file"]').first(),
                this.page.locator('input[type="file"][accept*="csv"]'),
                this.page.locator('input[type="file"]'),
            ];
            while (Date.now() < deadline) {
                for (const loc of buildCandidates()) {
                    try {
                        const n = await loc.count();
                        if (n === 0) continue;
                        await loc.first().setInputFiles(fullPath, { timeout: 15000 });
                        Logger.success('Attached CSV via file input (Uploadcare / hidden input)');
                        return true;
                    } catch {
                        /* try next locator / next poll slice */
                    }
                }
                await this.page.waitForTimeout(450);
                await this.page.waitForLoadState('networkidle').catch(() => { });
            }
            return false;
        };

        if (!(await tryDirectFileInput(3000))) {
            const fromDeviceVisible = await myb.uploadCsvFromDeviceBtn.isVisible({ timeout: 5000 }).catch(() => false);
            if (fromDeviceVisible) {
                let attachedViaFileChooser = false;
                try {
                    const [fileChooser] = await Promise.all([
                        this.page.waitForEvent('filechooser', { timeout: 15000 }),
                        myb.uploadCsvFromDeviceBtn.click(),
                    ]);
                    await fileChooser.setFiles(fullPath);
                    attachedViaFileChooser = true;
                } catch {
                    Logger.info('[MultiYearBudget] No native filechooser event (expected in some CI environments) — falling back to direct <input type="file">');
                }
                if (!attachedViaFileChooser && !(await tryDirectFileInput())) {
                    throw new Error('Upload CSV: neither the native filechooser event nor a direct <input type="file"> attach succeeded');
                }
            } else if (!(await tryDirectFileInput())) {
                throw new Error('Upload CSV: no file upload control found (no "From device" button and no <input type="file">)');
            }
        }

        await expect(myb.uploadCsvDoneBtn).toBeEnabled({ timeout: 15000 });
        await myb.uploadCsvDoneBtn.click();
        Logger.success(`Uploaded CSV file: ${filePath}`);
    }

    /** Asserts the CSV upload dialog rejected the last-uploaded file with an inline error
     * containing the given text, and that the dialog stayed open (no import happened). */
    async verifyCsvUploadRejected(expectedErrorText) {
        await expect(myb.csvErrorsAlert).toBeVisible({ timeout: 10000 });
        await expect(myb.csvErrorsAlert, `Expected CSV error containing "${expectedErrorText}"`).toContainText(expectedErrorText);
        await expect(myb.uploadCsvDialog).toBeVisible();
        Logger.success(`CSV upload correctly rejected: "${expectedErrorText}"`);
    }

    /** Asserts the CSV upload succeeded and auto-created the given new budget item. */
    async verifyCsvUploadCreatedNewItem(itemName) {
        await expect(myb.csvImportCompletedAlert).toBeVisible({ timeout: 10000 });
        await expect(myb.csvBudgetItemsCreatedAlert, `Expected "Budget items created" to list "${itemName}"`).toContainText(itemName);
        Logger.success(`CSV upload auto-created new budget item: "${itemName}"`);
    }

    async exportCsv(downloadsDir = './downloads') {
        const path = require('path');
        const [download] = await Promise.all([
            this.page.waitForEvent('download'),
            myb.exportCsvBtn.click(),
        ]);
        // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal -- suggestedFilename() comes from Playwright's own Download API for a file downloaded from our own test app during an automated test run, not externally attacker-controlled input; downloadsDir defaults to a fixed literal test folder.
        const savePath = path.join(downloadsDir, await download.suggestedFilename());
        await download.saveAs(savePath);
        Logger.success(`Exported multi-year budget CSV to ${savePath}`);
        return savePath;
    }

    // ===================== Toolbar: Reset budget =====================

    async openResetBudgetDialog() {
        await myb.resetBudgetBtn.click();
        await expect(myb.resetBudgetDialog).toBeVisible({ timeout: 10000 });
        Logger.success('Reset budget dialog opened');
    }

    async verifyResetDisabledUntilDownload() {
        await expect(myb.resetConfirmBtn).toBeDisabled();
        Logger.success('Reset button confirmed disabled until table is downloaded');
    }

    async cancelResetBudgetDialog() {
        await myb.resetCancelBtn.click();
        await expect(myb.resetBudgetDialog).not.toBeVisible({ timeout: 5000 });
    }

    // ===================== Toolbar: Settings =====================

    async openSettingsDialog() {
        await myb.settingsBtn.click();
        await expect(myb.settingsDialog).toBeVisible({ timeout: 10000 });
        Logger.success('Settings dialog opened');
    }

    async verifyNoCapitalEnvelopeFieldInSettings() {
        await expect(myb.totalCapitalEnvelopeField).toHaveCount(0);
        Logger.success('Confirmed no "Total Capital Envelope" field exists in Settings dialog');
    }

    async cancelSettingsDialog() {
        await myb.settingsCancelBtn.click();
        await expect(myb.settingsDialog).not.toBeVisible({ timeout: 5000 });
    }

    async applySettingsDialog() {
        await myb.settingsApplyBtn.click();
        await expect(myb.settingsDialog).not.toBeVisible({ timeout: 10000 });
        Logger.success('Settings dialog applied');
    }

    async setHoldPeriodEndYear(value) {
        await myb.holdPeriodEndYear.fill(String(value));
    }

    async getHoldPeriodEndYearValue() {
        return (await myb.holdPeriodEndYear.inputValue()).trim();
    }

    // ===================== Item selection list (shared by Init + Settings dialogs) =====================

    async searchItemSelectionList(term) {
        await myb.itemSearchBox.fill(term);
    }

    async verifyNoItemsMatchSearchMessage() {
        await expect(myb.noItemsMatchSearchText).toBeVisible({ timeout: 5000 });
        Logger.success('"No items match your search." message verified for a non-matching search term');
    }

    async verifySelectAllAndDeselectAllDisabled() {
        await expect(myb.selectAllItemsBtn).toBeDisabled();
        await expect(myb.deselectAllItemsBtn).toBeDisabled();
    }

    async clickSelectAllItems() {
        await myb.selectAllItemsBtn.click();
    }

    async clickDeselectAllItems() {
        await myb.deselectAllItemsBtn.click();
    }

    async getItemCheckboxSummary() {
        const total = await myb.allItemCheckboxes.count();
        let checked = 0;
        for (let i = 0; i < total; i++) {
            if (await myb.allItemCheckboxes.nth(i).isChecked()) checked++;
        }
        return { total, checked };
    }

    // ===================== Property switcher search =====================

    async searchPropertySwitcher(term) {
        await myb.propertySwitcherButton.click();
        await this.page.waitForTimeout(500);
        await myb.propertySearchBox.fill(term);
    }

    async verifyNoPropertiesFoundMessage() {
        await expect(myb.noPropertiesFoundText).toBeVisible({ timeout: 5000 });
        Logger.success('"No properties found" message verified for a non-matching property search term');
    }

    // ===================== Toolbar: History =====================

    async openHistoryDialog() {
        await myb.historyBtn.click();
        await expect(myb.historyDialog).toBeVisible({ timeout: 10000 });
        Logger.success('Multi-year budget history dialog opened');
    }

    async verifyHistoryContainsText(text) {
        await expect(myb.historyDialog.getByText(text)).toBeVisible({ timeout: 10000 });
        Logger.success(`History log entry containing "${text}" verified`);
    }
};
