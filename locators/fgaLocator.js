/**
 * FEAT-972 — FGA (Fine-Grained Access) User Management.
 * Locators for the Organization > "Property access" tab: property grid, per-row
 * Settings action, and the "Property access: {propertyName}" assignment dialog.
 * MCP-verified live (2026-07-08) against Organization workspace, QA Automations org.
 *
 * Follows this repo's `locators/organization.js` convention (plain object of
 * selector strings / literal UI copy) — new file, does not modify that one.
 */
module.exports = {
  usersTabName: 'Users',
  propertyAccessTabName: 'Property access',

  transposeViewButtonName: 'Transpose view',
  settingsButtonName: 'Settings',

  propertyAccessSearchPlaceholder: 'Search',
  noPropertiesFoundText: 'No properties found.',

  columnHeaders: ['Property', 'Location', 'Access', 'Actions'],

  /** Assignment dialog opened via a property row's "Settings" action. */
  dialogTitlePrefix: 'Property access: ',
  dialogUserSearchPlaceholder: 'Search by name or email',
  selectAllButtonName: 'Select all',
  deselectAllButtonName: 'Deselect all',

  /** Each assignable user renders as a Mantine Group (checkbox + name/email) — MCP-verified DOM chain. */
  dialogUserRowGroup: 'div.mantine-Group-root',

  accessGrantedToastTitle: 'Access granted',
  accessGrantedToastMessage: 'Property access granted.',
};
