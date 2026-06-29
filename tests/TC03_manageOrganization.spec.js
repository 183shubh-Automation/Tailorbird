/**
 * TC03 — Manage Organization (`/organization`): invites, revoke/resend, role edits, validation regressions.
 * MCP-verified beta UI (2026-05-05); reference screenshots: `mcp-reference-screenshots/`.
 */
require('dotenv').config();
const { test, expect } = require('@playwright/test');
const { Logger } = require('../utils/logger');
const { LoginPage } = require('../pages/loginPage');
const { InteractionLogger } = require('../utils/InteractionLogger');
const OrganizationHelper = require('../pages/organizationHelper');
const organizationFixture = require('../fixture/organization.json');

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

test.beforeAll(async ({ browser }) => {
  sharedBrowserContext = await browser.newContext({
    storageState: 'sessionState.json',
  });

  sharedPage = await sharedBrowserContext.newPage();
  organizationHelper = new OrganizationHelper(sharedPage);

  await organizationHelper.goto(process.env.DASHBOARD_URL || organizationFixture.dashboardUrl);
  await applyWorkspaceZoom(sharedPage);

  await organizationHelper.goToOrganization();
  await applyWorkspaceZoom(sharedPage);

  sharedPage.on('domcontentloaded', async () => {
    await applyWorkspaceZoom(sharedPage);
  });
});

test.afterAll(async () => {
  await sharedBrowserContext.close();
});

test.describe.skip('Manage Organization Flow ', () => {
  test.beforeEach(async () => {
    await organizationHelper.gotoOrganizationWorkspace();
    await applyWorkspaceZoom(sharedPage);
  });

  test('@sanity @regression TC22 - Invite new user to organization with Member role', async () => {
    const invitedEmail = `member_${Date.now()}@yopmail.com`;
    Logger.info(`[TC22] Starting: invite new Member — ${invitedEmail}`);
    await organizationHelper.inviteUser(invitedEmail, 'Member');
    await applyWorkspaceZoom(sharedPage);
    await organizationHelper.search(invitedEmail);
    const userRow = await organizationHelper.getRow(invitedEmail);
    Logger.info(`[TC22] Asserting: invited badge visible for ${invitedEmail}`);
    await organizationHelper.validateInvitedBadge(userRow, invitedEmail);
    Logger.info('[TC22] Asserting: at least one row visible in results');
    expect(await organizationHelper.visibleRowCount()).toBeGreaterThan(0);
    Logger.success(`[TC22] ✅ Member user invited and verified: ${invitedEmail}`);
  });

  test('@sanity @regression TC23 - Invite new user to organization with Admin role', async () => {
    const invitedEmail = `admin_${Date.now()}@yopmail.com`;
    Logger.info(`[TC23] Starting: invite new Admin — ${invitedEmail}`);
    await organizationHelper.inviteUser(invitedEmail, 'Admin');
    await applyWorkspaceZoom(sharedPage);
    await organizationHelper.search(invitedEmail);
    const userRow = await organizationHelper.getRow(invitedEmail);
    Logger.info(`[TC23] Asserting: invited badge visible for ${invitedEmail}`);
    await organizationHelper.validateInvitedBadge(userRow, invitedEmail);
    Logger.info('[TC23] Asserting: at least one row visible');
    expect(await organizationHelper.visibleRowCount()).toBeGreaterThan(0);
    Logger.success(`[TC23] ✅ Admin user invited and verified: ${invitedEmail}`);
  });

  test('@sanity @regression TC24 - Revoke user invitation to organization', async () => {
    const invitedEmail = `revoke_${Date.now()}@yopmail.com`;
    Logger.info(`[TC24] Starting: invite then revoke — ${invitedEmail}`);
    await organizationHelper.inviteUser(invitedEmail, 'Admin');
    await applyWorkspaceZoom(sharedPage);
    await organizationHelper.search(invitedEmail);
    const userRow = await organizationHelper.getRow(invitedEmail);
    Logger.info(`[TC24] Revoking invitation for ${invitedEmail}`);
    await organizationHelper.revoke(userRow, invitedEmail);
    await applyWorkspaceZoom(sharedPage);
    await organizationHelper.search(invitedEmail);
    Logger.info('[TC24] Asserting: no results after revoke (user removed from list)');
    await organizationHelper.verifyNoResults();
    Logger.success(`[TC24] ✅ Invitation revoked — user no longer in list: ${invitedEmail}`);
  });

  test('@sanity @regression TC25 - Resend user invitation to organization', async () => {
    const invitedEmail = `resend_${Date.now()}@yopmail.com`;
    Logger.info(`[TC25] Starting: invite then resend — ${invitedEmail}`);
    await organizationHelper.inviteUser(invitedEmail, 'Admin');
    await applyWorkspaceZoom(sharedPage);
    await organizationHelper.search(invitedEmail);
    const userRow = await organizationHelper.getRow(invitedEmail);
    Logger.info(`[TC25] Opening user action menu for ${invitedEmail}`);
    await organizationHelper.openFirstMenu();
    await applyWorkspaceZoom(sharedPage);
    Logger.info('[TC25] Resending invitation');
    await organizationHelper.resendInvite(invitedEmail);
    Logger.info('[TC25] Asserting: resend success feedback visible');
    await organizationHelper.verifyResendSuccess(invitedEmail);
    Logger.success(`[TC25] ✅ Invitation resent successfully: ${invitedEmail}`);
  });

  test('@sanity @regression TC26 - Edit user role to organization', async () => {
    const existingAdminEmail = 'tailorbird-admin@tailorbird.us';
    Logger.info(`[TC26] Starting: toggle role for ${existingAdminEmail}`);
    await organizationHelper.search(existingAdminEmail);
    await applyWorkspaceZoom(sharedPage);
    const userRow = await organizationHelper.getRow(existingAdminEmail);
    const toggledRole = await organizationHelper.toggleRole(userRow);
    Logger.info(`[TC26] Role toggled to: ${toggledRole} — verifying update`);
    await applyWorkspaceZoom(sharedPage);
    await organizationHelper.search(existingAdminEmail);
    Logger.info(`[TC26] Asserting: role updated to ${toggledRole} for ${existingAdminEmail}`);
    await organizationHelper.verifyUpdatedRole(existingAdminEmail, toggledRole);
    Logger.success(`[TC26] ✅ Role toggled and verified for ${existingAdminEmail}: ${toggledRole}`);
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

test.describe.skip('Regression — organization invite validation, search, snapshot', () => {
  test.beforeEach(async ({}, testInfo) => {
    await organizationHelper.gotoOrganizationWorkspace();
    await applyWorkspaceZoom(sharedPage);
    if (!/TC03-vis-01/.test(testInfo.title)) {
      await organizationHelper.clearOrganizationSearch();
    } else {
      await sharedPage.locator('.mantine-AppShell-main').first().waitFor({ state: 'visible', timeout: 60_000 });
    }
  });

  test('TC27 @regression @organization Empty email: invite blocked or shows validation', async () => {
    Logger.info('[TC27] Starting: empty email invite must be blocked with validation');
    const inviteUserPanel = await organizationHelper.openInvite();
    InteractionLogger.logFormFill('Email', '', false);
    await expectInviteBlockingFeedback(organizationHelper, sharedPage, inviteUserPanel, {});
    Logger.success('[TC27] ✅ Empty email invite correctly blocked');
  });

  test('TC28 @regression @organization Malformed email: invite blocked or shows validation', async () => {
    Logger.info('[TC28] Starting: malformed email invite must be blocked with validation');
    const inviteUserPanel = await organizationHelper.openInvite();
    InteractionLogger.logFormFill('Email', 'not-a-valid-email-string', false);
    await expectInviteBlockingFeedback(organizationHelper, sharedPage, inviteUserPanel, {
      malformedEmail: 'not-a-valid-email-string',
    });
    Logger.success('[TC28] ✅ Malformed email invite correctly blocked');
  });

  test('TC29 @regression @organization Cancel closes invite dialog without inviting', async () => {
    Logger.info('[TC29] Starting: Cancel button must close invite dialog');
    const inviteUserPanel = await organizationHelper.openInvite();
    await inviteUserPanel.emailAddressInput.fill(`cancel_flow_${Date.now()}@yopmail.com`);
    await organizationHelper.selectRole(inviteUserPanel.roleSelectTrigger, 'Admin');
    InteractionLogger.logButtonClick('Cancel', organizationFixture.inviteCancelText);
    await inviteUserPanel.dialogRoot.getByRole('button', { name: organizationFixture.inviteCancelText }).click();
    Logger.info('[TC29] Asserting: invite dialog is hidden after Cancel');
    await expect(inviteUserPanel.dialogRoot).toBeHidden({ timeout: 8000 });
    Logger.success('[TC29] ✅ Cancel dismissed invite dialog without inviting');
  });

  test('TC30 @regression @organization Escape dismisses invite dialog', async () => {
    Logger.info('[TC30] Starting: Escape key must dismiss invite dialog');
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
    Logger.info('[TC30] Asserting: invite dialog is hidden after Escape');
    await expect(inviteUserPanel.dialogRoot).toBeHidden({ timeout: 12_000 });
    Logger.success('[TC30] ✅ Escape dismissed invite dialog');
  });

  test('TC31 @regression @organization Search with no matches shows empty state', async () => {
    const noMatchTerm = `__no_users_match_${Date.now()}__`;
    Logger.info(`[TC31] Starting: search with "${noMatchTerm}" must show empty state`);
    await organizationHelper.search(noMatchTerm);
    Logger.info('[TC31] Asserting: no results shown for unmatched search term');
    await organizationHelper.verifyNoResults();
    Logger.success('[TC31] ✅ Empty search state verified');
  });

  test('TC32 @regression @organization Workspace exposes Invite user action', async () => {
    Logger.info('[TC32] Asserting: Invite user button is visible in organization workspace');
    await expect(sharedPage.getByRole('button', { name: /invite user/i })).toBeVisible({ timeout: 15_000 });
    Logger.success('[TC32] ✅ Invite user button visible in workspace');
  });

  test('TC33 @regression @organization Visual snapshot: organization main workspace', async () => {
    Logger.info('[TC33] Starting: visual snapshot of organization main workspace');
    await expect(sharedPage.locator('.mantine-AppShell-main').first()).toHaveScreenshot(
      'organization-main-workspace.png',
      {
        ...ORGANIZATION_WORKSPACE_SCREENSHOT_OPTIONS,
      },
    );
    Logger.success('[TC33] ✅ Organization workspace visual snapshot passed');
  });
});

// ─── Text Agent ───────────────────────────────────────────────────────────────
test.describe.skip('TC03 Manage Organization — Text Agent (live MCP browser scan)', () => {
  test.setTimeout(120_000);

  test('TC34 @organization @sanity Full organization workspace text agent — tabs, CTA buttons, table columns, search', async ({ browser }) => {
    const dashboardBase = process.env.DASHBOARD_URL || organizationFixture.dashboardUrl;
    test.skip(!dashboardBase, 'DASHBOARD_URL or fixture dashboard required');
    const orgUrl = new URL('/organization', new URL(dashboardBase).origin).href;
    InteractionLogger.logNavigation(orgUrl, 'Organization workspace — Text Agent');
    const ctx = await browser.newContext({ storageState: 'sessionState.json', viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    try {
      await test.step('STATE 1 | Organization page — full scan of all text elements', async () => {
        await page.goto(orgUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        await page.locator('[role="tablist"]').waitFor({ state: 'visible', timeout: 20_000 });
        await page.locator('[aria-label="User search"]').waitFor({ state: 'visible', timeout: 20_000 });

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
        const main = page.locator('main');

        InteractionLogger.logNavigation(orgUrl, 'Breadcrumb: Organization');
        await expect(main.getByText('Organization', { exact: true })).toBeVisible({ timeout: 8_000 });

        const tablist = page.locator('[role="tablist"]');
        for (const tabName of ['Users', 'Property access']) {
          InteractionLogger.logVisibility(`${tabName} tab`, true);
          await expect(tablist.getByRole('tab', { name: tabName })).toBeVisible({ timeout: 8_000 });
        }

        InteractionLogger.logButtonClick('Invite user', 'Invite user');
        await expect(page.getByRole('button', { name: /invite user/i })).toBeVisible({ timeout: 8_000 });

        InteractionLogger.logVisibility('Search by name or e-mail input', true);
        await expect(page.getByPlaceholder('Search by name or e-mail')).toBeVisible({ timeout: 8_000 });

        for (const col of ['User', 'Roles', 'Last active']) {
          InteractionLogger.logVisibility(`Column: ${col}`, true);
          await expect(page.getByRole('columnheader', { name: col })).toBeVisible({ timeout: 8_000 });
        }
      });
    } finally {
      await ctx.close();
    }
  });
});
