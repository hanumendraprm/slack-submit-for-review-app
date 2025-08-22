require('dotenv').config();
const GoogleSheetsService = require('./googleSheets');

async function testGoogleSheets() {
  console.log('🔍 Testing Google Sheets Connections...\n');

  // Test App 1 Google Sheets
  console.log('📊 Testing App 1 (Review Workflow) Google Sheets...');
  const googleSheets1 = new GoogleSheetsService();
  
  try {
    await googleSheets1.initialize(
      process.env.GOOGLE_SHEET_ID_APP1 || process.env.GOOGLE_SHEET_ID,
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY_APP1 || process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    );
    console.log('✅ App 1 Google Sheets connected successfully');
    
    // Test fetching assets
    const assets = await googleSheets1.getAllAssets();
    console.log(`   Found ${assets.length} assets in the sheet`);
    
    if (assets.length > 0) {
      const firstAsset = assets[0];
      console.log(`   Sample asset: ${firstAsset.assetCode} - ${firstAsset.topic}`);
      
      // Test fetching by code
      const testAsset = await googleSheets1.getAssetByCode(firstAsset.assetCode);
      if (testAsset) {
        console.log(`   ✅ Successfully fetched asset by code: ${testAsset.assetCode}`);
      } else {
        console.log(`   ❌ Failed to fetch asset by code: ${firstAsset.assetCode}`);
      }
    }
    
  } catch (error) {
    console.log(`❌ App 1 Google Sheets connection failed: ${error.message}`);
  }

  console.log('\n📊 Testing App 2 (Resource Request) Google Sheets...');
  const googleSheets2 = new GoogleSheetsService();
  
  try {
    await googleSheets2.initialize(
      process.env.GOOGLE_SHEET_ID_APP2,
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY_APP2
    );
    console.log('✅ App 2 Google Sheets connected successfully');
    
    // Test fetching assets
    const assets = await googleSheets2.getAllAssets();
    console.log(`   Found ${assets.length} assets in the sheet`);
    
    if (assets.length > 0) {
      const firstAsset = assets[0];
      console.log(`   Sample asset: ${firstAsset.assetCode} - ${firstAsset.topic}`);
      
      // Test fetching by code
      const testAsset = await googleSheets2.getAssetByCode(firstAsset.assetCode);
      if (testAsset) {
        console.log(`   ✅ Successfully fetched asset by code: ${testAsset.assetCode}`);
      } else {
        console.log(`   ❌ Failed to fetch asset by code: ${firstAsset.assetCode}`);
      }
    }
    
  } catch (error) {
    console.log(`❌ App 2 Google Sheets connection failed: ${error.message}`);
  }

  console.log('\n🔧 Slack App Configuration Check:');
  console.log('\n📱 For "Submit for Review" to work:');
  console.log('   1. Go to https://api.slack.com/apps');
  console.log('   2. Select your FIRST app (the one with token ending in tRHqeu8mpnaFjcUk7UdtuXpo)');
  console.log('   3. Go to "Features" → "Global Shortcuts"');
  console.log('   4. Add shortcut:');
  console.log('      - Name: "Submit for Review"');
  console.log('      - Callback ID: submit_for_review');
  console.log('      - Description: "Submit content for review"');
  console.log('   5. Go to "OAuth & Permissions" → "Scopes" → "Bot Token Scopes"');
  console.log('      - Add: chat:write, channels:read, groups:read, im:read, mpim:read');
  console.log('   6. Go to "Socket Mode" → Enable Socket Mode');
  console.log('   7. Go to "Install App" → Install to Workspace');

  console.log('\n📱 For "Request for Resource" to work:');
  console.log('   1. In the SAME app (first app), go to "Features" → "Global Shortcuts"');
  console.log('   2. Add another shortcut:');
  console.log('      - Name: "Request for Resource"');
  console.log('      - Callback ID: request_for_resource');
  console.log('      - Description: "Request resources for assets"');
  console.log('   3. The app should already have the required scopes and Socket Mode enabled');
}

testGoogleSheets().catch(console.error);
