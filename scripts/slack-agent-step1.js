require('dotenv').config();

const { App } = require('@slack/bolt');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

async function start() {
  try {
    await app.start();

    console.log('🤖 Slack Agent is connected.');

    await app.client.chat.postMessage({
      token: process.env.SLACK_BOT_TOKEN,
      channel: process.env.SLACK_CHANNEL_ID,
      text: '🤖 Ticket Automation Agent POC\n\nStatus: ONLINE ✅\n\nLocal Slack connection successful.',
    });

    console.log('✅ Test message sent to Slack.');
  } catch (error) {
    console.error('❌ Slack Agent failed to start.');
    console.error(error);
    process.exit(1);
  }
}

start();