const { expect } = require('@playwright/test');
const { Logger } = require('../utils/logger');
const { multiApproverLocators } = require('../locators/multiApproverLocator');

exports.DrawReportingInvoiceJob = class DrawReportingInvoiceJob {
    constructor(page) {
        this.page = page;
    }

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

        // Reuses the proven column-index-based cell lookup from multiApproverLocator.js —
        // more robust than matching on the cell's placeholder text ("—" before any value is set).
        const loc = multiApproverLocators(this.page);
        await expect(loc.invoiceAmountColumnHeader, 'Invoice Amount column header must be visible').toBeVisible({ timeout: 15000 });
        const colIndex = await loc.invoiceAmountColumnHeader.evaluate((el) => el.getAttribute('data-rgcol') || el.getAttribute('aria-colindex'));
        if (!colIndex) throw new Error('Could not resolve Invoice Amount column index');
        const amountCell = loc.invoiceGridDataCellByColIndex(colIndex);
        await amountCell.scrollIntoViewIfNeeded().catch(() => { });
        await amountCell.dblclick();
        const amountEditor = loc.invoiceAmountEditorInput;
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
};
