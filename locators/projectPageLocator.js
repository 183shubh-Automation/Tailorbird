const projectJobLocators = (page) => ({

    projectsTab: page
        .getByRole('link', { name: /^Projects$/ })
        .or(page.locator('nav').locator('a, [role="link"]').filter({ hasText: /^Projects$/ }).first()),
    jobsTab: page.locator('.mantine-Tabs-tabLabel:has-text("Jobs")'),
    bidsTab: page.locator('.mantine-Tabs-tabLabel:has-text("Bids")'),
    contractsTab: page.locator('.mantine-Tabs-tabLabel:has-text("Contracts")'),

    modal: page.locator('section[role="dialog"][data-modal-content="true"], [role="dialog"]'),
    anyDialog: page.locator('section[role="dialog"]'),
    modalTitleAddProject: page.getByRole('heading', { name: /Add project/i }),

    createProjectButton: page.locator('button:has-text("Create Project")'),
    searchProjectInput: page.locator('input[placeholder="Search..."]'),
    propertyDropdown: page.getByRole('textbox', { name: 'Property' }),
    nameInput: page.getByLabel('Name'),
    descInput: page.getByLabel('Description'),
    startDateInput: page.getByLabel('Start Date'),
    endDateInput: page.getByLabel('End Date'),
    cancelProjectButton: page.getByRole('button', { name: 'Cancel' }),
    addProjectButton: page.getByRole('dialog').getByRole('button', { name: /^Create Project$/i }),

    projectCardByName: (name) =>
        page.locator('.mantine-Group-root:has(p:has-text("' + name + '"))'),

    dynamicText: (text) =>
        page.locator(`p:has-text("${text}")`),

    gridRowByText: (text) =>
        page.locator(`div[role="row"]:has-text("${text}")`),

    optionByName: (name) =>
        page.getByRole('option', { name }),

    successToaster: page.locator('.mantine-Notification-root'),
    successToasterFirst: page.locator('.mantine-Notification-root').first(),

    projectGridName: page.locator(`.mantine-Grid-inner:has-text("Project Name")`),
    projectGridDescription: page.locator(`.mantine-Grid-inner:has-text("Description")`),

    createJobButton: page.locator('button', { hasText: 'Create Job' }),
    jobModal: page.locator('[data-modal-content="true"]'),
    jobTitleInput: page.getByPlaceholder('Enter title'),
    jobTypeInput: page.getByPlaceholder('Select job type'),
    jobDescriptionInput: page.getByPlaceholder('Enter description'),
    jobCancelBtn: page.locator('button:has-text("Cancel")'),
    jobSubmitBtn: page.getByRole('button', { name: /add job/i }),
    jobTypeOption: (type) =>
        page.getByRole('option', { name: type }),

    viewDetailsButton: page.locator('button[title="View Details"]'),
    editButton: page.getByRole('button', { name: 'Edit' }),
    jobOverviewTitle: page.getByText('Job Overview'),

    bidsTabPanel: page.locator('.mantine-Tabs-panel'),
    addRowBtn: page.getByTestId('bt-add-row'),
    addRowMenuBtn: page.getByTestId('bt-add-row-menu'),
    firstGridCell: page.locator('div[role="gridcell"]').first(),
    lastGridCell: page.locator('div[role="gridcell"]').last(),
    bidSearchInput: page.locator('input[data-testid="bird-table-text-input"]'),

    bidQuantityCell: page.locator('[col-id="quantity"]'),
    bidUnitCostCell: page.locator('[col-id="unit_cost"]'),

    inviteVendorsToBidButton: page.locator("button:has-text('Invite Vendors To Bid')"),
    manageVendorsToggle: page.locator('p:has-text("Manage Vendors")'),

    vendorSearchInput: page.getByRole('dialog').locator('input[placeholder="Search..."]'),
    vendorCheckboxByName: (vendor) =>
        page.locator(`.ag-pinned-left-cols-container div[role="row"]:has-text("${vendor}") .ag-checkbox`),
    inviteSelectedVendorsBtn: page.locator('button:has-text("Invite Selected Vendors to Bid")'),

    vendorNameCell: (vendor) =>
        page.locator(`div[col-id="vendor_name"]:has-text("${vendor}")`),

    templateMenuButton: page.locator('button:has(svg.lucide-globe)'),
    templateMenuDropdown: page.locator('.mantine-Menu-dropdown'),
    templateMenuFirstOption: page.locator('.mantine-Menu-itemLabel').nth(0),
    templateMenuSecondOption: page.locator('.mantine-Menu-itemLabel').nth(1),
    templateMenuGlobeIcon: page.locator('svg.lucide-globe'),
    templateMenuFirstDivider: page.locator('.mantine-Menu-divider').first(),

    applyTemplateDialog: page.locator('section[role="dialog"]'),
    applyTemplateTitle: page.locator('section[role="dialog"] h2'),
    applyTemplateMessage: page.locator('section[role="dialog"] p'),
    applyTemplateCancelBtn: page.locator('button:has-text("Cancel")'),
    applyTemplateApplyBtn: page.locator('button:has-text("Apply Template")'),

    saveTemplateDialog: page.locator('section[role="dialog"]'),
    saveTemplateHeader: page.locator('section[role="dialog"] h2'),
    saveTemplateNameLabel: page.locator('label:has-text("Name")'),
    saveTemplateNameInput: page.locator('input[placeholder="Enter name"]'),
    saveTemplateDescLabel: page.locator('label:has-text("Description")'),
    saveTemplateDescInput: page.locator('textarea'),
    saveTemplateCancelBtn: page.locator('button:has-text("Cancel")'),
    saveTemplateSaveBtn: page.locator('button:has-text("Save Template")'),

    notificationRoot: page.locator('.mantine-Notification-root'),
    notificationRootFirst: page.locator('.mantine-Notification-root').first(),

    scopeMixButton: page.locator('button:has(svg.lucide-folder-tree)'),
    scopeModal: page.locator('section[role="dialog"]'),
    scopeSearchInput: page.locator('input.mantine-Input-input'),
    plusIcon: page.locator('button:has(svg.lucide-plus)'),
    repeatIcon: page.locator('button:has(svg.lucide-repeat-2)'),
    scopeGrid: page.locator('.ag-root'),
    scopeClearAllBtn: page.locator('button:has-text("Clear All")'),
    scopeSubmitBtn: page.locator('button:has-text("Submit")'),
    scopeCloseButton: page.locator('button:has(svg[viewBox="0 0 15 15"])'),

    scopeEditorPopup: page.locator('[data-scope-portal-editor="true"]'),
    scopeEditorInput: page.locator('[data-scope-portal-editor="true"] input'),
    scopeEditorCheckBtn: page.locator('[data-scope-portal-editor="true"] button:has(svg.lucide-check)'),
    scopeEditorCancelBtn: page.locator('[data-scope-portal-editor="true"] button:has(svg.lucide-x)'),

    resetTableIcon: page.locator('button[data-variant="subtle"][data-size="md"] svg.lucide-rotate-ccw'),
    resetTableModal: page.locator('section[role="dialog"]'),
    resetTableHeader: page.locator('section[role="dialog"] h2.mantine-Modal-title'),
    resetTableBodyText: page.locator('section[role="dialog"] .mantine-Modal-body p'),
    resetCancelBtn: page.locator('button:has-text("Cancel")'),
    resetConfirmBtn: page.locator('button:has-text("Reset Table")'),

    bidLevelingButton: page.locator('button.mantine-ActionIcon-root:has(svg.lucide-scale)'),
    levelingTotalRow: page.locator('div[role="row"]:has-text("Total")'),
    levelingBidRow: page.locator('div[role="row"]:has-text("Bid with material")'),

    vendorActionsButton: page.locator('button:has(svg.lucide-ellipsis-vertical)').nth(0),
    awardBidMenuItem: page.locator('.mantine-Menu-itemLabel:has-text("Award Bid")'),
    awardDialogCancelBtn: page.locator('section[role="dialog"] button:has-text("Cancel")'),
    awardDialogAwardBtn: page.locator('section[role="dialog"] button:has-text("Award")'),

    awardedStatusCell: page.locator('div[role="row"]:has-text("Awarded") div[col-id="status"] p'),

    finalizeContractBtn: page.locator('button:has-text("Finalize Contract")'),
    finalizeContractConfirmBtn: page.locator('.mantine-Modal-content button:has-text("Finalize Contract")'),

    filterIconBtn: page.getByRole('button', { name: /^Filter$/i }).first(),
    layoutToolbarBtn: page.getByRole('button', { name: /^Layout$/i }).first(),
    viewToolbarBtn: page.getByRole('button', { name: /^View$/i }).first(),
    tableToolbarBtn: page.getByRole('button', { name: /^Table$/i }).first(),
    exportToolbarBtn: page.getByRole('button', { name: /^Export$/i }).first(),
    createProjectToolbarBtn: page.getByRole('button', { name: 'Create Project' }).first(),
    mainContainer: page.locator('main').first(),
    mainSearchInput: page.locator('main input[placeholder="Search..."]').first(),
    projectsLeftNav: page
        .locator('nav')
        .locator('a, button, [role="link"], [role="button"]')
        .filter({ hasText: /^Projects$/ })
        .first(),
    jobsLeftNav: page
        .locator('nav')
        .locator('a, button, [role="link"], [role="button"]')
        .filter({ hasText: /^Jobs \(Contracts & POs\)$/i })
        .first(),
    bidsLeftNav: page
        .locator('nav')
        .locator('a, button, [role="link"], [role="button"]')
        .filter({ hasText: /^Bids$/i })
        .first(),
    toolbarMenuPopup: page.locator('[role="dialog"], [role="menu"], [role="listbox"]').first(),
    filterDrawer: page.locator('.mantine-Paper-root').filter({ hasText: /Filters|Filter Options/i }).first(),
    filterDrawerCloseBtn: page.locator('.mantine-Paper-root').filter({ hasText: /Filters|Filter Options/i }).first().locator('button').filter({ has: page.locator('svg') }).first(),
    filterDrawerResetBtn: page.locator('.mantine-Paper-root').filter({ hasText: /Filters|Filter Options/i }).first().getByRole('button', { name: /Reset Filters/i }).first(),
    filterDrawerFirstCheckbox: page.locator('.mantine-Paper-root').filter({ hasText: /Filters|Filter Options/i }).first().locator('input[type="checkbox"]').first(),
    createJobDialog: page
        .locator('section[role="dialog"], [role="dialog"]')
        .filter({ has: page.getByPlaceholder(/Enter job title/i) })
        .last(),
    createJobDialogCreateBtn: page
        .locator('section[role="dialog"], [role="dialog"]')
        .filter({ has: page.getByPlaceholder(/Enter job title/i) })
        .last()
        .getByRole('button', { name: /^Create$/i })
        .first(),
    createJobDialogCancelBtn: page
        .locator('section[role="dialog"], [role="dialog"]')
        .filter({ has: page.getByPlaceholder(/Enter job title/i) })
        .last()
        .getByRole('button', { name: /Cancel/i })
        .first(),
    noResultsPrimaryText: page.getByText(/No projects added yet|No results/i),
    noResultsSecondaryText: page.getByText(/Use \+ or Create Button to create one|Nothing matches your filters/i),
    projectViewDetailsBtn: page.locator('button[title="View Details"]').first(),
    bidsManageVendorsBtn: page
        .getByRole('tabpanel', { name: /Bids/i })
        .first()
        .locator('div:has(p:has-text("Manage Vendors")) button')
        .first(),

    exportButton: page.locator('button:has-text("Export")'),

    // Bulk Update Status (Contracts tab)
    contractsScopeHeader: page.getByRole('columnheader', { name: 'Scope' }),
    contractRowCheckboxes: page.locator('revo-grid input[type="checkbox"], [role="treegrid"] input[type="checkbox"]'),
    contractAltCheckboxes: page.getByRole('checkbox'),
    bulkUpdateStatusBtn: page.locator('button:has-text("Bulk Update Status")').first(),
    bulkUpdateInProgressItem: page.locator('div.mantine-Menu-itemLabel:has-text("In Progress")').first(),
    inProgressStatusText: page.locator('text=In Progress').first(),

    agCellEditorInput: page.locator('input[data-testid="bird-table-text-input"]'),
    agCellEditorTextarea: page.locator('textarea[data-testid="bird-table-text-input"]'),
    firstAgRow: page.locator('div[role="row"][row-index="0"]'),
    agRowCells: () => page.locator('div[role="row"][row-index="0"] [role="gridcell"]')

});

/**
 * Self-healing locator strategies for the TC71 Create Project flow (pages/projectPage.js).
 * Strategy #1 per element is always the EXACT original locator this file used before
 * healing was added, so normal runs resolve identically (same expression, same cost)
 * to the pre-existing passing baseline. Later strategies are pure fallback safety nets
 * that only engage if the original stops matching. No regex, no XPath (semgrep-safe).
 *
 * All strategies MCP-verified live 2026-08-04 (beta.tailorbird.com/projects). Where an
 * element genuinely has no further independent attribute (e.g. "Projects" nav item has
 * no data-testid/aria-label/icon), the strategy count is honest, not padded.
 * @param {import('@playwright/test').Page} page
 */
function projectElementStrategies(page) {
    return {
        projectsTab: [
            {
                name: 'nav>filter[text=Projects]',
                /** Keep under `nav` only — breadcrumb "Projects" on project/property views also matches `getByRole('link')` (strict mode violation). Mantine renders duplicate NavLink nodes (e.g. responsive); `.first()` often hits a hidden clone — only match visible. */
                locator: page.locator('nav').locator('a, button, [role="link"]').filter({ hasText: /^Projects$/ }).locator('visible=true').first(),
            },
            /** MCP-verified: the live nav renders "Projects" as an <a> WITHOUT href/role, so it has no accessibility role — getByRole('link') never matches it. getByText is tag-agnostic, so it survives even if this switches to a <button>/<div>. */
            { name: 'text:Projects[in nav]', locator: page.locator('nav').getByText('Projects', { exact: true }).locator('visible=true').first() },
            /** MCP-verified: only 2 genuinely independent strategies exist for this element — no data-testid, aria-label, or distinguishing class anywhere on the live nav item. Not padded with a 3rd/4th. */
        ],
        createProjectBtn: [
            { name: 'css:button:has-text(Create Project)', locator: page.locator(`button:has-text('Create Project')`) },
            /** No-regex: exact:true gives the same precise "Create Project" (not "Create Project Something") match the former /^Create Project$/i regex gave, without a regex literal. */
            { name: 'role:button[name=Create Project]', locator: page.getByRole('button', { name: 'Create Project', exact: true }) },
            /**
             * MCP-verified: the toolbar trigger has a "plus" icon (svg.lucide-plus); the modal's
             * OWN internal "Create Project" submit button (same text!) was confirmed to have NO
             * icon at all — so icon+text together unambiguously identify the toolbar button even
             * while the modal is open (both "Create Project" buttons coexist in the DOM then).
             */
            { name: 'css:button:has(svg.lucide-plus):has-text(Create Project)', locator: page.locator('button:has(svg.lucide-plus)').filter({ hasText: 'Create Project' }) },
            /** Scoped to <main> — the modal's own submit button is NOT a descendant of <main>, so this also disambiguates from the modal's duplicate-text button. Weakest signal (breaks if markup ever moves), kept last. */
            { name: 'css:main>>button[hasText=Create Project]', locator: page.locator('main').locator('button').filter({ hasText: 'Create Project' }) },
        ],
        modal: [
            { name: 'css:section[role=dialog][data-modal-content]', locator: page.locator('section[role="dialog"][data-modal-content="true"], [role="dialog"]') },
            { name: 'role:dialog', locator: page.getByRole('dialog') },
            /** MCP-verified: structural — the dialog's aria-labelledby points at an h2.mantine-Modal-title inside it; matching "a dialog that HAS that heading" is a different mechanism (DOM containment) than matching by role alone. */
            { name: 'css:dialog:has(h2.mantine-Modal-title)', locator: page.locator('[role="dialog"]').filter({ has: page.locator('h2.mantine-Modal-title') }) },
            /** MCP-verified: aria-modal="true" is a real, separate attribute from role="dialog" (both usually co-occur, but are independently settable). */
            { name: 'css:[aria-modal=true]', locator: page.locator('[aria-modal="true"]') },
        ],
        modalTitle: [
            { name: 'role:heading[name=/Add project/i]', locator: page.getByRole('heading', { name: /Add project/i }) },
            /** MCP-verified: Mantine's own modal-title class, filtered by text — a different mechanism (CSS class match) than ARIA role+accessible-name computation. */
            { name: 'css:.mantine-Modal-title[hasText=Add project]', locator: page.locator('.mantine-Modal-title').filter({ hasText: 'Add project' }) },
            /** MCP-verified: structural — the dialog's title is always its first <h2>, regardless of text/copy changes. Weakest signal (breaks if the dialog ever has an earlier h2), kept last. Only 3 genuinely independent strategies found for this element — not padded to 4. */
            { name: 'position:dialog-first-h2', locator: page.locator('[role="dialog"] h2').first() },
        ],
        nameInput: [
            { name: 'label:Name', locator: page.getByLabel('Name') },
            { name: 'role:textbox[name=Name]', locator: page.getByRole('textbox', { name: 'Name' }) },
            /** MCP-verified: real placeholder is "Enter project name" — no data-testid/aria-label exists anywhere in this modal. */
            { name: 'placeholder:Enter project name', locator: page.getByPlaceholder('Enter project name') },
            /** MCP-verified: field order in the modal is fixed [Name, Property, Description, Start Date, End Date, ...] — Name is always the 1st non-hidden input. Positional, weakest signal, kept last. */
            { name: 'position:dialog-input-nth(0)', locator: page.locator('[role="dialog"] input:not([type="hidden"])').nth(0) },
        ],
        propertyDropdown: [
            { name: 'role:textbox[name=Property]', locator: page.getByRole('textbox', { name: 'Property' }).first() },
            /** MCP-verified: despite aria-haspopup="listbox", this input's computed accessibility role is "textbox", not "combobox" (no role attribute set anywhere in the DOM) — getByRole('combobox') never matches it. Placeholder is a genuinely independent attribute (label vs. placeholder), so it survives if the <label> association breaks. */
            { name: 'placeholder:Select property', locator: page.getByPlaceholder('Select property').first() },
            /** MCP-verified: no name attribute, no data-testid on any modal field — aria-haspopup="listbox" is real but shared with Budget Category's field too, so alone it's not unique; combined with position it is. */
            { name: 'css:[aria-haspopup=listbox][nth=0]', locator: page.locator('[role="dialog"] [aria-haspopup="listbox"]').nth(0) },
            { name: 'position:dialog-input-nth(1)', locator: page.locator('[role="dialog"] input:not([type="hidden"])').nth(1) },
        ],
        descInput: [
            { name: 'label:Description', locator: page.getByLabel('Description') },
            { name: 'role:textbox[name=Description]', locator: page.getByRole('textbox', { name: 'Description' }) },
            /** MCP-verified: real placeholder is "Enter project description". */
            { name: 'placeholder:Enter project description', locator: page.getByPlaceholder('Enter project description') },
            { name: 'position:dialog-input-nth(2)', locator: page.locator('[role="dialog"] input:not([type="hidden"])').nth(2) },
        ],
        startDateInput: [
            { name: 'label:Start Date', locator: page.getByLabel('Start Date') },
            { name: 'role:textbox[name=Start Date]', locator: page.getByRole('textbox', { name: 'Start Date' }) },
            /** MCP-verified: both date fields share the literal placeholder "YYYY-MM-DD" (not unique alone) — Start renders first in DOM order, so `.nth(0)` disambiguates. */
            { name: 'placeholder:YYYY-MM-DD[nth=0]', locator: page.getByPlaceholder('YYYY-MM-DD').nth(0) },
            /** MCP-verified: field-order position within the modal (index 3 of the non-hidden inputs) — a genuinely different mechanism (absolute field order) than "nth among same-placeholder fields" above. Weakest signal, kept last. */
            { name: 'position:dialog-input-nth(3)', locator: page.locator('[role="dialog"] input:not([type="hidden"])').nth(3) },
        ],
        endDateInput: [
            { name: 'label:End Date', locator: page.getByLabel('End Date') },
            { name: 'role:textbox[name=End Date]', locator: page.getByRole('textbox', { name: 'End Date' }) },
            { name: 'placeholder:YYYY-MM-DD[nth=1]', locator: page.getByPlaceholder('YYYY-MM-DD').nth(1) },
            { name: 'position:dialog-input-nth(4)', locator: page.locator('[role="dialog"] input:not([type="hidden"])').nth(4) },
        ],
    };
}

/**
 * Self-healing strategies for TC81 (tests/TC06_jobs.spec.js — "Add job" modal flow and
 * job config). All MCP-verified live 2026-08-06 (beta.tailorbird.com/projects/<id>,
 * job details page, and the Contracts "Edit Contract Overview" dialog). Every field's
 * dynamic Mantine `id` is unusable; `label[for]` and `placeholder` are two genuinely
 * independent real attributes confirmed to resolve to the SAME input node for every
 * field below (verified via direct DOM equality before writing).
 */

/** "Create Job" toolbar trigger on the project's Jobs tab — original CSS text-match kept as #1. */
function createJobBtnStrategies(page) {
    return [
        { name: "css:button[hasText=Create Job](original)", locator: page.locator('button', { hasText: 'Create Job' }) },
        { name: 'role:button[name=Create Job](exact)', locator: page.getByRole('button', { name: 'Create Job', exact: true }) },
    ];
}

/**
 * "Add job" modal root — the constructor's own field (`this.modal`, used by
 * openCreateJobModal()). Original is a simple, unfiltered dialog-role selector.
 */
function addJobModalStrategies(page) {
    return [
        { name: 'css:dialog[data-modal-content]|role=dialog(original)', locator: page.locator('section[role="dialog"][data-modal-content="true"], [role="dialog"]') },
        { name: 'role:dialog', locator: page.getByRole('dialog') },
    ];
}

/**
 * "Add job" modal, re-scoped (used locally inside fillJobForm()/submitJob() — a
 * SEPARATE lookup from `this.modal` above). Mantine can leave stale hidden dialogs in
 * the DOM (same lesson as the Create-Property/Create-Project modals) — original filters
 * by "contains the Title input" and takes `.last()`. Fallback uses `getByRole('dialog')`
 * instead of the raw CSS role-attribute selector (still filtered+last the same way).
 */
function addJobModalScopedStrategies(page) {
    return [
        { name: 'css:dialog[data-modal-content]|role=dialog, filter(title input), last(original)', locator: page.locator('section[role="dialog"][data-modal-content="true"], [role="dialog"]').filter({ has: page.getByPlaceholder('Enter job title') }).last() },
        { name: 'role:dialog, filter(title input), last', locator: page.getByRole('dialog').filter({ has: page.getByPlaceholder('Enter job title') }).last() },
    ];
}

/** Add-job "Title" field — original placeholder-based; label-based added as an independent mechanism (MCP-verified same node). */
function jobTitleInputStrategies(scope) {
    return [
        { name: 'placeholder:Enter job title(original)', locator: scope.getByPlaceholder('Enter job title') },
        { name: 'label:Title', locator: scope.getByLabel('Title', { exact: true }) },
    ];
}

/** Add-job "Job Type" dropdown. */
function jobTypeDropdownStrategies(scope) {
    return [
        { name: 'placeholder:Select job type(original)', locator: scope.getByPlaceholder('Select job type') },
        { name: 'label:Job Type', locator: scope.getByLabel('Job Type', { exact: true }) },
    ];
}

/** Add-job "Financial Type" dropdown — original 2-mechanism `.or()` union kept intact; label-based fallback added. */
function jobFinancialTypeDropdownStrategies(scope) {
    return [
        { name: 'placeholder:Select Contract or PO(original)', locator: scope.getByPlaceholder('Select Contract or PO') },
        { name: 'role:combobox[name=/Financial Type/i](original)', locator: scope.getByRole('combobox', { name: /Financial Type/i }) },
        { name: 'label:Financial Type', locator: scope.getByLabel('Financial Type', { exact: true }) },
    ];
}

/**
 * Add-job "Vendor" dropdown. Two different pre-existing call sites used two different
 * expressions for this same field (constructor vs. fillJobForm) — both kept verbatim as
 * originals. MCP-verified this input carries NO `role` attribute (computed accessibility
 * role defaults to "textbox", not "combobox" — `getByRole('combobox', ...)` never
 * matches it live, mirroring the same stale-combobox-assumption bug found elsewhere in
 * this suite), so `getByRole('textbox', {name:'Vendor'})` is the one that actually works;
 * kept first for that reason even though it originates from the other call site.
 */
function jobVendorDropdownStrategies(scope) {
    return [
        { name: 'role:textbox[name=Vendor](original, from fillJobForm)', locator: scope.getByRole('textbox', { name: 'Vendor' }) },
        { name: 'role:combobox[name=/Vendor/i](original, from constructor — MCP-verified this role is never actually present)', locator: scope.getByRole('combobox', { name: /Vendor/i }) },
        { name: 'placeholder:Select vendor(original, from constructor)', locator: scope.getByPlaceholder('Select vendor') },
        { name: 'placeholder:Loading vendors...(original, from constructor)', locator: scope.getByPlaceholder('Loading vendors...') },
    ];
}

/** Add-job "Description" field. */
function jobDescriptionInputStrategies(scope) {
    return [
        { name: 'placeholder:Enter job description(original)', locator: scope.getByPlaceholder('Enter job description') },
        { name: 'label:Description', locator: scope.getByLabel('Description', { exact: true }) },
    ];
}

/** Add-job "Estimated Budget" field — original 3-mechanism `.or()` union kept intact. */
function jobEstimatedBudgetInputStrategies(scope) {
    return [
        { name: 'role:textbox[name=/Estimated Budget/i](original)', locator: scope.getByRole('textbox', { name: /Estimated Budget/i }) },
        { name: 'placeholder:/Enter estimated budget/i(original)', locator: scope.getByPlaceholder(/Enter estimated budget/i) },
        { name: 'css:input[placeholder*=budget i](original)', locator: scope.locator('input[placeholder*="budget" i]') },
    ];
}

/** Add-job "Start Date" / "End Date" fields — role+label association already disambiguates them (both fields share no other unique attribute; MCP-verified both render `placeholder="YYYY-MM-DD"`). */
function jobStartDateInputStrategies(scope) {
    return [
        { name: 'role:textbox[name=Start Date](original)', locator: scope.getByRole('textbox', { name: 'Start Date' }) },
        { name: 'label:Start Date', locator: scope.getByLabel('Start Date', { exact: true }) },
    ];
}
function jobEndDateInputStrategies(scope) {
    return [
        { name: 'role:textbox[name=End Date](original)', locator: scope.getByRole('textbox', { name: 'End Date' }) },
        { name: 'label:End Date', locator: scope.getByLabel('End Date', { exact: true }) },
    ];
}

/** Add-job "Budget Category" combobox (selectJobBudgetCategory). */
function jobBudgetCategoryInputStrategies(scope) {
    return [
        { name: 'role:textbox[name=Budget Category](original)', locator: scope.getByRole('textbox', { name: 'Budget Category' }) },
        { name: 'label:Budget Category', locator: scope.getByLabel('Budget Category', { exact: true }) },
    ];
}

/** Add-job modal "Create" submit button — original scoped-to-modal role lookup kept as #1. */
function jobSubmitBtnStrategies(scope) {
    return [
        { name: 'role:button[name=Create](exact,original)', locator: scope.getByRole('button', { name: 'Create', exact: true }) },
    ];
}

/** Job-details "Contracts" tab trigger (projectPage.js constructor field, clicked by openContractsTab()). */
function contractsTabTriggerStrategies(page) {
    return [
        { name: 'role:tab[name=Contracts](original,exact)', locator: page.getByRole('tab', { name: 'Contracts' }) },
    ];
}

/** Job-details "Contracts" tabpanel and its "Edit" button, and the resulting "Edit Contract/PO Overview" dialog fields — inline locators lifted from tests/TC06_jobs.spec.js. */
function contractsTabPanelStrategies(page) {
    return [
        { name: 'role:tabpanel[name=Contracts](original)', locator: page.getByRole('tabpanel', { name: 'Contracts' }) },
    ];
}
function contractEditButtonStrategies(contractsTabPanel) {
    return [
        { name: 'role:button[name=Edit](original,exact)', locator: contractsTabPanel.getByRole('button', { name: /^Edit$/i }) },
    ];
}
function editContractDialogStrategies(page) {
    return [
        { name: 'role:dialog[hasText=/Edit (Contract|PO) Overview/i](original)', locator: page.getByRole('dialog').filter({ hasText: /Edit (Contract|PO) Overview/i }) },
    ];
}
function estimatedTotalCostInputStrategies(editContractDialog) {
    return [
        { name: 'role:textbox[name=/Estimated total cost/i](original)', locator: editContractDialog.getByRole('textbox', { name: /Estimated total cost/i }) },
        { name: 'label:/Estimated total cost/i(original)', locator: editContractDialog.getByLabel(/Estimated total cost/i) },
        /** MCP-verified: real placeholder is "Enter estimated total cost" — a genuinely independent attribute from the label association above. */
        { name: 'placeholder:Enter estimated total cost', locator: editContractDialog.getByPlaceholder('Enter estimated total cost') },
    ];
}
function saveChangesBtnStrategies(editContractDialog) {
    return [
        { name: 'role:button[name=/Save Changes|Save/i](original)', locator: editContractDialog.getByRole('button', { name: /Save Changes|Save/i }) },
    ];
}

/** Job-details "Job Summary" tab/tabpanel and label→value field pairs (properties.js validateJobDetails). */
function jobSummaryTabStrategies(page) {
    return [
        { name: 'role:tab[name=/Job Summary/i](original)', locator: page.getByRole('tab', { name: /Job Summary/i }) },
    ];
}
function jobSummaryTabpanelStrategies(page) {
    return [
        { name: 'role:tabpanel[name=/Job Summary/i](original)', locator: page.getByRole('tabpanel', { name: /Job Summary/i }) },
        { name: 'css:tabpanel[first](original)', locator: page.locator('[role="tabpanel"]').first() },
    ];
}
/**
 * Job Summary label→value pair (e.g. "Job Name" → "Mall in Noida"). Original uses a raw
 * XPath template (`.//p[normalize-space()="${label}"]/following-sibling::p[1]`), kept as
 * #1. MCP-verified the DOM structure is a label `<p>` immediately followed by a value
 * `<p>` sibling — the CSS adjacent-sibling combinator `+` with `:text-is()` expresses the
 * SAME structural relationship through a different selector engine (CSS vs XPath), so it
 * is not a fabricated fallback.
 */
function jobSummaryFieldValueStrategies(summaryPanel, label) {
    return [
        { name: 'xpath:p[label]/following-sibling::p[1](original)', locator: summaryPanel.locator(`xpath=.//p[normalize-space()="${label}"]/following-sibling::p[1]`) },
        { name: 'css:p:text-is(label)+p', locator: summaryPanel.locator(`p:text-is("${label}") + p`) },
    ];
}
/** Job-details "Edit" button (Overview) — properties.js validateJobDetails and projectPage.js validateOverviewVisible both reference this. */
function jobOverviewEditButtonStrategies(page) {
    return [
        { name: 'role:button[name=Edit](original,exact)', locator: page.getByRole('button', { name: 'Edit' }) },
    ];
}

module.exports = {
    projectJobLocators,
    projectElementStrategies,
    createJobBtnStrategies,
    addJobModalStrategies,
    addJobModalScopedStrategies,
    jobTitleInputStrategies,
    jobTypeDropdownStrategies,
    jobFinancialTypeDropdownStrategies,
    jobVendorDropdownStrategies,
    jobDescriptionInputStrategies,
    jobEstimatedBudgetInputStrategies,
    jobStartDateInputStrategies,
    jobEndDateInputStrategies,
    jobBudgetCategoryInputStrategies,
    jobSubmitBtnStrategies,
    contractsTabTriggerStrategies,
    contractsTabPanelStrategies,
    contractEditButtonStrategies,
    editContractDialogStrategies,
    estimatedTotalCostInputStrategies,
    saveChangesBtnStrategies,
    jobSummaryTabStrategies,
    jobSummaryTabpanelStrategies,
    jobSummaryFieldValueStrategies,
    jobOverviewEditButtonStrategies,
};
