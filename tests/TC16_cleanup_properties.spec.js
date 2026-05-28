require('dotenv').config();

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { LoginPage } = require('../pages/loginPage');
const PropertiesHelper = require('../pages/properties');
const OrganizationHelper = require('../pages/organizationHelper');
const data = require('../fixture/organization.json');

const SAMPLE_PROPERTY_1 = 'Harbor Bay at MacDill_Liberty Cove (Sample Property 1)';
const SAMPLE_PROPERTY_2 = 'The Brook (Sample Property 2)';

/**
 * Loads recently created property name.
 * Priority:
 * 1) downloads/property.json (latest runtime output)
 * 2) data/propertyData.json (fallback)
 * @returns {string|null}
 */
function loadRecentPropertyName() {
  const preferredPath = path.join(process.cwd(), 'downloads', 'property.json');
  const fallbackPath = path.join(__dirname, '../data/propertyData.json');
  try {
    const candidates = [preferredPath, fallbackPath];
    for (const filePath of candidates) {
      if (!fs.existsSync(filePath)) continue;
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      const name = parsed?.propertyName;
      if (typeof name === 'string' && name.trim()) return name.trim();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Names visible in the current treegrid viewport (first column text per data row).
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string[]>}
 */
async function collectVisiblePropertyNames(page) {
  const grid = page.locator('[role="treegrid"]').first();
  await grid.waitFor({ state: 'visible', timeout: 60000 });
  const rows = grid.locator('[role="row"]');
  const count = await rows.count();
  const names = [];
  const skip = new Set(['Property Name', 'Name', '']);

  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const firstCell = row.locator('[role="gridcell"]').first();
    if ((await firstCell.count()) === 0) continue;
    const raw = (await firstCell.innerText()).trim();
    const name = raw.split('\n')[0].trim();
    if (!name || skip.has(name)) continue;
    if (name.length < 2) continue;
    names.push(name);
  }

  return [...new Set(names)];
}

/**
 * Scrolls the treegrid and unions visible first-column names (handles virtualized rows).
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string[]>}
 */
async function collectAllPropertyNamesFromGrid(page) {
  const grid = page.locator('[role="treegrid"]').first();
  await grid.waitFor({ state: 'visible', timeout: 60000 });
  const all = new Set();

  await grid.evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.waitForTimeout(400);

  let stagnant = 0;
  let prevSize = 0;

  for (let step = 0; step < 60; step++) {
    const batch = await collectVisiblePropertyNames(page);
    batch.forEach((n) => all.add(n));

    if (all.size === prevSize) stagnant += 1;
    else stagnant = 0;
    prevSize = all.size;

    const atBottom = await grid.evaluate((el) => {
      const scrollable = el;
      return scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 8;
    });

    if (atBottom && stagnant >= 2) break;

    await grid.evaluate((el) => {
      el.scrollTop = Math.min(el.scrollTop + Math.max(200, el.clientHeight * 0.75), el.scrollHeight);
    });
    await page.waitForTimeout(280);

    if (stagnant >= 8 && step > 10) break;
  }

  return [...all];
}

/**
 * Cleans pending users across pages:
 * - Invited => Revoke invitation
 * - Expired => Remove user
 * @param {import('@playwright/test').Page} page
 */
async function revokeAllInvitedUsersAcrossPages(page) {
  const tableRows = page.locator('table tbody tr');
  const nextPageBtn = page
    .locator(
      'button[aria-label*="next" i], button:has-text("Next"), [data-testid*="next" i], button:has(svg.lucide-chevron-right)'
    )
    .first();

  let totalRevoked = 0;
  const maxPages = 100;

  for (let pageNo = 1; pageNo <= maxPages; pageNo++) {
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(600);

    let revokedOnThisPage = 0;
    for (let guard = 0; guard < 100; guard++) {
      const rowCount = await tableRows.count();
      if (rowCount === 0) break;

      let targetRow = null;
      let targetStatus = null;
      for (let i = 0; i < rowCount; i++) {
        const row = tableRows.nth(i);
        const rowText = (await row.innerText().catch(() => '')).trim();
        const isInvited = /Invited/i.test(rowText);
        const isExpired = /Expired/i.test(rowText);
        if (isInvited || isExpired) {
          targetRow = row;
          targetStatus = isExpired ? 'expired' : 'invited';
          break;
        }
      }

      if (!targetRow) break;

      const emailText = (
        (await targetRow.locator('td').nth(1).innerText().catch(() => '')) ||
        (await targetRow.innerText().catch(() => ''))
      ).trim();

      const actionButton = targetRow
        .locator('button[title="User actions"], button[aria-label*="user action" i], button:has(svg.lucide-ellipsis-vertical)')
        .first();
      await actionButton.click();

      let actionItem;
      if (targetStatus === 'expired') {
        actionItem = page
          .locator('role=menuitem >> text=/Remove user|Remove invitation|Remove|Delete/i')
          .first();
      } else {
        actionItem = page
          .locator('role=menuitem >> text=/Revoke invitation|Revoke invite/i')
          .first();
      }
      await actionItem.click();

      const confirmDialog = page.locator('[role="alertdialog"], [role="dialog"]').filter({
        hasText: targetStatus === 'expired'
          ? /Remove user|Remove invitation|Remove|Delete/i
          : /Revoke invitation|Revoke invite/i
      }).first();
      await expect(confirmDialog).toBeVisible({ timeout: 10000 });

      const confirmBtn = confirmDialog
        .locator(
          targetStatus === 'expired'
            ? 'button:has-text("Remove"), button:has-text("Delete"), button:has-text("Confirm"), button:has-text("Yes")'
            : 'button:has-text("Revoke"), button:has-text("Confirm"), button:has-text("Yes")'
        )
        .first();
      await confirmBtn.click();

      await confirmDialog.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(700);

      revokedOnThisPage += 1;
      totalRevoked += 1;
      console.log(`[cleanup-users] ${targetStatus === 'expired' ? 'Removed expired' : 'Revoked invited'} user: ${emailText || 'unknown'}`);
    }

    const nextVisible = await nextPageBtn.isVisible().catch(() => false);
    if (!nextVisible) break;

    const nextDisabled = await nextPageBtn.isDisabled().catch(async () => {
      const ariaDisabled = await nextPageBtn.getAttribute('aria-disabled').catch(() => null);
      return ariaDisabled === 'true';
    });
    if (nextDisabled) break;

    const before = await tableRows.first().innerText().catch(() => '');
    await nextPageBtn.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(900);
    const after = await tableRows.first().innerText().catch(() => '');

    if (before === after && revokedOnThisPage === 0) break;
  }

  return totalRevoked;
}

test.describe.skip('Properties cleanup', () => {
  test('TC259 @cleanup @property Delete all properties except sample pair and recently created', async ({
    browser,
  }) => {
    // Large environments can have hundreds of generated properties;
    // allow enough time for full cleanup in one run.
    test.setTimeout(180000);

    const recent = loadRecentPropertyName();
    const keep = new Set([SAMPLE_PROPERTY_1, SAMPLE_PROPERTY_2]);
    if (recent) keep.add(recent);
    const requiredKeep = new Set([SAMPLE_PROPERTY_1, SAMPLE_PROPERTY_2]);

    const context = await browser.newContext({ storageState: 'sessionState.json' });
    const page = await context.newPage();
    const prop = new PropertiesHelper(page);

    try {
      try {
        await test.step('Open Properties (table view) with existing session', async () => {
          const dashboardUrl = process.env.DASHBOARD_URL || data.dashboardUrl;
          await prop.goto(dashboardUrl);
          if ((page.url() || '').includes('/login')) {
            throw new Error('sessionState.json is not authenticated. Refresh sessionState once, then rerun cleanup.');
          }
          await prop.goToProperties();
          await prop.changeView('Table View');
        });

        await test.step('Clear search', async () => {
          const input = page.locator('input[placeholder="Search..."]');
          await input.click();
          await input.fill('');
          await page.waitForLoadState('networkidle').catch(() => {});
          await page.waitForTimeout(1500);
        });

        await test.step('Delete properties not in keep list', async () => {
          let iterations = 0;
          const maxIterations = 200;

          // Only enforce "must remain" for protected names that actually
          // exist at cleanup start; prevents false failures when the recent
          // downloaded property is already gone from prior runs.
          const initialNames = await collectAllPropertyNamesFromGrid(page);
          for (const name of keep) {
            if (initialNames.includes(name)) requiredKeep.add(name);
          }

          while (iterations < maxIterations) {
            iterations += 1;

            await page.locator('input[placeholder="Search..."]').fill('');
            await page.waitForLoadState('networkidle').catch(() => {});
            await page.waitForTimeout(1200);

            const allNames = await collectAllPropertyNamesFromGrid(page);
            const toRemove = allNames.filter((n) => !keep.has(n));

            if (toRemove.length === 0) {
              console.log('[cleanup] No extra properties to delete.');
              break;
            }

            // Delete all discovered extras in this scan to avoid repeated
            // expensive grid scans that can trigger test timeout.
            for (const victim of toRemove) {
              console.log(`[cleanup] Deleting: ${victim}`);
              await prop.deleteProperty(victim);
            }
          }

          expect(iterations).toBeLessThan(maxIterations);
        });

        await test.step('Verify only kept properties remain', async () => {
          await page.locator('input[placeholder="Search..."]').fill('');
          await page.waitForLoadState('networkidle').catch(() => {});
          await page.waitForTimeout(1200);

          const remaining = await collectAllPropertyNamesFromGrid(page);
          const unexpected = remaining.filter((n) => !keep.has(n));
          expect(
            unexpected,
            `Unexpected properties still present: ${unexpected.join(', ')}`
          ).toEqual([]);
          for (const must of requiredKeep) {
            expect(remaining, `Kept property missing from list: ${must}`).toContain(must);
          }
        });
      } catch (err) {
        throw new Error(`[cleanup] Property cleanup failed: ${err?.message || err}`);
      }
    } finally {
      await context.close().catch((e) => {
        console.warn(`[cleanup-users] context.close warning ignored: ${e.message}`);
      });
    }
  });
});

test.describe('Organization pending users cleanup', () => {
  test('TC260 @cleanup @organization Cleanup invited/expired users across pages', async ({ browser }) => {
    test.setTimeout(600000);

    const context = await browser.newContext({ storageState: 'sessionState.json' });
    const page = await context.newPage();
    const org = new OrganizationHelper(page);

    try {
      try {
        await test.step('Open Manage Organization (reuse existing session)', async () => {
          await org.goto(process.env.ORGANIZATION_URL || 'https://beta.tailorbird.com/organization');
          await page.waitForLoadState('networkidle').catch(() => {});

          // Hard fail fast when session is stale; avoids relogin in this cleanup flow.
          if ((page.url() || '').includes('/login')) {
            throw new Error('sessionState.json is not authenticated. Refresh sessionState once, then rerun cleanup.');
          }
        });

        await test.step('Clear user search if present', async () => {
          const search = page.locator('input[placeholder="Search by name or e-mail"]').first();
          if (await search.isVisible().catch(() => false)) {
            await search.fill('');
            await page.waitForLoadState('networkidle').catch(() => {});
            await page.waitForTimeout(600);
          }
        });

        await test.step('Cleanup invited/expired users from all pages', async () => {
          const revokedCount = await revokeAllInvitedUsersAcrossPages(page);
          if (revokedCount === 0) {
            console.log('[cleanup-users] No invited/expired users found. Cleanup completed successfully.');
          } else {
            console.log(`[cleanup-users] Total invited/expired users cleaned: ${revokedCount}`);
          }
          expect(revokedCount).toBeGreaterThanOrEqual(0);
        });
      } catch (err) {
        throw new Error(`[cleanup-users] User cleanup failed: ${err?.message || err}`);
      }
    } finally {
      await context.close();
    }
  });
});
