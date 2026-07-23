const { expect } = require('@playwright/test');
const { simpleApprovalLocators } = require('../locators/simpleApprovalLocator');
const { Logger } = require('../utils/logger');

class SimpleApprovalPage {
    constructor(page) {
        this.page = page;
        this.loc = simpleApprovalLocators(page);
    }

    async navigateToApprovalTab() {
        await this.loc.approvalTab.click();
        await this.page.waitForTimeout(20000);
        await this.page.waitForTimeout(1000);
    }

    async waitForPageLoad() {
        await this.page.waitForTimeout(30000);
        await this.page.waitForTimeout(1500);
    }

    async waitForApprovalApiWithData() {
        // This endpoint's body has been measured at ~32MB in this org (accumulated test
        // data). Reading a body that large through Playwright/CDP (response.json()/body(),
        // which round-trips the full base64-encoded payload over the DevTools protocol
        // channel) fails deterministically — confirmed live: 3/3 retries on the same
        // already-landed response all threw. A page-side fetch() for the identical URL,
        // using the page's own session cookies, has no such limit and returns the same
        // JSON the SPA itself is displaying — so read it that way instead.
        //
        // The API's own 200 response lands quickly but the underlying data can take ~20s
        // to actually populate server-side — so the first response is expected to come
        // back without populated options. Wait at least 20s before checking, then if still
        // empty, re-fetch (a genuinely new response, not a re-read of the same one) up to
        // two more times at 5s intervals.
        const fetchApprovalData = () => this.page.evaluate(async () => {
            const res = await fetch('/api/bird-table?table_name=approval&filter_by_current_user=true', {
                credentials: 'include',
            });
            if (!res.ok) return null;
            try {
                return await res.json();
            } catch {
                return null;
            }
        });

        const hasPopulatedOptions = (body) =>
            body?.columns?.some(column =>
                Array.isArray(column.options) &&
                column.options.length > 0 &&
                column.options.every(option => option?.id && option?.label)
            );

        let body = await fetchApprovalData();

        if (!hasPopulatedOptions(body)) {
            Logger.info('Approval API received, but options are still empty. Waiting 20s before re-checking...');
            await this.page.waitForTimeout(20000);
            body = await fetchApprovalData();
        }

        for (let attempt = 0; attempt < 2 && !hasPopulatedOptions(body); attempt++) {
            Logger.info(`Approval API options still empty. Retrying in 5s (attempt ${attempt + 1}/2)...`);
            await this.page.waitForTimeout(5000);
            body = await fetchApprovalData();
        }

        if (!hasPopulatedOptions(body)) {
            throw new Error('Approval API never returned populated options within timeout.');
        }

        Logger.success('Approval API loaded with populated options.');
        return body;
    }

    async navigateToMyApprovalsTab() {
        const approvalPromise = this.waitForApprovalApiWithData();

        await this.loc.myApprovalsTab.click();
        await this.page.waitForURL('**/approvals/my-approvals**');
        await expect(this.loc.myApprovalsTab).toHaveAttribute('aria-selected', 'true');

        const body = await approvalPromise;

        Logger.success(`Approval API loaded with ${body.rows?.length || 0} rows.`);
    }

    // async navigateToMyApprovalsTab() {
    //     const approvalDataPromise = this.page.waitForResponse(
    //         resp => resp.url().includes('/api/bird-table') &&
    //                 resp.url().includes('table_name=approval') &&
    //                 resp.url().includes('filter_by_current_user=true') &&
    //                 resp.status() >= 200 && resp.status() < 300,
    //         { timeout: 45000 }
    //     ).catch(() => null);

    //     await this.loc.myApprovalsTab.click();
    //     await this.page.waitForURL('**/approvals/my-approvals**', { timeout: 15000 }).catch(() => {});
    //     await expect(this.loc.myApprovalsTab).toHaveAttribute('aria-selected', 'true', { timeout: 10000 });
    //     // await this.waitForPageLoad();
    //     await this.page.waitForTimeout(13000);

    //     const resp = await approvalDataPromise;
    //     if (resp) {
    //         try {
    //             const body = await resp.json();
    //             if (!body.rows || body.rows.length === 0) {
    //                 Logger.error('bird-table approval API returned empty rows — no approval data present');
    //             } else {
    //                 Logger.success(`bird-table approval API: ${body.rows.length} rows loaded`);
    //             }
    //         } catch {
    //             Logger.info('Could not parse bird-table approval response body');
    //         }
    //     } else {
    //         Logger.info('bird-table approval API response not captured within timeout');
    //     }
    // }

    async navigateToAllApprovalsTab() {
        await this.loc.allApprovalsTab.click();
        await this.page.waitForURL('**/approvals/all-approvals**', { timeout: 15000 }).catch(() => { });
        await expect(this.loc.allApprovalsTab).toHaveAttribute('aria-selected', 'true', { timeout: 10000 });
        await this.waitForPageLoad();
    }

    async searchApprovals(term) {
        await this.loc.searchInput.fill(term, { timeout: 10000 });
        await this.page.waitForTimeout(600);
    }

    async clearSearch() {
        await this.loc.searchInput.clear({ timeout: 10000 });
        await this.page.waitForTimeout(400);
    }

    async getTableRowCount() {
        const count = await this.loc.tableRows.count();
        return Math.max(0, count - 1);
    }

    async getAllTableHeaders() {
        // Wait for the Property Name header to ensure full table is loaded
        const propertyHeader = this.page.locator('[role="columnheader"]', { hasText: 'Property Name' });
        try {
            await propertyHeader.waitFor({ state: 'visible', timeout: 15000 });
        } catch {
            // Fallback: wait for any column header to appear before giving up
            const anyHeader = this.page.locator('[role="columnheader"]').first();
            await anyHeader.waitFor({ state: 'visible', timeout: 10000 }).catch(() => { });
            await this.page.waitForTimeout(5000);
        }
        return await this.loc.columnHeaders.allTextContents();
    }

    async viewApprovalDetails(rowIndex = 0) {
        const viewBtn = this.page.locator('[role="treegrid"] button[title="View Details"]').first();
        try {
            await viewBtn.waitFor({ state: 'visible', timeout: 10000 });
            await viewBtn.click();
            await this.page.waitForTimeout(1000);
            return true;
        } catch {
            return false;
        }
    }

    async isApprovalModalVisible() {
        try {
            const dialog = this.page.getByRole('dialog', { name: 'Approval Details' });
            await dialog.waitFor({ state: 'visible', timeout: 5000 });
            return await dialog.isVisible();
        } catch {
            return false;
        }
    }

    async closeApprovalModal() {
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(400);
        return true;
    }

    async clickFilterButton() {
        await this.loc.filterButton.click();
        await this.page.waitForTimeout(600);
        return true;
    }

    async clickSettingsButton() {
        await this.loc.tableMenuButton.click();
        await expect(this.loc.hideShowColumnsMenuItem).toBeVisible({ timeout: 10000 });
        await this.loc.hideShowColumnsMenuItem.click();
        await expect(this.loc.manageColumnsDrawer).toBeVisible({ timeout: 10000 });
        return true;
    }

    async clickExportButton() {
        await this.loc.exportButton.click();
        await this.page.waitForTimeout(800);
        return true;
    }

    async addColumndata() {
        const colName = `ApprCol_${Date.now()}`;
        await this.loc.tableMenuButton.click();
        await expect(this.loc.addColumnMenuItem).toBeVisible({ timeout: 10000 });
        await this.loc.addColumnMenuItem.click();
        await this.page.waitForTimeout(400);

        const nameInput = this.loc.addColumnNameInput.first();
        await expect(nameInput).toBeVisible({ timeout: 10000 });
        await nameInput.fill(colName);
        const desc = this.loc.addColumnDescInput.first();
        if (await desc.isVisible().catch(() => false)) {
            await desc.fill('Automation custom column');
        }
        await this.loc.addColumnSubmitButton.click();
        await this.page.waitForTimeout(1000);
        return true;
    }

    async closeDialog() {
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(400);
        return true;
    }
}

module.exports = { SimpleApprovalPage };
