function simpleApprovalLocators(page) {
    return {
        // Sidebar
        approvalTab: page.locator('text=Approvals').first(),

        // Top tabs
        myApprovalsTab: page.getByRole('tab', { name: 'My Approvals' }),
        allApprovalsTab: page.getByRole('tab', { name: 'All Approvals' }),

        // Search
        searchInput: page.getByPlaceholder('Search...'),

        // Table
        tableRows: page.locator('[role="row"]'),
        columnHeaders: page.locator('[role="columnheader"]'),

        // Toolbar (My / All Approvals): Table dropdown holds Add custom column + Hide/show columns
        filterButton: page.locator('main').getByRole('button', { name: 'Filter' }),
        exportButton: page.locator('main').getByRole('button', { name: 'Export' }),
        tableMenuButton: page
            .locator('main')
            .getByTestId('bt-table-action')
            .or(page.locator('main').getByRole('button', { name: 'Table' })),
        addColumnMenuItem: page.getByTestId('bt-table-action-add-column'),
        hideShowColumnsMenuItem: page.getByTestId('bt-table-action-hide-show-columns'),

        addColumnNameInput: page.getByPlaceholder(/Enter column name/i),
        addColumnDescInput: page.getByPlaceholder(/Enter column description/i).or(page.getByLabel(/description/i)),
        addColumnSubmitButton: page.getByRole('button', { name: /^Add column$/i }),

        manageColumnsDrawer: page.getByRole('dialog', { name: 'Manage Columns' }),

        // Actions in row
        viewDetailsButton: page.locator('button[title="View Details"]').first(),
    };
}

/**
 * Self-healing strategies for TC209/TC212/TC216/TC220/TC221 (tests/TC11_approval_workflow.spec.js
 * — My/All Approvals tabs, table headers, add-column, export). All MCP-verified live
 * 2026-08-06 (beta.tailorbird.com/approvals/my-approvals). Strategy #1 in every list is
 * the exact original pre-existing expression.
 * @param {import('@playwright/test').Page} page
 */
function simpleApprovalElementStrategies(page) {
    return {
        /** Left-nav "Approvals" link — original text-based `.first()` kept as #1 (no role/testid exists on this exact nav entry per prior MCP findings elsewhere in this suite). */
        approvalTab: [
            { name: 'text:Approvals[first](original)', locator: page.locator('text=Approvals').first() },
        ],
        /** "My Approvals" / "All Approvals" top tabs — same Mantine tab pattern (role=tab + `.mantine-Tabs-tab` class) MCP-verified throughout this suite. */
        myApprovalsTab: [
            { name: 'role:tab[name=My Approvals](original)', locator: page.getByRole('tab', { name: 'My Approvals' }) },
            { name: 'css:.mantine-Tabs-tab[hasText=My Approvals]', locator: page.locator('.mantine-Tabs-tab').filter({ hasText: 'My Approvals' }) },
        ],
        allApprovalsTab: [
            { name: 'role:tab[name=All Approvals](original)', locator: page.getByRole('tab', { name: 'All Approvals' }) },
            { name: 'css:.mantine-Tabs-tab[hasText=All Approvals]', locator: page.locator('.mantine-Tabs-tab').filter({ hasText: 'All Approvals' }) },
        ],
        /** Table search input. */
        searchInput: [
            { name: 'placeholder:Search...(original)', locator: page.getByPlaceholder('Search...') },
            { name: 'role:textbox[name=Search...]', locator: page.getByRole('textbox', { name: 'Search...' }) },
        ],
        /** "Property Name" column header — used as the table-fully-loaded readiness gate. MCP-verified live: this exact text is a real column header. */
        propertyNameColumnHeader: [
            { name: 'css:[role=columnheader][hasText=Property Name](original)', locator: page.locator('[role="columnheader"]').filter({ hasText: 'Property Name' }) },
            { name: 'role:columnheader[name=Property Name]', locator: page.getByRole('columnheader', { name: 'Property Name', exact: true }) },
        ],
        /** Fallback readiness gate: any column header, used when "Property Name" specifically doesn't appear in time. */
        anyColumnHeader: [
            { name: 'css:[role=columnheader][first](original)', locator: page.locator('[role="columnheader"]').first() },
        ],
        /** Toolbar Export button. */
        exportButton: [
            { name: 'css:main>>role:button[name=Export](original)', locator: page.locator('main').getByRole('button', { name: 'Export' }) },
        ],
        /** Toolbar "Table" action menu trigger — original 2-mechanism `.or()` union kept intact. */
        tableMenuButton: [
            { name: 'testid:bt-table-action[in main](original)', locator: page.locator('main').getByTestId('bt-table-action') },
            { name: 'role:button[name=Table][in main](original)', locator: page.locator('main').getByRole('button', { name: 'Table' }) },
        ],
        /** "Add custom column" menu item. */
        addColumnMenuItem: [
            { name: 'testid:bt-table-action-add-column(original)', locator: page.getByTestId('bt-table-action-add-column') },
        ],
        /** Add-column modal Name/Description inputs and submit button. */
        addColumnNameInput: [
            { name: 'placeholder:/Enter column name/i(original)', locator: page.getByPlaceholder(/Enter column name/i) },
        ],
        addColumnDescInput: [
            { name: 'placeholder:/Enter column description/i(original)', locator: page.getByPlaceholder(/Enter column description/i) },
            { name: 'label:/description/i(original)', locator: page.getByLabel(/description/i) },
        ],
        addColumnSubmitButton: [
            { name: 'role:button[name=/^Add column$/i](original)', locator: page.getByRole('button', { name: /^Add column$/i }) },
        ],
    };
}

module.exports = { simpleApprovalLocators, simpleApprovalElementStrategies };
