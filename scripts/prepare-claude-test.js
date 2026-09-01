const fs = require("fs");
const path = require("path");

const TICKET_FILE = path.join(
  __dirname,
  "..",
  "data",
  "current-ticket-context.json"
);

const SELECTED_TESTCASES_FILE = path.join(
  __dirname,
  "..",
  "data",
  "selected-testcases.json"
);

const OUTPUT_FILE = path.join(
  __dirname,
  "..",
  "data",
  "claude-test-generation-prompt.md"
);

function readJson(filePath, name) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `${name} not found: ${filePath}`
    );
  }

  try {
    return JSON.parse(
      fs.readFileSync(filePath, "utf8")
    );
  } catch (error) {
    throw new Error(
      `Failed to parse ${name}: ${error.message}`
    );
  }
}

function formatTestCase(testCase, index) {
  const steps = Array.isArray(testCase.steps)
    ? testCase.steps
        .map((step, stepIndex) => `${stepIndex + 1}. ${step}`)
        .join("\n")
    : String(testCase.steps || "");

  return `
### ${index + 1}. ${testCase.id} - ${testCase.title}

**Type:** ${testCase.type || "N/A"}

**Priority:** ${testCase.priority || "N/A"}

**Preconditions:**
${testCase.preconditions || "N/A"}

**Steps:**
${steps || "N/A"}

**Expected Result:**
${testCase.expectedResult || "N/A"}
`.trim();
}

function main() {
  console.log("🤖 Preparing Claude test-generation prompt...");

  // --------------------------------------------------
  // Read ticket context
  // --------------------------------------------------

  const ticket = readJson(
    TICKET_FILE,
    "current-ticket-context.json"
  );

  // --------------------------------------------------
  // Read ONLY Slack-approved test cases
  // --------------------------------------------------

  const selectedData = readJson(
    SELECTED_TESTCASES_FILE,
    "selected-testcases.json"
  );

  const selectedTestCases =
    Array.isArray(selectedData.selectedTestCases)
      ? selectedData.selectedTestCases
      : [];

  if (!selectedTestCases.length) {
    throw new Error(
      "No selected test cases were found in selected-testcases.json."
    );
  }

  console.log("");
  console.log("======================================");
  console.log("SLACK-APPROVED TEST CASES");
  console.log("======================================");
  console.log(`Ticket: ${ticket.id}`);
  console.log(
    `Selected test cases: ${selectedTestCases.length}`
  );

  selectedTestCases.forEach(testCase => {
    console.log(
      `- ${testCase.id} | ${testCase.title}`
    );
  });

  console.log("======================================");

  // --------------------------------------------------
  // Build selected test-case documentation
  // --------------------------------------------------

  const selectedTestCaseText =
    selectedTestCases
      .map(formatTestCase)
      .join("\n\n---\n\n");

  // --------------------------------------------------
  // Claude prompt
  // --------------------------------------------------

  const prompt = `
# AI PLAYWRIGHT TEST AUTOMATION TASK

You are an AI QA Automation Engineer working inside the existing
Tailorbird Playwright automation repository.

Your task is to automate ONLY the test cases that were explicitly
selected and approved by a human through Slack.

You must not create, select, invent, or automate any additional
test cases beyond the approved list below.

---

# APPROVED TICKET

Ticket ID:
${ticket.id}

Title:
${ticket.title}

Issue Type:
${ticket.issueType || "N/A"}

Priority:
${ticket.priority || "N/A"}

Status:
${ticket.status || "N/A"}

Notion URL:
${ticket.url || "N/A"}

---

# NOTION TICKET CONTENT

${ticket.pageContent || "No additional ticket content available."}

---

# HUMAN-APPROVED TEST CASES

The following test cases were selected by a human from Slack.

These are the ONLY test cases you are authorized to automate.

${selectedTestCaseText}

---

# STRICT SCOPE RULE

IMPORTANT:

You MUST automate ONLY the test cases listed under
"HUMAN-APPROVED TEST CASES".

DO NOT:

- Create additional test cases.
- Add extra scenarios.
- Add unrelated regression coverage.
- Expand the scope based on your own assumptions.
- Automate test cases that were not selected in Slack.
- Replace an approved test case with a different scenario.
- Modify unrelated existing tests.
- Create generic tests outside the approved list.

If you discover that an approved test case cannot currently be automated,
do not silently replace it with another test case.

Instead, report why that specific approved test case could not be automated.

---

# BEFORE WRITING TESTS

Inspect the existing repository carefully.

You MUST:

1. Inspect the existing tests.
2. Search for related functionality.
3. Search for existing Invoice / Retainage tests.
4. Identify existing login/session helpers.
5. Identify existing fixtures.
6. Identify existing test data.
7. Identify existing invoice creation utilities.
8. Identify existing selectors and page objects.
9. Identify existing helper functions.
10. Determine whether an approved scenario should extend an existing spec
   or use a new spec.
11. Reuse existing framework patterns wherever possible.
12. Avoid creating duplicate coverage.

Do not guess selectors when existing selectors or framework patterns
are available.

---

# TOP PRIORITY — A WORKING PR IS THE GOAL

You have a limited number of turns. Producing a committed, working test
file is the primary deliverable — more valuable than exhaustive
exploration that runs out of budget before anything is written.

Follow this order strictly:

1. Do the MINIMUM exploration needed to understand the target UI
   (check authentication state, locate the feature, identify the
   relevant existing patterns). Do not exhaustively map every element
   on the page before writing anything.
2. Write the locator(s), page-object method(s), and spec file EARLY —
   as soon as you have enough information to make a reasonable
   best-effort attempt, not after you have verified every detail.
3. Only after the file exists, use remaining turns to verify and
   refine it (run the test, fix failures, tighten locators).
4. If you are running low on turns and the implementation is not yet
   perfect, a committed best-effort file with a clear, honest note in
   the final report about what remains unverified is FAR better than
   no file at all. Do not let the pursuit of a fully-verified,
   multi-locator-hardened implementation cause you to run out of turns
   with nothing written.
5. Never spend turns re-confirming something you have already
   confirmed. Move forward once you have enough information to act.

If you reach roughly 70% of your turn budget and have not yet written
the spec file, stop exploring immediately and write your best-effort
implementation with whatever information you currently have.

A browser session MAY already be pre-authenticated for you via the
Playwright MCP server's --storage-state configuration.

Before attempting any login flow:

1. Navigate directly to the dashboard/target URL first.
2. Check whether you are already logged in (look for dashboard
   elements, not a login form).
3. Only perform a manual login if you are NOT already authenticated.

Do not re-login "just to be safe" if the page already shows an
authenticated dashboard. Every unnecessary action consumes turns from
your limited budget — spend them on understanding and building the
feature, not on re-verifying things that are already true.

---

# CODE ARCHITECTURE — STRICT SEPARATION OF CONCERNS

This repository follows a strict three-layer pattern. You MUST follow
it exactly, with no exceptions:

## 1. Locators layer — locators/*.js

- EVERY selector used anywhere in the new code must be defined here,
  not inline in a page object or spec file.
- For any element belonging to UI that has NOT been previously
  automated in this repo (i.e. no existing verified locator to reuse),
  define it as a MULTI-LOCATOR: a primary locator combined with at
  least one fallback locator using Playwright's .or() chaining, e.g.:

  Example (multi-locator with fallback):

  const saveButton = (page) =>
    page.getByRole("button", { name: "Save" })
      .or(page.getByTestId("save-invoice-button"))
      .or(page.locator("button:has-text('Save')"));

  This is required specifically because you cannot fully verify new,
  unautomated UI without a live authenticated pass — a multi-locator
  gives the test a real chance of still finding the element if your
  primary guess about the DOM is wrong.
- Do not define the same logical locator twice in different files.

## 2. Page object layer — pages/*.js

- ALL interactions (click, fill, select, read text, wait, assert
  element state) must be implemented as methods here.
- Page object methods use ONLY locators imported from locators/*.js.
  Never construct a new locator inline inside a page object method.
- Method names should describe the action or capability, not the
  underlying selector (e.g. saveAddInvoiceModal(), not
  clickSaveButton()).

## 3. Spec layer — tests/*.js

- Spec files MUST ONLY call page-object methods.
- A spec file must NEVER contain: page.locator(, page.getByRole(,
  page.getByText(, page.getByLabel(, page.getByTestId(,
  page.getByPlaceholder(, page.click(, page.fill(, page.check(,
  page.selectOption(, or any other direct interaction with the raw
  page object for the feature under test.
- The ONLY acceptable direct use of page in a spec is for
  test.use({ storageState: ... }), top-level navigation via an
  existing page-object goto()-style method, or final expect(...)
  assertions that read state already retrieved through a page-object
  method.

This structure will be automatically checked after you finish. Code
that puts raw locators or raw page interactions inside a spec file
will be flagged and the resulting PR will be marked as needing manual
review, even if the test itself passes. Follow the pattern exactly.

Follow these rules strictly:

- Use Playwright.
- Follow the repository's existing coding style.
- Reuse existing page objects, fixtures and helpers.
- Use stable Playwright locators.
- Do not use arbitrary hardcoded waits.
- Do not use regex locators.
- Use proper Playwright assertions.
- Do not modify unrelated files.
- Do not change framework configuration unless absolutely necessary.
- Keep tests maintainable.
- Follow existing test naming conventions.
- Follow existing folder structure.
- Use existing authentication/session mechanisms.
- Use existing test data where possible.

---

# APPROVED TEST CASE IMPLEMENTATION

For EACH approved test case:

1. Locate the relevant functionality in the existing repository.
2. Determine the correct existing setup and test pattern.
3. Implement the scenario as a Playwright test.
4. Keep the implementation directly aligned with the approved test case.
5. Do not add extra scenarios.
6. Preserve the intent and expected result of the approved test case.

The test case ID should be traceable from the generated test.

For example:

TC001
TC004
TC007

should remain clearly identifiable in the test title or test metadata
according to the repository's existing conventions.

---

# TEST EXECUTION

After implementing the approved test cases:

1. Run the newly created or modified tests.
2. Investigate failures.
3. Fix failures caused by your implementation.
4. Re-run the relevant tests.
5. Do not modify unrelated tests just to make the workflow pass.

If a test cannot be executed because required application data,
environment setup, or functionality is unavailable, report that clearly.

---

# IMPORTANT SAFETY RULE

Do not modify unrelated existing tests.

Do not perform broad refactoring.

Do not change configuration unless absolutely required.

Do not create tests outside the approved Slack selection.

---

# FINAL REPORT

At the end of your work, report:

## Files Created

List every newly created file.

## Files Modified

List every existing file that was modified.

## Approved Test Cases Automated

List each approved test case ID and its implementation status.

Example:

- TC001 - Automated
- TC004 - Automated
- TC007 - Could not automate - reason

## Test Command

Provide the exact command used to execute the tests.

## Test Result

Provide:

- Passed
- Failed
- Blocked

and the relevant details.

## Scenarios Not Automated

If any approved test case could not be automated, explain exactly why.

Remember:

ONLY the human-approved test cases may be automated.
Do not expand the scope.
`.trim();

  // --------------------------------------------------
  // Write Claude prompt
  // --------------------------------------------------

  fs.writeFileSync(
    OUTPUT_FILE,
    prompt,
    "utf8"
  );

  console.log("");
  console.log("======================================");
  console.log("CLAUDE PROMPT READY");
  console.log("======================================");
  console.log(
    `📁 Saved to: ${OUTPUT_FILE}`
  );
  console.log(
    `🎯 Ticket: ${ticket.id} | ${ticket.title}`
  );
  console.log(
    `✅ Approved test cases: ${selectedTestCases.length}`
  );
  console.log("======================================");
}

try {
  main();
} catch (error) {
  console.error("");
  console.error(
    "❌ Failed to prepare Claude prompt."
  );
  console.error(error.message);
  process.exit(1);
}