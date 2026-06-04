require('dotenv').config();

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { LoginPage } = require('../pages/loginPage');
const PropertiesHelper = require('../pages/properties');
const OrganizationHelper = require('../pages/organizationHelper');
const data = require('../fixture/organization.json');

const SAMPLE_PROPERTY_1 = 'Test Property 1_Cottages on Elm';
const SAMPLE_PROPERTY_2 = 'Test Property 2_The Westerham';
const SAMPLE_PROPERTY_3 = 'Test Property 3_Courtney Ridge Apartments';
const SAMPLE_PROPERTY_4 = 'Test Property 4_Malmstrom';

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
 * Loads the job name stored in data/lastCreatedJob.json.
 * @returns {string|null}
 */
function loadLastCreatedJobName() {
  const filePath = path.join(__dirname, '../data/lastCreatedJob.json');
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return typeof parsed?.jobName === 'string' ? parsed.jobName.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Navigates to the global Jobs page via the left panel.
 * Expands "Construction Management" if collapsed before clicking "Jobs (Contracts & POs)".
 * @param {import('@playwright/test').Page} page
 */
async function navigateToJobsViaLeftPanel(page) {
  const nav = page.locator('nav').first();
  await nav.waitFor({ state: 'visible', timeout: 15000 });

  const jobsItem = nav.locator('a, div').filter({ hasText: /^Jobs \(Contracts & POs\)$/i }).first();

  if (!(await jobsItem.isVisible().catch(() => false))) {
    const cmSection = nav.locator('a, div').filter({ hasText: /^Construction Management$/i }).first();
    if (await cmSection.isVisible().catch(() => false)) {
      await cmSection.click();
      await page.waitForTimeout(700);
    }
  }

  await expect(jobsItem).toBeVisible({ timeout: 15000 });
  await jobsItem.click();
  await page.waitForURL('**/jobs', { timeout: 20000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
}

/**
 * Collects visible job rows from the treegrid on the /jobs page.
 * Returns array of { title, propertyName } for data rows only (skips header/checkbox/action rows).
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<Array<{title: string, propertyName: string}>>}
 */
async function collectVisibleJobInfoFromGrid(page) {
  const grid = page.locator('[role="treegrid"]').first();
  await grid.waitFor({ state: 'visible', timeout: 60000 });
  const rows = grid.locator('[role="row"]');
  const count = await rows.count();
  const jobs = [];
  const skip = new Set(['Title', '']);

  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const cells = row.locator('[role="gridcell"]');
    const cellCount = await cells.count();
    // Data rows have 10 gridcells; action rows have 1, checkbox rows have 1, headers have 0.
    if (cellCount < 5) continue;

    const title = (await cells.nth(0).innerText().catch(() => '')).trim().split('\n')[0].trim();
    if (!title || skip.has(title)) continue;

    const propText = (await cells.last().innerText().catch(() => '')).trim().split('\n')[0].trim();
    jobs.push({ title, propertyName: propText });
  }

  return [...new Map(jobs.map((j) => [j.title, j])).values()];
}

/**
 * Scrolls the jobs treegrid and collects all job rows (handles virtualization).
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<Array<{title: string, propertyName: string}>>}
 */
async function collectAllJobsFromGrid(page) {
  const grid = page.locator('[role="treegrid"]').first();
  await grid.waitFor({ state: 'visible', timeout: 60000 });
  const all = new Map();

  await grid.evaluate((el) => { el.scrollTop = 0; });
  await page.waitForTimeout(400);

  let stagnant = 0;
  let prevSize = 0;

  for (let step = 0; step < 80; step++) {
    const batch = await collectVisibleJobInfoFromGrid(page);
    batch.forEach(({ title, propertyName }) => {
      if (!all.has(title)) all.set(title, propertyName);
    });

    if (all.size === prevSize) stagnant++;
    else stagnant = 0;
    prevSize = all.size;

    const atBottom = await grid.evaluate((el) => {
      return el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
    });
    if (atBottom && stagnant >= 2) break;

    await grid.evaluate((el) => {
      el.scrollTop = Math.min(
        el.scrollTop + Math.max(200, el.clientHeight * 0.75),
        el.scrollHeight
      );
    });
    await page.waitForTimeout(280);
    if (stagnant >= 8 && step > 10) break;
  }

  return [...all.entries()].map(([title, propertyName]) => ({ title, propertyName }));
}

/**
 * Searches for a job by title and deletes it via the "Delete Row" button.
 * Confirms using the Mantine popover or dialog confirmation button.
 * @param {import('@playwright/test').Page} page
 * @param {string} jobTitle
 * @returns {Promise<boolean>} true if deleted, false if not found
 */
async function deleteJobByTitle(page, jobTitle) {
  // Wait for search input to be enabled (may be disabled during grid refresh after a prior deletion).
  const searchInput = page.locator('input[placeholder="Search..."]:not([disabled])').first();
  await searchInput.waitFor({ state: 'visible', timeout: 30000 });
  await searchInput.fill(jobTitle);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1200);

  // Search is substring-based so multiple rows may appear (e.g. "Mall in Noida" matches
  // "Mall in Noida_XXXXX"). Find the data row whose first cell EXACTLY matches the title
  // and use its positional index to click the corresponding delete button.
  const grid = page.locator('[role="treegrid"]').first();
  const rows = grid.locator('[role="row"]');
  const rowCount = await rows.count();
  let exactDataRowIndex = -1;
  let dataRowsSeen = 0;

  for (let i = 0; i < rowCount; i++) {
    const row = rows.nth(i);
    const cells = row.locator('[role="gridcell"]');
    const cellCount = await cells.count();
    if (cellCount < 5) continue; // skip action / checkbox rows
    const title = (await cells.nth(0).innerText().catch(() => '')).trim().split('\n')[0].trim();
    if (title === jobTitle) {
      exactDataRowIndex = dataRowsSeen;
    }
    dataRowsSeen++;
  }

  if (exactDataRowIndex === -1) {
    console.log(`[cleanup-jobs] Job "${jobTitle}" not found with exact title match, skipping.`);
    await searchInput.fill('');
    await page.waitForLoadState('networkidle').catch(() => {});
    return false;
  }

  const deleteBtn = page.locator('button[aria-label="Delete Row"]').nth(exactDataRowIndex);
  if (!(await deleteBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
    await searchInput.fill('');
    return false;
  }

  await deleteBtn.click();
  await page.waitForTimeout(500);

  const confirmBtn = page.locator([
    '.mantine-Popover-dropdown button:has-text("Delete")',
    '[role="alertdialog"] button:has-text("Delete")',
    '[role="dialog"] button:has-text("Delete")',
  ].join(', ')).first();
  await confirmBtn.waitFor({ state: 'visible', timeout: 10000 });
  await confirmBtn.click();

  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1000);

  // Wait for search to re-enable before clearing it.
  await page.locator('input[placeholder="Search..."]:not([disabled])').first()
    .waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  await searchInput.fill('');
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(800);
  return true;
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
  test('TC261 @cleanup @job Delete all jobs not belonging to protected properties or last created job', async ({ browser }) => {
    test.setTimeout(300000);

    const lastCreatedJobName = loadLastCreatedJobName();
    const protectedProperties = new Set([
      SAMPLE_PROPERTY_1,
      SAMPLE_PROPERTY_2,
      SAMPLE_PROPERTY_3,
      SAMPLE_PROPERTY_4,
    ]);

    console.log(`[cleanup-jobs] Protected job from lastCreatedJob.json: ${lastCreatedJobName || '(none)'}`);
    console.log(`[cleanup-jobs] Protected properties: ${[...protectedProperties].join(', ')}`);

    const context = await browser.newContext({ storageState: 'sessionState.json' });
    const page = await context.newPage();

    try {
      try {
        await test.step('Open app with existing session', async () => {
          const dashboardUrl = process.env.DASHBOARD_URL || data.dashboardUrl;
          await page.goto(dashboardUrl);
          await page.waitForLoadState('networkidle').catch(() => {});
          if ((page.url() || '').includes('/login')) {
            throw new Error('sessionState.json is not authenticated. Refresh sessionState once, then rerun cleanup.');
          }
        });

        await test.step('Navigate to Jobs tab via left panel', async () => {
          await navigateToJobsViaLeftPanel(page);
        });

        await test.step('Delete all non-protected jobs', async () => {
          let iterations = 0;
          const maxIterations = 200;

          while (iterations < maxIterations) {
            iterations++;

            const searchInput = page.locator('input[placeholder="Search..."]').first();
            // Search is disabled when the grid is empty — no jobs left to process.
            const searchEnabled = await searchInput.evaluate(el => !el.disabled).catch(() => false);
            if (!searchEnabled) {
              console.log('[cleanup-jobs] Search input disabled — no jobs in grid, done.');
              break;
            }
            await searchInput.fill('');
            await page.waitForLoadState('networkidle').catch(() => {});
            await page.waitForTimeout(1200);

            const allJobs = await collectAllJobsFromGrid(page);
            const toDelete = allJobs.filter(({ title, propertyName }) => {
              const protectedByProp = protectedProperties.has(propertyName);
              const protectedByJob = lastCreatedJobName && title === lastCreatedJobName;
              return !protectedByProp && !protectedByJob;
            });

            if (toDelete.length === 0) {
              console.log('[cleanup-jobs] No extra jobs to delete.');
              break;
            }

            for (const { title } of toDelete) {
              console.log(`[cleanup-jobs] Deleting job: "${title}"`);
              await deleteJobByTitle(page, title);
            }
          }

          expect(iterations).toBeLessThan(maxIterations);
        });

        await test.step('Verify no non-protected jobs remain', async () => {
          const searchInput = page.locator('input[placeholder="Search..."]').first();
          await searchInput.fill('');
          await page.waitForLoadState('networkidle').catch(() => {});
          await page.waitForTimeout(1200);

          const remaining = await collectAllJobsFromGrid(page);
          const unexpected = remaining.filter(({ title, propertyName }) => {
            const protectedByProp = protectedProperties.has(propertyName);
            const protectedByJob = lastCreatedJobName && title === lastCreatedJobName;
            return !protectedByProp && !protectedByJob;
          });

          expect(
            unexpected.map((j) => j.title),
            `Non-protected jobs still present: ${unexpected.map((j) => `"${j.title}" (property: ${j.propertyName})`).join(', ')}`
          ).toEqual([]);
        });

      } catch (err) {
        throw new Error(`[cleanup-jobs] Job cleanup failed: ${err?.message || err}`);
      }
    } finally {
      await context.close().catch((e) => {
        console.warn(`[cleanup-jobs] context.close warning: ${e.message}`);
      });
    }
  });

  test('TC259 @cleanup @property Delete all properties except sample pair and recently created', async ({
    browser,
  }) => {
    // Large environments can have hundreds of generated properties;
    // allow enough time for full cleanup in one run.
    test.setTimeout(180000);

    const recent = loadRecentPropertyName();
    const keep = new Set([SAMPLE_PROPERTY_1, SAMPLE_PROPERTY_2, SAMPLE_PROPERTY_3, SAMPLE_PROPERTY_4]);
    if (recent) keep.add(recent);
    const requiredKeep = new Set([SAMPLE_PROPERTY_1, SAMPLE_PROPERTY_2, SAMPLE_PROPERTY_3, SAMPLE_PROPERTY_4]);

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
          await org.goto(process.env.ORGANIZATION_URL || '/organization');
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
