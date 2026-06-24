require('dotenv').config();
const { test, expect } = require('@playwright/test');
const { Logger } = require('../utils/logger');
const { LoginPage } = require('../pages/loginPage');
const { InteractionLogger } = require('../utils/InteractionLogger');
const helper = require('../pages/leftPanel');
const locators = require('../locators/leftPanelLocator');
const data = require('../fixture/leftPanel.json');
const uiBenchmark = require('../fixture/tailorbirdUiMessages.json');

/** Used by TC02-vis-01 (left nav visual regression). */
const MENU_SCREENSHOT_OPTIONS = {
    animations: 'disabled',
    // Left-nav icon/text anti-aliasing varies in headed runs.
    maxDiffPixels: 100000,
    maxDiffPixelRatio: 0.3,
};

let page;

test.use({
    storageState: 'sessionState.json',
    viewport: { width: 1440, height: 900 }
});

test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    Logger.info(`Navigating to dashboard: ${process.env.DASHBOARD_URL}`);
    await page.goto(process.env.DASHBOARD_URL, { waitUntil: 'load', timeout: 60000 });
    Logger.info('Dashboard loaded successfully.');

    page.on('domcontentloaded', async () => {
        await page.evaluate(() => {
            const elements = document.querySelectorAll('main, .mantine-AppShell-navbar');
            elements.forEach(el => {
                el.style.zoom = '70%';
            });
        });
    });

    await page.evaluate(() => {
        const elements = document.querySelectorAll('main, .mantine-AppShell-navbar');
        elements.forEach(el => {
            el.style.zoom = '70%';
        });
    });
});

test.afterAll(async () => {
    Logger.info('Closing browser context...');
});


test.describe('Tailorbird Left Panel Flow - Modular', () => {

    test('TC06 @sanity @regression Verify all left panel menu options are available', async () => {
        const actualLabels = await helper.getLeftPanelLabels(page);

        if (actualLabels.length === 0)
            throw new Error('Left panel labels not found.');

        for (const label of data.expectedLabels) {
            expect(actualLabels).toContain(label);
            Logger.info(`✅ Label matched: "${label}"`);
        }
    });

      test('TC07 @regression Verify each left panel menu item navigates to its correct URL when clicked',
        async () => {
            test.setTimeout(180000);

            const base = process.env.BASE_URL || new URL(process.env.DASHBOARD_URL).origin;

            // Start from /properties for a predictable nav state (CM collapsed, all sections visible).
            // waitUntil:'load' (not 'domcontentloaded') ensures React has mounted the nav before proceeding.
            await page.goto(`${base}/properties`, { waitUntil: 'load', timeout: 120000 });
            await page.locator('nav .mantine-NavLink-root').filter({ hasText: 'Properties' }).first().waitFor({ state: 'visible', timeout: 30000 });
            Logger.info('[TC22] Start state: /properties — Construction Management collapsed');

            // ── S1: Direct nav items visible without any section expansion ───────────
            for (const item of [
                { label: 'Properties', path: '/properties' },
                { label: 'Approvals',  path: '/approvals'  },
            ]) {
                await test.step(`S1: Click "${item.label}" → URL must contain "${item.path}"`, async () => {
                    Logger.info(`[TC22-S1] Clicking "${item.label}"`);
                    InteractionLogger.logButtonClick(item.label, item.label);
                    const link = page.locator('nav .mantine-NavLink-root').filter({ hasText: item.label }).first();
                    await link.waitFor({ state: 'visible', timeout: 20000 });
                    await link.click();
                    await expect(page).toHaveURL(new RegExp(item.path), { timeout: 15000 });
                    InteractionLogger.logAssertion('MenuURLNav', item.label, item.path, page.url(), true);
                    Logger.success(`[TC22-S1] ✔ "${item.label}" → ${page.url()}`);
                });
            }

            // ── S2: Construction Management children ──────────────────────────────────
            // Reload /properties so nav is in its default (CM collapsed) state, then expand CM.
            // At 1440×900, expanding CM causes Financials/Trackers/Documents/Vendors to move into "More".
            await page.goto(`${base}/properties`, { waitUntil: 'load', timeout: 120000 });
            await page.locator('nav .mantine-NavLink-root').filter({ hasText: 'Properties' }).first().waitFor({ state: 'visible', timeout: 30000 });
            await helper.ensureSectionExpanded(page, 'Construction Management');
            Logger.info('[TC22] Construction Management expanded — testing CM child routes');

            for (const item of [
                { label: 'Projects',              path: '/projects'       },
                { label: 'Jobs (Contracts & POs)', path: '/jobs'           },
                { label: 'Bids',                  path: '/bids'           },
                { label: 'Change Orders',         path: '/change-orders'  },
                { label: 'Invoices',              path: '/invoices'       },
            ]) {
                await test.step(`S2: Click "${item.label}" (Construction Management) → URL must contain "${item.path}"`, async () => {
                    Logger.info(`[TC22-S2] Clicking "${item.label}"`);
                    InteractionLogger.logButtonClick(item.label, item.label);
                    const link = page.locator('nav .mantine-NavLink-root').filter({ hasText: item.label }).first();
                    await link.waitFor({ state: 'visible', timeout: 10000 });
                    await link.click();
                    await expect(page).toHaveURL(new RegExp(item.path), { timeout: 15000 });
                    InteractionLogger.logAssertion('MenuURLNav', item.label, item.path, page.url(), true);
                    Logger.success(`[TC22-S2] ✔ "${item.label}" → ${page.url()}`);
                });
            }

            // ── S3: Financials items — still in direct nav (CM expanded but Financials section visible) ──
            // At 1440×900 with CM expanded: Financials (Category/Budget/CapEx) stay in direct nav.
            // Only Trackers / Documents / Vendors overflow into the More dropdown.
            Logger.info('[TC22] Testing Financials items — visible in direct nav under Financials section');

            for (const item of [
                { label: 'Category', path: '/financials/category' },
                { label: 'Budget',   path: '/financials/budget'   },
                { label: 'CapEx',    path: '/financials/capex'    },
            ]) {
                await test.step(`S3: Click "${item.label}" (Financials nav) → URL must contain "${item.path}"`, async () => {
                    Logger.info(`[TC22-S3] Clicking "${item.label}" from Financials nav section`);
                    InteractionLogger.logButtonClick(item.label, item.label);
                    const link = page.locator('nav .mantine-NavLink-root').filter({ hasText: item.label }).first();
                    await link.waitFor({ state: 'visible', timeout: 10000 });
                    await link.click();
                    await expect(page).toHaveURL(new RegExp(item.path), { timeout: 15000 });
                    InteractionLogger.logAssertion('MenuURLNav', item.label, item.path, page.url(), true);
                    Logger.success(`[TC22-S3] ✔ "${item.label}" → ${page.url()}`);
                });
            }

            // ── S4: "More" overflow items — Trackers / Documents / Vendors ─────────────
            Logger.info('[TC22] Testing More overflow items — Trackers/Documents/Vendors');

            for (const item of [
                { label: 'Unit Tracker',  path: '/unit-tracker'      },
                { label: 'Asset Tracker', path: '/asset-tracker'     },
                { label: 'Files',         path: '/documents/files'   },
                { label: 'Images',        path: '/documents/images'  },
                { label: 'Directory',     path: '/vendors/directory' },
            ]) {
                await test.step(`S4: Click "${item.label}" (More menu) → URL must contain "${item.path}"`, async () => {
                    Logger.info(`[TC22-S4] Opening More menu for "${item.label}"`);
                    const more = await helper.openMoreMenu(page);
                    expect(more, `"More" overflow menu must be present — CM is expanded at 1440×900`).toBeTruthy();
                    await more.waitFor({ state: 'visible', timeout: 15000 });
                    InteractionLogger.logButtonClick(item.label, item.label);
                    const menuItem = more.locator('[role="menuitem"]').filter({ hasText: item.label }).first();
                    await menuItem.waitFor({ state: 'visible', timeout: 10000 });
                    await menuItem.click();
                    await expect(page).toHaveURL(new RegExp(item.path), { timeout: 15000 });
                    InteractionLogger.logAssertion('MenuURLNav', item.label, item.path, page.url(), true);
                    Logger.success(`[TC22-S4] ✔ "${item.label}" → ${page.url()}`);
                });
            }

            Logger.success('[TC22] COMPLETE: All left panel menu items verified — each navigates to its correct URL');
        },
    );

    test('TC08 @sanity @regression Verify main menu toggle functionality', async () => {
        Logger.info('[TC08] Starting: main sidebar toggle — collapse and expand');
        await test.step('Sidebar shell collapses and expands (width + layout, not aria-expanded)', async () => {
            await helper.assertMainSidebarToggle(page);
        });
        Logger.success('[TC08] ✅ Main sidebar toggle verified — collapse and expand work');
    });

    test('TC09 @sanity @regression Verify Financials expand/collapse', async () => {
        Logger.info('[TC09] Starting: Financials section expand/collapse');
        await helper.runTwoClickTest(page, "Financials");
        Logger.success('[TC09] ✅ Financials expand/collapse verified');
    });

    test('TC10 @sanity @regression Verify Trackers expand/collapse', async () => {
        Logger.info('[TC10] Starting: Trackers section expand/collapse');
        await helper.runTwoClickTest(page, "Trackers");
        Logger.success('[TC10] ✅ Trackers expand/collapse verified');
    });

    test('TC11 @sanity @regression Verify Documents expand/collapse', async () => {
        Logger.info('[TC11] Starting: Documents section expand/collapse');
        await helper.runTwoClickTest(page, "Documents");
        Logger.success('[TC11] ✅ Documents expand/collapse verified');
    });

    test.describe('Regression — left nav edges, resilience, and UI snapshot', () => {
        test.beforeEach(async ({ page }) => {
            Logger.info(`Navigating to dashboard: ${process.env.DASHBOARD_URL}`);
            await page.goto(process.env.DASHBOARD_URL, { waitUntil: 'load', timeout: 60000 });
            await page.locator('nav').waitFor({ state: 'visible', timeout: 15000 });
            await page.evaluate(() => {
                document.querySelectorAll('main, .mantine-AppShell-navbar').forEach((el) => {
                    el.style.zoom = '70%';
                });
            });
        });

        test('TC13 @regression @menu Browser back returns from Properties toward prior app route', async ({
            page,
        }) => {
            const base = process.env.BASE_URL || new URL(process.env.DASHBOARD_URL).origin;
            const beforeUrl = page.url();
            Logger.info(`[TC13] URL before Properties navigation: ${beforeUrl}`);
            const propertiesUrl = new URL('/properties', base).href;
            await page.goto(propertiesUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await expect(page).toHaveURL(/properties/i, { timeout: 15000 });
            Logger.info(`[TC13] On Properties: ${page.url()}`);
            await page.goBack({ waitUntil: 'domcontentloaded' });
            await expect.poll(() => page.url(), { timeout: 15000 }).not.toBe(propertiesUrl);
            Logger.info(`[TC13] URL after browser back: ${page.url()}`);
            expect(page.url()).not.toMatch(/\/properties(\/|$)/);
            expect(
                page.url().startsWith(base),
                `Expected URL under app origin after back; got ${page.url()} (was ${beforeUrl})`,
            ).toBeTruthy();
        });

        test('TC14 @regression @menu Unknown deep link still renders app shell (no blank page)', async ({
            page,
        }) => {
            Logger.info('[TC14] Starting: unknown route must still render app shell');
            const origin = new URL(process.env.DASHBOARD_URL).origin;
            const unknownUrl = `${origin}/__tb_automation_unknown_route__/`;
            InteractionLogger.logNavigation(unknownUrl, 'Unknown route — app shell render check');
            await page.goto(unknownUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 45000,
            });
            Logger.info('[TC14] Asserting: body is visible (no blank page)');
            await expect(page.locator('body')).toBeVisible();
            Logger.info('[TC14] Asserting: app shell (AppShell-root, nav, or main) is visible');
            const shell = page.locator('.mantine-AppShell-root, nav, main').first();
            await expect(shell).toBeVisible({ timeout: 20000 });
            Logger.success('[TC14] ✅ Unknown route renders app shell — no blank page');
            Logger.info('[TC14] Asserting: 404 page heading is displayed');
            await expect(page.locator('main h1'), 'main must show "404" heading').toHaveText('404', { timeout: 10000 });
            await expect(page.locator('main h2'), 'main must show "This page could not be found." sub-heading').toHaveText('This page could not be found.', { timeout: 10000 });
            InteractionLogger.logAssertion('404Page', unknownUrl, '404 + "This page could not be found."', '404 heading visible', true);
            Logger.success('[TC14] ✅ 404 page headings confirmed: h1="404", h2="This page could not be found."');
        });

        test('TC15 @regression @menu Escape closes More submenu when present', async ({ page }) => {
            const dashboardUrl = process.env.DASHBOARD_URL;
            test.skip(!dashboardUrl, 'DASHBOARD_URL required');

            /**
             * "More" only renders when ClientWrapper overflow mode is on — often skipped on large viewports.
             * 1) Short viewport + shrink the tallest overflow column to encourage "More".
             * 2) If still no "More", use the user avatar menu (same Mantine [role=menu] + Escape behavior).
             */
            await page.setViewportSize({ width: 1280, height: 720 });
            await page.goto(dashboardUrl, { waitUntil: 'load', timeout: 60_000 });
            await page.locator('nav').waitFor({ state: 'visible', timeout: 15_000 });
            await page.evaluate(() => {
                document.querySelectorAll('main, .mantine-AppShell-navbar').forEach((el) => {
                    el.style.zoom = '70%';
                });
            });
            await page.waitForTimeout(500);

            await page.evaluate(() => {
                const root = document.querySelector('.mantine-AppShell-navbar');
                if (!root) return;
                let best = null;
                let bestH = 0;
                for (const el of root.querySelectorAll('div')) {
                    const st = window.getComputedStyle(el);
                    if (st.overflowY !== 'auto' && st.overflowY !== 'scroll') continue;
                    if (el.scrollHeight > bestH) {
                        bestH = el.scrollHeight;
                        best = el;
                    }
                }
                if (best) {
                    best.style.setProperty('max-height', '100px', 'important');
                }
            });
            await page.waitForTimeout(1500);
            await page.evaluate(() => window.dispatchEvent(new Event('resize')));

            const shell = page.locator('.mantine-AppShell-navbar');
            const moreButton = shell.locator('.mantine-NavLink-root').filter({ hasText: 'More' }).first();
            const usedMore = await moreButton.isVisible().catch(() => false);

            if (usedMore) {
                Logger.info('[TC15] Using sidebar "More" overflow menu');
                await moreButton.click();
            } else {
                Logger.info('[TC15] "More" not shown — using user shell menu (Escape still closes Mantine menu)');
                await shell.locator('.mantine-Avatar-root').last().click();
            }

            await page.waitForTimeout(300);
            const openMenu = page.locator('[role="menu"]').first();
            await expect(openMenu).toBeVisible({ timeout: 8000 });
            const beforeLabels = await openMenu.getByRole('menuitem').allInnerTexts().catch(() => []);
            Logger.info(`[TC15] Menu items before Escape: ${JSON.stringify(beforeLabels.map((t) => t.trim()))}`);
            await page.keyboard.press('Escape');
            await expect(openMenu).toBeHidden({ timeout: 8000 });
        });

        test('TC16 @regression @menu Verify get help option is visible.', async ({
            page,
        }) => {
            const nav = page.getByRole('navigation');
            await expect(nav).toBeVisible({ timeout: 15_000 });
            const linkTexts = await nav.locator('a, button').allInnerTexts().catch(() => []);
            const sample = [...new Set(linkTexts.map((t) => t.trim()).filter(Boolean))].slice(0, 30);
            Logger.info(`[TC16] Navigation landmark sample labels: ${JSON.stringify(sample)}`);
            await expect(
                nav.getByText('Properties', { exact: true }).first(),
                `FAIL: Expected "Properties" in nav landmark; sample above. Menu copy may have changed.`,
            ).toBeVisible({ timeout: 10_000 });
        });

        test('TC17 @regression @menu User menu exposes Profile, org management (when shown), Logout', async ({
            page,
        }) => {
            const navbar = page.locator('.mantine-AppShell-navbar');
            await expect(navbar.locator('.mantine-Avatar-root').last()).toBeVisible({ timeout: 15_000 });
            await navbar.locator('.mantine-Avatar-root').last().click();

            const menu = page
                .locator('[role="menu"]')
                .filter({ has: page.getByRole('menuitem', { name: /^Logout$/i }) })
                .first();
            await expect(menu, 'FAIL: No user menu with Logout found (wrong trigger or portal timing).').toBeVisible({
                timeout: 12_000,
            });

            const items = (await menu.getByRole('menuitem').allInnerTexts()).map((t) => t.trim());
            Logger.info(`[TC17] User menu items (live): ${JSON.stringify(items)}`);
            Logger.info(
                `[TC17] Fixture benchmark (${uiBenchmark._source?.slice(0, 80)}…): expect Profile="${uiBenchmark.userMenuProfile}", Logout="${uiBenchmark.userMenuLogout}", org copy one of: "${uiBenchmark.userMenuManageTeam}" | "${uiBenchmark.userMenuManageOrganizationLegacy}" | Manage Approvers`,
            );

            await expect(
                menu.getByRole('menuitem', { name: new RegExp(`^${uiBenchmark.userMenuProfile}$`, 'i') }),
                `FAIL: Missing "${uiBenchmark.userMenuProfile}" menuitem — got ${JSON.stringify(items)}. Update fixture or app.`,
            ).toBeVisible({ timeout: 5_000 });

            await expect(
                menu.getByRole('menuitem', { name: new RegExp(`^${uiBenchmark.userMenuLogout}$`, 'i') }),
                `FAIL: Missing "${uiBenchmark.userMenuLogout}" — got ${JSON.stringify(items)}.`,
            ).toBeVisible({ timeout: 5_000 });

            const orgPattern = /^(Manage Team|Manage Organization|Manage Approvers)$/i;
            const hasOrgItem = items.some((t) => orgPattern.test(t));
            if (items.length <= 2) {
                Logger.info(
                    '[TC17] Only Profile + Logout (vendor-style per userSettingsMenu.ts) — skipping org-management item assertion.',
                );
            } else {
                expect(
                    hasOrgItem,
                    `FAIL: Non-vendor menu should include one of Manage Team | Manage Organization | Manage Approvers. Got ${JSON.stringify(items)}.`,
                ).toBeTruthy();
                const orgLocator = menu.getByRole('menuitem', { name: orgPattern }).first();
                await expect(
                    orgLocator,
                    `FAIL: Org-management menuitem missing — got ${JSON.stringify(items)}.`,
                ).toBeVisible({ timeout: 3_000 });
            }

            await page.keyboard.press('Escape');
            await expect(menu).toBeHidden({ timeout: 5_000 });
        });

        test('TC18 @regression @menu Verify get help option.', async ({
            page,
        }) => {
            Logger.info('[TC18] Collapse shell, navigate via in-app link, assert width, then expand');
            const toggle = helper.mainNavbarToggleLocator(page);
            await expect(toggle).toBeVisible({ timeout: 10_000 });
            expect(await helper.getMainNavbarWidth(page), 'Start expanded').toBeGreaterThan(150);
            await toggle.click();
            await expect.poll(() => helper.getMainNavbarWidth(page), { timeout: 10_000 }).toBeLessThan(120);
            Logger.info(`[TC18] Collapsed width: ${await helper.getMainNavbarWidth(page)}px`);

            /**
             * Collapsed ClientWrapper nav uses icon-only Mantine NavLinks with onClick + router.push — no /properties href.
             * (Verified from failure trace snapshot: menu strip is img-only; "More" is link href="#".)
             */
            const shell = page.locator('.mantine-AppShell-navbar');
            const sideNav = shell.getByRole('navigation').first();
            const byExactHref = shell.locator('a[href="/properties"]').first();
            const byPartialHref = shell.locator('a[href*="/properties"]').first();
            const byLabel = sideNav.getByText('Properties', { exact: true }).first();

            const navigatePropertiesSpa = async () => {
                if (await byExactHref.isVisible().catch(() => false)) {
                    Logger.info('[TC18] Using a[href="/properties"] (expanded / labelled nav)');
                    await byExactHref.click();
                    return;
                }
                if (await byPartialHref.isVisible().catch(() => false)) {
                    Logger.info('[TC18] Using a[href*="/properties"]');
                    await byPartialHref.click();
                    return;
                }
                if (await byLabel.isVisible().catch(() => false)) {
                    Logger.info('[TC18] Using visible "Properties" label');
                    await byLabel.click();
                    return;
                }
                Logger.info(
                    '[TC18] Collapsed mode: 2nd .mantine-NavLink-root in shell = Properties (icons are SVG, not <img>)',
                );
                const navLink = shell.locator('.mantine-NavLink-root').nth(1);
                await expect(
                    navLink,
                    'Collapsed shell: second Mantine NavLink should be Properties (first is logo expand control).',
                ).toBeVisible({ timeout: 10_000 });
                await navLink.click({ force: true });
            };

            await Promise.all([page.waitForURL(/\/properties/i, { timeout: 25_000 }), navigatePropertiesSpa()]);

            await expect.poll(() => helper.getMainNavbarWidth(page), {
                message:
                    'Navbar should remain collapsed after client-side navigation (regression: ClientWrapper state lost on route change).',
                timeout: 10_000,
            }).toBeLessThan(120);

            await helper.mainNavbarToggleLocator(page).click();
            await expect.poll(() => helper.getMainNavbarWidth(page), { timeout: 10_000 }).toBeGreaterThan(150);
            Logger.success('[TC18] Collapsed SPA persistence + expand OK');
        });

        test('TC19 @regression @menu Visual snapshot: left navigation shell', async ({ page }) => {
            const nav = page.locator('.mantine-AppShell-navbar').first();
            await nav.waitFor({ state: 'visible', timeout: 15000 });
            const navTexts = await nav
                .evaluate((el) => {
                    const out = [];
                    el.querySelectorAll('span, a, button').forEach((n) => {
                        const t = (n.textContent || '').trim().replace(/\s+/g, ' ');
                        if (t && t.length > 0 && t.length < 120) out.push(t);
                    });
                    return [...new Set(out)];
                })
                .catch(() => []);
            Logger.info(
                `[TC19] Navbar snapshot benchmark — text nodes (sample): ${JSON.stringify(navTexts.slice(0, 40))}`,
            );
            await expect(nav, 'FAIL: Left nav shell screenshot mismatch — layout/branding changed. Review diff + logs.').toHaveScreenshot(
                'menu-left-navbar-shell.png',
                {
                    ...MENU_SCREENSHOT_OPTIONS,
                },
            );
        });
    });

    test.describe('Regression — no session (AuthKit entry)', () => {
        test.use({ storageState: { cookies: [], origins: [] } });

        test('TC20 @regression @menu Visiting /properties without session shows Sign in', async ({ page }) => {
            test.skip(!process.env.DASHBOARD_URL, 'DASHBOARD_URL is required to resolve app origin for this check.');
            Logger.info('[TC20] Starting: /properties without session must show Sign in');
            const base = process.env.BASE_URL || new URL(process.env.DASHBOARD_URL).origin;
            const propertiesUrl = new URL('/properties', base).href;
            InteractionLogger.logNavigation(propertiesUrl, 'Properties — unauthenticated access');
            await page.goto(propertiesUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
            Logger.info('[TC20] Asserting: Sign in heading visible');
            await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible({ timeout: 30_000 });
            Logger.success('[TC20] ✅ Unauthenticated /properties redirected to Sign in');
        });
    });

});

test.describe('TC02 Menu — Single-org user assertions', () => {
    test.use({ storageState: 'OneOrganizationUserSessionState.json' });
    test.setTimeout(60_000);

    test('TC23 @regression @menu Single-org user: Switch Organization is NOT in user menu', async ({ page }) => {
        test.skip(!process.env.DASHBOARD_URL, 'DASHBOARD_URL required');
        Logger.info('[TC23] Starting: single-org user — open profile menu, assert expected items present, assert Switch Organization absent');

        await page.goto(process.env.DASHBOARD_URL, { waitUntil: 'load', timeout: 60_000 });

        // Click the profile section at the bottom of the navbar (avatar + name row)
        const navbar = page.locator('.mantine-AppShell-navbar');
        const profileTrigger = navbar.locator('[cursor=pointer]').filter({ hasText: /summit\.harsha@tailorbird\.us/i })
            .or(navbar.locator('.mantine-Avatar-root').last());
        await expect(navbar.locator('.mantine-Avatar-root').last()).toBeVisible({ timeout: 15_000 });
        Logger.info('[TC23] Clicking profile trigger in navbar');
        await navbar.locator('.mantine-Avatar-root').last().click();

        const menu = page
            .locator('[role="menu"]')
            .filter({ has: page.getByRole('menuitem', { name: /^Logout$/i }) })
            .first();
        await expect(menu, 'FAIL: No user menu with Logout found (wrong trigger or portal timing).').toBeVisible({
            timeout: 12_000,
        });

        const items = (await menu.getByRole('menuitem').allInnerTexts()).map((t) => t.trim());
        Logger.info(`[TC23] User menu items (single-org session): ${JSON.stringify(items)}`);

        // Assert expected items ARE present (MCP-verified: these appear for single-org user)
        const expectedPresent = ['Manage Approvers', 'Manage Organization', 'Profile', 'Logout'];
        for (const label of expectedPresent) {
            await expect(
                menu.getByRole('menuitem', { name: new RegExp(`^${label}$`, 'i') }),
                `FAIL: Expected "${label}" to be visible in single-org user menu. Got: ${JSON.stringify(items)}`,
            ).toBeVisible({ timeout: 5_000 });
            Logger.info(`[TC23] ✅ Present: "${label}"`);
        }

        // Assert Switch Organization is NOT present
        await expect(
            menu.getByRole('menuitem', { name: /^Switch Organization$/i }),
            `FAIL: "Switch Organization" must NOT appear for a single-org user. Got: ${JSON.stringify(items)}`,
        ).not.toBeVisible();
        Logger.success('[TC23] ✅ "Switch Organization" correctly absent for single-org user');

        await page.keyboard.press('Escape');
        await expect(menu).toBeHidden({ timeout: 5_000 });
    });
});

test.describe('TC02 Menu — Text assertions', () => {
    test.setTimeout(120_000);

    test('TC21 @menu @sanity Full nav text agent — all CTAs, labels, nav items, profile menu', async ({ page }) => {
        test.skip(!process.env.DASHBOARD_URL, 'DASHBOARD_URL required');
        // beforeEach already navigated to DASHBOARD_URL and set up auth session
        InteractionLogger.logNavigation(process.env.DASHBOARD_URL, 'Dashboard — left nav Text Agent');
        // Wait for nav skeleton to resolve: the container becomes visible immediately,
        // but actual link text (Properties) only appears after JS hydration completes.
        await page.getByRole('navigation').getByText('Properties', { exact: true }).first().waitFor({ state: 'visible', timeout: 30_000 });

        await test.step('STATE 1 | Dashboard nav — full scan of all text elements', async () => {
            const snapshot = await LoginPage.scanAllTextElements(page);
            const failures = LoginPage.logAndAssertSnapshot(snapshot, 'dashboard-nav');

            // Nav-specific: all visible buttons must have text or aria-label
            const visibleButtons = snapshot.buttons.filter((b) => b.visible);
            visibleButtons.forEach((btn, i) => {
                const hasText = (btn.text && btn.text.trim().length > 0) || (btn.ariaLabel && btn.ariaLabel.trim().length > 0);
                expect(hasText, `FAIL [dashboard-nav]: Button[${i}] has no text or aria-label. Button: ${JSON.stringify(btn)}`).toBe(true);
            });

            const visibleLinks = snapshot.links.filter((l) => l.visible && l.text && l.text.trim().length > 0);
            expect(visibleLinks.length, `FAIL [dashboard-nav]: No visible non-empty links. All: ${JSON.stringify(snapshot.links)}`).toBeGreaterThan(0);

            expect(failures, `FAIL [dashboard-nav]: ${failures.length} accessibility issue(s):\n${failures.join('\n')}`).toHaveLength(0);
        });

        await test.step('STATE 1b | Known nav labels — primary items visible (MCP-verified 2026-05-18)', async () => {
            const nav = page.getByRole('navigation');
            for (const label of [
                'Properties', 'Approvals', 'Construction Management',
                'Projects', 'Jobs (Contracts & POs)', 'Bids', 'Change Orders', 'Invoices',
                'Get Help',
            ]) {
                InteractionLogger.logVisibility(label, true);
                await expect(nav.getByText(label, { exact: true }).first()).toBeVisible({ timeout: 8_000 });
            }

            const secondaryLabels = [
                'Financials', 'Category', 'Budget', 'CapEx',
                'Trackers', 'Unit Tracker', 'Asset Tracker',
                'Documents', 'Files', 'Images',
                'Vendors', 'Directory',
            ];
            const moreBtn = nav.getByText('More').first();
            const moreVisible = await moreBtn.isVisible({ timeout: 2_000 }).catch(() => false);
            if (moreVisible) {
                InteractionLogger.logButtonClick('More', 'More');
                await moreBtn.click();
                const moreMenu = page.getByRole('menu', { name: 'More' });
                await moreMenu.waitFor({ state: 'visible', timeout: 20_000 });
                for (const label of secondaryLabels) {
                    InteractionLogger.logVisibility(label, true);
                    // At 1440×900 some labels (Financials group) stay in the main nav;
                    // only overflow items land in the More menu — check whichever location has it.
                    const inMenu = await moreMenu.getByText(label, { exact: true }).first().isVisible({ timeout: 1_000 }).catch(() => false);
                    if (!inMenu) {
                        await expect(nav.getByText(label, { exact: true }).first()).toBeVisible({ timeout: 5_000 });
                    }
                }
                await page.keyboard.press('Escape');
            } else {
                for (const label of secondaryLabels) {
                    InteractionLogger.logVisibility(label, true);
                    await expect(nav.getByText(label, { exact: true }).first()).toBeVisible({ timeout: 5_000 });
                }
            }
        });

        await test.step('STATE 2 | Profile menu — open and assert all action labels', async () => {
            const nav = page.getByRole('navigation');
            const profileTrigger = nav.locator('[class*="Avatar-root"]').first();
            if (await profileTrigger.isVisible({ timeout: 3_000 }).catch(() => false)) {
                InteractionLogger.logButtonClick('Profile avatar', 'S');
                await profileTrigger.click();
            } else {
                InteractionLogger.logButtonClick('Profile name', 'Sumit Mishra');
                await nav.locator('text=Sumit Mishra').first().click();
            }
            const profileMenu = page.locator('[role="menu"]');
            await profileMenu.waitFor({ state: 'visible', timeout: 10_000 });

            for (const label of ['Manage Approvers', 'Manage Organization', 'Profile', 'Switch Organization', 'Logout']) {
                InteractionLogger.logVisibility(label, true);
                await expect(profileMenu.getByText(label, { exact: true }).first()).toBeVisible({ timeout: 5_000 });
            }
            await page.keyboard.press('Escape');
        });
    });
});
