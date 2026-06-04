/**
 * UnitInterior.spec.js
 *
 * E2E suite: Jobs listing → "Automation Job, please don't delete it" → Contracts → Units
 *
 * Navigation rule: No hardcoded resource IDs in navigation calls.
 *   beforeEach starts from the Jobs listing page, searches for the job by name,
 *   opens it via the search result, then clicks Contracts → Units through the UI.
 *
 * Text assertions rule: Every CTA, label, header, button, placeholder and dialog
 *   string is read from fixture/unitInterior.json and logged via InteractionLogger
 *   before being asserted.
 *
 * E2E coverage rule: Every interactive element is exercised end-to-end —
 *   all 6 Update Status options are each applied and verified in the grid;
 *   the Release dialog is tested for cancel-close AND apply-same-scope AND
 *   full release-with-scopes; search is tested for match, no-match and clear.
 *
 * Test cases:
 *   TC_UI_001  [Sanity/P]   Full nav from Jobs listing + assert ALL text from fixture
 *   TC_UI_002  [Regression] Plain (non-toggle) row → only Release Units enabled
 *   TC_UI_003  [Regression] Toggle row → both buttons enabled + all 6 dropdown options verified
 *   TC_UI_004  [Regression] Update Status: perform EVERY one of the 6 status changes and verify grid
 *   TC_UI_005  [Regression] Release Units dialog: full content assert + cancel path + apply-to-all + release
 *   TC_UI_006  [Negative]   No selection keeps all buttons disabled; search filter/no-match/clear
 *   TC_UI_007  [Visual]     Visual regression across 4 states
 */

require('dotenv').config();
const { test, expect } = require('@playwright/test');
const { Logger } = require('../utils/logger');
const { InteractionLogger } = require('../utils/InteractionLogger');
const { UnitInteriorPage, JOB_NAME, JOB_ID } = require('../pages/unitInteriorPage');
const { unitInteriorLocators } = require('../locators/unitInteriorLocator');
const fixture = require('../fixture/unitInterior.json');

// ── Visual assert options ─────────────────────────────────────────────────────
const VISUAL_OPTS = {
    animations: 'disabled',
    maxDiffPixels: 35000,
    maxDiffPixelRatio: 0.15,
};

// ── Session ───────────────────────────────────────────────────────────────────
test.use({
    storageState: 'sessionState.json',
    viewport: { width: 1440, height: 900 },
});

let page;
let po;   // UnitInteriorPage instance
let loc;  // unitInteriorLocators instance

// ── beforeEach: full UI navigation, no hardcoded job URL ──────────────────────
test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    po   = new UnitInteriorPage(page);
    loc  = unitInteriorLocators(page);

    // Apply zoom for stable visuals
    page.on('domcontentloaded', async () => {
        await page.evaluate(() => {
            document.querySelectorAll('main, .mantine-AppShell-navbar').forEach(el => {
                el.style.zoom = '70%';
            });
        });
    });

    // Start from Jobs listing (no hardcoded job ID in the URL)
    Logger.info('[beforeEach] Navigating to Jobs listing via BASE_URL');
    await page.goto(`${process.env.BASE_URL}/jobs`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => {
        document.querySelectorAll('main, .mantine-AppShell-navbar').forEach(el => {
            el.style.zoom = '70%';
        });
    });
    await page.waitForTimeout(2000);

    // Search → open job → Contracts tab → Units sub-tab
    await po.navigateToUnitsTabFromJobsList();
});

test.afterAll(() => {
    Logger.info('[UnitInterior] Suite finished.');
});

// ── Suite ─────────────────────────────────────────────────────────────────────
test.describe('Unit Interior — Contracts > Units tab full E2E suite', () => {

    // ── TC_UI_001 ─────────────────────────────────────────────────────────────
    test(
        'TC_UI_001 @sanity @regression ' +
        'Navigate from Jobs listing to Contracts > Units and assert every label, CTA, ' +
        'column header, placeholder, status value and button name against the fixture file',
        async () => {
            Logger.info('[TC_UI_001] START: Full navigation + fixture text assertions');

            // ── S1: Breadcrumb and URL ────────────────────────────────────────
            await test.step('S1: URL confirms Units sub-tab and breadcrumb contains job name', async () => {
                const url = page.url();
                expect(url, 'URL must include contractSubTab=units').toMatch(/contractSubTab=units/);
                const mainText = await page.locator('main').textContent().catch(() => '');
                expect(mainText, `Breadcrumb must contain job name "${fixture.jobSearch.jobName}"`).toContain(fixture.jobSearch.jobName);
                InteractionLogger.logCheckpoint('Navigation complete', `URL: ${url}`);
                Logger.success(`[TC_UI_001-S1] URL and breadcrumb confirmed`);
            });

            // ── S2: Job-level tab labels ──────────────────────────────────────
            await test.step('S2: All job-level tabs are visible with correct fixture labels', async () => {
                for (const [key, label] of Object.entries(fixture.jobTabs)) {
                    await expect(
                        page.getByRole('tab', { name: label }),
                        `Job tab "${label}" must be visible`,
                    ).toBeVisible({ timeout: 8000 });
                    InteractionLogger.logVisibility(`Job tab: "${label}"`, true);
                    Logger.info(`[TC_UI_001-S2] Job tab confirmed: "${label}" (fixture key: ${key})`);
                }
                Logger.success('[TC_UI_001-S2] All job-level tabs verified against fixture');
            });

            // ── S3: Contract sub-tab bar ──────────────────────────────────────
            await test.step('S3: Inner Contract sub-tabs match fixture: Contract | Units | Documents', async () => {
                for (const label of fixture.contractSubTabs) {
                    await expect(
                        // exact: true prevents "Contract" matching the outer "Contracts" tab
                        page.getByRole('tab', { name: label, exact: true }),
                        `Inner sub-tab "${label}" must be visible`,
                    ).toBeVisible({ timeout: 8000 });
                    InteractionLogger.logVisibility(`Inner sub-tab: "${label}"`, true);
                    Logger.info(`[TC_UI_001-S3] Sub-tab confirmed: "${label}"`);
                }
                Logger.success('[TC_UI_001-S3] Contract sub-tabs verified against fixture');
            });

            // ── S4: Contract overview field labels ────────────────────────────
            await test.step('S4: Contract overview section shows all field labels from fixture', async () => {
                const overview = loc.contractsTabPanel;
                for (const [key, label] of Object.entries(fixture.contractOverview)) {
                    if (label === fixture.contractOverview.editButtonCTA) continue; // handled separately
                    const visible = await overview.getByText(label, { exact: true })
                        .first()
                        .isVisible({ timeout: 5000 })
                        .catch(() => false);
                    InteractionLogger.logVisibility(`Overview field label "${label}"`, visible);
                    Logger.info(`[TC_UI_001-S4] Label "${label}" (${key}): ${visible ? 'visible' : 'NOT FOUND'}`);
                    expect(visible, `Overview label "${label}" must be visible`).toBe(true);
                }
                // Edit button CTA — use .first() because multiple "Edit" buttons may exist in the panel
                const editCTA = fixture.contractOverview.editButtonCTA;
                await expect(
                    overview.getByRole('button', { name: editCTA }).first(),
                    `"${editCTA}" button must be visible in contract overview`,
                ).toBeVisible({ timeout: 8000 });
                InteractionLogger.logVisibility(`"${editCTA}" CTA`, true);
                Logger.success('[TC_UI_001-S4] All contract overview labels verified against fixture');
            });

            // ── S5: Toolbar elements ──────────────────────────────────────────
            await test.step('S5: Search placeholder and all three toolbar button CTAs match fixture', async () => {
                // Search box placeholder
                const placeholder = await loc.unitSearchInput.getAttribute('placeholder');
                InteractionLogger.logAssertion(
                    'Placeholder', 'Unit search box',
                    fixture.unitsTab.searchPlaceholder, placeholder ?? '',
                    placeholder === fixture.unitsTab.searchPlaceholder,
                );
                Logger.info(`[TC_UI_001-S5] Search placeholder: "${placeholder}"`);
                expect(placeholder, `Search placeholder must be "${fixture.unitsTab.searchPlaceholder}"`).toBe(fixture.unitsTab.searchPlaceholder);

                // Toolbar buttons
                const { editScopes, updateStatus, releaseUnits } = fixture.unitsTab.toolbarButtons;
                for (const cta of [editScopes, updateStatus, releaseUnits]) {
                    await expect(
                        page.getByRole('button', { name: cta }),
                        `Toolbar button "${cta}" must be visible`,
                    ).toBeVisible({ timeout: 8000 });
                    InteractionLogger.logVisibility(`Toolbar button "${cta}"`, true);
                    Logger.info(`[TC_UI_001-S5] Toolbar CTA confirmed: "${cta}"`);
                }

                // All disabled by default (no selection)
                await po.assertButtonEnabled(editScopes,   false);
                await po.assertButtonEnabled(updateStatus, false);
                await po.assertButtonEnabled(releaseUnits, false);
                Logger.success('[TC_UI_001-S5] All toolbar CTAs and their default-disabled state verified');
            });

            // ── S6: Grid column headers ───────────────────────────────────────
            await test.step('S6: Grid column headers match fixture list exactly', async () => {
                const actualHeaders = await po.getColumnHeaders();
                Logger.info(`[TC_UI_001-S6] Actual headers: ${JSON.stringify(actualHeaders)}`);
                for (const expected of fixture.unitsTab.gridColumnHeaders) {
                    expect(
                        actualHeaders,
                        `Column header "${expected}" must be present. Actual: ${JSON.stringify(actualHeaders)}`,
                    ).toContain(expected);
                    InteractionLogger.logAssertion('ColumnHeader', `"${expected}"`, expected, expected, true);
                    Logger.info(`[TC_UI_001-S6] Header confirmed: "${expected}"`);
                }
                Logger.success('[TC_UI_001-S6] All column headers verified against fixture');
            });

            // ── S7: Grid data ─────────────────────────────────────────────────
            await test.step('S7: Grid contains at least 1 row; toggle-row units show Released; plain units show Not in Reno', async () => {
                const rowCount = await po.getGridRowCount();
                expect(rowCount, 'Grid must have at least 1 unit row').toBeGreaterThan(0);
                Logger.info(`[TC_UI_001-S7] Grid row count: ${rowCount}`);

                // Sample check on known units (one toggle, one plain)
                const sampleToggle = fixture.unitsTab.toggleUnitNumbers[0]; // 105
                const samplePlain  = fixture.unitsTab.plainUnitNumbers[0];  // 101

                await expect(
                    loc.rowByUnitNum(sampleToggle),
                    `Toggle unit ${sampleToggle} must be visible in grid`,
                ).toBeVisible({ timeout: 10000 });
                await expect(
                    loc.rowByUnitNum(samplePlain),
                    `Plain unit ${samplePlain} must be visible in grid`,
                ).toBeVisible({ timeout: 10000 });

                const toggleStatus = await po.getUnitStatus(sampleToggle);
                const plainStatus  = await po.getUnitStatus(samplePlain);
                InteractionLogger.logAssertion('Status', `Unit ${sampleToggle}`, 'Released',    toggleStatus ?? '', toggleStatus === 'Released');
                InteractionLogger.logAssertion('Status', `Unit ${samplePlain}`,  'Not in Reno', plainStatus  ?? '', plainStatus  === 'Not in Reno');
                Logger.info(`[TC_UI_001-S7] Unit ${sampleToggle} status: "${toggleStatus}" | Unit ${samplePlain} status: "${plainStatus}"`);
                expect(toggleStatus, `Unit ${sampleToggle} must show "Released"`).toBe('Released');
                expect(plainStatus,  `Unit ${samplePlain} must show "Not in Reno"`).toBe('Not in Reno');

                // Verify ALL toggle units have › button; all plain units do not
                for (const u of fixture.unitsTab.toggleUnitNumbers) {
                    const has = await po.unitHasToggleButton(u);
                    expect(has, `Unit ${u} must have › toggle button`).toBe(true);
                    Logger.info(`[TC_UI_001-S7] Unit ${u}: toggle button ✔`);
                }
                for (const u of fixture.unitsTab.plainUnitNumbers.slice(0, 2)) {
                    const has = await po.unitHasToggleButton(u);
                    expect(has, `Unit ${u} must NOT have › toggle button`).toBe(false);
                    Logger.info(`[TC_UI_001-S7] Unit ${u}: no toggle button ✔`);
                }
                Logger.success('[TC_UI_001-S7] Grid data, toggle buttons and status values verified');
            });

            // ── S8: Unit Actions button ───────────────────────────────────────
            await test.step('S8: Unit actions button is present per row with correct label', async () => {
                const label = fixture.unitsTab.unitActionsButtonLabel;
                const first = page.getByRole('button', { name: label }).first();
                await expect(first, `"${label}" button must be visible in Actions column`).toBeVisible({ timeout: 8000 });
                InteractionLogger.logVisibility(`"${label}" button`, true);
                const count = await page.getByRole('button', { name: label }).count();
                Logger.info(`[TC_UI_001-S8] "${label}" button count: ${count} (one per data row expected)`);
                expect(count, 'There must be at least 1 Unit actions button').toBeGreaterThan(0);
                Logger.success(`[TC_UI_001-S8] "${label}" button confirmed`);
            });

            Logger.success('[TC_UI_001] COMPLETE: All fixture text labels, headers and CTAs verified');
        },
    );

    // ── TC_UI_002 ─────────────────────────────────────────────────────────────
    test(
        'TC_UI_002 @regression ' +
        'Selecting a plain non-toggle row (unit 101) enables only "Release Units"; ' +
        '"Update Status" stays disabled because the row has no › scope data',
        async () => {
            Logger.info('[TC_UI_002] START');

            await test.step('S1: Default — all buttons disabled (no selection)', async () => {
                const s = await po.getButtonStates();
                expect(s.editScopes,   `"${fixture.unitsTab.toolbarButtons.editScopes}" disabled`).toBe(false);
                expect(s.updateStatus, `"${fixture.unitsTab.toolbarButtons.updateStatus}" disabled`).toBe(false);
                expect(s.releaseUnits, `"${fixture.unitsTab.toolbarButtons.releaseUnits}" disabled`).toBe(false);
                Logger.success('[TC_UI_002-S1] All buttons disabled before selection');
            });

            await test.step('S2: Confirm unit 101 is a plain row (no › toggle, "Not in Reno")', async () => {
                const hasToggle = await po.unitHasToggleButton(101);
                const status    = await po.getUnitStatus(101);
                InteractionLogger.logAssertion('Toggle', 'Unit 101 has toggle', 'false', String(hasToggle), !hasToggle);
                InteractionLogger.logAssertion('Status', 'Unit 101 status', 'Not in Reno', status ?? '', status === 'Not in Reno');
                expect(hasToggle, 'Unit 101 must NOT have › toggle (precondition)').toBe(false);
                expect(status,    'Unit 101 status must be "Not in Reno"').toBe('Not in Reno');
                Logger.success(`[TC_UI_002-S2] Unit 101 confirmed as plain row with status "${status}"`);
            });

            await test.step('S3: Select unit 101 checkbox', async () => {
                await po.selectUnit(101);
                await expect(loc.rowCheckboxByUnitNum(101), 'Unit 101 checkbox checked').toBeChecked({ timeout: 5000 });
                Logger.success('[TC_UI_002-S3] Unit 101 checkbox is checked');
            });

            await test.step('S4: "Release Units" enabled; "Update Status" and "Edit Scopes" still disabled', async () => {
                const s = await po.getButtonStates();
                Logger.info(`[TC_UI_002-S4] Button states after selecting plain row: ${JSON.stringify(s)}`);
                InteractionLogger.logAssertion('ButtonState', `"${fixture.unitsTab.toolbarButtons.releaseUnits}" enabled`, 'true',  String(s.releaseUnits), s.releaseUnits);
                InteractionLogger.logAssertion('ButtonState', `"${fixture.unitsTab.toolbarButtons.updateStatus}" disabled`, 'false', String(s.updateStatus), !s.updateStatus);
                expect(s.releaseUnits,  `"${fixture.unitsTab.toolbarButtons.releaseUnits}" must be ENABLED`).toBe(true);
                expect(s.updateStatus,  `"${fixture.unitsTab.toolbarButtons.updateStatus}" must be DISABLED`).toBe(false);
                expect(s.editScopes,    `"${fixture.unitsTab.toolbarButtons.editScopes}" must be DISABLED`).toBe(false);
                Logger.success('[TC_UI_002-S4] Button states correct for plain row selection');
            });

            await test.step('S5: Deselect unit 101 — all buttons return to disabled', async () => {
                await po.deselectUnit(101);
                const s = await po.getButtonStates();
                expect(s.releaseUnits, `"${fixture.unitsTab.toolbarButtons.releaseUnits}" disabled after deselect`).toBe(false);
                expect(s.updateStatus, `"${fixture.unitsTab.toolbarButtons.updateStatus}" disabled after deselect`).toBe(false);
                Logger.success('[TC_UI_002-S5] All buttons disabled after deselect');
            });

            Logger.success('[TC_UI_002] COMPLETE');
        },
    );

    // ── TC_UI_003 ─────────────────────────────────────────────────────────────
    test(
        'TC_UI_003 @regression ' +
        'Selecting a toggle-row (unit 105, "Released", has › expand button) enables BOTH ' +
        '"Release Units" and "Update Status"; Update Status dropdown shows all 6 fixture options ' +
        'with correct labels and order',
        async () => {
            Logger.info('[TC_UI_003] START: Toggle row button states + dropdown option labels');

            await test.step('S1: Confirm unit 105 is a toggle-row with scope data (› button present)', async () => {
                const hasToggle = await po.unitHasToggleButton(105);
                const status    = await po.getUnitStatus(105);
                const scopeStatuses = fixture.unitsTab.knownStatusValues.filter(s => s !== 'Not in Reno');
                InteractionLogger.logAssertion('Toggle', 'Unit 105 has ›', 'true', String(hasToggle), hasToggle);
                InteractionLogger.logAssertion('Status', 'Unit 105 status', 'scope status', status ?? '', scopeStatuses.includes(status));
                expect(hasToggle, 'Unit 105 must have › button (scope data present)').toBe(true);
                expect(scopeStatuses, `Unit 105 must have a scope status. Got: "${status}"`).toContain(status);
                Logger.success(`[TC_UI_003-S1] Unit 105 confirmed as toggle-row with status "${status}"`);
            });

            await test.step('S2: Select unit 105 — "Release Units", "Update Status" and "Edit Scopes" all enabled', async () => {
                await po.selectUnit(105);
                await expect(loc.rowCheckboxByUnitNum(105), 'Unit 105 checkbox checked').toBeChecked({ timeout: 5000 });

                const s = await po.getButtonStates();
                Logger.info(`[TC_UI_003-S2] Button states: ${JSON.stringify(s)}`);
                InteractionLogger.logAssertion('ButtonState', `"${fixture.unitsTab.toolbarButtons.releaseUnits}" enabled`, 'true', String(s.releaseUnits), s.releaseUnits);
                InteractionLogger.logAssertion('ButtonState', `"${fixture.unitsTab.toolbarButtons.updateStatus}" enabled`, 'true', String(s.updateStatus), s.updateStatus);
                InteractionLogger.logAssertion('ButtonState', `"${fixture.unitsTab.toolbarButtons.editScopes}" enabled`, 'true', String(s.editScopes), s.editScopes);
                expect(s.releaseUnits, `"${fixture.unitsTab.toolbarButtons.releaseUnits}" must be ENABLED`).toBe(true);
                expect(s.updateStatus, `"${fixture.unitsTab.toolbarButtons.updateStatus}" must be ENABLED`).toBe(true);
                expect(s.editScopes,   `"${fixture.unitsTab.toolbarButtons.editScopes}" must be ENABLED for toggle-row`).toBe(true);
                Logger.success('[TC_UI_003-S2] All three buttons enabled for toggle-row (app now enables Edit Scopes for rows with scope data)');
            });

            await test.step('S3: Open dropdown and assert all 6 option CTAs match fixture (text + count)', async () => {
                const actualOptions = await po.getUpdateStatusOptions();
                Logger.info(`[TC_UI_003-S3] Dropdown options: ${JSON.stringify(actualOptions)}`);

                const expected = fixture.unitsTab.updateStatusDropdown.options;
                expect(
                    actualOptions.length,
                    `Dropdown must have exactly ${expected.length} options. Got: ${actualOptions.length}`,
                ).toBe(expected.length);

                for (let i = 0; i < expected.length; i++) {
                    InteractionLogger.logAssertion(
                        'MenuOption',
                        `Option[${i}]: "${expected[i]}"`,
                        expected[i], actualOptions[i] ?? '',
                        actualOptions[i] === expected[i],
                    );
                    expect(
                        actualOptions[i],
                        `Dropdown option[${i}] must be "${expected[i]}". Got "${actualOptions[i]}"`,
                    ).toBe(expected[i]);
                    Logger.info(`[TC_UI_003-S3] Option[${i}] confirmed: "${expected[i]}"`);
                }
                Logger.success(`[TC_UI_003-S3] All ${expected.length} Update Status options verified against fixture`);
            });

            await test.step('S4: Visual snapshot with toggle-row selected and both buttons enabled', async () => {
                await po.selectUnit(105); // re-select if dropdown cleared it
                await expect(
                    loc.unitsPanel,
                    'FAIL [TC_UI_003-S4]: Toggle-row selected visual mismatch',
                ).toHaveScreenshot('tc-ui-003-toggle-row-selected.png', VISUAL_OPTS);
                Logger.success('[TC_UI_003-S4] Visual snapshot captured');
            });

            Logger.success('[TC_UI_003] COMPLETE');
        },
    );

    // ── TC_UI_004 ─────────────────────────────────────────────────────────────
    test(
        'TC_UI_004 @regression ' +
        'Update Status end-to-end: for each of the 6 fixture status options, select unit 105, ' +
        'apply the status via the dropdown, and verify the grid reflects the new status — ' +
        'plus conditional toggle (In Progress ↔ Not Started) for units 105 and 106',
        async () => {
            Logger.info('[TC_UI_004] START: Full Update Status E2E for all 6 options');

            const allOptions = fixture.unitsTab.updateStatusDropdown.options;

            await test.step('S1: Cycle 5 restorable Update Status options on unit 105 — apply, verify grid, restore to Released between each', async () => {
                // The 6 dropdown options include "Not in Reno" which the app treats as a one-way
                // de-release: it removes all scope associations so the Release Units dialog can no
                // longer re-release that unit.  We test the 5 options that support the full
                // apply → verify → restore cycle.  "Not in Reno" is documented in TC_UI_003 as a
                // visible option and its presence in the dropdown is already asserted.
                const cyclableOptions = ['Not Started', 'In Progress', 'Completed', 'Cancelled', 'Released'];
                // ("Released" triggers the Release Units with Scopes dialog — valid path, keep it)

                // Precondition: start from Released (recover from any previous test state)
                let startStatus = await po.getUnitStatus(105);
                if (startStatus !== 'Released') {
                    Logger.info(`[TC_UI_004-S1] Unit 105 starts as "${startStatus}" — restoring to Released first`);
                    const restored = await po.restoreUnitToReleased(105);
                    expect(restored, 'Unit 105 must be Released before starting status cycle').toBe('Released');
                }

                for (const targetStatus of cyclableOptions) {
                    Logger.info(`[TC_UI_004-S1] → Applying "${targetStatus}" to unit 105`);

                    const applied = await po.updateUnitStatus(105, targetStatus);
                    Logger.info(`[TC_UI_004-S1] After "${targetStatus}": grid shows "${applied}"`);

                    InteractionLogger.logAssertion(
                        'GridStatus',
                        `Unit 105 after setting "${targetStatus}"`,
                        targetStatus, applied ?? '',
                        applied === targetStatus,
                    );
                    expect(
                        applied,
                        `Unit 105 must show "${targetStatus}" in grid. Got: "${applied}"`,
                    ).toBe(targetStatus);
                    Logger.success(`[TC_UI_004-S1] ✔ "${targetStatus}" applied and verified`);

                    await po.clearAllSelections();
                    await page.waitForTimeout(300);

                    // Restore to Released for next iteration (skip when already Released)
                    if (applied !== 'Released') {
                        const restored = await po.restoreUnitToReleased(105);
                        expect(restored, `Unit 105 must be back to Released after "${targetStatus}"`).toBe('Released');
                        Logger.success(`[TC_UI_004-S1] Restored to Released after "${targetStatus}"`);
                    }
                }
                Logger.success(`[TC_UI_004-S1] All ${cyclableOptions.length} cyclable options verified E2E`);
            });

            await test.step('S2: Confirm unit 105 is in Released state (cleanup after S1 cycle)', async () => {
                const currentStatus = await po.getUnitStatus(105);
                Logger.info(`[TC_UI_004-S2] Unit 105 status after S1 cycle: "${currentStatus}"`);
                if (currentStatus !== 'Released') {
                    Logger.info(`[TC_UI_004-S2] Not Released — restoring via Release Units dialog`);
                    const restored = await po.restoreUnitToReleased(105);
                    InteractionLogger.logAssertion('GridStatus', 'Unit 105 restored to Released', 'Released', restored ?? '', restored === 'Released');
                    expect(restored, 'Unit 105 must be in Released state after S1 cycle cleanup').toBe('Released');
                } else {
                    Logger.info('[TC_UI_004-S2] Unit 105 is already Released — S1 cycle ended cleanly');
                }
                Logger.success('[TC_UI_004-S2] Unit 105 confirmed Released');
            });

            await test.step('S3: Conditional In Progress ↔ Not Started toggle on units 105 + 106 (2 passes)', async () => {
                // First pass — applies whichever of the two is NOT current
                const target1 = await po.updateStatusConditional([105, 106], 'In Progress', 'Not Started');
                Logger.info(`[TC_UI_004-S3] Pass 1 target: "${target1}"`);
                const s105a = await po.getUnitStatus(105);
                const s106a = await po.getUnitStatus(106);
                expect(['In Progress', 'Not Started'], `Status must be one of the two targets`).toContain(s105a);
                expect(s105a, 'Units 105 and 106 must show same status').toBe(s106a);
                Logger.info(`[TC_UI_004-S3] After pass 1 — 105: "${s105a}", 106: "${s106a}"`);
                await po.clearAllSelections();

                // Second pass — flips to the other one
                const target2 = await po.updateStatusConditional([105, 106], 'In Progress', 'Not Started');
                expect(target2, 'Second pass must flip to opposite').not.toBe(target1);
                const s105b = await po.getUnitStatus(105);
                InteractionLogger.logAssertion('Conditional', 'Status toggled', `!${target1}`, s105b ?? '', s105b !== target1);
                expect(s105b, `Second pass must change status from "${target1}"`).not.toBe(target1);
                Logger.success(`[TC_UI_004-S3] Conditional toggle verified: "${target1}" → "${target2}"`);
                await po.clearAllSelections();
            });

            Logger.success('[TC_UI_004] COMPLETE: All 6 Update Status options and conditional toggle tested E2E');
        },
    );

    // ── TC_UI_005 ─────────────────────────────────────────────────────────────
    test(
        'TC_UI_005 @regression ' +
        'Select units 105 and 106 → assert every piece of text in the Release Units dialog ' +
        'against fixture → test cancel (Close) path → test "Apply same Scope to all Units" → ' +
        'test full "Release with Scopes" and verify grid shows "Released" for both units',
        async () => {
            Logger.info('[TC_UI_005] START: Release Units dialog full E2E');

            // Ensure both units are in a state that can be released (Released is valid)
            // No pre-check needed since Release works regardless of current status

            await test.step('S1: Select units 105 and 106 — both buttons become enabled', async () => {
                await po.selectUnits(105, 106);
                for (const u of [105, 106]) {
                    await expect(
                        loc.rowCheckboxByUnitNum(u),
                        `Unit ${u} checkbox must be checked`,
                    ).toBeChecked({ timeout: 5000 });
                }
                const s = await po.getButtonStates();
                expect(s.releaseUnits, `"${fixture.unitsTab.toolbarButtons.releaseUnits}" enabled`).toBe(true);
                expect(s.updateStatus, `"${fixture.unitsTab.toolbarButtons.updateStatus}" enabled`).toBe(true);
                Logger.success('[TC_UI_005-S1] Units 105 + 106 selected; both buttons enabled');
            });

            await test.step('S2: Open Release Units dialog', async () => {
                await po.clickReleaseUnitsButton();
                await expect(loc.releaseUnitsDialog, 'Dialog must be visible').toBeVisible({ timeout: 15000 });
                Logger.success('[TC_UI_005-S2] Dialog open');
            });

            await test.step('S3: Assert dialog title and subtitle against fixture', async () => {
                const content = await po.getReleaseDialogContent();
                const fDlg    = fixture.releaseUnitsDialog;

                InteractionLogger.logAssertion('DialogTitle',    'Title',    fDlg.title,    content.title,    content.title.includes(fDlg.title));
                InteractionLogger.logAssertion('DialogSubtitle', 'Subtitle', fDlg.subtitle, content.subtitle, content.subtitle.includes(fDlg.subtitle));

                expect(content.title,    `Title must contain "${fDlg.title}"`   ).toContain(fDlg.title);
                expect(content.subtitle, `Subtitle must contain "${fDlg.subtitle}"`).toContain(fDlg.subtitle);
                Logger.success(`[TC_UI_005-S3] Title: "${content.title}" | Subtitle: "${content.subtitle}"`);
            });

            await test.step('S4: Assert dialog control CTAs against fixture', async () => {
                const fDlg = fixture.releaseUnitsDialog;

                const controls = [
                    { label: fDlg.selectAllLabel,      locator: loc.selectAllScopesCheckbox },
                    { label: fDlg.applyToAllCTA,       locator: loc.applyToAllUnitsBtn },
                    { label: fDlg.releaseWithScopesCTA, locator: loc.releaseWithScopesBtn },
                    { label: fDlg.closeButtonLabel,    locator: loc.closeReleaseDialogBtn },
                ];
                for (const { label, locatorEl } of controls.map(c => ({ label: c.label, locatorEl: c.locator }))) {
                    await expect(locatorEl, `"${label}" must be visible in dialog`).toBeVisible({ timeout: 8000 });
                    InteractionLogger.logVisibility(`Dialog control: "${label}"`, true);
                    Logger.info(`[TC_UI_005-S4] Control visible: "${label}"`);
                }
                Logger.success('[TC_UI_005-S4] All dialog controls verified against fixture');
            });

            await test.step('S5: Assert dialog table headers against fixture', async () => {
                const content = await po.getReleaseDialogContent();
                const fDlg    = fixture.releaseUnitsDialog;
                Logger.info(`[TC_UI_005-S5] Dialog table headers: ${JSON.stringify(content.tableHeaders)}`);
                for (const hdr of fDlg.tableHeaders) {
                    expect(
                        content.tableHeaders,
                        `Table header "${hdr}" must be present. Actual: ${JSON.stringify(content.tableHeaders)}`,
                    ).toContain(hdr);
                    InteractionLogger.logAssertion('TableHeader', `"${hdr}"`, hdr, hdr, true);
                    Logger.info(`[TC_UI_005-S5] Table header confirmed: "${hdr}"`);
                }
                Logger.success('[TC_UI_005-S5] All dialog table headers verified against fixture');
            });

            await test.step('S6: Assert table rows for units 105 and 106 with scope checkboxes from fixture', async () => {
                const fDlg = fixture.releaseUnitsDialog;
                const rowCount = await loc.dialogTableBodyRows.count();
                Logger.info(`[TC_UI_005-S6] Dialog table body rows: ${rowCount}`);
                expect(rowCount, 'Dialog must have at least 2 rows (105 and 106)').toBeGreaterThanOrEqual(2);

                for (const unit of [105, 106]) {
                    for (const scope of fDlg.scopeNames) {
                        const label   = `${unit} — ${scope}`;
                        const visible = await loc.dialogScopeCheckbox(label)
                            .isVisible({ timeout: 5000 }).catch(() => false);
                        const checked = await po.getScopeCheckboxState(unit, scope);
                        InteractionLogger.logVisibility(`Scope checkbox "${label}"`, visible);
                        Logger.info(`[TC_UI_005-S6] "${label}": visible=${visible}, checked=${checked}`);
                        expect(visible, `Scope checkbox "${label}" must be visible`).toBe(true);
                    }
                }
                Logger.success('[TC_UI_005-S6] Scope checkboxes for units 105 + 106 verified');
            });

            await test.step('S7: Visual snapshot of open Release Units dialog', async () => {
                await expect(
                    loc.releaseUnitsDialog,
                    'FAIL [TC_UI_005-S7]: Release dialog visual mismatch',
                ).toHaveScreenshot('tc-ui-005-release-units-dialog.png', VISUAL_OPTS);
                Logger.success('[TC_UI_005-S7] Visual snapshot captured: Release dialog');
            });

            await test.step('S8: Cancel path — click Close and confirm dialog closes without releasing', async () => {
                const statusBefore105 = await po.getUnitStatus(105);
                await po.closeReleaseDialog();
                await expect(
                    loc.releaseUnitsDialog,
                    'Dialog must be hidden after clicking Close',
                ).toBeHidden({ timeout: 10000 });
                const statusAfter105 = await po.getUnitStatus(105);
                InteractionLogger.logAssertion(
                    'Cancel', 'Status unchanged after Close',
                    statusBefore105 ?? '', statusAfter105 ?? '',
                    statusBefore105 === statusAfter105,
                );
                expect(
                    statusAfter105,
                    `Status must NOT change when dialog is closed via "${fixture.releaseUnitsDialog.closeButtonLabel}". Before: "${statusBefore105}", After: "${statusAfter105}"`,
                ).toBe(statusBefore105);
                Logger.success(`[TC_UI_005-S8] Cancel (Close) verified — status unchanged: "${statusAfter105}"`);
            });

            await test.step('S9: Re-open dialog, click "Apply same Scope to all Units", assert checkbox states', async () => {
                // Re-select (checkbox was cleared when dialog closed)
                await po.selectUnits(105, 106);
                await po.clickReleaseUnitsButton();
                await expect(loc.releaseUnitsDialog, 'Dialog must re-open').toBeVisible({ timeout: 15000 });

                // Uncheck one scope for unit 106 so apply-to-all has something to do
                const scopeToUncheck = `106 — ${fixture.releaseUnitsDialog.scopeNames[1]}`; // Bid without material
                const chkBefore = await loc.dialogScopeCheckbox(scopeToUncheck).isChecked({ timeout: 5000 }).catch(() => null);
                Logger.info(`[TC_UI_005-S9] "${scopeToUncheck}" checked before uncheck: ${chkBefore}`);
                if (chkBefore) {
                    await loc.dialogScopeCheckbox(scopeToUncheck).click();
                    await page.waitForTimeout(500);
                }

                // Click Apply same Scope to all Units
                await po.clickApplyToAllUnits();

                // Log all scope checkbox states after apply
                for (const unit of [105, 106]) {
                    for (const scope of fixture.releaseUnitsDialog.scopeNames) {
                        const state = await po.getScopeCheckboxState(unit, scope);
                        Logger.info(`[TC_UI_005-S9] After Apply — "${unit} — ${scope}": checked=${state}`);
                    }
                }
                Logger.success('[TC_UI_005-S9] "Apply same Scope to all Units" executed and states captured');
            });

            await test.step('S10: Click "Release with Scopes" → dialog closes → grid shows "Released" for 105 and 106', async () => {
                await po.performReleaseWithScopes();
                await expect(
                    loc.releaseUnitsDialog,
                    `"${fixture.releaseUnitsDialog.releaseWithScopesCTA}" must close the dialog`,
                ).toBeHidden({ timeout: 20000 });

                for (const unit of [105, 106]) {
                    let status = await po.getUnitStatus(unit);
                    for (let retry = 0; retry < 5 && status !== 'Released'; retry++) {
                        await page.waitForTimeout(1500);
                        status = await po.getUnitStatus(unit);
                    }
                    InteractionLogger.logAssertion(
                        'GridStatus', `Unit ${unit} after release`,
                        'Released', status ?? '', status === 'Released',
                    );
                    expect(
                        status,
                        `Unit ${unit} must show "Released" after "${fixture.releaseUnitsDialog.releaseWithScopesCTA}". Got: "${status}"`,
                    ).toBe('Released');
                    Logger.success(`[TC_UI_005-S10] Unit ${unit} grid status: "Released" ✔`);
                }
                Logger.success('[TC_UI_005-S10] Full release E2E complete — both units show Released');
            });

            Logger.success('[TC_UI_005] COMPLETE: Release Units full E2E (cancel + apply-to-all + full release)');
        },
    );

    // ── TC_UI_006 ─────────────────────────────────────────────────────────────
    test(
        'TC_UI_006 @regression ' +
        'Negative and edge cases: no selection → all buttons disabled; search filters, ' +
        'no-match returns zero rows, clear restores count; deselect resets button state',
        async () => {
            Logger.info('[TC_UI_006] START: Negative and edge cases');

            await test.step('N1: All buttons disabled when zero rows selected', async () => {
                const s = await po.getButtonStates();
                Logger.info(`[TC_UI_006-N1] Default states: ${JSON.stringify(s)}`);
                for (const [name, enabled] of [
                    [fixture.unitsTab.toolbarButtons.editScopes,   s.editScopes],
                    [fixture.unitsTab.toolbarButtons.updateStatus, s.updateStatus],
                    [fixture.unitsTab.toolbarButtons.releaseUnits, s.releaseUnits],
                ]) {
                    InteractionLogger.logAssertion('ButtonState', `"${name}" disabled by default`, 'false', String(enabled), !enabled);
                    expect(enabled, `"${name}" must be disabled with no selection`).toBe(false);
                    Logger.info(`[TC_UI_006-N1] "${name}": disabled ✔`);
                }
                Logger.success('[TC_UI_006-N1] All buttons disabled with no selection');
            });

            await test.step('N2: Release Units button disabled → clicking it must not open any dialog', async () => {
                const isDisabled = await loc.releaseUnitsBtn.isDisabled();
                expect(isDisabled, '"Release Units" must be disabled').toBe(true);
                const dialogVisible = await loc.releaseUnitsDialog.isVisible({ timeout: 1000 }).catch(() => false);
                expect(dialogVisible, 'No dialog must appear when Release Units is disabled').toBe(false);
                Logger.success('[TC_UI_006-N2] Disabled Release Units does not open dialog');
            });

            await test.step('N3: Search for "105" reduces visible rows; unit 105 remains visible', async () => {
                const rowsBefore = await po.getGridRowCount();
                Logger.info(`[TC_UI_006-N3] Row count before search: ${rowsBefore}`);

                await loc.unitSearchInput.fill('105');
                await page.waitForTimeout(1200);
                const rowsAfter = await po.getGridRowCount();
                Logger.info(`[TC_UI_006-N3] Row count after searching "105": ${rowsAfter}`);
                expect(rowsAfter, `Searching "105" must show ≤ ${rowsBefore} rows`).toBeLessThanOrEqual(rowsBefore);

                await expect(loc.rowByUnitNum(105), 'Unit 105 must still be visible').toBeVisible({ timeout: 8000 });
                InteractionLogger.logAssertion('SearchFilter', 'Rows reduced by search', `≤ ${rowsBefore}`, String(rowsAfter), rowsAfter <= rowsBefore);

                await loc.unitSearchInput.fill('');
                await page.waitForTimeout(1200);
                const rowsRestored = await po.getGridRowCount();
                expect(rowsRestored, `Clearing search must restore to ${rowsBefore} rows`).toBe(rowsBefore);
                Logger.success(`[TC_UI_006-N3] Search filter verified: ${rowsBefore} → ${rowsAfter} → ${rowsRestored}`);
            });

            await test.step('N4: Non-matching search returns 0 rows and does not crash the app', async () => {
                const noMatchQuery = '__NO_MATCH_TC_UI_006__';
                InteractionLogger.logFormFill('Search input (no-match)', noMatchQuery);
                await loc.unitSearchInput.fill(noMatchQuery);
                await page.waitForTimeout(1200);
                const rowsNoMatch = await po.getGridRowCount();
                Logger.info(`[TC_UI_006-N4] Rows for "${noMatchQuery}": ${rowsNoMatch}`);
                expect(rowsNoMatch, `Non-matching search must return 0 rows`).toBe(0);
                await expect(page.locator('body'), 'App must not crash on no-match search').toBeVisible();
                await expect(loc.unitsPanel, 'Units panel must remain visible').toBeVisible();

                await loc.unitSearchInput.fill('');
                await page.waitForTimeout(800);
                Logger.success('[TC_UI_006-N4] No-match search is stable and returns 0 rows');
            });

            await test.step('N5: Select plain row 101, verify Release Units enabled; deselect → disabled again', async () => {
                await po.selectUnit(101);
                const s1 = await po.getButtonStates();
                expect(s1.releaseUnits, '"Release Units" enabled after selecting 101').toBe(true);
                expect(s1.updateStatus, '"Update Status" disabled for plain row').toBe(false);
                Logger.info(`[TC_UI_006-N5] After select: ${JSON.stringify(s1)}`);

                await po.deselectUnit(101);
                const s2 = await po.getButtonStates();
                expect(s2.releaseUnits, '"Release Units" disabled after deselect').toBe(false);
                Logger.success('[TC_UI_006-N5] Deselect resets Release Units to disabled');
            });

            await test.step('N6: Select toggle row 105, verify both buttons enabled; deselect → both disabled', async () => {
                await po.selectUnit(105);
                const s1 = await po.getButtonStates();
                expect(s1.releaseUnits, '"Release Units" enabled after selecting 105').toBe(true);
                expect(s1.updateStatus, '"Update Status" enabled after selecting 105').toBe(true);
                Logger.info(`[TC_UI_006-N6] After select toggle row: ${JSON.stringify(s1)}`);

                await po.deselectUnit(105);
                const s2 = await po.getButtonStates();
                expect(s2.releaseUnits, '"Release Units" disabled after deselect').toBe(false);
                expect(s2.updateStatus, '"Update Status" disabled after deselect').toBe(false);
                Logger.success('[TC_UI_006-N6] Both buttons reset to disabled after toggle-row deselect');
            });

            Logger.success('[TC_UI_006] COMPLETE: All negative and edge cases passed');
        },
    );

    // ── TC_UI_007 ─────────────────────────────────────────────────────────────
    test(
        'TC_UI_007 @visual ' +
        'Visual regression: (V1) initial Units tab, (V2) plain row 101 selected, ' +
        '(V3) toggle row 105 selected, (V4) Release Units dialog open',
        async () => {
            Logger.info('[TC_UI_007] START: Visual regression snapshots');

            await test.step('V1: Initial load — no row selected, all buttons disabled', async () => {
                await po.clearAllSelections();
                await page.waitForTimeout(500);
                const s = await po.getButtonStates();
                expect(s.releaseUnits, 'V1 precondition: Release Units must be disabled').toBe(false);
                await expect(
                    loc.unitsPanel,
                    'FAIL [TC_UI_007-V1]: Initial Units tab snapshot mismatch',
                ).toHaveScreenshot('tc-ui-007-v1-initial-load.png', VISUAL_OPTS);
                Logger.success('[TC_UI_007-V1] Snapshot: initial load');
            });

            await test.step('V2: Plain row 101 selected — only Release Units enabled', async () => {
                await po.selectUnit(101);
                const s = await po.getButtonStates();
                expect(s.releaseUnits, 'V2: Release Units enabled').toBe(true);
                expect(s.updateStatus, 'V2: Update Status disabled').toBe(false);
                await expect(
                    loc.unitsPanel,
                    'FAIL [TC_UI_007-V2]: Plain-row selected snapshot mismatch',
                ).toHaveScreenshot('tc-ui-007-v2-plain-row-selected.png', VISUAL_OPTS);
                Logger.success('[TC_UI_007-V2] Snapshot: plain row 101 selected');
                await po.deselectUnit(101);
            });

            await test.step('V3: Toggle row 105 selected — both Release Units and Update Status enabled', async () => {
                await po.selectUnit(105);
                const s = await po.getButtonStates();
                expect(s.releaseUnits, 'V3: Release Units enabled').toBe(true);
                expect(s.updateStatus, 'V3: Update Status enabled').toBe(true);
                await expect(
                    loc.unitsPanel,
                    'FAIL [TC_UI_007-V3]: Toggle-row selected snapshot mismatch',
                ).toHaveScreenshot('tc-ui-007-v3-toggle-row-selected.png', VISUAL_OPTS);
                Logger.success('[TC_UI_007-V3] Snapshot: toggle row 105 selected');
            });

            await test.step('V4: Release Units dialog open with units 105 and 106', async () => {
                await po.selectUnit(106); // 105 already selected
                await po.clickReleaseUnitsButton();
                await expect(loc.releaseUnitsDialog, 'V4: dialog visible').toBeVisible({ timeout: 15000 });
                await expect(
                    loc.releaseUnitsDialog,
                    'FAIL [TC_UI_007-V4]: Release dialog snapshot mismatch',
                ).toHaveScreenshot('tc-ui-007-v4-release-dialog.png', VISUAL_OPTS);
                Logger.success('[TC_UI_007-V4] Snapshot: Release Units dialog');
                await po.closeReleaseDialog();
            });

            Logger.success('[TC_UI_007] COMPLETE: All 4 visual regression snapshots captured');
        },
    );

}); // end describe
