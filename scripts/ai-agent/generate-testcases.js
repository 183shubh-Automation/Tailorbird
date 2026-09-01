require("dotenv").config();

const fs = require("fs");
const path = require("path");

/*
 * ============================================================
 * AI TEST CASE GENERATOR
 * ============================================================
 *
 * This script is responsible for:
 *
 * 1. Reading the approved Notion ticket context
 * 2. Preparing the instructions for Claude Code
 * 3. Making sure Claude generates comprehensive test cases
 * 4. Enforcing exactly SIX test-case categories:
 *
 *    - E2E
 *    - Edge
 *    - Positive
 *    - Negative
 *    - UI
 *    - Visual
 *
 * 5. Supporting approximately 50 test cases or more when
 *    the ticket requires them.
 *
 * IMPORTANT:
 * This script ONLY prepares/validates test-case generation.
 * It does NOT create Playwright automation.
 * ============================================================
 */

const DATA_DIR = path.join(
  __dirname,
  "..",
  "..",
  "data"
);

const TICKET_CONTEXT_FILE = path.join(
  DATA_DIR,
  "current-ticket-context.json"
);

const OUTPUT_JSON_FILE = path.join(
  DATA_DIR,
  "generated-testcases.json"
);

const OUTPUT_MD_FILE = path.join(
  DATA_DIR,
  "generated-testcases.md"
);

const PROMPT_FILE = path.join(
  DATA_DIR,
  "testcase-generation-prompt.md"
);

/*
 * ============================================================
 * ALLOWED TEST CASE TYPES
 * ============================================================
 */

const ALLOWED_TYPES = [
  "E2E",
  "Edge",
  "Positive",
  "Negative",
  "UI",
  "Visual",
];

/*
 * ============================================================
 * ALLOWED PRIORITIES
 * ============================================================
 */

const ALLOWED_PRIORITIES = [
  "P0",
  "P1",
  "P2",
  "P3",
];

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function ensureDataDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {
      recursive: true,
    });
  }
}

function readTicketContext() {
  if (!fs.existsSync(TICKET_CONTEXT_FILE)) {
    throw new Error(
      `Ticket context file not found: ${TICKET_CONTEXT_FILE}`
    );
  }

  const raw = fs.readFileSync(
    TICKET_CONTEXT_FILE,
    "utf8"
  );

  if (!raw.trim()) {
    throw new Error(
      "current-ticket-context.json is empty."
    );
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Invalid JSON in current-ticket-context.json: ${error.message}`
    );
  }
}

/*
 * ============================================================
 * GENERATION PROMPT
 * ============================================================
 */

function buildPrompt(ticketContext) {
  return `
You are an expert Senior QA Engineer and Test Architect.

Your task is to analyze the provided Notion ticket and generate
a comprehensive set of QA test cases.

============================================================
TICKET CONTEXT
============================================================

${JSON.stringify(ticketContext, null, 2)}

============================================================
IMPORTANT OBJECTIVE
============================================================

Generate comprehensive, practical and ticket-specific test cases.

Do NOT generate generic test cases.

Every test case must be directly related to the actual ticket,
its requirements, acceptance criteria, UI behavior, business
logic, validation rules, integrations and user workflows.

There is NO hard limit of 30 test cases.

Approximately 50 test cases is perfectly acceptable.

If the ticket requires fewer test cases, generate fewer.

If the ticket requires more than 50 meaningful test cases,
generate more.

DO NOT create duplicate or meaningless test cases just to reach
a number.

============================================================
MANDATORY TEST CASE CATEGORIES
============================================================

Every generated test case MUST belong to exactly ONE of these
six categories:

1. E2E
2. Edge
3. Positive
4. Negative
5. UI
6. Visual

Use these exact values in the "type" field.

Allowed type values:

- E2E
- Edge
- Positive
- Negative
- UI
- Visual

Do NOT use:

- Visual/UI
- UI/Visual
- Functional
- Regression
- Smoke
- Integration
- Other

============================================================
CATEGORY DEFINITIONS
============================================================

1. E2E

End-to-end scenarios covering a complete real user workflow.

Examples:

- Complete workflow from beginning to successful completion
- Multiple screens/modules involved
- Data created in one area and verified in another
- Full business workflow
- Submit/save/approve/verify flows

These should represent realistic user journeys.

------------------------------------------------------------

2. EDGE

Boundary, unusual or exceptional conditions.

Examples:

- Minimum values
- Maximum values
- Empty states
- Very large data
- Very long text
- Decimal values
- Rapid repeated actions
- Boundary limits
- Missing optional data
- Unusual combinations
- Duplicate operations
- State transitions

------------------------------------------------------------

3. POSITIVE

Valid expected behavior using correct inputs.

Examples:

- Valid data submission
- Successful save
- Correct calculations
- Correct navigation
- Valid file upload
- Expected business rules
- Successful editing
- Successful search/filter
- Correct data persistence

------------------------------------------------------------

4. NEGATIVE

Invalid input or prohibited behavior.

Examples:

- Invalid data
- Missing required fields
- Incorrect values
- Unsupported file type
- Unauthorized operation
- Invalid state transition
- Validation errors
- Save/submit prevention
- Incorrect business conditions

------------------------------------------------------------

5. UI

Functional UI behavior and UI interaction.

Examples:

- Buttons
- Fields
- Dropdowns
- Checkboxes
- Radio buttons
- Modals
- Tables
- Tabs
- Navigation
- Tooltips
- Enabled/disabled states
- Error messages
- Dynamic UI behavior
- Loading states

UI tests should verify functional interface behavior.

------------------------------------------------------------

6. VISUAL

Pure visual and visual-regression-oriented checks.

Examples:

- Alignment
- Spacing
- Typography
- Colors
- Icons
- Borders
- Component sizing
- Responsive layout
- Modal layout
- Table alignment
- Visual hierarchy
- Empty states
- Error-state styling
- Button visual states
- Visual consistency

Do not classify normal UI interaction as Visual unless the
primary purpose of the test is visual appearance.

============================================================
CATEGORY COVERAGE
============================================================

Try to provide meaningful coverage across ALL SIX categories.

Do not put all test cases into Positive/Negative.

A strong test suite should contain a reasonable mixture of:

- E2E
- Edge
- Positive
- Negative
- UI
- Visual

The exact distribution should depend on the ticket.

Do NOT force equal distribution if the ticket does not justify it.

============================================================
TEST CASE STRUCTURE
============================================================

Every test case MUST contain exactly these fields:

{
  "id": "TC001",
  "title": "Short but sufficiently descriptive test case title",
  "type": "Positive",
  "priority": "P1",
  "preconditions": [],
  "steps": [],
  "expectedResult": "..."
}

============================================================
TEST CASE ID
============================================================

IDs must be unique.

Use this format:

TC001
TC002
TC003
...

Continue sequentially.

Do not skip IDs.

Do not duplicate IDs.

============================================================
TEST CASE TITLES
============================================================

Titles should be:

- Human-written
- Clear
- Specific
- Easy to understand
- Short enough to scan
- Descriptive enough to understand the scenario

Avoid overly generic names.

Bad:

"Verify functionality"

Good:

"Verify invoice allocation is saved when total matches invoice amount"

============================================================
PRIORITY
============================================================

Use:

P0 = Critical business functionality

P1 = High priority functionality

P2 = Medium priority functionality

P3 = Low priority / cosmetic / low-risk functionality

Every test case MUST have one of:

P0
P1
P2
P3

============================================================
PRECONDITIONS
============================================================

Preconditions must describe what needs to exist before the test.

Examples:

- User is logged in
- User has access to the required project
- Required configuration exists
- Test data exists
- User is on the required page

Use an empty array when no specific precondition exists.

============================================================
TEST STEPS
============================================================

Steps must be actionable.

Example:

[
  "Open the Add Invoice modal.",
  "Select the required Project.",
  "Select the required Job.",
  "Enter a valid invoice amount.",
  "Allocate the full amount to one contract line item.",
  "Click Save."
]

Do not write vague steps such as:

"Test the feature."

============================================================
EXPECTED RESULT
============================================================

The expected result must clearly describe what should happen.

Avoid vague statements.

Bad:

"The feature works."

Good:

"The invoice is saved successfully and the allocated amount
matches the invoice amount in the saved invoice."

============================================================
IMPORTANT QA COVERAGE
============================================================

Analyze the ticket for all relevant areas, including:

- Functional behavior
- Business rules
- Validation
- Required fields
- Optional fields
- Boundary conditions
- Error handling
- State transitions
- Data persistence
- Calculations
- Permissions
- Navigation
- UI interaction
- Responsive behavior
- Visual consistency
- End-to-end workflows
- Integration behavior
- Existing behavior that could regress

Only include areas that are relevant to the ticket.

============================================================
DO NOT AUTOMATE
============================================================

This task is TEST CASE GENERATION ONLY.

DO NOT:

- Create Playwright tests
- Create .spec.js files
- Modify files inside tests/
- Write automation code
- Use Playwright
- Use Playwright MCP
- Open the application
- Create branches
- Create commits
- Create pull requests

Only create the test-case documentation files.

============================================================
OUTPUT FILE 1
============================================================

Create:

data/generated-testcases.json

Use exactly this top-level structure:

{
  "ticketId": "...",
  "ticketTitle": "...",
  "testCases": [
    {
      "id": "TC001",
      "title": "...",
      "type": "E2E",
      "priority": "P1",
      "preconditions": [],
      "steps": [],
      "expectedResult": "..."
    }
  ]
}

============================================================
OUTPUT FILE 2
============================================================

Create:

data/generated-testcases.md

Use this structure:

# Generated Test Cases

## Ticket Information

Ticket ID: ...

Ticket Title: ...

Total Test Cases: ...

---

## E2E Test Cases

### TCxxx - Test Case Title

- Type: E2E
- Priority: P1

#### Preconditions

- ...

#### Steps

1. ...
2. ...
3. ...

#### Expected Result

...

---

## Edge Cases

...

---

## Positive Cases

...

---

## Negative Cases

...

---

## UI Cases

...

---

## Visual Testing

...

============================================================
FINAL VALIDATION
============================================================

Before finishing verify:

1. generated-testcases.json exists.
2. generated-testcases.md exists.
3. JSON is valid.
4. At least one test case exists.
5. Every test case has all required fields.
6. Every test case has a unique ID.
7. IDs are sequential.
8. Every type is one of:
   E2E
   Edge
   Positive
   Negative
   UI
   Visual
9. Every priority is one of:
   P0
   P1
   P2
   P3
10. Every test case has at least one step.
11. Test cases are specific to the ticket.
12. No duplicate test cases exist.
13. No Playwright files were created.
14. No files inside tests/ were modified.
15. No automation code was created.
16. No branch was created.
17. No commit was created.
18. No pull request was created.

============================================================
FINAL QUALITY RULE
============================================================

Quality is more important than quantity.

Approximately 50 test cases is acceptable.

Generate as many meaningful test cases as the ticket warrants.

Do not stop at 30.

Do not artificially create cases just to reach 50.

Do not omit important scenarios just to keep the count low.
`;
}

/*
 * ============================================================
 * WRITE PROMPT FILE
 * ============================================================
 */

function writePromptFile(prompt) {
  fs.writeFileSync(
    PROMPT_FILE,
    prompt,
    "utf8"
  );

  console.log(
    `✅ Test-case generation prompt created: ${PROMPT_FILE}`
  );
}

/*
 * ============================================================
 * VALIDATE GENERATED TEST CASES
 * ============================================================
 */

function validateGeneratedTestCases() {
  if (!fs.existsSync(OUTPUT_JSON_FILE)) {
    throw new Error(
      `Generated test-case file not found: ${OUTPUT_JSON_FILE}`
    );
  }

  const raw = fs.readFileSync(
    OUTPUT_JSON_FILE,
    "utf8"
  );

  if (!raw.trim()) {
    throw new Error(
      "generated-testcases.json is empty."
    );
  }

  let data;

  try {
    data = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `generated-testcases.json contains invalid JSON: ${error.message}`
    );
  }

  if (!data.ticketId) {
    throw new Error(
      "ticketId is missing from generated-testcases.json."
    );
  }

  if (!data.ticketTitle) {
    throw new Error(
      "ticketTitle is missing from generated-testcases.json."
    );
  }

  if (
    !Array.isArray(data.testCases) ||
    data.testCases.length === 0
  ) {
    throw new Error(
      "No test cases were generated."
    );
  }

  const requiredFields = [
    "id",
    "title",
    "type",
    "priority",
    "preconditions",
    "steps",
    "expectedResult",
  ];

  const ids = new Set();

  const typeCounts = {
    E2E: 0,
    Edge: 0,
    Positive: 0,
    Negative: 0,
    UI: 0,
    Visual: 0,
  };

  data.testCases.forEach(
    (testCase, index) => {
      for (const field of requiredFields) {
        if (
          testCase[field] === undefined ||
          testCase[field] === null
        ) {
          throw new Error(
            `Test case ${
              testCase.id || index + 1
            } is missing required field: ${field}`
          );
        }
      }

      if (ids.has(testCase.id)) {
        throw new Error(
          `Duplicate test case ID: ${testCase.id}`
        );
      }

      ids.add(testCase.id);

      if (
        !ALLOWED_TYPES.includes(
          testCase.type
        )
      ) {
        throw new Error(
          `Invalid test type "${testCase.type}" in ${testCase.id}. ` +
          `Allowed types: ${ALLOWED_TYPES.join(", ")}`
        );
      }

      if (
        !ALLOWED_PRIORITIES.includes(
          testCase.priority
        )
      ) {
        throw new Error(
          `Invalid priority "${testCase.priority}" in ${testCase.id}. ` +
          `Allowed priorities: ${ALLOWED_PRIORITIES.join(", ")}`
        );
      }

      if (
        !Array.isArray(
          testCase.preconditions
        )
      ) {
        throw new Error(
          `Preconditions must be an array in ${testCase.id}`
        );
      }

      if (
        !Array.isArray(testCase.steps)
      ) {
        throw new Error(
          `Steps must be an array in ${testCase.id}`
        );
      }

      if (testCase.steps.length === 0) {
        throw new Error(
          `Test case ${testCase.id} has no steps.`
        );
      }

      typeCounts[testCase.type]++;
    }
  );

  console.log("");
  console.log(
    "======================================"
  );
  console.log(
    "TEST CASE VALIDATION SUCCESSFUL"
  );
  console.log(
    "======================================"
  );

  console.log(
    `Ticket: ${data.ticketId}`
  );

  console.log(
    `Title: ${data.ticketTitle}`
  );

  console.log(
    `Total Test Cases: ${data.testCases.length}`
  );

  console.log("");

  console.log("CATEGORY SUMMARY");

  console.log(
    `E2E:       ${typeCounts.E2E}`
  );

  console.log(
    `Edge:      ${typeCounts.Edge}`
  );

  console.log(
    `Positive:  ${typeCounts.Positive}`
  );

  console.log(
    `Negative:  ${typeCounts.Negative}`
  );

  console.log(
    `UI:        ${typeCounts.UI}`
  );

  console.log(
    `Visual:    ${typeCounts.Visual}`
  );

  console.log(
    "======================================"
  );

  return data;
}

/*
 * ============================================================
 * MAIN
 * ============================================================
 */

async function main() {
  try {
    console.log("");
    console.log(
      "======================================"
    );
    console.log(
      "🤖 AI TEST CASE GENERATOR"
    );
    console.log(
      "======================================"
    );

    ensureDataDirectory();

    /*
     * Read approved ticket context.
     */
    console.log(
      "\n📋 Reading ticket context..."
    );

    const ticketContext =
      readTicketContext();

    console.log(
      `🎫 Ticket: ${
        ticketContext.ticketId ||
        ticketContext.id ||
        "UNKNOWN"
      }`
    );

    console.log(
      `📝 Title: ${
        ticketContext.ticketTitle ||
        ticketContext.title ||
        "UNKNOWN"
      }`
    );

    /*
     * Build Claude prompt.
     */
    console.log(
      "\n🧠 Preparing AI test-case generation prompt..."
    );

    const prompt =
      buildPrompt(ticketContext);

    /*
     * Write prompt for GitHub Actions / Claude.
     */
    writePromptFile(prompt);

    /*
     * If generated-testcases.json already exists,
     * validate it.
     *
     * This makes the script useful both as a prompt
     * preparation script and as a validation step.
     */
    if (
      fs.existsSync(
        OUTPUT_JSON_FILE
      )
    ) {
      console.log(
        "\n🔎 Existing generated-testcases.json found."
      );

      validateGeneratedTestCases();
    } else {
      console.log("");
      console.log(
        "ℹ️ generated-testcases.json does not exist yet."
      );

      console.log(
        "Claude Code should create it using:"
      );

      console.log(
        `   ${PROMPT_FILE}`
      );
    }

    console.log("");
    console.log(
      "======================================"
    );
    console.log(
      "✅ TEST-CASE GENERATION PREPARATION COMPLETE"
    );
    console.log(
      "======================================"
    );

  } catch (error) {
    console.error("");
    console.error(
      "======================================"
    );
    console.error(
      "❌ TEST-CASE GENERATION FAILED"
    );
    console.error(
      "======================================"
    );

    console.error(
      error.message || error
    );

    process.exit(1);
  }
}

main();