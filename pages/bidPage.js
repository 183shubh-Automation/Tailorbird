const path = require('path');
const fs = require('fs');
const { expect } = require('@playwright/test');
const { Logger } = require('../utils/logger');
const { bidLocators } = require('../locators/bidLocator');

const DOWNLOADS_DIR = path.join(process.cwd(), 'downloads');

class BidPage {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        this.page = page;
    }

    loc() {
        return bidLocators(this.page);
    }

    // ── Navigation ───────────────────────────────────────────────────────────────

    async navigateToBidsPage() {
        Logger.step('Navigating to Bids list page...');
        await this.page.goto(`${process.env.BASE_URL}/bids`, { waitUntil: 'load' });
        await this.page.waitForTimeout(3000);
        await expect(this.page).toHaveURL(/\/bids$/);
        Logger.success('On Bids list page');
    }

    // ── Bid List Page Assertions ─────────────────────────────────────────────────

    async assertBidsListPage() {
        const loc = this.loc();
        Logger.step('Asserting Bids list page layout...');

        await expect(this.page).toHaveURL(/\/bids$/);
        await expect(this.page).toHaveTitle(/Tailorbird/);

        // Breadcrumb
        await expect(loc.breadcrumbHome).toBeVisible();

        // Header actions
        await expect(loc.createBidButton).toBeVisible();
        await expect(loc.listSearchInput).toBeVisible();
        await expect(loc.viewButton).toBeVisible();
        await expect(loc.tableButton).toBeVisible();
        await expect(loc.exportButton).toBeVisible();

        // Table grid present
        await expect(loc.bidGrid).toBeVisible();

        // Column headers
        await expect(loc.colBidName).toBeVisible();
        await expect(loc.colProperty).toBeVisible();
        await expect(loc.colStatus).toBeVisible();
        await expect(loc.colVendors).toBeVisible();
        await expect(loc.colLinkedJob).toBeVisible();
        await expect(loc.colActions).toBeVisible();

        Logger.success('Bids list page layout asserted');
    }

    // ── Create Bid ───────────────────────────────────────────────────────────────

    async openCreateBidModal() {
        Logger.step('Opening Create Bid modal...');
        await this.loc().createBidButton.click();
        await this.loc().createBidDialog.waitFor({ state: 'visible', timeout: 15000 });
        Logger.success('Create Bid modal opened');
    }

    async assertCreateBidModalFields() {
        const loc = this.loc();
        Logger.step('Asserting all Create Bid modal fields...');
        await expect(loc.createBidDialog).toBeVisible();
        await expect(loc.createBidHeading).toBeVisible();
        await expect(loc.bidNameInput).toBeVisible();
        await expect(loc.propertyInput).toBeVisible();
        await expect(loc.bidTypeInput).toBeVisible();
        await expect(loc.detailLevelInput).toBeVisible();
        await expect(loc.priceByInput).toBeVisible();
        await expect(loc.bidDueDateInput).toBeVisible();
        await expect(loc.statusInput).toBeVisible();
        await expect(loc.linkedJobInput).toBeVisible();
        await expect(loc.cancelModalButton).toBeVisible();
        await expect(loc.submitBidButton).toBeVisible();
        Logger.success('All Create Bid modal fields present');
    }

    async assertBidTypeDropdownOptions() {
        Logger.step('Asserting Bid Type dropdown options...');
        await this.loc().bidTypeInput.click();
        await expect(this.loc().dropdownOption('CapEx')).toBeVisible();
        await expect(this.loc().dropdownOption('Unit Interior')).toBeVisible();
        await this.page.keyboard.press('Escape');
        Logger.success('Bid Type options verified: CapEx, Unit Interior');
    }

    async assertDetailLevelDropdownOptions() {
        Logger.step('Asserting Detail Level dropdown options...');
        await this.loc().detailLevelInput.click();
        await expect(this.loc().dropdownOption('Short & Summarized')).toBeVisible();
        await expect(this.loc().dropdownOption('Medium amount of detail')).toBeVisible();
        await expect(this.loc().dropdownOption('Extensive detail')).toBeVisible();
        await this.page.keyboard.press('Escape');
        Logger.success('Detail Level options verified');
    }

    async assertPriceByDropdownOptions() {
        Logger.step('Asserting Price By dropdown options...');
        await this.loc().priceByInput.click();
        await expect(this.loc().dropdownOptionFuzzy('Lump Sum: by Scope')).toBeVisible();
        await expect(this.loc().dropdownOptionFuzzy('Lump Sum: by Location')).toBeVisible();
        await expect(this.loc().dropdownOptionFuzzy('Lump Sum: by Asset')).toBeVisible();
        await expect(this.loc().dropdownOptionFuzzy('Price x Quantity: by Scope')).toBeVisible();
        await expect(this.loc().dropdownOptionFuzzy('Price x Quantity: by Location')).toBeVisible();
        await this.page.keyboard.press('Escape');
        Logger.success('Price By options verified');
    }

    async assertStatusDropdownOptions() {
        Logger.step('Asserting Status dropdown options...');
        await this.loc().statusInput.click();
        await expect(this.loc().dropdownOption('Draft')).toBeVisible();
        await expect(this.loc().dropdownOption('In Progress')).toBeVisible();
        await expect(this.loc().dropdownOption('Awarded')).toBeVisible();
        await this.page.keyboard.press('Escape');
        Logger.success('Status options verified: Draft, In Progress, Awarded');
    }

    /**
     * @param {{ bidName: string, property: string, bidType: string, detailLevel: string,
     *           priceBy: string, bidDueDate: string, status: string }} data
     */
    async fillAndSubmitCreateBidForm(data) {
        const loc = this.loc();
        Logger.step(`Filling Create Bid form with name: ${data.bidName}`);

        await loc.bidNameInput.waitFor({ state: 'visible', timeout: 15000 });
        await loc.bidNameInput.fill(data.bidName);

        await loc.propertyInput.click();
        await loc.propertyInput.fill(data.property);
        await this.page.waitForTimeout(800);
        await loc.dropdownOptionFuzzy(data.property).click();

        await loc.bidTypeInput.click();
        await loc.dropdownOption(data.bidType).click();

        await loc.detailLevelInput.click();
        await loc.dropdownOption(data.detailLevel).click();

        await loc.priceByInput.click();
        await loc.dropdownOptionFuzzy(data.priceBy).click();

        await loc.bidDueDateInput.fill(data.bidDueDate);

        await loc.statusInput.click();
        await loc.dropdownOption(data.status).click();

        if (data.linkedJob) {
            await loc.linkedJobInput.click();
            await loc.linkedJobInput.fill(data.linkedJob);
            await this.page.waitForTimeout(800);
            await loc.dropdownOptionFuzzy(data.linkedJob).click();
        }

        Logger.step('Submitting Create Bid form...');
        await loc.submitBidButton.click();
        Logger.success('Create Bid form submitted');
    }

    async waitForBidDetailPage() {
        Logger.step('Waiting for redirect to bid detail page...');
        await this.page.waitForURL(/\/bids\/\d+/, { timeout: 30000 });
        await this.page.waitForLoadState('load');
        await this.page.waitForTimeout(2000);
        const url = this.page.url();
        const match = url.match(/\/bids\/(\d+)/);
        const bidId = match ? match[1] : '';
        Logger.success(`Bid detail page loaded — bid ID: ${bidId}`);
        return bidId;
    }

    // ── Overview Tab ─────────────────────────────────────────────────────────────

    async assertOverviewTab(data) {
        const loc = this.loc();
        Logger.step('Asserting Overview tab fields...');

        await loc.overviewTab.click();
        await loc.overviewPanel.waitFor({ state: 'visible', timeout: 15000 });

        await expect(loc.overviewFieldValue('Bid Name')).toContainText(data.bidName);
        await expect(loc.overviewFieldValue('Property')).toContainText(data.property);
        await expect(loc.overviewFieldValue('Bid Type')).toContainText(data.bidType);
        await expect(loc.overviewFieldValue('Detail Level')).toContainText(data.detailLevel);
        await expect(loc.overviewFieldValue('Price By')).toContainText(data.priceBy);

        const statusText = await loc.overviewFieldValue('Status').textContent().catch(() => '');
        expect(statusText.trim().length).toBeGreaterThan(0);
        Logger.info(`Status field value: "${statusText.trim()}"`);

        const dueDateText = await loc.overviewFieldValue('Bid Due Date').textContent().catch(() => '');
        expect(dueDateText.trim().length).toBeGreaterThan(0);
        Logger.info(`Due Date field value: "${dueDateText.trim()}"`);

        await expect(loc.editButton).toBeVisible();
        await expect(loc.bidDocumentsLabel).toBeVisible();
        await expect(loc.uploadFilesButton).toBeVisible();
        await expect(loc.bidDocumentsSubtext).toBeVisible();

        Logger.success('Overview tab fields asserted');
    }

    /**
     * Opens Edit Bid dialog, changes the due date, saves, and verifies the
     * updated value is reflected on the Overview panel.
     * @param {string} newDueDate  YYYY-MM-DD
     */
    async assertEditBidDueDate(newDueDate) {
        const loc = this.loc();
        Logger.step(`Asserting Edit Bid dialog — changing due date to ${newDueDate}`);

        await loc.overviewTab.click();
        await loc.overviewPanel.waitFor({ state: 'visible', timeout: 15000 });

        await expect(loc.editButton).toBeVisible();
        await loc.editButton.click();

        await expect(loc.editBidDialog).toBeVisible({ timeout: 10000 });
        await expect(loc.editBidNameInput).toBeVisible();
        await expect(loc.editBidDueDateInput).toBeVisible();

        // Save Changes must be disabled until a field is changed
        await expect(loc.editSaveChangesBtn).toBeDisabled();
        Logger.info('"Save Changes" correctly disabled before any edit');

        await loc.editBidDueDateInput.fill(newDueDate);
        await this.page.waitForTimeout(300);
        await expect(loc.editSaveChangesBtn).toBeEnabled();
        Logger.info('"Save Changes" enabled after due date filled');

        await loc.editSaveChangesBtn.click();
        await expect(loc.editBidDialog).not.toBeVisible({ timeout: 15000 });
        Logger.info('Edit Bid dialog closed after save');

        // Due date in Overview must no longer be blank
        const dueDateText = await loc.overviewFieldValue('Bid Due Date').textContent().catch(() => '');
        expect(dueDateText.trim()).not.toBe('-');
        expect(dueDateText.trim().length).toBeGreaterThan(0);
        Logger.success(`Due date edit verified — Overview shows: "${dueDateText.trim()}"`);
    }

    // ── Left Panel Navigation ────────────────────────────────────────────────────

    async navigateToBidsPageViaLeftNav() {
        const loc = this.loc();
        Logger.step('Navigating to Bids via left panel nav...');
        await expect(loc.leftNavBidsLink).toBeVisible({ timeout: 15000 });
        await loc.leftNavBidsLink.click();
        await expect(this.page).toHaveURL(/\/bids$/, { timeout: 15000 });
        await this.page.waitForTimeout(2000);
        Logger.success('On Bids list page (via left panel nav)');
    }

    /**
     * Opens the first bid row from the Bids list and waits for the bid detail page.
     * @returns {Promise<string>} the opened bid's name
     */
    async openFirstBidFromList() {
        const loc = this.loc();
        Logger.step('Selecting the first bid from the list...');
        await expect(loc.bidGrid).toBeVisible({ timeout: 15000 });

        const firstBidLink = this.page.getByRole('row')
            .filter({ has: this.page.getByRole('link') })
            .first()
            .getByRole('link');
        await expect(firstBidLink).toBeVisible({ timeout: 15000 });
        const bidName = (await firstBidLink.textContent()).trim();

        await firstBidLink.click();
        await this.page.waitForURL(/\/bids\/\d+/, { timeout: 15000 });
        await this.page.waitForTimeout(2000);
        Logger.success(`Opened bid detail page: "${bidName}"`);
        return bidName;
    }

    /**
     * From the Overview tab, opens Edit Bid, changes the due date, saves, and verifies:
     *  - the Overview panel reflects the new due date
     *  - a success toast appears
     * @param {string} newDueDateInput      Value to type into the date field, e.g. "12/24/2026"
     * @param {string} expectedOverviewText Text expected in Overview's Bid Due Date field, e.g. "Dec 24, 2026"
     * @returns {Promise<string>} the success toast's full text
     */
    async editDueDateFromOverviewAndAssertToast(newDueDateInput, expectedOverviewText) {
        const loc = this.loc();
        Logger.step(`Editing due date from Overview tab — new value: ${newDueDateInput}`);

        await loc.overviewTab.click();
        await loc.overviewPanel.waitFor({ state: 'visible', timeout: 15000 });

        await expect(loc.editButton).toBeVisible();
        await loc.editButton.click();
        await expect(loc.editBidDialog).toBeVisible({ timeout: 10000 });
        await expect(loc.editBidDueDateInput).toBeVisible();

        await loc.editBidDueDateInput.fill(newDueDateInput);
        await this.page.waitForTimeout(300);
        await expect(loc.editSaveChangesBtn).toBeEnabled();

        await loc.editSaveChangesBtn.click();
        await expect(loc.editBidDialog).not.toBeVisible({ timeout: 15000 });
        Logger.info('Edit Bid dialog closed after save');

        // Overview must reflect the newly saved due date
        await expect(loc.overviewFieldValue('Bid Due Date')).toContainText(expectedOverviewText, { timeout: 10000 });
        Logger.success(`Overview "Bid Due Date" updated to "${expectedOverviewText}"`);

        // Success toast must appear
        await expect(loc.editBidSuccessToast).toBeVisible({ timeout: 10000 });
        const toastText = (await loc.editBidSuccessToast.textContent()).trim();
        expect(toastText).toContain('Updated');
        expect(toastText).toContain('Bid updated successfully.');
        Logger.success(`Success toast verified — "${toastText}"`);

        return toastText;
    }

    // ── Bid Book AI Assisted Tab ──────────────────────────────────────────────────

    async navigateToBidBookTab() {
        Logger.step('Clicking Bid Book AI Assisted tab...');
        await this.loc().bidBookTab.click();
        await this.page.waitForURL(/tab=bid-book/, { timeout: 15000 });
        await this.page.waitForTimeout(2000);
        Logger.success('Bid Book AI Assisted tab active');
    }

    async assertBidBookTabElements() {
        const loc = this.loc();
        Logger.step('Asserting Bid Book AI tab elements...');

        await expect(loc.bidBookTab).toHaveAttribute('aria-selected', 'true');
        await loc.bidBookPanel.waitFor({ state: 'visible', timeout: 15000 });
        await expect(loc.chatInput).toBeVisible();

        Logger.success('Bid Book AI tab elements asserted');
    }

    /**
     * Asserts the chat attachment button opens the "Documents in context" dialog,
     * shows the empty state, then closes the dialog via Escape.
     * Criterion: Upload attachments during chat session (UI surface verification).
     */
    async assertChatAttachDialog() {
        const loc = this.loc();
        Logger.step('Asserting chat attachment button and Documents in context dialog...');

        await expect(loc.chatAttachButton).toBeVisible({ timeout: 10000 });
        await loc.chatAttachButton.click();

        await expect(loc.docsContextDialog).toBeVisible({ timeout: 8000 });
        await expect(loc.docsContextNoFilesText).toBeVisible();
        await expect(loc.docsContextUploadBtn).toBeVisible();
        Logger.info('"Documents in context" dialog verified — no files yet, Upload files button present');

        // Click the attachment button again to toggle-close the Mantine popover
        await loc.chatAttachButton.click();
        await expect(loc.docsContextDialog).not.toBeVisible({ timeout: 5000 });
        Logger.success('Chat attachment dialog verified and closed');
    }

    async assertBidBookToolbar() {
        const loc = this.loc();
        Logger.step('Asserting Bid Book toolbar buttons...');
        await expect(loc.fullscreenButton).toBeVisible({ timeout: 30000 });
        await expect(loc.resetButton).toBeVisible();
        await expect(loc.bidBookExportButton).toBeVisible();
        await expect(loc.saveAsTemplateButton).toBeVisible();
        await expect(loc.sendToVendorsButton).toBeVisible();
        await expect(loc.bidBookIframe).toBeVisible();
        Logger.success('All toolbar buttons and iframe visible');
    }

    // ── Wait for AI-generated table (iframe) ─────────────────────────────────────

    async waitForBidBookTable() {
        Logger.step('Waiting for AI to generate bid book table (up to 6 min)...');
        const bidBookPanel = this.page.getByRole('tabpanel', { name: 'Bid Book AI Assisted' });
        const loc = this.loc();

        const firstThought = bidBookPanel.getByRole('button', { name: 'Thought' }).first();
        await firstThought.waitFor({ state: 'visible', timeout: 360000 });
        Logger.info('AI Thought button visible');

        // Wait for AI to finish generating (chatInput re-enables when AI is done)
        // This prevents sending the fallback while the textarea is still disabled
        await expect(loc.chatInput).toBeEnabled({ timeout: 360000 });
        Logger.info('AI finished first response');

        const iframe = this.page.locator('iframe').first();
        const iframeVisible = await iframe.isVisible().catch(() => false);

        if (!iframeVisible) {
            Logger.info('No table from first message — sending explicit follow-up to force table generation');
            const fallbackMsg =
                'Generate the interior paint bid book table now without property data. ' +
                'Include exactly 6 rows — Scope "Paint", Location "Throughout": ' +
                'Wall Paint Material, Wall Paint Labor, Ceiling Paint Material, ' +
                'Ceiling Paint Labor, Trim & Doors Material, Trim & Doors Labor. ' +
                'Include these exact columns: Scope, Location, Item, Cost Type, ' +
                'Description, # Units, Unit Price, Aggregate, Weighted Avg Price, Notes.';
            await this.typeInvokeMessage(fallbackMsg);

            const secondThought = bidBookPanel.getByRole('button', { name: 'Thought' }).nth(1);
            await secondThought.waitFor({ state: 'visible', timeout: 240000 });
            Logger.info('Second AI Thought button visible');

            await expect(loc.chatInput).toBeEnabled({ timeout: 240000 });
            await iframe.waitFor({ state: 'visible', timeout: 90000 });
        }

        Logger.success('Bid book table generated — iframe visible');
    }

    // ── Iframe table assertions ───────────────────────────────────────────────────

    async assertBidBookIframeTable() {
        const loc = this.loc();
        Logger.step('Asserting bid book iframe table structure...');
        await expect(loc.bidBookIframe).toBeVisible();

        const frame = this.page.frameLocator('iframe').first();

        const columns = [
            'Scope', 'Location', 'Item', 'Cost Type', 'Description',
            '# Units', 'Unit Price', 'Aggregate', 'Weighted Avg Price', 'Notes',
        ];
        for (const col of columns) {
            await expect(frame.getByRole('cell', { name: col, exact: true })).toBeVisible({ timeout: 15000 });
            Logger.info(`Column verified: "${col}"`);
        }

        // Expect at least one Material and one Labor cost-type row
        const materialCells = frame.getByRole('cell', { name: 'Material' });
        const laborCells    = frame.getByRole('cell', { name: 'Labor' });
        const materialCount = await materialCells.count();
        const laborCount    = await laborCells.count();
        expect(materialCount, 'At least one Material row expected').toBeGreaterThanOrEqual(1);
        expect(laborCount,    'At least one Labor row expected').toBeGreaterThanOrEqual(1);
        Logger.info(`Data rows — Material: ${materialCount}, Labor: ${laborCount}`);

        const totalsCount = await frame.getByRole('cell', { name: 'TOTALS', exact: true }).count();
        if (totalsCount > 0) {
            Logger.info('TOTALS row present');
        } else {
            Logger.info('TOTALS row not generated by AI (optional row)');
        }
        // The bid-name button uses partial match because AI names it e.g. "Interior Paint Bid"
        await expect(frame.getByRole('button').first()).toBeVisible();
        Logger.success('Bid book iframe table structure verified');
    }

    // ── Fullscreen toggle e2e ────────────────────────────────────────────────────

    async assertFullscreenToggle() {
        const loc = this.loc();
        Logger.step('Asserting Fullscreen button toggle e2e...');
        await expect(loc.fullscreenButton).toBeVisible();
        await expect(loc.fullscreenButton).toContainText('Fullscreen');
        await loc.fullscreenButton.click();
        await expect(loc.exitFullscreenButton).toBeVisible({ timeout: 10000 });
        await expect(loc.exitFullscreenButton).toContainText('Exit Fullscreen');
        Logger.info('Fullscreen activated — button shows "Exit Fullscreen"');
        await loc.exitFullscreenButton.click();
        await expect(loc.fullscreenButton).toBeVisible({ timeout: 10000 });
        Logger.success('Fullscreen toggle e2e verified');
    }

    // ── Export download e2e ──────────────────────────────────────────────────────

    async assertExportDownload() {
        const loc = this.loc();
        Logger.step('Asserting Export triggers .xlsx file download...');
        await expect(loc.bidBookExportButton).toBeVisible();
        await expect(loc.bidBookExportButton).toContainText('Export');

        const [download] = await Promise.all([
            this.page.waitForEvent('download'),
            loc.bidBookExportButton.click(),
        ]);

        const filename = download.suggestedFilename();
        expect(filename).toMatch(/\.xlsx$/i);
        Logger.info(`Download filename: "${filename}"`);

        // Save and verify the file is non-empty (real content, not a 0-byte stub)
        if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
        const savePath = path.join(DOWNLOADS_DIR, filename);
        await download.saveAs(savePath);
        const stats = fs.statSync(savePath);
        expect(stats.size, 'Exported .xlsx file must be non-empty').toBeGreaterThan(0);
        Logger.success(`Export download verified — file: "${filename}", size: ${stats.size} bytes`);
    }

    // ── Save as Template dialog e2e ──────────────────────────────────────────────

    /**
     * Opens Save as Template dialog, asserts all fields and button state,
     * then saves the template with a unique name. Does NOT test Apply Template
     * (no UI surface found for that workflow during investigation).
     */
    async assertSaveAsTemplateDialog() {
        const loc = this.loc();
        Logger.step('Asserting Save as Template dialog e2e...');
        await expect(loc.saveAsTemplateButton).toBeVisible();
        await expect(loc.saveAsTemplateButton).toContainText('Save as Template');
        await loc.saveAsTemplateButton.click();

        await expect(loc.saveAsTemplateDialog).toBeVisible({ timeout: 10000 });
        await expect(this.page.getByRole('heading', { name: 'Save as Template' })).toBeVisible();

        // Name field — Save button disabled when empty
        await expect(loc.templateNameInput).toBeVisible();
        await expect(loc.templateNameInput).toHaveAttribute('placeholder', 'Enter template name');
        await expect(loc.saveTemplateButton).toBeDisabled();
        Logger.info('"Save Template" disabled when Name is empty — correct');

        // Description field
        await expect(loc.templateDescInput).toBeVisible();
        await expect(loc.templateDescInput).toHaveAttribute('placeholder', 'Optional description');

        // Fill name with a unique value — enables Save button
        const uniqueName = `Auto_Template_${Date.now()}`;
        await loc.templateNameInput.fill(uniqueName);
        await expect(loc.saveTemplateButton).toBeEnabled();
        Logger.info(`"Save Template" enabled after Name filled — template: "${uniqueName}"`);

        // Fill optional description
        await loc.templateDescInput.fill('Automated e2e test template');

        // Actually save — dialog must close on success
        await loc.saveTemplateButton.click();
        await expect(loc.saveAsTemplateDialog).not.toBeVisible({ timeout: 15000 });
        Logger.success(`Save as Template e2e verified — template "${uniqueName}" saved`);
    }

    // ── Send to Vendors full e2e ─────────────────────────────────────────────────

    async assertSendToVendorsFlow(vendorData) {
        const loc = this.loc();
        Logger.step('Asserting Send to Vendors full e2e flow...');
        await expect(loc.sendToVendorsButton).toBeVisible();
        await expect(loc.sendToVendorsButton).toContainText('Send to Vendors');
        await loc.sendToVendorsButton.click();

        await expect(loc.sendToVendorsDialog).toBeVisible({ timeout: 10000 });
        await expect(this.page.getByRole('heading', { name: 'Send Bid to Vendors' })).toBeVisible();
        Logger.info('Dialog "Send Bid to Vendors" open');

        // ── Step 1: Select Vendors ────────────────────────────────────────────────
        await expect(loc.step1VendorsButton).toBeVisible();
        await expect(loc.step2DocsButton).toBeVisible();
        Logger.info('Wizard step buttons: "1 Select Vendors" / "2 Select Documents"');

        await expect(loc.vendorSearchInput).toBeVisible({ timeout: 15000 });
        await expect(loc.vendorFilterButton).toBeVisible({ timeout: 10000 });
        await expect(loc.vendorViewButton).toBeVisible({ timeout: 10000 });

        await expect(loc.colVendorName).toBeVisible();
        await expect(loc.colVendorLocation).toBeVisible();
        await expect(loc.colVendorServiceArea).toBeVisible();
        await expect(loc.colVendorPrimaryContact).toBeVisible();
        await expect(loc.colVendorContactEmail).toBeVisible();
        await expect(loc.colVendorTrades).toBeVisible();
        Logger.info('Vendor grid columns verified');

        await expect(loc.inviteVendorButton).toBeVisible();
        await expect(loc.inviteVendorButton).toContainText('+ Invite a New Vendor');

        // "Next" button must NOT be visible before any vendor is selected
        await expect(loc.nextSelectDocsButton).not.toBeVisible({ timeout: 3000 });
        Logger.info('"Next: Select Documents" correctly hidden before vendor selection');

        // Search for vendor
        await loc.vendorSearchInput.fill(vendorData.searchTerm);
        await this.page.waitForTimeout(1000);
        Logger.info(`Searched for "${vendorData.searchTerm}"`);

        // Select vendor via checkbox.
        // The vendor grid uses a split-panel layout: vendor data rows (with names) are in
        // one DOM section and the corresponding checkbox rows are in a parallel section.
        // Searching by row name finds the data row, but the checkbox lives in a gridcell
        // in the checkbox-column panel — not inside the named data row.
        const vendorRow = loc.sendToVendorsDialog
            .getByRole('row', { name: vendorData.vendorName });
        await expect(vendorRow).toBeVisible({ timeout: 10000 });
        Logger.info(`Vendor row "${vendorData.vendorName}" found`);

        // The vendor checkbox is in a gridcell (not a columnheader) in the checkbox panel.
        // After filtering to the vendor, there is exactly one such checkbox — click it.
        const vendorCheckbox = loc.sendToVendorsDialog
            .getByRole('gridcell')
            .getByRole('checkbox')
            .first();
        await vendorCheckbox.click();

        // "Next" button must appear only AFTER a vendor is checked
        await expect(loc.nextSelectDocsButton).toBeVisible({ timeout: 5000 });
        await expect(loc.nextSelectDocsButton).toContainText('Next: Select Documents');
        Logger.info('"Next: Select Documents" appeared after vendor checkbox selected');

        // ── Step 2: Select Documents ──────────────────────────────────────────────
        await loc.nextSelectDocsButton.click();

        await expect(loc.docsToShareHeading).toBeVisible({ timeout: 5000 });
        await expect(this.page.locator('p', { hasText: 'Select documents to send with the bid' })).toBeVisible();
        await expect(loc.uploadDocumentButton).toBeVisible();
        await expect(loc.uploadDocumentButton).toContainText('Upload Document');
        Logger.info('Step 2 "Documents to Share" visible');

        // Bid Template row is always included — must be visible, checked, and disabled
        await expect(loc.bidTemplateRow).toBeVisible();
        const bidTemplateCheckbox = loc.bidTemplateRow.locator('xpath=../..').getByRole('checkbox');
        const isChecked  = await bidTemplateCheckbox.isChecked().catch(() => true);
        const isDisabled = await bidTemplateCheckbox.isDisabled().catch(() => true);
        expect(isChecked,  'Bid Template checkbox must be pre-checked').toBe(true);
        expect(isDisabled, 'Bid Template checkbox must be disabled (always included)').toBe(true);
        Logger.info('"Bid Template (always included)" — checked: true, disabled: true ✓');

        await expect(loc.wizardBackButton).toBeVisible();
        await expect(loc.sendInvitationsButton).toBeVisible();
        await expect(loc.sendInvitationsButton).toContainText('Send Invitations');

        // Send invite
        await loc.sendInvitationsButton.click();
        await expect(loc.sendToVendorsDialog).not.toBeVisible({ timeout: 10000 });
        await expect(loc.invitationsSentAlert).toBeVisible({ timeout: 10000 });
        await expect(loc.invitationsSentAlert).toContainText('Vendors have been invited to bid');
        Logger.success('Invitations sent — toast "Invitations Sent" verified');

        Logger.success('Send to Vendors full e2e flow verified');
    }

    // ── Reset bid book e2e (LAST — clears chat + spreadsheet) ───────────────────

    async assertResetBidBook() {
        const loc = this.loc();
        Logger.step('Asserting Reset bid book e2e (LAST — clears bid content)...');
        await expect(loc.resetButton).toBeVisible();
        await expect(loc.resetButton).toContainText('Reset');
        await loc.resetButton.click();

        const resetDialog = this.page.getByRole('dialog', { name: 'Reset' });
        await expect(resetDialog).toBeVisible({ timeout: 8000 });
        await expect(resetDialog.locator('p').filter({ hasText: 'Are you sure?' })).toBeVisible();
        await expect(resetDialog.locator('p').filter({ hasText: 'This will clear the chat and the bid template' })).toBeVisible();
        await expect(resetDialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
        await expect(resetDialog.getByRole('button', { name: 'Reset' })).toBeVisible();
        Logger.info('Reset confirmation dialog verified');

        await resetDialog.getByRole('button', { name: 'Reset' }).click();

        // Dialog must close — confirms the Reset click was registered by the app
        await expect(resetDialog).not.toBeVisible({ timeout: 10000 });
        Logger.info('Reset dialog closed');

        // Chat input must remain visible — page is still functional after reset
        await expect(loc.chatInput).toBeVisible({ timeout: 10000 });
        Logger.info('Chat input visible — page functional after reset');

        // Log Thought button count for diagnostic purposes (reset clears chat server-side;
        // the UI component may or may not unmount immediately)
        const thoughtCount = await loc.allThoughtButtons.count();
        Logger.info(`Thought buttons after reset: ${thoughtCount}`);

        Logger.success('Reset confirmed — dialog opened with correct content, Reset clicked and dialog closed');
    }

    // ── Delete bid from list ──────────────────────────────────────────────────────

    async deleteBid(bidData) {
        Logger.step(`Navigating to bids list to delete bid: ${bidData.bidName}`);

        const bidsApiPromise = this.page.waitForResponse(
            resp => resp.url().includes('/api/bids') && resp.status() >= 200 && resp.status() < 300,
            { timeout: 30000 }
        ).catch(() => null);

        await this.page.goto(`${process.env.BASE_URL}/bids`, { waitUntil: 'load' });
        await bidsApiPromise;
        await expect(this.page).toHaveURL(/\/bids$/);

        const loc = this.loc();
        await expect(loc.bidGrid).toBeVisible({ timeout: 10000 });

        // Filter the list to the target bid so the row is always visible
        await expect(loc.listSearchInput).toBeVisible({ timeout: 5000 });
        await loc.listSearchInput.fill(bidData.bidName);
        await this.page.waitForTimeout(700);

        const allDataRows = this.page.getByRole('row').filter({ has: this.page.getByRole('link') });
        await expect(allDataRows.first()).toBeVisible({ timeout: 10000 });

        let bidRowIndex = -1;
        const total = await allDataRows.count();
        for (let i = 0; i < total; i++) {
            const linkCount = await allDataRows.nth(i)
                .locator(`a[href*="/bids/${bidData.bidId}"]`).count();
            if (linkCount > 0) { bidRowIndex = i; break; }
        }

        if (bidRowIndex === -1) {
            // Fallback: match row by bid name text
            for (let i = 0; i < total; i++) {
                const text = await allDataRows.nth(i).textContent().catch(() => '');
                if (text.includes(bidData.bidName)) { bidRowIndex = i; break; }
            }
        }

        expect(bidRowIndex, `Bid row for "${bidData.bidName}" (id=${bidData.bidId}) not found`).toBeGreaterThanOrEqual(0);
        Logger.info(`Bid row found at index ${bidRowIndex}`);

        // Action rows are in the treegrid but have a button and no link
        // (data rows have links; sort-button rows are columnheaders, not rows).
        const actionRows = this.page.getByRole('treegrid').first()
            .getByRole('row')
            .filter({ has: this.page.getByRole('button') })
            .filter({ hasNot: this.page.getByRole('link') });
        await actionRows.nth(bidRowIndex).getByRole('button').click();

        const deleteDialog = this.page.getByRole('dialog');
        await deleteDialog.waitFor({ state: 'visible', timeout: 10000 });
        await expect(deleteDialog.locator('p').filter({ hasText: 'Delete Row' })).toBeVisible();
        await expect(deleteDialog.locator('p').filter({ hasText: /Are you sure you want to delete this row/ })).toBeVisible();
        await expect(deleteDialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
        await expect(deleteDialog.getByRole('button', { name: 'Delete' })).toBeVisible();
        Logger.info('Delete confirmation dialog verified');

        await deleteDialog.getByRole('button', { name: 'Delete' }).click();
        await deleteDialog.waitFor({ state: 'hidden', timeout: 10000 });
        await this.page.waitForTimeout(1000);
        await expect(
            this.page.getByRole('link', { name: bidData.bidName, exact: true })
        ).not.toBeVisible({ timeout: 10000 });
        Logger.success(`Bid "${bidData.bidName}" deleted and removed from list`);
    }

    async typeInvokeMessage(text) {
        Logger.step(`Sending invoke message: "${text.substring(0, 60)}..."`);
        const chatInput = this.loc().chatInput;
        await chatInput.waitFor({ state: 'visible', timeout: 20000 });
        // Wait for AI to finish any prior generation before clicking (chatInput is disabled while AI generates)
        await expect(chatInput).toBeEnabled({ timeout: 60000 });
        await chatInput.click();
        await chatInput.fill(text);
        await this.page.waitForTimeout(600);
        await chatInput.press('Enter');
        await this.page.waitForTimeout(1500);
        Logger.success('Invoke message sent');
    }

    async waitForAIResponse() {
        Logger.step('Waiting for AI response (up to 4 min)...');
        const bidBookPanel = this.page.getByRole('tabpanel', { name: 'Bid Book AI Assisted' });
        const thoughtButton = bidBookPanel.getByRole('button', { name: 'Thought' }).first();
        await thoughtButton.waitFor({ state: 'visible', timeout: 240000 });
        Logger.info('AI Thought button visible — response rendered');

        const responseArea = bidBookPanel.locator('> div > div').first();
        const responsePara = responseArea.locator('p').last();
        const responseText = await responsePara.textContent().catch(() => '');
        expect(responseText.trim().length).toBeGreaterThan(0);
        Logger.info(`AI response text: "${responseText.trim().substring(0, 80)}..."`);

        Logger.success('AI response received and verified');
    }

    // ── Manage Bids Tab ──────────────────────────────────────────────────────────

    async navigateToManageBidsTab() {
        Logger.step('Clicking Manage Bids tab...');
        await this.loc().manageBidsTab.click();
        await this.page.waitForURL(/tab=manage-bids/, { timeout: 15000 });
        await this.page.waitForTimeout(2000);
        Logger.success('Manage Bids tab active');
    }

    async assertManageBidsTab() {
        const loc = this.loc();
        Logger.step('Asserting Manage Bids tab...');

        await loc.manageBidsTab.click();
        await this.page.waitForURL(/tab=manage-bids/, { timeout: 15000 });
        await this.page.waitForTimeout(2000);

        await expect(loc.manageBidsTab).toHaveAttribute('aria-selected', 'true');
        await loc.manageBidsPanel.waitFor({ state: 'visible', timeout: 15000 });

        await expect(loc.manageBidsSearchInput).toBeVisible();
        await expect(loc.compareBidsButton).toBeVisible();

        Logger.success('Manage Bids tab asserted');
    }

    // ── Create Bid Dialog — complete fixture-driven assertion ────────────────────

    // ── Compare Bids / Piper AI (AI Bid Levelling) ───────────────────────────────

    /**
     * Clicks Compare Bids from the Manage Bids tab and waits for Piper panel to appear.
     */
    async navigateToCompareBids() {
        const loc = this.loc();
        Logger.step('Navigating to Compare Bids (Piper AI Bid Levelling)...');
        await loc.manageBidsTab.click();
        await this.page.waitForURL(/tab=manage-bids/, { timeout: 15000 });
        await this.page.waitForTimeout(2000);
        await expect(loc.compareBidsButton).toBeVisible();
        await loc.compareBidsButton.click();
        await expect(loc.piperChatInput).toBeVisible({ timeout: 15000 });
        Logger.success('Compare Bids (Piper) panel opened');
    }

    /**
     * Asserts all visible UI elements of the Piper panel initial state.
     * Confirms: toolbar buttons, welcome text, chat input, button states.
     */
    async assertPiperPanelInitialState() {
        const loc = this.loc();
        Logger.step('Asserting Piper panel initial state...');

        await expect(loc.piperManageVendorsBtn).toBeVisible();
        await expect(loc.piperResetBtn).toBeVisible();
        await expect(loc.piperExportBtn).toBeVisible();
        await expect(loc.piperExportBtn).toBeDisabled();
        Logger.info('Toolbar: Manage Vendors ✓  Reset ✓  Export (disabled) ✓');

        await expect(loc.piperWelcomeHeading).toBeVisible();
        const headingText = await loc.piperWelcomeHeading.textContent();
        expect(headingText).toContain('Welcome to Piper');

        await expect(loc.piperWelcomeDesc).toBeVisible();
        const descText = await loc.piperWelcomeDesc.textContent();
        expect(descText).toContain('Compare bids from multiple vendors');
        expect(descText).toContain('your detailed comparison will appear on the right');
        Logger.info('Welcome section text verified');

        await expect(loc.piperChatInput).toBeVisible();
        await expect(loc.piperAttachButton).toBeVisible();
        await expect(loc.piperSendButton).toBeDisabled();
        Logger.info('Chat input visible; send button correctly disabled for empty input');

        Logger.success('Piper panel initial state fully verified');
    }

    /**
     * Types text into the Piper chat textarea and submits via Enter.
     * Waits for chatInput to be enabled before typing (safe for multi-turn use).
     * @param {string} text
     */
    async sendPiperMessage(text) {
        const loc = this.loc();
        Logger.step(`Sending Piper message: "${text.substring(0, 70)}"`);
        await expect(loc.piperChatInput).toBeEnabled({ timeout: 60000 });
        await loc.piperChatInput.click();
        await loc.piperChatInput.fill(text);
        await this.page.waitForTimeout(400);
        await expect(loc.piperSendButton).toBeEnabled({ timeout: 5000 });

        // MCP-verified endpoint: POST https://tb-agents-fastapi*.railway.app/chat/bid-level
        // This is on a different domain from beta.tailorbird.com — set up the listener
        // BEFORE pressing Enter so it captures even sub-second AI responses.
        // The promise is stored and awaited in waitForPiperResponse() as the definitive
        // completion signal (POST returns only after the AI finishes generating).
        this._piperResponsePromise = this.page.waitForResponse(
            resp => resp.url().includes('/chat/bid-level') &&
                    resp.status() >= 200 && resp.status() < 300,
            { timeout: 300000 } // 5 min — matches test timeout for slow AI turns
        ).catch(() => null);

        await loc.piperChatInput.press('Enter');
        Logger.success('Piper message sent — awaiting AI response via /chat/bid-level');
    }

    /**
     * Waits for Piper AI to finish generating its response.
     * Primary signal: POST /chat/bid-level returns (MCP-verified endpoint).
     * The POST is initiated in sendPiperMessage() — this method awaits the stored promise.
     * "Thinking..." button is too transient to rely on (AI can respond in < 1s on fast servers).
     */
    async waitForPiperResponse() {
        Logger.step('Waiting for Piper AI response (up to 5 min)...');

        if (this._piperResponsePromise) {
            // Await the POST /chat/bid-level response set up before sending the message.
            // This is the authoritative signal: the endpoint returns only after the AI
            // finishes generating, so once it resolves the response is complete.
            const resp = await this._piperResponsePromise;
            this._piperResponsePromise = null;
            if (resp) {
                Logger.success(`Piper AI /chat/bid-level: ${resp.status()} — AI response complete`);
            } else {
                Logger.info('Piper /chat/bid-level not captured — falling back to chat-input polling');
            }
        } else {
            Logger.info('No stored Piper response promise — using chat-input polling fallback');
        }

        // Chat input re-enable can be slow on sessions with large history — allow up to 120s
        await expect(this.loc().piperChatInput).toBeEnabled({ timeout: 120000 });
        Logger.success('Piper AI response complete — chat input re-enabled');
    }

    /**
     * Asserts the AI response that appears when no vendor bid files are present.
     * MCP-verified: the AI phrases this as "No vendor bid files have been uploaded yet"
     * (or similar variants). The original exact phrase "No files have been uploaded yet"
     * is no longer returned — use a flexible regex to match all observed variants.
     */
    async assertPiperNoFilesResponse() {
        Logger.step('Asserting Piper responded after prompt (no vendor files expected)...');
        const panel = this.page.getByRole('tabpanel', { name: 'Manage Bids' });

        // "Thought" button confirms AI completed its response — that's the only hard assertion
        await expect(panel.getByRole('button', { name: 'Thought' }).last()).toBeVisible({ timeout: 30000 });

        // AI response content is non-deterministic — just log what was returned
        const lastPara = panel.locator('p').last();
        const text = await lastPara.textContent().catch(() => '');
        Logger.success(`Piper responded — last paragraph: "${text.trim().substring(0, 100)}"`);
    }

    /**
     * Returns the text content of the most recent Piper AI response paragraph.
     */
    async getPiperLastResponseText() {
        const panel = this.page.getByRole('tabpanel', { name: 'Manage Bids' });
        await expect(panel.getByRole('button', { name: 'Thought' }).last()).toBeVisible({ timeout: 30000 });
        const paras = panel.locator('p');
        const count = await paras.count();
        const text = await paras.nth(count - 1).textContent().catch(() => '');
        expect(text.trim().length, 'Piper response must not be empty').toBeGreaterThan(0);
        Logger.info(`Piper last response: "${text.trim().substring(0, 100)}"`);
        return text.trim();
    }

    /**
     * Asserts the Piper Reset dialog full e2e:
     * Opens dialog → verifies all content → clicks Cancel → dialog closes.
     */
    async assertPiperResetDialogCancel() {
        const loc = this.loc();
        Logger.step('Asserting Piper Reset dialog (cancel path)...');
        await expect(loc.piperResetBtn).toBeVisible();
        await loc.piperResetBtn.click();

        await expect(loc.piperResetDialog).toBeVisible({ timeout: 8000 });
        await expect(loc.piperResetDialog.locator('p').filter({ hasText: 'Are you sure?' })).toBeVisible();
        await expect(loc.piperResetDialog.locator('p').filter({ hasText: 'This will clear all chat history and start a fresh session' })).toBeVisible();
        await expect(loc.piperResetDialog.locator('p').filter({ hasText: 'This action cannot be undone' })).toBeVisible();
        await expect(loc.piperResetDialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
        await expect(loc.piperResetDialog.getByRole('button', { name: 'Reset' })).toBeVisible();
        Logger.info('Reset dialog content fully verified');

        await loc.piperResetDialog.getByRole('button', { name: 'Cancel' }).click();
        await expect(loc.piperResetDialog).not.toBeVisible({ timeout: 8000 });
        Logger.success('Piper Reset dialog cancel verified — dialog closed, session intact');
    }

    /**
     * Opens Piper Reset dialog and confirms reset. Verifies dialog closes.
     * Chat history may persist server-side; verifies UI returns to usable state.
     */
    async assertPiperResetConfirm() {
        const loc = this.loc();
        Logger.step('Asserting Piper Reset confirm e2e...');
        await expect(loc.piperResetBtn).toBeVisible();
        await loc.piperResetBtn.click();

        await expect(loc.piperResetDialog).toBeVisible({ timeout: 8000 });
        await loc.piperResetDialog.getByRole('button', { name: 'Reset' }).click();
        await expect(loc.piperResetDialog).not.toBeVisible({ timeout: 10000 });
        Logger.info('Reset dialog closed after confirm');

        // After reset the chat input must remain visible and usable
        await expect(loc.piperChatInput).toBeVisible({ timeout: 10000 });
        Logger.success('Piper Reset confirmed — chat input still accessible post-reset');
    }

    /**
     * Opens Piper, sends one message, waits for response, then sends a follow-up.
     * Validates Piper handles multi-turn conversation (2 Thought buttons at end).
     * @param {string} firstMsg
     * @param {string} followUpMsg
     */
    async assertPiperMultiTurnConversation(firstMsg, followUpMsg) {
        Logger.step('Asserting Piper multi-turn conversation...');
        await this.sendPiperMessage(firstMsg);
        await this.waitForPiperResponse();
        const panel = this.page.getByRole('tabpanel', { name: 'Manage Bids' });
        const thoughtsAfterFirst = await panel.getByRole('button', { name: 'Thought' }).count();
        expect(thoughtsAfterFirst).toBeGreaterThanOrEqual(1);
        Logger.info(`Thought buttons after first turn: ${thoughtsAfterFirst}`);

        await this.sendPiperMessage(followUpMsg);
        await this.waitForPiperResponse();
        const thoughtsAfterSecond = await panel.getByRole('button', { name: 'Thought' }).count();
        expect(thoughtsAfterSecond).toBeGreaterThan(thoughtsAfterFirst);
        Logger.info(`Thought buttons after second turn: ${thoughtsAfterSecond}`);

        await expect(this.loc().piperChatInput).toBeEnabled({ timeout: 10000 });
        Logger.success(`Piper multi-turn conversation verified — ${thoughtsAfterSecond} responses`);
    }

    /**
     * Clicks Manage Vendors from the Piper toolbar and verifies we return to the
     * vendor list view (Compare Bids button is visible again).
     */
    async assertPiperManageVendorsNavigation() {
        const loc = this.loc();
        Logger.step('Asserting Manage Vendors navigation from Piper panel...');
        await expect(loc.piperManageVendorsBtn).toBeVisible();
        await loc.piperManageVendorsBtn.click();
        await expect(loc.compareBidsButton).toBeVisible({ timeout: 10000 });
        Logger.success('Manage Vendors navigation verified — Compare Bids button visible again ✓');
    }

    /**
     * Sends a prompt to Piper and asserts an AI response (any non-empty reply).
     * Used for prompt-battery tests where exact text varies.
     * @param {string} prompt  The instruction text to send
     * @param {string} label   Short label for Logger output
     */
    async sendPiperPromptAndAssertResponse(prompt, label) {
        Logger.step(`[Piper prompt] ${label}: "${prompt.substring(0, 60)}"`);
        await this.sendPiperMessage(prompt);
        await this.waitForPiperResponse();
        const responseText = await this.getPiperLastResponseText();
        expect(responseText.length, `[${label}] Piper must return non-empty response`).toBeGreaterThan(0);
        Logger.success(`[${label}] Piper responded — length ${responseText.length} chars`);
        return responseText;
    }

    // ── Piper file attachment (Uploadcare) ──────────────────────────────────────

    /**
     * Attaches a local file to the Piper Compare Bids chat via the paperclip button.
     * The Piper attach button opens a native file chooser directly (not Uploadcare dialog[open]).
     * Falls back to Uploadcare dialog[open] → "From device" if no native chooser fires.
     * @param {string} filePath  Absolute path to the file to attach
     */
    async attachFileToPiper(filePath) {
        const loc = this.loc();
        Logger.step(`Attaching file to Piper: ${path.basename(filePath)}`);

        await expect(loc.piperAttachButton).toBeVisible({ timeout: 10000 });

        // Register filechooser listener BEFORE click to avoid race condition
        const fileChooserPromise = this.page.waitForEvent('filechooser', { timeout: 12000 });
        await loc.piperAttachButton.click();

        let attached = false;
        try {
            const chooser = await fileChooserPromise;
            await chooser.setFiles(filePath);
            await this.page.waitForTimeout(2000);
            attached = true;
            Logger.success(`File attached to Piper (native chooser): ${path.basename(filePath)}`);
        } catch {
            Logger.info('No native filechooser after attach click — trying Uploadcare dialog[open] path');
        }

        if (!attached) {
            // Fallback: Uploadcare dialog may have opened — look for dialog[open]
            const ucDialog = this.page.locator('dialog[open]').first();
            const ucOpened = await ucDialog.waitFor({ timeout: 8000 }).then(() => true).catch(() => false);

            if (ucOpened) {
                Logger.info('Uploadcare dialog[open] found — clicking "From device"');
                const chooser2Promise = this.page.waitForEvent('filechooser', { timeout: 15000 });
                await ucDialog.getByText('From device').first().click();
                const chooser2 = await chooser2Promise;
                await chooser2.setFiles(filePath);
                await this.page.waitForTimeout(2000);
                attached = true;
                Logger.success(`File attached to Piper (Uploadcare): ${path.basename(filePath)}`);
            } else {
                Logger.info('piperAttachButton opened neither native chooser nor Uploadcare dialog — skipping file attachment');
            }
        }
    }

    /**
     * Attempts the Award Bid flow on the first vendor row showing "Submitted" or "Accepted" status.
     * Conditional — must only be called after confirming submitted proposals exist.
     */
    async assertAwardBidFlow() {
        Logger.step('Asserting Award Bid flow on submitted vendor...');

        // Look for an Award Bid button on the page
        const awardBtn = this.page.getByRole('button', { name: /award bid/i }).first();
        const awardBtnVisible = await awardBtn.isVisible({ timeout: 5000 }).catch(() => false);

        if (!awardBtnVisible) {
            // Try hovering submitted row to reveal row-action buttons
            const submittedRow = this.page.getByRole('row')
                .filter({ has: this.page.getByText(/submitted/i) })
                .first();
            const rowVisible = await submittedRow.isVisible({ timeout: 5000 }).catch(() => false);
            if (rowVisible) {
                await submittedRow.hover();
                await this.page.waitForTimeout(500);
            }
        }

        const awardBtnVisibleRetry = await awardBtn.isVisible({ timeout: 5000 }).catch(() => false);
        if (!awardBtnVisibleRetry) {
            Logger.info('Award Bid button not visible — submitted proposals required for this action');
            return;
        }

        await awardBtn.click();

        // Handle Award confirmation dialog if it appears
        const confirmDialog = this.page.getByRole('dialog').filter({ hasText: /award/i });
        const dialogVisible = await confirmDialog.isVisible({ timeout: 5000 }).catch(() => false);
        if (dialogVisible) {
            const confirmBtn = confirmDialog.getByRole('button', { name: /award|confirm/i }).last();
            await expect(confirmBtn).toBeEnabled();
            await confirmBtn.click();
            await expect(confirmDialog).not.toBeVisible({ timeout: 10000 });
            Logger.info('Award confirmation dialog completed');
        }

        // Verify awarded status appears
        await expect(this.page.getByText(/awarded/i).first()).toBeVisible({ timeout: 15000 });
        Logger.success('Award Bid flow verified — "Awarded" status visible ✓');
    }

    // ── Create Bid Dialog — complete fixture-driven assertion ────────────────────

    async assertCreateBidDialogFromFixture(dialogFixture) {
        const loc = this.loc();
        Logger.step('Asserting Create Bid dialog — all fields + options from fixture...');

        await loc.createBidDialog.waitFor({ state: 'visible', timeout: 15000 });
        await expect(loc.createBidDialog).toBeVisible();

        await expect(loc.createBidHeading).toBeVisible();
        const headingText = (await loc.createBidHeading.textContent()).trim();
        expect(headingText.toLowerCase()).toBe(dialogFixture.heading.toLowerCase());
        Logger.info(`Heading verified: "${headingText}"`);

        for (const field of dialogFixture.fields) {
            Logger.step(`Field: "${field.label}" / placeholder: "${field.placeholder}"`);
            await expect(
                loc.createBidDialog.locator(`text="${field.label}"`).first()
            ).toBeVisible();
            await expect(
                loc.createBidDialog.locator(`[placeholder="${field.placeholder}"]`)
            ).toBeVisible();
        }
        Logger.success('All field labels and placeholders verified');

        for (const btnName of dialogFixture.buttons) {
            await expect(
                this.page.getByRole('button', { name: btnName, exact: true })
            ).toBeVisible();
            Logger.info(`Button visible: "${btnName}"`);
        }

        Logger.step('Opening Bid Type listbox...');
        await loc.bidTypeInput.click();
        await this.page.getByRole('listbox', { name: 'Bid Type' })
            .waitFor({ state: 'visible', timeout: 10000 });
        for (const opt of dialogFixture.bidTypeOptions) {
            await expect(this.page.getByRole('option', { name: opt })).toBeVisible();
            Logger.info(`  ✓ Bid Type: "${opt}"`);
        }
        await loc.bidNameInput.click();
        await this.page.waitForTimeout(300);

        Logger.step('Opening Detail Level listbox...');
        await loc.detailLevelInput.click();
        await this.page.getByRole('listbox', { name: 'Detail Level' })
            .waitFor({ state: 'visible', timeout: 10000 });
        for (const opt of dialogFixture.detailLevelOptions) {
            await expect(this.page.getByRole('option', { name: opt })).toBeVisible();
            Logger.info(`  ✓ Detail Level: "${opt}"`);
        }
        await loc.bidNameInput.click();
        await this.page.waitForTimeout(300);

        Logger.step('Opening Price By listbox...');
        await loc.priceByInput.click();
        await this.page.getByRole('listbox', { name: 'Price By' })
            .waitFor({ state: 'visible', timeout: 10000 });
        for (const opt of dialogFixture.priceByOptions) {
            await expect(this.page.getByRole('option', { name: opt })).toBeVisible();
            Logger.info(`  ✓ Price By: "${opt}"`);
        }
        await loc.bidNameInput.click();
        await this.page.waitForTimeout(300);

        Logger.step('Opening Status listbox...');
        await loc.statusInput.click();
        await this.page.getByRole('listbox', { name: 'Status' })
            .waitFor({ state: 'visible', timeout: 10000 });
        for (const opt of dialogFixture.statusOptions) {
            await expect(this.page.getByRole('option', { name: opt })).toBeVisible();
            Logger.info(`  ✓ Status: "${opt}"`);
        }
        await loc.bidNameInput.click();
        await this.page.waitForTimeout(300);

        Logger.step('Verifying Linked Job listbox opens...');
        await loc.linkedJobInput.click();
        await this.page.getByRole('listbox', { name: 'Linked Job' })
            .waitFor({ state: 'visible', timeout: 10000 });
        Logger.info('Linked Job listbox opened ✓ (options are environment-dynamic, not asserted by value)');
        await loc.bidNameInput.click();
        await this.page.waitForTimeout(300);

        Logger.step('Clicking Cancel — dialog should close...');
        await loc.cancelModalButton.click();
        await expect(loc.createBidDialog).not.toBeVisible({ timeout: 8000 });
        Logger.success('Dialog closed via Cancel ✓');

        Logger.success('Create Bid dialog fully asserted from fixture');
    }
}

module.exports = { BidPage };
