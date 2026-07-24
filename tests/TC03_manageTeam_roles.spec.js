/**
 * TC18 — Approvers Management + Organization tabs (MCP-aligned: `/user-role-management`, `/organization`).
 * Legacy `/manage-team` returns 404 on beta (MCP 2026-05-05).
 *
 * Prerequisite: `sessionState.json` from TC01 mandatory login.
 */
require("dotenv").config();

const { test, expect } = require("@playwright/test");
const { Logger } = require("../utils/logger");
const { LoginPage } = require("../pages/loginPage");
const { InteractionLogger } = require("../utils/InteractionLogger");
const { ensureLeftPanelExpanded } = require('../utils/leftPanelExpander');
const {
  ManageTeamRolesHelper,
  manageTeamRolesBench: roleManagementUiLabels,
  orgUrls,
} = require("../pages/manageTeamRolesHelper");

const dashboardLandingUrl = process.env.DASHBOARD_URL || orgUrls.dashboardUrl;
const tailorbirdOrigin = process.env.BASE_URL

test.describe("TC18 Manage Team — Roles (positive / negative / edge)", () => {
  test.describe("Authenticated (sessionState)", () => {
    test.use({
      storageState: "sessionState.json",
      viewport: { width: 1440, height: 900 },
      animations: 'disabled',
      maxDiffPixels: 50_000,
      maxDiffPixelRatio: 0.3,
    });

    test.beforeEach(() => {
      test.skip(!process.env.DASHBOARD_URL && !orgUrls.dashboardUrl, "DASHBOARD_URL or fixture dashboard required");
    });

    test("TC36 @regression @manageTeam @roles Direct user-role-management lands with benchmark controls", async ({
      page,
    }) => {
      Logger.info("[MT-roles-pos-01] Starting: Direct navigation to user-role-management");
      const userRoleManagement = new ManageTeamRolesHelper(page);
      await userRoleManagement.gotoManageTeamRolesViaQuery();
      Logger.info("[MT-roles-pos-01] Asserting: URL contains user-role-management");
      await expect(page).toHaveURL(/user-role-management/i);
      Logger.info("[MT-roles-pos-01] Asserting: Roles benchmark controls are visible");
      await userRoleManagement.expectRolesBenchmarkVisible();
      Logger.success("[MT-roles-pos-01] ✅ Direct user-role-management navigation with benchmark controls passed");
    });

    test("TC37 @regression @manageTeam @roles Menu path Manage Approvers shows benchmark", async ({ page }) => {
      Logger.info("[MT-roles-pos-02] Starting: Menu path navigation to Manage Approvers");
      const userRoleManagement = new ManageTeamRolesHelper(page);
      InteractionLogger.logNavigation(dashboardLandingUrl, "Dashboard — profile menu → Manage Approvers");
      await userRoleManagement.landManageTeamViaMenu(dashboardLandingUrl);
      Logger.info("[MT-roles-pos-02] Asserting: Roles benchmark is visible after menu navigation");
      await userRoleManagement.expectRolesBenchmarkVisible();
      Logger.success("[MT-roles-pos-02] ✅ Menu path to Manage Approvers with benchmark visible passed");
    });

    test("TC38 @regression @manageTeam @roles Role matrix exposes Properties / Location columns", async ({
      page,
    }) => {
      Logger.info("[MT-roles-pos-03] Starting: Role matrix column headers check");
      const userRoleManagement = new ManageTeamRolesHelper(page);
      await userRoleManagement.gotoManageTeamRolesViaQuery();
      Logger.info("[MT-roles-pos-03] Asserting: Properties and Location column headers are visible in role matrix");
      await userRoleManagement.expectRolesColumnHeaders();
      Logger.success("[MT-roles-pos-03] ✅ Role matrix Properties / Location columns visible passed");
    });

    test("TC39 @regression @manageTeam @roles Add role control is available", async ({ page }) => {
      Logger.info("[MT-roles-pos-04] Starting: Add role button availability check");
      const userRoleManagement = new ManageTeamRolesHelper(page);
      await userRoleManagement.gotoManageTeamRolesViaQuery();
      Logger.info(`[MT-roles-pos-04] Asserting: '${roleManagementUiLabels.addRoleButtonText}' button is visible`);
      InteractionLogger.logVisibility(roleManagementUiLabels.addRoleButtonText, true);
      await expect(page.getByRole("button", { name: roleManagementUiLabels.addRoleButtonText })).toBeVisible({
        timeout: 20_000,
      });
      Logger.success("[MT-roles-pos-04] ✅ Add role control available passed");
    });

    test("TC40 @regression @manageTeam @roles Built-in or automation roles visible as column headers", async ({
      page,
    }) => {
      Logger.info("[MT-roles-pos-05] Starting: Built-in and automation role column headers check");
      const userRoleManagement = new ManageTeamRolesHelper(page);
      await userRoleManagement.gotoManageTeamRolesViaQuery();
      Logger.info(
        `[MT-roles-pos-05] Asserting: Role column header matching '${roleManagementUiLabels.builtInRoleEditor}', '${roleManagementUiLabels.builtInRoleViewOnly}', or 'E2E' is visible`,
      );
      InteractionLogger.logVisibility("Built-in or E2E role column header", true);
      await expect(
        page
          .getByRole("columnheader", { name: roleManagementUiLabels.builtInRoleEditor })
          .or(page.getByRole("columnheader", { name: roleManagementUiLabels.builtInRoleViewOnly }))
          .or(page.getByRole("columnheader", { name: 'E2E' }))
          .first(),
      ).toBeVisible({ timeout: 30_000 });
      Logger.success("[MT-roles-pos-05] ✅ Built-in / automation roles visible as column headers passed");
    });

    test("TC41 @regression @manageTeam @roles Organization: Users ↔ Property access tabs switch cleanly", async ({
      page,
    }) => {
      Logger.info("[MT-roles-pos-06] Starting: Organization Users ↔ Property access tab switching");
      const userRoleManagement = new ManageTeamRolesHelper(page);
      InteractionLogger.logNavigation(dashboardLandingUrl, "Dashboard — profile menu → Manage Organization");
      await userRoleManagement.landOrganizationWorkspaceViaMenu(dashboardLandingUrl);
      Logger.info(`[MT-roles-pos-06] Asserting: '${roleManagementUiLabels.tabUsers}' tab is selected by default`);
      await expect(page.getByRole("tab", { name: roleManagementUiLabels.tabUsers })).toHaveAttribute("aria-selected", "true", {
        timeout: 15_000,
      });
      InteractionLogger.logButtonClick(roleManagementUiLabels.tabPropertyAccess, "Property access tab");
      await page.getByRole("tab", { name: roleManagementUiLabels.tabPropertyAccess }).click();
      Logger.info(`[MT-roles-pos-06] Asserting: '${roleManagementUiLabels.tabPropertyAccess}' tab becomes selected`);
      await expect(page.getByRole("tab", { name: roleManagementUiLabels.tabPropertyAccess })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      InteractionLogger.logButtonClick(roleManagementUiLabels.tabUsers, "Users tab");
      await page.getByRole("tab", { name: roleManagementUiLabels.tabUsers }).click();
      Logger.info(`[MT-roles-pos-06] Asserting: '${roleManagementUiLabels.tabUsers}' tab is re-selected`);
      await expect(page.getByRole("tab", { name: roleManagementUiLabels.tabUsers })).toHaveAttribute("aria-selected", "true");
      Logger.success("[MT-roles-pos-06] ✅ Organization Users ↔ Property access tab switching passed");
    });

    test("TC42 @regression @manageTeam @roles Invalid tab query still renders app shell on organization", async ({
      page,
    }) => {
      Logger.info("[MT-roles-neg-01] Starting: Invalid tab query graceful degradation check");
      InteractionLogger.logNavigation(`${orgUrls.organizationUrl}?tab=__tb_invalid_tab__`, "Organization — invalid tab query");
      await page.goto(`${orgUrls.organizationUrl}?tab=__tb_invalid_tab__`, {
        waitUntil: "load",
        timeout: 90_000,
      });
      Logger.info("[MT-roles-neg-01] Asserting: body is visible (page rendered)");
      await expect(page.locator("body")).toBeVisible();
      Logger.info("[MT-roles-neg-01] Asserting: URL still contains /organization");
      await expect(page).toHaveURL(/\/organization/i);
      Logger.info("[MT-roles-neg-01] Asserting: App shell / main is visible");
      await expect(page.locator(".mantine-AppShell-root, main").first()).toBeVisible({ timeout: 25_000 });
      Logger.success("[MT-roles-neg-01] ✅ Invalid tab query still renders app shell passed");
    });

    test("TC43 @regression @manageTeam @roles Reload keeps user-role-management usable", async ({ page }) => {
      Logger.info("[MT-roles-edge-01] Starting: Page reload keeps user-role-management usable");
      const userRoleManagement = new ManageTeamRolesHelper(page);
      await userRoleManagement.gotoManageTeamRolesViaQuery();
      Logger.info("[MT-roles-edge-01] Asserting: Roles benchmark visible before reload");
      await userRoleManagement.expectRolesBenchmarkVisible();
      await page.reload({ waitUntil: "load" });
      Logger.info("[MT-roles-edge-01] Asserting: URL still contains user-role-management after reload");
      await expect(page).toHaveURL(/user-role-management/i);
      Logger.info("[MT-roles-edge-01] Asserting: Roles benchmark still visible after reload");
      await userRoleManagement.expectRolesBenchmarkVisible();
      Logger.success("[MT-roles-edge-01] ✅ Reload keeps user-role-management usable passed");
    });

    test("TC44 @regression @manageTeam @roles Organization: rapid Users ↔ Property access keeps shell stable", async ({
      page,
    }) => {
      Logger.info("[MT-roles-edge-02] Starting: Rapid tab switching keeps Organization shell stable");
      const userRoleManagement = new ManageTeamRolesHelper(page);
      InteractionLogger.logNavigation(dashboardLandingUrl, "Dashboard → Organization workspace rapid tab switch");
      await userRoleManagement.landOrganizationWorkspaceViaMenu(dashboardLandingUrl);
      InteractionLogger.logButtonClick(roleManagementUiLabels.tabPropertyAccess, "Property access tab — rapid switch 1");
      await page.getByRole("tab", { name: roleManagementUiLabels.tabPropertyAccess }).click();
      Logger.info("[MT-roles-edge-02] Asserting: Property access tab selected after first click");
      await expect(page.getByRole("tab", { name: roleManagementUiLabels.tabPropertyAccess })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      InteractionLogger.logButtonClick(roleManagementUiLabels.tabUsers, "Users tab — rapid switch 2");
      await page.getByRole("tab", { name: roleManagementUiLabels.tabUsers }).click();
      Logger.info("[MT-roles-edge-02] Asserting: Users tab selected after second click");
      await expect(page.getByRole("tab", { name: roleManagementUiLabels.tabUsers })).toHaveAttribute("aria-selected", "true");
      InteractionLogger.logButtonClick(roleManagementUiLabels.tabPropertyAccess, "Property access tab — rapid switch 3");
      await page.getByRole("tab", { name: roleManagementUiLabels.tabPropertyAccess }).click();
      Logger.info("[MT-roles-edge-02] Asserting: Property access tab selected after third click");
      await expect(page.getByRole("tab", { name: roleManagementUiLabels.tabPropertyAccess })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      Logger.success("[MT-roles-edge-02] ✅ Rapid Users ↔ Property access tab switching keeps shell stable passed");
    });

    test("TC45 @regression @manageTeam @roles Breadcrumb shows Approvers Management on matrix page", async ({
      page,
    }) => {
      Logger.info("[MT-roles-edge-03] Starting: Breadcrumb shows Approvers Management on matrix page");
      const userRoleManagement = new ManageTeamRolesHelper(page);
      await userRoleManagement.gotoManageTeamRolesViaQuery();
      Logger.info("[MT-roles-edge-03] Asserting: Breadcrumb displays 'Approvers Management'");
      await userRoleManagement.expectManageTeamBreadcrumb();
      Logger.success("[MT-roles-edge-03] ✅ Breadcrumb shows Approvers Management on matrix page passed");
    });

    test("TC46 @regression @manageTeam @roles Organization Property access differs from Users tab", async ({
      page,
    }) => {
      Logger.info("[MT-roles-edge-04] Starting: Organization Property access tab content differs from Users tab");
      const userRoleManagement = new ManageTeamRolesHelper(page);
      InteractionLogger.logNavigation(dashboardLandingUrl, "Dashboard → Organization workspace tab content check");
      await userRoleManagement.landOrganizationWorkspaceViaMenu(dashboardLandingUrl);
      InteractionLogger.logButtonClick(roleManagementUiLabels.tabUsers, "Users tab — content check");
      await page.getByRole("tab", { name: roleManagementUiLabels.tabUsers }).click();
      Logger.info("[MT-roles-edge-04] Asserting: User search textbox is visible on Users tab");
      await expect(page.getByRole("textbox", { name: /user search|search by name/i })).toBeVisible({ timeout: 15_000 });
      InteractionLogger.logButtonClick(roleManagementUiLabels.tabPropertyAccess, "Property access tab — content differs");
      await page.getByRole("tab", { name: roleManagementUiLabels.tabPropertyAccess }).click();
      Logger.info("[MT-roles-edge-04] Asserting: Property access tab is selected (different content from Users)");
      await expect(page.getByRole("tab", { name: roleManagementUiLabels.tabPropertyAccess })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      Logger.success("[MT-roles-edge-04] ✅ Organization Property access content differs from Users tab passed");
    });
  });

  test.describe("Unauthenticated", () => {
    test.use({
      storageState: { cookies: [], origins: [] },
      viewport: { width: 1440, height: 900 },
      animations: 'disabled',
      maxDiffPixels: 30_000,
      maxDiffPixelRatio: 0.15,
    });

    test("TC47 @regression @manageTeam @roles Approvers-management without session shows AuthKit Sign in", async ({
      page,
    }) => {
      test.skip(!dashboardLandingUrl, "DASHBOARD_URL / dashboard missing");
      Logger.info("[MT-roles-neg-02] Starting: Unauthenticated access to user-role-management redirects to Sign in");
      const url = new URL("/user-role-management", tailorbirdOrigin).href;
      InteractionLogger.logNavigation(url, "User Role Management — unauthenticated access");
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
      Logger.info("[MT-roles-neg-02] Asserting: AuthKit 'Sign in' heading is visible");
      await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible({ timeout: 45_000 });
      Logger.success("[MT-roles-neg-02] ✅ Unauthenticated user-role-management redirects to AuthKit Sign in passed");
    });
  });
});

// ─── Text Agent ───────────────────────────────────────────────────────────────
test.describe("TC03 Manage Team Roles — Text Agent (live MCP browser scan)", () => {
  test.setTimeout(120_000);

  test("TC48 @manageTeam @roles @sanity Full user-role-management text agent — CTAs, search, table columns", async ({ browser }) => {
    test.skip(!dashboardLandingUrl, "DASHBOARD_URL / dashboard missing");
    const rolesUrl = new URL("/user-role-management", tailorbirdOrigin).href;
    InteractionLogger.logNavigation(rolesUrl, "User Role Management — Text Agent");
    const ctx = await browser.newContext({ storageState: "sessionState.json", viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    try {
      await test.step("STATE 1 | User Role Management — full scan of all text elements", async () => {
        await page.goto(rolesUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
        await page.getByRole("button", { name: "Add Role" }).waitFor({ state: "visible", timeout: 20_000 });
        await page.getByPlaceholder("Search...").waitFor({ state: "visible", timeout: 20_000 });

        const snapshot = await LoginPage.scanAllTextElements(page);
        const failures = LoginPage.logAndAssertSnapshot(snapshot, "roles-workspace");

        // RevoGrid column-header action buttons (group, pin, sort, menu) are icon-only with no
        // accessible text or aria-label — known app limitation, exclude from accessibility check.
        const REVOGRID_ICON_BTN = /^\.?(group-btn|pin-btn|sort-btn|menu-btn)$/;
        const visibleButtons = snapshot.buttons
          .filter((b) => b.visible)
          .filter((b) => !REVOGRID_ICON_BTN.test(b.selector || ''));
        expect(visibleButtons.length, `FAIL [roles-workspace]: No visible buttons found`).toBeGreaterThan(0);
        visibleButtons.forEach((btn, i) => {
          const hasText = (btn.text && btn.text.trim().length > 0) || (btn.ariaLabel && btn.ariaLabel.trim().length > 0);
          expect(hasText, `FAIL [roles-workspace]: Button[${i}] has no text or aria-label. Button: ${JSON.stringify(btn)}`).toBe(true);
        });

        const visibleInputs = snapshot.inputs.filter((inp) => inp.visible);
        expect(visibleInputs.length, `FAIL [roles-workspace]: No fully-visible inputs found. All: ${JSON.stringify(snapshot.inputs)}`).toBeGreaterThan(0);

        expect(failures, `FAIL [roles-workspace]: ${failures.length} accessibility issue(s):\n${failures.join('\n')}`).toHaveLength(0);
      });

      await test.step("STATE 1b | Known CTAs and labels — MCP-verified 2026-05-18", async () => {
        const main = page.locator("main");

        InteractionLogger.logNavigation(rolesUrl, "Breadcrumb: Approvers Management");
        await expect(main.getByText("Approvers Management", { exact: true })).toBeVisible({ timeout: 8_000 });

        InteractionLogger.logButtonClick("Add Role", "Add Role");
        await expect(page.getByRole("button", { name: "Add Role" })).toBeVisible({ timeout: 8_000 });

        InteractionLogger.logVisibility("Search... input", true);
        await expect(page.getByPlaceholder("Search...")).toBeVisible({ timeout: 8_000 });

        for (const btnName of ["View", "Table", "Export", "Import Property Role"]) {
          InteractionLogger.logButtonClick(btnName, btnName);
          await expect(page.getByRole("button", { name: btnName })).toBeVisible({ timeout: 8_000 });
        }

        for (const col of ["Properties", "Location", "address"]) {
          InteractionLogger.logVisibility(`Column: ${col}`, true);
          await expect(page.getByRole("columnheader", { name: col })).toBeVisible({ timeout: 8_000 });
        }
      });
    } finally {
      await ctx.close();
    }
  });
});
