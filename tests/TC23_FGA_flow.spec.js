
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { test, expect } = require("@playwright/test");
const { Logger } = require("../utils/logger");
const { InteractionLogger } = require("../utils/InteractionLogger");
const { FgaUserManagementPage } = require("../pages/fgaUserManagementPage");
const { orgUrls } = require("../pages/manageTeamRolesHelper");
const { UserActivationPage } = require("../pages/userActivationPage");
const fgaTexts = require("../fixture/fga_cta_texts.json");

const dashboardLandingUrl = process.env.DASHBOARD_URL || orgUrls.dashboardUrl;
const TARGET_PROPERTY = "Test Property 1_Cottages on Elm";
const CREATED_USERS_FILE = path.join(__dirname, "../data/fgaCreatedUsers.json");

/**
 * Random every call — timestamp + random suffix avoids collisions even within the same
 * millisecond. Lowercase throughout: the app itself normalizes invited emails to lowercase
 * (MCP/live-run verified), so generating lowercase avoids a spurious case mismatch against
 * what later renders in the Users table.
 */
function generateFgaTestUser(prefix = "fga") {
    const randomSuffix = Math.random().toString(36).slice(2, 8);
    const email = `${prefix}_${Date.now()}_${randomSuffix}@yopmail.com`;
    return { email, prefix, randomSuffix };
}

/** Appends to data/fgaCreatedUsers.json (array) — does not overwrite prior runs' records. */
function saveCreatedUser(record) {
    let existing = [];
    if (fs.existsSync(CREATED_USERS_FILE)) {
        try {
            const parsed = JSON.parse(fs.readFileSync(CREATED_USERS_FILE, "utf8"));
            if (Array.isArray(parsed)) existing = parsed;
        } catch (err) {
            Logger.info(`[FGA] Could not parse existing fgaCreatedUsers.json, starting fresh: ${err.message}`);
        }
    }
    existing.push(record);
    fs.mkdirSync(path.dirname(CREATED_USERS_FILE), { recursive: true });
    fs.writeFileSync(CREATED_USERS_FILE, JSON.stringify(existing, null, 2));
    Logger.info(`[FGA] Saved created user to data/fgaCreatedUsers.json: ${JSON.stringify(record)}`);
}

test.describe("FEAT-972 FGA User Management", () => {
    test.use({
        storageState: "sessionState.json",
        viewport: { width: 1440, height: 900 },
    });

    test.beforeEach(() => {
        test.skip(!dashboardLandingUrl, "DASHBOARD_URL or fixture dashboard required");
    });

    test("TC350 @sanity @regression @FGA : Invite user and assign property access successfully", async ({ page }) => {
        const fga = new FgaUserManagementPage(page);
        const { email } = generateFgaTestUser("testmember");

        InteractionLogger.logNavigation(dashboardLandingUrl, "Dashboard — profile menu → Manage Organization");
        await fga.gotoOrganization(dashboardLandingUrl);
        Logger.info("[TC350] Asserting: URL is /organization");
        await expect(page).toHaveURL(/\/organization/);

        Logger.step(`[TC350] Inviting new member: ${email}`);
        const inviteResult = await fga.inviteMemberAndCaptureApi(email);
        Logger.info("[TC350] Asserting: invite API responded 201 with success:true");
        expect(inviteResult.status).toBe(201);
        expect(inviteResult.ok).toBeTruthy();
        expect(inviteResult.responseBody).toEqual({ success: true });
        expect(inviteResult.requestBody.email, "Invite request body must carry the exact invited email").toBe(email);

        saveCreatedUser({ email, role: "Member", testCase: "TC350", purpose: "invite + property assignment", createdAt: new Date().toISOString() });

        await fga.validateInvitedBadge(email);
        Logger.success(`[TC350] Invite verified — badge shown for ${email}`);

        Logger.step("[TC350] Navigating to Property access tab");
        await fga.openPropertyAccessTab();
        await fga.searchProperty(TARGET_PROPERTY);

        const beforeCount = await fga.getAssignedUserCount(TARGET_PROPERTY);
        Logger.info(`[TC350] Existing assigned user count for "${TARGET_PROPERTY}": ${beforeCount}`);
        expect(beforeCount, `"${TARGET_PROPERTY}" must show a numeric Access count before assignment`).not.toBeNull();

        const assignResult = await fga.assignUserToProperty(TARGET_PROPERTY, email);
        Logger.info("[TC350] Asserting: assign API responded 200 with success:true");
        expect(assignResult.status).toBe(200);
        expect(assignResult.ok).toBeTruthy();
        expect(assignResult.responseBody).toEqual({ success: true });
        expect(assignResult.requestBody.userId, "Assign request must carry the invited user's id").toBeTruthy();
        expect(assignResult.propertyId, "Property id must resolve from the approval-approvers API fired on Settings open").not.toBeNull();
        expect(assignResult.requestBody.propertyId, "Assign request propertyId must match the property actually opened").toBe(assignResult.propertyId);

        await fga.expectAccessGrantedToast();
        await fga.closePropertySettings(TARGET_PROPERTY);

        const afterCount = await fga.getAssignedUserCount(TARGET_PROPERTY);
        Logger.info(`[TC350] Access count after assignment: ${afterCount}`);
        expect(afterCount, "Access count must increase by exactly one after assignment").toBe(beforeCount + 1);

        Logger.success(`[TC350] ✅ Invite + property access assignment completed for ${email}`);
    });

    test("TC351 @regression @FGA : Validate property access page functionality — headers, search, sort, empty state, actions", async ({ page }) => {
        const fga = new FgaUserManagementPage(page);
        await fga.gotoOrganization(dashboardLandingUrl);
        await fga.openPropertyAccessTab();

        Logger.step("[TC351] Validating column headers against fga_cta_texts.json");
        const headers = await fga.getColumnHeaderTexts();
        Logger.info(`[TC351] Headers found: ${JSON.stringify(headers)}`);
        for (const expectedHeader of [
            fgaTexts.column_property,
            fgaTexts.column_location,
            fgaTexts.column_access,
            fgaTexts.column_actions,
        ]) {
            expect(headers, `Expected column "${expectedHeader}" in Property access grid`).toContain(expectedHeader);
        }

        Logger.step("[TC351] Validating search input and Transpose view button are visible");
        await expect(fga.propertyAccessSearchInput()).toBeVisible();
        await expect(
            fga.propertyAccessTabPanel().getByRole("button", { name: fgaTexts.transpose_view_button }),
        ).toBeVisible();

        Logger.step(`[TC351] Searching known fixture property: ${TARGET_PROPERTY}`);
        await fga.searchProperty(TARGET_PROPERTY);
        const row = fga.getPropertyRow(TARGET_PROPERTY);
        await expect(row, "Known fixture property must be found via search").toBeVisible({ timeout: 15000 });
        await expect(
            row.getByRole("button", { name: fgaTexts.settings_button }),
            "Settings action must be visible per row",
        ).toBeVisible();

        Logger.step("[TC351] Validating empty state for a non-existent property");
        await fga.searchProperty(`__no_such_property_${Date.now()}__`);
        await fga.expectNoPropertiesFound();

        Logger.step("[TC351] Re-searching known property and exercising column sort");
        await fga.searchProperty(TARGET_PROPERTY);
        await expect(row).toBeVisible({ timeout: 15000 });
        const sortResult = await fga.sortByColumn(fgaTexts.column_property);
        Logger.info(
            `[TC351] Sort by "${fgaTexts.column_property}" — first row before: "${sortResult.firstRowBefore}", after: "${sortResult.firstRowAfter}"`,
        );
        await expect(fga.propertyAccessTable(), "Grid must remain rendered after clicking a column header").toBeVisible();

        Logger.info(
            "[TC351] Pagination and filter controls are not present on the Property access tab in the current UI (MCP-verified live) — not applicable, no assertion made.",
        );

        Logger.success("[TC351] ✅ Property access page structure validated");
    });

    test("TC352 @regression @FGA : Validate invited user assignment increases property user count by exactly one", async ({ page }) => {
        const fga = new FgaUserManagementPage(page);
        const { email } = generateFgaTestUser("fga_count");

        await fga.gotoOrganization(dashboardLandingUrl);
        Logger.step(`[TC352] Inviting new member: ${email}`);
        await fga.inviteMemberAndCaptureApi(email);
        saveCreatedUser({ email, role: "Member", testCase: "TC352", purpose: "count-delta validation", createdAt: new Date().toISOString() });
        await fga.validateInvitedBadge(email);

        await fga.openPropertyAccessTab();
        await fga.searchProperty(TARGET_PROPERTY);
        const beforeCount = await fga.getAssignedUserCount(TARGET_PROPERTY);
        Logger.info(`[TC352] Count before assignment: ${beforeCount}`);
        expect(beforeCount).not.toBeNull();

        await fga.assignUserToProperty(TARGET_PROPERTY, email);
        await fga.expectAccessGrantedToast();
        await fga.closePropertySettings(TARGET_PROPERTY);

        const afterCount = await fga.getAssignedUserCount(TARGET_PROPERTY);
        Logger.info(`[TC352] Count after assignment: ${afterCount}`);
        expect(afterCount, "Count must increase by exactly one after assigning a single new user").toBe(beforeCount + 1);

        Logger.success(`[TC352] ✅ Count increased by exactly one: ${beforeCount} → ${afterCount}`);
    });

    test("TC353 @regression @FGA : Validate invited user appears with invited badge and correct status after invitation", async ({ page }) => {
        const fga = new FgaUserManagementPage(page);
        const { email } = generateFgaTestUser("fga_badge");

        await fga.gotoOrganization(dashboardLandingUrl);
        Logger.step(`[TC353] Inviting new member: ${email}`);
        await fga.inviteMemberAndCaptureApi(email);
        saveCreatedUser({ email, role: "Member", testCase: "TC353", purpose: "badge/status validation", createdAt: new Date().toISOString() });

        Logger.step(`[TC353] Validating row, email display, and Invited badge for ${email}`);
        const row = page.getByRole("row").filter({ hasText: email });
        await expect(row, "Invited user row must be visible in Users table").toBeVisible({ timeout: 15000 });
        await expect(row, "Email must display correctly in the row").toContainText(email);
        await fga.validateInvitedBadge(email);

        Logger.step("[TC353] Cross-checking via GET /api/organization/users");
        const orgUser = await fga.getOrganizationUserByEmail(email);
        expect(orgUser, `Invited user "${email}" must exist in /api/organization/users`).not.toBeNull();
        expect(orgUser.email).toBe(email);
        expect(orgUser.status, 'Newly invited user must have status "pending" (backs the "Invited" badge)').toBe("pending");
        expect(orgUser.id, "Invitation id (proxy) must exist").toBeTruthy();
        Logger.info(`[TC353] Invitation id (proxy): ${orgUser.id}, status: ${orgUser.status}`);

        Logger.success(`[TC353] ✅ Invited badge + status verified for ${email} (id ${orgUser.id})`);
    });

    test("TC354 @regression @negative @FGA : Duplicate invite using same email is rejected with expected error", async ({ page }) => {
        const fga = new FgaUserManagementPage(page);
        const { email } = generateFgaTestUser("fga_dup");

        await fga.gotoOrganization(dashboardLandingUrl);
        Logger.step(`[TC354] First invite: ${email}`);
        await fga.inviteMemberAndCaptureApi(email);
        saveCreatedUser({ email, role: "Member", testCase: "TC354", purpose: "duplicate-invite negative check", createdAt: new Date().toISOString() });
        await fga.validateInvitedBadge(email);

        Logger.step("[TC354] Re-inviting the same email — expecting rejection");
        const dup = await fga.attemptDuplicateInvite(email);

        Logger.info("[TC354] Asserting: duplicate invite API responded 400 with expected message");
        expect(dup.status).toBe(400);
        expect(dup.ok).toBeFalsy();
        expect(dup.responseBody?.message).toBe(fgaTexts.duplicate_invite_inline_error);

        Logger.info("[TC354] Asserting: dialog stays open with inline validation error");
        await expect(dup.dialogRoot).toBeVisible();
        await expect(dup.dialogRoot.getByText(fgaTexts.duplicate_invite_inline_error)).toBeVisible({ timeout: 10000 });
        await expect(dup.emailAddressInput).toHaveAttribute("aria-invalid", "true");

        await dup.dialogRoot.getByRole("button", { name: "Cancel" }).click();
        await expect(dup.dialogRoot).toBeHidden({ timeout: 10000 });

        Logger.success(`[TC354] ✅ Duplicate invite correctly rejected with "${fgaTexts.duplicate_invite_inline_error}"`);
    });

    test("TC355 @regression @FGA @activation : Invited user completes full account activation via yopmail (name, password, organization) and lands on dashboard", async ({ page, browser }) => {
        const fga = new FgaUserManagementPage(page);
        const { email, randomSuffix } = generateFgaTestUser("fga_activate");
        const firstName = "Test";
        const lastName = `Test${randomSuffix}`;
        const password = process.env.TEST_PASSWORD || "Pitney51@@";

        InteractionLogger.logNavigation(dashboardLandingUrl, "Dashboard — profile menu → Manage Organization");
        await fga.gotoOrganization(dashboardLandingUrl);
        Logger.step(`[TC355] Inviting new member for activation: ${email}`);
        const inviteResult = await fga.inviteMemberAndCaptureApi(email);
        expect(inviteResult.status).toBe(201);
        expect(inviteResult.ok).toBeTruthy();

        saveCreatedUser({ email, role: "Member", testCase: "TC355", purpose: "full activation via yopmail", createdAt: new Date().toISOString() });
        await fga.validateInvitedBadge(email);
        Logger.success(`[TC355] Invite verified — badge shown for ${email}`);

        Logger.step(`[TC355] Granting property access on "${TARGET_PROPERTY}" so the activated user has exactly one property`);
        await fga.openPropertyAccessTab();
        await fga.searchProperty(TARGET_PROPERTY);
        const assignResult = await fga.assignUserToProperty(TARGET_PROPERTY, email);
        expect(assignResult.status).toBe(200);
        expect(assignResult.ok).toBeTruthy();
        await fga.expectAccessGrantedToast();
        await fga.closePropertySettings(TARGET_PROPERTY);
        Logger.success(`[TC355] Property access granted on "${TARGET_PROPERTY}" for ${email}`);

        const activation = await UserActivationPage.create(browser);
        try {
            Logger.step("[TC355] Opening yopmail and the invite email");
            await activation.openInbox(email);
            await activation.openInviteEmailAndLaunchActivation();

            Logger.step("[TC355] Accepting invitation");
            await activation.acceptInvitation();

            Logger.step(`[TC355] Providing first/last name: ${firstName} ${lastName}`);
            await activation.fillNameAndContinue(firstName, lastName);

            Logger.step("[TC355] Setting password from env (TEST_PASSWORD)");
            await activation.setPasswordAndContinue(password);

            Logger.step("[TC355] Completing email OTP verification if AuthKit prompts for it");
            await activation.completeEmailVerificationIfPrompted();

            Logger.step("[TC355] Selecting QA Automations Org_2026 if an organization-selection screen is shown");
            await activation.selectOrganizationIfPrompted("2026");

            Logger.step("[TC355] Asserting activation completed — user landed on dashboard");
            await activation.expectLandedOnDashboard(process.env.DASHBOARD_URL || /financials\/capex/);

            Logger.step("[TC355] Invoking GET /api/properties for the newly activated user");
            const propertiesApiResult = await activation.fetchPropertiesApi();
            Logger.info(`[TC355] Asserting: GET /api/properties responded 200 for the newly activated user`);
            expect(propertiesApiResult.status).toBe(200);
            expect(propertiesApiResult.ok).toBeTruthy();
            Logger.info(`[TC355] /api/properties returned properties: ${JSON.stringify(propertiesApiResult.propertyNames)}`);
            expect(propertiesApiResult.propertyNames, "API must return exactly one property for the newly activated user").toHaveLength(1);
            expect(propertiesApiResult.propertyNames, `API must return only "${TARGET_PROPERTY}" — no other property`).toEqual([TARGET_PROPERTY]);
            Logger.success(`[TC355] ✅ API confirmed exactly one property — "${TARGET_PROPERTY}"`);

            Logger.step("[TC355] Cross-checking the same on the rendered Properties page UI");
            await activation.gotoPropertiesPage();
            const visibleProperties = await activation.getVisiblePropertyNames();
            Logger.info(`[TC355] Properties rendered in UI: ${JSON.stringify(visibleProperties)}`);
            expect(visibleProperties, `"${TARGET_PROPERTY}" must be visible to the newly activated user`).toContain(TARGET_PROPERTY);
            expect(visibleProperties, `No property other than "${TARGET_PROPERTY}" should render in the UI`).toEqual([TARGET_PROPERTY]);
            Logger.success(`[TC355] ✅ UI confirmed exactly one property visible — "${TARGET_PROPERTY}" — and no others`);

            Logger.step("[TC355] Cross-checking activation via GET /api/organization/users");
            const orgUser = await fga.getOrganizationUserByEmail(email);
            expect(orgUser, `Activated user "${email}" must exist in /api/organization/users`).not.toBeNull();
            expect(orgUser.status, "Activated user must no longer be in pending status").not.toBe("pending");

            Logger.success(`[TC355] ✅ Full activation completed for ${email} (${firstName} ${lastName})`);
        } finally {
            await activation.close();
        }
    });
});

/**
 * FGA scope validation for an activated Member user with single-property access.
 *
 * TC355 (above) proves the activation flow itself. Everything that used to run inline at
 * the end of that one giant test — profile menu options, per-module grid/dropdown scope —
 * is broken out here into 8 test cases, one per module, per the requested breakdown.
 *
 * Session reuse: activating a user via yopmail + AuthKit is by far the slowest part of this
 * flow (multiple inbox polls, ~30-90s). Repeating it for all 8 cases below would be both
 * slow and wasteful, so it runs exactly ONCE in beforeAll, and its authenticated
 * storageState is captured and reused to spin up a fresh, independent context/page per
 * test — the same "session file" pattern used elsewhere in this framework
 * (test.use({ storageState: 'sessionState.json' })), just captured at runtime instead of
 * being a pre-existing checked-in file, since this session belongs to a brand-new user
 * created fresh on every run.
 *
 * Parallel-safe: every test below creates its own context/page from the shared
 * storageState and closes it when done, so none share mutable state and
 * test.describe.configure({ mode: 'parallel' }) can safely schedule them concurrently.
 * Note: with this repo's playwright.config.js pinned to workers: 1, they still execute
 * one at a time in practice; the beforeAll below would only re-run per additional worker
 * process if that pin is ever raised.
 */
test.describe("FEAT-972 FGA scope validation — activated Member user (single-property access)", () => {
    test.describe.configure({ mode: "parallel" });

    /** @type {Awaited<ReturnType<import('@playwright/test').BrowserContext['storageState']>> | null} */
    let sharedStorageState = null;
    let sharedEmail = null;

    test.beforeAll(async ({ browser }) => {
        test.skip(!dashboardLandingUrl, "DASHBOARD_URL or fixture dashboard required");

        const adminContext = await browser.newContext({ storageState: "sessionState.json" });
        const adminPage = await adminContext.newPage();
        const fga = new FgaUserManagementPage(adminPage);
        const { email, randomSuffix } = generateFgaTestUser("fga_scope");
        const firstName = "Test";
        const lastName = `Test${randomSuffix}`;
        const password = process.env.TEST_PASSWORD || "Pitney51@@";

        Logger.step(`[FGA scope setup] Inviting new member for scope validation: ${email}`);
        await fga.gotoOrganization(dashboardLandingUrl);
        const inviteResult = await fga.inviteMemberAndCaptureApi(email);
        expect(inviteResult.status).toBe(201);
        expect(inviteResult.ok).toBeTruthy();
        saveCreatedUser({ email, role: "Member", testCase: "TC356-374", purpose: "FGA scope validation (shared session)", createdAt: new Date().toISOString() });
        await fga.validateInvitedBadge(email);

        Logger.step(`[FGA scope setup] Granting property access on "${TARGET_PROPERTY}" so the activated user has exactly one property`);
        await fga.openPropertyAccessTab();
        await fga.searchProperty(TARGET_PROPERTY);
        const assignResult = await fga.assignUserToProperty(TARGET_PROPERTY, email);
        expect(assignResult.status).toBe(200);
        expect(assignResult.ok).toBeTruthy();
        await fga.expectAccessGrantedToast();
        await fga.closePropertySettings(TARGET_PROPERTY);
        await adminContext.close();
        Logger.success(`[FGA scope setup] Property access granted on "${TARGET_PROPERTY}" for ${email}`);

        const activation = await UserActivationPage.create(browser);
        try {
            Logger.step("[FGA scope setup] Opening yopmail and the invite email");
            await activation.openInbox(email);
            await activation.openInviteEmailAndLaunchActivation();
            await activation.acceptInvitation();
            await activation.fillNameAndContinue(firstName, lastName);
            await activation.setPasswordAndContinue(password);
            await activation.completeEmailVerificationIfPrompted();
            await activation.selectOrganizationIfPrompted("2026");
            await activation.expectLandedOnDashboard(process.env.DASHBOARD_URL || /financials\/capex/);

            sharedStorageState = await activation.context.storageState();
            sharedEmail = email;
            Logger.success(`[FGA scope setup] ✅ Activated ${email} and captured its session for reuse across all scope-validation cases`);
        } finally {
            await activation.close();
        }
    });

    /**
     * Spins up a fresh, isolated context/page from the shared activated-user session and
     * navigates it straight to the dashboard (so gotoXPage()'s relative navigation has a
     * real origin to resolve against — a brand-new page starts at about:blank).
     * @param {import('@playwright/test').Browser} browser
     */
    async function newAuthenticatedActivation(browser) {
        const context = await browser.newContext({ storageState: sharedStorageState });
        const page = await context.newPage();
        await page.goto(process.env.DASHBOARD_URL || dashboardLandingUrl, { waitUntil: "load" });
        return { context, activation: UserActivationPage.fromAuthenticatedSession(context, page) };
    }

    /** Poll-then-read: the grid shell can render before the named column's data finishes fetching. */
    async function getScopedGridValues(activation, columnHeader, pageLabel) {
        await expect
            .poll(async () => (await activation.getGridColumnValues(columnHeader)).length, {
                timeout: 20000,
                message: `${pageLabel}: waiting for ${columnHeader} column rows to load`,
            })
            .toBeGreaterThan(0);
        const values = await activation.getGridColumnValues(columnHeader);
        values.forEach((value, idx) => Logger.info(`[FGA scope] ${pageLabel} Row ${idx + 1} ${columnHeader} = ${value}`));
        return values;
    }

    test("TC356 @regression @FGA @scope : Profile menu access is scoped correctly — Profile/Logout visible, org-admin options restricted", async ({ browser }) => {
        const { context, activation } = await newAuthenticatedActivation(browser);
        try {
            const options = await activation.getProfileMenuOptions(sharedEmail);
            Logger.info(`[TC356] Profile menu options: ${JSON.stringify(options)}`);

            expect(options, 'Profile menu must contain "Profile"').toContain("Profile");
            Logger.success('[TC356] ✅ "Profile" option is visible');

            expect(options, 'Profile menu must contain "Logout"').toContain("Logout");
            Logger.success('[TC356] ✅ "Logout" option is visible');

            for (const forbiddenOption of ["Manage Approvers", "Manage Organization", "Switch Organization"]) {
                expect(options, `Profile menu must NOT contain "${forbiddenOption}" for this Member user`).not.toContain(forbiddenOption);
                Logger.success(`[TC356] ✅ "${forbiddenOption}" correctly restricted`);
            }

            Logger.success("[TC356] ✅ Verified Profile menu access and validated restricted options are hidden.");
        } finally {
            await context.close();
        }
    });

    test("TC357 @regression @FGA @scope : Project visibility is limited to the assigned property only", async ({ browser }) => {
        const { context, activation } = await newAuthenticatedActivation(browser);
        try {
            await activation.gotoProjectsPage();
            const values = await getScopedGridValues(activation, "Property", "Projects");
            Logger.info(`[TC357] Projects table contains ${values.length} row(s)`);

            expect(values.length, `Projects must contain at least one row scoped to "${TARGET_PROPERTY}"`).toBeGreaterThan(0);
            expect(values, `"${TARGET_PROPERTY}" must be visible in the Projects Property column`).toContain(TARGET_PROPERTY);

            values.forEach((value, idx) => {
                expect(value, `Projects Row ${idx + 1} Property must equal exactly "${TARGET_PROPERTY}" — no other property allowed`).toBe(TARGET_PROPERTY);
            });

            Logger.success(`[TC357] ✅ Verified Project visibility is limited to the assigned property only (${values.length} row(s), all "${TARGET_PROPERTY}").`);
        } finally {
            await context.close();
        }
    });

    test("TC358 @regression @FGA @scope : Job visibility is limited to the assigned property only", async ({ browser }) => {
        const { context, activation } = await newAuthenticatedActivation(browser);
        try {
            await activation.gotoJobsPage();
            const values = await getScopedGridValues(activation, "Property", "Jobs");
            Logger.info(`[TC358] Jobs table contains ${values.length} row(s)`);

            expect(values.length, `Jobs must contain at least one row scoped to "${TARGET_PROPERTY}"`).toBeGreaterThan(0);
            expect(values, `"${TARGET_PROPERTY}" must be visible in the Jobs Property column`).toContain(TARGET_PROPERTY);

            values.forEach((value, idx) => {
                expect(value, `Jobs Row ${idx + 1} Property must equal exactly "${TARGET_PROPERTY}" — no other property allowed`).toBe(TARGET_PROPERTY);
            });

            Logger.success(`[TC358] ✅ Verified Job visibility is limited to the assigned property only (${values.length} row(s), all "${TARGET_PROPERTY}").`);
        } finally {
            await context.close();
        }
    });

    test("TC359 @regression @FGA @scope : CapEx module shows only the assigned property", async ({ browser }) => {
        const { context, activation } = await newAuthenticatedActivation(browser);
        try {
            await activation.gotoCapexPage();
            const values = await getScopedGridValues(activation, "Property", "CapEx");
            Logger.info(`[TC359] CapEx table contains ${values.length} row(s)`);

            expect(values.length, `CapEx must contain at least one row scoped to "${TARGET_PROPERTY}"`).toBeGreaterThan(0);
            expect(values, `"${TARGET_PROPERTY}" must be visible in the CapEx Property column`).toContain(TARGET_PROPERTY);

            values.forEach((value, idx) => {
                expect(value, `CapEx Row ${idx + 1} Property must equal exactly "${TARGET_PROPERTY}" — no additional property allowed`).toBe(TARGET_PROPERTY);
            });

            Logger.success(`[TC359] ✅ Verified CapEx module shows only the assigned property (${values.length} row(s), all "${TARGET_PROPERTY}").`);
        } finally {
            await context.close();
        }
    });

    test("TC360 @regression @FGA @scope : Bid visibility is limited to the assigned property only", async ({ browser }) => {
        const { context, activation } = await newAuthenticatedActivation(browser);
        try {
            await activation.gotoBidsPage();
            const values = await getScopedGridValues(activation, "Property", "Bids");
            Logger.info(`[TC360] Bids table contains ${values.length} row(s)`);

            expect(values.length, `Bids must contain at least one row scoped to "${TARGET_PROPERTY}"`).toBeGreaterThan(0);
            expect(values, `"${TARGET_PROPERTY}" must be visible in the Bids Property column`).toContain(TARGET_PROPERTY);

            values.forEach((value, idx) => {
                expect(value, `Bids Row ${idx + 1} Property must equal exactly "${TARGET_PROPERTY}" — no other property allowed`).toBe(TARGET_PROPERTY);
            });

            Logger.success(`[TC360] ✅ Verified Bid visibility is limited to the assigned property only (${values.length} row(s), all "${TARGET_PROPERTY}").`);
        } finally {
            await context.close();
        }
    });

    test("TC361 @regression @FGA @scope : Change Order visibility is limited to the assigned property only", async ({ browser }) => {
        const { context, activation } = await newAuthenticatedActivation(browser);
        try {
            await activation.gotoChangeOrdersPage();
            const values = await getScopedGridValues(activation, "Property", "Change Orders");
            Logger.info(`[TC361] Change Orders table contains ${values.length} row(s)`);

            expect(values.length, `Change Orders must contain at least one row scoped to "${TARGET_PROPERTY}"`).toBeGreaterThan(0);
            expect(values, `"${TARGET_PROPERTY}" must be visible in the Change Orders Property column`).toContain(TARGET_PROPERTY);

            values.forEach((value, idx) => {
                expect(value, `Change Orders Row ${idx + 1} Property must equal exactly "${TARGET_PROPERTY}" — no other property allowed`).toBe(TARGET_PROPERTY);
            });

            Logger.success(`[TC361] ✅ Verified Change Order visibility is limited to the assigned property only (${values.length} row(s), all "${TARGET_PROPERTY}").`);
        } finally {
            await context.close();
        }
    });

    test("TC362 @regression @FGA @scope : Invoice visibility is limited to the assigned property only", async ({ browser }) => {
        const { context, activation } = await newAuthenticatedActivation(browser);
        try {
            await activation.gotoInvoicesPage();
            const values = await getScopedGridValues(activation, "Property", "Invoices");
            Logger.info(`[TC362] Invoices table contains ${values.length} row(s)`);

            expect(values.length, `Invoices must contain at least one row scoped to "${TARGET_PROPERTY}"`).toBeGreaterThan(0);
            expect(values, `"${TARGET_PROPERTY}" must be visible in the Invoices Property column`).toContain(TARGET_PROPERTY);

            values.forEach((value, idx) => {
                expect(value, `Invoices Row ${idx + 1} Property must equal exactly "${TARGET_PROPERTY}" — no other property allowed`).toBe(TARGET_PROPERTY);
            });

            Logger.success(`[TC362] ✅ Verified Invoice visibility is limited to the assigned property only (${values.length} row(s), all "${TARGET_PROPERTY}").`);
        } finally {
            await context.close();
        }
    });

    test("TC363 @regression @FGA @scope : Budget property dropdown contains only the assigned property", async ({ browser }) => {
        const { context, activation } = await newAuthenticatedActivation(browser);
        try {
            await activation.gotoBudgetPage();
            const budgetPropertyOptions = await activation.getBudgetPropertyDropdownOptions();
            Logger.info(`[TC363] Budget Property dropdown options: ${JSON.stringify(budgetPropertyOptions)}`);

            expect(budgetPropertyOptions, `Budget Property dropdown must contain "${TARGET_PROPERTY}"`).toContain(TARGET_PROPERTY);
            expect(budgetPropertyOptions, "Budget Property dropdown must contain exactly one option").toHaveLength(1);
            expect(budgetPropertyOptions, `Budget Property dropdown must contain only "${TARGET_PROPERTY}" — no additional property`).toEqual([TARGET_PROPERTY]);

            Logger.success(`[TC363] ✅ Verified Budget property dropdown contains only the assigned property ("${TARGET_PROPERTY}").`);
        } finally {
            await context.close();
        }
    });
});
