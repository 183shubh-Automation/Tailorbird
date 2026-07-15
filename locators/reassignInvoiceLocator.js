/**
 * Reassign Invoice locators — Property → Job → Invoice tab navigation and the
 * "Reassign Invoice" modal (Current Assignment / New Assignment / Scope Allocations).
 * @param {import('@playwright/test').Page} page
 */
function reassignInvoiceLocators(page) {
    return {
        // ── Property → Jobs navigation ───────────────────────────────────────────
        propertyTableCell: (name) => page.locator(`[role="gridcell"]:has-text("${name}")`).first(),
        propertyCardLink: (name) => page.locator('main').getByText(name, { exact: true }).first(),
        // Property Overview "Jobs" stat — a paragraph "Jobs" followed by a sibling button showing the count.
        jobsStatButton: page.locator('p', { hasText: /^Jobs$/ }).locator('..').getByRole('button').first(),

        // Jobs grid (opened via the Jobs stat button — scoped to the property that was clicked from)
        jobsGrid: page.locator('[role="treegrid"]').first(),
        jobRowsForProperty: (propertyName) =>
            page.locator('[role="treegrid"] [role="row"]')
                .filter({ has: page.locator('[role="gridcell"]') })
                .filter({ hasText: propertyName }),
        jobIdLinkInRow: (row) => row.locator('a[href*="/jobs/"]').first(),

        // ── Invoice list grid — Actions column ───────────────────────────────────
        invoiceGridScope: page.locator('[role="treegrid"]').filter({ has: page.getByRole('columnheader', { name: 'Invoice Number' }) }),
        // Scoped to rows with an actual "Invoice #NNNN" link — excludes the totals/footer row,
        // which also renders gridcells and would otherwise throw off index-alignment with actionRows.
        invoiceDataRows: page.locator('[role="treegrid"]')
            .filter({ has: page.getByRole('columnheader', { name: 'Invoice Number' }) })
            .getByRole('row')
            .filter({ has: page.getByRole('link', { name: /Invoice #/ }) }),
        invoiceActionRows: page.locator('[role="treegrid"]')
            .filter({ has: page.getByRole('columnheader', { name: 'Invoice Number' }) })
            .getByRole('row')
            .filter({ has: page.getByRole('button', { name: 'Reassign Invoice' }) }),
        reassignButtonInActionRow: (actionRow) => actionRow.getByRole('button', { name: 'Reassign Invoice' }),

        // ── Reassign Invoice modal ────────────────────────────────────────────────
        reassignDialog: page.getByRole('dialog').filter({ hasText: 'Reassign Invoice' }),
        dialogHeading: (dlg) => dlg.getByRole('heading', { level: 2 }),

        currentProjectInput: (dlg) => dlg.getByRole('textbox', { name: 'Current Project' }),
        currentJobInput: (dlg) => dlg.getByRole('textbox', { name: 'Current Job' }),
        currentScopeInput: (dlg) => dlg.getByRole('textbox', { name: 'Current Scope' }),

        newProjectInput: (dlg) => dlg.getByRole('textbox', { name: 'New Project' }),
        newJobInput: (dlg) => dlg.getByRole('textbox', { name: 'New Job' }),
        newProjectLabel: (dlg) => dlg.getByText('New Project *', { exact: true }),
        newJobLabel: (dlg) => dlg.getByText('New Job *', { exact: true }),

        newProjectListbox: page.getByRole('listbox', { name: 'New Project' }),
        newJobListbox: page.getByRole('listbox', { name: 'New Job' }),
        // Scope combobox has no accessible name — it is the only open listbox at the time it's queried.
        openUnlabeledListbox: page.getByRole('listbox').filter({ has: page.getByRole('option') }).last(),

        scopeAllocationsHeading: (dlg) => dlg.getByText('Scope Allocations', { exact: false }),
        invoiceTotalText: (dlg) => dlg.getByText(/Invoice total:/i),
        addScopeButton: (dlg) => dlg.getByRole('button', { name: 'Add Scope' }),
        scopeSelectInput: (dlg) => dlg.getByRole('textbox', { name: 'Select scope' }),
        scopeTable: (dlg) => dlg.locator('table'),
        scopeTableColumnHeaders: (dlg) => dlg.locator('table').getByRole('columnheader'),
        totalAllocatedRow: (dlg) => dlg.locator('tr').filter({ hasText: 'Total Allocated' }),

        cancelButton: (dlg) => dlg.getByRole('button', { name: 'Cancel' }),
        confirmReassignmentButton: (dlg) => dlg.getByRole('button', { name: 'Confirm Reassignment' }),

        reassignSuccessToast: page.getByRole('alert').filter({ hasText: 'Invoice Reassigned' }),
    };
}

module.exports = { reassignInvoiceLocators };
