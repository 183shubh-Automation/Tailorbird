function budgetLocators(page) {
    return {
        // --- Navigation sidebar ---
        budgetTab: page.locator('nav').getByRole('link', { name: 'Budget' }).first(),
        budgetNavSection: page.locator('nav a.mantine-NavLink-root').filter({ hasText: 'Budget' }).first(),
        budgetCategoryNav: page.locator('nav').locator('a.mantine-NavLink-root, [role="menuitem"]').filter({ hasText: 'Budget Category' }).first(),
        budgetNavText: page.locator('nav').locator('text=Budget').first(),
        categoryNavText: page.locator('nav').locator('text=Category').first(),

        // --- Property selection ---
        propertyDropdownButton: page
            .getByRole('button', { name: /Select a Property|Test Property|Sample Property|name_/i })
            .first(),
        brookProperty: page.getByRole('menuitem', { name: /Test Property 2_The Westerham/i }),
        propertyHeader: page.getByRole('button', { name: /Test Property 2_The Westerham/i }),
        propertyMenuItems: page.getByRole('menuitem'),

        // --- Year & Version selectors ---
        yearText: page.locator('text=2026').first(),
        versionText: page.locator('text=Version').first(),
        versionDropdown: page.getByRole('textbox').nth(1),
        draftOption: page.getByRole('option', { name: /draft/i }),
        manageVersionsOption: page.getByRole('option', { name: 'Manage Versions' }),
        manageVersionsDialog: page.getByRole('dialog', { name: 'Manage budget versions' }),

        // --- Grid / Table ---
        columnHeader: (name) => page.locator(`[role="columnheader"]:has-text("${name}")`),
        categoryCodeColumn: page.locator('[col-id="category_code"], [role="columnheader"]:has-text("Category Code")'),
        tableRows: page.locator('[role="row"]'),
        dataRows: page.locator('[role="row"]').filter({ has: page.locator('[role="gridcell"]') }),
        gridCells: page.locator('[role="gridcell"]'),
        treegrid: page.locator('[role="treegrid"]'),
        treegridDataRows: page.locator('[role="treegrid"] [role="row"][data-rgrow]'),
        firstRowCategoryCell: page.locator('[role="row"]').filter({ has: page.locator('[role="gridcell"]') }).first().locator('[role="gridcell"]').nth(2),

        // --- Budget items (for assertion) ---
        budgetItemText: (name) => page.locator(`text=${name}`).first(),

        // --- Overview panel & toolbar ---
        overviewPanel: page.getByRole('tabpanel', { name: 'Overview' }),
        searchBox: page.getByRole('textbox', { name: 'Search...' }),
        reviseBudgetsBtn: page.getByRole('button', {
            name: /Revise Budgets|Create First Budget/i,
        }),
        createBudgetRevisionBtn: page
            .getByRole('button', { name: /Create budget revision|Create a budget revision/i })
            .or(
                page
                    .locator('button')
                    .filter({ hasText: /Create budget revision|Create a budget revision/i })
            ),

        // --- Add row ---
        addRowMenu: page.getByTestId('bt-add-row-menu'),
        addRowBtn: page.getByTestId('bt-add-row'),
        addRowMenuItem: page.getByRole('menuitem', { name: /Add row|Add/i }),
        addBudgetBtn: page.getByRole('button', { name: /Add Budget|Add.*Budget|Add row|Add Row/i }),

        // --- View management (toolbar: first control in the Table/Export group is always Views) ---
        viewMenuBtn: page
            .getByRole('tabpanel', { name: 'Overview' })
            .locator('.mantine-Group-root')
            .filter({ has: page.getByTestId('bt-table-action') })
            .getByRole('button')
            .first(),
        viewNameInput: page.getByRole('textbox', { name: 'Enter view name...' }).or(page.getByPlaceholder(/Enter view name/i)),
        createNewViewMenuItem: page.getByRole('menuitem', { name: 'Create New View' }),
        defaultViewOption: page.locator('[role="menuitem"], [role="option"]').filter({ hasText: /Switch to Default|^Default$/i }),

        // --- Table menu (Add custom column + Hide/show columns live under Table dropdown) ---
        tableMenuBtn: page.getByRole('tabpanel', { name: 'Overview' }).getByTestId('bt-table-action'),
        addColumnMenuItem: page.getByTestId('bt-table-action-add-column'),
        hideShowColumnsMenuItem: page.getByTestId('bt-table-action-hide-show-columns'),

        // --- Column management ---
        columnNameInput: page.getByRole('textbox', { name: /Enter column name/ }),
        columnDescInput: page.getByRole('textbox', { name: /Enter column description/ }),
        addColumnSubmitBtn: page.getByRole('button', { name: 'Add column' }),
        manageColumnsDialog: page.getByRole('dialog', { name: 'Manage Columns' }),

        // --- Export ---
        exportBtn: page.getByRole('tabpanel', { name: 'Overview' }).getByRole('button', { name: 'Export' }),

        // --- Category cells (for assertion) ---
        categoryDropdown: page.locator('[role="combobox"], .ag-cell-edit-input, [col-id="category_code"] input'),
        categoryOption: (text) => page.getByRole('option', { name: text }).or(page.locator(`[role="menuitem"]:has-text("${text}")`)),
        categoryCells: page.locator('[role="gridcell"]').filter({ hasText: /Construction|Electrical|Plumbing|HVAC|Finishes|Landscaping|Roofing|Carpentry|Fire Protection|Security/i }),
        categoryColumnHeader: page.locator('[role="columnheader"]:has-text("Category")'),

        // --- Revise Budget editor ---
        revisionDialog: page.getByRole('dialog'),
        budgetTabInRevision: page.getByRole('tab', { name: 'Budget' }),
        submitForApprovalBtn: page.getByRole('dialog').getByRole('button', { name: /Submit for Approval|Submit for Review/i }).first()
            .or(page.getByRole('button', { name: /Submit for Approval|Submit for Review/i }).first()),

        // --- Revise Budget toolbar ---
        resetTableOption: page.getByRole('button', { name: /Reset|Reset Table/i }),
        uploadBudgetFileInput: page.locator('input[type="file"]'),

        // --- File upload flow ---
        uploadGuideModal: page.getByRole('dialog', { name: /Budget File Upload Guide|Upload Guide/i }),
        uploadGuideContinueBtn: page.getByRole('button', { name: /Continue/i }),
        fromDeviceBtn: page.getByRole('button', { name: /From device|Choose file|Browse|Select file/i }),
        uploadModal: page.locator('[role="dialog"]').filter({ hasText: /Upload|Import|file|mapping|columns/i }),
        doneBtn: page.getByRole('button', { name: /Done|Apply|Confirm|Import/i }),

        // --- Confirmation dialogs ---
        deleteBtn: page.getByRole('button', { name: 'Delete' }),
        confirmBtn: page.getByRole('button', { name: /Submit|Confirm|Yes|Approve/i }),
        resetConfirmBtn: page.getByRole('button', { name: /Reset|Confirm|Yes/i }),
        deleteDraftDialog: page.getByRole('dialog').filter({ hasText: /Delete.*Draft|Delete Budget Version/i }),

        // --- TC244: Revision editor inline currency editing ---
        currencyEditInput: page.locator('[data-testid="bird-table-currency-input"]'),
        revisionAdjustmentHeader: page.locator('[role="columnheader"]').filter({ hasText: 'Adjustment' }).first(),
    };
}

/**
 * Self-healing locator strategies for the TC71 budget upload/submit flow
 * (pages/budgetPage.js). budgetLocators() above already gives most elements
 * resilient role/regex names; these three were single-strategy (or worth
 * tracking for health-check visibility), so each gets a second, independent
 * strategy layered on via healingLocator() in budgetPage.js. No regex, no XPath
 * in the ADDED strategies (semgrep-safe) — primary strategies re-use
 * budgetLocators()'s existing (pre-existing, out-of-scope-to-change) locators.
 * @param {import('@playwright/test').Page} page
 */
function budgetElementStrategies(page) {
    const budget = budgetLocators(page);
    return {
        propertyDropdownButton: [
            { name: 'role:button[name=/Select a Property|Test Property|Sample Property|name_/i]', locator: budget.propertyDropdownButton },
            /** MCP-verified 2026-08-04: real class is `.tb-property-selector-button` (a dedicated, purpose-built class) — the icon SVG has no class attribute at all, so an icon-based selector would never match. */
            { name: 'css:.tb-property-selector-button', locator: page.locator('.tb-property-selector-button').first() },
            /** MCP-verified: this button is the ONLY element with BOTH aria-haspopup="menu" and data-with-left-section+data-with-right-section together (count=1 on the live page) — a genuinely independent compound-attribute signal from the class/role above. */
            { name: 'css:button[aria-haspopup=menu][data-with-left-section][data-with-right-section]', locator: page.locator('button[aria-haspopup="menu"][data-with-left-section][data-with-right-section]').first() },
            /**
             * MCP-verified: only 3 genuinely independent strategies found for this element — it's alone
             * in its own .mantine-Group-root with no sibling to position against, no data-testid, no
             * aria-label, and generic data-variant/data-size attrs shared by many other buttons. Not
             * padded with an invented 4th.
             */
        ],
        reviseBudgetsBtn: [
            { name: 'role:button[name=/Revise Budgets|Create First Budget/i]', locator: budget.reviseBudgetsBtn },
            /**
             * MCP-verified 2026-08-04: a brand-new property with no budget yet renders "Create First Budget",
             * not "Revise Budgets" — a fallback covering only one text would silently fail on exactly the
             * properties most likely to need it. No-regex: `.or()` of two exact-substring filters expresses
             * the same "A or B" match as the former `/Revise Budgets|Create First Budget/i` regex.
             */
            {
                name: 'css:button[filter=Revise Budgets OR Create First Budget]',
                locator: page.locator('button').filter({ hasText: 'Revise Budgets' })
                    .or(page.locator('button').filter({ hasText: 'Create First Budget' }))
                    .first(),
            },
            /**
             * MCP-verified: real, semantically-distinct icon class svg.lucide-file-pen, confirmed unique
             * (count=1) on the live page in the "Revise Budgets" state. Not independently re-verified
             * against the "Create First Budget" state — but since strategies are OR'd, a strategy that
             * doesn't match in one state is harmless (the other strategies above still cover it); it's
             * never a false-positive risk since the class itself is confirmed unique when present.
             */
            { name: 'css:button:has(svg.lucide-file-pen)', locator: page.locator('button:has(svg.lucide-file-pen)') },
            /** MCP-verified: this button is the LAST of a group whose direct children are exactly [Version Note, Revise Budgets] (`:scope > button` — see locators/manageTeamRolesLocator.js for why this matters vs. Playwright's descendant-matching `.locator('button')`). Positional, weakest signal, kept last. */
            {
                name: 'position:group-with-direct-VersionNote-child-last-direct-button',
                locator: page.locator('.mantine-Group-root')
                    .filter({ has: page.locator(':scope > button', { hasText: 'Version Note' }) })
                    .locator(':scope > button')
                    .last(),
            },
        ],
        /**
         * TC243 (Budget workspace load) locators — MCP-verified live 2026-08-06
         * (beta.tailorbird.com/financials/budget, "Test Property 2_The Westerham").
         */
        brookProperty: [
            { name: 'role:menuitem[name=/Test Property 2_The Westerham/i]', locator: budget.brookProperty },
            /** MCP-verified: this menuitem is itself a real `<button>` (Mantine menu items render as buttons) — a role-scoped exact-text filter is a genuinely different mechanism (own-text filter vs. accessible-name regex) than the original. */
            { name: 'css:role:menuitem>>button[hasText]', locator: page.getByRole('menuitem').filter({ hasText: 'Test Property 2_The Westerham' }) },
        ],
        propertyHeader: [
            { name: 'role:button[name=/Test Property 2_The Westerham/i]', locator: budget.propertyHeader },
            /** MCP-verified: same underlying button carries `aria-haspopup="menu"` — a genuinely independent compound signal from the accessible-name regex above. */
            { name: 'css:button[aria-haspopup=menu][hasText]', locator: page.locator('button[aria-haspopup="menu"]').filter({ hasText: 'Test Property 2_The Westerham' }) },
        ],
        /** RevoGrid column headers — original `:has-text()` (own-text, no parent/child split risk) kept as #1; role-based fallback added since MCP-verified this table's headers carry a real `role="columnheader"`. */
        columnHeader: (name) => [
            { name: 'css:[role=columnheader][hasText](original)', locator: page.locator(`[role="columnheader"]:has-text("${name}")`) },
            { name: 'role:columnheader[name]', locator: page.getByRole('columnheader', { name }) },
        ],
        /** Year indicator text — MCP-verified live "2026" renders as a plain leaf text node with no role/label/testid to anchor an independent fallback on; only genuinely independent option is exact-match instead of substring. */
        yearText: [
            { name: 'text:2026[first](original)', locator: page.locator('text=2026').first() },
            { name: 'text:2026[exact]', locator: page.getByText('2026', { exact: true }).first() },
        ],
        /** Version indicator text — MCP-verified live multiple elements contain "Version" as a substring (e.g. "Version Note", "Version 102") — `.first()` already resolves this in the original; no independent second mechanism exists beyond re-confirming the same match differently, so kept honest at 1 strategy. */
        versionText: [
            { name: 'text:Version[first](original)', locator: page.locator('text=Version').first() },
        ],
        /** Budget item name cell text — MCP-verified live plain text match; no role/testid exists on these cells to hang an independent fallback on beyond exact-match. */
        budgetItemText: (name) => [
            { name: 'text:name[first](original)', locator: page.locator(`text=${name}`).first() },
            { name: 'text:name[exact,first]', locator: page.getByText(name, { exact: true }).first() },
        ],
        submitForApprovalBtn: [
            /** No-regex: `.or()` of two exact role/name locators replaces the former `/Submit for Approval|Submit for Review/i` regex with the same "A or B" coverage. */
            {
                name: 'role:dialog>button[name=Submit for Approval OR Submit for Review]',
                locator: page.getByRole('dialog').getByRole('button', { name: 'Submit for Approval' })
                    .or(page.getByRole('dialog').getByRole('button', { name: 'Submit for Review' }))
                    .first(),
            },
            {
                name: 'role:button[name=Submit for Approval OR Submit for Review]',
                locator: page.getByRole('button', { name: 'Submit for Approval' })
                    .or(page.getByRole('button', { name: 'Submit for Review' }))
                    .first(),
            },
        ],
    };
}

module.exports = { budgetLocators, budgetElementStrategies };
