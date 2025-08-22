require('dotenv').config();
const GoogleSheetsService = require('./googleSheets');

async function debugSheets() {
  console.log('🔍 Debugging Google Sheets Structure...\n');

  const googleSheets = new GoogleSheetsService();
  
  try {
    await googleSheets.initialize(
      process.env.GOOGLE_SHEET_ID_APP1 || process.env.GOOGLE_SHEET_ID,
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY_APP1 || process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    );
    
    const assets = await googleSheets.getAllAssets();
    console.log(`Found ${assets.length} assets`);
    
    if (assets.length > 0) {
      console.log('\n📋 Column Headers:');
      const firstAsset = assets[0];
      Object.keys(firstAsset).forEach((key, index) => {
        console.log(`   ${index + 1}. "${key}"`);
      });
      
      console.log('\n📋 First Asset Data:');
      Object.entries(firstAsset).forEach(([key, value]) => {
        console.log(`   "${key}": "${value}"`);
      });
      
      console.log('\n🔍 Looking for Asset Code columns...');
      const possibleCodeColumns = Object.keys(firstAsset).filter(key => 
        key.toLowerCase().includes('code') || 
        key.toLowerCase().includes('asset') ||
        key.toLowerCase().includes('id')
      );
      console.log('Possible Asset Code columns:', possibleCodeColumns);
      
      console.log('\n🔍 Looking for Topic columns...');
      const possibleTopicColumns = Object.keys(firstAsset).filter(key => 
        key.toLowerCase().includes('topic') || 
        key.toLowerCase().includes('title') ||
        key.toLowerCase().includes('name')
      );
      console.log('Possible Topic columns:', possibleTopicColumns);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugSheets().catch(console.error);
