const { expect } = require('@playwright/test');
const { Logger } = require('../utils/logger');
const OrganizationHelper = require('./organizationHelper');
const { ManageTeamRolesHelper } = require('./manageTeamRolesHelper');
const fgaLocators = require('../locators/fgaLocator');

/**
 * FEAT-972 — FGA (Fine-Grained Access) User Management.
 *
 * New page object. Composes the existing, unmodified OrganizationHelper (invite/search
 * users, Manage Organization navigation) and ManageTeamRolesHelper (land on /organization)
 * instead of touching either — this class only adds the Property access grid and the
 * per-property "assign user" flow, which did not exist anywhere in the framework before.
 *
 * MCP-verified live (2026-07-08) against beta.tailorbird.com/organization, QA Automations org.
 */
class FgaUserManagementPage {
    constructor(page) {
        this.page = page;
        this.organizationHelper = new OrganizationHelper(page);
        this.manageTeamRolesHelper = new ManageTeamRolesHelper(page);
    }

    // ---------------------------------------------------------------------
    // Navigation — delegates to existing, already-verified helpers (reused, unmodified)
    // ---------------------------------------------------------------------

    async gotoOrganization(dashboardUrl) {
        await this.manageTeamRolesHelper.landOrganizationWorkspaceViaMenu(dashboardUrl);
    }

    async inviteMember(email) {
        await this.organizationHelper.inviteUser(email, 'Member');
    }

    async openUsersTab() {
        await this.page.getByRole('tab', { name: fgaLocators.usersTabName }).click();
    }

    async openPropertyAccessTab() {
        Logger.step('Opening Property access tab');
        await this.page.getByRole('tab', { name: fgaLocators.propertyAccessTabName }).click();
        await expect(this.propertyAccessSearchInput()).toBeVisible({ timeout: 15000 });
        // Not getByRole('columnheader'): the header row's cell role flips between
        // "columnheader" and "cell" depending on render/hydration state (MCP/live-run
        // verified) — role="row" itself is stable throughout, so wait on that instead.
        await expect(this.propertyAccessTable().getByRole('row').first()).toBeVisible({ timeout: 15000 });
    }

    // ---------------------------------------------------------------------
    // Property access grid
    // ---------------------------------------------------------------------

    propertyAccessTabPanel() {
        return this.page.getByRole('tabpanel', { name: fgaLocators.propertyAccessTabName });
    }

    propertyAccessSearchInput() {
        return this.propertyAccessTabPanel().getByRole('textbox', { name: fgaLocators.propertyAccessSearchPlaceholder });
    }

    async searchProperty(propertyName) {
        Logger.step(`Searching property access grid for "${propertyName}"`);
        const input = this.propertyAccessSearchInput();
        await input.fill('');
        await input.fill(propertyName);
    }

    propertyAccessTable() {
        return this.propertyAccessTabPanel().getByRole('table');
    }

    getPropertyRow(propertyName) {
        return this.propertyAccessTable().getByRole('row').filter({ hasText: propertyName });
    }

    /** Header cell role flips between "columnheader"/"cell" (see openPropertyAccessTab) — read the header row's cells directly instead of pinning a role. */
    async getColumnHeaderTexts() {
        const headerRow = this.propertyAccessTable().getByRole('row').first();
        return headerRow.locator('th, td, [role="columnheader"], [role="cell"]').allInnerTexts();
    }

    /** Access column renders as e.g. "2 Users"; returns the numeric count. */
    async getAssignedUserCount(propertyName) {
        const row = this.getPropertyRow(propertyName);
        await expect(row).toBeVisible({ timeout: 15000 });
        const accessCell = row.getByRole('cell').nth(2);
        const text = ((await accessCell.textContent()) || '').trim();
        const leadingNumber = text.split(' ')[0];
        const parsed = Number(leadingNumber);
        return Number.isFinite(parsed) ? parsed : null;
    }

    async expectNoPropertiesFound() {
        await expect(this.propertyAccessTabPanel().getByText(fgaLocators.noPropertiesFoundText)).toBeVisible({ timeout: 10000 });
    }

    async clickTransposeView() {
        await this.propertyAccessTabPanel().getByRole('button', { name: fgaLocators.transposeViewButtonName }).click();
    }

    /**
     * Clicks a column header to trigger sorting. Returns the first data row's text
     * before/after so the caller can assert on observed behavior without this helper
     * assuming a specific sort direction (grid re-renders live, no API round trip).
     */
    async sortByColumn(columnName) {
        const table = this.propertyAccessTable();
        const rows = table.getByRole('row');
        const firstRowBefore = await rows.nth(1).innerText().catch(() => '');
        const headerCell = rows.first().locator('th, td, [role="columnheader"], [role="cell"]').filter({ hasText: columnName }).first();
        await headerCell.click();
        await this.page.waitForTimeout(300);
        const firstRowAfter = await rows.nth(1).innerText().catch(() => '');
        return { firstRowBefore, firstRowAfter };
    }

    // ---------------------------------------------------------------------
    // Property Settings → assign-user dialog
    // ---------------------------------------------------------------------

    propertyAccessDialog(propertyName) {
        return this.page.getByRole('dialog', { name: `${fgaLocators.dialogTitlePrefix}${propertyName}` });
    }

    /**
     * Opens the "Property access: {propertyName}" dialog via the row's Settings action.
     * Also captures the property id from the approval-approvers API call the app fires
     * on open, so callers can validate the assign API's propertyId against a real value
     * instead of a hard-coded one.
     * @returns {Promise<{dialog: import('@playwright/test').Locator, propertyId: number|null}>}
     */
    async openPropertySettings(propertyName) {
        Logger.step(`Opening Property access settings for "${propertyName}"`);
        const row = this.getPropertyRow(propertyName);
        await expect(row).toBeVisible({ timeout: 15000 });

        const approversResponsePromise = this.page.waitForResponse(
            (res) => res.url().includes('/api/properties/') && res.url().includes('/approval-approvers') && res.status() === 200,
            { timeout: 15000 },
        ).catch(() => null);

        await row.getByRole('button', { name: fgaLocators.settingsButtonName }).click();

        const dialog = this.propertyAccessDialog(propertyName);
        await expect(dialog).toBeVisible({ timeout: 15000 });

        const approversResponse = await approversResponsePromise;
        const idMatch = approversResponse ? approversResponse.url().match(/\/properties\/(\d+)\//) : null;
        const propertyId = idMatch ? Number(idMatch[1]) : null;
        Logger.info(`Property "${propertyName}" resolved id: ${propertyId}`);

        return { dialog, propertyId };
    }

    async closePropertySettings(propertyName) {
        const dialog = this.propertyAccessDialog(propertyName);
        await dialog.getByRole('banner').getByRole('button').first().click();
        await expect(dialog).toBeHidden({ timeout: 10000 });
    }

    dialogUserRow(dialog, email) {
        return dialog.locator(fgaLocators.dialogUserRowGroup).filter({ hasText: email });
    }

    async searchUserInDialog(dialog, query) {
        const input = dialog.getByPlaceholder(fgaLocators.dialogUserSearchPlaceholder);
        await input.fill('');
        await input.fill(query);
    }

    async isUserCheckedInDialog(dialog, email) {
        const row = this.dialogUserRow(dialog, email);
        await expect(row).toBeVisible({ timeout: 15000 });
        return row.getByRole('checkbox').isChecked();
    }

    /**
     * Full assign flow: open Settings for propertyName, check the target user's
     * checkbox, and capture the POST /api/user-property-access request/response.
     * @returns {Promise<{dialog: import('@playwright/test').Locator, propertyId: number|null, status: number, ok: boolean, requestBody: any, responseBody: any}>}
     */
    async assignUserToProperty(propertyName, email) {
        const { dialog, propertyId } = await this.openPropertySettings(propertyName);
        await this.searchUserInDialog(dialog, email);

        const row = this.dialogUserRow(dialog, email);
        await expect(row).toBeVisible({ timeout: 15000 });
        const checkbox = row.getByRole('checkbox');

        const assignResponsePromise = this.page.waitForResponse(
            (res) => res.url().endsWith('/api/user-property-access') && res.request().method() === 'POST',
            { timeout: 15000 },
        );

        Logger.step(`Assigning "${email}" to property "${propertyName}"`);
        // Not checkbox.check(): its post-click re-verification races the live re-render
        // this UI triggers on a successful assign (count/toast update swaps the row's
        // DOM node) and throws "did not change state" even though the click — and the
        // API call below — succeeded (MCP/live-run verified). The awaited response is
        // the authoritative confirmation here, not Playwright's own checked-state poll.
        await checkbox.click();

        const response = await assignResponsePromise;
        const requestBody = response.request().postDataJSON();
        const responseBody = await response.json().catch(() => null);

        Logger.info(`Assign API request: ${JSON.stringify(requestBody)}`);
        Logger.info(`Assign API response [${response.status()}]: ${JSON.stringify(responseBody)}`);

        return {
            dialog,
            propertyId,
            status: response.status(),
            ok: response.ok(),
            requestBody,
            responseBody,
        };
    }

    async expectAccessGrantedToast() {
        const toast = this.page.getByText(fgaLocators.accessGrantedToastMessage);
        await expect(toast).toBeVisible({ timeout: 10000 });
    }

    // ---------------------------------------------------------------------
    // Invite API validation (Users tab)
    // ---------------------------------------------------------------------

    /**
     * Wraps OrganizationHelper.inviteUser() (reused, unmodified) with capture of the
     * underlying WorkOS "invite-user" widget API call. Note: that third-party API's
     * response body is just `{ success: true }` — no invitation id or email is echoed
     * back (MCP-verified live). For an id-bearing record use getOrganizationUserByEmail().
     */
    async inviteMemberAndCaptureApi(email) {
        const inviteResponsePromise = this.page.waitForResponse(
            (res) => res.url().includes('/_widgets/UserManagement/invite-user') && res.request().method() === 'POST',
            { timeout: 20000 },
        );

        await this.organizationHelper.inviteUser(email, 'Member');

        const response = await inviteResponsePromise;
        const requestBody = response.request().postDataJSON();
        const responseBody = await response.json().catch(() => null);

        Logger.info(`Invite API request: ${JSON.stringify(requestBody)}`);
        Logger.info(`Invite API response [${response.status()}]: ${JSON.stringify(responseBody)}`);

        return {
            status: response.status(),
            ok: response.ok(),
            requestBody,
            responseBody,
        };
    }

    /**
     * Reads this app's own GET /api/organization/users and returns the entry matching
     * email — the real id-bearing record backing the "Invited" badge, used as the
     * invitation-id proxy since the WorkOS widget API does not return one.
     * Uses page.request (shares the page's session/cookies) rather than reload +
     * waitForResponse: a reload doesn't reliably re-issue this fetch on every run
     * (live-run verified — timed out waiting for it), whereas a direct authenticated
     * GET is deterministic for a pure read-only lookup.
     */
    async getOrganizationUserByEmail(email) {
        const response = await this.page.request.get('/api/organization/users?role=member');
        const body = await response.json().catch(() => null);
        const users = body?.users || [];
        return users.find((u) => u.email === email) || null;
    }

    async validateInvitedBadge(email) {
        const row = this.page.getByRole('row').filter({ hasText: email });
        await this.organizationHelper.validateInvitedBadge(row, email);
    }

    /**
     * Negative flow: reuses OrganizationHelper.openInvite() (unmodified) to open the
     * dialog, then submits an email expected to already be invited and captures the
     * resulting 400 response + inline validation error. The dialog is left open on
     * failure (matches live app behavior, MCP-verified) — caller is responsible for
     * closing it via inviteUserPanel.dialogRoot's Cancel button.
     */
    async attemptDuplicateInvite(email) {
        const inviteUserPanel = await this.organizationHelper.openInvite();
        await inviteUserPanel.emailAddressInput.fill(email);

        const inviteResponsePromise = this.page.waitForResponse(
            (res) => res.url().includes('/_widgets/UserManagement/invite-user') && res.request().method() === 'POST',
            { timeout: 20000 },
        );

        await inviteUserPanel.nextOrInvitePrimaryButton.click();

        const response = await inviteResponsePromise;
        const responseBody = await response.json().catch(() => null);

        Logger.info(`Duplicate invite API response [${response.status()}]: ${JSON.stringify(responseBody)}`);

        return {
            dialogRoot: inviteUserPanel.dialogRoot,
            emailAddressInput: inviteUserPanel.emailAddressInput,
            status: response.status(),
            ok: response.ok(),
            responseBody,
        };
    }
}

module.exports = { FgaUserManagementPage };
