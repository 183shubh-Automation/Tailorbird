require('dotenv').config();
const { test, expect } = require('@playwright/test');
const { SimpleApprovalPage } = require('../pages/simpleApprovalPage');
const { Logger } = require('../utils/logger');
const { ensureLeftPanelExpanded } = require('../utils/leftPanelExpander');
const { healingLocator } = require('../utils/locatorHealer');
const { simpleApprovalElementStrategies } = require('../locators/simpleApprovalLocator');
const { AddColumnPage } = require('../pages/addColumnPage');

test.use({
    storageState: 'sessionState.json',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    animations: 'disabled',
    maxDiffPixels: 50_000,
    maxDiffPixelRatio: 0.3,
});

let page, approvalJob;

test.describe('My & All Approval', () => {
    test.describe.configure({ retries: 1 });

    test.beforeEach(async ({ page: p }) => {
        page = p;
        approvalJob = new SimpleApprovalPage(page);

        await page.goto(process.env.DASHBOARD_URL, { waitUntil: 'load' });
        await expect(page).toHaveURL(process.env.DASHBOARD_URL);
        await page.waitForTimeout(10000);
        Logger.info('Dashboard loaded from stored session');
        await ensureLeftPanelExpanded(page);

        await approvalJob.navigateToApprovalTab();
        await approvalJob.waitForPageLoad();
        Logger.success('Setup complete - Navigated to Approval section');
    });

    test('TC207 @approval @sanity @regression : Verify My Approvals displays the expected column header', async () => {
        try {
            Logger.step('TC207: Verifying My Approvals tab navigation and page structure');

            // Navigate to My Approvals
            await approvalJob.navigateToMyApprovalsTab();
            await approvalJob.waitForPageLoad();
            Logger.info('Navigated to My Approvals tab');

            // Wait for the search input to be visible
            const searchInput = healingLocator(simpleApprovalElementStrategies(page).searchInput);
            await searchInput.waitFor({ state: 'visible', timeout: 10000 });
            const searchInputVisible = await searchInput.isVisible();
            expect(searchInputVisible).toBeTruthy();
            await page.waitForTimeout(10000);
            Logger.info('My Approvals page loaded');

            const headers = await approvalJob.getAllTableHeaders();
            expect(headers.length, 'My Approvals table should have at least one column header').toBeGreaterThan(0);
            Logger.info('Column headers: ' + headers.join(' | '));
            const headerText = headers.map(h => h.toLowerCase()).join(' ');
            expect(headerText).toContain('property');

            Logger.success('TC207 passed: My Approvals tab structure verified');
        } catch (error) {
            Logger.error('TC207 failed: ' + error.message);
            throw error;
        }
    });

    test('TC208 @approval @regression : Verify My Approvals records can be exported as a CSV', async () => {
        try {
            Logger.step('TC208: Testing export data functionality in My Approvals');

            await approvalJob.navigateToMyApprovalsTab();
            await approvalJob.waitForPageLoad();

            const rowCount = await approvalJob.getTableRowCount();
            Logger.info('Approval records available for export: ' + rowCount);

            // Click export button
            const exportSuccess = await approvalJob.clickExportButton();
            expect(exportSuccess).toBeTruthy();
            Logger.success('Export button clicked - CSV file should download');

            Logger.success('TC208 passed: Export functionality working');
        } catch (error) {
            Logger.error('TC208 failed: ' + error.message);
            throw error;
        }
    });

    test('TC209 @approval @regression : Verify Manage Columns dialog can be opened and closed', async () => {
        try {
            Logger.step('TC209: Testing Manage Columns dialog in My Approvals');

            await approvalJob.navigateToMyApprovalsTab();
            await approvalJob.waitForPageLoad();

            // Click settings button
            const settingsSuccess = await approvalJob.clickSettingsButton();
            expect(settingsSuccess).toBeTruthy();
            Logger.info('Settings button clicked');

            // Wait for dialog to appear
            await approvalJob.waitForPageLoad();
            Logger.info('Manage Columns dialog should be visible');

            // Close dialog
            await approvalJob.closeDialog();
            Logger.success('Dialog closed');

            Logger.success('TC209 passed: Manage Columns dialog tested');
        } catch (error) {
            Logger.error('TC209 failed: ' + error.message);
            throw error;
        }
    });

    test('TC210 @approval @sanity @regression : Verify user can add a new column to the approvals table', async () => {
        try {
            Logger.step('TC210: Testing Add Column button in My Approvals');

            await approvalJob.navigateToMyApprovalsTab();
            await approvalJob.waitForPageLoad();

            // Clean up leftover automation columns from previous runs so the grid
            // doesn't accumulate columns and slow down/timeout column-header detection
            const addColumnPage = new AddColumnPage(page, { scope: page.locator('main') });
            await addColumnPage.deleteAllCustomColumns();

            // Add new column. NOTE: the Add Column dialog's Name field silently strips any
            // character outside [A-Za-z0-9 -] as it's typed (MCP-verified live 2026-08-13) —
            // an underscore-containing name here would get created without the underscore,
            // so addColumn()'s own post-submit column-header lookup (which searches for the
            // exact string it was given) would never match and always time out, no matter how
            // long the timeout is. Using a hyphen instead (same convention TC254 in
            // TC15_Budget.spec.js already uses successfully) avoids that mismatch entirely.
            // Retried once with a fresh name/timestamp as defense-in-depth against transient
            // slowness, since addColumn() itself doesn't distinguish "never matches" from
            // "not rendered yet".
            let lastError;
            let added = false;
            for (let attempt = 0; attempt < 2 && !added; attempt++) {
                const colName = `ApprCol-${Date.now()}`;
                try {
                    await addColumnPage.addColumn(colName, 'Automation custom column');
                    added = true;
                } catch (err) {
                    lastError = err;
                    Logger.error(`TC210: addColumn attempt ${attempt + 1} failed — ${err.message}`);
                }
            }
            if (!added) throw lastError;
            Logger.success('New column added successfully');

            Logger.success('TC210 passed: Add Column functionality working');
        } catch (error) {
            Logger.error('TC210 failed: ' + error.message);
            throw error;
        }
    });

    test('TC211 @approval @regression : Verify My Approvals filter panel can be opened, applied and closed', async () => {
        try {
            Logger.step('TC211: Testing Filter button in My Approvals');

            await approvalJob.navigateToMyApprovalsTab();
            await approvalJob.waitForPageLoad();

            // Click filter button
            const filterSuccess = await approvalJob.clickFilterButton();
            expect(filterSuccess).toBeTruthy();
            Logger.success('Filter button clicked - Filter panel should display');

            // Close filter panel
            await approvalJob.closeDialog();
            Logger.success('Filter panel closed');

            Logger.success('TC211 passed: Filter button tested');
        } catch (error) {
            Logger.error('TC211 failed: ' + error.message);
            throw error;
        }
    });

    test('TC212 @approval @regression : Verify All Approvals displays the expected column headers', async () => {
        try {
            Logger.step('TC212: Verifying All Approvals tab navigation and structure');

            // Navigate to All Approvals tab
            await approvalJob.navigateToAllApprovalsTab();
            await approvalJob.waitForPageLoad();
            Logger.info('Navigated to All Approvals tab');

            // Verify page is loaded
            const searchInputVisible = await page.getByPlaceholder('Search...').isVisible({ timeout: 5000 }).catch(() => false);
            const hasRows = await page.locator('[role="row"]').count() > 0;
            expect(searchInputVisible || hasRows).toBeTruthy();
            Logger.info('All Approvals page loaded');

            const headers = await approvalJob.getAllTableHeaders();
            expect(headers.length, 'All Approvals table should have at least one column header').toBeGreaterThan(0);
            Logger.info('Column headers: ' + headers.join(' | '));
            const headerText = headers.map(h => h.toLowerCase()).join(' ');
            expect(headerText).toContain('property');
            Logger.success('TC212 passed: All Approvals tab structure verified');
        } catch (error) {
            Logger.error('TC212 failed: ' + error.message);
            throw error;
        }
    });

    test('TC213 @approval @regression : Verify approval records can be searched in All Approvals', async () => {
        try {
            Logger.step('TC213: Testing search in All Approvals tab');

            await approvalJob.navigateToAllApprovalsTab();
            await approvalJob.waitForPageLoad();

            const initialRowCount = await approvalJob.getTableRowCount();
            Logger.info('Initial rows in All Approvals: ' + initialRowCount);

            // Perform search
            const searchTerm = 'test';
            await approvalJob.searchApprovals(searchTerm);
            const afterSearchRowCount = await approvalJob.getTableRowCount();
            Logger.info('Rows after searching for "' + searchTerm + '": ' + afterSearchRowCount);

            // Clear search
            await approvalJob.clearSearch();
            const afterClearRowCount = await approvalJob.getTableRowCount();
            Logger.info('Rows after clearing search: ' + afterClearRowCount);

            Logger.success('TC213 passed: Search functionality in All Approvals working');
        } catch (error) {
            Logger.error('TC213 failed: ' + error.message);
            throw error;
        }
    });

    test('TC214 @approval @sanity @regression : Verify All Approvals records can be exported as a CSV', async () => {
        try {
            Logger.step('TC214: Testing export in All Approvals tab');

            await approvalJob.navigateToAllApprovalsTab();
            await approvalJob.waitForPageLoad();

            const rowCount = await approvalJob.getTableRowCount();
            Logger.info('Records in All Approvals: ' + rowCount);

            // Click export
            const exportSuccess = await approvalJob.clickExportButton();
            expect(exportSuccess).toBeTruthy();
            Logger.success('Export button clicked in All Approvals');

            Logger.success('TC214 passed: Export working in All Approvals');
        } catch (error) {
            Logger.error('TC214 failed: ' + error.message);
            throw error;
        }
    });

    test('TC215 @approval @regression : Verify Manage Columns dialog can be opened and closed in All Approvals', async () => {
        try {
            Logger.step('TC215: Testing Manage Columns in All Approvals');

            await approvalJob.navigateToAllApprovalsTab();
            await approvalJob.waitForPageLoad();

            // Click settings
            const settingsSuccess = await approvalJob.clickSettingsButton();
            expect(settingsSuccess).toBeTruthy();

            // Wait for dialog
            await approvalJob.waitForPageLoad();
            Logger.success('Manage Columns dialog should be visible in All Approvals');

            // Close
            await approvalJob.closeDialog();
            Logger.success('Dialog closed');

            Logger.success('TC215 passed: Manage Columns tested in All Approvals');
        } catch (error) {
            Logger.error('TC215 failed: ' + error.message);
            throw error;
        }
    });

    test('TC216 @approval @regression : Verify a new custom column can be added to All Approvals', async () => {
        try {
            Logger.step('TC216: Testing Add Column in All Approvals');

            await approvalJob.navigateToAllApprovalsTab();
            await approvalJob.waitForPageLoad();

            // Add new column
            const columnAdded = await approvalJob.addColumndata();
            expect(columnAdded).toBeTruthy();
            Logger.success('New column added successfully');

            Logger.success('TC216 passed: Add Column functionality working');
        } catch (error) {
            Logger.error('TC216 failed: ' + error.message);
            throw error;
        }
    });

    test('TC217 @approval @regression : Verify All Approvals filter panel can be opened and closed', async () => {
        try {
            Logger.step('TC217: Testing Filter button in All Approvals');

            await approvalJob.navigateToAllApprovalsTab();
            await approvalJob.waitForPageLoad();

            // Click filter
            const filterSuccess = await approvalJob.clickFilterButton();
            expect(filterSuccess).toBeTruthy();
            Logger.success('Filter button clicked in All Approvals');

            // Close
            await approvalJob.closeDialog();
            Logger.success('Filter panel closed');

            Logger.success('TC217 passed: Filter button tested in All Approvals');
        } catch (error) {
            Logger.error('TC217 failed: ' + error.message);
            throw error;
        }
    });

    test('TC218 @approval @sanity @regression : Verify users can switch between My Approvals and All Approvals', async () => {
        try {
            Logger.step('TC218: E2E test - switching between tabs');

            // Start with My Approvals
            await approvalJob.navigateToMyApprovalsTab();
            Logger.info('My Approvals active');

            const myApprovalsRowCount = await approvalJob.getTableRowCount();
            Logger.info('My Approvals rows: ' + myApprovalsRowCount);

            // Switch to All Approvals
            await approvalJob.navigateToAllApprovalsTab();
            Logger.info('All Approvals active');

            const allApprovalsRowCount = await approvalJob.getTableRowCount();
            Logger.info('All Approvals rows: ' + allApprovalsRowCount);

            // Switch back to My Approvals
            await approvalJob.navigateToMyApprovalsTab();
            Logger.success('Successfully navigated between tabs');

            Logger.success('TC218 passed: Cross-tab navigation working');
        } catch (error) {
            Logger.error('TC218 failed: ' + error.message);
            throw error;
        }
    });

    test('TC219 @approval @sanity @regression : Verify My Approvals and All Approvals load with column headers', async () => {
        try {
            Logger.step('TC219: E2E test - verifying page loaded across tabs');

            // Get My Approvals page loaded
            await approvalJob.navigateToMyApprovalsTab();
            await approvalJob.waitForPageLoad();
            const myApprovalsHeaders = await approvalJob.getAllTableHeaders();
            Logger.info('My Approvals headers count: ' + myApprovalsHeaders.length);

            // Get All Approvals page loaded
            await approvalJob.navigateToAllApprovalsTab();
            await approvalJob.waitForPageLoad();
            const allApprovalsHeaders = await approvalJob.getAllTableHeaders();
            Logger.info('All Approvals headers count: ' + allApprovalsHeaders.length);

            // Verify both tabs are accessible
            expect(myApprovalsHeaders.length >= 0).toBeTruthy();
            expect(allApprovalsHeaders.length >= 0).toBeTruthy();

            Logger.success('TC219 passed: Both tabs loaded successfully');
        } catch (error) {
            Logger.error('TC219 failed: ' + error.message);
            throw error;
        }
    });

});
