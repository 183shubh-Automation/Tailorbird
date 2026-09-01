/**
 * Locators for the Out of Office (OOO) feature.
 * All selectors verified via MCP browser live DOM inspection on 2026-05-26; re-verified
 * live 2026-08-10 (beta.tailorbird.com/profile, Out of Office tab) when adding the
 * multi-locator fallback strategies below.
 *
 * DOM facts:
 *  - Radio inputs: type="radio" value="user"|"role" inside a Mantine RadioGroup
 *  - Team member & role dropdowns: Mantine Select — rendered as <input> inside a textbox role
 *  - Date picker: Mantine DateInput — placeholder "Pick a date"
 *  - Past dates: data-disabled="true" on .mantine-DateInput-day buttons
 *  - Previous-month nav: first .mantine-DateInput-calendarHeaderControl button, disabled=true when on current month
 *  - Active state: <p> inside tabpanel containing "Active — delegating approvals to"
 *  - POST payload: { delegateRoleId: N, deactivateAt: null|"YYYY-MM-DD" }
 *    OR            { delegateUserId: N, deactivateAt: null|"YYYY-MM-DD" }
 *  - GET /api/ooo response: { success, ooo: null|{id, delegate_user_id, delegate_role_id, deactivate_at, started_at, delegate_role_name}, delegatedFrom, currentUserId }
 *
 * Fallback strategies (see utils/locatorHealer.js) are added ONLY where MCP live-run
 * confirmed a second, independent mechanism resolves to the EXACT SAME DOM node as the
 * original — e.g. a native <input>/<button> whose role/accessible-name is computed from
 * an attribute or its own text that a plain CSS selector can also match directly. Elements
 * with no such independently-verified same-node mechanism (calendar prev/next nav — icon-
 * only, no aria-label, distinguished only by position; the date-clear × button — no
 * aria-label, only Mantine's own class) are left as a single strategy: an unsound fallback
 * (e.g. matching a broader ancestor) is worse than none — see the FGA locator fallback
 * regression this same lesson came from (Properties grid "Home" leak, profile-menu-trigger
 * strict-mode violation) fixed in locators/userActivationLocator.js.
 */
const { healingLocator } = require('../utils/locatorHealer');

function oooLocators(page) {
    const oooTabpanel = page.getByRole('tabpanel', { name: 'Out of Office' });

    /** MCP-confirmed: [role="tab"] is set directly on the same element carrying Mantine's own `mantine-Tabs-tab` class — not a wrapper. */
    const tabStrategies = (label) => [
        { name: `role:tab[name=${label}](original)`, locator: page.getByRole('tab', { name: label }) },
        { name: `css:.mantine-Tabs-tab[hasText=${label}]`, locator: page.locator('.mantine-Tabs-tab').filter({ hasText: label }) },
    ];

    /** MCP-confirmed: the radio's own `value` attribute ("user"/"role") lives on the exact same <input> the accessible name resolves to. */
    const radioStrategies = (label, value) => [
        { name: `role:radio[name=${label}](original)`, locator: page.getByRole('radio', { name: label }) },
        { name: `css:input[type=radio][value=${value}]`, locator: page.locator(`input[type="radio"][value="${value}"]`) },
    ];

    /** MCP-confirmed: the Mantine Select/DateInput's accessible name resolves from its own `placeholder` attribute — same <input> either way. */
    const placeholderInputStrategies = (label, placeholder) => [
        { name: `role:textbox[name=${label}](original)`, locator: page.getByRole('textbox', { name: label }) },
        { name: `css:input[placeholder=${placeholder}]`, locator: page.locator(`input[placeholder="${placeholder}"]`) },
    ];

    /** MCP-confirmed: a real native <button> — role="button" is implicit on the same element whose own text CSS :has-text matches. */
    const buttonStrategies = (label) => [
        { name: `role:button[name=${label}](original)`, locator: page.getByRole('button', { name: label }) },
        { name: `css:tabpanel button[hasText=${label}]`, locator: oooTabpanel.locator('button').filter({ hasText: label }) },
    ];

    return {
        // ── Profile page tab strip ─────────────────────────────────────────
        tab_profile:  healingLocator(tabStrategies('Profile')),
        tab_security: healingLocator(tabStrategies('Security')),
        tab_ooo:      healingLocator(tabStrategies('Out of Office')),
        oooTabpanel,

        // ── Delegation type radios ─────────────────────────────────────────
        radio_delegateToUser: healingLocator(radioStrategies('Delegate to user', 'user')),
        radio_delegateToRole: healingLocator(radioStrategies('Delegate to role', 'role')),

        // ── Dropdowns (Mantine Select — role="textbox") ────────────────────
        input_teamMember: healingLocator(placeholderInputStrategies('Select a team member', 'Select a team member')),
        input_role:       healingLocator(placeholderInputStrategies('Select a role', 'Select a role')),

        // Listbox options — pass the exact option label
        roleOption:   (label) => page.getByRole('option', { name: label }),
        memberOption: (label) => page.getByRole('option', { name: label }),

        // ── Helper text (only visible when "Delegate to role" is selected) ─
        // Conditionally MOUNTED (not just hidden) by the app — unmounted entirely outside
        // role mode, so this exact-text match is already unambiguous; no fallback needed.
        helperText: page.getByText(
            'Approvals will be routed to the person assigned to this role for each property.',
            { exact: true }
        ),

        // ── Auto-deactivate date (Mantine DateInput) ───────────────────────
        input_deactivateDate: healingLocator(placeholderInputStrategies('Auto-deactivate on (optional)', 'Pick a date')),

        // The × clear button that appears inside the date wrapper after a date is set.
        // Verified live: Mantine renders this as class "mantine-InputClearButton-root" with
        // no aria-label/text — no independently-verified second mechanism exists for it.
        btn_clearDate: oooTabpanel.locator('button[class*="InputClearButton"]').first(),

        // ── Calendar pop-over elements ─────────────────────────────────────
        // First calendarHeaderControl is the "previous month" left-arrow nav.
        // Verified: disabled=true when already at current month. MCP-confirmed live
        // (2026-08-10): both nav buttons are icon-only (no aria-label/title), distinguished
        // only by DOM position and an SVG rotation — no safe independent fallback exists.
        calendar_prevMonthBtn: page.locator('.mantine-DateInput-calendarHeaderControl').first(),
        calendar_nextMonthBtn: page.locator('.mantine-DateInput-calendarHeaderControl').nth(1),
        calendar_monthLabel:   page.locator('.mantine-DateInput-calendarHeaderLevel'),
        // All day buttons inside the calendar; filter by data-disabled to find past/future dates
        calendar_allDayBtns:   page.locator('.mantine-DateInput-day'),

        // ── Action buttons ─────────────────────────────────────────────────
        btn_activate:   healingLocator(buttonStrategies('Activate OOO mode')),
        btn_deactivate: healingLocator(buttonStrategies('Deactivate OOO mode')),

        // ── Active state display ───────────────────────────────────────────
        // Visible only when OOO is active. Contains text like:
        // "Active — delegating approvals to E2E_Test_Role_1730180000 (role)"
        activeStatePara: oooTabpanel
            .locator('p')
            .filter({ hasText: /Active.*delegating approvals to/i }),

        // ── Sidebar user block (used in TC-OOO-012 navigation test) ────────
        // MCP-confirmed (2026-08-10) live-node-identity check: both strategies resolve to
        // the identical leaf <p> — the fallback scopes to the stable Mantine `Group-root`
        // wrapper class first, then narrows back down to that same exact-text <p>, rather
        // than stopping at the wrapper itself (which is a DIFFERENT, ancestor node — the
        // exact mistake that caused a strict-mode violation in the FGA profile-menu fix).
        sidebarUserBlock: healingLocator([
            { name: 'text:Sumit Harsh(original)', locator: page.locator('nav').getByText(/Sumit Harsh/i).first() },
            {
                name: 'css:.mantine-Group-root>>text:Sumit Harsh',
                locator: page.locator('nav div.mantine-Group-root').filter({ hasText: /Sumit Harsh/i }).getByText(/Sumit Harsh/i).first(),
            },
        ]),

        // ── Approvals sidebar link ─────────────────────────────────────────
        // Unused by TC17 today — left as the original single expression.
        sidebarApprovalsLink: page.locator('nav').getByText('Approvals').first(),
    };
}

module.exports = { oooLocators };
