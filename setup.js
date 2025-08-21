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

async function setup() {
  console.log('🚀 Slack Content Review Workflow - Setup\n');
  
  // Check if .env already exists
  if (fs.existsSync('.env')) {
    const overwrite = await question('.env file already exists. Overwrite? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Setup cancelled.');
      rl.close();
      return;
    }
  }
  
  console.log('Please provide your Slack app credentials:\n');
  
  const botToken = await question('Bot User OAuth Token (xoxb-...): ');
  const signingSecret = await question('Signing Secret: ');
  const appToken = await question('App-Level Token (xapp-...): ');
  
  const useChannelName = await question('Use channel name instead of ID? (Y/n): ');
  let channelConfig;
  
  if (useChannelName.toLowerCase() !== 'n') {
    const channelName = await question('Channel name (without #): ');
    channelConfig = `CHANNEL_NAME=${channelName}`;
  } else {
    const channelId = await question('Channel ID (C...): ');
    channelConfig = `CHANNEL_ID=${channelId}`;
  }
  
  const port = await question('Port (default: 3000): ') || '3000';
  
  // Google Sheets integration
  console.log('\n📊 Google Sheets Integration (Optional):');
  const enableSheets = await question('Enable Google Sheets integration? (y/N): ');
  
  let sheetsConfig = '';
  if (enableSheets.toLowerCase() === 'y') {
    console.log('\nTo set up Google Sheets integration:');
    console.log('1. Go to https://console.cloud.google.com/');
    console.log('2. Create a new project or select existing one');
    console.log('3. Enable Google Sheets API');
    console.log('4. Create a Service Account and download the JSON key');
    console.log('5. Share your Google Sheet with the service account email\n');
    
    const sheetId = await question('Google Sheet ID (from URL): ');
    const serviceAccountKey = await question('Service Account Key JSON (paste the entire JSON): ');
    const sheetRange = await question('Sheet Range (default: Sheet1!A:L): ') || 'Sheet1!A:L';
    
    sheetsConfig = `
# Google Sheets Integration
GOOGLE_SHEET_ID=${sheetId}
GOOGLE_SERVICE_ACCOUNT_KEY=${serviceAccountKey}
GOOGLE_SHEET_RANGE=${sheetRange}`;
  }
  
  // Create .env content
  const envContent = `# Slack App Configuration
SLACK_BOT_TOKEN=${botToken}
SLACK_SIGNING_SECRET=${signingSecret}
SLACK_APP_TOKEN=${appToken}
${channelConfig}
PORT=${port}${sheetsConfig}
`;
  
  // Write .env file
  fs.writeFileSync('.env', envContent);
  
  console.log('\n✅ Environment configuration saved to .env');
  console.log('\n📋 Next steps:');
  console.log('1. Install dependencies: npm install');
  console.log('2. Start the app: npm start');
  console.log('3. Test the shortcut in Slack');
  
  if (enableSheets.toLowerCase() === 'y') {
    console.log('\n📊 Google Sheets setup:');
    console.log('- Make sure your Google Sheet is shared with the service account email');
    console.log('- Ensure the sheet has the correct column structure (A Code, Topic, Asset Name, Status, etc.)');
    console.log('- Test the auto-fill functionality by entering an Asset Code');
  }
  
  rl.close();
}

setup().catch(console.error);
