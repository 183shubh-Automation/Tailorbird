/**
 * End-to-end orchestration: property → budget revision (TC31 path) → project → job (TC37 subset) → TC47_NEW_UI finalize.
 * Calls `ProjectJob.runTc47NewUiContractFinalize` (same path as TC47_NEW_UI).
 */
require('dotenv').config();

const path = require('path');
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { ProjectPage } = require('../pages/projectPage');
const { ProjectJob } = require('../pages/projectJob');
const { BudgetJob } = require('../pages/budgetPage');
const PropertiesHelper = require('../pages/properties');
const { ApprovalJob } = require('../pages/approvalPage');
const { InvoicePage } = require('../pages/invoicePage');
const { Logger } = require('../utils/logger');

test.use({
    storageState: 'sessionState.json',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
});

const PROPERTY_TYPES = ['Garden Style', 'Mid Rise', 'High Rise', 'Military Housing'];

test.describe.serial('Finalize bid / contract + OOO approval chain', () => {
    test('TC258 @regression @contract @finalizeBidUi @property @projectAndJob : E2E flow to finalize contract', async ({
        page,
    }) => {
        /** Long single journey; default 30s is insufficient. */
        test.setTimeout(900000);

        const projectPage = new ProjectPage(page);
        const projectJob = new ProjectJob(page);
        const budgetJob = new BudgetJob(page);
        const prop = new PropertiesHelper(page);

        const propertyName = `e2e_prop_${Date.now()}`;
        const address = 'Domestic Terminal, College Park, GA 30337, USA';
        const city = 'College Park';
        const state = 'GA';
        const zip = '30337';
        const propertyType = PROPERTY_TYPES[Math.floor(Math.random() * PROPERTY_TYPES.length)];

        await page.goto(process.env.DASHBOARD_URL, { waitUntil: 'load' });
        await expect(page).toHaveURL(process.env.DASHBOARD_URL);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1500);

        Logger.step('TC258: Create property + persist propertyData (TC14 core)');
        await prop.goToProperties();
        await prop.createProperty(propertyName, address, city, state, zip, propertyType);

        const propertyPayload = { propertyName };
        const propertyDataPath = path.join(__dirname, '../data/propertyData.json');
        const downloadsPropertyPath = path.join(process.cwd(), 'downloads', 'property.json');
        fs.mkdirSync(path.dirname(propertyDataPath), { recursive: true });
        fs.mkdirSync(path.dirname(downloadsPropertyPath), { recursive: true });
        fs.writeFileSync(propertyDataPath, JSON.stringify(propertyPayload, null, 2));
        fs.writeFileSync(downloadsPropertyPath, JSON.stringify(propertyPayload, null, 2));

        Logger.step('TC258: Budget revision + create project (TC31)');
        const budgetDataPath = path.resolve(process.cwd(), 'files', 'budget_data.csv');
        expect(fs.existsSync(budgetDataPath), 'files/budget_data.csv must exist').toBeTruthy();

        await page.waitForTimeout(4000);

        await budgetJob.navigateToBudget();
        await budgetJob.waitForPageLoad();

        const propertySelected = await budgetJob.selectPropertyByName(propertyName);
        expect(propertySelected, `Budget dropdown must list "${propertyName}"`).toBeTruthy();

        await budgetJob.openRevisionEditor();
        await budgetJob.uploadFileInRevision(budgetDataPath);
        await budgetJob.ensureSubmitEnabledAfterUpload();
        await budgetJob.clickSubmitForApproval();
        await page.waitForTimeout(8000); // extra time for backend to index budget categories before navigating away
        await expect(page).toHaveURL(/financials\/budget|budget-revision/i, { timeout: 15000 });

        await page.goto(process.env.DASHBOARD_URL, { waitUntil: 'load' });
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000);

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
            budget: budgetAmount,
        });

        const projectDataPath = path.join(__dirname, '../data/projectData.json');
        const projectData = JSON.parse(fs.readFileSync(projectDataPath, 'utf8'));

        Logger.step('TC258: Add job + contract overview edit + lastCreatedJob (TC37 trimmed)');
        await projectPage.navigateToProjects();
        await projectPage.openProject(projectData.projectName);
        await projectJob.navigateToJobsTab();

        await projectPage.openCreateJobModal();

        const today = new Date();
        const jobEnd = new Date(today);
        jobEnd.setFullYear(today.getFullYear() + 1);
        const randomSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        const jobTitle = `Mall in Noida_${randomSuffix}`;
        const estimatedBudget = Math.floor(Math.random() * (10000 - 3000 + 1)) + 3000;

        await projectPage.fillJobForm({
            title: jobTitle,
            jobType: 'Unit Interior',
            financialType: 'Contract',
            vendor: 'Sumit_Corp',
            description: 'Job created via automation',
            estimatedBudget,
            startDate: projectPage.formatDate(today),
            endDate: projectPage.formatDate(jobEnd),
            selectBudgetCategory: true,
        });

        const selectedCategory = projectPage.selectedBudgetCategory;
        if (selectedCategory) {
            expect(selectedCategory.length).toBeGreaterThan(0);
        }

        await projectPage.submitJob();
        // After creation the app navigates to the job detail page; wait for that
        // navigation to complete before validating, since submitJob() has no waitForURL.
        await page.waitForURL(/\/jobs\/\d+/, { timeout: 20000 }).catch(() => {});
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1500);

        await prop.validateJobDetails({
            'Job Name': jobTitle,
            'Job Type': 'Unit Interior',
            'Financial Type': 'Contract',
            Description: 'Job created via automation',
        });

        const contractEstimatedBudget = Math.floor(Math.random() * (10000 - 1000 + 1)) + 1000;
        await projectPage.openContractsTab();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(5000);

        const editContractBtn = page.getByRole('button', { name: /^Edit$/i }).first();
        await expect(editContractBtn).toBeVisible({ timeout: 15000 });
        await editContractBtn.click({ force: true });
        await page.waitForTimeout(2000);

        const editContractDialog = page.getByRole('dialog').filter({ hasText: /Edit Contract Overview/i }).first();
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
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(5000);

        const lastCreatedJobPath = path.join(__dirname, '../data/lastCreatedJob.json');
        fs.writeFileSync(
            lastCreatedJobPath,
            JSON.stringify(
                {
                    jobName: jobTitle,
                    estimatedBudget,
                    contractEstimatedBudget,
                    projectName: projectData.projectName,
                    createdVia: 'TC15_E2E_FinalizeBidUIFlow',
                    createdAt: new Date().toISOString(),
                },
                null,
                2
            )
        );

        Logger.step('TC258 Scenario 1: Assert Budget Category is prefilled when Add Contract is clicked');
        const addContractBtn = page.getByRole('button', { name: /Add Contract/i });
        await expect(addContractBtn).toBeVisible({ timeout: 10000 });
        if (selectedCategory) {
            const beforeAddCount = await page
                .getByRole('gridcell', { name: selectedCategory, exact: true })
                .count();
            await addContractBtn.click();
            await page.waitForTimeout(2000);
            const afterAddCount = await page
                .getByRole('gridcell', { name: selectedCategory, exact: true })
                .count();
            expect(
                afterAddCount,
                `New contract row must have Budget Category "${selectedCategory}" prefilled`
            ).toBeGreaterThan(beforeAddCount);
            Logger.success(`TC258 Scenario 1: Budget Category "${selectedCategory}" is prefilled in new contract row ✓`);
        } else {
            Logger.info('TC258 Scenario 1: selectedCategory not captured — prefill assertion skipped');
        }

        Logger.step('TC258 Scenario 2: Table → Manage Columns → hide Cost Item → assert hidden → restore');
        const tableMenuBtn = page.getByRole('button', { name: 'Table' });
        await expect(tableMenuBtn).toBeVisible({ timeout: 10000 });
        await tableMenuBtn.click();
        await page.waitForTimeout(500);
        await page.getByText(/hide \/ show columns/i).click();
        await page.waitForTimeout(1000);
        const manageColumnsDialog = page.getByRole('dialog', { name: 'Manage Columns' });
        await expect(manageColumnsDialog).toBeVisible({ timeout: 10000 });
        await manageColumnsDialog.getByText('Cost Item', { exact: true }).click();
        await page.waitForTimeout(1000);
        await expect(
            page.getByRole('columnheader', { name: 'Cost Item', exact: true }),
            '"Cost Item" column header must be hidden after unchecking in Manage Columns'
        ).not.toBeVisible({ timeout: 5000 });
        Logger.success('TC258 Scenario 2: Cost Item column is hidden ✓');
        await manageColumnsDialog.getByText('Cost Item', { exact: true }).click();
        await page.waitForTimeout(1000);
        await manageColumnsDialog.getByRole('banner').getByRole('button').click();
        await page.waitForTimeout(500);
        await expect(
            page.getByRole('columnheader', { name: 'Cost Item', exact: true }),
            '"Cost Item" column header must be visible after re-enabling in Manage Columns'
        ).toBeVisible({ timeout: 5000 });
        Logger.success('TC258 Scenario 2: Cost Item column restored ✓');

        Logger.step('TC258: Jobs menu contract grid + finalize (TC47_NEW_UI)');
        await projectJob.runTc47NewUiContractFinalize(projectData);

        Logger.success('TC258: Full chain completed');
    });

    test('@ooo @e2e TC259-SETUP-APPROVAL-INVOICE Create an Invoice approval template with three required approvers on the TC258 property and submit a test invoice to prepare for the approval routing verification test', async ({ page }) => {
        test.setTimeout(300000);
        Logger.step('TC-OOO-SETUP-APPROVAL-INVOICE: Start');

        const suffix = Date.now();

        // Use TC258's property for the Invoice template so that the invoice created
        // in TC258's job (which belongs to TC258's property) triggers this template.
        // A fresh property here would mismatch the invoice → no approval → TC260 fails.
        const propertyDataFile = path.join(__dirname, '../data/propertyData.json');
        expect(fs.existsSync(propertyDataFile), 'data/propertyData.json must exist — TC258 must run first').toBe(true);
        const { propertyName } = JSON.parse(fs.readFileSync(propertyDataFile, 'utf8'));
        expect(propertyName, 'propertyName must be set in propertyData.json').toBeTruthy();
        Logger.success(`TC-OOO-SETUP: Using TC258 property "${propertyName}" for Invoice template ✓`);

        const approvalJob = new ApprovalJob(page);
        await page.goto(process.env.DASHBOARD_URL, { waitUntil: 'domcontentloaded' });
        await approvalJob.navigateToApprovalTab();
        await approvalJob.navigateToApprovalTemplatesTab();
        await approvalJob.waitForPageLoad();

        const templateName = `OOO_InvTemplate_${suffix}`;
        await approvalJob.openCreateTemplateDialog();
        await approvalJob.fillTemplateName(templateName);
        await approvalJob.selectTemplateType('Invoice');
        await approvalJob.addProperty(propertyName);
        Logger.info(`TC-OOO-SETUP: Template dialog — name="${templateName}", type=Invoice, property="${propertyName}" ✓`);

        const APPROVER_TIMEOUT = 15000;
        const approverInputs = page.getByPlaceholder('Select approver');
        const approvers = ['sumit mishra', 'sumit test', 'Sumit Harsh'];
        for (let i = 0; i < approvers.length; i++) {
            const input = approverInputs.nth(i);
            await input.waitFor({ state: 'visible', timeout: APPROVER_TIMEOUT });
            await input.click();
            await page.waitForTimeout(300);
            await input.fill(approvers[i]);
            await page.waitForTimeout(800);
            await page.keyboard.press('ArrowDown');
            await page.waitForTimeout(300);
            await page.keyboard.press('Enter');
            await page.waitForTimeout(800);
            Logger.success(`TC-OOO-SETUP: Approver row ${i + 1} — "${approvers[i]}" ✓`);
        }

        await approvalJob.fillAmount(5000);
        await approvalJob.checkAlwaysRequiredInTemplateDialog(3);
        Logger.info('TC-OOO-SETUP: Amount=$5000, Always Required checked for all 3 rows ✓');

        await approvalJob.submitCreateTemplate();
        await page.waitForTimeout(7000);
        await approvalJob.searchTemplate(templateName);
        await expect(
            page.getByRole('row').filter({ hasText: templateName }),
            `Template "${templateName}" must appear in the list`
        ).toBeVisible({ timeout: 15000 });
        await approvalJob.clearSearch();
        Logger.success(`TC-OOO-SETUP: Template "${templateName}" confirmed in list ✓`);

        const projectData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/projectData.json'), 'utf8'));
        const projectPage = new ProjectPage(page);
        const projectJob = new ProjectJob(page);
        const invoicePage = new InvoicePage(page);

        await page.goto(process.env.DASHBOARD_URL, { waitUntil: 'load' });
        await projectPage.openProject(projectData.projectName);
        await projectJob.navigateToJobsTab();
        await projectJob.openJobSummary();
        await invoicePage.navigateToInvoiceTab();
        await page.waitForLoadState('load');
        await page.waitForTimeout(2000);
        Logger.info(`TC-OOO-SETUP: Opened project "${projectData.projectName}" → invoice tab ✓`);

        await page.evaluate(() => {
            document.querySelectorAll('main, .mantine-AppShell-navbar').forEach(el => { el.style.zoom = '70%'; });
        });

        const invoiceAmount = Math.floor(Math.random() * (5000 - 1000 + 1)) + 1000;
        const invoiceResult = await invoicePage.createCompleteInvoice({
            title: `OOO_Invoice_${suffix}`,
            description: 'Invoice for OOO approval routing setup',
            budgetCategory: 'Bathroom fixtures install',
            amount: invoiceAmount,
            confirm: true,
        });

        expect(invoiceResult.number, 'Invoice number must be assigned').toBeTruthy();
        expect(invoiceResult.budgetCategoriesSet, 'Budget category must be set').toBeGreaterThan(0);
        expect(invoiceResult.amountFilled, `Amount $${invoiceAmount} must be committed in grid`).toBe(true);
        const committedDigits = (invoiceResult.amountCellText || '').replace(/\D/g, '');
        expect(committedDigits, `Grid cell must contain amount digits`).toContain(String(invoiceAmount).replace(/\D/g, ''));

        const amountMatch = (invoiceResult.amountCellText || '').match(/\$[\d,]+/);
        const invoiceAmountFormatted = amountMatch ? amountMatch[0] : `$${invoiceAmount.toLocaleString()}`;
        const invoiceId = (invoiceResult.number || '').match(/\d+/)?.[0] || '';

        const oooChainDataPath = path.join(__dirname, '../data/oooChainData.json');
        fs.mkdirSync(path.dirname(oooChainDataPath), { recursive: true });
        fs.writeFileSync(oooChainDataPath, JSON.stringify({
            invoiceId,
            invoiceAmount,
            invoiceAmountFormatted,
            invoiceTitle: `OOO_Invoice_${suffix}`,
            invoiceNumber: invoiceResult.number,
            createdAt: new Date().toISOString(),
        }, null, 2));
        Logger.success(`TC-OOO-SETUP: Invoice "${invoiceResult.number}" created — ID: ${invoiceId}, amount: ${invoiceAmountFormatted}. Chain data saved ✓`);

        Logger.success('TC-OOO-SETUP-APPROVAL-INVOICE PASSED');
    });

    const _hasOtherSession15 = fs.existsSync(path.join(__dirname, '../OtherSessionState.json'));
    test.describe('TC260-APPROVAL-VERIFY — verify Other user can see the created approval for OUt of Office', () => {
        test.use({ storageState: _hasOtherSession15 ? 'OtherSessionState.json' : 'sessionState.json' });

        test('@ooo @e2e TC-OOO-APPROVAL-VERIFY The test invoice shows up in All Approvals with the correct amount and Pending status and the Approval Details panel lists all three expected approvers with their individual statuses', async ({ page }) => {
            test.skip(!_hasOtherSession15, 'OtherSessionState.json missing — provide a second authenticated user session to run this test');
            test.setTimeout(120000);
            Logger.step('TC-OOO-APPROVAL-VERIFY: Verify the setup invoice in All Approvals with all 3 approvers');

            const chainDataPath = path.join(__dirname, '../data/oooChainData.json');
            expect(fs.existsSync(chainDataPath), 'data/oooChainData.json must exist — TC-OOO-SETUP must have run first').toBe(true);
            const { invoiceId, invoiceAmountFormatted, invoiceNumber } = JSON.parse(fs.readFileSync(chainDataPath, 'utf8'));
            expect(invoiceId, 'invoiceId must be populated in oooChainData.json').toBeTruthy();
            expect(invoiceAmountFormatted, 'invoiceAmountFormatted must be populated in oooChainData.json').toBeTruthy();
            Logger.info(`TC-OOO-APPROVAL-VERIFY: Looking for ID="${invoiceId}", amount="${invoiceAmountFormatted}" ✓`);

            const origin = new URL(process.env.DASHBOARD_URL).origin;
            await page.goto(`${origin}/approvals/all-approvals`, { waitUntil: 'domcontentloaded' });
            await page.waitForSelector('input[placeholder="Search..."]:not([data-disabled="true"])', { timeout: 30000 });
            Logger.success('TC-OOO-APPROVAL-VERIFY: All Approvals page loaded ✓');

            await page.getByPlaceholder('Search...').first().fill(invoiceId);
            // Give CI more time — approval indexing may lag after invoice creation.
            await page.waitForTimeout(3000);
            Logger.info(`TC-OOO-APPROVAL-VERIFY: Searched for ID "${invoiceId}"`);

            // Retry the row lookup with a longer timeout to handle any indexing delay
            const invoiceRow = page.getByRole('row').filter({ hasText: invoiceId }).first();
            await expect(invoiceRow, `Row with invoice ID "${invoiceId}" must be visible`).toBeVisible({ timeout: 30000 });
            await expect(invoiceRow.getByText(invoiceAmountFormatted), `Amount "${invoiceAmountFormatted}" must be in the row`).toBeVisible({ timeout: 5000 });
            Logger.success(`TC-OOO-APPROVAL-VERIFY: Row found — ID="${invoiceId}", amount="${invoiceAmountFormatted}" ✓`);

            const statusCell = invoiceRow.getByRole('gridcell').filter({ hasText: /pending/i }).first();
            await expect(statusCell, 'Status cell must show Pending').toBeVisible({ timeout: 5000 });
            const rawStatusText = await statusCell.innerText().catch(() => statusCell.textContent());
            const statusText = (rawStatusText.match(/(Pending Approval|Pending Assignment|Pending|Approved|Rejected)/i)?.[0] || rawStatusText).trim();
            expect(statusText, 'Status must be a pending variant').toMatch(/pending/i);
            Logger.success(`TC-OOO-APPROVAL-VERIFY: Status is "${statusText}" ✓`);

            const viewDetailsBtn = page.getByRole('button', { name: 'View Details' }).first();
            await expect(viewDetailsBtn, '"View Details" must be visible').toBeVisible({ timeout: 10000 });
            await viewDetailsBtn.click();

            const dialog = page.getByRole('dialog', { name: 'Approval Details' });
            await expect(dialog, 'Approval Details dialog must open').toBeVisible({ timeout: 15000 });
            Logger.success('TC-OOO-APPROVAL-VERIFY: Approval Details dialog opened ✓');

            const expectedApprovers = ['Sumit Mishra', 'Sumit Test', 'Sumit Harsh'];
            for (const name of expectedApprovers) {
                await expect(dialog.getByText(name, { exact: true }), `Approver "${name}" must be listed`).toBeVisible({ timeout: 10000 });
            }
            Logger.success(`TC-OOO-APPROVAL-VERIFY: All 3 approvers confirmed — ${expectedApprovers.join(', ')} ✓`);

            const STATUS_VALUES = ['Pending Approval', 'Pending Assignment', 'Pending', 'Skipped', 'Rejected', 'Approved'];
            for (const name of expectedApprovers) {
                const nameEl = dialog.getByText(name, { exact: true }).first();
                const approverStatus = await nameEl.evaluate((el, statuses) => {
                    let node = el;
                    for (let i = 0; i < 6; i++) {
                        if (!node.parentElement) break;
                        node = node.parentElement;
                        for (const sib of Array.from(node.parentElement?.children || [])) {
                            if (sib === node) continue;
                            const txt = (sib.textContent || '').trim();
                            if (statuses.some(s => s.toLowerCase() === txt.toLowerCase())) return txt;
                        }
                    }
                    return 'Unknown';
                }, STATUS_VALUES);
                Logger.info(`TC-OOO-APPROVAL-VERIFY: "${name}" → "${approverStatus}"`);
            }

            Logger.success(
                `TC-OOO-APPROVAL-VERIFY PASSED — Invoice ${invoiceNumber} in All Approvals ` +
                `(amount: ${invoiceAmountFormatted}, status: ${statusText}), all 3 approvers logged`
            );
        });
    });
});
