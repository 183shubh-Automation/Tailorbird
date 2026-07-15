const { expect } = require('@playwright/test');
const { Logger } = require('../utils/logger');
const PropertiesHelper = require('./properties');
const { InvoicePage } = require('./invoicePage');
const { reassignInvoiceLocators } = require('../locators/reassignInvoiceLocator');

/**
 * Page object for the "Reassign Invoice" feature.
 * Composes the existing PropertiesHelper / InvoicePage page objects (reused as-is,
 * neither is modified) and adds only what is new: Property → Job navigation via the
 * property's "Jobs" stat, the $5 invoice-amount helper, and the Reassign Invoice modal.
 */
class ReassignInvoicePage {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        this.page = page;
        this.properties = new PropertiesHelper(page);
        this.invoicePage = new InvoicePage(page);
        this.loc = reassignInvoiceLocators(page);
    }

    // ── Property → Job → Invoice tab navigation ─────────────────────────────────

    async openPropertyByName(propertyName) {
        Logger.step(`Opening property: ${propertyName}`);
        await this.properties.goToProperties();
        await this.properties.searchProperty(propertyName);

        const tableCell = this.loc.propertyTableCell(propertyName);
        const cardLink = this.loc.propertyCardLink(propertyName);
        if (await tableCell.isVisible({ timeout: 3000 }).catch(() => false)) {
            await tableCell.click();
        } else {
            await cardLink.click();
        }
        await expect(this.page).toHaveURL(/\/properties\/details/, { timeout: 20000 });
        await this.page.waitForTimeout(1500);
        Logger.success(`Opened property details: ${propertyName}`);
    }

    /**
     * Opens the property's Jobs list (via the Overview "Jobs" stat) and navigates into
     * one job scoped to that property — the first job by default, or a specific job by name.
     * @param {string} propertyName
     * @param {{ jobName?: string }} [options]
     * @returns {Promise<string>} the opened job's name
     */
    async openJobOfProperty(propertyName, { jobName } = {}) {
        await this.openPropertyByName(propertyName);

        Logger.step(`Opening Jobs list for property: ${propertyName}`);
        await this.loc.jobsStatButton.click();
        await this.page.waitForURL(/\/jobs/, { timeout: 20000 });
        await this.loc.jobsGrid.waitFor({ state: 'visible', timeout: 20000 });
        await this.page.waitForTimeout(1000);

        const propertyJobRows = this.loc.jobRowsForProperty(propertyName);
        await expect(
            propertyJobRows.first(),
            `No jobs found for property "${propertyName}"`
        ).toBeVisible({ timeout: 15000 });

        const targetRow = jobName ? propertyJobRows.filter({ hasText: jobName }).first() : propertyJobRows.first();
        await expect(targetRow, `Job "${jobName}" not found for property "${propertyName}"`).toBeVisible({ timeout: 10000 });

        const rawJobName = (await targetRow.locator('[role="gridcell"]').first().textContent().catch(() => ''));
        const resolvedJobName = ReassignInvoicePage.stripClearIcon(rawJobName);
        const jobLink = this.loc.jobIdLinkInRow(targetRow);

        await jobLink.click();
        await this.page.waitForURL(/\/jobs\/\d+/, { timeout: 20000 });
        await this.page.waitForLoadState('load');
        await this.page.waitForTimeout(1500);
        Logger.success(`Opened job "${resolvedJobName}" for property "${propertyName}"`);
        return resolvedJobName;
    }

    /** Selects the first job listed for the property. */
    async openFirstJobOfProperty(propertyName) {
        return this.openJobOfProperty(propertyName);
    }

    async openInvoiceTab() {
        await this.invoicePage.navigateToInvoiceTab();
    }

    // ── $5 invoice creation ──────────────────────────────────────────────────────

    /**
     * New method — fills exactly $5 into the invoice grid's amount cell.
     * Reuses InvoicePage.fillInvoiceGridAmount(amount) (existing, untouched) rather than
     * duplicating its cell-edit logic.
     */
    async fillFiveDollarAmount() {
        return this.invoicePage.fillInvoiceGridAmount(5);
    }

    /**
     * Creates a complete invoice with a $5 amount.
     * Reuses InvoicePage.clickAddInvoice / getInvoiceNumber / fillInvoiceDetails (existing,
     * untouched) — the only new piece is fillFiveDollarAmount() above.
     * @param {string} title
     * @param {string} description
     * @returns {Promise<string>} the invoice number, e.g. "Invoice #16553"
     */
    async createFiveDollarInvoice(title, description) {
        Logger.step(`Creating $5 invoice: ${title}`);
        await this.invoicePage.clickAddInvoice();
        const invoiceNumber = await this.invoicePage.getInvoiceNumber();
        await this.invoicePage.fillInvoiceDetails({ title, description });

        const amountFilled = await this.fillFiveDollarAmount();
        expect(amountFilled, 'Failed to fill the $5 invoice amount').toBeTruthy();

        Logger.success(`Invoice ${invoiceNumber} created with $5 amount`);
        return invoiceNumber;
    }

    /** Reuses InvoicePage.confirmInvoiceAndHandleModal (existing, untouched). */
    async confirmAndApproveInvoice() {
        return this.invoicePage.confirmInvoiceAndHandleModal();
    }

    // ── Invoice list helpers ─────────────────────────────────────────────────────

    /** Returns the full text of the invoice's row (contains amount + status columns), or null if not found. */
    async getInvoiceRowText(invoiceNumber) {
        const rows = this.loc.invoiceDataRows;
        const count = await rows.count().catch(() => 0);
        for (let i = 0; i < count; i++) {
            const text = await rows.nth(i).textContent().catch(() => '');
            if (text.includes(invoiceNumber)) return text;
        }
        return null;
    }

    /**
     * Polls the current (unfiltered) invoice grid until the invoice's row renders and returns
     * its full text. Deliberately reads the already-rendered grid instead of using
     * InvoicePage.getInvoiceStatusBySearch: that method depends on the list's search box
     * literally matching the "#" in "Invoice #NNNN", which the search backend does not always
     * honor, and it has no retry — a proven source of flakiness (a freshly created/reassigned
     * row can be sitting right there in the grid while the search-based lookup returns null).
     * Uses Playwright's expect(...).toPass() retry idiom rather than a hand-rolled wait loop.
     * @param {string} invoiceNumber
     * @param {{ timeout?: number }} [options]
     * @returns {Promise<string>}
     */
    async waitForInvoiceRowText(invoiceNumber, { timeout = 30000 } = {}) {
        let rowText = null;
        await expect(async () => {
            rowText = await this.getInvoiceRowText(invoiceNumber);
            expect(rowText, `Invoice row "${invoiceNumber}" not yet visible in grid`).toBeTruthy();
        }).toPass({ timeout, intervals: [1000, 2000, 3000] });
        return rowText;
    }

    /** Polls until the invoice's row is confirmed absent from the current (unfiltered) grid. */
    async waitForInvoiceAbsent(invoiceNumber, { timeout = 20000 } = {}) {
        await expect(async () => {
            const present = await this.isInvoiceInList(invoiceNumber);
            expect(present, `Invoice "${invoiceNumber}" still present — expected it to be gone by now`).toBe(false);
        }).toPass({ timeout, intervals: [1000, 2000, 3000] });
    }

    /** Extracts the Status column value (Draft/Pending Approval/Approved/Rejected) from a row's full text. */
    extractStatusFromRowText(rowText) {
        const match = (rowText || '').match(/(Pending Approval|Approved|Rejected|Draft)/i);
        return match ? match[0] : null;
    }

    /**
     * Robust status read: polls the grid for the row (see waitForInvoiceRowText) and extracts
     * its Status column — no dependency on the invoice-list search box.
     */
    async getInvoiceStatus(invoiceNumber, options) {
        const rowText = await this.waitForInvoiceRowText(invoiceNumber, options);
        return this.extractStatusFromRowText(rowText);
    }

    async isInvoiceInList(invoiceNumber) {
        const rows = this.loc.invoiceDataRows;
        const count = await rows.count().catch(() => 0);
        for (let i = 0; i < count; i++) {
            const text = await rows.nth(i).textContent().catch(() => '');
            if (text.includes(invoiceNumber)) return true;
        }
        return false;
    }

    // ── Reassign Invoice modal ───────────────────────────────────────────────────

    reassignDialog() {
        return this.loc.reassignDialog;
    }

    async openReassignModalForInvoice(invoiceNumber) {
        Logger.step(`Opening Reassign Invoice modal for "${invoiceNumber}"`);
        const dataRows = this.loc.invoiceDataRows;
        const actionRows = this.loc.invoiceActionRows;

        // The Actions column is a separately virtualized revo-grid section — a freshly created
        // row's action buttons can lag behind its data cells. Retry with a reload if the row
        // index found in dataRows isn't yet mirrored in actionRows.
        let idx = -1;
        let targetRow = null;
        for (let attempt = 0; attempt < 3 && idx < 0; attempt++) {
            if (attempt > 0) {
                await this.page.reload({ waitUntil: 'load' });
                await this.page.waitForTimeout(2000);
            }
            const count = await dataRows.count();
            for (let i = 0; i < count; i++) {
                const text = await dataRows.nth(i).textContent().catch(() => '');
                if (text.includes(invoiceNumber)) { idx = i; targetRow = dataRows.nth(i); break; }
            }
        }
        expect(idx, `Invoice row "${invoiceNumber}" not found in grid`).toBeGreaterThanOrEqual(0);

        await targetRow.scrollIntoViewIfNeeded().catch(() => {});
        await this.page.waitForTimeout(500);

        const reassignBtn = this.loc.reassignButtonInActionRow(actionRows.nth(idx));
        await expect(reassignBtn).toBeVisible({ timeout: 10000 });
        await reassignBtn.click();

        await expect(this.loc.reassignDialog).toBeVisible({ timeout: 10000 });
        Logger.success('Reassign Invoice modal opened');
    }

    /**
     * Revogrid-backed fields in this app can carry a trailing "✕" clear-icon character in their
     * value (same quirk documented elsewhere in this framework, e.g. approval template names) —
     * strip it so captured values reflect the actual field content.
     */
    static stripClearIcon(value) {
        return (value || '').replace(/✕.*$/, '').trim();
    }

    /**
     * The New Project / New Job / scope comboboxes lazily fetch their options and show a
     * transient "Loading …" placeholder before settling — reading/opening them too early is a
     * proven source of flakiness (the placeholder/options captured on one modal-open pass can
     * differ from the next). Wait past it with a web-first assertion instead of a fixed sleep.
     */
    async waitForFieldReady(input, { timeout = 15000 } = {}) {
        await expect(input).not.toHaveAttribute('placeholder', /loading/i, { timeout }).catch(() => {});
    }

    /** Captures the modal's static text/labels/current-assignment values (no dropdown interaction). */
    async captureStaticModalContent() {
        const dlg = this.loc.reassignDialog;
        const newProjectInput = this.loc.newProjectInput(dlg);
        await this.waitForFieldReady(newProjectInput);

        return {
            heading: (await this.loc.dialogHeading(dlg).textContent()).trim(),
            currentProject: ReassignInvoicePage.stripClearIcon(await this.loc.currentProjectInput(dlg).inputValue()),
            currentJob: ReassignInvoicePage.stripClearIcon(await this.loc.currentJobInput(dlg).inputValue()),
            currentScope: ReassignInvoicePage.stripClearIcon(await this.loc.currentScopeInput(dlg).inputValue()),
            newProjectLabel: (await this.loc.newProjectLabel(dlg).textContent()).trim(),
            newJobLabel: (await this.loc.newJobLabel(dlg).textContent()).trim(),
            newProjectPlaceholder: await newProjectInput.getAttribute('placeholder'),
            cancelButtonText: (await this.loc.cancelButton(dlg).textContent()).trim(),
            confirmButtonText: (await this.loc.confirmReassignmentButton(dlg).textContent()).trim(),
        };
    }

    /** Opens the "New Project" dropdown and returns its option list. */
    async getNewProjectOptions() {
        const dlg = this.loc.reassignDialog;
        const input = this.loc.newProjectInput(dlg);
        await this.waitForFieldReady(input);
        await input.click();
        await expect(this.loc.newProjectListbox).toBeVisible({ timeout: 10000 });
        const options = await this.loc.newProjectListbox.getByRole('option').allTextContents();
        return options.map((o) => o.trim()).filter(Boolean);
    }

    async selectNewProject(projectName) {
        const dlg = this.loc.reassignDialog;
        const input = this.loc.newProjectInput(dlg);
        await this.waitForFieldReady(input);
        await input.click();
        await expect(this.loc.newProjectListbox).toBeVisible({ timeout: 10000 });
        await this.loc.newProjectListbox.getByRole('option', { name: projectName, exact: true }).click();
    }

    /** Opens the "New Job" dropdown (requires a project already selected) and returns its options. */
    async getNewJobOptions() {
        const dlg = this.loc.reassignDialog;
        const input = this.loc.newJobInput(dlg);
        await this.waitForFieldReady(input);
        await input.click();
        await expect(this.loc.newJobListbox).toBeVisible({ timeout: 10000 });
        const options = await this.loc.newJobListbox.getByRole('option').allTextContents();
        return options.map((o) => o.trim()).filter(Boolean);
    }

    async selectNewJob(jobName) {
        const dlg = this.loc.reassignDialog;
        const input = this.loc.newJobInput(dlg);
        await this.waitForFieldReady(input);
        await input.click();
        await expect(this.loc.newJobListbox).toBeVisible({ timeout: 10000 });
        await this.loc.newJobListbox.getByRole('option', { name: jobName, exact: true }).click();
    }

    /** Opens the scope-allocation "Select scope" dropdown (requires a job already selected) and returns its options. */
    async getScopeOptions() {
        const dlg = this.loc.reassignDialog;
        const input = this.loc.scopeSelectInput(dlg);
        await this.waitForFieldReady(input);
        await input.click();
        await expect(this.loc.openUnlabeledListbox).toBeVisible({ timeout: 10000 });
        const options = await this.loc.openUnlabeledListbox.getByRole('option').allTextContents();
        return options.map((o) => o.trim()).filter(Boolean);
    }

    async selectScope(scopeName) {
        const dlg = this.loc.reassignDialog;
        const input = this.loc.scopeSelectInput(dlg);
        await this.waitForFieldReady(input);
        await input.click();
        await expect(this.loc.openUnlabeledListbox).toBeVisible({ timeout: 10000 });
        await this.loc.openUnlabeledListbox.getByRole('option', { name: scopeName, exact: true }).click();
    }

    async getTotalAllocatedText() {
        const dlg = this.loc.reassignDialog;
        return (await this.loc.totalAllocatedRow(dlg).textContent()).trim();
    }

    async isConfirmReassignmentEnabled() {
        const dlg = this.loc.reassignDialog;
        return this.loc.confirmReassignmentButton(dlg).isEnabled();
    }

    async confirmReassignment() {
        const dlg = this.loc.reassignDialog;
        const btn = this.loc.confirmReassignmentButton(dlg);
        await expect(btn).toBeEnabled({ timeout: 10000 });
        await btn.click();
        await expect(this.loc.reassignSuccessToast).toBeVisible({ timeout: 15000 });
        Logger.success('Invoice reassigned — success toast verified');
    }

    async cancelReassignModal() {
        const dlg = this.loc.reassignDialog;
        await this.loc.cancelButton(dlg).click();
        await expect(dlg).not.toBeVisible({ timeout: 10000 });
    }
}

module.exports = { ReassignInvoicePage };
