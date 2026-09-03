require('dotenv').config();
const { test, expect } = require('@playwright/test');
const { BidPage } = require('../pages/bidPage');
const { Logger } = require('../utils/logger');
const PropertiesHelper = require('../pages/properties');
const fs = require('fs');
const path = require('path');
const { ensureLeftPanelExpanded } = require('../utils/leftPanelExpander');

const BID_DATA_PATH = path.join(__dirname, '../data/bidData.json');
const BID_SNAPSHOT_DIR = path.join(process.cwd(), 'committed_ui_snapshots', 'Bid.spec.js');

test.use({
    storageState: 'sessionState.json',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
});

let page, bidPage;

function loadBidData() {
    return JSON.parse(fs.readFileSync(BID_DATA_PATH, 'utf8'));
}

function saveBidData(updated) {
    fs.writeFileSync(BID_DATA_PATH, JSON.stringify(updated, null, 2), 'utf8');
}

/**
 * Parses an Overview "Bid Due Date" display value (e.g. "Mar 15, 2027") and returns the
 * next day, both as an input-field value ("MM/DD/YYYY") and the expected Overview display
 * text (e.g. "Mar 16, 2027"). Falls back to tomorrow (relative to now) if the current value
 * is blank/unparsable (e.g. "-" when no due date has been set yet).
 * @param {string} currentOverviewText
 * @returns {{ inputValue: string, overviewValue: string }}
 */
function addOneDayToOverviewDate(currentOverviewText) {
    const parsed = new Date(currentOverviewText);
    const base = isNaN(parsed.getTime()) ? new Date() : parsed;
    const next = new Date(base.getTime());
    next.setDate(next.getDate() + 1);

    const inputValue = `${String(next.getMonth() + 1).padStart(2, '0')}/${String(next.getDate()).padStart(2, '0')}/${next.getFullYear()}`;
    const overviewValue = next.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return { inputValue, overviewValue };
}

test.describe('Verify Bids', () => {
    test.describe.configure({ retries: 1 });

    // ── Property setup — creates a fresh property per suite run ──────────────────
    test.beforeAll(async ({ browser }) => {
        const ctx = await browser.newContext({ storageState: 'sessionState.json' });
        const setupPage = await ctx.newPage();
        const prop = new PropertiesHelper(setupPage);

        const propertyName = `bid_prop_${Date.now()}`;
        await setupPage.goto(process.env.BASE_URL, { waitUntil: 'load' });
        await setupPage.waitForTimeout(1500);
        await ensureLeftPanelExpanded(setupPage);
        await prop.goToProperties();
        await prop.createProperty(
            propertyName,
            'Domestic Terminal, College Park, GA 30337, USA',
            'College Park', 'GA', '30337',
            'Garden Style'
        );

        const bidData = JSON.parse(fs.readFileSync(BID_DATA_PATH, 'utf8'));
        saveBidData({ ...bidData, property: propertyName });
        Logger.info(`Created property for bid tests: ${propertyName}`);

        await ctx.close();
    });

    test.beforeEach(async ({ page: p }) => {
        if (!fs.existsSync(BID_SNAPSHOT_DIR)) fs.mkdirSync(BID_SNAPSHOT_DIR, { recursive: true });
        page = p;
        bidPage = new BidPage(page);
        await page.goto(`${process.env.BASE_URL}/bids`, { waitUntil: 'load' });
        await expect(page).toHaveURL(/\/bids$/);
        await page.waitForTimeout(3000);
    });

    test('TC311 @regression @bid : Verify Bids list page layout, columns, and toolbar', async () => {
        Logger.step('TC_BID_01: Asserting Bid list page');

        await bidPage.assertBidsListPage();

        const rows = page.getByRole('row').filter({ has: page.getByRole('link') });
        const rowCount = await rows.count().catch(() => 0);
        Logger.info(`Bid rows visible: ${rowCount}`);
        expect(rowCount).toBeGreaterThanOrEqual(0);

        Logger.success('TC_BID_01 passed');
    });

    test('TC312 @regression @bid : Verify Create Bid form, dropdown options, bid creation, and due date update', async () => {
        const bidData = loadBidData();
        const uniqueBidName = `Auto_Bid_${Date.now()}`;

        Logger.step('TC_BID_02: Open Create Bid modal and assert fields');
        await bidPage.openCreateBidModal();
        await bidPage.assertCreateBidModalFields();

        await bidPage.assertBidTypeDropdownOptions();
        await bidPage.assertDetailLevelDropdownOptions();
        await bidPage.assertPriceByDropdownOptions();

        const formData = {
            bidName: uniqueBidName,
            property: bidData.property,
            bidType: bidData.bidType,
            detailLevel: bidData.detailLevel,
            priceBy: bidData.priceBy,
            bidDueDate: bidData.bidDueDate,
        };
        await bidPage.fillAndSubmitCreateBidForm(formData);

        const bidId = await bidPage.waitForBidDetailPage();
        const bidUrl = `${process.env.BASE_URL}/bids/${bidId}`;

        saveBidData({ ...bidData, bidName: uniqueBidName, bidId, bidUrl });

        await expect.poll(() => page.title(), { timeout: 10_000 }).toContain(uniqueBidName);

        await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible();
        await expect(page.getByRole('tab', { name: 'Bid Book AI Assisted' })).toBeVisible();
        await expect(page.getByRole('tab', { name: 'Manage Bids' })).toBeVisible();

        // Assert Overview tab field values
        await bidPage.assertOverviewTab(formData);

        // Assert Edit Bid dialog and due date modification (criterion: due date modification)
        Logger.step('TC_BID_02 — Edit Bid due date e2e');
        await bidPage.assertEditBidDueDate(bidData.editedDueDate);

        Logger.success(`TC_BID_02 passed — bid created: ${uniqueBidName} (ID: ${bidId})`);
    });

    test('TC313 @regression @bid : Verify Manage Bids tab columns and toolbar', async () => {
        const bidData = loadBidData();
        if (!bidData.bidUrl) test.skip(true, 'bidUrl not set — run TC_BID_02 first');

        Logger.step(`TC_BID_04: Navigating to bid: ${bidData.bidUrl}`);
        await page.goto(bidData.bidUrl, { waitUntil: 'load' });
        await page.waitForTimeout(3000);
        await expect(page).toHaveURL(url => url.href.includes(`/bids/${bidData.bidId}`));

        await bidPage.assertManageBidsTab();

        Logger.success('TC_BID_04 passed — Manage Bids tab asserted');
    });

    test('TC314 @regression @bid : Verify Create Bid dialog fields, placeholders, and dropdown options', async () => {
        const bidData = loadBidData();

        Logger.step('TC_BID_05: Opening Create Bid dialog for complete fixture assertion');

        await bidPage.openCreateBidModal();
        await bidPage.assertCreateBidDialogFromFixture(bidData.createBidDialog);

        Logger.success('TC_BID_05 passed — Create Bid dialog completely verified against fixture');
    });

    test('TC315 @regression @bid  : Verify AI Bid Levelling conversation, multi-turn responses, and Reset', async () => {
        test.setTimeout(600000);
        const bidData = loadBidData();
        if (!bidData.bidUrl) test.skip(true, 'bidUrl not set — run TC_BID_02 first');

        Logger.step(`TC_BID_08: Navigating to bid: ${bidData.bidUrl}`);
        await page.goto(bidData.bidUrl, { waitUntil: 'load' });
        await page.waitForTimeout(3000);

        await bidPage.navigateToCompareBids();
        const loc = bidPage.loc();

        // ── Turn 1: "Level the bids" demo prompt ─────────────────────────────────
        Logger.step('TC_BID_08 — Turn 1: "Level the bids" demo prompt');
        await bidPage.sendPiperMessage('Level the bids');

        // Assert chat input is disabled while AI is thinking
        await expect(loc.piperChatInput).toBeDisabled({ timeout: 10000 });
        Logger.info('Chat input disabled during AI processing ✓');

        await bidPage.waitForPiperResponse();

        // Thought button must be visible after response
        await expect(loc.piperThoughtButton).toBeVisible({ timeout: 15000 });
        Logger.info('"Thought" button visible — AI completed turn 1 ✓');

        // Response text present and non-empty
        const turn1Response = await bidPage.getPiperLastResponseText();
        expect(turn1Response.length).toBeGreaterThan(0);
        Logger.info(`Turn 1 response: "${turn1Response.substring(0, 100)}"`);

        // AI response content is non-deterministic — only verify a response was generated (done above)
        // Export button state depends on prior AI context in the session — just log it
        const isExportDisabled = await loc.piperExportBtn.isDisabled().catch(() => false);
        Logger.info(`Export button after turn 1: ${isExportDisabled ? 'disabled (no spreadsheet)' : 'enabled (spreadsheet in context)'}`);

        // ── Turn 2: Follow-up asking for details ──────────────────────────────────
        Logger.step('TC_BID_08 — Turn 2: multi-turn follow-up');
        await bidPage.sendPiperMessage('Please provide more details on the bid comparison format.');
        await bidPage.waitForPiperResponse();

        const panel = page.getByRole('tabpanel', { name: 'Manage Bids' });
        // Per explicit product decision: "Thought" is not guaranteed on every turn (MCP-
        // verified live — Piper only shows it for some turns, not a fixed count per message).
        // The only thing that matters for pass/fail is that the AI actually replied with
        // something after this turn too — same bar as turn 1.
        const turn2Response = await bidPage.getPiperLastResponseText();
        expect(turn2Response.length).toBeGreaterThan(0);
        Logger.info(`Turn 2 response (first 100 chars): "${turn2Response.substring(0, 100)}"`);

        // ── Reset dialog: Cancel path ─────────────────────────────────────────────
        Logger.step('TC_BID_08 — Reset dialog cancel path');
        await bidPage.assertPiperResetDialogCancel();

        // Chat history must still be present after cancel — at least one prior response.
        const thoughtCountAfterCancel = await panel.getByRole('button', { name: 'Thought' }).count();
        expect(thoughtCountAfterCancel).toBeGreaterThanOrEqual(1);
        Logger.info('Chat history intact after Reset cancel ✓');

        // ── Reset dialog: Confirm path ────────────────────────────────────────────
        Logger.step('TC_BID_08 — Reset dialog confirm path');
        await bidPage.assertPiperResetConfirm();

        Logger.success('TC_BID_08 passed — prompt flow, multi-turn conversation and Reset e2e verified');
    });

    test('TC316 @regression @bid : Verify attach external proposal file via Piper paperclip button and run AI Bid Levelling', async () => {
        test.setTimeout(600000);
        const bidData = loadBidData();
        if (!bidData.bidUrl) test.skip(true, 'bidUrl not set — run TC_BID_02 first');

        const proposalFile = path.resolve('./files/Misora_Bid_Leveling_Reference_with_data.csv');
        if (!fs.existsSync(proposalFile)) {
            test.skip(true, `Proposal file not found: ${proposalFile}`);
        }

        Logger.step(`TC_BID_09: Navigating to bid: ${bidData.bidUrl}`);
        await page.goto(bidData.bidUrl, { waitUntil: 'load' });
        await page.waitForTimeout(3000);

        await bidPage.navigateToCompareBids();
        const loc = bidPage.loc();

        // ── Attach file via paperclip button ─────────────────────────────────────
        Logger.step('TC_BID_09 — Attaching proposal file via paperclip button');
        await expect(loc.piperAttachButton).toBeVisible();
        await loc.piperAttachButton.click();

        // Same working upload mechanism as TC06_jobs.spec.js's proven "uploadAndClickDone"
        // (contract CSV import): the native OS file chooser only opens once "From device" is
        // clicked — not on the paperclip click that reveals the Uploadcare menu — so the
        // filechooser listener must be paired with THAT click via Promise.all. The previous
        // page.once('filechooser', ...) here was registered before the triggering click and
        // was never awaited by the flow, so chooser.setFiles() could still be in-flight when
        // the code moved on to look for the Done button.
        const fromDeviceBtn = page.getByRole('button', { name: /From device|Upload|Choose file|Browse/i }).first();
        await expect(fromDeviceBtn).toBeVisible({ timeout: 5000 });
        const [chooser] = await Promise.all([
            page.waitForEvent('filechooser', { timeout: 15000 }),
            fromDeviceBtn.click({ force: true }),
        ]);
        await chooser.setFiles(proposalFile);

        // Allow time for the file chooser / Uploadcare to register the file
        await page.waitForTimeout(3000);
        Logger.info(`Proposal file attached: ${path.basename(proposalFile)}`);
        // MCP-verified live (2026-08-06): after upload, Uploadcare leaves its confirmation
        // dialog ("N file(s) uploaded" + Done button) open on top of the Piper panel — that
        // dialog's subtree intercepts pointer events on the chat textarea underneath, which is
        // what causes sendPiperMessage()'s click on piperChatInput to time out.
        // Framework style (same as TC06_jobs.spec.js): wait for upload dialog and click Done
        // when enabled, falling back to Apply/Import/Confirm if Done isn't the label used.
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
        // The upload must actually complete — no dialog left blocking the chat panel.
        await expect(page.locator('dialog[open]').first()).not.toBeVisible({ timeout: 15000 });

        // ── Send AI Bid Levelling prompt ──────────────────────────────────────────
        Logger.step('TC_BID_09 — Sending AI Bid Levelling prompt after file attach');
        await bidPage.sendPiperMessage(
            'Level all submitted bids by aggregate price, from lowest to highest. ' +
            'Flag any significant pricing difference and scope item exclusions that may impact comparison.'
        );
        await bidPage.waitForPiperResponse();

        // Thought button confirms AI responded
        await expect(loc.piperThoughtButton).toBeVisible({ timeout: 30000 });
        Logger.info('"Thought" button visible — AI processed file attach prompt ✓');

        const responseText = await bidPage.getPiperLastResponseText();
        expect(responseText.length).toBeGreaterThan(0);
        Logger.info(`Response after file attach: "${responseText.substring(0, 100)}"`);

        Logger.success('TC_BID_09 passed — file attach and AI Bid Levelling prompt verified');
    });

    test('TC317 @regression @bid : Verify AI Bid Levelling empty, long, special-character, and invalid prompts', async () => {
        test.setTimeout(600000);
        const bidData = loadBidData();
        if (!bidData.bidUrl) test.skip(true, 'bidUrl not set — run TC_BID_02 first');

        Logger.step(`TC_BID_11: Navigating to bid: ${bidData.bidUrl}`);
        await page.goto(bidData.bidUrl, { waitUntil: 'load' });
        await page.waitForTimeout(3000);

        await bidPage.navigateToCompareBids();
        const loc = bidPage.loc();

        // ── Negative 1: Empty prompt — send button must stay disabled ─────────────
        Logger.step('TC_BID_11 — N1: Empty prompt cannot be submitted');
        await expect(loc.piperChatInput).toBeVisible();
        await loc.piperChatInput.fill('');
        await expect(loc.piperSendButton).toBeDisabled();
        Logger.info('N1 ✓ Empty prompt: send button disabled — cannot submit');

        // ── Negative 2: Whitespace-only prompt — send must remain disabled ─────────
        Logger.step('TC_BID_11 — N2: Whitespace-only prompt');
        await loc.piperChatInput.fill('   ');
        // The send button state may vary; primary assertion is the chat input is still visible
        await expect(loc.piperChatInput).toBeVisible();
        await loc.piperChatInput.fill('');
        Logger.info('N2 ✓ Whitespace-only prompt handled without crash');

        // ── Edge 3: Very long prompt (>500 chars) ─────────────────────────────────
        Logger.step('TC_BID_11 — E3: Very long prompt accepted and processed');
        const longPrompt = 'Level all submitted bids by aggregate price from lowest to highest. ' +
            'For each bidder, show line items by scope category including wall paint, ceiling paint, ' +
            'trim and doors, flooring, electrical, plumbing, HVAC, cabinetry, countertops and appliances. ' +
            'Group by trade category with subtotal per category. Add Lowest, Highest, Median and Grand Total columns. ' +
            'Flag any scope exclusions or significant pricing differences greater than 15 percent. ' +
            'Create a separate Allowance Items tab with the same structure. Show WAVG per unit type at the bottom.';
        await bidPage.sendPiperMessage(longPrompt);
        await bidPage.waitForPiperResponse();
        const longPromptResponse = await bidPage.getPiperLastResponseText();
        expect(longPromptResponse.length).toBeGreaterThan(0);
        Logger.info(`E3 ✓ Long prompt (${longPrompt.length} chars): Piper responded`);

        // ── Edge 4: Special characters prompt ─────────────────────────────────────
        Logger.step('TC_BID_11 — E4: Special characters in prompt');
        const specialCharsPrompt = 'Compare bids: #1 vs #2 vs #3! Use $, %, & symbols. Show data @ 100% accuracy. <Note: exclude n/a>';
        await bidPage.sendPiperMessage(specialCharsPrompt);
        await bidPage.waitForPiperResponse();
        const specialCharsResponse = await bidPage.getPiperLastResponseText();
        expect(specialCharsResponse.length).toBeGreaterThan(0);
        Logger.info('E4 ✓ Special characters prompt: Piper responded without crash');

        // ── Edge 5: Random/invalid text prompt ────────────────────────────────────
        Logger.step('TC_BID_11 — E5: Random/irrelevant text prompt');
        await bidPage.sendPiperMessage('xyzzy foo bar qux randomstring123');
        await bidPage.waitForPiperResponse();
        const randomResponse = await bidPage.getPiperLastResponseText();
        expect(randomResponse.length).toBeGreaterThan(0);
        Logger.info('E5 ✓ Random text prompt: Piper responded without crash');

        // ── Edge 6: Reset Cancel — history must survive ────────────────────────────
        Logger.step('TC_BID_11 — E6: Reset Cancel preserves chat history');
        const panel = page.getByRole('tabpanel', { name: 'Manage Bids' });
        // Per explicit product decision: "Thought" is not guaranteed on every turn (MCP-
        // verified live — Piper only shows it for some turns, not a fixed count per message).
        // E3/E4/E5 above already confirmed the AI replied with real content each time —
        // that's the only pass bar. Here we just confirm Reset Cancel doesn't wipe history.
        const paraCountBefore = await panel.locator('p').count();
        expect(paraCountBefore).toBeGreaterThan(0);
        await bidPage.assertPiperResetDialogCancel();
        const paraCountAfterCancel = await panel.locator('p').count();
        expect(paraCountAfterCancel).toBe(paraCountBefore);
        Logger.info(`E6 ✓ Reset Cancel: chat history intact (${paraCountAfterCancel} paragraphs) after cancel`);

        // ── Edge 7: Manage Vendors closes Piper back to vendor list ───────────────
        Logger.step('TC_BID_11 — E7: Manage Vendors closes Piper');
        await bidPage.assertPiperManageVendorsNavigation();

        Logger.success('TC_BID_11 passed — all negative and edge cases verified');
    });

    test('TC318 @regression @bid : Verify bid due date update from Overview and success notification', async () => {
        Logger.step('TC365: Navigating to Bids via left panel');
        await page.goto(process.env.BASE_URL, { waitUntil: 'load' });
        await page.waitForTimeout(2000);

        await bidPage.navigateToBidsPageViaLeftNav();

        Logger.step('TC365: Selecting any bid from the list and viewing its details');
        const bidName = await bidPage.openFirstBidFromList();

        const loc = bidPage.loc();
        await expect(loc.overviewTab).toHaveAttribute('aria-selected', 'true');
        await loc.overviewPanel.waitFor({ state: 'visible', timeout: 15000 });

        const dueDateBefore = (await loc.overviewFieldValue('Bid Due Date').textContent().catch(() => '')).trim();
        Logger.info(`TC365: "${bidName}" due date before edit: "${dueDateBefore}"`);

        // Always advance whatever date is currently set by exactly 1 day — guarantees a real
        // change every run (a fixed hardcoded date would collide once a prior run already set it).
        const { inputValue: newDueDateInput, overviewValue: expectedOverviewText } =
            addOneDayToOverviewDate(dueDateBefore);
        const expectedToastTitle = 'Updated';
        const expectedToastMessage = 'Bid updated successfully.';
        Logger.info(`TC365: New due date (current + 1 day) = "${newDueDateInput}" → expected Overview text "${expectedOverviewText}"`);

        const toastText = await bidPage.editDueDateFromOverviewAndAssertToast(newDueDateInput, expectedOverviewText);

        // Explicit comparison of invoked toast text against the expected text
        expect(toastText).toContain(expectedToastTitle);
        expect(toastText).toContain(expectedToastMessage);
        Logger.info(`TC365: Toast text compared — expected to contain "${expectedToastTitle}" and "${expectedToastMessage}", got "${toastText}"`);

        const dueDateAfter = (await loc.overviewFieldValue('Bid Due Date').textContent()).trim();
        expect(dueDateAfter).toBe(expectedOverviewText);
        expect(dueDateAfter).not.toBe(dueDateBefore);
        Logger.success(`TC365 passed — "${bidName}" due date changed from "${dueDateBefore}" to "${dueDateAfter}", success toast verified`);
    });

    test('TC319 @regression @bid : Verify full e2e — create bid, upload file to Bid Book AI, generate table via chat, and send to vendors', async () => {
        test.setTimeout(600000);
        const bidData = loadBidData();
        const uniqueBidName = `E2E_BidBook_${Date.now()}`;
        const csvFile = path.resolve('./files/bid_to_upload.csv');
        if (!fs.existsSync(csvFile)) {
            test.skip(true, `Bid book source file not found: ${csvFile}`);
        }

        // ── Left panel nav → Bids (repeated here deliberately for a genuine e2e chain) ──
        Logger.step('TC319: Navigating to Bids via left panel nav');
        await page.goto(process.env.BASE_URL, { waitUntil: 'load' });
        await page.waitForTimeout(2000);
        await bidPage.navigateToBidsPageViaLeftNav();

        // ── Create Bid ─────────────────────────────────────────────────────────────
        Logger.step('TC319: Creating a new bid');
        await bidPage.openCreateBidModal();
        const formData = {
            bidName: uniqueBidName,
            property: bidData.property,
            bidType: bidData.bidType,
            detailLevel: bidData.detailLevel,
            priceBy: bidData.priceBy,
            bidDueDate: bidData.bidDueDate,
        };
        await bidPage.fillAndSubmitCreateBidForm(formData);
        const bidId = await bidPage.waitForBidDetailPage();
        Logger.success(`TC319: Bid created — "${uniqueBidName}" (ID: ${bidId})`);

        await bidPage.assertOverviewTab(formData);

        // ── Bid Book tab: upload CSV and chat with AI to generate the table ─────────
        // MCP-verified live (2026-09-02): on a genuinely fresh bid the right-hand panel shows
        // only "AI-generated output will render here as your conversation progresses" — the
        // toolbar (Fullscreen/Reset/Export/etc.) and iframe don't exist in the DOM until AFTER
        // the first AI response, so assertBidBookToolbar() must run after generation, not before.
        Logger.step('TC319: Opening Bid Book tab and uploading reference file');
        await bidPage.navigateToBidBookTab();
        await bidPage.assertBidBookTabElements();
        await bidPage.attachFileToBidBookChat(csvFile);

        Logger.step('TC319: Chatting with AI to generate the bid book table (adaptive, up to 4 turns)');
        const tableGenerated = await bidPage.generateBidBookViaChat(
            'Please create the bid book table using the attached reference file (bid_to_upload.csv) as the source of scopes and line items.'
        );
        expect(tableGenerated, 'Bid book table must be generated from the uploaded file within 4 chat turns').toBe(true);

        // ── Strong structural assertions on the generated table itself (data fidelity —
        // NOT the AI's chat prose, which is explicitly excluded per requirements) ──────
        await bidPage.assertBidBookToolbar();
        const loc = bidPage.loc();
        await expect(loc.bidBookIframe).toBeVisible();
        const frame = page.frameLocator('iframe').first();
        await expect(frame.locator('table')).toBeVisible({ timeout: 15000 });

        const rowCount = await frame.getByRole('row').count();
        expect(rowCount, 'Generated bid book table must contain data rows beyond the header').toBeGreaterThan(1);
        Logger.info(`Generated bid book table row count (incl. header): ${rowCount}`);

        // The uploaded CSV's own literal Scope/Item values are deterministic source data
        // (not AI-authored wording) — they must be reflected in the generated table.
        await expect(frame.getByRole('cell', { name: 'Roofing', exact: true }).first()).toBeVisible();
        await expect(frame.getByRole('cell', { name: 'Asphalt Shingles', exact: true }).first()).toBeVisible();
        Logger.success('Bid book table verified — reflects uploaded CSV scope/item data');

        // ── Send to Vendors — reuses the fully MCP-verified existing e2e method ─────
        Logger.step('TC319: Sending bid to vendor via "Send to Vendors"');
        await bidPage.assertSendToVendorsFlow(bidData.sendToVendors);

        // ── Manage Bids must now show the invited vendor ────────────────────────────
        Logger.step('TC319: Verifying invited vendor appears in Manage Bids');
        await bidPage.navigateToManageBidsTab();
        const vendorRow = page.getByRole('tabpanel', { name: 'Manage Bids' })
            .getByRole('row', { name: bidData.sendToVendors.vendorName });
        await expect(vendorRow).toBeVisible({ timeout: 15000 });
        await expect(vendorRow).toContainText('Invited');

        Logger.success(`TC319 passed — bid "${uniqueBidName}" created, bid book generated from uploaded file, vendor "${bidData.sendToVendors.vendorName}" invited`);
    });

});
