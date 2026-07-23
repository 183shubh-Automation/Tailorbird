function drawApprovalLocators(page) {
    const createDialog = () => page.getByRole('dialog').filter({ has: page.getByText('Create Approval Template', { exact: true }) });

    return {
        createTemplateButton: page.getByRole('button', { name: 'Create Template', exact: true }),
        createDialog,

        // --- Fields inside the Create Approval Template dialog ---
        templateNameInput: () => createDialog().getByRole('textbox', { name: 'Template Name' }),
        drawTypeRadio: () => createDialog().getByRole('radio', { name: 'Draw', exact: true }),
        addPropertiesButton: () => createDialog().getByRole('button', { name: 'Search and add properties' }),

        // --- Property picker popover (opened by addPropertiesButton) ---
        propertySearchInput: page.getByRole('textbox', { name: 'Search properties' }),
        propertyOptionCheckbox: (propertyName) => page.getByText(propertyName, { exact: true }),
        closePropertyPickerButton: page.getByRole('button', { name: 'Close', exact: true }),

        // --- Approval rule rows (row 0 = header, rows 1..3 = default approver rows) ---
        approvalRuleRow: (index) => createDialog().getByRole('row').nth(index + 1),
        approverInputInRow: (index) => createDialog().getByRole('row').nth(index + 1).getByRole('textbox', { name: 'Select approvers' }),
        approverOption: (name) => page.getByRole('option', { name, exact: true }),
        alwaysRequiredCheckboxInRow: (index) => createDialog().getByRole('row').nth(index + 1).getByRole('checkbox'),
        deleteRowButtonInRow: (index) => createDialog().getByRole('row').nth(index + 1).getByRole('button').last(),

        submitTemplateButton: () => createDialog().getByRole('button', { name: 'Create Template', exact: true }),

        // --- Approval Templates list (post-creation verification) ---
        // CSS-based (not getByRole) deliberately: on the All Approvals page (a heavy
        // virtualized RevoGrid data grid), the browser's accessibility-tree computation was
        // observed to lag far behind the actual DOM/paint — the input is genuinely visible
        // and interactable in the DOM (confirmed via direct evaluation) long before
        // getByRole('textbox', {name:'Search...'}) resolves, sometimes never within 90s+ of
        // waiting. A plain CSS attribute selector reads the DOM directly and sidesteps that.
        templatesListSearchInput: page.locator('input[placeholder="Search..."]').first(),
        templateRowByName: (name) => page.getByRole('row').filter({ hasText: name }),

        // --- Top nav "Approvals" link + "All Approvals" tab (for client-side SPA navigation) ---
        approvalsNavLink: page.locator('nav').getByText('Approvals', { exact: true }).first(),
        allApprovalsTab: page.getByRole('tab', { name: 'All Approvals', exact: true }),

        // --- All Approvals grid + Approval Details dialog ---
        // The grid's rows do NOT render the draw's name anywhere (only Property Name, Job,
        // Approval Type, ID, Amount, etc.) and the page's search box does not index draw name
        // either — searching by draw name always yields zero rows. Since the domain only
        // allows one Pending draw submission per property at a time, the unique way to find
        // "the draw I just submitted" is by property name + type "Draw" + status "Pending
        // Approval"; the exact draw name is then verified from the opened dialog's own text.
        allApprovalsRowByName: (name) => page.getByRole('row').filter({ hasText: name }),
        allApprovalsPendingDrawRowForProperty: (propertyName) => page
            .getByRole('row')
            .filter({ hasText: propertyName })
            .filter({ hasText: 'Draw' })
            .filter({ hasText: 'Pending Approval' }),
        allApprovalsViewDetailsButtonInRow: (row) => row.getByRole('button', { name: 'View Details' }),
        approvalDetailsDialog: page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Approval Details' }) }),
        eligibleApproversText: page.getByText(/Eligible approvers:/),
        directApproveButton: page.getByRole('button', { name: 'Approve', exact: true }),
        directRejectButton: page.getByRole('button', { name: 'Reject', exact: true }),
        approveOnBehalfButton: page.getByRole('button', { name: 'Approve on Behalf', exact: true }),
    };
}

module.exports = { drawApprovalLocators };
