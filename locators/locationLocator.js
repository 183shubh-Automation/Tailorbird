module.exports = {

        // View details
    viewDetailsBtn: 'button[title="View Details"], button:has(svg.lucide-eye)',

    // Location Tab - scope to property details
    locationsTab: 'button[role="tab"]:has-text("Locations")',
    locationsTabpanel: 'role=tabpanel[name="Locations"]',

    // Locations: row actions use bt-add-row (replaces bt-add-row-menu).
    addButton: '[data-testid="bt-add-row"]',
    addSite: '[data-testid="bt-add-row"]',
    addDataOption: 'role=menuitem[name="Add Data"]',
    addUnitOption: 'role=menuitem[name="Add Unit"]',

    // Grid elements
    newRow: 'role=row[name*="—"] >> nth=0',
    nameCell: '[role="gridcell"]:nth-child(1)',
    nameInput: 'input[type="text"]:visible, textarea',
    deleteRowBtn: 'button[title="Delete Row"], button:has(svg.lucide-trash2)',
    deleteConfirmBtn: ".mantine-Popover-dropdown button:has-text('Delete')",

    // Add Column Modal
    modal_AddColumn: 'div.mantine-Paper-root:has-text("Add column")',
    columnNameInput: 'role=textbox[name^="Enter column name"]',
    descriptionInput: 'role=textbox[name^="Enter column description"]',
    addColumnBtn: 'role=button[name="Add column"]',
    

    // SETTINGS Drawer
    tableSettingBtn: 'button:has(svg.lucide-settings):visible',
    settingsDrawer: 'section.mantine-Drawer-content[role="dialog"]',
    drawerTitle: 'h2:has-text("Manage Columns")',
    drawerClose: 'button.mantine-Drawer-close',
    defaultColumnText: 'p:has-text("Default Columns")',
    customColumnsText: 'p:has-text("Custom Columns")',
    deleteColumnIcon: ".mantine-Group-root:has-text('Test Column') .lucide-trash2",

    // Location Dropdown Select
    locationDropdown: 'input[placeholder="Select location type"]',
    locationDropdownOption: (type) => `.mantine-Select-option:has-text("${type}")`,

    // Table Headers / Rows
    unitHeader: 'text=Unit Name',
    tableColumnHeader: (header) => `role=columnheader[name="${header}"]`,
    visibleRows: 'div[role="row"]:visible'
};

/**
 * Self-healing strategies for TC56 (tests/TC04_properties.spec.js — "Validate Location
 * Tab") and its sibling tests (TC57-TC59, TC62) that share the same PropertiesHelper
 * Locations-tab methods. All MCP-verified live 2026-08-05
 * (beta.tailorbird.com/properties/details, "Test Property 1_Cottages on Elm").
 * Strategy #1 in every list is the exact original pre-existing expression.
 */

const locators = module.exports;

/** Property-details "Locations" tab trigger. Mantine tab: role=tab + stable `.mantine-Tabs-tab` class (same pattern MCP-verified on the organization-workspace and CTA tabs elsewhere in this suite). */
function locationsTabStrategies(page) {
    return [
        { name: 'role:tab[name=Locations](original)', locator: page.getByRole('tab', { name: 'Locations' }) },
        { name: 'css:.mantine-Tabs-tab[hasText=Locations]', locator: page.locator('.mantine-Tabs-tab').filter({ hasText: 'Locations' }) },
        { name: 'css:locationsTab(original-unused-css)', locator: page.locator(locators.locationsTab) },
    ];
}

/** Locations tabpanel root — used by nearly every method in this section. */
function locationsTabpanelStrategies(page) {
    return [
        { name: 'role:tabpanel[name=Locations](original)', locator: page.getByRole('tabpanel', { name: 'Locations' }) },
        { name: 'css:locationsTabpanel(engine-role)', locator: page.locator(locators.locationsTabpanel) },
    ];
}

/**
 * "Add Row" trigger in the Locations toolbar. MCP-verified live: current UI renders a
 * direct `[data-testid="bt-add-row"]` button with visible text "Add Row" — no dropdown
 * menu (the addTriggerCandidates array's menu-based branches are legacy-UI fallbacks,
 * left untouched since they represent genuinely different, previously-necessary flows).
 */
function addRowTriggerStrategies(tabpanel, page) {
    return [
        { name: 'testid:bt-add-row(original,scoped)', locator: tabpanel.getByTestId('bt-add-row') },
        { name: 'role:button[name=/Add site|row|unit|Data/i](original)', locator: tabpanel.getByRole('button', { name: /Add site|Add row|Add unit|Add Data/i }) },
        { name: 'testid:bt-add-row(original,page-level)', locator: page.getByTestId('bt-add-row') },
    ];
}

/** The actual "Add site/row/unit/Data" choice that appears after opening the add-row trigger (menuitem in legacy UI, plain button in current UI — same regex, two role mechanisms). */
function addRowMenuChoiceStrategies(page) {
    return [
        { name: 'role:menuitem[name=/Add site|row|unit|Data/i](original)', locator: page.getByRole('menuitem', { name: /Add site|Add row|Add unit|Add Data/i }) },
        { name: 'role:button[name=/Add site|row|unit|Data/i](original)', locator: page.getByRole('button', { name: /Add site|Add row|Add unit|Add Data/i }) },
    ];
}

/** Locations treegrid — role-based, optionally scoped to the tabpanel by the caller. */
function locationsTreegridStrategies(scope) {
    return [
        { name: 'role:treegrid(original)', locator: scope.getByRole('treegrid') },
    ];
}

/** "Edit" button that some Locations grid states require before a row becomes editable. */
function locationEditButtonStrategies(page) {
    return [
        { name: 'role:button[name=Edit](original,exact)', locator: page.getByRole('button', { name: /^Edit$/i }) },
    ];
}

/** Blank placeholder row ("—") already present at the top of the grid before any Add-row click. */
function blankRowIndicatorStrategies(treegrid) {
    return [
        { name: 'role:row[name=/^— — —$|^—$/](original)', locator: treegrid.getByRole('row', { name: /^— — —$|^—$/ }) },
    ];
}

/** "Add site/row/unit" choice WITHOUT "Add Data" — original regex for the direct add-row flow (distinct from addRowMenuChoiceStrategies, which also matches "Add Data" for the Table-menu flow). */
function addSiteOnlyChoiceStrategies(page) {
    return [
        { name: 'role:menuitem[name=/Add site|row|unit/i](original)', locator: page.getByRole('menuitem', { name: /Add site|Add row|Add unit/i }) },
        { name: 'role:button[name=/Add site|row|unit/i](original)', locator: page.getByRole('button', { name: /Add site|Add row|Add unit/i }) },
    ];
}

/** Add-row choice surfaced after opening the "Table" action menu (includes "Add Data"). */
function addRowContextMenuItemStrategies(page) {
    return [
        { name: 'role:menuitem[name=/Add site|row|unit|Data/i](original,first)', locator: page.getByRole('menuitem', { name: /Add site|Add row|Add unit|Add Data/i }) },
    ];
}

/** Grid cell matching a given row name — used to confirm a committed/existing row. */
function gridCellByTextStrategies(page, text) {
    return [
        { name: 'css:[role=treegrid][role=gridcell][hasText](original)', locator: page.locator(`[role="treegrid"] [role="gridcell"]:has-text("${text}")`) },
    ];
}

/** Newly-added/blank editable row in the Locations grid — original 2-mechanism `.or()` union kept intact. */
function newRowStrategies(treegrid) {
    return [
        { name: 'role:row[name=—](original)', locator: treegrid.getByRole('row', { name: /—/ }) },
        { name: 'css:row[has=gridcell](original)', locator: treegrid.locator('[role="row"]').filter({ has: treegrid.locator('[role="gridcell"]') }) },
    ];
}

/** revogr-edit's floating input — used as a readiness gate before nameEditorCandidateStrategies() is tried. */
function revogrEditInputStrategies(page) {
    return [
        { name: 'css:revogr-edit input:not([readonly]):not([disabled])(original)', locator: page.locator('revogr-edit input:not([readonly]):not([disabled])') },
    ];
}

/**
 * Ordered list of candidate name-editor locators for a just-opened grid-cell editor.
 * Each entry is tried in sequence (NOT combined via `.or()`) because the calling loop's
 * fill behavior differs by index (idx 0 uses keyboard.type(), others use .fill()) — this
 * mirrors 5 genuinely different real DOM states the editor can appear in, not 5
 * alternate selectors for one fixed element. Returned as plain Locators (not
 * {name,locator} strategy objects) since the caller needs positional array access.
 */
function nameEditorCandidateLocators(page) {
    return [
        page.locator('revogr-edit input:visible:not([readonly]):not([disabled])'),
        page.locator('input[type="text"]:visible:not([placeholder="Search..."]):not([readonly]):not([disabled])'),
        page.locator('textarea:visible:not([readonly]):not([disabled])'),
        page.getByRole('textbox', { name: /name/i }),
        page.locator(locators.nameInput),
    ];
}

/** Last-resort contenteditable editor fallback when no standalone input/textarea editor is found. */
function inlineContentEditableStrategies(page) {
    return [
        { name: 'css:[contenteditable=true]:visible(original)', locator: page.locator('[contenteditable="true"]:visible') },
    ];
}

/** Re-opened cell editor mid-commit-retry (original 3-mechanism CSS union kept intact). */
function lateEditorStrategies(page) {
    return [
        { name: 'css:revogr-edit|input|textarea(original)', locator: page.locator('revogr-edit input:visible, input[type="text"]:visible:not([placeholder="Search..."]), textarea:visible') },
    ];
}

/** Data rows (excludes the row containing the "Clear selection" action button) inside a scoped treegrid. */
function dataRowsStrategies(treegrid, page) {
    return [
        { name: 'css:row[has=gridcell:not(has-button)](original)', locator: treegrid.locator('[role="row"]').filter({ has: page.locator('[role="gridcell"]:not(:has(button))') }) },
    ];
}

/** Row matching a given cell text, scoped to a treegrid. */
function matchedRowStrategies(treegrid, page, text) {
    return [
        { name: 'css:row[has=gridcell:hasText](original)', locator: treegrid.locator('[role="row"]').filter({ has: page.locator(`[role="gridcell"]:has-text("${text}")`) }) },
    ];
}

/** Data rows (role=row filtered by presence of a role=gridcell) inside a scoped treegrid — used by expectUnitTable/expectBuildingTable row-count assertions. */
function treegridDataRowsStrategies(tabpanel, page) {
    return [
        { name: 'css:treegrid row[has=gridcell](original)', locator: tabpanel.locator('[role="treegrid"] [role="row"]').filter({ has: page.locator('[role="gridcell"]') }) },
    ];
}

/** Locations grid's own search input (distinct from the Properties-list search). */
function locationSearchInputStrategies(tabpanel) {
    return [
        { name: 'css:input[placeholder=Search...](original)', locator: tabpanel.locator('input[placeholder="Search..."]') },
        { name: 'role:textbox[name=Search...]', locator: tabpanel.getByRole('textbox', { name: 'Search...' }) },
    ];
}

/**
 * Toolbar trigger for the "Add custom column" / "Hide / show columns" popover.
 * MCP-verified live: the "View" button (role=button, exact text "View") now opens an
 * UNRELATED "Save current view as" dialog — a real product-copy/behavior drift from
 * what this flow originally targeted. The pre-existing code already treats this as a
 * soft-fail (checks `addData`/`manageColumns` visibility after clicking, falls through
 * to the "Table" `bt-table-action` button if not found) — confirmed live that clicking
 * "Table" afterward correctly auto-dismisses the stray Save-view popover AND opens the
 * real column-actions popover. Original branching preserved as-is; only the raw
 * locator expressions are centralized here.
 */
function viewMenuTriggerStrategies(panelScope) {
    return [
        { name: 'role:button[name=View](original,exact)', locator: panelScope.getByRole('button', { name: /^View$/i }) },
    ];
}
function tableActionTriggerStrategies(panelScope, page) {
    return [
        { name: 'testid:bt-table-action(original,scoped)', locator: panelScope.getByTestId('bt-table-action') },
        { name: 'role:button[name=Table](original,exact)', locator: panelScope.getByRole('button', { name: /^Table$/i }) },
    ];
}

/** "Add custom column" action — MCP-verified live it renders as a plain `<button>` (not `role=menuitem`) inside the Table-action popover. */
function addColumnActionStrategies(page) {
    return [
        { name: 'role:menuitem[name=/Add custom column|Add column|Add Data/i](original)', locator: page.getByRole('menuitem', { name: /Add custom column|Add column|Add Data/i }) },
        { name: 'role:button[name=/Add custom column|Add column|Add Data/i](original,live-confirmed)', locator: page.getByRole('button', { name: /Add custom column|Add column|Add Data/i }) },
    ];
}

/** "Hide / show columns" (a.k.a. Manage Columns) action — same plain-`<button>` structure confirmed live. */
function manageColumnsActionStrategies(page) {
    return [
        { name: 'role:menuitem[name=/Manage Columns|Hide.show columns/i](original)', locator: page.getByRole('menuitem', { name: /Hide\s*\/\s*show columns|Show\s*\/\s*hide columns|Manage Columns|Column visibility/i }) },
        { name: 'role:button[name=/Manage Columns|Hide.show columns/i](original,live-confirmed)', locator: page.getByRole('button', { name: /Hide\s*\/\s*show columns|Show\s*\/\s*hide columns|Manage Columns|Column visibility/i }) },
    ];
}

/** Legacy-UI settings gear icon fallback (older builds without the View/Table split). */
function settingsGearButtonStrategies(panelScope) {
    return [
        { name: 'css:button:has(svg.lucide-settings)(original)', locator: panelScope.locator('button:has(svg.lucide-settings)') },
    ];
}

/** Add-Column modal — original CSS text-match plus a heading-based fallback. */
function addColumnModalStrategies(page) {
    return [
        { name: 'css:modal_AddColumn(original)', locator: page.locator(locators.modal_AddColumn) },
        { name: 'role:dialog[has=heading(Add column)]', locator: page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Add column' }) }) },
    ];
}

/** Manage-Columns settings drawer — original CSS plus the propertyLocators variant already used elsewhere in this file as a second real strategy. */
function settingsDrawerStrategies(page) {
    return [
        { name: 'css:settingsDrawer(original)', locator: page.locator(locators.settingsDrawer) },
        { name: 'css:section[role=dialog][hasText=Manage Columns]', locator: page.locator('section[role="dialog"]').filter({ hasText: 'Manage Columns' }) },
    ];
}

/** Add-Column modal's Name/Description inputs and submit button — original Playwright role-engine strings kept as #1, plain getByRole/getByPlaceholder added as a genuinely different lookup mechanism. */
function columnNameInputStrategies(page) {
    return [
        { name: 'engine:role=textbox[name^=Enter column name](original)', locator: page.locator(locators.columnNameInput) },
        { name: 'role:textbox[name=Enter column name]', locator: page.getByRole('textbox', { name: 'Enter column name' }) },
        { name: 'placeholder:Enter column name', locator: page.getByPlaceholder('Enter column name') },
    ];
}
function descriptionInputStrategies(page) {
    return [
        { name: 'engine:role=textbox[name^=Enter column description](original)', locator: page.locator(locators.descriptionInput) },
        { name: 'role:textbox[name=Enter column description]', locator: page.getByRole('textbox', { name: 'Enter column description' }) },
        { name: 'placeholder:Enter column description', locator: page.getByPlaceholder('Enter column description') },
    ];
}
function addColumnSubmitBtnStrategies(page) {
    return [
        { name: 'engine:role=button[name=Add column](original)', locator: page.locator(locators.addColumnBtn) },
        { name: 'role:button[name=Add column](exact)', locator: page.getByRole('button', { name: 'Add column', exact: true }) },
    ];
}

/** Manage-Columns drawer contents — original Playwright role-engine/CSS strings kept as #1, `getByRole`/`getByText` added as independent mechanisms. */
function drawerTitleStrategies(panel) {
    return [
        { name: 'css:h2[hasText=Manage Columns](original)', locator: panel.locator(locators.drawerTitle) },
        { name: 'role:heading[name=Manage Columns]', locator: panel.getByRole('heading', { name: 'Manage Columns' }) },
    ];
}
function drawerCloseStrategies(pageOrPanel) {
    return [
        { name: 'css:button.mantine-Drawer-close(original)', locator: pageOrPanel.locator('.mantine-Drawer-close') },
    ];
}
function defaultColumnTextStrategies(panel) {
    return [
        { name: 'css:p[hasText=Default Columns](original)', locator: panel.locator(locators.defaultColumnText) },
        { name: 'text:Default Columns', locator: panel.getByText('Default Columns') },
    ];
}
function customColumnsTextStrategies(panel) {
    return [
        { name: 'css:p[hasText=Custom Columns](original)', locator: panel.locator(locators.customColumnsText) },
        { name: 'text:Custom Columns', locator: panel.getByText('Custom Columns') },
    ];
}

/** Location-type dropdown (Sites / Units / Buildings) inside the Locations tabpanel. */
function locationDropdownStrategies(tabpanel) {
    return [
        { name: 'css:input[placeholder=Select location type](original)', locator: tabpanel.locator(locators.locationDropdown) },
        { name: 'placeholder:Select location type', locator: tabpanel.getByPlaceholder('Select location type') },
    ];
}
function locationDropdownOptionStrategies(page, type) {
    const optionLabel = type === 'unit' ? 'Units' : type === 'building' ? 'Buildings' : type;
    return [
        { name: 'role:option[name](original)', locator: page.getByRole('option', { name: optionLabel }) },
        { name: 'css:.mantine-Select-option[hasText](original)', locator: page.locator(locators.locationDropdownOption(type)) },
    ];
}

/** Row-level delete button inside a Locations grid row — icon-class-based, MCP-verified live (`svg.lucide-trash2`, no title/aria-label present on the button itself). */
function locationRowDeleteButtonStrategies(row) {
    return [
        { name: 'css:button:has(svg.lucide-trash2)|title|ariaLabel(original)', locator: row.locator('button:has(svg.lucide-trash2), button[title*="Delete"], button[aria-label*="Delete"]') },
    ];
}
/** Delete-row confirmation button — original role-based + popover-CSS union kept intact as one combined strategy (already a genuine 2-mechanism union). */
function locationDeleteConfirmStrategies(page) {
    return [
        { name: 'role:button[name=Delete](original)', locator: page.getByRole('button', { name: 'Delete' }) },
        { name: 'css:.mantine-Popover-dropdown button[hasText=Delete](original)', locator: page.locator('.mantine-Popover-dropdown button:has-text("Delete")') },
    ];
}

/** "Test Column" row inside the settings drawer, and its own action button (deleteCustomColumn). */
function testColumnRowStrategies(page) {
    return [
        { name: 'css:.mantine-Group-root[hasText=Test Column](original)', locator: page.locator(".mantine-Group-root:has-text('Test Column')") },
        { name: 'css:div[hasText=Test Column]', locator: page.locator('div').filter({ hasText: 'Test Column' }).last() },
    ];
}
function genericDeleteButtonStrategies(page) {
    return [
        { name: 'css:button|menuitem[hasText=Delete](original)', locator: page.locator('button:has-text("Delete"), [role="menuitem"]:has-text("Delete")') },
    ];
}

/** Unit-view / Building-view table assertions. */
function unitNameHeaderStrategies(tabpanel) {
    return [
        { name: 'text:Unit Name(exact,original)', locator: tabpanel.getByText('Unit Name', { exact: true }) },
        /**
         * CAUTION (found live, not assumed): `getByRole('columnheader', {name})` matches
         * the columnheader DIV (accessible-name computation), while the original
         * `getByText` matches the smaller inner `<span class="bird-table-header-title">`
         * — two different real, simultaneously-visible nodes, strict-mode violation.
         * Filtering the columnheader locator by its own `hasText` keeps the match on
         * the SAME span-containing structure instead of introducing a second node.
         */
        { name: 'css:columnheader[hasText=Unit Name]', locator: tabpanel.locator('[role="columnheader"]').filter({ hasText: 'Unit Name' }).locator('.bird-table-header-title') },
    ];
}
function buildingColumnHeaderStrategies(tabpanel, header) {
    return [
        { name: 'role:columnheader[name](original)', locator: tabpanel.getByRole('columnheader', { name: header }) },
    ];
}

module.exports = {
    ...locators,
    locationsTabStrategies,
    locationsTabpanelStrategies,
    addRowTriggerStrategies,
    addRowMenuChoiceStrategies,
    locationSearchInputStrategies,
    viewMenuTriggerStrategies,
    tableActionTriggerStrategies,
    addColumnActionStrategies,
    manageColumnsActionStrategies,
    settingsGearButtonStrategies,
    addColumnModalStrategies,
    settingsDrawerStrategies,
    columnNameInputStrategies,
    descriptionInputStrategies,
    addColumnSubmitBtnStrategies,
    drawerTitleStrategies,
    drawerCloseStrategies,
    defaultColumnTextStrategies,
    customColumnsTextStrategies,
    locationDropdownStrategies,
    locationDropdownOptionStrategies,
    locationRowDeleteButtonStrategies,
    locationDeleteConfirmStrategies,
    testColumnRowStrategies,
    genericDeleteButtonStrategies,
    unitNameHeaderStrategies,
    buildingColumnHeaderStrategies,
    locationsTreegridStrategies,
    locationEditButtonStrategies,
    blankRowIndicatorStrategies,
    addSiteOnlyChoiceStrategies,
    addRowContextMenuItemStrategies,
    gridCellByTextStrategies,
    newRowStrategies,
    revogrEditInputStrategies,
    nameEditorCandidateLocators,
    inlineContentEditableStrategies,
    lateEditorStrategies,
    dataRowsStrategies,
    matchedRowStrategies,
    treegridDataRowsStrategies,
};