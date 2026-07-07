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

  /** @param {string} value e.g. "4" or "4%" */
  async setRetainagePercent(value) {
    Logger.step(`Setting Retainage % to "${value}"...`);
    await this.loc.retainagePercentInput.fill(String(value));
    await this.loc.retainagePercentInput.blur();
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
   * Sums Withheld/Released across every top-level invoice row currently rendered in the
   * Contracts > Retainage grid — used to cross-check the Total row without assuming there is
   * exactly one invoice on the job.
   * @returns {Promise<{withheld:number, released:number}>}
   */
  async sumAllRetainageTabInvoiceRows() {
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
   * Parses an Invoice Details line-items grid row into its named columns.
   * @param {import('@playwright/test').Locator} row
   */
  async getInvoiceLineItemRowValues(row) {
    const text = await row.innerText();
    const cells = text.split('\n').filter(Boolean);
    const [
      scope,
      budgetCategory,
      location,
      scheduleOfValue,
      costItem,
      status,
      invoiceAmount,
      retainagePercent,
      retainageAmount,
      retainageReleased,
      totalWithheldToDate,
      outstandingRetainage,
      netPayable,
    ] = cells;
    return {
      scope,
      budgetCategory,
      location,
      scheduleOfValue,
      costItem,
      status,
      invoiceAmount,
      retainagePercent,
      retainageAmount,
      retainageReleased,
      totalWithheldToDate,
      outstandingRetainage,
      netPayable,
    };
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
