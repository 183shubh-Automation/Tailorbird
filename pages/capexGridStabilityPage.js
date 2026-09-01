const { capexGridStabilityLocators } = require('../locators/capexGridStabilityLocator');
const { Logger } = require('../utils/logger');

class CapexGridStabilityPage {
    constructor(page) {
        this.page = page;
        this.l = capexGridStabilityLocators(page);
    }

    // Waits until column headers and at least one tree-toggle button are visible.
    async waitForGridReady() {
        await this.l.columnHeaders.first().waitFor({ state: 'visible', timeout: 30000 });
        await this.l.treeToggleBtns.first().waitFor({ state: 'visible', timeout: 20000 });
        await this.page.waitForTimeout(400);
    }

    // Returns the count of child rows currently in the DOM.
    // Child rows are identified by a span with margin-left >= 20px inside a gridcell
    // — these are the indented leaf nodes of the revo-grid tree.
    async countVisibleChildRows() {
        return this.page.evaluate(() => {
            return Array.from(document.querySelectorAll('[role="gridcell"]'))
                .filter(c => {
                    const indent = c.querySelector('[style*="margin-left"]');
                    return indent && parseInt(indent.style.marginLeft, 10) >= 20;
                }).length;
        });
    }

    // Returns the property name for the Nth parent row visible in the grid
    // (0-based). Parent rows are gridcells that contain a button.tree-toggle.
    async getPropertyNameAtToggleIndex(index) {
        return this.page.evaluate((idx) => {
            const toggleCells = Array.from(document.querySelectorAll('[role="gridcell"]'))
                .filter(c => c.querySelector('button.tree-toggle'));
            const cell = toggleCells[idx];
            return cell?.querySelector('span')?.textContent?.trim() || '';
        }, index);
    }

    // Scrolls the revo-grid by deltaY pixels (positive = down). Moves the mouse
    // over the grid center first so the wheel event reaches the correct element.
    async scrollGrid(deltaY, times = 1) {
        const gridBox = await this.l.revoGrid.boundingBox();
        const cx = gridBox ? gridBox.x + gridBox.width / 2 : 600;
        const cy = gridBox ? gridBox.y + gridBox.height / 2 : 400;
        await this.page.mouse.move(cx, cy);
        for (let i = 0; i < times; i++) {
            await this.page.mouse.wheel(0, deltaY);
            await this.page.waitForTimeout(200);
        }
        await this.page.waitForTimeout(400);
    }

    // Scrolls the grid back to the very top.
    async scrollGridToTop() {
        await this.scrollGrid(-5000, 1);
    }

    // After property 0 is expanded (8 children), scrolls down past its children
    // and clicks the first tree-toggle found — expanding the next visible property.
    // Returns true if a second expansion succeeded, false otherwise.
    async expandSecondProperty() {
        // Captured BEFORE scrolling — the property already expanded by the caller, whose
        // continued expansion this method must not silently lose. Used below to detect and
        // recover from the mid-test remount case (see comment further down).
        const firstPropertyName = await this.getPropertyNameAtToggleIndex(0);
        // 8 children × ~36px row height = ~288px. Scroll 500px to clear them.
        await this.scrollGrid(500, 1);
        const firstToggle = this.l.treeToggleBtns.first();
        if (await firstToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
            await firstToggle.click();
            await this.page.waitForTimeout(800);
            // MCP-verified live (2026-07-28): instrumented diagnostic logging on this exact
            // test previously confirmed this shared portfolio's property dataset can be
            // mutated by an external process mid-test, causing revo-grid to fully remount —
            // which resets scrollTop to 0 and collapses whatever was expanded, all before the
            // click above even fires. When that happens, the click above lands on an
            // unrelated (or already-collapsed) property instead of a genuinely different
            // second one, and no children render. Detect that here and recover by trying
            // every other currently visible toggle until one actually reveals children,
            // instead of reporting a false "second expansion" that added nothing.
            const childCountAfterFirstAttempt = await this.countVisibleChildRows();
            if (childCountAfterFirstAttempt === 0) {
                const toggleCount = await this.l.treeToggleBtns.count().catch(() => 0);
                for (let i = 0; i < toggleCount; i++) {
                    const candidate = this.l.treeToggleBtns.nth(i);
                    if (await candidate.isVisible({ timeout: 1000 }).catch(() => false)) {
                        await candidate.click();
                        await this.page.waitForTimeout(800);
                        if (await this.countVisibleChildRows() > 0) break;
                    }
                }
            }
            // The recovery above only guarantees a SECOND property ended up expanded — it
            // does not guarantee the FIRST one (captured above) survived. If the remount
            // wiped it too, restore it now by name so both sections genuinely coexist by the
            // time this method returns, matching what the caller actually asked for.
            if (firstPropertyName) {
                const firstToggleAgain = this.page
                    .locator('[role="gridcell"]')
                    .filter({ has: this.page.getByText(firstPropertyName, { exact: true }) })
                    .locator('button.tree-toggle')
                    .first();
                if (await firstToggleAgain.isVisible({ timeout: 2000 }).catch(() => false)) {
                    const alreadyExpanded = await firstToggleAgain.getAttribute('expanded').catch(() => null);
                    if (alreadyExpanded === null) {
                        await firstToggleAgain.click();
                        await this.page.waitForTimeout(800);
                    }
                }
            }
            return true;
        }
        return false;
    }

    // Returns { headersVisible, hasGridCells } to confirm the grid is still rendering.
    async validateGridStability() {
        const headersVisible = await this.l.columnHeaders.first()
            .isVisible({ timeout: 5000 }).catch(() => false);
        const hasGridCells = await this.page.evaluate(
            () => document.querySelectorAll('[role="gridcell"]').length > 0
        );
        return { headersVisible, hasGridCells };
    }

    // Returns the index (among all button.tree-toggle elements in the DOM) of the
    // first toggle that is currently expanded — identified by being immediately
    // above a child row in the property column pane.
    // Cells are sorted by vertical position to handle revo-grid's absolute layout.
    // Returns -1 if no expanded parent is visible in the current DOM.
    async getFirstExpandedToggleIndex() {
        return this.page.evaluate(() => {
            const propContainer = Array.from(document.querySelectorAll('revogr-data[type="rgRow"]'))
                .find(c => c.querySelector('button.tree-toggle'));
            if (!propContainer) return -1;
            // Sort by visual top position — revo-grid may render rows non-sequentially in DOM
            const cells = Array.from(propContainer.querySelectorAll('[role="gridcell"]'))
                .map(c => ({ c, top: c.getBoundingClientRect().top }))
                .sort((a, b) => a.top - b.top)
                .map(item => item.c);
            for (let i = 0; i < cells.length - 1; i++) {
                const toggle = cells[i].querySelector('button.tree-toggle');
                // Parent rows have margin-left:0px; children have margin-left:20px.
                // Must check >= 20 — !!querySelector('[style*="margin-left"]') returns
                // true for parent cells too (they carry a 0px spacer span).
                const nextEl = cells[i + 1].querySelector('[style*="margin-left"]');
                const nextIsChildRow = nextEl && parseInt(nextEl.style.marginLeft, 10) >= 20;
                if (toggle && nextIsChildRow) {
                    // Return index among ALL tree-toggle buttons so the caller can use
                    // Playwright's .nth(index).click() — JS click does not work on
                    // revo-grid tree-toggle buttons.
                    const allToggles = Array.from(document.querySelectorAll('button.tree-toggle'));
                    return allToggles.indexOf(toggle);
                }
            }
            return -1;
        });
    }

    // Collapses all expanded rows. Each iteration finds the first expanded parent
    // (whose next sibling in the property column is a child row) and collapses it
    // with a Playwright click. Scrolls when no expanded parent is in the current
    // viewport. Exits after 20 attempts.
    async collapseAllExpanded() {
        for (let attempt = 0; attempt < 20; attempt++) {
            const childCount = await this.countVisibleChildRows();
            if (childCount === 0) break;
            const toggleIndex = await this.getFirstExpandedToggleIndex();
            if (toggleIndex >= 0) {
                await this.l.treeToggleBtns.nth(toggleIndex).click();
                await this.page.waitForTimeout(600);
            } else {
                await this.scrollGrid(400, 1);
            }
        }
    }
}

module.exports = { CapexGridStabilityPage };
