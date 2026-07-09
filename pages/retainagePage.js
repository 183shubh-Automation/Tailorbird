const { expect } = require('@playwright/test');
const { Logger } = require('../utils/logger');
const { retainageLocators } = require('../locators/retainageLocator');

/**
 * Retainage UI lives inside the existing Invoice tab / Invoice Details drawer — there is no
 * separate "Retainage" screen. Discovered live via MCP browser against the pre-existing
 * "Automation_Job_for_Retainage_flow" fixture (see fixture/retainage.json). Locators verified
 * with page.locator(...).count() against the live app before being committed here.
 */
class RetainagePage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.loc = retainageLocators(page);
  }

  /** @param {number|string} jobId */
  async gotoInvoiceList(jobId) {
    Logger.step(`Navigating to invoice list for job ${jobId}...`);
    await this.page.goto(`${process.env.BASE_URL}/jobs/${jobId}?tab=invoices`, { waitUntil: 'load' });
    await this.page.waitForTimeout(2000);
  }

  /**
   * The invoice list grid virtualizes rows, so an older invoice can scroll out of the default
   * view once enough invoices exist on the job — searching narrows it back down to one row.
   * @param {string} term
   */
  async searchInvoiceList(term) {
    Logger.step(`Searching invoice list for: ${term}`);
    await this.loc.invoiceListSearchInput.fill(term);
    await this.page.waitForTimeout(600);
  }

  /**
   * Clicks Create Invoice from the Invoice list and returns the new invoice's numeric ID, parsed
   * from the resulting /jobs/{jobId}/invoices/{invoiceId} URL (no hardcoded ID — every run gets
   * a fresh, globally-unique one from the app itself).
   * @returns {Promise<string>}
   */
  async createDraftInvoice() {
    Logger.step('Creating new draft invoice');
    await this.loc.createInvoiceButton.click();
    await this.page.waitForURL(/\/invoices\/\d+/, { timeout: 20000 });
    const invoiceId = this.page.url().match(/\/invoices\/(\d+)/)[1];
    Logger.success(`Created draft invoice #${invoiceId}`);
    return invoiceId;
  }

  /**
   * @param {number|string} jobId
   * @param {number|string} invoiceId
   */
  async gotoInvoiceDetail(jobId, invoiceId) {
    Logger.step(`Navigating to invoice detail ${invoiceId} for job ${jobId}...`);
    await this.page.goto(`${process.env.BASE_URL}/jobs/${jobId}/invoices/${invoiceId}`, { waitUntil: 'load' });
    await this.page.waitForTimeout(2000);
  }

  /** @returns {Promise<{retainagePercent:string, grossAmount:string, retainageWithheld:string, retainageReleased:string, netPayable:string}>} */
  async getOverviewRetainageValues() {
    return {
      retainagePercent: await this.loc.retainagePercentInput.inputValue(),
      grossAmount: await this.loc.grossAmountInput.inputValue(),
      retainageWithheld: await this.loc.retainageWithheldInput.inputValue(),
      retainageReleased: await this.loc.retainageReleasedInput.inputValue(),
      netPayable: await this.loc.netPayableInput.inputValue(),
    };
  }

  /** Parses "$4,800" / "- $200" / "+ $0" style values into signed numbers. */
  static parseCurrency(text) {
    const negative = /^-/.test(text.trim());
    const digits = text.replace(/[^0-9.]/g, '');
    const value = digits ? parseFloat(digits) : 0;
    return negative ? -value : value;
  }

  /**
   * @param {string|number} value e.g. "4" or "4%"
   *
   * Click + .fill() + a real Tab keypress — confirmed live via MCP browser that this exact
   * sequence is what flips the badge to "Override" and cascades the new % to every line (via a
   * "Retainage % applied to all lines" toast). Character-by-character keyboard.type() here left
   * the badge showing the stale "From contract (X%)" state; only .fill() reliably commits it.
   */
  async setRetainagePercent(value) {
    Logger.step(`Setting Retainage % to "${value}"...`);
    await this.loc.retainagePercentInput.click();
    await this.loc.retainagePercentInput.fill(String(value));
    await this.page.keyboard.press('Tab');
    await this.page.waitForTimeout(1000);
  }

  /** Reads the invoice-level Retainage % badge: "From contract (X%)" or "Override". */
  async getInvoiceRetainageBadgeText() {
    return (await this.loc.invoiceRetainageBadge.textContent()).trim();
  }

  async goBack() {
    await this.loc.goBackButton.click();
    await this.page.waitForLoadState('load');
  }

  /** @param {string} invoiceNumberText e.g. "Invoice #14080" */
  getListRowByInvoiceNumber(invoiceNumberText) {
    return this.loc.listRowByInvoiceNumber(invoiceNumberText);
  }

  /**
   * Navigates job -> Contracts tab -> Retainage sub-tab.
   * @param {number|string} jobId
   */
  async gotoContractRetainageTab(jobId) {
    Logger.step(`Navigating to Contracts > Retainage tab for job ${jobId}...`);
    await this.page.goto(`${process.env.BASE_URL}/jobs/${jobId}?tab=contracts`, { waitUntil: 'load' });
    await this.page.waitForTimeout(2000);
    await this.loc.contractsTab.click().catch(() => {});
    await this.loc.retainageSubTab.waitFor({ state: 'visible', timeout: 15000 });
    await this.loc.retainageSubTab.click();
    await this.page.waitForURL(/contractSubTab=retainage/, { timeout: 15000 });
    await this.page.waitForTimeout(1500);
    Logger.success('Navigated to Contracts > Retainage tab.');
  }

  /** @param {string} invoiceNumberText e.g. "Invoice #14080" */
  getRetainageTabInvoiceRow(invoiceNumberText) {
    return this.loc.retainageTabInvoiceRow(invoiceNumberText);
  }

  /**
   * @param {string} scope e.g. "Bid with material"
   * @param {string} scheduleOfValue e.g. "76000"
   */
  getRetainageTabLineItemRow(scope, scheduleOfValue) {
    return this.loc.retainageTabLineItemRow(scope, scheduleOfValue);
  }

  /**
   * Expands (or collapses, if already expanded) the given invoice row's tree toggle.
   * @param {import('@playwright/test').Locator} invoiceRow
   */
  async toggleRetainageTabRow(invoiceRow) {
    await this.loc.expandToggleWithin(invoiceRow).click();
    await this.page.waitForTimeout(400);
  }

  /** @param {import('@playwright/test').Locator} row */
  hasExpandToggle(row) {
    return this.loc.expandToggleWithin(row);
  }

  /**
   * Parses a data row's cell text into a structured object. Works for both the invoice-level
   * row and a line-item child row on the Contracts > Retainage grid.
   * @param {import('@playwright/test').Locator} row
   * @returns {Promise<{label:string, date:string, withheld:string, released:string, outstanding:string}>}
   */
  async getRetainageTabRowValues(row) {
    const text = await row.innerText();
    const parts = text.split('\n').filter(Boolean);
    // Level-0 invoice rows start with the tree-toggle glyph '›' as its own line.
    const cells = parts[0] === '›' ? parts.slice(1) : parts;
    const [label, date, withheld, released, outstanding] = cells;
    return { label, date, withheld, released, outstanding };
  }

  /** @returns {Promise<{withheld:string, released:string, outstanding:string}>} */
  async getRetainageTabTotals() {
    const text = await this.loc.retainageTabTotalRow.innerText();
    const [, withheld, released, outstanding] = text.split('\n').filter(Boolean);
    return { withheld, released, outstanding };
  }

  /**
   * Counts DOM rows between the given invoice row and the next top-level invoice row (or the
   * end of the grid) — i.e. just its own expanded line items, regardless of how many other
   * invoices are also present/expanded in the same grid.
   * @param {import('@playwright/test').Locator} invoiceRow
   * @returns {Promise<number>}
   */
  async getChildRowCount(invoiceRow) {
    return invoiceRow.evaluate((rowEl) => {
      const allRows = Array.from(document.querySelectorAll('revo-grid revogr-data[type="rgRow"] div[role="row"]'));
      const idx = allRows.indexOf(rowEl);
      let count = 0;
      for (let i = idx + 1; i < allRows.length; i++) {
        if (allRows[i].querySelector('.tree-toggle')) break;
        count++;
      }
      return count;
    });
  }

  /**
   * Forces every row of the Contracts > Retainage grid to render into the DOM at once. This
   * revo-grid instance sizes its own rendered row count to whatever currently fits in the
   * visible viewport height — it has no scrollable overflow container, so rows below the fold
   * are simply never instantiated in the DOM (confirmed live via MCP browser: at a short window
   * height only 10 of 12 invoice rows existed in the DOM, and every row appeared immediately
   * once the grid element was forced to an oversized explicit height). As this fixture job
   * accumulates more invoices from repeated test runs, that fold moves higher, so any read that
   * counts/sums every row must call this first.
   */
  async renderAllRetainageTabRows() {
    await this.page.evaluate(() => {
      const grid = document.querySelector('revo-grid');
      const wrapper = document.querySelector('.retainage-history-revogrid');
      if (grid) grid.style.setProperty('height', '20000px', 'important');
      if (wrapper) wrapper.style.setProperty('height', '20000px', 'important');
    });
    await this.page.waitForTimeout(300);
  }

  /**
   * Sums Withheld/Released across every top-level invoice row currently rendered in the
   * Contracts > Retainage grid — used to cross-check the Total row without assuming there is
   * exactly one invoice on the job.
   * @returns {Promise<{withheld:number, released:number}>}
   */
  async sumAllRetainageTabInvoiceRows() {
    await this.renderAllRetainageTabRows();
    const rows = await this.loc.retainageTabAllInvoiceRows.all();
    let withheld = 0;
    let released = 0;
    for (const row of rows) {
      const values = await this.getRetainageTabRowValues(row);
      withheld += RetainagePage.parseCurrency(values.withheld);
      released += RetainagePage.parseCurrency(values.released);
    }
    return { withheld, released };
  }

  /**
   * @param {string} scope e.g. "Bid with material"
   * @param {string} scheduleOfValue e.g. "76000"
   */
  getInvoiceLineItemRow(scope, scheduleOfValue) {
    return this.loc.lineItemsRow(scope, scheduleOfValue);
  }

  /**
   * Resolves a data cell's text for the given row by matching the header's own
   * data-rgcol/aria-colindex — robust to the grid's on-screen column order (confirmed live via
   * MCP browser that "Retainage ($)" and "Retainage %" can swap positions), unlike splitting
   * innerText by line, which silently mismaps values whenever columns are reordered.
   * @param {import('@playwright/test').Locator} row
   * @param {import('@playwright/test').Locator} headerLocator
   */
  async getColumnValueForRow(row, headerLocator) {
    await headerLocator.waitFor({ state: 'attached', timeout: 10000 });
    const colIndex = await headerLocator.evaluate((el) => el.getAttribute('data-rgcol') || el.getAttribute('aria-colindex'));
    if (!colIndex) {
      throw new Error(`Could not resolve column index for header: ${await headerLocator.textContent()}`);
    }
    const cell = row.locator(`[role="gridcell"][data-rgcol="${colIndex}"], [role="gridcell"][aria-colindex="${colIndex}"]`).first();
    // A focused/edited cell can render an inline "Clear selection" (✕) button, and the open
    // NumberInput editor injects its own <style> tag — both confirmed live via MCP browser to
    // leak into textContent() and contaminate the value. Strip them before reading text; the
    // button's presence is checked separately via getLineOverrideClearButton, not by parsing this.
    return cell.evaluate((el) => {
      const clone = el.cloneNode(true);
      clone.querySelectorAll('button, style').forEach((n) => n.remove());
      return clone.textContent.trim();
    });
  }

  /**
   * Reads the Invoice Details line-items grid's Retainage-related columns for the given row,
   * resolved by header name rather than on-screen position.
   * @param {import('@playwright/test').Locator} row
   */
  async getInvoiceLineItemRowValues(row) {
    const [invoiceAmount, retainagePercent, retainageAmount, retainageReleased, totalWithheldToDate, outstandingRetainage, netPayable] = await Promise.all([
      this.getColumnValueForRow(row, this.loc.lineItemsInvoiceAmountHeader),
      this.getColumnValueForRow(row, this.loc.lineItemsRetainagePercentHeader),
      this.getColumnValueForRow(row, this.loc.lineItemsRetainageAmountHeader),
      this.getColumnValueForRow(row, this.loc.lineItemsRetainageReleasedHeader),
      this.getColumnValueForRow(row, this.loc.lineItemsTotalWithheldHeader),
      this.getColumnValueForRow(row, this.loc.lineItemsOutstandingRetainageHeader),
      this.getColumnValueForRow(row, this.loc.lineItemsNetPayableHeader),
    ]);
    return {
      invoiceAmount,
      retainagePercent,
      retainageAmount,
      retainageReleased,
      totalWithheldToDate,
      outstandingRetainage,
      netPayable,
    };
  }

  /**
   * Resolves the given row's cell for a header (by data-rgcol, robust to column reordering) and
   * double-clicks it to open its inline editor.
   * @param {import('@playwright/test').Locator} row
   * @param {import('@playwright/test').Locator} headerLocator
   */
  async openLineCellEditor(row, headerLocator) {
    const colIndex = await headerLocator.evaluate((el) => el.getAttribute('data-rgcol') || el.getAttribute('aria-colindex'));
    await row.locator(`[data-rgcol="${colIndex}"]`).dblclick();
  }

  /**
   * @param {import('@playwright/test').Locator} row
   *
   * The 1s wait after committing lets the app's debounced recalculation (a PATCH to
   * /api/bird-table/cells, confirmed live via MCP browser) finish before any caller reads
   * Retainage ($) / Net Payable — reading immediately after Enter races ahead of it and
   * observes stale "—" / "$0" values.
   */
  async setLineInvoiceAmount(row, amount) {
    Logger.step(`Setting line Invoice Amount to ${amount}`);
    await this.openLineCellEditor(row, this.loc.lineItemsInvoiceAmountHeader);
    await this.loc.cellCurrencyEditorInput.fill(String(amount));
    await this.loc.cellCurrencyEditorInput.press('Enter');
    await this.page.waitForTimeout(1000);
  }

  /**
   * Overrides a single line's Retainage % independently of the invoice-level value. The editor
   * has no stable testid, so it's driven by keyboard (select-all + type) after opening it.
   * @param {import('@playwright/test').Locator} row
   */
  async setLineRetainagePercentOverride(row, value) {
    Logger.step(`Overriding line Retainage % to ${value}`);
    await this.openLineCellEditor(row, this.loc.lineItemsRetainagePercentHeader);
    await this.page.keyboard.press('ControlOrMeta+a');
    await this.page.keyboard.type(String(value));
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(1000);
  }

  /** @param {import('@playwright/test').Locator} row */
  async setLineRetainageReleased(row, amount) {
    Logger.step(`Setting line Retainage Released to ${amount}`);
    await this.openLineCellEditor(row, this.loc.lineItemsRetainageReleasedHeader);
    await this.loc.cellCurrencyEditorInput.fill(String(amount));
    await this.loc.cellCurrencyEditorInput.press('Enter');
    await this.page.waitForTimeout(1000);
  }

  /** @param {import('@playwright/test').Locator} row */
  getLineOverrideClearButton(row) {
    return this.loc.cellClearOverrideButton(row);
  }

  /**
   * Clicks Confirm Invoice, accepts the "Are you sure?" dialog, and waits for the app to settle
   * on either outcome: a successful approval (redirect to the invoice list) or a rejection (a
   * "Confirmation Failed" toast while staying on the invoice detail page). Returns the outcome
   * so the caller can assert either branch without swallowing a genuine unexpected failure.
   * @returns {Promise<{approved: boolean, errorMessage: string|null}>}
   */
  async confirmInvoice() {
    Logger.step('Clicking Confirm Invoice');
    await this.loc.confirmInvoiceButton.click();
    await expect(this.loc.confirmInvoiceConfirmationDialog).toBeVisible({ timeout: 10000 });
    await this.loc.confirmInvoiceConfirmationConfirmButton.click();

    const approved = await this.page
      .waitForURL(/tab=invoices/, { timeout: 15000 })
      .then(() => true)
      .catch(() => false);

    if (approved) {
      Logger.success('Invoice confirmed and approved.');
      return { approved: true, errorMessage: null };
    }

    await expect(this.loc.confirmationFailedToastTitle, 'Neither approval redirect nor a "Confirmation Failed" toast appeared').toBeVisible({ timeout: 10000 });
    const errorMessage = (await this.loc.confirmationFailedToastMessage.textContent()).trim();
    Logger.info(`Confirmation rejected: ${errorMessage}`);
    return { approved: false, errorMessage };
  }

  /** @param {string} label e.g. "Property", "Budget Category" */
  async getContractOverviewFieldValue(label) {
    return (await this.loc.contractOverviewFieldValue(label).textContent()).trim();
  }

  async openEditContractOverviewDrawer() {
    Logger.step('Opening Edit Contract Overview drawer');
    await this.loc.editContractOverviewButton.click();
    await expect(this.loc.editContractOverviewDialog).toBeVisible({ timeout: 15000 });
  }

  async cancelEditContractOverviewDrawer() {
    await this.loc.editContractOverviewCancelButton.click();
    await expect(this.loc.editContractOverviewDialog).not.toBeVisible({ timeout: 10000 });
    Logger.success('Edit Contract Overview drawer closed via Cancel — no changes saved.');
  }
}

module.exports = { RetainagePage };
