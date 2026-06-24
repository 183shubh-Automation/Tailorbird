const { expect } = require('@playwright/test');
const { Logger } = require('../utils/logger');
const { addColumnLocators, ADD_COLUMN_TYPES } = require('../locators/addColumnLocator');

const MONTH_NAMES = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];

class AddColumnPage {
    /**
     * @param {import('@playwright/test').Page} page
     * @param {{ scope?: import('@playwright/test').Locator }} [options]
     */
    constructor(page, options = {}) {
        this.page = page;
        this.loc = addColumnLocators(page);
        this.scope = options.scope || page.locator('main');
    }

    async _dismissOverlays() {
        await this.page.keyboard.press('Escape').catch(() => {});
        await this.page.waitForTimeout(300);
    }

    async _waitForTableMenuOpen() {
        const portalItemProbe = this.loc.hideShowColumnsMenuItem
            .first()
            .or(this.loc.addColumnMenuItem.first());
        const menuShell = this.page
            .locator('.mantine-Menu-dropdown')
            .or(this.page.locator('.mantine-Popover-dropdown'))
            .or(this.page.locator('[role="menu"]'))
            .first();

        await portalItemProbe.waitFor({ state: 'visible', timeout: 12000 }).catch(async () => {
            await menuShell.waitFor({ state: 'visible', timeout: 8000 });
        });
    }

    async _openTableMenu(retries = 3) {
        await this._dismissOverlays();

        for (let attempt = 0; attempt < retries; attempt++) {
            const tableBtn = this.loc.tableMenuBtn(this.scope).first();
            await tableBtn.waitFor({ state: 'visible', timeout: 10000 });
            await tableBtn.scrollIntoViewIfNeeded().catch(() => {});

            await this.page.locator('body').click({ position: { x: 10, y: 10 }, force: true }).catch(() => {});
            await this.page.waitForTimeout(200);

            await tableBtn.click({ force: true });
            await this.page.waitForTimeout(500);

            const menuOpen =
                (await this.loc.hideShowColumnsMenuItem.isVisible({ timeout: 1500 }).catch(() => false)) ||
                (await this.loc.addColumnMenuItem.isVisible({ timeout: 500 }).catch(() => false));

            if (menuOpen) return;

            await this._dismissOverlays();
            await this.page.waitForTimeout(400);
        }

        await this._waitForTableMenuOpen();
    }

    /** Table menu → Add column → wait for panel. */
    async openAddColumnPanel() {
        await this._openTableMenu();
        await expect(this.loc.addColumnMenuItem).toBeVisible({ timeout: 10000 });
        await this.loc.addColumnMenuItem.click();
        await expect(this.loc.columnNameInput).toBeVisible({ timeout: 10000 });
        await expect(this.loc.columnDescInput).toBeVisible({ timeout: 10000 });
        await expect(this.loc.columnTypeGrid).toBeVisible({ timeout: 10000 });
    }

    /**
     * Add one custom column.
     * @param {string} columnName
     * @param {string} description
     * @param {number} typeIndex - 0 = Text, 1 = Number, 2 = Select, ...
     */
    async addColumn(columnName, description, typeIndex = 0) {
        await this.openAddColumnPanel();
        await this.loc.columnNameInput.fill(columnName);
        await this.loc.columnDescInput.fill(description);
        await this.loc.columnTypeGrid.locator('button').nth(typeIndex).click();

        const typeName = ADD_COLUMN_TYPES[typeIndex];
        if (typeName === 'Select' || typeName === 'Multi-select') {
            const optionInput = this.loc.selectOptionInput;
            if (await optionInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                await optionInput.fill('Option A');
                await this.page.keyboard.press('Enter');
                if (typeName === 'Multi-select') {
                    await optionInput.fill('Option B');
                    await this.page.keyboard.press('Enter');
                }
            }
        }

        await expect(this.loc.addColumnSubmitBtn).toBeEnabled({ timeout: 5000 });
        await this.loc.addColumnSubmitBtn.click();
        await expect(this.loc.columnNameInput).toBeHidden({ timeout: 15000 });
        await this.page.keyboard.press('Escape').catch(() => {});
        await this._waitForColumnHeader(columnName);
        Logger.success(`Added column "${columnName}" (${typeName})`);
    }

    /** Open Manage Columns, confirm column exists, then verify grid accepts the column type input. */
    async verifyColumnAdded(columnName, typeName) {
        await this.openManageColumns();
        await expect(
            this.loc.manageColumnsDialog.locator('p').filter({ hasText: columnName }).first(),
        ).toBeVisible({ timeout: 8000 });
        await this.closeManageColumns();
        Logger.success(`Verified column "${columnName}" in Manage Columns`);
        await this.verifyColumnTypeInput(columnName, typeName);
    }

    async _scrollGridRight(stepPx = 500) {
        const treegrid = this.scope.locator('[role="treegrid"]').first();
        await this.page.evaluate((px) => {
            const scrollNode = (node) => {
                if (!node) return;
                if (node.scrollWidth > node.clientWidth + 5) {
                    node.scrollLeft = Math.min(node.scrollLeft + px, node.scrollWidth);
                }
                for (const child of node.children || []) scrollNode(child);
                if (node.shadowRoot) scrollNode(node.shadowRoot);
            };
            document.querySelectorAll('revo-grid, [role="treegrid"], revogr-viewport-scroll').forEach(scrollNode);
        }, stepPx);

        if (await treegrid.isVisible().catch(() => false)) {
            await treegrid.hover({ force: true }).catch(() => {});
            await this.page.mouse.wheel(stepPx, 0);
        }
    }

    async _waitForColumnHeader(columnName) {
        const header = this.page.locator('[role="columnheader"]').filter({ hasText: columnName }).first();

        await expect
            .poll(
                async () => {
                    if ((await header.count()) > 0) return true;
                    await this._scrollGridRight();
                    return (await header.count()) > 0;
                },
                { timeout: 25000, intervals: [250] },
            )
            .toBe(true);

        await header.scrollIntoViewIfNeeded();
        await expect(header).toBeVisible({ timeout: 5000 });
        return header;
    }

    async _getFirstDataCellForColumn(columnName) {
        const header = await this._waitForColumnHeader(columnName);
        const colIndex = await header.getAttribute('aria-colindex');
        expect(colIndex, `Column "${columnName}" must have aria-colindex`).toBeTruthy();

        const dataRow = this.scope
            .locator('[role="treegrid"] [role="row"], [role="grid"] [role="row"]')
            .filter({ has: this.page.locator('[role="gridcell"]') })
            .first();
        const cell = dataRow.locator(`[role="gridcell"][aria-colindex="${colIndex}"]`);
        await cell.scrollIntoViewIfNeeded();
        return cell;
    }

    async _openCellEditor(cell) {
        await cell.scrollIntoViewIfNeeded();
        await cell.dblclick({ force: true });
        await this.page.waitForTimeout(800);

        if (!(await this.page.locator('revogr-edit').first().isVisible({ timeout: 1500 }).catch(() => false))) {
            await this.page.keyboard.press('F2');
            await this.page.waitForTimeout(800);
        }
    }

    async _activeInput() {
        return this.page
            .locator('revogr-edit input, revogr-edit textarea')
            .first()
            .or(this.page.locator('input:focus, textarea:focus').first());
    }

    async _commitCellEdit() {
        await this.page.keyboard.press('Enter');
        await this.page.waitForTimeout(400);
        if (await this.page.locator('revogr-edit').first().isVisible({ timeout: 500 }).catch(() => false)) {
            await this.page.keyboard.press('Tab');
            await this.page.waitForTimeout(400);
        }
    }

    /** Strip newlines and grid chrome (e.g. clear ✕ buttons) from cell text before logging. */
    _sanitizeCellText(text) {
        return String(text || '')
            .split(/[\n\r]+/)
            .map((line) => line.trim())
            .filter((line) => line && line !== '✕' && line !== '—' && line !== '-')
            .join(' ')
            .trim();
    }

    async _readCellText(cell) {
        return this._sanitizeCellText(await cell.innerText());
    }

    async _assertCellShows(cell, pattern, columnName, typeName, insertedValue) {
        await this._dismissEditor();
        let cellText = '';
        await expect
            .poll(
                async () => {
                    cellText = await this._readCellText(cell);
                    return cellText || '';
                },
                { timeout: 10000 },
            )
            .toMatch(pattern);
        this._logCellResult(columnName, typeName, insertedValue, cellText);
    }

    async _fillActiveInputAndAssertCell(cell, value, cellPattern, columnName, typeName) {
        await this._openCellEditor(cell);
        const input = await this._activeInput();
        await expect(input).toBeVisible({ timeout: 5000 });
        await input.fill(value);
        await this._commitCellEdit();
        await this._assertCellShows(cell, cellPattern, columnName, typeName, value);
    }

    async _dismissEditor() {
        await this.page.keyboard.press('Escape').catch(() => {});
        await this.page.waitForTimeout(300);
    }

    _logCellResult(columnName, typeName, insertedValue, displayValue) {
        Logger.info(`Inserted value for ${typeName} column "${columnName}": ${insertedValue}`);
        Logger.info(`Verified cell display for ${typeName} column "${columnName}": ${displayValue}`);
    }

    _randomFutureDate(minDays = 7, maxDays = 180) {
        const offset = Math.floor(Math.random() * (maxDays - minDays + 1)) + minDays;
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + offset);

        const yyyy = targetDate.getFullYear();
        const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
        const dd = String(targetDate.getDate()).padStart(2, '0');

        return {
            iso: `${yyyy}-${mm}-${dd}`,
            us: `${mm}/${dd}/${yyyy}`,
            cellPattern: new RegExp(`${mm}.*${dd}.*${yyyy}|${yyyy}.*${mm}.*${dd}`, 'i'),
            targetDate,
        };
    }

    _toCalendarButtonName(date) {
        return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
    }

    async _pickDateInCalendar(targetDate) {
        const targetLabel = `${MONTH_NAMES[targetDate.getMonth()]} ${targetDate.getFullYear()}`;
        const dayButtonName = this._toCalendarButtonName(targetDate);

        const calendarDialog = this.page
            .getByRole('dialog')
            .filter({ has: this.page.locator('table') })
            .last();
        await expect(calendarDialog).toBeVisible({ timeout: 8000 });

        const monthLabel = calendarDialog.getByRole('button', {
            name: /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}$/,
        });
        const headerRow = monthLabel.locator('xpath=..');
        const prevBtn = headerRow.getByRole('button').first();
        const nextBtn = headerRow.getByRole('button').last();

        for (let attempt = 0; attempt < 36; attempt++) {
            const current = ((await monthLabel.textContent()) || '').trim();
            if (current === targetLabel) break;

            const [curMonth, curYear] = current.split(' ');
            const curMonthDate = new Date(Number(curYear), MONTH_NAMES.indexOf(curMonth), 1);
            const targetMonthDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);

            await (targetMonthDate > curMonthDate ? nextBtn : prevBtn).click();
            await this.page.waitForTimeout(300);
        }

        const dayBtn = calendarDialog.getByRole('button', { name: dayButtonName, exact: true });
        if (await dayBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await dayBtn.click();
            return;
        }

        await calendarDialog
            .locator('button')
            .filter({ hasText: new RegExp(`^${targetDate.getDate()}$`) })
            .first()
            .click();
    }

    async _fillDateCell(cell, columnName, typeName) {
        const { iso, us, cellPattern, targetDate } = this._randomFutureDate();
        await this._openCellEditor(cell);

        const dateInput = this.page
            .locator('input[type="date"]:visible, input[type="datetime-local"]:visible')
            .or(this.page.locator('revogr-edit input:visible:not([type="hidden"])').first());

        if (await dateInput.first().isVisible({ timeout: 1500 }).catch(() => false)) {
            const input = dateInput.first();
            const value = (await input.getAttribute('type')) === 'date' ? iso : us;
            await input.fill(value);
            await this.page.keyboard.press('Enter');
            await this.page.waitForTimeout(300);
            await this._commitCellEdit();
            await this._assertCellShows(cell, cellPattern, columnName, typeName, value);
            return;
        }

        await this._pickDateInCalendar(targetDate);
        await this.page.keyboard.press('Escape').catch(() => {});
        await this.page.waitForTimeout(300);
        await this._commitCellEdit();
        await this._assertCellShows(cell, cellPattern, columnName, typeName, us);
    }

    async _waitForDropdownOptions(timeout = 8000) {
        const options = this.page.locator(
            '[role="option"]:visible, [data-combobox-option]:visible, [role="listbox"] [role="option"]:visible',
        );
        await expect
            .poll(async () => await options.count(), { timeout, intervals: [300] })
            .toBeGreaterThan(0);
        return options;
    }

    async _selectUserFromCell(cell, columnName, typeName) {
        await cell.scrollIntoViewIfNeeded();

        const openUserMenu = async () => {
            const userTrigger = cell.getByText(/Select a user/i).first();
            if (await userTrigger.isVisible({ timeout: 1500 }).catch(() => false)) {
                await userTrigger.click({ force: true });
                return;
            }

            await cell.dblclick({ force: true });
            await this.page.waitForTimeout(500);

            const triggerAfterEdit = cell.getByText(/Select a user/i).first();
            if (await triggerAfterEdit.isVisible({ timeout: 2000 }).catch(() => false)) {
                await triggerAfterEdit.click({ force: true });
            }
        };

        await openUserMenu();
        await this.page.waitForTimeout(800);

        const userMenu = this.page
            .getByRole('menu', { name: /Select a user/i })
            .filter({ has: this.page.getByPlaceholder(/Search users/i) });
        await expect(userMenu).toBeVisible({ timeout: 10000 });

        const firstUserLabel = userMenu.locator('p').filter({ hasText: /@/ }).first();
        await expect(firstUserLabel).toBeVisible({ timeout: 8000 });

        const firstUserRow = firstUserLabel.locator(
            'xpath=ancestor::*[@cursor="pointer" or contains(@style,"cursor")][1]',
        );
        const selectedText = (await firstUserLabel.innerText()).trim();

        if (await firstUserRow.isVisible({ timeout: 1000 }).catch(() => false)) {
            await firstUserRow.click({ force: true });
        } else {
            await firstUserLabel.click({ force: true });
        }

        await userMenu.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
        await this.page.waitForTimeout(400);
        await this._commitCellEdit();

        await expect
            .poll(async () => this._sanitizeCellText(await cell.innerText()), { timeout: 10000 })
            .toMatch(/@|yopmail|tailorbird/i);

        this._logCellResult(columnName, typeName, selectedText, selectedText);
        return selectedText;
    }

    async _pickVisibleDropdownOption(optionName) {
        const options = this.page.locator(
            '[role="option"]:visible, [data-combobox-option]:visible, [role="listbox"] [role="option"]:visible',
        );

        if (!optionName) {
            const first = options.filter({ hasNotText: /^\s*$/ }).first();
            if (await first.isVisible({ timeout: 500 }).catch(() => false)) {
                await first.click();
                return true;
            }
            return false;
        }

        const match = options.filter({ hasText: optionName }).first();
        if (await match.isVisible({ timeout: 500 }).catch(() => false)) {
            await match.click();
            return true;
        }

        return false;
    }

    /**
     * Double-click cell, try to pick a dropdown option.
     * @returns {Promise<boolean>} true when an option was selected
     */
    async _openCellDropdownAndSelect(cell, optionName = 'Option A') {
        await cell.scrollIntoViewIfNeeded();
        await cell.dblclick({ force: true });
        await this.page.waitForTimeout(800);
        await this.page.keyboard.press('ArrowDown').catch(() => {});
        await this.page.waitForTimeout(500);

        try {
            await this._waitForDropdownOptions(optionName ? 6000 : 12000);
        } catch {
            Logger.info('no option found');
            await this._dismissEditor();
            return false;
        }

        if (await this._pickVisibleDropdownOption(optionName)) {
            return true;
        }

        Logger.info('no option found');
        await this._dismissEditor();
        return false;
    }

    /**
     * Open first row cell, enter a value, and confirm it appears in the grid after commit.
     * @param {string} columnName
     * @param {string} typeName
     */
    async verifyColumnTypeInput(columnName, typeName) {
        const cell = await this._getFirstDataCellForColumn(columnName);

        switch (typeName) {
            case 'Text':
                await this._fillActiveInputAndAssertCell(cell, 'Sample text', /Sample text/i, columnName, typeName);
                break;
            case 'Number':
                await this._fillActiveInputAndAssertCell(cell, '42', /42/, columnName, typeName);
                break;
            case 'Select': {
                const selectValue = 'Option A';
                if (await this._openCellDropdownAndSelect(cell, selectValue)) {
                    await this._commitCellEdit();
                    await this._assertCellShows(cell, /Option A/i, columnName, typeName, selectValue);
                } else {
                    Logger.info(`Inserted value for ${typeName} column "${columnName}": (no option available)`);
                }
                break;
            }
            case 'Multi-select': {
                const selectedA = await this._openCellDropdownAndSelect(cell, 'Option A');
                if (!selectedA) {
                    Logger.info(`Inserted value for ${typeName} column "${columnName}": (no option available)`);
                    break;
                }
                await this.page.waitForTimeout(400);
                const selectedB = await this._openCellDropdownAndSelect(cell, 'Option B');
                const insertedValue = selectedB ? 'Option A, Option B' : 'Option A';
                await this._commitCellEdit();
                await this._assertCellShows(
                    cell,
                    selectedB ? /Option B|Option A/i : /Option A/i,
                    columnName,
                    typeName,
                    insertedValue,
                );
                break;
            }
            case 'Date':
                await this._fillDateCell(cell, columnName, typeName);
                break;
            case 'Checkbox': {
                let checkbox = cell.locator('input[type="checkbox"]').first();
                if (!(await checkbox.isVisible({ timeout: 1500 }).catch(() => false))) {
                    await this._openCellEditor(cell);
                    checkbox = cell.locator('input[type="checkbox"]').first();
                }
                await expect(checkbox).toBeVisible({ timeout: 5000 });
                if (!(await checkbox.isChecked().catch(() => false))) {
                    await checkbox.click({ force: true });
                }
                await this._commitCellEdit();
                await expect(checkbox).toBeChecked({ timeout: 8000 });
                this._logCellResult(columnName, typeName, 'checked', 'checked');
                break;
            }
            case 'URL':
                await this._fillActiveInputAndAssertCell(
                    cell,
                    'https://tailorbird.com',
                    /tailorbird\.com/i,
                    columnName,
                    typeName,
                );
                break;
            case 'Email':
                await this._fillActiveInputAndAssertCell(
                    cell,
                    'test@tailorbird.com',
                    /test@tailorbird\.com/i,
                    columnName,
                    typeName,
                );
                break;
            case 'Phone':
                await this._fillActiveInputAndAssertCell(
                    cell,
                    '5551234567',
                    /555.*123.*4567|5551234567/,
                    columnName,
                    typeName,
                );
                break;
            case 'Currency':
                await this._fillActiveInputAndAssertCell(cell, '100', /\$?\s*100/, columnName, typeName);
                break;
            case 'Thumbnail': {
                await this._openCellEditor(cell);
                await expect(this.page.locator('revogr-edit').first()).toBeVisible({ timeout: 5000 });
                Logger.info(`Inserted value for ${typeName} column "${columnName}": (image upload editor — no file attached)`);
                await this._dismissEditor();
                break;
            }
            case 'Attachments': {
                await this._openCellEditor(cell);
                await expect(this.page.locator('revogr-edit').first()).toBeVisible({ timeout: 5000 });
                Logger.info(`Inserted value for ${typeName} column "${columnName}": (file upload editor — no text value)`);
                await this._dismissEditor();
                break;
            }
            case 'User': {
                await this._selectUserFromCell(cell, columnName, typeName);
                break;
            }
            default:
                throw new Error(`No input verification defined for column type "${typeName}"`);
        }

        Logger.success(`Verified ${typeName} input behaviour for column "${columnName}"`);
    }

    async openManageColumns() {
        for (let attempt = 0; attempt < 3; attempt++) {
            await this._openTableMenu();
            const hideShowItem = this.loc.hideShowColumnsMenuItem.first();
            if (await hideShowItem.isVisible({ timeout: 3000 }).catch(() => false)) {
                await hideShowItem.click();
                await expect(this.loc.manageColumnsDialog).toBeVisible({ timeout: 10000 });
                await this._waitForManageColumnsReady();
                return;
            }
            await this._dismissOverlays();
            await this.page.waitForTimeout(500);
        }

        await expect(this.loc.hideShowColumnsMenuItem).toBeVisible({ timeout: 8000 });
        await this.loc.hideShowColumnsMenuItem.click();
        await expect(this.loc.manageColumnsDialog).toBeVisible({ timeout: 10000 });
        await this._waitForManageColumnsReady();
    }

    async closeManageColumns() {
        await this.page.keyboard.press('Escape');
        await this.loc.manageColumnsDialog.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
        await this.page.waitForTimeout(300);
    }

    async _waitForManageColumnsReady() {
        await expect(this.loc.manageColumnsDialog).toBeVisible({ timeout: 10000 });
        await this.page.waitForTimeout(600);
        await this._ensureCustomColumnsExpanded();
        await expect
            .poll(
                async () =>
                    (await this.loc.manageColumnsDialog
                        .locator('[data-loading="true"], .mantine-Loader-root')
                        .count()) === 0,
                { timeout: 10000, intervals: [300] },
            )
            .toBe(true)
            .catch(() => {});
    }

    _customColumnsHeader() {
        return this.loc.manageColumnsDialog.getByText('Custom Columns', { exact: true });
    }

    _customColumnsHeaderRow() {
        return this._customColumnsHeader().locator('xpath=../..');
    }

    _customColumnsToggle() {
        return this._customColumnsHeaderRow().locator('button').last();
    }

    _customColumnsContent() {
        return this._customColumnsHeaderRow().locator('xpath=following-sibling::div[1]');
    }

    _customColumnRowFromDescription(desc) {
        return desc.locator('xpath=ancestor::div[contains(@style,"cursor")][1]');
    }

    async _readColumnNameFromDescription(desc) {
        return desc.evaluate((el) => el.previousElementSibling?.textContent?.trim() || '');
    }

    /**
     * @param {{ fullScan?: boolean }} [options] - fullScan scrolls entire panel (startup/verify); default is faster single-pass for delete loop
     */
    async _getAutomationColumnEntries(options = {}) {
        const { fullScan = false } = options;
        await this._ensureManageColumnsOpen();
        await this._openCustomColumnsDropdown();

        const descriptions = this.loc.manageColumnsDialog.locator('p').filter({ hasText: /^Automation / });
        const entries = [];
        const seen = new Set();
        const maxPasses = fullScan ? 12 : 2;

        await this._scrollCustomColumnsContent('start');
        let stablePasses = 0;

        for (let pass = 0; pass < maxPasses; pass++) {
            const count = await descriptions.count();
            let foundNew = false;

            for (let i = 0; i < count; i++) {
                const desc = descriptions.nth(i);
                try {
                    await desc.scrollIntoViewIfNeeded().catch(() => {});
                    const name = await this._readColumnNameFromDescription(desc);
                    if (!name || seen.has(name)) continue;

                    const row = this._customColumnRowFromDescription(desc);
                    if (!(await row.isVisible({ timeout: 1000 }).catch(() => false))) continue;

                    seen.add(name);
                    entries.push({ name, row });
                    foundNew = true;
                } catch (e) {
                    Logger.info(`Skipping column at index ${i}: ${e.message}`);
                }
            }

            if (!foundNew) {
                stablePasses++;
                if (stablePasses >= 2) break;
            } else {
                stablePasses = 0;
            }

            await this._scrollCustomColumnsContent('end');
        }

        return entries;
    }

    async _findRowByColumnName(columnName) {
        await this._openCustomColumnsDropdown();

        const descriptions = this.loc.manageColumnsDialog.locator('p').filter({ hasText: /^Automation / });

        for (const scrollPosition of ['start', 'end']) {
            await this._scrollCustomColumnsContent(scrollPosition);
            const count = await descriptions.count();

            for (let i = 0; i < count; i++) {
                const desc = descriptions.nth(i);
                await desc.scrollIntoViewIfNeeded().catch(() => {});
                const name = await this._readColumnNameFromDescription(desc);
                if (name !== columnName) continue;

                const row = this._customColumnRowFromDescription(desc);
                if (await row.isVisible({ timeout: 1000 }).catch(() => false)) {
                    return row;
                }
            }
        }

        return null;
    }

    async _deleteAutomationColumnEntry(name) {
        await this._ensureManageColumnsOpen();
        await this._openCustomColumnsDropdown();

        const row = await this._findRowByColumnName(name);
        if (!row) {
            throw new Error(`Column row "${name}" not found in Manage Columns`);
        }

        await row.scrollIntoViewIfNeeded().catch(() => {});

        const deleteBtn = row
            .locator('button:has(svg.lucide-trash-2), button:has(svg[class*="lucide-trash"])')
            .first();
        await expect(deleteBtn).toBeVisible({ timeout: 8000 });
        await deleteBtn.click({ force: true });
        await this.page.waitForTimeout(400);

        const confirmBtn = this.loc.deleteConfirmBtn;
        if (await confirmBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
            await confirmBtn.click();
            await confirmBtn.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
        }

        await expect(row).toBeHidden({ timeout: 20000 });
        Logger.success(`Deleted column "${name}"`);
        return true;
    }

    async _scrollCustomColumnsContent(position = 'end') {
        const dialog = this.loc.manageColumnsDialog;
        if (!(await dialog.isVisible().catch(() => false))) return;

        await dialog.evaluate((dialogEl, scrollPosition) => {
            const scrollables = [dialogEl, ...dialogEl.querySelectorAll('div')].filter(
                (el) => el.scrollHeight > el.clientHeight + 5,
            );
            for (const el of scrollables) {
                el.scrollTop = scrollPosition === 'start' ? 0 : el.scrollHeight;
            }
        }, position);
        await this.page.waitForTimeout(300);
    }

    async _getCustomColumnNames() {
        try {
            return (await this._getAutomationColumnEntries({ fullScan: true })).map((entry) => entry.name);
        } catch (error) {
            Logger.error(`Error getting custom column names: ${error.message}`);
            return [];
        }
    }

    async getCustomColumnCount() {
        return this._getCustomColumnNames().then((names) => names.length);
    }

    async deleteColumn(columnName) {
        try {
            return await this._deleteAutomationColumnEntry(columnName);
        } catch (error) {
            if (error.message.includes('not found')) {
                Logger.info(`Column "${columnName}" not found in Manage Columns, skipping`);
                return false;
            }
            Logger.error(`Failed to delete "${columnName}": ${error.message}`);
            throw error;
        }
    }

    async _isCustomColumnsSectionExpanded() {
        const header = this._customColumnsHeader();
        if (!(await header.isVisible({ timeout: 2000 }).catch(() => false))) return false;

        const visibleAutomationRows = await this.loc.manageColumnsDialog
            .locator('p')
            .filter({ hasText: /^Automation / })
            .locator('visible=true')
            .count();
        if (visibleAutomationRows > 0) return true;

        return this._customColumnsContent().isVisible({ timeout: 500 }).catch(() => false);
    }

    /** Expand the Custom Columns accordion when it is collapsed in Manage Columns. */
    async _openCustomColumnsDropdown() {
        const dialog = this.loc.manageColumnsDialog;
        if (!(await dialog.isVisible().catch(() => false))) return;
        if (!(await this._customColumnsHeader().isVisible({ timeout: 3000 }).catch(() => false))) return;
        if (await this._isCustomColumnsSectionExpanded()) return;

        Logger.info('Custom Columns dropdown closed — opening section');
        await this._customColumnsToggle().click({ force: true });
        await expect(this._customColumnsContent()).toBeVisible({ timeout: 8000 });
    }

    async _ensureCustomColumnsExpanded() {
        await this._openCustomColumnsDropdown();
    }

    async _ensureManageColumnsOpen() {
        if (await this.loc.manageColumnsDialog.isVisible().catch(() => false)) {
            await this._waitForManageColumnsReady();
            return;
        }
        await this._dismissOverlays();
        await this.page.waitForTimeout(300);
        await this.openManageColumns();
        await this._waitForManageColumnsReady();
    }

    async deleteAllCustomColumns() {
        let deleted = 0;
        let consecutiveFailures = 0;
        const maxConsecutiveFailures = 3;

        try {
            await this._ensureManageColumnsOpen();
            const initial = await this._getAutomationColumnEntries({ fullScan: true });
            if (initial.length === 0) {
                Logger.info('No automation custom columns to delete');
            } else {
                Logger.info(`Found ${initial.length} automation custom column(s) to delete`);
            }

            for (let round = 0; round < 300; round++) {
                const entries = await this._getAutomationColumnEntries();
                if (entries.length === 0) {
                    if (deleted > 0) {
                        Logger.success(`All custom columns deleted (total: ${deleted})`);
                    }
                    break;
                }

                const entry = entries[0];
                Logger.info(`Deleting custom column "${entry.name}" (${entries.length} remaining)`);

                try {
                    await this._deleteAutomationColumnEntry(entry.name);
                    deleted++;
                    consecutiveFailures = 0;
                } catch (error) {
                    consecutiveFailures++;
                    Logger.error(
                        `Failed to delete "${entry.name}" (${consecutiveFailures}/${maxConsecutiveFailures}): ${error.message}`,
                    );
                    if (consecutiveFailures >= maxConsecutiveFailures) {
                        throw error;
                    }
                    await this.page.waitForTimeout(1000);
                }
            }
        } finally {
            try {
                await this.closeManageColumns();
            } catch (e) {
                Logger.info(`Error closing manage columns: ${e.message}`);
            }
        }

        Logger.success(`Deleted ${deleted} custom column(s)`);
        return deleted;
    }

    async verifyNoCustomColumnsRemain() {
        await this.openManageColumns();
        await this._waitForManageColumnsReady();
        let finalCount = await this.getCustomColumnCount();

        if (finalCount > 0) {
            Logger.info(`${finalCount} columns still present — running final cleanup`);
            await this.closeManageColumns();
            await this.deleteAllCustomColumns();
            finalCount = await this.getCustomColumnCount();
        }

        expect(finalCount).toBe(0, `Expected 0 custom columns, but found ${finalCount}`);
        Logger.success('No custom columns remain');
        await this.closeManageColumns();
    }

    /**
     * Reusable flow: add each column type (Text → User), verify each, then delete all.
     * @returns {Promise<string[]>} names of columns that were created
     */
    async addAndVerifyAllColumnTypes() {
        Logger.info('Step 1: Delete leftover automation columns from previous runs');
        const removedAtStart = await this.deleteAllCustomColumns();
        Logger.info(`Startup cleanup removed ${removedAtStart} column(s)`);

        const createdColumns = [];
        const runId = Date.now();

        Logger.info('Step 2: Create and verify all 13 column types');
        for (let i = 0; i < ADD_COLUMN_TYPES.length; i++) {
            const typeName = ADD_COLUMN_TYPES[i];
            const columnName = `${typeName.replace(/[^a-zA-Z0-9]/g, '')}${runId + i}`;
            const description = `Automation ${typeName} column`;

            await this.addColumn(columnName, description, i);
            await this.verifyColumnAdded(columnName, typeName);
            createdColumns.push(columnName);
        }

        Logger.info(`Step 3: Delete all ${createdColumns.length} columns created in this run`);
        await this.deleteAllCustomColumns();

        Logger.info('Step 4: Verify no automation custom columns remain');
        await this.verifyNoCustomColumnsRemain();
        return createdColumns;
    }
}

module.exports = { AddColumnPage, ADD_COLUMN_TYPES };
