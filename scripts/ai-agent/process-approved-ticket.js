require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { Client } = require("@notionhq/client");

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

const CONTEXT_FILE = path.join(
  __dirname,
  "..",
  "..",
  "data",
  "current-ticket-context.json"
);

const DATA_SOURCE_ID =
  process.env.NOTION_DATA_SOURCE_ID ||
  "201aef20-7051-80c9-96fe-000b582249cd";

const TICKET_ID = process.env.TICKET_ID;

function getText(property) {
  if (!property) return "";

  if (property.type === "title") {
    return (
      property.title
        ?.map(item => item.plain_text)
        .join("") || ""
    );
  }

  if (property.type === "rich_text") {
    return (
      property.rich_text
        ?.map(item => item.plain_text)
        .join("") || ""
    );
  }

  return "";
}

function getSelect(property) {
  return property?.select?.name || "";
}

function getStatus(property) {
  return property?.status?.name || "";
}

function getUrl(property) {
  return property?.url || "";
}

function getUniqueId(property) {
  if (!property?.unique_id) {
    return "";
  }

  const prefix = property.unique_id.prefix || "";
  const number = property.unique_id.number || "";

  return `${prefix}-${number}`;
}

function extractRichText(richText = []) {
  return richText
    .map(item => item.plain_text || "")
    .join("");
}

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

function saveTicketContext(ticket) {
  const outputDir = path.dirname(CONTEXT_FILE);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(
    CONTEXT_FILE,
    JSON.stringify(ticket, null, 2),
    "utf8"
  );
}

async function findTicket() {
  console.log(`🔎 Looking for approved ticket: ${TICKET_ID}`);

  let cursor = undefined;

  do {
    const response = await notion.dataSources.query({
      data_source_id: DATA_SOURCE_ID,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const page of response.results) {
      const properties = page.properties;

      const id = getUniqueId(properties["ID"]);

      if (id === TICKET_ID) {
        return {
          id,
          title: getText(properties["Name"]),
          status: getStatus(properties["Status"]),
          issueType: getSelect(properties["Issue Type"]),
          priority: getSelect(properties["Priority"]),
          testType: getText(properties["Test_TYPE"]),
          createdTime:
            properties["Created time"]?.created_time || "",
          url:
            getUrl(properties["URL"]) ||
            page.url,
          notionPageId: page.id,
        };
      }
    }

    cursor = response.has_more
      ? response.next_cursor
      : undefined;

  } while (cursor);

  return null;
}

async function main() {
  try {
    if (!TICKET_ID) {
      throw new Error("TICKET_ID was not provided.");
    }

    const ticket = await findTicket();

    if (!ticket) {
      throw new Error(
        `Ticket ${TICKET_ID} was not found in Notion.`
      );
    }

    console.log("");
    console.log("======================================");
    console.log("APPROVED TICKET RECEIVED");
    console.log("======================================");
    console.log(`ID:       ${ticket.id}`);
    console.log(`Title:    ${ticket.title}`);
    console.log(`Status:   ${ticket.status}`);
    console.log(`Priority: ${ticket.priority || "N/A"}`);
    console.log(`Type:     ${ticket.issueType || "N/A"}`);
    console.log(`URL:      ${ticket.url}`);
    console.log("======================================");

    console.log("");
    console.log(
      "📖 Fetching full Notion page content..."
    );

    const pageContent = await getNotionPageContent(
      ticket.notionPageId
    );

    saveTicketContext({
      ...ticket,
      pageContent,
    });

    console.log(
      `💾 Saved ticket context to: ${CONTEXT_FILE}`
    );

    console.log("");
    console.log(
      "✅ Ticket successfully received from Slack approval."
    );

    console.log(
      "➡️ Ready for the next AI agent step."
    );

  } catch (error) {
    console.error(
      "\n❌ Failed to process approved ticket."
    );

    console.error(
      error.body?.message ||
      error.message ||
      error
    );

    process.exit(1);
  }
}

main();