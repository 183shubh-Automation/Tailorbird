const { expect } = require('@playwright/test');
const { Logger } = require('../utils/logger');

/**
 * Retainage UI lives inside the existing Invoice tab / Invoice Details drawer — there is no
 * separate "Retainage" screen. Discovered live via MCP browser against the pre-existing
 * "Automation_Job_for_Retainage_flow" fixture (see data/retainageFixture.json). Locators verified
 * with page.locator(...).count() against the live app before being committed here.
 */
class RetainagePage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;

    this.goBackButton = page.getByRole('button', { name: 'Go Back' });
    this.confirmInvoiceButton = page.getByRole('button', { name: 'Confirm Invoice' });
    this.invoiceNumberInput = page.getByRole('textbox', { name: 'Enter invoice number' });
    this.titleInput = page.getByRole('textbox', { name: 'Enter title' });
    this.descriptionInput = page.getByRole('textbox', { name: 'Enter description' });

    // Overview panel — Retainage % is the only editable/enabled field of the five; the rest are
    // computed + disabled. "Retainage %" text also appears in the line-items grid column header,
    // so every field here is scoped from its <p> label's parent container, not a bare getByText().
    this.retainagePercentLabel = page.locator('p', { hasText: /^Retainage %$/ }).first();
    this.retainagePercentInput = page.locator('p', { hasText: /^Retainage %$/ }).locator('xpath=..').getByRole('textbox');
    this.overrideLabel = page.getByText('Override', { exact: true });
    this.grossAmountInput = page.locator('p', { hasText: /^Gross Amount$/ }).locator('xpath=..').getByRole('textbox');
    this.retainageWithheldInput = page.locator('p', { hasText: /^Retainage Withheld$/ }).locator('xpath=..').getByRole('textbox');
    this.retainageReleasedInput = page.locator('p', { hasText: /^Retainage Released$/ }).locator('xpath=..').getByRole('textbox');
    this.netPayableInput = page.locator('p', { hasText: /^Net Payable$/ }).locator('xpath=..').getByRole('textbox');

    // Line-items grid (revo-grid) column headers
    this.lineItemsGrid = page.locator('revo-grid:has([role="columnheader"] span:text("Cost Item"))');
    this.lineItemsRetainagePercentHeader = page.locator('[role="columnheader"]').filter({ hasText: /^Retainage %$/ });
    this.lineItemsRetainageAmountHeader = page.locator('[role="columnheader"]').filter({ hasText: 'Retainage ($)' });
    this.lineItemsRetainageReleasedHeader = page.locator('[role="columnheader"]').filter({ hasText: 'Retainage Released ($)' });
    this.lineItemsTotalWithheldHeader = page.locator('[role="columnheader"]').filter({ hasText: 'Total Withheld to Date' });
    this.lineItemsOutstandingRetainageHeader = page.locator('[role="columnheader"]').filter({ hasText: 'Outstanding Retainage' });
    this.lineItemsNetPayableHeader = page.locator('[role="columnheader"]').filter({ hasText: /^Net Payable$/ });

    // Invoice list grid (revo-grid) column headers
    this.listRetainageWithheldHeader = page.locator('[role="columnheader"]').filter({ hasText: 'Retainage Withheld ($)' });
    this.listRetainageReleasedHeader = page.locator('[role="columnheader"]').filter({ hasText: 'Retainage Released ($)' });
    this.listOutstandingRetainageHeader = page.locator('[role="columnheader"]').filter({ hasText: 'Outstanding Retainage ($)' });
    this.listNetPayableHeader = page.locator('[role="columnheader"]').filter({ hasText: /^Net Payable$/ });
    this.createInvoiceButton = page
      .getByRole('button', { name: /^(Create|Add) Invoice$/i })
      .locator('visible=true')
      .first();

    // Contracts tab -> Retainage sub-tab (job page: Job Summary / Contracts / Change Orders / Invoice)
    this.contractsTab = page.getByRole('tab', { name: 'Contracts' });
    this.contractSubTab = page.getByRole('tab', { name: 'Contract', exact: true });
    this.documentsSubTab = page.getByRole('tab', { name: 'Documents', exact: true });
    this.retainageSubTab = page.getByRole('tab', { name: 'Retainage', exact: true });

    this.retainageTabInvoiceOrLineItemHeader = page.getByRole('columnheader', { name: 'Invoice / Line Item', exact: true });
    this.retainageTabDateHeader = page.getByRole('columnheader', { name: 'Date', exact: true });
    this.retainageTabWithheldHeader = page.getByRole('columnheader', { name: 'Withheld', exact: true });
    this.retainageTabReleasedHeader = page.getByRole('columnheader', { name: 'Released', exact: true });
    this.retainageTabOutstandingHeader = page.getByRole('columnheader', { name: 'Outstanding', exact: true });
    // Total row is rendered outside revogr-data[type="rgRow"] (a pinned/footer row), so it needs
    // the broader [role="row"] selector rather than the data-row-scoped locator used elsewhere.
    this.retainageTabTotalRow = page.locator('[role="row"]').filter({ hasText: /^Total/ });
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
      retainagePercent: await this.retainagePercentInput.inputValue(),
      grossAmount: await this.grossAmountInput.inputValue(),
      retainageWithheld: await this.retainageWithheldInput.inputValue(),
      retainageReleased: await this.retainageReleasedInput.inputValue(),
      netPayable: await this.netPayableInput.inputValue(),
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
    await this.retainagePercentInput.fill(String(value));
    await this.retainagePercentInput.blur();
  }

  async goBack() {
    await this.goBackButton.click();
    await this.page.waitForLoadState('load');
  }

  /** @param {string} invoiceNumberText e.g. "Invoice #14080" */
  getListRowByInvoiceNumber(invoiceNumberText) {
    return this.page
      .locator('revo-grid:has([role="columnheader"] span:text("Invoice Number")) revogr-data[type="rgRow"] div[role="row"]')
      .filter({ hasText: invoiceNumberText });
  }

  /**
   * Navigates job -> Contracts tab -> Retainage sub-tab.
   * @param {number|string} jobId
   */
  async gotoContractRetainageTab(jobId) {
    Logger.step(`Navigating to Contracts > Retainage tab for job ${jobId}...`);
    await this.page.goto(`${process.env.BASE_URL}/jobs/${jobId}?tab=contracts`, { waitUntil: 'load' });
    await this.page.waitForTimeout(2000);
    await this.contractsTab.click().catch(() => {});
    await this.retainageSubTab.waitFor({ state: 'visible', timeout: 15000 });
    await this.retainageSubTab.click();
    await this.page.waitForURL(/contractSubTab=retainage/, { timeout: 15000 });
    await this.page.waitForTimeout(1500);
    Logger.success('Navigated to Contracts > Retainage tab.');
  }

  /** @param {string} invoiceNumberText e.g. "Invoice #14080" */
  getRetainageTabInvoiceRow(invoiceNumberText) {
    return this.page
      .locator('revo-grid revogr-data[type="rgRow"] div[role="row"]')
      .filter({ hasText: invoiceNumberText });
  }

  /**
   * @param {string} scope e.g. "Bid with material"
   * @param {string} scheduleOfValue e.g. "76000"
   */
  getRetainageTabLineItemRow(scope, scheduleOfValue) {
    return this.page
      .locator('revo-grid revogr-data[type="rgRow"] div[role="row"]')
      .filter({ hasText: `${scope} · ${scheduleOfValue}` });
  }

  /**
   * Expands (or collapses, if already expanded) the given invoice row's tree toggle.
   * @param {import('@playwright/test').Locator} invoiceRow
   */
  async toggleRetainageTabRow(invoiceRow) {
    await invoiceRow.locator('.tree-toggle').click();
    await this.page.waitForTimeout(400);
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
    const text = await this.retainageTabTotalRow.innerText();
    const [, withheld, released, outstanding] = text.split('\n').filter(Boolean);
    return { withheld, released, outstanding };
  }
}

module.exports = { RetainagePage };
