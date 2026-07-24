require('dotenv').config();
const { test, expect } = require('@playwright/test');
const { MultiApproverPage } = require('../pages/multiApproverPage');
const { Logger } = require('../utils/logger');
const fixture = require('../fixture/multiApprover.json');
const { ensureLeftPanelExpanded } = require('../utils/leftPanelExpander');

test.use({
    storageState: 'sessionState.json',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
});

let page, multiApprover;

test.describe('Multi Approver Invoice Approval Flow', () => {
    test.beforeEach(async ({ page: p }) => {
        page = p;
        multiApprover = new MultiApproverPage(page);

        await page.goto(process.env.DASHBOARD_URL, { waitUntil: 'load' });
        await expect(page).toHaveURL(process.env.DASHBOARD_URL);
        await ensureLeftPanelExpanded(page);
    });

    test('TC320 @approval @multiApprover : Two invoices route through multi-approver approval end-to-end', async () => {
        const { jobName, approverEmails, approvalNotes, invoiceAmount, approvalStatus } = fixture;

        // Step 1: Go to Jobs tab
        Logger.step('Step 1: Navigating to Jobs tab');
        await multiApprover.navigateToJobsTab();

        // Step 2: Search the job and view its details
        Logger.step('Step 2: Opening job details');
        await multiApprover.searchAndOpenJob(jobName);

        // Step 3: Go to Invoice tab
        Logger.step('Step 3: Navigating to Invoice tab');
        await multiApprover.navigateToInvoiceTab();

        // Step 4: Create 2 invoices, amount always below $1000, save both invoice
        // names (the system-assigned invoice number, unique every run) to a JSON
        // file under data/ without overwriting unrelated data.
        Logger.step('Step 4: Creating 2 invoices with amount below $1000');
        const invoiceRecords = [];
        for (let i = 1; i <= 2; i++) {
            const { invoiceNumberLabel, invoiceNumber } = await multiApprover.createInvoiceDraft();

            const title = multiApprover.generateInvoiceTitle();
            await multiApprover.fillInvoiceTitle(title);

            const amount = multiApprover.randomInvoiceAmount(invoiceAmount.min, invoiceAmount.max);
            expect(amount).toBeLessThan(1000);
            await multiApprover.fillInvoiceAmountInGrid(amount);

            invoiceRecords.push({ invoiceNumberLabel, invoiceNumber, title, amount });
            await multiApprover.goBackFromInvoiceDetails();
        }

        expect(invoiceRecords).toHaveLength(2);
        multiApprover.saveInvoiceRecords(jobName, invoiceRecords);

        // Step 5: Once both invoices are created, make sure each invoice's status
        // is Pending Approval. If it is Draft, view details and click Confirm —
        // status then becomes Pending Approval. Checked individually per invoice.
        Logger.step('Step 5: Verifying invoice status and confirming drafts');
        for (const invoice of invoiceRecords) {
            await multiApprover.confirmInvoiceIfDraft(invoice.invoiceNumber);
        }

        // Step 6: Go to All Approval tab and search for the first created invoice
        Logger.step('Step 6: Searching All Approvals for the first invoice');
        const firstInvoice = invoiceRecords[0];
        await multiApprover.navigateToAllApprovals();
        await multiApprover.searchApprovals(firstInvoice.invoiceNumber);

        // Step 7: Assert Approver column contains both approver emails
        Logger.step('Step 7: Verifying Approver column');
        const approverColumnText = await multiApprover.getApproverColumnText();
        expect(approverColumnText).toContain(approverEmails.email1);
        expect(approverColumnText).toContain(approverEmails.email2);

        // Step 8: Click View Details
        Logger.step('Step 8: Opening approval View Details');
        await multiApprover.openApprovalViewDetails();

        // Step 9: Assert approval status text piece by piece (not one giant
        // combined string comparison), against fixture-defined expected values.
        Logger.step('Step 9: Verifying pending approval status');
        const pendingStatus = await multiApprover.getApprovalStatusDetails();
        const expectedEligibleApproversText = multiApprover.buildExpectedEligibleApproversText(
            approvalStatus.eligibleApproversPrefix,
            approverEmails.email1,
            approverEmails.email2
        );
        multiApprover.assertEquals('Approval Status label', pendingStatus.approvalStatusLabel, approvalStatus.approvalStatusLabel);
        multiApprover.assertEquals('Approved count (pending)', pendingStatus.approvedCountText, approvalStatus.pending.approvedCountText);
        multiApprover.assertEquals('Row number', pendingStatus.rowNumberText, approvalStatus.rowNumber);
        multiApprover.assertEquals('Eligible approvers text', pendingStatus.eligibleApproversText, expectedEligibleApproversText);
        multiApprover.assertEquals('Status badge (pending)', pendingStatus.statusBadgeText, approvalStatus.pending.statusBadgeText);

        // Step 10: Fill notes and click "Approve on Behalf"
        Logger.step('Step 10: Approving on behalf');
        await multiApprover.fillApprovalNotes(approvalNotes);
        await multiApprover.clickApproveOnBehalf();

        // The signed-in user approving "on behalf" is not himself one of the two
        // eligible approvers, so this invoice will not surface under "My
        // Approvals" for this session (verified live: searching there returns no
        // rows). The final approved state is verified back in All Approvals,
        // which is the reliable, reachable source of truth for this account.
        Logger.step('Step 11: Re-searching and verifying final approved status');
        await multiApprover.searchApprovals(firstInvoice.invoiceNumber);
        await multiApprover.openApprovalViewDetails();

        const approvedStatus = await multiApprover.getApprovalStatusDetails();

        // The approver-name assertion is against the actual signed-in user's
        // display name (read live from the nav), never a hardcoded value.
        const signedInUserName = await multiApprover.getSignedInUserName();

        multiApprover.assertEquals('Approval Status label', approvedStatus.approvalStatusLabel, approvalStatus.approvalStatusLabel);
        multiApprover.assertEquals('Approved count (approved)', approvedStatus.approvedCountText, approvalStatus.approved.approvedCountText);
        multiApprover.assertEquals('Row number', approvedStatus.rowNumberText, approvalStatus.rowNumber);
        multiApprover.assertEquals('Eligible approvers text', approvedStatus.eligibleApproversText, expectedEligibleApproversText);
        multiApprover.assertEquals('Status badge (approved)', approvedStatus.statusBadgeText, approvalStatus.approved.statusBadgeText);
        multiApprover.assertEquals('Approver name', approvedStatus.approverName, signedInUserName);
        multiApprover.assertEquals('Approval notes', approvedStatus.notesText, approvalNotes);
        multiApprover.assertMatches('Approval timestamp', approvedStatus.timestampText, new RegExp(approvalStatus.timestampPattern));

        multiApprover.saveApprovalStatusResults({
            jobName,
            invoiceNumber: firstInvoice.invoiceNumber,
            expectations: approvalStatus,
            pendingStatus,
            approvedStatus,
            signedInUserName,
        });

        Logger.success('Multi approver invoice approval flow verified end-to-end');
    });
});
