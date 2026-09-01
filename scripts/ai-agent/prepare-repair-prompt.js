const fs = require("fs");
const path = require("path");

/*
 * ============================================================
 * PREPARE ARCHITECTURE REPAIR PROMPT
 * ============================================================
 *
 * Builds a prompt asking Claude to refactor specific flagged
 * raw page/locator usages out of spec files and into
 * locators/*.js + pages/*.js, WITHOUT changing test behavior,
 * assertion values, or intent.
 *
 * Env vars expected:
 *   TICKET_ID
 *   ATTEMPT
 *   MAX_ATTEMPTS
 *
 * Reads:
 *   data/architecture-violations.json
 *   (written by verify-test-architecture.js)
 *
 * Writes:
 *   data/claude-architecture-repair-prompt.md
 * ============================================================
 */

const TICKET_ID = process.env.TICKET_ID || "UNKNOWN";
const ATTEMPT = process.env.ATTEMPT || "1";
const MAX_ATTEMPTS = process.env.MAX_ATTEMPTS || "2";

const VIOLATIONS_FILE = path.join(
  __dirname,
  "..",
  "..",
  "data",
  "architecture-violations.json"
);

const OUTPUT_FILE = path.join(
  __dirname,
  "..",
  "..",
  "data",
  "claude-architecture-repair-prompt.md"
);

function readViolations() {
  if (!fs.existsSync(VIOLATIONS_FILE)) {
    return [];
  }

  try {
    return JSON.parse(fs.readFileSync(VIOLATIONS_FILE, "utf8"));
  } catch (error) {
    return [];
  }
}

function main() {
  const violations = readViolations();

  if (!violations.length) {
    fs.writeFileSync(
      OUTPUT_FILE,
      "No architecture violations to fix.",
      "utf8"
    );
    return;
  }

  const violationList = violations
    .map(
      (v) =>
        `- ${v.file}:${v.lineNumber} (${v.pattern})\n  ${v.snippet}`
    )
    .join("\n\n");

  const prompt = `
# REFACTOR ARCHITECTURE VIOLATIONS — DO NOT CHANGE TEST BEHAVIOR

For ticket ${TICKET_ID}, the following lines in the spec file(s) you
just wrote use the raw Playwright \`page\` object directly instead of
going through the locators/pages layers, violating this repo's
architecture convention:

${violationList}

Your job is to refactor ONLY these lines so they comply, WITHOUT
changing what the test does, what it asserts, or what values it
checks. This is a pure refactor, not a behavior change.

For each violation:

1. If it is a LOCATOR used for an interaction or a scoping/waiting
   call (e.g. \`page.locator(...)\`, \`page.getByRole(...)\` used to
   click, scope, or wait): move the locator definition into the
   appropriate file in locators/*.js as a named function, following
   the existing conventions in that file (multi-locator \`.or()\`
   fallback pattern where the element is not already verified
   elsewhere). Add or extend a method in the matching pages/*.js file
   that uses that locator to perform the action, and call that method
   from the spec instead.

2. If it is a locator used ONLY to read/assert a value (e.g. inside
   an \`expect(page.getByText(...))\` call checking a toast message or
   a dollar amount): add a locator to locators/*.js and a getter
   method to the matching pages/*.js file that returns that Locator
   (or its text, whichever matches this repo's existing getter
   pattern — check how similar existing getters are written first).
   Call that getter from the spec, store the result in a variable,
   then assert on that variable. The exact text/value being asserted
   must NOT change.

3. Do not touch any line that was not listed above.

4. Do not modify the test's logic, flow, preconditions, or the
   meaning of any assertion.

5. After your changes, every one of the flagged lines above should no
   longer exist verbatim in the spec file — the raw \`page.\` call
   should now live in a locators/*.js or pages/*.js file instead.

6. Do not run the tests yourself — they will be re-run automatically
   after you finish, to confirm both the refactor is clean and
   nothing broke.

This is attempt ${ATTEMPT} of ${MAX_ATTEMPTS}.
`.trim();

  fs.writeFileSync(OUTPUT_FILE, prompt, "utf8");

  console.log(
    `Architecture repair prompt (attempt ${ATTEMPT}) saved to: ${OUTPUT_FILE}`
  );
  console.log(`Targeting ${violations.length} violation(s).`);
}

main();