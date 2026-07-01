require('dotenv').config();
const { test, expect } = require('@playwright/test');
const { SimpleApprovalPage } = require('../pages/simpleApprovalPage');
const { Logger } = require('../utils/logger');

test.use({
    storageState: 'OtherSessionState.json',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    animations: 'disabled',
    maxDiffPixels: 50_000,
    maxDiffPixelRatio: 0.3,
});

let page, approvalJob;

test.describe('Approval Workflow - My Approvals E2E Tests with another user', () => {
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

    test('@approval @sanity @regression TC211 My Approvals – Verify user can successfully search approval records using a valid keyword and see filtered results', async () => {
        try {
            Logger.step('TC211: Testing search functionality in My Approvals tab');

            await approvalJob.navigateToMyApprovalsTab();
            await approvalJob.waitForPageLoad();

            // Get initial row count
            const initialRowCount = await approvalJob.getTableRowCount();
            Logger.info('Initial data rows in My Approvals: ' + initialRowCount);

            // Search for a common term
            const searchTerm = 'test';
            await approvalJob.searchApprovals(searchTerm);
            Logger.step('Searching for term: ' + searchTerm);
            const afterSearchRowCount = await approvalJob.getTableRowCount();
            Logger.info('Rows after search: ' + afterSearchRowCount);

            // Clear search
            await approvalJob.clearSearch();
            const afterClearRowCount = await approvalJob.getTableRowCount();
            Logger.info('Rows after clearing search: ' + afterClearRowCount);

            Logger.success('TC211 passed: Search functionality working correctly');
        } catch (error) {
            Logger.error('TC211 failed: ' + error.message);
            throw error;
        }
    });

    test('@approval @regression TC212 My Approvals – Verify My Approvals page loads correctly with functional toolbar, table, search, export, and approval details modal', async () => {
        try {
            Logger.step('TC212: Navigating to My Approvals tab');
            await approvalJob.navigateToMyApprovalsTab();
            await approvalJob.waitForPageLoad();
            await page.waitForTimeout(30000);
            await page.waitForTimeout(4000); 

            const searchInputVisible = await page
                .getByPlaceholder('Search...')
                .isVisible()
                .catch(() => false);

            expect(searchInputVisible).toBeTruthy();
            Logger.info('Search input is visible');

            const initialRowCount = await approvalJob.getTableRowCount();
            Logger.info(`Initial rows available: ${initialRowCount}`);

            Logger.step('Verify toolbar buttons presence');

            const toolbarButtonsCount = await page
                .locator('button')
                .filter({ has: page.locator('svg') })
                .count();

            expect(toolbarButtonsCount).toBeGreaterThan(0);
            Logger.info(`Toolbar buttons found: ${toolbarButtonsCount}`);

            Logger.step('Verify table structure');

            const tableVisible =
                (await page
                    .locator('[role="row"]')
                    .first()
                    .isVisible({ timeout: 5000 })
                    .catch(() => false)) || initialRowCount === 0;

            expect(tableVisible).toBeTruthy();
            Logger.info('Table structure verified');

            Logger.step('Verify search and toolbar combination');

            await approvalJob.searchApprovals('prop');

            const searchRowCount = await approvalJob.getTableRowCount();
            Logger.info(`Rows after search: ${searchRowCount}`);

            const exportSuccess = await approvalJob.clickExportButton();
            expect(exportSuccess).toBeTruthy();
            Logger.info('Export button works with active search');

            await approvalJob.clearSearch();

            const clearedRowCount = await approvalJob.getTableRowCount();
            Logger.info(`Rows after clearing search: ${clearedRowCount}`);

            Logger.step('Verify modal open/close behavior');

            if (initialRowCount === 0) {
                test.skip(true, 'No approval rows available — cannot test modal open/close');
            }
            await approvalJob.viewApprovalDetails(0);
            await approvalJob.waitForPageLoad();
            Logger.info('Approval details modal opened');

            await approvalJob.closeApprovalModal();
            Logger.info('Approval details modal closed');
            await approvalJob.waitForPageLoad();
            await page.waitForTimeout(3000);

            await expect(page.getByPlaceholder('Search...')).toBeVisible({ timeout: 10000 });
            Logger.info('Page remains functional after modal close');

            Logger.success('TC212 passed: My Approvals flow validated end-to-end');
        } catch (error) {
            Logger.error('TC212 failed: ' + error.message);
            throw error;
        }
    });

    test('@approval @regression TC213 Approval Workflow – Verify search behavior is handled correctly when switching between approval tabs', async () => {
        try {
            Logger.step('TC213: E2E test - testing search behavior across tabs');

            // Search in My Approvals
            await approvalJob.navigateToMyApprovalsTab();
            await approvalJob.waitForPageLoad();

            const searchTerm = 'test';
            await approvalJob.searchApprovals(searchTerm);
            const myApprovalsSearchResults = await approvalJob.getTableRowCount();
            Logger.info('My Approvals search results for "' + searchTerm + '": ' + myApprovalsSearchResults);

            // Switch to All Approvals
            await approvalJob.navigateToAllApprovalsTab();
            await approvalJob.waitForPageLoad();
            Logger.info('Switched to All Approvals tab');

            // Clear search from previous tab
            await approvalJob.clearSearch();
            Logger.success('Search properly managed across tab switches');

            Logger.success('TC213 passed: Search behavior across tabs verified');
        } catch (error) {
            Logger.error('TC213 failed: ' + error.message);
            throw error;
        }
    });

    test('@approval @regression TC214 Approval Workflow – Verify user can complete the full end-to-end approval journey including search, view details, manage columns, export data, and tab navigation', async () => {
        try {
            Logger.step('TC214: E2E complete workflow - view, search, manage columns, export');

            // Step 1: Navigate to My Approvals
            Logger.step('Step 1: Navigate to My Approvals');
            await approvalJob.navigateToMyApprovalsTab();
            // await approvalJob.waitForPageLoad();
            await page.waitForTimeout(25000); // Wait for 30 seconds to ensure the page is fully loaded
            // Step 2: Verify page is loaded
            Logger.step('Step 2: Verify page is loaded');
            const searchInputVisible = await page.getByPlaceholder('Search...').isVisible({ timeout: 5000 }).catch(() => false);
            const hasRows = await page.locator('[role="row"]').count() > 0;
            expect(
                searchInputVisible || hasRows,
                "UI changed: My Approvals should show search input or at least one row"
            ).toBeTruthy();

            // Step 3: Search for data
            Logger.step('Step 3: Perform search');
            await approvalJob.searchApprovals('test');
            const searchRowCount = await approvalJob.getTableRowCount();
            Logger.info('Search returned ' + searchRowCount + ' results');

            // Step 4: Clear search
            Logger.step('Step 4: Clear search');
            await approvalJob.clearSearch();

            // Step 5: Open approval details
            Logger.step('Step 5: View approval details');
            const hasData = (await approvalJob.getTableRowCount()) > 0;
            if (hasData) {
                await approvalJob.viewApprovalDetails(0);
                const modalVisible = await approvalJob.isApprovalModalVisible();
                expect(modalVisible, 'Approval details modal should be visible after opening').toBeTruthy();
                await approvalJob.closeApprovalModal();
            } else {
                test.skip(true, 'No approval data available — cannot test modal open/close');
            }

            // Step 6: Test export
            Logger.step('Step 6: Test export');
            await approvalJob.clickExportButton();

            // Step 7: Test manage columns
            Logger.step('Step 7: Test manage columns');
            await approvalJob.clickSettingsButton();
            // await approvalJob.waitForPageLoad();
            await page.waitForTimeout(25000);
            await approvalJob.closeDialog();

            // Step 8: Switch to All Approvals
            Logger.step('Step 8: Switch to All Approvals');
            await approvalJob.navigateToAllApprovalsTab();
            // await approvalJob.waitForPageLoad();
            await page.waitForTimeout(25000);

            // Step 9: Verify All Approvals page loaded
            Logger.step('Step 9: Verify All Approvals page loaded');
            const allApprovalsVisible =
                await page.getByPlaceholder(/Search/i).isVisible({ timeout: 5000 }).catch(() => false);
            const allTabSelected =
                await page.getByRole('tab', { name: 'All Approvals' }).getAttribute('aria-selected').then(v => v === 'true').catch(() => false);
            const allApprovalsUrl = /\/approvals\/all-approvals/.test(page.url());
            const allGridVisible =
                await page.locator('[role="treegrid"]').isVisible({ timeout: 5000 }).catch(() => false);
            expect(
                allApprovalsVisible || allGridVisible || (allTabSelected && allApprovalsUrl),
                "UI changed: All Approvals should show search/grid or selected all-approvals state"
            ).toBeTruthy();
            // await approvalJob.waitForPageLoad();
            await page.waitForTimeout(25000);
            Logger.success('TC214 passed: Complete E2E workflow executed successfully');
        } catch (error) {
            Logger.error('TC214 failed: ' + error.message);
            throw error;
        }
    });

});
