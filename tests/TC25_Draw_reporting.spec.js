require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { ApprovalJob } = require('../pages/approvalPage');
const { DrawReportingJob } = require('../pages/drawReportingPage');
const { DrawApprovalJob } = require('../pages/drawApprovalPage');
const { DrawReportingInvoiceJob } = require('../pages/drawReportingInvoicePage');
const { Logger } = require('../utils/logger');
const { captureDrawReportingUi, compareUiSnapshotToBaseline } = require('../utils/uiSnapshotCapture');

test.use({
    storageState: 'sessionState.json',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
});

let page, approvalJob, drawReportingJob, drawApprovalJob, drawReportingInvoiceJob;

test.describe('Draw Reporting - Empty State, All Grid Controls, and Create Draw E2E Impact', () => {
    test.describe.configure({ retries: 1 });

    test.beforeEach(async ({ page: p }) => {
        page = p;
        approvalJob = new ApprovalJob(page);
        drawReportingJob = new DrawReportingJob(page);
        drawApprovalJob = new DrawApprovalJob(page);
        drawReportingInvoiceJob = new DrawReportingInvoiceJob(page);
        await page.goto(process.env.DASHBOARD_URL, { waitUntil: 'load' });
        await expect(page).toHaveURL(process.env.DASHBOARD_URL);
        await page.waitForTimeout(7000);
        Logger.info('Dashboard loaded from stored session');
    });

    test('TC372 @drawReporting @sanity @regression @e2e : Draw Reporting — brand-new property empty state, every grid control (Filter/View/Table/Export), and full Create Draw flow with asserted impact', async () => {
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

        // ===== STEP 1: Create a brand-new property =====
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

        // ===== STEP 2: Persist the property name for downstream reuse =====
        await test.step('Write drawReportingPropertyData.json for downstream Draw Reporting tests', async () => {
            const propertyData = { propertyName, createdAt: timestamp };
            const filePath = path.join(__dirname, '../data/drawReportingPropertyData.json');
            if (!fs.existsSync(path.dirname(filePath))) fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, JSON.stringify(propertyData, null, 2));
            const fromDisk = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            expect(fromDisk.propertyName, 'drawReportingPropertyData.json must round-trip the created property name').toBe(propertyName);
            Logger.success(`TC372 Step 2: Persisted property name to ${filePath}`);
        });

        // ===== STEP 3: Navigate to Draw Reporting and select ONLY the new property =====
        Logger.step('TC372 Step 3: Navigating to Draw Reporting');
        await drawReportingJob.navigateToDrawReporting();
        await drawReportingJob.selectPropertyByName(propertyName);
        await drawReportingJob.assertSelectedPropertyIs(propertyName);
        Logger.success('TC372 Step 3: Draw Reporting loaded for the newly created property');

        // ===== STEP 4: Verify Overview tab empty state (KPIs, Budget Overview, Capex Status) =====
        Logger.step('TC372 Step 4: Verifying Overview tab empty state');
        await drawReportingJob.verifyOverviewEmptyState();

        // ===== STEP 5: Verify Historical Draws tab empty state (no draws, no invoice data) =====
        Logger.step('TC372 Step 5: Verifying Historical Draws tab empty state');
        await drawReportingJob.openHistoricalDrawsTab();
        await drawReportingJob.verifyHistoricalDrawsEmptyState();
        await drawReportingJob.openOverviewTab();
        Logger.success('TC372 Step 5: Historical Draws empty state verified');

        // ===== STEP 6: Verify Create Draw opens Step 1 correctly — do NOT submit =====
        Logger.step('TC372 Step 6: Verifying Create Draw modal Step 1');
        await drawReportingJob.openCreateDrawModal();
        await drawReportingJob.verifyCreateDrawModalStepOne();
        await drawReportingJob.closeCreateDrawModal();
        Logger.success('TC372 Step 6: Create Draw Step 1 verified without submitting a draw');

        // ===== STEP 7: Invoke and assert every CTA / dropdown / header / export control on both grids =====
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

        // ===== STEP 8: Full E2E — create one draw and assert its impact =====
        Logger.step('TC372 Step 8: Creating a draw end-to-end and asserting its impact');
        const drawName = `TC372_Draw_${timestamp}`;
        await drawReportingJob.createDraw(drawName, '07/01/2026', '07/31/2026');
        await drawReportingJob.verifyDrawEditorStepTwo(drawName);
        await drawReportingJob.closeDrawEditor();
        await drawReportingJob.verifyActiveDrawImpact(drawName);
        await drawReportingJob.verifyBudgetOverviewUnaffectedByDraft();
        await drawReportingJob.verifyHistoricalDrawsUnaffectedByDraft();
        Logger.success(`TC372 Step 8: Draw "${drawName}" created end-to-end; impact on KPIs, Active Draw card, and both grids asserted`);

        // ===== STEP 9: Capture live UI into JSON and compare against committed baseline =====
        Logger.step('TC372 Step 9: Capturing Draw Reporting UI snapshot');
        const liveSnapshot = await captureDrawReportingUi(page, [propertyName, drawName]);

        const capturedSnapshotPath = path.join(__dirname, '../downloads/drawReportingUiSnapshot.json');
        if (!fs.existsSync(path.dirname(capturedSnapshotPath))) fs.mkdirSync(path.dirname(capturedSnapshotPath), { recursive: true });
        fs.writeFileSync(capturedSnapshotPath, JSON.stringify(liveSnapshot, null, 2));

        const baselinePath = path.join(__dirname, '../fixture/drawReportingUiBaseline.json');
        compareUiSnapshotToBaseline({ baselinePath, liveSnapshot, expect });
        Logger.success('TC372 Step 9: Live UI snapshot captured and compared against committed baseline');

        // ===== STEP 10: No console errors, page errors, or failed API responses =====
        expect(consoleErrors, `Unexpected console errors: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
        expect(pageErrors, `Unexpected page errors: ${JSON.stringify(pageErrors)}`).toHaveLength(0);
        expect(failedResponses, `Unexpected failed API responses: ${JSON.stringify(failedResponses)}`).toHaveLength(0);
        Logger.success('TC372: No console errors, page errors, or failed API responses observed');
    });

    test('TC373 @drawReporting @regression : Draw Reporting — existing populated property ("Test Property 6_Draw reporting") shows the same controls, with data values asserted logically since they change over time', async () => {
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

        // ===== STEP 1: Navigate to Draw Reporting and select the existing, already-populated property =====
        Logger.step('TC373 Step 1: Navigating to Draw Reporting and selecting the existing property');
        await drawReportingJob.navigateToDrawReporting();
        await drawReportingJob.selectPropertyByName(propertyName);
        await drawReportingJob.assertSelectedPropertyIs(propertyName);
        Logger.success(`TC373 Step 1: Draw Reporting loaded for "${propertyName}"`);

        // ===== STEP 2: Overview tab — KPIs, Budget Overview grid, Capex Status asserted logically =====
        Logger.step('TC373 Step 2: Verifying Overview tab data exists and is validly formatted');
        const overviewKpis = await drawReportingJob.verifyOverviewKpisExistAndValid();
        const budgetOverviewResult = await drawReportingJob.verifyBudgetOverviewLogical();
        const capexStatus = await drawReportingJob.verifyCapexStatusHasValidValues();
        Logger.success('TC373 Step 2: Overview tab data verified logically (existence + format, not fixed values)');

        // ===== STEP 3: Historical Draws tab — KPIs and grid asserted logically =====
        Logger.step('TC373 Step 3: Verifying Historical Draws tab data exists and is validly formatted');
        await drawReportingJob.openHistoricalDrawsTab();
        const historicalKpis = await drawReportingJob.verifyHistoricalDrawsKpisExistAndValid();
        const historicalDrawsResult = await drawReportingJob.verifyHistoricalDrawsLogical();
        await drawReportingJob.openOverviewTab();
        Logger.success('TC373 Step 3: Historical Draws tab data verified logically (existence + format, not fixed values)');

        // ===== STEP 4: Create Draw modal Step 1 — same static fields/labels as the empty-property case =====
        Logger.step('TC373 Step 4: Verifying Create Draw modal Step 1 (same static UI as any property)');
        await drawReportingJob.openCreateDrawModal();
        await drawReportingJob.verifyCreateDrawModalStepOne();
        await drawReportingJob.closeCreateDrawModal();
        Logger.success('TC373 Step 4: Create Draw Step 1 verified without submitting a draw');

        // ===== STEP 5: Every CTA / dropdown / header / export control — must match the SAME committed baseline =====
        // These are static UI copy, not data, so they must be identical to the brand-new-property case (TC372).
        Logger.step('TC373 Step 5: Capturing and asserting every grid control matches the same static baseline as TC372');
        const budgetOverviewControls = await drawReportingJob.captureAllBudgetOverviewControls();
        await drawReportingJob.openHistoricalDrawsTab();
        const historicalDrawsControls = await drawReportingJob.captureAllHistoricalDrawsControls();
        await drawReportingJob.openOverviewTab();

        const allControlsSnapshot = { budgetOverviewControls, historicalDrawsControls };
        const controlsBaselinePath = path.join(__dirname, '../fixture/drawReportingControlsBaseline.json');
        compareUiSnapshotToBaseline({ baselinePath: controlsBaselinePath, liveSnapshot: allControlsSnapshot, expect });
        Logger.success('TC373 Step 5: Grid controls (Filter/View/Table/Export, column names) match the same static baseline as the brand-new-property test');

        // ===== STEP 6: Persist captured data-existence snapshot for audit — NOT compared against a fixed baseline =====
        await test.step('Write drawReportingExistingPropertySnapshot.json (audit record, values not baseline-compared)', async () => {
            const snapshot = {
                propertyName,
                capturedAt: Date.now(),
                overviewKpis,
                capexStatus,
                budgetOverview: budgetOverviewResult,
                historicalKpis,
                historicalDraws: historicalDrawsResult,
            };
            const snapshotPath = path.join(__dirname, '../downloads/drawReportingExistingPropertySnapshot.json');
            if (!fs.existsSync(path.dirname(snapshotPath))) fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
            fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
            Logger.success(`TC373 Step 6: Persisted data-existence audit snapshot to ${snapshotPath}`);
        });

        // ===== STEP 7: No console errors, page errors, or failed API responses =====
        expect(consoleErrors, `Unexpected console errors: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
        expect(pageErrors, `Unexpected page errors: ${JSON.stringify(pageErrors)}`).toHaveLength(0);
        expect(failedResponses, `Unexpected failed API responses: ${JSON.stringify(failedResponses)}`).toHaveLength(0);
        Logger.success('TC373: No console errors, page errors, or failed API responses observed');
    });

    test('TC374 @drawReporting @regression @e2e : Draw Reporting — full E2E create-draw flow on the existing populated property; verifies the draw becomes available, then discards it to keep the shared property re-testable', async () => {
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

        // ===== STEP 1: Navigate to Draw Reporting and select the existing, already-populated property =====
        Logger.step('TC374 Step 1: Navigating to Draw Reporting and selecting the existing property');
        await drawReportingJob.navigateToDrawReporting();
        await drawReportingJob.selectPropertyByName(propertyName);
        await drawReportingJob.assertSelectedPropertyIs(propertyName);
        Logger.success(`TC374 Step 1: Draw Reporting loaded for "${propertyName}"`);

        // ===== STEP 2: Create the draw end-to-end =====
        Logger.step('TC374 Step 2: Creating a new draw end-to-end');
        await drawReportingJob.createDraw(drawName, '07/01/2026', '07/31/2026');
        await drawReportingJob.verifyDrawEditorNameAndStatus(drawName);
        Logger.success(`TC374 Step 2: Draw "${drawName}" created — toast confirmed, editor opened in Draft status`);

        // ===== STEP 3: Close the editor and verify the draw is available on the Overview tab =====
        Logger.step('TC374 Step 3: Verifying the created draw is available');
        await drawReportingJob.closeDrawEditor();
        const impact = await drawReportingJob.verifyActiveDrawImpactLogical(drawName);
        Logger.success(`TC374 Step 3: Confirmed draw "${drawName}" is available (Active Draw card, KPI "${impact.activeDrawValue}", Continue Editing, Create Draw disabled)`);

        // ===== STEP 4: Clean up — discard the draft so this shared property stays re-testable =====
        Logger.step('TC374 Step 4: Discarding the draft draw to restore the shared property');
        await drawReportingJob.reopenActiveDraw();
        await drawReportingJob.verifyDrawEditorNameAndStatus(drawName);
        await drawReportingJob.discardDraw();
        Logger.success('TC374 Step 4: Draft draw discarded — Create Draw re-enabled, property restored');

        // ===== STEP 5: Confirm the discarded draw left no trace (not in Historical Draws either) =====
        await drawReportingJob.openHistoricalDrawsTab();
        const historicalRowForDiscardedDraw = page.getByText(drawName, { exact: true });
        await expect(historicalRowForDiscardedDraw, 'Discarded draw must not appear in Historical Draws').toHaveCount(0);
        await drawReportingJob.openOverviewTab();
        Logger.success('TC374 Step 5: Confirmed the discarded draw left no trace in Historical Draws');

        // ===== STEP 6: No console errors, page errors, or failed API responses =====
        expect(consoleErrors, `Unexpected console errors: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
        expect(pageErrors, `Unexpected page errors: ${JSON.stringify(pageErrors)}`).toHaveLength(0);
        expect(failedResponses, `Unexpected failed API responses: ${JSON.stringify(failedResponses)}`).toHaveLength(0);
        Logger.success('TC374: No console errors, page errors, or failed API responses observed');
    });

    test('TC375 @drawReporting @regression @e2e @approval : Draw Reporting — create+confirm a $10 invoice, verify the right panel shows it with CM Fee, edit its CM Fee %, confirm the current user cannot approve, then approve as the real eligible approver (Sumit_tailorbird) and verify the right panel updates', async ({ browser }) => {
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
        const jobId = 4330; // "test job for draw reporting" — the prepared job under this property
        const timestamp = Date.now();
        const drawName = `TC375_Draw_${timestamp}`;
        const currentUserFullName = 'Sumit Harsh'; // the logged-in session user (TEST_EMAIL) — not the Draw approver
        const eligibleApproverFullName = 'Sumit Mishra'; // the display name behind NEW_TEST_EMAIL (Sumit_tailorbird@yopmail.com)

        // ===== STEP 1: Create and confirm a $10 invoice on the prepared job =====
        Logger.step('TC375 Step 1: Creating and confirming a $10 invoice');
        const invoiceTitle = `TC375_Invoice_${timestamp}`;
        const invoiceResult = await drawReportingInvoiceJob.createPendingInvoiceForJobOnProperty(jobId, invoiceTitle);
        expect(invoiceResult.amount, 'Invoice must be created with the exact $10 amount').toBe(10);
        Logger.success(`TC375 Step 1: Invoice "${invoiceResult.invoiceNumberLabel}" created and confirmed at $10`);

        // ===== STEP 2: Navigate to Draw Reporting (left nav) and select the property =====
        Logger.step('TC375 Step 2: Navigating to Draw Reporting from the left nav');
        await drawReportingJob.navigateToDrawReporting();
        await drawReportingJob.selectPropertyByName(propertyName);
        await drawReportingJob.assertSelectedPropertyIs(propertyName);
        Logger.success('TC375 Step 2: Draw Reporting loaded for the property');

        // ===== STEP 3: Open the draw editor and assert the right panel shows this invoice with CM Fee =====
        Logger.step('TC375 Step 3: Asserting the right panel (Invoices panel) shows the invoice together with CM Fee');
        await drawReportingJob.createDraw(drawName, '07/01/2026', '07/22/2026');
        await drawReportingJob.verifyDrawEditorNameAndStatus(drawName);
        const panelState = await drawReportingJob.assertInvoicePanelShowsInvoiceWithCmFee(invoiceResult.invoiceNumberLabel);
        Logger.success(`TC375 Step 3: Right panel confirmed — invoice row "${panelState.invoiceRowText}", CM Fee ${panelState.cmFeeAmount}`);

        // ===== STEP 4: Edit this invoice's CM Fee % and verify the panel recalculates =====
        Logger.step('TC375 Step 4: Editing the invoice — overriding its CM Fee %');
        const editResult = await drawReportingJob.editInvoiceCmFeePercent(invoiceResult.invoiceNumberLabel, 25);
        expect(editResult.after.replace(/[^\d.]/g, ''), 'CM Fee % must reflect the override').toBe('25');
        expect(editResult.sourceLabelText, 'CM Fee % source label must read "overridden" once it differs from the property default').toBe('overridden');
        Logger.success(`TC375 Step 4: Edited CM Fee % ${editResult.before} -> ${editResult.after} — Current Draw Request now ${editResult.currentDrawRequest}`);

        // Revert to the property default (20%) before submitting, so the persisted historical
        // record matches the property's standard CM Fee rate rather than a throwaway override.
        // Typing the exact default value back clears the override, so the source label goes
        // back to "from property (20%)" rather than staying "overridden".
        const revertResult = await drawReportingJob.editInvoiceCmFeePercent(invoiceResult.invoiceNumberLabel, 20);
        expect(revertResult.after.replace(/[^\d.]/g, ''), 'CM Fee % must be back at the property default before submission').toBe('20');
        expect(revertResult.sourceLabelText, 'CM Fee % source label must read "from property (20%)" once reverted to the default').toBe('from property (20%)');

        // ===== STEP 5: Submit the draw for approval =====
        Logger.step('TC375 Step 5: Submitting the draw for approval');
        await drawReportingJob.proceedToDrawStepTwo();
        await drawReportingJob.submitDrawForApproval();
        await drawReportingJob.openHistoricalDrawsTab();
        const pendingStatus = await drawReportingJob.getHistoricalDrawRowStatus(drawName);
        expect(pendingStatus, 'Draw must be Pending immediately after submission').toBe('Pending');
        Logger.success(`TC375 Step 5: Draw "${drawName}" submitted — status = "${pendingStatus}"`);

        // ===== STEP 6: Confirm the CURRENT user (Sumit Harsh) cannot directly approve it =====
        Logger.step(`TC375 Step 6: Confirming "${currentUserFullName}" cannot directly approve this draw`);
        await drawApprovalJob.navigateToAllApprovalsTab();
        await drawApprovalJob.assertCurrentUserCannotDirectlyApprove(propertyName, drawName, currentUserFullName);
        Logger.success(`TC375 Step 6: Confirmed "${currentUserFullName}" is not the eligible approver`);

        // ===== STEP 7: Log in as the real eligible approver (Sumit_tailorbird) and approve directly =====
        Logger.step('TC375 Step 7: Approving as the real eligible approver (Sumit_tailorbird / Sumit Mishra)');
        const approverContext = await browser.newContext({ storageState: 'OtherSessionState.json' });
        const approverPage = await approverContext.newPage();
        try {
            const approverDrawApprovalJob = new DrawApprovalJob(approverPage);
            await approverDrawApprovalJob.navigateToAllApprovalsTab();
            await approverDrawApprovalJob.approveDrawDirectlyByName(propertyName, drawName);
        } finally {
            await approverContext.close();
        }
        Logger.success(`TC375 Step 7: Draw "${drawName}" approved by "${eligibleApproverFullName}"`);

        // ===== STEP 8: Back as Sumit Harsh — verify the right panel (Historical Draws status) changed =====
        Logger.step('TC375 Step 8: Verifying the right panel reflects the Approved status');
        await drawReportingJob.navigateToDrawReporting();
        await drawReportingJob.selectPropertyByName(propertyName);
        await drawReportingJob.openHistoricalDrawsTab();
        const approvedStatus = await drawReportingJob.getHistoricalDrawRowStatus(drawName);
        expect(approvedStatus, 'Draw must be Approved after the real eligible approver approves it').toBe('Approved');
        await drawReportingJob.verifyHistoricalDrawsKpisExistAndValid();
        Logger.success(`TC375 Step 8: Confirmed draw "${drawName}" is Approved — right panel changed, full E2E complete`);

        // ===== STEP 9: No console errors, page errors, or failed API responses =====
        expect(consoleErrors, `Unexpected console errors: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
        expect(pageErrors, `Unexpected page errors: ${JSON.stringify(pageErrors)}`).toHaveLength(0);
        expect(failedResponses, `Unexpected failed API responses: ${JSON.stringify(failedResponses)}`).toHaveLength(0);
        Logger.success('TC375: No console errors, page errors, or failed API responses observed');
    });
});
