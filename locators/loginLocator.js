/**
 * Self-healing locator strategies for the AuthKit login flow (pages/loginPage.js).
 * Strategy #1 per element is always the EXACT original locator this app used before
 * healing was added — same expression, same resolution cost, so normal runs behave
 * identically to the pre-existing passing baseline. Later strategies are pure fallback
 * safety nets that only engage if the original ever stops matching a real UI change.
 * No regex, no XPath (semgrep-safe) — Playwright's default string matching for
 * getByRole/getByLabel/getByText is already case-insensitive substring match unless
 * `exact: true` is passed.
 *
 * All 4-strategy sets below were MCP-verified live 2026-08-04 against a genuinely
 * fresh, unauthenticated AuthKit session (logged out via the app's own Logout menu
 * item to get past a persistent cross-domain session cookie).
 * @param {import('@playwright/test').Page} page
 */
function loginElementStrategies(page) {
  return {
    emailInput: [
      { name: 'css:input[name=email],input[type=email]', locator: page.locator('input[name="email"], input[type="email"]') },
      { name: 'role:textbox[name=Email]', locator: page.getByRole('textbox', { name: 'Email' }) },
      { name: 'placeholder:Your email address', locator: page.getByPlaceholder('Your email address') },
      /** MCP-verified: real, independent HTML autocomplete attribute distinct from name/type/label/placeholder. */
      { name: 'css:input[autocomplete=email]', locator: page.locator('input[autocomplete="email"]') },
    ],
    passwordInput: [
      { name: 'css:input[name=password],input[type=password]', locator: page.locator('input[name="password"], input[type="password"]') },
      { name: 'label:Password', locator: page.getByLabel('Password') },
      { name: 'placeholder:Your password', locator: page.getByPlaceholder('Your password') },
      { name: 'css:input[autocomplete=current-password]', locator: page.locator('input[autocomplete="current-password"]') },
    ],
    continueButton: [
      { name: 'css:button[type=submit]:has-text(Continue)', locator: page.locator('button[type="submit"]:has-text("Continue")') },
      { name: 'role:button[name=Continue]', locator: page.getByRole('button', { name: 'Continue' }) },
      /** MCP-verified: data-hak-cta is a real AuthKit-specific "hosted authkit CTA" marker — exactly 1 match per step (email step here), since only one primary CTA renders at a time. */
      { name: 'css:[data-hak-cta]', locator: page.locator('[data-hak-cta]') },
      /** MCP-verified: ak-PrimaryButton is a real, AuthKit-specific class — also exactly 1 match per step. */
      { name: 'css:.ak-PrimaryButton', locator: page.locator('.ak-PrimaryButton') },
    ],
    signInButton: [
      { name: 'css:button[name=intent]:has-text(Sign in)', locator: page.locator('button[name="intent"]:has-text("Sign in")') },
      { name: 'role:button[name=Sign in]', locator: page.getByRole('button', { name: 'Sign in' }) },
      /** MCP-verified: same data-hak-cta marker as continueButton — exactly 1 match on the password step. */
      { name: 'css:[data-hak-cta]', locator: page.locator('[data-hak-cta]') },
      { name: 'css:.ak-PrimaryButton', locator: page.locator('.ak-PrimaryButton') },
    ],
    organizationSelect: [
      { name: 'scoped:.ak-OrgSelection>role:button[name=QA Automations Org_2026]', locator: page.locator('.ak-OrgSelection').getByRole('button', { name: 'QA Automations Org_2026' }) },
      { name: 'role:button[name=QA Automations Org_2026]', locator: page.getByRole('button', { name: 'QA Automations Org_2026' }) },
      /** MCP-verified: each org button carries a real, unique `value="org_<id>"` attribute tied to that org's backend ID — stable as long as the QA Automations Org_2026 test org exists. */
      { name: 'css:button[value=org_01KT25WVGR8WYABP3EVYSZZ7QG]', locator: page.locator('button[value="org_01KT25WVGR8WYABP3EVYSZZ7QG"]') },
      /**
       * REMOVED (2026-08-05): a 4th "positional" strategy (`.ak-OrgSelectionButton.first()`)
       * was here, reasoning that QA Automations Org_2026 renders first in the org list. That's
       * true only for TC01's test account — TC03 logs in as a DIFFERENT account
       * (NEW_TEST_EMAIL) whose org list has a different org ("IRT") listed first. Since `.or()`
       * unions every distinct match across ALL strategies (not "first strategy that succeeds"),
       * that positional strategy resolved to a genuinely different button than strategies 1-3,
       * causing a real strict-mode violation ("resolved to 2 elements") — not a flake. Position
       * is fundamentally the wrong kind of signal for "find this ONE NAMED org among several
       * options" — unlike a generic single-CTA button, an org list's order is account-specific
       * and not something a fallback can safely assume. Only 3 genuinely safe, account-agnostic
       * strategies exist for this element; not padded back to 4 with an unsafe one.
       */
    ],
    errorMessage: [
      { name: 'css:.error,.form-error,[role=alert]', locator: page.locator('.error, .form-error, [role="alert"]') },
      { name: 'role:alert', locator: page.getByRole('alert') },
      /**
       * MCP-verified 2026-08-04: triggering a real validation error ("Please enter your email")
       * showed it does NOT render in a [role="alert"] region at all (confirmed empty) — it's a
       * plain div with a dedicated, purpose-built class `ak-ErrorMessage`. This is actually a MORE
       * reliable signal than the original strategies for this specific error type, but per the
       * "original stays primary" rule it's added as a fallback, not promoted — `.or()` doesn't
       * care about ordering for a simple existence check.
       */
      { name: 'css:.ak-ErrorMessage', locator: page.locator('.ak-ErrorMessage') },
      /** MCP-verified: the invalid field's wrapper carries data-invalid="true" (AuthKit-specific validation marker), scoped down to its error text. */
      { name: 'css:[data-invalid=true] .ak-ErrorMessage', locator: page.locator('[data-invalid="true"] .ak-ErrorMessage') },
    ],
  };
}

module.exports = { loginElementStrategies };
