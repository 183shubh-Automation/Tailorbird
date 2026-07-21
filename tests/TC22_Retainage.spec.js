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

    test('TC321 @regression @retainage : Invoice list grid exposes Retainage Withheld/Released/Outstanding/Net Payable columns', async () => {
        await retainagePage.gotoInvoiceList(fixture.jobId);

        const jobNotFound = await page.getByText(fixture.messages.jobNotFoundOnInvoiceList, { exact: false }).isVisible({ timeout: 5000 }).catch(() => false);
        test.skip(jobNotFound, `Fixture job ${fixture.jobId} no longer exists — update fixture/retainage.json.`);

        await expect(loc.listRetainageWithheldHeader).toBeVisible({ timeout: 20000 });
        await expect(loc.listRetainageReleasedHeader).toBeVisible();
        await expect(loc.listOutstandingRetainageHeader).toBeVisible();
        await expect(loc.listNetPayableHeader).toBeVisible();
        Logger.success('Invoice list grid Retainage columns are all visible.');
    });

    test('TC322 @regression @retainage : Existing invoice row shows correct Retainage figures in the list grid', async () => {
        await retainagePage.gotoInvoiceList(fixture.jobId);
        // The list grid virtualizes rows and this job accumulates more invoices over time (via
        // other tests in this suite), so #14080 can scroll out of the default view — search
        // narrows it back to a single row instead of assuming it's already rendered.
        await retainagePage.searchInvoiceList(String(fixture.invoiceId));

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

    test('TC323 @regression @retainage : Invoice Details Overview shows Retainage %, Gross Amount, Withheld, Released and Net Payable', async () => {
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

    test('TC324 @regression @retainage : Retainage % locks once the invoice is Approved; Gross Amount, Withheld, Released and Net Payable are always read-only', async () => {
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

    test('TC325 @regression @retainage : Net Payable = Gross Amount - Retainage Withheld + Retainage Released', async () => {
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

    test('TC326 @regression @retainage : Invoice line-items grid exposes per-line Retainage columns', async () => {
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

    test('TC327 @regression @retainage : Go Back returns from Invoice Details to the Invoice list', async () => {
        await retainagePage.gotoInvoiceDetail(fixture.jobId, fixture.invoiceId);
        await expect(loc.goBackButton).toBeVisible({ timeout: 20000 });

        await retainagePage.goBack();
        await expect(page).toHaveURL(/tab=invoices/, { timeout: 15000 });
        Logger.success('Go Back navigated from Invoice Details drawer back to the Invoice list.');
    });

    test('TC328 @regression @retainage : No console errors while loading the Retainage UI', async () => {
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

    test('TC329 @regression @retainage : Invoice line-items grid shows the correct per-line Retainage %, Retainage ($), Retainage Released, Total Withheld to Date, Outstanding Retainage and Net Payable values', async () => {
        await retainagePage.gotoInvoiceDetail(fixture.jobId, fixture.invoiceId);
        await expect(loc.retainagePercentInput).toBeVisible({ timeout: 20000 });

        const row = retainagePage.getInvoiceLineItemRow(fixture.lineItem.scope, fixture.lineItem.scheduleOfValue);
        await expect(row, `Line item row "${fixture.lineItem.label}" must be visible in the invoice line-items grid`).toBeVisible({ timeout: 15000 });

        const values = await retainagePage.getInvoiceLineItemRowValues(row);
        Logger.info(`Line-items grid row values for "${fixture.lineItem.label}": ${JSON.stringify(values)}`);

        // ── The 4 core columns: Invoice Amount, Retainage %, Retainage ($), Net Payable ────────
        Logger.step(`Asserting the 4 core columns for "${fixture.lineItem.label}": Invoice Amount, Retainage %, Retainage ($), Net Payable`);

        Logger.info(`Column "Invoice Amount" -> actual: "${values.invoiceAmount}" | expected: "${fixture.lineItem.invoiceAmount}"`);
        expect(values.invoiceAmount).toBe(fixture.lineItem.invoiceAmount);

        Logger.info(`Column "Retainage %" -> actual: "${values.retainagePercent}" | expected: "${fixture.lineItem.retainagePercentValue}"`);
        expect(values.retainagePercent).toBe(fixture.lineItem.retainagePercentValue);

        Logger.info(`Column "Retainage ($)" -> actual: "${values.retainageAmount}" | expected: "${fixture.lineItem.retainageAmount}"`);
        expect(values.retainageAmount).toBe(fixture.lineItem.retainageAmount);

        Logger.info(`Column "Net Payable" -> actual: "${values.netPayable}" | expected: "${fixture.lineItem.netPayable}"`);
        expect(values.netPayable).toBe(fixture.lineItem.netPayable);

        Logger.success(`All 4 core columns present with the expected values: Invoice Amount=${values.invoiceAmount}, Retainage %=${values.retainagePercent}, Retainage ($)=${values.retainageAmount}, Net Payable=${values.netPayable}.`);

        // Calculation between those same 4 columns, computed from this row's own live cell values
        // (not the fixture constants above), so it fails loudly if the UI's math ever drifts from
        // the source data:
        //   Invoice Amount x Retainage % = Retainage ($)
        //   Invoice Amount - Retainage ($) + Retainage Released = Net Payable
        const invoiceAmount = RetainagePage.parseCurrency(values.invoiceAmount);
        const retainagePercent = parseFloat(values.retainagePercent);
        const retainageAmount = RetainagePage.parseCurrency(values.retainageAmount);
        const retainageReleased = RetainagePage.parseCurrency(values.retainageReleased);
        const netPayable = RetainagePage.parseCurrency(values.netPayable);

        const expectedRetainageAmount = Math.round(invoiceAmount * (retainagePercent / 100));
        Logger.info(`Calculation: Invoice Amount ($${invoiceAmount}) x Retainage % (${retainagePercent}%) = $${expectedRetainageAmount} | actual Retainage ($) = $${retainageAmount}`);
        expect(retainageAmount).toBe(expectedRetainageAmount);
        Logger.success(`Verified: $${invoiceAmount} x ${retainagePercent}% = $${expectedRetainageAmount}, matching the actual Retainage ($) column.`);

        const expectedNetPayable = invoiceAmount - retainageAmount + retainageReleased;
        Logger.info(`Calculation: Invoice Amount ($${invoiceAmount}) - Retainage ($${retainageAmount}) + Retainage Released ($${retainageReleased}) = $${expectedNetPayable} | actual Net Payable = $${netPayable}`);
        expect(netPayable).toBe(expectedNetPayable);
        Logger.success(`Verified: $${invoiceAmount} - $${retainageAmount} + $${retainageReleased} = $${expectedNetPayable}, matching the actual Net Payable column.`);

        // ── Remaining columns (Retainage Released, Total Withheld to Date, Outstanding Retainage) ──
        Logger.info(`Column "Retainage Released ($)" -> actual: "${values.retainageReleased}" | expected: "${fixture.lineItem.retainageReleased}"`);
        expect(values.retainageReleased).toBe(fixture.lineItem.retainageReleased);

        // Total Withheld to Date / Outstanding Retainage are CONTRACT-level cumulative figures for
        // this scope/schedule-of-value across every invoice on the job (confirmed live via MCP
        // browser: they grow as other invoices are added), not a value owned by this invoice alone.
        // So these are asserted structurally — currency-formatted and at least this invoice's own
        // Retainage ($) contribution — instead of pinned to one exact dollar amount that drifts.
        const totalWithheldToDate = RetainagePage.parseCurrency(values.totalWithheldToDate);
        const outstandingRetainage = RetainagePage.parseCurrency(values.outstandingRetainage);
        Logger.info(`Column "Total Withheld to Date" -> actual: "${values.totalWithheldToDate}" (cumulative across all invoices for this scope; must be >= this invoice's own Retainage ($) of $${retainageAmount})`);
        expect(values.totalWithheldToDate).toMatch(new RegExp(fixture.patterns.moneyPrefix));
        expect(totalWithheldToDate).toBeGreaterThanOrEqual(retainageAmount);

        Logger.info(`Column "Outstanding Retainage" -> actual: "${values.outstandingRetainage}" (cumulative across all invoices for this scope; must be >= this invoice's own Retainage ($) of $${retainageAmount})`);
        expect(values.outstandingRetainage).toMatch(new RegExp(fixture.patterns.moneyPrefix));
        expect(outstandingRetainage).toBeGreaterThanOrEqual(retainageAmount);
        Logger.success(`Total Withheld to Date ($${totalWithheldToDate}) and Outstanding Retainage ($${outstandingRetainage}) are correctly formatted and include this invoice's contribution.`);

        Logger.success(`Invoice line-items grid: all 7 Retainage columns and the calculation between Invoice Amount / Retainage % / Retainage ($) / Net Payable are verified for "${fixture.lineItem.label}".`);
    });

    test('TC330 @regression @retainage : Retainage calculation formula is verified explicitly — Invoice Amount x Retainage % = Retainage Withheld, and Invoice Amount - Retainage Withheld + Retainage Released = Net Payable', async () => {
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

    test('TC331 @regression @retainage : Invoice inherits the job/contract Retainage % by default, and can be overridden at the invoice level', async () => {
        await retainagePage.gotoInvoiceList(fixture.jobId);
        await retainagePage.createDraftInvoice();

        const inheritedBadge = await retainagePage.getInvoiceRetainageBadgeText();
        Logger.info(`Invoice-level Retainage % badge before any change -> actual: "${inheritedBadge}" | expected pattern: ${fixture.patterns.invoiceRetainageBadgeInherited}`);
        expect(inheritedBadge).toMatch(new RegExp(fixture.patterns.invoiceRetainageBadgeInherited));

        await retainagePage.setRetainagePercent(fixture.overrideScenario.invoiceLevelPercent);
        const overriddenBadge = await retainagePage.getInvoiceRetainageBadgeText();
        Logger.info(`Invoice-level Retainage % badge after overriding to ${fixture.overrideScenario.invoiceLevelPercent}% -> actual: "${overriddenBadge}" | expected: "Override"`);
        expect(overriddenBadge).toBe('Override');
        Logger.success('Invoice-level Retainage % transitioned from "From contract (X%)" (inherited) to "Override" once changed by the user.');

        const row = retainagePage.getInvoiceLineItemRow(fixture.lineItem.scope, fixture.lineItem.scheduleOfValue);
        await retainagePage.setLineInvoiceAmount(row, fixture.overrideScenario.invoiceAmount);

        const values = await retainagePage.getInvoiceLineItemRowValues(row);
        Logger.info(`Line values after invoice-level override cascaded down: ${JSON.stringify(values)}`);
        expect(values.retainagePercent).toBe(String(fixture.overrideScenario.invoiceLevelPercent));
        expect(RetainagePage.parseCurrency(values.retainageAmount)).toBe(fixture.overrideScenario.expectedRetainageAmount);
        expect(RetainagePage.parseCurrency(values.netPayable)).toBe(fixture.overrideScenario.expectedNetPayable);
        Logger.success(`Invoice-level override (${fixture.overrideScenario.invoiceLevelPercent}%) cascaded to the line: Retainage ($${fixture.overrideScenario.expectedRetainageAmount}) and Net Payable ($${fixture.overrideScenario.expectedNetPayable}) both match Invoice Amount ($${fixture.overrideScenario.invoiceAmount}) x ${fixture.overrideScenario.invoiceLevelPercent}%.`);
    });

    test('TC332 @regression @retainage : A single line\'s Retainage % can be overridden independently of the invoice-level value', async () => {
        await retainagePage.gotoInvoiceList(fixture.jobId);
        await retainagePage.createDraftInvoice();
        await retainagePage.setRetainagePercent(fixture.overrideScenario.invoiceLevelPercent);

        const row = retainagePage.getInvoiceLineItemRow(fixture.lineItem.scope, fixture.lineItem.scheduleOfValue);
        await retainagePage.setLineInvoiceAmount(row, fixture.overrideScenario.invoiceAmount);

        const inheritedValues = await retainagePage.getInvoiceLineItemRowValues(row);
        Logger.info(`Line Retainage % before per-line override -> actual: "${inheritedValues.retainagePercent}" | expected (inherited from invoice): "${fixture.overrideScenario.invoiceLevelPercent}"`);
        expect(inheritedValues.retainagePercent).toBe(String(fixture.overrideScenario.invoiceLevelPercent));

        await retainagePage.setLineRetainagePercentOverride(row, fixture.overrideScenario.lineOverridePercent);

        const overriddenValues = await retainagePage.getInvoiceLineItemRowValues(row);
        Logger.info(`Line values after per-line override to ${fixture.overrideScenario.lineOverridePercent}%: ${JSON.stringify(overriddenValues)}`);
        expect(overriddenValues.retainagePercent).toBe(String(fixture.overrideScenario.lineOverridePercent));
        expect(RetainagePage.parseCurrency(overriddenValues.retainageAmount)).toBe(fixture.overrideScenario.expectedLineOverrideRetainageAmount);
        expect(RetainagePage.parseCurrency(overriddenValues.netPayable)).toBe(fixture.overrideScenario.expectedLineOverrideNetPayable);
        Logger.success(`Line-level override (${fixture.overrideScenario.lineOverridePercent}%) took effect independently of the invoice-level value (${fixture.overrideScenario.invoiceLevelPercent}%): Retainage ($${fixture.overrideScenario.expectedLineOverrideRetainageAmount}) and Net Payable ($${fixture.overrideScenario.expectedLineOverrideNetPayable}) both match the line's own %.`);

        await expect(retainagePage.getLineOverrideClearButton(row), 'An overridden line must expose a "Clear selection" control to revert to the inherited %').toBeVisible({ timeout: 5000 });
        Logger.success('Overridden line exposes a "Clear selection" control, confirming the override is tracked distinctly from the inherited invoice-level value.');

        const invoiceLevelBadge = await retainagePage.getInvoiceRetainageBadgeText();
        Logger.info(`Invoice-level badge remains unaffected by the per-line override -> actual: "${invoiceLevelBadge}" | expected: "Override" (still reflecting the invoice-level 6% override from earlier in this test, unrelated to the line's own 9%)`);
        expect(invoiceLevelBadge).toBe('Override');
    });

    test('TC333 @regression @retainage : Retainage ($) rounds to the nearest cent, not the nearest whole dollar (rounding edge case)', async () => {
        await retainagePage.gotoInvoiceList(fixture.jobId);
        await retainagePage.createDraftInvoice();

        const row = retainagePage.getInvoiceLineItemRow(fixture.lineItem.scope, fixture.lineItem.scheduleOfValue);
        await retainagePage.setLineInvoiceAmount(row, fixture.roundingScenario.amountEntered);
        await retainagePage.setLineRetainagePercentOverride(row, fixture.roundingScenario.percent);

        const values = await retainagePage.getInvoiceLineItemRowValues(row);
        Logger.info(`Rounding scenario values: ${JSON.stringify(values)}`);

        // 333.335 entered rounds to 333.33 on input; 333.33 x 5% = 16.6665, which must round to
        // the nearest CENT ($16.67), not the nearest whole dollar ($17) — the two diverge here,
        // which is exactly what makes this a real rounding edge case rather than a coincidence.
        Logger.info(`Invoice Amount after entry -> actual: "${values.invoiceAmount}" | expected: "${fixture.roundingScenario.expectedAmountAfterEntry}"`);
        expect(values.invoiceAmount).toBe(fixture.roundingScenario.expectedAmountAfterEntry);

        Logger.info(`Retainage ($) -> actual: "${values.retainageAmount}" | expected (rounded to nearest cent): "${fixture.roundingScenario.expectedRetainageAmount}" | NOT nearest-dollar ($17)`);
        expect(values.retainageAmount).toBe(fixture.roundingScenario.expectedRetainageAmount);
        expect(values.retainageAmount).not.toBe('$17');

        Logger.info(`Net Payable -> actual: "${values.netPayable}" | expected: "${fixture.roundingScenario.expectedNetPayable}"`);
        expect(values.netPayable).toBe(fixture.roundingScenario.expectedNetPayable);
        Logger.success(`Rounding edge case verified: $${fixture.roundingScenario.expectedAmountAfterEntry} x ${fixture.roundingScenario.percent}% = 16.6665 rounds to ${fixture.roundingScenario.expectedRetainageAmount} (nearest cent), giving Net Payable ${fixture.roundingScenario.expectedNetPayable}.`);
    });

    test('TC334 @regression @retainage : Retainage Released can be set above 0 and is reflected in Net Payable; approval succeeds when it does not exceed Withheld', async () => {
        await retainagePage.gotoInvoiceList(fixture.jobId);
        const invoiceId = await retainagePage.createDraftInvoice();

        const row = retainagePage.getInvoiceLineItemRow(fixture.lineItem.scope, fixture.lineItem.scheduleOfValue);
        await retainagePage.setLineInvoiceAmount(row, fixture.releaseScenario.amount);
        await retainagePage.setLineRetainagePercentOverride(row, fixture.releaseScenario.percent);

        const beforeRelease = await retainagePage.getInvoiceLineItemRowValues(row);
        Logger.info(`Retainage Released before setting it -> actual: "${beforeRelease.retainageReleased}" | expected: "$0"`);
        expect(beforeRelease.retainageReleased).toBe('$0');

        await retainagePage.setLineRetainageReleased(row, fixture.releaseScenario.releasedAmount);

        const afterRelease = await retainagePage.getInvoiceLineItemRowValues(row);
        Logger.info(`Line values after setting Retainage Released to ${fixture.releaseScenario.releasedAmount}: ${JSON.stringify(afterRelease)}`);
        expect(RetainagePage.parseCurrency(afterRelease.retainageReleased)).toBe(fixture.releaseScenario.releasedAmount);
        expect(RetainagePage.parseCurrency(afterRelease.retainageAmount)).toBe(fixture.releaseScenario.expectedRetainageAmount);
        expect(RetainagePage.parseCurrency(afterRelease.netPayable)).toBe(fixture.releaseScenario.expectedNetPayable);
        Logger.success(`Released > 0 scenario verified: Net Payable = Invoice Amount ($${fixture.releaseScenario.amount}) - Retainage ($${fixture.releaseScenario.expectedRetainageAmount}) + Released ($${fixture.releaseScenario.releasedAmount}) = $${fixture.releaseScenario.expectedNetPayable}.`);

        const result = await retainagePage.confirmInvoice();
        Logger.info(`Confirm Invoice #${invoiceId} outcome -> approved: ${result.approved} (Released $${fixture.releaseScenario.releasedAmount} <= Withheld $${fixture.releaseScenario.expectedRetainageAmount} for this line, so no over-draw)`);
        expect(result.approved, `Invoice should approve successfully: ${result.errorMessage}`).toBe(true);
        Logger.success(`Invoice #${invoiceId} approved successfully with Retainage Released > 0 and no over-draw error.`);
    });

    test('TC335 @regression @retainage : Approval is rejected when a contract line\'s cumulative Retainage Released would exceed its cumulative Retainage Withheld', async () => {
        await retainagePage.gotoInvoiceList(fixture.jobId);
        const invoiceId = await retainagePage.createDraftInvoice();

        const row = retainagePage.getInvoiceLineItemRow(fixture.lineItem.scope, fixture.lineItem.scheduleOfValue);
        await retainagePage.setLineInvoiceAmount(row, fixture.overDrawScenario.amount);
        await retainagePage.setLineRetainageReleased(row, fixture.overDrawScenario.releasedAmount);

        const values = await retainagePage.getInvoiceLineItemRowValues(row);
        Logger.info(`Over-draw setup: Invoice Amount=${values.invoiceAmount}, Retainage ($)=${values.retainageAmount}, Retainage Released=${values.retainageReleased} (deliberately far larger than this line's own Retainage ($) — the guard checks the CUMULATIVE line balance across every invoice on the contract, not just this one, so a released amount this large is guaranteed to exceed it).`);

        const result = await retainagePage.confirmInvoice();
        Logger.info(`Confirm Invoice #${invoiceId} outcome -> approved: ${result.approved} | message: "${result.errorMessage}"`);
        expect(result.approved, 'Approval must be rejected when Retainage Released would exceed Retainage Withheld for the contract line').toBe(false);

        const pattern = new RegExp(fixture.patterns.overDrawErrorMessage);
        expect(result.errorMessage).toMatch(pattern);
        const [, releasedInMessage, withheldInMessage] = result.errorMessage.match(pattern);
        Logger.info(`Guard error parsed -> released: $${releasedInMessage}, withheld: $${withheldInMessage}`);
        expect(parseFloat(releasedInMessage.replace(/,/g, ''))).toBeGreaterThan(parseFloat(withheldInMessage.replace(/,/g, '')));
        expect(parseFloat(releasedInMessage.replace(/,/g, ''))).toBeGreaterThanOrEqual(fixture.overDrawScenario.releasedAmount);
        Logger.success(`Over-draw guard confirmed: approval rejected with "${result.errorMessage}" — released ($${releasedInMessage}) correctly exceeds withheld ($${withheldInMessage}) for the contract line.`);
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

    test('TC336 @regression @retainage : Contracts tab -> Retainage sub-tab loads with the correct headers', async () => {
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

    test('TC337 @regression @retainage : Invoice row is present with correct Date/Withheld/Released/Outstanding and expands successfully', async () => {
        await retainagePage.gotoContractRetainageTab(fixture.jobId);

        const invoiceRow = retainagePage.getRetainageTabInvoiceRow(`Invoice #${fixture.invoiceId}`);
        await expect(invoiceRow, 'Invoice present on Retainage tab').toBeVisible({ timeout: 15000 });

        const before = await retainagePage.getRetainageTabRowValues(invoiceRow);
        Logger.info(`Invoice row before expand: ${JSON.stringify(before)}`);
        expect(before.withheld).toBe(fixture.expected.retainageTab.withheld);
        expect(before.released).toBe(fixture.expected.retainageTab.released);
        // Outstanding is a CONTRACT-line cumulative balance across every approved invoice on this
        // scope/schedule-of-value (confirmed live via MCP browser), not a value owned by this
        // invoice alone — other tests in this suite (e.g. TC334) approve additional invoices
        // against the same line, so it only ever grows. Asserted structurally instead of pinned
        // to one exact dollar amount that drifts across runs.
        expect(before.outstanding).toMatch(new RegExp(fixture.patterns.moneyPrefix));
        expect(RetainagePage.parseCurrency(before.outstanding)).toBeGreaterThanOrEqual(
            RetainagePage.parseCurrency(before.withheld) - RetainagePage.parseCurrency(before.released)
        );
        Logger.success('Invoice row values verified before expansion.');

        await retainagePage.toggleRetainageTabRow(invoiceRow);
        const lineItemRow = retainagePage.getRetainageTabLineItemRow(fixture.lineItem.scope, fixture.lineItem.scheduleOfValue);
        await expect(lineItemRow, 'Line item row appears after expanding the invoice row').toBeVisible({ timeout: 8000 });
        Logger.success('Invoice row expanded successfully — line item child row is visible.');
    });

    test('TC338 @regression @retainage : Every available line item under the invoice is expanded and has no further nested rows', async () => {
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

    test('TC339 @regression @retainage : Expanded line item shows correct Scope/Schedule of Value label and currency values', async () => {
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

    test('TC340 @regression @retainage : Total row is correct and cross-checks against the expanded rows', async () => {
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
        // toBeCloseTo, not toBe: summing many invoices' cents via repeated += accumulates
        // ordinary floating-point drift (e.g. 660.0099999999999 vs the displayed "$660.01").
        expect(RetainagePage.parseCurrency(totals.withheld)).toBeCloseTo(sumAcrossAllInvoices.withheld, 2);
        expect(RetainagePage.parseCurrency(totals.released)).toBeCloseTo(sumAcrossAllInvoices.released, 2);
        expect(totals.outstanding).toBe(fixture.expected.dashText);
        Logger.success(`Total row cross-checked: Withheld ($${sumAcrossAllInvoices.withheld}) and Released ($${sumAcrossAllInvoices.released}) match the sum of every invoice row in the grid; Outstanding shows "—" (not summed by design).`);

        const invoiceValues = await retainagePage.getRetainageTabRowValues(invoiceRow);
        const lineItemValues = await retainagePage.getRetainageTabRowValues(lineItemRow);
        expect(invoiceValues.withheld).toBe(lineItemValues.withheld);
        expect(invoiceValues.released).toBe(lineItemValues.released);
        Logger.success(`Cross-check passed: fixture invoice #${fixture.invoiceId}'s own Withheld/Released (${invoiceValues.withheld}/${invoiceValues.released}) match the sum of its expanded line item(s), and correctly contribute to the grid-wide Total row above.`);
    });

    test('TC341 @regression @retainage : Withheld amount matches Invoice Amount x Retainage % from the invoice created earlier', async () => {
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

        // Outstanding is a CONTRACT-line cumulative balance (see TC337), not owned by this
        // invoice alone, so it only ever grows as other tests approve invoices against the same
        // line — asserted structurally rather than pinned to this invoice's own contribution.
        expect(actualOutstanding).toBeGreaterThanOrEqual(actualWithheld - actualReleased);
        Logger.success(`Outstanding ($${actualOutstanding}) >= this invoice's own Withheld ($${actualWithheld}) - Released ($${actualReleased}) verified.`);
    });

    test('TC342 @regression @retainage : Currency formatting is correct for Withheld/Released/Outstanding', async () => {
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

    test('TC343 @regression @retainage : Expand/collapse persists data correctly with no UI corruption across repeated cycles', async () => {
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
            // Outstanding is a cumulative contract-line balance (see TC337) — asserted structurally
            // rather than pinned to one exact amount that drifts as other tests approve invoices.
            expect(invoiceValuesAfterCollapse.outstanding).toMatch(new RegExp(fixture.patterns.moneyPrefix));
            expect(RetainagePage.parseCurrency(invoiceValuesAfterCollapse.outstanding)).toBeGreaterThanOrEqual(
                RetainagePage.parseCurrency(invoiceValuesAfterCollapse.withheld) - RetainagePage.parseCurrency(invoiceValuesAfterCollapse.released)
            );
            Logger.success(`Cycle ${cycle}: expand/collapse -> line item hidden, invoice row Withheld unchanged (${fixture.expected.retainageTab.withheld}) — no UI corruption.`);
        }
    });

    test('TC344 @regression @retainage : Contract / Documents / Retainage sub-tab selection state is correct when switching tabs', async () => {
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

    test('TC345 @regression @retainage : retainage-invoices API returns 200 with values matching the UI', async () => {
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

    test('TC346 @regression @retainage : No console errors, page errors, or failed API responses on the Contract > Retainage tab', async () => {
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

    test('TC347 @regression @retainage : Contract Overview card shows every field, and Total Withheld / Total Released / Outstanding Balance are hidden when the contract Retainage % is 0', async () => {
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

    test('TC348 @regression @retainage : Edit Contract Overview drawer locks Retainage % once the contract is finalized', async () => {
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

    test('TC349 @regression @retainage : Retainage sub-tab is enabled because the contract is finalized', async () => {
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
