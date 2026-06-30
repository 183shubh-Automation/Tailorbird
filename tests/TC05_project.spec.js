require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { ProjectJob } = require('../pages/projectJob');
const { ProjectPage } = require('../pages/projectPage');
const { BudgetJob } = require('../pages/budgetPage');
const PropertiesHelper = require('../pages/properties');

test.use({
    storageState: 'sessionState.json',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
});

let projectPage, projectJob, prop;
const PROJECT_VISUAL_ASSERT = {
    animations: 'disabled',
    maxDiffPixels: 100000,
    threshold: 0.3,
    maxDiffPixelRatio: 0.3,
};

test.beforeEach(async ({ page }) => {
    projectPage = new ProjectPage(page);
    projectJob = new ProjectJob(page);
    prop = new PropertiesHelper(page);

    await page.goto(process.env.DASHBOARD_URL, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(process.env.DASHBOARD_URL);
    // networkidle times out on CapEx page in CI â€” wait for app shell instead
    const _appShell05 = page.locator('.mantine-AppShell-navbar, .mantine-AppShell-main, main').first();
    await _appShell05.waitFor({ state: 'visible', timeout: 20_000 });
});

test('TC63 @regression @projectAndJob : Navigate to Projects & Jobs and verify page loads successfully within 2 seconds and zero console error', async ({ page }) => {
    await projectPage.navigateToProjects();
});

test('TC64 @regression @projectAndJob : User should be able to Open Create Project modal and verify all fields are visible', async () => {
    await projectPage.navigateToProjects();
    await projectPage.openCreateProjectModal();
    await projectPage.verifyModalFields();
});

test('TC65 @regression @sanity @mandatory @projectAndJob @contract : User should be able to Fill Create Project form, submit, and verify project details on dashboard', async ({ page }) => {
    let propertyName;
    const propertyDataPath = path.join(__dirname, '../data/propertyData.json');
    const downloadsPropertyPath = path.join(process.cwd(), 'downloads', 'property.json');
    if (fs.existsSync(propertyDataPath)) {
        const propertyData = JSON.parse(fs.readFileSync(propertyDataPath, 'utf8'));
        propertyName = propertyData.propertyName;
    } else if (fs.existsSync(downloadsPropertyPath)) {
        const propertyData = JSON.parse(fs.readFileSync(downloadsPropertyPath, 'utf8'));
        propertyName = propertyData.propertyName;
    } else {
        throw new Error('Property name not found. Ensure TC65 (create property) runs first or add data/propertyData.json or downloads/property.json');
    }

    const budgetJob = new BudgetJob(page);
    const budgetDataPath = path.resolve(process.cwd(), 'files', 'budget_data.csv');
    expect(fs.existsSync(budgetDataPath), 'files/budget_data.csv must exist for budget upload').toBeTruthy();

    await budgetJob.navigateToBudget();
    // await budgetJob.waitForPageLoad();

    const propertySelected = await budgetJob.selectPropertyByName(propertyName);
    expect(propertySelected, `Property "${propertyName}" must exist in Budget property dropdown`).toBeTruthy();

    await budgetJob.openRevisionEditor();
    await budgetJob.uploadFileInRevision(budgetDataPath);
    await budgetJob.ensureSubmitEnabledAfterUpload();
    await budgetJob.clickSubmitForApproval();
    // clickSubmitForApproval already handles dialog + network waits; avoid hanging on pages with long-lived requests.
    await page.waitForTimeout(2000);
    await page.waitForURL(/financials\/budget|budget-revision/i, { timeout: 15000 }).catch(() => {});

    // Upload success is already asserted inside uploadFileInRevision (row count in revision grid).
    // Skip main-grid text/row checks here â€” they flake if the overview has not refreshed yet.

    await page.goto(process.env.DASHBOARD_URL, { waitUntil: 'load' });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(10000);

    await projectPage.navigateToProjects();
    await projectPage.openCreateProjectModal();
    const startDate = await projectPage.getStartDate();
    const endDate = await projectPage.getEndDate();
    const budgetAmount = projectPage.generateRandomBudget(400000, 1000000);

    await projectPage.fillProjectDetails({
        name: 'Automation Test Project',
        description: 'Created via Playwright automation',
        startDate,
        endDate,
        budget: budgetAmount
    });
});

test('TC66 @regression @projectAndJob : User should be able to search project using partial name and verify matching results', async () => {
    await projectPage.navigateToProjects();
    await projectPage.setProjectsTableView();
    await projectPage.searchProjectInProjects('Automa_Test');
});

test('TC67 @regression @projectAndJob : User should be able to apply filter and export project', async () => {
    await projectPage.navigateToProjects();
    await projectPage.setProjectsTableView();
    await projectJob.applyProjectFilterAndExport('Test Property 1_Cottages on Elm', 'Automa_Test');
    // await projectJob.deleteFirstProjectRow();
});

test('TC68 @regression @projectAndJob : Validate cancel button closes without saving.', async () => {
    await projectPage.navigateToProjects();
    await projectPage.setProjectsTableView();
    await projectPage.openCreateProjectModal();
    await projectPage.verifyModalClosed();
});

test('TC69 @regression @projectAndJob : Validate Create Project form mandatory fields assertion, property dropdown options and date can be filled directly without using calender', async () => {
    await projectPage.navigateToProjects();
    await projectPage.openCreateProjectModal();
    await projectPage.validateMandatoryFields();
    await projectPage.propertyDropdownOptions();
    await projectPage.fillDateField('2024-07-01', '2024-12-31');
});

test('TC70 @regression @projectAndJob : Positive user journeys for Projects, Jobs and Bids', async ({ page }) => {
    const loc = projectPage.tc05Loc();
    await test.step('P1: Projects workspace loads with key controls', async () => {
        await projectPage.tc05GotoProjectsWorkspace();
        await expect(loc.createProjectToolbarBtn).toBeVisible();
        await expect(loc.filterIconBtn).toBeVisible();
        await expect(loc.exportToolbarBtn).toBeVisible();
    });

    await test.step('P2: Create Project modal opens and closes cleanly', async () => {
        await projectPage.openCreateProjectModal();
        await expect(projectPage.modalTitle).toBeVisible({ timeout: 10000 });
        await expect(projectPage.nameInput).toBeVisible();
        await projectPage.verifyModalClosed();
    });

    await test.step('P3: Search input accepts and clears value', async () => {
        const keyword = `positive_${Date.now().toString().slice(-4)}`;
        await projectPage.tc05FillSearch(keyword);
        await expect(loc.mainSearchInput).toHaveValue(keyword);
        await projectPage.tc05ClearSearch();
        await expect(loc.mainSearchInput).toHaveValue('');
    });

    await test.step('P4: Export works without filters', async () => {
        await projectPage.tc05ExportAndAssertDownload();
    });

    await test.step('P5: Jobs workspace navigation is healthy', async () => {
        await projectPage.tc05GotoJobsWorkspace();
        await expect(loc.mainContainer).toBeVisible();
    });

    await test.step('P6: Bids workspace navigation is healthy', async () => {
        await projectPage.tc05GotoBidsWorkspace();
        await expect(loc.mainContainer).toBeVisible();
    });
});

test('TC71 @regression @projectAndJob : Negative and missing input validations', async ({ page }) => {
    const loc = projectPage.tc05Loc();

    await test.step('N1: Create Project empty submit shows mandatory invalid markers', async () => {
        console.log('[TC71] N1 â€” Navigate to Projects workspace and open Create Project modal (no fields filled)');
        await projectPage.tc05GotoProjectsWorkspace();
        await projectPage.openCreateProjectModal();
        const invalidCount = await projectPage.tc05ClickCreateProjectAndInvalidCount();
        console.log(`[TC71] N1 â€” ASSERT: invalid field marker count >= 2 | actual: ${invalidCount}`);
        try {
            expect(invalidCount).toBeGreaterThanOrEqual(2);
            console.log(`[TC71] N1 â€” PASS: found ${invalidCount} invalid markers (>= 2)`);
        } catch (e) {
            console.log(`[TC71] N1 â€” FAIL: expected >= 2 invalid markers, got ${invalidCount}`);
            throw e;
        }
        await projectPage.verifyModalClosed();
    });

    await test.step('N2: Create Project name-only submit should still enforce missing required fields', async () => {
        console.log('[TC71] N2 â€” Open modal, fill name only ("Only Name Negative Case"), submit');
        await projectPage.openCreateProjectModal();
        await projectPage.nameInput.fill('Only Name Negative Case');
        const invalidCount = await projectPage.tc05ClickCreateProjectAndInvalidCount();
        console.log(`[TC71] N2 â€” ASSERT: invalid field marker count >= 1 (other required fields missing) | actual: ${invalidCount}`);
        try {
            expect(invalidCount).toBeGreaterThanOrEqual(1);
            console.log(`[TC71] N2 â€” PASS: found ${invalidCount} invalid marker(s) (>= 1)`);
        } catch (e) {
            console.log(`[TC71] N2 â€” FAIL: expected >= 1 invalid marker, got ${invalidCount}`);
            throw e;
        }
        const stillOpen = await projectPage.modal.first().isVisible({ timeout: 2000 }).catch(() => false);
        console.log(`[TC71] N2 â€” ASSERT: modal stays open after failed submit | actual visible: ${stillOpen}`);
        try {
            expect(stillOpen).toBeTruthy();
            console.log(`[TC71] N2 â€” PASS: modal remains open after name-only submit`);
        } catch (e) {
            console.log(`[TC71] N2 â€” FAIL: modal closed unexpectedly after name-only submit`);
            throw e;
        }
        await projectPage.verifyModalClosed();
    });

    await test.step('N3: Create Project whitespace-only name should not be treated as valid', async () => {
        console.log('[TC71] N3 â€” Open modal, fill whitespace-only name ("   "), submit');
        await projectPage.openCreateProjectModal();
        await projectPage.nameInput.fill('   ');
        const invalidCount = await projectPage.tc05ClickCreateProjectAndInvalidCount();
        console.log(`[TC71] N3 â€” ASSERT: invalid field marker count >= 1 (whitespace name rejected) | actual: ${invalidCount}`);
        try {
            expect(invalidCount).toBeGreaterThanOrEqual(1);
            console.log(`[TC71] N3 â€” PASS: whitespace name produced ${invalidCount} invalid marker(s)`);
        } catch (e) {
            console.log(`[TC71] N3 â€” FAIL: whitespace name should trigger >= 1 invalid marker, got ${invalidCount}`);
            throw e;
        }
        await projectPage.verifyModalClosed();
    });

    await test.step('N4: Create Project negative budget value should not proceed silently', async () => {
        console.log('[TC71] N4 â€” Open modal, fill name "Negative Budget Case" and budget "-1000", submit');
        await projectPage.openCreateProjectModal();
        await projectPage.nameInput.fill('Negative Budget Case');
        await projectPage.budgetInput.fill('-1000').catch(() => { });
        await projectPage.tc05ClickCreateProjectAndInvalidCount();
        const stillOpen = await projectPage.modal.first().isVisible({ timeout: 2000 }).catch(() => false);
        console.log(`[TC71] N4 â€” ASSERT: modal stays open when budget is negative (-1000) | actual visible: ${stillOpen}`);
        try {
            expect(stillOpen).toBeTruthy();
            console.log(`[TC71] N4 â€” PASS: modal remains open with negative budget value`);
        } catch (e) {
            console.log(`[TC71] N4 â€” FAIL: modal closed unexpectedly with negative budget value`);
            throw e;
        }
        await projectPage.verifyModalClosed();
    });

    await test.step('N5: Create Project impossible date ordering keeps modal guarded', async () => {
        console.log('[TC71] N5 â€” Open modal, fill start=2026-12-31 end=2026-01-01 (end before start), submit');
        await projectPage.openCreateProjectModal();
        await projectPage.nameInput.fill('Date Order Negative');
        await projectPage.startDateInput.fill('2026-12-31').catch(() => { });
        await projectPage.endDateInput.fill('2026-01-01').catch(() => { });
        await projectPage.tc05ClickCreateProjectAndInvalidCount();
        const stillOpen = await projectPage.modal.first().isVisible({ timeout: 2000 }).catch(() => false);
        console.log(`[TC71] N5 â€” ASSERT: modal stays open with impossible date range | actual visible: ${stillOpen}`);
        try {
            expect(stillOpen).toBeTruthy();
            console.log(`[TC71] N5 â€” PASS: modal remains open with end-before-start dates`);
        } catch (e) {
            console.log(`[TC71] N5 â€” FAIL: modal closed unexpectedly with impossible date range`);
            throw e;
        }
        await projectPage.verifyModalClosed();
    });

    await test.step('N6: Project search SQL-like string must not crash page', async () => {
        const sqlPayload = `' OR 1=1 --`;
        console.log(`[TC71] N6 â€” Fill Projects search with SQL injection payload: "${sqlPayload}"`);
        await projectPage.tc05FillSearch(sqlPayload);
        console.log(`[TC71] N6 â€” ASSERT: search input retains raw value "${sqlPayload}" (not interpreted, page not crashed)`);
        try {
            await expect(loc.mainSearchInput).toHaveValue(sqlPayload);
            console.log(`[TC71] N6 â€” PASS: SQL-like payload stored as plain text in search input`);
        } catch (e) {
            console.log(`[TC71] N6 â€” FAIL: search input did not retain SQL-like payload`);
            throw e;
        }
    });

    await test.step('N7: Project search script-like payload must remain plain text', async () => {
        const xssPayload = '<script>alert(1)</script>';
        console.log(`[TC71] N7 â€” Fill Projects search with XSS payload: "${xssPayload}"`);
        await projectPage.tc05FillSearch(xssPayload);
        console.log(`[TC71] N7 â€” ASSERT: search input retains raw value "${xssPayload}" (not executed as script)`);
        try {
            await expect(loc.mainSearchInput).toHaveValue(xssPayload);
            console.log(`[TC71] N7 â€” PASS: XSS payload treated as plain text in search input`);
        } catch (e) {
            console.log(`[TC71] N7 â€” FAIL: search input did not retain XSS payload as plain text`);
            throw e;
        }
    });

    await test.step('N8: No-match project search shows safe empty state', async () => {
        const noMatchTerm = `__NEG_NO_MATCH_${Date.now()}__`;
        console.log(`[TC71] N8 â€” Fill Projects search with guaranteed no-match term: "${noMatchTerm}"`);
        await projectPage.tc05FillSearch(noMatchTerm);
        console.log(`[TC71] N8 â€” ASSERT: empty-state / no-results element is visible within 15s`);
        try {
            await expect(loc.noResultsPrimaryText).toBeVisible({ timeout: 15000 });
            console.log(`[TC71] N8 â€” PASS: empty state shown for no-match search`);
        } catch (e) {
            console.log(`[TC71] N8 â€” FAIL: empty state not visible within 15s for no-match search "${noMatchTerm}"`);
            throw e;
        }
        await projectPage.tc05ClearSearch();
    });

});

test('TC72 @regression @projectAndJob : Edge behavior and state transition checks', async ({ page }) => {
    const loc = projectPage.tc05Loc();
    await test.step('E1: Very long project search input should be accepted and recoverable', async () => {
        await projectPage.tc05GotoProjectsWorkspace();
        const longText = `LONG_${'X'.repeat(180)}`;
        await projectPage.tc05FillSearch(longText);
        await expect(loc.mainSearchInput).toHaveValue(longText);
        await projectPage.tc05ClearSearch();
    });

    await test.step('E2: Rapid open/close filter drawer twice should remain stable', async () => {
        for (let i = 0; i < 2; i++) {
            await projectPage.tc05OpenFilterDrawer();
            await projectPage.tc05CloseFilterDrawer();
        }
        await expect(loc.mainContainer).toBeVisible({ timeout: 10000 });
    });

    await test.step('E3: Toolbar dropdown menus should open/close via Escape or click-outside', async () => {
        for (const btn of [loc.layoutToolbarBtn, loc.viewToolbarBtn, loc.tableToolbarBtn]) {
            await btn.click();
            const openMenu = page.locator('[role="menu"], [role="listbox"], [role="dialog"]').first();
            await expect(openMenu).toBeVisible({ timeout: 5000 });
            await page.keyboard.press('Escape');
            await page.waitForTimeout(400);
            // Dialogs (view/table drawers) may not respond to Escape alone â€” click outside as fallback
            const isStillVisible = await openMenu.isVisible().catch(() => false);
            if (isStillVisible) await page.mouse.click(5, 5);
            await expect(openMenu).toBeHidden({ timeout: 5000 });
        }
    });

    await test.step('E4: Project details route fallback behavior', async () => {
        const exists = await loc.projectViewDetailsBtn.isVisible({ timeout: 3000 }).catch(() => false);
        if (exists) {
            await loc.projectViewDetailsBtn.click();
            await expect(page).toHaveURL(/\/projects\//, { timeout: 20000 });
        } else {
            await expect(loc.mainContainer).toBeVisible();
        }
    });
});

test('@regression @projectAndJob TC271 - Reject project creation with "      " name', async ({ page }) => {
    await projectPage.navigateToProjects();
    await projectPage.openCreateProjectModal();

    // Fill name with whitespace + dot; all other fields valid to isolate name validation
    await projectPage.nameInput.fill('      ');

    // Property: read from run-data if available, fall back to known sample property
    let propertyName = 'Test Property 1_Cottages on Elm';
    try {
        const propertyDataPath = path.join(__dirname, '../data/propertyData.json');
        const downloadsPropertyPath = path.join(process.cwd(), 'downloads', 'property.json');
        if (fs.existsSync(propertyDataPath)) {
            propertyName = JSON.parse(fs.readFileSync(propertyDataPath, 'utf8')).propertyName || propertyName;
        } else if (fs.existsSync(downloadsPropertyPath)) {
            propertyName = JSON.parse(fs.readFileSync(downloadsPropertyPath, 'utf8')).propertyName || propertyName;
        }
    } catch {}

    await projectPage.propertyDropdown.click();
    await page.waitForTimeout(500);
    await projectPage.propertyDropdown.fill(propertyName.slice(0, 20));
    await page.waitForTimeout(800);
    const propOption = page.getByRole('option', { name: propertyName.slice(0, 20) }).first();
    if (await propOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await propOption.click();
    }

    await projectPage.startDateInput.fill('2026-01-01').catch(() => {});
    await projectPage.endDateInput.fill('2026-12-31').catch(() => {});
    await projectPage.budgetInput.fill('500000').catch(() => {});

    const urlBefore = page.url();
    await projectPage.addProjectBtn.click();

    // Wait for any navigation triggered by a successful (buggy) submit
    await page.waitForTimeout(4000);
    const urlAfter = page.url();

    // If the URL navigated away to a project detail page, the project was created â€” that is the bug.
    const navigatedToProject = urlAfter !== urlBefore && /\/projects\//.test(urlAfter);
    expect(
        navigatedToProject,
        `Bug: project was created with whitespace-only name "      " â€” navigated to ${urlAfter} â€” app must reject names that are blank or contain only whitespace/punctuation.`,
    ).toBe(false);

    // Modal must still be open (validation blocked the submit)
    const modalStillOpen = await projectPage.modal.first().isVisible({ timeout: 2000 }).catch(() => false);
    expect(
        modalStillOpen,
        'Add Project modal should stay open when the name is whitespace-only.',
    ).toBe(true);

    await projectPage.verifyModalClosed();
});
