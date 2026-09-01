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
        // lives under "My Approvals" instead. Both grids share the same row-finding problem,
        // just scoped to a different list.
        approvalsNavLink: page.locator('nav').getByText('Approvals', { exact: true }).first(),
        allApprovalsTab: page.getByRole('tab', { name: 'All Approvals', exact: true }),
        myApprovalsTab: page.getByRole('tab', { name: 'My Approvals', exact: true }),

        // --- All Approvals / My Approvals grids + Approval Details dialog ---
        // The grid's rows do NOT render the draw's name anywhere (only Property Name, Job,
        // Approval Type, ID, Amount, etc.) and the page's search box does not index draw name
        // either — searching by draw name always yields zero rows. MCP-verified live
        // (2026-07-30, exhaustive shadow-DOM scan of the whole page): neither grid renders a
        // Status column at all — "Pending Approval"/"Approved"/"Rejected" text exists only
        // inside the Approval Details dialog, never in a row. Filtering a row on
        // hasText:'Pending Approval' therefore always matches zero rows, which silently broke
        // every approve/reject flow that went through the "All Approvals" tab. Since the domain
        // only allows one Pending draw submission per property at a time, and a newly-submitted
        // draw sorts first, the unique way to find "the draw I just submitted" is by property
        // name + type "Draw", taking the first (most recent) match; the exact draw name is then
        // verified from the opened dialog's own text.
        allApprovalsRowByName: (name) => page.getByRole('row').filter({ hasText: name }),
        allApprovalsPendingDrawRowForProperty: (propertyName) => page
            .getByRole('row')
            .filter({ hasText: propertyName })
            .filter({ hasText: 'Draw' }),
        myApprovalsPendingDrawRowForProperty: (propertyName) => page
            .getByRole('row')
            .filter({ hasText: propertyName })
            .filter({ hasText: 'Draw' }),
        // MCP-verified live (2026-08-13): the Status column is real and renders plain text
        // ("Pending Approval"/"Approved"/"Rejected") — it sits near the right edge of the
        // grid, though, so it's the first cell dropped by horizontal column virtualization.
        // Scrolling this header into view forces the grid's shared horizontal scroll
        // container to bring Status back into the rendered window for every visible row.
        // `.or()` fallback (same convention as budgetLocator.js/vendorLocator.js etc.): if the
        // role/accessible-name ever stops resolving, the header still carries revo-grid's own
        // `.rgHeaderCell` class (MCP-verified) — filtering that by its text is a second,
        // independent way to find the same element.
        allApprovalsStatusColumnHeader: page
            .getByRole('columnheader', { name: 'Status', exact: true })
            .or(page.locator('.rgHeaderCell').filter({ hasText: 'Status' })),
        // The grid virtualizes the "Actions" column as a structurally separate column group —
        // its rows are DOM siblings of the data rows, not descendants, and row.getByRole('button',
        // {name:'View Details'}) therefore always matches zero elements (confirmed via direct
        // count() inspection). The button is instead resolved by matching the data row's
        // vertical screen position against each Actions button's position (see
        // resolveViewDetailsButtonForRow) — index-based and text-based matching were both tried
        // first and both broke under column virtualization / split DOM row structure.
        allViewDetailsButtons: page.getByRole('button', { name: 'View Details' }),
        approvalDetailsDialog: page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Approval Details' }) }),
        // The dialog's own status badge (next to the eligible-approver line) — the ONLY place
        // "Pending Approval"/"Approved"/"Rejected" text actually renders anywhere in the app;
        // see the All Approvals comment above.
        approvalDetailsStatusBadge: page
            .getByRole('dialog')
            .filter({ has: page.getByRole('heading', { name: 'Approval Details' }) })
            .getByText(/^(Pending Approval|Approved|Rejected)$/),
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

/**
 * Self-healing strategies for TC372 (tests/TC25_Draw_reporting.spec.js — "Draw Reporting —
 * brand-new property empty state, every grid control, and full Create Draw flow"). Every
 * `draw.*` key from drawReportingLocators() that TC372's own call chain touches (property
 * selection, Overview/Historical Draws empty states, Create Draw modal, Filter/View/Manage
 * Columns/Export toolbars on both tabpanels, the full create-draw + Draw Editor Step 2 flow,
 * Active Draw card impact, and the (not-executed-on-a-brand-new-property-but-still-healed)
 * ensureNoBlockingPendingDraw/openApprovalDetailsForDraw cleanup chain) is centralized here as
 * a `{name, locator}[]` strategy array, plus the handful of locators that were previously raw
 * inline expressions in pages/drawReportingPage.js (verifyFilterPanel's comparator combobox,
 * verifyDrawEditorStepTwo's "0 Warnings"/"0 items to review" text, verifyActiveDrawImpact's
 * dynamic draw-name text, and openApprovalDetailsForDraw's local search-input lookup).
 *
 * All MCP-verified live 2026-08-06 (beta.tailorbird.com/financials/draw-reporting and
 * /approvals/all-approvals). Strategy #1 in every array is the exact original pre-existing
 * expression from drawReportingLocators() (or the exact original inline expression), byte for
 * byte unchanged. No regex/XPath in ADDED strategies. Every OTHER key in drawReportingLocators()
 * (used only by TC373/374/375 and the other regression tests below them) is left untouched —
 * this function only ever ADDS strategies for the keys TC372 itself exercises.
 *
 * Known recurring pitfalls specifically guarded against here (all MCP-confirmed live in this
 * exact app during this healing pass):
 *  - "Overview" contains the substring "view" (case-insensitively) — an unscoped
 *    `button:has-text("View")` lookup resolves BOTH the "Overview" tab and the toolbar's "View"
 *    button. Every toolbar-button fallback below is scoped to its panel/dialog and additionally
 *    disambiguated via the `data-table-action="true"` attribute the 4 toolbar buttons share.
 *  - "Reject"/"Approve" are substrings of "Reject on Behalf"/"Approve on Behalf", and "Continue"
 *    is a substring of "Continue Editing" — fallbacks that filter by these shorter strings use an
 *    additional `hasNotText` filter to stay resolved to the same single original node.
 *  - budgetOverviewEmptyTitle/Subtitle and historicalDrawsEmptyTitle/Subtitle are unscoped
 *    `page.getByText(...)` in the original — their fallbacks are scoped to the relevant
 *    tabpanel, per the "don't add an unscoped page-level fallback" guidance for hidden
 *    duplicates (both tabpanels/toolbars are simultaneously mounted, one just `display:none`).
 * @param {import('@playwright/test').Page} page
 */
function tc372DrawReportingStrategies(page) {
    return {
        // --- Property selection / breadcrumb ---
        /** Selected-property breadcrumb button, keyed by property name. MCP-verified: renders as `button.tb-property-selector-button` (same stable class used on the Properties-details page's own breadcrumb). */
        selectedPropertyBreadcrumbButton: (name) => [
            { name: 'role:button[name](exact,first)(original)', locator: page.getByRole('button', { name, exact: true }).first() },
            { name: 'css:.tb-property-selector-button[hasText]', locator: page.locator('.tb-property-selector-button').filter({ hasText: name }) },
        ],
        selectPropertyButton: [
            { name: 'role:button[name=Select a Property](original)', locator: page.getByRole('button', { name: 'Select a Property' }) },
            { name: 'css:button[hasText=Select a Property]', locator: page.locator('button').filter({ hasText: 'Select a Property' }) },
        ],
        propertyMenuItems: [
            { name: 'role:menuitem(original)', locator: page.getByRole('menuitem') },
            { name: 'css:[role=menuitem]', locator: page.locator('[role="menuitem"]') },
        ],

        // --- Tabs / tabpanels ---
        overviewTab: [
            { name: 'role:tab[name=Overview](original)', locator: page.getByRole('tab', { name: 'Overview' }) },
            { name: 'css:.mantine-Tabs-tab[hasText=Overview]', locator: page.locator('.mantine-Tabs-tab').filter({ hasText: 'Overview' }) },
        ],
        historicalDrawsTab: [
            { name: 'role:tab[name=Historical Draws](original)', locator: page.getByRole('tab', { name: 'Historical Draws' }) },
            { name: 'css:.mantine-Tabs-tab[hasText=Historical Draws]', locator: page.locator('.mantine-Tabs-tab').filter({ hasText: 'Historical Draws' }) },
        ],
        overviewTabPanel: [
            { name: 'role:tabpanel[name=Overview](original)', locator: page.getByRole('tabpanel', { name: 'Overview' }) },
            { name: 'css:[role=tabpanel][aria-labelledby$=-tab-overview]', locator: page.locator('[role="tabpanel"][aria-labelledby$="-tab-overview"]') },
        ],
        historicalDrawsTabPanel: [
            { name: 'role:tabpanel[name=Historical Draws](original)', locator: page.getByRole('tabpanel', { name: 'Historical Draws' }) },
            { name: 'css:[role=tabpanel][aria-labelledby$=-tab-historical-draws]', locator: page.locator('[role="tabpanel"][aria-labelledby$="-tab-historical-draws"]') },
        ],

        // --- Overview: Budget Overview / Capex Status (empty state) ---
        /** MCP-verified: parent Card carries the stable CSS-module class `DrawOverviewBudgetTable_card__UqyXa`. */
        budgetOverviewHeading: [
            { name: "text:Budget Overview(exact)(original)", locator: page.getByText('Budget Overview', { exact: true }) },
            { name: 'css:.DrawOverviewBudgetTable_card__UqyXa>>text', locator: page.locator('.DrawOverviewBudgetTable_card__UqyXa').getByText('Budget Overview', { exact: true }) },
        ],
        /** MCP-verified: a plain inline-styled `<div>` with no class/testid — scoping to the Overview tabpanel is the only genuine independent signal available (avoids the Historical Draws tabpanel's own always-mounted-but-hidden content). */
        budgetOverviewEmptyTitle: [
            { name: "text:No draw budget overviews added yet(exact)(original)", locator: page.getByText('No draw budget overviews added yet', { exact: true }) },
            { name: 'role:tabpanel[Overview]>>text', locator: page.getByRole('tabpanel', { name: 'Overview' }).getByText('No draw budget overviews added yet', { exact: true }) },
        ],
        budgetOverviewEmptySubtitle: [
            { name: "text:Use + or Create Button to create one(exact)(original,first)", locator: page.getByText('Use + or Create Button to create one', { exact: true }).first() },
            { name: 'role:tabpanel[Overview]>>text(first)', locator: page.getByRole('tabpanel', { name: 'Overview' }).getByText('Use + or Create Button to create one', { exact: true }).first() },
        ],
        capexStatusHeading: [
            { name: "text:Capex Status(exact)(original)", locator: page.getByText('Capex Status', { exact: true }) },
            { name: 'role:tabpanel[Overview]>>text', locator: page.getByRole('tabpanel', { name: 'Overview' }).getByText('Capex Status', { exact: true }) },
        ],
        drawnVsRemainingLabel: [
            { name: "text:Drawn VS Remaining(exact)(original)", locator: page.getByText('Drawn VS Remaining', { exact: true }) },
            { name: 'role:tabpanel[Overview]>>text', locator: page.getByRole('tabpanel', { name: 'Overview' }).getByText('Drawn VS Remaining', { exact: true }) },
        ],
        drawnPercentText: [
            { name: "text:0% Drawn ($0.00)(exact)(original)", locator: page.getByText('0% Drawn ($0.00)', { exact: true }) },
            { name: 'role:tabpanel[Overview]>>text', locator: page.getByRole('tabpanel', { name: 'Overview' }).getByText('0% Drawn ($0.00)', { exact: true }) },
        ],
        remainingPercentText: [
            { name: "text:100% Remaining ($0.00)(exact)(original)", locator: page.getByText('100% Remaining ($0.00)', { exact: true }) },
            { name: 'role:tabpanel[Overview]>>text', locator: page.getByRole('tabpanel', { name: 'Overview' }).getByText('100% Remaining ($0.00)', { exact: true }) },
        ],
        /** MCP-verified: when the Create Draw modal is open, its own submit button's accessible name is ALSO exactly "Create Draw" — original already resolves this with `.first()`; fallback mirrors that. */
        createDrawButton: [
            { name: "role:button[name=Create Draw](exact,first)(original)", locator: page.getByRole('button', { name: 'Create Draw', exact: true }).first() },
            { name: 'css:button[hasText=Create Draw](first)', locator: page.locator('button').filter({ hasText: 'Create Draw' }).first() },
        ],

        // --- Historical Draws (empty state) ---
        historicalDrawsEmptyTitle: [
            { name: "text:No draws added yet(exact)(original)", locator: page.getByText('No draws added yet', { exact: true }) },
            { name: 'role:tabpanel[Historical Draws]>>text', locator: page.getByRole('tabpanel', { name: 'Historical Draws' }).getByText('No draws added yet', { exact: true }) },
        ],
        historicalDrawsEmptySubtitle: [
            { name: "text:Use + or Create Button to create one(exact)(original,first)", locator: page.getByText('Use + or Create Button to create one', { exact: true }).first() },
            { name: 'role:tabpanel[Historical Draws]>>text(first)', locator: page.getByRole('tabpanel', { name: 'Historical Draws' }).getByText('Use + or Create Button to create one', { exact: true }).first() },
        ],

        // --- Create New Draw modal (Step 1) ---
        createDrawModal: [
            { name: "role:dialog[has=heading(Create New Draw)](original)", locator: page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Create New Draw' }) }) },
            { name: 'css:.mantine-Modal-content[hasText]', locator: page.locator('.mantine-Modal-content').filter({ hasText: 'Create New Draw' }) },
        ],
        createDrawModalHeading: [
            { name: 'role:heading[name=Create New Draw](original)', locator: page.getByRole('heading', { name: 'Create New Draw' }) },
            { name: 'css:h2[hasText=Create New Draw]', locator: page.locator('h2').filter({ hasText: 'Create New Draw' }) },
        ],
        /** MCP-verified: the modal's close (X) button carries the stable Mantine class `.mantine-Modal-close` (no accessible name of its own — original resolves it positionally as the dialog's first button). */
        createDrawModalCloseBtn: [
            {
                name: 'role:dialog[has=heading(Create New Draw)]>>button[first](original)',
                locator: page
                    .getByRole('dialog')
                    .filter({ has: page.getByRole('heading', { name: 'Create New Draw' }) })
                    .getByRole('button')
                    .first(),
            },
            { name: 'css:.mantine-Modal-content[hasText]>>.mantine-Modal-close', locator: page.locator('.mantine-Modal-content').filter({ hasText: 'Create New Draw' }).locator('.mantine-Modal-close') },
        ],
        drawNameInput: [
            { name: 'role:textbox[name=Draw Name](original)', locator: page.getByRole('textbox', { name: 'Draw Name' }) },
            { name: 'placeholder:Enter draw name', locator: page.getByPlaceholder('Enter draw name') },
        ],
        /** MCP-verified: Start/End date inputs share the IDENTICAL placeholder "MM/DD/YYYY" — no independent attribute distinguishes them, so the fallback is a last-resort DOM-order position within the open dialog (Start renders before End), matching this repo's established "position" last-resort convention. */
        billingStartDateInput: [
            { name: 'role:textbox[name=Billing Period Start Date](original)', locator: page.getByRole('textbox', { name: 'Billing Period Start Date' }) },
            { name: 'position:dialog-date-input[0]', locator: page.locator('[role="dialog"] input[placeholder="MM/DD/YYYY"]').nth(0) },
        ],
        billingEndDateInput: [
            { name: 'role:textbox[name=Billing Period End Date](original)', locator: page.getByRole('textbox', { name: 'Billing Period End Date' }) },
            { name: 'position:dialog-date-input[1]', locator: page.locator('[role="dialog"] input[placeholder="MM/DD/YYYY"]').nth(1) },
        ],
        createDrawModalSubmitBtn: [
            {
                name: 'role:dialog[has=heading(Create New Draw)]>>button[name=Create Draw](exact)(original)',
                locator: page
                    .getByRole('dialog')
                    .filter({ has: page.getByRole('heading', { name: 'Create New Draw' }) })
                    .getByRole('button', { name: 'Create Draw', exact: true }),
            },
            { name: 'css:.mantine-Modal-content[hasText]>>button[hasText=Create Draw]', locator: page.locator('.mantine-Modal-content').filter({ hasText: 'Create New Draw' }).locator('button').filter({ hasText: 'Create Draw' }) },
        ],

        // --- Grid toolbars (Filter / View / Table / Export), scoped per tabpanel ---
        /** MCP-verified: "Overview" contains the substring "view", so an unscoped `button:has-text("View")` would also match the Overview TAB — the `data-table-action="true"` attribute (shared by all 4 toolbar buttons, confirmed live) disambiguates safely since the tab itself never carries it. */
        filterButtonIn: (panel) => [
            { name: 'role:button[name=Filter](exact)(original)', locator: panel.getByRole('button', { name: 'Filter', exact: true }) },
            { name: 'css:button[data-table-action=true][hasText=Filter]', locator: panel.locator('button[data-table-action="true"]').filter({ hasText: 'Filter' }) },
        ],
        viewButtonIn: (panel) => [
            { name: 'role:button[name=View](exact)(original)', locator: panel.getByRole('button', { name: 'View', exact: true }) },
            { name: 'css:button[data-table-action=true][hasText=View]', locator: panel.locator('button[data-table-action="true"]').filter({ hasText: 'View' }) },
        ],
        tableButtonIn: (panel) => [
            { name: 'testid:bt-table-action(original)', locator: panel.getByTestId('bt-table-action') },
            { name: 'role:button[name=Table](exact)', locator: panel.getByRole('button', { name: 'Table', exact: true }) },
        ],
        exportButtonIn: (panel) => [
            { name: 'role:button[name=Export](exact)(original)', locator: panel.getByRole('button', { name: 'Export', exact: true }) },
            { name: 'css:button[data-table-action=true][hasText=Export]', locator: panel.locator('button[data-table-action="true"]').filter({ hasText: 'Export' }) },
        ],

        // --- Filters popover ---
        filtersPanelHeading: [
            { name: "text:Filters(exact)(original)", locator: page.getByText('Filters', { exact: true }) },
            { name: 'css:p[hasText=Filters]', locator: page.locator('p').filter({ hasText: 'Filters' }) },
        ],
        filterOptionsHeading: [
            { name: "text:Filter Options(exact)(original)", locator: page.getByText('Filter Options', { exact: true }) },
            { name: 'css:p[hasText=Filter Options]', locator: page.locator('p').filter({ hasText: 'Filter Options' }) },
        ],
        /**
         * Original already uses the ARIA-role engine with an anchored regex (`^label$`) so
         * "Budget Item" never matches the Capex Status widget's own "Budget Items" label.
         * CAUTION (found live via a real test run, not assumed): a first fallback attempt used
         * `page.locator('p').filter({ hasText: label })` — Playwright's `hasText` string form is
         * an UNANCHORED substring match, so `label:"Budget Item"` also matched the "Budget Items"
         * paragraph, throwing a strict-mode violation. Fixed by using `getByText(label, {exact:
         * true})` instead — Playwright's `exact` option is a true whole-string equality check
         * (not a substring match), so it excludes "Budget Items" without needing regex.
         */
        filterFieldLabel: (label) => [
            {
                name: 'role:paragraph[hasText=^label$](original)',
                locator: page.getByRole('paragraph').filter({ hasText: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }),
            },
            { name: 'text:label(exact)', locator: page.getByText(label, { exact: true }) },
        ],
        /** Filter popover's comparator dropdown (Equals/Greater than/Less than/Between) — previously a raw inline locator in verifyFilterPanel(). */
        filterComparatorCombobox: [
            { name: "css:select,[role=combobox](first)(original)", locator: page.locator('select, [role="combobox"]').first() },
            { name: 'role:combobox(first)', locator: page.getByRole('combobox').first() },
        ],

        // --- "Save current view as" popover ---
        saveViewDialogHeading: [
            { name: "text:Save current view as(exact)(original)", locator: page.getByText('Save current view as', { exact: true }) },
            { name: 'css:p[hasText=Save current view as]', locator: page.locator('p').filter({ hasText: 'Save current view as' }) },
        ],
        saveViewNameInput: [
            { name: 'role:textbox[name=Enter a view name](original)', locator: page.getByRole('textbox', { name: 'Enter a view name' }) },
            { name: 'placeholder:Enter a view name', locator: page.getByPlaceholder('Enter a view name') },
        ],

        // --- Table popover (Manage columns) ---
        addCustomColumnButton: [
            { name: 'role:button[name=Add custom column](original)', locator: page.getByRole('button', { name: 'Add custom column' }) },
            { name: 'css:button[hasText=Add custom column]', locator: page.locator('button').filter({ hasText: 'Add custom column' }) },
        ],
        hideShowColumnsButton: [
            { name: 'testid:bt-table-action-hide-show-columns(original)', locator: page.getByTestId('bt-table-action-hide-show-columns') },
            { name: 'role:button[name=Hide / show columns](exact)', locator: page.getByRole('button', { name: 'Hide / show columns', exact: true }) },
        ],
        manageColumnsHeading: [
            { name: 'role:heading[name=Manage Columns](original)', locator: page.getByRole('heading', { name: 'Manage Columns' }) },
            { name: 'css:h2[hasText=Manage Columns]', locator: page.locator('h2').filter({ hasText: 'Manage Columns' }) },
        ],
        defaultColumnsLabel: [
            { name: "text:Default Columns(exact)(original)", locator: page.getByText('Default Columns', { exact: true }) },
            { name: 'css:p[hasText=Default Columns]', locator: page.locator('p').filter({ hasText: 'Default Columns' }) },
        ],
        /** Scoped to the "Manage Columns" dialog in the original (avoids colliding with the grid's own column headers when it has data) — fallback keeps that same dialog scope but swaps the text-matching mechanism (CSS tag vs Playwright's text engine). */
        columnLabel: (name) => [
            { name: "role:dialog[name=Manage Columns]>>text(exact)(original)", locator: page.getByRole('dialog', { name: 'Manage Columns' }).getByText(name, { exact: true }) },
            { name: 'role:dialog[name=Manage Columns]>>css:p[hasText]', locator: page.getByRole('dialog', { name: 'Manage Columns' }).locator('p').filter({ hasText: name }) },
        ],

        // --- Draw editor (Step 2) ---
        /** MCP-verified: this panel is a Mantine Drawer (`.mantine-Drawer-content`), distinct from the Create Draw modal's `.mantine-Modal-content` and the Approval Details drawer (also `.mantine-Drawer-content`, disambiguated by its own hasText below). */
        drawEditorDialog: [
            { name: "role:dialog[has=text(Draw disbursement schedule)](original)", locator: page.getByRole('dialog').filter({ has: page.getByText('Draw disbursement schedule', { exact: true }) }) },
            { name: 'css:.mantine-Drawer-content[hasText]', locator: page.locator('.mantine-Drawer-content').filter({ hasText: 'Draw disbursement schedule' }) },
        ],
        drawEditorNameInput: [
            { name: 'role:textbox[name=Untitled Draw](original)', locator: page.getByRole('textbox', { name: 'Untitled Draw' }) },
            { name: 'placeholder:Untitled Draw', locator: page.getByPlaceholder('Untitled Draw') },
        ],
        drawEditorStatusBadge: [
            { name: "text:Draft(exact)(original)", locator: page.getByText('Draft', { exact: true }) },
            { name: 'css:.mantine-Drawer-content[hasText=schedule]>>p[hasText=Draft]', locator: page.locator('.mantine-Drawer-content').filter({ hasText: 'Draw disbursement schedule' }).locator('p').filter({ hasText: 'Draft' }) },
        ],
        /** MCP-verified: "Discard" carries `data-variant="outline"` (the only button in the editor's header with that variant), a genuinely independent attribute-based disambiguator. */
        drawEditorDiscardButton: [
            { name: 'role:button[name=Discard](exact)(original)', locator: page.getByRole('button', { name: 'Discard', exact: true }) },
            { name: 'css:button[data-variant=outline][hasText=Discard]', locator: page.locator('button[data-variant="outline"]').filter({ hasText: 'Discard' }) },
        ],
        /** MCP-verified: the editor's "Close" control is an icon-only ActionIcon with `aria-label="Close"` (no visible text) — a genuinely independent attribute-based fallback. */
        drawEditorCloseButton: [
            { name: 'role:button[name=Close](exact)(original)', locator: page.getByRole('button', { name: 'Close', exact: true }) },
            { name: 'css:.mantine-ActionIcon-root[aria-label=Close]', locator: page.locator('.mantine-ActionIcon-root[aria-label="Close"]') },
        ],
        /** MCP-verified: "Continue" is a substring of the Overview tab's "Continue Editing" button — `hasNotText` keeps the fallback resolved to only this one. */
        drawEditorContinueButton: [
            { name: 'role:button[name=Continue](exact)(original)', locator: page.getByRole('button', { name: 'Continue', exact: true }) },
            { name: 'css:button[hasText=Continue][hasNotText=Editing]', locator: page.locator('button').filter({ hasText: 'Continue' }).filter({ hasNotText: 'Editing' }) },
        ],
        drawDisbursementHeading: [
            { name: "text:Draw disbursement schedule(exact)(original)", locator: page.getByText('Draw disbursement schedule', { exact: true }) },
            { name: 'css:p[hasText=Draw disbursement schedule]', locator: page.locator('p').filter({ hasText: 'Draw disbursement schedule' }) },
        ],
        drawDisbursementEmptyMessage: [
            { name: "text:No budget categories found for this property.(exact)(original)", locator: page.getByText('No budget categories found for this property.', { exact: true }) },
            { name: 'css:p[hasText=No budget categories found for this property.]', locator: page.locator('p').filter({ hasText: 'No budget categories found for this property.' }) },
        ],
        drawInvoicesHeading: [
            { name: "text:Invoices (0)(exact)(original)", locator: page.getByText('Invoices (0)', { exact: true }) },
            { name: 'css:p[hasText=Invoices (0)]', locator: page.locator('p').filter({ hasText: 'Invoices (0)' }) },
        ],
        drawInvoicesEmptyMessage: [
            { name: "text:No invoices match the current search/filter.(exact)(original)", locator: page.getByText('No invoices match the current search/filter.', { exact: true }) },
            { name: 'css:p[hasText=No invoices match the current search/filter.]', locator: page.locator('p').filter({ hasText: 'No invoices match the current search/filter.' }) },
        ],
        /** Previously raw inline `page.getByText('0 Warnings', {exact:true})` in verifyDrawEditorStepTwo(). */
        zeroWarningsText: [
            { name: "text:0 Warnings(exact)(original)", locator: page.getByText('0 Warnings', { exact: true }) },
            { name: 'css:p[hasText=0 Warnings]', locator: page.locator('p').filter({ hasText: '0 Warnings' }) },
        ],
        /** Previously raw inline `page.getByText('0 items to review', {exact:true})` in verifyDrawEditorStepTwo(). */
        zeroItemsToReviewText: [
            { name: "text:0 items to review(exact)(original)", locator: page.getByText('0 items to review', { exact: true }) },
            { name: 'css:p[hasText=0 items to review]', locator: page.locator('p').filter({ hasText: '0 items to review' }) },
        ],

        // --- "Draw created" toast ---
        /**
         * CAUTION (found live via a real test run, not assumed): a first fallback attempt used
         * `page.getByRole('alert').filter({ hasText: 'Draw created' })` — that resolves to the
         * WHOLE alert/toast container (an ancestor of the original's leaf title text), a
         * different physical node whose own `.textContent()` concatenates the title AND message
         * together ("Draw createdYour new draw has been created successfully."), silently
         * corrupting the assertion even after `.first()` prevented the strict-mode crash. Fixed
         * by scoping `.getByText()` to search WITHIN the alert for the same exact leaf text the
         * original targets, rather than matching the alert container itself.
         */
        drawCreatedToastTitle: [
            { name: "text:Draw created(exact)(original)", locator: page.getByText('Draw created', { exact: true }) },
            { name: 'role:alert>>text(exact)', locator: page.getByRole('alert').getByText('Draw created', { exact: true }) },
        ],
        drawCreatedToastMessage: [
            { name: "text:Your new draw has been created successfully.(exact)(original)", locator: page.getByText('Your new draw has been created successfully.', { exact: true }) },
            { name: 'role:alert>>text(exact)', locator: page.getByRole('alert').getByText('Your new draw has been created successfully.', { exact: true }) },
        ],

        // --- Active Draw card + KPI (Overview tab) ---
        activeDrawCardStatus: [
            { name: "text:Draw in Progress(exact)(original)", locator: page.getByText('Draw in Progress', { exact: true }) },
            { name: 'role:tabpanel[Overview]>>text', locator: page.getByRole('tabpanel', { name: 'Overview' }).getByText('Draw in Progress', { exact: true }) },
        ],
        /** Previously raw inline `page.getByText(expectedName, {exact:true}).first()` in verifyActiveDrawImpact(), keyed by the created draw's name. */
        activeDrawCardName: (expectedName) => [
            { name: 'text:expectedName(exact)(first)(original)', locator: page.getByText(expectedName, { exact: true }).first() },
            { name: 'role:tabpanel[Overview]>>text(first)', locator: page.getByRole('tabpanel', { name: 'Overview' }).getByText(expectedName, { exact: true }).first() },
        ],
        activeDrawContinueEditingButton: [
            { name: 'role:button[name=Continue Editing](exact)(original)', locator: page.getByRole('button', { name: 'Continue Editing', exact: true }) },
            { name: 'css:button[hasText=Continue Editing]', locator: page.locator('button').filter({ hasText: 'Continue Editing' }) },
        ],

        // --- All Approvals search box (navigateToAllApprovalsTab + openApprovalDetailsForDraw's local lookup) ---
        templatesListSearchInput: [
            { name: 'css:input[placeholder=Search...](first)(original)', locator: page.locator('input[placeholder="Search..."]').first() },
            { name: 'role:textbox[name=Search...](first)', locator: page.getByRole('textbox', { name: 'Search...' }).first() },
        ],

        // --- All/My Approvals pending-draw row lookup + View Details + Approval Details dialog ---
        myApprovalsPendingDrawRowForProperty: (propertyName) => [
            { name: 'role:row[hasText][hasText=Draw](original)', locator: page.getByRole('row').filter({ hasText: propertyName }).filter({ hasText: 'Draw' }) },
            { name: 'css:[role=row][hasText][hasText=Draw]', locator: page.locator('[role="row"]').filter({ hasText: propertyName }).filter({ hasText: 'Draw' }) },
        ],
        allApprovalsPendingDrawRowForProperty: (propertyName) => [
            { name: 'role:row[hasText][hasText=Draw](original)', locator: page.getByRole('row').filter({ hasText: propertyName }).filter({ hasText: 'Draw' }) },
            { name: 'css:[role=row][hasText][hasText=Draw]', locator: page.locator('[role="row"]').filter({ hasText: propertyName }).filter({ hasText: 'Draw' }) },
        ],
        allViewDetailsButtons: [
            { name: 'role:button[name=View Details](original)', locator: page.getByRole('button', { name: 'View Details' }) },
            { name: 'css:button[hasText=View Details]', locator: page.locator('button').filter({ hasText: 'View Details' }) },
        ],
        /** MCP-verified: the Approval Details panel is ALSO a Mantine Drawer (`.mantine-Drawer-content`), disambiguated from the draw editor's own Drawer via its "Approval Details" heading text. */
        approvalDetailsDialog: [
            { name: "role:dialog[has=heading(Approval Details)](original)", locator: page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Approval Details' }) }) },
            { name: 'css:.mantine-Drawer-content[hasText=Approval Details]', locator: page.locator('.mantine-Drawer-content').filter({ hasText: 'Approval Details' }) },
        ],

        // --- Reject / Reject on Behalf (ensureNoBlockingPendingDraw cleanup) ---
        /** MCP-verified: "Reject" is a substring of "Reject on Behalf" — `hasNotText` keeps the fallback resolved to only the direct-reject button. */
        directRejectButton: [
            { name: 'role:button[name=Reject](exact)(original)', locator: page.getByRole('button', { name: 'Reject', exact: true }) },
            { name: 'css:button[hasText=Reject][hasNotText=on Behalf]', locator: page.locator('button').filter({ hasText: 'Reject' }).filter({ hasNotText: 'on Behalf' }) },
        ],
        rejectOnBehalfButton: [
            { name: 'role:button[name=Reject on Behalf](exact)(original)', locator: page.getByRole('button', { name: 'Reject on Behalf', exact: true }) },
            { name: 'css:button[hasText=Reject on Behalf]', locator: page.locator('button').filter({ hasText: 'Reject on Behalf' }) },
        ],
        rejectionNotesInput: [
            { name: 'role:textbox[name=Notes (required for rejection)](original)', locator: page.getByRole('textbox', { name: 'Notes (required for rejection)' }) },
            { name: 'placeholder:Enter any remarks or notes about this approval...', locator: page.getByPlaceholder('Enter any remarks or notes about this approval...') },
        ],
    };
}

module.exports = { drawReportingLocators, tc372DrawReportingStrategies };
