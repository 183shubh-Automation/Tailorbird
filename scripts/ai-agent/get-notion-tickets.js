require("dotenv").config();

const { Client } = require("@notionhq/client");
const fs = require("fs");
const path = require("path");

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

const DATA_SOURCE_ID =
  process.env.NOTION_DATA_SOURCE_ID ||
  "201aef20-7051-80c9-96fe-000b582249cd";

const TARGET_STATUS = "Complete";

/*
 * Only pull tickets at this priority.
 *
 * Was not filtered by priority at all before — whatever priority the
 * newest tickets happened to have (often P0) is what got picked.
 * Now explicitly restricted to P1, configurable via env var.
 */
const TARGET_PRIORITY = process.env.TARGET_PRIORITY || "P1";

/*
 * How many tickets to pull per run.
 *
 * Was hard-coded to exactly 1. Now configurable, defaulting to 5.
 */
const MAX_TICKETS = parseInt(
  process.env.MAX_TICKETS || "5",
  10
);

function getText(property) {
  if (!property) return "";

  if (property.type === "title") {
    return (
      property.title
        ?.map((item) => item.plain_text)
        .join("") || ""
    );
  }

  if (property.type === "rich_text") {
    return (
      property.rich_text
        ?.map((item) => item.plain_text)
        .join("") || ""
    );
  }

  return "";
}

function getSelect(property) {
  if (!property) return "";

  return property.select?.name || "";
}

function getStatus(property) {
  if (!property) return "";

  return property.status?.name || "";
}

function getUrl(property) {
  if (!property) return "";

  return property.url || "";
}

function getUniqueId(property) {
  if (!property || !property.unique_id) {
    return "";
  }

  const prefix = property.unique_id.prefix || "";
  const number = property.unique_id.number || "";

  return `${prefix}-${number}`;
}

function mapTicket(page) {
  const properties = page.properties;

  return {
    id: getUniqueId(properties["ID"]),

    title: getText(properties["Name"]),

    status: getStatus(properties["Status"]),

    issueType: getSelect(
      properties["Issue Type"]
    ),

    priority: getSelect(
      properties["Priority"]
    ),

    testType: getText(
      properties["Test_TYPE"]
    ),

    createdTime:
      properties["Created time"]
        ?.created_time || "",

    url:
      getUrl(properties["URL"]) ||
      page.url,

    notionPageId: page.id,
  };
}

async function getAvailableTickets() {
  console.log(
    `🔎 Looking for up to ${MAX_TICKETS} newest Notion tickets with status "${TARGET_STATUS}" and priority "${TARGET_PRIORITY}"...`
  );

  const tickets = [];

  let cursor = undefined;

  do {
    const response = await notion.dataSources.query({
      data_source_id: DATA_SOURCE_ID,

      start_cursor: cursor,

      page_size: 100,

      filter: {
        and: [
          {
            property: "Status",
            status: {
              equals: TARGET_STATUS,
            },
          },
          {
            property: "Priority",
            select: {
              equals: TARGET_PRIORITY,
            },
          },
        ],
      },

      sorts: [
        {
          property: "Created time",
          direction: "descending",
        },
      ],
    });

    for (const page of response.results) {
      tickets.push(mapTicket(page));

      /*
       * Stop as soon as we have enough.
       *
       * Because Notion returns results in descending
       * Created time order, these are always the
       * MAX_TICKETS newest available tickets.
       */
      if (tickets.length >= MAX_TICKETS) {
        return tickets;
      }
    }

    cursor = response.has_more
      ? response.next_cursor
      : undefined;

  } while (cursor);

  return tickets;
}

async function main() {
  try {
    if (!process.env.NOTION_API_KEY) {
      throw new Error(
        "NOTION_API_KEY is missing."
      );
    }

    console.log(
      "\n======================================"
    );

    console.log(
      "AI TICKET SELECTION"
    );

    console.log(
      "======================================"
    );

    /*
     * Find up to MAX_TICKETS available tickets.
     *
     * Only Status = Complete is allowed.
     */
    const tickets = await getAvailableTickets();

    /*
     * No tickets available.
     */
    if (!tickets.length) {
      console.log(
        `\nℹ️ No tickets with status "${TARGET_STATUS}" and priority "${TARGET_PRIORITY}" are available.`
      );

      console.log(
        "Nothing will be sent to Slack."
      );

      /*
       * This is not an error.
       *
       * GitHub Actions should finish successfully
       * when there is simply no ticket waiting.
       */
      process.exit(0);
    }

    /*
     * Save the tickets.
     */
    const outputDir = path.join(
      __dirname,
      "..",
      "..",
      "data"
    );

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, {
        recursive: true,
      });
    }

    const outputFile = path.join(
      outputDir,
      "notion-completed-tickets.json"
    );

    /*
     * Output format is unchanged: an array of tickets.
     *
     * send-ticket-approval.js already loops over this
     * array to build the Slack checkboxes, so no changes
     * are needed there.
     *
     * It will contain:
     *
     * []                    -> no tickets available
     * [ticket]               -> 1 ticket (fewer than MAX_TICKETS were found)
     * [ticket, ticket, ...]  -> up to MAX_TICKETS tickets
     */
    fs.writeFileSync(
      outputFile,
      JSON.stringify(tickets, null, 2),
      "utf8"
    );

    /*
     * Display result.
     */
    console.log(
      "\n======================================"
    );

    console.log(
      `AVAILABLE TICKETS (${tickets.length})`
    );

    console.log(
      "======================================"
    );

    tickets.forEach((ticket, index) => {
      console.log(
        `\n[${index + 1}] ID:       ${ticket.id}`
      );

      console.log(
        `    Title:    ${ticket.title}`
      );

      console.log(
        `    Status:   ${ticket.status}`
      );

      console.log(
        `    Priority: ${ticket.priority || "N/A"}`
      );

      console.log(
        `    Type:     ${ticket.issueType || "N/A"}`
      );

      console.log(
        `    Created:  ${ticket.createdTime}`
      );

      console.log(
        `    URL:      ${ticket.url}`
      );
    });

    console.log(
      "\n======================================"
    );

    console.log(
      `\n✅ ${tickets.length} ticket(s) selected for Slack.`
    );

    console.log(
      `📁 Saved to: ${outputFile}`
    );

    console.log(
      "\n➡️ Waiting for human approval in Slack..."
    );

  } catch (error) {
    console.error(
      "\n❌ Failed to fetch Notion ticket."
    );

    if (error.body) {
      console.error(
        JSON.stringify(
          error.body,
          null,
          2
        )
      );
    } else {
      console.error(
        error.message || error
      );
    }

    process.exit(1);
  }
}

main();