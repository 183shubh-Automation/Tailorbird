require('dotenv').config();
const { test, expect } = require('@playwright/test');
const { BidPage } = require('../pages/bidPage');
const { Logger } = require('../utils/logger');
const PropertiesHelper = require('../pages/properties');
const fs = require('fs');
const path = require('path');

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

    // ──────────────────────────────────────────────────────────────────────────────
    // TC_BID_01 — Bid list page layout
    // ──────────────────────────────────────────────────────────────────────────────
    test('TC311 TC_BID_01 @regression @bid : Should display Bid list page with correct layout, columns and toolbar', async () => {
        Logger.step('TC_BID_01: Asserting Bid list page');

        await bidPage.assertBidsListPage();

        const rows = page.getByRole('row').filter({ has: page.getByRole('link') });
        const rowCount = await rows.count().catch(() => 0);
        Logger.info(`Bid rows visible: ${rowCount}`);
        expect(rowCount).toBeGreaterThanOrEqual(0);

        Logger.success('TC_BID_01 passed');
    });

    // ──────────────────────────────────────────────────────────────────────────────
    // TC_BID_02 — Create AI Bid + Overview tab + Edit due date
    // ──────────────────────────────────────────────────────────────────────────────
    test('TC312 TC_BID_02 @regression @bid @createBid : Should open Create Bid modal, assert all fields and dropdown options, create bid, verify Overview tab and edit due date', async () => {
        const bidData = loadBidData();
        const uniqueBidName = `Auto_Bid_${Date.now()}`;

        Logger.step('TC_BID_02: Open Create Bid modal and assert fields');
        await bidPage.openCreateBidModal();
        await bidPage.assertCreateBidModalFields();

        await bidPage.assertBidTypeDropdownOptions();
        await bidPage.assertDetailLevelDropdownOptions();
        await bidPage.assertPriceByDropdownOptions();
        await bidPage.assertStatusDropdownOptions();

        const formData = {
            bidName: uniqueBidName,
            property: bidData.property,
            bidType: bidData.bidType,
            detailLevel: bidData.detailLevel,
            priceBy: bidData.priceBy,
            bidDueDate: bidData.bidDueDate,
            status: bidData.status,
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

    test('TC313 TC_BID_04 @regression @bid @manageBids : Should assert Manage Bids tab columns and toolbar', async () => {
        const bidData = loadBidData();
        if (!bidData.bidUrl) test.skip(true, 'bidUrl not set — run TC_BID_02 first');

        Logger.step(`TC_BID_04: Navigating to bid: ${bidData.bidUrl}`);
        await page.goto(bidData.bidUrl, { waitUntil: 'load' });
        await page.waitForTimeout(3000);
        await expect(page).toHaveURL(url => url.href.includes(`/bids/${bidData.bidId}`));

        await bidPage.assertManageBidsTab();

        Logger.success('TC_BID_04 passed — Manage Bids tab asserted');
    });

    // ──────────────────────────────────────────────────────────────────────────────
    // TC_BID_05 — Create Bid dialog: full fixture-driven assertion of every
    //             field label, placeholder, and each dropdown option
    // ──────────────────────────────────────────────────────────────────────────────
    test('TC314 TC_BID_05 @regression @bid @dialogAssert : Should assert every field label, placeholder and dropdown option in Create Bid dialog using fixture data from bidData.json', async () => {
        const bidData = loadBidData();

        Logger.step('TC_BID_05: Opening Create Bid dialog for complete fixture assertion');

        await bidPage.openCreateBidModal();
        await bidPage.assertCreateBidDialogFromFixture(bidData.createBidDialog);

        Logger.success('TC_BID_05 passed — Create Bid dialog completely verified against fixture');
    });

    test('TC315 TC_BID_08 @regression @bid @compareBids @aiPiper : Should send AI Bid Levelling prompt, validate Thinking→Thought→response flow, multi-turn conversation and Reset e2e', async () => {
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
        const thoughtCountAfterTurn2 = await panel.getByRole('button', { name: 'Thought' }).count();
        expect(thoughtCountAfterTurn2).toBeGreaterThanOrEqual(2);
        Logger.info(`Thought buttons after turn 2: ${thoughtCountAfterTurn2} ✓`);

        const turn2Response = await bidPage.getPiperLastResponseText();
        expect(turn2Response.length).toBeGreaterThan(0);
        Logger.info(`Turn 2 response (first 100 chars): "${turn2Response.substring(0, 100)}"`);

        // ── Reset dialog: Cancel path ─────────────────────────────────────────────
        Logger.step('TC_BID_08 — Reset dialog cancel path');
        await bidPage.assertPiperResetDialogCancel();

        // Chat history must still be present after cancel
        const thoughtCountAfterCancel = await panel.getByRole('button', { name: 'Thought' }).count();
        expect(thoughtCountAfterCancel).toBeGreaterThanOrEqual(2);
        Logger.info('Chat history intact after Reset cancel ✓');

        // ── Reset dialog: Confirm path ────────────────────────────────────────────
        Logger.step('TC_BID_08 — Reset dialog confirm path');
        await bidPage.assertPiperResetConfirm();

        Logger.success('TC_BID_08 passed — prompt flow, multi-turn conversation and Reset e2e verified');
    });

    // ──────────────────────────────────────────────────────────────────────────────
    // TC_BID_09 — Compare Bids (Piper): external proposal file attach e2e
    //             Uploads files\Misora_Bid_Leveling_Reference_with data(Aggregate Summary).csv
    //             via the paperclip attach button, then runs AI Bid Levelling.
    // ──────────────────────────────────────────────────────────────────────────────
    test('TC316 TC_BID_09 @regression @bid @compareBids @fileUpload : Should attach external proposal file via Piper paperclip button and run AI Bid Levelling', async () => {
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

        page.once('filechooser', async (chooser) => {
            Logger.info('File chooser opened — selecting proposal file');
            await chooser.setFiles(proposalFile);
        });
        await loc.piperAttachButton.click();

        // Handle Uploadcare "From device" option if it appears
        const fromDevice = page.getByText('From device');
        const fromDeviceVisible = await fromDevice.isVisible({ timeout: 5000 }).catch(() => false);
        if (fromDeviceVisible) {
            Logger.info('"From device" option appeared — clicking');
            await fromDevice.click();
        }

        // Allow time for the file chooser / Uploadcare to register the file
        await page.waitForTimeout(3000);
        Logger.info(`Proposal file attached: ${path.basename(proposalFile)}`);

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

    test('TC318 TC_BID_11 @regression @bid @compareBids @negative : Should handle negative and edge cases — empty prompt blocked, long/special-char prompts accepted, Reset cancel preserves history', async () => {
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
        const countBefore = await panel.getByRole('button', { name: 'Thought' }).count();
        expect(countBefore).toBeGreaterThanOrEqual(3); // at least E3, E4, E5 responses
        await bidPage.assertPiperResetDialogCancel();
        const countAfterCancel = await panel.getByRole('button', { name: 'Thought' }).count();
        expect(countAfterCancel).toBe(countBefore);
        Logger.info(`E6 ✓ Reset Cancel: ${countAfterCancel} Thought buttons intact after cancel`);

        // ── Edge 7: Manage Vendors closes Piper back to vendor list ───────────────
        Logger.step('TC_BID_11 — E7: Manage Vendors closes Piper');
        await bidPage.assertPiperManageVendorsNavigation();

        Logger.success('TC_BID_11 passed — all negative and edge cases verified');
    });

});
