const organizationLocators = {
  breadcrumbContainer: '.mantine-Breadcrumbs-root',
  breadcrumbHome: '.mantine-Anchor-root',
  breadcrumbOrg: '.mantine-Breadcrumbs-breadcrumb',
  searchInputPlaceholder:
    'input[placeholder="Search by name or email"], input[placeholder="Search by name or e-mail"]',
  roleDropdown: 'combobox',
  inviteButton: 'button:has-text("Invite users"), button:has-text("Invite user")',
  tableRoot: 'table.rt-TableRootTable',
  tableRow: 'table tbody tr.rt-TableRow',
  tableHeaders: 'table thead th.rt-TableColumnHeaderCell',
  roleMenu: '.rt-SelectContent[data-state="open"]',
  dialogRoot: '[role="dialog"]',
  dialogEmailInput: 'input[placeholder*="company.com"], input[placeholder="Enter an email address"]',
  dialogRoleSelect: '[role="combobox"]',
  dialogInviteBtn: 'button:has-text("Invite")',
  dialogCancelBtn: 'button:has-text("Cancel")',
  modal: '[role="alertdialog"], [role="dialog"]',
  // MCP-verified live (2026-07-29): the Revoke/Resend confirmation modals are Mantine
  // Modals whose title renders as <h2>, not <h1>.
  modalTitle: 'h2',
  modalConfirmBtn: 'button:has-text("Resend"), button:has-text("Revoke")',
  modalCancelBtn: 'button:has-text("Cancel")',
  userActionsBtn: 'button[title="User actions"]',
  firstRowMenuBtn: 'table tbody tr:first-child button[title="User actions"]',
  menuItemRevoke: 'role=menuitem >> text=Revoke invitation',
  menuItemResend: 'role=menuitem >> text=Resend'
};

/**
 * Self-healing strategies for the "User actions" row-menu button (pages/organizationHelper.js,
 * TC25/TC26). 4 independent strategies, MCP-verified 2026-08-04 (beta.tailorbird.com):
 *   1. `title="User actions"` (original — organizationLocators.userActionsBtn)
 *   2. `aria-label="User actions"` — a separate, independently-settable attribute from #1
 *   3. icon SVG class `lucide-ellipsis-vertical` — confirmed distinct from the "Edit user"
 *      button's icon (`lucide-panel-right`) in the same row, so no ambiguity within a
 *      row-scoped lookup
 *   4. positional — this button is the LAST of the row's action buttons (Edit user, then
 *      User actions); weakest signal (breaks if a 3rd action button is ever added), kept
 *      last in priority order for that reason
 * `scope` lets callers pass a row-scoped locator (revoke's primary attempt) or the page
 * itself (rowIndex-correlated fallback, openFirstMenu's fallback).
 * @param {import('@playwright/test').Locator} scope
 */
function userActionsButtonStrategies(scope) {
  return [
    { name: 'css:button[title=User actions]', locator: scope.locator(organizationLocators.userActionsBtn) },
    { name: 'role:button[name=User actions]', locator: scope.getByRole('button', { name: 'User actions', exact: true }) },
    { name: 'css:button:has(svg.lucide-ellipsis-vertical)', locator: scope.locator('button:has(svg.lucide-ellipsis-vertical)') },
    { name: 'position:last-action-button', locator: scope.locator('button').last() },
  ];
}

/**
 * Self-healing strategies for TC35 (tests/TC03_manageOrganization.spec.js — "Full
 * organization workspace text agent"). Every element the test touches is healed here,
 * per the "heal every locator, working or not" directive — not just fragile ones.
 * All MCP-verified live 2026-08-05 (beta.tailorbird.com/organization). No regex/XPath in
 * ADDED strategies; strategy #1 is always the exact original pre-existing expression.
 * @param {import('@playwright/test').Page} page
 */
function orgWorkspaceTabsListStrategies(page) {
  return [
    { name: 'css:[role=tablist](original)', locator: page.locator('[role="tablist"]') },
    /**
     * MCP/live-run-verified: Mantine's own stable class name on this exact element —
     * `mantine-Tabs-list` (confirmed via the real rendered class attribute
     * "m_576c9d4 m_89d33d6d mantine-Tabs-list", hash-prefixed but this literal substring
     * is stable). A genuinely independent mechanism (CSS class vs. ARIA role attribute).
     *
     * CAUTION (found live, not assumed): an earlier version of this strategy used
     * `div:has(role=tab[name=Users])`, i.e. "any div that CONTAINS a Users tab". Because
     * `:has()`/`.filter({has})` matches ANY ancestor, not just the immediate parent, this
     * resolved to 2 real elements (an outer wrapper div AND the actual tablist div) and
     * threw a strict-mode violation on the very first standalone run. Selecting the
     * element by its OWN class instead of "an ancestor of X" avoids that ambiguity.
     */
    { name: 'css:.mantine-Tabs-list', locator: page.locator('.mantine-Tabs-list') },
  ];
}

function orgWorkspaceSearchInputStrategies(page) {
  return [
    { name: 'css:input[placeholder=Search by name or email/e-mail](original)', locator: page.locator('input[placeholder="Search by name or email"], input[placeholder="Search by name or e-mail"]') },
    /** MCP-verified: aria-label is "Search users by name or email" — different text from the placeholder, a genuinely independent attribute. */
    { name: 'role:textbox[name=Search users by name or email]', locator: page.getByRole('textbox', { name: 'Search users by name or email', exact: true }) },
    /** Structural: the first textbox inside the "Users" tabpanel — independent of both label text and placeholder text. */
    { name: 'css:tabpanel[Users]>>role:textbox[first]', locator: page.getByRole('tabpanel', { name: 'Users' }).getByRole('textbox').first() },
  ];
}

function orgWorkspaceBreadcrumbStrategies(page) {
  return [
    { name: 'text:Organization(exact,original)', locator: page.locator('main').getByText('Organization', { exact: true }) },
    /** No data-testid/aria-label/distinguishing class exists on this plain <p> — only 2 genuinely independent strategies, not padded. */
    { name: 'css:main>>p[hasText=Organization]', locator: page.locator('main').locator('p').filter({ hasText: 'Organization' }).first() },
  ];
}

function orgWorkspaceTabStrategies(page, tabName) {
  return [
    { name: 'role:tab[name](original)', locator: page.locator('[role="tablist"]').getByRole('tab', { name: tabName }) },
    /**
     * MCP/live-run-verified: Mantine's own tab class, filtered by the BUTTON's own text
     * (`filter({hasText})` on a locator matching `button[role=tab]` elements filters those
     * button elements themselves, not a descendant) — a different mechanism (CSS class +
     * filter) than ARIA role/name computation, but resolves to the same physical button.
     *
     * CAUTION (found live, not assumed): an earlier version used
     * `getByText(tabName, {exact:true})` scoped to the tablist. Playwright's `getByText`
     * matches the SMALLEST element containing that exact text, which here is the inner
     * `<span class="mantine-Tabs-tabLabel">`, not the `<button role="tab">` itself — two
     * different real, simultaneously-visible nodes — causing a strict-mode violation on
     * the very first standalone run. Filtering an element-typed locator by its own
     * `hasText` (rather than searching for the text node) avoids that parent/child split.
     */
    { name: 'css:.mantine-Tabs-tab[hasText]', locator: page.locator('.mantine-Tabs-tab').filter({ hasText: tabName }) },
  ];
}

function orgWorkspaceInviteButtonStrategies(page) {
  return [
    /** Original pre-existing test code used a case-insensitive regex; kept verbatim as strategy #1 (business logic untouched). */
    { name: 'role:button[name=/invite user/i](original)', locator: page.getByRole('button', { name: /invite user/i }) },
    /** MCP-verified: real, full aria-label is "Invite users to organization" — an exact, no-regex match on the complete accessible name. */
    { name: 'role:button[name=Invite users to organization](exact)', locator: page.getByRole('button', { name: 'Invite users to organization', exact: true }) },
    /** MCP-verified: the button's own visible inner text is exactly "Invite users" (from a child span) — filter-based, no regex. */
    { name: 'css:button[hasText=Invite users]', locator: page.getByRole('button').filter({ hasText: 'Invite users' }) },
  ];
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} colName
 */
function orgWorkspaceColumnHeaderStrategies(page, colName) {
  return [
    { name: 'role:columnheader[name](original)', locator: page.getByRole('columnheader', { name: colName }) },
    /**
     * Structural: the columnheader div itself, filtered by its own text — a different
     * mechanism (own-text filter, no accessible-name computation) than strategy 1.
     *
     * CAUTION (found live, not assumed): two earlier versions were tried and rejected —
     * (a) `getByText(colName, {exact:true})` scoped to the treegrid matched RevoGrid's
     * inner `<div class="header-content">` text node, not the `[role="columnheader"]`
     * div itself (parent/child split, strict-mode violation); (b) an `aria-colindex`
     * positional strategy assumed one global index per column, but this RevoGrid table
     * renders a SEPARATE index sequence per pinned region — the "Role" column
     * (aria-colindex="3", data-rgcol="3", main scroll region) and the pinned-end
     * "Actions" column (aria-colindex="3", data-rgcol="0", `.colPinEnd` region) collide
     * on the same aria-colindex value, so it is not actually unique table-wide and was
     * dropped rather than kept as a false-safety net.
     */
    { name: 'css:treegrid>>columnheader[hasText]', locator: page.locator('[role="treegrid"] [role="columnheader"]').filter({ hasText: colName }) },
  ];
}

module.exports = {
  ...organizationLocators,
  userActionsButtonStrategies,
  orgWorkspaceTabsListStrategies,
  orgWorkspaceSearchInputStrategies,
  orgWorkspaceBreadcrumbStrategies,
  orgWorkspaceTabStrategies,
  orgWorkspaceInviteButtonStrategies,
  orgWorkspaceColumnHeaderStrategies,
};
