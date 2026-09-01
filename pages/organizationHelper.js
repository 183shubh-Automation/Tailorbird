const { expect } = require("@playwright/test");
const organizationLocators = require("../locators/organization");
const data = require("../fixture/organization.json");
const { healingLocator } = require("../utils/locatorHealer");

class OrganizationHelper {
  constructor(page) {
    this.page = page;
  }

  /**
   * Healed "User actions" row-menu button. Strategy definitions live in
   * locators/organization.js (userActionsButtonStrategies — 4 independent
   * strategies, see that file for the MCP-verification rationale). `scope` lets
   * callers pass a row-scoped locator (revoke's primary attempt) or the page
   * itself (rowIndex-correlated fallback, openFirstMenu's fallback).
   * @param {import('@playwright/test').Locator} scope
   */
  userActionsButton(scope) {
    return healingLocator(organizationLocators.userActionsButtonStrategies(scope));
  }

  /**
   * Organization → Users tab search field, scoped to the main app shell so we never target a hidden
   * global “Search” control from another surface (MCP + TC13: visible User search only).
   */
  organizationUsersTabSearchInput() {
    const mainContent = this.page.locator(".mantine-AppShell-main").first();
    return mainContent
      .getByRole("textbox", { name: /^User search$/i })
      .or(mainContent.locator(organizationLocators.searchInputPlaceholder))
      .or(
        mainContent.getByRole("textbox", {
          name: /search by name or e-mail|search by name or email/i,
        }),
      )
      .first();
  }

  log(msg) {
    console.log(`[OrganizationHelper] ${msg}`);
  }

  fillDynamic(str, email) {
    return str.replace("{{email}}", email);
  }

  async goto(url) {
    const startTime = Date.now();
    try {
      this.log(`Navigating to URL: ${url}`);
      await this.page.goto(url, { waitUntil: 'domcontentloaded' });

      const appShell = this.page
        .locator('.mantine-AppShell-main, .mantine-AppShell-navbar, main')
        .first();

      const loaded = await appShell
        .waitFor({ state: 'visible', timeout: 20_000 })
        .then(() => true)
        .catch(() => false);

      if (loaded) {
        this.log(`Navigation successful: ${url} (${Date.now() - startTime}ms)`);
        return;
      }

      for (let i = 0; i < 3; i++) {
        await this.page.waitForTimeout(5000);
        const ok = await appShell.isVisible().catch(() => false);
        if (ok) {
          this.log(`Navigation successful after extra ${(i + 1) * 5}s: ${url} (${Date.now() - startTime}ms)`);
          return;
        }
        this.log(`[goto] App shell not yet visible after ${(i + 1) * 5}s extra wait`);
      }

      this.log(`[goto] WARNING: App shell not visible after ${Date.now() - startTime}ms for ${url} — proceeding anyway`);
    } catch (err) {
      this.log(`ERROR navigating to ${url} after ${Date.now() - startTime}ms: ${err}`);
      throw err;
    }
  }

  async goToOrganization() {
    const navbar = this.page.locator('.mantine-AppShell-navbar');
    const avatar = navbar.locator('.mantine-Avatar-root').last();
    // CI can be slow to render the user avatar after the app shell appears — try once, reload, retry
    const avatarVisible = await avatar.waitFor({ state: 'visible', timeout: 30_000 }).then(() => true).catch(() => false);
    if (!avatarVisible) {
      this.log('Avatar not found after 30s — reloading page and retrying');
      await this.page.reload({ waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(3000);
      await avatar.waitFor({ state: 'visible', timeout: 30_000 });
    }
    await avatar.click();

    const menu = this.page
      .locator('[role="menu"]')
      .filter({ has: this.page.getByRole('menuitem', { name: /^Logout$/i }) })
      .first();
    await menu.waitFor({ state: 'visible', timeout: 15_000 });

    const itemLabels = (await menu.getByRole('menuitem').allInnerTexts()).map((t) => t.trim());
    console.log(`[OrganizationHelper] User menu items: ${JSON.stringify(itemLabels)}`);

    // Product copy: user shell shows "Manage Organization" (see ClientWrapper.tsx); legacy tests referenced "Manage Team".
    const manageEntry = this.page
      .getByRole("menuitem", { name: /^(Manage Team|Manage Organization)$/i })
      .or(this.page.getByRole("button", { name: /^(Manage Team|Manage Organization)$/i }));
    await manageEntry.first().waitFor({ state: "visible", timeout: 20_000 });
    await manageEntry.first().click();

    const crumbs = this.page.locator(".mantine-Breadcrumbs-root");
    await expect(
      crumbs.filter({ hasText: /Organization|Team/i }).first(),
    ).toBeVisible({ timeout: 30_000 });
    await expect(this.page).toHaveURL(/\/(organization|manage-team)(\/.+)?([?#]|$)/i);
  }

  /** User menu → Manage Approvers (property × role matrix; replaces legacy /manage-team for roles UI). */
  async goToUserRoleManagement() {
    const navbar = this.page.locator('.mantine-AppShell-navbar');
    await navbar.locator('.mantine-Avatar-root').last().waitFor({ state: 'visible', timeout: 20_000 });
    await navbar.locator('.mantine-Avatar-root').last().click();

    const menu = this.page
      .locator('[role="menu"]')
      .filter({ has: this.page.getByRole('menuitem', { name: /^Logout$/i }) })
      .first();
    await menu.waitFor({ state: 'visible', timeout: 15_000 });

    await this.page.getByRole('menuitem', { name: /Manage Approvers/i }).first().waitFor({ state: 'visible', timeout: 20_000 });
    await this.page.getByRole('menuitem', { name: /Manage Approvers/i }).first().click();

    await expect(this.page).toHaveURL(/\/user-role-management(\/|$|\?)/i, { timeout: 35_000 });
  }

  /**
   * Collects Mantine field errors inside the open invite dialog (exact copy for benchmark tests).
   * @returns {Promise<string[]>}
   */
  async getInviteDialogInputErrors() {
    const dialogRoot = this.page.getByRole("dialog").filter({ hasText: /invite user/i }).first();
    const errs = dialogRoot.locator(".mantine-Input-error");
    const n = await errs.count();
    const texts = [];
    for (let i = 0; i < n; i++) {
      texts.push((await errs.nth(i).innerText()).trim());
    }
    return texts;
  }

  async openInvite() {
    try {
      this.log("Opening Invite User dialog...");
      const inviteUserLauncher = this.page.locator(organizationLocators.inviteButton);
      await inviteUserLauncher.click();
      this.log("Invite button clicked");
      const dialogRoot = this.page.getByRole("dialog").filter({ hasText: /invite user/i }).first();
      await expect(dialogRoot).toBeVisible();
      this.log("Invite dialog opened successfully");
      return {
        dialogRoot,
        emailAddressInput: dialogRoot.getByLabel(/email address(es)?/i),
        roleSelectTrigger: dialogRoot.locator(organizationLocators.dialogRoleSelect),
        confirmInviteButton: dialogRoot.locator(`button:has-text("${data.inviteButtonText}")`),
        nextOrInvitePrimaryButton: dialogRoot.getByRole("button", { name: /^(Next|Invite)$/i }),
      };
    } catch (err) {
      this.log("ERROR opening invite dialog: " + err);
      throw err;
    }
  }

  async selectRole(roleSelectTrigger, roleName, inviteDialogRoot) {
    try {
      const dialogScoped =
        inviteDialogRoot || this.page.getByRole("dialog").filter({ hasText: /invite user/i }).first();
      const orgAdmin = dialogScoped.getByRole("checkbox", { name: /organization admin/i });
      if (roleName === "Admin") {
        // Checking "Organization admin" alone flips the wizard's primary button straight to
        // "Invite" (enabled) — no Organization role selection is needed or possible for admins.
        if (await orgAdmin.isVisible().catch(() => false)) await orgAdmin.check();
        return;
      }
      if (await orgAdmin.isVisible().catch(() => false)) await orgAdmin.uncheck();
      // For non-admin invites, an Organization role is required for "Next" to enable
      // (the field's "Optional" placeholder only means it's optional when Organization admin is checked).
      const mapped = roleName === "Member" ? data.inviteMappedLegacyMemberRole : roleName;
      const orgRoleTrigger = dialogScoped.getByRole("textbox", { name: /organization role/i });
      await orgRoleTrigger.click();
      const choice = this.page.getByRole("option", { name: mapped, exact: true });
      await expect(choice, `Expected organization role option "${mapped}"`).toBeVisible({ timeout: 15_000 });
      await choice.click();
      await expect
        .poll(async () => dialogScoped.getByRole("button", { name: data.inviteWizardNextText }).isEnabled(), {
          timeout: 20_000,
          message: `Next should enable after choosing role "${mapped}" (Manage Team invite drawer)`,
        })
        .toBeTruthy();
    } catch (err) {
      this.log(`ERROR selecting role ${roleName}: ${err}`);
      throw err;
    }
  }

  /**
   * @param {{propertyName?: string}} [options] - Which property to pick in the mandatory
   *   "Property access" step (see below). Defaults to whichever property sorts first.
   */
  async inviteUser(email, role, options = {}) {
    try {
      this.log(`Inviting user: ${email} with role: ${role}`);
      const invitePanel = await this.openInvite();
      await invitePanel.dialogRoot.getByText("Loading roles",{timeout: 10000}).waitFor({ state: "hidden", timeout: 60_000 }).catch(() => {});
      this.log(`Filling email...${email}`);
      await invitePanel.emailAddressInput.fill(email,{delay: 50});
      this.log(`Selecting role: ${role}`);
      await this.selectRole(invitePanel.roleSelectTrigger, role, invitePanel.dialogRoot);
      this.log("Advancing invite wizard (Next)...");
      await invitePanel.nextOrInvitePrimaryButton.evaluate((el) => el.click());
      // Non-admin invites land on a mandatory "Property access" step before the wizard's
      // own Invite button will do anything (MCP-verified live) — Admin invites skip this
      // step entirely since the Next click above was already the final submit (see selectRole()).
      // This DOES grant the invited user real access to whichever property is picked here
      // (MCP-verified live: it shows up in that user's own GET /api/properties once
      // activated) — it is a separate mechanism from the per-property "Property access" tab
      // / user-property-access API tests assign against afterwards (that one's Access-count
      // checkbox does NOT reflect this pick), but callers asserting an activated user's total
      // property list must pass options.propertyName to keep both mechanisms pointed at the
      // same property.
      const propertyAccessTrigger = invitePanel.dialogRoot.getByRole("button", { name: /search and add properties/i });
      if (await propertyAccessTrigger.isVisible({ timeout: 8000 }).catch(() => false)) {
        this.log("Property access step shown — selecting a property to satisfy the required field");
        await propertyAccessTrigger.click();
        const propertyPopover = this.page
          .locator(".mantine-Popover-dropdown")
          .filter({ has: this.page.getByPlaceholder("Search properties") });
        await expect(propertyPopover, "Property picker popover must open").toBeVisible({ timeout: 10_000 });
        if (options.propertyName) {
          await propertyPopover.getByPlaceholder("Search properties").fill(options.propertyName);
        }
        await propertyPopover.getByRole("checkbox").first().click();
        await propertyPopover.getByRole("button", { name: "Close" }).click();
      }
      await this.page.waitForTimeout(2000);
      const confirmInvite = invitePanel.dialogRoot.getByRole("button", { name: data.inviteButtonText, exact: true });

      // The app re-fetches the members list itself once an invite is accepted — confirmed live
      // via MCP browser: GET /api/organization/users fires again right after the invite POST
      // completes, with no manual reload needed. Wait for that instead of a hard page reload
      // with networkidle (this repo's documented rule: never use networkidle — org/financial
      // pages keep background network activity alive, so it hangs instead of resolving in CI).
      // Registered before the submitting click below so a fast-firing refetch can't be missed.
      const usersRefetchPromise = this.page.waitForResponse(
        (res) => res.url().includes('/api/organization/users') && res.request().method() === 'GET' && res.status() === 200,
        { timeout: 25_000 },
      ).then(() => true).catch(() => false);

      if (await confirmInvite.isVisible({ timeout: 10_000 }).catch(() => false)) {
        await confirmInvite.evaluate((el) => el.click());
        // Wait for the invite dialog to close — signals the backend accepted the invite
        await invitePanel.dialogRoot.waitFor({ state: "hidden", timeout: 40_000 }).catch(() => {});
      }

      const refetched = await usersRefetchPromise;
      if (!refetched) {
        // Fallback safety net for a slow CI backend that doesn't auto-refresh in time — a real
        // reload, but domcontentloaded + an explicit element wait, never networkidle.
        this.log("Members list did not auto-refresh after invite — falling back to a reload.");
        await this.page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
        const appShell = this.page.locator('.mantine-AppShell-main, .mantine-AppShell-navbar, main').first();
        await appShell.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {});
      }
      await this.page.waitForTimeout(refetched ? 1500 : 7500);
      const inviteDialog = invitePanel.dialogRoot;
      if (
        await inviteDialog
          .getByRole("heading", { name: "Create role" })
          .isVisible()
          .catch(() => false)
      ) {
        throw new Error(
          "Invite drawer advanced to ‘Create role’ — organization role was not applied; check Mantine Select / overlay handling.",
        );
      }
      this.log("Waiting for invited user to appear in grid...");
      // Filter the member grid by email so the newly invited (pending) user is visible even
      // though it's a virtualized RevoGrid (not a plain <table> — new rows off the currently
      // rendered window won't exist in the DOM at all without filtering, MCP-verified live).
      const _memberSearch = this.organizationUsersTabSearchInput();
      if (await _memberSearch.isVisible({ timeout: 3000 }).catch(() => false)) {
        await _memberSearch.fill(email);
        await this.page.waitForTimeout(1500);
      }
      await expect(this.page.getByRole("row").filter({ hasText: email }).first()).toBeVisible({
        timeout: 120_000,
      });
      if (await invitePanel.dialogRoot.isVisible().catch(() => false)) {
        await this.page.keyboard.press("Escape");
      }
      this.log(`User invited successfully → ${email}`);
    } catch (err) {
      this.log(`ERROR inviting user ${email}: ${err}`);
      throw err;
    }
  }

  async search(searchQuery) {
    try {
      this.log(`Searching for: ${searchQuery}`);
      const userSearchInput = this.organizationUsersTabSearchInput();
      await userSearchInput.waitFor({ state: "visible", timeout: 60_000 });
      await userSearchInput.fill(searchQuery);
      await this.page.waitForTimeout(1800);
      this.log(`Search completed: ${searchQuery}`);
    } catch (err) {
      this.log(`ERROR searching ${searchQuery}: ${err}`);
      throw err;
    }
  }

  async gotoOrganizationWorkspace() {
    await this.goto(process.env.DASHBOARD_URL || data.dashboardUrl);
    await this.goToOrganization();
  }

  /** Clears organization user search (regression / reset between cases). */
  async clearOrganizationSearch() {
    await this.page.locator(".mantine-AppShell-main").first().waitFor({ state: "visible", timeout: 60_000 });
    const userSearchInput = this.organizationUsersTabSearchInput();
    await userSearchInput.waitFor({ state: "visible", timeout: 60_000 });
    await userSearchInput.fill("");
    await this.page.waitForTimeout(800);
  }

  /**
   * The Users grid no longer renders a styled "Invited" badge for pending members — the
   * Status column is now a plain "Pending" text cell (MCP-verified live 2026-07-26; the old
   * `span.rt-Badge.woswidgets-badge` markup this used to look for doesn't exist anymore).
   */
  async validateInvitedBadge(row, email) {
    try {
      this.log(`Validating pending invite status for: ${email}`);
      const pendingStatus = row.getByText("Pending", { exact: true });
      await expect(pendingStatus).toBeVisible({ timeout: 4000 });
      this.log(`Pending status is visible for: ${email}`);
      return true;
    } catch (err) {
      this.log(`❌ ERROR validating pending invite status for ${email}: ${err}`);
      throw err;
    }
  }

  async visibleRowCount() {
    try {
      // The Users grid is a RevoGrid treegrid (role="row"), not a plain <table> — the old
      // `table tbody tr.rt-TableRow` markup doesn't exist anymore (MCP-verified live 2026-07-26).
      const count = await this.page.getByRole("row").count();
      this.log(`Visible row count: ${count}`);
      return count;
    } catch (err) {
      this.log("ERROR fetching visible row count: " + err);
      throw err;
    }
  }

  async getRow(text) {
    try {
      this.log(`Locating row with text: ${text}`);
      const row = this.page.getByRole("row").filter({ hasText: text }).first();
      await row.waitFor({ state: "visible", timeout: 15000 });
      this.log(`Row found for: ${text}`);
      return row;
    } catch (err) {
      this.log(`ERROR locating row for ${text}: ${err}`);
      throw err;
    }
  }

  async revoke(row, email) {
    try {
      this.log(`Revoking invitation for: ${email}`);
      const menu = this.userActionsButton(row);
      // Short timeout: this locator is scoped to the data-pane row and the "User actions"
      // button lives in a structurally separate actions-pane row (MCP-verified live), so this
      // can never resolve — waiting the full default timeout here only burns real-world time
      // that risks the grid/DOM drifting before the (working) fallback below even starts.
      await menu.click({ timeout: 3000 });
      this.log("Opened user action menu.");
      await this.page.locator(organizationLocators.menuItemRevoke).click();
      this.log("Clicked 'Revoke invite'.");
      const modal = this.page.locator(organizationLocators.modal);
      await expect(modal).toBeVisible({ timeout: 5000 });
      this.log("Revoke modal visible.");
      const title = modal.locator(organizationLocators.modalTitle);
      await expect(title).toHaveText(data.revokeDialogTitle);
      this.log("Revoke dialog title validated.");
      const expectedMsg = this.fillDynamic(data.revokeDialogMessage, email);
      const msgLocator = modal.locator("p");
      const actualMsg = (await msgLocator.innerText()).trim();
      this.log("Extracted message: " + actualMsg);
      await expect(msgLocator).toHaveText(expectedMsg);
      this.log("Revoke message validated.");
      await modal.locator(`button:has-text("${data.revokeConfirmButton}")`).click();
      this.log("Clicked revoke confirm.");
      await modal.waitFor({ state: "hidden" });
      this.log(`Invitation revoked for ${email}.`);
    } catch (err) {
      this.log(`❌ ERROR revoking invitation for ${email}: ${err}`);
      // MCP-verified live (2026-07-28): the Users tab now renders as a revo-grid instead of
      // the native <table> these locators were written for. Each row is split across two
      // separate DOM subtrees (a "data" pane and an "actions" pane) that both carry the same
      // data-rgrow index but are NOT in an ancestor/descendant relationship — so
      // row.locator(userActionsBtn) above can never find the actions pane's "User actions"
      // button, no matter how long it waits. This fallback re-locates that button by
      // correlating on the shared data-rgrow index instead, then completes the exact same
      // revoke flow as above.
      try {
        const rowIndex = await row.getAttribute("data-rgrow");
        if (rowIndex === null) throw err;
        this.log(`Falling back to grid actions-pane lookup for row index ${rowIndex}...`);
        const actionsPaneRow = this.page.locator(`[role="row"][data-rgrow="${rowIndex}"]`);
        const actionsBtn = this.userActionsButton(actionsPaneRow).first();
        await actionsBtn.click({ timeout: 15000 });
        this.log("Opened user action menu (fallback).");
        await this.page.locator(organizationLocators.menuItemRevoke).click();
        this.log("Clicked 'Revoke invite' (fallback).");
        const fallbackModal = this.page.locator(organizationLocators.modal);
        await expect(fallbackModal).toBeVisible({ timeout: 5000 });
        this.log("Revoke modal visible (fallback).");
        const fallbackTitle = fallbackModal.locator(organizationLocators.modalTitle);
        await expect(fallbackTitle).toHaveText(data.revokeDialogTitle);
        this.log("Revoke dialog title validated (fallback).");
        const fallbackExpectedMsg = this.fillDynamic(data.revokeDialogMessage, email);
        const fallbackMsgLocator = fallbackModal.locator("p");
        const fallbackActualMsg = (await fallbackMsgLocator.innerText()).trim();
        this.log("Extracted message (fallback): " + fallbackActualMsg);
        await expect(fallbackMsgLocator).toHaveText(fallbackExpectedMsg);
        this.log("Revoke message validated (fallback).");
        await fallbackModal.locator(`button:has-text("${data.revokeConfirmButton}")`).click();
        this.log("Clicked revoke confirm (fallback).");
        await fallbackModal.waitFor({ state: "hidden" });
        this.log(`Invitation revoked for ${email} (fallback).`);
        return;
      } catch (fallbackErr) {
        this.log(`❌ Fallback also failed revoking invitation for ${email}: ${fallbackErr}`);
      }
      throw err;
    }
  }

  async verifyNoResults() {
    try {
      this.log("Verifying organization user search empty state...");
      // Live copy (MCP-verified 2026-07-26): "No users match your search." — replaced the
      // older "No users found for query '<term>'" copy. Hardcoded here rather than reusing
      // data.noResultsText: that fixture key is shared with properties.js for a different
      // (Properties table) empty-state message, so it can't just be updated in place.
      await expect(this.page.getByText('No users match your search.')).toBeVisible({ timeout: 15_000 });
      this.log("Empty search state verified.");
    } catch (err) {
      this.log("ERROR verifying no results: " + err);
      throw err;
    }
  }

  async openFirstMenu() {
    try {
      this.log("Opening first row menu...");
      // Short timeout: 'table tbody tr:first-child ...' can never match (no <table> renders
      // anymore, MCP-verified live) — waiting a long timeout here only burns real-world time
      // that risks the grid/DOM drifting before the (working) fallback below even starts.
      // (The {timeout:40000} previously here was passed to .locator(), which doesn't accept
      // that option, so .click() was actually still using the ~55s default action timeout.)
      await this.page.locator(organizationLocators.firstRowMenuBtn).click({ timeout: 3000 });
      this.log("First row menu opened.");
    } catch (err) {
      this.log("ERROR opening first row menu: " + err);
      // MCP-verified live (2026-07-28): the Users tab no longer renders a native <table> at
      // all — it's a revo-grid now — so 'table tbody tr:first-child ...' can never match a
      // single element, regardless of timeout. Fall back to the grid's own first row
      // (data-rgrow="0") and its row-index-correlated actions-pane "User actions" button.
      try {
        this.log("Falling back to grid actions-pane lookup for the first row...");
        const firstActionsPaneRow = this.page.locator('[role="row"][data-rgrow="0"]');
        const actionsBtn = this.userActionsButton(firstActionsPaneRow).first();
        await actionsBtn.click({ timeout: 15000 });
        this.log("First row menu opened (fallback).");
        return;
      } catch (fallbackErr) {
        this.log("❌ Fallback also failed opening first row menu: " + fallbackErr);
      }
      throw err;
    }
  }

  async resendInvite(email) {
    try {
      this.log(`Initiating resend invite for: ${email}`);
      await this.page.locator(organizationLocators.menuItemResend).click();
      this.log("Clicked Resend.");
      // MCP-verified live (2026-07-29): the resend confirmation is a Mantine Modal —
      // role="dialog" (not "alertdialog"), with its title in an <h2> (not <h1>).
      const firstDialog = this.page.getByRole("dialog").filter({ hasText: data.resendDialogTitle });
      await expect(firstDialog).toBeVisible();
      this.log("First Resend dialog visible.");
      await expect(firstDialog.locator("h2")).toHaveText(data.resendDialogTitle);
      this.log("First title validated.");
      const expectedMsg = this.fillDynamic(data.resendDialogMessage, email);
      const msgLocator = firstDialog.locator("p");
      const actualMsg = (await msgLocator.innerText()).trim();
      this.log("First message: " + actualMsg);
      await expect(msgLocator).toHaveText(expectedMsg);
      this.log("First message validated.");
      await firstDialog.locator(`button:has-text("${data.resendConfirmButton}")`).click();
      this.log("Clicked Resend.");
    } catch (err) {
      this.log("❌ ERROR in resendInvite: " + err);
      throw err;
    }
  }

  async verifyResendSuccess(email) {
    try {
      this.log("Verifying resend success notification...");
      // MCP-verified live (2026-07-29): the post-resend confirmation is a Mantine
      // Notification toast — role="alert" (not "dialog"), no heading tag at all (title is
      // a plain div), and it auto-dismisses on its own after a few seconds, so this must
      // grab it immediately after resendInvite() returns rather than assuming it lingers.
      const secondDialog = this.page.getByRole("alert").filter({ hasText: data.resendSuccessTitle });
      await expect(secondDialog).toBeVisible({ timeout: 8000 });
      this.log("Success notification visible.");
      await expect(secondDialog.getByText(data.resendSuccessTitle, { exact: true })).toBeVisible();
      this.log("Title validated.");
      const expectedMsg = this.fillDynamic(data.resendSuccessMessage, email);
      const actualMsg = (await secondDialog.innerText()).trim();
      this.log("Message: " + actualMsg);
      expect(actualMsg).toContain(expectedMsg);
      this.log("Message validated.");
      // The close (X) button has no accessible name here — it's icon-only — so target it
      // structurally (the notification's own button) instead of by text.
      await secondDialog.getByRole("button").first().click();
      this.log("Clicked Close.");
      await expect(this.page.getByRole("dialog")).toBeHidden({ timeout: 5000 });
      await expect(secondDialog).toBeHidden({ timeout: 5000 });
      this.log("Both dialogs closed.");
    } catch (err) {
      this.log("❌ ERROR verifying resend success: " + err);
      throw err;
    }
  }

  /**
   * Toggles a user between the org-level Admin / Member roles.
   * MCP-verified live 2026-07-26: the old per-row "Edit roles" menu item (Member/Admin
   * checkbox modal) no longer exists — the row's "User actions" menu now only offers
   * "Revoke access". Role editing instead happens via the row's "Edit user" button, which
   * opens the same dialog shape as inviting a user (Email, "Organization admin" checkbox,
   * Organization role dropdown, Save). Toggling that single checkbox is now what flips
   * Admin <-> Member — there's no separate Member checkbox to also uncheck/check.
   */
  async toggleRole(row) {
    try {
      this.log("Opening Edit user...");
      // The Users grid splits its Actions column into a separate pinned pane — the "Edit
      // user" button is NOT a descendant of the data row `row` itself; the two rows share
      // the same aria-rowindex, so match on that instead.
      const rowIndex = await row.getAttribute("aria-rowindex");
      const editButton = this.page
        .locator(`[role="row"][aria-rowindex="${rowIndex}"]`)
        .getByRole("button", { name: "Edit user" });
      await editButton.click();
      const modal = this.page.getByRole("dialog").filter({ hasText: "Edit user" });
      await modal.waitFor({ state: "visible", timeout: 10000 });
      const adminCheckbox = modal.getByRole("checkbox", { name: /organization admin/i });
      const isAdminChecked = await adminCheckbox.isChecked();
      const next = isAdminChecked ? data.roles[1] : data.roles[0];
      const current = isAdminChecked ? data.roles[0] : data.roles[1];
      this.log(`Current: ${current}, Changing to: ${next}`);
      await adminCheckbox.click();
      await modal.getByRole("button", { name: "Save" }).click();
      await modal.waitFor({ state: "hidden" });
      this.log(`Role changed: ${current} → ${next}`);
      return next;
    } catch (err) {
      this.log("ERROR toggling role: " + err);
      throw err;
    }
  }

  /**
   * Reads a user's current Admin/Member state via the "Edit user" dialog's "Organization
   * admin" checkbox — the grid's own "Role" column shows the *custom* Organization role
   * (e.g. "View Only") or "—", never the literal "Admin"/"Member" text, so it can't be used
   * to verify this (MCP-verified live 2026-07-26).
   */
  async verifyUpdatedRole(email, expectedRole) {
    try {
      this.log(`Verifying updated role for ${email}`);
      await this.page.waitForTimeout(5000);
      const row = await this.getRow(email);
      const rowIndex = await row.getAttribute("aria-rowindex");
      const editButton = this.page
        .locator(`[role="row"][aria-rowindex="${rowIndex}"]`)
        .getByRole("button", { name: "Edit user" });
      await editButton.click();
      const modal = this.page.getByRole("dialog").filter({ hasText: "Edit user" });
      await modal.waitFor({ state: "visible", timeout: 10000 });
      const adminCheckbox = modal.getByRole("checkbox", { name: /organization admin/i });
      const updatedRole = (await adminCheckbox.isChecked()) ? data.roles[0] : data.roles[1];
      this.log(`Fetched updated role: ${updatedRole}`);
      await modal.getByRole("button", { name: "Cancel" }).click();
      await modal.waitFor({ state: "hidden" });
      expect(updatedRole).toBe(expectedRole);
      this.log(`Role verification PASSED → ${email}: ${updatedRole} == ${expectedRole}`);
      return updatedRole;
    } catch (err) {
      this.log(`ERROR verifying updated role for ${email}. Expected ${expectedRole}. Error: ${err}`);
      throw err;
    }
  }
}

module.exports = OrganizationHelper;
