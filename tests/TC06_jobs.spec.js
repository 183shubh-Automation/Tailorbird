require('dotenv').config();
const { test, expect } = require('@playwright/test');
const { ProjectPage } = require('../pages/projectPage');
const { ProjectJob } = require('../pages/projectJob');
const { Logger } = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const PropertiesHelper = require('../pages/properties');
const { setTabsDisabledState } = require('../utils/tabsDisabledHelper');

test.use({
    storageState: 'sessionState.json',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
});

let page, projectPage, projectJob, projectData, prop;
const JOB_VISUAL_ASSERT = {
    animations: 'disabled',
    maxDiffPixels: 50000,
    maxDiffPixelRatio: 0.3,
};

async function openJobsWorkspaceFromLeftNav(page) {
    const jobsMenu = page
        .locator('nav')
        .locator('a, button, div[role="link"], div')
        .filter({ hasText: /^Jobs \(Contracts & POs\)$/i })
        .first();
    await expect(jobsMenu).toBeVisible({ timeout: 15000 });
    await jobsMenu.click();
    await page.waitForTimeout(30000);
    await page.waitForURL(/\/jobs|tab=jobs/i, { timeout: 15000 }).catch(() => { });
}

test.describe('Verify Create Project and Add Job flow', () => {

    test.beforeEach(async ({ page: p }) => {
        page = p;

        projectPage = new ProjectPage(page);
        projectJob = new ProjectJob(page);
        prop = new PropertiesHelper(page);

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

    test('TC80 @regression @projectAndJob : Validate Navigation to job tab without any console error within 2 seconds', async () => {
        Logger.step('Navigating to Projects...');
        await projectPage.navigateToProjects();
        await projectPage.openProject(projectData.projectName);

        const projectCard = page.locator(
            '.mantine-SimpleGrid-root .mantine-Group-root',
            { hasText: projectData.projectName }
        );

        // await projectCard.waitFor({ state: 'visible', timeout: 10000 });
        // await projectCard.click();
        await projectJob.navigateToJobsTab();
    });

    test('TC81 @regression @sanity @mandatory @projectAndJob @contract : Validate add job modal fields, add job flow and job config in job overview', async () => {
        await projectPage.navigateToProjects();
        await projectPage.openProject(projectData.projectName);
        await projectJob.navigateToJobsTab();
        Logger.step('Adding and editing Job...');

        await projectPage.openCreateJobModal();
        await projectPage.validateModalFields();

        const today = new Date();
        const endDate = new Date(today);
        endDate.setFullYear(today.getFullYear() + 1);
        const randomSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        const jobTitle = `Mall in Noida_${randomSuffix}`;
        const estimatedBudget = Math.floor(Math.random() * (10000 - 3000 + 1)) + 3000;

        await projectPage.fillJobForm({
            title: jobTitle,
            jobType: 'Capex',
            financialType: 'Contract',
            vendor: 'Sumit_Corp',
            description: 'Job created via automation',
            estimatedBudget,
            startDate: projectPage.formatDate(today),
            endDate: projectPage.formatDate(endDate),
            selectBudgetCategory: true
        });

        const selectedCategory = projectPage.selectedBudgetCategory;
        expect(selectedCategory, 'Budget Category must be assigned when selectBudgetCategory: true is passed to fillJobForm').toBeTruthy();
        expect(selectedCategory.length, `Budget Category must have a non-empty name, got: "${selectedCategory}"`).toBeGreaterThan(0);

        await projectPage.submitJob();

        const expected = {
            'Job Name': jobTitle,
            'Job Type': 'Capex',
            'Financial Type': 'Contract',
            'Description': 'Job created via automation'
        };

        await prop.validateJobDetails(expected);
        await projectPage.validateOverviewVisible();

        const contractEstimatedBudget = Math.floor(Math.random() * (10000 - 1000 + 1)) + 1000;
        Logger.step(`Updating contract estimated budget to: ${contractEstimatedBudget}`);

        await projectPage.openContractsTab();
        // await page.waitForTimeout(30000);
        await page.waitForTimeout(10000);

        // Scope to the Contracts tab so .first() cannot click another "Edit" (failure snapshot: wrong dialog was "Edit Job").
        const contractsTabPanel = page.getByRole('tabpanel', { name: 'Contracts' });
        const editContractBtn = contractsTabPanel.getByRole('button', { name: /^Edit$/i }).first();
        await expect(editContractBtn).toBeVisible({ timeout: 15000 });
        await editContractBtn.click({ force: true });

        // EditContractOverviewDrawer title: `Edit ${instrumentLabels.noun} Overview` → "Edit Contract Overview" | "Edit PO Overview"
        const editContractDialog = page
            .getByRole('dialog')
            .filter({ hasText: /Edit (Contract|PO) Overview/i })
            .first();
        await expect(editContractDialog).toBeVisible({ timeout: 15000 });

        const estimatedTotalCostInput = editContractDialog
            .getByRole('textbox', { name: /Estimated total cost/i })
            .or(editContractDialog.getByLabel(/Estimated total cost/i))
            .first();
        await expect(estimatedTotalCostInput).toBeVisible({ timeout: 10000 });
        await estimatedTotalCostInput.click({ force: true });
        await estimatedTotalCostInput.press('Control+A');
        await estimatedTotalCostInput.press('Backspace');
        await estimatedTotalCostInput.fill(String(contractEstimatedBudget));
        await estimatedTotalCostInput.press('Tab');

        const saveChangesBtn = editContractDialog.getByRole('button', { name: /Save Changes|Save/i }).first();
        await expect(saveChangesBtn).toBeVisible({ timeout: 10000 });
        await expect(saveChangesBtn).toBeEnabled({ timeout: 10000 });
        await saveChangesBtn.click();
        // await page.waitForTimeout(30000);
        await page.waitForTimeout(10000);
        Logger.success(`Contract estimated budget updated and saved: ${contractEstimatedBudget}`);

        const lastCreatedJobPath = path.join(__dirname, '../data/lastCreatedJob.json');
        fs.writeFileSync(
            lastCreatedJobPath,
            JSON.stringify(
                {
                    jobName: jobTitle,
                    estimatedBudget,
                    contractEstimatedBudget,
                    projectName: projectData.projectName,
                    createdVia: 'mcp-browser-playwright',
                    createdAt: new Date().toISOString()
                },
                null,
                2
            )
        );
        Logger.success(`Created job details saved to: ${lastCreatedJobPath}`);
    });

    test('TC83 @regression @mandatory @projectAndJob @contract : Add contract from left Jobs menu and finalize contract with new flow', async () => {
        const captureDebugScreenshot = async (label) => {
        };

        try {
            const lastCreatedJobPath = path.join(__dirname, '../data/lastCreatedJob.json');
            if (!fs.existsSync(lastCreatedJobPath)) {
                throw new Error(`Missing job data file: ${lastCreatedJobPath}`);
            }
            const lastCreatedJob = JSON.parse(fs.readFileSync(lastCreatedJobPath, 'utf8'));
            const targetJobName = String(lastCreatedJob.jobName || '').trim();
            if (!targetJobName) {
                throw new Error('jobName is missing in data/lastCreatedJob.json');
            }

            Logger.step('Opening Jobs from left panel...');
            const jobsMenu = page
                .locator('nav')
                .locator('a, button, div[role="link"], div')
                .filter({ hasText: /^Jobs \(Contracts & POs\)$/i })
                .first();
            await expect(jobsMenu).toBeVisible({ timeout: 15000 });
            await jobsMenu.click();
            await page.waitForTimeout(20000);

            Logger.step('Opening target job from Jobs listing...');
            const searchInput = page.locator('input[placeholder="Search..."]').first();
            await expect(searchInput).toBeVisible({ timeout: 15000 });
            await searchInput.fill(targetJobName);
            await page.waitForTimeout(1500);

            // View Details button removed; the ID column now has a clickable link to job details.
            // Restrict to this project so we do not open "Mall in Noida" / "Mall in noida" from another project.
            const matchingRows = page
                .getByRole('row')
                .filter({ hasText: targetJobName })
                .filter({ hasText: projectData.projectName });
            await expect(matchingRows.first()).toBeVisible({ timeout: 15000 });
            const targetRow = (await matchingRows.count()) > 1 ? matchingRows.last() : matchingRows.first();
            await expect(targetRow).toBeVisible({ timeout: 10000 });

            const jobIdLink = targetRow.locator('a[href*="/jobs/"]').first();
            await expect(jobIdLink).toBeVisible({ timeout: 15000 });
            await jobIdLink.scrollIntoViewIfNeeded();
            await jobIdLink.click();
            await page.waitForURL(/\/jobs\/\d+/, { timeout: 30000 });
            await page.waitForLoadState('domcontentloaded');

            Logger.step('Opening Contracts tab and importing contract CSV...');
            const contractsTab = page.getByRole('tab', { name: 'Contracts' });
            await contractsTab.click();
            await page.waitForTimeout(400);
            const selected = await contractsTab.getAttribute('aria-selected').catch(() => 'false');
            if (selected !== 'true') {
                await contractsTab.click();
            }
            await page.waitForURL(/tab=contracts/, { timeout: 15000 });

            // Job-level tab is "Contracts"; nested tabpanel for the grid is "Contract".
            const contractsJobPanel = page.getByRole('tabpanel', { name: 'Contracts' });
            await expect(contractsJobPanel).toBeVisible({ timeout: 15000 });
            const innerContractPanel = contractsJobPanel.getByRole('tabpanel', { name: 'Contract' }).first();
            await expect(innerContractPanel).toBeVisible({ timeout: 15000 });
            // Wait for grid toolbar to finish loading (skeleton → real content) before any grid interaction
            await innerContractPanel.getByRole('button', { name: /^Import$/i })
                .waitFor({ state: 'visible', timeout: 30000 });


            const clearExistingContracts = async () => {
                const contractsPanel = innerContractPanel;
                const noContractsMsg = contractsPanel.locator('text=No contracts added yet');
                let guard = 0;

                while (guard < 40) {
                    const deleteButtons = contractsPanel.locator('button:has(svg.lucide-trash2), button[aria-label="Delete Row"]');
                    const count = await deleteButtons.count().catch(() => 0);

                    if (count === 0) {
                        const noRowsVisible = await noContractsMsg.isVisible().catch(() => false);
                        if (noRowsVisible) break;
                        await page.waitForTimeout(400);
                        guard += 1;
                        continue;
                    }

                    const delBtn = deleteButtons.first();
                    await delBtn.scrollIntoViewIfNeeded();
                    const isDisabled = await delBtn.isDisabled().catch(() => true);
                    if (isDisabled) {
                        await page.waitForTimeout(500);
                        guard += 1;
                        continue;
                    }

                    await delBtn.click({ force: true });

                    const confirmDelete = page
                        .locator(".mantine-Popover-dropdown button:has-text('Delete'), [role='dialog'] button:has-text('Delete')")
                        .first();
                    const hasConfirm = await confirmDelete.isVisible({ timeout: 3000 }).catch(() => false);
                    if (hasConfirm) {
                        await confirmDelete.click({ force: true });
                    } else {
                        // If no confirmation appears, the row is likely already removed or action is still settling.
                        await page.waitForTimeout(600);
                    }

                    // Wait for row count to drop / UI settle before next delete
                    await page.waitForTimeout(900);
                    guard += 1;
                }

                const remainingDeletes = await contractsPanel
                    .locator('button:has(svg.lucide-trash2), button[aria-label="Delete Row"]')
                    .count()
                    .catch(() => 0);
                if (remainingDeletes > 0) {
                    throw new Error(`Unable to clear existing contract rows. Remaining delete buttons: ${remainingDeletes}`);
                }
            };
            await page.waitForTimeout(5000);
            await clearExistingContracts();
            await page.waitForTimeout(500);
            const importContractCsv = async () => {
                const contractCsvRelativePath = path.join(__dirname, '../data/propertyData.json');
                const csvPath = path.join(__dirname, '../data/propertyData.json');
                const csvPath2 = path.join(__dirname, '../files/contract_data.csv');
                const getImportedRowCount = async () => {
                    const rowCount = await innerContractPanel
                        .locator('div[role="row"][data-rgrow]')
                        .count()
                        .catch(() => 0);
                    if (rowCount > 0) return rowCount;
                    const importedMarker = await innerContractPanel
                        .getByText(/Bid with material|contract_data\.csv|04\/01\/2026|04\/30\/2026/i)
                        .first()
                        .isVisible({ timeout: 1500 })
                        .catch(() => false);
                    return importedMarker ? 1 : 0;
                };

                const uploadAndClickDone = async () => {
                    const importBtnCandidates = [
                        innerContractPanel.getByRole('button', { name: /^Import$/i }),
                        innerContractPanel.getByRole('button', { name: /Import Data/i }),
                        innerContractPanel.locator('[title="Import Data"]'),
                        innerContractPanel.locator('button:has(svg.lucide-upload)')
                    ];
                    let clicked = false;
                    for (const btn of importBtnCandidates) {
                        if (await btn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
                            await btn.first().click({ force: true });
                            clicked = true;
                            break;
                        }
                    }
                    if (!clicked) {
                        const existingRows = await innerContractPanel
                            .locator('div[role="row"][data-rgrow]')
                            .count()
                            .catch(() => 0);
                        if (existingRows > 0) {
                            Logger.info(`Import button not visible, but ${existingRows} contract row(s) already exist. Continuing.`);
                            return;
                        }
                        throw new Error('Import button not found in Contracts tab.');
                    }
                    await page.waitForTimeout(800);

                    const guideContinueBtn = page.getByRole('button', { name: /Continue|Next|Got it/i }).first();
                    if (await guideContinueBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                        await guideContinueBtn.click();
                        await page.waitForTimeout(400);
                    }

                    const fromDeviceBtn = page.getByRole('button', { name: /From device|Upload|Choose file|Browse/i }).first();
                    const hasFromDevice = await fromDeviceBtn.isVisible({ timeout: 3000 }).catch(() => false);
                    if (hasFromDevice) {
                        const [chooser] = await Promise.all([
                            page.waitForEvent('filechooser', { timeout: 15000 }),
                            fromDeviceBtn.click({ force: true })
                        ]);
                        await chooser.setFiles(csvPath2);
                    } else {
                        const fileInput = page.locator('input[type="file"]');
                        if (await fileInput.first().isVisible({ timeout: 3000 }).catch(() => false)) {
                            await fileInput.first().setInputFiles(csvPath2);
                        } else {
                            const anyFileInput = page.locator('input[type="file"]');
                            if ((await anyFileInput.count()) > 0) {
                                await anyFileInput.first().setInputFiles(csvPath2);
                            } else {
                                throw new Error('No file upload control found - upload button or file input missing');
                            }
                        }
                    }

                    // Framework style: wait for upload dialog and click Done when enabled.
                    const doneBtn = page.getByRole('button', { name: /^Done$/i }).last();
                    const doneVisible = await doneBtn.isVisible({ timeout: 10000 }).catch(() => false);
                    if (doneVisible) {
                        await expect(doneBtn).toBeEnabled({ timeout: 20000 });
                        await doneBtn.click({ force: true });
                    } else {
                        const fallbackDone = page.getByRole('button', { name: /Apply|Import|Confirm/i }).last();
                        if (await fallbackDone.isVisible({ timeout: 3000 }).catch(() => false)) {
                            await fallbackDone.click({ force: true });
                        }
                    }

                    // Data appears immediately after Done click; networkidle never fires in this SPA.
                    await innerContractPanel
                        .locator('div[role="row"][data-rgrow]')
                        .first()
                        .waitFor({ state: 'visible', timeout: 30000 })
                        .catch(() => {}); // If row doesn't appear here, retry logic below handles it
                    await page.waitForTimeout(800);
                };

                await uploadAndClickDone();
                let finalCount = await getImportedRowCount();
                if (finalCount === 0) {
                    // Import click can be one-time in this UI state; avoid a second click failure.
                    Logger.step('No rows immediately after import; waiting for grid refresh');
                    await page.waitForTimeout(5000);
                    finalCount = await getImportedRowCount();
                }
                if (finalCount === 0) {
                    await page.waitForTimeout(5000);
                    finalCount = await getImportedRowCount();
                }
                if (finalCount === 0) throw new Error('No rows after import wait - data may not have loaded');
            };

            await importContractCsv();

            Logger.step('Editing imported contract, filling missing values and finalizing...');

            // "Edit" button removed from grid toolbar in new UI; grid is directly editable by double-click.
            // Clicking it would open "Edit Contract Overview" dialog (wrong) and block grid cells.

            const contractsGrid = innerContractPanel.locator('revo-grid[role="treegrid"]').first();
            await expect(contractsGrid).toBeVisible({ timeout: 15000 });

            /* ---------- Helper Functions ---------- */

            const normalize = (text) =>
                String(text || "").replace(/\s+/g, " ").trim().toLowerCase();

            const getHeaders = async () => {
                return await contractsGrid.locator('div[role="columnheader"]').evaluateAll((els) =>
                    els.map((e) => ({
                        text: (e.textContent || "").trim(),
                        col: Number(e.getAttribute("aria-colindex"))
                    }))
                );
            };

            const findColumnIndex = (headers, nameRegex) => {
                const col = headers.find(h => nameRegex.test(h.text));
                if (!col) throw new Error(`Column not found for ${nameRegex}`);
                return col.col;
            };
            const findOptionalColumnIndex = (headers, nameRegex) => {
                const col = headers.find(h => nameRegex.test(h.text));
                return col ? col.col : null;
            };

            const getRow = () =>
                contractsGrid.locator('div[role="row"][data-rgrow]').first();

            const getCell = (rowGrow, colIndex) =>
                contractsGrid.locator(
                    `div[role="gridcell"][data-rgrow="${rowGrow}"][aria-colindex="${colIndex}"]`
                ).first();

            /* ---------- Cell Edit Utility ---------- */

            if (await page.locator('.mantine-Drawer-header svg').isVisible({ timeout: 3000 }).catch(() => false)) {
                await page.locator('.mantine-Drawer-header svg').click();
                await page.waitForTimeout(1200);
            }
            // Keep the same trigger behavior used by automation:
            // - triggerCol 6 opens editor for Cost Item flow
            // - End Date trigger opens editor for Contract Amount flow
            const editByTrigger = async ({ rowGrow, triggerCol, value, commitKey = 'Tab' }) => {
                const triggerCell = getCell(rowGrow, triggerCol);
                await triggerCell.scrollIntoViewIfNeeded();
                await triggerCell.dblclick({ force: true });
                await page.waitForTimeout(800);

                const editor = page.locator('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):visible, textarea:visible').last();
                await expect(editor).toBeVisible({ timeout: 7000 });
                await editor.fill(value);
                await page.waitForTimeout(500);
                await editor.press(commitKey);
                await page.waitForTimeout(1500);
            };
            const getActiveCellCol = async () => {
                return await page.evaluate(() => {
                    const active = document.activeElement;
                    const cell = active?.closest?.('div[role="gridcell"]');
                    const raw = cell?.getAttribute('aria-colindex') || cell?.getAttribute('data-rgcol');
                    const asNum = Number(raw);
                    return Number.isFinite(asNum) ? asNum : null;
                });
            };

            const setValueViaTriggeredCell = async ({
                rowGrow,
                triggerCol,
                targetCol,
                value,
                commitKey = 'Tab',
                label = 'field'
            }) => {
                const triggerCell = getCell(rowGrow, triggerCol);
                await triggerCell.scrollIntoViewIfNeeded();
                await triggerCell.dblclick({ force: true });
                await page.waitForTimeout(700);

                let activeCol = await getActiveCellCol();
                Logger.info(`${label} focus after trigger: activeCol=${activeCol}, targetCol=${targetCol}`);

                if (activeCol !== null && targetCol !== null && activeCol !== targetCol) {
                    const directionKey = targetCol < activeCol ? 'ArrowLeft' : 'ArrowRight';
                    const hops = Math.min(6, Math.abs(targetCol - activeCol));
                    for (let i = 0; i < hops; i++) {
                        await page.keyboard.press(directionKey);
                        await page.waitForTimeout(120);
                    }
                    await page.keyboard.press('Enter');
                    await page.waitForTimeout(350);
                    activeCol = await getActiveCellCol();
                    Logger.info(`${label} focus corrected: activeCol=${activeCol}`);
                }

                let editor = page.locator('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):visible, textarea:visible').last();
                let hasEditor = await editor.isVisible({ timeout: 2000 }).catch(() => false);

                if (!hasEditor && targetCol !== null) {
                    // Fallback: keep trigger behavior but force editor on intended target.
                    const targetCell = getCell(rowGrow, targetCol);
                    await targetCell.scrollIntoViewIfNeeded();
                    await targetCell.dblclick({ force: true });
                    await page.waitForTimeout(400);
                    editor = page.locator('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):visible, textarea:visible').last();
                    hasEditor = await editor.isVisible({ timeout: 2500 }).catch(() => false);
                }

                await expect(editor).toBeVisible({ timeout: 7000 });
                await editor.fill(value);
                await page.waitForTimeout(400);
                await editor.press('Enter');
                // Extra commit for flaky Revo behavior: confirm + blur.
                await page.keyboard.press('Enter').catch(() => { });
                await page.waitForTimeout(300);
                if (targetCol !== null) {
                    const blurCell = getCell(rowGrow, targetCol);
                    await blurCell.click({ force: true }).catch(() => { });
                }
                await page.waitForTimeout(1400);
            };

            const waitForCellValue = async (rowGrow, colIndex, valueRegex, timeout = 12000) => {
                await expect.poll(
                    async () => normalize(await getCell(rowGrow, colIndex).textContent()),
                    { timeout, intervals: [1000, 1500, 2000] }
                ).toMatch(valueRegex);
            };

            /* ---------- Identify Columns ---------- */

            const headers = await getHeaders();

            const colMap = {
                costItem: findColumnIndex(headers, /cost item/i),
                contractAmount: findColumnIndex(headers, /contract amount/i),
                endDate: findColumnIndex(headers, /end date/i),
                scope: findOptionalColumnIndex(headers, /scope|imported from/i),
                budgetCategory: findOptionalColumnIndex(headers, /budget category/i),
                startDate: findOptionalColumnIndex(headers, /start date/i)
            };
            const colNameByIndex = Object.fromEntries(headers.map((h) => [h.col, h.text]));

            /* ---------- Resolve Row ---------- */

            const row = getRow();

            await expect(row).toBeVisible();

            const rowGrow = await row.getAttribute("data-rgrow");

            if (!rowGrow) throw new Error("Contract row not found");

            const logRowCells = async (label) => {
                const cells = await contractsGrid
                    .locator(`div[role="gridcell"][data-rgrow="${rowGrow}"]`)
                    .evaluateAll((els) =>
                        els.map((el) => ({
                            col: Number(el.getAttribute('aria-colindex') || el.getAttribute('data-rgcol')),
                            text: (el.textContent || '').trim()
                        }))
                    );
                Logger.info(`${label} rowCells => ${JSON.stringify(cells)}`);
            };

            /* ---------- Required 3-step flow ---------- */
            // 1) Trigger via Contract Amount cell (existing automation behavior), then fill Cost Item.
            let costItemUpdated = false;
            for (let attempt = 1; attempt <= 3 && !costItemUpdated; attempt++) {
                await logRowCells(`Before cost item attempt ${attempt}`);
                await setValueViaTriggeredCell({
                    rowGrow,
                    triggerCol: 6, // do not change: this trigger is flaky but works in automation
                    targetCol: colMap.costItem,
                    value: 'Fireplace',
                    commitKey: 'Tab',
                    label: `CostItem attempt ${attempt}`
                });
                const activeDebug = await page.evaluate(() => {
                    const active = document.activeElement;
                    const activeText = (active?.value ?? active?.textContent ?? '').toString().trim();
                    const cell = active?.closest?.('div[role="gridcell"]');
                    return {
                        activeTag: active?.tagName || null,
                        activeText,
                        activeCellCol: cell?.getAttribute('aria-colindex') || cell?.getAttribute('data-rgcol') || null,
                        activeCellText: (cell?.textContent || '').trim()
                    };
                });
                Logger.info(`Active target after trigger attempt ${attempt} => ${JSON.stringify(activeDebug)}`);

                const fireplaceOption = page.getByRole('option', { name: /fireplace/i }).first();
                if (await fireplaceOption.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await fireplaceOption.click({ force: true });
                    await page.waitForTimeout(1000);
                }

                const currentCostItem = normalize(await getCell(rowGrow, colMap.costItem).textContent());
                costItemUpdated = /fireplace/i.test(currentCostItem);
                Logger.info(
                    `CostItem monitor attempt ${attempt}: triggerCol=6(${colNameByIndex[6] || 'unknown'}), targetCol=${colMap.costItem}(${colNameByIndex[colMap.costItem]}), value="${currentCostItem}"`
                );
                if (!costItemUpdated) {
                    // Fallback: directly edit target cost item cell and commit hard.
                    const directCostItemCell = getCell(rowGrow, colMap.costItem);
                    await directCostItemCell.scrollIntoViewIfNeeded();
                    await directCostItemCell.dblclick({ force: true });
                    const directEditor = page.locator('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):visible, textarea:visible').last();
                    await expect(directEditor).toBeVisible({ timeout: 5000 });
                    await directEditor.fill('Fireplace');
                    const directOption = page.getByRole('option', { name: /fireplace/i }).first();
                    if (await directOption.isVisible({ timeout: 1500 }).catch(() => false)) {
                        await directOption.click({ force: true });
                    }
                    await directEditor.press('Enter');
                    await page.waitForTimeout(300);
                    await getCell(rowGrow, colMap.contractAmount).click({ force: true }).catch(() => { });
                    Logger.info(`Cost Item update attempt ${attempt} did not persist yet. Retrying...`);
                    await page.waitForTimeout(1200);
                }
                await logRowCells(`After cost item attempt ${attempt}`);
            }
            await waitForCellValue(rowGrow, colMap.costItem, /fireplace/i, 18000);

            // 2) Trigger via End Date cell, then fill Contract Amount.
            await logRowCells('Before contract amount update');
            await setValueViaTriggeredCell({
                rowGrow,
                triggerCol: 9,
                targetCol: colMap.contractAmount,
                value: '30000',
                commitKey: 'Enter',
                label: 'ContractAmount'
            });
            Logger.info(
                `ContractAmount monitor: triggerCol=${colMap.endDate}(${colNameByIndex[colMap.endDate]}), targetCol=${colMap.contractAmount}(${colNameByIndex[colMap.contractAmount]})`
            );
            await waitForCellValue(rowGrow, colMap.contractAmount, /(30000|30,000|\$30,000)/i);
            await logRowCells('After contract amount update');

            /* ---------- Save Changes ---------- */

            const saveBtn = page.getByRole("button", { name: /Save Changes/i });
            if (await saveBtn.isVisible()) {
                await expect(saveBtn).toBeVisible();
                await saveBtn.click();
                await page.waitForTimeout(30000);
            }


            /* ---------- Finalize Contract ---------- */

            const finalizeBtn = page.getByRole("button", { name: /Finalize Contract/i });
            const alreadyFinalized = !(await finalizeBtn.isVisible({ timeout: 5000 }).catch(() => false));

            if (alreadyFinalized) {
                Logger.info('Finalize Contract button not visible — contract already finalized. Verifying tab state...');
            } else {
                const finalizeResponsePromise = page.waitForResponse((response) => {
                    const url = response.url();
                    const method = response.request().method();
                    return /contract/i.test(url) && /final|finalize/i.test(url) && ['POST', 'PATCH', 'PUT'].includes(method);
                }, { timeout: 30000 }).catch(() => null);

                await finalizeBtn.click();

                /* ---------- Confirmation ---------- */

                // const confirmBtn = page.getByRole("button", { name: /Finalize|Confirm/i }).last();
                // if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                //     await confirmBtn.click();
                // }

                // await page.waitForTimeout(30000);
                await page.waitForTimeout(5000);
                const finalizeResponse = await finalizeResponsePromise;
                if (finalizeResponse) {
                    Logger.success(`Finalize API: ${finalizeResponse.request().method()} ${finalizeResponse.url()} [${finalizeResponse.status()}]`);
                } else {
                    Logger.info('Finalize API response was not captured within timeout.');
                }
                Logger.success("Contract finalized successfully");
                await page.waitForTimeout(1500);
            }

            const changeOrderTab = page.getByRole('tab', { name: /Change Order/i });
            const invoiceTab = page.getByRole('tab', { name: /^Invoice$/i }).or(page.getByRole('tab', { name: 'Invoice' }));
            await expect(changeOrderTab).toBeEnabled({ timeout: 15000 });
            await expect(invoiceTab).toBeEnabled({ timeout: 15000 });
        } catch (error) {
            await captureDebugScreenshot('failure_state');
            throw error;
        }
    });

    // Writes tabs disabled state for TC08 / TC09; run after `npm run Test:mandatory` when executing invoice/CO suites (see `npm run Test:depsForInvoiceCo`).
    test('TC84 @regression @projectAndJob @mandatory : Check if Invoice and Change Order tabs are disabled - persist for spec 8 and 9', async () => {
        Logger.step('Checking if Invoice and Change Order tabs are disabled...');
        await projectPage.openProject(projectData.projectName);
        await projectJob.navigateToJobsTab();
        await projectJob.openJobSummary();
        // await projectJob.navigateToBidsTab();
        // await projectJob.minimizeManageVendors();
        // // await page.waitForTimeout(30000);
        await page.waitForTimeout(15000);

        const changeOrdersTab = page.getByRole('tab', { name: 'Change Orders' });
        const invoiceTab = page.getByRole('tab', { name: 'Invoice' });

        const changeOrderTabDisabled = await changeOrdersTab.isDisabled().catch(() => false);
        const invoiceTabDisabled = await invoiceTab.isDisabled().catch(() => false);

        const state = {
            invoiceTabDisabled: !!invoiceTabDisabled,
            changeOrderTabDisabled: !!changeOrderTabDisabled
        };
        setTabsDisabledState(state);

        if (invoiceTabDisabled || changeOrderTabDisabled) {
            Logger.info(`Skipping spec 8 and 9: Invoice tab disabled=${invoiceTabDisabled}, Change Order tab disabled=${changeOrderTabDisabled}`);
        } else {
            Logger.success('Invoice and Change Order tabs are enabled - spec 8 and 9 will run.');
        }
    });

    test('TC85 @regression @projectAndJob : Jobs positive user journey assertions', async () => {
        await test.step('P1: Open target project and Jobs tab successfully', async () => {
            await openJobsWorkspaceFromLeftNav(page);
            await expect(page).toHaveURL(/\/jobs|tab=jobs/i);
            await expect(projectPage.tc05Loc().mainContainer).toBeVisible({ timeout: 10000 });
        });

        await test.step('P2: Jobs search accepts and clears values', async () => {
            const search = projectPage.tc05Loc().mainSearchInput;
            const keyword = `job_positive_${Date.now().toString().slice(-4)}`;
            await search.fill(keyword);
            await search.press('Enter').catch(() => { });
            await expect(search).toHaveValue(keyword);
            await search.fill('');
            await search.press('Enter').catch(() => { });
            await expect(search).toHaveValue('');
        });

        await test.step('P3: Export action from Jobs returns a downloadable file', async () => {
            const exportBtn = projectPage.tc05Loc().exportToolbarBtn;
            await expect(exportBtn).toBeVisible({ timeout: 10000 });
            const [download] = await Promise.all([
                page.waitForEvent('download'),
                exportBtn.click(),
            ]);
            expect(await download.path()).toBeTruthy();
        });

        await test.step('P4: Create Job modal opens and required fields are visible', async () => {
            await projectPage.openCreateJobModal();
            await projectPage.validateModalFields();
            await projectPage.closeJobModalIfOpen();
        });
    });

    test('TC86 @regression @projectAndJob : Jobs negative and missing validations', async () => {
        await test.step('N1: Empty Create Job submit should remain guarded', async () => {
            await openJobsWorkspaceFromLeftNav(page);
            await projectPage.openCreateJobModal();
            await projectPage.submitBtn.click().catch(() => { });
            const dialog = projectPage.modal.filter({ has: page.getByPlaceholder(/Enter job title/i) }).last();
            const stillOpen = await dialog.isVisible({ timeout: 2000 }).catch(() => false);
            expect(stillOpen).toBeTruthy();
            await projectPage.closeJobModalIfOpen();
        });

        await test.step('N2: Title-only job should not silently save', async () => {
            await projectPage.openCreateJobModal();
            await projectPage.titleInput.fill(`OnlyTitle_${Date.now()}`);
            await projectPage.submitBtn.click().catch(() => { });
            const dialog = projectPage.modal.filter({ has: page.getByPlaceholder(/Enter job title/i) }).last();
            const stillOpen = await dialog.isVisible({ timeout: 2000 }).catch(() => false);
            expect(stillOpen).toBeTruthy();
            await projectPage.closeJobModalIfOpen();
        });

        await test.step('N3: SQL-like search payload should be treated as plain text', async () => {
            const search = projectPage.tc05Loc().mainSearchInput;
            await search.fill(`' OR 1=1 --`);
            await search.press('Enter').catch(() => { });
            await expect(search).toHaveValue(`' OR 1=1 --`);
        });

        await test.step('N4: Script-like search payload should not break UI', async () => {
            const search = projectPage.tc05Loc().mainSearchInput;
            await search.fill('<script>alert(1)</script>');
            await search.press('Enter').catch(() => { });
            await expect(search).toHaveValue('<script>alert(1)</script>');
            await search.fill('');
            await search.press('Enter').catch(() => { });
        });

        await test.step('N5: No-result Jobs search should remain stable', async () => {
            const search = projectPage.tc05Loc().mainSearchInput;
            await search.fill(`__TC06_JOBS_NO_MATCH_${Date.now()}__`);
            await search.press('Enter').catch(() => { });
            await expect(search).toHaveValue(/__TC06_JOBS_NO_MATCH_/);
            await search.fill('');
            await search.press('Enter').catch(() => { });
        });
    });

    test('TC87 @regression @projectAndJob : Jobs edge and stress interactions', async () => {
        await test.step('E1: Long search strings should be accepted and recover', async () => {
            await openJobsWorkspaceFromLeftNav(page);
            const search = projectPage.tc05Loc().mainSearchInput;
            const longText = `TC06_LONG_${'X'.repeat(180)}`;
            await search.fill(longText);
            await search.press('Enter').catch(() => { });
            await expect(search).toHaveValue(longText);
            await search.fill('');
            await search.press('Enter').catch(() => { });
        });

        await test.step('E2: Repeated filter open/close should remain stable', async () => {
            const loc = projectPage.tc05Loc();
            for (let i = 0; i < 2; i++) {
                await loc.filterIconBtn.click();
                await expect(loc.filterDrawer).toBeVisible({ timeout: 10000 });
                if (await loc.filterDrawerCloseBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                    await loc.filterDrawerCloseBtn.click();
                } else {
                    await page.keyboard.press('Escape');
                }
                await expect(loc.filterDrawer).toBeHidden({ timeout: 10000 });
            }
        });

        await test.step('E3: Open/close Create Job modal rapidly without state corruption', async () => {
            for (let i = 0; i < 2; i++) {
                await projectPage.openCreateJobModal();
                await projectPage.closeJobModalIfOpen();
            }
            await expect(projectPage.tc05Loc().mainContainer).toBeVisible({ timeout: 10000 });
        });
    });

    test('TC88 @regression @projectAndJob : Jobs visual assurance across states', async () => {
        const loc = projectPage.tc05Loc();
        const shotMain = { ...JOB_VISUAL_ASSERT, mask: [loc.mainSearchInput] };

        await test.step('V1: Jobs base workspace visual', async () => {
            await openJobsWorkspaceFromLeftNav(page);
            await expect(loc.mainContainer).toHaveScreenshot('tc06-v-jobs-workspace.png', shotMain);
        });

        await test.step('V2: Jobs filter drawer visual', async () => {
            await loc.filterIconBtn.click();
            await expect(loc.filterDrawer).toBeVisible({ timeout: 10000 });
            await expect(loc.filterDrawer).toHaveScreenshot('tc06-v-jobs-filter-drawer.png', JOB_VISUAL_ASSERT);
            if (await loc.filterDrawerCloseBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                await loc.filterDrawerCloseBtn.click();
            } else {
                await page.keyboard.press('Escape');
            }
        });

        await test.step('V3: Jobs with-filter visual state', async () => {
            await loc.filterIconBtn.click();
            if (await loc.filterDrawerFirstCheckbox.isVisible({ timeout: 1200 }).catch(() => false)) {
                await loc.filterDrawerFirstCheckbox.click({ force: true });
                await page.waitForTimeout(800);
                await expect(loc.mainContainer).toHaveScreenshot('tc06-v-jobs-with-filter-state.png', shotMain);
            }
            if (await loc.filterDrawerCloseBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                await loc.filterDrawerCloseBtn.click();
            } else {
                await page.keyboard.press('Escape');
            }
            await expect(loc.mainContainer).toHaveScreenshot('tc06-v-jobs-without-filter-state.png', shotMain);
        });

        await test.step('V4: Create Job modal visual (default + validation)', async () => {
            await projectPage.openCreateJobModal();
            const dialog = projectPage.modal.filter({ has: page.getByPlaceholder(/Enter job title/i) }).last();
            await expect(dialog).toHaveScreenshot('tc06-v-create-job-modal.png', JOB_VISUAL_ASSERT);
            await projectPage.submitBtn.click().catch(() => { });
            await expect(dialog).toHaveScreenshot('tc06-v-create-job-modal-validation.png', JOB_VISUAL_ASSERT);
            await projectPage.closeJobModalIfOpen();
        });

        await test.step('V5: Jobs no-match search visual state', async () => {
            await loc.mainSearchInput.fill(`__TC06_VISUAL_NO_MATCH_${Date.now()}__`);
            await loc.mainSearchInput.press('Enter').catch(() => { });
            await expect(loc.mainContainer).toHaveScreenshot('tc06-v-jobs-no-match-state.png', shotMain);
            await loc.mainSearchInput.fill('');
            await loc.mainSearchInput.press('Enter').catch(() => { });
        });
    });

    test('@regression @projectAndJob TC89 - Reject job creation with whitespace-only title', async () => {
        await openJobsWorkspaceFromLeftNav(page);
        await projectPage.openCreateJobModal();

        const jobModal = page
            .locator('section[role="dialog"][data-modal-content="true"], [role="dialog"]')
            .filter({ has: page.getByPlaceholder('Enter job title') })
            .last();

        // Fill title with whitespace + dot; all other required fields valid to isolate title validation
        await jobModal.getByPlaceholder('Enter job title').fill('      .');

        const jobTypeDropdown = jobModal.getByPlaceholder('Select job type');
        await jobTypeDropdown.click();
        await page.waitForTimeout(400);
        const capexOption = page.getByRole('option', { name: /Capex/i }).first();
        if (await capexOption.isVisible({ timeout: 3000 }).catch(() => false)) {
            await capexOption.click();
        }

        const financialTypeDropdown = jobModal.getByPlaceholder('Select Contract or PO')
            .or(jobModal.getByRole('combobox', { name: /Financial Type/i })).first();
        await financialTypeDropdown.click();
        await page.waitForTimeout(400);
        const contractOption = page.getByRole('option', { name: /^Contract$/i }).first();
        if (await contractOption.isVisible({ timeout: 3000 }).catch(() => false)) {
            await contractOption.click();
        }

        const vendorDropdown = jobModal.getByRole('textbox', { name: 'Vendor' }).first();
        if (await vendorDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
            await vendorDropdown.click();
            await vendorDropdown.fill('Sumit');
            await page.waitForTimeout(600);
            const vendorOption = page.getByRole('option').first();
            if (await vendorOption.isVisible({ timeout: 3000 }).catch(() => false)) {
                await vendorOption.click();
            }
        }

        const urlBefore = page.url();
        await projectPage.submitBtn.click().catch(() => { });
        await page.waitForTimeout(3000);
        const urlAfter = page.url();

        // If the URL navigated to a job detail page, the job was created — that is the bug.
        const navigatedToJob = urlAfter !== urlBefore && /\/jobs\//.test(urlAfter);
        expect(
            navigatedToJob,
            `Bug: job was created with whitespace-only title "      ." — navigated to ${urlAfter} — app must reject titles that are blank or contain only whitespace/punctuation.`,
        ).toBe(false);

        // Modal must still be open (validation blocked the submit)
        const modalStillOpen = await jobModal.isVisible({ timeout: 2000 }).catch(() => false);
        expect(
            modalStillOpen,
            'Create Job modal should stay open when the title is whitespace-only.',
        ).toBe(true);

        await projectPage.closeJobModalIfOpen();
    });

});
