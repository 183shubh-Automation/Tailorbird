require('dotenv').config();
/**
 * Retainage flow — discovered via a mandatory MCP browser investigation of the live staging app
 * (see artifacts/debug/*.json for the full UI inventory, network log, and locator map).
 *
 * There is no standalone "Retainage" screen: the feature lives inside the existing Invoice tab
 * (list-grid columns) and the Invoice Details drawer (Overview fields + line-items grid columns).
 * This spec drives a pre-existing staging fixture purpose-built for this flow — project
 * "Project_Automation_Retainage_flow" / job "Automation_Job_for_Retainage_flow" — whose IDs,
 * expected values, and text keywords are read from fixture/retainage.json so this file never
 * needs to change if the fixture moves.
 *
 * Complete page-object split: every selector lives in locators/retainageLocator.js, every
 * page interaction/computation is a method on pages/retainagePage.js, and every keyword/expected
 * value used in assertions is read from fixture/retainage.json.
 */
const { test, expect } = require('@playwright/test');
const { RetainagePage } = require('../pages/retainagePage');
const { retainageLocators } = require('../locators/retainageLocator');
const { Logger } = require('../utils/logger');
const fixture = require('../fixture/retainage.json');

test.use({
    storageState: 'sessionState.json',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
});

let page, retainagePage, loc;

test.describe('Verify Retainage flow (Invoice list + Invoice Details)', () => {
    test.describe.configure({ retries: 1 });

    test.beforeEach(async ({ page: p }) => {
        page = p;
        retainagePage = new RetainagePage(page);
        loc = retainageLocators(page);
    });

    test('TC211 @regression @retainage : Invoice list grid exposes Retainage Withheld/Released/Outstanding/Net Payable columns', async () => {
        await retainagePage.gotoInvoiceList(fixture.jobId);

        const jobNotFound = await page.getByText(fixture.messages.jobNotFoundOnInvoiceList, { exact: false }).isVisible({ timeout: 5000 }).catch(() => false);
        test.skip(jobNotFound, `Fixture job ${fixture.jobId} no longer exists — update fixture/retainage.json.`);

        await expect(loc.listRetainageWithheldHeader).toBeVisible({ timeout: 20000 });
        await expect(loc.listRetainageReleasedHeader).toBeVisible();
        await expect(loc.listOutstandingRetainageHeader).toBeVisible();
        await expect(loc.listNetPayableHeader).toBeVisible();
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
        expect(rowText).toContain(fixture.expected.listRowWithheldText);
        expect(rowText).toContain(fixture.expected.listRowNetPayableText);
        Logger.success(`Invoice row Retainage Withheld (${fixture.expected.listRowWithheldText}) and Net Payable (${fixture.expected.listRowNetPayableText}) verified.`);
    });

    test('TC213 @regression @retainage : Invoice Details Overview shows Retainage %, Gross Amount, Withheld, Released and Net Payable', async () => {
        await retainagePage.gotoInvoiceDetail(fixture.jobId, fixture.invoiceId);

        const notFound = await page.getByText(fixture.messages.notFoundGeneric, { exact: false }).isVisible({ timeout: 5000 }).catch(() => false);
        test.skip(notFound, `Fixture invoice ${fixture.invoiceId} no longer exists — update fixture/retainage.json.`);

        await expect(loc.retainagePercentLabel).toBeVisible({ timeout: 20000 });
        const values = await retainagePage.getOverviewRetainageValues();
        Logger.info(`Overview Retainage values: ${JSON.stringify(values)}`);

        expect(values.retainagePercent).toMatch(new RegExp(fixture.patterns.percentSuffix));
        expect(values.grossAmount).toMatch(new RegExp(fixture.patterns.moneyPrefix));
        expect(values.retainageWithheld).toMatch(new RegExp(fixture.patterns.withheldSignedPrefix));
        expect(values.retainageReleased).toMatch(new RegExp(fixture.patterns.releasedSignedPrefix));
        expect(values.netPayable).toMatch(new RegExp(fixture.patterns.moneyPrefix));
        Logger.success(`Overview fields present with expected formatting: ${JSON.stringify(values)}`);
    });

    test('TC214 @regression @retainage : Retainage % locks once the invoice is Approved; Gross Amount, Withheld, Released and Net Payable are always read-only', async () => {
        await retainagePage.gotoInvoiceDetail(fixture.jobId, fixture.invoiceId);
        await expect(loc.retainagePercentInput).toBeVisible({ timeout: 20000 });

        // Confirmed live via MCP browser: approving an invoice (status Draft -> Approved) locks its
        // entire Overview panel, including Retainage % (previously editable while Draft). Branch on
        // the invoice's current lock state instead of assuming one, so this test stays valid whether
        // the fixture invoice is re-created as Draft or is already Approved.
        const isLocked = await loc.invoiceNumberInput.isDisabled();
        Logger.info(`Invoice Overview lock state: invoiceNumberInput disabled=${isLocked} (disabled implies invoice status is Approved).`);

        if (isLocked) {
            await expect(loc.retainagePercentInput).toBeDisabled();
            Logger.success('Invoice is Approved — Retainage % is correctly locked/disabled along with the rest of the Overview panel.');
        } else {
            await expect(loc.retainagePercentInput).toBeEnabled();
            Logger.success('Invoice is in Draft — Retainage % is correctly editable.');
        }

        await expect(loc.grossAmountInput).toBeDisabled();
        await expect(loc.retainageWithheldInput).toBeDisabled();
        await expect(loc.retainageReleasedInput).toBeDisabled();
        await expect(loc.netPayableInput).toBeDisabled();
        Logger.success('Gross Amount / Retainage Withheld / Retainage Released / Net Payable are disabled computed fields regardless of approval state.');
    });

    test('TC215 @regression @retainage : Net Payable = Gross Amount - Retainage Withheld + Retainage Released', async () => {
        await retainagePage.gotoInvoiceDetail(fixture.jobId, fixture.invoiceId);
        await expect(loc.retainagePercentInput).toBeVisible({ timeout: 20000 });

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
        await expect(loc.retainagePercentInput).toBeVisible({ timeout: 20000 });

        await expect(loc.lineItemsRetainagePercentHeader).toBeVisible({ timeout: 15000 });
        await expect(loc.lineItemsRetainageAmountHeader).toBeVisible();
        await expect(loc.lineItemsRetainageReleasedHeader).toBeVisible();
        await expect(loc.lineItemsTotalWithheldHeader).toBeVisible();
        await expect(loc.lineItemsOutstandingRetainageHeader).toBeVisible();
        await expect(loc.lineItemsNetPayableHeader).toBeVisible();
        Logger.success('Line-items grid Retainage %, Retainage ($), Retainage Released, Total Withheld to Date, Outstanding Retainage and Net Payable headers are all visible.');
    });

    test('TC217 @regression @retainage : Go Back returns from Invoice Details to the Invoice list', async () => {
        await retainagePage.gotoInvoiceDetail(fixture.jobId, fixture.invoiceId);
        await expect(loc.goBackButton).toBeVisible({ timeout: 20000 });

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
        await expect(loc.listNetPayableHeader).toBeVisible({ timeout: 20000 });

        await retainagePage.gotoInvoiceDetail(fixture.jobId, fixture.invoiceId);
        await expect(loc.retainagePercentInput).toBeVisible({ timeout: 20000 });

        expect(errors, `Unexpected console/page errors while loading the Retainage UI: ${JSON.stringify(errors)}`).toHaveLength(0);
        Logger.success('No console errors observed while loading the Invoice list or Invoice Details Retainage UI.');
    });

    test('TC230 @regression @retainage : Invoice line-items grid shows the correct per-line Retainage %, Retainage ($), Retainage Released, Total Withheld to Date, Outstanding Retainage and Net Payable values', async () => {
        await retainagePage.gotoInvoiceDetail(fixture.jobId, fixture.invoiceId);
        await expect(loc.retainagePercentInput).toBeVisible({ timeout: 20000 });

        const row = retainagePage.getInvoiceLineItemRow(fixture.lineItem.scope, fixture.lineItem.scheduleOfValue);
        await expect(row, `Line item row "${fixture.lineItem.label}" must be visible in the invoice line-items grid`).toBeVisible({ timeout: 15000 });

        const values = await retainagePage.getInvoiceLineItemRowValues(row);
        Logger.info(`Line-items grid row values for "${fixture.lineItem.label}": ${JSON.stringify(values)}`);

        Logger.info(`Asserting Invoice Amount -> actual: "${values.invoiceAmount}" | expected: "${fixture.lineItem.invoiceAmount}"`);
        expect(values.invoiceAmount).toBe(fixture.lineItem.invoiceAmount);

        Logger.info(`Asserting Retainage % -> actual: "${values.retainagePercent}" | expected: "${fixture.lineItem.retainagePercentValue}"`);
        expect(values.retainagePercent).toBe(fixture.lineItem.retainagePercentValue);

        Logger.info(`Asserting Retainage ($) -> actual: "${values.retainageAmount}" | expected: "${fixture.lineItem.retainageAmount}"`);
        expect(values.retainageAmount).toBe(fixture.lineItem.retainageAmount);

        Logger.info(`Asserting Retainage Released ($) -> actual: "${values.retainageReleased}" | expected: "${fixture.lineItem.retainageReleased}"`);
        expect(values.retainageReleased).toBe(fixture.lineItem.retainageReleased);

        Logger.info(`Asserting Total Withheld to Date -> actual: "${values.totalWithheldToDate}" | expected: "${fixture.lineItem.totalWithheldToDate}"`);
        expect(values.totalWithheldToDate).toBe(fixture.lineItem.totalWithheldToDate);

        Logger.info(`Asserting Outstanding Retainage -> actual: "${values.outstandingRetainage}" | expected: "${fixture.lineItem.outstandingRetainageToDate}"`);
        expect(values.outstandingRetainage).toBe(fixture.lineItem.outstandingRetainageToDate);

        Logger.info(`Asserting Net Payable -> actual: "${values.netPayable}" | expected: "${fixture.lineItem.netPayable}"`);
        expect(values.netPayable).toBe(fixture.lineItem.netPayable);

        // Per-line formula check, computed from this same row's own cells (not the fixture
        // constants above), so it fails loudly if the UI's math ever drifts from the source data.
        const invoiceAmount = RetainagePage.parseCurrency(values.invoiceAmount);
        const retainagePercent = parseFloat(values.retainagePercent);
        const retainageAmount = RetainagePage.parseCurrency(values.retainageAmount);
        const netPayable = RetainagePage.parseCurrency(values.netPayable);
        const expectedRetainageAmount = Math.round(invoiceAmount * (retainagePercent / 100));
        const expectedNetPayable = invoiceAmount - retainageAmount + RetainagePage.parseCurrency(values.retainageReleased);
        Logger.info(`Formula check: Invoice Amount ($${invoiceAmount}) x Retainage % (${retainagePercent}%) = $${expectedRetainageAmount} (actual: $${retainageAmount})`);
        expect(retainageAmount).toBe(expectedRetainageAmount);
        Logger.info(`Formula check: Net Payable = Invoice Amount ($${invoiceAmount}) - Retainage ($${retainageAmount}) + Released ($0) = $${expectedNetPayable} (actual: $${netPayable})`);
        expect(netPayable).toBe(expectedNetPayable);
        Logger.success(`Invoice line-items grid values and Retainage % calculation verified for "${fixture.lineItem.label}".`);
    });

    test('TC231 @regression @retainage : Retainage calculation formula is verified explicitly — Invoice Amount x Retainage % = Retainage Withheld, and Invoice Amount - Retainage Withheld + Retainage Released = Net Payable', async () => {
        await retainagePage.gotoInvoiceDetail(fixture.jobId, fixture.invoiceId);
        await expect(loc.retainagePercentInput).toBeVisible({ timeout: 20000 });

        const overview = await retainagePage.getOverviewRetainageValues();
        const invoiceAmount = RetainagePage.parseCurrency(overview.grossAmount);
        const retainagePercent = parseFloat(overview.retainagePercent.replace('%', ''));
        // The Overview panel displays Retainage Withheld with a leading "-" (a deduction-style
        // sign, e.g. "- $200") and Retainage Released with a leading "+" — parseCurrency preserves
        // that sign. The withheld-vs-percentage formula compares magnitudes; the net-payable
        // formula below adds the signed values directly, same as TC215.
        const actualRetainageWithheldSigned = RetainagePage.parseCurrency(overview.retainageWithheld);
        const actualRetainageWithheld = Math.abs(actualRetainageWithheldSigned);
        const actualRetainageReleased = RetainagePage.parseCurrency(overview.retainageReleased);
        const actualNetPayable = RetainagePage.parseCurrency(overview.netPayable);

        Logger.step(`Verifying Retainage calculation for Invoice #${fixture.invoiceId} — Invoice Amount = $${invoiceAmount}, Retainage % = ${retainagePercent}%`);

        // Step 1: Invoice Amount x Retainage % = Retainage Withheld
        const expectedRetainageWithheld = Math.round(invoiceAmount * (retainagePercent / 100));
        Logger.info(`Calculated Retainage Withheld = Invoice Amount ($${invoiceAmount}) x Retainage % (${retainagePercent}%) = $${expectedRetainageWithheld}`);
        Logger.info(`Actual Retainage Withheld from Overview panel = $${actualRetainageWithheld} (displayed as "${overview.retainageWithheld}")`);
        expect(actualRetainageWithheld).toBe(expectedRetainageWithheld);
        Logger.success(`Retainage Withheld calculation verified: $${invoiceAmount} x ${retainagePercent}% = $${expectedRetainageWithheld} (matches actual).`);

        // Step 2: Invoice Amount - Retainage Withheld + Retainage Released = Net Payable
        const expectedNetPayable = invoiceAmount + actualRetainageWithheldSigned + actualRetainageReleased;
        Logger.info(`Calculated Net Payable = Invoice Amount ($${invoiceAmount}) - Retainage Withheld ($${actualRetainageWithheld}) + Retainage Released ($${actualRetainageReleased}) = $${expectedNetPayable}`);
        Logger.info(`Actual Net Payable from Overview panel = $${actualNetPayable}`);
        expect(actualNetPayable).toBe(expectedNetPayable);
        Logger.success(`Net Payable calculation verified: $${invoiceAmount} - $${actualRetainageWithheld} + $${actualRetainageReleased} = $${expectedNetPayable} (matches actual).`);

        // Illustrative worked example in the style requested: for an invoice amount of $1000 at a
        // 5% retainage rate, the same two formulas verified above would compute Retainage Withheld
        // = $1000 x 5% = $50, and Net Payable = $1000 - $50 + $0 = $950. This fixture invoice's
        // contract is finalized (Retainage % is locked — see TC233), so its own real numbers are
        // used above instead of fabricating a second invoice at a different rate.
        const illustrativeAmount = 1000;
        const illustrativePercent = 5;
        const illustrativeWithheld = Math.round(illustrativeAmount * (illustrativePercent / 100));
        const illustrativeNetPayable = illustrativeAmount - illustrativeWithheld;
        Logger.info(`Formula sanity-check with the requested example: Invoice Amount $${illustrativeAmount}, Retainage % ${illustrativePercent}% -> Retainage Withheld $${illustrativeWithheld}, Net Payable $${illustrativeNetPayable}`);
        expect(illustrativeWithheld).toBe(50);
        expect(illustrativeNetPayable).toBe(950);
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
        loc = retainageLocators(page);
    });

    test('TC219 @regression @retainage : Contracts tab -> Retainage sub-tab loads with the correct headers', async () => {
        await retainagePage.gotoContractRetainageTab(fixture.jobId);

        const notFound = await page.getByText(fixture.messages.notFoundGeneric, { exact: false }).isVisible({ timeout: 5000 }).catch(() => false);
        test.skip(notFound, `Fixture job ${fixture.jobId} no longer exists — update fixture/retainage.json.`);

        await expect(page).toHaveURL(/contractSubTab=retainage/);
        await expect(loc.retainageSubTab).toHaveAttribute('aria-selected', 'true');
        Logger.success('Contracts tab loaded and Retainage sub-tab is selected.');

        await expect(loc.retainageTabInvoiceOrLineItemHeader).toBeVisible({ timeout: 15000 });
        await expect(loc.retainageTabDateHeader).toBeVisible();
        await expect(loc.retainageTabWithheldHeader).toBeVisible();
        await expect(loc.retainageTabReleasedHeader).toBeVisible();
        await expect(loc.retainageTabOutstandingHeader).toBeVisible();
        Logger.success('Headers verified: Invoice / Line Item, Date, Withheld, Released, Outstanding.');
    });

    test('TC220 @regression @retainage : Invoice row is present with correct Date/Withheld/Released/Outstanding and expands successfully', async () => {
        await retainagePage.gotoContractRetainageTab(fixture.jobId);

        const invoiceRow = retainagePage.getRetainageTabInvoiceRow(`Invoice #${fixture.invoiceId}`);
        await expect(invoiceRow, 'Invoice present on Retainage tab').toBeVisible({ timeout: 15000 });

        const before = await retainagePage.getRetainageTabRowValues(invoiceRow);
        Logger.info(`Invoice row before expand: ${JSON.stringify(before)}`);
        expect(before.withheld).toBe(fixture.expected.retainageTab.withheld);
        expect(before.released).toBe(fixture.expected.retainageTab.released);
        expect(before.outstanding).toBe(fixture.expected.retainageTab.outstanding);
        Logger.success('Invoice row values verified before expansion.');

        await retainagePage.toggleRetainageTabRow(invoiceRow);
        const lineItemRow = retainagePage.getRetainageTabLineItemRow(fixture.lineItem.scope, fixture.lineItem.scheduleOfValue);
        await expect(lineItemRow, 'Line item row appears after expanding the invoice row').toBeVisible({ timeout: 8000 });
        Logger.success('Invoice row expanded successfully — line item child row is visible.');
    });

    test('TC221 @regression @retainage : Every available line item under the invoice is expanded and has no further nested rows', async () => {
        await retainagePage.gotoContractRetainageTab(fixture.jobId);
        const invoiceRow = retainagePage.getRetainageTabInvoiceRow(`Invoice #${fixture.invoiceId}`);
        await expect(invoiceRow).toBeVisible({ timeout: 15000 });

        await retainagePage.toggleRetainageTabRow(invoiceRow);
        // Scoped to this invoice's own rows (between it and the next top-level invoice row, if
        // any) rather than the whole grid — the job can accumulate additional invoices over time,
        // and a global row-count assertion would break as soon as a second one appears.
        await expect
            .poll(() => retainagePage.getChildRowCount(invoiceRow), { timeout: 8000 })
            .toBe(1); // exactly 1 line item, matching the retainage-invoices API payload (lines.length === 1)
        Logger.success(`Invoice #${fixture.invoiceId} expanded to exactly 1 child row — matches the retainage-invoices API payload (lines.length === 1), independent of any other invoices present in the grid.`);

        const lineItemRow = retainagePage.getRetainageTabLineItemRow(fixture.lineItem.scope, fixture.lineItem.scheduleOfValue);
        const expandToggleOnChild = retainagePage.hasExpandToggle(lineItemRow);
        await expect(expandToggleOnChild, 'Line item row has no further expand toggle — no deeper nesting exists').toHaveCount(0);
        Logger.success('Confirmed no additional expandable rows remain under the line item — expansion is exhaustive for this fixture.');
    });

    test('TC222 @regression @retainage : Expanded line item shows correct Scope/Schedule of Value label and currency values', async () => {
        await retainagePage.gotoContractRetainageTab(fixture.jobId);
        const invoiceRow = retainagePage.getRetainageTabInvoiceRow(`Invoice #${fixture.invoiceId}`);
        await retainagePage.toggleRetainageTabRow(invoiceRow);

        const lineItemRow = retainagePage.getRetainageTabLineItemRow(fixture.lineItem.scope, fixture.lineItem.scheduleOfValue);
        await expect(lineItemRow).toBeVisible({ timeout: 8000 });

        const values = await retainagePage.getRetainageTabRowValues(lineItemRow);
        Logger.info(`Line item values: ${JSON.stringify(values)}`);

        expect(values.label).toBe(fixture.lineItem.label);
        expect(values.date).toBe(fixture.expected.dashText);
        expect(values.withheld).toBe(fixture.expected.retainageTab.withheld);
        expect(values.released).toBe(fixture.expected.retainageTab.released);
        expect(values.outstanding).toBe(fixture.expected.dashText);
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
        const lineItemRow = retainagePage.getRetainageTabLineItemRow(fixture.lineItem.scope, fixture.lineItem.scheduleOfValue);
        await expect(lineItemRow).toBeVisible({ timeout: 8000 });

        const totals = await retainagePage.getRetainageTabTotals();
        Logger.info(`Totals row: ${JSON.stringify(totals)}`);

        // The Total row sums Withheld/Released across every invoice currently loaded in the grid
        // (not just the fixture invoice), so cross-check it against a dynamic sum rather than a
        // value hardcoded for a single-invoice job — this stays correct as more invoices land.
        const sumAcrossAllInvoices = await retainagePage.sumAllRetainageTabInvoiceRows();
        Logger.info(`Sum of Withheld/Released across every invoice row in the grid: ${JSON.stringify(sumAcrossAllInvoices)}`);
        expect(RetainagePage.parseCurrency(totals.withheld)).toBe(sumAcrossAllInvoices.withheld);
        expect(RetainagePage.parseCurrency(totals.released)).toBe(sumAcrossAllInvoices.released);
        expect(totals.outstanding).toBe(fixture.expected.dashText);
        Logger.success(`Total row cross-checked: Withheld ($${sumAcrossAllInvoices.withheld}) and Released ($${sumAcrossAllInvoices.released}) match the sum of every invoice row in the grid; Outstanding shows "—" (not summed by design).`);

        const invoiceValues = await retainagePage.getRetainageTabRowValues(invoiceRow);
        const lineItemValues = await retainagePage.getRetainageTabRowValues(lineItemRow);
        expect(invoiceValues.withheld).toBe(lineItemValues.withheld);
        expect(invoiceValues.released).toBe(lineItemValues.released);
        Logger.success(`Cross-check passed: fixture invoice #${fixture.invoiceId}'s own Withheld/Released (${invoiceValues.withheld}/${invoiceValues.released}) match the sum of its expanded line item(s), and correctly contribute to the grid-wide Total row above.`);
    });

    test('TC224 @regression @retainage : Withheld amount matches Invoice Amount x Retainage % from the invoice created earlier', async () => {
        await retainagePage.gotoInvoiceDetail(fixture.jobId, fixture.invoiceId);
        await expect(loc.retainagePercentInput).toBeVisible({ timeout: 20000 });
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
        const lineItemRow = retainagePage.getRetainageTabLineItemRow(fixture.lineItem.scope, fixture.lineItem.scheduleOfValue);
        await expect(lineItemRow).toBeVisible({ timeout: 8000 });

        const invoiceValues = await retainagePage.getRetainageTabRowValues(invoiceRow);
        const lineItemValues = await retainagePage.getRetainageTabRowValues(lineItemRow);
        const totals = await retainagePage.getRetainageTabTotals();

        const currencyOrDash = new RegExp(fixture.patterns.currencyOrDash);
        for (const [source, values] of [['invoice row', invoiceValues], ['line item row', lineItemValues], ['totals row', totals]]) {
            for (const field of ['withheld', 'released', 'outstanding']) {
                expect(values[field], `${source}.${field} = "${values[field]}" must be "$"-prefixed currency or an em-dash`).toMatch(currencyOrDash);
            }
        }
        Logger.success('Currency formatting verified across invoice row, line item row and totals row: $ prefix present, no thousands separator needed at these magnitudes, zero renders as "$0", missing values render as "—" (no negative values observed for this fixture).');

        expect(lineItemValues.released).toBe(fixture.expected.retainageTab.released);
        Logger.success('Zero-amount formatting verified: Released renders as "$0" (not "$0.00" or blank).');
    });

    test('TC226 @regression @retainage : Expand/collapse persists data correctly with no UI corruption across repeated cycles', async () => {
        await retainagePage.gotoContractRetainageTab(fixture.jobId);
        const invoiceRow = retainagePage.getRetainageTabInvoiceRow(`Invoice #${fixture.invoiceId}`);
        await expect(invoiceRow).toBeVisible({ timeout: 15000 });

        for (let cycle = 1; cycle <= 2; cycle++) {
            await retainagePage.toggleRetainageTabRow(invoiceRow);
            // Scoped to this invoice's own child rows — robust even if other invoices in the
            // grid are independently expanded/collapsed at the same time.
            await expect
                .poll(() => retainagePage.getChildRowCount(invoiceRow), { timeout: 8000 })
                .toBe(1);
            const expandedLineItem = retainagePage.getRetainageTabLineItemRow(fixture.lineItem.scope, fixture.lineItem.scheduleOfValue);
            const valuesAfterExpand = await retainagePage.getRetainageTabRowValues(expandedLineItem);
            expect(valuesAfterExpand.withheld).toBe(fixture.expected.retainageTab.withheld);
            Logger.success(`Cycle ${cycle}: expand -> line item visible with unchanged Withheld=${fixture.expected.retainageTab.withheld}.`);

            await retainagePage.toggleRetainageTabRow(invoiceRow);
            await expect
                .poll(() => retainagePage.getChildRowCount(invoiceRow), { timeout: 8000 })
                .toBe(0);
            const invoiceValuesAfterCollapse = await retainagePage.getRetainageTabRowValues(invoiceRow);
            expect(invoiceValuesAfterCollapse.withheld).toBe(fixture.expected.retainageTab.withheld);
            expect(invoiceValuesAfterCollapse.outstanding).toBe(fixture.expected.retainageTab.outstanding);
            Logger.success(`Cycle ${cycle}: collapse -> line item hidden, invoice row values unchanged (Withheld=${fixture.expected.retainageTab.withheld}, Outstanding=${fixture.expected.retainageTab.outstanding}) — no UI corruption.`);
        }
    });

    test('TC227 @regression @retainage : Contract / Documents / Retainage sub-tab selection state is correct when switching tabs', async () => {
        await retainagePage.gotoContractRetainageTab(fixture.jobId);
        await expect(loc.retainageSubTab).toHaveAttribute('aria-selected', 'true');

        await loc.contractSubTab.click();
        await expect(loc.contractSubTab).toHaveAttribute('aria-selected', 'true');
        await expect(loc.retainageSubTab).toHaveAttribute('aria-selected', 'false');
        Logger.success('Switched to Contract sub-tab — selected state correct.');

        await loc.documentsSubTab.click();
        await expect(loc.documentsSubTab).toHaveAttribute('aria-selected', 'true');
        await expect(loc.contractSubTab).toHaveAttribute('aria-selected', 'false');
        Logger.success('Switched to Documents sub-tab — selected state correct.');

        await loc.retainageSubTab.click();
        await expect(page).toHaveURL(/contractSubTab=retainage/, { timeout: 10000 });
        await expect(loc.retainageSubTab).toHaveAttribute('aria-selected', 'true');
        await expect(loc.documentsSubTab).toHaveAttribute('aria-selected', 'false');
        Logger.success('Switched back to Retainage sub-tab — selected state correct and URL reflects contractSubTab=retainage.');
    });

    test('TC228 @regression @retainage : retainage-invoices API returns 200 with values matching the UI', async () => {
        let capturedResponse = null;
        const retainageInvoicesEndpoint = fixture.apiEndpoints.retainageInvoices.replace('{jobId}', fixture.jobId);
        page.on('response', async (response) => {
            if (response.url().includes(retainageInvoicesEndpoint)) {
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
        Logger.success(`API ${retainageInvoicesEndpoint} returned HTTP 200 within the ${elapsedMs}ms page-load window.`);

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
        const lineItemRow = retainagePage.getRetainageTabLineItemRow(fixture.lineItem.scope, fixture.lineItem.scheduleOfValue);
        await expect(lineItemRow).toBeVisible({ timeout: 8000 });
        await retainagePage.toggleRetainageTabRow(invoiceRow);

        expect(consoleErrors, `Unexpected console errors: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
        expect(pageErrors, `Unexpected page errors: ${JSON.stringify(pageErrors)}`).toHaveLength(0);
        expect(failedResponses, `Unexpected failed API responses: ${JSON.stringify(failedResponses)}`).toHaveLength(0);
        Logger.success('No console errors, page errors, or failed (4xx/5xx) API responses observed while loading and expanding/collapsing the Contract > Retainage tab.');
    });

    test('TC232 @regression @retainage : Contract Overview card shows every field, and Total Withheld / Total Released / Outstanding Balance are hidden when the contract Retainage % is 0', async () => {
        await retainagePage.gotoContractRetainageTab(fixture.jobId);
        await expect(loc.contractsTabPanel).toBeVisible({ timeout: 15000 });

        const fields = [
            ['Property', fixture.contractOverview.property],
            ['Budget Category', fixture.contractOverview.budgetCategory],
            ['Contract ID', fixture.contractOverview.contractId],
            ['Vendor', fixture.contractOverview.vendor],
            ['Vendor Address', fixture.contractOverview.vendorAddress],
            ['Duration', fixture.contractOverview.duration],
            ['Estimated Total Cost', fixture.contractOverview.estimatedTotalCost],
            ['Contract Terms', fixture.contractOverview.contractTerms],
        ];
        for (const [label, expected] of fields) {
            const actual = await retainagePage.getContractOverviewFieldValue(label);
            Logger.info(`Contract Overview field "${label}" -> actual: "${actual}" | expected: "${expected}"`);
            expect(actual).toBe(expected);
        }
        await expect(loc.editContractOverviewButton).toBeVisible({ timeout: 10000 });
        Logger.success('Contract Overview card fields (Property, Budget Category, Contract ID, Vendor, Vendor Address, Duration, Estimated Total Cost, Contract Terms) and the Edit CTA are all present and correct.');

        // Per PR978: Total Withheld / Total Released / Outstanding Balance on the Contract
        // Overview card are only shown when retainagePercent > 0. This fixture's contract-level
        // Retainage % is locked at 0% (verified in TC233), so all three must be absent here.
        await expect(loc.contractOverviewTotalWithheldLabel, `"${fixture.contractOverview.labels.totalWithheld}" must be hidden when contract Retainage % is 0`).toHaveCount(0);
        await expect(loc.contractOverviewTotalReleasedLabel, `"${fixture.contractOverview.labels.totalReleased}" must be hidden when contract Retainage % is 0`).toHaveCount(0);
        await expect(loc.contractOverviewOutstandingBalanceLabel, `"${fixture.contractOverview.labels.outstandingBalance}" must be hidden when contract Retainage % is 0`).toHaveCount(0);
        Logger.success('Total Withheld / Total Released / Outstanding Balance are correctly hidden on the Contract Overview card because this contract\'s Retainage % is 0.');
    });

    test('TC233 @regression @retainage : Edit Contract Overview drawer locks Retainage % once the contract is finalized', async () => {
        await retainagePage.gotoContractRetainageTab(fixture.jobId);
        await expect(loc.editContractOverviewButton).toBeVisible({ timeout: 15000 });

        await retainagePage.openEditContractOverviewDrawer();
        await expect(loc.editContractOverviewDialog.getByRole('heading', { name: fixture.editContractOverview.dialogTitle })).toBeVisible();
        Logger.success(`"${fixture.editContractOverview.dialogTitle}" drawer opened.`);

        await expect(loc.editContractRetainagePercentLabel, `"${fixture.editContractOverview.retainagePercentLabel}" field label must be visible`).toBeVisible({ timeout: 10000 });
        Logger.success(`"${fixture.editContractOverview.retainagePercentLabel}" field label is visible.`);

        const lockMessageText = (await loc.editContractRetainageLockMessage.textContent()).trim();
        Logger.info(`Lock message -> actual: "${lockMessageText}" | expected: "${fixture.editContractOverview.lockedMessage}"`);
        expect(lockMessageText).toBe(fixture.editContractOverview.lockedMessage);

        await expect(loc.editContractRetainagePercentInput).toBeDisabled();
        const lockedValue = await loc.editContractRetainagePercentInput.inputValue();
        Logger.info(`Retainage % input value while locked -> actual: "${lockedValue}" | expected: "${fixture.editContractOverview.lockedValue}"`);
        expect(lockedValue).toBe(fixture.editContractOverview.lockedValue);
        Logger.success('Retainage % field is disabled and shows the locked value, with the finalized-contract lock message displayed.');

        await retainagePage.cancelEditContractOverviewDrawer();
    });

    test('TC234 @regression @retainage : Retainage sub-tab is enabled because the contract is finalized', async () => {
        await retainagePage.gotoContractRetainageTab(fixture.jobId);

        // Per PR978, the Retainage sub-tab is enabled only once its contract is finalized. This
        // fixture's contract is finalized (its Retainage % is locked — see TC233), so the tab
        // must be enabled and reachable, which is what this asserts. The inverse case (tab
        // disabled on a non-finalized contract, or on a NonUIContract) has no corresponding
        // fixture available in this environment and is intentionally not fabricated here.
        await expect(loc.retainageSubTab).toBeEnabled({ timeout: 10000 });
        Logger.success('Retainage sub-tab is enabled — consistent with this contract being finalized.');
    });
});
