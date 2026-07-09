
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

            // ── Strict FGA scope validation: profile menu options for a Member with single-property access ──
            Logger.step("[TC355] Validating profile menu options for the activated Member user");
            const profileMenuOptions = await activation.getProfileMenuOptions(email);
            Logger.info(`[TC355] Profile menu options visible: ${JSON.stringify(profileMenuOptions)}`);
            expect(profileMenuOptions, "Profile menu must contain exactly Profile and Logout, in that order").toEqual(["Profile", "Logout"]);
            for (const forbiddenOption of ["Manage Approvers", "Manage Organization", "Switch Organization"]) {
                expect(profileMenuOptions, `Profile menu must NOT contain "${forbiddenOption}" for this Member user`).not.toContain(forbiddenOption);
            }
            Logger.success("[TC355] ✅ Profile menu correctly limited to Profile and Logout only");

            // ── Strict FGA scope validation: every row's Property column, on every list page, must be
            // exactly TARGET_PROPERTY — logs and asserts each row individually, never just the first ──
            async function assertGridPropertyColumn(pageLabel) {
                // The grid shell (and its checkbox column) can render before the "Property"
                // column's own data finishes fetching — poll instead of reading once immediately.
                await expect
                    .poll(async () => (await activation.getGridColumnValues("Property")).length, {
                        timeout: 20000,
                        message: `${pageLabel}: waiting for Property column rows to load`,
                    })
                    .toBeGreaterThan(0);

                const values = await activation.getGridColumnValues("Property");
                Logger.info(`[TC355] ${pageLabel} table contains ${values.length} row(s)`);
                values.forEach((value, idx) => {
                    Logger.info(`[TC355] ${pageLabel} Row ${idx + 1} Property = ${value}`);
                });
                expect(values.length, `${pageLabel} must contain at least one row scoped to "${TARGET_PROPERTY}"`).toBeGreaterThan(0);
                values.forEach((value, idx) => {
                    expect(value, `${pageLabel} Row ${idx + 1} Property must equal exactly "${TARGET_PROPERTY}" — no other property allowed`).toBe(TARGET_PROPERTY);
                });
                Logger.success(`[TC355] ✅ ${pageLabel}: all ${values.length} row(s) scoped to "${TARGET_PROPERTY}"`);
            }

            Logger.step("[TC355] Navigating to Projects page to validate Property column scope");
            await activation.gotoProjectsPage();
            await assertGridPropertyColumn("Projects");

            Logger.step("[TC355] Navigating to Jobs page to validate Property column scope");
            await activation.gotoJobsPage();
            await assertGridPropertyColumn("Jobs");

            Logger.step("[TC355] Navigating to Bids page to validate Property column scope");
            await activation.gotoBidsPage();
            await assertGridPropertyColumn("Bids");

            Logger.step("[TC355] Navigating to Change Orders page to validate Property column scope");
            await activation.gotoChangeOrdersPage();
            await assertGridPropertyColumn("Change Orders");

            Logger.step("[TC355] Navigating to Invoices page to validate Property column scope");
            await activation.gotoInvoicesPage();
            await assertGridPropertyColumn("Invoices");

            Logger.step("[TC355] Navigating to CapEx page to validate Property column scope");
            await activation.gotoCapexPage();
            await assertGridPropertyColumn("CapEx");

            Logger.step("[TC355] Navigating to Budget page to validate the Property dropdown scope");
            await activation.gotoBudgetPage();
            const budgetPropertyOptions = await activation.getBudgetPropertyDropdownOptions();
            Logger.info(`[TC355] Budget Property dropdown options: ${JSON.stringify(budgetPropertyOptions)}`);
            expect(budgetPropertyOptions, "Budget Property dropdown must contain exactly one option").toHaveLength(1);
            expect(budgetPropertyOptions, `Budget Property dropdown must contain only "${TARGET_PROPERTY}"`).toEqual([TARGET_PROPERTY]);
            Logger.success(`[TC355] ✅ Budget Property dropdown scoped to exactly one property — "${TARGET_PROPERTY}"`);

            Logger.success(`[TC355] ✅ Full activation completed for ${email} (${firstName} ${lastName})`);
        } finally {
            await activation.close();
        }
    });
});
