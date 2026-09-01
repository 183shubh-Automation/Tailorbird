const { Logger } = require('./logger');

/**
 * Combines ordered strategies into a single real Playwright Locator via `.or()` chaining.
 * This is NOT a custom wrapper class — every existing call site (`.fill()`, `.click()`,
 * `expect(locator).toBeVisible()`, `.waitFor()`) keeps working unchanged on the result.
 * Strategies are tried as alternates by the browser, not strict priority; when both match
 * the same DOM node (the common case — a fallback is just another way of finding the same
 * element) there's no ambiguity. If two DIFFERENT nodes match at once, Playwright's
 * strict-mode error surfaces on use, which is correct "fail loud" behavior rather than
 * silently picking one.
 * @param {{name: string, locator: import('@playwright/test').Locator}[]} strategies ordered, most-specific/stable first
 * @returns {import('@playwright/test').Locator}
 */
function healingLocator(strategies) {
  if (!strategies || strategies.length === 0) {
    throw new Error('healingLocator: at least one strategy is required');
  }
  return strategies.map((s) => s.locator).reduce((combined, locator) => (combined ? combined.or(locator) : locator));
}

/**
 * Best-effort, non-throwing health check: for each tracked element, reports which named
 * strategy is currently live in the DOM. Surfaces drift in logs (primary locator broke,
 * a fallback caught it) before it becomes a hard failure somewhere else in the run.
 * Never throws and never fails the test — purely diagnostic.
 * @param {{label: string, strategies: {name: string, locator: import('@playwright/test').Locator}[]}[]} checks
 * @param {string} [contextLabel]
 * @returns {Promise<{label: string, matched: string|null, strategies: string[]}[]>}
 */
async function logLocatorHealth(checks, contextLabel = 'locator-health') {
  const report = [];
  for (const { label, strategies } of checks) {
    let matched = null;
    for (const strat of strategies) {
      const alive = await strat.locator
        .first()
        .waitFor({ state: 'attached', timeout: 2000 })
        .then(() => true)
        .catch(() => false);
      if (alive) {
        matched = strat.name;
        break;
      }
    }

    if (!matched) {
      Logger.error(
        `[${contextLabel}] "${label}" — NONE of ${strategies.length} strategies matched (${strategies
          .map((s) => s.name)
          .join(', ')}). Update locators — this element may be broken for real users too.`,
      );
    } else if (matched !== strategies[0].name) {
      Logger.info(
        `[${contextLabel}] "${label}" — HEALED via fallback "${matched}" (primary "${strategies[0].name}" did not match — update the source locator to match the live UI).`,
      );
    } else {
      Logger.info(`[${contextLabel}] "${label}" — OK via primary "${matched}"`);
    }

    report.push({ label, matched, strategies: strategies.map((s) => s.name) });
  }
  return report;
}

module.exports = { healingLocator, logLocatorHealth };
