const { expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { Logger } = require('../utils/logger');
const { multiApproverLocators } = require('../locators/multiApproverLocator');

class MultiApproverPage {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        this.page = page;
        this.loc = multiApproverLocators(page);
    }

    async navigateToJobsTab() {
        Logger.step('Navigating to Jobs tab');
        await expect(this.loc.jobsNavLink).toBeVisible({ timeout: 15000 });
        await this.loc.jobsNavLink.click();
        await this.page.waitForURL(/\/jobs/, { timeout: 20000 });
        Logger.success('Navigated to Jobs tab');
    }

    async searchAndOpenJob(jobName) {
        Logger.step(`Searching for job: ${jobName}`);
        await this.loc.jobsSearchInput.fill(jobName);
        const jobRow = this.page.getByRole('row').filter({ hasText: jobName });
        await expect(jobRow.first()).toBeVisible({ timeout: 20000 });

        const jobIdLink = jobRow.first().locator('a[href*="/jobs/"]').first();
        await expect(jobIdLink).toBeVisible({ timeout: 10000 });
        await jobIdLink.click();
        await this.page.waitForURL(/\/jobs\/\d+/, { timeout: 20000 });
        await expect(this.loc.jobNameText(jobName)).toBeVisible({ timeout: 15000 });
        Logger.success(`Opened job details: ${jobName}`);
    }

    async navigateToInvoiceTab() {
        Logger.step('Navigating to Invoice tab');
        await this.loc.invoiceTab.click();
        await this.page.waitForURL(/tab=invoices/, { timeout: 20000 });
        await expect(this.loc.createInvoiceButton).toBeVisible({ timeout: 15000 });
        Logger.success('Navigated to Invoice tab');
    }

    /**
     * Clicks Create Invoice and returns the auto-generated invoice number (e.g. "14218").
     * The invoice number is globally unique and auto-assigned by the system every run.
     */
    async createInvoiceDraft() {
        Logger.step('Creating new invoice');
        await this.loc.createInvoiceButton.click();
        await expect(this.loc.invoiceDetailsDialog).toBeVisible({ timeout: 20000 });
        const invoiceNumberLabel = (await this.loc.invoiceNumberInput.inputValue()).trim();
        const invoiceNumber = (invoiceNumberLabel.match(/\d+/) || [])[0];
        if (!invoiceNumber) {
            throw new Error(`Could not parse invoice number from "${invoiceNumberLabel}"`);
        }
        Logger.success(`Invoice created: ${invoiceNumberLabel}`);
        return { invoiceNumberLabel, invoiceNumber };
    }

    /** Generates a unique invoice title for this run. */
    generateInvoiceTitle() {
        return `MultiApprover_Invoice_${Date.now()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    }

    /** Generates a random invoice amount within the given inclusive [min, max] range. */
    randomInvoiceAmount(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    async fillInvoiceTitle(title) {
        Logger.step(`Filling invoice title: ${title}`);
        await this.loc.invoiceTitleInput.fill(title);
    }

    /**
     * Sets the invoice line-item amount via the grid. Locates the "Invoice Amount"
     * column by its header (data-rgcol/aria-colindex) so the correct cell is edited
     * regardless of column order or how many optional columns render.
     */
    async fillInvoiceAmountInGrid(amount) {
        Logger.step(`Filling invoice amount in grid: ${amount}`);
        const header = this.loc.invoiceAmountColumnHeader;
        await expect(header).toBeVisible({ timeout: 15000 });
        const colIndex = await header.evaluate((el) => el.getAttribute('data-rgcol') || el.getAttribute('aria-colindex'));
        if (!colIndex) {
            throw new Error('Could not resolve Invoice Amount column index');
        }
        const cell = this.loc.invoiceGridDataCellByColIndex(colIndex);
        await cell.scrollIntoViewIfNeeded().catch(() => {});
        await cell.dblclick();
        const editor = this.loc.invoiceAmountEditorInput;
        await expect(editor).toBeVisible({ timeout: 10000 });
        await editor.fill(String(amount));
        await editor.press('Enter');
        Logger.success(`Invoice amount set to ${amount}`);
    }

    async goBackFromInvoiceDetails() {
        await this.loc.goBackButton.click();
        await this.page.waitForURL(/tab=invoices/, { timeout: 20000 });
    }

    async openInvoiceFromList(invoiceNumber) {
        Logger.step(`Opening invoice #${invoiceNumber} from list`);
        await this.loc.invoiceListLink(`Invoice #${invoiceNumber}`).click();
        await expect(this.loc.invoiceDetailsDialog).toBeVisible({ timeout: 20000 });
    }

    /** Draft invoices have editable fields and an enabled "Confirm Invoice" button. */
    async isInvoiceDraft() {
        const appeared = await this.loc.confirmInvoiceButton
            .waitFor({ state: 'visible', timeout: 15000 })
            .then(() => true)
            .catch(() => false);
        if (!appeared) return false;
        return this.loc.confirmInvoiceButton.isEnabled();
    }

    /**
     * Verifies the invoice's current status and, only if it is still Draft,
     * confirms it so it moves to Pending Approval.
     */
    async confirmInvoiceIfDraft(invoiceNumber) {
        await this.openInvoiceFromList(invoiceNumber);
        const isDraft = await this.isInvoiceDraft();
        if (!isDraft) {
            Logger.info(`Invoice #${invoiceNumber} is not in Draft status; skipping confirm`);
            await this.goBackFromInvoiceDetails();
            return;
        }
        Logger.step(`Invoice #${invoiceNumber} is Draft; confirming to move to Pending Approval`);
        await this.loc.confirmInvoiceButton.click();
        await expect(this.loc.confirmInvoiceDialog).toBeVisible({ timeout: 15000 });
        await this.loc.confirmInvoiceDialogConfirmButton.click();
        await expect(this.loc.invoiceSubmittedToast).toBeVisible({ timeout: 20000 });
        Logger.success(`Invoice #${invoiceNumber} confirmed — now Pending Approval`);
    }

    async navigateToAllApprovals() {
        Logger.step('Navigating to Approvals section');
        await this.loc.approvalsNavLink.click();
        await this.page.waitForURL(/\/approvals/, { timeout: 20000 });
        Logger.step('Navigating to All Approval tab');
        await expect(this.loc.allApprovalsTab).toBeVisible({ timeout: 15000 });
        await this.loc.allApprovalsTab.click();
        await this.page.waitForURL(/\/approvals\/all-approvals/, { timeout: 20000 });
    }

    async navigateToMyApprovals() {
        Logger.step('Navigating to My Approval tab');
        await this.loc.myApprovalsTab.click();
        await this.page.waitForURL(/\/approvals\/my-approvals/, { timeout: 20000 });
    }

    async searchApprovals(term) {
        Logger.step(`Searching approvals for: ${term}`);
        await this.loc.approvalsSearchInput.fill(term);
        await this.page.waitForTimeout(600);
    }

    /**
     * Forces the All Approvals revo-grid to a large width so it mounts every column instead
     * of virtualizing rightmost ones out of the DOM. MCP-verified live (2026-07-28): at
     * default width this grid renders only Property Name through Requested By + Actions —
     * "Approver" (and Status/Submitted On/Approved On/Revision Notes) are dropped entirely.
     * Scrolling an internal container only reveals columns that are already mounted — it
     * can't help when the column isn't in the DOM at all, which is the actual failure mode
     * here. Purely visual — does not change any data, selection, or interaction behavior.
     */
    async forceGridFullWidth() {
        const grid = this.page.locator('revo-grid').first();
        if (await grid.count().catch(() => 0)) {
            await grid.evaluate((g) => {
                g.style.setProperty('width', '3500px', 'important');
                g.style.setProperty('min-width', '3500px', 'important');
            }).catch(() => {});
            await this.page.waitForTimeout(400);
        }
    }

    /**
     * Reads the Approver column text for the single row currently shown (grid is
     * horizontally virtualized, so the column must be scrolled into view first).
     */
    async getApproverColumnText() {
        await this.forceGridFullWidth();
        await this.page.evaluate(() => {
            const el = document.querySelector('.rgCol.scroll-rgCol.hydrated');
            if (el) el.scrollLeft = 900;
        });
        await expect(this.loc.approverColumnHeader).toBeVisible({ timeout: 10000 });
        const colIndex = await this.loc.approverColumnHeader.evaluate((el) =>
            el.getAttribute('data-rgcol') || el.getAttribute('aria-colindex')
        );
        const cell = this.page.locator(
            `[role="gridcell"][data-rgcol="${colIndex}"], [role="gridcell"][aria-colindex="${colIndex}"]`
        ).first();
        return (await cell.textContent() || '').trim();
    }

    async openApprovalViewDetails() {
        await this.loc.viewDetailsActionButton.click();
        await expect(this.loc.approvalDetailsDialog).toBeVisible({ timeout: 15000 });
    }

    /**
     * Extracts the approval-status block piece by piece (never as one combined
     * string) so each expected fragment can be asserted independently.
     */
    async getApprovalStatusDetails() {
        const dialog = this.loc.approvalDetailsDialog;
        await expect(dialog).toBeVisible({ timeout: 15000 });

        const approvalStatusLabel = (await dialog.getByText('Approval Status', { exact: true }).first().textContent()).trim();
        const approvedCountText = (await dialog.getByText(/^\d+ of \d+ approved$/).first().textContent()).trim();

        const numberPara = dialog.getByText(/^\d+\.$/).first();
        await expect(numberPara).toBeVisible({ timeout: 10000 });
        const rowNumberText = (await numberPara.textContent()).trim();

        const eligiblePara = dialog.getByText(/^Eligible approvers:/).first();
        const eligibleApproversText = (await eligiblePara.textContent()).trim();

        // The status badge's exact text is one of a known, fixed set of values,
        // so match on that directly instead of a fragile sibling-depth xpath —
        // the surrounding DOM nesting differs between Pending and Approved states.
        const statusBadge = dialog.getByText(/^(Pending Approval|Approved|Rejected)$/).first();
        await expect(statusBadge).toBeVisible({ timeout: 10000 });
        const statusBadgeText = (await statusBadge.textContent()).trim();

        // Approver name / timestamp / notes only exist once the invoice has been
        // approved, so an absent element is a real, legitimate state — not an error.
        //
        // MCP-verified live (2026-07-29): this template now has a second, role-based
        // approval rule ("e2e_test_role") rendered as its own "Eligible approvers:"
        // paragraph that shows "Skipped" (the role condition doesn't apply to this
        // invoice) and has no approver-name/timestamp/notes content at all. That rule's
        // paragraph can render before the actual approved rule's paragraph, so the
        // first "Eligible approvers:" match is not reliably the row that was acted on.
        //
        // No id/data-testid exists anywhere in this dialog (Mantine renders plain
        // <p class="mantine-Text-root"> with only hashed, per-build CSS-module classes
        // for content — confirmed live), so element identity here is resolved via each
        // paragraph's own text plus real DOM sibling relationships (nextElementSibling /
        // closest('.mantine-Group-root') — Mantine's own stable component class, not a
        // hashed one) inside locator.evaluate(), rather than an xpath or regex locator.
        const allEligibleParas = dialog.getByText('Eligible approvers:');
        const eligibleCount = await allEligibleParas.count();
        let approverName = null;
        let timestampText = null;
        let notesText = null;
        for (let i = 0; i < eligibleCount; i++) {
            const candidatePara = allEligibleParas.nth(i);
            const details = await candidatePara.evaluate((el) => {
                const nameEl = el.nextElementSibling;
                const groupRoot = el.closest('.mantine-Group-root');
                const row = groupRoot ? groupRoot.parentElement : null;
                const rowParagraphs = row ? Array.from(row.children).filter((child) => child.tagName === 'P') : [];
                return {
                    name: nameEl ? nameEl.textContent.trim() : null,
                    timestamp: rowParagraphs[0] ? rowParagraphs[0].textContent.trim() : null,
                    notes: rowParagraphs[1] ? rowParagraphs[1].textContent.trim() : null,
                };
            });
            if (details.name) {
                approverName = details.name;
                timestampText = details.timestamp;
                notesText = details.notes;
                break;
            }
        }

        return {
            approvalStatusLabel,
            approvedCountText,
            rowNumberText,
            eligibleApproversText,
            approverName,
            timestampText,
            notesText,
            statusBadgeText,
        };
    }

    /** Builds the expected "Eligible approvers: a@x, b@x" text from fixture values. */
    buildExpectedEligibleApproversText(prefix, email1, email2) {
        return `${prefix} ${email1}, ${email2}`;
    }

    /**
     * Asserts the "Eligible approvers: ..." text has the right prefix and at least one
     * non-empty, comma-separated entry after it — without hardcoding exactly who those
     * entries are. MCP-verified live (2026-07-29): one of this template's two approver
     * rules is role-based ("e2e_test_role"), which resolves to however many org members
     * currently hold that role (and renders their display names, not raw emails) — a set
     * that legitimately grows/shrinks over time as other tests invite/assign that role, so
     * a fixed roster (or raw-email) comparison here would be permanently fragile.
     */
    assertEligibleApproversTextValid(prefix, actualText) {
        Logger.info(`Eligible approvers text -> actual: "${actualText}" (expected prefix: "${prefix}")`);
        expect(actualText.startsWith(prefix), `Eligible approvers text must start with "${prefix}"`).toBe(true);
        const namesPart = actualText.slice(prefix.length).trim();
        const names = namesPart.split(',').map((n) => n.trim()).filter(Boolean);
        expect(names.length, 'Eligible approvers text must list at least one approver').toBeGreaterThan(0);
    }

    /** Asserts equality and logs both the actual and expected values. */
    assertEquals(label, actual, expected) {
        Logger.info(`${label} -> actual: "${actual}" | expected: "${expected}"`);
        expect(actual).toBe(expected);
    }

    /** Asserts a regex match and logs both the actual value and the pattern used. */
    assertMatches(label, actual, pattern) {
        Logger.info(`${label} -> actual: "${actual}" | expected pattern: ${pattern}`);
        expect(actual).toMatch(pattern);
    }

    /** Persists the created invoice records to data/multiApproverInvoices.json. */
    saveInvoiceRecords(jobName, invoiceRecords) {
        const dataDir = path.join(__dirname, '../data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        const outputPath = path.join(dataDir, 'multiApproverInvoices.json');
        fs.writeFileSync(
            outputPath,
            JSON.stringify({ jobName, invoices: invoiceRecords, createdAt: new Date().toISOString() }, null, 2)
        );
        Logger.success(`Saved invoice names to ${outputPath}`);
        return outputPath;
    }

    /**
     * Persists the actual observed approval-status text alongside what was
     * expected, in its own file so it never overwrites the invoice records.
     */
    saveApprovalStatusResults({ jobName, invoiceNumber, expectations, pendingStatus, approvedStatus, signedInUserName }) {
        const dataDir = path.join(__dirname, '../data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        const outputPath = path.join(dataDir, 'multiApproverApprovalStatus.json');
        fs.writeFileSync(
            outputPath,
            JSON.stringify(
                { jobName, invoiceNumber, expectations, pendingStatus, approvedStatus, signedInUserName, verifiedAt: new Date().toISOString() },
                null,
                2
            )
        );
        Logger.success(`Saved approval status verification results to ${outputPath}`);
        return outputPath;
    }

    /**
     * Reads the signed-in user's display name from the nav profile block, by
     * locating the paragraph directly preceding the account email paragraph —
     * kept dynamic so it never hardcodes a specific name.
     */
    async getSignedInUserName() {
        const emailPara = this.loc.signedInUserEmailText;
        await expect(emailPara).toBeVisible({ timeout: 10000 });
        const namePara = emailPara.locator('xpath=preceding-sibling::p[1]');
        await expect(namePara).toBeVisible({ timeout: 10000 });
        return (await namePara.textContent()).trim();
    }

    async fillApprovalNotes(notes) {
        await this.loc.approvalNotesInput.fill(notes);
    }

    async clickApproveOnBehalf() {
        Logger.step('Clicking Approve on Behalf');
        await this.loc.approveOnBehalfButton.click();
        await expect(this.page.getByText('Approved', { exact: true }).first()).toBeVisible({ timeout: 15000 });
        Logger.success('Approve on Behalf completed');
    }
}

module.exports = { MultiApproverPage };
