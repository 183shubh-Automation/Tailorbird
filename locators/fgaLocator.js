/**
 * FEAT-972 — FGA (Fine-Grained Access) User Management.
 * Locators for the Organization > "Property access" tab: property grid, per-row
 * Settings action, and the "Property access: {propertyName}" assignment dialog.
 * MCP-verified live (2026-07-08) against Organization workspace, QA Automations org.
 *
 * Follows this repo's `locators/organization.js` convention (plain object of
 * selector strings / literal UI copy) — new file, does not modify that one.
 */
const fgaLocatorText = {
  usersTabName: 'Users',
  propertyAccessTabName: 'Property access',

  transposeViewButtonName: 'Transpose view',
  settingsButtonName: 'Settings',

  propertyAccessSearchPlaceholder: 'Search',
  noPropertiesFoundText: 'No properties found.',

  columnHeaders: ['Property', 'Location', 'Access', 'Actions'],

  /** Assignment dialog opened via a property row's "Settings" action. */
  dialogTitlePrefix: 'Property access: ',
  dialogUserSearchPlaceholder: 'Search by name or email',
  selectAllButtonName: 'Select all',
  deselectAllButtonName: 'Deselect all',

  /** Each assignable user renders as a Mantine Group (checkbox + name/email) — MCP-verified DOM chain. */
  dialogUserRowGroup: 'div.mantine-Group-root',

  accessGrantedToastTitle: 'Access granted',
  accessGrantedToastMessage: 'Property access granted.',
};

/**
 * Original pre-existing expression for this call site was unscoped `page.getByRole('tab',
 * {name})` (fgaUserManagementPage.openPropertyAccessTab) — kept verbatim as strategy #1.
 * Fallback reuses the same Mantine tab-class mechanism already MCP-verified for
 * orgWorkspaceTabStrategies (organization.js) — same tablist, same physical element.
 */
function propertyAccessTabStrategies(page) {
  return [
    { name: 'role:tab[name](original)', locator: page.getByRole('tab', { name: fgaLocatorText.propertyAccessTabName }) },
    { name: 'css:.mantine-Tabs-tab[hasText]', locator: page.locator('.mantine-Tabs-tab').filter({ hasText: fgaLocatorText.propertyAccessTabName }) },
  ];
}

/**
 * TC350 (tests/TC23_FGA_flow.spec.js) — Property access tab: grid, per-row Settings
 * action, and the assign-user drawer. Every element on TC350's execution path is healed
 * here, per the "heal every locator, working or not" directive. All MCP-verified live
 * 2026-08-06 (beta.tailorbird.com/organization). No regex/XPath in ADDED strategies;
 * strategy #1 is always the exact original pre-existing expression.
 */

/** Tabpanel search input: MCP-confirmed the real `<input>` has placeholder="Search" and NO aria-label — accessible name resolves from the placeholder itself. */
function propertyAccessSearchInputStrategies(tabPanel) {
  return [
    { name: 'role:textbox[name=Search](original)', locator: tabPanel.getByRole('textbox', { name: fgaLocatorText.propertyAccessSearchPlaceholder }) },
    { name: 'css:input[placeholder=Search]', locator: tabPanel.locator('input[placeholder="Search"]') },
  ];
}

/** MCP-confirmed: a real semantic `<table>` (Mantine Table) — role="table" is browser-computed, not an explicit attribute. */
function propertyAccessTableStrategies(tabPanel) {
  return [
    { name: 'role:table(original)', locator: tabPanel.getByRole('table') },
    { name: 'css:.mantine-Table-table', locator: tabPanel.locator('table.mantine-Table-table') },
  ];
}

function propertyRowStrategies(table, propertyName) {
  return [
    { name: 'role:row[hasText](original)', locator: table.getByRole('row').filter({ hasText: propertyName }) },
    { name: 'css:tr[hasText]', locator: table.locator('tr').filter({ hasText: propertyName }) },
  ];
}

/** MCP-confirmed: icon-only ActionIcon, accessible name from `aria-label="Settings"` (no visible text), icon is `svg.lucide-settings`. */
function propertySettingsButtonStrategies(row) {
  return [
    { name: 'role:button[name=Settings](original)', locator: row.getByRole('button', { name: fgaLocatorText.settingsButtonName }) },
    { name: 'css:button:has(svg.lucide-settings)', locator: row.locator('button:has(svg.lucide-settings)') },
  ];
}

/** MCP-confirmed: Mantine Drawer with role="dialog"; heading is a real `<h2>` matching the accessible name computed for the dialog. */
function propertyAccessDialogStrategies(page, propertyName) {
  const expectedTitle = `${fgaLocatorText.dialogTitlePrefix}${propertyName}`;
  return [
    { name: 'role:dialog[name](original)', locator: page.getByRole('dialog', { name: expectedTitle }) },
    { name: 'css:dialog[has=heading[name,exact]]', locator: page.locator('[role="dialog"]').filter({ has: page.getByRole('heading', { name: expectedTitle, exact: true }) }) },
  ];
}

/** MCP-confirmed: the drawer's close (X) button carries Mantine's own stable `mantine-Drawer-close` class — a genuinely independent mechanism from the landmark+role lookup. */
function propertyAccessDialogCloseButtonStrategies(dialog) {
  return [
    { name: 'role:banner>>role:button[first](original)', locator: dialog.getByRole('banner').getByRole('button').first() },
    { name: 'css:.mantine-Drawer-close', locator: dialog.locator('.mantine-Drawer-close') },
  ];
}

/** MCP-confirmed live DOM chain: input[type=checkbox] -> ... -> div.mantine-Group-root (the per-row wrapper) -> outer div.mantine-Stack-root (the list container, NOT per-row). */
function dialogUserRowStrategies(dialog, email) {
  return [
    { name: 'css:.mantine-Group-root[hasText](original)', locator: dialog.locator(fgaLocatorText.dialogUserRowGroup).filter({ hasText: email }) },
    { name: 'css:.mantine-Group-root[has=text-exact]', locator: dialog.locator(fgaLocatorText.dialogUserRowGroup).filter({ has: dialog.getByText(email, { exact: true }) }) },
  ];
}

function dialogUserSearchInputStrategies(dialog) {
  return [
    { name: 'placeholder:Search by name or email(original)', locator: dialog.getByPlaceholder(fgaLocatorText.dialogUserSearchPlaceholder) },
    { name: 'role:textbox[name=Search by name or email]', locator: dialog.getByRole('textbox', { name: fgaLocatorText.dialogUserSearchPlaceholder }) },
  ];
}

/** MCP-confirmed live: Mantine Notification toast, `role="alert"`, containing this exact message. */
/** Original pre-existing expression assumed a fixed column position (Access = 3rd cell). Fallback locates the cell by its own rendered content ("N Users") instead of position — an independent, content-based mechanism. */
function accessCellStrategies(row) {
  return [
    { name: 'role:cell[nth=2](original)', locator: row.getByRole('cell').nth(2) },
    { name: 'role:cell[hasText=Users]', locator: row.getByRole('cell').filter({ hasText: 'Users' }) },
  ];
}

/** Users tab grid row lookup (fgaUserManagementPage.validateInvitedBadge) — original substring `hasText` filter kept as strategy #1; fallback uses an exact-text descendant filter, a distinct matching mechanism. */
function userRowByEmailStrategies(page, email) {
  return [
    { name: 'role:row[hasText](original)', locator: page.getByRole('row').filter({ hasText: email }) },
    { name: 'role:row[has=text-exact]', locator: page.getByRole('row').filter({ has: page.getByText(email, { exact: true }) }) },
  ];
}

/**
 * MCP/live-run-verified: the original `getByText(exact)` resolves to the inner
 * `.mantine-Notification-description` div, while the `role=alert` fallback resolves to the
 * OUTER notification div — two different, simultaneously-visible real nodes (confirmed via
 * a live strict-mode violation) — callers must apply `.first()` to the combined locator.
 */
function accessGrantedToastStrategies(page) {
  return [
    { name: 'text:Property access granted.(original)', locator: page.getByText(fgaLocatorText.accessGrantedToastMessage) },
    { name: 'role:alert[hasText]', locator: page.getByRole('alert').filter({ hasText: fgaLocatorText.accessGrantedToastMessage }) },
  ];
}

module.exports = {
  ...fgaLocatorText,
  propertyAccessTabStrategies,
  propertyAccessSearchInputStrategies,
  propertyAccessTableStrategies,
  propertyRowStrategies,
  propertySettingsButtonStrategies,
  propertyAccessDialogStrategies,
  propertyAccessDialogCloseButtonStrategies,
  dialogUserRowStrategies,
  dialogUserSearchInputStrategies,
  accessCellStrategies,
  userRowByEmailStrategies,
  accessGrantedToastStrategies,
};
