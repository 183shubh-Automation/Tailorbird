/**
 * FEAT-972 — post-activation UI locators for pages/userActivationPage.js (TC23_FGA_flow.spec.js
 * TC355-TC363): profile menu, Properties grid, and the Budget page's Property selector.
 * Follows this repo's `locators/fgaLocator.js` / `locators/loginLocator.js` convention (ordered
 * `{name, locator}` strategies, strategy #1 is always the exact original expression) so these
 * can be combined via `utils/locatorHealer.js`'s `healingLocator()`.
 *
 * MCP-verified live 2026-08-10 against beta.tailorbird.com (QA Automations org, admin session —
 * DOM structure for these elements does not vary by role, only the data each renders does).
 */

/**
 * Sidebar profile trigger: original locates the exact user-email <p> directly (no stable
 * role/testid on the clickable wrapper itself — MCP-confirmed). Live-run verified (2026-08-10)
 * that a naive ancestor-wrapper fallback (`div.mantine-Group-root` filtered by the email text)
 * resolves to a DIFFERENT, simultaneously-visible node than the original — the wrapper vs. its
 * inner <p> — which throws a strict-mode violation on `.click()` once combined via `.or()`
 * (see utils/locatorHealer.js jsdoc: fallbacks must resolve to the SAME node as the original).
 * This fallback instead scopes to that same wrapper class first, then narrows back down to the
 * identical exact-text <p> — an independent lookup PATH that still lands on the same leaf node.
 */
function profileMenuTriggerStrategies(page, userEmail) {
  return [
    { name: 'text:email(exact)(original)', locator: page.getByText(userEmail, { exact: true }) },
    {
      name: 'css:.mantine-Group-root>>text:email(exact)',
      locator: page.locator('div.mantine-Group-root').filter({ hasText: userEmail }).getByText(userEmail, { exact: true }),
    },
  ];
}

/** MCP-confirmed: the open profile menu's `role="menu"` resolves via `aria-labelledby` pointing at the trigger; `.mantine-Menu-dropdown` is an independent, non-hashed class on the same node. */
function profileMenuStrategies(page) {
  return [
    { name: 'role:menu[first](original)', locator: page.getByRole('menu').first() },
    { name: 'css:.mantine-Menu-dropdown', locator: page.locator('.mantine-Menu-dropdown').first() },
  ];
}

/**
 * Properties grid container has no role/testid, only Mantine's hashed SimpleGrid class — MCP
 * live-run (2026-08-10) confirmed there is no safe second mechanism for the CONTAINER itself:
 * an ancestor-`div`-that-has-a-PropertyCard fallback matches every enclosing div (breadcrumb
 * wrapper, page wrapper, etc.), not just the grid, and leaked an unrelated "Home" breadcrumb
 * entry into propertyCards() once combined with `> div`. Single strategy, deliberately: an
 * unsound fallback is worse than none. propertyCardStrategies below still gets a safe,
 * independent fallback for the cards themselves.
 */
function propertiesGridStrategies(page) {
  return [
    { name: 'css:.mantine-SimpleGrid-root(original)', locator: page.locator('.mantine-SimpleGrid-root') },
  ];
}

/** MCP-confirmed DOM: each property card's class starts with `PropertyCard_card__` (CSS-module hash suffix) — an independent mechanism from "direct child of the grid". */
function propertyCardStrategies(propertiesGrid, page) {
  return [
    { name: 'css:>div(original)', locator: propertiesGrid.locator('> div') },
    { name: 'css:[class*=PropertyCard_card__]', locator: page.locator('[class*="PropertyCard_card__"]') },
  ];
}

/** MCP-confirmed: Budget page's property selector button carries the app-owned (non-Mantine-hashed) `tb-property-selector-button` class alongside its accessible name. */
function budgetPropertySelectorButtonStrategies(page) {
  return [
    { name: 'role:button[name=Select a Property](original)', locator: page.getByRole('button', { name: 'Select a Property' }) },
    { name: 'css:.tb-property-selector-button', locator: page.locator('.tb-property-selector-button') },
  ];
}

/** MCP-confirmed: the opened dropdown carries the app-owned `tb-property-selector-menu-dropdown` class alongside its role="menu" (name resolved via aria-labelledby -> trigger button). */
function budgetPropertyDropdownStrategies(page) {
  return [
    { name: 'role:menu[name=Select a Property](original)', locator: page.getByRole('menu', { name: 'Select a Property' }) },
    { name: 'css:.tb-property-selector-menu-dropdown', locator: page.locator('.tb-property-selector-menu-dropdown') },
  ];
}

module.exports = {
  profileMenuTriggerStrategies,
  profileMenuStrategies,
  propertiesGridStrategies,
  propertyCardStrategies,
  budgetPropertySelectorButtonStrategies,
  budgetPropertyDropdownStrategies,
};
