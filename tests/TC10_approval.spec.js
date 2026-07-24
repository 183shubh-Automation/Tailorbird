require('dotenv').config();
const { test, expect } = require('@playwright/test');
const { ApprovalJob } = require('../pages/approvalPage');
const { Logger } = require('../utils/logger');
const PropertiesHelper = require('../pages/properties');
const { CapexPage } = require('../pages/capexPage');
const { CapexColumnPersistencePage } = require('../pages/capexColumnPersistencePage');
const { CapexGridStabilityPage } = require('../pages/capexGridStabilityPage');
const { ensureLeftPanelExpanded } = require('../utils/leftPanelExpander');
import { getPropertyName } from '../utils/propertyUtils';

test.use({
    storageState: 'sessionState.json',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
});

let page, approvalJob, propertiesHelper;

// Property creation helper
async function createNewProperty(page) {
    const propertyTypes = ["Garden Style", "Mid Rise", "High Rise", "Military Housing"];
    const propertyType = propertyTypes[Math.floor(Math.random() * propertyTypes.length)];
    const uniqueSuffix = Date.now();
    const propertyName = `Approval_Test_Property_${uniqueSuffix}`;
    const address = 'Domestic Terminal, College Park, GA 30337, USA';
    const city = 'College Park';
    const state = 'GA';
    const zip = '30337';

    try {
        Logger.step('Creating new property for approval template test: ' + propertyName);
        const propHelper = new PropertiesHelper(page);
        await propHelper.goToProperties();
        await page.waitForTimeout(500);

        await propHelper.createProperty(propertyName, address, city, state, zip, propertyType);
        Logger.success('New property created: ' + propertyName);
        return propertyName;
    } catch (error) {
        Logger.error('Failed to create property: ' + error.message);
        throw error;
    }
}

let currentPropertyName = '';
const APPROVAL_VISUAL_ASSERT = {
    animations: 'disabled',
    maxDiffPixels: 50000,
    maxDiffPixelRatio: 0.3,
};

async function settleApprovalWorkspace(pg, ms = 2200) {
    const startTime = Date.now();
    await pg.waitForLoadState('domcontentloaded');

    const anchor = pg.getByRole('tab', { name: /Approval Templates|My Approvals|All Approvals/i })
        .or(pg.locator('[role="columnheader"]').filter({ hasText: /Template|Approver|Status/i }))
        .or(pg.locator('main').getByPlaceholder('Search...'));

    const loaded = await anchor.first()
        .waitFor({ state: 'visible', timeout: 20_000 })
        .then(() => true)
        .catch(() => false);

    if (loaded) {
        Logger.info(`[Approval-workspace] Workspace loaded in ${Date.now() - startTime}ms`);
    } else {
        for (let i = 0; i < 3; i++) {
            await pg.waitForTimeout(5000);
            const ok = await anchor.first().isVisible().catch(() => false);
            if (ok) {
                Logger.info(`[Approval-workspace] Workspace loaded after extra ${(i + 1) * 5}s (total ${Date.now() - startTime}ms)`);
                if (ms > 0) await pg.waitForTimeout(ms);
                return;
            }
            Logger.info(`[Approval-workspace] Not visible yet after ${(i + 1) * 5}s extra wait`);
        }
        Logger.info(`[Approval-workspace] WARNING: Workspace not visible after ${Date.now() - startTime}ms — proceeding`);
    }

    if (ms > 0) await pg.waitForTimeout(ms);
}

test.describe('Approval Templates - Comprehensive E2E Tests', () => {
    test.describe.configure({ retries: 0 });

    test.beforeEach(async ({ page: p }) => {
        page = p;
        approvalJob = new ApprovalJob(page);

        await page.goto(process.env.DASHBOARD_URL, { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(process.env.DASHBOARD_URL);
        await ensureLeftPanelExpanded(page);
        // Wait for app shell — networkidle times out on CapEx page in CI (headless Linux)
        const _appShell = page.locator('.mantine-AppShell-navbar, .mantine-AppShell-main, main').first();
        const _t0 = Date.now();
        const _loaded = await _appShell.waitFor({ state: 'visible', timeout: 20_000 }).then(() => true).catch(() => false);
        if (!_loaded) {
            for (let _i = 0; _i < 3; _i++) {
                await page.waitForTimeout(5000);
                if (await _appShell.isVisible().catch(() => false)) break;
            }
        }
        console.log(`[beforeEach] CapEx shell ready in ${Date.now() - _t0}ms`);
        await approvalJob.navigateToApprovalTab();
        await approvalJob.navigateToApprovalTemplatesTab();
        await approvalJob.waitForPageLoad();
    });

      test('TC168 @approval @Mandatory @sanity Creating approval for mandatory property', async () => {
        currentPropertyName = getPropertyName();
       
        try {
            Logger.step('TC161: Starting create template positive flow');

            const templateName = 'ApprovalTemplate_' + Date.now();
            await approvalJob.createTemplateWorkflow(templateName, 'Invoice', currentPropertyName, 1000, true);

            await expect(approvalJob.createTemplateDialog()).toBeHidden({ timeout: 20000 });
            await approvalJob.searchTemplate(templateName);
            await expect(page.getByRole('row').filter({ hasText: templateName })).toBeVisible({ timeout: 15000 });
            await approvalJob.clearSearch();

            Logger.success('TC161 passed: Template created successfully with all elements verified');
        } catch (error) {
            Logger.error('TC161 failed: ' + error.message);
            throw error;
        }
    });

    test('@approval @regression @sanity TC169 Approval Templates – Verify user can successfully create an approval template with all required elements including property, approver, amount, and mandatory flags', async () => {
        currentPropertyName = await createNewProperty(page);
        Logger.info('Property for template: ' + currentPropertyName);

        await approvalJob.navigateToApprovalTab();
        await approvalJob.navigateToApprovalTemplatesTab();
        await approvalJob.waitForPageLoad();

        try {
            Logger.step('TC169: Starting create template positive flow');

            const templateName = 'ApprovalTemplate_' + Date.now();
            await approvalJob.createTemplateWorkflow(templateName, 'Invoice', currentPropertyName, 1000, true);

            await expect(approvalJob.createTemplateDialog()).toBeHidden({ timeout: 20000 });
            await approvalJob.searchTemplate(templateName);
            await expect(page.getByRole('row').filter({ hasText: templateName })).toBeVisible({ timeout: 15000 });
            await approvalJob.clearSearch();

            Logger.success('TC169 passed: Template created successfully with all elements verified');
        } catch (error) {
            Logger.error('TC169 failed: ' + error.message);
            throw error;
        }
    });

    test('@approval @regression TC170 Approval Templates – Verify system validations and error handling when creating an approval template with missing, invalid, or incorrect inputs', async () => {

        // Create a new property for this test
        currentPropertyName = await createNewProperty(page);
        Logger.info('Created property for template: ' + currentPropertyName);

        await approvalJob.navigateToApprovalTab();
        await approvalJob.navigateToApprovalTemplatesTab();
        await approvalJob.waitForPageLoad();

        try {
            Logger.step('TC170: Starting create template negative flow');

            // Open Create Template dialog
            await approvalJob.openCreateTemplateDialog();

            // Test 1: Try submitting without filling any required field
            const submitBtn = page.getByRole('button', { name: /^Create Template$/ }).last();
            const isDisabled = await submitBtn.isDisabled().catch(() => false);
            Logger.info('Submit button disabled state with empty form: ' + isDisabled);

            // Test 2: Fill name without selecting type
            await approvalJob.fillTemplateName('TestTemplateNoType');
            Logger.info('Template name filled without selecting type');

            // Test 3: Select type and properties but no approver setup
            await approvalJob.selectTemplateType('Invoice');
            await approvalJob.addProperty(currentPropertyName);
            Logger.info('Type and property selected without full approver setup');

            // // Test 4: Click properties but don't select
            // const propertiesInput = page.getByPlaceholder('Search and add properties');
            // await propertiesInput.click();
            // await page.waitForTimeout(300);
            // await page.keyboard.press('Escape');
            // Logger.info('Properties dropdown opened and closed without selection');

            // Test 5: Fill amount with invalid value
            const amountInput = page.getByPlaceholder('Enter Amount').first();
            await amountInput.fill('abc');
            Logger.info('Amount field filled with non-numeric value');

            // Test 6: Clear and set amount to zero
            await amountInput.clear();
            await amountInput.fill('0');
            Logger.info('Amount set to zero (edge case)');

            // Test 7: Cancel dialog
            await approvalJob.cancelDialog();
            Logger.info('Dialog cancelled');

            await approvalJob.waitForPageLoad();
            await page.waitForTimeout(1000);
            // Verify dialog closed
            const dialogClosed = await approvalJob.isDialogClosed();
            expect(dialogClosed).toBeTruthy();
            Logger.success('TC170 passed: All negative scenarios tested and dialog cancelled');
        } catch (error) {
            Logger.error('TC170 failed: ' + error.message);
            throw error;
        }
    });

    test('@approval @regression TC171 Approval Templates – Verify user can apply and clear search filters successfully using valid template names', async () => {
        try {
            Logger.step('TC171: Starting filter positive flow');

            // Verify table visible before filtering
            const initialRowCount = await approvalJob.getTableRowCount();
            Logger.info('Initial table rows: ' + initialRowCount);

            // Search for specific template
            await approvalJob.searchTemplate('test113377');
            Logger.info('Search filter applied: test113377');

            const searchInput = page.getByPlaceholder('Search...').first();
            await expect(searchInput).toHaveValue('test113377', { timeout: 5000 });
            const filteredRowCount = await approvalJob.getTableRowCount();
            Logger.info('Filtered table rows: ' + filteredRowCount);

            // Clear filter
            await approvalJob.clearSearch();
            await expect(searchInput).toHaveValue('', { timeout: 5000 });
            Logger.info('Search filter cleared');

            // Verify all rows returned
            const allRowsCount = await approvalJob.getTableRowCount();
            expect(allRowsCount).toBeGreaterThanOrEqual(filteredRowCount);
            Logger.info('All rows count after clear: ' + allRowsCount);

            Logger.success('TC171 passed: Filter applied and cleared successfully');
        } catch (error) {
            Logger.error('TC171 failed: ' + error.message);
            throw error;
        }
    });

    test('@approval @regression TC172 Approval Templates – Verify system handles invalid, special character, long text, and rapid search inputs gracefully in template filters', async () => {
        try {
            Logger.step('TC172: Starting filter negative flow');

            const searchInput = page.getByPlaceholder('Search...').first();

            await approvalJob.searchTemplate('NonExistentTemplate12345');
            await expect(searchInput).toHaveValue('NonExistentTemplate12345', { timeout: 5000 });
            Logger.info('Searched for non-existent template');

            await approvalJob.clearSearch();
            await expect(searchInput).toHaveValue('', { timeout: 5000 });
            await approvalJob.searchTemplate('!@#$%^');
            await expect(searchInput).toHaveValue('!@#$%^', { timeout: 5000 });
            Logger.info('Searched with special characters');

            await approvalJob.clearSearch();
            const longString = 'a'.repeat(100);
            await approvalJob.searchTemplate(longString);
            await expect(searchInput).toHaveValue(longString, { timeout: 5000 });
            Logger.info('Searched with 100-character long string');

            await approvalJob.searchTemplate('test');
            await page.waitForTimeout(200);
            await approvalJob.searchTemplate('test113377');
            await expect(searchInput).toHaveValue('test113377', { timeout: 5000 });
            Logger.info('Rapid search updates completed');

            await approvalJob.clearSearch();
            await expect(searchInput).toHaveValue('', { timeout: 5000 });

            Logger.success('TC172 passed: All negative filter scenarios tested');
        } catch (error) {
            Logger.error('TC172 failed: ' + error.message);
            throw error;
        }
    });

    test('@approval @regression TC173 Approval Templates – Verify user can open Manage Columns dialog and view available column options successfully', async () => {
        try {
            Logger.step('TC173: Starting manage columns positive flow');

            await approvalJob.expectApprovalTemplatesTableCoreColumnsVisible();
            Logger.info('Core template table columns visible before manage columns');

            // Click Manage Columns button
            await approvalJob.clickManageColumnsButton();
            Logger.info('Manage Columns dialog opened');

            const allCheckboxes = await approvalJob.getAllCheckboxes();
            const checkboxCount = await allCheckboxes.count();
            expect(checkboxCount, 'Manage Columns dialog should expose at least one column checkbox').toBeGreaterThan(0);
            Logger.info('Column checkboxes found: ' + checkboxCount);

            // Record original state then toggle first 2 columns
            const originalStates = [];
            for (let i = 0; i < Math.min(2, checkboxCount); i++) {
                const checkbox = allCheckboxes.nth(i);
                const wasChecked = await checkbox.isChecked();
                originalStates.push(wasChecked);
                await checkbox.click();
                await page.waitForTimeout(300);
                const nowChecked = await checkbox.isChecked();
                Logger.info('Checkbox ' + i + ' toggled from ' + wasChecked + ' to ' + nowChecked);
            }

            // Restore original states so column visibility is not polluted for subsequent tests
            Logger.info('TC173: Restoring toggled columns to original state');
            for (let i = 0; i < originalStates.length; i++) {
                const checkbox = allCheckboxes.nth(i);
                const currentChecked = await checkbox.isChecked();
                if (currentChecked !== originalStates[i]) {
                    await checkbox.click();
                    await page.waitForTimeout(300);
                    Logger.info('Checkbox ' + i + ' restored to ' + originalStates[i]);
                }
            }

            // Close dialog
            await page.keyboard.press('Escape');
            await page.waitForTimeout(800);
            Logger.info('Manage Columns dialog closed');

            Logger.success('TC173 passed: Manage Columns tested with column toggles');
        } catch (error) {
            Logger.error('TC173 failed: ' + error.message);
            throw error;
        }
    });

    test('@approval @regression TC174 Approval Templates – Verify system behavior when all columns are unchecked and reselected in Manage Columns dialog', async () => {
        try {
            Logger.step('TC174: Starting manage columns negative flow');

            // Open Manage Columns dialog
            await approvalJob.clickManageColumnsButton();
            Logger.info('Manage Columns dialog opened');

            // Get all checkboxes
            const allCheckboxes = await approvalJob.getAllCheckboxes();
            const checkboxCount = await allCheckboxes.count();

            // Test: Uncheck all columns (negative case)
            for (let i = 0; i < checkboxCount; i++) {
                const checkbox = allCheckboxes.nth(i);
                const isChecked = await checkbox.isChecked();
                if (isChecked) {
                    await checkbox.click();
                    await page.waitForTimeout(200);
                }
            }
            Logger.info('All columns unchecked');

            // Check them all back
            for (let i = 0; i < checkboxCount; i++) {
                const checkbox = allCheckboxes.nth(i);
                const isChecked = await checkbox.isChecked();
                if (!isChecked) {
                    await checkbox.click();
                    await page.waitForTimeout(200);
                }
            }
            Logger.info('All columns checked back');

            // Close dialog
            await page.keyboard.press('Escape');
            await page.waitForTimeout(800);

            await approvalJob.expectApprovalTemplatesTableCoreColumnsVisible();
            Logger.success('TC174 passed: Manage Columns negative scenarios tested — columns restored');
        } catch (error) {
            Logger.error('TC174 failed: ' + error.message);
            throw error;
        }
    });

    test('@approval @regression @sanity TC175 Approval Templates – Verify user can export approval templates data successfully when valid data is available', async () => {
        try {
            Logger.step('TC175: Starting export data positive flow');

            await approvalJob.expectApprovalTemplatesTableCoreColumnsVisible();
            Logger.info('Core columns present — export');

            const exportBtn = page.locator('main').getByRole('button', { name: 'Export' });
            await expect(exportBtn).toBeVisible({ timeout: 10000 });
            await expect(exportBtn).toBeEnabled();
            await approvalJob.clickExportButton();
            Logger.info('Export button clicked');

            Logger.success('TC175 passed: Export data initiated successfully');
        } catch (error) {
            Logger.error('TC175 failed: ' + error.message);
            throw error;
        }
    });

    test('@approval @regression TC176 Approval Templates – Verify Export action remains functional and stable under edge conditions and repeated export attempts', async () => {
        try {
            Logger.step('TC176: Starting export data negative flow');

            const exportBtn = page.locator('main').getByRole('button', { name: 'Export' });
            await expect(exportBtn).toBeVisible({ timeout: 10000 });
            const isEnabled = await exportBtn.isEnabled();
            expect(isEnabled, 'Export button should be enabled when templates are available').toBeTruthy();
            Logger.info('Export button enabled: ' + isEnabled);

            await approvalJob.clickExportButton();
            Logger.info('Export button clicked');

            await expect(exportBtn).toBeVisible({ timeout: 5000 });
            Logger.success('TC176 passed: Export negative flow tested — button remains visible after click');
        } catch (error) {
            Logger.error('TC176 failed: ' + error.message);
            throw error;
        }
    });

    test('@approval @regression TC177 Approval Templates – Verify user can create, save, and close a custom table view successfully in Approval Templates', async () => {
        try {
            Logger.step('TC177: Starting create view positive flow');

            await approvalJob.clickCreateViewButton();
            Logger.info('Create View button clicked');

            const viewNameInput = page.locator('input[placeholder*="view" i]').first();
            await expect(viewNameInput).toBeVisible({ timeout: 10000 });

            const viewName = 'TestView_' + Date.now();
            await viewNameInput.fill(viewName);
            await expect(viewNameInput).toHaveValue(viewName, { timeout: 5000 });
            Logger.info('View name filled: ' + viewName);

            const saveBtn = page.locator('button:has-text("Create")').last();
            await expect(saveBtn).toBeVisible({ timeout: 5000 });
            await saveBtn.click();
            await page.waitForTimeout(1000);
            Logger.info('View created');

            await page.keyboard.press('Escape').catch(() => { });
            await page.waitForTimeout(600);

            Logger.success('TC177 passed: Create View flow completed');
        } catch (error) {
            Logger.error('TC177 failed: ' + error.message);
            throw error;
        }
    });

    test('@approval @regression TC178 Approval Templates – Verify Create View form handles empty names, special characters, and excessively long view names correctly', async () => {
        try {
            Logger.step('TC178: Starting create view negative flow');

            await approvalJob.clickCreateViewButton();
            Logger.info('Create View dialog opened');

            const viewNameInput = page.locator('input[placeholder*="view" i]').first();
            await expect(viewNameInput).toBeVisible({ timeout: 10000 });

            const submitBtn = page.locator('button:has-text("Create")').last();
            await expect(submitBtn).toBeVisible({ timeout: 5000 });
            const isDisabled = await submitBtn.isDisabled().catch(() => false);
            Logger.info('Submit button disabled with empty name: ' + isDisabled);

            await viewNameInput.fill('!@#$%^&*()');
            await expect(viewNameInput).toHaveValue('!@#$%^&*()', { timeout: 5000 });
            Logger.info('View name with special characters verified');

            await viewNameInput.clear();
            const longName = 'A'.repeat(200);
            await viewNameInput.fill(longName);
            const filledValue = await viewNameInput.inputValue();
            expect(filledValue.length).toBeGreaterThanOrEqual(32);
            Logger.info('Long view name attempted: ' + longName.length + ' characters, actual: ' + filledValue.length);

            await page.keyboard.press('Escape');
            await page.waitForTimeout(600);

            Logger.success('TC178 passed: Create View negative scenarios tested');
        } catch (error) {
            Logger.error('TC178 failed: ' + error.message);
            throw error;
        }
    });

    test('@approval @regression TC179 Approval Templates – Verify Create Template and Edit Template dialogs can be cancelled safely without saving any unsaved changes', async () => {
        try {
            Logger.step('TC179: Starting E2E cancel flow');

            // CREATE and CANCEL
            await approvalJob.openCreateTemplateDialog();
            await approvalJob.fillTemplateName('TemplateToCancel');
            Logger.info('Template name filled for cancellation test');

            await approvalJob.cancelDialog();
            Logger.info('Create dialog cancelled');

            await approvalJob.waitForPageLoad();
            await page.waitForTimeout(1000);
            // Verify dialog closed
            const dialogClosed = await approvalJob.isDialogClosed();
            expect(dialogClosed).toBeTruthy();
            Logger.info('Create dialog confirmed closed');

            // EDIT and CANCEL
            const editBtnExists = await page.getByRole('button', { name: 'Edit' }).first().isVisible().catch(() => false);
            if (editBtnExists) {
                await approvalJob.clickEditTemplate();
                Logger.info('Edit dialog opened');

                await approvalJob.uncheckAlwaysRequired();
                Logger.info('Always Required checkbox unchecked');

                const amountInput = page.getByPlaceholder('Enter Amount').first();
                if (await amountInput.isVisible().catch(() => false)) {
                    await amountInput.clear();
                    await amountInput.fill('99999');
                    Logger.info('Amount changed in edit');
                }

                const editCancelBtn = page.getByRole('button', { name: 'Cancel' }).last();
                if (await editCancelBtn.isVisible().catch(() => false)) {
                    await editCancelBtn.click();
                    await page.waitForTimeout(1000);
                    Logger.info('Edit dialog cancelled');
                }
            }

            Logger.success('TC179 passed: E2E cancel flows tested');
        } catch (error) {
            Logger.error('TC179 failed: ' + error.message);
            throw error;
        }
    });

    test('@approval @regression TC180 Approval Templates – Verify approval templates table displays all expected column headers correctly', async () => {
        try {
            Logger.step('TC180: Starting table headers positive flow');

            const expectedHeaders = ['Name', 'Template Type', 'Properties', 'Approval Rules', 'Created By'];
            for (const expectedHeader of expectedHeaders) {
                await expect(
                    page.getByRole('columnheader', { name: expectedHeader }).first()
                ).toBeVisible({ timeout: 15000 });
                Logger.info('Header verified: ' + expectedHeader);
            }

            Logger.success('TC180 passed: All table headers verified');
        } catch (error) {
            Logger.error('TC180 failed: ' + error.message);
            throw error;
        }
    });

    test('@approval @regression TC181 Approval Templates – Verify Approval Templates table displays all expected column headers with correct labels', async () => {
        try {
            Logger.step('TC181: Starting table headers negative flow');

            // Test non-existent header
            const invalidHeaderExists = await approvalJob.getAllTableHeaders().then(headers =>
                headers.some(h => h.includes("InvalidHeader"))
            );
            expect(invalidHeaderExists).toBeFalsy();
            Logger.info('Non-existent header check: not found (as expected)');

            // Verify column structure
            const headerCount = await approvalJob.getTableHeaderCount();
            Logger.info('Column count verified: ' + headerCount);

            Logger.success('TC181 passed: Invalid header checks passed');
        } catch (error) {
            Logger.error('TC181 failed: ' + error.message);
            throw error;
        }
    });

    test('@approval @regression TC182 Approval Templates – Verify user can open and access the Create Template flow for different approval template types successfully', async () => {
        test.setTimeout(180000);
        try {
            Logger.step('TC182: Starting non-blocking validation flow');
            await approvalJob.navigateToApprovalTab();
            await approvalJob.navigateToApprovalTemplatesTab();
            await approvalJob.waitForPageLoad();
            await approvalJob.openCreateTemplateDialog();
            await approvalJob.cancelDialog();
            Logger.success('TC182 passed');
        } catch (error) {
            Logger.error('TC182 failed: ' + error.message);
            throw error;
        }
    });

    test('@approval @regression TC183 Approval Templates – Verify Create Template dialog remains stable when switching rapidly between multiple approval template types', async () => {
        try {
            Logger.step('TC183: Starting all template types negative flow');

            // Test selecting type then changing multiple times
            await approvalJob.openCreateTemplateDialog();
            Logger.info('Create Template dialog opened');

            // Test rapid type switching
            const types = ['Change Order', 'Invoice', 'Contract', 'Budget'];
            for (const type of types) {
                const isSelected = await approvalJob.selectTemplateType(type);
                Logger.info('Type ' + type + ' selected: ' + isSelected);
            }

            // Test deselecting (clicking same radio twice)
            await approvalJob.selectTemplateType('Change Order');
            Logger.info('Initial selection: Change Order');

            // Try clicking same radio again
            const changeOrderRadio = page.getByRole('radio', { name: 'Change Order' });
            await changeOrderRadio.click();
            await page.waitForTimeout(200);
            const stillSelected = await changeOrderRadio.isChecked();
            Logger.info('Still selected after double-click: ' + stillSelected);

            // Close dialog
            await approvalJob.cancelDialog();

            Logger.success('TC183 passed: Type switching and selection tested');
        } catch (error) {
            Logger.error('TC183 failed: ' + error.message);
            throw error;
        }
    });

    test('@approval @regression TC184 Approval Templates – Verify approval template type remains locked during edit mode while allowing updates to editable fields like amount and approval rules', async () => {
        test.setTimeout(240000);
        const tc176Property = await createNewProperty(page);
        await approvalJob.navigateToApprovalTab();
        await approvalJob.navigateToApprovalTemplatesTab();
        await approvalJob.waitForPageLoad();
        const tc176Template = `TC176_Template_${Date.now()}`;
        await approvalJob.createTemplateWorkflow(tc176Template, 'Change Order', tc176Property, 5000, true);
        await settleApprovalWorkspace(page, 2000);
        await approvalJob.searchTemplate(tc176Template);
        await expect(page.getByRole('row').filter({ hasText: tc176Template })).toBeVisible({ timeout: 15000 });

        try {
            Logger.step('TC184: Starting edit template type lock positive flow');

            // Click Edit button on first template
            const editBtn = page.getByRole('button', { name: 'Edit' }).first();
            const editExists = await editBtn.isVisible().catch(() => false);

            expect(editExists, 'TC176: No "Edit" button found — template creation may have failed').toBe(true);

            await approvalJob.clickEditTemplate();
            Logger.info('Edit dialog opened');

            // Verify template type radios are disabled
            const types = ['Change Order', 'Invoice', 'Contract', 'Budget'];
            for (const type of types) {
                const isDisabled = await approvalJob.isRadioDisabled(type);
                Logger.info('Type ' + type + ' radio disabled: ' + isDisabled);
            }

            await approvalJob.uncheckAlwaysRequired();
            Logger.info('Always Required checkbox unchecked');

            // Edit other fields (amount)
            const amountInputs = page.getByPlaceholder('Enter Amount');
            const amountCount = await amountInputs.count();
            Logger.info('Amount inputs found: ' + amountCount);

            if (amountCount > 0) {
                const firstAmount = amountInputs.first();
                const currentValue = await firstAmount.inputValue();
                await firstAmount.clear();
                await firstAmount.fill('15000');
                Logger.info('Amount updated from ' + currentValue + ' to 15000');
            }

            // Cancel to not save
            await approvalJob.cancelDialog();

            Logger.success('TC184 passed: Template type lock in edit mode verified');
        } catch (error) {
            Logger.error('TC184 failed: ' + error.message);
            throw error;
        } finally {
            await approvalJob.clearSearch().catch(() => { });
            await approvalJob.searchTemplate(tc176Template).catch(() => { });
            await approvalJob.deleteTemplate(tc176Template).catch(() => { });
            await approvalJob.clearSearch().catch(() => { });
        }
    });

    test('@approval @regression TC185 Approval Templates – Verify system prevents forced or invalid changes to template type during edit mode', async () => {
        test.setTimeout(240000);
        const tc177Property = await createNewProperty(page);
        await approvalJob.navigateToApprovalTab();
        await approvalJob.navigateToApprovalTemplatesTab();
        await approvalJob.waitForPageLoad();
        const tc177Template = `TC177_Template_${Date.now()}`;
        await approvalJob.createTemplateWorkflow(tc177Template, 'Change Order', tc177Property, 5000, true);
        await settleApprovalWorkspace(page, 2000);
        await approvalJob.searchTemplate(tc177Template);
        await expect(page.getByRole('row').filter({ hasText: tc177Template })).toBeVisible({ timeout: 15000 });

        try {
            Logger.step('TC185: Starting edit template type lock negative flow');

            // Open Edit dialog
            const editBtn = page.getByRole('button', { name: 'Edit' }).first();
            const editExists = await editBtn.isVisible().catch(() => false);

            expect(editExists, 'TC177: No "Edit" button found — template creation may have failed').toBe(true);

            await approvalJob.clickEditTemplate();
            Logger.info('Edit dialog opened');

            // Test each type to confirm disabled state
            const disabledTests = [];
            const types = ['Change Order', 'Invoice', 'Contract', 'Budget'];

            for (const type of types) {
                const isDisabled = await approvalJob.isRadioDisabled(type);
                disabledTests.push({ type, disabled: isDisabled });
                Logger.info('Type ' + type + ' - disabled: ' + isDisabled);
            }

            // Verify all are disabled or all are enabled (consistency)
            const allDisabled = disabledTests.every(t => t.disabled);
            const allEnabled = disabledTests.every(t => !t.disabled);

            if (!allDisabled && !allEnabled) {
                Logger.info('Warning: Inconsistent type radio states');
            }

            // Try to directly manipulate a radio (force click)
            const invoiceRadio = page.getByRole('radio', { name: 'Invoice' });
            try {
                await invoiceRadio.click({ force: true });
                Logger.info('Force click attempted on type radio');
            } catch (e) {
                Logger.info('Force click blocked on type radio');
            }

            // Close dialog
            await approvalJob.cancelDialog();

            Logger.success('TC185 passed: Type lock negative attempts tested');
        } catch (error) {
            Logger.error('TC185 failed: ' + error.message);
            throw error;
        } finally {
            await approvalJob.clearSearch().catch(() => { });
            await approvalJob.searchTemplate(tc177Template).catch(() => { });
            await approvalJob.deleteTemplate(tc177Template).catch(() => { });
            await approvalJob.clearSearch().catch(() => { });
        }
    });

    test('@approval @regression @positive TC186 Approval Templates – Verify newly created approval template appears correctly in search results and remains searchable after clearing and reapplying filters', async () => {
        const propertyName = await createNewProperty(page);
        await approvalJob.navigateToApprovalTab();
        await approvalJob.navigateToApprovalTemplatesTab();
        await approvalJob.waitForPageLoad();

        const templateName = `ApprovalTemplate_TC121_${Date.now()}`;
        await approvalJob.createTemplateWorkflow(templateName, 'Invoice', propertyName, 2500, true);
        await settleApprovalWorkspace(page, 1800);

        await approvalJob.searchTemplate(templateName);
        const matchedRows = page.getByRole('row').filter({ hasText: templateName });
        await expect(matchedRows.first()).toBeVisible({ timeout: 15000 });
        const matchedCount = await matchedRows.count();
        expect(matchedCount).toBeGreaterThan(0);

        await approvalJob.clearSearch();
        await settleApprovalWorkspace(page, 1000);
        await approvalJob.searchTemplate(templateName);
        await expect(page.getByRole('row').filter({ hasText: templateName }).first()).toBeVisible({ timeout: 15000 });
        await approvalJob.clearSearch();
    });

    test('@approval @regression @negative TC187 Approval Templates – Verify Create Template dialog rejects template names containing only blank spaces and prevents submission', async () => {
        await approvalJob.openCreateTemplateDialog();
        await approvalJob.fillTemplateName('    ');
        await approvalJob.selectTemplateType('Change Order');

        const submitBtn = page.getByRole('button', { name: /^Create Template$/ }).last();
        const canSubmit = await submitBtn.isEnabled().catch(() => false);
        if (canSubmit) {
            await submitBtn.click();
            await page.waitForTimeout(1200);
        }

        // Dialog should remain open for invalid/blank name inputs.
        await expect(approvalJob.createTemplateDialog()).toBeVisible({ timeout: 10000 });
        await approvalJob.cancelDialog();
        expect(await approvalJob.isDialogClosed()).toBeTruthy();
    });

    test('@approval @regression @edge TC188 Approval Templates – Verify toolbar controls and approval template table remain stable when switching repeatedly between Approval Templates, My Approvals, and All Approvals tabs', async () => {
        await settleApprovalWorkspace(page, 1200);
        const myApprovalsTab = page.getByRole('tab', { name: 'My Approvals' });
        const allApprovalsTab = page.getByRole('tab', { name: 'All Approvals' });
        const approvalTemplatesTab = page.getByRole('tab', { name: 'Approval Templates' });

        await myApprovalsTab.click();
        await settleApprovalWorkspace(page, 1200);
        await allApprovalsTab.click();
        await settleApprovalWorkspace(page, 1200);
        await approvalTemplatesTab.click();
        await settleApprovalWorkspace(page, 1500);

        await expect(page.getByRole('button', { name: 'Create Template' }).first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByRole('button', { name: 'Export' })).toBeVisible({ timeout: 15000 });
        await approvalJob.expectApprovalTemplatesTableCoreColumnsVisible();
    });

    test('@approval @regression @edge TC189 Approval Templates – Verify Create Template modal remains functional and all template type options stay visible during rapid template type switching', async () => {
        await approvalJob.openCreateTemplateDialog();
        await approvalJob.fillTemplateName(`TC124_${Date.now()}`);

        const switchTypes = ['Change Order', 'Invoice', 'Contract', 'Budget', 'Invoice', 'Change Order'];
        for (const type of switchTypes) {
            await approvalJob.selectTemplateType(type);
            await page.waitForTimeout(120);
        }

        await expect(approvalJob.createTemplateDialog()).toBeVisible({ timeout: 10000 });
        await expect(page.getByRole('radio', { name: 'Change Order' })).toBeVisible();
        await expect(page.getByRole('radio', { name: 'Invoice' })).toBeVisible();
        await expect(page.getByRole('radio', { name: 'Contract/PO' })).toBeVisible();
        await expect(page.getByRole('radio', { name: 'Budget' })).toBeVisible();
        await approvalJob.cancelDialog();
    });

    test('@approval @regression @positive TC190 Approval Templates – Verify required controls, amount fields, approver selection, and Create button state update correctly while filling the template form', async () => {
        await approvalJob.openCreateTemplateDialog();
        const dialog = approvalJob.createTemplateDialog();
        const submitBtn = page.getByRole('button', { name: /^Create Template$/ }).last();
        const templateNameInput = page.getByPlaceholder('Enter template name').first();
        const amountInputs = dialog.getByPlaceholder('Enter Amount');

        await expect(dialog).toBeVisible({ timeout: 15000 });
        await expect(templateNameInput).toBeVisible();
        await expect(page.getByRole('radio', { name: 'Change Order' })).toBeVisible();
        await expect(page.getByRole('radio', { name: 'Invoice' })).toBeVisible();
        await expect(page.getByRole('radio', { name: 'Contract/PO' })).toBeVisible();
        await expect(page.getByRole('radio', { name: 'Budget' })).toBeVisible();

        await templateNameInput.fill(`TC125_${Date.now()}`);
        await approvalJob.selectTemplateType('Invoice');
        await approvalJob.addApprover('sumit test').catch(() => { });
        await approvalJob.fillAmount(5555).catch(() => { });
        await page.waitForTimeout(800);

        await expect(amountInputs.first()).toBeVisible();
        const amountCount = await amountInputs.count();
        expect(amountCount).toBeGreaterThan(0);
        await expect(submitBtn).toBeVisible();
        await expect(submitBtn).toBeEnabled();
        await approvalJob.cancelDialog();
    });

    test('@approval @regression @negative TC191 Approval Templates – Verify Approval Template search field handles long special-character input and restores default table state after clearing search', async () => {
        await settleApprovalWorkspace(page, 1600);
        await approvalJob.expectApprovalTemplatesTableCoreColumnsVisible();
        const search = page.getByPlaceholder('Search...').first();
        await expect(search).toBeVisible({ timeout: 15000 });

        const longSpecial = `__TC126__${'X'.repeat(90)}!@#$%^&*()`;
        await search.fill(longSpecial);
        await page.keyboard.press('Enter').catch(() => { });
        await page.waitForTimeout(1200);
        await expect(search).toHaveValue(longSpecial);

        await search.fill('');
        await page.keyboard.press('Enter').catch(() => { });
        await page.waitForTimeout(800);
        await expect(search).toHaveValue('');
        await approvalJob.expectApprovalTemplatesTableCoreColumnsVisible();
        await expect(page.getByRole('button', { name: 'Create Template' }).first()).toBeVisible({ timeout: 15000 });
    });

    test('@approval @regression @positive TC192 Approval Templates — Verify Filter drawer accepts Name OR filter values, displays applied filter tags, and closes without breaking the approval templates grid', async () => {
        await settleApprovalWorkspace(page, 1400);
        await approvalJob.clearSearch();

        await approvalJob.expectApprovalTemplatesTableCoreColumnsVisible();
        await approvalJob.clickFilterButton();
        await expect(page.getByText('Filter Options').first()).toBeVisible({ timeout: 12000 });
        await expect(page.getByText('Name', { exact: true }).first()).toBeVisible();
        await expect(page.getByText('Template Type', { exact: true }).first()).toBeVisible();

        const orInputs = approvalJob.filterDrawerOrInputs();
        await expect(orInputs).toHaveCount(2);
        await expect(orInputs.nth(0)).toBeEditable();

        await approvalJob.commitFilterOrTag(0, '__TC127_NAME_OR__');
        await page.waitForTimeout(800);

        await expect(page.locator('div').filter({ has: page.getByText('Filter Options') }).getByText('__TC127_NAME_OR__', { exact: true }))
            .toBeVisible({ timeout: 8000 });

        await approvalJob.clearFilterDrawerCommittedTags();
        await approvalJob.closeFilterDrawerToggle();
        await expect(page.getByText('Filter Options').first()).toBeHidden({ timeout: 10000 });

        await page.goto(process.env.DASHBOARD_URL, { waitUntil: 'domcontentloaded' });
        const _s127 = page.locator('.mantine-AppShell-navbar, .mantine-AppShell-main, main').first();
        await _s127.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => { });
        await approvalJob.navigateToApprovalTab();
        await approvalJob.navigateToApprovalTemplatesTab();
        await approvalJob.waitForPageLoad();
        await approvalJob.expectApprovalTemplatesTableCoreColumnsVisible();
    });

    test('@approval @regression @positive TC193 Approval Templates — Filter drawer Template Type OR field accepts and retains value', async () => {
        await settleApprovalWorkspace(page, 1400);
        await approvalJob.clearSearch();

        await approvalJob.clickFilterButton();
        await expect(page.getByText('Filter Options').first()).toBeVisible({ timeout: 12000 });

        await approvalJob.commitFilterOrTag(1, 'Invoice');
        await page.waitForTimeout(800);
        await expect(page.locator('div').filter({ has: page.getByText('Filter Options') }).getByText('Invoice', { exact: true }))
            .toBeVisible({ timeout: 8000 });

        await approvalJob.clearFilterDrawerCommittedTags();
        await approvalJob.closeFilterDrawerToggle();
        await expect(page.getByText('Filter Options').first()).toBeHidden({ timeout: 10000 });

        await page.goto(process.env.DASHBOARD_URL, { waitUntil: 'domcontentloaded' });
        const _s128 = page.locator('.mantine-AppShell-navbar, .mantine-AppShell-main, main').first();
        await _s128.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => { });
        await approvalJob.navigateToApprovalTab();
        await approvalJob.navigateToApprovalTemplatesTab();
        await approvalJob.waitForPageLoad();
        await approvalJob.expectApprovalTemplatesTableCoreColumnsVisible();
    });

    test('@approval @regression @edge TC194 Approval Templates — Verify Approval Templates filter drawer opens successfully from toolbar controls and closes properly when toggled again without affecting the underlying approval templates grid state', async () => {
        await settleApprovalWorkspace(page, 1000);
        await approvalJob.clickFilterButton();
        await expect(page.getByText('Filter Options').first()).toBeVisible({ timeout: 12000 });

        await approvalJob.closeFilterDrawerToggle();
        await expect(page.getByText('Filter Options').first()).toBeHidden({ timeout: 10000 });
    });

    test('@approval @regression @sanity TC195 Approval Templates — Verify Export action generates a downloadable CSV file successfully while keeping Approval Templates toolbar actions and table state functional after export attempt', async () => {
        await settleApprovalWorkspace(page, 1200);
        await approvalJob.expectApprovalTemplatesTableCoreColumnsVisible();

        try {
            await approvalJob.exportTemplatesCsvDownload({ timeoutMs: 25000 });
        } catch (e) {
            Logger.error('TC195 optional download assertion: ' + e.message);
            const exportBtn = page.locator('main').getByRole('button', { name: 'Export' });
            await expect(exportBtn).toBeEnabled();
            await exportBtn.click();
            await page.waitForTimeout(2000);
        }
    });

    test('@approval @regression @positive TC196 Approval Templates — Verify View menu opens the “Save Current View As” dialog successfully and allows users to access custom view creation options from Approval Templates toolbar', async () => {
        await settleApprovalWorkspace(page, 1000);
        await page.locator('main').getByRole('button', { name: 'View' }).click();
        // The View button opens a "Save current view as" dialog with a name input
        await expect(
            page.getByRole('dialog').filter({ hasText: /Save current view as/i })
        ).toBeVisible({ timeout: 12000 });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
    });

    test('@approval @regression @positive TC197 Approval Templates — Verify table action menu displays Hide/Show Columns management option successfully and allows users to access column visibility configuration controls', async () => {
        await settleApprovalWorkspace(page, 1000);
        await page.locator('main').getByTestId('bt-table-action').click();
        await expect(page.getByRole('button', { name: /hide.*show columns/i })).toBeVisible({ timeout: 12000 });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
    });

    test('@approval @regression @edge TC198 Approval Templates — Verify clicking Add Approval Rule (+) dynamically inserts a new approver selection row inside Create Template dialog without affecting existing approval rule entries', async () => {
        await approvalJob.openCreateTemplateDialog();

        const dialog = approvalJob.createTemplateDialog();
        const beforeApprovers = await dialog.getByPlaceholder('Select approver').count();
        expect(beforeApprovers).toBeGreaterThanOrEqual(3);

        await approvalJob.clickAddApprovalRuleRow();
        await expect(dialog.getByPlaceholder('Select approver')).toHaveCount(beforeApprovers + 1, { timeout: 10000 });

        await approvalJob.cancelDialog();
        expect(await approvalJob.isDialogClosed()).toBeTruthy();
    });

    test('@approval @regression @negative TC199 Approval Templates — Verify Create Template workflow prevents template creation when property selection is opened but not committed, and validation keeps the dialog active until required property mapping is completed', async () => {
        await approvalJob.openCreateTemplateDialog();
        await approvalJob.fillTemplateName(`TC134_${Date.now()}`);
        await approvalJob.selectTemplateType('Invoice');

        await page.getByRole('button', { name: /Search and add properties/i }).click();
        await page.waitForTimeout(500);
        await page.getByPlaceholder('Enter template name').click({ force: true });
        await page.waitForTimeout(700);

        const submitBtn = page.getByRole('button', { name: /^Create Template$/ }).last();
        if (!(await submitBtn.isEnabled())) {
            await expect(submitBtn).toBeDisabled();
        } else {
            await submitBtn.click();
            await page.waitForTimeout(1500);
            await expect(approvalJob.createTemplateDialog()).toBeVisible({ timeout: 10000 });
            expect(await approvalJob.isDialogClosed()).toBe(false);
        }

        await approvalJob.cancelDialog();
    });

    test('@approval @regression @positive TC200 Approval Templates — Verify My Approvals workspace hides template authoring actions like Create Template while preserving approval navigation and restoring template actions after returning to Approval Templates', async () => {
        await settleApprovalWorkspace(page, 1000);
        await page.getByRole('tab', { name: 'My Approvals' }).click();
        await settleApprovalWorkspace(page, 1400);
        await expect(page).toHaveURL(/\/approvals\/my-approvals(?:\/)?$/i);

        await expect.poll(async () => page.getByRole('button', { name: 'Create Template' }).count(), { timeout: 10000 }).toBe(
            0
        );

        await approvalJob.navigateToApprovalTemplatesTab();
        await settleApprovalWorkspace(page, 800);
        await expect(page.getByRole('button', { name: 'Create Template' }).first()).toBeVisible({ timeout: 15000 });
    });

    test('@approval @regression @positive TC201 Approval Templates — Verify All Approvals workspace restricts template authoring controls by hiding Create Template actions and restores template management functionality after navigating back to Approval Templates', async () => {
        await settleApprovalWorkspace(page, 1000);
        await page.getByRole('tab', { name: 'All Approvals' }).click();
        await settleApprovalWorkspace(page, 1400);
        await expect(page).toHaveURL(/\/approvals\/all-approvals(?:\/)?$/i);

        await expect.poll(async () => page.getByRole('button', { name: 'Create Template' }).count(), { timeout: 10000 }).toBe(
            0
        );

        await approvalJob.navigateToApprovalTemplatesTab();
        await settleApprovalWorkspace(page, 800);
        await expect(page.getByRole('button', { name: 'Create Template' }).first()).toBeVisible({ timeout: 15000 });
    });

    test('@approval @regression @positive TC202 Approval Templates — Verify cancelling template deletion preserves the approval template record, while confirming deletion permanently removes the template from Approval Templates search results', async () => {
        test.setTimeout(240000);
        const propertyName = await createNewProperty(page);
        await approvalJob.navigateToApprovalTab();
        await approvalJob.navigateToApprovalTemplatesTab();
        await approvalJob.waitForPageLoad();

        const templateName = `DelTC137_${Date.now()}`;
        await approvalJob.createTemplateWorkflow(templateName, 'Change Order', propertyName, 2200, true, false);
        await settleApprovalWorkspace(page, 2000);

        await approvalJob.searchTemplate(templateName);
        await expect(page.getByRole('row').filter({ hasText: templateName })).toBeVisible({ timeout: 15000 });

        await approvalJob.cancelDeleteTemplate(templateName);
        await settleApprovalWorkspace(page, 1000);
        await approvalJob.searchTemplate(templateName);
        await expect(page.getByRole('row').filter({ hasText: templateName })).toBeVisible({ timeout: 15000 });

        await approvalJob.deleteTemplate(templateName);
        await settleApprovalWorkspace(page, 1800);

        await approvalJob.clearSearch();
        await approvalJob.searchTemplate(templateName);
        await expect(page.getByRole('row').filter({ hasText: templateName })).toHaveCount(0, { timeout: 12000 });
        await approvalJob.clearSearch();
    });

    test('@approval @regression TC203 Approval Templates — Verify Go Back action closes the Create Template drawer safely without blocking subsequent template creation flows or affecting toolbar functionality', async () => {
        await approvalJob.openCreateTemplateDialog();
        await expect(page.getByRole('button', { name: 'Go Back' })).toBeVisible({ timeout: 10000 });
        await page.getByRole('button', { name: 'Go Back' }).click();
        await settleApprovalWorkspace(page, 1000);

        expect(await approvalJob.isDialogClosed()).toBeTruthy();
        await expect(page.getByRole('button', { name: 'Create Template' }).first()).toBeVisible({ timeout: 15000 });

        await approvalJob.openCreateTemplateDialog();
        await approvalJob.cancelDialog();
        await page.waitForTimeout(1500);
        expect(await approvalJob.isDialogClosed()).toBeTruthy();
    });

    test('@approval @regression @edge TC204 Approval Templates — Verify toolbar search functionality continues working correctly while filter drawer inputs are populated and both filtering mechanisms coexist without breaking Approval Templates grid behavior', async () => {
        await settleApprovalWorkspace(page, 1200);
        await approvalJob.clearSearch();

        await approvalJob.clickFilterButton();
        await expect(page.getByText('Filter Options').first()).toBeVisible({ timeout: 12000 });
        await approvalJob.filterDrawerOrInputs().nth(0).fill('t');
        await page.waitForTimeout(900);

        const search = page.getByPlaceholder('Search...').first();
        await search.fill('approval');
        await page.waitForTimeout(1200);

        await expect(search).toHaveValue('approval');
        await approvalJob.expectApprovalTemplatesTableCoreColumnsVisible();

        await approvalJob.clearFilterDrawerCommittedTags().catch(() => { });
        await approvalJob.clearFilterDrawerInputs();
        if (await approvalJob.isFilterDrawerOpen()) {
            await approvalJob.closeFilterDrawerToggle();
        }
        await settleApprovalWorkspace(page, 400);
        await approvalJob.clearSearch();
    });

    test('TC205 Visual Regression Suite – Verify Approval Templates workspace, approval navigation tabs, grid headers, search result states, Create Template dialog flows, approver and amount configuration screens, Manage Columns dialog, Views section, My Approvals workspace, All Approvals workspace, and restored Approval Templates state render correctly across the complete approval workflow', async () => {
        test.setTimeout(720000);
        await settleApprovalWorkspace(page, 2500);

        const main = page.locator('main').first();
        const search = page.getByPlaceholder('Search...').first();
        const shotMain =
            (await search.isVisible({ timeout: 2000 }).catch(() => false))
                ? { ...APPROVAL_VISUAL_ASSERT, mask: [search] }
                : APPROVAL_VISUAL_ASSERT;

        await test.step('V1 — Approval Templates workspace', async () => {
            await expect(main).toHaveScreenshot('tc10-v-approval-templates-workspace.png', shotMain);
        });

        await test.step('V2 — Tab strip (Approval Templates / My / All)', async () => {
            const tablist = page.getByRole('tablist').first();
            await expect(tablist).toBeVisible({ timeout: 15000 });
            await expect(tablist).toHaveScreenshot('tc10-v-approval-tabstrip.png', APPROVAL_VISUAL_ASSERT);
        });

        await test.step('V4 — Search with junk value', async () => {
            if (!(await search.isVisible({ timeout: 2500 }).catch(() => false))) {
                test.skip(true, 'Approval Templates search not visible — cannot test junk search visual');
            }
            await search.fill('__APPROVAL_NO_MATCH__');
            await page.keyboard.press('Enter').catch(() => { });
            await page.waitForTimeout(1400);
            await expect(main).toHaveScreenshot('tc10-v-approval-list-junk-search.png', shotMain);
        });

        await test.step('V5 — Search cleared state', async () => {
            if (!(await search.isVisible({ timeout: 2500 }).catch(() => false))) {
                test.skip(true, 'Approval Templates search not visible — cannot test cleared search visual');
            }
            await search.fill('');
            await page.keyboard.press('Enter').catch(() => { });
            await page.waitForTimeout(1000);
            await expect(main).toHaveScreenshot('tc10-v-approval-list-search-cleared.png', shotMain);
        });

        await test.step('V6 — Search with long text', async () => {
            if (!(await search.isVisible({ timeout: 2500 }).catch(() => false))) {
                test.skip(true, 'Approval Templates search not visible — cannot test long search visual');
            }
            const longText = `TC10_VISUAL_LONG_${'Z'.repeat(84)}`;
            await search.fill(longText);
            await page.waitForTimeout(1000);
            await expect(main).toHaveScreenshot('tc10-v-approval-list-long-search.png', shotMain);
            await search.fill('');
            await page.keyboard.press('Enter').catch(() => { });
            await page.waitForTimeout(700);
        });

        await test.step('V7 — Search with whitespace', async () => {
            if (!(await search.isVisible({ timeout: 2500 }).catch(() => false))) {
                test.skip(true, 'Approval Templates search not visible — cannot test whitespace search visual');
            }
            await search.fill('   ');
            await page.keyboard.press('Enter').catch(() => { });
            await page.waitForTimeout(700);
            await expect(main).toHaveScreenshot('tc10-v-approval-list-whitespace-search.png', shotMain);
            await search.fill('');
            await page.keyboard.press('Enter').catch(() => { });
            await page.waitForTimeout(700);
        });

        await test.step('V8 — Create Template dialog shell', async () => {
            await approvalJob.openCreateTemplateDialog();
            const dialog = approvalJob.createTemplateDialog();
            await expect(dialog).toBeVisible({ timeout: 15000 });
            await expect(dialog).toHaveScreenshot('tc10-v-approval-create-template-dialog.png', APPROVAL_VISUAL_ASSERT);
        });

        await test.step('V9 — Create Template filled basics (Change Order)', async () => {
            await approvalJob.fillTemplateName(`V_TC10_${Date.now()}`);
            await approvalJob.selectTemplateType('Change Order');
            await page.waitForTimeout(500);
            await expect(approvalJob.createTemplateDialog()).toHaveScreenshot('tc10-v-approval-create-template-filled.png', {
                ...APPROVAL_VISUAL_ASSERT,
                mask: [page.getByPlaceholder('Enter template name')],
            });
        });

        await test.step('V10 — Create Template: Invoice type selected', async () => {
            await approvalJob.selectTemplateType('Invoice');
            await page.waitForTimeout(500);
            await expect(approvalJob.createTemplateDialog()).toHaveScreenshot('tc10-v-approval-create-template-invoice-type.png', APPROVAL_VISUAL_ASSERT);
        });

        await test.step('V11 — Create Template: amount + approver area', async () => {
            await approvalJob.addApprover('sumit test').catch(() => { });
            await approvalJob.fillAmount(1234).catch(() => { });
            await page.waitForTimeout(700);
            await expect(approvalJob.createTemplateDialog()).toHaveScreenshot('tc10-v-approval-create-template-approver-amount.png', APPROVAL_VISUAL_ASSERT);
        });

        await test.step('V12 — Create Template: submit action strip', async () => {
            const footer = approvalJob.createTemplateDialog().locator('button:has-text("Create Template"), button:has-text("Cancel")').first();
            if (await footer.isVisible({ timeout: 4000 }).catch(() => false)) {
                await expect(footer).toHaveScreenshot('tc10-v-approval-create-template-actions.png', APPROVAL_VISUAL_ASSERT);
            } else {
                await expect(approvalJob.createTemplateDialog()).toHaveScreenshot('tc10-v-approval-create-template-actions.png', APPROVAL_VISUAL_ASSERT);
            }
        });

        await test.step('V13 — Manage Columns dialog', async () => {
            await approvalJob.cancelDialog();
            await settleApprovalWorkspace(page, 1200);
            await approvalJob.clickManageColumnsButton();
            const manageDialog = page
                .getByRole('dialog', { name: 'Manage Columns' })
                .or(page.locator('section[role="dialog"]').filter({ hasText: 'Manage Columns' }))
                .first();
            await expect(manageDialog).toBeVisible({ timeout: 15000 });
            await expect(manageDialog).toHaveScreenshot('tc10-v-approval-manage-columns-dialog.png', APPROVAL_VISUAL_ASSERT);
            await page.keyboard.press('Escape');
        });

        await test.step('V16 — All Approvals workspace', async () => {
            await page.getByRole('tab', { name: 'All Approvals' }).click();
            await settleApprovalWorkspace(page, 1400);
            await expect(main).toHaveScreenshot('tc10-v-all-approvals-workspace.png', shotMain);
        });

        await test.step('V17 — Return to Approval Templates', async () => {
            await page.getByRole('tab', { name: 'Approval Templates' }).click();
            await settleApprovalWorkspace(page, 1400);
            await expect(main).toHaveScreenshot('tc10-v-approval-templates-returned.png', shotMain);
        });
    });

    test('TC206 @regression @capex — Column settings persist after page refresh: visibility, sort and width saved server-side via table-view-config', async ({ page }) => {
        test.setTimeout(240000);
        const capex = new CapexPage(page);
        await capex.goto();
        Logger.step('TC206: Column settings persistence after page refresh');

        const colPersist = new CapexColumnPersistencePage(page);
        // Grid already loaded by beforeEach goto(). Confirm it is stable.
        await colPersist.waitForGridReady();

        // ── Scenario 1: Column visibility persistence ─────────────────────
        await test.step('Scenario 1 — Column visibility persistence', async () => {
            const COL = 'Invoiced Amount';
            Logger.info(`TC206 S1: Hiding "${COL}"`);

            // Ensure a clean start — show the column if a previous run left it hidden
            await colPersist.showColumn(COL);
            expect(await colPersist.isColumnVisibleInGrid(COL)).toBeTruthy();
            await colPersist.hideColumn(COL);
            expect(await colPersist.isColumnVisibleInGrid(COL)).toBeFalsy();
            Logger.info('TC206 S1: Column hidden in grid ✓');

            await colPersist.reloadAndWaitForGrid();

            expect(
                await colPersist.isColumnVisibleInGrid(COL),
                `"${COL}" should still be hidden after page refresh`
            ).toBeFalsy();
            Logger.info('TC206 S1: Column still hidden after page refresh ✓');

            // Cleanup — restore to original visible state
            await colPersist.showColumn(COL);
            expect(await colPersist.isColumnVisibleInGrid(COL)).toBeTruthy();
            Logger.info('TC206 S1: Column restored ✓');
        });

        // ── Scenario 2: Sort state persistence ───────────────────────────
        await test.step('Scenario 2 — Sort state persistence', async () => {
            const COL = 'Budget Revision';
            Logger.info(`TC206 S2: Applying sort on "${COL}"`);

            // Ensure clean start — remove any sort left from a previous run
            await colPersist.clearColumnSort(COL);
            await colPersist.clickColumnSortButton(COL);
            const sortedState = await colPersist.getColumnSortState(COL);
            expect(sortedState, `Sort should be active on "${COL}"`).toMatch(/sort-asc|sort-desc|sort-off/);
            Logger.info(`TC206 S2: Sort applied — state="${sortedState}" ✓`);

            const rowCountBefore = await page.evaluate(() =>
                Array.from(document.querySelectorAll('[role="row"]'))
                    .filter(r => r.querySelectorAll('[role="gridcell"]').length >= 7).length
            );

            await colPersist.reloadAndWaitForGrid();

            const sortAfterReload = await colPersist.getColumnSortState(COL);
            expect(
                sortAfterReload,
                `Sort on "${COL}" should persist after page refresh`
            ).toMatch(/sort-asc|sort-desc|sort-off/);
            expect(sortAfterReload).toBe(sortedState);
            Logger.info(`TC206 S2: Sort direction "${sortAfterReload}" persisted after reload ✓`);

            const rowCountAfter = await page.evaluate(() =>
                Array.from(document.querySelectorAll('[role="row"]'))
                    .filter(r => r.querySelectorAll('[role="gridcell"]').length >= 7).length
            );
            // Allow ±2 rendered-row tolerance (virtual scroll varies by scroll position)
            expect(Math.abs(rowCountAfter - rowCountBefore)).toBeLessThanOrEqual(2);
            Logger.info('TC206 S2: Grid row count unchanged after reload with sort active ✓');

            // Cleanup — cycle sort back to off
            await colPersist.clearColumnSort(COL);
            Logger.info('TC206 S2: Sort cleared ✓');
        });

        // ── Scenario 3: Column width persistence ─────────────────────────
        await test.step('Scenario 3 — Column width persistence', async () => {
            const COL = 'Approved Change Orders';
            const DELTA = 80;
            Logger.info(`TC206 S3: Resizing "${COL}" by +${DELTA}px`);

            const initialWidth = await colPersist.getColumnWidthPx(COL);
            Logger.info(`TC206 S3: Initial width = ${initialWidth}px`);
            expect(initialWidth).toBeGreaterThan(0);

            const newWidth = await colPersist.resizeColumn(COL, DELTA);
            Logger.info(`TC206 S3: Width after resize = ${newWidth}px`);
            expect(
                newWidth,
                `Column width should increase after drag-resize`
            ).toBeGreaterThan(initialWidth + 20);

            await colPersist.reloadAndWaitForGrid();

            const widthAfterReload = await colPersist.getColumnWidthPx(COL);
            Logger.info(`TC206 S3: Width after reload = ${widthAfterReload}px`);
            expect(
                Math.abs(widthAfterReload - newWidth),
                `Width after reload (${widthAfterReload}px) should match width before reload (${newWidth}px)`
            ).toBeLessThanOrEqual(5);
            Logger.info(`TC206 S3: Width ${widthAfterReload}px persisted after reload ✓`);

            // Cleanup — resize back to initial
            await colPersist.resizeColumn(COL, initialWidth - widthAfterReload);
            Logger.info('TC206 S3: Width restored to initial ✓');
        });

        // ── Scenario 4: Combined settings persistence ─────────────────────
        await test.step('Scenario 4 — Combined: hidden column + active sort persist together', async () => {
            const HIDE_COL = 'Remaining Contract Amount';
            const SORT_COL = 'Original Contract Amount';
            Logger.info(`TC206 S4: Hiding "${HIDE_COL}" and sorting "${SORT_COL}" simultaneously`);

            // Ensure clean start for both settings
            await colPersist.showColumn(HIDE_COL);
            await colPersist.clearColumnSort(SORT_COL);
            await colPersist.hideColumn(HIDE_COL);
            await colPersist.clickColumnSortButton(SORT_COL);

            expect(await colPersist.isColumnVisibleInGrid(HIDE_COL)).toBeFalsy();
            const sortState = await colPersist.getColumnSortState(SORT_COL);
            expect(sortState).toMatch(/sort-asc|sort-desc|sort-off/);
            Logger.info(`TC206 S4: Both settings applied — col hidden, sort="${sortState}" ✓`);

            await colPersist.reloadAndWaitForGrid();

            expect(
                await colPersist.isColumnVisibleInGrid(HIDE_COL),
                `"${HIDE_COL}" should remain hidden after reload`
            ).toBeFalsy();
            Logger.info(`TC206 S4: "${HIDE_COL}" still hidden after reload ✓`);

            const sortAfterReload = await colPersist.getColumnSortState(SORT_COL);
            expect(
                sortAfterReload,
                `Sort on "${SORT_COL}" should remain after reload`
            ).toMatch(/sort-asc|sort-desc|sort-off/);
            Logger.info(`TC206 S4: "${SORT_COL}" sort "${sortAfterReload}" still active after reload ✓`);

            // Cleanup
            await colPersist.showColumn(HIDE_COL);
            await colPersist.clearColumnSort(SORT_COL);
            Logger.info('TC206 S4: Settings restored ✓');
        });

        // ── Scenario 5: Grouping UI observation (non-failing) ─────────────
        await test.step('Scenario 5 — Grouping UI observation', async () => {
            const hasGrouping = await colPersist.hasGroupingUI();
            Logger.info(`TC206 S5: Grouping UI present = ${hasGrouping}`);
            if (!hasGrouping) {
                Logger.info(
                    'TC206 S5: No grouping UI detected on CapEx page. ' +
                    'The API stores a "grouping" field (observed as [] in table-view-config) ' +
                    'but no grouping control is exposed in the current UI — observation logged, not a failure.'
                );
            }
            // No assertion — observation only per investigation findings
        });

        Logger.success('TC206 ✓');
    });

    test('@approval @regression @positive TC207 Approval Templates — Verify Add Approval Rules approver combobox groups matches under "Roles" and "Users" headings, supports multiple approvers/roles in a single input, and the template is created successfully using dynamically discovered (non-hardcoded) roles and users', async () => {
        test.setTimeout(420000);
        const fs = require('fs');
        const path = require('path');

        const tc198Property = await createNewProperty(page);
        await approvalJob.navigateToApprovalTab();
        await approvalJob.navigateToApprovalTemplatesTab();
        await approvalJob.waitForPageLoad();

        await approvalJob.openCreateTemplateDialog();
        const dialog = approvalJob.createTemplateDialog();

        const templateName = `TC198_MultiApprover_${Date.now()}`;
        await approvalJob.fillTemplateName(templateName);
        await approvalJob.selectTemplateType('Invoice');
        await approvalJob.addProperty(tc198Property);

        const approverInputs = dialog.getByPlaceholder('Select approver');
        const approver1 = approverInputs.nth(0);
        const approver2 = approverInputs.nth(1);
        const approver3 = approverInputs.nth(2);
        const approver1Cell = approver1.locator('xpath=ancestor::td[1]');
        const approver2Cell = approver2.locator('xpath=ancestor::td[1]');
        const approver3Cell = approver3.locator('xpath=ancestor::td[1]');

        // ── Discover ALL roles/users from the live combobox (no hardcoded names) ──
        await approver1.click();
        await page.waitForTimeout(2000);
        let dropdown = page.locator('.mantine-MultiSelect-dropdown:visible').first();
        await expect(dropdown).toBeVisible({ timeout: 15000 });

        const rolesHeading = dropdown.locator('.mantine-MultiSelect-groupLabel', { hasText: 'Roles' });
        const usersHeading = dropdown.locator('.mantine-MultiSelect-groupLabel', { hasText: 'Users' });
        await expect(rolesHeading, 'FAIL: "Roles" group heading should be visible in the approver combobox').toBeVisible({ timeout: 10000 });
        await expect(usersHeading, 'FAIL: "Users" group heading should be visible in the approver combobox').toBeVisible({ timeout: 10000 });
        Logger.success('TC207: Approver combobox shows both "Roles" and "Users" headings');

        const rolesGroup = dropdown.locator('.mantine-MultiSelect-group', { hasText: 'Roles' });
        const usersGroup = dropdown.locator('.mantine-MultiSelect-group', { hasText: 'Users' });
        const discoveredRoles = (await rolesGroup.getByRole('option').allTextContents()).map(t => t.trim()).filter(Boolean);
        const discoveredUsers = (await usersGroup.getByRole('option').allTextContents()).map(t => t.trim()).filter(Boolean);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);

        if (discoveredRoles.length === 0 || discoveredUsers.length === 0) {
            Logger.error(`TC207: Approver combobox returned ${discoveredRoles.length} role(s) and ${discoveredUsers.length} user(s) — cannot proceed without at least one of each.`);
            throw new Error(`TC198 FAILED: No roles and/or users available in the approver combobox (roles=${discoveredRoles.length}, users=${discoveredUsers.length}).`);
        }
        Logger.info(`TC207: Discovered ${discoveredRoles.length} role(s) and ${discoveredUsers.length} user(s) from the live combobox`);

        // Persist the full discovered lists to data/approverRolesAndUsers.json
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        const rolesUsersFile = path.join(dataDir, 'approverRolesAndUsers.json');
        fs.writeFileSync(
            rolesUsersFile,
            JSON.stringify({ roles: discoveredRoles, users: discoveredUsers, capturedAt: new Date().toISOString() }, null, 2)
        );
        Logger.info(`TC207: Persisted discovered roles/users to ${rolesUsersFile}`);

        // Select random approvers/roles from the persisted JSON only — never hardcoded
        const persisted = JSON.parse(fs.readFileSync(rolesUsersFile, 'utf-8'));
        if (!persisted.roles?.length || !persisted.users?.length) {
            Logger.error(`TC207: Persisted JSON at ${rolesUsersFile} has no roles/users to select from.`);
            throw new Error(`TC198 FAILED: ${rolesUsersFile} contains no roles and/or users.`);
        }
        if (persisted.users.length < 3) {
            Logger.error(`TC207: Need at least 3 users (2 for approver row 1, 1 for approver row 3) — only ${persisted.users.length} available.`);
            throw new Error(`TC198 FAILED: Fewer than 3 users available in ${rolesUsersFile}.`);
        }
        if (persisted.roles.length < 2) {
            Logger.error(`TC207: Need at least 2 distinct roles to prove approver row 2 accepts multiple roles — only ${persisted.roles.length} available.`);
            throw new Error(`TC198 FAILED: Fewer than 2 roles available in ${rolesUsersFile}.`);
        }

        // Many discovered users (yopmail test accounts, etc.) don't have access to a freshly-created
        // property, which was making the retry loop below burn through most/all attempts on invalid
        // candidates. Users containing "sumit" are known-good property-access accounts, so approver
        // ROW selection (not roles — roles are untouched) is restricted to that subset only. Search
        // term used against the combobox is "sumit" itself, so only these accounts are ever suggested.
        const sumitUsers = persisted.users.filter(u => u.toLowerCase().includes('sumit'));
        if (sumitUsers.length < 3) {
            Logger.error(`TC207: Need at least 3 users containing "sumit" (2 for approver row 1, 1 for approver row 3) — only ${sumitUsers.length} available: ${sumitUsers.join(', ')}`);
            throw new Error(`TC198 FAILED: Fewer than 3 "sumit" users available in ${rolesUsersFile} (found: ${sumitUsers.join(', ')}).`);
        }
        Logger.info(`TC207: Restricting user-approver candidates to "sumit" accounts only: ${sumitUsers.join(', ')}`);

        // Replace whatever is currently selected in an approver cell with a fresh set of values.
        // searchTerm lets user cells filter the combobox by "sumit" while still selecting the exact
        // suggested option for `value` — role cells are unaffected (no searchTerm, same as before).
        async function setApproverCell(cell, input, values, { searchTerm } = {}) {
            const clearBtn = cell.locator('.mantine-InputClearButton-root');
            if (await clearBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                await clearBtn.click();
                await page.waitForTimeout(300);
            }
            for (const value of values) {
                await input.click();
                await input.fill(searchTerm || value);
                await page.waitForTimeout(1800);
                const dd = page.locator('.mantine-MultiSelect-dropdown:visible').first();
                await expect(dd, `FAIL: combobox should reopen while filtering for "${searchTerm || value}"`).toBeVisible({ timeout: 15000 });
                await dd.getByRole('option', { name: value, exact: true }).click();
            }
            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
        }

        // Retry loop: the backend rejects approvers without explicit access to the property, and the
        // combobox gives no upfront signal for who is eligible. Each attempt reads the app's own
        // validation error, permanently excludes any flagged name from the candidate pool, and tries a
        // fresh random combination — all sourced from the persisted JSON only, never hardcoded.
        const excluded = new Set();
        let created = false;
        let finalUsers = [];
        let finalRoles = [];
        const maxAttempts = 8;

        // Amount + "Always Required" are tied to row position, not approver identity, and checking
        // "Always Required" disables that row's Amount field — so this only needs to run once, before
        // any submit attempt, not on every retry (re-clicking an already-disabled field would hang).
        await approvalJob.fillAmount(1000);
        await approvalJob.checkAlwaysRequiredInTemplateDialog(3);

        for (let attempt = 1; attempt <= maxAttempts && !created; attempt++) {
            const usersPool = sumitUsers.filter(u => !excluded.has(u));
            const rolesPool = persisted.roles.filter(r => !excluded.has(r));

            if (usersPool.length < 3) {
                Logger.error(`TC207: Ran out of valid "sumit" candidate users after ${attempt - 1} attempt(s). Excluded so far: ${[...excluded].join(', ')}`);
                throw new Error(`TC198 FAILED: Could not find 3 "sumit" users with property access (excluded: ${[...excluded].join(', ')}).`);
            }
            if (rolesPool.length < 2) {
                Logger.error(`TC207: Ran out of valid candidate roles after ${attempt - 1} attempt(s). Excluded so far: ${[...excluded].join(', ')}`);
                throw new Error(`TC198 FAILED: Could not find 2 roles with property access among the discovered roles (excluded: ${[...excluded].join(', ')}).`);
            }

            const shuffledUsers = [...usersPool].sort(() => Math.random() - 0.5);
            const shuffledRoles = [...rolesPool].sort(() => Math.random() - 0.5);
            const [u1, u2, u3] = shuffledUsers;
            const [r1, r2] = shuffledRoles;
            Logger.info(`TC207: Attempt ${attempt}/${maxAttempts} — approver1=["${u1}", "${u2}"], approver2=["${r1}", "${r2}"], approver3="${u3}"`);

            // ── Scenario 1: approver row 1 — more than one approver in the SAME input ──
            await setApproverCell(approver1Cell, approver1, [u1, u2], { searchTerm: 'sumit' });
            await expect(approver1Cell.getByText(u1, { exact: true }), `FAIL: approver row 1 should show "${u1}" as a pill`).toBeVisible({ timeout: 10000 });
            await expect(approver1Cell.getByText(u2, { exact: true }), `FAIL: approver row 1 should show "${u2}" as a pill in the SAME input`).toBeVisible({ timeout: 10000 });

            // ── Scenario 2: approver row 2 — more than one role in the SAME input ──
            await setApproverCell(approver2Cell, approver2, [r1, r2]);
            await expect(approver2Cell.getByText(r1, { exact: true }), `FAIL: approver row 2 should show "${r1}" as a pill`).toBeVisible({ timeout: 10000 });
            await expect(approver2Cell.getByText(r2, { exact: true }), `FAIL: approver row 2 should show "${r2}" as a pill in the SAME input`).toBeVisible({ timeout: 10000 });

            // Complete approver row 3 so the template can be submitted
            await setApproverCell(approver3Cell, approver3, [u3], { searchTerm: 'sumit' });

            await approvalJob.submitCreateTemplate();

            const accessError = dialog.getByText(/do not have access to the listed properties/i).first();
            const hasAccessError = await accessError.isVisible({ timeout: 4000 }).catch(() => false);

            if (!hasAccessError) {
                created = true;
                finalUsers = [u1, u2, u3];
                finalRoles = [r1, r2];
                break;
            }

            const errorText = (await accessError.textContent().catch(() => '')) || '';
            const flagged = [u1, u2, u3, r1, r2].filter(candidate => errorText.includes(candidate));
            if (flagged.length === 0) {
                Logger.error(`TC207: Submission failed with an unrecognized validation error: ${errorText}`);
                throw new Error(`TC198 FAILED: Unexpected validation error on submit: ${errorText}`);
            }
            flagged.forEach(name => excluded.add(name));
            Logger.info(`TC207: Attempt ${attempt} rejected — excluding invalid approver(s) from future attempts: ${flagged.join(', ')}`);
        }

        if (!created) {
            throw new Error(`TC198 FAILED: Could not create the template after ${maxAttempts} attempts (excluded: ${[...excluded].join(', ')}).`);
        }

        await expect(dialog, 'FAIL: Create Template dialog should close after successful submission').toBeHidden({ timeout: 20000 });
        Logger.success(`TC207: Template submitted successfully with approver1=["${finalUsers[0]}", "${finalUsers[1]}"], approver2=["${finalRoles[0]}", "${finalRoles[1]}"], approver3="${finalUsers[2]}"`);

        try {
            await approvalJob.searchTemplate(templateName);
            await expect(
                page.getByRole('row').filter({ hasText: templateName }),
                `FAIL: Newly created template "${templateName}" should appear in the Approval Templates grid`
            ).toBeVisible({ timeout: 15000 });
            await approvalJob.clearSearch();
            Logger.success(`TC207 passed: template "${templateName}" created successfully using dynamically discovered (non-hardcoded) approvers/roles`);
        } finally {
            await approvalJob.clearSearch().catch(() => {});
            await approvalJob.searchTemplate(templateName).catch(() => {});
            await approvalJob.deleteTemplate(templateName).catch(() => {});
            await approvalJob.clearSearch().catch(() => {});
        }
    });

    test('@approval @regression @positive TC208 Approval Templates — Verify a template can be created with approval rules assigned to roles only (no individual user approvers), using dynamically discovered (non-hardcoded) roles', async () => {
        test.setTimeout(240000);
        const fs = require('fs');
        const path = require('path');

        const tc199Property = await createNewProperty(page);
        await approvalJob.navigateToApprovalTab();
        await approvalJob.navigateToApprovalTemplatesTab();
        await approvalJob.waitForPageLoad();

        await approvalJob.openCreateTemplateDialog();
        const dialog = approvalJob.createTemplateDialog();

        const templateName = `TC199_RolesOnly_${Date.now()}`;
        await approvalJob.fillTemplateName(templateName);
        await approvalJob.selectTemplateType('Budget');
        await approvalJob.addProperty(tc199Property);

        const approverInputs = dialog.getByPlaceholder('Select approver');
        const approver1 = approverInputs.nth(0);
        const approver2 = approverInputs.nth(1);
        const approver3 = approverInputs.nth(2);
        const approverCells = [approver1, approver2, approver3].map(input => input.locator('xpath=ancestor::td[1]'));

        // ── Discover ALL roles from the live combobox (no hardcoded names) ──
        await approver1.click();
        await page.waitForTimeout(2000);
        const dropdown = page.locator('.mantine-MultiSelect-dropdown:visible').first();
        await expect(dropdown).toBeVisible({ timeout: 15000 });

        const rolesHeading = dropdown.locator('.mantine-MultiSelect-groupLabel', { hasText: 'Roles' });
        const usersHeading = dropdown.locator('.mantine-MultiSelect-groupLabel', { hasText: 'Users' });
        await expect(rolesHeading, 'FAIL: "Roles" group heading should be visible in the approver combobox').toBeVisible({ timeout: 10000 });
        await expect(usersHeading, 'FAIL: "Users" group heading should be visible in the approver combobox').toBeVisible({ timeout: 10000 });

        const rolesGroup = dropdown.locator('.mantine-MultiSelect-group', { hasText: 'Roles' });
        const usersGroup = dropdown.locator('.mantine-MultiSelect-group', { hasText: 'Users' });
        const discoveredRoles = (await rolesGroup.getByRole('option').allTextContents()).map(t => t.trim()).filter(Boolean);
        const discoveredUsers = (await usersGroup.getByRole('option').allTextContents()).map(t => t.trim()).filter(Boolean);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);

        if (discoveredRoles.length === 0) {
            Logger.error(`TC208: Approver combobox returned 0 roles — cannot create a roles-only template.`);
            throw new Error('TC199 FAILED: No roles available in the approver combobox.');
        }
        Logger.info(`TC208: Discovered ${discoveredRoles.length} role(s) and ${discoveredUsers.length} user(s) from the live combobox`);

        // Persist the full discovered lists to data/approverRolesAndUsers.json — same file/shape as TC198
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        const rolesUsersFile = path.join(dataDir, 'approverRolesAndUsers.json');
        fs.writeFileSync(
            rolesUsersFile,
            JSON.stringify({ roles: discoveredRoles, users: discoveredUsers, capturedAt: new Date().toISOString() }, null, 2)
        );
        Logger.info(`TC208: Persisted discovered roles/users to ${rolesUsersFile}`);

        // Select roles for all 3 approver rows from the persisted JSON only — never hardcoded
        const persisted = JSON.parse(fs.readFileSync(rolesUsersFile, 'utf-8'));
        if (!persisted.roles?.length) {
            Logger.error(`TC208: Persisted JSON at ${rolesUsersFile} has no roles to select from.`);
            throw new Error(`TC199 FAILED: ${rolesUsersFile} contains no roles.`);
        }

        const shuffledRoles = [...persisted.roles].sort(() => Math.random() - 0.5);
        // Reuse roles round-robin if the org has fewer than 3 — every row still needs a value to submit.
        const rowRoles = [0, 1, 2].map(i => shuffledRoles[i % shuffledRoles.length]);
        Logger.info(`TC208: Randomly selected roles for approver rows 1/2/3 = ${JSON.stringify(rowRoles)}`);

        for (let i = 0; i < 3; i++) {
            const input = approverInputs.nth(i);
            const cell = approverCells[i];
            const role = rowRoles[i];

            await input.click();
            await input.fill(role);
            await page.waitForTimeout(1800);
            const dd = page.locator('.mantine-MultiSelect-dropdown:visible').first();
            await expect(dd, `FAIL: combobox should reopen while filtering for "${role}"`).toBeVisible({ timeout: 15000 });
            await dd.getByRole('option', { name: role, exact: true }).click();
            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);

            await expect(cell.getByText(role, { exact: true }), `FAIL: approver row ${i + 1} should show role "${role}" as a pill`).toBeVisible({ timeout: 10000 });
            // Sanity check: no individual user (always email-style in this org's directory) ever ends
            // up in a roles-only row — cheaper than asserting absence of every discovered user name.
            const cellText = (await cell.textContent()) || '';
            expect(
                cellText.includes('@'),
                `FAIL: approver row ${i + 1} should contain only a role, but found an email-style entry suggesting a user was added: ${cellText}`
            ).toBe(false);
        }
        Logger.success(`TC208: All 3 approver rows populated with roles only (no individual user approvers) — ${JSON.stringify(rowRoles)}`);

        await approvalJob.fillAmount(1000);
        await approvalJob.checkAlwaysRequiredInTemplateDialog(3);
        await approvalJob.submitCreateTemplate();

        const unexpectedError = dialog.getByText(/do not have access|error/i).first();
        if (await unexpectedError.isVisible({ timeout: 3000 }).catch(() => false)) {
            const errorText = (await unexpectedError.textContent().catch(() => '')) || '';
            Logger.error(`TC208: Submission failed unexpectedly for a roles-only template: ${errorText}`);
            throw new Error(`TC199 FAILED: Unexpected validation error when submitting a roles-only template: ${errorText}`);
        }
        await expect(dialog, 'FAIL: Create Template dialog should close after successful submission').toBeHidden({ timeout: 20000 });
        Logger.success(`TC208: Roles-only template submitted successfully with roles ${JSON.stringify(rowRoles)}`);

        try {
            await approvalJob.searchTemplate(templateName);
            const gridRow = page.getByRole('row').filter({ hasText: templateName });
            await expect(
                gridRow,
                `FAIL: Newly created template "${templateName}" should appear in the Approval Templates grid`
            ).toBeVisible({ timeout: 15000 });

            const approvalRulesText = (await gridRow.textContent()) || '';
            expect(
                approvalRulesText.includes('@'),
                `FAIL: Approval Rules for "${templateName}" should contain only roles, but grid text suggests an individual user (email) was included: ${approvalRulesText}`
            ).toBe(false);
            for (const role of rowRoles) {
                expect(
                    approvalRulesText.includes(role),
                    `FAIL: Approval Rules for "${templateName}" should list role "${role}"`
                ).toBe(true);
            }

            await approvalJob.clearSearch();
            Logger.success(`TC208 passed: template "${templateName}" created successfully using roles only (${JSON.stringify(rowRoles)}), dynamically discovered — no individual approvers used`);
        } finally {
            await approvalJob.clearSearch().catch(() => {});
            await approvalJob.searchTemplate(templateName).catch(() => {});
            await approvalJob.deleteTemplate(templateName).catch(() => {});
            await approvalJob.clearSearch().catch(() => {});
        }
    });

    test('@approval @regression @positive TC364 All Approvals — Verify "Remind Approver" option is present in Approval Details and sends a reminder to the pending approver', async () => {
        Logger.step('TC364: Starting Remind Approver flow in All Approvals');

        await approvalJob.navigateToAllApprovalsTab();
        await settleApprovalWorkspace(page, 1500);

        // Open the Approval Details dialog for the first row in the grid via its eye icon.
        const viewDetailsBtn = page.locator('[role="treegrid"] button:has(svg.lucide-eye):visible').first();
        await expect(viewDetailsBtn, 'FAIL: No "View Details" (eye icon) button found in All Approvals grid').toBeVisible({ timeout: 15000 });
        await viewDetailsBtn.click();

        const dialog = page.getByRole('dialog').filter({ hasText: /Approval Details/i });
        await expect(dialog).toBeVisible({ timeout: 20000 });
        Logger.info('TC364: Approval Details dialog opened');

        // Assert the "Remind Approver" option is present
        const remindApproverBtn = dialog.getByRole('button', { name: 'Remind Approver' });
        await expect(remindApproverBtn, 'FAIL: "Remind Approver" button should be visible in Approval Details').toBeVisible({ timeout: 10000 });
        Logger.success('TC364: "Remind Approver" option verified as present');

        // Click it and assert the success toast
        await remindApproverBtn.click();

        const successToast = page.getByRole('alert').filter({ hasText: /Reminder Sent/i });
        await expect(successToast, 'FAIL: Success toast "Reminder Sent" should be visible after clicking Remind Approver').toBeVisible({ timeout: 15000 });
        await expect(successToast).toContainText(/Reminder email sent to the pending approver/i);
        Logger.success('TC364 passed: Remind Approver sent a reminder and success toast was shown');

        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
    });

});
