function drawReportingLocators(page) {
    return {
        // --- Navigation ---
        drawReportingNavLink: page.locator('nav').getByText('Draw Reporting', { exact: true }).first(),

        // --- Breadcrumb ---
        breadcrumbHomeLink: page.getByRole('link', { name: 'Home' }),
        breadcrumbDrawReportingText: page.getByText('Draw Reporting', { exact: true }).first(),
        selectedPropertyBreadcrumbButton: (name) => page.getByRole('button', { name, exact: true }).first(),

        // --- Property selection ---
        selectPropertyButton: page.getByRole('button', { name: 'Select a Property' }),
        propertyDropdownMenu: page.getByRole('menu', { name: 'Select a Property' }),
        propertySearchInput: page.getByRole('textbox', { name: 'Search properties...' }),
        propertyMenuItems: page.getByRole('menuitem'),

        // --- No-property empty state ---
        noPropertySelectedMessage: page.getByText('Please select a property from the header to view draw reporting.', { exact: true }),

        // --- Top toolbar ---
        createDrawButton: page.getByRole('button', { name: 'Create Draw', exact: true }).first(),

        // --- Tabs ---
        overviewTab: page.getByRole('tab', { name: 'Overview' }),
        historicalDrawsTab: page.getByRole('tab', { name: 'Historical Draws' }),
        overviewTabPanel: page.getByRole('tabpanel', { name: 'Overview' }),
        historicalDrawsTabPanel: page.getByRole('tabpanel', { name: 'Historical Draws' }),

        // --- Overview: Budget Overview section ---
        budgetOverviewHeading: page.getByText('Budget Overview', { exact: true }),
        budgetOverviewEmptyTitle: page.getByText('No draw budget overviews added yet', { exact: true }),
        budgetOverviewEmptySubtitle: page.getByText('Use + or Create Button to create one', { exact: true }).first(),

        // --- Overview: Capex Status widget ---
        capexStatusHeading: page.getByText('Capex Status', { exact: true }),
        drawnVsRemainingLabel: page.getByText('Drawn VS Remaining', { exact: true }),
        drawnPercentText: page.getByText('0% Drawn ($0.00)', { exact: true }),
        remainingPercentText: page.getByText('100% Remaining ($0.00)', { exact: true }),
        budgetItemsLabel: page.getByText('Budget Items', { exact: true }),

        // --- Historical Draws: empty state ---
        historicalDrawsEmptyTitle: page.getByText('No draws added yet', { exact: true }),
        historicalDrawsEmptySubtitle: page.getByText('Use + or Create Button to create one', { exact: true }).first(),

        // --- Create New Draw modal (Step 1 only) ---
        createDrawModal: page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Create New Draw' }) }),
        createDrawModalHeading: page.getByRole('heading', { name: 'Create New Draw' }),
        createDrawModalCloseBtn: page
            .getByRole('dialog')
            .filter({ has: page.getByRole('heading', { name: 'Create New Draw' }) })
            .getByRole('button')
            .first(),
        drawNameInput: page.getByRole('textbox', { name: 'Draw Name' }),
        billingStartDateInput: page.getByRole('textbox', { name: 'Billing Period Start Date' }),
        billingEndDateInput: page.getByRole('textbox', { name: 'Billing Period End Date' }),
        createDrawModalSubmitBtn: page
            .getByRole('dialog')
            .filter({ has: page.getByRole('heading', { name: 'Create New Draw' }) })
            .getByRole('button', { name: 'Create Draw', exact: true }),

        // --- Grid toolbars (Filter / View / Table / Export), scoped per tabpanel ---
        filterButtonIn: (panel) => panel.getByRole('button', { name: 'Filter', exact: true }),
        viewButtonIn: (panel) => panel.getByRole('button', { name: 'View', exact: true }),
        tableButtonIn: (panel) => panel.getByTestId('bt-table-action'),
        exportButtonIn: (panel) => panel.getByRole('button', { name: 'Export', exact: true }),

        // --- Filters popover (Budget Overview grid only) ---
        filtersPanelHeading: page.getByText('Filters', { exact: true }),
        filterOptionsHeading: page.getByText('Filter Options', { exact: true }),
        // When the grid has data, its column headers (e.g. "Budget Item") reuse the same
        // exact text as these popover field labels, so scope to the popover paragraph specifically.
        filterFieldLabel: (label) => page.getByRole('paragraph').filter({ hasText: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }),

        // --- "Save current view as" popover (View button) ---
        saveViewDialogHeading: page.getByText('Save current view as', { exact: true }),
        saveViewNameInput: page.getByRole('textbox', { name: 'Enter a view name' }),

        // --- Table popover (Manage columns) ---
        addCustomColumnButton: page.getByRole('button', { name: 'Add custom column' }),
        hideShowColumnsButton: page.getByTestId('bt-table-action-hide-show-columns'),
        manageColumnsHeading: page.getByRole('heading', { name: 'Manage Columns' }),
        defaultColumnsLabel: page.getByText('Default Columns', { exact: true }),
        // Scoped to the dialog: when the grid has data, its own column headers (e.g. "Budget Item")
        // reuse the same exact text as these checkbox labels, so a page-wide search is ambiguous.
        columnLabel: (name) => page.getByRole('dialog', { name: 'Manage Columns' }).getByText(name, { exact: true }),

        // --- Draw editor (Step 2, opened right after Create Draw submits) ---
        drawEditorDialog: page.getByRole('dialog').filter({ has: page.getByText('Draw disbursement schedule', { exact: true }) }),
        drawEditorNameInput: page.getByRole('textbox', { name: 'Untitled Draw' }),
        drawEditorStatusBadge: page.getByText('Draft', { exact: true }),
        drawEditorDiscardButton: page.getByRole('button', { name: 'Discard', exact: true }),
        drawEditorCloseButton: page.getByRole('button', { name: 'Close', exact: true }),
        drawEditorContinueButton: page.getByRole('button', { name: 'Continue', exact: true }),
        drawDisbursementHeading: page.getByText('Draw disbursement schedule', { exact: true }),
        drawDisbursementEmptyMessage: page.getByText('No budget categories found for this property.', { exact: true }),
        drawInvoicesHeading: page.getByText('Invoices (0)', { exact: true }),
        drawInvoiceSearchInput: page.getByRole('textbox', { name: 'Search invoice, vendor, or job' }),
        drawInvoicesEmptyMessage: page.getByText('No invoices match the current search/filter.', { exact: true }),

        // --- "Draw created" toast ---
        drawCreatedToastTitle: page.getByText('Draw created', { exact: true }),
        drawCreatedToastMessage: page.getByText('Your new draw has been created successfully.', { exact: true }),

        // --- Active Draw card + KPI (Overview tab, once a draft draw exists) ---
        activeDrawKpiLabel: page.getByText('Active Draw (Draw in progress)', { exact: true }),
        activeDrawCardStatus: page.getByText('Draw in Progress', { exact: true }),
        activeDrawContinueEditingButton: page.getByRole('button', { name: 'Continue Editing', exact: true }),

        // --- Invoice inclusion (Step 1 editor, Invoices panel) ---
        invoiceRowCheckboxByLabel: (label) => page
            .getByRole('dialog')
            .filter({ has: page.getByText('Draw disbursement schedule', { exact: true }) })
            .locator('*')
            .filter({ hasText: label })
            .filter({ has: page.getByRole('checkbox') })
            .last()
            .getByRole('checkbox')
            .first(),
        cmFeeAutoInvoiceLabel: page.getByText('CM Fee Invoice (TBD)', { exact: true }),
        // The per-invoice wrapper containing BOTH the checkbox/name/amount row AND its own
        // "CM Fee %" override section — filtering on both texts together (rather than just
        // "has a checkbox", which many ancestors satisfy) resolves to exactly this one wrapper,
        // since nothing deeper still contains the label text and nothing shallower contains
        // "CM Fee %" too (that text lives only inside this invoice's own override section).
        invoicePanelRowByLabel: (label) => page
            .getByRole('dialog')
            .filter({ has: page.getByText('Draw disbursement schedule', { exact: true }) })
            .locator('*')
            .filter({ hasText: label })
            .filter({ hasText: 'CM Fee %' })
            .last(),

        // --- Draw editor Step 2 (PDF preview / submit) ---
        drawStepTwoDialog: page.getByRole('dialog').filter({ has: page.getByText('Draw Summary', { exact: true }) }),
        backToEditLink: page.getByText('Back to Edit', { exact: true }).first(),
        approvalFlowHeading: page.getByText('Approval Flow', { exact: true }),
        approvalFlowNoApprovalMessage: page.getByText('No approval required for this draw.', { exact: true }),
        submitForApprovalButton: page.getByRole('button', { name: 'Submit for Approval', exact: true }),

        // --- Historical Draws grid row lookup by draw name ---
        historicalDrawRowByName: (drawName) => page.getByRole('row').filter({ hasText: drawName }),
    };
}

module.exports = { drawReportingLocators };
