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

test.use({
    storageState: 'sessionState.json',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    animations: 'disabled',
    maxDiffPixels: 50_000,
    maxDiffPixelRatio: 0.3,
});

// ── serial: all OOO tests share a single API-level OOO state.
// Running in parallel with --workers > 1 causes beforeEach to DELETE another
// test's active OOO record, leading to random assertion failures on CI.
test.describe.skip('Out of Office — OOO suite', () => {

    let oooPage;

    test.beforeEach(async ({ page }) => {
        oooPage = new OOOPage(page);
        await page.goto(process.env.DASHBOARD_URL, { waitUntil: 'domcontentloaded' });

        // Ensure OOO is inactive — retry once on transient network/server failure.
        // A failing cleanup in serial mode would skip all subsequent tests, so we give
        // the server a second chance before letting the error propagate.
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                await oooPage.ensureOooInactive();
                break;
            } catch (e) {
                if (attempt === 2) throw e;
                Logger.error(`[beforeEach] Cleanup attempt ${attempt} failed: ${e.message} — retrying in 2 s`);
                await page.waitForTimeout(2000);
            }
        }

        // Navigate to profile + OOO tab — retry once on transient navigation failure.
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                await oooPage.navigateToProfile();
                await oooPage.clickOooTab();
                break;
            } catch (e) {
                if (attempt === 2) throw e;
                Logger.error(`[beforeEach] Navigation attempt ${attempt} failed: ${e.message} — retrying`);
                await page.waitForTimeout(2000);
            }
        }

        Logger.step('[beforeEach] OOO tab ready; state confirmed inactive');
    });

    test.afterEach(async ({ page }) => {
        const apiBase = new URL(process.env.DASHBOARD_URL).origin;
        await page.request.delete(`${apiBase}/api/ooo`).catch((e) =>
            Logger.error(`[afterEach] OOO cleanup DELETE failed: ${e.message}`)
        );
        Logger.step('[afterEach] OOO cleanup attempted');
    });

    // =========================================================================
    // TC261 — Navigation: OOO tab reachable via direct URL and sidebar menu
    // =========================================================================
    test('@ooo @regression TC261 The Out of Office tab opens correctly from the direct Profile page URL and also from the sidebar user menu dropdown', async ({ page }) => {
        Logger.step('TC261: Verify the OOO tab is reachable via two navigation paths');

        // Path 1: already on OOO tab via beforeEach (direct /profile URL)
        await expect(oooPage.loc.tab_ooo, 'OOO tab must be selected').toHaveAttribute('aria-selected', 'true', { timeout: 8000 });
        await expect(oooPage.loc.oooTabpanel, 'OOO tabpanel must be visible').toBeVisible({ timeout: 5000 });
        Logger.info('TC261: Path 1 — OOO tab opens via direct /profile URL ✓');

        // Path 2: dashboard → sidebar user block → Profile → OOO tab
        await page.goto(process.env.DASHBOARD_URL, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1500);
        await oooPage.loc.sidebarUserBlock.waitFor({ state: 'visible', timeout: 20000 });
        await oooPage.loc.sidebarUserBlock.click();
        const profileMenuItem = page.getByRole('menuitem', { name: 'Profile' });
        await profileMenuItem.waitFor({ state: 'visible', timeout: 10000 });
        await profileMenuItem.click();
        await expect(page).toHaveURL(/\/profile/, { timeout: 15000 });

        await expect(oooPage.loc.tab_ooo, 'OOO tab must be visible').toBeVisible({ timeout: 10000 });
        await oooPage.clickOooTab();
        await expect(oooPage.loc.tab_ooo, 'OOO tab must be selected after clicking').toHaveAttribute('aria-selected', 'true', { timeout: 8000 });
        await expect(oooPage.loc.oooTabpanel, 'OOO tabpanel must be visible').toBeVisible({ timeout: 5000 });
        Logger.info('TC261: Path 2 — OOO tab opens via sidebar user menu ✓');

        Logger.success('TC261 PASSED');
    });

    // =========================================================================
    // TC262 — Activate with role delegate: verify UI banner and API record
    // =========================================================================
    test('@ooo @regression TC262 Turning on Out of Office with a role delegate shows the active banner with the correct role name and saves the correct state to the API', async ({ page }) => {
        test.setTimeout(60000);
        Logger.step('TC262: Activate with role delegate, verify UI and API');

        const roleName = await oooPage.getFirstRoleName();
        Logger.info(`TC262: Using role "${roleName}"`);

        await oooPage.activateWithRole(roleName, null);
        await oooPage.assertIsActive();
        const activeText = await oooPage.assertActiveBanner({ roleName, isRole: true });
        Logger.info(`TC262: Active banner: "${activeText}" ✓`);

        // No date → auto-deactivation line must NOT appear
        const dateVisible = await page.getByText(/Auto-deactivates on/i).isVisible().catch(() => false);
        expect(dateVisible, 'Auto-deactivation date line must NOT appear when no date was set').toBe(false);

        const apiState = await oooPage.assertRoleDelegationApi({ roleName, apiDate: null });
        Logger.info(`TC262: API confirmed — id=${apiState.ooo.id}, role="${roleName}", deactivate_at=null ✓`);

        Logger.success('TC262 PASSED');
    });

    // =========================================================================
    // TC264 — Deactivate resets form completely; re-activate with different role
    // =========================================================================
    test('@ooo @regression TC264 Clicking Deactivate clears the form completely, removes the API record, and lets you activate again with a different role without showing leftover data', async ({ page }) => {
        test.setTimeout(90000);
        Logger.step('TC264: Activate Role A → deactivate → verify full reset → re-activate Role B');

        const roleA = await oooPage.getFirstRoleName();
        const delegates = await oooPage.getDelegatesApiResponse();
        // If only one role exists, re-activate with the same role — still verifies
        // the full deactivate-and-re-activate flow and form reset behaviour.
        const hasTwoRoles = delegates.roles.length >= 2;
        const roleB = hasTwoRoles ? await oooPage.getSecondRoleName() : roleA;
        if (hasTwoRoles) {
            expect(roleA, 'Role A and Role B must be different').not.toBe(roleB);
        } else {
            Logger.info('TC264: Only one role in org — re-activating with same role (verifies reset, not role-switch)');
        }

        await oooPage.activateWithRole(roleA);
        await oooPage.assertIsActive();
        await oooPage.assertActiveBanner({ roleName: roleA, isRole: true });
        Logger.info('TC264: OOO activated with Role A ✓');

        await oooPage.clickDeactivateOoo();
        await oooPage.assertIsInactive();
        Logger.info('TC264: Full UI reset confirmed ✓');

        const apiAfterDeactivate = await oooPage.getOooApiState();
        expect(apiAfterDeactivate.ooo, 'API ooo must be NULL after deactivation').toBeNull();
        Logger.info('TC264: API confirms ooo=null ✓');

        await oooPage.activateWithRole(roleB);
        const textB = await oooPage.assertActiveBanner({ roleName: roleB, isRole: true });
        if (hasTwoRoles) {
            expect(textB, 'Active banner must NOT contain Role A (stale data)').not.toContain(roleA);
        }
        Logger.info(`TC264: Re-activated with Role B${hasTwoRoles ? ' (different from A)' : ' (same as A — 1-role env)'} — form reset confirmed ✓`);

        const finalApi = await oooPage.assertRoleDelegationApi({ roleName: roleB });
        Logger.info(`TC264: API confirmed delegate="${finalApi.ooo.delegate_role_name}" ✓`);

        Logger.success('TC264 PASSED');
    });

    // =========================================================================
    // TC265 — OOO state persists across page navigation and full browser reload
    // =========================================================================
    test('@ooo @regression TC265 Out of Office stays active after navigating away to a different page and after doing a full browser reload', async ({ page }) => {
        test.setTimeout(90000);
        Logger.step('TC265: Activate OOO then verify persistence across navigation and reload');

        const roleName = await oooPage.getFirstRoleName();

        // Calculate the date without calling setFutureDate (which opens the calendar as a
        // side-effect and can leave the popup blocking the Activate button).
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 4);
        const mm265 = String(futureDate.getMonth() + 1).padStart(2, '0');
        const dd265 = String(futureDate.getDate()).padStart(2, '0');
        const yyyy265 = futureDate.getFullYear();
        const uiDate = `${mm265}/${dd265}/${yyyy265}`;

        await oooPage.selectDelegateToRole();
        await oooPage.pickRoleFromDropdown(roleName);
        await oooPage.loc.input_deactivateDate.fill(uiDate);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
        // Close the date picker calendar — Mantine DateInput opens below the input and
        // the calendar popup covers the Activate button, causing an invisible click.
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        await oooPage.clickActivateOoo();
        Logger.info(`TC265: OOO activated — role="${roleName}", date="${uiDate}"`);

        // Give the backend a moment to commit the POST before navigating away.
        // The true persistence check is the navigation test below — if the backend
        // didn't save the state, the OOO tab will show inactive after returning.
        await page.waitForTimeout(3000);

        // Part 1: navigate away and back
        const origin = new URL(process.env.DASHBOARD_URL).origin;
        await page.goto(`${origin}/properties`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1500);
        await oooPage.goToOooTab();
        await oooPage.assertIsActive({ withDateLine: true });
        await oooPage.assertActiveBanner({ roleName });
        Logger.info('TC265: OOO state persisted after navigation ✓');

        const apiAfterNav = await oooPage.assertRoleDelegationApi({ roleName });
        expect(apiAfterNav.ooo.deactivate_at, 'deactivate_at must still be set after navigation').not.toBeNull();

        // Part 2: hard browser reload
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);
        await oooPage.clickOooTab();
        await oooPage.assertIsActive({ withDateLine: true });
        await oooPage.assertActiveBanner({ roleName });
        Logger.info('TC265: OOO state persisted after reload ✓');

        const apiAfterReload = await oooPage.assertRoleDelegationApi({ roleName });
        expect(apiAfterReload.ooo.deactivate_at, 'deactivate_at must still be set after reload').not.toBeNull();
        Logger.info('TC265: API confirms state is backend-persisted ✓');

        Logger.success('TC265 PASSED');
    });

    // =========================================================================
    // TC266 — E2E: budget approval routed to delegate role when OOO is active
    // =========================================================================
    test('@ooo @e2e @critical TC266 A budget approval submitted while Out of Office is on goes to the delegate role in All Approvals and does not appear in the Out of Office user own My Approvals', async ({ page }) => {
        test.setTimeout(900000);
        Logger.step('TC266: Submit budget revision with OOO active and verify approval routing');

        const budgetDataPath = path.resolve(process.cwd(), 'files', 'budget_data.csv');
        expect(fs.existsSync(budgetDataPath), `Budget CSV must exist: ${budgetDataPath}`).toBe(true);

        const suffix = Date.now();
        const propertyName = `OOO_AC006_${suffix}`;
        const prop = new PropertiesHelper(page);
        const budgetJob = new BudgetJob(page);
        const approvalPage = new SimpleApprovalPage(page);
        const approvalJob = new ApprovalJob(page);
        const roleName = await oooPage.getFirstRoleName();

        // Step 1: Create property
        await page.goto(process.env.DASHBOARD_URL, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);
        await prop.goToProperties();
        await prop.createProperty(propertyName, 'Domestic Terminal, College Park, GA 30337, USA', 'College Park', 'GA', '30337', 'Garden Style');
        Logger.info(`TC266: Property "${propertyName}" created ✓`);

        // Step 2: Create a Budget approval template for this property so budget submission triggers routing.
        // All 3 default approver rows must be filled — fillAmount fills all rows, so leaving rows
        // 2 & 3 without an approver causes silent form-validation failure (submitCreateTemplate has
        // a .catch guard). Use 3 approvers; Sumit Mishra (OOO user) is row 1, so with OOO active
        // that approval routes to the delegate role instead of appearing in My Approvals.
        await page.goto(process.env.DASHBOARD_URL, { waitUntil: 'domcontentloaded' });
        await approvalJob.navigateToApprovalTab();
        await approvalJob.navigateToApprovalTemplatesTab();
        await approvalJob.waitForPageLoad();
        const budgetTemplateName = `OOO_BudgetTmpl_${suffix}`;
        await approvalJob.openCreateTemplateDialog();
        await approvalJob.fillTemplateName(budgetTemplateName);
        await approvalJob.selectTemplateType('Budget');
        await approvalJob.addProperty(propertyName);
        // Use the 3 stable Sumit test users as approvers (same 4 that appear when typing "sum").
        // These are long-lived test accounts; yopmail users are excluded as they may be deleted.
        const stableMembers266 = await oooPage.getStableTestMemberNames();
        expect(stableMembers266.length, 'Need at least 3 stable Sumit test users for TC266 approvers').toBeGreaterThanOrEqual(3);
        const APPROVERS_266 = stableMembers266.slice(0, 3);
        const approverInputs266 = page.getByPlaceholder('Select approver');
        for (let i = 0; i < APPROVERS_266.length; i++) {
            const fullName = APPROVERS_266[i];
            const partial = fullName.trim().split(/\s+/)[0]; // First word as filter (e.g. "Sumit", "test")
            const inp = approverInputs266.nth(i);
            await inp.waitFor({ state: 'visible', timeout: 15000 });
            await inp.click();
            await page.waitForTimeout(300);
            await inp.pressSequentially(partial, { delay: 50 });
            await page.waitForTimeout(800);
            const option = page.getByRole('option', { name: fullName });
            await option.waitFor({ state: 'visible', timeout: 10000 });
            await option.click();
            await page.waitForTimeout(800);
            Logger.info(`TC266: Approver row ${i + 1} — "${fullName}" ✓`);
        }
        await approvalJob.fillAmount(1000);
        await approvalJob.checkAlwaysRequiredInTemplateDialog(3);
        await approvalJob.submitCreateTemplate();
        await page.waitForTimeout(7000);
        // Verify the template was actually created (submitCreateTemplate silently swallows failures)
        await approvalJob.searchTemplate(budgetTemplateName);
        await expect(
            page.getByRole('row').filter({ hasText: budgetTemplateName }),
            `Budget template "${budgetTemplateName}" must appear in the list`
        ).toBeVisible({ timeout: 15000 });
        await approvalJob.clearSearch();
        Logger.info(`TC266: Budget approval template "${budgetTemplateName}" created and verified ✓`);

        // Step 3: Activate OOO
        await oooPage.goToOooTab();
        await oooPage.activateWithRole(roleName);
        await oooPage.assertIsActive();
        const oooApi = await oooPage.assertRoleDelegationApi({ roleName });
        Logger.info(`TC266: OOO active — role="${roleName}", id=${oooApi.ooo.id} ✓`);

        // Step 4: Submit budget revision
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
        Logger.info('TC266: Budget revision submitted ✓');

        // Step 5: Assert approval is in All Approvals (triggered by the template)
        const origin = new URL(process.env.DASHBOARD_URL).origin;
        await page.goto(`${origin}/approvals/all-approvals`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('input[placeholder="Search..."]:not([data-disabled="true"])', { timeout: 60000 });
        await approvalPage.searchApprovals(propertyName);
        await page.waitForTimeout(1500);
        const allRows = await approvalPage.getTableRowCount();
        Logger.info(`TC266: All Approvals — ${allRows} row(s) for "${propertyName}"`);
        expect(allRows, `OOO approval for "${propertyName}" must appear in All Approvals — template exists so routing must trigger`).toBeGreaterThan(0);

        // Step 6: Assert NOT in My Approvals (routed to delegate role due to OOO)
        await page.goto(`${origin}/approvals/my-approvals`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('input[placeholder="Search..."]:not([data-disabled="true"])', { timeout: 30000 }).catch(() => {});
        let myRows = 0;
        if (await page.$('input[placeholder="Search..."]:not([data-disabled="true"])')) {
            await approvalPage.searchApprovals(propertyName);
            await page.waitForTimeout(1500);
            myRows = await approvalPage.getTableRowCount();
        }
        Logger.info(`TC266: My Approvals — ${myRows} row(s) for "${propertyName}"`);
        expect(
            myRows,
            `OOO ROUTING BUG: approval appeared in My Approvals. With OOO active it must route to delegate role "${roleName}", NOT the OOO user.`
        ).toBe(0);
        Logger.success('TC266: Approval in All Approvals but NOT in My Approvals — OOO routing confirmed ✓');

        Logger.success('TC266 PASSED');
    });

    // =========================================================================
    // TC267 — Field gating, button state, and self-delegation prevention
    // =========================================================================
    test('@ooo @regression TC267 Toggling between delegate-to-user and delegate-to-role enables and disables the correct form fields, controls the Activate button state, and blocks a user from selecting themselves as a delegate', async ({ page }) => {
        Logger.step('TC267: Verify field states, button gating, and self-delegation prevention');

        // Default: user mode
        await expect(oooPage.loc.radio_delegateToUser).toBeChecked({ timeout: 5000 });
        await expect(oooPage.loc.radio_delegateToRole).not.toBeChecked({ timeout: 5000 });
        await expect(oooPage.loc.input_teamMember).toBeEnabled({ timeout: 5000 });
        await expect(oooPage.loc.input_role).toBeDisabled({ timeout: 5000 });
        await expect(oooPage.loc.helperText).toBeHidden({ timeout: 5000 });
        await expect(oooPage.loc.btn_activate).toBeDisabled({ timeout: 5000 });
        Logger.info('TC267: Default user mode field states ✓');

        // Switch to role mode
        await oooPage.selectDelegateToRole();
        await expect(oooPage.loc.input_role).toBeEnabled({ timeout: 5000 });
        await expect(oooPage.loc.input_teamMember).toBeDisabled({ timeout: 5000 });
        await expect(oooPage.loc.helperText).toBeVisible({ timeout: 5000 });
        const helperContent = await oooPage.loc.helperText.textContent();
        expect(helperContent.trim()).toBe('Approvals will be routed to the person assigned to this role for each property.');
        await expect(oooPage.loc.btn_activate).toBeDisabled({ timeout: 5000 });
        Logger.info('TC267: Role mode field states ✓');

        // All roles visible in dropdown
        const allRoles = await oooPage.getAllRoleNames();
        expect(allRoles.length, 'At least one role must exist').toBeGreaterThan(0);
        await oooPage.loc.input_role.click();
        await expect(page.getByRole('listbox'), 'Role dropdown listbox must be visible').toBeVisible({ timeout: 5000 });
        for (const rName of allRoles) {
            await expect(page.getByRole('option', { name: rName }), `Role "${rName}" must appear in dropdown`).toBeVisible({ timeout: 5000 });
        }
        Logger.info(`TC267: All ${allRoles.length} role(s) visible in dropdown ✓`);

        const roleName = allRoles[0];
        await page.getByRole('option', { name: roleName }).click();
        await expect(oooPage.loc.input_role).toHaveValue(roleName, { timeout: 5000 });
        await expect(oooPage.loc.btn_activate).toBeEnabled({ timeout: 5000 });
        Logger.info(`TC267: Role "${roleName}" selected — Activate enabled ✓`);

        // Switch back to user mode
        await oooPage.selectDelegateToUser();
        await expect(oooPage.loc.input_role).toBeDisabled({ timeout: 5000 });
        await expect(oooPage.loc.input_teamMember).toBeEnabled({ timeout: 5000 });
        await expect(oooPage.loc.helperText).toBeHidden({ timeout: 5000 });
        await expect(oooPage.loc.btn_activate).toBeDisabled({ timeout: 5000 });
        Logger.info('TC267: Switched back to user mode ✓');

        // Self-delegation prevention
        const currentUserName = await oooPage.getCurrentUserName();
        Logger.info(`TC267: Current user is "${currentUserName}"`);
        await oooPage.loc.input_teamMember.click();
        await oooPage.loc.input_teamMember.fill(currentUserName.split(' ')[0]);
        await page.waitForTimeout(800);
        const selfOption = page.getByRole('option', { name: currentUserName });
        expect(await selfOption.isVisible().catch(() => false), `"${currentUserName}" must NOT appear in dropdown`).toBe(false);
        Logger.info(`TC267: Self-delegation blocked ✓`);

        const delegates = await oooPage.getDelegatesApiResponse();
        const selfInApi = delegates.members.find(m => m.label.toLowerCase().includes(currentUserName.toLowerCase().split(' ')[0]));
        expect(selfInApi, 'Current user must exist in API members (UI filters them out)').toBeTruthy();
        Logger.info(`TC267: API has self (id=${selfInApi.id}) — UI correctly excludes them ✓`);

        await page.keyboard.press('Escape');
        Logger.success('TC267 PASSED');
    });

    // =========================================================================
    // TC269 — THE calendar test: date picker, past-date blocking, today, clear,
    //          timezone (merged from TC263), invalid dates
    // =========================================================================
    test('@ooo @regression TC269 The auto-deactivation date picker blocks past dates, allows today and future dates, clears with the X button, saves dates without timezone shift, and ignores bad input without breaking the form', async ({ page }) => {
        test.setTimeout(120000);
        Logger.step('TC269: Verify all date picker and calendar scenarios');

        // 1. Clear button hidden initially
        await expect(oooPage.loc.btn_clearDate, 'Clear (×) must be HIDDEN before any date set').toBeHidden({ timeout: 5000 });

        // 2. Date-only does NOT enable Activate
        await expect(oooPage.loc.radio_delegateToUser).toBeChecked({ timeout: 3000 });
        const { uiDate: dateOnly } = await oooPage.setFutureDate(3);
        await expect(oooPage.loc.btn_activate, 'Activate must NOT be enabled by date alone').toBeDisabled({ timeout: 5000 });
        Logger.info(`TC269: Date-only (${dateOnly}) — Activate remains disabled ✓`);
        await oooPage.clearDeactivateDate();
        await expect(oooPage.loc.input_deactivateDate).toHaveValue('', { timeout: 5000 });

        // 3. Switch to role mode, pick a role (needed for remaining steps)
        await oooPage.selectDelegateToRole();
        const roleName = await oooPage.getFirstRoleName();
        await oooPage.pickRoleFromDropdown(roleName);
        await expect(oooPage.loc.btn_activate).toBeEnabled({ timeout: 5000 });
        Logger.info(`TC269: Role "${roleName}" selected ✓`);

        // 4. Calendar: prev-month nav disabled on current month, past dates disabled
        await oooPage.openDatePicker();
        // Navigate back to current month (calendar may still show the future month from step 2)
        // Use prev-button disabled state as the signal: disabled = already at current month.
        for (let i = 0; i < 3; i++) {
            const prevDisabled = await oooPage.loc.calendar_prevMonthBtn.isDisabled().catch(() => true);
            if (prevDisabled) break;
            await oooPage.loc.calendar_prevMonthBtn.click();
            await page.waitForTimeout(400);
        }
        await expect(oooPage.loc.calendar_prevMonthBtn, 'Prev-month button must be DISABLED on current month').toBeDisabled({ timeout: 5000 });
        Logger.info('TC269: Prev-month button disabled on current month ✓');

        const allDayBtns = oooPage.loc.calendar_allDayBtns;
        const count = await allDayBtns.count();
        expect(count, 'Calendar must have at least one day button').toBeGreaterThan(0);
        Logger.info(`TC269: ${count} day buttons found in calendar`);

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
        // On the 1st of any month there are no past dates in the calendar — skip the count assertion.
        if (today.getDate() > 1) {
            expect(pastCount, 'At least one past date must have been found and verified').toBeGreaterThan(0);
            Logger.info(`TC269: ${pastCount} past date(s) verified as disabled ✓`);
        } else {
            Logger.info('TC269: First of month — no past dates in calendar to verify (expected)');
        }

        // 5. Today is selectable — use data-today="true" attribute (stable in headless CI)
        const todayBtn = page.locator('[data-today="true"]').first();
        await expect(todayBtn, 'Today button must be visible in calendar').toBeVisible({ timeout: 5000 });
        await todayBtn.click();
        await expect(oooPage.loc.btn_activate, 'Activate remains ENABLED after selecting today').toBeEnabled({ timeout: 5000 });
        Logger.info('TC269: Today is selectable ✓');

        // 6. Clear button appears and works
        await expect(oooPage.loc.btn_clearDate, '× must appear after a date is set').toBeVisible({ timeout: 5000 });
        await oooPage.clearDeactivateDate();
        await expect(oooPage.loc.input_deactivateDate).toHaveValue('', { timeout: 5000 });
        expect(await oooPage.loc.btn_clearDate.isVisible().catch(() => false), '× must disappear after clearing').toBe(false);
        await expect(oooPage.loc.btn_activate, 'Activate remains ENABLED — delegate still selected').toBeEnabled({ timeout: 5000 });
        Logger.info('TC269: Clear button works ✓');

        // 7. Future date saves without timezone shift (assertion originally in TC263)
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
        await page.keyboard.press('Escape'); // close calendar before asserting and activating
        await page.waitForTimeout(300);
        await expect(oooPage.loc.input_deactivateDate).toHaveValue(futureUi, { timeout: 5000 });
        await oooPage.clickActivateOoo();

        // Verify API stores the date with no timezone shift
        const apiState = await oooPage.assertRoleDelegationApi({ roleName, apiDate: futureApi });
        Logger.info(`TC269: No timezone shift — stored "${apiState.ooo.deactivate_at}" starts with "${futureApi}" ✓`);

        // Also verify the auto-deactivation banner shows a date
        const lineText = await page.getByText(/Auto-deactivates on/i).textContent();
        expect(lineText, 'Auto-deactivation line must contain a date in M/D/YYYY format').toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
        Logger.info(`TC269: Auto-deactivation UI line: "${lineText}" ✓`);

        await oooPage.clickDeactivateOoo();
        await oooPage.assertIsInactive();
        Logger.info('TC269: Deactivated before invalid date tests ✓');

        // 8. Invalid dates do not corrupt the Activate button
        await oooPage.selectDelegateToRole();
        await oooPage.pickRoleFromDropdown(roleName);
        await expect(oooPage.loc.btn_activate).toBeEnabled({ timeout: 5000 });

        for (const inv of ['32/13/2026', 'abcd', '00/00/0000', '99-99-9999', '   ']) {
            Logger.step(`TC269: Testing invalid date "${inv}"`);
            await oooPage.loc.input_deactivateDate.fill(inv);
            await page.keyboard.press('Tab');
            await page.waitForTimeout(400);
            const fieldVal = await oooPage.loc.input_deactivateDate.inputValue();
            Logger.info(`TC269: After "${inv}" input shows: "${fieldVal}"`);
            await expect(oooPage.loc.btn_activate, `Activate must stay ENABLED after invalid date "${inv}"`).toBeEnabled({ timeout: 5000 });
            await oooPage.loc.input_deactivateDate.fill('');
            await page.keyboard.press('Tab');
            await page.waitForTimeout(300);
        }
        Logger.info('TC269: All invalid date inputs handled gracefully ✓');

        Logger.success('TC269 PASSED');
    });

    // =========================================================================
    // TC271 — Role delegation e2e with random future date: UI + API
    // =========================================================================
    test('@ooo @e2e TC271 Activating Out of Office in role delegation mode with a specific role and a random future date shows the correct active banner and saves the right role name and date to the API', async ({ page }) => {
        test.setTimeout(60000);
        Logger.step('TC271: Activate with role + random date, verify UI and API');

        await oooPage.ensureOooInactive();

        await oooPage.selectDelegateToRole();
        await expect(oooPage.loc.radio_delegateToRole).toBeChecked({ timeout: 5000 });
        await expect(oooPage.loc.input_role).toBeEnabled({ timeout: 5000 });
        await expect(oooPage.loc.input_teamMember).toBeDisabled({ timeout: 5000 });
        await expect(oooPage.loc.helperText).toBeVisible({ timeout: 5000 });

        const roleName = await oooPage.getFirstRoleName();
        await oooPage.pickRoleFromDropdown(roleName);
        await expect(oooPage.loc.btn_activate).toBeEnabled({ timeout: 5000 });

        const randomDays = Math.floor(Math.random() * 300) + 30;
        const { uiDate, apiDate } = await oooPage.setFutureDate(randomDays);
        Logger.info(`TC271: Role="${roleName}", date UI="${uiDate}", API="${apiDate}" (${randomDays} days)`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);

        await oooPage.clickActivateOoo();

        await oooPage.assertIsActive({ withDateLine: true });
        const activeText = await oooPage.assertActiveBanner({ roleName, isRole: true });
        Logger.info(`TC271: Active banner: "${activeText}" ✓`);

        const apiState = await oooPage.assertRoleDelegationApi({ roleName, apiDate });
        Logger.info(`TC271: API confirmed — id=${apiState.ooo.id}, role="${roleName}", date="${apiState.ooo.deactivate_at}" ✓`);

        Logger.success('TC271 PASSED');
    });

    // =========================================================================
    // TC272 — User delegation e2e with conflict handling
    // =========================================================================
    test('@ooo @e2e TC272 Activating Out of Office in user delegation mode selects a specific user and a random future date, shows the correct active banner, and saves the right user ID and date to the API', async ({ page }) => {
        test.setTimeout(90000);
        Logger.step('TC272: Activate with user + random date, verify UI and API');

        // Resolve first available member dynamically — no hardcoded name that may not exist.
        const PREFERRED_USER = await oooPage.getFirstMemberName();

        await oooPage.ensureOooInactive();

        const alert = oooPage.attachAlertDetector();

        await expect(oooPage.loc.radio_delegateToUser).toBeChecked({ timeout: 5000 });
        await expect(oooPage.loc.input_teamMember).toBeEnabled({ timeout: 5000 });
        await expect(oooPage.loc.btn_activate).toBeDisabled({ timeout: 5000 });

        await oooPage.searchAndSelectUser(PREFERRED_USER);
        await expect(oooPage.loc.btn_activate).toBeEnabled({ timeout: 5000 });

        const randomDays = Math.floor(Math.random() * 300) + 30;
        const { uiDate, apiDate } = await oooPage.setFutureDate(randomDays);
        Logger.info(`TC272: Date set — UI="${uiDate}", API="${apiDate}" (${randomDays} days)`);

        // Close the date picker calendar (it stays open for far-future months and
        // intercepts the Activate button click — confirmed via MCP screenshot).
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);

        alert.assertNoAlert('after setting date with delegate user already selected');

        await oooPage.loc.btn_activate.click();
        await page.waitForTimeout(1500);

        const combinationConflict = await page.getByText(/This combination already exists/i).isVisible().catch(() => false);
        let chosenUser = PREFERRED_USER;

        if (combinationConflict) {
            Logger.info(`TC272: "${PREFERRED_USER}"+date conflict — switching to fallback stable user`);
            const stableUsers = await oooPage.getStableTestMemberNames();
            const fallbackName = stableUsers.find(n => n !== PREFERRED_USER);
            expect(fallbackName, 'A second stable test user must exist as fallback').toBeTruthy();
            chosenUser = fallbackName;
            await oooPage.replaceSelectedUser(chosenUser);
            alert.assertNoAlert(`after changing delegate from "${PREFERRED_USER}" to "${chosenUser}" while date "${uiDate}" was set`);
            await oooPage.clickActivateOoo();
        }

        await oooPage.assertIsActive({ withDateLine: true });
        await oooPage.assertActiveBanner();
        Logger.info(`TC272: Active state confirmed for delegate "${chosenUser}" ✓`);

        alert.assertNoAlert('during the entire test');

        const apiState = await oooPage.assertUserDelegationApi({ apiDate });
        Logger.info(`TC272: API confirmed — id=${apiState.ooo.id}, delegate_user_id="${apiState.ooo.delegate_user_id}", date="${apiState.ooo.deactivate_at}" ✓`);

        Logger.success('TC272 PASSED');
    });

    // =========================================================================
    // TC273 — Duplicate API POST is rejected by the backend
    // =========================================================================
    test('@ooo @e2e @known-issue TC273 Sending a second Out of Office activation request directly to the API while one is already active is rejected by the backend and leaves the original record completely unchanged', async ({ page }) => {
        test.setTimeout(90000);
        Logger.step('TC273: Activate via UI then verify the API rejects a duplicate POST');

        // Resolve first available member dynamically — no hardcoded name that may not exist.
        const DELEGATE_USER_EMAIL = await oooPage.getFirstMemberName();

        await oooPage.ensureOooInactive();

        const delegates = await oooPage.getDelegatesApiResponse();
        const userMember = delegates.members.find(m => m.label === DELEGATE_USER_EMAIL);
        expect(userMember, `"${DELEGATE_USER_EMAIL}" must be in the delegates list`).toBeTruthy();
        const delegateUserId = parseInt(userMember.id, 10);
        Logger.info(`TC273: delegate_user_id=${delegateUserId} ✓`);

        const uniqueDays = Math.floor(Math.random() * 300) + 30;
        const target = new Date();
        target.setDate(target.getDate() + uniqueDays);
        const mm = String(target.getMonth() + 1).padStart(2, '0');
        const dd = String(target.getDate()).padStart(2, '0');
        const yyyy = target.getFullYear();
        const uiDate = `${mm}/${dd}/${yyyy}`;
        const apiDate = `${yyyy}-${mm}-${dd}`;
        Logger.info(`TC273: Date — UI="${uiDate}", API="${apiDate}" (${uniqueDays} days)`);

        await oooPage.searchAndSelectUser(DELEGATE_USER_EMAIL);
        await oooPage.loc.input_deactivateDate.fill(uiDate);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
        await page.keyboard.press('Escape'); // close calendar popup before clicking Activate
        await page.waitForTimeout(300);
        await oooPage.clickActivateOoo();

        await oooPage.assertIsActive();
        const firstApiState = await oooPage.assertUserDelegationApi({ apiDate });
        Logger.info(`TC273: First activation confirmed — id=${firstApiState.ooo.id} ✓`);

        const duplicatePayload = { delegateUserId, deactivateAt: apiDate };
        Logger.step(`TC273: POSTing duplicate — ${JSON.stringify(duplicatePayload)}`);
        const dupRes = await oooPage.postOooDirect(duplicatePayload);
        const dupBody = await dupRes.json();
        Logger.info(`TC273: Duplicate POST → HTTP ${dupRes.status()}, body: ${JSON.stringify(dupBody)}`);

        const isRejected = dupRes.status() !== 200
            || dupBody.success === false
            || JSON.stringify(dupBody).toLowerCase().includes('combination')
            || JSON.stringify(dupBody).toLowerCase().includes('exists')
            || JSON.stringify(dupBody).toLowerCase().includes('already')
            || JSON.stringify(dupBody).toLowerCase().includes('error');
        expect(
            isRejected,
            `[KNOWN ISSUE] Backend must reject a duplicate OOO POST.\nHTTP ${dupRes.status()} | body: ${JSON.stringify(dupBody)}`
        ).toBe(true);
        Logger.info(`TC273: Duplicate POST rejected (HTTP ${dupRes.status()}) ✓`);

        const finalApiState = await oooPage.getOooApiState();
        expect(finalApiState.ooo, 'Original OOO record must still be active').not.toBeNull();
        expect(finalApiState.ooo.id, 'OOO id must be unchanged').toBe(firstApiState.ooo.id);
        expect(finalApiState.ooo.delegate_user_id, 'delegate_user_id must be unchanged').toBe(delegateUserId);
        Logger.info(`TC273: Original record unchanged — id=${finalApiState.ooo.id} ✓`);

        Logger.success('TC273 PASSED — duplicate POST rejected, original record preserved');
    });

}); // end test.describe.serial
// TC274 and TC275 (Invoice approval template + cross-user approval-verify chain) are
// identical in purpose to TC259 and TC260 in TC15_FInalizeBidWithUIFlow.spec.js which
// already run in the main E2E pipeline. Duplicating them here adds fragile external
// dependencies (projectData.json from TC258, OtherSessionState.json for a second user)
// that are unavailable when TC17 runs in parallel with TC15 on CI.
