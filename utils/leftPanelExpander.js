/**
 * leftPanelExpander.js
 *
 * The left navigation panel now loads collapsed (icon-only rail, ~68px) instead
 * of expanded. Hovering over the rail reveals full labels plus a "Pin sidebar"
 * button (MCP-verified on beta.tailorbird.com); clicking it persists the
 * expanded state (localStorage: tb-sidebar-pinned) across reloads/navigation.
 *
 * This utility expands + pins the panel only when it is actually collapsed,
 * so it is safe to call repeatedly with no side effects.
 *
 * Usage:
 *   const { ensureLeftPanelExpanded } = require('../utils/leftPanelExpander');
 *   await ensureLeftPanelExpanded(page);
 */
const { expect } = require('@playwright/test');
const { Logger } = require('./logger');

const NAVBAR_SELECTOR = '.mantine-AppShell-navbar';
// Collapsed rail renders ~68px wide; expanded/pinned renders ~224px wide.
const COLLAPSED_WIDTH_THRESHOLD = 120;
const PIN_BUTTON_NAME = /pin sidebar/i;
const UNPIN_BUTTON_NAME = /unpin sidebar/i;

async function getNavbarWidth(page) {
    const navbar = page.locator(NAVBAR_SELECTOR).first();
    return navbar.evaluate((el) => el.getBoundingClientRect().width);
}

/**
 * Expands the left navigation panel and pins it open, but only if it is
 * currently collapsed. Does nothing if the panel is already expanded/pinned.
 * @param {import('@playwright/test').Page} page
 */
async function ensureLeftPanelExpanded(page) {
    const navbar = page.locator(NAVBAR_SELECTOR).first();
    await navbar.waitFor({ state: 'visible' });

    const alreadyPinned = await navbar
        .getByRole('button', { name: UNPIN_BUTTON_NAME })
        .isVisible()
        .catch(() => false);
    if (alreadyPinned) {
        Logger.info('[LeftPanelExpander] Panel already pinned open — no action taken.');
        return;
    }

    const width = await getNavbarWidth(page);
    if (width >= COLLAPSED_WIDTH_THRESHOLD) {
        Logger.info(`[LeftPanelExpander] Panel already expanded (width=${width}px) — no action taken.`);
        return;
    }

    Logger.info(`[LeftPanelExpander] Panel collapsed (width=${width}px) — expanding and pinning.`);
    await navbar.hover();

    const pinButton = navbar.getByRole('button', { name: PIN_BUTTON_NAME });
    await pinButton.waitFor({ state: 'visible' });
    await pinButton.click();

    await expect(navbar.getByRole('button', { name: UNPIN_BUTTON_NAME })).toBeVisible();
    await expect.poll(() => getNavbarWidth(page)).toBeGreaterThanOrEqual(COLLAPSED_WIDTH_THRESHOLD);

    Logger.success('[LeftPanelExpander] Panel expanded and pinned open.');
}

module.exports = { ensureLeftPanelExpanded };
