const { healingLocator } = require('../utils/locatorHealer');

/**
 * Vendors Directory & Vendor Detail page locators
 * URL: vendors/directory, vendors/{id}
 */
function vendorLocators(page) {
    return {
        // --- Navigation ---
        vendorsNav: page.locator('nav').locator('a, [role="menuitem"]').filter({ hasText: 'Vendors' }).first(),
        directoryLink: page.locator('nav').locator('a, [role="menuitem"]').filter({ hasText: 'Directory' }).first(),
        moreMenuLink: page.locator('nav').filter({ hasText: 'More' }).first(),

        // --- Directory page ---
        inviteNewVendorBtn: page.getByRole('button', { name: 'Invite New Vendor' }),
        searchInput: page.getByRole('textbox', { name: 'Search...' }),
        // MCP-verified live (2026-08-10): the icon-CSS selector and the button's own visible
        // "Filter" text resolve to the exact same <button> node — a genuinely independent
        // fallback mechanism (accessible-name lookup vs icon-class CSS), not just another
        // way of finding an ancestor/descendant of it.
        filterBtn: healingLocator([
            { name: 'css:button:has(svg.lucide-funnel)[first](original)', locator: page.locator('button:has(svg.lucide-funnel)').first() },
            { name: 'role:button[name=Filter]', locator: page.getByRole('button', { name: 'Filter', exact: true }) },
        ]),
        exportBtn: page.locator('button:has(svg.lucide-download)').first(),
        viewDropdownBtn: page.locator('main').getByRole('button').first().or(page.getByRole('tabpanel', { name: 'Overview' }).getByRole('button').first()),
        addColumnBtn: page.getByTestId('bt-add-column').first().or(page.locator('main').locator('[data-testid="bt-add-column"]').first()),
        manageColumnsBtn: page.locator('button:has(svg.lucide-settings)').first(),

        // --- Filters panel ---
        filtersPanel: page.locator('.mantine-Paper-root').filter({ hasText: 'Filters' }),
        filterInput: page.getByPlaceholder('Enter values to search for (OR logic)'),
        tradeCheckbox: (name) => page.getByRole('checkbox', { name }),

        // --- Grid ---
        grid: page.locator('[role="treegrid"], [role="grid"]').first(),
        columnHeader: (name) => page.locator(`[role="columnheader"]:has-text("${name}")`),
        dataRows: page.locator('[role="row"]').filter({ has: page.locator('[role="gridcell"]') }),
        viewDetailsBtns: page.getByRole('button', { name: 'View Details' }),

        // --- View / Column management ---
        viewNameInput: page.getByPlaceholder(/Enter view name/i),
        createNewViewItem: page.getByRole('menuitem', { name: 'Create New View' }),
        defaultViewOption: page.locator('[role="menuitem"], [role="option"]').filter({ hasText: /Default/i }).first(),
        manageColumnsDialog: page.getByRole('dialog', { name: 'Manage Columns' }).or(page.locator('section[role="dialog"]').filter({ hasText: 'Manage Columns' })),
        columnNameInput: page.getByRole('textbox', { name: /column name/i }).or(page.getByPlaceholder(/Enter column name/i)),
        columnDescInput: page.getByPlaceholder(/description/i),
        addColumnSubmitBtn: page.getByRole('button', { name: 'Add column' }),

        // --- Vendor Detail page ---
        overviewTab: page.getByRole('tab', { name: 'Overview' }),
        activityTab: page.getByRole('tab', { name: 'Activity' }),
        editBtn: page.getByRole('button', { name: 'Edit' }),
        breadcrumbManageVendors: page.getByRole('link', { name: 'Manage Vendors' }),
        breadcrumbDirectory: page.locator('.mantine-Breadcrumbs-root').filter({ hasText: 'Directory' }),

        // --- Overview fields ---
        vendorIdLabel: page.locator('text=Vendor ID').first(),
        companyNameLabel: page.locator('text=Company Name').first(),
        usersTable: page.locator('[role="table"], [role="grid"]').filter({ has: page.locator('text=Users') }).first(),

        // --- Activity tab ---
        bidsSubmittedLabel: page.locator('text=Bids Submitted').first(),
        contractsAwardedLabel: page.locator('text=Contracts Awarded').first(),
        invoicesProcessedLabel: page.locator('text=Invoices Processed').first(),
        changeOrdersLabel: page.locator('text=Change Orders').first(),

        // --- Invite New Vendor ---
        inviteDialog: page.getByRole('dialog').filter({ hasText: /Invite|New Vendor|Organization/i }),
        inviteForm: page.locator('form, section[role="dialog"]').filter({ hasText: /Organization|Vendor/i }),
        companyNameInput: page.getByRole('dialog').getByLabel(/Company Name/i),
        firstNameInput: page.getByRole('dialog').getByLabel(/First Name/i),
        lastNameInput: page.getByRole('dialog').getByLabel(/Last Name/i),
        phoneInput: page.getByRole('dialog').getByLabel(/Phone Number/i),
        emailInput: page.getByRole('dialog').getByLabel(/Email Address/i),
        addressSearch: page.getByRole('dialog').getByPlaceholder(/Search and select location/i),
        tradeSearch: page.getByRole('dialog').getByPlaceholder(/Select trade/i),
        serviceAreaSearch: page.getByRole('dialog').getByPlaceholder(/Search and select cities or regions/i),
        createVendorBtn: page.getByRole('dialog').getByRole('button', { name: 'Create Vendor' }),

        // --- Edit vendor form ---
        editDialog: page.getByRole('dialog'),
        saveBtn: page.getByRole('button', { name: /Save|Update/i }),

        // --- Error indicators (exclude grid cells - data may contain 'error' in strings like onerror=) ---
        errorAlertLocator: page.locator('.mantine-Alert-root[color="red"]'),
        errorInMain: page.locator('main').getByText(/^Error:|404|Not found|Something went wrong/i),
    };
}

/**
 * Self-healing strategies for TC229/TC238 (tests/TC14_manageVendor.spec.js — Vendor
 * Directory navigation and Invite Vendor workflow). All MCP-verified live 2026-08-06
 * (beta.tailorbird.com/vendors/directory). Strategy #1 in every list is the exact
 * original pre-existing expression.
 * @param {import('@playwright/test').Page} page
 */
function vendorElementStrategies(page) {
    return {
        /** Directory breadcrumb — original CSS class kept as #1; MCP-verified live text is "Home/Manage Vendors". */
        breadcrumb: [
            { name: 'css:.mantine-Breadcrumbs-root(original)', locator: page.locator('.mantine-Breadcrumbs-root') },
        ],
        /** revo-grid element used by forceGridFullWidth(). */
        revoGrid: [
            { name: 'css:revo-grid[first](original)', locator: page.locator('revo-grid').first() },
        ],
        /** Invite/Create-Vendor dialog. MCP-verified live title is exactly "Create New Vendor"; original unscoped `getByRole('dialog')` kept as #1 since only one dialog is open at a time in this flow. */
        inviteVendorDialog: [
            { name: 'role:dialog(original)', locator: page.getByRole('dialog') },
            { name: 'role:dialog[has=heading(Create New Vendor)]', locator: page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Create New Vendor' }) }) },
        ],
        /**
         * A combobox's option list (Trade / Address / Service Area fields). MCP-verified
         * live: Mantine portals these OUTSIDE the dialog's DOM subtree entirely — the
         * pre-existing `dialog.locator('[role="option"]')` scoping never matches anything
         * live (confirmed 0 matches), and multiple comboboxes' option lists stay MOUNTED
         * (but hidden) simultaneously even when only one is actually open, so an unscoped,
         * non-visibility-filtered lookup risks resolving to a closed one. Both problems are
         * fixed by looking page-wide (not dialog-scoped) AND filtering to `:visible`.
         */
        openComboboxOption: [
            { name: 'css:dialog>>role:option[first](original, MCP-confirmed 0 matches live)', locator: page.getByRole('dialog').locator('[role="option"]') },
            { name: 'css:role:option:visible(page-wide, confirmed-live)', locator: page.locator('[role="option"]:visible') },
        ],
        openComboboxListbox: [
            { name: 'css:dialog>>role:listbox[first](original, MCP-confirmed 0 matches live)', locator: page.getByRole('dialog').locator('[role="listbox"]') },
            { name: 'css:role:listbox:visible(page-wide, confirmed-live)', locator: page.locator('[role="listbox"]:visible') },
        ],
        /**
         * Vendor-created success toast. Original mixed-engine comma-string kept as #1.
         * MCP-verified live: after a successful create, the toast IS present in the DOM
         * as a `role="alert"` element containing "Success" / "Vendor created
         * successfully" text — but the original string's CSS+text-engine comma
         * combination did not actually resolve to it in a real run (confirmed by a live
         * failure where the DOM snapshot showed the alert present while the original
         * locator still reported `isVisible() === false`). The `role="alert"` + text
         * filter below is a genuinely different, confirmed-working mechanism.
         */
        vendorCreatedToast: [
            { name: 'css:.mantine-Notification-root|text-regex(original, confirmed unreliable live)', locator: page.locator('.mantine-Notification-root, text=/success|created|invited/i') },
            { name: 'role:alert[hasText=/success|created|invited/i](confirmed-live)', locator: page.getByRole('alert').filter({ hasText: /success|created|invited/i }) },
        ],
    };
}

/** Grid cell/row containing a given (dynamically-generated) vendor org name, used to confirm the invited vendor appears in the directory. */
function vendorRowByNameStrategies(page, orgName) {
    return [
        { name: 'css:text=orgName[first](original)', locator: page.locator(`text=${orgName}`).first() },
    ];
}

module.exports = { vendorLocators, vendorElementStrategies, vendorRowByNameStrategies };
