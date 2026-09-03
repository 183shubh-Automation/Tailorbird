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

        // Left panel navigation — "Bids" item under Construction Management.
        // Multiple matches can render in the nav (e.g. collapsed/expanded rail) — take the first.
        leftNavBidsLink:      page.locator('nav').getByText('Bids', { exact: true }).first(),

        // ── Create Bid Modal ───────────────────────────────────────────────────────
        createBidDialog:      page.getByRole('dialog'),
        // MCP-verified live (2026-09-01) against beta.tailorbird.com/bids: the modal heading
        // reads "Create New Bid" — the old "Add ai_bid" copy is gone. Chained with fallbacks
        // (banner heading, then any heading in the dialog) so a future copy change degrades
        // gracefully instead of reproducing this exact failure.
        createBidHeading:     page.getByRole('dialog').getByRole('heading', { name: 'Create New Bid', exact: true })
                                  .or(page.getByRole('dialog').getByRole('banner').getByRole('heading'))
                                  .or(page.getByRole('dialog').getByRole('heading').first()),
        bidNameInput:         page.getByRole('textbox', { name: 'Bid Name' }),
        propertyInput:        page.getByRole('textbox', { name: 'Property' }),
        bidTypeInput:         page.getByRole('textbox', { name: 'Bid Type' }),
        detailLevelInput:     page.getByRole('textbox', { name: 'Detail Level' }),
        priceByInput:         page.getByRole('textbox', { name: 'Price By' }),
        bidDueDateInput:      page.getByRole('textbox', { name: 'Bid Due Date' }),
        // MCP-verified live (2026-09-01): scoped to the dialog — "Cancel" and "Create Bid"
        // buttons here are distinct DOM nodes from any same-named controls outside the modal.
        cancelModalButton:    page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }),
        // MCP-verified live (2026-09-01): the submit button now reads "Create Bid" — the SAME
        // text as the page-level button that OPENS this modal — so it must be scoped to the
        // dialog or Playwright's strict-mode matches two elements. Fallback picks the last
        // button in the dialog's action row (Cancel is always first, submit is always last).
        submitBidButton:      page.getByRole('dialog').getByRole('button', { name: 'Create Bid', exact: true })
                                  .or(page.getByRole('dialog').locator('button').last()),
        // Regression guard (product decision, MCP-verified 2026-09-01 across all 3 accessible
        // orgs): a bid must NOT be linkable to a job at creation time — job-linking only
        // happens at award time, and never across a different property (see bug report:
        // the old modal let users pick a job from ANY property, not just the bid's own).
        // Matches a "Linked Job" textbox by accessible name OR a plain "Linked Job" label/text
        // anywhere in the dialog, so this stays a real regression guard however the field is
        // reintroduced if the product ever brings it back to this modal.
        linkedJobFieldCheck:  page.getByRole('dialog').getByRole('textbox', { name: 'Linked Job' })
                                  .or(page.getByRole('dialog').getByText('Linked Job', { exact: true })),

        // Supporting Documents (optional) — Uploadcare widget, MCP-verified live (2026-09-01).
        // Uploadcare renders "Drop files here" in TWO places at once: the visible drop zone
        // (<uc-start-from>) and a hidden empty-state placeholder inside <uc-upload-list>
        // (display:none, 0x0). A plain getByText() matches both and trips Playwright's strict
        // mode even though only one is ever visible — so every locator here is intersected
        // with `:visible` to deterministically grab the one actually on screen, regardless of
        // which internal Uploadcare container happens to render it.
        supportingDocsLabel:     page.getByRole('dialog').getByText('Supporting Documents (optional)')
                                      .and(page.locator(':visible')),
        dropFilesHereText:       page.getByRole('dialog').getByText('Drop files here')
                                      .and(page.locator(':visible')),
        supportingDocsFromDeviceBtn: page.getByRole('dialog').getByRole('button', { name: 'From device' })
                                          .and(page.locator(':visible')),
        supportingDocsGoogleDriveBtn: page.getByRole('dialog').getByRole('button', { name: 'Google Drive' })
                                           .and(page.locator(':visible')),
        supportingDocsDropboxBtn:    page.getByRole('dialog').getByRole('button', { name: 'Dropbox' })
                                          .and(page.locator(':visible')),
        poweredByUploadcareLink: page.getByRole('dialog').getByRole('link', { name: 'Powered by Uploadcare' })
                                      .and(page.locator(':visible')),

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
            page.locator(`p:text-is("${label}")`)
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
        editBidSuccessToast:  page.getByRole('alert').filter({ hasText: 'Bid updated successfully' }),

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
