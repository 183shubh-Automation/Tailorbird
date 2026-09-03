const { expect } = require('@playwright/test');
const { Logger } = require('../utils/logger');
const { cmFeeLocators } = require('../locators/cmFeeLocator');

class CMFeePage {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        this.page = page;
    }

    loc() {
        return cmFeeLocators(this.page);
    }

    // ── Open / close ─────────────────────────────────────────────────────────────

    async openCmFeeConfiguration() {
        const loc = this.loc();
        Logger.step('Opening CM Fee Configuration dialog...');
        await expect(loc.cmFeeConfigButton).toBeVisible({ timeout: 15000 });
        await loc.cmFeeConfigButton.click();
        await expect(loc.cmFeeDialog).toBeVisible({ timeout: 15000 });
        Logger.success('CM Fee Configuration dialog opened');
    }

    async closeCmFeeViaCancel() {
        const loc = this.loc();
        Logger.step('Closing CM Fee Configuration dialog via Cancel...');
        await loc.cmFeeCancelButton.click();
        await expect(loc.cmFeeDialog).not.toBeVisible({ timeout: 8000 });
        Logger.success('Dialog closed via Cancel');
    }

    // ── UI assertions ────────────────────────────────────────────────────────────

    async assertDialogUiElements() {
        const loc = this.loc();
        Logger.step('Asserting CM Fee Configuration dialog UI elements...');

        await expect(loc.cmFeeDialog).toBeVisible();
        await expect(loc.cmFeeHeading).toBeVisible();
        await expect(loc.cmFeeHeading).toHaveText('Edit CM Fee Configuration');

        await expect(loc.cmFeeEnabledCheckbox).toBeVisible();

        await expect(loc.cmFeePercentageInput).toBeVisible();
        await expect(loc.cmFeePercentageInput).toHaveAttribute('placeholder', 'Enter cm fee percentage');

        await expect(loc.cmFeeBudgetItemInput).toBeVisible();
        await expect(loc.cmFeeBudgetItemInput).toHaveAttribute('placeholder', 'Select budget item');

        await expect(loc.cmFeeCancelButton).toBeVisible();
        await expect(loc.cmFeeSaveChangesButton).toBeVisible();
        await expect(loc.cmFeeSaveChangesButton).toBeDisabled();

        Logger.success('All CM Fee Configuration dialog UI elements asserted');
    }

    // ── Field interactions ───────────────────────────────────────────────────────

    /**
     * Sets the "CM Fee Enabled" checkbox to the given target state, only clicking
     * if it isn't already in that state (idempotent).
     * @param {boolean} targetChecked
     */
    async setCmFeeEnabled(targetChecked) {
        const loc = this.loc();
        const isChecked = await loc.cmFeeEnabledCheckbox.isChecked();
        if (isChecked !== targetChecked) {
            await loc.cmFeeEnabledCheckbox.click();
        }
        await expect(loc.cmFeeEnabledCheckbox).toBeChecked({ checked: targetChecked });
        Logger.info(`CM Fee Enabled checkbox set to: ${targetChecked}`);
    }

    async isCmFeeEnabled() {
        return this.loc().cmFeeEnabledCheckbox.isChecked();
    }

    async fillPercentage(value) {
        const loc = this.loc();
        await loc.cmFeePercentageInput.click();
        await loc.cmFeePercentageInput.fill(String(value));
        Logger.info(`CM Fee Percentage filled: "${value}"`);
    }

    async getPercentageValue() {
        return this.loc().cmFeePercentageInput.inputValue();
    }

    async selectBudgetItem(name) {
        const loc = this.loc();
        await loc.cmFeeBudgetItemInput.click();
        await expect(loc.cmFeeBudgetItemOption(name)).toBeVisible({ timeout: 10000 });
        await loc.cmFeeBudgetItemOption(name).click();
        Logger.info(`Budget Item selected: "${name}"`);
    }

    async getBudgetItemValue() {
        return this.loc().cmFeeBudgetItemInput.inputValue();
    }

    async isSaveChangesEnabled() {
        return this.loc().cmFeeSaveChangesButton.isEnabled();
    }

    /**
     * Clicks Save Changes and returns the success toast's full text.
     * @returns {Promise<string>}
     */
    async saveChanges() {
        const loc = this.loc();
        Logger.step('Saving CM Fee Configuration changes...');
        await expect(loc.cmFeeSaveChangesButton).toBeEnabled();
        await loc.cmFeeSaveChangesButton.click();
        await expect(loc.cmFeeSuccessToast).toBeVisible({ timeout: 15000 });
        const toastText = (await loc.cmFeeSuccessToast.textContent()).trim();
        Logger.success(`CM Fee Configuration saved — toast: "${toastText}"`);
        return toastText;
    }
}

module.exports = { CMFeePage };
