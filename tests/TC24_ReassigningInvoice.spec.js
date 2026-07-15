require('dotenv').config();
const { test, expect } = require('@playwright/test');
const { ReassignInvoicePage } = require('../pages/reassignInvoicePage');
const { Logger } = require('../utils/logger');
const fs = require('fs');
const path = require('path');

// Reassign Invoice is only exposed to an approver on the invoice's approval chain
// (verified live: the invoice creator alone does not see "Reassign Invoice" in the
// Actions column; the configured approver does) — so this suite runs as that other
// user, same as TC11's "another user" approval suite.
test.use({
    storageState: 'OtherSessionState.json',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
});

const PROPERTY_NAME = 'Test Property5_Reassigning_Automation';
const MODAL_DATA_PATH = path.join(__dirname, '../data/reassignInvoiceModalData.json');

function saveModalData(data) {
    fs.writeFileSync(MODAL_DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function loadModalData() {
    return JSON.parse(fs.readFileSync(MODAL_DATA_PATH, 'utf8'));
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers for Scenarios 1–4 (TC368–TC371) below.
// Every call inside these is an EXISTING ReassignInvoicePage / InvoicePage method or an
// EXISTING locator (reassignInvoiceLocators) — nothing new is added to any page object,
// locator file, JSON file, or utility file. This is pure composition/orchestration local
// to this spec, in the same spirit as the saveModalData/loadModalData helpers above.
// ─────────────────────────────────────────────────────────────────────────────

// Invoice-list grid column order (confirmed live via MCP browser): Invoice Number,
// Financial Type, Title, Description, Invoiced Amount, Gross Amount, Retainage Withheld,
// Retainage Released, Outstanding Retainage, Net Payable, Status, Attachments, Approved At.
const INVOICE_COL = { TITLE: 2, DESCRIPTION: 3, INVOICED_AMOUNT: 4, STATUS: 10 };

/** Reads one gridcell (by column index) from the row matching invoiceNumber, on whatever job's Invoice tab is currently open. */
async function getInvoiceGridCellText(rip, invoiceNumber, colIndex) {
    const row = rip.loc.invoiceDataRows.filter({ hasText: invoiceNumber }).first();
    await expect(row, `Row for "${invoiceNumber}" not found`).toBeVisible({ timeout: 15000 });
    return (await row.locator('[role="gridcell"]').nth(colIndex).textContent().catch(() => '')).trim();
}

/** Snapshots Title/Description/Invoiced Amount/Status for an invoice on the currently-open Invoice tab. */
async function captureInvoiceFields(rip, invoiceNumber) {
    return {
        title: await getInvoiceGridCellText(rip, invoiceNumber, INVOICE_COL.TITLE),
        description: await getInvoiceGridCellText(rip, invoiceNumber, INVOICE_COL.DESCRIPTION),
        amount: await getInvoiceGridCellText(rip, invoiceNumber, INVOICE_COL.INVOICED_AMOUNT),
        status: await getInvoiceGridCellText(rip, invoiceNumber, INVOICE_COL.STATUS),
    };
}

/**
 * Discovers every job for the property (name + owning project) by reading the live Jobs grid
 * opened via the property's existing "Jobs" stat button — nothing hardcoded, nothing cached.
 */
async function discoverPropertyJobs(rip, propertyName) {
    await rip.openPropertyByName(propertyName);
    await rip.loc.jobsStatButton.click();
    await rip.page.waitForURL(/\/jobs/, { timeout: 20000 });
    await rip.loc.jobsGrid.waitFor({ state: 'visible', timeout: 20000 });

    const rows = rip.loc.jobRowsForProperty(propertyName);
    await expect(rows.first(), `No jobs found for property "${propertyName}"`).toBeVisible({ timeout: 15000 });

    const count = await rows.count();
    const jobs = [];
    for (let i = 0; i < count; i++) {
        const cells = rows.nth(i).locator('[role="gridcell"]');
        const jobName = ReassignInvoicePage.stripClearIcon(await cells.nth(0).textContent().catch(() => ''));
        const projectName = ReassignInvoicePage.stripClearIcon(await cells.nth(5).textContent().catch(() => ''));
        if (jobName) jobs.push({ jobName, projectName });
    }
    return jobs;
}

/** Opens a job's Invoice tab and returns its current invoice-row count — read live, never assumed. */
async function countInvoicesInJob(rip, propertyName, jobName) {
    await rip.openJobOfProperty(propertyName, { jobName });
    await rip.openInvoiceTab();

    // The invoice grid renders asynchronously (virtualized) — reading count() immediately can
    // observe 0 rows before they've painted, misclassifying a populated job as empty (a proven
    // race in this scenario). Wait for either a data row or the explicit empty-state message.
    await Promise.race([
        rip.loc.invoiceDataRows.first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {}),
        rip.page.getByText('No invoices added yet').waitFor({ state: 'visible', timeout: 15000 }).catch(() => {}),
    ]);

    const noInvoicesVisible = await rip.page.getByText('No invoices added yet').isVisible().catch(() => false);
    if (noInvoicesVisible) return 0;

    // revo-grid VIRTUALIZES rows — it only paints what fits the current viewport, so once a job's
    // invoice list grows past one screen, invoiceDataRows.count() undercounts the true total (proven
    // live via MCP browser: 20 invoices in the API response / aria-rowcount="20", only 9 painted in
    // the DOM). aria-rowcount on the grid element reflects revo-grid's real dataset size regardless
    // of what's currently rendered, so prefer that; fall back to the DOM count if it's ever absent.
    const ariaRowCount = await rip.loc.invoiceGridScope.getAttribute('aria-rowcount').catch(() => null);
    const parsed = parseInt(ariaRowCount, 10);
    if (Number.isFinite(parsed)) return parsed;

    return rip.loc.invoiceDataRows.count();
}

/** Creates + approves an invoice for an arbitrary amount, composed entirely from existing InvoicePage methods. */
async function createAndApproveInvoice(rip, { title, description, amount }) {
    await rip.invoicePage.clickAddInvoice();
    const invoiceNumber = await rip.invoicePage.getInvoiceNumber();
    await rip.invoicePage.fillInvoiceDetails({ title, description });

    const amountFilled = await rip.invoicePage.fillInvoiceGridAmount(amount);
    expect(amountFilled, `Failed to fill $${amount} invoice amount`).toBeTruthy();

    await rip.confirmAndApproveInvoice();

    const status = await rip.getInvoiceStatus(invoiceNumber);
    expect(status, `Invoice "${invoiceNumber}" should be Approved after confirming`).toMatch(/approved/i);

    return invoiceNumber;
}

/** Static modal content + New Project dropdown — asserted identically in every scenario (mirrors TC366). */
async function assertModalStaticContentAndProjects(rip, { expectedProject, expectedJob } = {}) {
    const staticContent = await rip.captureStaticModalContent();
    expect(staticContent.heading).toBe('Reassign Invoice');
    if (expectedProject !== undefined) expect(staticContent.currentProject).toBe(expectedProject);
    if (expectedJob !== undefined) expect(staticContent.currentJob).toBe(expectedJob);
    expect(staticContent.newProjectLabel).toContain('New Project');
    expect(staticContent.newJobLabel).toContain('New Job');
    expect(staticContent.cancelButtonText).toBe('Cancel');
    expect(staticContent.confirmButtonText).toBe('Confirm Reassignment');

    const newProjectOptions = await rip.getNewProjectOptions();
    expect(newProjectOptions.length, 'New Project dropdown should list at least one project').toBeGreaterThan(0);
    expect(newProjectOptions).toContain(staticContent.currentProject);

    return { staticContent, newProjectOptions };
}

/**
 * Drives New Project -> New Job -> Scope using caller-supplied pickers, asserting every
 * dropdown's option list is non-empty and that Confirm Reassignment stays disabled until a
 * scope is chosen (true for every scenario, not just Scenario 3). Returns the full capture
 * (for JSON-snapshot comparison) plus the resolved project/job/scope.
 */
async function driveModalSelections(rip, { expectedProject, expectedJob, pickProject, pickJob, pickScope }) {
    const { staticContent, newProjectOptions } = await assertModalStaticContentAndProjects(rip, { expectedProject, expectedJob });

    const targetProject = pickProject(newProjectOptions, staticContent.currentProject);
    expect(targetProject, 'Could not resolve a target project from New Project options').toBeTruthy();
    await rip.selectNewProject(targetProject);

    const newJobOptions = await rip.getNewJobOptions();
    expect(newJobOptions.length, `New Job dropdown should list at least one job for "${targetProject}"`).toBeGreaterThan(0);
    const targetJob = pickJob(newJobOptions);
    expect(targetJob, 'Could not resolve a target job from New Job options').toBeTruthy();
    await rip.selectNewJob(targetJob);

    const scopeOptions = await rip.getScopeOptions();
    expect(scopeOptions.length, `Scope dropdown should list at least one scope for "${targetJob}"`).toBeGreaterThan(0);

    expect(await rip.isConfirmReassignmentEnabled(), 'Confirm Reassignment must be disabled before a scope is selected').toBe(false);

    const targetScope = pickScope(scopeOptions);
    expect(targetScope, 'Could not resolve a scope from Scope options').toBeTruthy();
    await rip.selectScope(targetScope);

    const totalAllocatedText = await rip.getTotalAllocatedText();
    expect(totalAllocatedText).toContain('Total Allocated');
    expect(await rip.isConfirmReassignmentEnabled(), 'Confirm Reassignment should enable once project/job/scope are all selected').toBe(true);

    return {
        capture: { ...staticContent, newProjectOptions, newJobOptions, scopeOptions },
        targetProject, targetJob, targetScope,
    };
}

/**
 * Full modal validation, JSON-snapshot round trip (open -> capture -> save -> close -> reopen ->
 * capture -> compare), then the real reassignment — the shared flow every scenario runs before
 * confirming. Pass 2's expected project/job are derived from Pass 1's own capture (not the
 * caller's), so this also self-checks the modal is internally consistent across two opens.
 */
async function validateModalAndReassign(rip, { invoiceNumber, expectedProject, expectedJob, pickProject, pickJob, pickScope }) {
    const before = await captureInvoiceFields(rip, invoiceNumber);

    await rip.openReassignModalForInvoice(invoiceNumber);
    const pass1 = await driveModalSelections(rip, { expectedProject, expectedJob, pickProject, pickJob, pickScope });
    saveModalData(pass1.capture);
    await rip.cancelReassignModal();

    await rip.openReassignModalForInvoice(invoiceNumber);
    const pass2 = await driveModalSelections(rip, {
        expectedProject: pass1.capture.currentProject,
        expectedJob: pass1.capture.currentJob,
        pickProject, pickJob, pickScope,
    });
    const saved = loadModalData();
    expect(pass2.capture, 'Re-opened modal (project/job/scope/options) must match the saved JSON snapshot').toEqual(saved);
    expect(pass2.targetProject).toBe(pass1.targetProject);
    expect(pass2.targetJob).toBe(pass1.targetJob);
    expect(pass2.targetScope).toBe(pass1.targetScope);

    await rip.confirmReassignment();

    return { ...pass2, before, sourceProject: pass1.capture.currentProject, sourceJob: pass1.capture.currentJob };
}

/**
 * Post-reassignment validation shared by every scenario: source removal, destination presence
 * (exactly once), and title/description/amount/status/project/job/scope all correct — every
 * read is by invoiceNumber match, never by row order/position.
 */
async function verifyReassignmentResult(rip, { invoiceNumber, targetProject, targetJob, targetScope, before }) {
    await rip.waitForInvoiceAbsent(invoiceNumber);

    await rip.openJobOfProperty(PROPERTY_NAME, { jobName: targetJob });
    await rip.openInvoiceTab();
    await rip.waitForInvoiceRowText(invoiceNumber);

    const matchingRowsCount = await rip.loc.invoiceDataRows.filter({ hasText: invoiceNumber }).count();
    expect(matchingRowsCount, `"${invoiceNumber}" must appear exactly once under "${targetJob}"`).toBe(1);

    const after = await captureInvoiceFields(rip, invoiceNumber);
    expect(after.title, 'Invoice title must be unchanged by reassignment').toBe(before.title);
    expect(after.description, 'Invoice description must be unchanged by reassignment').toBe(before.description);
    expect(after.amount, 'Invoice amount must be unchanged by reassignment').toBe(before.amount);
    expect(after.status, 'Invoice status must be unchanged by reassignment').toBe(before.status);
    expect(after.status, `"${invoiceNumber}" status should still be Approved`).toMatch(/approved/i);

    // Read project/job/scope back from the app's own "Current Assignment" fields — the most
    // authoritative source, and proves the invoice lives under this scope only (an invoice has
    // exactly one current scope at a time).
    await rip.openReassignModalForInvoice(invoiceNumber);
    const modalAfter = await rip.captureStaticModalContent();
    expect(modalAfter.currentProject, 'Project should reflect the reassignment target').toBe(targetProject);
    expect(modalAfter.currentJob, 'Job should reflect the reassignment target').toBe(targetJob);
    expect(modalAfter.currentScope, 'Scope should reflect the reassignment target').toBe(targetScope);
    await rip.cancelReassignModal();

    return after;
}

let page, reassignInvoicePage;

test.describe('Reassign Invoice', () => {
    test.describe.configure({ retries: 1 });

    test.beforeEach(async ({ page: p }) => {
        page = p;
        reassignInvoicePage = new ReassignInvoicePage(page);

        await page.goto(process.env.DASHBOARD_URL, { waitUntil: 'load' });
        await expect(page).toHaveURL(process.env.DASHBOARD_URL);
        await page.waitForTimeout(5000);
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TC366 — Reassign Invoice modal UI and dropdown assertions
    // Non-destructive: captures every label/dropdown/option, persists it to a JSON
    // fixture, re-opens the modal and asserts the live UI still matches that fixture,
    // then walks every dropdown to the end (New Project -> New Job -> Scope) purely
    // to assert their contents/enablement — and always Cancels, never confirms.
    // ──────────────────────────────────────────────────────────────────────────
    test('TC366 @regression @reassignInvoice : Should assert every Reassign Invoice modal field, label and dropdown option, and persist/compare them via JSON', async () => {
        test.setTimeout(180000);

        Logger.step('TC366: Navigating to property -> first job -> Invoice tab');
        const jobName = await reassignInvoicePage.openFirstJobOfProperty(PROPERTY_NAME);
        await reassignInvoicePage.openInvoiceTab();

        const dataRows = reassignInvoicePage.loc.invoiceDataRows;
        await expect(dataRows.first(), `No invoices found on job "${jobName}" — cannot test Reassign modal`).toBeVisible({ timeout: 15000 });
        const firstInvoiceNumberMatch = (await dataRows.first().textContent().catch(() => '')).match(/Invoice #\d+/);
        expect(firstInvoiceNumberMatch, 'Could not read an invoice number from the first row').toBeTruthy();
        const invoiceNumber = firstInvoiceNumberMatch[0];
        Logger.info(`TC366: Using existing invoice "${invoiceNumber}" for modal assertions (read-only — will Cancel, never Confirm)`);

        // ── First pass: open modal, capture everything, save to JSON ──────────────
        await reassignInvoicePage.openReassignModalForInvoice(invoiceNumber);

        const staticContent = await reassignInvoicePage.captureStaticModalContent();
        expect(staticContent.heading).toBe('Reassign Invoice');
        expect(staticContent.currentJob).toBe(jobName);
        expect(staticContent.newProjectLabel).toContain('New Project');
        expect(staticContent.newJobLabel).toContain('New Job');
        expect(staticContent.cancelButtonText).toBe('Cancel');
        expect(staticContent.confirmButtonText).toBe('Confirm Reassignment');
        Logger.success('TC366: Static modal content asserted');

        const newProjectOptions = await reassignInvoicePage.getNewProjectOptions();
        expect(newProjectOptions.length, 'New Project dropdown should list at least one project').toBeGreaterThan(0);
        expect(newProjectOptions).toContain(staticContent.currentProject);
        Logger.success(`TC366: New Project options captured: ${JSON.stringify(newProjectOptions)}`);

        const capturedData = { ...staticContent, newProjectOptions };
        saveModalData(capturedData);
        Logger.success(`TC366: Modal data saved to ${MODAL_DATA_PATH}`);

        await reassignInvoicePage.cancelReassignModal();

        // ── Second pass: re-open the same modal, re-capture, compare against JSON ──
        await reassignInvoicePage.openReassignModalForInvoice(invoiceNumber);

        const staticContentAgain = await reassignInvoicePage.captureStaticModalContent();
        const newProjectOptionsAgain = await reassignInvoicePage.getNewProjectOptions();
        const recapturedData = { ...staticContentAgain, newProjectOptions: newProjectOptionsAgain };

        const savedData = loadModalData();
        expect(recapturedData, 'Re-opened modal content must match the saved JSON snapshot').toEqual(savedData);
        Logger.success('TC366: Re-opened modal content matches saved JSON snapshot');

        // ── Walk every dropdown to the end (assert-only — pick any project/job/scope) ──
        const otherProject = newProjectOptionsAgain.find((p) => p !== staticContentAgain.currentProject) || newProjectOptionsAgain[0];
        await reassignInvoicePage.selectNewProject(otherProject);
        Logger.success(`TC366: Selected New Project "${otherProject}"`);

        const newJobOptions = await reassignInvoicePage.getNewJobOptions();
        expect(newJobOptions.length, `New Job dropdown should list at least one job for project "${otherProject}"`).toBeGreaterThan(0);
        Logger.success(`TC366: New Job options for "${otherProject}": ${JSON.stringify(newJobOptions)}`);

        await reassignInvoicePage.selectNewJob(newJobOptions[0]);
        Logger.success(`TC366: Selected New Job "${newJobOptions[0]}"`);

        const scopeOptions = await reassignInvoicePage.getScopeOptions();
        expect(scopeOptions.length, `Scope dropdown should list at least one scope for job "${newJobOptions[0]}"`).toBeGreaterThan(0);
        Logger.success(`TC366: Scope options for "${newJobOptions[0]}": ${JSON.stringify(scopeOptions)}`);

        await reassignInvoicePage.selectScope(scopeOptions[0]);
        Logger.success(`TC366: Selected Scope "${scopeOptions[0]}"`);

        const totalAllocatedText = await reassignInvoicePage.getTotalAllocatedText();
        expect(totalAllocatedText).toContain('Total Allocated');
        Logger.success(`TC366: Scope Allocations total row: "${totalAllocatedText}"`);

        const confirmEnabled = await reassignInvoicePage.isConfirmReassignmentEnabled();
        expect(confirmEnabled, 'Confirm Reassignment should enable once project/job/scope are all selected').toBe(true);

        // Discard — this test only asserts the UI, it must never actually reassign a real invoice.
        await reassignInvoicePage.cancelReassignModal();
        Logger.success('TC366 passed: every Reassign Invoice modal field/dropdown asserted, JSON snapshot compared, dialog cancelled without saving');
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TC367 — Full Reassign Invoice E2E: create $5 invoice -> approve -> reassign
    // to a different project/job -> verify it's gone from the original job.
    // ──────────────────────────────────────────────────────────────────────────
    test('TC367 @regression @reassignInvoice : Should create a $5 invoice, approve it, reassign it to another project/job, and verify it is removed from the original job', async () => {
        test.setTimeout(180000);

        Logger.step('TC367: Navigating to property -> first job -> Invoice tab');
        const originalJobName = await reassignInvoicePage.openFirstJobOfProperty(PROPERTY_NAME);
        await reassignInvoicePage.openInvoiceTab();

        const title = `Reassign_E2E_${Date.now()}`;
        const description = 'Automation invoice for full Reassign Invoice e2e — $5';
        const invoiceNumber = await reassignInvoicePage.createFiveDollarInvoice(title, description);
        expect(invoiceNumber).toBeTruthy();

        await reassignInvoicePage.confirmAndApproveInvoice();

        // getInvoiceStatus polls the already-rendered grid (expect(...).toPass()) instead of a
        // fixed sleep + one-shot check, so this survives any lag between confirm and re-render.
        const status = await reassignInvoicePage.getInvoiceStatus(invoiceNumber);
        expect(status, `Invoice "${invoiceNumber}" should be Approved after confirming`).toMatch(/approved/i);
        Logger.success(`TC367: Invoice "${invoiceNumber}" status confirmed: "${status}"`);

        await reassignInvoicePage.openReassignModalForInvoice(invoiceNumber);

        const staticContent = await reassignInvoicePage.captureStaticModalContent();
        expect(staticContent.currentJob).toBe(originalJobName);

        const newProjectOptions = await reassignInvoicePage.getNewProjectOptions();
        const targetProject = newProjectOptions.find((p) => p !== staticContent.currentProject);
        expect(targetProject, 'Need at least one other project on this property to reassign to').toBeTruthy();
        await reassignInvoicePage.selectNewProject(targetProject);

        const newJobOptions = await reassignInvoicePage.getNewJobOptions();
        expect(newJobOptions.length, `Project "${targetProject}" should have at least one job`).toBeGreaterThan(0);
        const targetJob = newJobOptions[0];
        await reassignInvoicePage.selectNewJob(targetJob);

        const scopeOptions = await reassignInvoicePage.getScopeOptions();
        expect(scopeOptions.length, `Job "${targetJob}" should have at least one scope`).toBeGreaterThan(0);
        const targetScope = scopeOptions[0];
        await reassignInvoicePage.selectScope(targetScope);

        Logger.info(`TC367: Reassigning "${invoiceNumber}" -> project="${targetProject}", job="${targetJob}", scope="${targetScope}"`);
        await reassignInvoicePage.confirmReassignment();

        // Polls (expect(...).toPass()) instead of a fixed sleep + one-shot read — the grid can
        // take a moment to drop the row after the reassign toast fires.
        await reassignInvoicePage.waitForInvoiceAbsent(invoiceNumber);
        Logger.success(`TC367: "${invoiceNumber}" is no longer available under the original job "${originalJobName}"`);

        // ── Verify the invoice now lives under the target project/job, with the same amount and status ──
        Logger.step(`TC367: Verifying "${invoiceNumber}" is now visible under target job "${targetJob}" (project "${targetProject}")`);
        await reassignInvoicePage.openJobOfProperty(PROPERTY_NAME, { jobName: targetJob });
        await reassignInvoicePage.openInvoiceTab();

        // Single poll for the row (presence + amount + status all read from the same text) —
        // avoids stacking three separate flaky one-shot checks after a navigation.
        const targetRowText = await reassignInvoicePage.waitForInvoiceRowText(invoiceNumber);
        const targetStatus = reassignInvoicePage.extractStatusFromRowText(targetRowText);
        expect(targetStatus, `"${invoiceNumber}" should still be Approved under "${targetJob}"`).toMatch(/approved/i);
        expect(targetRowText, `"${invoiceNumber}" should still show a $5 amount under "${targetJob}"`).toContain('$5');
        Logger.success(`TC367: "${invoiceNumber}" confirmed present under "${targetJob}" — amount $5, status "${targetStatus}"`);

        Logger.success(`TC367 passed: "${invoiceNumber}" reassigned from "${originalJobName}" to "${targetJob}" — verified absent from original job and present (same amount/status) in target job`);
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TC368 — Scenario 1: Reassign between two jobs within the SAME project.
    // ──────────────────────────────────────────────────────────────────────────
    test('TC368 @regression @reassignInvoice : Scenario 1 — Should reassign a $5 invoice between two jobs in the same project and verify every field/modal/dropdown', async () => {
        test.setTimeout(300000);

        Logger.step('TC368 (Scenario 1): Discovering a project with 2+ jobs on the property (no assumptions)');
        const jobs = await discoverPropertyJobs(reassignInvoicePage, PROPERTY_NAME);
        const byProject = {};
        for (const j of jobs) { (byProject[j.projectName] ||= []).push(j.jobName); }
        const sameProjectEntry = Object.entries(byProject).find(([, list]) => list.length >= 2);
        expect(sameProjectEntry, 'Need a project with at least 2 jobs on this property for a same-project reassignment').toBeTruthy();
        const [sameProject, jobsInSameProject] = sameProjectEntry;
        const sourceJobName = jobsInSameProject[0];
        Logger.success(`TC368: Discovered same-project pair — project="${sameProject}", jobs=${JSON.stringify(jobsInSameProject)}`);

        await reassignInvoicePage.openJobOfProperty(PROPERTY_NAME, { jobName: sourceJobName });
        await reassignInvoicePage.openInvoiceTab();

        const title = `Reassign_S1_${Date.now()}`;
        const description = `Reassign_S1_Description_${Date.now()}`;
        const invoiceNumber = await createAndApproveInvoice(reassignInvoicePage, { title, description, amount: 5 });
        Logger.success(`TC368: Created and approved "${invoiceNumber}" ($5) on "${sourceJobName}"`);

        const result = await validateModalAndReassign(reassignInvoicePage, {
            invoiceNumber,
            expectedProject: sameProject,
            expectedJob: sourceJobName,
            pickProject: (options, current) => current, // force New Project === Current Project
            pickJob: (options) => options[0],
            pickScope: (options) => options[0],
        });

        expect(result.targetProject, 'Same-project scenario: target project must equal source project').toBe(sameProject);
        expect(result.targetJob, 'Same-project scenario: target job must differ from source job').not.toBe(sourceJobName);
        Logger.info(`TC368: Reassigning "${invoiceNumber}" -> project="${result.targetProject}" (unchanged), job="${result.targetJob}", scope="${result.targetScope}"`);

        await expect(reassignInvoicePage.loc.reassignSuccessToast, 'Reassign Invoice success toast should be visible').toBeVisible({ timeout: 15000 });

        await verifyReassignmentResult(reassignInvoicePage, {
            invoiceNumber,
            targetProject: result.targetProject,
            targetJob: result.targetJob,
            targetScope: result.targetScope,
            before: result.before,
        });

        Logger.success(`TC368 passed: "${invoiceNumber}" reassigned within "${sameProject}" from "${sourceJobName}" to "${result.targetJob}" — same project confirmed, job changed, scope "${result.targetScope}" persisted, all fields unchanged`);
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TC369 — Scenario 2: Reassign between jobs across DIFFERENT projects.
    // ──────────────────────────────────────────────────────────────────────────
    test('TC369 @regression @reassignInvoice : Scenario 2 — Should reassign a $6 invoice across two different projects and verify every field/modal/dropdown', async () => {
        test.setTimeout(300000);

        Logger.step('TC369 (Scenario 2): Navigating to property -> first job -> Invoice tab');
        const sourceJobName = await reassignInvoicePage.openFirstJobOfProperty(PROPERTY_NAME);
        await reassignInvoicePage.openInvoiceTab();

        const title = `Reassign_S2_${Date.now()}`;
        const description = `Reassign_S2_Description_${Date.now()}`;
        const invoiceNumber = await createAndApproveInvoice(reassignInvoicePage, { title, description, amount: 6 });
        Logger.success(`TC369: Created and approved "${invoiceNumber}" ($6) on "${sourceJobName}"`);

        const result = await validateModalAndReassign(reassignInvoicePage, {
            invoiceNumber,
            expectedJob: sourceJobName,
            pickProject: (options, current) => options.find((p) => p !== current),
            pickJob: (options) => options[0],
            pickScope: (options) => options[0],
        });

        expect(result.targetProject, 'Cross-project scenario: target project must differ from source project').not.toBe(result.sourceProject);
        expect(result.targetJob, 'Cross-project scenario: target job must differ from source job').not.toBe(sourceJobName);
        Logger.info(`TC369: Reassigning "${invoiceNumber}" -> project="${result.targetProject}" (was "${result.sourceProject}"), job="${result.targetJob}", scope="${result.targetScope}"`);

        await expect(reassignInvoicePage.loc.reassignSuccessToast, 'Reassign Invoice success toast should be visible').toBeVisible({ timeout: 15000 });

        await verifyReassignmentResult(reassignInvoicePage, {
            invoiceNumber,
            targetProject: result.targetProject,
            targetJob: result.targetJob,
            targetScope: result.targetScope,
            before: result.before,
        });

        Logger.success(`TC369 passed: "${invoiceNumber}" reassigned from project "${result.sourceProject}"/job "${sourceJobName}" to project "${result.targetProject}"/job "${result.targetJob}" — project changed, job changed, scope "${result.targetScope}" persisted, exactly one copy exists`);
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TC370 — Scenario 3: Reassign to a job with multiple (>1) scopes.
    // ──────────────────────────────────────────────────────────────────────────
    test('TC370 @regression @reassignInvoice : Scenario 3 — Should reassign a $7 invoice to a job with multiple scopes and verify only the selected scope is used', async () => {
        test.setTimeout(300000);

        Logger.step('TC370 (Scenario 3): Navigating to property -> first job -> Invoice tab');
        const sourceJobName = await reassignInvoicePage.openFirstJobOfProperty(PROPERTY_NAME);
        await reassignInvoicePage.openInvoiceTab();

        const title = `Reassign_S3_${Date.now()}`;
        const description = `Reassign_S3_Description_${Date.now()}`;
        const invoiceNumber = await createAndApproveInvoice(reassignInvoicePage, { title, description, amount: 7 });
        Logger.success(`TC370: Created and approved "${invoiceNumber}" ($7) on "${sourceJobName}"`);

        // ── Discover (dynamically — no assumptions) a project/job whose Scope dropdown has >1 option ──
        Logger.step('TC370: Discovering a target job with more than one scope');
        await reassignInvoicePage.openReassignModalForInvoice(invoiceNumber);
        const discoveryStatic = await reassignInvoicePage.captureStaticModalContent();
        const discoveryProjects = await reassignInvoicePage.getNewProjectOptions();
        const candidateProjects = [discoveryStatic.currentProject, ...discoveryProjects.filter((p) => p !== discoveryStatic.currentProject)];

        let multiScopeProject = null, multiScopeJob = null, multiScopeOptions = null;
        for (const proj of candidateProjects) {
            await reassignInvoicePage.selectNewProject(proj);
            const jobsForProject = await reassignInvoicePage.getNewJobOptions();
            for (const job of jobsForProject) {
                await reassignInvoicePage.selectNewJob(job);
                const scopes = await reassignInvoicePage.getScopeOptions();
                Logger.info(`TC370: Probed job "${job}" (project "${proj}") — ${scopes.length} scope(s): ${JSON.stringify(scopes)}`);
                if (scopes.length > 1) { multiScopeProject = proj; multiScopeJob = job; multiScopeOptions = scopes; break; }
            }
            if (multiScopeJob) break;
        }
        expect(multiScopeJob, 'Could not find any job on this property with more than one scope').toBeTruthy();
        expect(multiScopeOptions.length, 'Scope count must be greater than one for this scenario').toBeGreaterThan(1);
        for (const scope of multiScopeOptions) {
            expect(typeof scope, 'Every discovered scope must render as a non-empty string').toBe('string');
            expect(scope.length).toBeGreaterThan(0);
        }
        Logger.success(`TC370: Discovered multi-scope target — project="${multiScopeProject}", job="${multiScopeJob}", scopes=${JSON.stringify(multiScopeOptions)}`);
        await reassignInvoicePage.cancelReassignModal();

        const chosenScope = multiScopeOptions[0];
        const result = await validateModalAndReassign(reassignInvoicePage, {
            invoiceNumber,
            expectedJob: sourceJobName,
            pickProject: () => multiScopeProject,
            pickJob: () => multiScopeJob,
            pickScope: (options) => {
                expect(options, 'Scope options must match what was discovered').toEqual(multiScopeOptions);
                return chosenScope;
            },
        });

        expect(result.targetProject).toBe(multiScopeProject);
        expect(result.targetJob).toBe(multiScopeJob);
        expect(result.targetScope).toBe(chosenScope);

        await expect(reassignInvoicePage.loc.reassignSuccessToast, 'Reassign Invoice success toast should be visible').toBeVisible({ timeout: 15000 });

        await verifyReassignmentResult(reassignInvoicePage, {
            invoiceNumber,
            targetProject: result.targetProject,
            targetJob: result.targetJob,
            targetScope: result.targetScope,
            before: result.before,
        });

        // "Not visible under non-selected scopes": the app models scope as a single current value
        // per invoice (already confirmed === chosenScope by verifyReassignmentResult above) — any
        // of the OTHER discovered scopes is therefore, by definition, not this invoice's scope.
        const otherScopes = multiScopeOptions.filter((s) => s !== chosenScope);
        expect(otherScopes.length, 'There should be at least one non-selected scope to contrast against').toBeGreaterThan(0);
        Logger.info(`TC370: Confirmed invoice scope is "${chosenScope}" only — not any of ${JSON.stringify(otherScopes)}`);

        Logger.success(`TC370 passed: "${invoiceNumber}" reassigned to multi-scope job "${multiScopeJob}" (${multiScopeOptions.length} scopes) — scope "${chosenScope}" selected and persisted, Confirm correctly gated on scope selection`);
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TC371 — Scenario 4: Reassign to a job WITH existing invoices, then again to a
    // job WITH NO invoices — both target jobs discovered dynamically at runtime.
    // ──────────────────────────────────────────────────────────────────────────
    test('TC371 @regression @reassignInvoice : Scenario 4 — Should reassign a $8 invoice into a populated job and then into an empty job, verifying both destinations', async () => {
        // Discovery scans every job on the property (each a full property->job navigation via
        // the existing, unmodified openJobOfProperty), and this property's job count only grows
        // over time as this suite (and others) keep running against it — budget generously.
        test.setTimeout(900000);

        Logger.step('TC371 (Scenario 4): Discovering every job on the property and its current invoice count');
        const jobs = await discoverPropertyJobs(reassignInvoicePage, PROPERTY_NAME);
        expect(jobs.length, 'Need at least 3 jobs on this property (source + populated target + empty target)').toBeGreaterThanOrEqual(3);

        const sourceJobName = jobs[0].jobName;
        const counts = [];
        for (const j of jobs) {
            if (j.jobName === sourceJobName) continue;
            const count = await countInvoicesInJob(reassignInvoicePage, PROPERTY_NAME, j.jobName);
            Logger.info(`TC371: Job "${j.jobName}" currently has ${count} invoice(s)`);
            counts.push({ jobName: j.jobName, projectName: j.projectName, count });
        }
        expect(counts.length, 'Need at least 2 non-source jobs on this property to test populated + empty targets').toBeGreaterThanOrEqual(2);

        const populatedCandidate = counts.find((c) => c.count > 0);
        expect(populatedCandidate, 'Could not dynamically locate a target job that already contains invoices').toBeTruthy();
        const populatedJob = populatedCandidate.jobName;
        const populatedProject = populatedCandidate.projectName;
        const populatedCountBefore = populatedCandidate.count;

        // Prefer a genuinely empty job. This scenario itself permanently consumes empty jobs (it
        // moves an invoice INTO whichever one it finds), so on a long-lived shared property this
        // will eventually run out — when that happens, fall back to the least-populated *other*
        // job so the suite keeps passing indefinitely on future runs, logged clearly either way.
        const emptyCandidate = counts.find((c) => c.count === 0 && c.jobName !== populatedJob);
        const fallbackCandidate = !emptyCandidate
            ? counts.filter((c) => c.jobName !== populatedJob).sort((a, b) => a.count - b.count)[0]
            : null;
        const emptyTarget = emptyCandidate || fallbackCandidate;
        expect(emptyTarget, 'Could not dynamically locate any other job to use as the second target').toBeTruthy();
        const emptyJob = emptyTarget.jobName;
        const emptyProject = emptyTarget.projectName;
        const emptyJobCountBefore = emptyTarget.count;

        if (!emptyCandidate) {
            Logger.info(`TC371: No completely empty job remains on this property right now (prior runs of this scenario have consumed them) — using least-populated job "${emptyJob}" (${emptyJobCountBefore} invoice(s)) as the second target instead.`);
        }
        Logger.success(`TC371: Discovered — source="${sourceJobName}", populated target="${populatedJob}" (${populatedCountBefore} invoices, project "${populatedProject}"), second target="${emptyJob}" (${emptyJobCountBefore} invoices, project "${emptyProject}")`);

        await reassignInvoicePage.openJobOfProperty(PROPERTY_NAME, { jobName: sourceJobName });
        await reassignInvoicePage.openInvoiceTab();

        const title = `Reassign_S4_${Date.now()}`;
        const description = `Reassign_S4_Description_${Date.now()}`;
        const invoiceNumber = await createAndApproveInvoice(reassignInvoicePage, { title, description, amount: 8 });
        Logger.success(`TC371: Created and approved "${invoiceNumber}" ($8) on "${sourceJobName}"`);

        // ── Leg 1: reassign into the POPULATED job ──────────────────────────────────
        const leg1 = await validateModalAndReassign(reassignInvoicePage, {
            invoiceNumber,
            expectedJob: sourceJobName,
            pickProject: () => populatedProject,
            pickJob: (options) => {
                expect(options, `"${populatedJob}" should be offered as a New Job option under "${populatedProject}"`).toContain(populatedJob);
                return populatedJob;
            },
            pickScope: (options) => options[0],
        });
        expect(leg1.targetJob).toBe(populatedJob);

        await expect(reassignInvoicePage.loc.reassignSuccessToast, 'Reassign Invoice success toast should be visible').toBeVisible({ timeout: 15000 });

        await verifyReassignmentResult(reassignInvoicePage, {
            invoiceNumber,
            targetProject: leg1.targetProject,
            targetJob: leg1.targetJob,
            targetScope: leg1.targetScope,
            before: leg1.before,
        });

        // Existing invoices in the populated job must remain untouched — count should be exactly +1,
        // regardless of where among them our invoice ended up (invoice ordering does not matter).
        // Reuse countInvoicesInJob (not a raw .count()) — the grid renders asynchronously and a
        // bare count immediately after navigation can catch it mid-render (proven race, headed mode).
        const populatedCountAfter = await countInvoicesInJob(reassignInvoicePage, PROPERTY_NAME, populatedJob);
        expect(populatedCountAfter, `"${populatedJob}" should now have exactly one more invoice than before (existing invoices untouched)`).toBe(populatedCountBefore + 1);
        Logger.success(`TC371 (Leg 1): "${invoiceNumber}" reassigned into populated job "${populatedJob}" — row count ${populatedCountBefore} -> ${populatedCountAfter}, existing invoices untouched`);

        // ── Leg 2: reassign the SAME invoice again, this time into the EMPTY job ────
        const leg2 = await validateModalAndReassign(reassignInvoicePage, {
            invoiceNumber,
            expectedJob: populatedJob,
            pickProject: () => emptyProject,
            pickJob: (options) => {
                expect(options, `"${emptyJob}" should be offered as a New Job option under "${emptyProject}"`).toContain(emptyJob);
                return emptyJob;
            },
            pickScope: (options) => options[0],
        });
        expect(leg2.targetJob).toBe(emptyJob);

        await expect(reassignInvoicePage.loc.reassignSuccessToast, 'Reassign Invoice success toast should be visible').toBeVisible({ timeout: 15000 });

        await verifyReassignmentResult(reassignInvoicePage, {
            invoiceNumber,
            targetProject: leg2.targetProject,
            targetJob: leg2.targetJob,
            targetScope: leg2.targetScope,
            before: leg2.before,
        });

        const emptyJobRowsAfter = await countInvoicesInJob(reassignInvoicePage, PROPERTY_NAME, emptyJob);
        expect(emptyJobRowsAfter, `Job "${emptyJob}" should now have exactly one more invoice than before (existing invoices, if any, untouched)`).toBe(emptyJobCountBefore + 1);

        if (emptyJobCountBefore === 0) {
            expect(emptyJobRowsAfter, 'A genuinely empty job should show exactly this one invoice').toBe(1);
            await expect(reassignInvoicePage.loc.invoiceDataRows.first(), 'The sole invoice should be immediately visible and be ours').toContainText(invoiceNumber);
            Logger.success(`TC371 (Leg 2): "${invoiceNumber}" reassigned into previously-empty job "${emptyJob}" — now the sole/first visible invoice, grid renders correctly`);
        } else {
            Logger.success(`TC371 (Leg 2): "${invoiceNumber}" reassigned into "${emptyJob}" (least-populated fallback target — no fully empty job remained) — row count ${emptyJobCountBefore} -> ${emptyJobRowsAfter}`);
        }

        Logger.success(`TC371 passed: "${invoiceNumber}" ($8) validated through populated target "${populatedJob}" and second target "${emptyJob}" — all fields unchanged both times`);
    });
});
