/**
 * Multi-Approver Invoice Flow Locators
 * @param {import('@playwright/test').Page} page
 */
function multiApproverLocators(page) {
    return {
        // Global Jobs list navigation (left nav "Jobs (Contracts & POs)")
        jobsNavLink: page
            .locator('nav')
            .locator('a, button, div[role="link"], div')
            .filter({ hasText: /^Jobs \(Contracts & POs\)$/i })
            .first(),
        jobsSearchInput: page.getByRole('textbox', { name: 'Search...' }),
        jobIdLink: (jobId) => page.getByRole('link', { name: jobId, exact: true }),
        jobNameText: (jobName) => page.getByText(jobName).first(),

        // Job workspace tabs
        invoiceTab: page.getByRole('tab', { name: 'Invoice' }),

        // Invoice tab list
        createInvoiceButton: page
            .getByRole('button', { name: /^(Create|Add) Invoice$/i })
            .locator('visible=true')
            .first(),
        invoiceListLink: (invoiceNumberLabel) => page.getByRole('link', { name: invoiceNumberLabel, exact: true }),

        // Invoice details dialog ("Go Back Invoice Details")
        invoiceDetailsDialog: page.getByRole('dialog', { name: 'Go Back Invoice Details' }),
        invoiceNumberInput: page.getByRole('textbox', { name: 'Enter invoice number' }),
        invoiceTitleInput: page.getByRole('textbox', { name: 'Enter title' }),
        goBackButton: page.getByRole('button', { name: 'Go Back' }),
        confirmInvoiceButton: page.getByRole('button', { name: 'Confirm Invoice' }),
        confirmInvoiceDialog: page.getByRole('dialog', { name: 'Confirm Invoice' }),
        confirmInvoiceDialogConfirmButton: page
            .getByRole('dialog', { name: 'Confirm Invoice' })
            .getByRole('button', { name: 'Confirm', exact: true }),
        invoiceSubmittedToast: page.getByText('Invoice submitted for approval'),

        // Invoice line-item grid (inside invoice details dialog)
        invoiceAmountColumnHeader: page.getByRole('columnheader', { name: 'Invoice Amount', exact: true }),
        invoiceGridDataCellByColIndex: (colIndex) =>
            page
                .locator(`[role="gridcell"][data-rgcol="${colIndex}"], [role="gridcell"][aria-colindex="${colIndex}"]`)
                .first(),
        invoiceAmountEditorInput: page.getByTestId('bird-table-currency-input'),

        // Approvals - All Approvals / My Approvals tabs
        approvalsNavLink: page
            .locator('nav')
            .locator('a, button, div[role="link"], div')
            .filter({ hasText: /^Approvals$/i })
            .first(),
        allApprovalsTab: page.getByRole('tab', { name: 'All Approvals' }),
        myApprovalsTab: page.getByRole('tab', { name: 'My Approvals' }),
        approvalsSearchInput: page.getByRole('textbox', { name: 'Search...' }),
        approvalsGridScrollContainer: page.locator('.rgCol.scroll-rgCol.hydrated').first(),
        approverColumnHeader: page.getByRole('columnheader', { name: 'Approver', exact: true }),
        viewDetailsActionButton: page.getByRole('button', { name: 'View Details' }).first(),

        // Approval Details dialog
        approvalDetailsDialog: page.getByRole('dialog', { name: 'Approval Details' }),
        approvalNotesInput: page.getByRole('textbox', { name: 'Notes (required for rejection)' }),
        approveOnBehalfButton: page.getByRole('button', { name: 'Approve on Behalf' }),

        // Signed-in user's profile block in the top nav (name paragraph precedes
        // the email paragraph) — used to dynamically resolve the current user's
        // display name without ever hardcoding it.
        signedInUserEmailText: page.locator('nav').getByText(/^[\w.+-]+@[\w-]+\.[\w.-]+$/).first(),
    };
}

module.exports = { multiApproverLocators };
