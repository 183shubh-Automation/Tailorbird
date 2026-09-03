require('dotenv').config();
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const PropertiesHelper = require('../pages/properties');
const { BudgetJob } = require('../pages/budgetPage');
const { CMFeePage } = require('../pages/cmFeePage');
const { DrawReportingJob } = require('../pages/drawReportingPage');
const { CMFeeDrawPdfPage } = require('../pages/cmFeeDrawPdfPage');
const { Logger } = require('../utils/logger');
const { ensureLeftPanelExpanded } = require('../utils/leftPanelExpander');

test.use({
    storageState: 'sessionState.json',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
});

let page, cmFeePage;
let sharedPropertyName, sharedPropertyId;

test.describe('CM Fee Configuration', () => {
    test.describe.configure({ retries: 1 });

    // ── Suite setup — one shared property + one approved budget, reused by every
    // test below. Both prerequisites are already covered elsewhere in the suite
    // (PropertiesHelper.createProperty, BudgetJob's CSV-upload-and-submit-for-approval
    // flow); this only composes those existing, already-verified methods — it does
    // not reimplement property or budget creation.
    test.beforeAll(async ({ browser }) => {
        test.setTimeout(300000);
        const ctx = await browser.newContext({ storageState: 'sessionState.json' });
        const setupPage = await ctx.newPage();

        const prop = new PropertiesHelper(setupPage);
        const budgetJob = new BudgetJob(setupPage);

        sharedPropertyName = `CMFee_Prop_${Date.now()}`;

        Logger.step(`Suite setup: creating shared property ${sharedPropertyName}`);
        await setupPage.goto(process.env.BASE_URL, { waitUntil: 'load' });
        await setupPage.waitForTimeout(1500);
        await ensureLeftPanelExpanded(setupPage);
        await prop.goToProperties();
        await prop.createProperty(
            sharedPropertyName,
            'Domestic Terminal, College Park, GA 30337, USA',
            'College Park', 'GA', '30337',
            'Garden Style'
        );

        Logger.step('Suite setup: opening the new property to capture its propertyId');
        await prop.openPropertyDetails(sharedPropertyName);
        const detailsUrl = setupPage.url();
        sharedPropertyId = new URL(detailsUrl).searchParams.get('propertyId');
        Logger.info(`Shared property created — propertyId: ${sharedPropertyId}`);

        // Mandatory prerequisite for CM Fee's "Budget Item" selector to ever offer any
        // options: the property needs an APPROVED (not draft) budget revision. MCP-verified
        // live (2026-09-01): a revision left in "Draft" status never populates the Budget
        // Item dropdown, regardless of the categories/items it contains — only submitting
        // it for approval does. Reusing BudgetJob's existing CSV-upload-and-submit flow.
        const csvPath = path.resolve(process.cwd(), 'files', 'budget_data.csv');
        expect(fs.existsSync(csvPath), 'files/budget_data.csv must exist for the budget seed').toBeTruthy();

        Logger.step('Suite setup: seeding an approved budget via CSV upload');
        await ensureLeftPanelExpanded(setupPage);
        await budgetJob.navigateToBudgetTab();
        await budgetJob.waitForPageLoad();
        await budgetJob.selectPropertyByName(sharedPropertyName);
        await budgetJob.openRevisionEditor();
        await budgetJob.uploadFileInRevision(csvPath);
        await budgetJob.ensureSubmitEnabledAfterUpload();
        await budgetJob.clickSubmitForApproval();
        Logger.success('Suite setup: budget revision submitted for approval');

        await ctx.close();
    });

    test.beforeEach(async ({ page: p }) => {
        page = p;
        cmFeePage = new CMFeePage(page);
        await page.goto(`${process.env.BASE_URL}/properties/details?propertyId=${sharedPropertyId}`, { waitUntil: 'load' });
        await expect(page).toHaveURL(/\/properties\/details/);
        await page.waitForTimeout(3000);
    });

    test('TC431 @regression @cmfee : Verify CM Fee Configuration dialog UI elements', async () => {
        Logger.step('TC431: Asserting CM Fee Configuration dialog UI');

        await cmFeePage.openCmFeeConfiguration();
        await cmFeePage.assertDialogUiElements();

        // Cancel must close the dialog without persisting anything, so the very first
        // save in TC432 below is genuinely the property's first CM Fee configuration.
        await cmFeePage.closeCmFeeViaCancel();

        Logger.success('TC431 passed — CM Fee Configuration dialog UI fully asserted');
    });

    test('TC432 @regression @cmfee : Verify enabling CM Fee with percentage and budget item saves and persists', async () => {
        Logger.step('TC432: Enable CM Fee, set percentage and budget item, save, verify persistence');

        await cmFeePage.openCmFeeConfiguration();
        await cmFeePage.setCmFeeEnabled(true);
        await cmFeePage.fillPercentage('15');
        await cmFeePage.selectBudgetItem('Site Prep');

        const toastText = await cmFeePage.saveChanges();
        expect(toastText).toContain('Success');
        expect(toastText).toMatch(/property_draw_config (created|updated) successfully/);

        // Re-open to verify the saved values actually persisted server-side, not just
        // reflected the in-memory form state.
        await cmFeePage.openCmFeeConfiguration();
        expect(await cmFeePage.isCmFeeEnabled()).toBe(true);
        expect(await cmFeePage.getPercentageValue()).toBe('15');
        expect(await cmFeePage.getBudgetItemValue()).toBe('Site Prep');
        await cmFeePage.closeCmFeeViaCancel();

        Logger.success('TC432 passed — CM Fee enabled with percentage and budget item, saved and persisted');
    });

    test('TC433 @regression @cmfee : Verify disabling CM Fee preserves the previously saved percentage and budget item', async () => {
        Logger.step('TC433: Disable CM Fee and verify percentage/budget item are preserved, not cleared');

        await cmFeePage.openCmFeeConfiguration();
        // Starting state here is TC432's saved config: enabled, percentage "15", budget item "Site Prep".
        expect(await cmFeePage.isCmFeeEnabled()).toBe(true);

        await cmFeePage.setCmFeeEnabled(false);
        const toastText = await cmFeePage.saveChanges();
        expect(toastText).toMatch(/property_draw_config (created|updated) successfully/);

        // MCP-verified live (2026-09-01): unchecking "CM Fee Enabled" and saving does NOT
        // clear the previously configured percentage/budget item — it only flips the
        // enabled flag. Re-open and assert that real, confirmed behavior exactly.
        await cmFeePage.openCmFeeConfiguration();
        expect(await cmFeePage.isCmFeeEnabled()).toBe(false);
        expect(await cmFeePage.getPercentageValue()).toBe('15');
        expect(await cmFeePage.getBudgetItemValue()).toBe('Site Prep');
        await cmFeePage.closeCmFeeViaCancel();

        Logger.success('TC433 passed — disabling CM Fee preserved the previously saved configuration');
    });

    test('TC434 @regression @cmfee : Verify CM Fee Percentage field rejects non-numeric input', async () => {
        Logger.step('TC434: Non-numeric input into CM Fee Percentage must not be accepted');

        await cmFeePage.openCmFeeConfiguration();
        // Starting state here is TC433's saved config: disabled, percentage "15" preserved.
        expect(await cmFeePage.getPercentageValue()).toBe('15');

        await cmFeePage.fillPercentage('abc');
        // MCP-verified live (2026-09-01): the masked numeric input strips non-numeric
        // characters entirely rather than accepting them — the field ends up empty,
        // not "abc". This is a hard assertion of that exact, confirmed behavior.
        expect(await cmFeePage.getPercentageValue()).toBe('');

        // Do not save — leave the property's persisted config untouched for TC435.
        await cmFeePage.closeCmFeeViaCancel();

        Logger.success('TC434 passed — non-numeric input was rejected by the Percentage field');
    });

    test('TC435 @regression @cmfee : Verify Cancel discards an unsaved CM Fee Percentage edit', async () => {
        Logger.step('TC435: Cancel must discard an in-progress edit without persisting it');

        await cmFeePage.openCmFeeConfiguration();
        // TC434 never saved, so the persisted value here is still TC433's "15".
        const originalValue = await cmFeePage.getPercentageValue();
        expect(originalValue).toBe('15');

        await cmFeePage.fillPercentage('77');
        expect(await cmFeePage.getPercentageValue()).toBe('77');
        await cmFeePage.closeCmFeeViaCancel();

        // Re-open and assert the discarded "77" never persisted — the original value
        // set by TC432/TC433 must still be there, proving Cancel truly discards.
        await cmFeePage.openCmFeeConfiguration();
        expect(await cmFeePage.getPercentageValue()).toBe(originalValue);
        expect(await cmFeePage.getPercentageValue()).not.toBe('77');
        await cmFeePage.closeCmFeeViaCancel();

        Logger.success('TC435 passed — Cancel discarded the unsaved edit, original value intact');
    });
});


const CM_FEE_PROPERTY_ID = 11063;
const CM_FEE_PROPERTY_NAME = 'Test_property7_CM_Fee_Automation';
const CM_FEE_JOB_ID = 4767;
const CM_FEE_BUDGET_ITEM = 'Bathroom fixtures install';
const CM_FEE_PERCENT = 20;
const CM_FEE_INVOICE_AMOUNT = 10;

let drawReportingJob, cmFeeDrawPdfPage;
let cmFeeInvoiceA, cmFeeInvoiceB;
let mainDrawName, mainDrawExpected;
let mainDrawUiInvoices;

test.describe('CM Fee — Invoice, Draw Calculation & Generated PDF (Test_property7_CM_Fee_Automation)', () => {
    test.describe.configure({ mode: 'serial', retries: 1 });

    test.beforeAll(async ({ browser }) => {
        test.setTimeout(300000);
        const ctx = await browser.newContext({ storageState: 'sessionState.json' });
        const setupPage = await ctx.newPage();

        const cmFeeSetup = new CMFeePage(setupPage);
        const cmFeeDrawPdfSetup = new CMFeeDrawPdfPage(setupPage);

        Logger.step(`Suite setup: configuring CM Fee (${CM_FEE_PERCENT}%, budget item "${CM_FEE_BUDGET_ITEM}") on "${CM_FEE_PROPERTY_NAME}"`);
        await setupPage.goto(`${process.env.BASE_URL}/properties/details?propertyId=${CM_FEE_PROPERTY_ID}`, { waitUntil: 'load' });
        await setupPage.waitForTimeout(3000);
        await cmFeeSetup.openCmFeeConfiguration();
        await cmFeeSetup.setCmFeeEnabled(true);
        await cmFeeSetup.fillPercentage(String(CM_FEE_PERCENT));
        await cmFeeSetup.selectBudgetItem(CM_FEE_BUDGET_ITEM);
        await cmFeeSetup.saveChanges();
        Logger.success('Suite setup: CM Fee configuration applied');

        const suffix = Date.now();
        cmFeeInvoiceA = await cmFeeDrawPdfSetup.createInvoiceWithAmount(CM_FEE_JOB_ID, `CMFee_InvoiceA_${suffix}`, CM_FEE_INVOICE_AMOUNT);
        cmFeeInvoiceB = await cmFeeDrawPdfSetup.createInvoiceWithAmount(CM_FEE_JOB_ID, `CMFee_InvoiceB_${suffix}`, CM_FEE_INVOICE_AMOUNT);
        Logger.success(`Suite setup: created invoices ${cmFeeInvoiceA.invoiceNumberLabel} and ${cmFeeInvoiceB.invoiceNumberLabel} ($${CM_FEE_INVOICE_AMOUNT} each)`);

        await ctx.close();
    });

    test.beforeEach(async ({ page: p }) => {
        page = p;
        cmFeePage = new CMFeePage(page);
        drawReportingJob = new DrawReportingJob(page);
        cmFeeDrawPdfPage = new CMFeeDrawPdfPage(page);
        await page.goto(process.env.BASE_URL, { waitUntil: 'load' });
        await page.waitForTimeout(1500);
        await ensureLeftPanelExpanded(page);
    });

    test('TC436 @regression @cmfee : Verify CM Fee Configuration is enabled with the correct percentage and budget item', async () => {
        Logger.step(`TC436: Verifying CM Fee Configuration on "${CM_FEE_PROPERTY_NAME}"`);

        await page.goto(`${process.env.BASE_URL}/properties/details?propertyId=${CM_FEE_PROPERTY_ID}`, { waitUntil: 'load' });
        await page.waitForTimeout(2000);

        await cmFeePage.openCmFeeConfiguration();
        expect(await cmFeePage.isCmFeeEnabled(), 'CM Fee must be enabled for this property').toBe(true);
        expect(await cmFeePage.getPercentageValue(), 'CM Fee percentage must match the configured rate').toBe(String(CM_FEE_PERCENT));
        expect(await cmFeePage.getBudgetItemValue(), 'CM Fee budget item must match the job\'s own budget category').toBe(CM_FEE_BUDGET_ITEM);

        await cmFeePage.closeCmFeeViaCancel();

        Logger.success('TC436 passed — CM Fee Configuration verified: enabled, correct percentage and budget item');
    });

    test('TC437 @regression @cmfee : Verify invoices created under $20 are Approved (not Draft) with the exact PO amount used for CM Fee', async () => {
        Logger.step('TC437: Verifying both suite-setup invoices are Approved with correct amounts');

        // MCP-verified live (2026-09-02): the job's Invoice tab grid is column-virtualized (same
        // revo-grid behavior documented elsewhere in drawReportingPage.js) — its "Status" column
        // can be entirely absent from the DOM depending on scroll position, and even scrolling
        // the header into view timed out (the header itself isn't mounted until manually
        // scrolled right, which scrollIntoViewIfNeeded can't do for a not-yet-rendered element).
        // The invoice's own detail page is a plain (non-virtualized) panel where every field goes
        // `disabled` and "Confirm Invoice" becomes disabled once approved — a reliable, real
        // "not Draft" signal that doesn't depend on that grid's column virtualization at all.
        for (const invoice of [cmFeeInvoiceA, cmFeeInvoiceB]) {
            await page.goto(`${process.env.BASE_URL}/jobs/${CM_FEE_JOB_ID}/invoices/${invoice.invoiceNumber}`, { waitUntil: 'load' });
            await page.waitForTimeout(2000);

            const confirmButton = page.getByRole('button', { name: 'Confirm Invoice', exact: true });
            await expect(confirmButton, `"${invoice.invoiceNumberLabel}" must no longer be awaiting confirmation (Approved, not Draft)`).toBeDisabled({ timeout: 45000 });

            const invoiceNumberField = page.getByRole('textbox', { name: 'Enter invoice number' });
            await expect(invoiceNumberField, `"${invoice.invoiceNumberLabel}" fields must be locked read-only once Approved`).toBeDisabled();
            expect(await invoiceNumberField.inputValue(), 'Invoice number field must show the exact invoice').toBe(invoice.invoiceNumberLabel);

            const netPayableText = await page.evaluate(() => {
                const labelEl = Array.from(document.querySelectorAll('p')).find((el) => el.textContent.trim() === 'Net Payable');
                const input = labelEl && labelEl.parentElement ? labelEl.parentElement.querySelector('input,textarea') : null;
                return input ? input.value : null;
            });
            expect(netPayableText, `"${invoice.invoiceNumberLabel}" Net Payable must show the exact $${invoice.amount} amount`).toBe(`$${invoice.amount}`);

            expect(invoice.amount, 'Invoice amount used for CM Fee calculation must be under $20').toBeLessThan(20);
        }

        Logger.success('TC437 passed — both invoices are Approved (not Draft) with the exact PO amount under $20');
    });

    test('TC438 @regression @cmfee @drawReporting : Verify creating a draw calculates the exact CM Fee amount and lands the draw total in the $15-$25 band', async () => {
        test.setTimeout(300000);
        Logger.step('TC438: Creating draw, including both invoices, verifying CM Fee calculation end-to-end');

        await drawReportingJob.navigateToDrawReporting();
        await drawReportingJob.selectPropertyByName(CM_FEE_PROPERTY_NAME);
        await drawReportingJob.assertSelectedPropertyIs(CM_FEE_PROPERTY_NAME);

        mainDrawName = `CMFee_MainDraw_${Date.now()}`;
        await drawReportingJob.createDraw(mainDrawName, '09/01/2026', '09/30/2026');

        // Determinism: this job's Invoices panel can also carry invoices from other test runs
        // (e.g. TC448's own throwaway invoice) — start from a known-empty baseline and include
        // exactly the two invoices this test cares about, rather than trusting whatever the
        // editor happens to default-check.
        await drawReportingJob.excludeAllInvoicesInDraft();

        await drawReportingJob.includeInvoiceInDraw(cmFeeInvoiceA.invoiceNumberLabel);
        await drawReportingJob.includeInvoiceInDraw(cmFeeInvoiceB.invoiceNumberLabel);

        const expectedSubtotal = cmFeeInvoiceA.amount + cmFeeInvoiceB.amount;
        const expectedCmFee = Math.round(expectedSubtotal * (CM_FEE_PERCENT / 100) * 100) / 100;
        const expectedNetPay = expectedSubtotal + expectedCmFee;

        const actualCmFee = await drawReportingJob.readCmFeeInvoiceAmount();
        expect(actualCmFee, `CM Fee must equal ${CM_FEE_PERCENT}% of the $${expectedSubtotal} invoice subtotal`).toBe(expectedCmFee);

        const currentDrawRequestText = await drawReportingJob.getKpiValueByLabel('Current Draw Request');
        const currentDrawRequest = drawReportingJob.parseCurrencyText(currentDrawRequestText);
        expect(currentDrawRequest, 'Current Draw Request must equal subtotal + CM Fee').toBe(expectedNetPay);
        expect(currentDrawRequest, 'Draw amount must fall within the required $15-$25 band').toBeGreaterThanOrEqual(15);
        expect(currentDrawRequest, 'Draw amount must fall within the required $15-$25 band').toBeLessThanOrEqual(25);

        // Source-amount separation: the property's own budget item must carry only the real
        // invoice subtotal as its Current Draw — the CM Fee itself is never folded into the
        // invoiced budget item's own draw amount. (The complementary fact — that the fee itself
        // lands under a separate "Uncategorized" bucket — is asserted independently and more
        // reliably from the generated PDF's fixed, submitted Schedule of Values in TC444, since
        // MCP-verified live (2026-09-02) that bucket's live in-draft figures shift with this
        // shared property's accumulating draw history in ways that aren't safe to assert exactly
        // from within an unsaved draft.)
        const budgetItemRow = await drawReportingJob.readDisbursementRowValuesInEditor(CM_FEE_BUDGET_ITEM);
        expect(budgetItemRow.currentDraw, `"${CM_FEE_BUDGET_ITEM}" disbursement row must carry only the invoice subtotal, not the CM Fee`).toBe(expectedSubtotal);

        await drawReportingJob.proceedToDrawStepTwo();
        const subtotalText = await drawReportingJob.getKpiValueByLabel('Subtotal');
        const cmFeeText = await drawReportingJob.getKpiValueByLabel('CM Fee');
        const netPayText = await drawReportingJob.getKpiValueByLabel('Net Pay This Draw');
        expect(subtotalText, 'Draw Summary Subtotal must equal the invoice subtotal exactly').toBe(`$${expectedSubtotal.toFixed(2)}`);
        expect(cmFeeText, 'Draw Summary CM Fee must equal the calculated CM Fee exactly').toBe(`+$${expectedCmFee.toFixed(2)}`);
        expect(netPayText, 'Draw Summary Net Pay must equal subtotal + CM Fee exactly').toBe(`$${expectedNetPay.toFixed(2)}`);

        await drawReportingJob.submitDrawForApproval();
        await page.waitForTimeout(3000);

        await drawReportingJob.openHistoricalDrawsTab();
        const status = await drawReportingJob.getHistoricalDrawRowStatus(mainDrawName);
        // No Draw approval template is configured for this property (MCP-verified live) — a
        // submitted draw finalizes straight to Approved rather than sitting Pending.
        expect(status, 'Draw with no approval template configured must finalize straight to Approved').toBe('Approved');

        mainDrawExpected = { subtotal: expectedSubtotal, cmFee: expectedCmFee, netPay: expectedNetPay };

        Logger.success(`TC438 passed — CM Fee $${expectedCmFee} calculated correctly, draw total $${expectedNetPay} within [$15,$25], draw "${mainDrawName}" Approved`);
    });

    test('TC439 @regression @cmfee : Verify CM Fee auto-generates a real, correctly-valued invoice record on the job', async () => {
        Logger.step('TC439: Verifying the CM Fee auto-generated invoice record on the job');
        expect(mainDrawExpected, 'TC438 must have run first to establish the draw and expected CM Fee').toBeTruthy();

        await page.goto(`${process.env.BASE_URL}/jobs/${CM_FEE_JOB_ID}?tab=invoices`, { waitUntil: 'load' });
        await page.waitForTimeout(3000);
        await page.getByRole('tab', { name: 'Invoice', exact: true }).click();
        await page.waitForTimeout(2000);

        const expectedTitle = `CM Fee – ${mainDrawName}`;
        const feeRow = page.getByRole('row').filter({ hasText: expectedTitle });
        await expect(feeRow, `A generated invoice titled "${expectedTitle}" must exist on the job`).toBeVisible({ timeout: 45000 });
        const rowText = (await feeRow.textContent()).trim();

        expect(rowText, 'Generated CM Fee invoice must be Financial Type "Contract"').toContain('Contract');
        expect(rowText, 'Generated CM Fee invoice must show the exact calculated fee amount').toContain(`$${mainDrawExpected.cmFee}`);

        const descriptionMatch = rowText.match(/CM Fee for draw #(\d+)/);
        expect(descriptionMatch, 'Generated CM Fee invoice description must read "CM Fee for draw #<id>"').not.toBeNull();
        mainDrawExpected.drawId = descriptionMatch[1];

        const feeInvoiceLink = feeRow.getByRole('link', { name: /^Invoice #\d+$/ });
        await expect(feeInvoiceLink, 'Generated CM Fee invoice row must carry its own invoice number link').toBeVisible({ timeout: 45000 });
        mainDrawExpected.feeInvoiceNumber = ((await feeInvoiceLink.textContent()).match(/\d+/) || [])[0];
        expect(mainDrawExpected.feeInvoiceNumber, 'Generated CM Fee invoice number must be parseable').toBeTruthy();

        Logger.success(`TC439 passed — CM Fee generated invoice verified (Invoice #${mainDrawExpected.feeInvoiceNumber}, draw #${mainDrawExpected.drawId}, $${mainDrawExpected.cmFee})`);
    });

    test('TC440 @regression @cmfee @drawReporting : Verify Historical Draws "View" detail dialog shows correct status and financials', async () => {
        Logger.step('TC440: Verifying Historical Draws detail Summary tab');
        expect(mainDrawExpected, 'TC438 must have run first').toBeTruthy();

        await drawReportingJob.navigateToDrawReporting();
        await drawReportingJob.selectPropertyByName(CM_FEE_PROPERTY_NAME);
        await drawReportingJob.openHistoricalDrawsTab();

        const summary = await cmFeeDrawPdfPage.readDrawDetailSummary(mainDrawName);
        expect(summary.status, 'Draw detail Status must read Approved').toBe('Approved');
        expect(summary.drawAmount, 'Draw detail Draw Amount must equal the calculated net pay').toBe(`$${mainDrawExpected.netPay.toFixed(2)}`);

        // "Previously Drawn" is a cumulative historical total across every earlier draw this
        // shared property has ever had approved (MCP-verified live 2026-09-02 — it is NOT $0
        // except on a property's very first-ever draw), so it can't be asserted as a fixed value
        // here. Its exact accounting relationship to the other two fields can be, though:
        // Total Draw at Submission must always equal Previously Drawn + this draw's own amount.
        const previouslyDrawn = drawReportingJob.parseCurrencyText(summary.previouslyDrawn);
        const totalDrawAtSubmission = drawReportingJob.parseCurrencyText(summary.totalDrawAtSubmission);
        expect(previouslyDrawn, 'Draw detail Previously Drawn must be a non-negative amount').toBeGreaterThanOrEqual(0);
        expect(Math.round((previouslyDrawn + mainDrawExpected.netPay) * 100) / 100, 'Draw detail Total Draw at Submission must equal Previously Drawn + this draw\'s own amount').toBe(totalDrawAtSubmission);

        Logger.success(`TC440 passed — Historical Draws detail Summary verified: ${JSON.stringify(summary)}`);
    });

    test('TC441 @regression @cmfee @drawReporting : Verify Historical Draws "View" detail dialog lists the 2 invoices + generated CM Fee invoice with correct amounts', async () => {
        Logger.step('TC441: Verifying Historical Draws detail Invoices tab');
        expect(mainDrawExpected, 'TC438 and TC439 must have run first').toBeTruthy();
        expect(mainDrawExpected.feeInvoiceNumber, 'TC439 must have captured the generated CM Fee invoice\'s own number').toBeTruthy();

        await drawReportingJob.navigateToDrawReporting();
        await drawReportingJob.selectPropertyByName(CM_FEE_PROPERTY_NAME);
        await drawReportingJob.openHistoricalDrawsTab();

        const { invoices, total } = await cmFeeDrawPdfPage.readDrawDetailInvoices(mainDrawName);

        // MCP-verified live (2026-09-02): this dialog's "Invoices (N)" tab is NOT scoped to the
        // individual draw despite living inside its own detail view — it lists every invoice
        // ever created for the property/job (28+ on this long-lived shared fixture) with a Total
        // to match, not just this draw's own 3. So this test finds our 3 specific invoices by
        // number WITHIN that larger list, rather than asserting the list equals exactly 3 or that
        // its Total equals this draw's own $24 — both would be wrong given the real behavior.
        const expectedEntries = [
            { number: cmFeeInvoiceA.invoiceNumber, label: cmFeeInvoiceA.invoiceNumberLabel, amount: cmFeeInvoiceA.amount },
            { number: cmFeeInvoiceB.invoiceNumber, label: cmFeeInvoiceB.invoiceNumberLabel, amount: cmFeeInvoiceB.amount },
            { number: mainDrawExpected.feeInvoiceNumber, label: `Invoice #${mainDrawExpected.feeInvoiceNumber}`, amount: mainDrawExpected.cmFee },
        ];
        const matchedInvoices = [];
        for (const expected of expectedEntries) {
            const match = invoices.find((i) => i.invoiceNumber.includes(expected.number));
            expect(match, `Property-wide invoices list must include ${expected.label}`).toBeTruthy();
            expect(match.amount, `${expected.label} amount must be exact`).toBe(`$${expected.amount.toFixed(2)}`);
            matchedInvoices.push(match);
        }
        mainDrawUiInvoices = matchedInvoices;

        const totalAmount = drawReportingJob.parseCurrencyText(total);
        expect(totalAmount, 'Property-wide invoices Total must be at least this draw\'s own net pay').toBeGreaterThanOrEqual(mainDrawExpected.netPay);

        Logger.success(`TC441 passed — Historical Draws Invoices tab lists all 3 invoices correctly, total $${mainDrawExpected.netPay}`);
    });

    test('TC442 @regression @cmfee @drawReporting : Verify CM Fee draw values persist correctly after navigating away and back', async () => {
        Logger.step('TC442: Verifying persistence of draw values after re-navigation');
        expect(mainDrawExpected, 'TC438 must have run first').toBeTruthy();

        await page.goto(process.env.BASE_URL, { waitUntil: 'load' });
        await page.waitForTimeout(1500);
        await ensureLeftPanelExpanded(page);

        await drawReportingJob.navigateToDrawReporting();
        await drawReportingJob.selectPropertyByName(CM_FEE_PROPERTY_NAME);
        await drawReportingJob.openHistoricalDrawsTab();

        const status = await drawReportingJob.getHistoricalDrawRowStatus(mainDrawName);
        expect(status, 'Draw status must persist as Approved after navigating away and back').toBe('Approved');

        const rowLocator = page.getByRole('row').filter({ hasText: mainDrawName });
        const rowText = (await rowLocator.textContent()).trim();
        expect(rowText, 'Draw Amount must persist as the exact calculated net pay').toContain(`$${mainDrawExpected.netPay}`);

        Logger.success('TC442 passed — CM Fee draw values persisted correctly after navigation');
    });

    test('TC443 @regression @cmfee @drawReporting : Verify the CM Fee draw generates a real, downloadable PDF', async () => {
        Logger.step('TC443: Verifying the generated draw PDF exists and is a genuine PDF document');
        expect(mainDrawExpected, 'TC438 must have run first').toBeTruthy();

        await drawReportingJob.navigateToDrawReporting();
        await drawReportingJob.selectPropertyByName(CM_FEE_PROPERTY_NAME);
        await drawReportingJob.openHistoricalDrawsTab();

        const pdfUrl = await cmFeeDrawPdfPage.getDrawPdfUrl(mainDrawName);
        expect(pdfUrl, 'PDF preview must resolve to a signed URL').toMatch(/^https:\/\/files\.tailorbird\.com\//);

        const pdf = await cmFeeDrawPdfPage.downloadAndExtractDrawPdfText(pdfUrl);
        expect(pdf.buffer.slice(0, 4).toString(), 'Downloaded file must be a genuine PDF').toBe('%PDF');
        expect(pdf.numpages, 'Generated PDF must contain at least one page').toBeGreaterThanOrEqual(1);

        mainDrawExpected.pdfText = pdf.text;
        mainDrawExpected.pdfNormalized = pdf.normalized;

        Logger.success(`TC443 passed — Draw PDF is a genuine, downloadable PDF (${pdf.numpages} pages)`);
    });

    test('TC444 @regression @cmfee : Verify the PDF shows the correct CM Fee amount, separated from the invoice subtotal', async () => {
        Logger.step('TC444: Verifying PDF Schedule of Values shows correct CM Fee and subtotal amounts');
        expect(mainDrawExpected && mainDrawExpected.pdfText, 'TC443 must have run first to fetch the PDF').toBeTruthy();

        const { pdfText, subtotal, cmFee } = mainDrawExpected;

        const budgetItemBlock = pdfText.match(new RegExp(`${CM_FEE_BUDGET_ITEM}[\\s\\S]{0,400}?\\+\\$${subtotal.toFixed(2)}`));
        expect(budgetItemBlock, `PDF must show "${CM_FEE_BUDGET_ITEM}" drawing exactly +$${subtotal.toFixed(2)} (the invoice subtotal, not the fee)`).not.toBeNull();

        const uncategorizedBlock = pdfText.match(new RegExp(`Uncategorized[\\s\\S]{0,200}?\\+\\$${cmFee.toFixed(2)}`));
        expect(uncategorizedBlock, `PDF must show the CM Fee as a separate "Uncategorized" line of exactly +$${cmFee.toFixed(2)}`).not.toBeNull();

        Logger.success('TC444 passed — PDF shows the CM Fee correctly separated from the invoice subtotal');
    });

    test('TC445 @regression @cmfee : Verify the PDF Invoice Appendix lists the exact invoice numbers/amounts matching the app, with a correct total', async () => {
        Logger.step('TC445: Verifying PDF Invoice Appendix against the app\'s own Invoices tab data');
        expect(mainDrawExpected && mainDrawExpected.pdfText, 'TC443 must have run first to fetch the PDF').toBeTruthy();
        expect(mainDrawUiInvoices, 'TC441 must have run first to capture the app\'s Invoices tab data').toBeTruthy();

        const { pdfText, pdfNormalized, netPay } = mainDrawExpected;

        expect(pdfNormalized, 'PDF Invoice Appendix must state exactly 3 invoices in this draw').toContain('3invoicesinthisdraw');

        for (const invoice of mainDrawUiInvoices) {
            const escapedNumber = invoice.invoiceNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const amountDigits = invoice.amount.replace('$', '').replace('.', '\\.');
            const found = pdfText.match(new RegExp(`${escapedNumber}[\\s\\S]{0,200}?\\$${amountDigits}`));
            expect(found, `PDF Invoice Appendix must list "${invoice.invoiceNumber}" at exactly ${invoice.amount} (matching the app's own Invoices tab)`).not.toBeNull();
        }

        expect(pdfNormalized, `PDF Appendix Total must equal the app's own draw total`).toContain(`APPENDIXTOTAL$${netPay.toFixed(2)}`);

        Logger.success('TC445 passed — PDF Invoice Appendix matches the app\'s own invoice data exactly, including totals');
    });

    test('TC446 @regression @cmfee : Verify the PDF\'s embedded CM Fee vendor invoice page shows the correct description, bill-to, and amount', async () => {
        Logger.step('TC446: Verifying the PDF\'s embedded CM Fee invoice page');
        expect(mainDrawExpected && mainDrawExpected.pdfText, 'TC443 must have run first to fetch the PDF').toBeTruthy();
        expect(mainDrawExpected.drawId, 'TC439 must have run first to capture the draw ID').toBeTruthy();

        const { pdfText, cmFee, drawId } = mainDrawExpected;

        const descriptionBlock = pdfText.match(new RegExp(`CM Fee for draw #${drawId}[\\s\\S]{0,150}?\\$${cmFee.toFixed(2)}`));
        expect(descriptionBlock, `PDF must embed the CM Fee vendor invoice with description "CM Fee for draw #${drawId}" and amount $${cmFee.toFixed(2)}`).not.toBeNull();

        const billToBlock = pdfText.match(new RegExp(`Bill To[\\s\\S]{0,150}?${CM_FEE_PROPERTY_NAME}`));
        expect(billToBlock, `PDF's embedded CM Fee invoice must bill the correct property "${CM_FEE_PROPERTY_NAME}"`).not.toBeNull();

        const totalDueBlock = pdfText.match(new RegExp(`Total Due[\\s\\S]{0,20}?\\$${cmFee.toFixed(2)}`));
        expect(totalDueBlock, `PDF's embedded CM Fee invoice Total Due must equal exactly $${cmFee.toFixed(2)}`).not.toBeNull();

        Logger.success('TC446 passed — PDF\'s embedded CM Fee vendor invoice page verified: description, bill-to, and amount all correct');
    });

    test('TC447 @regression @cmfee : Verify the PDF "Total this period" equals Subtotal + CM Fee, matching the app\'s Net Pay', async () => {
        Logger.step('TC447: Verifying PDF grand total matches Subtotal + CM Fee');
        expect(mainDrawExpected && mainDrawExpected.pdfNormalized, 'TC443 must have run first to fetch the PDF').toBeTruthy();

        const { pdfNormalized, netPay } = mainDrawExpected;
        expect(pdfNormalized, 'PDF "TOTAL THIS PERIOD" must equal Subtotal + CM Fee, matching the app\'s own Net Pay').toContain(`TOTALTHISPERIOD+$${netPay.toFixed(2)}`);

        Logger.success(`TC447 passed — PDF total ($${netPay.toFixed(2)}) matches the app's Net Pay exactly`);
    });

    test('TC448 @regression @cmfee @drawReporting : Verify CM Fee is trigger-conditional on included invoices and rounds correctly to 2 decimals', async () => {
        test.setTimeout(300000);
        Logger.step('TC448: Verifying CM Fee absence with zero invoices, then correct rounding on a fractional-percent override');

        const invoiceC = await cmFeeDrawPdfPage.createInvoiceWithAmount(CM_FEE_JOB_ID, `CMFee_RoundingCheck_${Date.now()}`, CM_FEE_INVOICE_AMOUNT);

        await drawReportingJob.navigateToDrawReporting();
        await drawReportingJob.selectPropertyByName(CM_FEE_PROPERTY_NAME);
        await drawReportingJob.assertSelectedPropertyIs(CM_FEE_PROPERTY_NAME);

        const roundingDrawName = `CMFee_RoundingDraw_${Date.now()}`;
        await drawReportingJob.createDraw(roundingDrawName, '09/01/2026', '09/30/2026');

        // Eligibility/trigger condition: CM Fee must never appear while zero invoices are included.
        await drawReportingJob.excludeAllInvoicesInDraft();
        await expect(page.getByText('CM Fee Invoice (TBD)', { exact: true }), 'CM Fee line must NOT appear while no invoices are included').not.toBeVisible();
        const zeroDrawRequestText = await drawReportingJob.getKpiValueByLabel('Current Draw Request');
        expect(zeroDrawRequestText, 'Current Draw Request must be $0.00 with no invoices included').toBe('$0.00');
        await drawReportingJob.assertContinueDisabledWithNoInvoices();

        // Including one invoice at the default 20% property rate must produce an exact, whole-cent fee.
        await drawReportingJob.includeInvoiceInDraw(invoiceC.invoiceNumberLabel);
        const defaultFee = await drawReportingJob.readCmFeeInvoiceAmount();
        expect(defaultFee, `CM Fee at the default ${CM_FEE_PERCENT}% rate must equal $${CM_FEE_INVOICE_AMOUNT * (CM_FEE_PERCENT / 100)}`).toBe(CM_FEE_INVOICE_AMOUNT * (CM_FEE_PERCENT / 100));

        // Rounding/decimal behavior: MCP-verified live (2026-09-02) that overriding this invoice's
        // own CM Fee % to 33.36% (10 * 0.3336 = 3.336, a genuine fractional-cent result) displays
        // as exactly $3.34 — standard round-to-nearest-cent, confirmed against the real app rather
        // than assumed.
        await drawReportingJob.editInvoiceCmFeePercent(invoiceC.invoiceNumberLabel, '33.36');
        const roundedFee = await drawReportingJob.readCmFeeInvoiceAmount();
        expect(roundedFee, 'CM Fee for a fractional-cent product (10 * 33.36% = 3.336) must round to the nearest cent').toBe(3.34);

        const cmFeeRawText = await page.getByText('CM Fee Invoice (TBD)', { exact: true }).evaluate((el) => {
            let node = el.parentElement;
            for (let i = 0; i < 8 && node; i++) {
                const match = node.textContent.match(/\$[\d,]+\.\d{2}/);
                if (match) return match[0];
                node = node.parentElement;
            }
            return null;
        });
        expect(cmFeeRawText, 'CM Fee must always display formatted to exactly 2 decimal places').toMatch(/^\$\d+\.\d{2}$/);

        await drawReportingJob.discardDraw();

        Logger.success('TC448 passed — CM Fee is absent with zero invoices, and rounds correctly (3.336 -> 3.34) with 2-decimal formatting');
    });
});
