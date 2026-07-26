// locators.js
module.exports = {
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
