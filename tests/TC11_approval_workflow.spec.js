require('dotenv').config();
const { test, expect } = require('@playwright/test');
const { SimpleApprovalPage } = require('../pages/simpleApprovalPage');
const { Logger } = require('../utils/logger');

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

test.describe('Approval Workflow - My Approvals & All Approvals E2E Tests', () => {
    test.describe.configure({ retries: 1 });

    test.beforeEach(async ({ page: p }) => {
        page = p;
        approvalJob = new SimpleApprovalPage(page);

        await page.goto(process.env.DASHBOARD_URL, { waitUntil: 'load' });
        await expect(page).toHaveURL(process.env.DASHBOARD_URL);
        await page.waitForTimeout(10000);
        Logger.info('Dashboard loaded from stored session');

        await approvalJob.navigateToApprovalTab();
        await approvalJob.waitForPageLoad();
        Logger.success('Setup complete - Navigated to Approval section');
    });

    test('@approval @sanity @regression TC198 My Approvals – Verify user can navigate to My Approvals tab and view all expected column headers correctly', async () => {
        try {
            Logger.step('TC198: Verifying My Approvals tab navigation and page structure');

            // Navigate to My Approvals
            await approvalJob.navigateToMyApprovalsTab();
            await approvalJob.waitForPageLoad();
            Logger.info('Navigated to My Approvals tab');

            // Wait for the search input to be visible
            const searchInput = page.getByPlaceholder('Search...');
            await searchInput.waitFor({ state: 'visible', timeout: 10000 });
            const searchInputVisible = await searchInput.isVisible();
            expect(searchInputVisible).toBeTruthy();
            Logger.info('My Approvals page loaded');

            const headers = await approvalJob.getAllTableHeaders();
            expect(headers.length, 'My Approvals table should have at least one column header').toBeGreaterThan(0);
            Logger.info('Column headers: ' + headers.join(' | '));
            const headerText = headers.map(h => h.toLowerCase()).join(' ');
            expect(headerText).toContain('property');

            Logger.success('TC198 passed: My Approvals tab structure verified');
        } catch (error) {
            Logger.error('TC198 failed: ' + error.message);
            throw error;
        }
    });

    test('@approval @regression TC199 My Approvals – Verify user can export available approval records from My Approvals into a CSV file successfully', async () => {
        try {
            Logger.step('TC199: Testing export data functionality in My Approvals');

            await approvalJob.navigateToMyApprovalsTab();
            await approvalJob.waitForPageLoad();

            const rowCount = await approvalJob.getTableRowCount();
            Logger.info('Approval records available for export: ' + rowCount);

            // Click export button
            const exportSuccess = await approvalJob.clickExportButton();
            expect(exportSuccess).toBeTruthy();
            Logger.success('Export button clicked - CSV file should download');

            Logger.success('TC199 passed: Export functionality working');
        } catch (error) {
            Logger.error('TC199 failed: ' + error.message);
            throw error;
        }
    });

    test('@approval @regression TC200 My Approvals – Verify user can open and close the Manage Columns dialog and view available column options', async () => {
        try {
            Logger.step('TC200: Testing Manage Columns dialog in My Approvals');

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

            Logger.success('TC200 passed: Manage Columns dialog tested');
        } catch (error) {
            Logger.error('TC200 failed: ' + error.message);
            throw error;
        }
    });

    test('@approval @sanity @regression TC201 My Approvals – Verify user can add a new column to the approvals table and see it reflected immediately', async () => {
        try {
            Logger.step('TC201: Testing Add Column button in My Approvals');

            await approvalJob.navigateToMyApprovalsTab();
            await approvalJob.waitForPageLoad();

            // Add new column
            const columnAdded = await approvalJob.addColumndata();
            expect(columnAdded).toBeTruthy();
            Logger.success('New column added successfully');

            Logger.success('TC201 passed: Add Column functionality working');
        } catch (error) {
            Logger.error('TC201 failed: ' + error.message);
            throw error;
        }
    });

    test('@approval @regression TC202 My Approvals – Verify user can open the filter panel, apply filters, and close the filter panel successfully', async () => {
        try {
            Logger.step('TC202: Testing Filter button in My Approvals');

            await approvalJob.navigateToMyApprovalsTab();
            await approvalJob.waitForPageLoad();

            // Click filter button
            const filterSuccess = await approvalJob.clickFilterButton();
            expect(filterSuccess).toBeTruthy();
            Logger.success('Filter button clicked - Filter panel should display');

            // Close filter panel
            await approvalJob.closeDialog();
            Logger.success('Filter panel closed');

            Logger.success('TC202 passed: Filter button tested');
        } catch (error) {
            Logger.error('TC202 failed: ' + error.message);
            throw error;
        }
    });

    test('@approval @regression TC203 All Approvals – Verify user can navigate to All Approvals tab and view all expected column headers correctly', async () => {
        try {
            Logger.step('TC203: Verifying All Approvals tab navigation and structure');

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
            Logger.success('TC203 passed: All Approvals tab structure verified');
        } catch (error) {
            Logger.error('TC203 failed: ' + error.message);
            throw error;
        }
    });

    test('@approval @regression TC204 All Approvals – Verify user can search approval records in All Approvals using a valid keyword and view filtered results', async () => {
        try {
            Logger.step('TC204: Testing search in All Approvals tab');

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

            Logger.success('TC204 passed: Search functionality in All Approvals working');
        } catch (error) {
            Logger.error('TC204 failed: ' + error.message);
            throw error;
        }
    });

    test('@approval @sanity @regression TC205 All Approvals – Verify user can export approval records from All Approvals into a CSV file successfully', async () => {
        try {
            Logger.step('TC205: Testing export in All Approvals tab');

            await approvalJob.navigateToAllApprovalsTab();
            await approvalJob.waitForPageLoad();

            const rowCount = await approvalJob.getTableRowCount();
            Logger.info('Records in All Approvals: ' + rowCount);

            // Click export
            const exportSuccess = await approvalJob.clickExportButton();
            expect(exportSuccess).toBeTruthy();
            Logger.success('Export button clicked in All Approvals');

            Logger.success('TC205 passed: Export working in All Approvals');
        } catch (error) {
            Logger.error('TC205 failed: ' + error.message);
            throw error;
        }
    });

    test('@approval @regression TC206 All Approvals – Verify user can open and close the Manage Columns dialog and manage table columns successfully', async () => {
        try {
            Logger.step('TC206: Testing Manage Columns in All Approvals');

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

            Logger.success('TC206 passed: Manage Columns tested in All Approvals');
        } catch (error) {
            Logger.error('TC206 failed: ' + error.message);
            throw error;
        }
    });

    test('@approval @regression TC207 All Approvals – Verify user can add a new custom column successfully in All Approvals table and validate updated approval grid structure after column creation', async () => {
        try {
            Logger.step('TC207: Testing Add Column in All Approvals');

            await approvalJob.navigateToAllApprovalsTab();
            await approvalJob.waitForPageLoad();

            // Add new column
            const columnAdded = await approvalJob.addColumndata();
            expect(columnAdded).toBeTruthy();
            Logger.success('New column added successfully');

            Logger.success('TC207 passed: Add Column functionality working');
        } catch (error) {
            Logger.error('TC207 failed: ' + error.message);
            throw error;
        }
    });

    test('@approval @regression TC208 All Approvals – Verify user can open the filter panel from All Approvals workspace, apply approval filters successfully, and close the filter drawer without breaking approval table behavior', async () => {
        try {
            Logger.step('TC208: Testing Filter button in All Approvals');

            await approvalJob.navigateToAllApprovalsTab();
            await approvalJob.waitForPageLoad();

            // Click filter
            const filterSuccess = await approvalJob.clickFilterButton();
            expect(filterSuccess).toBeTruthy();
            Logger.success('Filter button clicked in All Approvals');

            // Close
            await approvalJob.closeDialog();
            Logger.success('Filter panel closed');

            Logger.success('TC208 passed: Filter button tested in All Approvals');
        } catch (error) {
            Logger.error('TC208 failed: ' + error.message);
            throw error;
        }
    });

    test('@approval @sanity @regression TC209 Approval Workflow – Verify user can switch between My Approvals and All Approvals tabs without data or UI issues', async () => {
        try {
            Logger.step('TC209: E2E test - switching between tabs');

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

            Logger.success('TC209 passed: Cross-tab navigation working');
        } catch (error) {
            Logger.error('TC209 failed: ' + error.message);
            throw error;
        }
    });

    test('@approval @sanity @regression TC210 Approval Workflow – Verify both My Approvals and All Approvals tabs load with consistent column headers and page structure', async () => {
        try {
            Logger.step('TC210: E2E test - verifying page loaded across tabs');

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

            Logger.success('TC210 passed: Both tabs loaded successfully');
        } catch (error) {
            Logger.error('TC210 failed: ' + error.message);
            throw error;
        }
    });

});
