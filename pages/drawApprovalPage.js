const { expect } = require('@playwright/test');
const { Logger } = require('../utils/logger');
const { drawApprovalLocators } = require('../locators/drawApprovalLocator');

let approval;

exports.DrawApprovalJob = class DrawApprovalJob {
    constructor(page) {
        this.page = page;
        approval = drawApprovalLocators(page);
    }

    async navigateToApprovalTemplatesTab() {
        Logger.step('Navigating to Approval Templates tab');
        await this.page.goto('/approvals/template', { waitUntil: 'load' });
        await this.page.waitForTimeout(3000);
        await expect(approval.createTemplateButton, 'Create Template button must be visible').toBeVisible({ timeout: 20000 });
        Logger.success('Navigated to Approval Templates tab');
    }

    /**
     * Creates a "Draw" type approval template scoped to one property with a single
     * always-required approver — mirrors approvalPage.js's createBudgetApprovalTemplateForTest
     * pattern, but for the new Draw approval type and exactly one approver.
     */
    async createDrawApprovalTemplateSingleApprover(templateName, propertyName, approverFullName) {
        Logger.step(`Creating Draw approval template "${templateName}" for "${propertyName}" with sole approver "${approverFullName}"`);

        await approval.createTemplateButton.click();
        const dialog = approval.createDialog();
        await expect(dialog, 'Create Approval Template dialog must open').toBeVisible({ timeout: 15000 });

        await approval.templateNameInput().fill(templateName);
        await approval.drawTypeRadio().click();
        await this.page.waitForTimeout(400);
        Logger.success('Template name filled and "Draw" type selected');

        await approval.addPropertiesButton().click();
        await this.page.waitForTimeout(1000);
        await approval.propertySearchInput.fill(propertyName);
        await this.page.waitForTimeout(1200);
        await approval.propertyOptionCheckbox(propertyName).click();
        await approval.closePropertyPickerButton.click();
        await this.page.waitForTimeout(500);
        Logger.success(`Property "${propertyName}" added to template`);

        // Remove approver rows 3 and 2 (in that order, high-to-low) so only row 1 remains.
        await approval.deleteRowButtonInRow(2).click();
        await this.page.waitForTimeout(400);
        await approval.deleteRowButtonInRow(1).click();
        await this.page.waitForTimeout(400);

        const approverInput = approval.approverInputInRow(0);
        await approverInput.click();
        await approverInput.fill(approverFullName.toLowerCase());
        await this.page.waitForTimeout(1000);
        await approval.approverOption(approverFullName).first().click();
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(400);
        Logger.success(`Sole approver "${approverFullName}" added`);

        await approval.alwaysRequiredCheckboxInRow(0).check({ force: true });
        await this.page.waitForTimeout(400);

        await approval.submitTemplateButton().click();
        await this.page.waitForTimeout(2500);

        // The backend allows only one template per (type, property) pair. If a Draw
        // template already exists for this property (e.g. from a prior test run),
        // treat that as already-configured rather than failing.
        const conflictToast = this.page.locator('[role="alert"]').filter({ hasText: /already linked|already exists|duplicate/i });
        if (await conflictToast.isVisible({ timeout: 1500 }).catch(() => false)) {
            const msg = (await conflictToast.textContent().catch(() => '')).trim();
            Logger.info(`Draw approval template already configured for "${propertyName}" — server said: "${msg}". Reusing existing routing.`);
            return { created: false, alreadyConfigured: true };
        }
        Logger.success('Create Template form submitted');

        await approval.templatesListSearchInput.fill(templateName);
        await this.page.waitForTimeout(1200);
        const row = approval.templateRowByName(templateName);
        await expect(row, `Template "${templateName}" must appear in the templates list`).toBeVisible({ timeout: 10000 });
        const rowText = (await row.textContent()).trim();
        expect(rowText, 'Template row must show "Draw" as the template type').toContain('Draw');
        expect(rowText, 'Template row must show the target property').toContain(propertyName);
        expect(rowText, 'Template row must show the sole approver').toContain(approverFullName);

        Logger.success(`Verified Draw approval template "${templateName}": type=Draw, property="${propertyName}", approver="${approverFullName}"`);
        return { created: true, alreadyConfigured: false };
    }

    async navigateToAllApprovalsTab() {
        Logger.step('Navigating to All Approvals tab');
        // This route's grid/search box has been observed to sometimes hydrate in a few
        // seconds and other times take much longer (intermittent, not tied to navigation
        // strategy). One contributing factor: this is normally called seconds after
        // submitting a draw for approval, while backend revalidation from that submission
        // may still be in flight — give that a moment to settle before even attempting the
        // navigation, then retry the direct navigation itself with a generous per-attempt
        // wait rather than failing fast on the first slow load.
        await this.page.waitForTimeout(8000);
        let ready = false;
        for (let attempt = 0; attempt < 3 && !ready; attempt++) {
            await this.page.goto('/approvals/all-approvals', { waitUntil: 'load' });
            ready = await approval.templatesListSearchInput.isVisible({ timeout: 30000 }).catch(() => false);
        }
        await expect(approval.templatesListSearchInput, 'All Approvals search box must be visible').toBeVisible({ timeout: 15000 });
        Logger.success('Navigated to All Approvals tab');
    }

    /**
     * Finds the given draw's row in the All Approvals grid and opens its "Approval Details"
     * dialog. Returns the dialog locator for the caller to inspect/act on.
     *
     * The grid's rows do NOT render the draw's name anywhere (only Property Name, Job,
     * Approval Type, ID, Amount, etc.), and the page's search box does not index draw name
     * either — searching by draw name always yields zero rows. Since the domain only allows
     * one Pending draw submission per property at a time, the row is instead found by
     * property name + type "Draw" + status "Pending Approval" (guaranteed unique), and the
     * exact draw name is verified from the opened dialog's own "Draw Name:" text.
     */
    async openApprovalDetailsForDraw(propertyName, drawName) {
        const row = approval.allApprovalsPendingDrawRowForProperty(propertyName);
        let found = false;
        for (let attempt = 0; attempt < 4 && !found; attempt++) {
            if (attempt > 0) {
                await this.navigateToAllApprovalsTab();
            }
            await approval.templatesListSearchInput.fill(propertyName);
            await this.page.waitForTimeout(2000);
            found = await row.isVisible({ timeout: 8000 }).catch(() => false);
        }
        await expect(row, `All Approvals grid must show a Pending Draw row for property "${propertyName}"`).toBeVisible({ timeout: 5000 });
        await approval.allApprovalsViewDetailsButtonInRow(row).click();
        await expect(approval.approvalDetailsDialog, 'Approval Details dialog must open').toBeVisible({ timeout: 15000 });

        const dialogText = (await approval.approvalDetailsDialog.textContent()).trim();
        expect(dialogText, `Opened Approval Details must be for draw "${drawName}" (raw dialog text: "${dialogText}")`).toContain(drawName);

        Logger.success(`Opened Approval Details for draw "${drawName}" on property "${propertyName}"`);
        return approval.approvalDetailsDialog;
    }

    /**
     * Confirms the CURRENT session's user cannot directly approve this draw: they are not
     * listed as an eligible approver, and no direct "Approve" button is offered to them
     * (only an admin "Approve on Behalf" affordance, which is a distinct override action).
     */
    async assertCurrentUserCannotDirectlyApprove(propertyName, drawName, currentUserFullName) {
        const dialog = await this.openApprovalDetailsForDraw(propertyName, drawName);
        const eligibleText = (await dialog.getByText(/Eligible approvers:/).textContent()).trim();
        expect(eligibleText, `Draw "${drawName}" eligible approvers must NOT include the current session user ("${currentUserFullName}")`)
            .not.toContain(currentUserFullName);

        const hasDirectApprove = await dialog.getByRole('button', { name: 'Approve', exact: true }).isVisible().catch(() => false);
        expect(hasDirectApprove, `Current user ("${currentUserFullName}") must not see a direct "Approve" button for draw "${drawName}"`).toBe(false);

        await this.page.keyboard.press('Escape');
        await expect(dialog, 'Approval Details dialog must close').not.toBeVisible({ timeout: 10000 });

        Logger.success(`Confirmed "${currentUserFullName}" cannot directly approve draw "${drawName}" — ${eligibleText}`);
        return { eligibleText };
    }

    /**
     * Directly approves a draw as the current session's user (expects them to genuinely
     * be the eligible approver — the real "Approve" button, not the admin "on Behalf" one).
     */
    async approveDrawDirectlyByName(propertyName, drawName) {
        const dialog = await this.openApprovalDetailsForDraw(propertyName, drawName);
        const eligibleText = (await dialog.getByText(/Eligible approvers:/).textContent()).trim();

        const approveBtn = dialog.getByRole('button', { name: 'Approve', exact: true });
        await expect(approveBtn, `Direct "Approve" button must be visible for draw "${drawName}" (eligible: "${eligibleText}")`).toBeVisible({ timeout: 10000 });
        await approveBtn.click();
        await this.page.waitForTimeout(2500);

        Logger.success(`Directly approved draw "${drawName}" (${eligibleText})`);
    }
};
