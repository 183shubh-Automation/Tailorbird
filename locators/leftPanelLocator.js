// locators.js
const locators = {
    /** Mantine AppShell left rail (width 280 expanded / 80 collapsed in ClientWrapper). */
    appShellNavbar: '.mantine-AppShell-navbar',
    /**
     * Shell-wide collapse/expand control (MCP-verified on beta.tailorbird.com, 2026-07-26).
     * The sidebar no longer has a chevron NavLink for this — the first NavLink is now a real
     * menu item ("Properties"). Collapse/expand is via the hover-revealed Pin/Unpin button
     * (aria-label "Pin sidebar" when collapsed, "Unpin sidebar" when expanded/pinned).
     */
    mainNavbarHeaderToggle:
        '.mantine-AppShell-navbar button[aria-label="Pin sidebar"], .mantine-AppShell-navbar button[aria-label="Unpin sidebar"]',
    leftPanelLabels: 'nav a.mantine-NavLink-root .mantine-NavLink-label, nav a.mantine-NavLink-root',
    leftPanelItem: (label) => `nav a.mantine-NavLink-root:has-text("${label}"), nav a:has-text("${label}")`,
    collapseContainer: 'xpath=following-sibling::div[contains(@class,"mantine-NavLink-collapse")][1]',
    subOptions: 'a.mantine-NavLink-root',
    firstLeftPanelToggle: 'nav a.mantine-NavLink-root',
    profileButton: 'button[aria-label="Profile"]',
    profileMenuOptions: 'div.mantine-Menu-dropdown button[role="menuitem"] div.mantine-Menu-itemLabel'
};

/**
 * Self-healing strategies for a section NavLink's collapse container (pages/leftPanel.js,
 * TC10/TC11/TC12). Strategy #1 is the EXACT original xpath locator (`collapseContainer`
 * above), unchanged — same behavior/cost as before healing was added. Later strategies are
 * pure fallback safety nets, MCP-verified 2026-08-04 (beta.tailorbird.com):
 *   2. CSS adjacent-sibling combinator `+` — the collapse container is always the
 *      collapsed link's immediate next sibling (`nextElementSibling`, class
 *      `mantine-NavLink-collapse`), confirmed live, not a guess.
 *   3. CSS general-sibling combinator `~` (with `.first()`) — a genuinely different
 *      selector mechanism from #2: it would survive an intermediate wrapper div being
 *      inserted between the link and its collapse container someday, where the strict
 *      adjacent-sibling `+` would break.
 * Only 3 genuinely independent strategies exist for this element — it's a purely
 * structural wrapper with no text, role, or distinguishing attribute of its own to hang
 * a 4th strategy on. Not padded with an invented one.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} parentLocator
 * @param {string} label
 */
function collapseContainerStrategies(page, parentLocator, label) {
    return [
        { name: 'xpath:following-sibling(original)', locator: parentLocator.locator(locators.collapseContainer) },
        { name: 'css:a[hasText]+div.mantine-NavLink-collapse', locator: page.locator(`nav a.mantine-NavLink-root:has-text("${label}") + div.mantine-NavLink-collapse`) },
        { name: 'css:a[hasText]~div.mantine-NavLink-collapse[first]', locator: page.locator(`nav a.mantine-NavLink-root:has-text("${label}") ~ div.mantine-NavLink-collapse`).first() },
    ];
}

/**
 * Self-healing strategies for the nav's profile-menu trigger (tests/TC02_menu.spec.js,
 * TC22 "STATE 2 | Profile menu"). MCP-verified 2026-08-05 (beta.tailorbird.com):
 *   1. Original: partial-class match on the Avatar element (`[class*="Avatar-root"]`)
 *      — Mantine hash-prefixes this class, so partial match is intentional; count=1 in nav.
 *   2. `div[aria-haspopup="menu"] [class*="Avatar-root"]` — the Avatar's PARENT div
 *      carries a genuine ARIA attribute (confirmed unique: the only other
 *      `[aria-haspopup="menu"]` in nav is the "More" NavLink, an `<a>` not a `<div>`),
 *      scoped down to the SAME Avatar span strategy #1 targets (confirmed identical
 *      DOM node via direct equality check) — a genuinely independent selector path to
 *      the same element, not a different element.
 *
 * CAUTION (found live, not assumed): an earlier version of strategy #2 targeted the
 * parent div itself (not scoped down to the Avatar span inside it). That resolved to a
 * DIFFERENT node than strategy #1 — parent vs. child, both simultaneously real and
 * visible — so the combined `.or()` locator was ambiguous (strict-mode violation).
 * Because the caller wraps this in `.isVisible({...}).catch(() => false)`, that error
 * was silently swallowed into `false`, routing execution into a broken hardcoded-name
 * fallback (`"Sumit Mishra"`, not this account's real name) that then timed out. Always
 * verify combined `.or()` strategies resolve to the SAME element, not just "an element
 * that seems equivalent" — see the organizationSelect fix in locators/loginLocator.js
 * for the same lesson.
 *
 * Only 2 genuinely independent strategies exist — no data-testid, no explicit role, and
 * the div's `id` is Mantine-generated per mount (unusable). Not padded to 4.
 * @param {import('@playwright/test').Page} page
 */
function profileTriggerStrategies(page) {
    return [
        { name: 'css:[class*=Avatar-root](original)', locator: page.locator('nav').locator('[class*="Avatar-root"]').first() },
        { name: 'css:nav div[aria-haspopup=menu]>>[class*=Avatar-root]', locator: page.locator('nav div[aria-haspopup="menu"] [class*="Avatar-root"]').first() },
    ];
}

module.exports = { ...locators, collapseContainerStrategies, profileTriggerStrategies };
