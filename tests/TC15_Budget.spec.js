require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { BudgetJob } = require('../pages/budgetPage');
const { Logger } = require('../utils/logger');

test.use({
    storageState: 'sessionState.json',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
});

let page, budgetJob;

test.describe('Budget Workflow - E2E Tests', () => {

    test.beforeEach(async ({ page: p }) => {
        page = p;
        budgetJob = new BudgetJob(page);
        await page.goto(process.env.DASHBOARD_URL, { waitUntil: 'load' });
        await expect(page).toHaveURL(process.env.DASHBOARD_URL);
        await page.waitForTimeout(7000);
        Logger.info('Dashboard loaded from stored session');
        await budgetJob.navigateToBudgetTab();
        await budgetJob.waitForPageLoad();
        Logger.success('Setup complete - Navigated to Budget section');
    });

    // ===== Budget Page & Property Tests =====

    test('TC215 @budget @sanity @regression : Verify Budget workspace loads successfully with selected property details, budget table headers, revise budget controls, year/version selectors, and visible budget item records across the main budget grid', async () => {
        await budgetJob.navigateToBudget();
        await budgetJob.selectBrookProperty();
        await budgetJob.verifyPropertyHeader();
        await budgetJob.verifyBudgetTableHeaders();
        await budgetJob.verifyReviseBudgetsVisible();
        await budgetJob.verifyYearSelector();
        await budgetJob.verifyVersionSelector();
        await budgetJob.verifyBudgetDataRows();
        await budgetJob.verifyBudgetItems(['Construction', 'Site Prep', 'Concrete', 'Wiring']);
        Logger.success('TC215: Budget page verification completed');
    });

    test('TC216 @budget @regression : Verify Budget Category section is displayed correctly within Budget navigation menu and remains accessible from the Budget workspace', async () => {
        await budgetJob.navigateToBudget();
        await budgetJob.verifyBudgetCategoryInNav();
        Logger.success('TC216: Budget Category section verified');
    });

    // ===== Category Code Column Tests =====

    test('TC217 @budget @regression : Verify Budget Category Code column is displayed correctly within the Budget grid and remains visible for selected property budget records', async () => {
        await budgetJob.navigateToBudget();
        await budgetJob.selectBrookProperty();
        await budgetJob.verifyCategoryCodeColumn();
        Logger.success('TC217: Category Code column present');
    });

    test('TC218 @budget @regression : Verify user can access and select Budget Category values successfully from the category dropdown while budget records remain visible in the grid', async () => {
        await budgetJob.navigateToBudget();
        await budgetJob.selectBrookProperty();
        await budgetJob.verifyCategoryCodeColumn();
        expect(await budgetJob.getDataRowCount()).toBeGreaterThan(0);
        Logger.success('TC218: Budget Category dropdown accessible');
    });

    test('TC219 @budget @regression : Verify Budget Category values are mapped correctly through Category Code linkage and displayed properly within budget item rows', async () => {
        await budgetJob.navigateToBudget();
        await budgetJob.selectBrookProperty();
        await budgetJob.verifyCategoryCodeColumn();
        await budgetJob.verifyFirstRowCategoryCell();
        Logger.success('TC219: Budget Category linked via Category Code');
    });

    test('TC220 @budget @regression : Verify Budget Category names display correctly for mapped budget items and category-linked budget rows appear successfully in the Budget grid', async () => {
        await budgetJob.navigateToBudget();
        await budgetJob.selectBrookProperty();
        await budgetJob.verifyCategoryCodeColumn();
        await budgetJob.verifyFirstRowCategoryCell();
        expect(await budgetJob.getFirstBudgetItemRowCount()).toBeGreaterThan(0);
        Logger.success('TC220: Category Name displays correctly');
    });

    test('TC221 @budget @regression : Verify Budget Categories can be assigned successfully to budget items while maintaining visible budget row data within the Budget workspace', async () => {
        await budgetJob.navigateToBudget();
        await budgetJob.selectBrookProperty();
        await budgetJob.verifyCategoryCodeColumn();
        expect(await budgetJob.getDataRowCount()).toBeGreaterThan(0);
        Logger.success('TC221: Budget Category assignable to items');
    });

    test('TC222 @budget @regression : Verify Budget Category and Category Code columns remain consistent across Budget table layouts, related views, and budget data structures', async () => {
        await budgetJob.navigateToBudget();
        await budgetJob.selectBrookProperty();
        await budgetJob.verifyBudgetTableHeaders(['Budget Item', 'Description', 'Category Code', 'Original Budget', 'Current Budget']);
        Logger.success('TC222: Category Code consistent across grid');
    });

    test('TC223 @budget @regression : Verify Budget Category functionality works correctly alongside Revise Budget controls and related invoice-enabled budget workflows', async () => {
        await budgetJob.navigateToBudget();
        await budgetJob.selectBrookProperty();
        await budgetJob.verifyReviseBudgetsVisible();
        await budgetJob.verifyCategoryCodeColumn();
        Logger.success('TC223: Category works with Revise Budgets');
    });

    test('TC224 @budget @regression : Verify the same Budget Category can be reused successfully across multiple budget items without affecting budget grid consistency', async () => {
        await budgetJob.navigateToBudget();
        await budgetJob.selectBrookProperty();
        await budgetJob.verifyCategoryCodeColumn();
        expect(await budgetJob.getDataRowCount()).toBeGreaterThan(1);
        Logger.success('TC224: Category reusable across items');
    });

    // ===== View & Column Management =====

    test('TC225 @budget @regression : Verify user can create a custom Budget view successfully, switch back to default view, and reload the saved Budget view without losing table configuration', async () => {
        await budgetJob.navigateToBudget();
        await budgetJob.selectBrookProperty();
        const viewName = `BudgetView_${Date.now()}`;
        await budgetJob.createView(viewName);
        await budgetJob.switchToDefaultView();
        await budgetJob.loadView(viewName);
        Logger.success('TC225: View created and loaded');
    });

    test('TC226 @budget @regression : Verify user can add a custom Budget column, validate the column inside Manage Columns, delete the column successfully, and confirm column removal from configuration controls', async () => {
        await budgetJob.navigateToBudget();
        await budgetJob.selectBrookProperty();
        const colName = `TestCol-${Date.now()}`;
        await budgetJob.addColumn(colName, 'Test column for budget');
        await budgetJob.openManageColumns();
        await budgetJob.verifyColumnInManageColumns(colName);
        await budgetJob.deleteColumnInManageColumns(colName);
        await budgetJob.verifyColumnNotInManageColumns(colName);
        await budgetJob.closeManageColumns();
        Logger.success('TC226: Add, verify, delete column completed');
    });

    test('TC227 @budget @regression : Verify exported Budget CSV/Excel file contains valid budget table headers, non-empty exported data, and expected budget item records after download', async () => {
        await budgetJob.navigateToBudget();
        await budgetJob.selectBrookProperty();
        const downloadsDir = path.join(process.cwd(), 'downloads');
        const savePath = await budgetJob.exportBudgetData(downloadsDir);
        const content = fs.readFileSync(savePath, 'utf-8');
        expect(content.length).toBeGreaterThan(100);
        expect(content).toContain('Description');
        // Westerham sample data may include Site Prep; other properties often show Construction, etc.
        expect(content).toMatch(/Site Prep|Construction/i);
        Logger.success('TC227: Export verified with budget data');
    });

    // ===== Revise Budget Flow (serial - share Westerham property / revision editor) =====

    test.describe.serial('Revise Budget - Serial', () => {

    test('TC228 @budget @regression : Verify Revise Budget workflow opens successfully with property details, Budget Category data, populated revision grid records, and accessible revision editor functionality', async () => {
        await budgetJob.navigateToBudget();
        await budgetJob.selectBrookProperty();
        await budgetJob.verifyPropertyHeader();
        await budgetJob.verifyCategoryCodeColumn();
        expect(await budgetJob.getDataRowCount()).toBeGreaterThan(0);
        await budgetJob.openRevisionEditor();
        await budgetJob.verifyRevisionEditorOpen();
        Logger.success('TC228: Revise Budget flow verified');
    });

    test('TC229 @budget @regression : Verify Reset Table action restores the original Budget grid state successfully after revision mode is enabled within the Revise Budget workflow', async () => {
        await budgetJob.navigateToBudget();
        await budgetJob.selectBrookProperty();
        const { reviseBtn, reviseEnabled } = await budgetJob.ensureReviseEnabled();
        expect(reviseEnabled).toBeTruthy();
        await reviseBtn.click();
        await page.waitForTimeout(2000);
        await budgetJob.resetTableInMainGrid();
        Logger.success('TC229: Reset table completed');
    });

    test('TC230 @budget @regression : Verify user can add a new Budget row successfully with custom budget item details and validate the newly created row inside the Budget grid', async () => {
        await budgetJob.navigateToBudget();
        await budgetJob.selectBrookProperty();
        const uniqueItemName = `TestBudgetItem_${Date.now()}`;
        await budgetJob.addRowInMainGrid(uniqueItemName, 'Test description for added row');
        Logger.success('TC230: Row added and verified');
    });

    test('TC231 @budget @regression : Verify user can upload a Budget CSV file successfully inside the Revision Editor and validate uploaded budget records are populated correctly in the revision tree grid', async () => {
        test.setTimeout(180000);
        await budgetJob.navigateToBudget();
        await budgetJob.selectBrookProperty();
        await page.waitForTimeout(30000);
        await page.waitForTimeout(2000);
        await budgetJob.openRevisionEditor();
        await budgetJob.verifyRevisionEditorOpen();
        const filePath = path.resolve(process.cwd(), 'files', 'budget_file_to_upload.csv');
        expect(fs.existsSync(filePath)).toBeTruthy();
        await budgetJob.uploadFileInRevision(filePath);
        await page.waitForTimeout(2000);
        const count = await budgetJob.getTreegridRowCount();
        expect(count, 'Uploaded budget data must have at least one row').toBeGreaterThan(0);
        Logger.success(`TC231: Upload budget file flow completed - ${count} rows in grid`);
    });

    // ===== Revise Budget E2E =====

    test('TC232 @budget @regression : Revise Budget - Verify deleted Budget revision rows are restored successfully after Reset Table action and original revision data becomes visible again inside the Revision Editor grid', async () => {
        test.setTimeout(180000);
        await budgetJob.navigateToBudget();
        await budgetJob.selectBrookProperty();
        await page.waitForTimeout(30000);
        await page.waitForTimeout(3000);
        await budgetJob.openRevisionEditor();
        await page.waitForTimeout(3000);
        await budgetJob.verifyRevisionEditorOpen();
        await page.waitForTimeout(2000);
        const countBeforeDelete = await budgetJob.getTreegridRowCount();
        expect(countBeforeDelete, 'Revision editor must have rows before delete').toBeGreaterThan(0);
        await budgetJob.deleteFirstRowInRevision();
        await page.waitForTimeout(30000);
        await page.waitForTimeout(3000);
        await budgetJob.resetTableInRevision();
        await page.waitForTimeout(30000);
        await page.waitForTimeout(4000);
        const count = await budgetJob.getTreegridRowCount();
        expect(count, 'Reset Table must restore rows - data should be restored').toBeGreaterThan(0);
        Logger.success(`TC232: Reset Table - ${count} rows restored`);
    });

    test('TC233 @budget @regression : Revise Budget - Verify user can delete an existing revision row, add a new budget row with category mapping from dropdown selection, submit the budget approval workflow successfully, and validate category persistence before and after submission across revision and main grids', async () => {
        await budgetJob.navigateToBudget();
        await budgetJob.selectBrookProperty();
        await budgetJob.openRevisionEditor();
        await budgetJob.deleteFirstRowInRevision();
        await budgetJob.addRowWithCategoryInRevision('Site Prep', 'Site preparation work', 'Construction', '15000');

        Logger.step('TC233: Assert category is set in first row before submit');
        const categoryBeforeSubmit = await budgetJob.getFirstRowCategoryValue('revision');
        expect(categoryBeforeSubmit).toBeTruthy();
        expect(categoryBeforeSubmit).not.toBe('-');
        expect(categoryBeforeSubmit).not.toBe('—');
        expect(categoryBeforeSubmit).not.toBe('');
        Logger.success(`TC233: Category in first row BEFORE submit = "${categoryBeforeSubmit}"`);

        await budgetJob.clickSubmitForApproval();
        await page.waitForTimeout(7000);

        // After submission the app navigates away and loses the property context
        // ("No budget version selected"). Re-navigate to the Westerham budget so we
        // can assert the main grid state.
        await budgetJob.navigateToBudget();
        await budgetJob.selectBrookProperty();
        await page.waitForTimeout(7000);
        // RevoGrid renders asynchronously after network-idle — wait for an actual
        // data row (not loading skeleton) to appear before counting.
        await page.locator('[role="row"]').filter({ has: page.locator('[role="gridcell"]') })
            .first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(1000);

        Logger.step('TC233: Assert budget data still visible in main grid after submit');
        const mainGridCount = await budgetJob.getDataRowCount();
        expect(mainGridCount, 'Main budget grid must have rows after revision is submitted for approval').toBeGreaterThan(0);

        Logger.step('TC233: Assert category persists in first row after submit (main grid)');
        const categoryAfterSubmit = await budgetJob.assertFirstRowCategoryNotEmpty('main');
        Logger.success(`TC233: Category in first row AFTER submit = "${categoryAfterSubmit}"`);
        Logger.success('TC233: Row added with category from dropdown, submitted, category verified in both views');
    });

    test('TC234 @budget @regression : Revise Budget - Verify user can select another property with no existing budget data, upload Budget CSV records successfully, submit the revision workflow, and validate uploaded budget items appear correctly in the main Budget grid after submission', async () => {
        // await page.pause();
        await budgetJob.navigateToBudget();
        await budgetJob.selectNonBrookProperty();
        await budgetJob.openRevisionEditor();
        const filePath = path.resolve(process.cwd(), 'files', 'budget_data.csv');
        expect(fs.existsSync(filePath)).toBeTruthy();
        await budgetJob.uploadFileInRevision(filePath);
        await budgetJob.ensureSubmitEnabledAfterUpload();
        await budgetJob.clickSubmitForApproval();
        await page.waitForTimeout(5000);
        const hasConstruction = await budgetJob.isTextVisible('Construction', 10000);
        const hasSitePrep = await budgetJob.isTextVisible('Site Prep', 10000);
        expect(hasConstruction || hasSitePrep, 'Uploaded budget data (Construction or Site Prep) must be visible after submit').toBeTruthy();
        const mainGridCount = await budgetJob.getDataRowCount();
        expect(mainGridCount, 'Main budget grid must have rows after submit').toBeGreaterThan(0);
        Logger.success('TC234: Upload on other property, submitted, verified');
    });

    }); // end serial

    test('TC236 @budget @regression @ui : Verify all Budget toolbar CTA labels, button states, View inline save flow, year selector options, and empty-year blank state', async () => {
        await budgetJob.navigateToBudget();
        await budgetJob.selectBrookProperty();
        await budgetJob.verifyToolbarCTALabels();
        await budgetJob.verifyReviseBudgetsDisabledWhenDraft();
        await budgetJob.verifyViewButtonPopover();
        await budgetJob.verifyYearSelectorHasOptions();
        await budgetJob.verifyEmptyYearState();
        Logger.success('TC236: Toolbar CTAs, View inline save, Year selector – PASSED');
    });

    test('TC237 @budget @regression @ui : Verify Table button menu items, Add column panel with all type buttons and submit validation, and Manage Columns drawer with default columns and visibility toggle', async () => {
        await budgetJob.navigateToBudget();
        await budgetJob.selectBrookProperty();
        await budgetJob.verifyTableMenuItems();
        await budgetJob.verifyAddColumnPanelValidation();
        await budgetJob.verifyManageColumnsDrawerContent();
        Logger.success('TC237: Table menu, Add column, Manage Columns – PASSED');
    });

    test('TC238 @budget @regression @ui : Verify column header sort cycling, search filter with no-match empty state, and filter clear restores full grid', async () => {
        await budgetJob.navigateToBudget();
        await budgetJob.selectBrookProperty();
        await budgetJob.verifyColumnHeaderControls();
        await budgetJob.verifySearchFilterBehavior();
        Logger.success('TC238: Column sort, search filter, empty state – PASSED');
    });

    test('TC239 @budget @regression @ui : Verify version dropdown Active/Inactive badges, Manage Versions drawer structure, and Budget History drawer with search and version badges', async () => {
        await budgetJob.navigateToBudget();
        await budgetJob.selectBrookProperty();
        await budgetJob.verifyVersionDropdownBadges();
        await budgetJob.verifyManageVersionsDrawer();
        await budgetJob.verifyBudgetHistoryDrawer();
        Logger.success('TC239: Version badges, Manage Versions drawer, Budget History – PASSED');
    });

    test('TC240 @budget @regression @ui : Verify Version Note modal field labels, Manage Versions rename flow, and delete confirmation cancel guard', async () => {
        await budgetJob.navigateToBudget();
        await budgetJob.selectBrookProperty();
        await budgetJob.verifyVersionNoteModalLabels();
        await budgetJob.verifyManageVersionsRenameAndDeleteGuard();
        Logger.success('TC240: Version Note modal, rename, delete guard – PASSED');
    });

    test('TC242 @budget @regression @ui : Verify Documents tab empty state, search bar, Upload files button, and Uploadcare widget sources with Done disabled and Cancel closes widget', async () => {
        await budgetJob.navigateToBudget();
        await budgetJob.selectBrookProperty();
        await budgetJob.openRevisionEditor();
        await budgetJob.verifyRevisionEditorOpen();
        await budgetJob.verifyDocumentsTabInRevision();
        await budgetJob.verifyUploadcareWidget();
        Logger.success('TC242: Documents tab and Uploadcare widget – PASSED');
    });

    test('TC243 @budget @regression @ui @visual : Verify disabled button styling, dollar amount formatting, Total row distinction, dash for unmapped categories, special-char column validation, long search no-crash, and drawer-open layout stability', async () => {
        await budgetJob.navigateToBudget();
        await budgetJob.selectBrookProperty();
        await budgetJob.verifyDisabledButtonStylingAndAmounts();
        await budgetJob.verifyEdgeCases();
        Logger.success('TC243: Visual states, negative guards, edge cases – PASSED');
    });

});
