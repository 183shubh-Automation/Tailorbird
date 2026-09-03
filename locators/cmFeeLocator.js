/**
 * CM Fee Configuration locators (Property detail page → "CM Fee Configuration").
 * MCP-verified live (2026-09-01) against beta.tailorbird.com/properties/details.
 *
 * Every interactive element is a chain of >=4 independent locator strategies via
 * `.or()` so a single markup/copy change can't silently break the whole suite —
 * Playwright resolves whichever strategy actually matches at run time.
 * @param {import('@playwright/test').Page} page
 */
function cmFeeLocators(page) {
    const dialog = () => page.getByRole('dialog').filter({ hasText: 'CM Fee Configuration' })
        .or(page.getByRole('dialog', { name: /CM Fee Configuration/i }))
        .or(page.locator('[role="dialog"]').filter({ has: page.getByRole('heading', { name: /CM Fee Configuration/i }) }))
        .or(page.getByRole('dialog').last());

    return {
        // ── Property Overview — entry point ───────────────────────────────────────
        cmFeeConfigButton: page.getByRole('button', { name: 'CM Fee Configuration', exact: true })
            .or(page.getByRole('button', { name: /CM Fee Configuration/i }))
            .or(page.locator('button', { hasText: 'CM Fee Configuration' }))
            .or(page.getByText('CM Fee Configuration', { exact: true }).locator('xpath=ancestor::button[1]')),

        // ── Edit CM Fee Configuration dialog ──────────────────────────────────────
        cmFeeDialog: dialog(),

        cmFeeHeading: dialog().getByRole('heading', { name: 'Edit CM Fee Configuration', exact: true })
            .or(page.getByRole('heading', { name: /Edit CM Fee Configuration/i }))
            .or(dialog().getByRole('banner').getByRole('heading'))
            .or(dialog().getByRole('heading').first()),

        cmFeeEnabledCheckbox: dialog().getByRole('checkbox', { name: 'CM Fee Enabled', exact: true })
            .or(page.getByRole('checkbox', { name: /CM Fee Enabled/i }))
            .or(dialog().getByLabel('CM Fee Enabled', { exact: true }))
            .or(dialog().locator('input[type="checkbox"]').first()),

        cmFeePercentageInput: dialog().getByRole('textbox', { name: 'CM Fee Percentage', exact: true })
            .or(page.getByRole('textbox', { name: /CM Fee Percentage/i }))
            .or(dialog().getByPlaceholder('Enter cm fee percentage', { exact: true }))
            .or(dialog().getByLabel('CM Fee Percentage', { exact: true })),

        cmFeeBudgetItemInput: dialog().getByRole('textbox', { name: 'Budget Item', exact: true })
            .or(page.getByRole('textbox', { name: /Budget Item/i }))
            .or(dialog().getByPlaceholder('Select budget item', { exact: true }))
            .or(dialog().getByLabel('Budget Item', { exact: true })),

        // Dynamic: one Budget Item option in the open listbox, matched by visible text.
        cmFeeBudgetItemOption: (name) => page.getByRole('option', { name, exact: true })
            .or(page.getByRole('listbox', { name: 'Budget Item' }).getByRole('option', { name }))
            .or(page.getByRole('option', { name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }))
            .or(page.locator('[role="option"]').filter({ hasText: name })),

        // MCP-verified live (2026-09-02): this dialog now renders as a Mantine Drawer with its
        // own native, icon-only "X" close button ahead of the real "Cancel" button in the DOM.
        // The old positional fallback (`dialog().locator('button').first()`) now matches that X
        // icon instead — and since `.or()` unions every branch's own match rather than stopping
        // at the first branch that resolves, combining it with the exact-name branch above threw
        // a strict-mode violation (2 elements) even though the exact-name branch alone already
        // resolves correctly. Requiring visible text on the fallback excludes the icon-only close
        // button by construction (rather than relying on DOM/`.first()` ordering, which would be
        // luck-of-position, not a real distinction between two buttons with different behavior).
        cmFeeCancelButton: dialog().getByRole('button', { name: 'Cancel', exact: true })
            .or(page.getByRole('button', { name: /^Cancel$/i }))
            .or(dialog().locator('button').filter({ hasText: 'Cancel' }))
            .or(dialog().locator('button').filter({ hasText: /\S/ }).first()),

        cmFeeSaveChangesButton: dialog().getByRole('button', { name: 'Save Changes', exact: true })
            .or(page.getByRole('button', { name: /Save Changes/i }))
            .or(dialog().locator('button').filter({ hasText: 'Save Changes' }))
            .or(dialog().locator('button').last()),

        // Mantine notification toast raised on Save. MCP-verified live (2026-09-02): the 4th
        // fallback previously matched the toast's inner `.mantine-Notification-description` text
        // node directly — a DIFFERENT element from the outer `role="alert"` container the other 3
        // branches resolve to (whose own textContent concatenates the "Success" title with the
        // description, e.g. "Successproperty_draw_config updated successfully" — the exact string
        // `saveChanges()`'s `toastText.toContain('Success')` check relies on). Unioned together
        // that was a strict-mode violation; scoping the 4th branch up to its own alert ancestor
        // makes every branch resolve to that same outer container instead of two different nodes.
        cmFeeSuccessToast: page.getByRole('alert').filter({ hasText: 'Success' }).filter({ hasText: /property_draw_config/i })
            .or(page.getByRole('alert').filter({ hasText: /property_draw_config (created|updated) successfully/i }))
            .or(page.locator('[role="alert"]').filter({ hasText: 'Success' }))
            .or(page.getByText(/property_draw_config (created|updated) successfully/i).locator('xpath=ancestor::*[@role="alert"][1]')),
    };
}

module.exports = { cmFeeLocators };
