require('dotenv').config();
const { test, expect } = require('@playwright/test');
const { Logger } = require('../utils/logger');
const { LoginPage } = require('../pages/loginPage');
const { InteractionLogger } = require('../utils/InteractionLogger');
const OrganizationHelper = require('../pages/organizationHelper');
const organizationFixture = require('../fixture/organization.json');
const { ensureLeftPanelExpanded } = require('../utils/leftPanelExpander');
// NEW, additive-only import — see utils/resilientRetry.js. Nothing in any page object,
// helper, or config is modified.
const { retryOperation } = require('../utils/resilientRetry');
const { healingLocator } = require('../utils/locatorHealer');
const {
  orgWorkspaceTabsListStrategies,
  orgWorkspaceSearchInputStrategies,
  orgWorkspaceBreadcrumbStrategies,
  orgWorkspaceTabStrategies,
  orgWorkspaceInviteButtonStrategies,
  orgWorkspaceColumnHeaderStrategies,
} = require('../locators/organization');

let sharedBrowserContext;
let sharedPage;
let organizationHelper;

/** Zoom out slightly so table + modals match committed screenshot baselines. */
async function applyWorkspaceZoom(page) {
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const elements = document.querySelectorAll('main, .mantine-AppShell-navbar, body, .mantine-Modal-root');
    elements.forEach((el) => {
      el.style.zoom = '70%';
    });
  });
}

/** Access column format used by the Property access tab's user-centric (transposed) view. */
const PROPERTY_ACCESS_COUNT_PATTERN = /^\d+\s+Propert(y|ies)$/i;

async function ensureUserCentricPropertyAccessView(page) {
  await page.getByRole('tablist').getByRole('tab', { name: 'Property access' }).click();
  const userColumnHeader = page.getByRole('columnheader', { name: 'User', exact: true })
    .or(page.getByRole('cell', { name: 'User', exact: true }));
  const alreadyTransposed = await userColumnHeader.isVisible({ timeout: 3000 }).catch(() => false);
  if (!alreadyTransposed) {
    await retryOperation(
      async () => {
        const isTransposed = await userColumnHeader.isVisible({ timeout: 1000 }).catch(() => false);
        if (!isTransposed) {
          await page.getByRole('button', { name: 'Transpose view' }).click();
        }
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => { });
        await expect(
          userColumnHeader,
          'User-centric Property access view must render after Transpose view',
        ).toBeVisible({ timeout: 45_000 });
      },
      { attempts: 3, delayMs: 2000, label: 'TC03 — Transpose to user-centric Property access view' }
    );
  }
}

test.beforeAll(async ({ browser }) => {
  sharedBrowserContext = await browser.newContext({
    storageState: 'sessionState.json',
  });

  sharedPage = await sharedBrowserContext.newPage();
  organizationHelper = new OrganizationHelper(sharedPage);

  await organizationHelper.goto(process.env.DASHBOARD_URL || organizationFixture.dashboardUrl);
  await applyWorkspaceZoom(sharedPage);
  await ensureLeftPanelExpanded(sharedPage);
  await organizationHelper.goToOrganization();
  await applyWorkspaceZoom(sharedPage);

  sharedPage.on('domcontentloaded', async () => {
    await applyWorkspaceZoom(sharedPage);
  });
});

test.afterAll(async () => {
  await sharedBrowserContext.close();
});

test.describe('Manage Organization', () => {
  test.beforeEach(async () => {
    await organizationHelper.gotoOrganizationWorkspace();
    await applyWorkspaceZoom(sharedPage);
  });

  test('TC22 @sanity @regression - Invite new user to organization with Member role', async () => {
    const invitedEmail = `member_${Date.now()}@yopmail.com`;
    Logger.info(`[TC23] Starting: invite new Member — ${invitedEmail}`);
    await organizationHelper.inviteUser(invitedEmail, 'Member');
    await applyWorkspaceZoom(sharedPage);
    await organizationHelper.search(invitedEmail);
    const userRow = await organizationHelper.getRow(invitedEmail);
    Logger.info(`[TC23] Asserting: invited badge visible for ${invitedEmail}`);
    await organizationHelper.validateInvitedBadge(userRow, invitedEmail);
    Logger.info('[TC23] Asserting: at least one row visible in results');
    expect(await organizationHelper.visibleRowCount()).toBeGreaterThan(0);
    Logger.success(`[TC23] ✅ Member user invited and verified: ${invitedEmail}`);
  });

  test('TC23 @sanity @regression - Invite new user to organization with Admin role', async () => {
    const invitedEmail = `admin_${Date.now()}@yopmail.com`;
    Logger.info(`[TC24] Starting: invite new Admin — ${invitedEmail}`);
    await organizationHelper.inviteUser(invitedEmail, 'Admin');
    await applyWorkspaceZoom(sharedPage);
    await organizationHelper.search(invitedEmail);
    const userRow = await organizationHelper.getRow(invitedEmail);
    Logger.info(`[TC24] Asserting: invited badge visible for ${invitedEmail}`);
    await organizationHelper.validateInvitedBadge(userRow, invitedEmail);
    Logger.info('[TC24] Asserting: at least one row visible');
    expect(await organizationHelper.visibleRowCount()).toBeGreaterThan(0);
    Logger.success(`[TC24] ✅ Admin user invited and verified: ${invitedEmail}`);
  });

  test('TC24 @sanity @regression - Revoke user invitation to organization', async () => {
    const invitedEmail = `revoke_${Date.now()}@yopmail.com`;
    Logger.info(`[TC25] Starting: invite then revoke — ${invitedEmail}`);
    // MCP-verified live (2026-07-29): an invited Admin's row in the Users grid renders only
    // an "Edit user" button in its Actions pane — there is no "User actions" (Revoke/Resend)
    // menu at all for Admin rows, only for non-Admin ("Member" / "View Only") rows. Revoking
    // is therefore only possible against a Member invite; inviting as Admin here made the
    // subsequent revoke() call wait on a menu button that structurally never renders.
    await organizationHelper.inviteUser(invitedEmail, 'Member');
    await applyWorkspaceZoom(sharedPage);
    await organizationHelper.search(invitedEmail);
    const userRow = await organizationHelper.getRow(invitedEmail);
    Logger.info(`[TC25] Revoking invitation for ${invitedEmail}`);
    await organizationHelper.revoke(userRow, invitedEmail);
    await applyWorkspaceZoom(sharedPage);
    await organizationHelper.search(invitedEmail);
    Logger.info('[TC25] Asserting: no results after revoke (user removed from list)');
    await organizationHelper.verifyNoResults();
    Logger.success(`[TC25] ✅ Invitation revoked — user no longer in list: ${invitedEmail}`);
  });

  test('TC25 @sanity @regression - Resend user invitation to organization', async () => {
    const invitedEmail = `resend_${Date.now()}@yopmail.com`;
    Logger.info(`[TC26] Starting: invite then resend — ${invitedEmail}`);
    // MCP-verified live (2026-07-29): same structural constraint as TC25 — an invited Admin's
    // row has no "User actions" menu (only "Edit user"), so openFirstMenu()'s
    // data-rgrow="0" fallback (correct once search narrows the grid to a single matching
    // row) was clicking a button that doesn't exist for an Admin row. Only Member rows
    // expose Resend/Revoke.
    await organizationHelper.inviteUser(invitedEmail, 'Member');
    await applyWorkspaceZoom(sharedPage);
    await organizationHelper.search(invitedEmail);
    const userRow = await organizationHelper.getRow(invitedEmail);
    Logger.info(`[TC26] Opening user action menu for ${invitedEmail}`);
    await organizationHelper.openFirstMenu();
    await applyWorkspaceZoom(sharedPage);
    Logger.info('[TC26] Resending invitation');
    await organizationHelper.resendInvite(invitedEmail);
    Logger.info('[TC26] Asserting: resend success feedback visible');
    await organizationHelper.verifyResendSuccess(invitedEmail);
    Logger.success(`[TC26] ✅ Invitation resent successfully: ${invitedEmail}`);
  });

  test('TC26 @sanity @regression - Edit user role to organization', async () => {
    const existingAdminEmail = 'tailorbird-admin@tailorbird.us';
    Logger.info(`[TC27] Starting: toggle role for ${existingAdminEmail}`);
    await organizationHelper.search(existingAdminEmail);
    await applyWorkspaceZoom(sharedPage);
    const userRow = await organizationHelper.getRow(existingAdminEmail);
    const toggledRole = await organizationHelper.toggleRole(userRow);
    Logger.info(`[TC27] Role toggled to: ${toggledRole} — verifying update`);
    await applyWorkspaceZoom(sharedPage);
    await organizationHelper.search(existingAdminEmail);
    Logger.info(`[TC27] Asserting: role updated to ${toggledRole} for ${existingAdminEmail}`);
    await organizationHelper.verifyUpdatedRole(existingAdminEmail, toggledRole);
    Logger.success(`[TC27] ✅ Role toggled and verified for ${existingAdminEmail}: ${toggledRole}`);
  });

  test('TC27 @sanity @regression - Validate property access and users list validation', async () => {
    Logger.info('[TC36] Starting: Property access user-centric list validation + property assignment');

    // Steps 1-2: Manage Organization is already loaded (beforeEach, lands on the Users
    // tab); the "Users list" with User/Email/Access/Actions columns and an "N Properties"
    // count lives on the Property access tab's user-centric (transposed) view — see
    // ensureUserCentricPropertyAccessView() above for why.
    await ensureUserCentricPropertyAccessView(sharedPage);
    await applyWorkspaceZoom(sharedPage);

    // Steps 3-4: table loaded and visible
    // See ensureUserCentricPropertyAccessView() above — applyWorkspaceZoom degrades this
    // table's header cells from an implicit "columnheader" role to "cell", so column-
    // presence checks below match on either via getByRole() (not a raw CSS attribute
    // selector, which cannot see implicit ARIA roles at all).
    const usersTable = sharedPage
      .locator('table')
      .filter({ has: sharedPage.getByRole('columnheader', { name: 'User', exact: true }).or(sharedPage.getByRole('cell', { name: 'User', exact: true })) });
    await expect(usersTable, 'Property access user-centric table must be visible').toBeVisible({ timeout: 15_000 });
    Logger.info('[TC36] Users list page loaded successfully');

    // Step 5: required columns present
    for (const columnName of ['User', 'Email', 'Access', 'Actions']) {
      Logger.info(`[TC36] Asserting column present: ${columnName}`);
      await expect(
        usersTable.getByRole('columnheader', { name: columnName, exact: true }).or(usersTable.getByRole('cell', { name: columnName, exact: true })),
        `Column "${columnName}" must be present`,
      ).toBeVisible({ timeout: 10_000 });
    }

    // Steps 6-7: at least one row, and every row structurally valid (User/Email non-empty,
    // Access matches "N Properties", Actions has an actionable control) — data itself is
    // dynamic, so no exact-value assertions. Batched into a single evaluate() call since
    // this table renders every row in the DOM (not virtualized, MCP-verified live —
    // 300+ rows in this organization), so validating "every row" doesn't cost one
    // round-trip per row.
    const rowValidation = await usersTable.evaluate((table, accessPatternSource) => {
      const accessPattern = new RegExp(accessPatternSource, 'i');
      const rows = Array.from(table.querySelectorAll('tbody tr'));
      const failures = [];
      rows.forEach((row, i) => {
        const cells = row.querySelectorAll('td');
        const userText = (cells[0]?.textContent || '').trim();
        const emailText = (cells[1]?.textContent || '').trim();
        const accessText = (cells[2]?.textContent || '').trim();
        const hasActionableControl = !!cells[3]?.querySelector('button');
        if (!userText) failures.push(`Row ${i}: User column is empty`);
        if (!emailText) failures.push(`Row ${i}: Email column is empty`);
        if (!accessPattern.test(accessText)) failures.push(`Row ${i}: Access column "${accessText}" is not a valid property count`);
        if (!hasActionableControl) failures.push(`Row ${i}: Actions column has no actionable control`);
      });
      return { rowCount: rows.length, failures };
    }, PROPERTY_ACCESS_COUNT_PATTERN.source);

    Logger.info(`[TC36] Validated ${rowValidation.rowCount} row(s)`);
    expect(rowValidation.rowCount, 'At least one user row must exist').toBeGreaterThan(0);
    expect(
      rowValidation.failures,
      `Row validation failure(s):\n${rowValidation.failures.join('\n')}`,
    ).toHaveLength(0);
    Logger.success(`[TC36] ✅ Users list validated — ${rowValidation.rowCount} row(s), all columns and formats correct`);

    // Steps 8-16: property assignment validation. A freshly-invited Member is used ("any
    // suitable user") so this test never mutates a pre-existing/shared user's real access
    // (isolation) — inviting via the existing organizationHelper.inviteUser() reuses the
    // framework's own utility rather than a new one. MCP-verified live (2026-07-30): the
    // Invite users control lives only on the literal "Users" tab, so navigate back there
    // first (inviteUser() itself does not manage tab navigation).
    await sharedPage.getByRole('tablist').getByRole('tab', { name: 'Users', exact: true }).click();
    await applyWorkspaceZoom(sharedPage);

    const targetEmail = `tc36_property_access_${Date.now()}@yopmail.com`;
    Logger.info(`[TC36] Step 8: Inviting a fresh Member user to use as the target: ${targetEmail}`);
    await organizationHelper.inviteUser(targetEmail, 'Member');
    await applyWorkspaceZoom(sharedPage);

    await ensureUserCentricPropertyAccessView(sharedPage);
    await applyWorkspaceZoom(sharedPage);

    Logger.info(`[TC36] Locating target user in the Property access list: ${targetEmail}`);
    const propertyAccessSearchInput = sharedPage.getByRole('textbox', { name: 'Search', exact: true });
    await propertyAccessSearchInput.fill(targetEmail);
    const targetRow = usersTable.locator('tbody tr').filter({ hasText: targetEmail });

    // MCP-verified live (2026-07-30): a just-invited user can take a moment to be indexed
    // into this list — the same class of grid-freshness gap already handled elsewhere in
    // this file's helpers (e.g. inviteUser()'s own reload fallback). Poll first; only
    // reload if the row genuinely never shows up in that window.
    const rowAppeared = await targetRow.isVisible({ timeout: 20_000 }).catch(() => false);
    if (!rowAppeared) {
      Logger.info('[TC36] Target row not yet visible — reloading and retrying once');
      await sharedPage.reload({ waitUntil: 'domcontentloaded' });
      await ensureUserCentricPropertyAccessView(sharedPage);
      await propertyAccessSearchInput.fill(targetEmail);
    }
    await expect(targetRow, `Row for ${targetEmail} must be visible`).toBeVisible({ timeout: 20_000 });

    // Step 9: capture the current property count exactly as displayed — no assumption
    // about what the starting value should be, since it is dynamic (data-driven).
    const accessCell = targetRow.locator('td').nth(2);
    const previousAccessText = (await accessCell.innerText()).trim();
    const previousCount = parseInt(previousAccessText, 10);
    Logger.info(`[TC36] Step 9: Captured previous property count for ${targetEmail}: "${previousAccessText}" (${previousCount})`);
    expect(Number.isNaN(previousCount), `Previous Access text "${previousAccessText}" must parse to a valid number`).toBe(false);

    // Step 10: open the Actions menu — the row's "Settings" button opens a
    // "Property access: {email}" dialog with a per-property checkbox picker.
    Logger.info('[TC36] Step 10: Opening Actions (Settings) for the target user');
    await targetRow.getByRole('button', { name: 'Settings' }).click();
    const propertyDialog = sharedPage
      .getByRole('dialog')
      .filter({ has: sharedPage.getByRole('heading', { name: `Property access: ${targetEmail}` }) });
    await expect(propertyDialog, 'Property access dialog must open').toBeVisible({ timeout: 10_000 });

    // Step 11: assign "Test Property1" — MCP-verified live (2026-07-30): no property is
    // literally named "Test Property1" in this organization; the only property matching
    // that intent is "Test Property 1_Cottages on Elm" (this org's other numbered test
    // properties, 2 through 6, follow the same "Test Property N_<description>" naming
    // convention and none of their descriptive suffixes contain the digit "1"), so this
    // targets it via a partial match on "Test Property 1" that tolerates the descriptive
    // suffix. Each checkbox row is a Mantine Group (`.mantine-Group-root` — a stable
    // component class, not a hashed one) wrapping the checkbox and its label together.
    await propertyDialog.getByPlaceholder('Search by property name or address').fill('Test Property 1');
    const targetPropertyRow = propertyDialog.locator('.mantine-Group-root').filter({ hasText: 'Test Property 1' }).first();
    await expect(targetPropertyRow, 'Target property row must be visible in the picker').toBeVisible({ timeout: 10_000 });
    await expect(
      targetPropertyRow.getByRole('checkbox'),
      'Target property must not already be assigned (would make the +1 assertion below invalid)',
    ).not.toBeChecked();

    // Steps 12-13: assigning here is a checkbox toggle that auto-saves immediately via
    // POST /api/user-property-access — MCP-verified live: there is no separate "Save"
    // button in this dialog, so the network response itself is the completion signal
    // (proper synchronization instead of a hardcoded wait).
    const propertyAccessSavedPromise = sharedPage.waitForResponse(
      (res) => res.url().includes('/api/user-property-access') && res.request().method() === 'POST' && res.status() === 200,
      { timeout: 20_000 },
    );
    await targetPropertyRow.click();
    await propertyAccessSavedPromise;
    Logger.info('[TC36] Steps 12-13: Property assignment saved (user-property-access POST confirmed)');

    await sharedPage.keyboard.press('Escape');
    await expect(propertyDialog, 'Property access dialog must close after assignment').toBeHidden({ timeout: 10_000 });

    // Steps 14-15: read the updated count and assert it increased by exactly 1.
    const updatedAccessText = (await accessCell.innerText()).trim();
    const updatedCount = parseInt(updatedAccessText, 10);
    Logger.info(`[TC36] Step 14: Captured updated property count: "${updatedAccessText}" (${updatedCount})`);
    expect(Number.isNaN(updatedCount), `Updated Access text "${updatedAccessText}" must parse to a valid number`).toBe(false);
    expect(
      updatedCount,
      `Access count must increase by exactly 1 (was ${previousCount}, now ${updatedCount})`,
    ).toBe(previousCount + 1);
    Logger.success(`[TC36] ✅ Property count incremented correctly: ${previousCount} → ${updatedCount}`);

    // Step 16: verify the assignment is genuinely reflected in the UI, not just the count.
    await targetRow.getByRole('button', { name: 'Settings' }).click();
    await expect(propertyDialog, 'Property access dialog must reopen for final verification').toBeVisible({ timeout: 10_000 });
    await propertyDialog.getByPlaceholder('Search by property name or address').fill('Test Property 1');
    const confirmedPropertyRow = propertyDialog.locator('.mantine-Group-root').filter({ hasText: 'Test Property 1' }).first();
    await expect(
      confirmedPropertyRow.getByRole('checkbox'),
      'Assigned property checkbox must be checked',
    ).toBeChecked({ timeout: 10_000 });
    await sharedPage.keyboard.press('Escape');
    await expect(propertyDialog, 'Property access dialog must close').toBeHidden({ timeout: 10_000 });
    Logger.success(`[TC36] ✅ Assignment of "Test Property 1_Cottages on Elm" confirmed reflected in UI for ${targetEmail}`);
  });
});

const ORGANIZATION_WORKSPACE_SCREENSHOT_OPTIONS = {
  animations: 'disabled',
  /** User table rows change during suite (invites); allow modest pixel drift vs golden image. */
  maxDiffPixels: 15_000,
  maxDiffPixelRatio: 0.15,
};

/** Shared assertion: product blocks bad invites via Mantine errors, alerts, native validity, or dialog copy. */
async function expectInviteBlockingFeedback(organizationHelperInstance, sharedTestPage, inviteUserPanel, options = {}) {
  await inviteUserPanel.dialogRoot.getByText('Loading roles').waitFor({ state: 'hidden', timeout: 60_000 }).catch(() => {});
  if (options.malformedEmail) {
    await inviteUserPanel.emailAddressInput.fill(options.malformedEmail);
  }
  // MCP-verified live 2026-07-26: for an empty/malformed email the wizard's Next button stays
  // permanently disabled (client-side format validation gates it) — it never becomes clickable,
  // so that IS the blocking behavior here. Only attempt the click when Next is actually enabled;
  // otherwise a plain .click() would hang waiting for an element that's never going to enable.
  if (await inviteUserPanel.nextOrInvitePrimaryButton.isDisabled().catch(() => false)) {
    return;
  }
  await inviteUserPanel.nextOrInvitePrimaryButton.click();
  await expect(async () => {
    const inviteDialogCopy = (await inviteUserPanel.dialogRoot.innerText()).toLowerCase();
    const mantineInputErrors = await organizationHelperInstance.getInviteDialogInputErrors();
    const notificationOrAlertCount = await sharedTestPage
      .locator('.mantine-Notification-root, [role="alert"]')
      .filter({ hasText: /email|required|invalid/i })
      .count();
    const nativeHtml5Message = await inviteUserPanel.emailAddressInput
      .evaluate((el) => (el instanceof HTMLInputElement ? el.validationMessage : ''))
      .catch(() => '');
    const invalidCopyWithoutNative =
      /invalid|required|valid email|enter an email|must|provide/i.test(inviteDialogCopy);
    return (
      mantineInputErrors.length > 0 ||
      notificationOrAlertCount > 0 ||
      nativeHtml5Message.length > 0 ||
      invalidCopyWithoutNative
    );
  }).toPass({ intervals: [200, 500, 1000], timeout: 15_000 });
}

test.describe('Manage Organization', () => {
  test.beforeEach(async ({}, testInfo) => {
    await organizationHelper.gotoOrganizationWorkspace();
    await applyWorkspaceZoom(sharedPage);
    if (!/TC03-vis-01/.test(testInfo.title)) {
      await organizationHelper.clearOrganizationSearch();
    } else {
      await sharedPage.locator('.mantine-AppShell-main').first().waitFor({ state: 'visible', timeout: 60_000 });
    }
  });

  test('TC28 @regression @organization Empty email: invite blocked or shows validation', async () => {
    Logger.info('[TC28] Starting: empty email invite must be blocked with validation');
    const inviteUserPanel = await organizationHelper.openInvite();
    InteractionLogger.logFormFill('Email', '', false);
    await expectInviteBlockingFeedback(organizationHelper, sharedPage, inviteUserPanel, {});
    Logger.success('[TC28] ✅ Empty email invite correctly blocked');
  });

  test('TC29 @regression @organization invalid email: invite blocked or shows validation', async () => {
    Logger.info('[TC29] Starting: malformed email invite must be blocked with validation');
    const inviteUserPanel = await organizationHelper.openInvite();
    InteractionLogger.logFormFill('Email', 'not-a-valid-email-string', false);
    await expectInviteBlockingFeedback(organizationHelper, sharedPage, inviteUserPanel, {
      malformedEmail: 'not-a-valid-email-string',
    });
    Logger.success('[TC29] ✅ Malformed email invite correctly blocked');
  });

  test('TC30 @regression @organization Cancel closes invite dialog without inviting', async () => {
    Logger.info('[TC30] Starting: Cancel button must close invite dialog');
    const inviteUserPanel = await organizationHelper.openInvite();
    await inviteUserPanel.emailAddressInput.fill(`cancel_flow_${Date.now()}@yopmail.com`);
    await organizationHelper.selectRole(inviteUserPanel.roleSelectTrigger, 'Admin');
    InteractionLogger.logButtonClick('Cancel', organizationFixture.inviteCancelText);
    await inviteUserPanel.dialogRoot.getByRole('button', { name: organizationFixture.inviteCancelText }).click();
    Logger.info('[TC30] Asserting: invite dialog is hidden after Cancel');
    await expect(inviteUserPanel.dialogRoot).toBeHidden({ timeout: 8000 });
    Logger.success('[TC30] ✅ Cancel dismissed invite dialog without inviting');
  });

  test('TC31 @regression @organization Escape dismisses invite dialog', async () => {
    Logger.info('[TC31] Starting: Escape key must dismiss invite dialog');
    const inviteUserPanel = await organizationHelper.openInvite();
    await inviteUserPanel.emailAddressInput.fill(`escape_${Date.now()}@yopmail.com`);
    InteractionLogger.logButtonClick('Escape key', 'Escape');
    await sharedPage.keyboard.press('Escape');
    await sharedPage.waitForTimeout(350);
    if (await inviteUserPanel.dialogRoot.isVisible().catch(() => false)) {
      await sharedPage.keyboard.press('Escape');
      await sharedPage.waitForTimeout(350);
    }
    if (await inviteUserPanel.dialogRoot.isVisible().catch(() => false)) {
      await inviteUserPanel.dialogRoot.getByRole('button', { name: organizationFixture.inviteCancelText }).click();
    }
    Logger.info('[TC31] Asserting: invite dialog is hidden after Escape');
    await expect(inviteUserPanel.dialogRoot).toBeHidden({ timeout: 12_000 });
    Logger.success('[TC31] ✅ Escape dismissed invite dialog');
  });

  test('TC32 @regression @organization Search with no matches shows empty state', async () => {
    const noMatchTerm = `__no_users_match_${Date.now()}__`;
    Logger.info(`[TC32] Starting: search with "${noMatchTerm}" must show empty state`);
    await organizationHelper.search(noMatchTerm);
    Logger.info('[TC32] Asserting: no results shown for unmatched search term');
    await organizationHelper.verifyNoResults();
    Logger.success('[TC32] ✅ Empty search state verified');
  });

  test('TC33 @regression @organization Workspace exposes Invite user action', async () => {
    Logger.info('[TC33] Asserting: Invite user button is visible in organization workspace');
    await expect(sharedPage.getByRole('button', { name: /invite user/i })).toBeVisible({ timeout: 15_000 });
    Logger.success('[TC33] ✅ Invite user button visible in workspace');
  });

  test('TC34 @regression @organization Visual assertions: organization main workspace', async () => {
    Logger.info('[TC34] Starting: visual snapshot of organization main workspace');
    await expect(sharedPage.locator('.mantine-AppShell-main').first()).toHaveScreenshot(
      'organization-main-workspace.png',
      {
        ...ORGANIZATION_WORKSPACE_SCREENSHOT_OPTIONS,
      },
    );
    Logger.success('[TC34] ✅ Organization workspace visual snapshot passed');
  });
});

// ─── Text Agent ───────────────────────────────────────────────────────────────
test.describe('Manage Organization', () => {
  test.setTimeout(120_000);

  test('TC35 @organization @sanity Verify Organization page tabs, search, and user table', async ({ browser }) => {
    const dashboardBase = process.env.DASHBOARD_URL || organizationFixture.dashboardUrl;
    test.skip(!dashboardBase, 'DASHBOARD_URL or fixture dashboard required');
    const orgUrl = new URL('/organization', new URL(dashboardBase).origin).href;
    InteractionLogger.logNavigation(orgUrl, 'Organization workspace — Text Agent');
    const ctx = await browser.newContext({ storageState: 'sessionState.json', viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    try {
      await test.step('STATE 1 | Organization page — full scan of all text elements', async () => {
        await page.goto(orgUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        await healingLocator(orgWorkspaceTabsListStrategies(page)).waitFor({ state: 'visible', timeout: 20_000 });
        // aria-label copy changed to "Search users by name or email" (MCP-verified);
        // match on the unchanged placeholder instead of the old exact aria-label.
        await healingLocator(orgWorkspaceSearchInputStrategies(page)).waitFor({ state: 'visible', timeout: 20_000 });

        const snapshot = await LoginPage.scanAllTextElements(page);
        const failures = LoginPage.logAndAssertSnapshot(snapshot, 'org-workspace');

        const visibleButtons = snapshot.buttons.filter((b) => b.visible);
        expect(visibleButtons.length, `FAIL [org-workspace]: No visible buttons found`).toBeGreaterThan(0);
        visibleButtons.forEach((btn, i) => {
          const hasText = (btn.text && btn.text.trim().length > 0) || (btn.ariaLabel && btn.ariaLabel.trim().length > 0);
          expect(hasText, `FAIL [org-workspace]: Button[${i}] has no text or aria-label. Button: ${JSON.stringify(btn)}`).toBe(true);
        });

        const visibleInputs = snapshot.inputs.filter((inp) => inp.visible);
        expect(visibleInputs.length, `FAIL [org-workspace]: No fully-visible inputs found. All: ${JSON.stringify(snapshot.inputs)}`).toBeGreaterThan(0);

        expect(failures, `FAIL [org-workspace]: ${failures.length} accessibility issue(s):\n${failures.join('\n')}`).toHaveLength(0);
      });

      await test.step('STATE 1b | Known CTAs and labels — MCP-verified 2026-05-18', async () => {
        InteractionLogger.logNavigation(orgUrl, 'Breadcrumb: Organization');
        await expect(healingLocator(orgWorkspaceBreadcrumbStrategies(page))).toBeVisible({ timeout: 8_000 });

        for (const tabName of ['Users', 'Property access']) {
          InteractionLogger.logVisibility(`${tabName} tab`, true);
          await expect(healingLocator(orgWorkspaceTabStrategies(page, tabName))).toBeVisible({ timeout: 8_000 });
        }

        InteractionLogger.logButtonClick('Invite user', 'Invite user');
        await expect(healingLocator(orgWorkspaceInviteButtonStrategies(page))).toBeVisible({ timeout: 8_000 });

        InteractionLogger.logVisibility('Search by name or e-mail input', true);
        await expect(healingLocator(orgWorkspaceSearchInputStrategies(page))).toBeVisible({ timeout: 8_000 });

        // MCP-verified live 2026-07-26 — current columns are Name, Email, Status, Role,
        // Property access, Actions (replaced the older User / Roles / Last active columns).
        for (const col of ['Email', 'Status', 'Role']) {
          InteractionLogger.logVisibility(`Column: ${col}`, true);
          await expect(healingLocator(orgWorkspaceColumnHeaderStrategies(page, col))).toBeVisible({ timeout: 8_000 });
        }
      });
    } finally {
      await ctx.close();
    }
  });
});
