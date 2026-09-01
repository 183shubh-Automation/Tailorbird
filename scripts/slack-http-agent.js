require("dotenv").config();

const https = require("https");
const { App, ExpressReceiver } = require("@slack/bolt");

// ==================================================
// ENVIRONMENT VARIABLES
// ==================================================

const PORT = Number(process.env.PORT || 3000);

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;

const GH_OWNER = process.env.GH_OWNER;
const GH_REPO = process.env.GH_REPO;
const GH_PAT = process.env.GH_PAT;

// IMPORTANT:
// Actual GitHub workflow filename:
// .github/workflows/ai-generate-testcases.yml

const TESTCASE_GENERATION_WORKFLOW =
  process.env.TESTCASE_GENERATION_WORKFLOW ||
  "ai-generate-testcases.yml";

const APPROVED_TICKET_WORKFLOW =
  process.env.APPROVED_TICKET_WORKFLOW ||
  "ai-approved-ticket.yml";

// ==================================================
// VALIDATION
// ==================================================

if (!SLACK_BOT_TOKEN) {
  throw new Error("SLACK_BOT_TOKEN is missing.");
}

if (!SLACK_SIGNING_SECRET) {
  throw new Error("SLACK_SIGNING_SECRET is missing.");
}

if (!GH_OWNER || !GH_REPO || !GH_PAT) {
  throw new Error(
    "GH_OWNER, GH_REPO, or GH_PAT environment variable is missing."
  );
}

// ==================================================
// SLACK HTTP RECEIVER
// ==================================================

const receiver = new ExpressReceiver({
  signingSecret: SLACK_SIGNING_SECRET,
  endpoints: "/slack/events",
});

// ==================================================
// SLACK BOLT APP
// ==================================================

const app = new App({
  token: SLACK_BOT_TOKEN,
  receiver,
});

// ==================================================
// HEALTH CHECK
// ==================================================

receiver.app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "tailorbird-slack-agent",
  });
});

// ==================================================
// GITHUB WORKFLOW DISPATCH
// ==================================================

function dispatchGitHubWorkflow(workflowFile, inputs) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      ref: "main",
      inputs,
    });

    const options = {
      hostname: "api.github.com",

      path:
        `/repos/${GH_OWNER}/${GH_REPO}` +
        `/actions/workflows/${workflowFile}/dispatches`,

      method: "POST",

      headers: {
        Authorization: `Bearer ${GH_PAT}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "tailorbird-ai-ticket-agent",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    };

    console.log("");
    console.log("======================================");
    console.log("🚀 GITHUB WORKFLOW DISPATCH");
    console.log("======================================");
    console.log(`Workflow: ${workflowFile}`);
    console.log(`Repository: ${GH_OWNER}/${GH_REPO}`);
    console.log(`Inputs: ${JSON.stringify(inputs)}`);
    console.log("======================================");

    const request = https.request(options, (response) => {
      let responseBody = "";

      response.on("data", (chunk) => {
        responseBody += chunk;
      });

      response.on("end", () => {
        if (
          response.statusCode >= 200 &&
          response.statusCode < 300
        ) {
          console.log(
            `✅ GitHub workflow dispatched successfully.`
          );

          console.log(
            `   Workflow: ${workflowFile}`
          );

          console.log(
            `   Status: ${response.statusCode}`
          );

          resolve({
            statusCode: response.statusCode,
            body: responseBody,
          });

          return;
        }

        reject(
          new Error(
            `GitHub workflow dispatch failed. ` +
              `Workflow: ${workflowFile}. ` +
              `Status: ${response.statusCode}. ` +
              `Response: ${responseBody}`
          )
        );
      });
    });

    request.on("error", (error) => {
      reject(error);
    });

    request.write(payload);
    request.end();
  });
}

// ==================================================
// EXTRACT CHECKBOX SELECTIONS
// ==================================================

function getCheckboxSelections(body) {
  const stateValues = body.state?.values || {};

  const selections = [];

  for (const blockId of Object.keys(stateValues)) {
    const block = stateValues[blockId];

    for (const actionId of Object.keys(block)) {
      const action = block[actionId];

      if (
        action.type === "checkboxes" &&
        Array.isArray(action.selected_options)
      ) {
        for (const option of action.selected_options) {
          if (option.value) {
            selections.push(option.value);
          }
        }
      }
    }
  }

  return [...new Set(selections)];
}

// ==================================================
// EXTRACT RADIO BUTTON SELECTION (single ticket)
// ==================================================
//
// Slack's radio_buttons element sends a single
// selected_option object under action.selected_option,
// NOT an array like checkboxes.
// ==================================================

function getRadioSelection(body) {
  const stateValues = body.state?.values || {};

  for (const blockId of Object.keys(stateValues)) {
    const block = stateValues[blockId];

    for (const actionId of Object.keys(block)) {
      const action = block[actionId];

      if (
        action.type === "radio_buttons" &&
        action.selected_option &&
        action.selected_option.value
      ) {
        return action.selected_option.value;
      }
    }
  }

  return null;
}

// ==================================================
// STAGE 1
//
// SELECT ONE NOTION TICKET (radio buttons)
//
// Slack action_id:
// approve_ticket
// ==================================================

app.action(
  "approve_ticket",
  async ({ ack, body, client }) => {
    // IMPORTANT:
    // Slack must receive acknowledgement immediately.
    await ack();

    console.log("");
    console.log("======================================");
    console.log("🎫 TICKET APPROVAL RECEIVED");
    console.log("======================================");

    console.log(
      "Raw Slack action:",
      JSON.stringify(body.actions?.[0] || {}, null, 2)
    );

    // ----------------------------------------------
    // Extract the single selected ticket
    // ----------------------------------------------

    const selectedTicket = getRadioSelection(body);

    console.log(
      "Selected ticket:",
      selectedTicket
    );

    // ----------------------------------------------
    // Validate
    // ----------------------------------------------

    if (!selectedTicket) {
      console.error(
        "❌ No ticket selected."
      );

      await client.chat.postMessage({
        channel: body.channel.id,

        text:
          "⚠️ No ticket was selected.\n\n" +
          "Please select exactly one ticket before clicking " +
          "'Start Automation for Selected Ticket'.",
      });

      return;
    }

    console.log(
      `✅ Ticket approved: ${selectedTicket}`
    );

    // ----------------------------------------------
    // Trigger test-case generation
    // ----------------------------------------------

    try {
      console.log("");
      console.log(
        `🚀 Starting test-case generation for ${selectedTicket}...`
      );

      await dispatchGitHubWorkflow(
        TESTCASE_GENERATION_WORKFLOW,
        {
          ticket_id: selectedTicket,
        }
      );

      console.log(
        `✅ Test-case generation started for ${selectedTicket}`
      );

      // --------------------------------------------
      // Slack confirmation
      // --------------------------------------------

      await client.chat.postMessage({
        channel: body.channel.id,

        text:
          `✅ *Ticket approved: ${selectedTicket}*\n\n` +
          `🤖 Test-case generation has been started.\n\n` +
          `Once the test cases are generated, a second approval ` +
          `message will appear where you can select which test ` +
          `cases should actually be automated.`,
      });

      console.log("");
      console.log("🎉 STAGE 1 COMPLETED");
      console.log(`Ticket approved: ${selectedTicket}`);
      console.log("======================================");
    } catch (error) {
      console.error(
        `❌ Failed to start generation for ${selectedTicket}:`,
        error.message
      );

      await client.chat.postMessage({
        channel: body.channel.id,

        text:
          `❌ *Failed to generate test cases for ${selectedTicket}*\n\n` +
          `${error.message}`,
      });
    }
  }
);

// ==================================================
// STAGE 2
//
// SELECT TEST CASES
//
// Slack action_id:
// automate_testcases
// ==================================================

app.action(
  "automate_testcases",
  async ({ ack, body, client }) => {
    // IMPORTANT:
    // Slack must receive acknowledgement immediately.
    await ack();

    console.log("");
    console.log("======================================");
    console.log("🧪 TEST CASE APPROVAL RECEIVED");
    console.log("======================================");

    console.log(
      "Raw Slack action:",
      JSON.stringify(body.actions?.[0] || {}, null, 2)
    );

    // ----------------------------------------------
    // Button value format:
    //
    // FEAT-1134|32692036243
    //
    // ticket_id | generation_run_id
    // ----------------------------------------------

    const buttonValue =
      body.actions?.[0]?.value || "";

    const [ticketId, generationRunId] =
      buttonValue.split("|");

    console.log(
      `Ticket ID: ${ticketId || "UNKNOWN"}`
    );

    console.log(
      `Generation Run ID: ${
        generationRunId || "UNKNOWN"
      }`
    );

    // ----------------------------------------------
    // Get selected test cases
    // ----------------------------------------------

    const selectedTestCases =
      getCheckboxSelections(body);

    console.log(
      "Selected test cases:",
      selectedTestCases
    );

    // ----------------------------------------------
    // Validate ticket
    // ----------------------------------------------

    if (!ticketId) {
      console.error(
        "❌ Ticket ID is missing."
      );

      await client.chat.postMessage({
        channel: body.channel.id,

        text:
          "❌ Unable to start automation because the ticket ID is missing.",
      });

      return;
    }

    // ----------------------------------------------
    // Validate generation run ID
    // ----------------------------------------------

    if (!generationRunId) {
      console.error(
        "❌ Generation run ID is missing."
      );

      await client.chat.postMessage({
        channel: body.channel.id,

        text:
          `❌ Unable to start automation for ${ticketId} because the generation workflow run ID is missing.`,
      });

      return;
    }

    // ----------------------------------------------
    // Validate selected test cases
    // ----------------------------------------------

    if (selectedTestCases.length === 0) {
      console.error(
        "❌ No test cases selected."
      );

      await client.chat.postMessage({
        channel: body.channel.id,

        text:
          "⚠️ No test cases were selected.\n\n" +
          "Please select at least one test case.",
      });

      return;
    }

    // ----------------------------------------------
    // Approval information
    // ----------------------------------------------

    console.log(
      `✅ Human approved ${selectedTestCases.length} test case(s).`
    );

    selectedTestCases.forEach((testCaseId) => {
      console.log(
        `   - ${testCaseId}`
      );
    });

    // ----------------------------------------------
    // Trigger AI Approved Ticket workflow
    // ----------------------------------------------

    try {
      console.log("");
      console.log(
        "🚀 Triggering AI Approved Ticket workflow..."
      );

      await dispatchGitHubWorkflow(
        APPROVED_TICKET_WORKFLOW,
        {
          ticket_id: ticketId,

          selected_test_cases:
            selectedTestCases.join(","),

          generation_run_id:
            generationRunId,
        }
      );

      console.log(
        `✅ AI Approved Ticket workflow triggered for ${ticketId}`
      );

      // --------------------------------------------
      // Slack confirmation
      // --------------------------------------------

      await client.chat.postMessage({
        channel: body.channel.id,

        text:
          `✅ *Automation started for ${ticketId}*\n\n` +
          `Selected test cases:\n` +
          selectedTestCases
            .map((testCase) => `• ${testCase}`)
            .join("\n") +
          `\n\n` +
          `🤖 Claude will automate only these approved test cases.`,
      });

      console.log("");
      console.log(
        "🎉 STAGE 2 COMPLETED"
      );
    } catch (error) {
      console.error(
        "❌ Failed to trigger AI Approved Ticket workflow:",
        error.message
      );

      await client.chat.postMessage({
        channel: body.channel.id,

        text:
          `❌ *Failed to start automation for ${ticketId}*\n\n` +
          `Error: ${error.message}`,
      });
    }

    console.log(
      "======================================"
    );
  }
);

// ==================================================
// START SERVER
// ==================================================

async function start() {
  try {
    await app.start(PORT);

    console.log(
      "🤖 Tailorbird Slack HTTP Agent is running."
    );

    console.log(
      `🌐 Health endpoint: http://localhost:${PORT}/health`
    );

    console.log(
      "👂 Waiting for Slack ticket and test-case selections..."
    );

    console.log("");
    console.log(
      "🎫 Stage 1 listener: approve_ticket"
    );

    console.log(
      "🧪 Stage 2 listener: automate_testcases"
    );

    console.log("");
    console.log(
      `📋 Test-case generation workflow: ${TESTCASE_GENERATION_WORKFLOW}`
    );

    console.log(
      `🤖 Approved-ticket workflow: ${APPROVED_TICKET_WORKFLOW}`
    );

    console.log("");
  } catch (error) {
    console.error(
      "❌ Failed to start Slack HTTP Agent:",
      error
    );

    process.exit(1);
  }
}

start();