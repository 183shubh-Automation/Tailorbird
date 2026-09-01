const { expect } = require('@playwright/test');
const { Logger } = require('./logger');

/**
 * NEW, additive-only helper — does not modify or duplicate any existing page-object
 * method. Several existing methods across the framework end with a hardcoded, tight
 * terminal wait (e.g. `expect(dialog).not.toBeVisible({ timeout: 45000 })`) that is too
 * short for this environment under real conditions: MCP-verified live on 2026-07-31, a
 * single isolated `DELETE /api/ooo` backend call took ~59.8s with zero concurrent load.
 * Under GitHub Actions' `--workers=4` on a 2 vCPU runner, generic UI/backend latency is
 * materially worse than that single-user baseline.
 *
 * `withExtendedTerminalWait` runs an existing action exactly as-is (reusing 100% of its
 * internal logic, including its own click and internal wait) and, ONLY if it throws,
 * falls back to directly re-checking the same terminal condition with a longer, realistic
 * timeout — rather than blindly bumping timeouts across the board or duplicating the
 * action's logic. If the fallback also fails, the fallback's own error is what surfaces
 * (a genuine failure, not the original tight-timeout error), and if the fallback
 * succeeds, this is where the correction happens.
 */
async function withExtendedTerminalWait(action, fallbackLocator, { timeoutMs = 120000, visible = false, label = 'element' } = {}) {
    try {
        return await action();
    } catch (err) {
        Logger.info(`[resilientRetry] "${label}" action's own wait was too tight — falling back to an extended ${timeoutMs}ms wait (original error: ${err.message.split('\n')[0]})`);
        if (visible) {
            await expect(fallbackLocator, `${label} (extended fallback wait)`).toBeVisible({ timeout: timeoutMs });
        } else {
            await expect(fallbackLocator, `${label} (extended fallback wait)`).not.toBeVisible({ timeout: timeoutMs });
        }
        Logger.success(`[resilientRetry] "${label}" reached the expected state on the extended fallback wait`);
    }
}

/**
 * Retries a full operation (not just its terminal wait) a bounded number of times.
 * Intended for actions whose failure mode is a genuine state race rather than a slow
 * backend — e.g. "locator.uncheck: Clicking the checkbox did not change its state",
 * which happens when a checkbox's underlying row is concurrently re-rendered/reset by
 * another process between the click and the state check. Each retry re-reads current
 * state from scratch (via `action`), so it self-corrects rather than compounding.
 * Never masks a genuine, consistently-reproducing product bug: if every attempt fails
 * with the SAME error, that error propagates unchanged after the final attempt.
 */
async function retryOperation(action, { attempts = 3, delayMs = 1500, label = 'operation' } = {}) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await action();
        } catch (err) {
            lastError = err;
            Logger.info(`[resilientRetry] "${label}" attempt ${attempt}/${attempts} failed: ${err.message.split('\n')[0]}`);
            if (attempt < attempts) {
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
        }
    }
    throw lastError;
}

module.exports = { withExtendedTerminalWait, retryOperation };
