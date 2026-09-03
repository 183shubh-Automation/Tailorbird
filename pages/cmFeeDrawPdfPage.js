const { expect } = require('@playwright/test');
const { Logger } = require('../utils/logger');
const { drawReportingLocators } = require('../locators/drawReportingLocator');
const { cmFeeDrawPdfLocators } = require('../locators/cmFeeDrawPdfLocator');
const { downloadAndExtractPdfText } = require('../utils/pdfTextExtractor');

/**
 * CM Fee coverage that spans Invoice creation (with a caller-chosen amount) -> Draw Reporting's
 * Historical Draws detail views -> the generated draw report PDF. Every method here is ADDITIVE:
 * nothing in `pages/drawReportingPage.js`, `pages/invoicePage.js`, or their locator files is
 * modified. `createInvoiceWithAmount` specifically is a parameterized copy of
 * `DrawReportingJob.createPendingInvoiceForJobOnProperty` (same MCP-verified working pattern —
 * column-index-based grid cell resolution, `getByTestId('bird-table-currency-input')` amount
 * editor, Confirm Invoice -> Confirm) — that original method is intentionally left untouched
 * since it's hardcoded to $10 for the existing Draw Reporting suite's own fixtures.
 */
exports.CMFeeDrawPdfPage = class CMFeeDrawPdfPage {
    constructor(page) {
        this.page = page;
        this.draw = drawReportingLocators(page);
        this.loc = cmFeeDrawPdfLocators(page);
    }

    // ===================== Invoice creation with a caller-chosen amount =====================

    /**
     * Creates and approves one invoice against the given job's existing contract line, with the
     * exact amount and title given (unlike the fixed-$10 original this is copied from). Returns
     * the created invoice number and number label. Never touches Retainage — it's left at
     * whatever the contract line inherits by default (0% for the job used by this suite).
     * @param {string|number} jobId
     * @param {string} invoiceTitle
     * @param {string|number} amount
     */
    async createInvoiceWithAmount(jobId, invoiceTitle, amount) {
        Logger.step(`Creating invoice "${invoiceTitle}" for $${amount} on job ${jobId}`);

        await this.page.goto(`/jobs/${jobId}?tab=invoices`, { waitUntil: 'load' });
        await this.page.waitForTimeout(3000);

        const invoiceTab = this.page.getByRole('tab', { name: 'Invoice', exact: true });
        await invoiceTab.click();
        await this.page.waitForTimeout(2000);

        const createInvoiceButton = this.page.getByRole('button', { name: 'Create Invoice', exact: true });
        await expect(createInvoiceButton, 'Create Invoice button must be visible').toBeVisible({ timeout: 45000 });
        await createInvoiceButton.click();

        const dialog = this.page.getByRole('dialog').filter({ has: this.page.getByText('Invoice Details', { exact: true }) });
        await expect(dialog, 'Invoice Details dialog must open').toBeVisible({ timeout: 45000 });

        const invoiceNumberLabel = (await dialog.getByRole('textbox', { name: 'Enter invoice number' }).inputValue()).trim();
        const invoiceNumber = (invoiceNumberLabel.match(/\d+/) || [])[0];
        if (!invoiceNumber) throw new Error(`Could not parse invoice number from "${invoiceNumberLabel}"`);
        Logger.success(`New invoice draft created: ${invoiceNumberLabel}`);

        await dialog.getByRole('textbox', { name: 'Enter title' }).fill(invoiceTitle);

        await expect(this.draw.invoiceAmountColumnHeader, 'Invoice Amount column header must be visible').toBeVisible({ timeout: 45000 });
        const colIndex = await this.draw.invoiceAmountColumnHeader.evaluate((el) => el.getAttribute('data-rgcol') || el.getAttribute('aria-colindex'));
        if (!colIndex) throw new Error('Could not resolve Invoice Amount column index');
        const amountCell = this.draw.invoiceGridDataCellByColIndex(colIndex);
        await amountCell.scrollIntoViewIfNeeded().catch(() => {});
        await amountCell.dblclick();
        const amountEditor = this.draw.invoiceAmountEditorInput;
        await expect(amountEditor, 'Invoice amount editor must open').toBeVisible({ timeout: 45000 });
        await amountEditor.fill(String(amount));
        await amountEditor.press('Enter');
        await this.page.waitForTimeout(500);

        const confirmedAmount = (await amountCell.textContent()).trim();
        expect(confirmedAmount, `Invoice amount cell must reflect the filled value, got "${confirmedAmount}"`).toContain(String(amount));

        await dialog.getByRole('button', { name: 'Confirm Invoice', exact: true }).click();
        const confirmDialog = this.page.getByRole('dialog').filter({ has: this.page.getByText('Are you sure you want to approve this invoice?', { exact: true }) });
        await expect(confirmDialog, 'Confirm Invoice dialog must open').toBeVisible({ timeout: 45000 });
        await confirmDialog.getByRole('button', { name: 'Confirm', exact: true }).click();
        await this.page.waitForTimeout(2500);

        const failureToast = this.page.locator('[role="alert"]').filter({ hasText: 'Confirmation Failed' });
        if (await failureToast.isVisible({ timeout: 45000 }).catch(() => false)) {
            const msg = (await failureToast.textContent().catch(() => '')).trim();
            throw new Error(`Invoice confirmation failed: ${msg}`);
        }

        Logger.success(`Created and approved invoice "${invoiceNumberLabel}" ($${amount}) on job ${jobId}`);
        return { invoiceNumberLabel, invoiceNumber, amount: Number(amount) };
    }

    /**
     * Resolves one of the Historical Draws grid's per-row action icons (View/PDF) by geometric
     * row-alignment rather than DOM nesting. MCP-verified live (2026-09-02) — and consistent with
     * the exact same documented issue this repo already solved for the "All Approvals" grid in
     * `DrawReportingJob.resolveViewDetailsButtonForRow` (drawReportingPage.js, left unmodified):
     * this grid virtualizes its "Actions" column as a structurally SEPARATE column group — those
     * buttons are DOM siblings of the data rows, not descendants, so `row.locator(...)` (any
     * selector) always matches zero of them. Porting that exact proven position-matching pattern
     * here instead of inventing a new one.
     * @param {import('@playwright/test').Locator} row
     * @param {string} iconClass e.g. 'lucide-eye' or 'lucide-file-text'
     */
    async resolveRowActionIconByPosition(row, iconClass) {
        await row.scrollIntoViewIfNeeded().catch(() => {});
        const box = await row.boundingBox();
        if (!box) throw new Error('Could not measure the target row\'s bounding box');
        const targetY = box.y + box.height / 2;
        const candidates = this.page.locator(`button:has(svg.${iconClass})`);
        const index = await candidates.evaluateAll((buttons, y) => {
            let bestIndex = -1;
            let bestDelta = Infinity;
            buttons.forEach((btn, i) => {
                const r = btn.getBoundingClientRect();
                const delta = Math.abs(r.top + r.height / 2 - y);
                if (delta < bestDelta) { bestDelta = delta; bestIndex = i; }
            });
            return bestDelta <= 20 ? bestIndex : -1;
        }, targetY);
        if (index === -1) throw new Error(`Could not find a "${iconClass}" action icon aligned with the target row`);
        return candidates.nth(index);
    }

    // ===================== Historical Draws row -> "View" (eye) detail dialog =====================

    async openDrawDetailView(drawName) {
        const row = this.draw.historicalDrawRowByName(drawName);
        await expect(row, `Historical Draws row for "${drawName}" must be visible`).toBeVisible({ timeout: 45000 });
        const viewButton = await this.resolveRowActionIconByPosition(row, 'lucide-eye');
        await expect(viewButton, `"View" action icon for draw "${drawName}" must be visible`).toBeVisible({ timeout: 45000 });
        await viewButton.click();
        const dialog = this.loc.drawDetailDialog(drawName);
        await expect(dialog, `Draw detail dialog for "${drawName}" must open`).toBeVisible({ timeout: 45000 });
        return dialog;
    }

    async closeDrawDetailDialog(dialog) {
        await this.loc.drawDetailCloseButton(dialog).click();
        await expect(dialog, 'Draw detail dialog must close').not.toBeVisible({ timeout: 45000 });
    }

    /**
     * Reads the Summary tab's status + financials. Reuses the exact same label/value DOM-walk
     * (`getKpiValueByLabel`-style) the rest of the suite already relies on, since the dialog's
     * "Draw Amount"/"Previously Drawn"/etc. rows share that identical
     * paragraph-label/paragraph-value sibling structure.
     */
    async readDrawDetailSummary(drawName) {
        const dialog = await this.openDrawDetailView(drawName);
        // MCP-verified live (2026-09-02): the Status badge renders before the "Financials"
        // section below it — reading the Financials labels immediately after the dialog becomes
        // visible can race that section's own render pass and see nothing yet. Waiting for the
        // "Financials" heading itself guarantees that section has mounted first.
        await expect(dialog.getByText('Financials', { exact: true }), 'Draw detail "Financials" section must render').toBeVisible({ timeout: 45000 });
        // MCP-verified live (2026-09-02): each label/value pair here is NOT a sibling pair under
        // one shared parent — Mantine's Grid renders the label and its value as separate Grid
        // columns one level up, with Mantine's own per-instance `<style>` tags interleaved as
        // additional DOM siblings between them (breaking a plain `nextElementSibling` walk too).
        // Searching the GRANDPARENT's `<p>` descendants for the non-label one sidesteps both.
        const getValue = (label) => this.page.evaluate((labelText) => {
            const all = Array.from(document.querySelectorAll('p'));
            const labelEl = all.find((el) => el.textContent.trim() === labelText);
            const row = labelEl && labelEl.parentElement ? labelEl.parentElement.parentElement : null;
            if (!row) return null;
            const candidates = Array.from(row.querySelectorAll('p'));
            const valueEl = candidates.find((el) => el !== labelEl);
            return valueEl ? valueEl.textContent.trim() : null;
        }, label);

        const status = await this.loc.drawDetailStatusText(dialog).textContent();
        const drawAmount = await getValue('Draw Amount');
        const previouslyDrawn = await getValue('Previously Drawn');
        const totalDrawAtSubmission = await getValue('Total Draw at Submission');
        const remainingAtSubmission = await getValue('Remaining at Submission');
        const submittedBy = await getValue('Submitted by');

        await this.closeDrawDetailDialog(dialog);

        const result = {
            status: status.trim(),
            drawAmount,
            previouslyDrawn,
            totalDrawAtSubmission,
            remainingAtSubmission,
            submittedBy,
        };
        Logger.success(`Draw "${drawName}" detail summary: ${JSON.stringify(result)}`);
        return result;
    }

    /** Reads the Invoices (N) tab's table rows: [{ invoiceNumber, vendor, paymentStatus, amount }], plus the parsed Total. */
    async readDrawDetailInvoices(drawName) {
        const dialog = await this.openDrawDetailView(drawName);
        await this.loc.drawDetailInvoicesTab(dialog).click();
        await this.page.waitForTimeout(1000);

        const rows = this.loc.drawDetailInvoiceRows(dialog);
        const rowCount = await rows.count();
        const invoices = [];
        let total = null;
        for (let i = 1; i < rowCount; i++) { // row 0 is the header row
            const cells = (await rows.nth(i).getByRole('cell').allTextContents()).map((c) => c.trim());
            if (cells[0] === 'Total') {
                total = cells[cells.length - 1];
                continue;
            }
            // This list has grown to 28+ rows on this long-lived shared property — a row can be
            // caught mid-render (fewer than the expected 4 cells) when read this soon after the
            // tab switch. Skip incomplete rows rather than crash; the ones we actually need are
            // matched by invoice number afterward, so a transiently-skipped unrelated row is safe
            // to lose (a genuinely missing target row still fails that later `.find()` assertion).
            if (cells.length < 4 || !cells[0]) continue;
            const [invoiceNumberRaw, vendor, paymentStatus, amount] = cells;
            // MCP-verified live (2026-09-02): this cell's raw text doubles the prefix, e.g.
            // "Invoice #Invoice #26245" — normalize to the clean "Invoice #<digits>" form that
            // actually appears everywhere else (job invoice list, generated PDF).
            const digits = (invoiceNumberRaw.match(/\d+/) || [])[0];
            invoices.push({
                invoiceNumber: digits ? `Invoice #${digits}` : invoiceNumberRaw.trim(),
                vendor,
                paymentStatus,
                amount,
            });
        }

        await this.closeDrawDetailDialog(dialog);
        Logger.success(`Draw "${drawName}" detail invoices: ${JSON.stringify(invoices)}, total=${total}`);
        return { invoices, total };
    }

    // ===================== Historical Draws row -> "PDF" (file-text) preview =====================

    /** Clicks the row's PDF action icon, reads the resulting preview iframe's `src`, and closes it. */
    async getDrawPdfUrl(drawName) {
        const row = this.draw.historicalDrawRowByName(drawName);
        await expect(row, `Historical Draws row for "${drawName}" must be visible`).toBeVisible({ timeout: 45000 });
        const pdfButton = await this.resolveRowActionIconByPosition(row, 'lucide-file-text');
        await expect(pdfButton, `"PDF" action icon for draw "${drawName}" must be visible`).toBeVisible({ timeout: 45000 });
        await pdfButton.click();

        const dialog = this.loc.pdfPreviewDialog(drawName);
        await expect(dialog, `PDF preview dialog for "${drawName}" must open`).toBeVisible({ timeout: 45000 });
        const iframe = this.loc.pdfPreviewIframe(dialog);
        await expect(iframe, 'PDF preview iframe must be present').toBeVisible({ timeout: 45000 });
        const src = await iframe.getAttribute('src');
        expect(src, 'PDF preview iframe must carry a src URL').toBeTruthy();

        await this.loc.pdfPreviewCloseButton(dialog).click();
        await expect(dialog, 'PDF preview dialog must close').not.toBeVisible({ timeout: 45000 });

        Logger.success(`Draw "${drawName}" PDF URL resolved: ${src}`);
        return src;
    }

    /** Downloads the PDF at `url` and extracts its text (raw + whitespace-stripped for robust matching). */
    async downloadAndExtractDrawPdfText(url) {
        return downloadAndExtractPdfText(url);
    }
};
