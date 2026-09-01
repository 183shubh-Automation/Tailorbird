require('dotenv').config();

const {
  createNotionClient,
  getFeatureBoardSchema,
  getInProgressFeatures,
} = require('./notion-client');

const {
  parseFeature,
  prepareFeatures,
} = require('./notion-feature-parser');

async function main() {
  console.log('');
  console.log('======================================');
  console.log('🤖 TICKET AUTOMATION AGENT');
  console.log('======================================');

  console.log('\n🔐 Checking Notion configuration...');

  if (!process.env.NOTION_API_KEY) {
    throw new Error(
      'NOTION_API_KEY is not configured.'
    );
  }

  if (!process.env.NOTION_DATA_SOURCE_ID) {
    throw new Error(
      'NOTION_DATA_SOURCE_ID is not configured.'
    );
  }

  console.log('✅ Notion API key configured.');
  console.log('✅ Data source ID configured.');

  const notion = createNotionClient();

  // ---------------------------------------------
  // STEP 1 — Verify Feature Board
  // ---------------------------------------------

  console.log(
    '\n🔎 Connecting to Product → Features...'
  );

  const schema =
    await getFeatureBoardSchema(
      notion,
      process.env.NOTION_DATA_SOURCE_ID
    );

  console.log(
    '✅ Feature Board connection successful.'
  );

  console.log('\n📋 Detected properties:');

  for (
    const [name, property]
    of Object.entries(schema.properties || {})
  ) {
    console.log(
      `   ${name} → ${property.type}`
    );
  }

  // ---------------------------------------------
  // STEP 2 — Read In Progress features
  // ---------------------------------------------

  console.log(
    '\n🔎 Searching for Status = In Progress...'
  );

  const pages =
    await getInProgressFeatures(
      notion,
      process.env.NOTION_DATA_SOURCE_ID
    );

  console.log(
    `✅ Notion returned ${pages.length} feature(s).`
  );

  // ---------------------------------------------
  // STEP 3 — Normalize
  // ---------------------------------------------

  const parsedFeatures =
    pages.map(parseFeature);

  // ---------------------------------------------
  // STEP 4 — Filter + Sort
  // ---------------------------------------------

  const features =
    prepareFeatures(parsedFeatures);

  console.log(
    `\n🎯 ${features.length} feature(s) are ready for QA processing.`
  );

  // ---------------------------------------------
  // STEP 5 — Display
  // ---------------------------------------------

  console.log('\n======================================');
  console.log('FEATURES READY FOR APPROVAL');
  console.log('======================================');

  if (features.length === 0) {
    console.log(
      'No In Progress features found.'
    );
  }

  features.forEach((feature, index) => {
    console.log('');
    console.log(
      `${index + 1}. ${feature.featureId || 'NO-ID'}`
    );
    console.log(
      `   Name     : ${feature.name}`
    );
    console.log(
      `   Priority : ${feature.priority || 'NOT SET'}`
    );
    console.log(
      `   Status   : ${feature.status || 'NOT SET'}`
    );
    console.log(
      `   Engineer : ${
        feature.engineer
          .map(person => person.name)
          .filter(Boolean)
          .join(', ') || 'N/A'
      }`
    );
    console.log(
      `   URL      : ${feature.notionUrl || 'N/A'}`
    );
  });

  console.log('');
  console.log('======================================');
  console.log(
    `TOTAL READY: ${features.length}`
  );
  console.log('======================================');

  // ---------------------------------------------
  // STEP 6 — Machine-readable output
  // ---------------------------------------------

  console.log(
    '\n📦 Normalized feature data:'
  );

  console.log(
    JSON.stringify(features, null, 2)
  );
}

main().catch(error => {
  console.error('');
  console.error(
    '❌ NOTION AGENT FAILED'
  );
  console.error('');

  if (error.body) {
    console.error(
      JSON.stringify(
        error.body,
        null,
        2
      )
    );
  } else {
    console.error(error.message);
  }

  process.exit(1);
});