/**
 * Locators for the CM Fee-in-Draw-Reporting + generated-PDF flow that are NOT already covered
 * by `locators/drawReportingLocator.js` (property selection, Create Draw modal, invoice
 * inclusion, per-invoice CM Fee % override, KPIs, `historicalDrawRowByName`, etc. — all reused
 * as-is, unmodified).
 *
 * New surfaces covered here only:
 *  - The "View" action's resulting draw-details dialog (Summary / Budget Snapshot / Invoices tabs).
 *  - The "PDF" action's resulting preview dialog (an iframe whose `src` is a signed, public PDF URL).
 *
 * The Historical Draws row's "View" (eye) and "PDF" (file-text) action icons themselves are
 * intentionally NOT locators here: MCP-verified live (2026-09-02) this grid virtualizes its
 * "Actions" column as a structurally SEPARATE column group — those buttons are DOM siblings of
 * the data rows, not descendants, so any `row.locator(...)`-scoped selector always matches zero
 * of them (the exact same documented issue this repo already solved for the "All Approvals" grid
 * in `DrawReportingJob.resolveViewDetailsButtonForRow`, drawReportingPage.js). They're resolved
 * instead by `CMFeeDrawPdfPage.resolveRowActionIconByPosition`, which ports that same proven
 * geometric row-alignment technique.
 *
 * Every interactive element below is a chain of >=4 independent locator strategies via `.or()`
 * (same convention as `locators/cmFeeLocator.js`) so a single markup/copy change can't silently
 * break the whole suite — Playwright resolves whichever strategy actually matches at run time.
 * @param {import('@playwright/test').Page} page
 */
function cmFeeDrawPdfLocators(page) {
    return {
        // --- Draw details ("View" / eye icon) dialog ---
        drawDetailDialog: (drawName) => page.getByRole('dialog').filter({ hasText: drawName }).last()
            .or(page.getByRole('dialog').filter({ has: page.getByText(drawName, { exact: true }) }).last())
            .or(page.locator('.mantine-Modal-content, .mantine-Drawer-content').filter({ hasText: drawName }).last())
            .or(page.getByRole('dialog').filter({ hasText: 'Summary' }).filter({ hasText: drawName }).last()),

        drawDetailCloseButton: (dialog) => dialog.getByRole('button', { name: 'Close', exact: true })
            .or(dialog.locator('button').filter({ hasText: 'Close' }))
            .or(dialog.locator('.mantine-ActionIcon-root[aria-label="Close"], .mantine-Modal-close'))
            .or(dialog.getByRole('button').first()),

        drawDetailSummaryTab: (dialog) => dialog.getByRole('tab', { name: 'Summary', exact: true })
            .or(dialog.locator('[role="tab"]').filter({ hasText: 'Summary' }))
            .or(dialog.locator('.mantine-Tabs-tab').filter({ hasText: 'Summary' }))
            .or(dialog.getByText('Summary', { exact: true }).locator('xpath=ancestor::*[@role="tab"][1]')),

        drawDetailBudgetSnapshotTab: (dialog) => dialog.getByRole('tab', { name: 'Budget Snapshot', exact: true })
            .or(dialog.locator('[role="tab"]').filter({ hasText: 'Budget Snapshot' }))
            .or(dialog.locator('.mantine-Tabs-tab').filter({ hasText: 'Budget Snapshot' }))
            .or(dialog.getByText('Budget Snapshot', { exact: true }).locator('xpath=ancestor::*[@role="tab"][1]')),

        drawDetailInvoicesTab: (dialog) => dialog.getByRole('tab', { name: /^Invoices \(\d+\)$/ })
            .or(dialog.locator('[role="tab"]').filter({ hasText: /^Invoices \(\d+\)$/ }))
            .or(dialog.locator('.mantine-Tabs-tab').filter({ hasText: /^Invoices \(\d+\)$/ }))
            .or(dialog.getByText(/^Invoices \(\d+\)$/).locator('xpath=ancestor::*[@role="tab"][1]')),

        // MCP-verified live (2026-09-02): the Summary tab shows "Approved" in TWO unrelated
        // places — the actual status badge, AND a separate "Approved: <date>" field label/column
        // header (alongside "Submitted"/"Funded") — an unscoped text-or-paragraph regex match
        // ambiguously resolves both, throwing a strict-mode violation. Every strategy here is
        // scoped specifically to the Mantine Badge component that renders the real status,
        // avoiding that plain-paragraph field label entirely. The Badge component itself renders
        // as TWO nested elements that both independently match (the outer `.mantine-Badge-root`
        // div and its inner `.mantine-Badge-label` span) — `.or()` unions live DOM matches from
        // every branch rather than stopping at the first one that resolves, so `.first()` is
        // applied ONCE to the combined chain (not per-branch) to deterministically pick a single
        // element regardless of how many of the 4 strategies simultaneously match.
        drawDetailStatusText: (dialog) => dialog.locator('.mantine-Badge-label')
            .or(dialog.locator('.mantine-Badge-root'))
            .or(dialog.getByText('Status', { exact: true }).locator('xpath=following::*[contains(@class,"Badge-label")][1]'))
            .or(dialog.locator('[class*="Badge"]').filter({ hasText: /^(Approved|Pending|Rejected|Funded)$/ }))
            .first(),

        drawDetailInvoiceRows: (dialog) => dialog.getByRole('table').getByRole('row')
            .or(dialog.locator('table').locator('tr'))
            .or(dialog.locator('[role="row"]'))
            .or(dialog.locator('.mantine-Table-tr, tr')),

        // --- PDF preview ("PDF" / file-text icon) dialog ---
        pdfPreviewDialog: (drawName) => page.getByRole('dialog').filter({ hasText: drawName }).filter({ has: page.locator('iframe') })
            .or(page.getByRole('dialog').filter({ has: page.locator('iframe') }).filter({ hasText: drawName }))
            .or(page.locator('.mantine-Modal-content').filter({ has: page.locator('iframe') }).filter({ hasText: drawName }))
            .or(page.getByRole('dialog').filter({ has: page.locator('iframe') }).last()),

        pdfPreviewIframe: (dialog) => dialog.locator('iframe')
            .or(dialog.locator('iframe[src]'))
            .or(dialog.locator('[src*="files.tailorbird.com"]'))
            .or(dialog.locator('.mantine-Modal-body iframe, .mantine-Drawer-body iframe')),

        // Same "`.first()` once on the combined chain, not per-branch" fix as drawDetailStatusText
        // above — these strategies can each independently match a different real element (e.g. an
        // icon-only close button vs. a broader `button` catch-all), which `.or()` would otherwise
        // union into a strict-mode violation.
        pdfPreviewCloseButton: (dialog) => dialog.getByRole('button', { name: /close/i })
            .or(dialog.locator('.mantine-Modal-close, .mantine-ActionIcon-root'))
            .or(dialog.locator('button'))
            .or(dialog.getByRole('button'))
            .first(),
    };
}

module.exports = { cmFeeDrawPdfLocators };
