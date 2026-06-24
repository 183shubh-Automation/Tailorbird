function capexGridStabilityLocators(page) {
    return {
        treeToggleBtns: page.locator('button.tree-toggle'),
        columnHeaders:  page.locator('[role="columnheader"]'),
        revoGrid:       page.locator('revo-grid').first(),
    };
}
module.exports = { capexGridStabilityLocators };
