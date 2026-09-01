require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { ApprovalJob } = require('../pages/approvalPage');
const { DrawReportingJob } = require('../pages/drawReportingPage');
const { Logger } = require('../utils/logger');
const { captureDrawReportingUi, compareUiSnapshotToBaseline } = require('../utils/uiSnapshotCapture');
const { ensureLeftPanelExpanded } = require('../utils/leftPanelExpander');

const { withExtendedTerminalWait, retryOperation } = require('../utils/resilientRetry');
const { drawReportingLocators } = require('../locators/drawReportingLocator');

test.use({
    storageState: 'sessionState.json',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
});

let page, approvalJob, drawReportingJob;

const REAL_APPROVER_FULL_NAME = 'Sumit Mishra';

async function approveDrawAsRealApprover(browser, propertyName, drawName) {
    const approverContext = await browser.newContext({ storageState: 'OtherSessionState.json' });
    const approverPage = await approverContext.newPage();
    const approverDrawReportingJob = new DrawReportingJob(approverPage);
    await approverDrawReportingJob.navigateToMyApprovalsTab();
    const approved = await approverDrawReportingJob.attemptApproveDraw(propertyName, drawName, { tab: 'mine' });
    return { approved, approvedByFullName: REAL_APPROVER_FULL_NAME };
}

async function rejectDrawAsRealApprover(browser, propertyName, drawName, note) {
    const approverContext = await browser.newContext({ storageState: 'OtherSessionState.json' });
    const approverPage = await approverContext.newPage();
    const approverDrawReportingJob = new DrawReportingJob(approverPage);
    await approverDrawReportingJob.navigateToMyApprovalsTab();
    const rejected = await approverDrawReportingJob.attemptRejectDraw(propertyName, drawName, note, { tab: 'mine' });
    return { rejected, rejectedByFullName: REAL_APPROVER_FULL_NAME };
}

test.describe('Draw Reporting', () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeEach(async ({ page: p }) => {
        page = p;
        approvalJob = new ApprovalJob(page);
        drawReportingJob = new DrawReportingJob(page);
        await page.goto(process.env.DASHBOARD_URL, { waitUntil: 'load' });
        await expect(page).toHaveURL(process.env.DASHBOARD_URL);
        await page.waitForTimeout(7000);
        Logger.info('Dashboard loaded from stored session');
        await ensureLeftPanelExpanded(page);
    });

    test('TC372 @drawReporting @sanity @regression : Verify Draw Reporting empty state, grid controls, Create Draw flow, and draw impact', async () => {
        test.setTimeout(600000);

        const consoleErrors = [];
        const pageErrors = [];
        const failedResponses = [];
        page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
        page.on('pageerror', (err) => pageErrors.push(err.message));
        page.on('response', (response) => {
            if (response.url().includes('/api/') && response.status() >= 400) {
                failedResponses.push(`${response.status()} ${response.url()}`);
            }
        });

        const timestamp = Date.now();
        const propertyName = `TC372_DrawReportProp_${timestamp}`;

        Logger.step('TC372 Step 1: Creating new property for Draw Reporting');
        await approvalJob.createProperty(
            propertyName,
            'Domestic Terminal, College Park, GA 30337, USA',
            'College Park',
            'GA',
            '30337',
            'Garden Style'
        );
        Logger.success(`TC372 Step 1: Property created — ${propertyName}`);

        await test.step('Write drawReportingPropertyData.json for downstream Draw Reporting tests', async () => {
            const propertyData = { propertyName, createdAt: timestamp };
            const filePath = path.join(__dirname, '../data/drawReportingPropertyData.json');
            if (!fs.existsSync(path.dirname(filePath))) fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, JSON.stringify(propertyData, null, 2));
            const fromDisk = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            expect(fromDisk.propertyName, 'drawReportingPropertyData.json must round-trip the created property name').toBe(propertyName);
            Logger.success(`TC372 Step 2: Persisted property name to ${filePath}`);
        });

        Logger.step('TC372 Step 3: Navigating to Draw Reporting');
        await drawReportingJob.navigateToDrawReporting();
        await drawReportingJob.selectPropertyByName(propertyName);
        await drawReportingJob.assertSelectedPropertyIs(propertyName);
        Logger.success('TC372 Step 3: Draw Reporting loaded for the newly created property');

        Logger.step('TC372 Step 4: Verifying Overview tab empty state');
        await drawReportingJob.verifyOverviewEmptyState();

        Logger.step('TC372 Step 5: Verifying Historical Draws tab empty state');
        await drawReportingJob.openHistoricalDrawsTab();
        await drawReportingJob.verifyHistoricalDrawsEmptyState();
        await drawReportingJob.openOverviewTab();
        Logger.success('TC372 Step 5: Historical Draws empty state verified');

        Logger.step('TC372 Step 6: Verifying Create Draw modal Step 1');
        await drawReportingJob.openCreateDrawModal();
        await drawReportingJob.verifyCreateDrawModalStepOne();
        await drawReportingJob.closeCreateDrawModal();
        Logger.success('TC372 Step 6: Create Draw Step 1 verified without submitting a draw');

        Logger.step('TC372 Step 7: Capturing and asserting every Budget Overview and Historical Draws control');
        const budgetOverviewControls = await drawReportingJob.captureAllBudgetOverviewControls();
        await drawReportingJob.openHistoricalDrawsTab();
        const historicalDrawsControls = await drawReportingJob.captureAllHistoricalDrawsControls();
        await drawReportingJob.openOverviewTab();

        const allControlsSnapshot = { budgetOverviewControls, historicalDrawsControls };
        const capturedControlsPath = path.join(__dirname, '../downloads/drawReportingControlsSnapshot.json');
        if (!fs.existsSync(path.dirname(capturedControlsPath))) fs.mkdirSync(path.dirname(capturedControlsPath), { recursive: true });
        fs.writeFileSync(capturedControlsPath, JSON.stringify(allControlsSnapshot, null, 2));

        const controlsBaselinePath = path.join(__dirname, '../fixture/drawReportingControlsBaseline.json');
        compareUiSnapshotToBaseline({ baselinePath: controlsBaselinePath, liveSnapshot: allControlsSnapshot, expect });
        Logger.success('TC372 Step 7: Every grid control text captured, asserted, and compared against committed baseline');

        Logger.step('TC372 Step 8: Creating a draw end-to-end and asserting its impact');
        const drawName = `TC372_Draw_${timestamp}`;
        await drawReportingJob.createDraw(drawName, '07/01/2026', '07/31/2026');
        await drawReportingJob.verifyDrawEditorStepTwo(drawName);
        await drawReportingJob.closeDrawEditor();
        await drawReportingJob.verifyActiveDrawImpact(drawName);
        await drawReportingJob.verifyBudgetOverviewUnaffectedByDraft();
        await drawReportingJob.verifyHistoricalDrawsUnaffectedByDraft();
        Logger.success(`TC372 Step 8: Draw "${drawName}" created end-to-end; impact on KPIs, Active Draw card, and both grids asserted`);

    });

    test('TC373 @drawReporting @regression : Verify Draw Reporting populated data, grid controls, and Create Draw modal', async () => {
        test.setTimeout(600000);

        const consoleErrors = [];
        const pageErrors = [];
        const failedResponses = [];
        page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
        page.on('pageerror', (err) => pageErrors.push(err.message));
        page.on('response', (response) => {
            if (response.url().includes('/api/') && response.status() >= 400) {
                failedResponses.push(`${response.status()} ${response.url()}`);
            }
        });

        const propertyName = 'Test Property 6_Draw reporting';

        Logger.step('TC373 Step 1: Navigating to Draw Reporting and selecting the existing property');
        await drawReportingJob.navigateToDrawReporting();
        await drawReportingJob.selectPropertyByName(propertyName);
        await drawReportingJob.assertSelectedPropertyIs(propertyName);
        Logger.success(`TC373 Step 1: Draw Reporting loaded for "${propertyName}"`);

        Logger.step('TC373 Step 2: Verifying Overview tab data exists and is validly formatted');
        const overviewKpis = await drawReportingJob.verifyOverviewKpisExistAndValid();
        const budgetOverviewResult = await drawReportingJob.verifyBudgetOverviewLogical();
        const capexStatus = await drawReportingJob.verifyCapexStatusHasValidValues();
        Logger.success('TC373 Step 2: Overview tab data verified logically (existence + format, not fixed values)');

        Logger.step('TC373 Step 3: Verifying Historical Draws tab data exists and is validly formatted');
        await drawReportingJob.openHistoricalDrawsTab();
        const historicalKpis = await drawReportingJob.verifyHistoricalDrawsKpisExistAndValid();
        const historicalDrawsResult = await drawReportingJob.verifyHistoricalDrawsLogical();
        await drawReportingJob.openOverviewTab();
        Logger.success('TC373 Step 3: Historical Draws tab data verified logically (existence + format, not fixed values)');

        Logger.step('TC373 Step 4: Verifying Create Draw modal Step 1 (same static UI as any property)');
        await drawReportingJob.openCreateDrawModal();
        await drawReportingJob.verifyCreateDrawModalStepOne();
        await drawReportingJob.closeCreateDrawModal();
        Logger.success('TC373 Step 4: Create Draw Step 1 verified without submitting a draw');

        Logger.step('TC373 Step 5: Capturing and asserting every grid control matches the same static baseline as TC372');
        const budgetOverviewControls = await drawReportingJob.captureAllBudgetOverviewControls();
        await drawReportingJob.openHistoricalDrawsTab();
        const historicalDrawsControls = await drawReportingJob.captureAllHistoricalDrawsControls();
        await drawReportingJob.openOverviewTab();

        const allControlsSnapshot = { budgetOverviewControls, historicalDrawsControls };
        const controlsBaselinePath = path.join(__dirname, '../fixture/drawReportingControlsBaseline.json');
        compareUiSnapshotToBaseline({ baselinePath: controlsBaselinePath, liveSnapshot: allControlsSnapshot, expect });
        Logger.success('TC373 Step 5: Grid controls (Filter/View/Table/Export, column names) match the same static baseline as the brand-new-property test');

    });

    test('TC374 @drawReporting @regression : Verify Draw creation, active draw state, and draft discard flow', async () => {
        test.setTimeout(600000);

        const consoleErrors = [];
        const pageErrors = [];
        const failedResponses = [];
        page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
        page.on('pageerror', (err) => pageErrors.push(err.message));
        page.on('response', (response) => {
            if (response.url().includes('/api/') && response.status() >= 400) {
                failedResponses.push(`${response.status()} ${response.url()}`);
            }
        });

        const propertyName = 'Test Property 6_Draw reporting';
        const timestamp = Date.now();
        const drawName = `TC374_Draw_${timestamp}`;

        Logger.step('TC374 Step 1: Navigating to Draw Reporting and selecting the existing property');
        await drawReportingJob.navigateToDrawReporting();
        await drawReportingJob.selectPropertyByName(propertyName);
        await drawReportingJob.assertSelectedPropertyIs(propertyName);
        Logger.success(`TC374 Step 1: Draw Reporting loaded for "${propertyName}"`);

        Logger.step('TC374 Step 2: Creating a new draw end-to-end');
        await drawReportingJob.createDraw(drawName, '07/01/2026', '07/31/2026');
        await drawReportingJob.verifyDrawEditorNameAndStatus(drawName);
        Logger.success(`TC374 Step 2: Draw "${drawName}" created — toast confirmed, editor opened in Draft status`);

        Logger.step('TC374 Step 3: Verifying the created draw is available');
        await drawReportingJob.closeDrawEditor();
        const impact = await drawReportingJob.verifyActiveDrawImpactLogical(drawName);
        Logger.success(`TC374 Step 3: Confirmed draw "${drawName}" is available (Active Draw card, KPI "${impact.activeDrawValue}", Continue Editing, Create Draw disabled)`);

        Logger.step('TC374 Step 4: Discarding the draft draw to restore the shared property');
        await drawReportingJob.reopenActiveDraw();
        await drawReportingJob.verifyDrawEditorNameAndStatus(drawName);
        await drawReportingJob.discardDraw();
        Logger.success('TC374 Step 4: Draft draw discarded — Create Draw re-enabled, property restored');

        await drawReportingJob.openHistoricalDrawsTab();
        const historicalRowForDiscardedDraw = page.getByText(drawName, { exact: true });
        await expect(historicalRowForDiscardedDraw, 'Discarded draw must not appear in Historical Draws').toHaveCount(0);
        await drawReportingJob.openOverviewTab();
        Logger.success('TC374 Step 5: Confirmed the discarded draw left no trace in Historical Draws');

    });

    test('TC375 @drawReporting @regression : Verify Draw approval flow, CM Fee update, approver access, and final status', async ({ browser }) => {
        test.setTimeout(600000);

        const propertyName = 'Test Property 6_Draw reporting';
        const jobId = 4330;
        const timestamp = Date.now();
        const drawName = `TC375_Draw_${timestamp}`;
        const currentUserFullName = 'Sumit Harsh';
        const eligibleApproverFullName = 'Sumit Mishra';

        Logger.step('TC375 Step 1: Creating and confirming a $10 invoice');
        const invoiceTitle = `TC375_Invoice_${timestamp}`;
        const invoiceResult = await drawReportingJob.createPendingInvoiceForJobOnProperty(jobId, invoiceTitle);
        expect(invoiceResult.amount, 'Invoice must be created with the exact $10 amount').toBe(10);
        Logger.success(`TC375 Step 1: Invoice "${invoiceResult.invoiceNumberLabel}" created and confirmed at $10`);
        Logger.step('TC375 Step 2: Navigating to Draw Reporting from the left nav');
        await drawReportingJob.navigateToDrawReporting();
        await drawReportingJob.selectPropertyByName(propertyName);
        await drawReportingJob.assertSelectedPropertyIs(propertyName);
        Logger.success('TC375 Step 2: Draw Reporting loaded for the property');
        Logger.step('TC375 Step 3: Asserting the right panel (Invoices panel) shows the invoice together with CM Fee');
        await drawReportingJob.createDraw(drawName, '07/01/2026', '07/22/2026');
        await drawReportingJob.verifyDrawEditorNameAndStatus(drawName);
        const panelState = await drawReportingJob.assertInvoicePanelShowsInvoiceWithCmFee(invoiceResult.invoiceNumberLabel);
        Logger.success(`TC375 Step 3: Right panel confirmed — invoice row "${panelState.invoiceRowText}", CM Fee ${panelState.cmFeeAmount}`);
        Logger.step('TC375 Step 4: Editing the invoice — overriding its CM Fee %');
        const editResult = await drawReportingJob.editInvoiceCmFeePercent(invoiceResult.invoiceNumberLabel, 25);
        expect(editResult.after.replace(/[^\d.]/g, ''), 'CM Fee % must reflect the override').toBe('25');
        expect(editResult.sourceLabelText, 'CM Fee % source label must read "overridden" once it differs from the property default').toBe('overridden');
        Logger.success(`TC375 Step 4: Edited CM Fee % ${editResult.before} -> ${editResult.after} — Current Draw Request now ${editResult.currentDrawRequest}`);
        const revertResult = await drawReportingJob.editInvoiceCmFeePercent(invoiceResult.invoiceNumberLabel, 20);
        expect(revertResult.after.replace(/[^\d.]/g, ''), 'CM Fee % must be back at the property default before submission').toBe('20');
        expect(revertResult.sourceLabelText, 'CM Fee % source label must read "from property (20%)" once reverted to the default').toBe('from property (20%)');
        Logger.step('TC375 Step 5: Submitting the draw for approval');
        await drawReportingJob.proceedToDrawStepTwo();
        const drawLocForSubmit = drawReportingLocators(page);
        await withExtendedTerminalWait(
            () => drawReportingJob.submitDrawForApproval(),
            drawLocForSubmit.drawStepTwoDialog,
            { timeoutMs: 120000, label: 'TC375 Step 5 — Draw Summary dialog after Submit for Approval' }
        );
        await drawReportingJob.openHistoricalDrawsTab();
        const pendingStatus = await drawReportingJob.getHistoricalDrawRowStatus(drawName);
        expect(pendingStatus, 'Draw must be Pending immediately after submission').toBe('Pending');
        Logger.success(`TC375 Step 5: Draw "${drawName}" submitted — status = "${pendingStatus}"`);
        Logger.step('TC375 Step 6: Approving the draw (any available approve button, retrying across users if needed)');
        await drawReportingJob.navigateToAllApprovalsTab();
        let approved = await drawReportingJob.attemptApproveDraw(propertyName, drawName);
        let approvedByFullName = currentUserFullName;

        if (!approved) {
            Logger.info(`Could not confirm approval of draw "${drawName}" as "${currentUserFullName}" — retrying as "${eligibleApproverFullName}"`);
            const approverContext = await browser.newContext({ storageState: 'OtherSessionState.json' });
            const approverPage = await approverContext.newPage();
            const approverDrawReportingJob = new DrawReportingJob(approverPage);
            await approverDrawReportingJob.navigateToMyApprovalsTab();
            approved = await approverDrawReportingJob.attemptApproveDraw(propertyName, drawName, { tab: 'mine' });
            approvedByFullName = eligibleApproverFullName;
            drawReportingJob = new DrawReportingJob(page);
        }
        expect(approved, `Draw "${drawName}" must end up "Approved" via one of the known users`).toBe(true);
        Logger.success(`TC375 Step 6: Draw "${drawName}" approved (via "${approvedByFullName}")`);

        Logger.step('TC375 Step 7: Verifying the right panel reflects the Approved status');
        await drawReportingJob.navigateToDrawReporting();
        await drawReportingJob.selectPropertyByName(propertyName);
        await drawReportingJob.openHistoricalDrawsTab();
        const approvedStatus = await drawReportingJob.getHistoricalDrawRowStatus(drawName);
        expect(approvedStatus, 'Draw must be Approved after approval').toBe('Approved');
        await drawReportingJob.verifyHistoricalDrawsKpisExistAndValid();
        Logger.success(`TC375 Step 7: Confirmed draw "${drawName}" is Approved — right panel changed, full E2E complete`);
    });

    test('TC376 @drawReporting @regression : Verify Draw calculations for CM Fee, Current Draw Request, and disbursement amounts', async () => {
        test.setTimeout(300000);

        const propertyName = 'Test Property 6_Draw reporting';
        const jobId = 4330;
        const timestamp = Date.now();
        const drawName = `CALC_Draw_${timestamp}`;

        const invoiceResult = await drawReportingJob.createPendingInvoiceForJobOnProperty(jobId, `CALC_Invoice_${timestamp}`);
        expect(invoiceResult.amount, 'Invoice must be created with the exact $10 amount').toBe(10);

        await drawReportingJob.navigateToDrawReporting();
        await drawReportingJob.selectPropertyByName(propertyName);
        await drawReportingJob.assertSelectedPropertyIs(propertyName);

        await drawReportingJob.createDraw(drawName, '07/01/2026', '07/22/2026');
        await drawReportingJob.verifyDrawEditorNameAndStatus(drawName);

        await drawReportingJob.excludeAllInvoicesInDraft();

        const budgetItemBefore = await drawReportingJob.readDisbursementRowValuesInEditor('Bathroom fixtures install');
        const totalBefore = await drawReportingJob.readDisbursementRowValuesInEditor('Total');

        await drawReportingJob.includeInvoiceInDraw(invoiceResult.invoiceNumberLabel);
        const cmFeeAfterDefault = await drawReportingJob.readCmFeeInvoiceAmount();
        expect(cmFeeAfterDefault, 'CM Fee at the property default (20%) must equal invoice amount × 20%').toBeCloseTo(10 * 0.20, 2);

        const currentDrawRequestAfterInclude = drawReportingJob.parseCurrencyText(await drawReportingJob.getKpiValueByLabel('Current Draw Request'));
        expect(currentDrawRequestAfterInclude, 'Current Draw Request must equal invoice amount + CM Fee').toBeCloseTo(10 + cmFeeAfterDefault, 2);

        const budgetItemAfterInclude = await drawReportingJob.readDisbursementRowValuesInEditor('Bathroom fixtures install');
        expect(budgetItemAfterInclude.currentDraw, 'Budget item "Current Draw" must equal the raw invoice amount (CM Fee is not part of the disbursement schedule)').toBeCloseTo(10, 2);
        expect(budgetItemAfterInclude.drawRemaining, 'Budget item "Draw Remaining" must equal Budget Remaining − Current Draw').toBeCloseTo(budgetItemBefore.budgetRemaining - 10, 2);

        const totalAfterInclude = await drawReportingJob.readDisbursementRowValuesInEditor('Total');
        expect(totalAfterInclude.currentDraw, 'Disbursement Total "Current Draw" must equal the raw invoice amount').toBeCloseTo(10, 2);
        expect(totalAfterInclude.drawRemaining, 'Disbursement Total "Draw Remaining" must equal Budget Remaining − Current Draw').toBeCloseTo(totalBefore.budgetRemaining - 10, 2);
        await drawReportingJob.editInvoiceCmFeePercent(invoiceResult.invoiceNumberLabel, 30);
        const cmFeeAfterOverride = await drawReportingJob.readCmFeeInvoiceAmount();
        expect(cmFeeAfterOverride, 'CM Fee at a 30% override must equal invoice amount × 30%').toBeCloseTo(10 * 0.30, 2);

        const currentDrawRequestAfterOverride = drawReportingJob.parseCurrencyText(await drawReportingJob.getKpiValueByLabel('Current Draw Request'));
        expect(currentDrawRequestAfterOverride, 'Current Draw Request must recompute to invoice amount + the new CM Fee').toBeCloseTo(10 + cmFeeAfterOverride, 2);

        const budgetItemAfterOverride = await drawReportingJob.readDisbursementRowValuesInEditor('Bathroom fixtures install');
        expect(budgetItemAfterOverride.currentDraw, 'Budget item "Current Draw" must be unaffected by a CM Fee % override').toBeCloseTo(budgetItemAfterInclude.currentDraw, 2);

        const drawLocForDiscard = drawReportingLocators(page);
        await withExtendedTerminalWait(
            () => drawReportingJob.discardDraw(),
            drawLocForDiscard.drawEditorDialog,
            { timeoutMs: 120000, label: 'CALC test — draw editor dialog after Discard' }
        );
        Logger.success(`Draw calculation correctness verified for "${drawName}"`);
    });

    test('TC377 @drawReporting @regression : Verify Draw Reporting invoice inclusion/exclusion math and CM Fee line lock-in', async () => {
        test.setTimeout(300000);

        const propertyName = 'Test Property 6_Draw reporting';
        const jobId = 4330;
        const timestamp = Date.now();
        const drawName = `INCEXC_Draw_${timestamp}`;

        const invoice1 = await drawReportingJob.createPendingInvoiceForJobOnProperty(jobId, `INCEXC_Invoice1_${timestamp}`);
        const invoice2 = await drawReportingJob.createPendingInvoiceForJobOnProperty(jobId, `INCEXC_Invoice2_${timestamp}`);

        await drawReportingJob.navigateToDrawReporting();
        await drawReportingJob.selectPropertyByName(propertyName);
        await drawReportingJob.assertSelectedPropertyIs(propertyName);

        await drawReportingJob.createDraw(drawName, '07/01/2026', '07/22/2026');
        await drawReportingJob.verifyDrawEditorNameAndStatus(drawName);
        await retryOperation(
            () => drawReportingJob.excludeAllInvoicesInDraft(),
            { attempts: 3, delayMs: 2000, label: 'INCEXC test — exclude all invoices in draft' }
        );

        await drawReportingJob.includeInvoiceInDraw(invoice1.invoiceNumberLabel);
        const cmFee1 = await drawReportingJob.readCmFeeInvoiceAmount();
        const requestAfterInvoice1 = drawReportingJob.parseCurrencyText(await drawReportingJob.getKpiValueByLabel('Current Draw Request'));
        expect(requestAfterInvoice1, 'After including invoice 1, Current Draw Request must equal invoice1 + its CM Fee').toBeCloseTo(10 + cmFee1, 2);

        await drawReportingJob.includeInvoiceInDraw(invoice2.invoiceNumberLabel);
        const cmFeeCombined = await drawReportingJob.readCmFeeInvoiceAmount();
        const requestAfterBoth = drawReportingJob.parseCurrencyText(await drawReportingJob.getKpiValueByLabel('Current Draw Request'));
        expect(cmFeeCombined, "Combined CM Fee with both invoices included must equal the sum of each invoice's own CM Fee").toBeCloseTo(cmFee1 * 2, 2);
        expect(requestAfterBoth, 'After including both invoices, Current Draw Request must equal both invoices + combined CM Fee').toBeCloseTo(20 + cmFeeCombined, 2);

        await drawReportingJob.assertCmFeeCheckboxLockedIn();

        await drawReportingJob.excludeInvoiceInDraw(invoice1.invoiceNumberLabel);
        const cmFeeAfterExclude = await drawReportingJob.readCmFeeInvoiceAmount();
        const requestAfterExclude = drawReportingJob.parseCurrencyText(await drawReportingJob.getKpiValueByLabel('Current Draw Request'));
        expect(cmFeeAfterExclude, "Excluding invoice 1 must drop the combined CM Fee back down to invoice 2's share alone").toBeCloseTo(cmFeeCombined - cmFee1, 2);
        expect(requestAfterExclude, 'Excluding invoice 1 must drop Current Draw Request back down by invoice1 + its CM Fee').toBeCloseTo(requestAfterBoth - 10 - cmFee1, 2);

        await drawReportingJob.discardDraw();
        Logger.success(`Invoice inclusion/exclusion math verified for "${drawName}"`);
    });

    test('TC378 @drawReporting @regression : Verify Draw Reporting — Reject / Reject on Behalf flow', async ({ browser }) => {
        test.setTimeout(300000);

        const propertyName = 'Test Property 6_Draw reporting';
        const jobId = 4330;
        const timestamp = Date.now();
        const drawName = `REJECT_Draw_${timestamp}`;
        const rejectionNote = `Rejected by automation for negative-path coverage (${timestamp})`;

        const invoice = await drawReportingJob.createPendingInvoiceForJobOnProperty(jobId, `REJECT_Invoice_${timestamp}`);
        await drawReportingJob.navigateToDrawReporting();
        await drawReportingJob.selectPropertyByName(propertyName);
        await drawReportingJob.assertSelectedPropertyIs(propertyName);
        await drawReportingJob.createDraw(drawName, '07/01/2026', '07/22/2026');
        await drawReportingJob.verifyDrawEditorNameAndStatus(drawName);
        await drawReportingJob.includeInvoiceInDraw(invoice.invoiceNumberLabel);
        await drawReportingJob.proceedToDrawStepTwo();
        await drawReportingJob.submitDrawForApproval();

        const { rejected, rejectedByFullName } = await rejectDrawAsRealApprover(browser, propertyName, drawName, rejectionNote);
        expect(rejected, `Draw "${drawName}" must end up "Rejected"`).toBe(true);
        Logger.success(`Draw "${drawName}" rejected via "${rejectedByFullName}"`);
        drawReportingJob = new DrawReportingJob(page);

        await drawReportingJob.navigateToDrawReporting();
        await drawReportingJob.selectPropertyByName(propertyName);
        await drawReportingJob.openHistoricalDrawsTab();
        const status = await drawReportingJob.getHistoricalDrawRowStatus(drawName);
        expect(status, 'Draw must be Rejected').toBe('Rejected');

        Logger.success(`Reject flow verified for draw "${drawName}"`);
    });

    test('TC379 @drawReporting @regression : Verify Draw submission prevents empty and duplicate pending submissions', async ({ browser }) => {
        test.setTimeout(400000);

        const propertyName = 'Test Property 6_Draw reporting';
        const jobId = 4330;
        const timestamp = Date.now();

        const invoiceA = await drawReportingJob.createPendingInvoiceForJobOnProperty(jobId, `GUARD_InvoiceA_${timestamp}`);
        const invoiceB = await drawReportingJob.createPendingInvoiceForJobOnProperty(jobId, `GUARD_InvoiceB_${timestamp}`);

        await drawReportingJob.navigateToDrawReporting();
        await drawReportingJob.selectPropertyByName(propertyName);
        await drawReportingJob.assertSelectedPropertyIs(propertyName);

        const drawNameA = `GUARD_DrawA_${timestamp}`;
        await drawReportingJob.createDraw(drawNameA, '07/01/2026', '07/22/2026');
        await drawReportingJob.verifyDrawEditorNameAndStatus(drawNameA);
        await drawReportingJob.excludeAllInvoicesInDraft();
        await drawReportingJob.assertContinueDisabledWithNoInvoices();

        // Submit Draw A for approval so it becomes genuinely Pending on this property
        await drawReportingJob.includeInvoiceInDraw(invoiceA.invoiceNumberLabel);
        await drawReportingJob.proceedToDrawStepTwo();
        await drawReportingJob.submitDrawForApproval();
        await drawReportingJob.openHistoricalDrawsTab();
        const statusA = await drawReportingJob.getHistoricalDrawRowStatus(drawNameA);
        expect(statusA, 'Draw A must be Pending').toBe('Pending');
        await drawReportingJob.openOverviewTab();

        const drawNameB = `GUARD_DrawB_${timestamp}`;
        await drawReportingJob.createDraw(drawNameB, '07/01/2026', '07/22/2026');
        await drawReportingJob.verifyDrawEditorNameAndStatus(drawNameB);
        await drawReportingJob.includeInvoiceInDraw(invoiceB.invoiceNumberLabel);
        const drawLocForGuard = drawReportingLocators(page);
        await withExtendedTerminalWait(
            () => drawReportingJob.proceedToDrawStepTwo(),
            drawLocForGuard.drawStepTwoDialog,
            { timeoutMs: 120000, visible: true, label: 'GUARD test — Draw B Step 2 dialog' }
        );
        await drawReportingJob.assertSubmitForApprovalDisabled();

        await drawReportingJob.backToStepOneEditor();
        await drawReportingJob.discardDraw();

        const { approved, approvedByFullName } = await approveDrawAsRealApprover(browser, propertyName, drawNameA);
        expect(approved, `Draw "${drawNameA}" must end up "Approved"`).toBe(true);
        Logger.success(`Submission guard rails verified — Draw A ("${drawNameA}") approved via "${approvedByFullName}", Draw B ("${drawNameB}") discarded`);
    });

    test('TC380 @drawReporting @regression : Verify approved Draw generates the correct report PDF in Property Documents', async ({ browser }) => {
        test.setTimeout(400000);

        const propertyName = 'Test Property 6_Draw reporting';
        const propertyId = 8659; // "Test Property 6_Draw reporting" — same property TC373/374/375 already use
        const jobId = 4330;
        const timestamp = Date.now();
        const drawName = `DOC_Draw_${timestamp}`;

        const invoice = await drawReportingJob.createPendingInvoiceForJobOnProperty(jobId, `DOC_Invoice_${timestamp}`);
        await drawReportingJob.navigateToDrawReporting();
        await drawReportingJob.selectPropertyByName(propertyName);
        await retryOperation(
            () => drawReportingJob.assertSelectedPropertyIs(propertyName),
            { attempts: 2, delayMs: 3000, label: 'DOC test — assertSelectedPropertyIs' }
        );
        await drawReportingJob.createDraw(drawName, '07/01/2026', '07/22/2026');
        await drawReportingJob.verifyDrawEditorNameAndStatus(drawName);
        await drawReportingJob.includeInvoiceInDraw(invoice.invoiceNumberLabel);
        await drawReportingJob.proceedToDrawStepTwo();
        await drawReportingJob.submitDrawForApproval();

        await drawReportingJob.navigateToAllApprovalsTab();
        const drawId = await drawReportingJob.getAllApprovalsRowIdForPendingDraw(propertyName);

        const { approved, approvedByFullName } = await approveDrawAsRealApprover(browser, propertyName, drawName);
        expect(approved, `Draw "${drawName}" must end up "Approved"`).toBe(true);

        drawReportingJob = new DrawReportingJob(page);

        const documentText = await drawReportingJob.openPropertyDocumentsAndAssertFileExists(propertyId, `draw-${drawId}-report.pdf`);
        Logger.success(`Confirmed generated document "${documentText}" for approved draw "${drawName}" (ID ${drawId}, approved via "${approvedByFullName}")`);
    });

    test('TC381 @drawReporting @regression  : Verify Draw approval details show the configured eligible approver', async ({ browser }) => {
        test.setTimeout(400000);

        const propertyName = 'Test Property 6_Draw reporting';
        const jobId = 4330;
        const timestamp = Date.now();
        const drawName = `TMPL_Draw_${timestamp}`;

        const invoice = await drawReportingJob.createPendingInvoiceForJobOnProperty(jobId, `TMPL_Invoice_${timestamp}`);
        await drawReportingJob.navigateToDrawReporting();
        await drawReportingJob.selectPropertyByName(propertyName);
        await drawReportingJob.assertSelectedPropertyIs(propertyName);
        await drawReportingJob.createDraw(drawName, '07/01/2026', '07/22/2026');
        await drawReportingJob.verifyDrawEditorNameAndStatus(drawName);
        await drawReportingJob.includeInvoiceInDraw(invoice.invoiceNumberLabel);
        await drawReportingJob.proceedToDrawStepTwo();
        await drawReportingJob.submitDrawForApproval();

        await drawReportingJob.navigateToAllApprovalsTab();
        const eligibleText = await drawReportingJob.readEligibleApproversText(propertyName, drawName);
        await drawReportingJob.verifyEligibleApproverMatchesTemplate(propertyName, eligibleText);

        const { approved, approvedByFullName } = await approveDrawAsRealApprover(browser, propertyName, drawName);
        expect(approved, `Draw "${drawName}" must end up "Approved"`).toBe(true);

        Logger.success(`Eligible approver configuration verified for draw "${drawName}" ("${eligibleText}"), approved via "${approvedByFullName}"`);
    });
});
