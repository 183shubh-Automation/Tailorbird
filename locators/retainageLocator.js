/**
 * Retainage flow locators — Invoice tab / Invoice Details drawer / Contracts > Retainage sub-tab.
 * Moved out of pages/retainagePage.js so every selector for this flow lives in one place,
 * matching the locator/page-object/fixture split used elsewhere in this framework.
 * @param {import('@playwright/test').Page} page
 */
function retainageLocators(page) {
  return {
    goBackButton: page.getByRole('button', { name: 'Go Back' }),
    confirmInvoiceButton: page.getByRole('button', { name: 'Confirm Invoice' }),
    invoiceNumberInput: page.getByRole('textbox', { name: 'Enter invoice number' }),
    titleInput: page.getByRole('textbox', { name: 'Enter title' }),
    descriptionInput: page.getByRole('textbox', { name: 'Enter description' }),

    // Overview panel — Retainage % is the only editable/enabled field of the five; the rest are
    // computed + disabled. "Retainage %" text also appears in the line-items grid column header,
    // so every field here is scoped from its <p> label's parent container, not a bare getByText().
    retainagePercentLabel: page.locator('p', { hasText: /^Retainage %$/ }).first(),
    retainagePercentInput: page.locator('p', { hasText: /^Retainage %$/ }).locator('xpath=..').getByRole('textbox'),
    overrideLabel: page.getByText('Override', { exact: true }),
    grossAmountInput: page.locator('p', { hasText: /^Gross Amount$/ }).locator('xpath=..').getByRole('textbox'),
    retainageWithheldInput: page.locator('p', { hasText: /^Retainage Withheld$/ }).locator('xpath=..').getByRole('textbox'),
    retainageReleasedInput: page.locator('p', { hasText: /^Retainage Released$/ }).locator('xpath=..').getByRole('textbox'),
    netPayableInput: page.locator('p', { hasText: /^Net Payable$/ }).locator('xpath=..').getByRole('textbox'),

    // Line-items grid (revo-grid) column headers
    lineItemsGrid: page.locator('revo-grid:has([role="columnheader"] span:text("Cost Item"))'),
    lineItemsInvoiceAmountHeader: page.locator('[role="columnheader"]').filter({ hasText: 'Invoice Amount' }),
    lineItemsRetainagePercentHeader: page.locator('[role="columnheader"]').filter({ hasText: /^Retainage %$/ }),
    lineItemsRetainageAmountHeader: page.locator('[role="columnheader"]').filter({ hasText: 'Retainage ($)' }),
    lineItemsRetainageReleasedHeader: page.locator('[role="columnheader"]').filter({ hasText: 'Retainage Released ($)' }),
    lineItemsTotalWithheldHeader: page.locator('[role="columnheader"]').filter({ hasText: 'Total Withheld to Date' }),
    lineItemsOutstandingRetainageHeader: page.locator('[role="columnheader"]').filter({ hasText: 'Outstanding Retainage' }),
    lineItemsNetPayableHeader: page.locator('[role="columnheader"]').filter({ hasText: /^Net Payable$/ }),
    lineItemsRow: (scope, scheduleOfValue) =>
      page
        .locator('revo-grid:has([role="columnheader"] span:text("Cost Item"))')
        .locator('revogr-data[type="rgRow"] div[role="row"]')
        .filter({ hasText: scope })
        .filter({ hasText: scheduleOfValue }),

    // Invoice list grid (revo-grid) column headers
    listRetainageWithheldHeader: page.locator('[role="columnheader"]').filter({ hasText: 'Retainage Withheld ($)' }),
    listRetainageReleasedHeader: page.locator('[role="columnheader"]').filter({ hasText: 'Retainage Released ($)' }),
    listOutstandingRetainageHeader: page.locator('[role="columnheader"]').filter({ hasText: 'Outstanding Retainage ($)' }),
    listNetPayableHeader: page.locator('[role="columnheader"]').filter({ hasText: /^Net Payable$/ }),
    createInvoiceButton: page
      .getByRole('button', { name: /^(Create|Add) Invoice$/i })
      .locator('visible=true')
      .first(),
    listRowByInvoiceNumber: (invoiceNumberText) =>
      page
        .locator('revo-grid:has([role="columnheader"] span:text("Invoice Number")) revogr-data[type="rgRow"] div[role="row"]')
        .filter({ hasText: invoiceNumberText }),

    // Contracts tab -> Retainage sub-tab (job page: Job Summary / Contracts / Change Orders / Invoice)
    contractsTab: page.getByRole('tab', { name: 'Contracts' }),
    contractSubTab: page.getByRole('tab', { name: 'Contract', exact: true }),
    documentsSubTab: page.getByRole('tab', { name: 'Documents', exact: true }),
    retainageSubTab: page.getByRole('tab', { name: 'Retainage', exact: true }),

    retainageTabInvoiceOrLineItemHeader: page.getByRole('columnheader', { name: 'Invoice / Line Item', exact: true }),
    retainageTabDateHeader: page.getByRole('columnheader', { name: 'Date', exact: true }),
    retainageTabWithheldHeader: page.getByRole('columnheader', { name: 'Withheld', exact: true }),
    retainageTabReleasedHeader: page.getByRole('columnheader', { name: 'Released', exact: true }),
    retainageTabOutstandingHeader: page.getByRole('columnheader', { name: 'Outstanding', exact: true }),
    // Total row is rendered outside revogr-data[type="rgRow"] (a pinned/footer row), so it needs
    // the broader [role="row"] selector rather than the data-row-scoped locator used elsewhere.
    retainageTabTotalRow: page.locator('[role="row"]').filter({ hasText: /^Total/ }),
    retainageTabInvoiceRow: (invoiceNumberText) =>
      page
        .locator('revo-grid revogr-data[type="rgRow"] div[role="row"]')
        .filter({ hasText: invoiceNumberText }),
    retainageTabLineItemRow: (scope, scheduleOfValue) =>
      page
        .locator('revo-grid revogr-data[type="rgRow"] div[role="row"]')
        .filter({ hasText: `${scope} · ${scheduleOfValue}` }),
    retainageTabDataRows: page.locator('revo-grid revogr-data[type="rgRow"] div[role="row"]'),
    // Every top-level invoice row (as opposed to an expanded line-item child row) has its own
    // tree-toggle; line-item rows never do. Used to sum across all invoices currently in the
    // grid without assuming there is exactly one.
    retainageTabAllInvoiceRows: page
      .locator('revo-grid revogr-data[type="rgRow"] div[role="row"]')
      .filter({ has: page.locator('.tree-toggle') }),
    expandToggleWithin: (row) => row.locator('.tree-toggle'),

    // Contract Overview card (Contracts tab, above the Contract/Documents/Retainage sub-tabs)
    contractsTabPanel: page.getByRole('tabpanel', { name: 'Contracts' }),
    contractOverviewFieldValue: (label) =>
      page
        .getByRole('tabpanel', { name: 'Contracts' })
        .locator('p', { hasText: new RegExp(`^${label}$`) })
        .locator('xpath=following-sibling::p[1]'),
    editContractOverviewButton: page.getByRole('tabpanel', { name: 'Contracts' }).getByRole('button', { name: 'Edit', exact: true }),
    contractOverviewTotalWithheldLabel: page.getByRole('tabpanel', { name: 'Contracts' }).getByText('Total Withheld', { exact: true }),
    contractOverviewTotalReleasedLabel: page.getByRole('tabpanel', { name: 'Contracts' }).getByText('Total Released', { exact: true }),
    contractOverviewOutstandingBalanceLabel: page.getByRole('tabpanel', { name: 'Contracts' }).getByText('Outstanding Balance', { exact: true }),

    // Edit Contract Overview drawer
    editContractOverviewDialog: page.getByRole('dialog', { name: 'Edit Contract Overview' }),
    editContractRetainagePercentLabel: page.getByRole('dialog', { name: 'Edit Contract Overview' }).getByText('Retainage %', { exact: true }),
    editContractRetainageLockMessage: page
      .getByRole('dialog', { name: 'Edit Contract Overview' })
      .getByText('Contract is finalized. Retainage % cannot be changed.', { exact: true }),
    editContractRetainagePercentInput: page
      .getByRole('dialog', { name: 'Edit Contract Overview' })
      .getByRole('textbox', { name: 'Retainage %' }),
    editContractOverviewSaveButton: page
      .getByRole('dialog', { name: 'Edit Contract Overview' })
      .getByRole('button', { name: 'Save Changes', exact: true }),
    editContractOverviewCancelButton: page
      .getByRole('dialog', { name: 'Edit Contract Overview' })
      .getByRole('button', { name: 'Cancel', exact: true }),
  };
}

module.exports = { retainageLocators };
