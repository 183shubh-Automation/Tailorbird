function drawReportingLocators(page) {
    const createTemplateDialog = () => page.getByRole('dialog').filter({ has: page.getByText('Create Approval Template', { exact: true }) });

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

        // ===================== Merged from drawApprovalLocator.js =====================
        // (Draw approval template creation + All Approvals workflow)

        createTemplateButton: page.getByRole('button', { name: 'Create Template', exact: true }),
        createDialog: createTemplateDialog,

        // --- Fields inside the Create Approval Template dialog ---
        templateNameInput: () => createTemplateDialog().getByRole('textbox', { name: 'Template Name' }),
        drawTypeRadio: () => createTemplateDialog().getByRole('radio', { name: 'Draw', exact: true }),
        addPropertiesButton: () => createTemplateDialog().getByRole('button', { name: 'Search and add properties' }),

        // --- Property picker popover (opened by addPropertiesButton) ---
        // Named distinctly from propertySearchInput above (the Draw Reporting header's
        // property picker) since both would otherwise collide under the same key.
        templatePropertySearchInput: page.getByRole('textbox', { name: 'Search properties' }),
        propertyOptionCheckbox: (propertyName) => page.getByText(propertyName, { exact: true }),
        closePropertyPickerButton: page.getByRole('button', { name: 'Close', exact: true }),

        // --- Approval rule rows (row 0 = header, rows 1..3 = default approver rows) ---
        approvalRuleRow: (index) => createTemplateDialog().getByRole('row').nth(index + 1),
        approverInputInRow: (index) => createTemplateDialog().getByRole('row').nth(index + 1).getByRole('textbox', { name: 'Select approvers' }),
        approverOption: (name) => page.getByRole('option', { name, exact: true }),
        alwaysRequiredCheckboxInRow: (index) => createTemplateDialog().getByRole('row').nth(index + 1).getByRole('checkbox'),
        deleteRowButtonInRow: (index) => createTemplateDialog().getByRole('row').nth(index + 1).getByRole('button').last(),

        submitTemplateButton: () => createTemplateDialog().getByRole('button', { name: 'Create Template', exact: true }),

        // --- Approval Templates list (post-creation verification) ---
        // CSS-based (not getByRole) deliberately: on the All Approvals page (a heavy
        // virtualized RevoGrid data grid), the browser's accessibility-tree computation was
        // observed to lag far behind the actual DOM/paint — the input is genuinely visible
        // and interactable in the DOM (confirmed via direct evaluation) long before
        // getByRole('textbox', {name:'Search...'}) resolves, sometimes never within 90s+ of
        // waiting. A plain CSS attribute selector reads the DOM directly and sidesteps that.
        templatesListSearchInput: page.locator('input[placeholder="Search..."]').first(),
        templateRowByName: (name) => page.getByRole('row').filter({ hasText: name }),

        // --- Top nav "Approvals" link + "All Approvals"/"My Approvals" tabs (for client-side SPA navigation) ---
        // "All Approvals" is an admin-wide view — it renders ZERO rows for a regular approver
        // (e.g. the real eligible approver logged in on their own account). That user's queue
        // lives under "My Approvals" instead. Both grids share the same row-finding problem
        // (see dataRowsWithDate below), just scoped to a different list.
        approvalsNavLink: page.locator('nav').getByText('Approvals', { exact: true }).first(),
        allApprovalsTab: page.getByRole('tab', { name: 'All Approvals', exact: true }),
        myApprovalsTab: page.getByRole('tab', { name: 'My Approvals', exact: true }),

        // --- All Approvals / My Approvals grids + Approval Details dialog ---
        // The grid's rows do NOT render the draw's name anywhere (only Property Name, Job,
        // Approval Type, ID, Amount, etc.) and the page's search box does not index draw name
        // either — searching by draw name always yields zero rows. Since the domain only
        // allows one Pending draw submission per property at a time, the unique way to find
        // "the draw I just submitted" is by property name + type "Draw" (+ status "Pending
        // Approval" on All Approvals only — My Approvals' rows don't render a status column at
        // all, since everything listed there is implicitly pending); the exact draw name is
        // then verified from the opened dialog's own text.
        allApprovalsRowByName: (name) => page.getByRole('row').filter({ hasText: name }),
        allApprovalsPendingDrawRowForProperty: (propertyName) => page
            .getByRole('row')
            .filter({ hasText: propertyName })
            .filter({ hasText: 'Draw' })
            .filter({ hasText: 'Pending Approval' }),
        myApprovalsPendingDrawRowForProperty: (propertyName) => page
            .getByRole('row')
            .filter({ hasText: propertyName })
            .filter({ hasText: 'Draw' }),
        // The grid virtualizes the "Actions" column as a structurally separate column group —
        // its rows are DOM siblings of the data rows, not descendants, and row.getByRole('button',
        // {name:'View Details'}) therefore always matches zero elements (confirmed via direct
        // count() inspection). The two column groups render in the same top-to-bottom order, so
        // the button is instead resolved by the data row's positional index among all real data
        // rows (identified by containing a Submitted-On date, which no Actions-only row has).
        dataRowsWithDate: page.getByRole('row').filter({ hasText: /\d{2}\/\d{2}\/\d{4}/ }),
        allViewDetailsButtons: page.getByRole('button', { name: 'View Details' }),
        approvalDetailsDialog: page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Approval Details' }) }),
        eligibleApproversText: page.getByText(/Eligible approvers:/),
        directApproveButton: page.getByRole('button', { name: 'Approve', exact: true }),
        directRejectButton: page.getByRole('button', { name: 'Reject', exact: true }),
        approveOnBehalfButton: page.getByRole('button', { name: 'Approve on Behalf', exact: true }),
        rejectOnBehalfButton: page.getByRole('button', { name: 'Reject on Behalf', exact: true }),
        rejectionNotesInput: page.getByRole('textbox', { name: 'Notes (required for rejection)' }),

        // --- CM Fee Invoice (TBD) row (always-included, non-deselectable line in the Invoices
        // panel) — same wrapper-matching pattern as invoicePanelRowByLabel, but keyed on this
        // fixed auto-generated label instead of a per-invoice one.
        cmFeeInvoiceRow: page
            .getByRole('dialog')
            .filter({ has: page.getByText('Draw disbursement schedule', { exact: true }) })
            .locator('*')
            .filter({ hasText: 'CM Fee Invoice (TBD)' })
            .filter({ has: page.getByRole('checkbox') })
            .last(),

        // ===================== Copied from multiApproverLocator.js =====================
        // Used only for filling the invoice amount when preparing a test invoice for Draw
        // Reporting E2E flows. multiApproverLocator.js itself is NOT modified — it's shared
        // by the multi-approver test suite — these are copies of its 3 relevant locators.
        invoiceAmountColumnHeader: page.getByRole('columnheader', { name: 'Invoice Amount', exact: true }),
        invoiceGridDataCellByColIndex: (colIndex) =>
            page
                .locator(`[role="gridcell"][data-rgcol="${colIndex}"], [role="gridcell"][aria-colindex="${colIndex}"]`)
                .first(),
        invoiceAmountEditorInput: page.getByTestId('bird-table-currency-input'),
    };
}

module.exports = { drawReportingLocators };
