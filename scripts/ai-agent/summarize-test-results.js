const fs = require("fs");
const path = require("path");

/*
 * ============================================================
 * SUMMARIZE TEST RESULTS
 * ============================================================
 *
 * Reads a Playwright JSON-reporter results file and determines,
 * per approved test-case ID, whether it passed, failed, or had
 * no matching test found in the results at all.
 *
 * Matching is done by checking whether the test-case ID string
 * (e.g. "TC042") appears in the test's title — this relies on
 * the repo convention (already enforced in the generation
 * prompt) that the test-case ID is traceable in the test title.
 *
 * Env vars expected:
 *   RESULTS_FILE          Path to Playwright JSON reporter output
 *                          (default: /tmp/new-tests-result.json)
 *   SELECTED_TEST_CASES    Comma-separated list of approved IDs
 *
 * Outputs (two forms, both written):
 *   1. /tmp/test-summary.env — shell-sourceable, for use later in
 *      the SAME workflow step (step outputs aren't readable until
 *      a later step).
 *   2. $GITHUB_OUTPUT (if set) — for use by LATER workflow steps.
 *      Keys: passed_ids, failed_ids, missing_ids, passed_count,
 *      failed_count, all_passed
 *
 * Also writes data/test-failure-details.json — a map of
 * { [testCaseId]: errorMessage } for failing/missing cases, used
 * by prepare-repair-prompt.js to give Claude a targeted error
 * instead of a blanket log dump.
 * ============================================================
 */

const RESULTS_FILE = process.env.RESULTS_FILE || "/tmp/new-tests-result.json";
const SELECTED_TEST_CASES = (process.env.SELECTED_TEST_CASES || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const ENV_OUTPUT_FILE = "/tmp/test-summary.env";
const FAILURE_DETAILS_FILE = path.join(
  __dirname,
  "..",
  "..",
  "data",
  "test-failure-details.json"
);

function collectTests(suite, out) {
  if (!suite) return;

  (suite.specs || []).forEach((spec) => {
    (spec.tests || []).forEach((test) => {
      const results = test.results || [];
      const last = results[results.length - 1];

      out.push({
        title: spec.title || "",
        file: spec.file || "",
        status: last ? last.status : test.status || "unknown",
        error:
          last && last.error
            ? last.error.message || String(last.error)
            : "",
      });
    });
  });

  (suite.suites || []).forEach((child) => collectTests(child, out));
}

function loadAllTests() {
  const allTests = [];

  if (!fs.existsSync(RESULTS_FILE)) {
    console.error(`Results file not found: ${RESULTS_FILE}`);
    return allTests;
  }

  let data;

  try {
    data = JSON.parse(fs.readFileSync(RESULTS_FILE, "utf8"));
  } catch (error) {
    console.error(
      `Failed to parse Playwright JSON results: ${error.message}`
    );
    return allTests;
  }

  (data.suites || []).forEach((suite) => collectTests(suite, allTests));

  return allTests;
}

function shellEscape(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function main() {
  console.log("======================================");
  console.log("TEST RESULT SUMMARY");
  console.log("======================================");

  const allTests = loadAllTests();

  const passedIds = [];
  const failedIds = [];
  const missingIds = [];
  const failureDetails = {};

  for (const id of SELECTED_TEST_CASES) {
    const matches = allTests.filter((t) => t.title.includes(id));

    if (!matches.length) {
      missingIds.push(id);
      failureDetails[id] =
        "No matching test was found in the results for this ID. " +
        "It may not have been implemented, or its title doesn't " +
        "contain the test-case ID as expected.";
      continue;
    }

    const failing = matches.find((t) => t.status !== "passed");

    if (failing) {
      failedIds.push(id);
      failureDetails[id] =
        failing.error || `Test status: ${failing.status} (no error message captured)`;
    } else {
      passedIds.push(id);
    }
  }

  SELECTED_TEST_CASES.forEach((id) => {
    if (passedIds.includes(id)) {
      console.log(`${id}  ✅ passed`);
    } else if (failedIds.includes(id)) {
      console.log(`${id}  ❌ failed`);
    } else {
      console.log(`${id}  ⚠️  no matching test found`);
    }
  });

  const allPassed =
    failedIds.length === 0 &&
    missingIds.length === 0 &&
    passedIds.length > 0;

  console.log("");
  console.log(
    `${passedIds.length} passed, ${failedIds.length} failed, ${missingIds.length} missing (of ${SELECTED_TEST_CASES.length} selected)`
  );

  // --------------------------------------------------
  // Write failure details for the repair prompt
  // --------------------------------------------------

  fs.writeFileSync(
    FAILURE_DETAILS_FILE,
    JSON.stringify(failureDetails, null, 2),
    "utf8"
  );

  // --------------------------------------------------
  // Write shell-sourceable env file (same-step use)
  // --------------------------------------------------

  const envLines = [
    `PASSED_IDS=${shellEscape(passedIds.join(","))}`,
    `FAILED_IDS=${shellEscape([...failedIds, ...missingIds].join(","))}`,
    `PASSED_COUNT=${passedIds.length}`,
    `FAILED_COUNT=${failedIds.length + missingIds.length}`,
    `ALL_PASSED=${allPassed ? "true" : "false"}`,
  ];

  fs.writeFileSync(ENV_OUTPUT_FILE, envLines.join("\n") + "\n", "utf8");

  // --------------------------------------------------
  // Write GITHUB_OUTPUT (later-step use)
  // --------------------------------------------------

  if (process.env.GITHUB_OUTPUT) {
    const outLines = [
      `passed_ids=${passedIds.join(",")}`,
      `failed_ids=${[...failedIds, ...missingIds].join(",")}`,
      `missing_ids=${missingIds.join(",")}`,
      `passed_count=${passedIds.length}`,
      `failed_count=${failedIds.length + missingIds.length}`,
      `all_passed=${allPassed ? "true" : "false"}`,
    ];

    fs.appendFileSync(
      process.env.GITHUB_OUTPUT,
      outLines.join("\n") + "\n",
      "utf8"
    );
  }
}

main();
