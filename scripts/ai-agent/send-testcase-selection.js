require("dotenv").config();

const { WebClient } = require("@slack/web-api");
const fs = require("fs");
const path = require("path");

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

const CHANNEL_ID = process.env.SLACK_CHANNEL_ID;

const TESTCASES_FILE = path.join(
  __dirname,
  "..",
  "..",
  "data",
  "generated-testcases.json"
);

/*
 * ============================================================
 * CONFIGURATION
 * ============================================================
 */

const CATEGORIES = [
  {
    key: "e2e",
    label: "🔄 E2E TEST CASES",
  },
  {
    key: "edge",
    label: "⚠️ EDGE CASES",
  },
  {
    key: "positive",
    label: "✅ POSITIVE CASES",
  },
  {
    key: "negative",
    label: "❌ NEGATIVE CASES",
  },
  {
    key: "ui",
    label: "🖥️ UI CASES",
  },
  {
    key: "visual",
    label: "👁️ VISUAL TESTING",
  },
];

/*
 * Slack Block Kit has a limit on the number of options
 * inside one checkbox element.
 *
 * We therefore split each CATEGORY into groups of 10.
 *
 * IMPORTANT:
 * This is ONLY a Slack rendering limit.
 * There is NO limit on the total number of generated
 * test cases.
 */
const OPTIONS_PER_CHECKBOX_GROUP = 10;

/*
 * Slack has a maximum number of blocks per message.
 *
 * If there are many test cases, multiple Slack messages
 * may be required.
 *
 * However, we keep the final "Automate Selected Test Cases"
 * button in the final message.
 */
const SLACK_MAX_BLOCKS = 45;

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function normalizeCategory(value) {
  if (!value) {
    return "";
  }

  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function getCategory(testCase) {
  /*
   * Preferred field:
   *
   * testCase.type
   *
   * Also support:
   *
   * category
   * testType
   *
   * This makes the script compatible with slightly different
   * generated-testcases.json structures.
   */

  const rawCategory =
    testCase.type ||
    testCase.category ||
    testCase.testType ||
    "";

  const normalized = normalizeCategory(rawCategory);

  if (
    normalized === "e2e" ||
    normalized === "endtoend" ||
    normalized === "endtoendtesting"
  ) {
    return "e2e";
  }

  if (
    normalized === "edge" ||
    normalized === "edgecase" ||
    normalized === "edgecases"
  ) {
    return "edge";
  }

  if (
    normalized === "positive" ||
    normalized === "positivecase" ||
    normalized === "positivecases"
  ) {
    return "positive";
  }

  if (
    normalized === "negative" ||
    normalized === "negativecase" ||
    normalized === "negativecases"
  ) {
    return "negative";
  }

  if (
    normalized === "ui" ||
    normalized === "uicase" ||
    normalized === "uicases"
  ) {
    return "ui";
  }

  if (
    normalized === "visual" ||
    normalized === "visualtesting" ||
    normalized === "visualtest"
  ) {
    return "visual";
  }

  return "";
}

function getTestCaseId(testCase, index) {
  return (
    testCase.id ||
    testCase.testCaseId ||
    testCase.tcId ||
    `TC${String(index + 1).padStart(3, "0")}`
  );
}

function getTestCaseTitle(testCase) {
  return (
    testCase.title ||
    testCase.name ||
    testCase.testCase ||
    "Untitled test case"
  );
}

function getShortSlackText(text, maxLength = 75) {
  const value = String(text || "").trim();

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.substring(0, maxLength - 3)}...`;
}

function chunkArray(array, size) {
  const chunks = [];

  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }

  return chunks;
}

/*
 * ============================================================
 * LOAD GENERATED TEST CASES
 * ============================================================
 */

function loadTestCases() {
  if (!fs.existsSync(TESTCASES_FILE)) {
    throw new Error(
      `Test case file not found: ${TESTCASES_FILE}`
    );
  }

  const data = JSON.parse(
    fs.readFileSync(TESTCASES_FILE, "utf8")
  );

  const ticketId =
    data.ticketId ||
    data.ticketID ||
    data.ticket ||
    "UNKNOWN";

  const ticketTitle =
    data.ticketTitle ||
    data.title ||
    "Unknown Ticket";

  const testCases =
    Array.isArray(data.testCases)
      ? data.testCases
      : [];

  return {
    ticketId,
    ticketTitle,
    testCases,
  };
}

/*
 * ============================================================
 * GROUP TEST CASES BY CATEGORY
 * ============================================================
 */

function groupTestCases(testCases) {
  const grouped = {
    e2e: [],
    edge: [],
    positive: [],
    negative: [],
    ui: [],
    visual: [],
  };

  const uncategorized = [];

  testCases.forEach((testCase, index) => {
    const category = getCategory(testCase);

    const normalizedTestCase = {
      ...testCase,

      id: getTestCaseId(testCase, index),

      title: getTestCaseTitle(testCase),

      category,
    };

    if (category && grouped[category]) {
      grouped[category].push(
        normalizedTestCase
      );
    } else {
      uncategorized.push(
        normalizedTestCase
      );
    }
  });

  return {
    grouped,
    uncategorized,
  };
}

/*
 * ============================================================
 * CREATE CHECKBOX BLOCKS
 * ============================================================
 */

function createCategoryBlocks(
  category,
  testCases
) {
  const blocks = [];

  if (!testCases.length) {
    return blocks;
  }

  const categoryConfig =
    CATEGORIES.find(
      item => item.key === category
    );

  if (!categoryConfig) {
    return blocks;
  }

  /*
   * Category heading
   */

  blocks.push({
    type: "section",

    text: {
      type: "mrkdwn",

      text:
        `*${categoryConfig.label}*` +
        `\n_${testCases.length} test case${
          testCases.length === 1
            ? ""
            : "s"
        }_`,
    },
  });

  /*
   * Split only for Slack's checkbox option limit.
   */

  const groups = chunkArray(
    testCases,
    OPTIONS_PER_CHECKBOX_GROUP
  );

  groups.forEach(
    (group, groupIndex) => {
      const options = group.map(
        testCase => ({
          text: {
            type: "plain_text",

            text:
              `${testCase.id} | ` +
              getShortSlackText(
                testCase.title,
                65
              ),
          },

          value: testCase.id,
        })
      );

      blocks.push({
        type: "actions",

        block_id:
          `testcase_${category}_${groupIndex + 1}`,

        elements: [
          {
            type: "checkboxes",

            action_id:
              `selected_testcases_${category}_${groupIndex + 1}`,

            options,
          },
        ],
      });
    }
  );

  blocks.push({
    type: "divider",
  });

  return blocks;
}

/*
 * ============================================================
 * CREATE SLACK MESSAGE
 * ============================================================
 */

function createBlocks(
  ticketId,
  ticketTitle,
  testCases,
  grouped,
  uncategorized,
  runId
) {
  const blocks = [];

  /*
   * Header
   */

  blocks.push({
    type: "header",

    text: {
      type: "plain_text",

      text: "🧪 AI Generated Test Cases",
    },
  });

  /*
   * Ticket information
   */

  blocks.push({
    type: "section",

    text: {
      type: "mrkdwn",

      text:
        `*Ticket:* ${ticketId}\n` +
        `*Title:* ${ticketTitle}\n\n` +
        `*Total Test Cases:* ${testCases.length}\n\n` +
        `*Select the test cases you want to automate:*`,
    },
  });

  blocks.push({
    type: "divider",
  });

  /*
   * Category summary
   */

  const summaryLines = [];

  CATEGORIES.forEach(
    category => {
      summaryLines.push(
        `${category.label}: *${grouped[category.key].length}*`
      );
    }
  );

  if (uncategorized.length) {
    summaryLines.push(
      `⚠️ Uncategorized: *${uncategorized.length}*`
    );
  }

  blocks.push({
    type: "section",

    text: {
      type: "mrkdwn",

      text:
        "*Test Case Distribution*\n" +
        summaryLines.join("\n"),
    },
  });

  blocks.push({
    type: "divider",
  });

  /*
   * Add all six categories.
   *
   * IMPORTANT:
   * No slice() is used here.
   *
   * Therefore 30, 40, 50, 60, 100+ generated
   * test cases can all be processed.
   */

  CATEGORIES.forEach(
    category => {
      const categoryBlocks =
        createCategoryBlocks(
          category.key,
          grouped[category.key]
        );

      blocks.push(
        ...categoryBlocks
      );
    }
  );

  /*
   * If Claude generated an unknown category,
   * display those separately instead of silently
   * throwing them away.
   */

  if (uncategorized.length) {
    blocks.push({
      type: "section",

      text: {
        type: "mrkdwn",

        text:
          "*⚠️ UNCATEGORIZED TEST CASES*\n" +
          "_These test cases did not contain a recognized category._",
      },
    });

    const groups = chunkArray(
      uncategorized,
      OPTIONS_PER_CHECKBOX_GROUP
    );

    groups.forEach(
      (group, groupIndex) => {
        blocks.push({
          type: "actions",

          block_id:
            `testcase_uncategorized_${groupIndex + 1}`,

          elements: [
            {
              type: "checkboxes",

              action_id:
                `selected_testcases_uncategorized_${groupIndex + 1}`,

              options: group.map(
                testCase => ({
                  text: {
                    type: "plain_text",

                    text:
                      `${testCase.id} | ` +
                      getShortSlackText(
                        testCase.title,
                        65
                      ),
                  },

                  value: testCase.id,
                })
              ),
            },
          ],
        });
      }
    );

    blocks.push({
      type: "divider",
    });
  }

  /*
   * Final automation button.
   *
   * Send ticket + GitHub run ID.
   */

  blocks.push({
    type: "section",

    text: {
      type: "mrkdwn",

      text:
        "When you are finished selecting test cases, " +
        "click the button below. Only the selected test cases " +
        "will be automated.",
    },
  });

  blocks.push({
    type: "actions",

    block_id:
      "automate_testcases_action",

    elements: [
      {
        type: "button",

        text: {
          type: "plain_text",

          text:
            "Automate Selected Test Cases",
        },

        style: "primary",

        action_id:
          "automate_testcases",

        /*
         * Example:
         *
         * FEAT-1191|32470304965
         */

        value:
          `${ticketId}|${runId}`,
      },
    ],
  });

  return blocks;
}

/*
 * ============================================================
 * SEND BLOCKS TO SLACK
 * ============================================================
 *
 * Slack has a maximum block count per message.
 *
 * The selection controls themselves need to remain together
 * with the final automation button.
 *
 * For normal 50-60 testcase runs this will generally fit.
 *
 * If a very large run exceeds the limit, we fail clearly
 * rather than silently losing test cases.
 */

async function sendToSlack(
  ticketId,
  ticketTitle,
  blocks
) {
  if (blocks.length > SLACK_MAX_BLOCKS) {
    throw new Error(
      `Slack message requires ${blocks.length} blocks, ` +
      `but Slack allows a maximum of ${SLACK_MAX_BLOCKS}. ` +
      `The generated test case count is too large for one ` +
      `interactive Slack message.`
    );
  }

  const response =
    await slack.chat.postMessage({
      channel: CHANNEL_ID,

      text:
        `AI Test Cases Ready - ${ticketId}`,

      blocks,
    });

  return response;
}

/*
 * ============================================================
 * MAIN
 * ============================================================
 */

async function main() {
  try {
    console.log(
      "🤖 Starting AI test-case Slack selection..."
    );

    /*
     * Validate environment variables.
     */

    if (!process.env.SLACK_BOT_TOKEN) {
      throw new Error(
        "SLACK_BOT_TOKEN environment variable is missing."
      );
    }

    if (!CHANNEL_ID) {
      throw new Error(
        "SLACK_CHANNEL_ID environment variable is missing."
      );
    }

    /*
     * Load generated test cases.
     */

    const {
      ticketId,
      ticketTitle,
      testCases,
    } = loadTestCases();

    if (!testCases.length) {
      throw new Error(
        "No test cases were found in generated-testcases.json"
      );
    }

    console.log(
      `📋 Loaded ${testCases.length} test cases for ${ticketId}`
    );

    /*
     * GitHub Actions run ID.
     *
     * This identifies the exact generation run.
     */

    const runId =
      process.env.GITHUB_RUN_ID;

    if (!runId) {
      throw new Error(
        "GITHUB_RUN_ID environment variable is missing."
      );
    }

    console.log(
      `🔗 Test-case generation run ID: ${runId}`
    );

    /*
     * Group test cases by category.
     */

    const {
      grouped,
      uncategorized,
    } = groupTestCases(testCases);

    /*
     * Display category summary in GitHub logs.
     */

    console.log(
      "\n======================================"
    );

    console.log(
      "TEST CASE CATEGORY SUMMARY"
    );

    console.log(
      "======================================"
    );

    CATEGORIES.forEach(
      category => {
        console.log(
          `${category.label}: ` +
          `${grouped[category.key].length}`
        );
      }
    );

    if (uncategorized.length) {
      console.log(
        `⚠️ Uncategorized: ${uncategorized.length}`
      );

      uncategorized.forEach(
        testCase => {
          console.log(
            `   - ${testCase.id} | ${testCase.title}`
          );
        }
      );
    }

    console.log(
      "======================================\n"
    );

    /*
     * Create Slack blocks.
     */

    const blocks = createBlocks(
      ticketId,
      ticketTitle,
      testCases,
      grouped,
      uncategorized,
      runId
    );

    console.log(
      `📦 Generated ${blocks.length} Slack blocks.`
    );

    /*
     * Send Slack message.
     */

    const response =
      await sendToSlack(
        ticketId,
        ticketTitle,
        blocks
      );

    console.log(
      "\n✅ Test-case selection message sent to Slack."
    );

    console.log(
      `Message TS: ${response.ts}`
    );

    console.log(
      `Ticket: ${ticketId}`
    );

    console.log(
      `Total test cases: ${testCases.length}`
    );

    console.log(
      `GitHub run ID: ${runId}`
    );

    console.log(
      "\nCategory counts:"
    );

    CATEGORIES.forEach(
      category => {
        console.log(
          `  ${category.label}: ` +
          `${grouped[category.key].length}`
        );
      }
    );

    console.log(
      "\n🎯 Only the test cases selected in Slack " +
      "will be sent to the automation workflow."
    );

  } catch (error) {
    console.error(
      "\n❌ Failed to send test cases to Slack."
    );

    console.error(
      error.data?.error ||
      error.message ||
      error
    );

    if (error.data) {
      console.error(
        "\nSlack API response:"
      );

      console.error(
        JSON.stringify(
          error.data,
          null,
          2
        )
      );
    }

    process.exit(1);
  }
}

main();