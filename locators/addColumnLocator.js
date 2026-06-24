/** Column types in Add column picker order (index 0 = Text, 1 = Number, …). */
const ADD_COLUMN_TYPES = [
    'Text',
    'Number',
    'Select',
    'Multi-select',
    'Date',
    'Checkbox',
    'URL',
    'Email',
    'Phone',
    'Currency',
    'Thumbnail',
    'Attachments',
    'User',
];

function addColumnLocators(page) {
    const columnTypeGrid = page
        .locator('div[style*="grid-template-columns"]')
        .filter({ has: page.locator('button[data-with-left-section="true"]') })
        .first();

    return {
        tableMenuBtn: (scope = page) => scope.getByTestId('bt-table-action'),
        addColumnMenuItem: page.getByTestId('bt-table-action-add-column'),
        hideShowColumnsMenuItem: page.getByTestId('bt-table-action-hide-show-columns'),

        columnNameInput: page
            .getByRole('textbox', { name: /Enter column name/i })
            .or(page.getByPlaceholder(/Enter column name/i))
            .first(),
        columnDescInput: page
            .getByRole('textbox', { name: /Enter column description/i })
            .or(page.getByPlaceholder(/Enter column description/i))
            .first(),
        columnTypeGrid,
        addColumnSubmitBtn: page.getByRole('button', { name: /^Add column$/i }).last(),

        selectOptionInput: page
            .getByPlaceholder(/Add option|Enter option|Option name|Type and press enter/i)
            .first(),

        columnHeader: (name) =>
            page.locator('[role="columnheader"]').filter({ hasText: name }).first(),
        manageColumnsDialog: page.getByRole('dialog', { name: 'Manage Columns' }),

        deleteConfirmBtn: page.locator('.mantine-Popover-dropdown:visible').getByRole('button', { name: 'Delete', exact: true }),
    };
}

module.exports = { addColumnLocators, ADD_COLUMN_TYPES };
