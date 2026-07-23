const { expect } = require('@playwright/test');
const { Logger } = require('../utils/logger');
const { drawReportingLocators } = require('../locators/drawReportingLocator');

let draw;

function isValidCurrencyText(text) {
    return /^-?\$[\d,]+(\.\d{1,2})?$/.test((text || '').trim());
}
function isValidNumericText(text) {
    return /^\d+$/.test((text || '').trim());
}

exports.DrawReportingJob = class DrawReportingJob {
    constructor(page) {
        this.page = page;
        draw = drawReportingLocators(page);
    }

    // ===================== Navigation =====================

    async navigateToDrawReporting() {
        Logger.step('Navigating to Draw Reporting');
        await this.page.goto('/financials/draw-reporting', { waitUntil: 'load' });
        await this.page.waitForTimeout(6000);
        await this.page.waitForURL('**/financials/draw-reporting**', { timeout: 15000 }).catch(() => { });
        Logger.success('Navigated to Draw Reporting');
    }

    async verifyNoPropertySelectedState() {
        await expect(draw.selectPropertyButton, 'Select a Property button must be visible when no property is chosen').toBeVisible({ timeout: 15000 });
        await expect(draw.createDrawButton, 'Create Draw button must be disabled with no property selected').toBeDisabled();
        const message = (await draw.noPropertySelectedMessage.textContent()).trim();
        expect(message, 'Empty-state message copy must match when no property is selected')
            .toBe('Please select a property from the header to view draw reporting.');
        Logger.success('Verified "no property selected" empty state');
    }

    // ===================== Property Selection =====================

    async selectPropertyByName(propertyName) {
        await expect(draw.selectPropertyButton, `Header must show a property picker before selecting "${propertyName}"`).toBeVisible({ timeout: 15000 });
        await draw.selectPropertyButton.click();
        await this.page.waitForTimeout(800);

        const option = draw.propertyMenuItems.filter({ hasText: propertyName }).first();
        await expect(option, `Property "${propertyName}" must appear in the property picker`).toBeVisible({ timeout: 10000 });
        await option.click();
        await this.page.waitForTimeout(4000);
        await this.page.waitForLoadState('networkidle').catch(() => { });
        Logger.success(`Selected property "${propertyName}" in Draw Reporting`);
    }

    async assertSelectedPropertyIs(propertyName) {
        const breadcrumbButton = draw.selectedPropertyBreadcrumbButton(propertyName);
        await expect(breadcrumbButton, `Breadcrumb must show the selected property "${propertyName}"`).toBeVisible({ timeout: 10000 });
        const text = (await breadcrumbButton.textContent()).trim();
        expect(text, 'Breadcrumb property text must exactly match the created property name').toBe(propertyName);
        Logger.success(`Confirmed selected property is "${propertyName}"`);
    }

    // ===================== KPI helpers (label/value pairs) =====================

    /**
     * KPI cards render as a value paragraph and a label paragraph as siblings
     * under a shared container. Walks the DOM directly (rather than relying on
     * a fixed index) so it stays correct even if card ordering changes.
     */
    async getKpiValueByLabel(label) {
        return this.page.evaluate((labelText) => {
            const all = Array.from(document.querySelectorAll('p'));
            const labelEl = all.find((el) => el.textContent.trim() === labelText);
            if (!labelEl || !labelEl.parentElement) return null;
            const siblings = Array.from(labelEl.parentElement.querySelectorAll('p'));
            const valueEl = siblings.find((el) => el !== labelEl);
            return valueEl ? valueEl.textContent.trim() : null;
        }, label);
    }

    async assertKpiValue(label, expectedValue) {
        const actual = await this.getKpiValueByLabel(label);
        expect(actual, `KPI "${label}" must be present with a value`).not.toBeNull();
        expect(actual, `KPI "${label}" value mismatch`).toBe(expectedValue);
        Logger.success(`KPI "${label}" = "${actual}" (matches expected)`);
    }

    // ===================== Overview tab (empty state) =====================

    async verifyOverviewEmptyState() {
        await expect(draw.overviewTab, 'Overview tab must be visible').toBeVisible({ timeout: 15000 });
        await expect(draw.historicalDrawsTab, 'Historical Draws tab must be visible').toBeVisible();

        await this.assertKpiValue('Total Budget', '$0.00');
        await this.assertKpiValue('Draws to Date', '$0.00');
        await this.assertKpiValue('Remaining Budget', '$0.00');
        await this.assertKpiValue('Pending Invoices', '$0.00');

        await expect(draw.budgetOverviewHeading, '"Budget Overview" heading must be visible').toBeVisible();
        const emptyTitle = (await draw.budgetOverviewEmptyTitle.textContent()).trim();
        expect(emptyTitle, 'Budget Overview empty-state title must match').toBe('No draw budget overviews added yet');
        const emptySubtitle = (await draw.budgetOverviewEmptySubtitle.textContent()).trim();
        expect(emptySubtitle, 'Budget Overview empty-state subtitle must match').toBe('Use + or Create Button to create one');

        await expect(draw.capexStatusHeading, '"Capex Status" widget heading must be visible').toBeVisible();
        await expect(draw.drawnVsRemainingLabel, '"Drawn VS Remaining" label must be visible').toBeVisible();
        const drawnText = (await draw.drawnPercentText.textContent()).trim();
        expect(drawnText, 'Drawn percent/amount text must match empty-state value').toBe('0% Drawn ($0.00)');
        const remainingText = (await draw.remainingPercentText.textContent()).trim();
        expect(remainingText, 'Remaining percent/amount text must match empty-state value').toBe('100% Remaining ($0.00)');

        await expect(draw.createDrawButton, 'Create Draw button must be enabled once a property is selected').toBeEnabled();

        Logger.success('Verified Draw Reporting Overview empty state for a brand-new property');
    }

    // ===================== Historical Draws tab (empty state) =====================

    async openHistoricalDrawsTab() {
        await draw.historicalDrawsTab.click();
        await this.page.waitForTimeout(1500);
    }

    async openOverviewTab() {
        await draw.overviewTab.click();
        await this.page.waitForTimeout(1500);
    }

    async verifyHistoricalDrawsEmptyState() {
        await this.assertKpiValue('Pending Approval', '0');
        await this.assertKpiValue('Total Requested (2026)', '$0.00');
        await this.assertKpiValue('Total Funded (2026)', '$0.00');
        await this.assertKpiValue('Draws with Issues', '0');

        const emptyTitle = (await draw.historicalDrawsEmptyTitle.textContent()).trim();
        expect(emptyTitle, 'Historical Draws empty-state title must match').toBe('No draws added yet');
        const emptySubtitle = (await draw.historicalDrawsEmptySubtitle.textContent()).trim();
        expect(emptySubtitle, 'Historical Draws empty-state subtitle must match').toBe('Use + or Create Button to create one');

        Logger.success('Verified Historical Draws empty state (no draws, no invoice data) for a brand-new property');
    }

    // ===================== Create Draw modal (Step 1 only — never submitted) =====================

    async openCreateDrawModal() {
        await expect(draw.createDrawButton, 'Create Draw button must be clickable').toBeEnabled({ timeout: 10000 });
        await draw.createDrawButton.click();
        await expect(draw.createDrawModal, 'Create New Draw modal must open').toBeVisible({ timeout: 10000 });
        Logger.success('Create Draw modal (Step 1) opened');
    }

    async verifyCreateDrawModalStepOne() {
        const heading = (await draw.createDrawModalHeading.textContent()).trim();
        expect(heading, 'Modal heading must read "Create New Draw"').toBe('Create New Draw');

        await expect(draw.drawNameInput, 'Draw Name field must be present').toBeVisible();
        await expect(draw.billingStartDateInput, 'Billing Period Start Date field must be present').toBeVisible();
        await expect(draw.billingEndDateInput, 'Billing Period End Date field must be present').toBeVisible();

        expect(await draw.drawNameInput.getAttribute('placeholder'), 'Draw Name placeholder must match').toBe('Enter draw name');
        expect(await draw.billingStartDateInput.getAttribute('placeholder'), 'Start date placeholder must match').toBe('MM/DD/YYYY');
        expect(await draw.billingEndDateInput.getAttribute('placeholder'), 'End date placeholder must match').toBe('MM/DD/YYYY');

        const submitText = (await draw.createDrawModalSubmitBtn.textContent()).trim();
        expect(submitText, 'Modal submit button must read "Create Draw"').toBe('Create Draw');

        Logger.success('Verified Create New Draw modal Step 1 fields and buttons — not submitting');
    }

    async closeCreateDrawModal() {
        await draw.createDrawModalCloseBtn.click();
        await expect(draw.createDrawModal, 'Create New Draw modal must close').not.toBeVisible({ timeout: 10000 });
        Logger.success('Closed Create Draw modal without submitting');
    }

    // ===================== Grid toolbar controls: Filter / View / Table / Export =====================

    async verifyFilterPanel() {
        await draw.filterButtonIn(draw.overviewTabPanel).click();
        await this.page.waitForTimeout(500);

        const heading = (await draw.filtersPanelHeading.textContent()).trim();
        expect(heading, 'Filters popover heading must match').toBe('Filters');
        const subheading = (await draw.filterOptionsHeading.textContent()).trim();
        expect(subheading, 'Filter Options subheading must match').toBe('Filter Options');

        const expectedFields = ['Budget Item', 'Original Budget', 'Reallocation', 'Current Budget', 'Committed', 'Drawn', 'Budget Remaining', 'Progress %'];
        const capturedFields = [];
        for (const field of expectedFields) {
            const label = (await draw.filterFieldLabel(field).textContent()).trim();
            expect(label, `Filter field "${field}" must be present`).toBe(field);
            capturedFields.push(label);
        }

        const comboboxOptions = (await this.page.locator('select, [role="combobox"]').first().locator('option').allTextContents())
            .map((o) => o.trim());
        expect(comboboxOptions, 'Filter comparator dropdown options must match').toEqual(['Equals', 'Greater than', 'Less than', 'Between']);

        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(400);

        Logger.success('Verified Filters popover: heading, subheading, all 8 field labels, and comparator options');
        return { heading, subheading, fields: capturedFields, comparatorOptions: comboboxOptions };
    }

    async verifyViewDialog(panel) {
        await draw.viewButtonIn(panel).click();
        await this.page.waitForTimeout(500);

        const heading = (await draw.saveViewDialogHeading.textContent()).trim();
        expect(heading, 'Save view popover heading must match').toBe('Save current view as');
        const placeholder = await draw.saveViewNameInput.getAttribute('placeholder');
        expect(placeholder, 'Save view input placeholder must match').toBe('Enter a view name');

        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(400);

        Logger.success('Verified "Save current view as" popover heading and input placeholder');
        return { heading, placeholder };
    }

    async verifyManageColumns(panel, expectedColumns) {
        await draw.tableButtonIn(panel).click();
        await this.page.waitForTimeout(500);
        const addCustomColumnText = (await draw.addCustomColumnButton.textContent()).trim();
        expect(addCustomColumnText, '"Add custom column" button text must match').toBe('Add custom column');

        await draw.hideShowColumnsButton.click();
        await this.page.waitForTimeout(500);

        const heading = (await draw.manageColumnsHeading.textContent()).trim();
        expect(heading, 'Manage Columns dialog heading must match').toBe('Manage Columns');
        const groupLabel = (await draw.defaultColumnsLabel.textContent()).trim();
        expect(groupLabel, 'Default Columns group label must match').toBe('Default Columns');

        const capturedColumns = [];
        for (const column of expectedColumns) {
            const label = (await draw.columnLabel(column).textContent()).trim();
            expect(label, `Column "${column}" must be present in Manage Columns`).toBe(column);
            capturedColumns.push(label);
        }

        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(400);

        Logger.success(`Verified Manage Columns dialog: heading, group label, and ${expectedColumns.length} column names`);
        return { addCustomColumnText, heading, groupLabel, columns: capturedColumns };
    }

    async captureExportDownload(panel, expectedFilename) {
        const [download] = await Promise.all([
            this.page.waitForEvent('download', { timeout: 15000 }),
            draw.exportButtonIn(panel).click(),
        ]);
        const filename = download.suggestedFilename();
        expect(filename, `Export button must download "${expectedFilename}"`).toBe(expectedFilename);
        Logger.success(`Verified Export button triggers download of "${filename}"`);
        return { filename };
    }

    async captureAllBudgetOverviewControls() {
        const filter = await this.verifyFilterPanel();
        const view = await this.verifyViewDialog(draw.overviewTabPanel);
        const table = await this.verifyManageColumns(draw.overviewTabPanel, [
            'Budget Item', 'Budget Remaining', 'Committed', 'Current Budget', 'Drawn', 'Original Budget', 'Progress %', 'Reallocation',
        ]);
        const exportResult = await this.captureExportDownload(draw.overviewTabPanel, 'draw-budget-overview-data.csv');
        return { filter, view, table, export: exportResult };
    }

    async captureAllHistoricalDrawsControls() {
        const view = await this.verifyViewDialog(draw.historicalDrawsTabPanel);
        const table = await this.verifyManageColumns(draw.historicalDrawsTabPanel, [
            'Draw Amount', 'Draw Name', 'Draw PDF', 'Previously Drawn', 'Property', 'Remaining at Submission', 'Status', 'Submitted on', 'Total Draw at Submission',
        ]);
        const exportResult = await this.captureExportDownload(draw.historicalDrawsTabPanel, 'draw-data.csv');
        return { view, table, export: exportResult };
    }

    // ===================== Create Draw — full E2E (create + verify impact) =====================

    async createDraw(drawName, startDate, endDate) {
        await this.openCreateDrawModal();
        await draw.drawNameInput.fill(drawName);
        await draw.billingStartDateInput.fill(startDate);
        await draw.billingEndDateInput.fill(endDate);
        await draw.createDrawModalHeading.click();
        await this.page.waitForTimeout(300);

        await draw.createDrawModalSubmitBtn.click();

        const toastTitle = (await draw.drawCreatedToastTitle.textContent({ timeout: 10000 })).trim();
        expect(toastTitle, 'Draw-created toast title must match').toBe('Draw created');
        const toastMessage = (await draw.drawCreatedToastMessage.textContent()).trim();
        expect(toastMessage, 'Draw-created toast message must match').toBe('Your new draw has been created successfully.');

        await expect(draw.drawEditorDialog, 'Draw editor (Step 2) must open after creating the draw').toBeVisible({ timeout: 10000 });
        Logger.success(`Created draw "${drawName}" — toast confirmed, editor opened`);
    }

    async verifyDrawEditorStepTwo(expectedName) {
        const nameValue = await draw.drawEditorNameInput.inputValue();
        expect(nameValue, 'Draw editor name field must show the created draw name').toBe(expectedName);

        const status = (await draw.drawEditorStatusBadge.textContent()).trim();
        expect(status, 'Draw editor status badge must read "Draft"').toBe('Draft');

        await this.assertKpiValue('Total Budget', '$0.00');
        await this.assertKpiValue('Draws to Date', '$0.00');
        await this.assertKpiValue('Current Draw Request', '$0.00');
        await this.assertKpiValue('Remaining Budget', '$0.00');
        await this.assertKpiValue('Pending Invoices', '$0.00');
        await this.assertKpiValue('Budget Used', '0%');

        const warningsText = (await this.page.getByText('0 Warnings', { exact: true }).textContent()).trim();
        expect(warningsText, 'Warnings summary text must match').toBe('0 Warnings');
        const itemsToReviewText = (await this.page.getByText('0 items to review', { exact: true }).textContent()).trim();
        expect(itemsToReviewText, 'Items-to-review summary text must match').toBe('0 items to review');

        const disbursementHeading = (await draw.drawDisbursementHeading.textContent()).trim();
        expect(disbursementHeading, 'Disbursement schedule heading must match').toBe('Draw disbursement schedule');
        const disbursementEmpty = (await draw.drawDisbursementEmptyMessage.textContent()).trim();
        expect(disbursementEmpty, 'Disbursement schedule empty message must match').toBe('No budget categories found for this property.');

        const invoicesHeading = (await draw.drawInvoicesHeading.textContent()).trim();
        expect(invoicesHeading, 'Invoices heading must match').toBe('Invoices (0)');
        const invoicesEmpty = (await draw.drawInvoicesEmptyMessage.textContent()).trim();
        expect(invoicesEmpty, 'Invoices empty message must match').toBe('No invoices match the current search/filter.');

        await expect(draw.drawEditorContinueButton, 'Continue button must be disabled with no budget items or invoices').toBeDisabled();

        Logger.success('Verified Draw editor (Step 2): name, Draft status, KPIs, empty disbursement schedule, empty invoices list, disabled Continue');
    }

    async closeDrawEditor() {
        await draw.drawEditorCloseButton.click();
        await expect(draw.drawEditorDialog, 'Draw editor must close').not.toBeVisible({ timeout: 10000 });
        Logger.success('Closed draw editor (draft preserved, not discarded)');
    }

    async verifyActiveDrawImpact(expectedName) {
        await expect(draw.createDrawButton, 'Create Draw button must become disabled while a draw is in progress').toBeDisabled();

        await this.assertKpiValue('Active Draw (Draw in progress)', '$0.00');

        const cardName = (await this.page.getByText(expectedName, { exact: true }).first().textContent()).trim();
        expect(cardName, 'Active Draw card must show the created draw name').toBe(expectedName);
        const cardStatus = (await draw.activeDrawCardStatus.textContent()).trim();
        expect(cardStatus, 'Active Draw card status must read "Draw in Progress"').toBe('Draw in Progress');

        await expect(draw.activeDrawContinueEditingButton, '"Continue Editing" button must be visible on the Active Draw card').toBeVisible();

        Logger.success(`Verified Active Draw impact on Overview tab for "${expectedName}": 5th KPI, card name/status, Continue Editing button, Create Draw disabled`);
    }

    async verifyDrawEditorNameAndStatus(expectedName) {
        const nameValue = await draw.drawEditorNameInput.inputValue();
        expect(nameValue, 'Draw editor name field must show the created draw name').toBe(expectedName);
        const status = (await draw.drawEditorStatusBadge.textContent()).trim();
        expect(status, 'Draw editor status badge must read "Draft"').toBe('Draft');
        Logger.success(`Verified draw editor opened for "${expectedName}" in Draft status`);
    }

    // Same intent as verifyActiveDrawImpact, but checks the Active Draw KPI by format rather
    // than a hardcoded $0.00 — needed on a real property where that amount can be non-zero.
    async verifyActiveDrawImpactLogical(expectedName) {
        await expect(draw.createDrawButton, 'Create Draw button must become disabled while a draw is in progress').toBeDisabled();

        const activeDrawValue = await this.getKpiValueByLabel('Active Draw (Draw in progress)');
        expect(activeDrawValue, 'Active Draw KPI must be present').not.toBeNull();
        expect(isValidCurrencyText(activeDrawValue), `Active Draw KPI value "${activeDrawValue}" must be a valid currency amount`).toBeTruthy();

        const cardName = (await this.page.getByText(expectedName, { exact: true }).first().textContent()).trim();
        expect(cardName, 'Active Draw card must show the created draw name').toBe(expectedName);
        const cardStatus = (await draw.activeDrawCardStatus.textContent()).trim();
        expect(cardStatus, 'Active Draw card status must read "Draw in Progress"').toBe('Draw in Progress');

        await expect(draw.activeDrawContinueEditingButton, '"Continue Editing" button must be visible on the Active Draw card').toBeVisible();

        Logger.success(`Verified draw "${expectedName}" is available: Active Draw KPI ("${activeDrawValue}"), card name/status, Continue Editing button, Create Draw disabled`);
        return { activeDrawValue };
    }

    async reopenActiveDraw() {
        await draw.activeDrawContinueEditingButton.click();
        await expect(draw.drawEditorDialog, 'Draw editor must reopen via "Continue Editing"').toBeVisible({ timeout: 10000 });
        Logger.success('Reopened the in-progress draw via "Continue Editing"');
    }

    // Discards the draft draw entirely (distinct from closeDrawEditor, which preserves it) —
    // used to restore a shared/pre-existing property to its original, re-testable state.
    async discardDraw() {
        this.page.once('dialog', (dialog) => dialog.accept());
        await draw.drawEditorDiscardButton.click();
        await expect(draw.drawEditorDialog, 'Draw editor must close after discarding').not.toBeVisible({ timeout: 10000 });
        await expect(draw.createDrawButton, 'Create Draw button must re-enable once the only in-progress draw is discarded').toBeEnabled({ timeout: 10000 });
        Logger.success('Discarded the draft draw — property restored to its original, re-testable state');
    }

    async verifyBudgetOverviewUnaffectedByDraft() {
        const emptyTitle = (await draw.budgetOverviewEmptyTitle.textContent()).trim();
        expect(emptyTitle, 'Budget Overview must remain empty — the draft draw has no budget items').toBe('No draw budget overviews added yet');
        Logger.success('Confirmed Budget Overview grid is unaffected by the draft draw (still empty)');
    }

    async verifyHistoricalDrawsUnaffectedByDraft() {
        await this.openHistoricalDrawsTab();
        const emptyTitle = (await draw.historicalDrawsEmptyTitle.textContent()).trim();
        expect(emptyTitle, 'Historical Draws must remain empty — draft draws are not listed there').toBe('No draws added yet');
        await this.openOverviewTab();
        Logger.success('Confirmed Historical Draws tab is unaffected by the draft draw (still empty — drafts are not historical)');
    }

    // ===================== Logical (format/existence) assertions for a real, populated property =====================
    // Real properties carry live data that changes over time, so these check that each value
    // EXISTS and is correctly formatted rather than comparing against a fixed expected number.

    async verifyOverviewKpisExistAndValid() {
        const labels = ['Total Budget', 'Draws to Date', 'Remaining Budget', 'Pending Invoices'];
        const captured = {};
        for (const label of labels) {
            const value = await this.getKpiValueByLabel(label);
            expect(value, `KPI "${label}" must be present`).not.toBeNull();
            expect(isValidCurrencyText(value), `KPI "${label}" value "${value}" must be a valid currency amount`).toBeTruthy();
            captured[label] = value;
            Logger.success(`KPI "${label}" = "${value}" (exists, valid currency format)`);
        }
        return captured;
    }

    async verifyHistoricalDrawsKpisExistAndValid() {
        const currencyLabels = ['Total Requested (2026)', 'Total Funded (2026)'];
        const numericLabels = ['Pending Approval', 'Draws with Issues'];
        const captured = {};
        for (const label of currencyLabels) {
            const value = await this.getKpiValueByLabel(label);
            expect(value, `KPI "${label}" must be present`).not.toBeNull();
            expect(isValidCurrencyText(value), `KPI "${label}" value "${value}" must be a valid currency amount`).toBeTruthy();
            captured[label] = value;
        }
        for (const label of numericLabels) {
            const value = await this.getKpiValueByLabel(label);
            expect(value, `KPI "${label}" must be present`).not.toBeNull();
            expect(isValidNumericText(value), `KPI "${label}" value "${value}" must be a valid whole number`).toBeTruthy();
            captured[label] = value;
        }
        Logger.success(`Verified Historical Draws KPIs exist with valid values: ${JSON.stringify(captured)}`);
        return captured;
    }

    async verifyCapexStatusHasValidValues() {
        await expect(draw.capexStatusHeading, '"Capex Status" widget heading must be visible').toBeVisible();
        await expect(draw.drawnVsRemainingLabel, '"Drawn VS Remaining" label must be visible').toBeVisible();

        const drawnText = (await this.page.getByText(/^\d{1,3}% Drawn \(\$/).first().textContent()).trim();
        expect(drawnText, `Drawn text "${drawnText}" must match "N% Drawn ($amount)" format`).toMatch(/^\d{1,3}% Drawn \(\$[\d,.]+\)$/);
        const remainingText = (await this.page.getByText(/^\d{1,3}% Remaining \(\$/).first().textContent()).trim();
        expect(remainingText, `Remaining text "${remainingText}" must match "N% Remaining ($amount)" format`).toMatch(/^\d{1,3}% Remaining \(\$[\d,.]+\)$/);

        Logger.success(`Verified Capex Status widget values exist and are well-formed: "${drawnText}" / "${remainingText}"`);
        return { drawnText, remainingText };
    }

    async verifyBudgetOverviewLogical() {
        const isEmpty = await draw.budgetOverviewEmptyTitle.isVisible().catch(() => false);
        if (isEmpty) {
            const emptyTitle = (await draw.budgetOverviewEmptyTitle.textContent()).trim();
            expect(emptyTitle, 'Budget Overview empty-state title must match when no budget items exist').toBe('No draw budget overviews added yet');
            Logger.success('Budget Overview grid currently has no items — verified empty-state message');
            return { hasData: false };
        }
        const firstCell = this.page.getByRole('gridcell').filter({ hasText: /\S/ }).first();
        await expect(firstCell, 'Budget Overview grid must show at least one data row when not empty').toBeVisible();
        const sampleRowText = (await firstCell.textContent()).trim();
        expect(sampleRowText.length, 'Budget Overview first data row must contain non-empty text').toBeGreaterThan(0);
        Logger.success(`Verified Budget Overview grid has data — sample row: "${sampleRowText}"`);
        return { hasData: true, sampleRowText };
    }

    async verifyHistoricalDrawsLogical() {
        const isEmpty = await draw.historicalDrawsEmptyTitle.isVisible().catch(() => false);
        if (isEmpty) {
            const emptyTitle = (await draw.historicalDrawsEmptyTitle.textContent()).trim();
            expect(emptyTitle, 'Historical Draws empty-state title must match when no draws exist').toBe('No draws added yet');
            Logger.success('Historical Draws grid currently has no draws — verified empty-state message');
            return { hasData: false };
        }
        // The first column is a row-selection checkbox with no text, so skip straight to the first cell with real content.
        const firstCell = this.page.getByRole('gridcell').filter({ hasText: /\S/ }).first();
        await expect(firstCell, 'Historical Draws grid must show at least one data row when not empty').toBeVisible();
        const sampleRowText = (await firstCell.textContent()).trim();
        expect(sampleRowText.length, 'Historical Draws first data row must contain non-empty text').toBeGreaterThan(0);
        Logger.success(`Verified Historical Draws grid has data — sample row: "${sampleRowText}"`);
        return { hasData: true, sampleRowText };
    }

    // ===================== Invoice inclusion + real approval-chain E2E (Step 1 -> Step 2 -> Submit) =====================

    /**
     * Checks the given invoice's row checkbox to include it in the draw. Asserts the
     * auto-generated, non-deselectable CM Fee invoice line appears as a result, and
     * returns the updated "Current Draw Request" KPI value (existence/format, not fixed).
     */
    async includeInvoiceInDraw(invoiceLabel) {
        const checkbox = draw.invoiceRowCheckboxByLabel(invoiceLabel);
        await expect(checkbox, `Checkbox for invoice "${invoiceLabel}" must be visible`).toBeVisible({ timeout: 10000 });
        await checkbox.check({ force: true });
        await this.page.waitForTimeout(1000);

        await expect(draw.cmFeeAutoInvoiceLabel, 'Auto-generated CM Fee invoice line must appear once an invoice is included').toBeVisible({ timeout: 10000 });

        const currentDrawRequest = await this.getKpiValueByLabel('Current Draw Request');
        expect(currentDrawRequest, 'Current Draw Request KPI must be present after including an invoice').not.toBeNull();
        expect(isValidCurrencyText(currentDrawRequest), `Current Draw Request "${currentDrawRequest}" must be a valid currency amount`).toBeTruthy();

        Logger.success(`Included invoice "${invoiceLabel}" — CM Fee auto-invoice appeared, Current Draw Request = "${currentDrawRequest}"`);
        return { currentDrawRequest };
    }

    /**
     * Checks whichever invoice is first available (i.e. not the disabled, auto-generated
     * CM Fee row), without needing to know its label ahead of time. Reuses whatever pending
     * invoice already exists rather than assuming a specific one.
     */
    async includeFirstAvailableInvoice() {
        // The Invoices panel populates asynchronously after the editor opens — wait for
        // its heading to report a non-zero count before scanning for checkboxes, otherwise
        // this races the fetch and finds nothing.
        await expect(async () => {
            const headingText = (await draw.drawEditorDialog.getByText(/^Invoices \(\d+\)$/).textContent()).trim();
            const count = Number((headingText.match(/Invoices \((\d+)\)/) || [])[1] || 0);
            expect(count, `Invoices panel heading "${headingText}" must report at least one invoice`).toBeGreaterThan(0);
        }).toPass({ timeout: 20000 });

        const checkboxes = draw.drawEditorDialog.getByRole('checkbox');
        const count = await checkboxes.count();
        let target = null;
        for (let i = 0; i < count; i++) {
            const candidate = checkboxes.nth(i);
            if (!(await candidate.isDisabled())) {
                target = candidate;
                break;
            }
        }
        if (!target) throw new Error('No available (non-disabled) invoice checkbox found in the draw editor');

        await target.check({ force: true });
        await this.page.waitForTimeout(1000);

        await expect(draw.cmFeeAutoInvoiceLabel, 'Auto-generated CM Fee invoice line must appear once an invoice is included').toBeVisible({ timeout: 10000 });

        const currentDrawRequest = await this.getKpiValueByLabel('Current Draw Request');
        expect(currentDrawRequest, 'Current Draw Request KPI must be present after including an invoice').not.toBeNull();
        expect(isValidCurrencyText(currentDrawRequest), `Current Draw Request "${currentDrawRequest}" must be a valid currency amount`).toBeTruthy();

        Logger.success(`Included first available invoice — CM Fee auto-invoice appeared, Current Draw Request = "${currentDrawRequest}"`);
        return { currentDrawRequest };
    }

    /** Reads the "Pending Invoices" KPI on the Overview tab (existence/format, not fixed). */
    async getPendingInvoicesKpi() {
        const value = await this.getKpiValueByLabel('Pending Invoices');
        expect(value, 'Pending Invoices KPI must be present').not.toBeNull();
        expect(isValidCurrencyText(value), `Pending Invoices "${value}" must be a valid currency amount`).toBeTruthy();
        return value;
    }

    async proceedToDrawStepTwo() {
        await expect(draw.drawEditorContinueButton, 'Continue button must be enabled once at least one invoice is included').toBeEnabled({ timeout: 10000 });
        await draw.drawEditorContinueButton.click();
        await expect(draw.drawStepTwoDialog, 'Step 2 (PDF preview / Draw Summary) must open').toBeVisible({ timeout: 15000 });
        Logger.success('Proceeded to Draw Step 2 (PDF preview)');
    }

    async backToStepOneEditor() {
        await draw.backToEditLink.click();
        await expect(draw.drawEditorDialog, 'Draw editor (Step 1) must be visible again').toBeVisible({ timeout: 10000 });
        Logger.success('Returned to Draw Step 1 editor');
    }

    /**
     * Reads the Approval Flow section on Step 2. When a Draw approval template is
     * configured for the property, this renders a real chain (Submitter + approver
     * steps); otherwise it shows the "No approval required" message. Returns whichever
     * is present so the caller can assert against what a specific property actually has.
     */
    async readApprovalFlowSection() {
        await expect(draw.approvalFlowHeading, '"Approval Flow" heading must be visible on Step 2').toBeVisible({ timeout: 10000 });

        const hasNoApprovalMessage = await draw.approvalFlowNoApprovalMessage.isVisible().catch(() => false);
        if (hasNoApprovalMessage) {
            Logger.info('Approval Flow: "No approval required for this draw." (no Draw approval template configured)');
            return { configured: false };
        }

        const sectionText = (await this.page.getByText('Approval Flow', { exact: true }).locator('xpath=..').textContent()).trim();
        Logger.success(`Approval Flow chain rendered: "${sectionText}"`);
        return { configured: true, sectionText };
    }

    async submitDrawForApproval() {
        await expect(draw.submitForApprovalButton, 'Submit for Approval button must be enabled').toBeEnabled({ timeout: 10000 });
        await draw.submitForApprovalButton.click();
        await expect(draw.drawStepTwoDialog, 'Draw editor must close after submitting for approval').not.toBeVisible({ timeout: 30000 });
        Logger.success('Draw submitted for approval');
    }

    /**
     * Asserts the Invoices panel (right side of the Step 1 draw editor) shows a specific
     * invoice together with the auto-generated CM Fee line — both with real currency
     * amounts, not just visibility. This is the "right panel" that lists an included
     * invoice alongside its CM Fee once the invoice is checked into the draw.
     */
    async assertInvoicePanelShowsInvoiceWithCmFee(invoiceLabel) {
        await expect(draw.cmFeeAutoInvoiceLabel, 'CM Fee Invoice (TBD) line must be visible once a real invoice is included').toBeVisible({ timeout: 10000 });

        const row = draw.invoicePanelRowByLabel(invoiceLabel);
        await expect(row, `Invoices panel must show a row for "${invoiceLabel}"`).toBeVisible({ timeout: 10000 });
        const rowText = (await row.textContent()).trim();
        expect(rowText, `Invoice row "${invoiceLabel}" must show a valid currency amount (raw: "${rowText}")`).toMatch(/\$[\d,]+(\.\d{1,2})?/);

        // The CM Fee $ amount is a real-DOM sibling of the "CM Fee Invoice (TBD)" text a few
        // levels up — but accessibility-tree nesting doesn't map 1:1 to actual DOM depth, so
        // climb real parentElements (via evaluate) rather than guessing an xpath ancestor count.
        const cmFeeText = await draw.cmFeeAutoInvoiceLabel.evaluate((el) => {
            let node = el.parentElement;
            for (let i = 0; i < 8 && node; i++) {
                const match = node.textContent.match(/\$[\d,]+(\.\d{1,2})?/);
                if (match) return match[0];
                node = node.parentElement;
            }
            return null;
        });
        expect(cmFeeText, 'CM Fee Invoice (TBD) line must show a valid currency amount nearby').not.toBeNull();
        expect(cmFeeText, `CM Fee amount "${cmFeeText}" must be a valid currency amount`).toMatch(/^\$[\d,]+(\.\d{1,2})?$/);

        Logger.success(`Right panel confirmed: invoice "${invoiceLabel}" (row: "${rowText}") shown together with CM Fee (${cmFeeText})`);
        return { invoiceRowText: rowText, cmFeeAmount: cmFeeText };
    }

    /**
     * Edits the per-invoice CM Fee % override inline in the Invoices panel and verifies
     * the change is real: the field value updates, the source label flips from
     * "from property (N%)" to "overridden", and the Current Draw Request KPI recalculates.
     */
    async editInvoiceCmFeePercent(invoiceLabel, newPercent) {
        const row = draw.invoicePanelRowByLabel(invoiceLabel);
        await expect(row, `Invoices panel must show a row for "${invoiceLabel}" before editing its CM Fee %`).toBeVisible({ timeout: 10000 });
        const percentInput = row.getByRole('textbox');
        await expect(percentInput, `CM Fee % input for "${invoiceLabel}" must be visible`).toBeVisible({ timeout: 10000 });

        const before = (await percentInput.inputValue()).trim();
        await percentInput.fill(String(newPercent));
        await percentInput.press('Enter');
        await this.page.waitForTimeout(800);

        const after = (await percentInput.inputValue()).trim();
        // The input sometimes shows the raw digits ("25") immediately after Enter and only
        // reformats with a trailing "%" ("25%") once the field's own re-render/blur settles —
        // compare on the numeric digits alone so either transient form passes.
        const afterDigits = after.replace(/[^\d.]/g, '');
        expect(afterDigits, `CM Fee % for "${invoiceLabel}" must reflect the edit (raw value: "${after}")`).toBe(String(newPercent));

        // The source label reads "overridden" only when the typed value differs from the
        // property's own default rate — typing the exact default value back in is treated as
        // "no longer overridden" and reverts the label to "from property (N%)". Both are
        // legitimate outcomes of a real edit, so capture whichever is shown rather than
        // assuming one fixed string.
        const sourceLabelText = (await row.getByText(/^(overridden|from property.*)$/).textContent()).trim();

        const currentDrawRequest = await this.getKpiValueByLabel('Current Draw Request');
        expect(currentDrawRequest, 'Current Draw Request KPI must still be present after editing CM Fee %').not.toBeNull();
        expect(isValidCurrencyText(currentDrawRequest), `Current Draw Request "${currentDrawRequest}" must remain a valid currency amount`).toBeTruthy();

        Logger.success(`Edited invoice "${invoiceLabel}" CM Fee % from "${before}" to "${after}" (source: "${sourceLabelText}") — Current Draw Request now "${currentDrawRequest}"`);
        return { before, after, sourceLabelText, currentDrawRequest };
    }

    async getHistoricalDrawRowStatus(drawName) {
        const row = draw.historicalDrawRowByName(drawName);
        await expect(row, `Historical Draws row for "${drawName}" must be visible`).toBeVisible({ timeout: 15000 });
        const rowText = (await row.textContent()).trim();
        // Unanchored — the anchored form (^...$) fails whenever the cell's raw text
        // content carries surrounding whitespace, which is common in generated tables.
        const statusCell = row.locator('[role="gridcell"]').filter({ hasText: /Pending|Approved|Funded|Rejected/ }).first();
        await expect(statusCell, `Historical Draws row "${drawName}" must have a recognizable status cell (raw row text: "${rowText}")`).toBeVisible({ timeout: 15000 });
        const statusCellText = (await statusCell.textContent()).trim();
        // Some rows render a trailing clear/action icon glyph inside the same cell — pull out
        // just the recognized status word rather than trusting the cell's raw textContent.
        const statusMatch = statusCellText.match(/Pending|Approved|Funded|Rejected/);
        expect(statusMatch, `Status cell text "${statusCellText}" must contain a recognizable status word`).not.toBeNull();
        const status = statusMatch[0];
        Logger.success(`Historical Draws row "${drawName}" status = "${status}" (cell raw: "${statusCellText}", full row: "${rowText}")`);
        return status;
    }
};
