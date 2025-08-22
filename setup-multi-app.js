#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupMultiApp() {
  console.log('🚀 Multi-App Slack Setup\n');
  console.log('This will help you configure multiple Slack apps in one Heroku dyno.\n');

  const envContent = [];

  // App 1 Configuration
  console.log('📱 APP 1 CONFIGURATION (Your current app)\n');
  
  const app1BotToken = await question('App 1 Bot Token (xoxb-...): ');
  const app1SigningSecret = await question('App 1 Signing Secret: ');
  const app1AppToken = await question('App 1 App Token (xapp-...): ');
  const app1ChannelName = await question('App 1 Channel Name (e.g., production-ems-in8code-gwunspoken): ');
  const app1GoogleSheetId = await question('App 1 Google Sheet ID: ');
  const app1GoogleServiceAccountKey = await question('App 1 Google Service Account Key (JSON): ');

  // App 2 Configuration
  console.log('\n📱 APP 2 CONFIGURATION (New app)\n');
  
  const app2BotToken = await question('App 2 Bot Token (xoxb-...): ');
  const app2SigningSecret = await question('App 2 Signing Secret: ');
  const app2AppToken = await question('App 2 App Token (xapp-...): ');
  const app2ChannelName = await question('App 2 Channel Name: ');
  const app2GoogleSheetId = await question('App 2 Google Sheet ID (optional, press Enter to skip): ');
  const app2GoogleServiceAccountKey = await question('App 2 Google Service Account Key (JSON, optional, press Enter to skip): ');

  // Build environment content
  envContent.push('# App 1 Configuration (Your current app)');
  envContent.push(`SLACK_BOT_TOKEN_APP1=${app1BotToken}`);
  envContent.push(`SLACK_SIGNING_SECRET_APP1=${app1SigningSecret}`);
  envContent.push(`SLACK_APP_TOKEN_APP1=${app1AppToken}`);
  envContent.push(`CHANNEL_NAME_APP1=${app1ChannelName}`);
  envContent.push(`GOOGLE_SHEET_ID_APP1=${app1GoogleSheetId}`);
  envContent.push(`GOOGLE_SERVICE_ACCOUNT_KEY_APP1=${app1GoogleServiceAccountKey}`);
  envContent.push('');

  envContent.push('# App 2 Configuration (New app)');
  envContent.push(`SLACK_BOT_TOKEN_APP2=${app2BotToken}`);
  envContent.push(`SLACK_SIGNING_SECRET_APP2=${app2SigningSecret}`);
  envContent.push(`SLACK_APP_TOKEN_APP2=${app2AppToken}`);
  envContent.push(`CHANNEL_NAME_APP2=${app2ChannelName}`);
  
  if (app2GoogleSheetId) {
    envContent.push(`GOOGLE_SHEET_ID_APP2=${app2GoogleSheetId}`);
  }
  if (app2GoogleServiceAccountKey) {
    envContent.push(`GOOGLE_SERVICE_ACCOUNT_KEY_APP2=${app2GoogleServiceAccountKey}`);
  }
  envContent.push('');

  envContent.push('# Fallback Configuration (for backward compatibility)');
  envContent.push(`SLACK_BOT_TOKEN=${app1BotToken}`);
  envContent.push(`SLACK_SIGNING_SECRET=${app1SigningSecret}`);
  envContent.push(`SLACK_APP_TOKEN=${app1AppToken}`);
  envContent.push(`CHANNEL_NAME=${app1ChannelName}`);
  envContent.push(`GOOGLE_SHEET_ID=${app1GoogleSheetId}`);
  envContent.push(`GOOGLE_SERVICE_ACCOUNT_KEY=${app1GoogleServiceAccountKey}`);
  envContent.push('');

  envContent.push('# Shared Configuration');
  envContent.push('PORT=3000');
  envContent.push('NODE_ENV=production');

  // Write to .env file
  const envPath = path.join(process.cwd(), '.env');
  fs.writeFileSync(envPath, envContent.join('\n'));

  console.log('\n✅ Configuration saved to .env file!');
  console.log('\n📋 Next Steps:');
  console.log('1. Create your second Slack app in the Slack API console');
  console.log('2. Set up the global shortcut "Submit for Review" for App 2');
  console.log('3. Install App 2 to your workspace and invite it to the target channel');
  console.log('4. Deploy to Heroku with: git push heroku main');
  console.log('5. Set Heroku config vars for both apps');

  rl.close();
}

setupMultiApp().catch(console.error);
