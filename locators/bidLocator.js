/**
 * Bid page locators
 * @param {import('@playwright/test').Page} page
 */
function bidLocators(page) {
    return {
        // ── Bid List Page ──────────────────────────────────────────────────────────
        bidsHeading:          page.locator('p', { hasText: /^Bids$/ }).first(),
        breadcrumbHome:       page.getByRole('link', { name: 'Home' }),
        breadcrumbBids:       page.getByRole('link', { name: 'Bids' }),
        createBidButton:      page.getByRole('button', { name: 'Create Bid' }),
        listSearchInput:      page.getByRole('textbox', { name: 'Search...' }).first(),
        viewButton:           page.getByRole('button', { name: 'View' }),
        tableButton:          page.getByRole('button', { name: 'Table' }),
        exportButton:         page.getByRole('button', { name: 'Export' }).first(),
        bidGrid:              page.getByRole('treegrid').first(),

        // Grid column headers
        colBidName:           page.getByRole('columnheader', { name: 'Bid Name' }),
        colProperty:          page.getByRole('columnheader', { name: 'Property' }),
        colStatus:            page.getByRole('columnheader', { name: 'Status' }).first(),
        colVendors:           page.getByRole('columnheader', { name: 'Vendors' }),
        colLinkedJob:         page.getByRole('columnheader', { name: 'Linked Job' }),
        colActions:           page.getByRole('columnheader', { name: 'Actions' }).first(),

        // Row link by bid name
        bidRowLink:           (name) => page.getByRole('link', { name, exact: true }),

        // ── Create Bid Modal ───────────────────────────────────────────────────────
        createBidDialog:      page.getByRole('dialog'),
        createBidHeading:     page.getByRole('heading', { name: /add ai_bid/i }),
        bidNameInput:         page.getByRole('textbox', { name: 'Bid Name' }),
        propertyInput:        page.getByRole('textbox', { name: 'Property' }),
        bidTypeInput:         page.getByRole('textbox', { name: 'Bid Type' }),
        detailLevelInput:     page.getByRole('textbox', { name: 'Detail Level' }),
        priceByInput:         page.getByRole('textbox', { name: 'Price By' }),
        bidDueDateInput:      page.getByRole('textbox', { name: 'Bid Due Date' }),
        statusInput:          page.getByRole('textbox', { name: 'Status' }),
        linkedJobInput:       page.getByRole('textbox', { name: 'Linked Job' }),
        cancelModalButton:    page.getByRole('button', { name: 'Cancel' }),
        submitBidButton:      page.getByRole('button', { name: /add ai_bid/i }),

        // Dropdown options (generic — same getByRole works for all listboxes)
        dropdownOption:       (name) => page.getByRole('option', { name }),
        dropdownOptionFuzzy:  (name) => page.getByRole('option', { name, exact: false }).first(),

        // ── Bid Detail – shared elements ──────────────────────────────────────────
        bidDetailName:        (name) => page.locator('p', { hasText: name }).first(),

        // Tabs
        overviewTab:          page.getByRole('tab', { name: 'Overview' }),
        bidBookTab:           page.getByRole('tab', { name: 'Bid Book AI Assisted' }),
        manageBidsTab:        page.getByRole('tab', { name: 'Manage Bids' }),

        // ── Overview Tab ──────────────────────────────────────────────────────────
        overviewPanel:        page.getByRole('tabpanel', { name: 'Overview' }),
        editButton:           page.getByRole('button', { name: 'Edit' }),
        bidDocumentsLabel:    page.locator('p', { hasText: 'Bid Documents' }),
        uploadFilesButton:    page.getByRole('button', { name: 'Upload Files' }),
        bidDocumentsSubtext:  page.locator('p', { hasText: 'Files and documents related to this bid' }),
        // Returns the value paragraph paired with the given label paragraph
        overviewFieldValue:   (label) =>
            page.locator('p', { hasText: new RegExp(`^${label}$`) })
                .locator('..')
                .locator('p')
                .last(),

        // ── Edit Bid Dialog (Overview → Edit button) ──────────────────────────────
        editBidDialog:        page.getByRole('dialog', { name: 'Edit Bid' }),
        editBidNameInput:     page.getByRole('dialog', { name: 'Edit Bid' })
                                  .getByRole('textbox', { name: 'Bid Name' }),
        editBidDueDateInput:  page.getByRole('dialog', { name: 'Edit Bid' })
                                  .getByRole('textbox', { name: 'Bid Due Date' }),
        editSaveChangesBtn:   page.getByRole('dialog', { name: 'Edit Bid' })
                                  .getByRole('button', { name: 'Save Changes' }),
        editCancelBtn:        page.getByRole('dialog', { name: 'Edit Bid' })
                                  .getByRole('button', { name: 'Cancel' }),

        // ── Bid Book AI Assisted Tab ──────────────────────────────────────────────
        bidBookPanel:         page.getByRole('tabpanel', { name: 'Bid Book AI Assisted' }),
        chatInput:            page.getByRole('textbox', { name: 'Ask about this bid...' }),

        // Chat attachment button — no aria-label; walk up via XPath ancestor to find
        // the nearest ancestor that actually contains button descendants, then take first.
        chatAttachButton:     page.getByRole('textbox', { name: 'Ask about this bid...' })
                                  .locator('xpath=ancestor::*[.//button][1]//button[1]'),

        // Documents in context dialog (opened by chatAttachButton)
        docsContextDialog:    page.getByRole('dialog').filter({ hasText: 'Documents in context' }),
        docsContextNoFilesText: page.locator('p', { hasText: 'No documents uploaded yet' }),
        docsContextUploadBtn: page.getByRole('button', { name: 'Upload files' }),

        // Toolbar buttons (right-hand panel)
        fullscreenButton:     page.getByRole('button', { name: 'Fullscreen' }),
        exitFullscreenButton: page.getByRole('button', { name: 'Exit Fullscreen' }),
        resetButton:          page.getByRole('button', { name: 'Reset' }),
        bidBookExportButton:  page.getByRole('button', { name: 'Export' }).last(),
        saveAsTemplateButton: page.getByRole('button', { name: 'Save as Template' }),
        sendToVendorsButton:  page.getByRole('button', { name: 'Send to Vendors' }),
        // Spreadsheet iframe
        bidBookIframe:        page.locator('iframe').first(),
        // AI response elements
        thoughtButton:        page.getByRole('button', { name: 'Thought' }).first(),
        allThoughtButtons:    page.getByRole('button', { name: /Thought/i }),
        chatResponsePara:     page.getByRole('tabpanel', { name: 'Bid Book AI Assisted' })
                                  .locator('p')
                                  .last(),

        // ── Save as Template Dialog ───────────────────────────────────────────────
        saveAsTemplateDialog:  page.getByRole('dialog', { name: 'Save as Template' }),
        templateNameInput:     page.getByRole('dialog', { name: 'Save as Template' })
                                   .getByRole('textbox', { name: 'Name' }),
        templateDescInput:     page.getByRole('dialog', { name: 'Save as Template' })
                                   .getByRole('textbox', { name: 'Description' }),
        saveTemplateButton:    page.getByRole('button', { name: 'Save Template' }),

        // ── Send to Vendors Dialog ────────────────────────────────────────────────
        sendToVendorsDialog:     page.getByRole('dialog', { name: 'Send Bid to Vendors' }),
        step1VendorsButton:      page.getByRole('button', { name: /Select Vendors/ }),
        step2DocsButton:         page.getByRole('button', { name: '2 Select Documents' }),
        nextSelectDocsButton:    page.getByRole('button', { name: 'Next: Select Documents' }),
        sendInvitationsButton:   page.getByRole('button', { name: 'Send Invitations' }),
        wizardBackButton:        page.getByRole('button', { name: 'Back' }),
        vendorSearchInput:       page.getByRole('dialog', { name: 'Send Bid to Vendors' })
                                     .getByRole('textbox', { name: 'Search...' }),
        vendorFilterButton:      page.getByRole('dialog', { name: 'Send Bid to Vendors' })
                                     .getByRole('button', { name: 'Filter' }),
        vendorViewButton:        page.getByRole('dialog', { name: 'Send Bid to Vendors' })
                                     .getByRole('button', { name: 'View' }),
        colVendorName:           page.getByRole('dialog', { name: 'Send Bid to Vendors' })
                                     .getByRole('columnheader', { name: 'Name', exact: true }),
        colVendorLocation:       page.getByRole('dialog', { name: 'Send Bid to Vendors' })
                                     .getByRole('columnheader', { name: 'Location', exact: true }),
        colVendorServiceArea:    page.getByRole('dialog', { name: 'Send Bid to Vendors' })
                                     .getByRole('columnheader', { name: 'Service Area', exact: true }),
        colVendorPrimaryContact: page.getByRole('dialog', { name: 'Send Bid to Vendors' })
                                     .getByRole('columnheader', { name: 'Primary Contact', exact: true }),
        colVendorContactEmail:   page.getByRole('dialog', { name: 'Send Bid to Vendors' })
                                     .getByRole('columnheader', { name: 'Primary Contact Email', exact: true }),
        colVendorTrades:         page.getByRole('dialog', { name: 'Send Bid to Vendors' })
                                     .getByRole('columnheader', { name: 'Trades', exact: true }),
        inviteVendorButton:      page.getByRole('button', { name: '+ Invite a New Vendor' }),
        docsToShareHeading:      page.locator('p', { hasText: 'Documents to Share' }),
        uploadDocumentButton:    page.getByRole('button', { name: 'Upload Document' }),
        // Bid Template row — scoped to the dialog to avoid matching other cells
        bidTemplateRow:          page.getByRole('dialog', { name: 'Send Bid to Vendors' })
                                     .getByRole('cell', { name: 'Bid Template (always included)' }),
        invitationsSentAlert:    page.getByRole('alert').filter({ hasText: 'Invitations Sent' }),

        // ── Manage Bids Tab ───────────────────────────────────────────────────────
        manageBidsPanel:      page.getByRole('tabpanel', { name: 'Manage Bids' }),
        manageBidsSearchInput:page.getByRole('tabpanel', { name: 'Manage Bids' })
                                  .getByRole('textbox', { name: 'Search...' }),
        compareBidsButton:    page.getByRole('button', { name: 'Compare Bids' }),
        colVendorMgmt:        page.getByRole('columnheader', { name: 'Vendor' }),
        colStatusMgmt:        page.getByRole('columnheader', { name: 'Status' }).last(),
        colInvitedAt:         page.getByRole('columnheader', { name: 'Invited At' }),
        colBidDueDateMgmt:    page.getByRole('columnheader', { name: 'Bid Due Date' }),
        colSubmittedAt:       page.getByRole('columnheader', { name: 'Submitted At' }),

        // ── Compare Bids / Piper AI (AI Bid Levelling panel) ─────────────────────
        piperManageVendorsBtn:  page.getByRole('button', { name: 'Manage Vendors' }),
        piperResetBtn:          page.getByRole('button', { name: 'Reset' }).first(),
        piperExportBtn:         page.getByRole('tabpanel', { name: 'Manage Bids' })
                                    .getByRole('button', { name: 'Export' }),
        piperWelcomeHeading:    page.locator('p', { hasText: '👋 Welcome to Piper!' }),
        piperWelcomeDesc:       page.locator('p', { hasText: 'Compare bids from multiple vendors' }),
        piperChatInput:         page.getByRole('textbox', { name: 'Ask your question' }),
        // attach button = first icon button in the chat toolbar; send = last
        piperAttachButton:      page.getByRole('textbox', { name: 'Ask your question' })
                                    .locator('xpath=ancestor::*[.//button][1]//button[1]'),
        piperSendButton:        page.getByRole('textbox', { name: 'Ask your question' })
                                    .locator('xpath=ancestor::*[.//button][1]//button[last()]'),
        piperThinkingButton:    page.getByRole('button', { name: 'Thinking...' }).first(),
        piperThoughtButton:     page.getByRole('button', { name: 'Thought' }).first(),
        piperAllThoughtButtons: page.getByRole('button', { name: 'Thought' }),
        piperResetDialog:       page.getByRole('dialog', { name: 'Reset' }),
        piperIframe:            page.getByRole('tabpanel', { name: 'Manage Bids' })
                                    .locator('iframe').first(),
        // Uploadcare dialog that appears when piperAttachButton is clicked
        piperUploadDialog:      page.locator('dialog[open]').first(),
        piperFromDeviceBtn:     page.locator('dialog[open]').getByText('From device').first(),
        // Manage Bids vendor grid — rows with vendor data
        manageBidsVendorGrid:   page.getByRole('tabpanel', { name: 'Manage Bids' })
                                    .getByRole('treegrid').first(),
        // Award Bid button (appears on submitted vendor rows)
        awardBidButton:         page.getByRole('button', { name: /award bid/i }).first(),
    };
}

module.exports = { bidLocators };
