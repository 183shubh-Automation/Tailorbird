require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { App } = require("@slack/bolt");
const { Client } = require("@notionhq/client");
const https = require("https");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

const TICKETS_FILE = path.join(
  __dirname,
  "..",
  "data",
  "notion-completed-tickets.json"
);

const APPROVED_TICKETS_FILE = path.join(
  __dirname,
  "..",
  "data",
  "approved-notion-tickets.json"
);

// --------------------------------------------------
// Load tickets selected from Notion
// --------------------------------------------------

function loadNotionTickets() {
  if (!fs.existsSync(TICKETS_FILE)) {
    throw new Error(
      `Notion ticket file not found: ${TICKETS_FILE}`
    );
  }

  return JSON.parse(
    fs.readFileSync(TICKETS_FILE, "utf8")
  );
}

// --------------------------------------------------
// Extract plain text from Notion rich text
// --------------------------------------------------

function extractRichText(richText = []) {
  return richText
    .map(item => item.plain_text || "")
    .join("");
}

// --------------------------------------------------
// Convert a Notion block to readable text
// --------------------------------------------------

function extractBlockText(block) {
  if (!block) return "";

  const type = block.type;
  const content = block[type];

  if (!content) return "";

  if (content.rich_text) {
    return extractRichText(content.rich_text);
  }

  if (content.text) {
    return extractRichText(content.text);
  }

  return "";
}

// --------------------------------------------------
// Fetch complete Notion page content
// --------------------------------------------------

async function getNotionPageContent(pageId) {
  const blocks = [];

  let cursor = undefined;

  do {
    const response = await notion.blocks.children.list({
      block_id: pageId,
      start_cursor: cursor,
      page_size: 100,
    });

    blocks.push(...response.results);

    cursor = response.has_more
      ? response.next_cursor
      : undefined;
  } while (cursor);

  return blocks
    .map(extractBlockText)
    .filter(Boolean)
    .join("\n");
}

// --------------------------------------------------
// Save approved tickets
// --------------------------------------------------

function saveApprovedTickets(tickets) {
  const outputDir = path.dirname(APPROVED_TICKETS_FILE);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(
    APPROVED_TICKETS_FILE,
    JSON.stringify(tickets, null, 2),
    "utf8"
  );
}

// --------------------------------------------------
// Extract ALL checkbox selections from Slack
// --------------------------------------------------

function getSelectedTickets(body) {
  const stateValues = body.state?.values || {};

  const selectedTickets = [];

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
            selectedTickets.push(option.value);
          }
        }
      }
    }
  }

  return [...new Set(selectedTickets)];
}

// --------------------------------------------------
// Trigger GitHub Actions workflow for approved ticket
// --------------------------------------------------

function triggerGitHubWorkflow(ticketId) {
  return new Promise((resolve, reject) => {
    const owner = process.env.GH_OWNER;
    const repo = process.env.GH_REPO;
    const token = process.env.GH_PAT;

    if (!owner || !repo || !token) {
      return reject(
        new Error(
          "Missing GITHUB_OWNER, GITHUB_REPO, or GITHUB_TOKEN environment variable."
        )
      );
    }

    const payload = JSON.stringify({
      ref: "main",
      inputs: {
        ticket_id: ticketId,
      },
    });

    const options = {
      hostname: "api.github.com",
      path: `/repos/${owner}/${repo}/actions/workflows/ai-approved-ticket.yml/dispatches`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "tailorbird-ai-ticket-agent",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    };

    const request = https.request(options, response => {
      let responseBody = "";

      response.on("data", chunk => {
        responseBody += chunk;
      });

      response.on("end", () => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          console.log(
            `✅ GitHub workflow triggered for ${ticketId}`
          );

          resolve();
        } else {
          reject(
            new Error(
              `GitHub workflow dispatch failed for ${ticketId}. ` +
              `Status: ${response.statusCode}. ` +
              `Response: ${responseBody}`
            )
          );
        }
      });
    });

    request.on("error", error => {
      reject(error);
    });

    request.write(payload);
    request.end();
  });
}
// --------------------------------------------------
// Approval button handler
// --------------------------------------------------

app.action(
  "approve_tickets",
  async ({ ack, body, client }) => {
    // Always acknowledge Slack immediately.
    await ack();

    console.log("\n🔔 Approval button clicked.");

    const requestId = body.actions?.[0]?.value;

    console.log(`Request ID: ${requestId || "UNKNOWN"}`);

    // ------------------------------------------------
    // Get selected FEAT IDs
    // ------------------------------------------------

    const selectedTicketIds = getSelectedTickets(body);

    console.log(
      "Selected tickets:",
      selectedTicketIds
    );

    // ------------------------------------------------
    // Safety check
    // ------------------------------------------------

    if (selectedTicketIds.length === 0) {
      console.log(
        "⚠️ No tickets selected."
      );

      await client.chat.postMessage({
        token: process.env.SLACK_BOT_TOKEN,
        channel: body.channel.id,
        text:
          "⚠️ *No tickets were selected.*\n\n" +
          "Nothing has been approved or processed.",
      });

      return;
    }

    // ------------------------------------------------
    // Load tickets from Notion JSON
    // ------------------------------------------------

    const notionTickets = loadNotionTickets();

    // ------------------------------------------------
    // Match selected FEAT IDs
    // ------------------------------------------------

    const selectedTickets = notionTickets.filter(ticket =>
      selectedTicketIds.includes(ticket.id)
    );

    console.log("\n✅ HUMAN APPROVAL RECEIVED");

    console.log("Approved tickets:");

    selectedTickets.forEach(ticket => {
      console.log(
        `   - ${ticket.id} | ${ticket.title}`
      );
    });
    // --------------------------------------------------
    // Trigger GitHub Actions for approved tickets
    // --------------------------------------------------

    console.log(
      "\n🚀 Triggering GitHub Actions for approved tickets..."
    );

    for (const ticket of selectedTickets) {
      try {
        await triggerGitHubWorkflow(ticket.id);

        console.log(
          `   ✅ ${ticket.id} sent to GitHub Actions`
        );
      } catch (error) {
        console.error(
          `   ❌ Failed to trigger GitHub for ${ticket.id}:`,
          error.message
        );

        await client.chat.postMessage({
          token: process.env.SLACK_BOT_TOKEN,
          channel: body.channel.id,
          text:
            `❌ Failed to start automation for *${ticket.id}*.\n\n` +
            `Error: ${error.message}`,
        });

        return;
      }
    }

    // ------------------------------------------------
    // Fetch actual Notion page content
    // ------------------------------------------------

    console.log(
      "\n📖 Fetching approved ticket details from Notion..."
    );

    const approvedTickets = [];

    for (const ticket of selectedTickets) {
      try {
        console.log(
          `   Reading ${ticket.id}...`
        );

        const pageContent =
          await getNotionPageContent(
            ticket.notionPageId
          );

        approvedTickets.push({
          ...ticket,
          pageContent,
          approvedBy: body.user?.id || "UNKNOWN_USER",
          approvedAt: new Date().toISOString(),
        });

        console.log(
          `   ✅ ${ticket.id} details fetched`
        );
      } catch (error) {
        console.error(
          `   ❌ Failed to fetch ${ticket.id}:`,
          error.body?.message ||
          error.message ||
          error
        );

        approvedTickets.push({
          ...ticket,
          pageContent: "",
          detailsFetchError:
            error.body?.message ||
            error.message ||
            "Unknown error",
          approvedBy: body.user?.id || "UNKNOWN_USER",
          approvedAt: new Date().toISOString(),
        });
      }
    }

    // ------------------------------------------------
    // Save approved tickets
    // ------------------------------------------------

    saveApprovedTickets(approvedTickets);

    console.log(
      `\n💾 Saved approved tickets to:`
    );

    console.log(
      APPROVED_TICKETS_FILE
    );

    // ------------------------------------------------
    // Update original Slack message
    // ------------------------------------------------

    const approvedList = approvedTickets
      .map(ticket =>
        `• *${ticket.id}* — ${ticket.title}`
      )
      .join("\n");

    await client.chat.update({
      token: process.env.SLACK_BOT_TOKEN,
      channel: body.channel.id,
      ts: body.message.ts,

      text:
        `Ticket approval completed for ${requestId}`,

      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "✅ Ticket Approval Completed",
          },
        },

        {
          type: "section",
          text: {
            type: "mrkdwn",
            text:
              `*Request ID:* \`${requestId || "N/A"}\`\n` +
              `*Status:* \`APPROVED\`\n` +
              `*Approved by:* <@${body.user?.id || "UNKNOWN_USER"}>`,
          },
        },

        {
          type: "section",
          text: {
            type: "mrkdwn",
            text:
              "*Approved tickets:*\n" +
              approvedList,
          },
        },

        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text:
                "🔒 Approval completed. " +
                "Ticket details have been fetched from Notion.",
            },
          ],
        },
      ],
    });

    console.log(
      "\n🎉 Notion → Slack approval completed."
    );

    console.log(
      "➡️ Approved ticket details are now ready for the next agent step."
    );
  }
);

// --------------------------------------------------
// Start Slack listener
// --------------------------------------------------

async function start() {
  try {
    await app.start();

    console.log(
      "🤖 Slack Agent is connected."
    );

    console.log(
      "👂 Waiting for ticket approval..."
    );
  } catch (error) {
    console.error(
      "❌ Slack Agent failed to start."
    );

    console.error(
      error.data?.error ||
      error.message ||
      error
    );

    process.exit(1);
  }
}

start();