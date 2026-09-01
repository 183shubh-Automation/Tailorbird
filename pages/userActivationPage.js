const { expect } = require('@playwright/test');
const { Logger } = require('../utils/logger');
const { healingLocator } = require('../utils/locatorHealer');
const {
    profileMenuTriggerStrategies,
    profileMenuStrategies,
    propertiesGridStrategies,
    propertyCardStrategies,
    budgetPropertySelectorButtonStrategies,
    budgetPropertyDropdownStrategies,
} = require('../locators/userActivationLocator');

/**
 * Drives the full "accept invite" activation flow for a brand-new invited user:
 * mailinator inbox -> "Open Tailorbird" link -> AuthKit accept-invitation -> sign-up
 * (first/last name) -> password -> email OTP verification -> (optional) organization
 * selection -> landing on the dashboard.
 *
 * Runs in its own, unauthenticated BrowserContext (via create()) so it never touches
 * the admin session used elsewhere in the suite (sessionState.json).
 *
 * MCP-verified live (2026-08-02) against mailinator.com's public inbox (both its UI at
 * mailinator.com/v4/public/inboxes.jsp and its unauthenticated public JSON API at
 * api.mailinator.com/api/v2/domains/public/...) and
 * stalwart-collection-11-staging.authkit.app (QA Automations Org_2026 invite).
 *
 * Switched from yopmail.com (2026-08-02): yopmail began showing a CAPTCHA that blocked
 * automated inbox access. Mailinator's public inbox needs no login/CAPTCHA for a
 * "<name>@mailinator.com" address, and its JSON API returns full message content
 * directly (including the invite link in the plain-text body, unwrapped from any
 * click-tracking redirect) — more robust than the previous iframe-based mail scraping,
 * since it removes the dependency on scraping a live inbox UI/iframe entirely.
 */
class UserActivationPage {
    /**
     * @param {import('@playwright/test').BrowserContext} context
     * @param {import('@playwright/test').Page} mailCheckPage
     */
    constructor(context, mailCheckPage) {
        this.context = context;
        this.mailCheckPage = mailCheckPage;
        this.activationPage = null;
        this.mailboxLocalPart = null;
    }

    /** @param {import('@playwright/test').Browser} browser */
    static async create(browser) {
        const context = await browser.newContext();
        const mailCheckPage = await context.newPage();
        return new UserActivationPage(context, mailCheckPage);
    }

    /**
     * Wraps an already-authenticated page/context (typically created from a storageState
     * captured after a prior run of the full activation flow) so callers can reuse the
     * post-activation navigation/assertion methods (gotoXPage, getProfileMenuOptions,
     * getGridColumnValues, ...) without repeating the mailinator + AuthKit dance every time.
     * @param {import('@playwright/test').BrowserContext} context
     * @param {import('@playwright/test').Page} page
     */
    static fromAuthenticatedSession(context, page) {
        const instance = new UserActivationPage(context, null);
        instance.activationPage = page;
        return instance;
    }

    /**
     * Navigates to the public inbox UI (purely so a headed run shows the actual inbox —
     * message retrieval itself goes through the JSON API below, not this page) and
     * records the mailbox's local part (Mailinator's inbox name) for later API polling.
     */
    async openInbox(email) {
        this.mailboxLocalPart = email.split('@')[0];
        Logger.step(`[Activation] Opening mailinator inbox for ${email}`);
        await this.mailCheckPage.goto(
            `https://www.mailinator.com/v4/public/inboxes.jsp?to=${this.mailboxLocalPart}`,
            { waitUntil: 'load' },
        );
    }

    /**
     * Polls Mailinator's public JSON API (GET /api/v2/domains/public/inboxes/<name>,
     * unauthenticated) until a message whose subject matches subjectPattern appears, and
     * returns that message's summary object (which carries the "id" needed to fetch its
     * full body). A fresh request each poll — unlike the previous yopmail iframe, there is
     * no local page state to go stale, so no reload is needed between attempts.
     *
     * ROOT CAUSE (MCP + local --workers=4 reproduction, 2026-08-02): the FGA scope-
     * validation describe block below runs in `mode: "parallel"`, so Playwright starts a
     * SEPARATE `beforeAll` per worker that picks up one of its tests — under CI's
     * --workers=4 that means up to 4 concurrent invite+activate flows, each sending its
     * own invite email through the same real backend at once. The original 60s budget is
     * enough in isolation (confirmed via a single-worker local run) but not once that
     * email-sending pipeline is queuing 4 concurrent invites, which reproducibly pushed
     * one mail past 60s locally. Raised to give real headroom for that queueing delay
     * rather than a blind guess.
     */
    async waitForMailinatorMessage(subjectPattern, timeoutMs = 180000) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const response = await this.mailCheckPage.request.get(
                `https://api.mailinator.com/api/v2/domains/public/inboxes/${this.mailboxLocalPart}`,
            );
            const body = await response.json().catch(() => null);
            const match = (body?.msgs || []).find((m) => subjectPattern.test(m.subject || ''));
            if (match) return match;
            await this.mailCheckPage.waitForTimeout(3000);
        }
        throw new Error(`[Activation] Mail matching "${subjectPattern}" did not arrive within ${timeoutMs}ms`);
    }

    /**
     * Fetches a Mailinator message's full body (GET /api/v2/domains/public/messages/<id>).
     * Prefers the text/plain part (Tailorbird's own body, un-redirected links); falls back
     * to the text/html part when a message arrives without one — observed live on CI
     * (GitHub Actions), where a message can be stored with only its HTML part even though
     * the same template usually ships a plain-text alternative alongside it. Also retries
     * a few times before giving up: mailinator can return a message's metadata (from the
     * inbox list) slightly before its parts have fully synced server-side, so a part that's
     * missing on the first read can appear moments later.
     */
    async fetchMailinatorMessageText(messageId, { retries = 4, retryDelayMs = 2500 } = {}) {
        let lastError;
        for (let attempt = 1; attempt <= retries; attempt++) {
            const response = await this.mailCheckPage.request.get(
                `https://api.mailinator.com/api/v2/domains/public/messages/${messageId}`,
            );
            const body = await response.json().catch(() => null);
            const parts = body?.parts || [];
            const plainPart = parts.find((p) => (p.headers?.['content-type'] || '').includes('text/plain'));
            if (plainPart?.body) {
                return plainPart.body;
            }
            const htmlPart = parts.find((p) => (p.headers?.['content-type'] || '').includes('text/html'));
            if (htmlPart?.body) {
                Logger.info(`[Activation] Message ${messageId} has no text/plain part — falling back to its text/html part`);
                return htmlPart.body;
            }
            lastError = new Error(`[Activation] Message ${messageId} has no text/plain or text/html part to read (attempt ${attempt}/${retries})`);
            if (attempt < retries) {
                await this.mailCheckPage.waitForTimeout(retryDelayMs);
            }
        }
        throw lastError;
    }

    /**
     * Finds the invite mail, reads its body for the "Open Tailorbird" link, and opens
     * that link directly in a brand-new page — the AuthKit "Accept invitation" screen.
     * MCP-verified live: the plain-text body's link is the direct, un-redirected
     * destination URL (the HTML part's link goes through a click-tracking redirect
     * domain instead), so navigating straight to it is both simpler and more reliable
     * than clicking through an email UI and waiting on a tracking redirect to resolve.
     * @returns {Promise<import('@playwright/test').Page>}
     */
    async openInviteEmailAndLaunchActivation() {
        const inviteMessage = await this.waitForMailinatorMessage(/invited you to Tailorbird/);
        Logger.step('[Activation] Reading invite email body for the activation link');
        const bodyText = await this.fetchMailinatorMessageText(inviteMessage.id);
        // Plain-text bodies wrap the un-redirected link in "<...>"; HTML-only bodies (the
        // text/plain fallback case above) carry it as an <a href="..."> instead — try the
        // "Open Tailorbird" CTA specifically first (avoids picking a logo/footer link), then
        // fall back to the first https href in the document.
        const linkMatch =
            bodyText.match(/<(https:\/\/[^\s>]+)>/) ||
            bodyText.match(/<a\b[^>]*href="(https:\/\/[^"]+)"[^>]*>\s*Open Tailorbird\s*<\/a>/is) ||
            bodyText.match(/href="(https:\/\/[^"]+)"/i);
        if (!linkMatch) {
            throw new Error(`[Activation] Could not find an activation link in invite mail body: "${bodyText}"`);
        }
        const activationUrl = linkMatch[1].replace(/&amp;/g, '&');

        Logger.step('[Activation] Opening the activation link in a new page');
        const activationPage = await this.context.newPage();
        await activationPage.goto(activationUrl, { waitUntil: 'load' });
        this.activationPage = activationPage;
        return activationPage;
    }

    /** Accept-invitation screen: email is pre-filled, just confirm. */
    async acceptInvitation() {
        Logger.step('[Activation] Accepting invitation (email pre-filled)');
        await expect(this.activationPage.getByRole('heading', { name: 'Accept invitation' })).toBeVisible({ timeout: 15000 });
        await this.activationPage.getByRole('button', { name: 'Continue' }).click();
    }

    /** Sign-up screen: first name + last name (email stays pre-filled). */
    async fillNameAndContinue(firstName, lastName) {
        Logger.step(`[Activation] Sign-up: first name="${firstName}", last name="${lastName}"`);
        await this.activationPage.getByPlaceholder('Your first name').waitFor({ state: 'visible', timeout: 15000 });
        await this.activationPage.getByPlaceholder('Your first name').fill(firstName);
        await this.activationPage.getByPlaceholder('Your last name').fill(lastName);
        await this.activationPage.getByRole('button', { name: 'Continue' }).click();
    }

    /** Password screen. */
    async setPasswordAndContinue(password) {
        Logger.step('[Activation] Setting password');
        const passwordInput = this.activationPage.getByPlaceholder('Create a password');
        await passwordInput.waitFor({ state: 'visible', timeout: 15000 });
        await passwordInput.fill(password);
        await this.activationPage.getByRole('button', { name: 'Continue', exact: true }).click();
    }

    /**
     * AuthKit does not always challenge with an email OTP after the password step —
     * live runs show it sometimes skips straight to /api/auth/callback (MCP-verified
     * manual run showed the OTP step; a subsequent automated run skipped it entirely).
     * Waits briefly for the heading; returns false without failing if it never appears.
     */
    async isEmailVerificationStepShown(timeoutMs = 10000) {
        return this.activationPage
            .getByRole('heading', { name: 'Verify your email' })
            .waitFor({ state: 'visible', timeout: timeoutMs })
            .then(() => true)
            .catch(() => false);
    }

    /** Runs the OTP round-trip only if AuthKit actually presented the verification step. */
    async completeEmailVerificationIfPrompted() {
        const shown = await this.isEmailVerificationStepShown();
        if (!shown) {
            Logger.info('[Activation] Email OTP step not shown for this session — AuthKit proceeded directly');
            return;
        }
        const code = await this.fetchEmailVerificationCode();
        await this.submitEmailVerificationCode(code);
    }

    /**
     * Reads the OTP mail from mailinator (separate mail from the original invite) and
     * returns the 6-digit code found in its body.
     */
    async fetchEmailVerificationCode() {
        Logger.step('[Activation] Fetching email verification code from mailinator');
        const otpMessage = await this.waitForMailinatorMessage(/Verify your email address/);
        const bodyText = await this.fetchMailinatorMessageText(otpMessage.id);
        // Strip any HTML tags before scanning for the code — a no-op on an already-plain
        // body, but required when fetchMailinatorMessageText fell back to the text/html part.
        const plainText = bodyText.replace(/<[^>]+>/g, ' ');
        const match = plainText.match(/\b(\d{6})\b/);
        if (!match) {
            throw new Error(`[Activation] Could not find a 6-digit verification code in mail body: "${bodyText}"`);
        }
        Logger.info(`[Activation] Verification code found: ${match[1]}`);
        return match[1];
    }

    /** Types the 6-digit code into the segmented OTP input; the app auto-submits on the last digit. */
    async submitEmailVerificationCode(code) {
        Logger.step('[Activation] Submitting email verification code');
        const otpBoxes = this.activationPage.getByRole('textbox');
        await otpBoxes.first().click();
        for (const digit of code) {
            await this.activationPage.keyboard.press(digit);
        }
    }

    /**
     * Some invited users belong to a single organization and are redirected straight to
     * the dashboard after OTP; others land on an organization-selection screen first.
     * Handles both — clicking the org whose name contains orgNameFragment when present.
     */
    async selectOrganizationIfPrompted(orgNameFragment = '2026') {
        await this.activationPage.waitForURL(/organization-selection|beta\.tailorbird\.com/, { timeout: 30000 });
        if (/organization-selection/.test(this.activationPage.url())) {
            Logger.step(`[Activation] Organization-selection screen shown — choosing org containing "${orgNameFragment}"`);
            await this.activationPage
                .locator('.ak-OrgSelection')
                .getByRole('button', { name: orgNameFragment })
                .click();
        } else {
            Logger.info('[Activation] No organization-selection screen — user redirected directly (single-org invite)');
        }
    }

    async expectLandedOnDashboard(dashboardUrlPattern) {
        await this.activationPage.waitForURL(dashboardUrlPattern, { timeout: 30000 });
        await expect(this.activationPage).toHaveURL(dashboardUrlPattern);
        Logger.success(`[Activation] ✅ Landed on dashboard: ${this.activationPage.url()}`);
    }

    // ---------------------------------------------------------------------
    // Properties page — post-activation access check
    // ---------------------------------------------------------------------

    propertiesGrid() {
        return healingLocator(propertiesGridStrategies(this.activationPage));
    }

    /** Each card is a direct child of the SimpleGrid; its first <p> is the property name (MCP-verified DOM: PropertyCard_card__*). */
    propertyCards() {
        return healingLocator(propertyCardStrategies(this.propertiesGrid(), this.activationPage));
    }

    /**
     * Directly invokes GET /api/properties (authenticated via the activated user's own
     * session/cookies) — the source of truth for which properties this user can see.
     * A direct invoke (like FgaUserManagementPage.getOrganizationUserByEmail) rather than
     * intercepting a UI-triggered fetch: the dashboard landing page already loads property
     * data, so the SPA can serve /properties from cache without firing a fresh request,
     * making page.waitForResponse() race and time out (MCP/live-run verified).
     */
    async fetchPropertiesApi() {
        Logger.step('[Activation] Invoking GET /api/properties');
        const response = await this.activationPage.request.get('/api/properties');
        const responseBody = await response.json().catch(() => null);
        const propertyNames = Array.isArray(responseBody) ? responseBody.map((p) => p.name) : [];
        Logger.info(`[Activation] GET /api/properties -> [${response.status()}] ${JSON.stringify(propertyNames)}`);

        return {
            status: response.status(),
            ok: response.ok(),
            responseBody,
            propertyNames,
        };
    }

    async gotoPropertiesPage() {
        Logger.step('[Activation] Navigating to Properties page');
        // MCP-verified live: this activation page's sidebar starts collapsed (icon-only,
        // width=68px), so every .mantine-NavLink-root's textContent is empty in that state —
        // propertiesNavLink's :has-text('Properties') matches zero elements and .click() hangs
        // until timeout. Every sibling goto*Page method already avoids this via gotoPath();
        // Properties was the one method still on the old click-based approach.
        await this.gotoPath('/properties');
        await expect(this.propertiesGrid().first()).toBeVisible({ timeout: 20000 });
    }

    /** Returns the property name (first <p> text) of every visible property card. */
    async getVisiblePropertyNames() {
        const cards = this.propertyCards();
        const count = await cards.count();
        const names = [];
        for (let i = 0; i < count; i++) {
            const name = ((await cards.nth(i).locator('p').first().innerText()) || '').trim();
            names.push(name);
        }
        return names;
    }

    // ---------------------------------------------------------------------
    // Profile menu — FGA scope validation (Member role must not see org-admin actions)
    // ---------------------------------------------------------------------

    /**
     * Opens the profile menu from the left sidebar (identified by the activated user's own
     * email — the sidebar trigger has no stable role/testid, MCP-verified live) and returns
     * the visible menu item labels. Closes the menu again before returning.
     */
    async getProfileMenuOptions(userEmail) {
        Logger.step('[Activation] Opening profile menu from the left sidebar');
        await healingLocator(profileMenuTriggerStrategies(this.activationPage, userEmail)).click();
        const menu = healingLocator(profileMenuStrategies(this.activationPage));
        await expect(menu, 'FAIL: profile menu should open').toBeVisible({ timeout: 10000 });
        const items = (await menu.getByRole('menuitem').allTextContents()).map((t) => t.trim()).filter(Boolean);
        await this.activationPage.keyboard.press('Escape');
        Logger.info(`[Activation] Profile menu options: ${JSON.stringify(items)}`);
        return items;
    }

    // ---------------------------------------------------------------------
    // Construction Management / Financials list pages — Property column scope check
    // ---------------------------------------------------------------------

    /**
     * Navigates by URL rather than clicking a sidebar nav item: the app renders the nav
     * three times in the DOM (one per responsive breakpoint, toggled via CSS, MCP/live-run
     * verified) so a text-based nav-link locator's first DOM match can be the hidden copy,
     * making .click() hang until timeout. Direct navigation is what this same framework's
     * PropertiesHelper.goToProperties() already falls back to for the identical reason.
     */
    async gotoPath(path) {
        const origin = new URL(this.activationPage.url()).origin;
        await this.activationPage.goto(`${origin}${path}`, { waitUntil: 'load' });
    }

    /** The treegrid container renders before its rows finish fetching — wait for an actual data cell, not just the empty shell. */
    async waitForGridRows() {
        await expect(this.activationPage.locator('[role="treegrid"]').first()).toBeVisible({ timeout: 20000 });
        await expect(this.activationPage.locator('[role="treegrid"] [role="gridcell"]').first()).toBeVisible({ timeout: 20000 });
    }

    async gotoProjectsPage() {
        Logger.step('[Activation] Navigating to Projects page');
        await this.gotoPath('/projects');
        await this.waitForGridRows();
    }

    async gotoJobsPage() {
        Logger.step('[Activation] Navigating to Jobs page');
        await this.gotoPath('/jobs');
        await this.waitForGridRows();
    }

    async gotoBidsPage() {
        Logger.step('[Activation] Navigating to Bids page');
        await this.gotoPath('/bids');
        await this.waitForGridRows();
    }

    async gotoChangeOrdersPage() {
        Logger.step('[Activation] Navigating to Change Orders page');
        await this.gotoPath('/change-orders');
        await this.waitForGridRows();
    }

    async gotoInvoicesPage() {
        Logger.step('[Activation] Navigating to Invoices page');
        await this.gotoPath('/invoices');
        await this.waitForGridRows();
    }

    async gotoCapexPage() {
        Logger.step('[Activation] Navigating to CapEx page');
        await this.gotoPath('/financials/capex');
        await this.waitForGridRows();
    }

    async gotoBudgetPage() {
        Logger.step('[Activation] Navigating to Budget page');
        await this.gotoPath('/financials/budget');
    }

    /**
     * Reads every value in a treegrid's named column, in DOM order, for every visible data
     * row — skipping footer/aggregate rows (identified by a blank or "Total" cell in that
     * column, e.g. CapEx's Total row or Invoices' totals footer, MCP-verified live) and
     * stripping any expand/collapse toggle button text (CapEx renders "›" inside the cell)
     * so only the real cell text remains. Runs as a single evaluate() — the grid used by
     * these pages groups its header/body into separate column-group containers, so a
     * columnheader's index must be resolved within its own group, not the whole treegrid.
     */
    /**
     * Forces the page's treegrid to a large width so revo-grid mounts every column instead of
     * virtualizing rightmost ones out of the DOM. MCP-verified live on /jobs: the grid renders
     * only 7 columns by default (Title..Project, Actions) — "Property" (and everything after)
     * is dropped entirely, so getGridColumnValues('Property') finds no matching header and
     * returns [] even though matching rows exist.
     */
    async forceTreegridFullWidth() {
        await this.activationPage.evaluate(() => {
            const grid = document.querySelector('revo-grid');
            if (grid) {
                grid.style.setProperty('width', '3000px', 'important');
                grid.style.setProperty('min-width', '3000px', 'important');
            }
        }).catch(() => {});
        await this.activationPage.waitForTimeout(400);
    }

    async getGridColumnValues(columnHeaderText) {
        await this.forceTreegridFullWidth();
        return this.activationPage.evaluate((headerText) => {
            const treegrid = document.querySelector('[role="treegrid"]');
            if (!treegrid) return [];

            const headers = Array.from(treegrid.querySelectorAll('[role="columnheader"]'));
            const targetHeader = headers.find((h) => h.textContent.trim() === headerText);
            if (!targetHeader) return [];

            const headerGroup = targetHeader.parentElement;
            const siblingHeaders = Array.from(headerGroup.querySelectorAll('[role="columnheader"]'));
            const colIndex = siblingHeaders.indexOf(targetHeader);

            let container = headerGroup;
            let rows = [];
            for (let depth = 0; depth < 5 && rows.length === 0; depth++) {
                container = container.parentElement;
                if (!container) break;
                rows = Array.from(container.querySelectorAll('[role="row"]')).filter((r) => r.querySelector('[role="gridcell"]'));
            }

            const cleanCellText = (cell) => {
                const clone = cell.cloneNode(true);
                clone.querySelectorAll('button').forEach((b) => b.remove());
                return clone.textContent.trim();
            };

            return rows
                .map((r) => {
                    const cells = Array.from(r.querySelectorAll('[role="gridcell"]'));
                    return cells[colIndex] ? cleanCellText(cells[colIndex]) : '';
                })
                .filter((value) => value !== '' && value !== 'Total');
        }, columnHeaderText);
    }

    // ---------------------------------------------------------------------
    // Budget page — Property dropdown scope check
    // ---------------------------------------------------------------------

    /** Opens the Budget page's "Select a Property" dropdown and returns every option's property name. */
    async getBudgetPropertyDropdownOptions() {
        Logger.step('[Activation] Opening Budget page Property dropdown');
        await healingLocator(budgetPropertySelectorButtonStrategies(this.activationPage)).click();
        const menu = healingLocator(budgetPropertyDropdownStrategies(this.activationPage));
        await expect(menu, 'FAIL: Budget Property dropdown should open').toBeVisible({ timeout: 10000 });

        const items = menu.getByRole('menuitem');
        const count = await items.count();
        const names = [];
        for (let i = 0; i < count; i++) {
            const name = ((await items.nth(i).locator('p').first().innerText()) || '').trim();
            names.push(name);
        }

        await this.activationPage.keyboard.press('Escape');
        Logger.info(`[Activation] Budget Property dropdown options: ${JSON.stringify(names)}`);
        return names;
    }

    async close() {
        await this.context.close().catch(() => {});
    }
}

module.exports = { UserActivationPage };
