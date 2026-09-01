/**
 * Self-healing locator strategies for the Approvers Management text-agent scan
 * (tests/TC03_manageTeam_roles.spec.js, TC48). No regex, no XPath (semgrep-safe).
 */

/**
 * "Table" toolbar button — 4 independently-verified attributes (MCP 2026-08-04,
 * beta.tailorbird.com/user-role-management):
 *   1. role/text "Table" (original)
 *   2. a real data-testid="bt-table-action" (one of very few in this app)
 *   3. semantically distinct icon class svg.lucide-table (icons are named after
 *      purpose, so this won't collide with View/Export's icons)
 *   4. DOM position — CAUTION (found live, not assumed): Mantine's <Group> wraps
 *      <Group>, so ".mantine-Group-root" nests. A naive
 *      `.filter({has: getByRole('button', {name:'Export'})})` matches BOTH the
 *      outer wrapper (Export is a nested descendant) AND the inner group (Export
 *      is a direct child) — 2 elements, strict-mode violation. Fixed by requiring
 *      Export as a DIRECT child (`:scope > button`), which uniquely selects the
 *      inner group. That inner group's direct children are
 *      [div-wrapping-View, button-Table, button-Export] — "View" is a real button
 *      but only reachable as a nested descendant of that wrapping div, not a
 *      direct child, so a plain `.locator('button')` (Playwright's descendant
 *      default) would incorrectly return "View" first; `:scope > button`
 *      restricts to direct-child buttons only ([Table, Export]), so `.first()`
 *      correctly lands on Table. Weakest signal, kept last in priority order.
 * View/Export only share a generic data-table-action="true" (not unique enough
 * to disambiguate between them) and have no distinctly-named icon, so they stay
 * text-only (no strategies function needed for them).
 * @param {import('@playwright/test').Page} page
 */
function tableButtonStrategies(page) {
  return [
    { name: 'role:button[name=Table]', locator: page.getByRole('button', { name: 'Table' }) },
    { name: 'testid:bt-table-action', locator: page.getByTestId('bt-table-action') },
    { name: 'css:button:has(svg.lucide-table)', locator: page.locator('button:has(svg.lucide-table)') },
    {
      name: 'position:group-with-direct-Export-child-first-direct-button',
      locator: page.locator('.mantine-Group-root')
        .filter({ has: page.locator(':scope > button', { hasText: 'Export' }) })
        .locator(':scope > button')
        .first(),
    },
  ];
}

module.exports = { tableButtonStrategies };
