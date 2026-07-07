require('dotenv').config();
/**
 * Retainage flow — discovered via a mandatory MCP browser investigation of the live staging app
 * (see artifacts/debug/*.json for the full UI inventory, network log, and locator map).
 *
 * There is no standalone "Retainage" screen: the feature lives inside the existing Invoice tab
 * (list-grid columns) and the Invoice Details drawer (Overview fields + line-items grid columns).
 * This spec drives a pre-existing staging fixture purpose-built for this flow — project
 * "Project_Automation_Retainage_flow" / job "Automation_Job_for_Retainage_flow" — whose IDs are
 * read from data/retainageFixture.json so this file never needs to change if the fixture moves.
 *
 * No existing page objects, locators, or helpers were modified — only this new spec and the new
 * pages/retainagePage.js were added.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { RetainagePage } = require('../pages/retainagePage');
const { Logger } = require('../utils/logger');

const fixturePath = path.join(__dirname, '../data/retainageFixture.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

test.use({
    storageState: 'sessionState.json',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
});

let page, retainagePage;

test.describe('Verify Retainage flow (Invoice list + Invoice Details)', () => {
    test.describe.configure({ retries: 1 });

    test.beforeEach(async ({ page: p }) => {
        page = p;
        retainagePage = new RetainagePage(page);
    });

    test('TC211 @regression @retainage : Invoice list grid exposes Retainage Withheld/Released/Outstanding/Net Payable columns', async () => {
        await retainagePage.gotoInvoiceList(fixture.jobId);

        const jobNotFound = await page.getByText('Job not found', { exact: false }).isVisible({ timeout: 5000 }).catch(() => false);
        test.skip(jobNotFound, `Fixture job ${fixture.jobId} no longer exists — update data/retainageFixture.json.`);

        await expect(retainagePage.listRetainageWithheldHeader).toBeVisible({ timeout: 20000 });
        await expect(retainagePage.listRetainageReleasedHeader).toBeVisible();
        await expect(retainagePage.listOutstandingRetainageHeader).toBeVisible();
        await expect(retainagePage.listNetPayableHeader).toBeVisible();
        Logger.success('Invoice list grid Retainage columns are all visible.');
    });

    test('TC212 @regression @retainage : Existing invoice row shows correct Retainage figures in the list grid', async () => {
        await retainagePage.gotoInvoiceList(fixture.jobId);

        const row = retainagePage.getListRowByInvoiceNumber(`Invoice #${fixture.invoiceId}`);
        await expect(row).toBeVisible({ timeout: 20000 });

        const rowText = await row.innerText();
        Logger.info(`Invoice row text: ${rowText.replace(/\n/g, ' | ')}`);

        // Fixture values captured via API (GET /api/bird-table/rows?...): retainage_amount=200,
        // retainage_released=0, outstanding_retainage=200, net_payable=4800, gross_amount=5000.
        expect(rowText).toContain('$200');
        expect(rowText).toContain('$4,800');
        Logger.success('Invoice row Retainage Withheld ($200) and Net Payable ($4,800) verified.');
    });

    test('TC213 @regression @retainage : Invoice Details Overview shows Retainage %, Gross Amount, Withheld, Released and Net Payable', async () => {
        await retainagePage.gotoInvoiceDetail(fixture.jobId, fixture.invoiceId);

        const notFound = await page.getByText('not found', { exact: false }).isVisible({ timeout: 5000 }).catch(() => false);
        test.skip(notFound, `Fixture invoice ${fixture.invoiceId} no longer exists — update data/retainageFixture.json.`);

        await expect(retainagePage.retainagePercentLabel).toBeVisible({ timeout: 20000 });
        const values = await retainagePage.getOverviewRetainageValues();
        Logger.info(`Overview Retainage values: ${JSON.stringify(values)}`);

        expect(values.retainagePercent).toMatch(/%$/);
        expect(values.grossAmount).toMatch(/^\$/);
        expect(values.retainageWithheld).toMatch(/^-\s*\$/);
        expect(values.retainageReleased).toMatch(/^\+\s*\$/);
        expect(values.netPayable).toMatch(/^\$/);
        Logger.success(`Overview fields present with expected formatting: ${JSON.stringify(values)}`);
    });

    test('TC214 @regression @retainage : Retainage % locks once the invoice is Approved; Gross Amount, Withheld, Released and Net Payable are always read-only', async () => {
        await retainagePage.gotoInvoiceDetail(fixture.jobId, fixture.invoiceId);
        await expect(retainagePage.retainagePercentInput).toBeVisible({ timeout: 20000 });

        // Confirmed live via MCP browser: approving an invoice (status Draft -> Approved) locks its
        // entire Overview panel, including Retainage % (previously editable while Draft). Branch on
        // the invoice's current lock state instead of assuming one, so this test stays valid whether
        // the fixture invoice is re-created as Draft or is already Approved.
        const isLocked = await retainagePage.invoiceNumberInput.isDisabled();
        Logger.info(`Invoice Overview lock state: invoiceNumberInput disabled=${isLocked} (disabled implies invoice status is Approved).`);

        if (isLocked) {
            await expect(retainagePage.retainagePercentInput).toBeDisabled();
            Logger.success('Invoice is Approved — Retainage % is correctly locked/disabled along with the rest of the Overview panel.');
        } else {
            await expect(retainagePage.retainagePercentInput).toBeEnabled();
            Logger.success('Invoice is in Draft — Retainage % is correctly editable.');
        }

        await expect(retainagePage.grossAmountInput).toBeDisabled();
        await expect(retainagePage.retainageWithheldInput).toBeDisabled();
        await expect(retainagePage.retainageReleasedInput).toBeDisabled();
        await expect(retainagePage.netPayableInput).toBeDisabled();
        Logger.success('Gross Amount / Retainage Withheld / Retainage Released / Net Payable are disabled computed fields regardless of approval state.');
    });

    test('TC215 @regression @retainage : Net Payable = Gross Amount - Retainage Withheld + Retainage Released', async () => {
        await retainagePage.gotoInvoiceDetail(fixture.jobId, fixture.invoiceId);
        await expect(retainagePage.retainagePercentInput).toBeVisible({ timeout: 20000 });

        const values = await retainagePage.getOverviewRetainageValues();
        const gross = RetainagePage.parseCurrency(values.grossAmount);
        const withheld = RetainagePage.parseCurrency(values.retainageWithheld);
        const released = RetainagePage.parseCurrency(values.retainageReleased);
        const netPayable = RetainagePage.parseCurrency(values.netPayable);

        Logger.info(`gross=${gross} withheld=${withheld} released=${released} netPayable=${netPayable}`);
        expect(netPayable).toBeCloseTo(gross + withheld + released, 2);
        Logger.success(`Net Payable formula verified: ${gross} + (${withheld}) + ${released} = ${netPayable}`);
    });

    test('TC216 @regression @retainage : Invoice line-items grid exposes per-line Retainage columns', async () => {
        await retainagePage.gotoInvoiceDetail(fixture.jobId, fixture.invoiceId);
        await expect(retainagePage.retainagePercentInput).toBeVisible({ timeout: 20000 });

        await expect(retainagePage.lineItemsRetainagePercentHeader).toBeVisible({ timeout: 15000 });
        await expect(retainagePage.lineItemsRetainageAmountHeader).toBeVisible();
        await expect(retainagePage.lineItemsRetainageReleasedHeader).toBeVisible();
        await expect(retainagePage.lineItemsTotalWithheldHeader).toBeVisible();
        await expect(retainagePage.lineItemsOutstandingRetainageHeader).toBeVisible();
        await expect(retainagePage.lineItemsNetPayableHeader).toBeVisible();
        Logger.success('Line-items grid Retainage %, Retainage ($), Retainage Released, Total Withheld to Date, Outstanding Retainage and Net Payable headers are all visible.');
    });

    test('TC217 @regression @retainage : Go Back returns from Invoice Details to the Invoice list', async () => {
        await retainagePage.gotoInvoiceDetail(fixture.jobId, fixture.invoiceId);
        await expect(retainagePage.goBackButton).toBeVisible({ timeout: 20000 });

        await retainagePage.goBack();
        await expect(page).toHaveURL(/tab=invoices/, { timeout: 15000 });
        Logger.success('Go Back navigated from Invoice Details drawer back to the Invoice list.');
    });

    test('TC218 @regression @retainage : No console errors while loading the Retainage UI', async () => {
        const errors = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') errors.push(msg.text());
        });
        page.on('pageerror', (err) => errors.push(err.message));

        await retainagePage.gotoInvoiceList(fixture.jobId);
        await expect(retainagePage.listNetPayableHeader).toBeVisible({ timeout: 20000 });

        await retainagePage.gotoInvoiceDetail(fixture.jobId, fixture.invoiceId);
        await expect(retainagePage.retainagePercentInput).toBeVisible({ timeout: 20000 });

        expect(errors, `Unexpected console/page errors while loading the Retainage UI: ${JSON.stringify(errors)}`).toHaveLength(0);
        Logger.success('No console errors observed while loading the Invoice list or Invoice Details Retainage UI.');
    });
});

/**
 * Final phase — Contract > Retainage deep validation.
 *
 * Discovered live via MCP browser: Jobs -> Automation_Job_for_Retainage_flow -> View Details ->
 * Contracts tab -> Retainage sub-tab (URL query param contractSubTab=retainage). This tab is
 * powered by a single API call, GET /api/jobs/{jobId}/retainage-invoices, which returns every
 * *approved* invoice (approved_at is non-null) together with its nested line items in one
 * response — the expand/collapse '›' toggle is pure client-side rendering, no extra request
 * fires (confirmed by diffing the network log before/after clicking it).
 *
 * The fixture invoice (#14080) is the same one used in the earlier Invoice-tab tests above; by
 * the time this phase ran it had been approved (approved_at populated), which is why it now shows
 * up here — the Retainage tab does not list unapproved/Draft invoices.
 */
test.describe('Verify Contract > Retainage deep validation', () => {
    test.describe.configure({ retries: 1 });

    test.beforeEach(async ({ page: p }) => {
        page = p;
        retainagePage = new RetainagePage(page);
    });

    test('TC219 @regression @retainage : Contracts tab -> Retainage sub-tab loads with the correct headers', async () => {
        await retainagePage.gotoContractRetainageTab(fixture.jobId);

        const notFound = await page.getByText('not found', { exact: false }).isVisible({ timeout: 5000 }).catch(() => false);
        test.skip(notFound, `Fixture job ${fixture.jobId} no longer exists — update data/retainageFixture.json.`);

        await expect(page).toHaveURL(/contractSubTab=retainage/);
        await expect(retainagePage.retainageSubTab).toHaveAttribute('aria-selected', 'true');
        Logger.success('Contracts tab loaded and Retainage sub-tab is selected.');

        await expect(retainagePage.retainageTabInvoiceOrLineItemHeader).toBeVisible({ timeout: 15000 });
        await expect(retainagePage.retainageTabDateHeader).toBeVisible();
        await expect(retainagePage.retainageTabWithheldHeader).toBeVisible();
        await expect(retainagePage.retainageTabReleasedHeader).toBeVisible();
        await expect(retainagePage.retainageTabOutstandingHeader).toBeVisible();
        Logger.success('Headers verified: Invoice / Line Item, Date, Withheld, Released, Outstanding.');
    });

    test('TC220 @regression @retainage : Invoice row is present with correct Date/Withheld/Released/Outstanding and expands successfully', async () => {
        await retainagePage.gotoContractRetainageTab(fixture.jobId);

        const invoiceRow = retainagePage.getRetainageTabInvoiceRow(`Invoice #${fixture.invoiceId}`);
        await expect(invoiceRow, 'Invoice present on Retainage tab').toBeVisible({ timeout: 15000 });

        const before = await retainagePage.getRetainageTabRowValues(invoiceRow);
        Logger.info(`Invoice row before expand: ${JSON.stringify(before)}`);
        expect(before.withheld).toBe('$200');
        expect(before.released).toBe('$0');
        expect(before.outstanding).toBe('$200');
        Logger.success('Invoice row values verified before expansion.');

        await retainagePage.toggleRetainageTabRow(invoiceRow);
        const lineItemRow = retainagePage.getRetainageTabLineItemRow('Bid with material', '76000');
        await expect(lineItemRow, 'Line item row appears after expanding the invoice row').toBeVisible({ timeout: 8000 });
        Logger.success('Invoice row expanded successfully — line item child row is visible.');
    });

    test('TC221 @regression @retainage : Every available line item under the invoice is expanded and has no further nested rows', async () => {
        await retainagePage.gotoContractRetainageTab(fixture.jobId);
        const invoiceRow = retainagePage.getRetainageTabInvoiceRow(`Invoice #${fixture.invoiceId}`);
        await expect(invoiceRow).toBeVisible({ timeout: 15000 });

        await retainagePage.toggleRetainageTabRow(invoiceRow);
        const dataRows = page.locator('revo-grid revogr-data[type="rgRow"] div[role="row"]');
        await expect(dataRows).toHaveCount(2, { timeout: 8000 }); // invoice row + exactly 1 line item
        Logger.success('Expanded row count = 2 (1 invoice + 1 line item) — matches the retainage-invoices API payload (lines.length === 1).');

        const lineItemRow = retainagePage.getRetainageTabLineItemRow('Bid with material', '76000');
        const expandToggleOnChild = lineItemRow.locator('.tree-toggle');
        await expect(expandToggleOnChild, 'Line item row has no further expand toggle — no deeper nesting exists').toHaveCount(0);
        Logger.success('Confirmed no additional expandable rows remain under the line item — expansion is exhaustive for this fixture.');
    });

    test('TC222 @regression @retainage : Expanded line item shows correct Scope/Schedule of Value label and currency values', async () => {
        await retainagePage.gotoContractRetainageTab(fixture.jobId);
        const invoiceRow = retainagePage.getRetainageTabInvoiceRow(`Invoice #${fixture.invoiceId}`);
        await retainagePage.toggleRetainageTabRow(invoiceRow);

        const lineItemRow = retainagePage.getRetainageTabLineItemRow('Bid with material', '76000');
        await expect(lineItemRow).toBeVisible({ timeout: 8000 });

        const values = await retainagePage.getRetainageTabRowValues(lineItemRow);
        Logger.info(`Line item values: ${JSON.stringify(values)}`);

        expect(values.label).toBe('Bid with material · 76000');
        expect(values.date).toBe('—');
        expect(values.withheld).toBe('$200');
        expect(values.released).toBe('$0');
        expect(values.outstanding).toBe('—');
        Logger.success('Line item Description/Schedule of Value label, Withheld and Released amounts verified; Date and Outstanding are intentionally blank at line-item level.');

        // Parent-child hierarchy: the line item's Withheld must equal the parent invoice's Withheld
        // because this invoice has exactly one line item (per the retainage-invoices API payload).
        const invoiceValues = await retainagePage.getRetainageTabRowValues(invoiceRow);
        expect(values.withheld).toBe(invoiceValues.withheld);
        expect(values.released).toBe(invoiceValues.released);
        Logger.success(`Parent-child hierarchy verified: line item Withheld/Released (${values.withheld}/${values.released}) match parent invoice row.`);
    });

    test('TC223 @regression @retainage : Total row is correct and cross-checks against the expanded rows', async () => {
        await retainagePage.gotoContractRetainageTab(fixture.jobId);
        const invoiceRow = retainagePage.getRetainageTabInvoiceRow(`Invoice #${fixture.invoiceId}`);
        await retainagePage.toggleRetainageTabRow(invoiceRow);
        const lineItemRow = retainagePage.getRetainageTabLineItemRow('Bid with material', '76000');
        await expect(lineItemRow).toBeVisible({ timeout: 8000 });

        const totals = await retainagePage.getRetainageTabTotals();
        Logger.info(`Totals row: ${JSON.stringify(totals)}`);
        expect(totals.withheld).toBe('$200');
        expect(totals.released).toBe('$0');
        expect(totals.outstanding).toBe('—');
        Logger.success('Total row values verified: Withheld=$200, Released=$0, Outstanding=— (not summed by design).');

        const invoiceValues = await retainagePage.getRetainageTabRowValues(invoiceRow);
        const lineItemValues = await retainagePage.getRetainageTabRowValues(lineItemRow);
        expect(totals.withheld).toBe(invoiceValues.withheld);
        expect(totals.withheld).toBe(lineItemValues.withheld);
        expect(totals.released).toBe(invoiceValues.released);
        expect(totals.released).toBe(lineItemValues.released);
        Logger.success('Cross-check passed: Total row Withheld/Released match both the invoice-level row and the sum of its expanded line item(s).');
    });

    test('TC224 @regression @retainage : Withheld amount matches Invoice Amount x Retainage % from the invoice created earlier', async () => {
        await retainagePage.gotoInvoiceDetail(fixture.jobId, fixture.invoiceId);
        await expect(retainagePage.retainagePercentInput).toBeVisible({ timeout: 20000 });
        const overview = await retainagePage.getOverviewRetainageValues();
        const grossAmount = RetainagePage.parseCurrency(overview.grossAmount);
        const retainagePercent = parseFloat(overview.retainagePercent.replace('%', ''));
        const expectedWithheld = Math.round(grossAmount * (retainagePercent / 100));
        Logger.info(`Invoice detail: grossAmount=${grossAmount}, retainagePercent=${retainagePercent}%, expectedWithheld=${expectedWithheld}`);

        await retainagePage.gotoContractRetainageTab(fixture.jobId);
        const invoiceRow = retainagePage.getRetainageTabInvoiceRow(`Invoice #${fixture.invoiceId}`);
        await expect(invoiceRow).toBeVisible({ timeout: 15000 });
        const retainageTabValues = await retainagePage.getRetainageTabRowValues(invoiceRow);
        const actualWithheld = RetainagePage.parseCurrency(retainageTabValues.withheld);
        const actualOutstanding = RetainagePage.parseCurrency(retainageTabValues.outstanding);
        const actualReleased = RetainagePage.parseCurrency(retainageTabValues.released);

        expect(actualWithheld).toBe(expectedWithheld);
        Logger.success(`Withheld ($${actualWithheld}) = Invoice Amount ($${grossAmount}) x Retainage % (${retainagePercent}%) verified end-to-end (Invoice Details -> Contract Retainage tab).`);

        expect(actualOutstanding).toBeCloseTo(actualWithheld - actualReleased, 2);
        Logger.success(`Outstanding ($${actualOutstanding}) = Withheld ($${actualWithheld}) - Released ($${actualReleased}) verified.`);
    });

    test('TC225 @regression @retainage : Currency formatting is correct for Withheld/Released/Outstanding', async () => {
        await retainagePage.gotoContractRetainageTab(fixture.jobId);
        const invoiceRow = retainagePage.getRetainageTabInvoiceRow(`Invoice #${fixture.invoiceId}`);
        await expect(invoiceRow).toBeVisible({ timeout: 15000 });
        await retainagePage.toggleRetainageTabRow(invoiceRow);
        const lineItemRow = retainagePage.getRetainageTabLineItemRow('Bid with material', '76000');
        await expect(lineItemRow).toBeVisible({ timeout: 8000 });

        const invoiceValues = await retainagePage.getRetainageTabRowValues(invoiceRow);
        const lineItemValues = await retainagePage.getRetainageTabRowValues(lineItemRow);
        const totals = await retainagePage.getRetainageTabTotals();

        const currencyOrDash = /^(\$[\d,]+(\.\d{2})?|—)$/;
        for (const [source, values] of [['invoice row', invoiceValues], ['line item row', lineItemValues], ['totals row', totals]]) {
            for (const field of ['withheld', 'released', 'outstanding']) {
                expect(values[field], `${source}.${field} = "${values[field]}" must be "$"-prefixed currency or an em-dash`).toMatch(currencyOrDash);
            }
        }
        Logger.success('Currency formatting verified across invoice row, line item row and totals row: $ prefix present, no thousands separator needed at these magnitudes, zero renders as "$0", missing values render as "—" (no negative values observed for this fixture).');

        expect(lineItemValues.released).toBe('$0');
        Logger.success('Zero-amount formatting verified: Released renders as "$0" (not "$0.00" or blank).');
    });

    test('TC226 @regression @retainage : Expand/collapse persists data correctly with no UI corruption across repeated cycles', async () => {
        await retainagePage.gotoContractRetainageTab(fixture.jobId);
        const invoiceRow = retainagePage.getRetainageTabInvoiceRow(`Invoice #${fixture.invoiceId}`);
        await expect(invoiceRow).toBeVisible({ timeout: 15000 });
        const dataRows = page.locator('revo-grid revogr-data[type="rgRow"] div[role="row"]');

        for (let cycle = 1; cycle <= 2; cycle++) {
            await retainagePage.toggleRetainageTabRow(invoiceRow);
            await expect(dataRows).toHaveCount(2, { timeout: 8000 });
            const expandedLineItem = retainagePage.getRetainageTabLineItemRow('Bid with material', '76000');
            const valuesAfterExpand = await retainagePage.getRetainageTabRowValues(expandedLineItem);
            expect(valuesAfterExpand.withheld).toBe('$200');
            Logger.success(`Cycle ${cycle}: expand -> line item visible with unchanged Withheld=$200.`);

            await retainagePage.toggleRetainageTabRow(invoiceRow);
            await expect(dataRows).toHaveCount(1, { timeout: 8000 });
            const invoiceValuesAfterCollapse = await retainagePage.getRetainageTabRowValues(invoiceRow);
            expect(invoiceValuesAfterCollapse.withheld).toBe('$200');
            expect(invoiceValuesAfterCollapse.outstanding).toBe('$200');
            Logger.success(`Cycle ${cycle}: collapse -> line item hidden, invoice row values unchanged (Withheld=$200, Outstanding=$200) — no UI corruption.`);
        }
    });

    test('TC227 @regression @retainage : Contract / Documents / Retainage sub-tab selection state is correct when switching tabs', async () => {
        await retainagePage.gotoContractRetainageTab(fixture.jobId);
        await expect(retainagePage.retainageSubTab).toHaveAttribute('aria-selected', 'true');

        await retainagePage.contractSubTab.click();
        await expect(retainagePage.contractSubTab).toHaveAttribute('aria-selected', 'true');
        await expect(retainagePage.retainageSubTab).toHaveAttribute('aria-selected', 'false');
        Logger.success('Switched to Contract sub-tab — selected state correct.');

        await retainagePage.documentsSubTab.click();
        await expect(retainagePage.documentsSubTab).toHaveAttribute('aria-selected', 'true');
        await expect(retainagePage.contractSubTab).toHaveAttribute('aria-selected', 'false');
        Logger.success('Switched to Documents sub-tab — selected state correct.');

        await retainagePage.retainageSubTab.click();
        await expect(page).toHaveURL(/contractSubTab=retainage/, { timeout: 10000 });
        await expect(retainagePage.retainageSubTab).toHaveAttribute('aria-selected', 'true');
        await expect(retainagePage.documentsSubTab).toHaveAttribute('aria-selected', 'false');
        Logger.success('Switched back to Retainage sub-tab — selected state correct and URL reflects contractSubTab=retainage.');
    });

    test('TC228 @regression @retainage : retainage-invoices API returns 200 with values matching the UI', async () => {
        let capturedResponse = null;
        page.on('response', async (response) => {
            if (response.url().includes(`/api/jobs/${fixture.jobId}/retainage-invoices`)) {
                capturedResponse = response;
            }
        });

        const start = Date.now();
        await retainagePage.gotoContractRetainageTab(fixture.jobId);
        const invoiceRow = retainagePage.getRetainageTabInvoiceRow(`Invoice #${fixture.invoiceId}`);
        await expect(invoiceRow).toBeVisible({ timeout: 15000 });
        const elapsedMs = Date.now() - start;

        expect(capturedResponse, 'GET /api/jobs/{jobId}/retainage-invoices must have fired while loading the Retainage tab').not.toBeNull();
        expect(capturedResponse.status()).toBe(200);
        Logger.success(`API /api/jobs/${fixture.jobId}/retainage-invoices returned HTTP 200 within the ${elapsedMs}ms page-load window.`);

        const body = await capturedResponse.json();
        Logger.info(`API response body: ${JSON.stringify(body)}`);
        expect(Array.isArray(body.invoices)).toBeTruthy();
        const invoice = body.invoices.find((inv) => inv.invoice_id === fixture.invoiceId);
        expect(invoice, `API response must include invoice_id ${fixture.invoiceId}`).toBeTruthy();
        expect(invoice.approved_at, 'Retainage tab only returns approved invoices — approved_at must be non-null').not.toBeNull();
        expect(Array.isArray(invoice.lines)).toBeTruthy();
        expect(invoice.lines.length).toBeGreaterThan(0);

        const rowValues = await retainagePage.getRetainageTabRowValues(invoiceRow);
        const apiWithheldFormatted = `$${Math.round(parseFloat(invoice.lines.reduce((sum, l) => sum + parseFloat(l.withheld), 0))).toLocaleString()}`;
        expect(rowValues.withheld).toBe(apiWithheldFormatted);
        Logger.success(`API payload cross-checked against UI: sum of lines[].withheld (${apiWithheldFormatted}) matches the rendered invoice row Withheld (${rowValues.withheld}).`);
    });

    test('TC229 @regression @retainage : No console errors, page errors, or failed API responses on the Contract > Retainage tab', async () => {
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

        await retainagePage.gotoContractRetainageTab(fixture.jobId);
        const invoiceRow = retainagePage.getRetainageTabInvoiceRow(`Invoice #${fixture.invoiceId}`);
        await expect(invoiceRow).toBeVisible({ timeout: 15000 });
        await retainagePage.toggleRetainageTabRow(invoiceRow);
        const lineItemRow = retainagePage.getRetainageTabLineItemRow('Bid with material', '76000');
        await expect(lineItemRow).toBeVisible({ timeout: 8000 });
        await retainagePage.toggleRetainageTabRow(invoiceRow);

        expect(consoleErrors, `Unexpected console errors: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
        expect(pageErrors, `Unexpected page errors: ${JSON.stringify(pageErrors)}`).toHaveLength(0);
        expect(failedResponses, `Unexpected failed API responses: ${JSON.stringify(failedResponses)}`).toHaveLength(0);
        Logger.success('No console errors, page errors, or failed (4xx/5xx) API responses observed while loading and expanding/collapsing the Contract > Retainage tab.');
    });
});
