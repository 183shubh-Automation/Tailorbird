export const propertyLocators = {
    // ============ TABLE HEADERS & STRUCTURE (REVOGRID) ============
    tableViewHeader: '[role="columnheader"]',
    tableScrollContainer: '[role="treegrid"]',
    tableHeaders: '[role="columnheader"]',
    tableRows: '[role="row"]',
    tableRowCells: '[role="gridcell"]',
    gridRootWrapper: "[role='treegrid']",
    
    // ============ ROW & CELL OPERATIONS ============
    firstRowNameCell: '[role="row"]:first-of-type [role="gridcell"]:first-of-type',
    firstRowNameCellText: '[role="row"]:first-of-type [role="gridcell"]:first-of-type div',
    propertyNameCell: name => `[role="gridcell"]:has-text("${name}")`,
    rowFromCell: "xpath=ancestor::div[@role='row']",
    /** Actions column: trash uses aria-label="Delete Property" and lucide-trash2 (live properties table HTML). */
    rowDeleteIcon: rowIndex =>
        `[role="row"][data-rgrow="${rowIndex}"] button[aria-label="Delete Property"], [role="row"][data-rgrow="${rowIndex}"] button:has(svg[class*="lucide-trash"])`,
    
    // ============ FILTERS & ACTIONS (BirdTable FilterPopup) ============
    filterBadges: '[role="treegrid"] .mantine-Badge-label',
    filterPanelTitle: ".mantine-Paper-root p:has-text('Filters')",
    filterCheckbox: value => `input[value="${value}"]`,
    clearAllFiltersLink: '.mantine-Paper-root a:has-text("Clear All Filters")',
    resetFiltersButton: 'button:has-text("Reset Filters")',
    
    // ============ TABS (TAKEOFFS) — UI labels (was Interior / Exterior) ============
    interiorTab: '[role="tab"]:has-text("Floor Plans")',
    exteriorTab: '[role="tab"]:has-text("Building Exterior")',
    assetViewerTab: 'button[role="tab"]:has-text("Asset Viewer")',
    locationsTab: 'button[role="tab"]:has-text("Locations")',
    
    // ============ NAVIGATION & VIEWS ============
    propertiesNavLink: ".mantine-NavLink-root:has-text('Properties')",
    breadcrumbsProperties: ".mantine-Breadcrumbs-root:has-text('Properties')",
    propertiesBreadcrumbByName: name => `.mantine-Breadcrumbs-root:has-text('${name}')`,
    propertiesGridCardByName: name => `.mantine-SimpleGrid-root p:has-text('${name}')`,
    layoutListIcon: "button:has-text('Layout')",
    viewMenuItemLabel: view => `.mantine-Menu-itemLabel:has-text('${view}')`,
    
    // ============ CREATE/EDIT PROPERTY ============
    createPropertyButton: "button:has-text('Create Property')",
    /** Prefer PropertiesHelper.addPropertyDialog() — Mantine heading level/title class changed in newer builds. */
    addPropertyModalHeader: "[role='dialog'] .mantine-Modal-title, [role='dialog'] .mantine-Modal-header",
    /** Mantine Autocomplete (GoogleMapsAutocomplete): options are `.mantine-Autocomplete-option`; listbox/role=option can be "hidden" to Playwright when portaled. */
    addressSuggestion: address =>
        `.mantine-Popover-dropdown .mantine-Autocomplete-option[data-combobox-option]:has-text("${address}")`,
    /** Property type uses Mantine Select; match open dropdown options like other suites (e.g. approval). */
    propertyTypeOption: type => `.mantine-Popover-dropdown .mantine-Select-option:has-text("${type}")`,
    
    // ============ BUTTONS & ACTIONS ============
    /** Revogrid row: view is ActionIcon + lucide-eye (no title in current bird-table cell renderer). */
    viewDetailsButton:
        '[role="treegrid"] button:has(svg.lucide-eye), [role="treegrid"] button[title="View Details"]',
    viewDetailsBtn:
        '[role="treegrid"] button:has(svg.lucide-eye), [role="treegrid"] button[title="View Details"]',
    deleteButtonInPopover: '[role="dialog"] button:has-text("Delete")',
    deleteConfirmBtn: ".mantine-Popover-dropdown button:has-text('Delete')",
    assetViewer: 'button:has-text("Asset Viewer")',
    selectall: 'button:has-text("Select All")',
    selectNone: 'button:has-text("Select None")',
    cancelbtn: 'button:has-text("Cancel")',
    selectDownload: 'button:has-text("Download Selected")',
    downloadIcon: '.lucide-download',
    
    // ============ SEARCH & FILTER ============
    /** BirdTable wraps the grid search; fall back to plain placeholder if markup shifts. */
    searchInput: '.bird-table-search-input input[placeholder="Search..."], input[placeholder="Search..."]',
    /**
     * Toolbar: Layout/Filter/View/Table/Export all use data-table-action="true"; Export alone uses lucide-download
     * (live /properties?tab=property-access HTML, Mantine Button + leftSection icon).
     */
    birdTableExportButton: 'button[data-table-action="true"]:has(svg.lucide-download)',
    /** Filter control in the same toolbar group as Export. */
    birdTableFilterButton: 'button[data-table-action="true"]:has(svg.lucide-funnel)',
    exportButton:
        'button[data-table-action="true"]:has(svg.lucide-download), button[aria-label="Export"], button:has-text("Export")',
    
    // ============ PROPERTY DOCUMENTS ============
    documentsHeader: 'text=Property Documents',
    documentsSubHeader: 'text=Files and images related to this property',
    propertyDocumentsTitle: 'p.mantine-Text-root:has-text("Property Documents")',
    uploadFilesBtn: 'button:has-text("Upload Files")',
    uploadFilesButton: 'role=button[name="Upload Files"]',
    uploadDialog: 'dialog[open]',
    uploadFileInput: 'input[type="file"]',
    uploadListDialog: 'dialog[open] uc-upload-list',
    
    // ============ COLUMN MANAGEMENT ============
    tableSettingsButton: 'button:has(svg.lucide-settings)',
    manageColumnsDrawer: 'section[role="dialog"]',
    deleteColumnIcon: ".mantine-Group-root:has-text('Random Name') .lucide-trash2",
    addDataButton: '[data-testid="bt-table-action"]',
    addColumn: '[data-testid="bt-table-action"]',
    nameInput: 'input[placeholder^="Enter column name"]',
    nameInputModal: 'input[placeholder^="Enter column name"]',
    descInput: 'input[placeholder^="Enter column description"]',
    typeButtons: 'div[style*="grid-template-columns"] button',
    submitButton: 'button:has-text("Add column"):not([disabled])',
    submitAddColumn: 'button:has-text("Add column"):not([disabled])',
};

/**
 * Self-healing strategies for TC49 (tests/TC04_properties.spec.js — "Validate Property
 * Export Functionality and New Property Creation") and reused by TC50-TC53/TC62/etc via
 * PropertiesHelper. All MCP-verified live 2026-08-05 (beta.tailorbird.com/properties).
 * Strategy #1 in every list is the exact original pre-existing expression, unchanged.
 * No regex/XPath in ADDED strategies (pre-existing regex kept verbatim where it was #1).
 */

/** "Create Property" toolbar button — original CSS text-match + a role-based ARIA fallback (MCP-verified exact visible text "Create Property", no data-testid). */
function createPropertyButtonStrategies(page) {
    return [
        { name: 'css:button:has-text(Create Property)(original)', locator: page.locator(propertyLocators.createPropertyButton) },
        { name: 'role:button[name=Create Property](exact)', locator: page.getByRole('button', { name: 'Create Property', exact: true }) },
    ];
}

/**
 * "Add property" modal root. Original filters the dialog by a case-insensitive regex on
 * its full text; fallback scopes by the modal's own <h2> heading instead (MCP-verified:
 * `<div role="dialog"><header><h2>Add property</h2>...`), a structurally independent path
 * (heading-role lookup vs whole-dialog text regex) that avoids regex in the new strategy.
 */
function addPropertyDialogStrategies(page) {
    return [
        { name: 'role:dialog[hasText=/add property/i](original)', locator: page.getByRole('dialog').filter({ hasText: /add\s+property/i }).last() },
        { name: 'role:dialog[has=heading(Add property)]', locator: page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Add property', level: 2 }) }).last() },
    ];
}

/**
 * Add-property modal field inputs. Every field's dynamic Mantine `id` is unusable
 * (regenerated per mount); the two genuinely independent live-verified signals are the
 * `<label for>` text (original) and the input's own `placeholder` attribute — two
 * separate DOM attributes set independently by the same form component. A 3rd,
 * weaker positional fallback (nth input inside the dialog, in the fixed field order
 * Name/Address/City/State/Zipcode/Type MCP-verified live) is kept last.
 *
 * CAUTION: City/State/Zipcode placeholders read "Enter city"/"Enter state"/"Enter
 * zipcode" only BEFORE an address suggestion is picked — MCP-verified that selecting an
 * address autocomplete option auto-fills AND disables these three fields, changing their
 * placeholder to "Auto-filled from address". createProperty() fills city/state/zip
 * BEFORE the address step (matching this pre-fill placeholder text), so the placeholder
 * fallback strategy is valid at the point it's actually used.
 */
function nameInputStrategies(page) {
    return [
        { name: 'label:Name(original)', locator: page.getByLabel('Name') },
        { name: 'placeholder:Enter name', locator: page.getByPlaceholder('Enter name') },
        { name: 'position:dialog-input[0]', locator: page.locator('[role="dialog"] input:not([type="hidden"])').nth(0) },
    ];
}

function addressInputStrategies(page) {
    return [
        { name: 'role:textbox[name=Address](original)', locator: page.getByRole('textbox', { name: 'Address' }) },
        { name: 'placeholder:Enter address', locator: page.getByPlaceholder('Enter address') },
        { name: 'position:dialog-input[1]', locator: page.locator('[role="dialog"] input:not([type="hidden"])').nth(1) },
    ];
}

function cityInputStrategies(page) {
    return [
        { name: 'label:City(original)', locator: page.getByLabel('City') },
        { name: 'placeholder:Enter city(pre-address-fill)', locator: page.getByPlaceholder('Enter city') },
        { name: 'position:dialog-input[2]', locator: page.locator('[role="dialog"] input:not([type="hidden"])').nth(2) },
    ];
}

function stateInputStrategies(page) {
    return [
        { name: 'label:State(original)', locator: page.getByLabel('State') },
        { name: 'placeholder:Enter state(pre-address-fill)', locator: page.getByPlaceholder('Enter state') },
        { name: 'position:dialog-input[3]', locator: page.locator('[role="dialog"] input:not([type="hidden"])').nth(3) },
    ];
}

function zipInputStrategies(page) {
    return [
        { name: 'label:Zipcode(original)', locator: page.getByLabel('Zipcode') },
        { name: 'placeholder:Enter zipcode(pre-address-fill)', locator: page.getByPlaceholder('Enter zipcode') },
        { name: 'position:dialog-input[4]', locator: page.locator('[role="dialog"] input:not([type="hidden"])').nth(4) },
    ];
}

/**
 * Original uses the placeholder directly (no label lookup). Fallback 2 uses a
 * role-scoped label lookup (`getByRole('textbox', {name})`), NOT plain `getByLabel`.
 *
 * CAUTION (found live, not assumed): plain `getByLabel('Type')` matched 2 elements —
 * the input itself AND Mantine's hidden `<div role="listbox" aria-labelledby="...">`
 * options container, which is ALSO associated with the same label via aria-labelledby
 * and therefore shares the same computed accessible name. Scoping the role to
 * `textbox` excludes the listbox div (role="listbox") and resolves only the input.
 */
function typeInputStrategies(page) {
    return [
        { name: 'css:input[placeholder=Select type](original)', locator: page.locator('input[placeholder="Select type"]') },
        { name: 'role:textbox[name=Type](exact)', locator: page.getByRole('textbox', { name: 'Type', exact: true }) },
        { name: 'position:dialog-input[5]', locator: page.locator('[role="dialog"] input:not([type="hidden"])').nth(5) },
    ];
}

/** Modal "Cancel" button — role-based original plus an own-text filter (different selector mechanism), MCP-verified single Cancel button in the dialog. */
function cancelBtnStrategies(page) {
    return [
        { name: 'role:button[name=Cancel](original)', locator: page.getByRole('button', { name: 'Cancel' }) },
        { name: 'css:dialog>>button[hasText=Cancel]', locator: page.locator('[role="dialog"] button').filter({ hasText: 'Cancel' }) },
    ];
}

/** Modal submit button — original regex (kept verbatim) plus an own-text filter fallback (Playwright's string hasText is already case-insensitive substring, so no regex needed in the new strategy). MCP-verified visible/DOM text is lowercase "add property". */
function addPropertyBtnStrategies(page) {
    return [
        { name: 'role:button[name=/add property/i](original)', locator: page.getByRole('button', { name: /add property/i }) },
        { name: 'css:dialog>>button[hasText=add property]', locator: page.locator('[role="dialog"] button').filter({ hasText: 'add property' }) },
    ];
}

/**
 * Google-Maps-Autocomplete address suggestion. Original CSS (class + data-combobox-option
 * + has-text) kept as #1. MCP-verified the option also carries `role="option"` in the
 * accessibility tree — role-based lookup is naturally scoped to the single VISIBLE
 * popover (hidden/stale popovers, confirmed to linger in the DOM after earlier
 * interactions, are excluded from the accessibility tree), so it's a safer fallback than
 * another CSS-only selector would be.
 */
function addressSuggestionStrategies(page, address) {
    return [
        { name: 'css:.mantine-Autocomplete-option[data-combobox-option](original)', locator: page.locator(propertyLocators.addressSuggestion(address)).first() },
        { name: 'role:option[name=address](exact)', locator: page.getByRole('option', { name: address, exact: true }) },
    ];
}

/** Property-type Select dropdown option. Same reasoning as addressSuggestionStrategies — role-based lookup naturally excludes the hidden/stale popovers MCP confirmed linger in the DOM. */
function propertyTypeOptionStrategies(page, type) {
    return [
        { name: 'css:.mantine-Select-option[data-combobox-option](original)', locator: page.locator(propertyLocators.propertyTypeOption(type)).first() },
        { name: 'role:option[name=type](exact)', locator: page.getByRole('option', { name: type, exact: true }) },
    ];
}

/**
 * Table/Grid view switcher toolbar button (Layout/View/Table — copy has varied across
 * builds). Identical union to the one previously inlined in PropertiesHelper.changeView();
 * moved here for locator-file architecture compliance, same precedence/behavior.
 * MCP-verified current toolbar renders "Layout" (icon `lucide-layout-list`, shares
 * `data-table-action="true"` with the other 3 toolbar buttons — not unique alone).
 */
function toolbarSwitcherStrategies(page) {
    return [
        { name: 'role:button[name=layout|view|table](original)', locator: page.getByRole('button', { name: /^(layout|view|table)$/i }) },
        { name: 'testid:bt-table-action', locator: page.locator('[data-testid="bt-table-action"]') },
        { name: 'css:button[data-table-action=true]', locator: page.locator('button[data-table-action="true"]') },
    ];
}

/** BirdTable Export toolbar button, scoped to a caller-supplied root (main or page). MCP-verified `svg.lucide-download` uniquely identifies Export among the 4 `data-table-action="true"` toolbar buttons. */
function exportButtonStrategies(scope) {
    return [
        { name: 'css:button[data-table-action=true]:has(svg.lucide-download)(original)', locator: scope.locator(propertyLocators.birdTableExportButton) },
        { name: 'role:button[name=Export](exact)', locator: scope.getByRole('button', { name: 'Export', exact: true }) },
    ];
}

/** Properties table search input. */
function searchInputStrategies(page) {
    return [
        { name: 'css:input[placeholder=Search...](original)', locator: page.locator(propertyLocators.searchInput) },
        { name: 'role:textbox[name=Search...]', locator: page.getByRole('textbox', { name: 'Search...' }) },
    ];
}

/**
 * Self-healing strategies for TC51 (tests/TC04_properties.spec.js — property-type filter
 * drawer). All MCP-verified live 2026-08-05 (beta.tailorbird.com/properties, Table View).
 */

/** Toolbar "Filter" button — original CSS (icon+attr) plus a role-based ARIA fallback (MCP-verified exact text "Filter", shares data-table-action="true" with 3 other toolbar buttons so the icon class is required to disambiguate the CSS strategy). */
function filterButtonStrategies(page) {
    return [
        { name: 'css:button[data-table-action=true]:has(svg.lucide-funnel)(original)', locator: page.locator(propertyLocators.birdTableFilterButton) },
        { name: 'role:button[name=Filter](exact)', locator: page.getByRole('button', { name: 'Filter', exact: true }) },
    ];
}

/**
 * Filter drawer/popup root. Original filters `.mantine-Paper-root` by "Filter Options"
 * hasText (kept as #1). MCP-verified the popup also always renders a "Filters" title
 * <p> above "Filter Options" — filtering on that instead is a genuinely different text
 * anchor on the same element (not just a re-check of the same string).
 */
function filterPopupStrategies(page) {
    return [
        { name: 'css:.mantine-Paper-root[hasText=Filter Options](original)', locator: page.locator('.mantine-Paper-root').filter({ hasText: 'Filter Options' }) },
        { name: 'css:.mantine-Paper-root[hasText=Filters]', locator: page.locator('.mantine-Paper-root').filter({ hasText: 'Filters' }).filter({ hasText: 'City' }) },
    ];
}

/**
 * Property-type filter checkbox (Garden Style / Mid Rise / High Rise / Military
 * Housing). Original PropertiesHelper.filterProperty() looks it up by role+accessible
 * name (computed from its <label>). MCP-verified each checkbox ALSO carries a stable
 * semantic `value` attribute (`garden_style`, `mid_rise`, etc., matching
 * propertyLocators.filterCheckbox) — a genuinely independent mechanism (DOM attribute
 * vs. label-derived accessible name) requiring a separate type→value map since the
 * value is snake_case while the visible label is Title Case.
 */
const FILTER_TYPE_VALUE = {
    'Garden Style': 'garden_style',
    'Mid Rise': 'mid_rise',
    'High Rise': 'high_rise',
    'Military Housing': 'military_housing',
};
function filterCheckboxStrategies(popup, type) {
    const strategies = [
        { name: 'role:checkbox[name](original)', locator: popup.getByRole('checkbox', { name: type }) },
    ];
    const value = FILTER_TYPE_VALUE[type];
    if (value) {
        strategies.push({ name: `css:input[value=${value}]`, locator: popup.locator(propertyLocators.filterCheckbox(value)) });
    }
    return strategies;
}

/** Filter drawer close (X) button — no aria-label/testid/icon-class exists (MCP-verified); the only other independent, live-confirmed signal is that it's the drawer's structurally-first button (header row, before the Filter Options accordion). */
function filterCloseButtonStrategies(popup) {
    return [
        { name: 'css:.mantine-CloseButton-root(original)', locator: popup.locator('.mantine-CloseButton-root') },
        { name: 'position:drawer-button[first]', locator: popup.locator('button').first() },
    ];
}

/**
 * Self-healing strategies for PropertiesHelper.viewDetailsButton() (TC56 and siblings).
 * MCP-verified live 2026-08-05.
 */
function viewDetailsButtonStrategies(page) {
    return [
        { name: 'css:viewDetailsButton(original)', locator: page.locator(propertyLocators.viewDetailsButton).first() },
        { name: 'role:button[name=View Details]', locator: page.getByRole('button', { name: 'View Details' }).first() },
    ];
}

/** Card-layout fallback: property title match inside a card, used when the grid "View Details" button isn't present. */
function matchingCardTitleStrategies(page, searchValue) {
    return [
        { name: 'css:main p[has=text-exact](original)', locator: page.locator('main p').filter({ has: page.getByText(searchValue, { exact: true }) }).first() },
    ];
}

/** Card-layout fallback: first visible property card, used when neither the grid button nor a title match is found. */
function firstClickableCardStrategies(page) {
    return [
        { name: 'css:.mantine-Card-root|Card-root(original)', locator: page.locator('.mantine-Card-root:visible, [class*="Card-root"]:visible').first() },
    ];
}

/**
 * Self-healing strategies for TC57/TC58 (tests/TC04_properties.spec.js — Takeoffs
 * Interior/Exterior panels). All MCP-verified live 2026-08-06
 * (beta.tailorbird.com/properties/details?selected-tab=takeoffs, "Test Property
 * 1_Cottages on Elm").
 */

/** Property-details "Takeoffs" top-level tab. Same Mantine tab pattern (role=tab + `.mantine-Tabs-tab` class) MCP-verified throughout this suite. */
function takeoffsTabStrategies(page) {
    return [
        { name: 'role:tab[name=Takeoffs](original,exact)', locator: page.getByRole('tab', { name: /^Takeoffs$/i }) },
        { name: 'css:.mantine-Tabs-tab[hasText=Takeoffs]', locator: page.locator('.mantine-Tabs-tab').filter({ hasText: 'Takeoffs' }) },
    ];
}

/** Floor Plans (interior) / Building Exterior sub-tabs within Takeoffs — original CSS text-match kept as #1, role-based ARIA lookup added (MCP-verified both render as role=tab buttons). */
function interiorTabStrategies(page) {
    return [
        { name: 'css:interiorTab(original)', locator: page.locator(propertyLocators.interiorTab) },
        { name: 'role:tab[name=Floor Plans]', locator: page.getByRole('tab', { name: 'Floor Plans' }) },
    ];
}
function exteriorTabStrategies(page) {
    return [
        { name: 'css:exteriorTab(original)', locator: page.locator(propertyLocators.exteriorTab) },
        { name: 'role:tab[name=Building Exterior]', locator: page.getByRole('tab', { name: 'Building Exterior' }) },
    ];
}

/** Takeoffs toolbar "Filter" button — MCP-verified exact text "Filter", shares the same 5-button toolbar pattern as other BirdTable-style toolbars in this suite. */
function takeoffsFilterButtonStrategies(page) {
    return [
        { name: 'role:button[name=Filter](original,exact)', locator: page.getByRole('button', { name: /^Filter$/i }) },
    ];
}

/** Filter-drawer "Reset Filters" button and its close (X) button — reuses the same Filter-Options-drawer structure MCP-verified for TC51's property-list filter drawer. */
function takeoffsResetFiltersStrategies(page) {
    return [
        { name: 'css:button[hasText=Reset Filters](original)', locator: page.locator('button:has-text("Reset Filters")') },
    ];
}
function takeoffsFilterCloseButtonStrategies(page) {
    return [
        { name: 'css:.mantine-Paper-root .mantine-CloseButton-root(original)', locator: page.locator(".mantine-Paper-root .mantine-CloseButton-root") },
    ];
}

/** Filter-drawer type-filter checkbox (ce-gm, ce-i, ce-l, ce-r, ce-t v1, etc.) — MCP-verified live label text matches exactly. */
function takeoffFilterCheckboxLabelStrategies(page, type) {
    return [
        { name: 'css:.mantine-Checkbox-labelWrapper label[hasText](original)', locator: page.locator(`.mantine-Checkbox-labelWrapper label:has-text("${type}")`) },
    ];
}

/** "Select Version" combobox on the Takeoffs panel — dynamic id, no label/aria-label (MCP-verified); placeholder is the only genuine signal, exposed via two independent Playwright APIs. */
function takeoffVersionInputStrategies(page) {
    return [
        { name: 'css:input[placeholder=Select Version](original)', locator: page.locator('input[placeholder="Select Version"]') },
        { name: 'placeholder:Select Version', locator: page.getByPlaceholder('Select Version') },
    ];
}

/** Takeoffs tabpanel — scopes grid searches away from other tabs' revo-grids (e.g. Locations). */
function takeoffsTabpanelStrategies(page) {
    return [
        { name: 'role:tabpanel[name=Takeoffs](original)', locator: page.getByRole('tabpanel', { name: 'Takeoffs' }) },
    ];
}

/** The 3 candidate grid element types considered by getVisibleTakeoffTreegrid()'s scoring algorithm — centralizing the raw selectors only; the scoring/selection logic itself is untouched. */
function revoGridStrategies(scope) {
    return [
        { name: 'css:revo-grid[role=treegrid](original)', locator: scope.locator('revo-grid[role="treegrid"]') },
    ];
}
function genericTreegridStrategies(scope) {
    return [
        { name: 'role:treegrid(original)', locator: scope.locator('[role="treegrid"]') },
    ];
}
function agGridStrategies(scope) {
    return [
        { name: 'css:.ag-root[role=grid](original)', locator: scope.locator('.ag-root[role="grid"]') },
    ];
}

/** Filter-drawer title paragraph ("Filters" / "Filter Options") — MCP-verified live, same 2-paragraph structure as TC51's property-list filter drawer. */
function takeoffsFilterPanelTitleStrategies(page) {
    return [
        { name: "css:.mantine-Paper-root p[hasText=Filter](original)", locator: page.locator(".mantine-Paper-root p:has-text('Filter')") },
    ];
}

/** AG-Grid badge cells (floorplan_id column) used to count filtered results. */
function takeoffFilterBadgeStrategies(page) {
    return [
        { name: 'css:.ag-center-cols-container div[col-id=floorplan_id](original)', locator: page.locator('.ag-center-cols-container div[col-id="floorplan_id"]') },
    ];
}

/** "Clear All Filters" link inside the takeoff filter drawer. */
function takeoffClearAllFiltersStrategies(page) {
    return [
        { name: 'css:.mantine-Paper-root a[hasText=Clear All Filters](original)', locator: page.locator('.mantine-Paper-root a:has-text("Clear All Filters")') },
    ];
}

/**
 * Self-healing strategies for TC59 (tests/TC04_properties.spec.js — Asset Viewer
 * dropdown discovery). MCP-verified live 2026-08-06.
 */

/** "Asset Viewer" top-level tab — same Mantine tab pattern (role=tab + `.mantine-Tabs-tab` class) as elsewhere in this suite; original CSS text-match kept as #1. */
function assetViewerTabStrategies(page) {
    return [
        { name: 'css:button[hasText=Asset Viewer](original)', locator: page.locator('button:has-text("Asset Viewer")') },
        { name: 'role:tab[name=Asset Viewer]', locator: page.getByRole('tab', { name: 'Asset Viewer', exact: true }) },
    ];
}

/**
 * A dropdown input discovered by its adjacent `<label>` text (TC59 iterates whatever
 * labels the Asset Viewer panel exposes at runtime — Neighborhoods/Type/Site/View —
 * so `name` is caller-supplied, not a fixed value). Original adjacent-sibling CSS
 * pattern kept as #1. MCP-verified `getByLabel(name)` (using the label's real `for`
 * attribute) resolves to the SAME input node — a genuinely independent mechanism
 * (semantic label association vs. structural sibling traversal), not a guess.
 */
function dropdownInputByLabelStrategies(panel, name) {
    return [
        { name: 'css:label[hasText]+div input(original)', locator: panel.locator(`label:has-text("${name}") + div input`) },
        { name: 'label:name(getByLabel)', locator: panel.getByLabel(name) },
    ];
}

/** Save button inside a takeoff cell-edit confirmation dialog. */
function takeoffSaveInDialogStrategies(page) {
    return [
        { name: 'css:dialog>>button[hasText=Save](original)', locator: page.locator('[role="dialog"] button:has-text("Save")') },
    ];
}

export {
    createPropertyButtonStrategies,
    addPropertyDialogStrategies,
    nameInputStrategies,
    addressInputStrategies,
    cityInputStrategies,
    stateInputStrategies,
    zipInputStrategies,
    typeInputStrategies,
    cancelBtnStrategies,
    addPropertyBtnStrategies,
    addressSuggestionStrategies,
    propertyTypeOptionStrategies,
    toolbarSwitcherStrategies,
    exportButtonStrategies,
    searchInputStrategies,
    filterButtonStrategies,
    filterPopupStrategies,
    filterCheckboxStrategies,
    filterCloseButtonStrategies,
    viewDetailsButtonStrategies,
    matchingCardTitleStrategies,
    firstClickableCardStrategies,
    takeoffsTabStrategies,
    interiorTabStrategies,
    exteriorTabStrategies,
    takeoffsFilterButtonStrategies,
    takeoffsResetFiltersStrategies,
    takeoffsFilterCloseButtonStrategies,
    takeoffFilterCheckboxLabelStrategies,
    takeoffVersionInputStrategies,
    takeoffsTabpanelStrategies,
    revoGridStrategies,
    genericTreegridStrategies,
    agGridStrategies,
    takeoffSaveInDialogStrategies,
    takeoffsFilterPanelTitleStrategies,
    takeoffFilterBadgeStrategies,
    takeoffClearAllFiltersStrategies,
    assetViewerTabStrategies,
    dropdownInputByLabelStrategies,
};
