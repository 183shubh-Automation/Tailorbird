/**
 * Locators for Financials → Category and shared Category grid/toolbar patterns.
 * @param {import('@playwright/test').Page} page
 */
function categoryPageLocators(page) {
    return {
        financialsNav: page.locator('nav a.mantine-NavLink-root:has-text("Financials")'),
        categoryLink: page
            .locator('a.mantine-NavLink-root:has(span.mantine-NavLink-label:has-text("Category"))')
            .first(),

        // Financials Category uses BirdTable (treegrid). Prefer main-scoped treegrid first so
        // waitForTableToLoad does not spend full timeout on irrelevant/hidden legacy <table> nodes.
        tableSelectors: [
            'main [role="treegrid"]',
            '[role="treegrid"]',
            'main table',
            'table',
            '.ag-root-wrapper',
            '.mantine-Table-root',
            '[role="table"]',
            '[role="grid"]',
        ],

        downloadSelectors: [
            'button:has(svg.lucide-download)',
            'button[title*="Download"]',
            'button[title*="Export"]',
            'button:has-text("Export")',
            'button:has-text("Download")',
        ],

        errorIndicators: [
            'text=/error/i',
            'text=/not found/i',
            'text=/404/i',
            '.mantine-Alert-root[color="red"]',
        ],

        resetTableIcon: page.locator(
            'button[data-variant="subtle"][data-size="md"]:has(svg.lucide-rotate-ccw)'
        ),

        resetModal: page.locator('section[role="dialog"]'),
        resetModalHeader: page.locator('section[role="dialog"]').locator('h2.mantine-Modal-title'),
        resetModalBody: page.locator('section[role="dialog"]').locator('div.mantine-Modal-body p'),
        resetCancelBtn: page.locator('section[role="dialog"]').locator('button:has-text("Cancel")'),
        resetConfirmBtn: page.locator('section[role="dialog"]').locator('button:has-text("Reset Table")'),

        uploadFilesButton: page.getByRole('button', { name: 'Upload Files' }),
        uploadDialog: page.locator('dialog[open], section[role="dialog"]'),
        uploadFileInput: page.locator('input[type="file"]'),
        uploadListDialog: page.locator(
            'dialog[open] uc-upload-list, section[role="dialog"] uc-upload-list, uc-upload-list'
        ),

        manageColumnsDrawer: page.locator('section[role="dialog"]'),
        tableSettingsButton: page.locator('button:has(svg.lucide-settings)'),
        viewDetailsBtn: page.locator('button[title="View Details"]'),
        documentsHeader: page.locator('text=Property Documents'),
        documentsSubHeader: page.locator('text=Files and images related to this property'),

        uploadFilesBtn: page.locator('button.mantine-ActionIcon-root:has(svg.lucide-upload)').first(),
        importDataButton: page.locator('[title="Import Data"]').first(),

        mainContainer: page.locator('main').first(),
        mainSearchInput: page.locator('main input[placeholder="Search..."]').first(),
        filterFunnelBtn: page.locator('button:has(svg.lucide-funnel)').first(),
        filterPopover: page.locator('.mantine-Paper-root:has-text("Filters")').first(),
        filterCloseBtn: page.locator('button.mantine-CloseButton-root').first(),
        filterGlobalSearch: page.getByPlaceholder('Enter values to search for (OR logic)').first(),

        btAddRow: page.getByTestId('bt-add-row'),
        btTableAction: page.getByTestId('bt-table-action'),
        btTableActionAddColumn: page.getByTestId('bt-table-action-add-column'),
        manageColumnsDialog: page
            .getByRole('dialog', { name: 'Manage Columns' })
            .or(page.locator('section[role="dialog"]').filter({ hasText: /Manage Columns/i }))
            .first(),
    };
}

/**
 * Self-healing strategies for TC98/TC101 (tests/TC07_category.spec.js — category upload
 * and filter options). All MCP-verified live 2026-08-06 (beta.tailorbird.com/financials/category).
 * @param {import('@playwright/test').Page} page
 */
function categoryElementStrategies(page) {
    return {
        /** Category-page readiness indicator — original 6-mechanism CSS union kept intact. */
        contentReadyIndicator: [
            { name: 'css:table|role variants|upload-icon|Import-Data-title|Import-Data-text(original)', locator: page.locator('table, [role="table"], [role="grid"], [role="treegrid"], button:has(svg.lucide-upload), [title="Import Data"], main') },
        ],
        /**
         * Toolbar Import/Upload trigger — original main-scoped exact-text regex kept as #1
         * (MCP-verified this IS the one that actually resolves live: current product copy
         * is "Import", not "Import Data" — the button's `title` attribute is empty and its
         * text is exactly "Import", so the OTHER 3 candidates in uploadCategory()'s retry
         * loop — icon-only, `[title="Import Data"]`, and `getByRole(name:'Import Data')` —
         * are now stale/legacy assumptions kept only as safety-net fallbacks, not because
         * they're expected to fire). A `data-table-action` attribute fallback is added since
         * it's a genuinely independent mechanism confirmed present on this exact button.
         */
        importMainBtn: [
            { name: 'role:button[name=/^Import$/i][in main](original)', locator: page.locator('main').getByRole('button', { name: /^Import$/i }) },
            { name: 'css:button[data-table-action=true][hasText=Import]', locator: page.locator('button[data-table-action="true"]').filter({ hasText: 'Import' }) },
        ],
        /** Icon-based Import/Upload candidate — original CSS kept as #1; MCP-verified icon class is `lucide-upload`. */
        uploadIconBtn: [
            { name: 'css:button:has(svg.lucide-upload)(original)', locator: page.locator('button:has(svg.lucide-upload)') },
        ],
        /**
         * `[title="Import Data"]` candidate — original kept verbatim as #1 even though
         * MCP-verified this attribute no longer exists on ANY element on this page (stale,
         * product copy changed from "Import Data" to "Import"). Fallback uses the
         * confirmed-live exact-text match so this candidate can still resolve on its own.
         */
        importDataButtonHealed: [
            { name: 'css:[title=Import Data](original, MCP-confirmed stale)', locator: page.locator('[title="Import Data"]') },
            { name: 'role:button[name=Import](exact, confirmed-live)', locator: page.getByRole('button', { name: 'Import', exact: true }) },
        ],
        /**
         * `getByRole(name:'Import Data')` candidate — original kept verbatim as #1 even
         * though MCP-verified the button's accessible name is "Import", not "Import Data"
         * (same stale-copy finding as above).
         */
        importRoleBtn: [
            { name: 'role:button[name=Import Data](original, MCP-confirmed stale)', locator: page.getByRole('button', { name: 'Import Data' }) },
            { name: 'role:button[name=Import](exact, confirmed-live)', locator: page.getByRole('button', { name: 'Import', exact: true }) },
        ],
        /** Uploadcare widget "From device" button. */
        fromDeviceBtn: [
            { name: 'role:button[name=From device](original,exact)', locator: page.getByRole('button', { name: 'From device' }) },
        ],
        /** Uploadcare widget "Done" button. */
        uploadDoneBtn: [
            { name: 'role:button[name=Done](original,exact)', locator: page.getByRole('button', { name: 'Done' }) },
        ],
    };
}

/** Grid cell matching a given filter value, used to count filtered rows (TC101). */
function categoryGridCellByTextStrategies(page, value) {
    return [
        { name: 'css:[role=gridcell][hasText](original)', locator: page.locator('[role="gridcell"]').filter({ hasText: value }) },
    ];
}

/**
 * Filter drawer's close (X) button, located "near" the "Filters" title text — original
 * uses Playwright's `near` proximity filter combined with an icon-class selector.
 */
function categoryFilterCloseNearStrategies(page) {
    return [
        { name: 'css:button:has(svg.lucide-x)[near=Filters](original)', locator: page.locator('button:has(svg.lucide-x)').filter({ near: page.getByText('Filters', { exact: true }) }) },
    ];
}

module.exports = { categoryPageLocators, categoryElementStrategies, categoryGridCellByTextStrategies, categoryFilterCloseNearStrategies };
