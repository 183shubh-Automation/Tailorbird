function approvalJobLocators(page) {
    return {
        // Left sidebar Approvals link - first occurrence of text Approvals
        approvalTab: page.locator('text=Approvals').first(),
        
        // Top tabs
        approvalTemplatesTab: page.getByRole('tab', { name: 'Approval Templates' }),
        myApprovalsTab: page.getByRole('tab', { name: 'My Approvals' }),
        allApprovalsTab: page.getByRole('tab', { name: 'All Approvals' }),
        
        // Search input
        searchInput: page.getByPlaceholder('Search...'),
        
        // Toolbar: Filter, Views, Table (dropdown: add column / hide-show), Export
        filterButton: page.locator('main').getByRole('button', { name: 'Filter' }),
        createViewButton: page.locator('main').getByRole('button', { name: /^Views?$/i }),
        tableMenuButton: page
            .locator('main')
            .getByTestId('bt-table-action')
            .or(page.locator('main').getByRole('button', { name: 'Table' })),
        addColumnMenuItem: page.getByTestId('bt-table-action-add-column'),
        hideShowColumnsMenuItem: page.getByTestId('bt-table-action-hide-show-columns'),
        exportButton: page.locator('main').getByRole('button', { name: 'Export' }),
        
        // Create Template button
        // createTemplateButton: page.getByRole('button', { name: 'Create Template' }),
        createTemplateButton: page.getByRole('button', { name: 'Create Template' }).first(),
        
        // Form inputs on Create/Edit Template dialog
        templateNameInput: page.getByPlaceholder('Enter template name'),
        changeOrderRadio: page.getByRole('radio', { name: 'Change Order' }),
        invoiceRadio: page.getByRole('radio', { name: 'Invoice' }),
        contractRadio: page.getByRole('radio', { name: 'Contract/PO' }),
        budgetRadio: page.getByRole('radio', { name: 'Budget' }),

         addPropertiesTrigger: page
            .getByRole('button', { name: /Search and add properties/i })
            .or(page.locator('button').filter({ hasText: 'Search and add properties' })),
       
        
        addPropertiesInput: page.getByPlaceholder('Search properties'),
        selectApproverInput: page.getByPlaceholder('Select approver'),
        amountInput: page.getByPlaceholder('Enter Amount'),
        // Create/Edit template drawer (Mantine Drawer uses role="dialog")
        templateDialog: page
            .getByRole('dialog')
            .filter({ has: page.getByPlaceholder('Enter template name') }),
        // "Always Required" checkbox inputs — one per approver row; keep scoped to templateDialog (property picker is portaled).
        alwaysRequiredCheckboxesInTemplateDialog: page
            .getByRole('dialog')
            .filter({ has: page.getByPlaceholder('Enter template name') })
            .locator('input[type="checkbox"]'),

        // Dialog buttons
        cancelButton: page.getByRole('button', { name: 'Cancel' }),
        goBackButton: page.getByRole('button', { name: 'Go Back' }),
        createTemplateSubmit: page.getByRole('button', { name: /^Create Template$/ }).last(),
        updateTemplateButton: page.getByRole('button', { name: 'Update Template' }),
        
        // Table
        templateTable: page.locator('treegrid'),
        tableHeaders: page.locator('columnheader'),
        tableRows: page.getByRole('row'),
        
        // Action buttons in table
        editButtons: page.getByRole('button', { name: 'Edit' }),
        
        // Delete confirmation dialog buttons
        deleteConfirmButton: page.getByRole('button', { name: 'Delete' }).last(),
        deleteConfirmCancelButton: page.getByRole('button', { name: 'Cancel' }).last(),
        
        // Filter dialog
        filterSearchInput: page.getByPlaceholder('Enter values to search for (OR logic)').first(),
        
        // Manage Columns (drawer/modal)
        manageColumnsDialog: page
            .getByRole('dialog', { name: 'Manage Columns' })
            .or(page.locator('section[role="dialog"]').filter({ hasText: 'Manage Columns' })),
        defaultColumnsButton: page.locator('button').filter({ hasText: 'Default Columns' }).first(),
        columnCheckbox: page.locator('checkbox').first(),
        
        // Create View
        viewNameInput: page.getByPlaceholder('Enter view name...'),
        saveViewButton: page.getByRole('button').filter({ hasText: /save/i }).first(),
        
        // Template search cells
        templateNameCell: (name) => page.locator(`text=${name}`).first(),
        columnHeaderByName: (header) => page.locator(`columnheader:has-text("${header}")`),
        
        // Dialog
        dialog: page.locator('dialog'),
        goBackDialog: page.locator('dialog').filter({ hasText: 'Go Back' }),
        
        // Properties (for property creation in approval tests)
        propertiesNavLink: page.locator(".mantine-NavLink-root:has-text('Properties')").first(),
        createPropertyButton: page.locator("button:has-text('Create Property')"),
        addPropertyModalHeader: page.locator(".mantine-Modal-header:has-text('Add property')"),
        propertyNameInput: page.getByLabel('Name'),
        propertyAddressInput: page.getByRole('textbox', { name: 'Address' }),
        addressSuggestion: (address) => page.locator(`.mantine-Autocomplete-option:has-text("${address}")`),
        propertyTypeInput: page.locator('input[placeholder="Select type"]'),
        propertyTypeOption: (type) => page.locator(`.mantine-Select-option:has-text("${type}")`),
        addPropertyButton: page.getByRole('button', { name: /add property/i }),
        propertyBreadcrumb: (name) => page.locator(`.mantine-Breadcrumbs-root:has-text('${name}')`),
        propertyGrid: (name) => page.locator(`.mantine-SimpleGrid-root p:has-text('${name}')`),
    }
};

/**
 * Self-healing strategies for TC168/TC169 (tests/TC10_approval.spec.js — Create Approval
 * Template flow). All MCP-verified live 2026-08-06 (beta.tailorbird.com/approvals/template).
 * Strategy #1 in every list is the exact original pre-existing expression.
 * @param {import('@playwright/test').Page} page
 */
function approvalElementStrategies(page) {
    const templateDialog = () => page.getByRole('dialog').filter({ has: page.getByPlaceholder('Enter template name') });
    return {
        /** "Approval Templates" top tab — original role-based lookup kept as #1; Mantine tab-class fallback (same pattern confirmed elsewhere in this suite). */
        approvalTemplatesTab: [
            { name: 'role:tab[name=Approval Templates](original)', locator: page.getByRole('tab', { name: 'Approval Templates' }) },
            { name: 'css:.mantine-Tabs-tab[hasText=Approval Templates]', locator: page.locator('.mantine-Tabs-tab').filter({ hasText: 'Approval Templates' }) },
        ],
        /** "Create Template" toolbar trigger — original role-based `.first()` kept as #1. */
        createTemplateButton: [
            { name: 'role:button[name=Create Template][first](original)', locator: page.getByRole('button', { name: 'Create Template' }).first() },
        ],
        /**
         * Create/Edit Template dialog — original filters by "contains the Template Name
         * input" (Mantine can leave stale hidden dialogs in the DOM, same lesson as
         * elsewhere in this suite). Centralizes the ad-hoc duplicate previously built
         * inline at pages/approvalPage.js:792.
         */
        templateDialog: [
            { name: 'role:dialog[has=templateNameInput](original)', locator: templateDialog() },
        ],
        /** Property-picker combobox dropdown opened by the "Add Properties" trigger. MCP-verified: a `<div role="button">Search and add properties</div>`, not a `<button>` tag — Playwright's role-based lookup already matches it regardless of tag. */
        addPropertiesDropdown: [
            { name: 'css:.mantine-Combobox-dropdown:visible(original)', locator: page.locator('.mantine-Combobox-dropdown:visible') },
        ],
        /** "Enter Amount" input scoped to the template dialog — centralizes the raw duplicate previously built inline (twice) instead of reusing the exported `amountInput`. */
        amountInputInDialog: [
            { name: 'placeholder:Enter Amount[in dialog](original)', locator: templateDialog().getByPlaceholder('Enter Amount') },
        ],
        /** Duplicate/already-exists toast shown when submitting a template name that's already linked. */
        duplicateTemplateToast: [
            { name: 'role:alert[hasText=/already linked|exists|duplicate/i](original)', locator: page.locator('[role="alert"]').filter({ hasText: /already linked|already exists|duplicate/i }) },
        ],
        /** Toolbar Export button scoped to `main` — same element as the exported `exportButton` above; centralizes a duplicate previously built inline in tests/TC10_approval.spec.js (TC195's fallback branch). */
        exportButtonInMain: [
            { name: 'css:main>>role:button[name=Export](original)', locator: page.locator('main').getByRole('button', { name: 'Export' }) },
        ],
    };
}

/** Property row within the Add-Properties combobox dropdown, matched by property name (MCP-verified: plain `<div>` rows with a nested checkbox, no `role="option"` present). */
function addPropertyRowStrategies(dropdown, propertyName) {
    return [
        { name: 'css:div[has=checkbox][hasText](original)', locator: dropdown.locator('div:has(input[type="checkbox"])').filter({ hasText: propertyName }) },
    ];
}
/** Checkbox input inside a matched property row. */
function addPropertyRowCheckboxStrategies(row) {
    return [
        { name: 'css:input[type=checkbox].mantine-Checkbox-input(original)', locator: row.locator('input[type="checkbox"].mantine-Checkbox-input') },
    ];
}
/** First non-"Select all" result row in the dropdown (used when no exact-name match is found). */
function firstPropertyResultRowStrategies(dropdown) {
    return [
        { name: 'css:div[has=checkbox][hasNotText=Select all](original)', locator: dropdown.locator('div:has(input[type="checkbox"])').filter({ hasNotText: 'Select all' }) },
    ];
}

/** Template row in the Approval Templates table, matched by template name (originally inline in tests/TC10_approval.spec.js). */
function templateRowByNameStrategies(page, templateName) {
    return [
        { name: 'role:row[hasText](original)', locator: page.getByRole('row').filter({ hasText: templateName }) },
    ];
}

/**
 * Self-healing strategies for ApprovalJob.createProperty() (pages/approvalPage.js, called by
 * TC372 — tests/TC25_Draw_reporting.spec.js). Every raw inline locator previously built in that
 * method is centralized here. All MCP-verified live 2026-08-06 (beta.tailorbird.com/properties,
 * navigated to via the same "Properties" nav-link route this method itself uses). This dialog is
 * the SAME "Add property" Mantine dialog already healed for TC49 in locators/propertyLocator.js
 * (createPropertyButtonStrategies/addPropertyDialogStrategies/etc.) — confirmed via MCP that the
 * route this method takes (clicking the sidebar "Properties" nav link, then "Create Property")
 * renders identical markup, so the same fallback mechanisms apply here.
 * Strategy #1 in every array is the exact original pre-existing expression, unchanged.
 * No regex/XPath in ADDED strategies.
 */
function createPropertyDialogStrategies(page) {
    return {
        /** Sidebar "Properties" nav link. Original CSS class+text kept as #1; fallback scopes to the <nav> landmark and uses role-based lookup (MCP-verified: the breadcrumb ALSO has a "Properties" link, so an unscoped role lookup would be ambiguous — scoping to <nav> avoids that). */
        propertiesNavLink: [
            { name: "css:.mantine-NavLink-root:has-text('Properties')(original)", locator: page.locator(".mantine-NavLink-root:has-text('Properties')").first() },
            { name: 'role:nav>>link[name=Properties](exact)', locator: page.locator('nav').getByRole('link', { name: 'Properties', exact: true }) },
        ],
        /** "Create Property" toolbar button — original CSS text-match kept as #1; role-based fallback MCP-verified (exact visible text "Create Property"). */
        createPropertyButton: [
            { name: "css:button:has-text('Create Property')(original)", locator: page.locator("button:has-text('Create Property')") },
            { name: 'role:button[name=Create Property](exact)', locator: page.getByRole('button', { name: 'Create Property', exact: true }) },
        ],
        /**
         * "Add property" modal header. Original scopes `.mantine-Modal-header` by hasText (kept
         * as #1); MCP-verified the header is `<header class="...mantine-Modal-header"><h2
         * class="mantine-Modal-title">Add property</h2>...`.
         * CAUTION (found live via a real test run, not assumed): an earlier fallback attempt
         * scoped to `page.getByRole('dialog').filter(...)` instead — that resolves to the outer
         * dialog `<section>`, a DIFFERENT physical node than the original's `<header>` child,
         * so `.or()`-combining them threw a strict-mode violation (2 elements). Fixed by scoping
         * the fallback to the same `<header>` tag so both strategies resolve to the identical node.
         */
        addPropertyModalHeader: [
            { name: "css:.mantine-Modal-header:has-text('Add property')(original)", locator: page.locator(".mantine-Modal-header:has-text('Add property')") },
            { name: 'css:header[has=heading(Add property)]', locator: page.locator('header').filter({ has: page.getByRole('heading', { name: 'Add property', level: 2 }) }) },
        ],
        /** Name field. Original `getByLabel('Name')` kept as #1; MCP-verified placeholder="Enter name" is a genuinely independent attribute on the same input. */
        nameInput: [
            // { name: 'label:Name(original)', locator: page.getByLabel('Name') },
            { name: 'placeholder:Enter name', locator: page.getByPlaceholder('Enter name') },
        ],
        /** Address field. Original `getByRole('textbox', {name:'Address'})` kept as #1; MCP-verified placeholder="Enter address" fallback. */
        addressInput: [
            // { name: 'role:textbox[name=Address](original)', locator: page.getByRole('textbox', { name: 'Address' }) },
            { name: 'placeholder:Enter address', locator: page.getByPlaceholder('Enter address') },
        ],
        /** Google-Maps-Autocomplete address suggestion, keyed by the address text passed to createProperty(). Original CSS class+hasText kept as #1; MCP-verified the same option also carries `role="option"` in the accessibility tree (the visible popover only — stale/hidden popovers are excluded from the a11y tree, unlike an unscoped second CSS lookup). */
        addressSuggestion: (address) => [
            // { name: 'css:.mantine-Autocomplete-option[hasText](original)', locator: page.locator(`.mantine-Autocomplete-option:has-text("${address}")`) },
            { name: 'role:option[name=address]', locator: page.getByRole('option', { name: address }) },
        ],
        /** Property "Type" input. Original CSS placeholder-attribute selector kept as #1; MCP-verified role-based fallback (exact accessible name "Type", scoped to `textbox` role so it excludes Mantine's hidden `role="listbox"` sharing the same label). */
        typeInput: [
            // { name: 'css:input[placeholder=Select type](original)', locator: page.locator('input[placeholder="Select type"]') },
            { name: 'role:textbox[name=Type](exact)', locator: page.getByRole('textbox', { name: 'Type', exact: true }) },
        ],
        /** Property-type Select dropdown option, keyed by the type text passed to createProperty(). Original CSS class+hasText kept as #1; MCP-verified role="option" fallback, same reasoning as addressSuggestion above. */
        propertyTypeOption: (type) => [
            { name: 'css:.mantine-Select-option[hasText](original)', locator: page.locator(`.mantine-Select-option:has-text("${type}")`) },
            { name: 'role:option[name=type]', locator: page.getByRole('option', { name: type }) },
        ],
        /** Modal submit button. Original regex-based role lookup kept verbatim as #1 (pre-existing regex is fine to keep); fallback uses a plain (non-regex) text filter scoped to the dialog — Playwright's `hasText` string form is already a case-insensitive substring match, so no regex is needed in the new strategy. */
        addPropertyBtn: [
            // { name: 'role:button[name=/add property/i](original)', locator: page.getByRole('button', { name: /add property/i }) },
            { name: "css:dialog>>button[hasText='add property']", locator: page.locator('[role="dialog"] button').filter({ hasText: 'add property' }) },
        ],
        /**
         * Post-creation breadcrumb, keyed by the new property's name. Original scopes the whole
         * `.mantine-Breadcrumbs-root` container by hasText (kept as #1).
         * CAUTION (found live via a real test run, not assumed): an earlier fallback attempt
         * resolved directly to the nested `button.tb-property-selector-button` instead — a
         * DIFFERENT physical node than the original's whole-container match (the button is a
         * descendant of `.mantine-Breadcrumbs-root`), so `.or()`-combining them threw a
         * strict-mode violation (2 elements). Fixed by keeping the fallback scoped to the same
         * `.mantine-Breadcrumbs-root` container (filtered by `has:` the button), so both
         * strategies resolve to the identical container node.
         */
        breadcrumb: (name) => [
            // { name: "css:.mantine-Breadcrumbs-root:has-text(name)(original)", locator: page.locator(`.mantine-Breadcrumbs-root:has-text('${name}')`) },
            { name: 'css:.mantine-Breadcrumbs-root[has=.tb-property-selector-button[hasText]]', locator: page.locator('.mantine-Breadcrumbs-root').filter({ has: page.locator('.tb-property-selector-button').filter({ hasText: name }) }) },
        ],
        /** Property card in the Properties grid list, keyed by name. Original scopes `.mantine-SimpleGrid-root p` by hasText (kept as #1); MCP-verified (2026-08-06) each card is a `div.PropertyCard_card__wSpcu` with the name in its own `<p>`. Fallback keeps the same `.mantine-SimpleGrid-root` scope (avoiding an unscoped page-wide text search that could resolve a different node elsewhere) but swaps the matching mechanism to Playwright's text engine — both resolve to the same `<p>`. */
        propertyGrid: (name) => [
            // { name: "css:.mantine-SimpleGrid-root p:has-text(name)(original)", locator: page.locator(`.mantine-SimpleGrid-root p:has-text('${name}')`) },
            { name: 'css:.mantine-SimpleGrid-root>>text(exact)', locator: page.locator('.mantine-SimpleGrid-root').getByText(name, { exact: true }) },
        ],
    };
}

module.exports = {
    approvalJobLocators,
    approvalElementStrategies,
    addPropertyRowStrategies,
    addPropertyRowCheckboxStrategies,
    firstPropertyResultRowStrategies,
    templateRowByNameStrategies,
    createPropertyDialogStrategies,
};
