require('dotenv').config();

const { Client } = require('@notionhq/client');

function createNotionClient() {
  if (!process.env.NOTION_API_KEY) {
    throw new Error(
      'NOTION_API_KEY is missing from .env'
    );
  }

  return new Client({
    auth: process.env.NOTION_API_KEY,
  });
}

async function getFeatureBoardSchema(notion, dataSourceId) {
  if (!dataSourceId) {
    throw new Error(
      'NOTION_DATA_SOURCE_ID is missing from .env'
    );
  }

  return notion.dataSources.retrieve({
    data_source_id: dataSourceId,
  });
}

async function getInProgressFeatures(
  notion,
  dataSourceId
) {
  if (!dataSourceId) {
    throw new Error(
      'NOTION_DATA_SOURCE_ID is missing from .env'
    );
  }

  const results = [];

  let cursor = undefined;

  do {
    const response = await notion.dataSources.query({
      data_source_id: dataSourceId,

      filter: {
        property: 'Status',
        status: {
          equals: 'In Progress',
        },
      },

      page_size: 100,

      ...(cursor
        ? { start_cursor: cursor }
        : {}),
    });

    results.push(...response.results);

    cursor = response.has_more
      ? response.next_cursor
      : undefined;

  } while (cursor);

  return results;
}

async function getPageBlocks(
  notion,
  pageId
) {
  const blocks = [];

  let cursor = undefined;

  do {
    const response =
      await notion.blocks.children.list({
        block_id: pageId,
        page_size: 100,

        ...(cursor
          ? { start_cursor: cursor }
          : {}),
      });

    blocks.push(...response.results);

    cursor = response.has_more
      ? response.next_cursor
      : undefined;

  } while (cursor);

  return blocks;
}

module.exports = {
  createNotionClient,
  getFeatureBoardSchema,
  getInProgressFeatures,
  getPageBlocks,
};