require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { ApprovalJob } = require('../pages/approvalPage');
const { BudgetJob } = require('../pages/budgetPage');
const { MultiYearBudgetJob } = require('../pages/multiYearBudgetPage');
const { Logger } = require('../utils/logger');
const { ensureLeftPanelExpanded } = require('../utils/leftPanelExpander');

test.use({
    storageState: 'sessionState.json',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
});

let page, approvalJob, budgetJob, mybJob;
let propertyName, budgetItemName, startYear, endYear, propertyId, timestamp;
let negPropertyName;

test.describe('Multi-Year Budget', () => {
    test.describe.configure({ mode: 'serial', retries: 1 });

    test.beforeEach(async ({ page: p }) => {
        page = p;
        approvalJob = new ApprovalJob(page);
        budgetJob = new BudgetJob(page);
        mybJob = new MultiYearBudgetJob(page);
        await page.goto(process.env.DASHBOARD_URL, { waitUntil: 'load' });
        await expect(page).toHaveURL(process.env.DASHBOARD_URL);
        await page.waitForTimeout(7000);
        Logger.info('Dashboard loaded from stored session');
        await ensureLeftPanelExpanded(page);
    });

    test('TC386 @multiYearBudget @sanity @regression @e2e : create a brand-new property', async () => {
        test.setTimeout(120000);
        timestamp = Date.now();
        propertyName = `TC26_MYBProp_${timestamp}`;
        budgetItemName = `MYB_Item_${timestamp}`;
        startYear = 2026;
        endYear = 2036;

        Logger.step('TC386: Creating new property for Multi-Year Budget');
        await approvalJob.createProperty(
            propertyName,
            'Domestic Terminal, College Park, GA 30337, USA',
            'College Park',
            'GA',
            '30337',
            'Garden Style'
        );
        Logger.success(`TC386: Property created — ${propertyName}`);
    });

    test('TC387 @multiYearBudget @sanity @regression @e2e : capture propertyId and persist property data for downstream reuse', async () => {
        test.setTimeout(60000);
        await page.goto(`${process.env.BASE_URL.replace(/\/$/, '')}/properties`, { waitUntil: 'load' });
        await page.waitForTimeout(3000);
        const propertyCard = page.getByText(propertyName, { exact: true }).first();
        await expect(propertyCard, `Newly created property "${propertyName}" must appear in the properties list`).toBeVisible({ timeout: 20000 });
        await propertyCard.scrollIntoViewIfNeeded();
        // MCP-verified live (2026-09-02): occasionally the click on a just-created property's
        // card doesn't register a navigation (real, reproducible timing flake — a fresh run
        // with retries disabled hit this) — retry the click once before failing outright.
        try {
            await propertyCard.click();
            await page.waitForURL(/propertyId=/, { timeout: 20000 });
        } catch (e) {
            Logger.info(`First click on property card didn't navigate (${e.message.substring(0, 80)}) — retrying`);
            await propertyCard.click();
            await page.waitForURL(/propertyId=/, { timeout: 20000 });
        }
        propertyId = new URL(page.url()).searchParams.get('propertyId');
        expect(propertyId, 'propertyId must be extractable from the property detail URL').toBeTruthy();

        const propertyData = { propertyName, propertyId, budgetItemName, startYear, endYear, createdAt: timestamp };
        const filePath = path.join(__dirname, '../data/multiYearBudgetPropertyData.json');
        if (!fs.existsSync(path.dirname(filePath))) fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(propertyData, null, 2));
        const fromDisk = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        expect(fromDisk.propertyName, 'multiYearBudgetPropertyData.json must round-trip the created property name').toBe(propertyName);
        Logger.success(`TC387: Persisted property data (propertyId=${propertyId}) to ${filePath}`);
    });

    test('TC388 @multiYearBudget @sanity @regression @e2e : create first single-year budget with one budget item ($50,000)', async () => {
        test.setTimeout(120000);
        Logger.step('TC388: Creating first single-year budget');
        await budgetJob.navigateToBudget();
        await budgetJob.selectPropertyByName(propertyName);
        await budgetJob.openRevisionEditor();
        await budgetJob.addBudgetItemInRevision('300 - INT_ADA Modifications', budgetItemName, 'Multi-Year Budget automation test item', '50000');
        await budgetJob.clickSubmitForApproval();
        Logger.success(`TC388: Single-year budget submitted with item "${budgetItemName}" ($50,000)`);
    });

    test('TC389 @multiYearBudget @sanity @regression @e2e : verify empty state before any plan exists', async () => {
        test.setTimeout(90000);
        await mybJob.navigateToMultiYearBudget();
        await mybJob.selectPropertyByName(propertyName);
        await mybJob.verifyEmptyStateBeforePlan();
        Logger.success('TC389: Empty state ("Create Your Multi-Year Budget") verified for brand-new property');
    });

    test('TC390 @multiYearBudget @sanity @regression @e2e : initialize plan and verify plan table structure', async () => {
        test.setTimeout(120000);
        await mybJob.navigateToMultiYearBudget();
        await mybJob.selectPropertyByName(propertyName);
        await mybJob.openInitializationDialog();
        await mybJob.verifyInitializationDefaults(startYear, endYear);
        await mybJob.selectBudgetItemInInitDialog(new RegExp(budgetItemName));
        await mybJob.submitInitializationDialog();
        Logger.success('TC390: Multi-year budget plan created (2026-2036) with the new budget item selected');

        await mybJob.verifyPlanTableStructure(budgetItemName);
        await mybJob.verifyYearVisible(startYear);
        await mybJob.verifyYearVisible(startYear + 1);
        Logger.success('TC390: Plan table structure verified — Category/Budget Item rows, Total row, year columns');
    });

    test('TC391 @multiYearBudget @sanity @regression @e2e : real-time propagation of single-year budget into Current Budget', async () => {
        test.setTimeout(150000);
        await mybJob.navigateToMultiYearBudget();
        await mybJob.selectPropertyByName(propertyName);
        const { current: initial } = await mybJob.getCurrentYearRowValues(budgetItemName, startYear);
        expect(initial, 'Current Budget column must reflect the active single-year budget total').toBe('$50,000');
        Logger.success('TC391: Real-time propagation confirmed — Current Budget shows $50,000');

        await budgetJob.navigateToBudget();
        await budgetJob.selectPropertyByName(propertyName);
        await budgetJob.openRevisionEditor();
        await budgetJob.enterRevisionAdjustmentByItemNameV2(budgetItemName, '10000');
        await budgetJob.clickSubmitForApproval();

        await mybJob.navigateToMultiYearBudget();
        await mybJob.selectPropertyByName(propertyName);
        const { current: revised } = await mybJob.getCurrentYearRowValues(budgetItemName, startYear);
        expect(revised, 'Current Budget must update to $60,000 after the budget revision is submitted').toBe('$60,000');
        Logger.success('TC391: Multi-Year Budget Current Budget updated to $60,000 after single-year budget revision');
    });

    test('TC392 @multiYearBudget @regression : health-indicator colouring for negative, zero, and positive variance', async () => {
        test.setTimeout(120000);
        await mybJob.navigateToMultiYearBudget();
        await mybJob.selectPropertyByName(propertyName);

        // Negative variance (Planned < Current) -> red
        await mybJob.openEditPlannedBudgetDialog(budgetItemName, startYear);
        await mybJob.setPlannedBudgetAmount('40000', 'MYB07 automation - negative variance check');
        let color = await mybJob.getVarianceColorCategory(budgetItemName, startYear);
        expect(color, 'Variance must render red when Planned Budget < Current Budget').toBe('red');

        // Zero variance (Planned == Current) -> orange
        await mybJob.openEditPlannedBudgetDialog(budgetItemName, startYear);
        await mybJob.setPlannedBudgetAmount('60000', 'MYB07 automation - zero variance check');
        color = await mybJob.getVarianceColorCategory(budgetItemName, startYear);
        expect(color, 'Variance must render orange/yellow when Planned Budget equals Current Budget').toBe('orange');

        // Positive variance (Planned > Current) -> green
        await mybJob.openEditPlannedBudgetDialog(budgetItemName, startYear);
        await mybJob.setPlannedBudgetAmount('80000', 'MYB07 automation - positive variance check');
        color = await mybJob.getVarianceColorCategory(budgetItemName, startYear);
        expect(color, 'Variance must render green when Planned Budget > Current Budget').toBe('green');

        Logger.success('TC392: Health-indicator colours verified for red/orange/green variance states');
    });

    test('TC393 @multiYearBudget @regression : cross-year reallocation', async () => {
        test.setTimeout(120000);
        await mybJob.navigateToMultiYearBudget();
        await mybJob.selectPropertyByName(propertyName);

        await mybJob.openEditPlannedBudgetDialog(budgetItemName, startYear + 1);
        await mybJob.reallocatePlannedBudget(new RegExp(`${budgetItemName}.*\\(${startYear}\\)`), '10000', 'MYB08 automation - cross-year reallocation');
        const nextYearPlanned = await mybJob.getFutureYearPlannedValue(budgetItemName, startYear + 1);
        expect(nextYearPlanned, `Planned Budget for ${startYear + 1} must reflect the $10,000 reallocated in`).toBe('$10,000');
        Logger.success(`TC393: Cross-year reallocation confirmed — ${startYear + 1} Planned Budget is now $10,000`);
    });

    test('TC394 @multiYearBudget @regression : Upload CSV dialog and template download', async () => {
        test.setTimeout(90000);
        await mybJob.navigateToMultiYearBudget();
        await mybJob.selectPropertyByName(propertyName);

        await mybJob.openUploadCsvDialog();
        const templatePath = await mybJob.downloadCsvTemplate(path.join(__dirname, '../downloads'));
        expect(fs.existsSync(templatePath), 'Downloaded CSV template file must exist on disk').toBeTruthy();
        const templateContent = fs.readFileSync(templatePath, 'utf-8');
        expect(templateContent, 'CSV template header must include Category and Budget Item columns').toMatch(/Category,Budget Item/);
        await mybJob.closeDialog();
        Logger.success('TC394: Upload CSV dialog and template download verified');
    });

    test('TC395 @multiYearBudget @regression : CSV export', async () => {
        test.setTimeout(90000);
        await mybJob.navigateToMultiYearBudget();
        await mybJob.selectPropertyByName(propertyName);

        const exportPath = await mybJob.exportCsv(path.join(__dirname, '../downloads'));
        expect(fs.existsSync(exportPath), 'Exported CSV file must exist on disk').toBeTruthy();
        const exportContent = fs.readFileSync(exportPath, 'utf-8');
        expect(exportContent, 'Exported CSV must include the budget item that was added').toContain(budgetItemName);
        Logger.success('TC395: CSV export verified');
    });

    test('TC396 @multiYearBudget @regression : Reset budget backup gate', async () => {
        test.setTimeout(90000);
        await mybJob.navigateToMultiYearBudget();
        await mybJob.selectPropertyByName(propertyName);

        await mybJob.openResetBudgetDialog();
        await mybJob.verifyResetDisabledUntilDownload();
        await mybJob.cancelResetBudgetDialog();
        Logger.success('TC396: Reset budget backup-gate verified (cancelled without resetting)');
    });

    test('TC397 @multiYearBudget @regression : Settings dialog fields and no Capital Envelope field', async () => {
        test.setTimeout(90000);
        await mybJob.navigateToMultiYearBudget();
        await mybJob.selectPropertyByName(propertyName);

        await mybJob.openSettingsDialog();
        await mybJob.verifyInitializationDefaults(startYear, endYear);
        await mybJob.verifyNoCapitalEnvelopeFieldInSettings();
        await mybJob.cancelSettingsDialog();
        Logger.success('TC397: Settings dialog verified — no Total Capital Envelope field present (ticket/app gap)');
    });

    test('TC398 @multiYearBudget @regression : history log records plan creation', async () => {
        test.setTimeout(90000);
        await mybJob.navigateToMultiYearBudget();
        await mybJob.selectPropertyByName(propertyName);

        await mybJob.openHistoryDialog();
        await mybJob.verifyHistoryContainsText('created this multi-year budget');
        await mybJob.closeDialog();
        Logger.success('TC398: History log entry for plan creation verified');
    });

    test('TC399 @multiYearBudget @regression : no Portfolio Roll-Up view exists (documents AC13 gap)', async () => {
        test.setTimeout(120000);
        await mybJob.navigateToMultiYearBudget();
       const portfolioNavEntry = page.locator('nav').getByText(/portfolio/i);
        await expect(portfolioNavEntry, 'No "Portfolio" navigation entry should currently exist (AC13 not implemented)').toHaveCount(0);
        Logger.success('TC399: Confirmed no Portfolio Roll-Up navigation entry exists — AC13 remains unimplemented');
    });

    test('TC400 @multiYearBudget @regression : second test account has full edit access (documents AC14 gap)', async ({ browser }) => {
        test.setTimeout(180000);
        const propertyDataPath = path.join(__dirname, '../data/multiYearBudgetPropertyData.json');
        test.skip(!fs.existsSync(propertyDataPath), 'Requires MYB02 to have run first and persisted a property');
        const { propertyId: savedPropertyId, propertyName: savedPropertyName } = JSON.parse(fs.readFileSync(propertyDataPath, 'utf-8'));
        const otherContext = await browser.newContext({ storageState: 'OtherSessionState.json' });
        const otherPage = await otherContext.newPage();
        await otherPage.goto(`${process.env.BASE_URL.replace(/\/$/, '')}/financials/multi-year-budget?propertyId=${savedPropertyId}`, { waitUntil: 'load' });
        await otherPage.waitForTimeout(4000);
        const landedOnProperty = await otherPage.getByText(savedPropertyName, { exact: true }).first().isVisible({ timeout: 10000 }).catch(() => false);
        if (!landedOnProperty) {
            Logger.info(`TC400: Second account (OtherSessionState.json) could not reach property "${savedPropertyName}" directly — likely a separate org/property scope, not a role restriction. AC14 remains unverified rather than confirmed either way.`);
            test.skip(true, 'Second test account does not have visibility into the property created by the primary account');
            return;
        }

        await expect(otherPage.locator('button:has(svg.lucide-plus)').first(), 'Second account currently still has the Add Budget Item control visible/enabled').toBeVisible({ timeout: 15000 });
        Logger.success('TC400: Confirmed second account has full edit access — no role-based read-only restriction is enforced yet (AC14 not implemented)');
    });

    test('TC401 @multiYearBudget @regression : Save stays disabled without Reason in "Set amount" mode', async () => {
        test.setTimeout(90000);
        await mybJob.navigateToMultiYearBudget();
        await mybJob.selectPropertyByName(propertyName);

        await mybJob.openEditPlannedBudgetDialog(budgetItemName, 2032);
        await mybJob.fillSetAmountFieldOnly('15000');
        await mybJob.assertEditSaveDisabled();
        await mybJob.cancelEditPlannedBudgetDialog();
        Logger.success('TC401: Save correctly stayed disabled with a valid amount but no Reason ("Set amount" mode)');
    });

    test('TC402 @multiYearBudget @regression : Save stays disabled without Reason in "Reallocate" mode', async () => {
        test.setTimeout(90000);
        await mybJob.navigateToMultiYearBudget();
        await mybJob.selectPropertyByName(propertyName);

        await mybJob.openEditPlannedBudgetDialog(budgetItemName, 2033);
        await mybJob.fillReallocateFieldsOnly(new RegExp(`${budgetItemName}.*\\(${startYear}\\)`), '5000');
        await mybJob.assertEditSaveDisabled();
        await mybJob.cancelEditPlannedBudgetDialog();
        Logger.success('TC402: Save correctly stayed disabled with a valid source + amount but no Reason ("Reallocate" mode)');
    });

    test('TC403 @multiYearBudget @regression : Cancel on Edit Planned Budget dialog discards changes', async () => {
        test.setTimeout(90000);
        await mybJob.navigateToMultiYearBudget();
        await mybJob.selectPropertyByName(propertyName);

        const before = await mybJob.getFutureYearPlannedValue(budgetItemName, 2034);
        await mybJob.openEditPlannedBudgetDialog(budgetItemName, 2034);
        await mybJob.fillSetAmountFieldOnly('12345');
        await mybJob.cancelEditPlannedBudgetDialog();
        const after = await mybJob.getFutureYearPlannedValue(budgetItemName, 2034);
        expect(after, 'Cancelling the dialog must discard the typed amount, leaving the cell unchanged').toBe(before);
        Logger.success(`TC403: Confirmed Cancel discarded the typed amount — year 2034 Planned Budget still "${after}"`);
    });

    test('TC404 @multiYearBudget @regression : negative "Set amount" input is silently clamped to $0.00', async () => {
        test.setTimeout(90000);
        await mybJob.navigateToMultiYearBudget();
        await mybJob.selectPropertyByName(propertyName);

        await mybJob.openEditPlannedBudgetDialog(budgetItemName, 2035);
        const displayed = await mybJob.fillPlannedBudgetAmountAndReadDisplayed('-5000');
        expect(displayed, 'A negative planned-budget amount must be clamped to $0.00 by the numeric stepper, not accepted as negative').toBe('$0.00');
        await mybJob.cancelEditPlannedBudgetDialog();
        Logger.success('TC404: Confirmed negative amount input is silently clamped to $0.00 (no validation error shown)');
    });

    test('TC405 @multiYearBudget @regression : clearing the Planned Budget field clears the cell', async () => {
        test.setTimeout(90000);
        await mybJob.navigateToMultiYearBudget();
        await mybJob.selectPropertyByName(propertyName);
        await mybJob.openEditPlannedBudgetDialog(budgetItemName, startYear + 1);
        await mybJob.setPlannedBudgetAmount('', 'TC405 automation - clear planned budget check');
        const itemValue = await mybJob.getFutureYearPlannedValue(budgetItemName, startYear + 1);
        expect(itemValue, 'Leaving the amount empty must clear the planned budget for that cell, per the dialog\'s own hint text').toBe('—');
        const totalValue = await mybJob.getFutureYearPlannedValue('Total', startYear + 1);
        expect(totalValue, 'The Total row must recalculate to $0 after the item\'s planned budget is cleared').toBe('$0');
        Logger.success(`TC405: Confirmed clearing the field cleared year ${startYear + 1}'s Planned Budget to "—" and the Total row recalculated to $0`);
    });

    test('TC406 @multiYearBudget @regression : "Reallocate from" excludes the year being edited', async () => {
        test.setTimeout(90000);
        await mybJob.navigateToMultiYearBudget();
        await mybJob.selectPropertyByName(propertyName);

        const targetYear = 2028;
        await mybJob.openEditPlannedBudgetDialog(budgetItemName, targetYear);
        const options = await mybJob.getReallocateFromOptionTexts();
        expect(options.length, 'The "Reallocate from" list must offer at least one source year').toBeGreaterThan(0);
        const includesOwnYear = options.some((text) => text.includes(`(${targetYear})`));
        expect(includesOwnYear, `"Reallocate from" must not list year ${targetYear} as a source for itself`).toBe(false);
        await mybJob.cancelEditPlannedBudgetDialog();
        Logger.success(`TC406: Confirmed year ${targetYear} does not appear as its own reallocation source`);
    });

    test('TC407 @multiYearBudget @regression : "Reallocate from" lists zero-balance years as valid options', async () => {
        test.setTimeout(90000);
        await mybJob.navigateToMultiYearBudget();
        await mybJob.selectPropertyByName(propertyName);

        // Year 2028 has never had a planned budget set, so it renders "—" (zero balance).
        await mybJob.openEditPlannedBudgetDialog(budgetItemName, 2030);
        const options = await mybJob.getReallocateFromOptionTexts();
        const zeroBalanceOption = options.find((text) => text.includes('(2028)'));
        expect(zeroBalanceOption, 'A zero-balance year must still be listed as a selectable "Reallocate from" option (only Save-time validation rejects it)').toBeTruthy();
        expect(zeroBalanceOption).toContain('—');
        await mybJob.cancelEditPlannedBudgetDialog();
        Logger.success(`TC407: Confirmed zero-balance year 2028 is listed as a selectable option: "${zeroBalanceOption}"`);
    });

    test('TC408 @multiYearBudget @regression : reallocating more than the source year\'s balance is rejected', async () => {
        test.setTimeout(90000);
        await mybJob.navigateToMultiYearBudget();
        await mybJob.selectPropertyByName(propertyName);

        const targetYear = 2031;
        const beforeValue = await mybJob.getFutureYearPlannedValue(budgetItemName, targetYear);
        await mybJob.openEditPlannedBudgetDialog(budgetItemName, targetYear);
        await mybJob.attemptReallocationExpectingFailure(
            new RegExp(`${budgetItemName}.*\\(2029\\)`),
            '50000',
            'TC408 automation - over-allocation from a zero-balance year',
            // MCP-verified live (2026-09-03): leftover from the "Planned Budget" →
            // "Proforma/Underwriting Budget" column rename — the toast body itself renamed too.
            'Insufficient Proforma/Underwriting budget in source cell'
        );
        await mybJob.cancelEditPlannedBudgetDialog();
        const afterValue = await mybJob.getFutureYearPlannedValue(budgetItemName, targetYear);
        expect(afterValue, 'A rejected reallocation must not mutate the target year\'s Planned Budget').toBe(beforeValue);
        Logger.success(`TC408: Confirmed over-allocation from a zero-balance source year was rejected and year ${targetYear} stayed at "${afterValue}"`);
    });

    test('TC409 @multiYearBudget @regression : CSV upload missing required columns is rejected', async () => {
        test.setTimeout(90000);
        await mybJob.navigateToMultiYearBudget();
        await mybJob.selectPropertyByName(propertyName);

        const invalidCsvPath = path.join(__dirname, '../downloads', `myb_invalid_upload_${Date.now()}.csv`);
        fs.writeFileSync(invalidCsvPath, 'Foo,Bar,Baz\n1,2,3\n');

        await mybJob.openUploadCsvDialog();
        await mybJob.uploadCsvFile(invalidCsvPath);
        await mybJob.verifyCsvUploadRejected('CSV must include "Category" and "Budget Item" columns.');
        await mybJob.closeDialog();
        Logger.success('TC409: Confirmed a CSV missing the required Category/Budget Item columns is rejected with an inline error');
    });

    test('TC410 @multiYearBudget @regression : CSV upload auto-creates a new budget item', async () => {
        test.setTimeout(90000);
        await mybJob.navigateToMultiYearBudget();
        await mybJob.selectPropertyByName(propertyName);

        const newItemName = `TC410_CsvNewItem_${Date.now()}`;
        const validCsvPath = path.join(__dirname, '../downloads', `tc410_valid_new_item_upload_${Date.now()}.csv`);
        fs.writeFileSync(validCsvPath, `Category,Budget Item,${startYear}\nUncategorized,${newItemName},5000\n`);

        await mybJob.openUploadCsvDialog();
        await mybJob.uploadCsvFile(validCsvPath);
        await mybJob.verifyCsvUploadCreatedNewItem(newItemName);
        await mybJob.closeDialog();

        const importedValue = await mybJob.getFutureYearPlannedValue(newItemName, startYear);
        expect(importedValue, 'The auto-created item must show the imported year\'s Planned Budget amount').toBe('$5,000');
        Logger.success(`TC410: Confirmed CSV upload auto-created budget item "${newItemName}" with ${startYear} Planned Budget of $5,000`);
    });

    test('TC411 @multiYearBudget @regression : a plan created with zero budget items shows a distinct empty state', async () => {
        test.setTimeout(150000);
        negPropertyName = `TC411_NegProp_${Date.now()}`;
        await approvalJob.createProperty(
            negPropertyName,
            'Domestic Terminal, College Park, GA 30337, USA',
            'College Park',
            'GA',
            '30337',
            'Garden Style'
        );

        await mybJob.navigateToMultiYearBudget();
        await mybJob.selectPropertyByName(negPropertyName);
        await mybJob.verifyEmptyStateBeforePlan();

        await mybJob.openInitializationDialog();
        await mybJob.submitInitializationDialogExpectingZeroItems();
        await mybJob.verifyZeroItemPlanEmptyState();
        Logger.success(`TC411: Confirmed a zero-item plan is accepted and renders "No multi year budget details added yet" (property: ${negPropertyName})`);
    });

    test('TC412 @multiYearBudget @regression : an invalid hold period (End Year < Start Year) is silently rejected', async () => {
        test.setTimeout(90000);
        await mybJob.navigateToMultiYearBudget();
        await mybJob.selectPropertyByName(negPropertyName);

        await mybJob.openSettingsDialog();
        await mybJob.setHoldPeriodEndYear('2020');
        await mybJob.applySettingsDialog();

        await mybJob.openSettingsDialog();
        const endYearAfter = await mybJob.getHoldPeriodEndYearValue();
        expect(endYearAfter, 'An invalid hold period (End < Start) must not be persisted — the app shows no error but silently reverts it').toBe('2036');
        await mybJob.cancelSettingsDialog();
        Logger.success('TC412: Confirmed an invalid hold period (End Year < Start Year) is silently rejected with no user-facing error (UX gap)');
    });

    test('TC413 @multiYearBudget @regression : Select all / Deselect all toggle the full item list', async () => {
        test.setTimeout(150000);
        await budgetJob.navigateToBudget();
        await budgetJob.selectPropertyByName(negPropertyName);
        await budgetJob.openRevisionEditor();
        await budgetJob.addBudgetItemInRevision('300 - INT_ADA Modifications', `NegItem1_${Date.now()}`, 'Negative-case catalog item 1', '1000');
        await budgetJob.addBudgetItemInRevision('300 - INT_ADA Modifications', `NegItem2_${Date.now()}`, 'Negative-case catalog item 2', '1000');
        await budgetJob.clickSubmitForApproval();

        await mybJob.navigateToMultiYearBudget();
        await mybJob.selectPropertyByName(negPropertyName);
        await mybJob.openSettingsDialog();
        let summary;
        await expect.poll(async () => {
            summary = await mybJob.getItemCheckboxSummary();
            if (summary.total <= 1) {
                await mybJob.cancelSettingsDialog();
                await mybJob.openSettingsDialog();
            }
            return summary.total;
        }, { timeout: 45000, intervals: [3000] }).toBeGreaterThan(1);
        expect(summary.checked, 'No items should be selected initially on this zero-item plan').toBe(0);

        await mybJob.clickSelectAllItems();
        summary = await mybJob.getItemCheckboxSummary();
        expect(summary.checked, '"Select all" must check every item in the list').toBe(summary.total);

        await mybJob.clickDeselectAllItems();
        summary = await mybJob.getItemCheckboxSummary();
        expect(summary.checked, '"Deselect all" must uncheck every item in the list').toBe(0);

        await mybJob.cancelSettingsDialog();
        Logger.success(`TC413: Confirmed Select all / Deselect all correctly toggled all ${summary.total} items`);
    });

    test('TC414 @multiYearBudget @regression : item search with no match shows an empty-result message', async () => {
        test.setTimeout(90000);
        await mybJob.navigateToMultiYearBudget();
        await mybJob.selectPropertyByName(negPropertyName);

        await mybJob.openSettingsDialog();
        await mybJob.searchItemSelectionList('zzz_nonexistent_item_xyz');
        await mybJob.verifyNoItemsMatchSearchMessage();
        await mybJob.verifySelectAllAndDeselectAllDisabled();
        await mybJob.cancelSettingsDialog();
        Logger.success('TC414: Confirmed a non-matching item search shows "No items match your search." and disables Select all/Deselect all');
    });

    test('TC415 @multiYearBudget @regression : property switcher search with no match shows an empty-result message', async () => {
        test.setTimeout(90000);
        await mybJob.navigateToMultiYearBudget();
        await mybJob.searchPropertySwitcher('nonexistent_property_zzz_123');
        await mybJob.verifyNoPropertiesFoundMessage();
        Logger.success('TC415: Confirmed a non-matching property search shows "No properties found"');
    });
});
