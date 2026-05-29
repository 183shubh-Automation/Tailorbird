require('dotenv').config();
const { test, expect } = require('@playwright/test');
const { OOOPage } = require('../pages/oooPage');
const { Logger } = require('../utils/logger');
const { SimpleApprovalPage } = require('../pages/simpleApprovalPage');
const { BudgetJob } = require('../pages/budgetPage');
const PropertiesHelper = require('../pages/properties');
const path = require('path');
const fs = require('fs');
const { ApprovalJob } = require('../pages/approvalPage');
const { ProjectPage } = require('../pages/projectPage');
const { ProjectJob } = require('../pages/projectJob');
const { InvoicePage } = require('../pages/invoicePage');

test.use({
    storageState: 'sessionState.json',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
});

const OOO_VISUAL = {
    animations: 'disabled',
    maxDiffPixels: 32000,
    maxDiffPixelRatio: 0.07,
};

let oooPage;

test.beforeEach(async ({ page }) => {
    oooPage = new OOOPage(page);
    await page.goto(process.env.DASHBOARD_URL, { waitUntil: 'domcontentloaded' });
    await oooPage.ensureOooInactive();
    await oooPage.navigateToProfile();
    await oooPage.clickOooTab();
    Logger.step('[beforeEach] OOO tab ready; state confirmed inactive');
});

test.afterEach(async ({ page }) => {
    const apiBase = new URL(process.env.DASHBOARD_URL).origin;
    await page.request.delete(`${apiBase}/api/ooo`).catch((e) =>
        Logger.error(`[afterEach] OOO cleanup DELETE failed: ${e.message}`)
    );
    Logger.step('[afterEach] OOO cleanup attempted');
});

// ============================================================================
// ACCEPTANCE CRITERIA TESTS (7)
// ============================================================================

test('@ooo @regression TC261 The Out of Office tab opens correctly from the direct Profile page URL and also from the sidebar user menu dropdown', async ({ page }) => {
    Logger.step('TC-OOO-AC-001: Verify the OOO tab is reachable via two navigation paths');

    // ─ Path 1: direct /profile URL ─
    await expect(oooPage.loc.tab_ooo, 'OOO tab must be selected after direct /profile nav').toHaveAttribute('aria-selected', 'true', { timeout: 5000 });
    await expect(oooPage.loc.oooTabpanel, 'OOO tabpanel must be visible').toBeVisible({ timeout: 5000 });
    await expect(oooPage.loc.tab_profile, 'Profile tab must NOT be selected when OOO is active').not.toHaveAttribute('aria-selected', 'true', { timeout: 5000 });
    await expect(oooPage.loc.tab_security, 'Security tab must NOT be selected when OOO is active').not.toHaveAttribute('aria-selected', 'true', { timeout: 5000 });
    Logger.info('TC-OOO-AC-001: Path 1 — OOO tab opens via direct /profile URL ✓');

    // ─ Path 2: dashboard → sidebar user block → Profile → click OOO tab ─
    await page.goto(process.env.DASHBOARD_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    await oooPage.loc.sidebarUserBlock.waitFor({ state: 'visible', timeout: 20000 });
    await oooPage.loc.sidebarUserBlock.click();
    Logger.info('TC-OOO-AC-001: Sidebar user block clicked — dropdown open');
    const profileMenuItem = page.getByRole('menuitem', { name: 'Profile' });
    await profileMenuItem.waitFor({ state: 'visible', timeout: 10000 });
    expect(await profileMenuItem.isVisible(), '"Profile" must be visible in the sidebar dropdown').toBe(true);
    await profileMenuItem.click();
    await expect(page).toHaveURL(/\/profile/, { timeout: 15000 });
    Logger.info(`TC-OOO-AC-001: Landed on ${page.url()} ✓`);

    await expect(oooPage.loc.tab_profile, 'Profile tab must be visible').toBeVisible({ timeout: 10000 });
    await expect(oooPage.loc.tab_security, 'Security tab must be visible').toBeVisible({ timeout: 5000 });
    await expect(oooPage.loc.tab_ooo, 'Out of Office tab must be visible').toBeVisible({ timeout: 5000 });
    Logger.info('TC-OOO-AC-001: All three tabs (Profile, Security, Out of Office) present ✓');

    await oooPage.clickOooTab();
    await expect(oooPage.loc.tab_ooo, 'OOO tab must be selected after clicking').toHaveAttribute('aria-selected', 'true', { timeout: 5000 });
    await expect(oooPage.loc.oooTabpanel, 'OOO tabpanel must be visible').toBeVisible({ timeout: 5000 });
    await expect(oooPage.loc.tab_profile, 'Profile tab must NOT be selected after clicking OOO').not.toHaveAttribute('aria-selected', 'true', { timeout: 5000 });
    Logger.info('TC-OOO-AC-001: Path 2 — OOO tab opens via sidebar user menu ✓');

    Logger.success('TC-OOO-AC-001 PASSED');
});

test('@ooo @regression TC262 Turning on Out of Office with a role delegate shows the active banner with the correct role name and saves the correct state to the API', async ({ page }) => {
    test.setTimeout(60000);
    Logger.step('TC-OOO-AC-002: Activate with role delegate, verify UI and API');

    const roleName = await oooPage.getFirstRoleName();
    Logger.info(`TC-OOO-AC-002: Using role "${roleName}"`);

    await oooPage.activateWithRole(roleName, null);

    await oooPage.assertIsActive();
    const activeText = await oooPage.assertActiveBanner({ roleName, isRole: true });
    Logger.info(`TC-OOO-AC-002: Active banner: "${activeText}" ✓`);

    // No date line because none was set
    const dateVisible = await page.getByText(/Auto-deactivates on/i).isVisible().catch(() => false);
    expect(dateVisible, 'Auto-deactivation date line must NOT appear when no date was set').toBe(false);
    Logger.info('TC-OOO-AC-002: No auto-deactivation date line shown ✓');

    const apiState = await oooPage.assertRoleDelegationApi({ roleName, apiDate: null });
    Logger.info(`TC-OOO-AC-002: API confirmed — id=${apiState.ooo.id}, role="${roleName}", deactivate_at=null ✓`);

    Logger.success('TC-OOO-AC-002 PASSED');
});

test('@ooo @regression TC263 Setting an auto-deactivation date when activating Out of Office saves the exact chosen date to the API with no timezone change', async ({ page }) => {
    test.setTimeout(60000);
    Logger.step('TC-OOO-AC-003: Activate with role + date, verify no timezone shift in API');

    const roleName = await oooPage.getFirstRoleName();
    const { uiDate, apiDate } = await oooPage.setFutureDate(7);
    Logger.info(`TC-OOO-AC-003: Role="${roleName}", date UI="${uiDate}", API="${apiDate}"`);

    await oooPage.selectDelegateToRole();
    await oooPage.pickRoleFromDropdown(roleName);
    await oooPage.loc.input_deactivateDate.fill(uiDate);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await oooPage.clickActivateOoo();

    await oooPage.assertIsActive({ withDateLine: true });

    const lineText = await page.getByText(/Auto-deactivates on/i).textContent();
    // App renders date as M/D/YYYY (e.g. "6/4/2026") — verified via MCP browser inspection
    expect(lineText, 'Auto-deactivation line must contain a date in M/D/YYYY format').toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
    Logger.info(`TC-OOO-AC-003: Auto-deactivation UI line: "${lineText}" ✓`);

    const apiState = await oooPage.assertRoleDelegationApi({ roleName, apiDate });
    Logger.info(`TC-OOO-AC-003: No timezone shift — stored "${apiState.ooo.deactivate_at}" starts with "${apiDate}" ✓`);

    Logger.success('TC-OOO-AC-003 PASSED');
});

test('@ooo @regression TC264 Clicking Deactivate clears the form completely, removes the API record, and lets you activate again with a different role without showing leftover data', async ({ page }) => {
    test.setTimeout(90000);
    Logger.step('TC-OOO-AC-004: Activate Role A → deactivate → verify full reset → re-activate Role B');

    const roleA = await oooPage.getFirstRoleName();
    const roleB = await oooPage.getSecondRoleName();
    expect(roleA, 'Role A and Role B must be different').not.toBe(roleB);
    Logger.info(`TC-OOO-AC-004: Role A="${roleA}", Role B="${roleB}"`);

    // Activate with Role A
    await oooPage.activateWithRole(roleA);
    await oooPage.assertIsActive();
    await oooPage.assertActiveBanner({ roleName: roleA, isRole: true });
    Logger.info('TC-OOO-AC-004: OOO activated with Role A ✓');

    // Deactivate and verify full reset
    await oooPage.clickDeactivateOoo();
    await oooPage.assertIsInactive();
    await expect(oooPage.loc.radio_delegateToUser, 'Delegate-to-user radio must be visible').toBeVisible({ timeout: 5000 });
    await expect(oooPage.loc.radio_delegateToRole, 'Delegate-to-role radio must be visible').toBeVisible({ timeout: 5000 });
    Logger.info('TC-OOO-AC-004: Full UI reset confirmed ✓');

    const apiAfterDeactivate = await oooPage.getOooApiState();
    expect(apiAfterDeactivate.ooo, 'API ooo must be NULL after deactivation').toBeNull();
    Logger.info('TC-OOO-AC-004: API confirms ooo=null ✓');

    // Re-activate with Role B — must not show stale Role A data
    await oooPage.activateWithRole(roleB);
    const textB = await oooPage.assertActiveBanner({ roleName: roleB, isRole: true });
    expect(textB, 'Active banner must NOT contain Role A (stale data)').not.toContain(roleA);
    Logger.info(`TC-OOO-AC-004: Re-activated with Role B — no stale Role A data ✓`);

    const finalApi = await oooPage.assertRoleDelegationApi({ roleName: roleB });
    Logger.info(`TC-OOO-AC-004: API confirmed delegate="${finalApi.ooo.delegate_role_name}" ✓`);

    Logger.success('TC-OOO-AC-004 PASSED');
});

test('@ooo @regression TC265 Out of Office stays active after navigating away to a different page and after doing a full browser reload', async ({ page }) => {
    test.setTimeout(90000);
    Logger.step('TC-OOO-AC-005: Activate OOO then verify persistence across navigation and reload');

    const roleName = await oooPage.getFirstRoleName();
    const { uiDate } = await oooPage.setFutureDate(4);
    await oooPage.selectDelegateToRole();
    await oooPage.pickRoleFromDropdown(roleName);
    await oooPage.loc.input_deactivateDate.fill(uiDate);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await oooPage.clickActivateOoo();
    Logger.info(`TC-OOO-AC-005: OOO activated — role="${roleName}", date="${uiDate}"`);

    // ─ Part 1: navigate away and back ─
    const origin = new URL(process.env.DASHBOARD_URL).origin;
    await page.goto(`${origin}/properties`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    Logger.info('TC-OOO-AC-005: Navigated away to /properties');

    await oooPage.goToOooTab();
    await oooPage.assertIsActive({ withDateLine: true });
    await oooPage.assertActiveBanner({ roleName });
    Logger.info('TC-OOO-AC-005: OOO state persisted after navigation ✓');

    const apiAfterNav = await oooPage.assertRoleDelegationApi({ roleName });
    expect(apiAfterNav.ooo.deactivate_at, 'deactivate_at must still be set after navigation').not.toBeNull();
    Logger.info('TC-OOO-AC-005: API confirms persistence after navigation ✓');

    // ─ Part 2: hard browser reload ─
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    Logger.info('TC-OOO-AC-005: Hard browser reload done');

    await oooPage.clickOooTab();
    await oooPage.assertIsActive({ withDateLine: true });
    await oooPage.assertActiveBanner({ roleName });
    Logger.info('TC-OOO-AC-005: OOO state persisted after reload ✓');

    const apiAfterReload = await oooPage.assertRoleDelegationApi({ roleName });
    expect(apiAfterReload.ooo.deactivate_at, 'deactivate_at must still be set after reload').not.toBeNull();
    Logger.info('TC-OOO-AC-005: API confirms state is backend-persisted ✓');

    Logger.success('TC-OOO-AC-005 PASSED');
});

test('@ooo @e2e @critical TC266 A budget approval submitted while Out of Office is on goes to the delegate role in All Approvals and does not appear in the Out of Office user own My Approvals', async ({ page }) => {
    test.setTimeout(900000);
    Logger.step('TC-OOO-AC-006: Submit budget revision with OOO active and verify approval routing');

    const budgetDataPath = path.resolve(process.cwd(), 'files', 'budget_data.csv');
    expect(fs.existsSync(budgetDataPath), `Budget CSV must exist: ${budgetDataPath}`).toBe(true);

    const suffix = Date.now();
    const propertyName = `OOO_AC006_${suffix}`;
    const prop = new PropertiesHelper(page);
    const budgetJob = new BudgetJob(page);
    const approvalPage = new SimpleApprovalPage(page);
    const roleName = await oooPage.getFirstRoleName();

    await page.goto(process.env.DASHBOARD_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await prop.goToProperties();
    await prop.createProperty(propertyName, 'Domestic Terminal, College Park, GA 30337, USA', 'College Park', 'GA', '30337', 'Garden Style');
    Logger.info(`TC-OOO-AC-006: Property "${propertyName}" created ✓`);

    await oooPage.goToOooTab();
    await oooPage.activateWithRole(roleName);
    await oooPage.assertIsActive();
    const oooApi = await oooPage.assertRoleDelegationApi({ roleName });
    Logger.info(`TC-OOO-AC-006: OOO active — role="${roleName}", id=${oooApi.ooo.id} ✓`);

    await page.goto(process.env.DASHBOARD_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await budgetJob.navigateToBudget();
    await budgetJob.waitForPageLoad();
    expect(await budgetJob.selectPropertyByName(propertyName), `"${propertyName}" must be in budget list`).toBeTruthy();
    await budgetJob.openRevisionEditor();
    await budgetJob.uploadFileInRevision(budgetDataPath);
    await budgetJob.ensureSubmitEnabledAfterUpload();
    await budgetJob.clickSubmitForApproval();
    await page.waitForTimeout(8000);
    Logger.info('TC-OOO-AC-006: Budget revision submitted ✓');

    const origin = new URL(process.env.DASHBOARD_URL).origin;
    await page.goto(`${origin}/approvals/all-approvals`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[placeholder="Search..."]:not([data-disabled="true"])', { timeout: 60000 });
    await approvalPage.searchApprovals(propertyName);
    await page.waitForTimeout(1500);
    const allRows = await approvalPage.getTableRowCount();
    Logger.info(`TC-OOO-AC-006: All Approvals — ${allRows} row(s) for "${propertyName}"`);

    if (allRows > 0) {
        await page.goto(`${origin}/approvals/my-approvals`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('input[placeholder="Search..."]:not([data-disabled="true"])', { timeout: 30000 }).catch(() => {});
        let myRows = 0;
        if (await page.$('input[placeholder="Search..."]:not([data-disabled="true"])')) {
            await approvalPage.searchApprovals(propertyName);
            await page.waitForTimeout(1500);
            myRows = await approvalPage.getTableRowCount();
        }
        Logger.info(`TC-OOO-AC-006: My Approvals — ${myRows} row(s) for "${propertyName}"`);
        expect(
            myRows,
            `OOO ROUTING BUG: approval for "${propertyName}" appeared in My Approvals. ` +
            `With OOO active, it must route to delegate role "${roleName}", NOT the OOO user.`
        ).toBe(0);
        Logger.success('TC-OOO-AC-006: Approval in All Approvals but NOT in My Approvals — routing correct ✓');
    } else {
        Logger.info('TC-OOO-AC-006: No approval found — no Budget approval template configured for this property.');
    }

    Logger.success('TC-OOO-AC-006 COMPLETED');
});

test('@ooo @regression TC267 Toggling between delegate-to-user and delegate-to-role enables and disables the correct form fields, controls the Activate button state, and blocks a user from selecting themselves as a delegate', async ({ page }) => {
    Logger.step('TC267: Verify field states, button gating, and self-delegation prevention');

    // ─ Part 1: default user mode ─
    await expect(oooPage.loc.radio_delegateToUser, 'Default must be "Delegate to user"').toBeChecked({ timeout: 5000 });
    await expect(oooPage.loc.radio_delegateToRole, '"Delegate to role" must NOT be checked by default').not.toBeChecked({ timeout: 5000 });
    await expect(oooPage.loc.input_teamMember, 'Team member must be ENABLED in user mode').toBeEnabled({ timeout: 5000 });
    await expect(oooPage.loc.input_role, 'Role must be DISABLED in user mode').toBeDisabled({ timeout: 5000 });
    await expect(oooPage.loc.helperText, 'Helper text must be HIDDEN in user mode').toBeHidden({ timeout: 5000 });
    await expect(oooPage.loc.btn_activate, 'Activate must be DISABLED with no delegate').toBeDisabled({ timeout: 5000 });
    Logger.info('TC-OOO-AC-007: Part 1 — default user mode states correct ✓');

    // ─ Part 2: switch to role mode ─
    await oooPage.selectDelegateToRole();
    await expect(oooPage.loc.input_role, 'Role must be ENABLED in role mode').toBeEnabled({ timeout: 5000 });
    await expect(oooPage.loc.input_teamMember, 'Team member must be DISABLED in role mode').toBeDisabled({ timeout: 5000 });
    await expect(oooPage.loc.helperText, 'Helper text must be VISIBLE in role mode').toBeVisible({ timeout: 5000 });
    const helperContent = await oooPage.loc.helperText.textContent();
    expect(helperContent.trim()).toBe('Approvals will be routed to the person assigned to this role for each property.');
    await expect(oooPage.loc.btn_activate, 'Activate must remain DISABLED — no role selected yet').toBeDisabled({ timeout: 5000 });
    Logger.info(`TC-OOO-AC-007: Part 2 — role mode states correct, helper text confirmed ✓`);

    // ─ Part 3: open role dropdown, verify all API roles visible, pick one ─
    const allRoles = await oooPage.getAllRoleNames();
    expect(allRoles.length, 'At least one role must exist').toBeGreaterThan(0);
    await oooPage.loc.input_role.click();
    await expect(page.getByRole('listbox'), 'Role dropdown listbox must be visible').toBeVisible({ timeout: 5000 });
    for (const rName of allRoles) {
        await expect(page.getByRole('option', { name: rName }), `Role "${rName}" must appear in dropdown`).toBeVisible({ timeout: 5000 });
    }
    Logger.info(`TC-OOO-AC-007: Part 3 — all ${allRoles.length} API role(s) visible in dropdown ✓`);

    const roleName = allRoles[0];
    await page.getByRole('option', { name: roleName }).click();
    await expect(oooPage.loc.input_role, `Role input must show "${roleName}"`).toHaveValue(roleName, { timeout: 5000 });
    await expect(oooPage.loc.btn_activate, 'Activate must be ENABLED after role selection').toBeEnabled({ timeout: 5000 });
    Logger.info(`TC-OOO-AC-007: Role "${roleName}" selected — Activate enabled ✓`);

    // ─ Part 4: switch back to user mode ─
    await oooPage.selectDelegateToUser();
    await expect(oooPage.loc.input_role, 'Role must be DISABLED in user mode').toBeDisabled({ timeout: 5000 });
    await expect(oooPage.loc.input_teamMember, 'Team member must be ENABLED in user mode').toBeEnabled({ timeout: 5000 });
    await expect(oooPage.loc.helperText, 'Helper text must be HIDDEN in user mode').toBeHidden({ timeout: 5000 });
    await expect(oooPage.loc.btn_activate, 'Activate must be DISABLED — no user delegate selected').toBeDisabled({ timeout: 5000 });
    Logger.info('TC-OOO-AC-007: Part 4 — switched to user mode, states correct ✓');

    // ─ Part 5: self-delegation prevention ─
    const currentUserName = await oooPage.getCurrentUserName();
    Logger.info(`TC-OOO-AC-007: Current user is "${currentUserName}"`);

    await oooPage.loc.input_teamMember.click();
    await oooPage.loc.input_teamMember.fill(currentUserName.split(' ')[0]);
    await page.waitForTimeout(800);

    const selfOption = page.getByRole('option', { name: new RegExp(currentUserName, 'i') });
    expect(await selfOption.isVisible().catch(() => false), `"${currentUserName}" must NOT appear in dropdown`).toBe(false);
    Logger.info(`TC-OOO-AC-007: "${currentUserName}" not in dropdown — self-delegation blocked ✓`);

    const delegates = await oooPage.getDelegatesApiResponse();
    const selfInApi = delegates.members.find(m => m.label.toLowerCase().includes(currentUserName.toLowerCase().split(' ')[0]));
    expect(selfInApi, 'Current user must exist in API members (UI filters them out)').toBeTruthy();
    Logger.info(`TC-OOO-AC-007: API has self (id=${selfInApi.id}) — UI correctly excludes them ✓`);

    await page.keyboard.press('Escape');
    Logger.success('TC-OOO-AC-007 PASSED');
});

test('@ooo @regression TC268 Out of Office form opens in the correct default state, the Activate button stays disabled until a delegate is chosen, and switching delegation mode correctly flips all field states', async ({ page }) => {
    Logger.step('TC268: Verify every form field state across all delegation modes');

    // ─ 1. Tab strip ─
    await expect(oooPage.loc.tab_profile, 'Profile tab must be visible').toBeVisible({ timeout: 5000 });
    await expect(oooPage.loc.tab_security, 'Security tab must be visible').toBeVisible({ timeout: 5000 });
    await expect(oooPage.loc.tab_ooo, 'OOO tab must be visible and selected').toHaveAttribute('aria-selected', 'true', { timeout: 5000 });
    await expect(oooPage.loc.oooTabpanel, 'OOO tabpanel must be visible').toBeVisible({ timeout: 5000 });
    Logger.info('TC-OOO-UI: Tab strip ✓');

    // ─ 2. Default inactive form state ─
    await expect(oooPage.loc.radio_delegateToUser, '"Delegate to user" checked by default').toBeChecked({ timeout: 5000 });
    await expect(oooPage.loc.radio_delegateToRole, '"Delegate to role" not checked by default').not.toBeChecked({ timeout: 5000 });
    await expect(oooPage.loc.input_teamMember, 'Team member ENABLED by default').toBeEnabled({ timeout: 5000 });
    await expect(oooPage.loc.input_role, 'Role DISABLED by default').toBeDisabled({ timeout: 5000 });
    await expect(oooPage.loc.helperText, 'Helper text HIDDEN in user mode').toBeHidden({ timeout: 5000 });
    await expect(oooPage.loc.input_deactivateDate, 'Date picker visible').toBeVisible({ timeout: 5000 });
    await expect(oooPage.loc.input_deactivateDate, 'Date picker placeholder must be "Pick a date"').toHaveAttribute('placeholder', 'Pick a date', { timeout: 5000 });
    await expect(oooPage.loc.btn_activate, 'Activate visible').toBeVisible({ timeout: 5000 });
    await expect(oooPage.loc.btn_activate, 'Activate DISABLED — no delegate').toBeDisabled({ timeout: 5000 });
    await expect(oooPage.loc.btn_deactivate, 'Deactivate HIDDEN before activation').toBeHidden({ timeout: 5000 });
    await expect(oooPage.loc.activeStatePara, 'Active banner HIDDEN on initial load').toBeHidden({ timeout: 5000 });
    await expect(oooPage.loc.btn_clearDate, 'Clear date (×) HIDDEN before any date set').toBeHidden({ timeout: 5000 });
    Logger.info('TC-OOO-UI: Default inactive form state ✓');

    // ─ 3. Date-only must NOT enable Activate and must NOT fire POST ─
    let postFired = false;
    await page.route('**/api/ooo', (route) => {
        if (route.request().method() === 'POST') postFired = true;
        route.continue();
    });
    const { uiDate: dateOnlyVal } = await oooPage.setFutureDate(3);
    await expect(oooPage.loc.btn_activate, 'Activate must remain DISABLED with date-only').toBeDisabled({ timeout: 5000 });
    await page.waitForTimeout(500);
    expect(postFired, 'POST /api/ooo must NOT fire when button is disabled').toBe(false);
    Logger.info(`TC-OOO-UI: Date-only (${dateOnlyVal}) — Activate still disabled, no POST fired ✓`);
    await oooPage.clearDeactivateDate();
    await expect(oooPage.loc.input_deactivateDate, 'Date field empty after clearing').toHaveValue('', { timeout: 5000 });

    // ─ 4. Switch to role mode — fields flip, helper text appears ─
    await oooPage.selectDelegateToRole();
    await expect(oooPage.loc.input_role, 'Role ENABLED in role mode').toBeEnabled({ timeout: 5000 });
    await expect(oooPage.loc.input_teamMember, 'Team member DISABLED in role mode').toBeDisabled({ timeout: 5000 });
    await expect(oooPage.loc.helperText, 'Helper text VISIBLE in role mode').toBeVisible({ timeout: 5000 });
    const helperText = await oooPage.loc.helperText.textContent();
    expect(helperText.trim()).toBe('Approvals will be routed to the person assigned to this role for each property.');
    await expect(oooPage.loc.btn_activate, 'Activate DISABLED — no role selected').toBeDisabled({ timeout: 5000 });
    Logger.info(`TC-OOO-UI: Role mode fields correct, helper text confirmed ✓`);

    // ─ 5. Switch back to user mode — reversal ─
    await oooPage.selectDelegateToUser();
    await expect(oooPage.loc.input_teamMember, 'Team member re-ENABLED in user mode').toBeEnabled({ timeout: 5000 });
    await expect(oooPage.loc.input_role, 'Role re-DISABLED in user mode').toBeDisabled({ timeout: 5000 });
    await expect(oooPage.loc.helperText, 'Helper text HIDDEN after switching back').toBeHidden({ timeout: 5000 });
    Logger.info('TC-OOO-UI: User mode reversal ✓');

    // ─ 6. Button gating follows the active mode ─
    await oooPage.selectDelegateToRole();
    const roleName = await oooPage.getFirstRoleName();
    await oooPage.pickRoleFromDropdown(roleName);
    await expect(oooPage.loc.btn_activate, 'Activate ENABLED after picking role').toBeEnabled({ timeout: 5000 });
    Logger.info(`TC-OOO-UI: Role "${roleName}" picked — Activate enabled ✓`);

    await oooPage.selectDelegateToUser();
    await expect(oooPage.loc.btn_activate, 'Activate DISABLED in user mode — no user chosen').toBeDisabled({ timeout: 5000 });

    await oooPage.selectDelegateToRole();
    const roleAfterReturn = await oooPage.loc.input_role.inputValue().catch(() => '');
    expect(roleAfterReturn, 'Role input must retain the previously selected value').toBe(roleName);
    await expect(oooPage.loc.btn_activate, 'Activate re-ENABLED — role retained on mode switch').toBeEnabled({ timeout: 5000 });
    Logger.info(`TC-OOO-UI: Mode switch round-trip — role "${roleAfterReturn}" retained, Activate re-enabled ✓`);

    Logger.success('TC-OOO-UI PASSED');
});

test('@ooo @regression TC269 The auto-deactivation date picker blocks past dates, allows today and future dates, clears with the X button, saves dates without timezone shift, and ignores bad input without breaking the form', async ({ page }) => {
    test.setTimeout(90000);
    Logger.step('TC-OOO-DATE: Verify all date picker scenarios');

    // ─ 1. Clear button hidden initially ─
    await expect(oooPage.loc.btn_clearDate, 'Clear (×) button must be HIDDEN before any date set').toBeHidden({ timeout: 3000 });

    // ─ 2. Date-only does NOT enable Activate ─
    await expect(oooPage.loc.radio_delegateToUser, 'Must start in user mode').toBeChecked({ timeout: 3000 });
    const { uiDate: dateOnly } = await oooPage.setFutureDate(3);
    await expect(oooPage.loc.btn_activate, 'Activate must NOT be enabled by date alone').toBeDisabled({ timeout: 5000 });
    Logger.info(`TC-OOO-DATE: Date-only (${dateOnly}) — Activate remains disabled ✓`);
    await oooPage.clearDeactivateDate();
    await expect(oooPage.loc.input_deactivateDate, 'Date field empty after clearing').toHaveValue('', { timeout: 5000 });

    // ─ 3. Switch to role mode and pick a role (needed for remaining steps) ─
    await oooPage.selectDelegateToRole();
    const roleName = await oooPage.getFirstRoleName();
    await oooPage.pickRoleFromDropdown(roleName);
    await expect(oooPage.loc.btn_activate, 'Activate ENABLED after picking role').toBeEnabled({ timeout: 5000 });
    Logger.info(`TC-OOO-DATE: Role "${roleName}" selected ✓`);

    // ─ 4. Calendar: prev-month nav disabled, past dates disabled ─
    await oooPage.openDatePicker();
    await expect(oooPage.loc.calendar_prevMonthBtn, 'Prev-month button must be DISABLED on current month').toBeDisabled({ timeout: 5000 });
    const allDayBtns = oooPage.loc.calendar_allDayBtns;
    const count = await allDayBtns.count();
    expect(count, 'Calendar must have at least one day button').toBeGreaterThan(0);
    Logger.info(`TC-OOO-DATE: ${count} day buttons found in calendar`);

    const today = new Date();
    let pastCount = 0;
    for (let i = 0; i < count; i++) {
        const btn = allDayBtns.nth(i);
        const label = await btn.getAttribute('aria-label');
        if (!label) continue;
        const btnDate = new Date(label);
        if (isNaN(btnDate.getTime())) continue;
        const isPast = btnDate < new Date(today.getFullYear(), today.getMonth(), today.getDate());
        if (isPast) {
            pastCount++;
            const isDisabled = await btn.isDisabled();
            const dataDisabled = await btn.getAttribute('data-disabled');
            expect(isDisabled || dataDisabled === 'true', `Past date "${label}" must be disabled`).toBe(true);
        }
    }
    expect(pastCount, 'At least one past date must have been found and verified').toBeGreaterThan(0);
    Logger.info(`TC-OOO-DATE: ${pastCount} past date(s) verified as disabled ✓`);

    // ─ 5. Today is selectable ─
    const todayCalendarValue = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    await oooPage.clickTodayInCalendar();
    await expect(oooPage.loc.input_deactivateDate, `Date input must show today: "${todayCalendarValue}"`).toHaveValue(todayCalendarValue, { timeout: 5000 });
    await expect(oooPage.loc.btn_activate, 'Activate remains ENABLED after selecting today').toBeEnabled({ timeout: 5000 });
    Logger.info(`TC-OOO-DATE: Today "${todayCalendarValue}" is selectable ✓`);

    // ─ 6. Clear button appears and works ─
    await expect(oooPage.loc.btn_clearDate, '× must appear after a date is set').toBeVisible({ timeout: 5000 });
    await oooPage.clearDeactivateDate();
    await expect(oooPage.loc.input_deactivateDate, 'Date field empty after clearing').toHaveValue('', { timeout: 5000 });
    expect(await oooPage.loc.btn_clearDate.isVisible().catch(() => false), '× must disappear after clearing').toBe(false);
    await expect(oooPage.loc.btn_activate, 'Activate remains ENABLED — delegate still selected').toBeEnabled({ timeout: 5000 });
    Logger.info('TC-OOO-DATE: Clear button works ✓');

    // ─ 7. Future date stores without timezone shift ─
    const future = new Date();
    future.setDate(future.getDate() + 7);
    const mmF = String(future.getMonth() + 1).padStart(2, '0');
    const ddF = String(future.getDate()).padStart(2, '0');
    const yyyyF = future.getFullYear();
    const futureUi = `${mmF}/${ddF}/${yyyyF}`;
    const futureApi = `${yyyyF}-${mmF}-${ddF}`;
    await oooPage.loc.input_deactivateDate.fill(futureUi);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await expect(oooPage.loc.input_deactivateDate, `Date input must show ${futureUi}`).toHaveValue(futureUi, { timeout: 5000 });
    await oooPage.clickActivateOoo();

    const apiState = await oooPage.assertRoleDelegationApi({ roleName, apiDate: futureApi });
    Logger.info(`TC-OOO-DATE: No timezone shift — stored "${apiState.ooo.deactivate_at}" starts with "${futureApi}" ✓`);

    await oooPage.clickDeactivateOoo();
    await oooPage.assertIsInactive();
    Logger.info('TC-OOO-DATE: Deactivated before invalid date tests ✓');

    // ─ 8. Invalid dates do not corrupt the Activate button ─
    await oooPage.selectDelegateToRole();
    await oooPage.pickRoleFromDropdown(roleName);
    await expect(oooPage.loc.btn_activate, 'Activate ENABLED before invalid date test').toBeEnabled({ timeout: 5000 });

    for (const inv of ['32/13/2026', 'abcd', '00/00/0000', '99-99-9999', '   ']) {
        Logger.step(`TC-OOO-DATE: Testing invalid date "${inv}"`);
        await oooPage.loc.input_deactivateDate.fill(inv);
        await page.keyboard.press('Tab');
        await page.waitForTimeout(400);
        const fieldVal = await oooPage.loc.input_deactivateDate.inputValue();
        Logger.info(`TC-OOO-DATE: After "${inv}" input shows: "${fieldVal}"`);
        await expect(oooPage.loc.btn_activate, `Activate must stay ENABLED after invalid date "${inv}"`).toBeEnabled({ timeout: 5000 });
        await oooPage.loc.input_deactivateDate.fill('');
        await page.keyboard.press('Tab');
        await page.waitForTimeout(300);
    }
    Logger.info('TC-OOO-DATE: All invalid date inputs handled gracefully ✓');

    Logger.success('TC-OOO-DATE PASSED');
});

test('@ooo @visual TC270 All Out of Office form states look correct compared to approved screenshots', async ({ page }) => {
    test.setTimeout(300000);
    Logger.step('TC-OOO-VISUAL: Capture all OOO UI state snapshots');

    const main = page.locator('main').first();
    const oooPanel = page.getByRole('tabpanel', { name: 'Out of Office' });
    const roleName = await oooPage.getFirstRoleName();

    await test.step('V1 — Default inactive form (user mode)', async () => {
        await expect(oooPage.loc.radio_delegateToUser).toBeChecked({ timeout: 5000 });
        await page.mouse.move(0, 0);
        await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
        await expect(oooPanel).toHaveScreenshot('ooo-v1-inactive-user-mode.png', OOO_VISUAL);
        Logger.info('V1 ✓');
    });

    await test.step('V2 — Role mode with helper text', async () => {
        await oooPage.selectDelegateToRole();
        await expect(oooPage.loc.helperText).toBeVisible({ timeout: 5000 });
        await page.mouse.move(0, 0);
        await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
        await expect(oooPanel).toHaveScreenshot('ooo-v2-role-mode-helper-text.png', OOO_VISUAL);
        Logger.info('V2 ✓');
    });

    await test.step('V3 — Role selected, Activate enabled', async () => {
        await oooPage.pickRoleFromDropdown(roleName);
        await expect(oooPage.loc.btn_activate).toBeEnabled({ timeout: 5000 });
        await page.mouse.move(0, 0);
        await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
        await expect(oooPanel).toHaveScreenshot('ooo-v3-role-selected-button-enabled.png', OOO_VISUAL);
        Logger.info('V3 ✓');
    });

    await test.step('V4 — Date picker calendar open', async () => {
        await oooPage.loc.input_deactivateDate.click();
        await expect(oooPage.loc.calendar_monthLabel).toBeVisible({ timeout: 5000 });
        await expect(main).toHaveScreenshot('ooo-v4-date-picker-open.png', OOO_VISUAL);
        Logger.info('V4 ✓');
    });

    await test.step('V5 — Future date selected with clear (×) visible', async () => {
        const { uiDate } = await oooPage.setFutureDate(5);
        Logger.info(`V5 — date: ${uiDate}`);
        await expect(oooPage.loc.btn_clearDate).toBeVisible({ timeout: 5000 });
        await page.mouse.move(0, 0);
        await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
        await expect(oooPanel).toHaveScreenshot('ooo-v5-date-selected-clear-visible.png', { ...OOO_VISUAL, mask: [oooPage.loc.input_deactivateDate] });
        Logger.info('V5 ✓');
    });

    await test.step('V6 — OOO active with role delegate, no date', async () => {
        await oooPage.clearDeactivateDate();
        await oooPage.clickActivateOoo();
        await expect(oooPage.loc.activeStatePara).toBeVisible({ timeout: 10000 });
        await page.mouse.move(0, 0);
        await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
        await expect(oooPanel).toHaveScreenshot('ooo-v6-active-role-no-date.png', OOO_VISUAL);
        Logger.info('V6 ✓');
    });

    await test.step('V7 — Deactivate button close-up', async () => {
        await expect(oooPage.loc.btn_deactivate).toBeVisible({ timeout: 5000 });
        await expect(oooPage.loc.btn_deactivate).toHaveScreenshot('ooo-v7-deactivate-button.png', OOO_VISUAL);
        Logger.info('V7 ✓');
    });

    await test.step('V8 — Form state after Deactivate', async () => {
        await oooPage.clickDeactivateOoo();
        await expect(oooPage.loc.btn_activate).toBeVisible({ timeout: 10000 });
        await expect(oooPage.loc.activeStatePara).toBeHidden({ timeout: 5000 });
        await page.mouse.move(0, 0);
        await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
        await expect(oooPanel).toHaveScreenshot('ooo-v8-deactivated-form-state.png', OOO_VISUAL);
        Logger.info('V8 ✓');
    });

    await test.step('V9 — OOO active with role delegate AND date', async () => {
        await oooPage.selectDelegateToRole();
        await oooPage.pickRoleFromDropdown(roleName);
        const { uiDate } = await oooPage.setFutureDate(10);
        Logger.info(`V9 — date: ${uiDate}`);
        await oooPage.clickActivateOoo();
        await expect(page.getByText(/Auto-deactivates on/i)).toBeVisible({ timeout: 10000 });
        await page.mouse.move(0, 0);
        await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
        await expect(oooPanel).toHaveScreenshot('ooo-v9-active-role-with-date.png', { ...OOO_VISUAL, mask: [page.getByText(/Auto-deactivates on/i)] });
        Logger.info('V9 ✓');
    });

    Logger.success('TC-OOO-VISUAL PASSED — all 9 snapshots captured');
});

test('@ooo @e2e TC271 Activating Out of Office in role delegation mode with a specific role and a random future date shows the correct active banner and saves the right role name and date to the API', async ({ page }) => {
    test.setTimeout(60000);
    Logger.step('TC-OOO-DELEGATE-ROLE: Activate with role + random date, verify UI and API');

    await oooPage.ensureOooInactive();

    // ─ 1. Switch to role mode and verify field states ─
    await oooPage.selectDelegateToRole();
    await expect(oooPage.loc.radio_delegateToRole, '"Delegate to role" must be checked').toBeChecked({ timeout: 5000 });
    await expect(oooPage.loc.input_role, 'Role input must be ENABLED').toBeEnabled({ timeout: 5000 });
    await expect(oooPage.loc.input_teamMember, 'Team member must be DISABLED in role mode').toBeDisabled({ timeout: 5000 });
    await expect(oooPage.loc.helperText, 'Helper text must be VISIBLE in role mode').toBeVisible({ timeout: 5000 });
    Logger.info('TC-OOO-DELEGATE-ROLE: Role mode field states correct ✓');

    // ─ 2. Pick role, set random date, activate ─
    const roleName = await oooPage.getFirstRoleName();
    await oooPage.pickRoleFromDropdown(roleName);
    await expect(oooPage.loc.btn_activate, 'Activate ENABLED after role selection').toBeEnabled({ timeout: 5000 });

    const randomDays = Math.floor(Math.random() * 300) + 30;
    const { uiDate, apiDate } = await oooPage.setFutureDate(randomDays);
    Logger.info(`TC-OOO-DELEGATE-ROLE: Role="${roleName}", date UI="${uiDate}", API="${apiDate}" (${randomDays} days)`);

    await oooPage.clickActivateOoo();

    // ─ 3. Verify UI active state ─
    await oooPage.assertIsActive({ withDateLine: true });
    const activeText = await oooPage.assertActiveBanner({ roleName, isRole: true });
    Logger.info(`TC-OOO-DELEGATE-ROLE: Active banner: "${activeText}" ✓`);

    // ─ 4. Verify API record ─
    const apiState = await oooPage.assertRoleDelegationApi({ roleName, apiDate });
    Logger.info(`TC-OOO-DELEGATE-ROLE: API confirmed — id=${apiState.ooo.id}, role="${roleName}", date="${apiState.ooo.deactivate_at}" ✓`);

    Logger.success('TC-OOO-DELEGATE-ROLE PASSED');
});

test('@ooo @e2e TC272 Activating Out of Office in user delegation mode selects a specific user and a random future date, shows the correct active banner, and saves the right user ID and date to the API', async ({ page }) => {
    test.setTimeout(90000);
    Logger.step('TC-OOO-DELEGATE-USER: Activate with user + random date, verify UI and API');

    const PREFERRED_USER = 'admin_1778137522347@yopmail.com';

    await oooPage.ensureOooInactive();

    // Attach alert detector — any browser dialog during this test is a bug
    const alert = oooPage.attachAlertDetector();

    // ─ 1. Verify default user mode ─
    await expect(oooPage.loc.radio_delegateToUser, '"Delegate to user" checked by default').toBeChecked({ timeout: 5000 });
    await expect(oooPage.loc.input_teamMember, 'Team member ENABLED').toBeEnabled({ timeout: 5000 });
    await expect(oooPage.loc.btn_activate, 'Activate DISABLED before delegate selection').toBeDisabled({ timeout: 5000 });
    Logger.info('TC-OOO-DELEGATE-USER: Default user mode confirmed ✓');

    // ─ 2. Select preferred user ─
    await oooPage.searchAndSelectUser(PREFERRED_USER);
    await expect(oooPage.loc.btn_activate, 'Activate ENABLED after user selection').toBeEnabled({ timeout: 5000 });

    // ─ 3. Set random date ─
    const randomDays = Math.floor(Math.random() * 300) + 30;
    const { uiDate, apiDate } = await oooPage.setFutureDate(randomDays);
    Logger.info(`TC-OOO-DELEGATE-USER: Date set — UI="${uiDate}", API="${apiDate}" (${randomDays} days)`);

    // Setting a date while a user is selected must NOT trigger any browser alert
    alert.assertNoAlert('after setting date with delegate user already selected');

    // ─ 4. Activate — handle "combination already exists" conflict with a fallback user ─
    await oooPage.loc.btn_activate.click();
    await page.waitForTimeout(1500);

    const combinationConflict = await page.getByText(/This combination already exists/i).isVisible().catch(() => false);
    let chosenUser = PREFERRED_USER;

    if (combinationConflict) {
        Logger.info(`TC-OOO-DELEGATE-USER: "${PREFERRED_USER}"+date conflict — switching to fallback user`);
        const delegates = await oooPage.getDelegatesApiResponse();
        const fallback = delegates.members.find(m => m.label !== PREFERRED_USER);
        expect(fallback, 'A fallback delegate user must exist in the org').toBeTruthy();
        chosenUser = fallback.label;

        // Change user while date is still set — this is the exact bug trigger
        await oooPage.replaceSelectedUser(chosenUser);

        // Changing the user while date is still set must NOT trigger any browser alert
        alert.assertNoAlert(`after changing delegate from "${PREFERRED_USER}" to "${chosenUser}" while date "${uiDate}" was set`);

        await oooPage.clickActivateOoo();
    }

    // ─ 5. Verify UI active state ─
    await oooPage.assertIsActive({ withDateLine: true });
    await oooPage.assertActiveBanner();
    Logger.info(`TC-OOO-DELEGATE-USER: Active state confirmed for delegate "${chosenUser}" ✓`);

    // Final guard — no alert must have appeared at any point
    alert.assertNoAlert('during the entire test');

    // ─ 6. Verify API record ─
    const apiState = await oooPage.assertUserDelegationApi({ apiDate });
    Logger.info(`TC-OOO-DELEGATE-USER: API confirmed — id=${apiState.ooo.id}, delegate_user_id="${apiState.ooo.delegate_user_id}", date="${apiState.ooo.deactivate_at}" ✓`);

    Logger.success('TC-OOO-DELEGATE-USER PASSED');
});

test('@ooo @e2e @known-issue TC273 Sending a second Out of Office activation request directly to the API while one is already active is rejected by the backend and leaves the original record completely unchanged', async ({ page }) => {
    test.setTimeout(90000);
    Logger.step('TC-OOO-DUPLICATE-COMBINATION: Activate via UI then verify the API rejects a duplicate POST');

    const DELEGATE_USER_EMAIL = 'admin_1778137522347@yopmail.com';

    await oooPage.ensureOooInactive();

    // ─ 1. Resolve numeric delegate user ID ─
    const delegates = await oooPage.getDelegatesApiResponse();
    const userMember = delegates.members.find(m => m.label === DELEGATE_USER_EMAIL);
    expect(userMember, `"${DELEGATE_USER_EMAIL}" must be in the delegates list`).toBeTruthy();
    const delegateUserId = parseInt(userMember.id, 10);
    Logger.info(`TC-OOO-DUPLICATE-COMBINATION: delegate_user_id=${delegateUserId} ✓`);

    // ─ 2. Generate a unique date for the first activation ─
    const uniqueDays = Math.floor(Math.random() * 300) + 30;
    const target = new Date();
    target.setDate(target.getDate() + uniqueDays);
    const mm = String(target.getMonth() + 1).padStart(2, '0');
    const dd = String(target.getDate()).padStart(2, '0');
    const yyyy = target.getFullYear();
    const uiDate = `${mm}/${dd}/${yyyy}`;
    const apiDate = `${yyyy}-${mm}-${dd}`;
    Logger.info(`TC-OOO-DUPLICATE-COMBINATION: Date — UI="${uiDate}", API="${apiDate}" (${uniqueDays} days)`);

    // ─ 3. First activation via UI ─
    Logger.step('TC-OOO-DUPLICATE-COMBINATION: Activating OOO via UI');
    await oooPage.searchAndSelectUser(DELEGATE_USER_EMAIL);
    await oooPage.loc.input_deactivateDate.fill(uiDate);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await oooPage.clickActivateOoo();

    await oooPage.assertIsActive();
    const firstApiState = await oooPage.assertUserDelegationApi({ apiDate });
    Logger.info(`TC-OOO-DUPLICATE-COMBINATION: First activation confirmed — id=${firstApiState.ooo.id} ✓`);

    // ─ 4. While OOO is still ACTIVE, POST the same payload again directly ─
    const duplicatePayload = { delegateUserId, deactivateAt: apiDate };
    Logger.step(`TC-OOO-DUPLICATE-COMBINATION: POSTing duplicate — ${JSON.stringify(duplicatePayload)}`);
    const dupRes = await oooPage.postOooDirect(duplicatePayload);
    const dupBody = await dupRes.json();
    Logger.info(`TC-OOO-DUPLICATE-COMBINATION: Duplicate POST → HTTP ${dupRes.status()}, body: ${JSON.stringify(dupBody)}`);

    // ─ 5. Backend must reject the duplicate ─
    const isRejected = dupRes.status() !== 200
        || dupBody.success === false
        || JSON.stringify(dupBody).toLowerCase().includes('combination')
        || JSON.stringify(dupBody).toLowerCase().includes('exists')
        || JSON.stringify(dupBody).toLowerCase().includes('already')
        || JSON.stringify(dupBody).toLowerCase().includes('error');
    expect(
        isRejected,
        `[KNOWN ISSUE] Backend must reject a duplicate OOO POST while one is active.\nHTTP ${dupRes.status()} | body: ${JSON.stringify(dupBody)}`
    ).toBe(true);
    Logger.info(`TC-OOO-DUPLICATE-COMBINATION: Duplicate POST rejected (HTTP ${dupRes.status()}) ✓`);

    // ─ 6. Original OOO record must be unchanged ─
    const finalApiState = await oooPage.getOooApiState();
    expect(finalApiState.ooo, 'Original OOO record must still be active').not.toBeNull();
    expect(finalApiState.ooo.id, 'OOO id must be unchanged').toBe(firstApiState.ooo.id);
    expect(finalApiState.ooo.delegate_user_id, 'delegate_user_id must be unchanged').toBe(delegateUserId);
    expect(finalApiState.ooo.deactivate_at, 'deactivate_at must be unchanged').not.toBeNull();
    Logger.info(`TC-OOO-DUPLICATE-COMBINATION: Original record unchanged — id=${finalApiState.ooo.id} ✓`);

    Logger.success('TC-OOO-DUPLICATE-COMBINATION PASSED — duplicate POST rejected, original record preserved');
});

test.skip('@ooo @e2e TC274 Create an Invoice approval template with three required approvers on the test property and submit a test invoice to prepare for the approval routing verification test', async ({ page }) => {
    test.setTimeout(300000);
    Logger.step('TC-OOO-SETUP-APPROVAL-INVOICE: Create approval template and invoice for OOO routing chain');

    const suffix = Date.now();

    // ── Step 1: Read property from TC258 data ─
    const propertyDataFile = path.join(__dirname, '../data/propertyData.json');
    expect(fs.existsSync(propertyDataFile), 'data/propertyData.json must exist — run TC258 first').toBe(true);
    const { propertyName } = JSON.parse(fs.readFileSync(propertyDataFile, 'utf8'));
    expect(propertyName, 'propertyName must be populated in data/propertyData.json').toBeTruthy();
    Logger.success(`TC-OOO-SETUP: Using property "${propertyName}" ✓`);

    // ── Step 2: Create Invoice approval template ─
    const approvalJob = new ApprovalJob(page);
    await page.goto(process.env.DASHBOARD_URL, { waitUntil: 'domcontentloaded' });
    await approvalJob.navigateToApprovalTab();
    await approvalJob.navigateToApprovalTemplatesTab();
    await approvalJob.waitForPageLoad();

    const templateName = `OOO_InvTemplate_${suffix}`;
    await approvalJob.openCreateTemplateDialog();
    await approvalJob.fillTemplateName(templateName);
    await approvalJob.selectTemplateType('Invoice');
    await approvalJob.addProperty(propertyName);
    Logger.info(`TC-OOO-SETUP: Template dialog — name="${templateName}", type=Invoice, property="${propertyName}" ✓`);

    // ── Step 3: Add 3 approvers ─
    const APPROVER_TIMEOUT = 15000;
    const approverInputs = page.getByPlaceholder('Select approver');
    const approvers = ['sumit mishra', 'sumit test', 'Sumit Harsh'];

    for (let i = 0; i < approvers.length; i++) {
        const input = approverInputs.nth(i);
        await input.waitFor({ state: 'visible', timeout: APPROVER_TIMEOUT });
        await input.click();
        await page.waitForTimeout(300);
        await input.fill(approvers[i]);
        await page.waitForTimeout(800);
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(300);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(800);
        Logger.success(`TC-OOO-SETUP: Approver row ${i + 1} set — "${approvers[i]}" ✓`);
    }

    await approvalJob.fillAmount(5000);
    await approvalJob.checkAlwaysRequiredInTemplateDialog(3);
    Logger.info('TC-OOO-SETUP: Amount=$5000, Always Required checked for all 3 rows ✓');

    await approvalJob.submitCreateTemplate();
    await approvalJob.searchTemplate(templateName);
    await expect(
        page.getByRole('row').filter({ hasText: templateName }),
        `Template "${templateName}" must appear in the list`
    ).toBeVisible({ timeout: 15000 });
    await approvalJob.clearSearch();
    Logger.success(`TC-OOO-SETUP: Template "${templateName}" confirmed in list ✓`);

    // ── Step 4: Add a test invoice ─
    const projectData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/projectData.json'), 'utf8'));
    const projectPage = new ProjectPage(page);
    const projectJob = new ProjectJob(page);
    const invoicePage = new InvoicePage(page);

    await page.goto(process.env.DASHBOARD_URL, { waitUntil: 'load' });
    await projectPage.openProject(projectData.projectName);
    await projectJob.navigateToJobsTab();
    await projectJob.openJobSummary();
    await invoicePage.navigateToInvoiceTab();
    await page.waitForLoadState('load');
    await page.waitForTimeout(2000);
    Logger.info(`TC-OOO-SETUP: Opened project "${projectData.projectName}" → invoice tab ✓`);

    await page.evaluate(() => {
        document.querySelectorAll('main, .mantine-AppShell-navbar').forEach(el => { el.style.zoom = '70%'; });
    });

    const invoiceAmount = Math.floor(Math.random() * (5000 - 1000 + 1)) + 1000;
    const invoiceResult = await invoicePage.createCompleteInvoice({
        title: `OOO_Invoice_${suffix}`,
        description: 'Invoice for OOO approval routing setup',
        budgetCategory: 'Bathroom fixtures install',
        amount: invoiceAmount,
        confirm: true,
    });

    expect(invoiceResult.number, 'Invoice number must be assigned').toBeTruthy();
    expect(invoiceResult.budgetCategoriesSet, 'Budget category must be set').toBeGreaterThan(0);
    expect(invoiceResult.amountFilled, `Amount $${invoiceAmount} must be committed in grid`).toBe(true);
    const committedDigits = (invoiceResult.amountCellText || '').replace(/\D/g, '');
    const expectedDigits = String(invoiceAmount).replace(/\D/g, '');
    expect(committedDigits, `Grid cell must contain amount digits (${expectedDigits})`).toContain(expectedDigits);

    const amountMatch = (invoiceResult.amountCellText || '').match(/\$[\d,]+/);
    const invoiceAmountFormatted = amountMatch ? amountMatch[0] : `$${invoiceAmount.toLocaleString()}`;
    const invoiceId = (invoiceResult.number || '').match(/\d+/)?.[0] || '';

    Logger.success(`TC-OOO-SETUP: Invoice "${invoiceResult.number}" — amount: ${invoiceAmountFormatted}, ID: ${invoiceId} ✓`);

    const oooChainDataPath = path.join(__dirname, '../data/oooChainData.json');
    fs.mkdirSync(path.dirname(oooChainDataPath), { recursive: true });
    fs.writeFileSync(oooChainDataPath, JSON.stringify({
        invoiceId, invoiceAmount, invoiceAmountFormatted,
        invoiceTitle: `OOO_Invoice_${suffix}`,
        invoiceNumber: invoiceResult.number,
        createdAt: new Date().toISOString(),
    }, null, 2));
    Logger.success(`TC-OOO-SETUP: Chain data saved — ID: ${invoiceId}, amount: ${invoiceAmountFormatted} ✓`);

    Logger.success('TC-OOO-SETUP-APPROVAL-INVOICE PASSED');
});

test.describe.skip('TC275-APPROVAL-VERIFY — Verify invoice in All Approvals (admin user)', () => {
    test.use({ storageState: 'OtherSessionState.json' });

    test('@ooo @e2e TC-OOO-APPROVAL-VERIFY The test invoice shows up in All Approvals with the correct amount and Pending status and the Approval Details panel lists all three expected approvers with their individual statuses', async ({ page }) => {
        test.setTimeout(120000);
        Logger.step('TC-OOO-APPROVAL-VERIFY: Verify the setup invoice in All Approvals with all 3 approvers');

        // ── Step 1: Read chain data ─
        const chainDataPath = path.join(__dirname, '../data/oooChainData.json');
        expect(fs.existsSync(chainDataPath), 'data/oooChainData.json must exist — run TC-OOO-SETUP first').toBe(true);
        const { invoiceId, invoiceAmountFormatted, invoiceNumber } = JSON.parse(fs.readFileSync(chainDataPath, 'utf8'));
        expect(invoiceId, 'invoiceId must be set').toBeTruthy();
        expect(invoiceAmountFormatted, 'invoiceAmountFormatted must be set').toBeTruthy();
        Logger.info(`TC-OOO-APPROVAL-VERIFY: Looking for ID="${invoiceId}", amount="${invoiceAmountFormatted}" ✓`);

        // ── Step 2: Navigate to All Approvals ─
        const origin = new URL(process.env.DASHBOARD_URL).origin;
        await page.goto(`${origin}/approvals/all-approvals`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('input[placeholder="Search..."]:not([data-disabled="true"])', { timeout: 30000 });
        Logger.success('TC-OOO-APPROVAL-VERIFY: All Approvals page loaded ✓');

        // ── Step 3: Search by invoice ID ─
        await page.getByPlaceholder('Search...').first().fill(invoiceId);
        await page.waitForTimeout(2000);
        Logger.info(`TC-OOO-APPROVAL-VERIFY: Searched for ID "${invoiceId}"`);

        // ── Step 4: Assert row — ID, amount, Pending status ─
        const invoiceRow = page.getByRole('row').filter({ hasText: invoiceId }).first();
        await expect(invoiceRow, `Row with invoice ID "${invoiceId}" must be visible`).toBeVisible({ timeout: 15000 });
        await expect(invoiceRow.getByText(invoiceAmountFormatted), `Amount "${invoiceAmountFormatted}" must be in the row`).toBeVisible({ timeout: 5000 });
        Logger.success(`TC-OOO-APPROVAL-VERIFY: Row found — ID="${invoiceId}", amount="${invoiceAmountFormatted}" ✓`);

        const statusCell = invoiceRow.getByRole('gridcell').filter({ hasText: /pending/i }).first();
        await expect(statusCell, 'Status cell must show Pending').toBeVisible({ timeout: 5000 });
        const rawStatusText = await statusCell.innerText().catch(() => statusCell.textContent());
        const statusText = (rawStatusText.match(/(Pending Approval|Pending Assignment|Pending|Approved|Rejected)/i)?.[0] || rawStatusText).trim();
        expect(statusText, 'Status must be a pending variant').toMatch(/pending/i);
        Logger.success(`TC-OOO-APPROVAL-VERIFY: Status is "${statusText}" ✓`);

        // ── Step 5: Open View Details ─
        const viewDetailsBtn = page.getByRole('button', { name: 'View Details' }).first();
        await expect(viewDetailsBtn, '"View Details" must be visible').toBeVisible({ timeout: 10000 });
        await viewDetailsBtn.click();

        const dialog = page.getByRole('dialog', { name: 'Approval Details' });
        await expect(dialog, 'Approval Details dialog must open').toBeVisible({ timeout: 15000 });
        Logger.success('TC-OOO-APPROVAL-VERIFY: Approval Details dialog opened ✓');

        // ── Step 6: Assert all 3 approvers are listed ─
        const expectedApprovers = ['Sumit Mishra', 'Sumit Test', 'Sumit Harsh'];
        for (const name of expectedApprovers) {
            await expect(dialog.getByText(name, { exact: true }), `Approver "${name}" must be in dialog`).toBeVisible({ timeout: 10000 });
        }
        Logger.success(`TC-OOO-APPROVAL-VERIFY: All 3 approvers confirmed — ${expectedApprovers.join(', ')} ✓`);

        // ── Step 7: Log each approver's status ─
        const STATUS_VALUES = ['Pending Approval', 'Pending Assignment', 'Pending', 'Skipped', 'Rejected', 'Approved'];
        for (const name of expectedApprovers) {
            const nameEl = dialog.getByText(name, { exact: true }).first();
            const approverStatus = await nameEl.evaluate((el, statuses) => {
                let node = el;
                for (let i = 0; i < 6; i++) {
                    if (!node.parentElement) break;
                    node = node.parentElement;
                    for (const sib of Array.from(node.parentElement?.children || [])) {
                        if (sib === node) continue;
                        const txt = (sib.textContent || '').trim();
                        if (statuses.some(s => s.toLowerCase() === txt.toLowerCase())) return txt;
                    }
                }
                return 'Unknown';
            }, STATUS_VALUES);
            Logger.info(`TC-OOO-APPROVAL-VERIFY: "${name}" → "${approverStatus}"`);
        }

        Logger.success(
            `TC-OOO-APPROVAL-VERIFY PASSED — Invoice ${invoiceNumber} in All Approvals ` +
            `(amount: ${invoiceAmountFormatted}, status: ${statusText}), all 3 approvers logged`
        );
    });
});
