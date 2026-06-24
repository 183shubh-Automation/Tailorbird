function capexColPersistenceLocators(page) {
    return {
        // Manage Columns drawer (dialog role)
        manageColumnsDialog: page
            .locator('[role="dialog"]')
            .filter({ hasText: 'Manage Columns' })
            .first(),

        // All column headers in the revo-grid
        columnHeaders: page.locator('[role="columnheader"]'),

        // Table toolbar button that opens the column-management dropdown
        tableToolbarBtn: page.getByRole('button', { name: 'Table' }),

        // "Hide / show columns" menu item inside the Table dropdown
        hideShowColumnsMenuItem: page.locator('button').filter({ hasText: 'Hide / show columns' }).first(),
    };
}

module.exports = { capexColPersistenceLocators };
