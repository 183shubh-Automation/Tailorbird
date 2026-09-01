const fs = require("fs");
const path = require("path");

/*
 * ============================================================
 * FILTER SELECTED TEST CASES
 * ============================================================
 *
 * Input:
 *   data/generated-testcases.json
 *
 * Environment variable:
 *   SELECTED_TEST_CASES
 *
 * Example:
 *   SELECTED_TEST_CASES=TC001,TC007,TC029
 *
 * Output:
 *   data/selected-testcases.json
 *
 * IMPORTANT:
 * Only the test cases explicitly selected in Slack
 * will be passed to the automation workflow.
 * ============================================================
 */

const INPUT_FILE = path.join(
  __dirname,
  "..",
  "..",
  "data",
  "generated-testcases.json"
);

const OUTPUT_FILE = path.join(
  __dirname,
  "..",
  "..",
  "data",
  "selected-testcases.json"
);

// ------------------------------------------------------------
// 1. Read selected test-case IDs from GitHub environment
// ------------------------------------------------------------

const selectedInput =
  process.env.SELECTED_TEST_CASES || "";

console.log("======================================");
console.log("🎯 TEST CASE SELECTION");
console.log("======================================");

console.log(
  `Raw SELECTED_TEST_CASES: "${selectedInput}"`
);

if (!selectedInput.trim()) {
  throw new Error(
    "❌ SELECTED_TEST_CASES is missing or empty. " +
    "No automation will be started."
  );
}

// ------------------------------------------------------------
// 2. Parse selected IDs
// ------------------------------------------------------------

const selectedIds = [
  ...new Set(
    selectedInput
      .split(",")
      .map(id => id.trim())
      .filter(Boolean)
  ),
];

console.log(
  `📋 Selected test-case IDs: ${selectedIds.join(", ")}`
);

console.log(
  `🔢 Number selected: ${selectedIds.length}`
);

// ------------------------------------------------------------
// 3. Verify generated test-case file exists
// ------------------------------------------------------------

if (!fs.existsSync(INPUT_FILE)) {
  throw new Error(
    `❌ Generated test cases file not found:\n${INPUT_FILE}`
  );
}

// ------------------------------------------------------------
// 4. Read generated test cases
// ------------------------------------------------------------

let data;

try {
  data = JSON.parse(
    fs.readFileSync(INPUT_FILE, "utf8")
  );
} catch (error) {
  throw new Error(
    `❌ Failed to parse generated-testcases.json: ${error.message}`
  );
}

const testCases = Array.isArray(data.testCases)
  ? data.testCases
  : [];

if (!testCases.length) {
  throw new Error(
    "❌ generated-testcases.json does not contain any test cases."
  );
}

console.log(
  `📦 Available generated test cases: ${testCases.length}`
);

// ------------------------------------------------------------
// 5. Find only the selected test cases
// ------------------------------------------------------------

const selectedTestCases = testCases.filter(
  testCase =>
    selectedIds.includes(
      String(testCase.id).trim()
    )
);

// ------------------------------------------------------------
// 6. Validate selection
// ------------------------------------------------------------

if (!selectedTestCases.length) {
  throw new Error(
    "❌ None of the selected test cases were found.\n\n" +
    `Selected IDs:\n${selectedIds.join(", ")}\n\n` +
    `Available IDs:\n${testCases
      .map(tc => tc.id)
      .join(", ")}`
  );
}

// Detect IDs that Slack sent but that don't exist
// in generated-testcases.json.

const foundIds = new Set(
  selectedTestCases.map(
    testCase => String(testCase.id).trim()
  )
);

const missingIds = selectedIds.filter(
  id => !foundIds.has(id)
);

if (missingIds.length) {
  console.warn(
    `⚠️ These selected IDs were not found: ${missingIds.join(
      ", "
    )}`
  );
}

// ------------------------------------------------------------
// 7. Preserve category information
// ------------------------------------------------------------

const categoryOrder = [
  "E2E",
  "EDGE",
  "POSITIVE",
  "NEGATIVE",
  "UI",
  "VISUAL",
];

selectedTestCases.sort((a, b) => {
  const categoryA =
    categoryOrder.indexOf(
      String(
        a.category ||
        a.testType ||
        ""
      ).toUpperCase()
    );

  const categoryB =
    categoryOrder.indexOf(
      String(
        b.category ||
        b.testType ||
        ""
      ).toUpperCase()
    );

  if (categoryA !== categoryB) {
    return (
      (categoryA === -1 ? 999 : categoryA) -
      (categoryB === -1 ? 999 : categoryB)
    );
  }

  return String(a.id).localeCompare(
    String(b.id),
    undefined,
    { numeric: true }
  );
});

// ------------------------------------------------------------
// 8. Create output
// ------------------------------------------------------------

const output = {
  ticketId: data.ticketId || "",
  ticketTitle: data.ticketTitle || "",

  selectedCount:
    selectedTestCases.length,

  selectedIds,

  missingIds,

  selectedTestCases,
};

// ------------------------------------------------------------
// 9. Ensure data directory exists
// ------------------------------------------------------------

const outputDir = path.dirname(
  OUTPUT_FILE
);

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, {
    recursive: true,
  });
}

// ------------------------------------------------------------
// 10. Save selected test cases
// ------------------------------------------------------------

fs.writeFileSync(
  OUTPUT_FILE,
  JSON.stringify(output, null, 2),
  "utf8"
);

// ------------------------------------------------------------
// 11. Display result
// ------------------------------------------------------------

console.log("\n======================================");
console.log("✅ SELECTED TEST CASES");
console.log("======================================");

console.log(
  `🎫 Ticket: ${data.ticketId}`
);

console.log(
  `🧪 Selected: ${selectedTestCases.length}`
);

selectedTestCases.forEach(
  (testCase, index) => {
    console.log(
      `${index + 1}. ${testCase.id} | ${
        testCase.category ||
        testCase.testType ||
        "UNCATEGORIZED"
      } | ${testCase.title}`
    );
  }
);

if (missingIds.length) {
  console.log("\n⚠️ Missing IDs:");

  missingIds.forEach(id => {
    console.log(`- ${id}`);
  });
}

console.log("\n======================================");

console.log(
  `📁 Saved to: ${OUTPUT_FILE}`
);

console.log("======================================");