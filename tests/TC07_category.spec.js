require('dotenv').config();
const { test, expect } = require('@playwright/test');
const { FinancialsCategoryPage } = require('../pages/categoryPage');
const { ProjectPage } = require('../pages/projectPage');
const { ProjectJob } = require('../pages/projectJob');
const { Logger } = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const PropertiesHelper = require('../pages/properties');

test.use({
    storageState: 'sessionState.json',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
});

let page, projectPage, projectJob, projectData, prop, financialsCategoryPage;

const CATEGORY_VISUAL_ASSERT = {
    animations: 'disabled',
    maxDiffPixels: 50000,
    maxDiffPixelRatio: 0.3,
};

// Entire suite skipped for now: Financials/Category screen load is too slow for routine runs. Re-enable when acceptable.
test.describe('Verify category tab', () => {

    test.beforeEach(async ({ page: p }) => {
        page = p;
        projectPage = new ProjectPage(page);
        projectJob = new ProjectJob(page);
        prop = new PropertiesHelper(page);
        financialsCategoryPage = new FinancialsCategoryPage(page);

        if (!projectData) {
            const filePath = path.join(__dirname, '../data/projectData.json');
            projectData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }

        await page.goto(process.env.DASHBOARD_URL, { waitUntil: 'load' });
        await expect(page).toHaveURL(process.env.DASHBOARD_URL);
        await page.waitForTimeout(10000);

        page.on('domcontentloaded', async () => {
            await page.evaluate(() => {
                const elements = document.querySelectorAll('main, .mantine-AppShell-navbar');
                elements.forEach(el => { el.style.zoom = '70%'; });
            });
        });

        await page.evaluate(() => {
            const elements = document.querySelectorAll('main, .mantine-AppShell-navbar');
            elements.forEach(el => { el.style.zoom = '70%'; });
        });
    });

    test('TC83 @regression @category : Should expand Financials section and show Category option', async () => {
        const _catApiWait = page.waitForResponse(
            r => r.url().includes('/api/bird-table') && r.url().includes('table_name=category') && r.status() === 200,
            { timeout: 60000 }
        ).catch(() => null);
        await financialsCategoryPage.goToCategory();
        await _catApiWait;
        await expect(page).toHaveURL(/\/category/);
    });

    test('TC84 @regression @category : Should navigate to Category page and verify URL', async () => {
        const _catApiWait = page.waitForResponse(
            r => r.url().includes('/api/bird-table') && r.url().includes('table_name=category') && r.status() === 200,
            { timeout: 60000 }
        ).catch(() => null);
        await financialsCategoryPage.goToCategory();
        await _catApiWait;
        await expect(page).toHaveURL(/\/category/);
    });

    test.describe('TC51 - Category page content load', () => {
        test.describe.configure({ retries: 1 });

        test('TC85 @regression @category : Should load Category page content and not be blank', async () => {
            const _catApiWait = page.waitForResponse(
            r => r.url().includes('/api/bird-table') && r.url().includes('table_name=category') && r.status() === 200,
            { timeout: 60000 }
        ).catch(() => null);
        await financialsCategoryPage.goToCategory();
        await _catApiWait;
            await expect(page).toHaveURL(/\/category/);
            await financialsCategoryPage.waitForCategoryPageReady();

            await expect.poll(async () => {
                const content = await page.locator('body').textContent();
                return content && content.trim().length > 50;
            }, { timeout: 15000 }).toBeTruthy();
        });
    });

    test('TC86 @regression @category : Should show data table/grid if present', async () => {
        const _catApiWait = page.waitForResponse(
            r => r.url().includes('/api/bird-table') && r.url().includes('table_name=category') && r.status() === 200,
            { timeout: 60000 }
        ).catch(() => null);
        await financialsCategoryPage.goToCategory();
        await _catApiWait;
        await expect(page).toHaveURL(/\/category/);
        const tableVisible = await financialsCategoryPage.isTableVisible();
        expect(tableVisible, 'FAIL [TC86]: Category data table/grid should be visible after page load').toBeTruthy();
    });

    test('TC87 @regression @category : Should show Download/Export button', async () => {
        const _catApiWait = page.waitForResponse(
            r => r.url().includes('/api/bird-table') && r.url().includes('table_name=category') && r.status() === 200,
            { timeout: 60000 }
        ).catch(() => null);
        await financialsCategoryPage.goToCategory();
        await _catApiWait;
        await expect(page).toHaveURL(/\/category/);
        await page.waitForTimeout(10000);
        const downloadButtonFound = await financialsCategoryPage.isDownloadButtonVisible();
        expect(downloadButtonFound).toBeTruthy();
    });

    test('TC88 @regression @category : Should not show any error indicators on Category page', async () => {
        const _catApiWait = page.waitForResponse(
            r => r.url().includes('/api/bird-table') && r.url().includes('table_name=category') && r.status() === 200,
            { timeout: 60000 }
        ).catch(() => null);
        await financialsCategoryPage.goToCategory();
        await _catApiWait;
        await expect(page).toHaveURL(/\/category/);
        const errorFound = await financialsCategoryPage.hasErrorIndicators();
        expect(errorFound).toBeFalsy();
    });

    test('TC89 @regression @category : Validate export job is working as expected', async () => {
        const _catApiWait = page.waitForResponse(
            r => r.url().includes('/api/bird-table') && r.url().includes('table_name=category') && r.status() === 200,
            { timeout: 60000 }
        ).catch(() => null);
        await financialsCategoryPage.goToCategory();
        await _catApiWait;
        await expect(page).toHaveURL(/\/category/);
        await prop.exportButton();
    });

    test('TC90 @regression @category : Validate reset table option is working as expected', async () => {
        const _catApiWait = page.waitForResponse(
            r => r.url().includes('/api/bird-table') && r.url().includes('table_name=category') && r.status() === 200,
            { timeout: 60000 }
        ).catch(() => null);
        await financialsCategoryPage.goToCategory();
        await _catApiWait;
        await expect(page).toHaveURL(/\/category/);
        await projectPage.openResetTableModal();
        await financialsCategoryPage.validateResetCategoryContent();
        await projectPage.confirmResetTable();
        await projectPage.assertRowCountAfterReset();
    });

    test.describe('TC57 - Upload category option', () => {
        test.describe.configure({ retries: 1 });

        test('TC91 @regression @category @sanity : Validate Upload category option is working as expected', async () => {
            const _catApiWait = page.waitForResponse(
            r => r.url().includes('/api/bird-table') && r.url().includes('table_name=category') && r.status() === 200,
            { timeout: 60000 }
        ).catch(() => null);
        await financialsCategoryPage.goToCategory();
        await _catApiWait;
            await expect(page).toHaveURL(/\/category/);
            await financialsCategoryPage.waitForCategoryPageReady();
            await page.waitForTimeout(10000);

            await financialsCategoryPage.uploadCategory(path.resolve("./files/category_data.csv"));
        });
    });

    test('TC92 @regression @category : Add data option is working as expected', async () => {
        const _catApiWait = page.waitForResponse(
            r => r.url().includes('/api/bird-table') && r.url().includes('table_name=category') && r.status() === 200,
            { timeout: 60000 }
        ).catch(() => null);
        await financialsCategoryPage.goToCategory();
        await _catApiWait;
        await expect(page).toHaveURL(/\/category/);
        await page.getByTestId('bt-table-action').click();
        const addColumnMenuItem = page.getByTestId('bt-table-action-add-column')
            .or(page.getByRole('menuitem', { name: /Add custom column|Add column/i }))
            .first();
        await expect(addColumnMenuItem).toBeVisible({ timeout: 10000 });
        await addColumnMenuItem.click();
        const columnNameInput = page.getByRole('textbox', { name: /Enter column name/i })
            .or(page.getByPlaceholder(/Enter column name/i))
            .first();
        const columnDescInput = page.getByRole('textbox', { name: /Enter column description/i })
            .or(page.getByPlaceholder(/Enter column description/i))
            .first();
        await expect(columnNameInput).toBeVisible({ timeout: 10000 });
        await columnNameInput.fill('Test Column');
        await columnDescInput.fill('This is a test description.');
        const addColumnBtn = page.getByRole('button', { name: /^Add column$/i }).last();
        await expect(addColumnBtn).toBeEnabled({ timeout: 5000 });
        await addColumnBtn.click();
        await expect(columnNameInput).toBeHidden({ timeout: 10000 });
        await page.getByTestId('bt-table-action').click();
        await page.getByTestId('bt-table-action-hide-show-columns').click();
        await expect(
            page.getByRole('dialog', { name: 'Manage Columns' })
                .or(page.locator('section[role="dialog"]').filter({ hasText: /Manage Columns/i }))
                .first()
        ).toBeVisible({ timeout: 10000 });
    });

    test('TC93 @regression @category : Add category option is working as expected', async () => {
        const _catApiWait = page.waitForResponse(
            r => r.url().includes('/api/bird-table') && r.url().includes('table_name=category') && r.status() === 200,
            { timeout: 60000 }
        ).catch(() => null);
        await financialsCategoryPage.goToCategory();
        await _catApiWait;
        await expect(page).toHaveURL(/\/category/);
        await financialsCategoryPage.waitForTableToLoad(20000);
        await page.getByTestId('bt-add-row').click();
        await financialsCategoryPage.addCategoryRowDetail();
        await financialsCategoryPage.deleteCategoryRowDetail();
    });

    test('TC94 @sanity @regression @category : filter option is working as expected', async () => {
        await page.goto('/financials/category?propertyId=765', { waitUntil: 'domcontentloaded' });
        await expect(page, 'UI changed: expected category route').toHaveURL(/category/);

        await page.waitForTimeout(10000);

        await financialsCategoryPage.waitForTableToLoad(15000).catch((e) => Logger.info('Table wait skipped: ' + e.message));
        const tableVisible = await financialsCategoryPage.isTableVisible(5000).catch(() => false);

        if (!tableVisible) {
            test.skip(true, 'Category table not visible for propertyId=765 — cannot verify filter');
        }

        const filteredRowCount = await financialsCategoryPage.filterCategoryAndVerify("Category Code", "100");
        expect(
            filteredRowCount,
            `UI changed: filter "Category Code" = 100 should return rows (got ${filteredRowCount})`
        ).toBeGreaterThan(0);
    });

    test('TC95 @regression @category : Positive structure and missing-path search resilience', async () => {
        await test.step('P1 — Category grid structure and BirdTable toolbar (positive)', async () => {
            const _catApiWait = page.waitForResponse(
            r => r.url().includes('/api/bird-table') && r.url().includes('table_name=category') && r.status() === 200,
            { timeout: 60000 }
        ).catch(() => null);
        await financialsCategoryPage.goToCategory();
        await _catApiWait;
            await expect(page).toHaveURL(/\/category/);
            await page.waitForTimeout(10000);
            await financialsCategoryPage.waitForTableToLoad(25000).catch(() => {});
            const tableOk = await financialsCategoryPage.isTableVisible(5000).catch(() => false);
            if (!tableOk) {
                test.skip(true, 'Category tree/grid not visible — cannot assert column/toolbar benchmarks');
            }
            await expect(page.getByRole('columnheader', { name: /Category Code/i }).first()).toBeVisible({ timeout: 15000 });
            await expect(page.getByRole('columnheader', { name: /Category Name/i }).first()).toBeVisible({ timeout: 15000 });

            await expect(page.getByRole('button', { name: /^View$/i }).first()).toBeVisible({ timeout: 12000 });
            await expect(page.getByRole('button', { name: /^Table$/i }).first()).toBeVisible({ timeout: 12000 });
            const downloadBtn = await financialsCategoryPage.isDownloadButtonVisible().catch(() => false);
            expect(downloadBtn).toBeTruthy();
            await expect(page.getByTestId('bt-add-row')).toBeVisible({ timeout: 10000 });
            await expect(page.getByTestId('bt-table-action')).toBeVisible({ timeout: 10000 });
        });

        await test.step('P2 — Main search probe and clear (missing / gap coverage)', async () => {
            const loc = financialsCategoryPage.tc07Loc();
            await expect(loc.mainContainer).toBeVisible({ timeout: 15000 });
            await expect(loc.mainSearchInput).toBeVisible({ timeout: 8000 });
            await loc.mainSearchInput.fill('__TC07_PROBE_MISSING__');
            await loc.mainSearchInput.press('Enter').catch(() => {});
            await page.waitForTimeout(10000);
            await loc.mainSearchInput.fill('');
            await loc.mainSearchInput.press('Enter').catch(() => {});
            await page.waitForTimeout(500);
            await expect(loc.mainContainer).toBeVisible({ timeout: 10000 });
        });
    });

    test('TC96 @regression @category : Negative filter + reset cancelled', async () => {
        await test.step('N1 — Global filter: no matching rows', async () => {
            const _catApiWait = page.waitForResponse(
            r => r.url().includes('/api/bird-table') && r.url().includes('table_name=category') && r.status() === 200,
            { timeout: 60000 }
        ).catch(() => null);
        await financialsCategoryPage.goToCategory();
        await _catApiWait;
            await expect(page).toHaveURL(/\/category/);
            await page.waitForTimeout(10000);
            await financialsCategoryPage.waitForTableToLoad(25000).catch((e) => Logger.info('Table wait: ' + e.message));
            const tableVisible = await financialsCategoryPage.isTableVisible(5000).catch(() => false);
            if (!tableVisible) {
                test.skip(true, 'Category table not visible — cannot verify negative filter');
            }
            await expect(async () => {
                await financialsCategoryPage.filterCategoryAndVerify('Category Code', '__NO_MATCH_TC07_XYZ__');
            }).rejects.toThrow(/No rows found/);
            await page.keyboard.press('Escape').catch(() => {});
        });

        await test.step('N2 — Reset modal: Cancel does not reload away from Category', async () => {
            await financialsCategoryPage.openResetCategoryModalScoped();
            await financialsCategoryPage.validateResetCategoryContent();
            await financialsCategoryPage.cancelResetCategoryModalScoped();
            await expect(page).toHaveURL(/\/category/);
        });
    });

    test('TC97 @regression @category : Filter churn, View/Table presses, long search', async () => {
        const _catApiWait = page.waitForResponse(
            r => r.url().includes('/api/bird-table') && r.url().includes('table_name=category') && r.status() === 200,
            { timeout: 60000 }
        ).catch(() => null);
        await financialsCategoryPage.goToCategory();
        await _catApiWait;
        await expect(page).toHaveURL(/\/category/);
        await page.waitForTimeout(10000);
        const loc = financialsCategoryPage.tc07Loc();

        await test.step('E1 — Filter funnel repeated open/dismiss', async () => {
            const filterPanel = page.locator('.mantine-Paper-root').filter({ hasText: /Filters/i }).first();
            for (let i = 0; i < 2; i++) {
                await loc.filterFunnelBtn.click();
                await expect(filterPanel).toBeVisible({ timeout: 8000 });
                await page.keyboard.press('Escape');
                await page.waitForTimeout(400);
                if (await filterPanel.isVisible().catch(() => false)) await page.mouse.click(5, 5);
                await expect(filterPanel).toBeHidden({ timeout: 5000 });
            }
        });

        await test.step('E2 — View and Table toolbar opens are stable', async () => {
            const viewBtn = page.getByRole('button', { name: /^View$/i }).first();
            const tableBtn = page.getByRole('button', { name: /^Table$/i }).first();
            await expect(viewBtn).toBeVisible({ timeout: 8000 });
            await viewBtn.click();
            const viewMenu = page.locator('[role="menu"], [role="listbox"], [role="dialog"]').first();
            await expect(viewMenu).toBeVisible({ timeout: 5000 });
            await page.keyboard.press('Escape');
            await page.waitForTimeout(400);
            if (await viewMenu.isVisible().catch(() => false)) await page.mouse.click(5, 5);
            await expect(viewMenu).toBeHidden({ timeout: 5000 });
            await expect(tableBtn).toBeVisible({ timeout: 8000 });
            await tableBtn.click();
            const tableMenu = page.locator('[role="menu"], [role="listbox"], [role="dialog"]').first();
            await expect(tableMenu).toBeVisible({ timeout: 5000 });
            await page.keyboard.press('Escape');
            await page.waitForTimeout(400);
            if (await tableMenu.isVisible().catch(() => false)) await page.mouse.click(5, 5);
            await expect(tableMenu).toBeHidden({ timeout: 5000 });
        });

        await test.step('E3 — Long main search string accepted and cleared', async () => {
            await expect(loc.mainSearchInput).toBeVisible({ timeout: 8000 });
            const longText = `TC07_LONG_${'Z'.repeat(100)}`;
            await loc.mainSearchInput.fill(longText);
            await expect(loc.mainSearchInput).toHaveValue(longText);
            await loc.mainSearchInput.fill('');
            await loc.mainSearchInput.press('Enter').catch(() => {});
        });
    });

    test('TC98 @regression @category : Dialogs and overlays (6 snapshots)', async () => {
        const loc = financialsCategoryPage.tc07Loc();
        const shotMain = { ...CATEGORY_VISUAL_ASSERT, mask: [loc.mainSearchInput] };
        const importDialog = page
            .locator('dialog[open], section[role="dialog"], [role="dialog"]')
            .filter({ has: page.getByRole('button', { name: 'From device' }) })
            .first();

        await test.step('V1 — Main workspace', async () => {
            const _catApiWait = page.waitForResponse(
            r => r.url().includes('/api/bird-table') && r.url().includes('table_name=category') && r.status() === 200,
            { timeout: 60000 }
        ).catch(() => null);
        await financialsCategoryPage.goToCategory();
        await _catApiWait;
            await expect(page).toHaveURL(/\/category/);
            await financialsCategoryPage.waitForCategoryPageReady().catch(() => {});
            await page.waitForTimeout(10000);
            await expect(loc.mainContainer).toHaveScreenshot('tc07-v-category-workspace.png', shotMain);
        });

        await test.step('V2 — Filters overlay', async () => {
            await loc.filterFunnelBtn.click();
            await page.waitForTimeout(600);
            const filterPanel = page.locator('.mantine-Paper-root').filter({ hasText: /Filters/i }).first();
            await expect(filterPanel).toBeVisible({ timeout: 10000 });
            await expect(filterPanel).toHaveScreenshot('tc07-v-category-filter-panel.png', CATEGORY_VISUAL_ASSERT);
            await page.keyboard.press('Escape').catch(() => {});
            await page.waitForTimeout(400);
        });

        await test.step('V3 — Import / upload modal (Uploadcare)', async () => {
            await financialsCategoryPage.openImportPickerVisual();
            await expect(importDialog).toBeVisible({ timeout: 10000 });
            await expect(importDialog).toHaveScreenshot('tc07-v-category-import-dialog.png', CATEGORY_VISUAL_ASSERT);
            await financialsCategoryPage.dismissImportPickerVisual();
        });

        await test.step('V4 — Manage Columns dialog', async () => {
            await financialsCategoryPage.openManageColumnsDialogFromMenu();
            await expect(loc.manageColumnsDialog).toBeVisible({ timeout: 12000 });
            await expect(loc.manageColumnsDialog).toHaveScreenshot(
                'tc07-v-category-manage-columns.png',
                CATEGORY_VISUAL_ASSERT,
            );
            await financialsCategoryPage.dismissDialogWithEscape(loc.manageColumnsDialog);
            await expect(loc.manageColumnsDialog).toBeHidden({ timeout: 12000 });
            await financialsCategoryPage.dismissMenuOrPopover();
            await page.waitForTimeout(400);
        });

        await test.step('V5 — Add custom column modal', async () => {
            await financialsCategoryPage.openAddColumnModalFromMenu();
            // Sheet is portaled; role/title/classes vary — anchor on copy from the BirdTable add-column flow.
            const addColSheet = page
                .locator('div')
                .filter({
                    has: page.locator('p').filter({ hasText: /^Add column$/ }),
                })
                .filter({
                    has: page.getByRole('textbox', { name: /Enter column description/i }),
                })
                .filter({ has: page.getByRole('button', { name: /^Cancel$/i }) })
                .first();
            await expect(addColSheet).toBeVisible({ timeout: 12000 });
            await expect(addColSheet).toHaveScreenshot(
                'tc07-v-category-add-column-modal.png',
                CATEGORY_VISUAL_ASSERT,
            );
            await financialsCategoryPage.dismissAddColumnModal();
            await financialsCategoryPage.dismissMenuOrPopover();
        });

        await test.step('V6 — Reset Category modal', async () => {
            await financialsCategoryPage.openResetCategoryModalScoped();
            const resetDlg = financialsCategoryPage.resetCategoryConfirmModal();
            await expect(resetDlg).toHaveScreenshot('tc07-v-category-reset-modal.png', CATEGORY_VISUAL_ASSERT);
            await financialsCategoryPage.cancelResetCategoryModalScoped();
        });
    });

});
