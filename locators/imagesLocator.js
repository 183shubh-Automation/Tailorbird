/**
 * Locators for the Images page (Documents > Images, /documents/images).
 * MCP-verified live (2026-08-14): this page shares the exact same generic toolbar
 * (Search/Filter/View/Table/Export), Manage-Columns drawer, and Uploadcare upload widget
 * already used by the Property Documents grid (pages/properties.js) — so several selectors
 * here intentionally mirror locators/propertyLocator.js's generic, non-page-specific CSS
 * (e.g. `dialog[open]`, `uc-upload-list`) rather than inventing new ones.
 *
 * Multi-locator strategy: key controls combine at least 4 distinct techniques (role,
 * data-testid, CSS, and text-based) via `.or()`, matching the fallback convention already
 * used throughout this codebase (e.g. locators/budgetLocator.js, locators/vendorLocator.js).
 */
function imagesLocators(page) {
    return {
        // --- Breadcrumb ---
        breadcrumbHomeLink: page.getByRole('link', { name: 'Home' }),
        // Scoped to <main> — the plain, unscoped `getByText('Images', { exact: true })` also
        // matches the left-nav's own (sometimes hidden/duplicated) "Images" NavLink label,
        // which lives in <nav>, a sibling of <main>, not a descendant.
        breadcrumbImagesText: page.locator('main').getByText('Images', { exact: true }).first(),

        // --- Toolbar ---
        // MCP-verified live (2026-08-14): Filter/View/Table/Export all share a real
        // `data-table-action="true"` attribute; only Table also carries a data-testid.
        uploadPhotosButton: page
            .getByRole('button', { name: 'Upload Photos', exact: true })
            .or(page.getByTestId('bt-upload-photos'))
            .or(page.locator('button').filter({ hasText: 'Upload Photos' }))
            .or(page.locator('button:has-text("Upload Photos")')),
        searchInput: page
            .locator('input[placeholder="Search..."]')
            .or(page.getByPlaceholder('Search...'))
            .or(page.locator('main').getByRole('textbox').first())
            .or(page.locator('input.mantine-TextInput-input[placeholder="Search..."]'))
            .first(),
        filterButton: page
            .getByRole('button', { name: 'Filter', exact: true })
            .or(page.locator('button[data-table-action="true"]').filter({ hasText: 'Filter' }))
            .or(page.locator('button:has-text("Filter")'))
            .or(page.locator('button.mantine-Button-root').filter({ hasText: 'Filter' })),
        viewButton: page
            .getByRole('button', { name: 'View', exact: true })
            .or(page.locator('button[data-table-action="true"]').filter({ hasText: 'View' }))
            .or(page.locator('button:has-text("View")'))
            .or(page.locator('button.mantine-Button-root').filter({ hasText: 'View' })),
        tableButton: page
            .getByTestId('bt-table-action')
            .or(page.getByRole('button', { name: 'Table', exact: true }))
            .or(page.locator('button[data-table-action="true"]').filter({ hasText: 'Table' }))
            .or(page.locator('button:has-text("Table")')),
        exportButton: page
            .getByRole('button', { name: 'Export', exact: true })
            .or(page.locator('button[data-table-action="true"]').filter({ hasText: 'Export' }))
            .or(page.locator('button:has-text("Export")'))
            .or(page.locator('button.mantine-Button-root').filter({ hasText: 'Export' })),

        // --- Table menu (Table button dropdown) ---
        addCustomColumnMenuItem: page
            .getByTestId('bt-table-action-add-column')
            .or(page.getByRole('button', { name: 'Add custom column' })),
        hideShowColumnsMenuItem: page
            .getByTestId('bt-table-action-hide-show-columns')
            .or(page.getByRole('button', { name: 'Hide / show columns' })),

        // --- KPI cards (value <p> and label <p> are DOM siblings — read via imagesPage.getKpiValue) ---
        kpiLabelParagraph: (label) => page.locator('p').filter({ hasText: new RegExp(`^${label}$`) }).first(),

        // --- Grid ---
        treegrid: page
            .getByRole('treegrid')
            .or(page.locator('[role="treegrid"]'))
            .or(page.locator('[role="grid"]'))
            .or(page.locator('main [role="treegrid"], main [role="grid"]')),
        imageRowByName: (name) =>
            page
                .getByRole('row')
                .filter({ hasText: name })
                .or(page.locator('[role="row"]').filter({ hasText: name }))
                .or(page.locator('[role="row"]').filter({ has: page.getByText(name, { exact: true }) })),
        thumbnailImgForRow: (row) =>
            row
                .getByRole('img', { name: 'Thumbnail' })
                .or(row.locator('img[alt="Thumbnail"]'))
                .or(row.locator('img'))
                .or(row.locator('[role="img"]')),
        // MCP-verified live (2026-08-14): the download button carries no accessible name/testid,
        // only a `lucide-download` icon — so it's matched by icon class, not by role name/text
        // like most other locators in this file (those techniques don't apply to this control).
        downloadImageButtonForRow: (row) =>
            row
                .locator('button:has(svg.lucide-download)')
                .or(row.locator('button').filter({ has: row.locator('svg.lucide-download') }))
                .or(row.locator('button:not([aria-label="Delete Image"])').first())
                .or(row.locator('button').first()),
        // MCP-verified live (2026-08-14): real attrs on this button are aria-label="Delete Image",
        // title="Delete Image", and a `lucide-trash-2` icon (no data-testid).
        deleteImageButtonForRow: (row) =>
            row
                .getByRole('button', { name: 'Delete Image' })
                .or(row.locator('button[aria-label="Delete Image"]'))
                .or(row.locator('button[title="Delete Image"]'))
                .or(row.locator('button:has(svg.lucide-trash-2)')),

        // --- Upload dialog (shared Uploadcare widget — same third-party component already
        // proven via PropertiesHelper.uploadPropertyDocument() in pages/properties.js) ---
        uploadDialog: page.locator('dialog[open]').or(page.locator('dialog[open="true"]')).or(page.locator('[role="dialog"][open]')),
        fromDeviceButton: page
            .getByRole('button', { name: 'From device' })
            .or(page.locator('button:has-text("From device")'))
            .or(page.locator('[role="listitem"] button:has-text("From device")')),
        uploadListDialog: page.locator('dialog[open] uc-upload-list').or(page.locator('uc-upload-list')),
        doneButton: page
            .getByRole('button', { name: 'Done', exact: true })
            .or(page.locator('button:has-text("Done")'))
            .or(page.locator('dialog[open] button:has-text("Done")')),
        addTagsModalHeading: page
            .getByRole('heading', { name: 'Add Tags & Types' })
            .or(page.getByText('Add Tags & Types', { exact: true })),
        addFilesButton: page
            .getByRole('button', { name: 'Add Files', exact: true })
            .or(page.locator('button:has-text("Add Files")'))
            .or(page.locator('dialog[open] button:has-text("Add Files")')),

        // --- Delete Image confirmation dialog ---
        deleteImageConfirmDialog: page
            .getByRole('dialog', { name: 'Delete Image' })
            .or(page.getByRole('dialog').filter({ has: page.getByText('Delete Image', { exact: true }) }))
            .or(page.locator('[role="dialog"]').filter({ hasText: 'Are you sure you want to delete this image' })),
        deleteConfirmButton: page
            .getByRole('button', { name: 'Delete', exact: true })
            .or(page.locator('[role="dialog"] button:has-text("Delete")').last())
            .or(page.locator('[role="dialog"] button[type="submit"]')),

        // --- Image preview dialog (opened by clicking the Cover thumbnail) ---
        imagePreviewDialogByFileName: (fileName) =>
            page
                .getByRole('dialog')
                .filter({ has: page.getByRole('heading', { name: fileName, exact: true }) })
                .or(page.locator('[role="dialog"]').filter({ hasText: fileName })),

        // --- Filter panel ---
        filterPropertySection: page
            .getByText('Property', { exact: true })
            .or(page.locator('label:has-text("Property")'))
            .or(page.locator('div:has-text("Property")').last())
            .first(),
        filterProjectSection: page
            .getByText('Project', { exact: true })
            .or(page.locator('label:has-text("Project")'))
            .first(),
        filterTagsSection: page
            .getByText('Tags', { exact: true })
            .or(page.locator('label:has-text("Tags")'))
            .first(),

        // --- Save View popover (View button) ---
        saveViewHeading: page
            .getByText('Save current view as', { exact: true })
            .or(page.locator('text=Save current view as')),
        saveViewNameInput: page
            .getByRole('textbox', { name: 'Enter a view name' })
            .or(page.getByPlaceholder('Enter a view name'))
            .or(page.locator('input[placeholder*="view name" i]')),
    };
}

module.exports = { imagesLocators };
