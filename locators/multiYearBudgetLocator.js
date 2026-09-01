function multiYearBudgetLocators(page) {
    return {
        // --- Navigation ---
        multiYearBudgetNavLink: page.locator('nav').locator('a, div').filter({ hasText: 'Multi-Year Budget' }).first(),
        // The breadcrumb's property-switcher button is consistently the first button
        // rendered under <main> (MCP-verified), both before ("Select a Property") and
        // after a property is chosen — its internal markup differs between those two
        // states (only the post-selection state wraps the label in a <p>), so matching
        // by DOM position here is more robust than filtering on internal markup.
        propertySwitcherButton: page.locator('main').getByRole('button').first(),
        propertyMenuItems: page.getByRole('menuitem'),
        propertySearchBox: page.getByRole('textbox', { name: 'Search properties...' }),

        // --- Empty state (no plan yet for the selected property) ---
        createPlanHeading: page.getByText('Create Your Multi-Year Budget'),
        createPlanBtn: page.getByRole('button', { name: 'Create Multi-Year Budget' }),
        noPropertiesFoundText: page.getByText('No properties found'),

        // --- Empty state (plan created but zero budget items selected, MCP-verified live 2026-08-11) ---
        noDetailsHeading: page.getByText('No multi year budget details added yet'),
        noDetailsSubtext: page.getByText('Use + or Create Button to create one'),
        noItemsMatchSearchText: page.getByText('No items match your search.'),

        // --- Initialization dialog ---
        initDialog: page.getByRole('dialog', { name: 'Create Multi-Year Budget' }),
        holdPeriodStartYear: page.getByRole('textbox', { name: 'Hold Period Start Year' }),
        holdPeriodEndYear: page.getByRole('textbox', { name: 'Hold Period End Year' }),
        itemSearchBox: page.getByRole('textbox', { name: 'Search by category or item' }),
        // exact: true is required here — Playwright's default substring name match means
        // 'Select all' would otherwise also match the "Deselect all" button (MCP/CI-verified:
        // "Deselect all" contains "select all" as a literal substring), causing a strict-mode
        // violation the moment anything actually clicks it. Pre-existing locator, never
        // exercised by any test until this one, so the ambiguity had never surfaced before.
        selectAllItemsBtn: page.getByRole('button', { name: 'Select all', exact: true }),
        deselectAllItemsBtn: page.getByRole('button', { name: 'Deselect all', exact: true }),
        noItemsFoundText: page.getByText('No budget items found for this property.'),
        itemCheckbox: (labelPattern) => page.getByRole('checkbox', { name: labelPattern }),
        // Scoped to whichever dialog (Init or Settings — both share this same item-list markup)
        // is currently open, rather than an unscoped page-wide role query, so this can never
        // accidentally pick up an unrelated checkbox elsewhere on the page.
        allItemCheckboxes: page.getByRole('dialog').getByRole('checkbox'),
        initCancelBtn: page.getByRole('dialog', { name: 'Create Multi-Year Budget' }).getByRole('button', { name: 'Cancel' }),
        initSubmitBtn: page.getByRole('dialog', { name: 'Create Multi-Year Budget' }).getByRole('button', { name: 'Create Multi-Year Budget' }),

        // --- Plan table view ---
        treegrid: page.locator('[role="treegrid"]'),
        categoryColumnHeader: page.getByRole('columnheader', { name: 'Category' }),
        budgetItemColumnHeader: page.getByRole('columnheader', { name: 'Budget Item' }),
        plannedBudgetColumnHeaders: page.getByRole('columnheader', { name: 'Planned Budget' }),
        currentBudgetColumnHeaders: page.getByRole('columnheader', { name: 'Current Budget' }),
        varianceColumnHeaders: page.getByRole('columnheader', { name: 'Variance' }),
        totalRow: page.locator('[role="row"]').filter({ hasText: 'Total' }),
        itemRow: (itemName) => page.locator('[role="row"]').filter({ hasText: itemName }),
        yearGroupHeader: (year) => page.getByText(String(year), { exact: true }),

        // --- Toolbar icon buttons (no accessible names in this app; identified by their
        // stable lucide icon class, MCP-verified live: lucide-upload / lucide-plus /
        // lucide-download / lucide-rotate-ccw / lucide-settings / lucide-history) ---
        uploadCsvBtn: page.locator('button:has(svg.lucide-upload)').first(),
        addBudgetItemBtn: page.locator('button:has(svg.lucide-plus)').first(),
        exportCsvBtn: page.locator('button:has(svg.lucide-download)').first(),
        resetBudgetBtn: page.locator('button:has(svg.lucide-rotate-ccw)').first(),
        settingsBtn: page.locator('button:has(svg.lucide-settings)').first(),
        historyBtn: page.locator('button:has(svg.lucide-history)').first(),

        // --- "Edit planned budget" dialog (opened by double-clicking a Planned Budget cell) ---
        editPlannedBudgetDialog: page.getByRole('dialog', { name: 'Edit planned budget' }),
        reallocateRadio: page.getByRole('radio', { name: 'Reallocate' }),
        setAmountRadio: page.getByRole('radio', { name: 'Set amount' }),
        reallocateFromInput: page.getByRole('textbox', { name: 'Reallocate from' }),
        reallocateFromOption: (labelPattern) => page.getByRole('option', { name: labelPattern }),
        reallocateFromOptionsList: page.getByRole('listbox', { name: 'Reallocate from' }).getByRole('option'),
        amountToReallocateInput: page.getByRole('textbox', { name: 'Amount to reallocate' }),
        plannedBudgetAmountInput: page.getByRole('textbox', { name: 'Planned budget' }),
        editReasonInput: page.getByRole('textbox', { name: 'Reason' }),
        editSaveBtn: page.getByRole('dialog', { name: 'Edit planned budget' }).getByRole('button', { name: 'Save' }),
        editCancelBtn: page.getByRole('dialog', { name: 'Edit planned budget' }).getByRole('button', { name: 'Cancel' }),

        // --- Upload CSV dialog ---
        uploadCsvDialog: page.getByRole('dialog', { name: 'Upload CSV' }),
        downloadTemplateBtn: page.getByRole('button', { name: 'Download Template CSV' }),
        // The widget is Uploadcare (third-party file picker); "From device" opens the native
        // file chooser, which Playwright intercepts via the 'filechooser' event (MCP-verified).
        uploadCsvFromDeviceBtn: page.getByRole('button', { name: 'From device' }),
        uploadCsvDoneBtn: page.getByRole('dialog', { name: 'Upload CSV' }).getByRole('button', { name: 'Done' }),
        csvErrorsAlert: page.getByRole('alert', { name: 'Errors' }),
        csvImportCompletedAlert: page.getByRole('alert', { name: 'Import completed' }),
        csvBudgetItemsCreatedAlert: page.getByRole('alert', { name: 'Budget items created' }),

        // --- Reset budget dialog ---
        resetBudgetDialog: page.getByRole('dialog', { name: 'Reset budget' }),
        downloadTableBtn: page.getByRole('button', { name: 'Download table' }),
        resetConfirmBtn: page.getByRole('dialog', { name: 'Reset budget' }).getByRole('button', { name: 'Reset' }),
        resetCancelBtn: page.getByRole('dialog', { name: 'Reset budget' }).getByRole('button', { name: 'Cancel' }),

        // --- Settings dialog ---
        settingsDialog: page.getByRole('dialog', { name: 'Settings' }),
        settingsApplyBtn: page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'Apply' }),
        settingsCancelBtn: page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'Cancel' }),
        totalCapitalEnvelopeField: page.getByText(/Total Capital Envelope/i),

        // --- Multi-year budget history dialog ---
        historyDialog: page.getByRole('dialog', { name: 'Multi-year budget history' }),
    };
}

module.exports = { multiYearBudgetLocators };
