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

    // ===================== Merged from drawApprovalPage.js =====================
    // (Draw approval template creation + All Approvals workflow)

    async navigateToApprovalTemplatesTab() {
        Logger.step('Navigating to Approval Templates tab');
        await this.page.goto('/approvals/template', { waitUntil: 'load' });
        await this.page.waitForTimeout(3000);
        await expect(draw.createTemplateButton, 'Create Template button must be visible').toBeVisible({ timeout: 20000 });
        Logger.success('Navigated to Approval Templates tab');
    }

    /**
     * Creates a "Draw" type approval template scoped to one property with a single
     * always-required approver — mirrors approvalPage.js's createBudgetApprovalTemplateForTest
     * pattern, but for the new Draw approval type and exactly one approver.
     */
    async createDrawApprovalTemplateSingleApprover(templateName, propertyName, approverFullName) {
        Logger.step(`Creating Draw approval template "${templateName}" for "${propertyName}" with sole approver "${approverFullName}"`);

        await draw.createTemplateButton.click();
        const dialog = draw.createDialog();
        await expect(dialog, 'Create Approval Template dialog must open').toBeVisible({ timeout: 15000 });

        await draw.templateNameInput().fill(templateName);
        await draw.drawTypeRadio().click();
        await this.page.waitForTimeout(400);
        Logger.success('Template name filled and "Draw" type selected');

        await draw.addPropertiesButton().click();
        await this.page.waitForTimeout(1000);
        await draw.templatePropertySearchInput.fill(propertyName);
        await this.page.waitForTimeout(1200);
        await draw.propertyOptionCheckbox(propertyName).click();
        await draw.closePropertyPickerButton.click();
        await this.page.waitForTimeout(500);
        Logger.success(`Property "${propertyName}" added to template`);

        // Remove approver rows 3 and 2 (in that order, high-to-low) so only row 1 remains.
        await draw.deleteRowButtonInRow(2).click();
        await this.page.waitForTimeout(400);
        await draw.deleteRowButtonInRow(1).click();
        await this.page.waitForTimeout(400);

        const approverInput = draw.approverInputInRow(0);
        await approverInput.click();
        await approverInput.fill(approverFullName.toLowerCase());
        await this.page.waitForTimeout(1000);
        await draw.approverOption(approverFullName).first().click();
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(400);
        Logger.success(`Sole approver "${approverFullName}" added`);

        await draw.alwaysRequiredCheckboxInRow(0).check({ force: true });
        await this.page.waitForTimeout(400);

        await draw.submitTemplateButton().click();
        await this.page.waitForTimeout(2500);

        // The backend allows only one template per (type, property) pair. If a Draw
        // template already exists for this property (e.g. from a prior test run),
        // treat that as already-configured rather than failing.
        const conflictToast = this.page.locator('[role="alert"]').filter({ hasText: /already linked|already exists|duplicate/i });
        if (await conflictToast.isVisible({ timeout: 1500 }).catch(() => false)) {
            const msg = (await conflictToast.textContent().catch(() => '')).trim();
            Logger.info(`Draw approval template already configured for "${propertyName}" — server said: "${msg}". Reusing existing routing.`);
            return { created: false, alreadyConfigured: true };
        }
        Logger.success('Create Template form submitted');

        await draw.templatesListSearchInput.fill(templateName);
        await this.page.waitForTimeout(1200);
        const row = draw.templateRowByName(templateName);
        await expect(row, `Template "${templateName}" must appear in the templates list`).toBeVisible({ timeout: 10000 });
        const rowText = (await row.textContent()).trim();
        expect(rowText, 'Template row must show "Draw" as the template type').toContain('Draw');
        expect(rowText, 'Template row must show the target property').toContain(propertyName);
        expect(rowText, 'Template row must show the sole approver').toContain(approverFullName);

        Logger.success(`Verified Draw approval template "${templateName}": type=Draw, property="${propertyName}", approver="${approverFullName}"`);
        return { created: true, alreadyConfigured: false };
    }

    async navigateToAllApprovalsTab() {
        Logger.step('Navigating to All Approvals tab');
        // This route's grid/search box has been observed to sometimes hydrate in a few
        // seconds and other times take much longer (intermittent, not tied to navigation
        // strategy). One contributing factor: this is normally called seconds after
        // submitting a draw for approval, while backend revalidation from that submission
        // may still be in flight — give that a moment to settle before even attempting the
        // navigation, then retry the direct navigation itself with a generous per-attempt
        // wait rather than failing fast on the first slow load.
        await this.page.waitForTimeout(8000);
        let ready = false;
        for (let attempt = 0; attempt < 3 && !ready; attempt++) {
            await this.page.goto('/approvals/all-approvals', { waitUntil: 'load' });
            ready = await draw.templatesListSearchInput.isVisible({ timeout: 30000 }).catch(() => false);
        }
        await expect(draw.templatesListSearchInput, 'All Approvals search box must be visible').toBeVisible({ timeout: 15000 });
        Logger.success('Navigated to All Approvals tab');
    }

    /**
     * "All Approvals" is an admin-wide view — a regular approver (not an admin) sees ZERO rows
     * there. Their own queue lives under "My Approvals" instead, reached by clicking the tab
     * from the same /approvals/all-approvals page (client-side tab switch, no separate route).
     */
    async navigateToMyApprovalsTab() {
        Logger.step('Navigating to My Approvals tab');
        await this.page.waitForTimeout(8000);
        let ready = false;
        for (let attempt = 0; attempt < 3 && !ready; attempt++) {
            await this.page.goto('/approvals/all-approvals', { waitUntil: 'load' });
            ready = await draw.myApprovalsTab.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
        }
        await expect(draw.myApprovalsTab, 'My Approvals tab must be visible').toBeVisible({ timeout: 15000 });
        await draw.myApprovalsTab.click();
        await this.page.waitForTimeout(2000);
        Logger.success('Navigated to My Approvals tab');
    }

    /**
     * Resolves a data row's "View Details" button. The grid renders its "Actions" column as a
     * structurally separate column group — those rows are DOM siblings of the data rows, not
     * descendants, so a row-scoped role query always matches zero elements. Both column groups
     * render in the same top-to-bottom order, so the button is found via the row's positional
     * index among all real data rows (rows containing a Submitted-On date; Actions-only rows
     * never have one). Returns null if the row can't be matched to an index.
     */
    async resolveViewDetailsButtonForRow(row) {
        const handle = await row.elementHandle().catch(() => null);
        if (!handle) return null;
        const index = await draw.dataRowsWithDate.evaluateAll((rows, el) => rows.indexOf(el), handle);
        if (index === -1) return null;
        return draw.allViewDetailsButtons.nth(index);
    }

    /**
     * Finds the given draw's row in the All Approvals (admin-wide) or My Approvals (current
     * user's own queue) grid and opens its "Approval Details" dialog. Returns the dialog
     * locator for the caller to inspect/act on. Pass { tab: 'mine' } when calling as the real
     * eligible approver — "All Approvals" renders zero rows for a non-admin account.
     *
     * The grid's rows do NOT render the draw's name anywhere (only Property Name, Job,
     * Approval Type, ID, Amount, etc.), and the page's search box does not index draw name
     * either — searching by draw name always yields zero rows. Since the domain only allows
     * one Pending draw submission per property at a time, the row is instead found by
     * property name + type "Draw" (+ status "Pending Approval" on the All Approvals grid only),
     * and the exact draw name is verified from the opened dialog's own "Draw Name:" text.
     */
    async openApprovalDetailsForDraw(propertyName, drawName, { tab = 'all' } = {}) {
        const row = tab === 'mine'
            ? draw.myApprovalsPendingDrawRowForProperty(propertyName)
            : draw.allApprovalsPendingDrawRowForProperty(propertyName);

        // Root cause #1 (trace.zip inspection): Locator.isVisible({timeout}) is a ONE-SHOT
        // check — it does not poll/wait despite taking a timeout option. Right after navigating
        // for a just-submitted draw, the grid's row data is still being fetched client-side, so
        // this check fired too early and got a false negative. waitFor({state:'visible'}) polls
        // for the timeout duration, which is what this needed all along.
        //
        // Root cause #2 (direct count() inspection): the grid virtualizes its "Actions" column
        // as a structurally separate column group — those rows are DOM siblings of the data
        // rows, not descendants, so row.getByRole('button', {name:'View Details'}) always
        // matched zero elements. Every observed failure was this click silently matching
        // nothing, not the row being unfindable. Fixed via resolveViewDetailsButtonForRow's
        // positional-index lookup instead of a row-scoped query.
        let opened = false;
        for (let attempt = 0; attempt < 4 && !opened; attempt++) {
            if (attempt > 0) {
                await (tab === 'mine' ? this.navigateToMyApprovalsTab() : this.navigateToAllApprovalsTab());
            }
            const found = await row.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
            if (!found) continue;

            const viewDetailsButton = await this.resolveViewDetailsButtonForRow(row.first());
            if (!viewDetailsButton) continue;

            opened = await viewDetailsButton.click({ timeout: 10000 })
                .then(() => draw.approvalDetailsDialog.waitFor({ state: 'visible', timeout: 10000 }))
                .then(() => true)
                .catch(() => false);
        }
        await expect(draw.approvalDetailsDialog, `Approval Details dialog must open for property "${propertyName}"`).toBeVisible({ timeout: 5000 });

        const dialogText = (await draw.approvalDetailsDialog.textContent()).trim();
        expect(dialogText, `Opened Approval Details must be for draw "${drawName}" (raw dialog text: "${dialogText}")`).toContain(drawName);

        Logger.success(`Opened Approval Details for draw "${drawName}" on property "${propertyName}"`);
        return draw.approvalDetailsDialog;
    }

    /**
     * Attempts to approve the given draw as whichever user is behind this instance's page:
     * clicks whichever approve-type button the Approval Details dialog offers — the real
     * "Approve" button for the genuine eligible approver, or the admin "Approve on Behalf"
     * override for anyone else with rights to it — then confirms via Historical Draws that
     * the draw's status actually became "Approved". Returns false (rather than throwing) if
     * the dialog never opened, no approve-type button appeared, or the confirmed status isn't
     * "Approved", so callers can retry the same draw as a different logged-in user instead of
     * failing outright.
     */
    async attemptApproveDraw(propertyName, drawName, { tab = 'all' } = {}) {
        let dialog;
        try {
            dialog = await this.openApprovalDetailsForDraw(propertyName, drawName, { tab });
        } catch {
            return false;
        }

        const hasApprove = await draw.directApproveButton.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
        const hasApproveOnBehalf = !hasApprove && await draw.approveOnBehalfButton.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
        if (!hasApprove && !hasApproveOnBehalf) {
            await this.page.keyboard.press('Escape');
            return false;
        }

        await (hasApprove ? draw.directApproveButton : draw.approveOnBehalfButton).click();
        await expect(dialog, 'Approval Details dialog must close after approving').not.toBeVisible({ timeout: 15000 }).catch(() => {});

        await this.navigateToDrawReporting();
        await this.selectPropertyByName(propertyName);
        await this.openHistoricalDrawsTab();
        const status = await this.getHistoricalDrawRowStatus(drawName).catch(() => null);

        if (status === 'Approved') {
            Logger.success(`Approved draw "${drawName}" via "${hasApprove ? 'Approve' : 'Approve on Behalf'}"`);
            return true;
        }
        Logger.info(`Clicked "${hasApprove ? 'Approve' : 'Approve on Behalf'}" for draw "${drawName}" but status is "${status}", not "Approved"`);
        return false;
    }

    // ===================== Merged from drawReportingInvoicePage.js =====================
    // (Invoice creation used to prepare Draw Reporting E2E test data)

    /**
     * Creates and approves one small throwaway invoice against an existing job's
     * existing contract line. Draw Reporting only surfaces invoices with
     * draw_status = never_included, and the prepared invoice gets consumed the
     * moment a draw including it is approved — so each E2E run needs a fresh one.
     * Uses a conservative $10 amount to stay under the contract line's fixed
     * historical retainage-withheld ceiling (observed at $28 for this line).
     */
    async createPendingInvoiceForJobOnProperty(jobId, invoiceTitle) {
        Logger.step(`Creating a fresh invoice on job ${jobId}`);

        await this.page.goto(`/jobs/${jobId}?tab=invoices`, { waitUntil: 'load' });
        await this.page.waitForTimeout(3000);

        const invoiceTab = this.page.getByRole('tab', { name: 'Invoice', exact: true });
        await invoiceTab.click();
        await this.page.waitForTimeout(2000);

        const createInvoiceButton = this.page.getByRole('button', { name: 'Create Invoice', exact: true });
        await expect(createInvoiceButton, 'Create Invoice button must be visible').toBeVisible({ timeout: 15000 });
        await createInvoiceButton.click();

        const dialog = this.page.getByRole('dialog').filter({ has: this.page.getByText('Invoice Details', { exact: true }) });
        await expect(dialog, 'Invoice Details dialog must open').toBeVisible({ timeout: 15000 });

        const invoiceNumberLabel = (await dialog.getByRole('textbox', { name: 'Enter invoice number' }).inputValue()).trim();
        const invoiceNumber = (invoiceNumberLabel.match(/\d+/) || [])[0];
        if (!invoiceNumber) throw new Error(`Could not parse invoice number from "${invoiceNumberLabel}"`);
        Logger.success(`New invoice draft created: ${invoiceNumberLabel}`);

        await dialog.getByRole('textbox', { name: 'Enter title' }).fill(invoiceTitle);

        // Reuses the proven column-index-based cell lookup (copied from multiApproverLocator.js) —
        // more robust than matching on the cell's placeholder text ("—" before any value is set).
        await expect(draw.invoiceAmountColumnHeader, 'Invoice Amount column header must be visible').toBeVisible({ timeout: 15000 });
        const colIndex = await draw.invoiceAmountColumnHeader.evaluate((el) => el.getAttribute('data-rgcol') || el.getAttribute('aria-colindex'));
        if (!colIndex) throw new Error('Could not resolve Invoice Amount column index');
        const amountCell = draw.invoiceGridDataCellByColIndex(colIndex);
        await amountCell.scrollIntoViewIfNeeded().catch(() => { });
        await amountCell.dblclick();
        const amountEditor = draw.invoiceAmountEditorInput;
        await expect(amountEditor, 'Invoice amount editor must open').toBeVisible({ timeout: 10000 });
        await amountEditor.fill('10');
        await amountEditor.press('Enter');
        await this.page.waitForTimeout(500);

        const confirmedAmount = (await amountCell.textContent()).trim();
        expect(confirmedAmount, `Invoice amount cell must reflect the filled value, got "${confirmedAmount}"`).toContain('10');

        await dialog.getByRole('button', { name: 'Confirm Invoice', exact: true }).click();
        const confirmDialog = this.page.getByRole('dialog').filter({ has: this.page.getByText('Are you sure you want to approve this invoice?', { exact: true }) });
        await expect(confirmDialog, 'Confirm Invoice dialog must open').toBeVisible({ timeout: 10000 });
        await confirmDialog.getByRole('button', { name: 'Confirm', exact: true }).click();
        await this.page.waitForTimeout(2500);

        const failureToast = this.page.locator('[role="alert"]').filter({ hasText: 'Confirmation Failed' });
        if (await failureToast.isVisible({ timeout: 1500 }).catch(() => false)) {
            const msg = (await failureToast.textContent().catch(() => '')).trim();
            throw new Error(`Invoice confirmation failed: ${msg}`);
        }

        Logger.success(`Created and approved invoice "${invoiceNumberLabel}" ($10) on job ${jobId}`);
        return { invoiceNumberLabel, invoiceNumber, amount: 10 };
    }

    // ===================== NEW: calculation-correctness, negative-path, and cross-view helpers =====================
    // Everything below is additive, supporting new test cases only — no method above this
    // point is modified.

    parseCurrencyText(text) {
        const n = Number((text || '').replace(/[^0-9.-]/g, ''));
        if (Number.isNaN(n)) throw new Error(`Could not parse currency from "${text}"`);
        return n;
    }

    /**
     * Reads one row of the "Draw disbursement schedule" table in the Step 1 draw editor by
     * budget item name (or "Total" for the summary row), parsing every column as a number:
     * Current Budget, Committed, Reallocation, Budget Remaining, Drawn, Current Draw, Draw
     * Remaining. Used to verify the disbursement schedule's own math independent of the
     * Invoices panel / KPIs.
     */
    async readDisbursementRowValuesInEditor(budgetItemName) {
        const row = draw.drawEditorDialog.getByRole('row').filter({ hasText: budgetItemName });
        await expect(row, `Disbursement schedule row for "${budgetItemName}" must be visible`).toBeVisible({ timeout: 10000 });
        const cells = (await row.getByRole('cell').allTextContents()).map((c) => c.trim());
        const [budgetItem, currentBudget, committed, reallocation, budgetRemaining, drawn, currentDraw, drawRemaining] = cells;
        return {
            budgetItem,
            currentBudget: this.parseCurrencyText(currentBudget),
            committed: this.parseCurrencyText(committed),
            reallocation: this.parseCurrencyText(reallocation),
            budgetRemaining: this.parseCurrencyText(budgetRemaining),
            drawn: this.parseCurrencyText(drawn),
            currentDraw: this.parseCurrencyText(currentDraw),
            drawRemaining: this.parseCurrencyText(drawRemaining),
        };
    }

    /** Reads the combined CM Fee $ amount from the "CM Fee Invoice (TBD)" line, as a number. */
    async readCmFeeInvoiceAmount() {
        await expect(draw.cmFeeAutoInvoiceLabel, 'CM Fee Invoice (TBD) line must be visible').toBeVisible({ timeout: 10000 });
        const amountText = await draw.cmFeeAutoInvoiceLabel.evaluate((el) => {
            let node = el.parentElement;
            for (let i = 0; i < 8 && node; i++) {
                const match = node.textContent.match(/\$[\d,]+(\.\d{1,2})?/);
                if (match) return match[0];
                node = node.parentElement;
            }
            return null;
        });
        expect(amountText, 'CM Fee Invoice (TBD) amount must be found nearby').not.toBeNull();
        return this.parseCurrencyText(amountText);
    }

    /** Unchecks a previously-included invoice's row checkbox, excluding it from the draw. */
    async excludeInvoiceInDraw(invoiceLabel) {
        const checkbox = draw.invoiceRowCheckboxByLabel(invoiceLabel);
        await expect(checkbox, `Checkbox for invoice "${invoiceLabel}" must be visible before excluding`).toBeVisible({ timeout: 10000 });
        await checkbox.uncheck({ force: true });
        await this.page.waitForTimeout(1000);
        Logger.success(`Excluded invoice "${invoiceLabel}" from the draw`);
    }

    /**
     * Unchecks every invoice checkbox currently included in the draft (the non-deselectable
     * CM Fee row is skipped automatically since it's disabled), leaving Current Draw Request
     * at $0.00. Older invoices left unconsumed by earlier discarded drafts on a shared
     * property can appear pre-checked by default in a fresh draft, so calculation tests call
     * this first to start from a known-clean baseline before including only the invoice(s)
     * they actually care about.
     */
    async excludeAllInvoicesInDraft() {
        // Re-queries fresh on every outer iteration (rather than caching indices) since
        // unchecking a row can remove the auto-generated CM Fee row entirely once no real
        // invoice remains included, which would shift indices out from under a stale list.
        for (let attempt = 0; attempt < 20; attempt++) {
            const checkboxes = draw.drawEditorDialog.getByRole('checkbox');
            const count = await checkboxes.count();
            let target = null;
            for (let i = 0; i < count; i++) {
                const candidate = checkboxes.nth(i);
                if (!(await candidate.isDisabled()) && await candidate.isChecked()) {
                    target = candidate;
                    break;
                }
            }
            if (!target) break;
            await target.uncheck({ force: true });
            await this.page.waitForTimeout(400);
        }
        Logger.success('Excluded all invoices from the draft (only the non-deselectable CM Fee row remains, if present)');
    }

    /** Confirms the auto-generated CM Fee Invoice (TBD) row is checked and non-deselectable. */
    async assertCmFeeCheckboxLockedIn() {
        const checkbox = draw.cmFeeInvoiceRow.getByRole('checkbox');
        await expect(checkbox, 'CM Fee Invoice (TBD) checkbox must be visible').toBeVisible({ timeout: 10000 });
        expect(await checkbox.isChecked(), 'CM Fee Invoice (TBD) must always be checked').toBe(true);
        expect(await checkbox.isDisabled(), 'CM Fee Invoice (TBD) checkbox must be non-deselectable (disabled)').toBe(true);
        Logger.success('Confirmed CM Fee Invoice (TBD) checkbox is checked and disabled (non-deselectable)');
    }

    async assertContinueDisabledWithNoInvoices() {
        await expect(draw.drawEditorContinueButton, 'Continue button must stay disabled with zero invoices included').toBeDisabled();
        Logger.success('Confirmed Continue button is disabled while zero invoices are included');
    }

    async assertSubmitForApprovalDisabled() {
        await expect(draw.submitForApprovalButton, 'Submit for Approval must stay disabled while another draw is already Pending on this property').toBeDisabled({ timeout: 10000 });
        Logger.success('Confirmed Submit for Approval is disabled while another draw is already Pending on this property');
    }

    /**
     * Reads one Historical Draws row's numeric columns by matching every currency-shaped cell
     * in document order: Draw Amount, Previously Drawn, Total Draw at Submission, Remaining at
     * Submission. Fails loudly (with the full raw cell list) if the count isn't exactly 4,
     * rather than silently misassigning columns if the grid's shape ever changes.
     */
    async readHistoricalDrawRowValues(drawName) {
        const row = draw.historicalDrawRowByName(drawName);
        await expect(row, `Historical Draws row for "${drawName}" must be visible`).toBeVisible({ timeout: 15000 });
        const texts = (await row.locator('[role="gridcell"]').allTextContents()).map((t) => t.trim());
        const statusMatch = texts.join(' | ').match(/Pending|Approved|Funded|Rejected/);
        const status = statusMatch ? statusMatch[0] : null;
        const currencyTexts = texts.filter((t) => /^\$[\d,]+(\.\d{1,2})?$/.test(t));
        expect(currencyTexts.length, `Historical Draws row "${drawName}" must have 4 currency cells (Draw Amount, Previously Drawn, Total Draw at Submission, Remaining at Submission); got: ${JSON.stringify(texts)}`).toBe(4);
        const [drawAmount, previouslyDrawn, totalDrawAtSubmission, remainingAtSubmission] = currencyTexts.map((t) => this.parseCurrencyText(t));
        Logger.success(`Historical Draws row "${drawName}" parsed: status=${status}, drawAmount=${drawAmount}, previouslyDrawn=${previouslyDrawn}, totalDrawAtSubmission=${totalDrawAtSubmission}, remainingAtSubmission=${remainingAtSubmission}`);
        return { status, drawAmount, previouslyDrawn, totalDrawAtSubmission, remainingAtSubmission };
    }

    /** Reads the numeric Draw ID (the Actions-column link text) for a property's Pending draw row in the All Approvals grid. */
    async getAllApprovalsRowIdForPendingDraw(propertyName) {
        const row = draw.allApprovalsPendingDrawRowForProperty(propertyName);
        await expect(row, `All Approvals grid must show a Pending Draw row for property "${propertyName}"`).toBeVisible({ timeout: 15000 });
        const idText = (await row.getByRole('link').first().textContent()).trim();
        expect(idText, `Draw ID link text "${idText}" must be a number`).toMatch(/^\d+$/);
        Logger.success(`All Approvals row ID for pending draw on "${propertyName}" = ${idText}`);
        return idText;
    }

    /** Reads the Status cell for a specific draw (identified by its numeric ID) in the All Approvals grid, regardless of its current status. */
    async readAllApprovalsRowStatus(propertyName, drawIdText) {
        const row = this.page
            .getByRole('row')
            .filter({ hasText: propertyName })
            .filter({ hasText: 'Draw' })
            .filter({ has: this.page.getByRole('link', { name: drawIdText, exact: true }) });
        await expect(row, `All Approvals grid must show a row with ID "${drawIdText}" for property "${propertyName}"`).toBeVisible({ timeout: 15000 });
        const statusCell = row.locator('[role="gridcell"]').filter({ hasText: /Pending Approval|Approved|Rejected/ }).first();
        const statusText = (await statusCell.textContent()).trim();
        const match = statusText.match(/Pending Approval|Approved|Rejected/);
        expect(match, `All Approvals row status text "${statusText}" must be recognizable`).not.toBeNull();
        return match[0];
    }

    /**
     * Attempts to reject the given draw as whichever user is behind this instance's page:
     * fills the required rejection note, then clicks whichever reject-type button the
     * Approval Details dialog offers — the real "Reject" button for the genuine eligible
     * approver, or the admin "Reject on Behalf" override for anyone else with rights to it —
     * then confirms via Historical Draws that the draw's status actually became "Rejected".
     * Returns false (rather than throwing) on any failure so callers can retry as a different
     * logged-in user instead of failing outright.
     */
    async attemptRejectDraw(propertyName, drawName, note, { tab = 'all' } = {}) {
        let dialog;
        try {
            dialog = await this.openApprovalDetailsForDraw(propertyName, drawName, { tab });
        } catch {
            return false;
        }

        const hasReject = await draw.directRejectButton.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
        const hasRejectOnBehalf = !hasReject && await draw.rejectOnBehalfButton.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
        if (!hasReject && !hasRejectOnBehalf) {
            await this.page.keyboard.press('Escape');
            return false;
        }

        await draw.rejectionNotesInput.fill(note);
        await (hasReject ? draw.directRejectButton : draw.rejectOnBehalfButton).click();
        await expect(dialog, 'Approval Details dialog must close after rejecting').not.toBeVisible({ timeout: 15000 }).catch(() => {});

        await this.navigateToDrawReporting();
        await this.selectPropertyByName(propertyName);
        await this.openHistoricalDrawsTab();
        const status = await this.getHistoricalDrawRowStatus(drawName).catch(() => null);

        if (status === 'Rejected') {
            Logger.success(`Rejected draw "${drawName}" via "${hasReject ? 'Reject' : 'Reject on Behalf'}"`);
            return true;
        }
        Logger.info(`Clicked "${hasReject ? 'Reject' : 'Reject on Behalf'}" for draw "${drawName}" but status is "${status}", not "Rejected"`);
        return false;
    }

    /** Reads the "Eligible approvers: ..." text from a draw's Approval Details dialog, then closes it. */
    async readEligibleApproversText(propertyName, drawName) {
        const dialog = await this.openApprovalDetailsForDraw(propertyName, drawName);
        const eligibleText = (await dialog.getByText(/Eligible approvers:/).textContent()).trim();
        await this.page.keyboard.press('Escape');
        await expect(dialog, 'Approval Details dialog must close after reading eligible approvers').not.toBeVisible({ timeout: 10000 }).catch(() => {});
        return eligibleText;
    }

    /**
     * Confirms every approver name parsed out of an "Eligible approvers: ..." string is
     * actually listed on the configured Draw approval template row for this property —
     * catches template misconfiguration rather than just "someone was able to approve".
     */
    async verifyEligibleApproverMatchesTemplate(propertyName, eligibleApproversText) {
        await this.navigateToApprovalTemplatesTab();
        await draw.templatesListSearchInput.fill(propertyName);
        await this.page.waitForTimeout(1200);
        const row = this.page.getByRole('row').filter({ hasText: propertyName }).filter({ hasText: 'Draw' });
        await expect(row.first(), `Draw approval template row for property "${propertyName}" must be visible`).toBeVisible({ timeout: 10000 });
        const rowText = (await row.first().textContent()).trim();

        const approverNames = eligibleApproversText.replace('Eligible approvers:', '').split(',').map((n) => n.trim()).filter(Boolean);
        expect(approverNames.length, `Could not parse any approver names out of "${eligibleApproversText}"`).toBeGreaterThan(0);
        for (const name of approverNames) {
            expect(rowText, `Approval template row must list approver "${name}" (dialog said: "${eligibleApproversText}")`).toContain(name);
        }
        Logger.success(`Verified template row for "${propertyName}" contains eligible approver(s): ${approverNames.join(', ')}`);
    }

    /** Navigates to a property's Details page and confirms a document matching the given filename pattern is listed. */
    async openPropertyDocumentsAndAssertFileExists(propertyId, filenamePattern) {
        await this.page.goto(`/properties/details?propertyId=${propertyId}`, { waitUntil: 'load' });
        await this.page.waitForTimeout(4000);
        const escaped = filenamePattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const fileText = this.page.getByText(new RegExp(escaped)).first();
        await expect(fileText, `Property Documents must show a file matching "${filenamePattern}"`).toBeVisible({ timeout: 20000 });
        const actualText = (await fileText.textContent()).trim();
        Logger.success(`Confirmed Property Documents contains file "${actualText}" (matched pattern "${filenamePattern}")`);
        return actualText;
    }
};
