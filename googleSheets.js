const { google } = require('googleapis');

class GoogleSheetsService {
  constructor() {
    this.sheets = google.sheets({ version: 'v4' });
    this.spreadsheetId = process.env.GOOGLE_SHEET_ID;
    this.range = process.env.GOOGLE_SHEET_RANGE || 'A:Z'; // A:Z covers all columns with a valid range
  }

  /**
   * Initialize Google Sheets authentication
   */
  async initialize() {
    try {
      // For service account authentication
      if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
        const serviceAccountKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        const auth = new google.auth.GoogleAuth({
          credentials: serviceAccountKey,
          scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        this.auth = auth;
      } else {
        throw new Error('Google Service Account Key not found in environment variables');
      }
    } catch (error) {
      console.error('Error initializing Google Sheets:', error);
      throw error;
    }
  }

  /**
   * Get all assets from the sheet
   */
  async getAllAssets() {
    try {
      const auth = await this.auth.getClient();
      const response = await this.sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: this.spreadsheetId,
        range: this.range
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        return [];
      }

      // Parse headers (first row)
      const headers = rows[0];
      const assets = [];

      // Parse data rows (skip header)
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const asset = {};
        
        headers.forEach((header, index) => {
          asset[header.trim()] = row[index] || '';
        });
        
        assets.push(asset);
      }

      return assets;
    } catch (error) {
      console.error('Error fetching assets from Google Sheets:', error);
      throw error;
    }
  }

  /**
   * Get asset by A Code
   */
  async getAssetByCode(assetCode) {
    try {
      const assets = await this.getAllAssets();
      const asset = assets.find(a => 
        a['A Code'] && a['A Code'].toString().trim().toLowerCase() === assetCode.trim().toLowerCase()
      );
      return asset;
    } catch (error) {
      console.error('Error fetching asset by code:', error);
      throw error;
    }
  }

  /**
   * Update asset status and draft link
   */
  async updateAssetStatus(assetCode, draftLink) {
    try {
      const auth = await this.auth.getClient();
      
      // First, find the row number for this asset code
      const response = await this.sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: this.spreadsheetId,
        range: this.range
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        throw new Error('No data found in sheet');
      }

      // Find the row index (A Code is in column B, index 1)
      let rowIndex = -1;
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][1] && rows[i][1].toString().trim().toLowerCase() === assetCode.trim().toLowerCase()) {
          rowIndex = i + 1; // +1 because sheets are 1-indexed
          break;
        }
      }

      if (rowIndex === -1) {
        throw new Error(`Asset with code "${assetCode}" not found`);
      }

      // Update Status (column G, index 6) and Draft Link (column J, index 9)
      const statusRange = `G${rowIndex}`;
      const draftLinkRange = `J${rowIndex}`;
      const lastUpdatedRange = `M${rowIndex}`;

      const now = new Date().toISOString();

      await this.sheets.spreadsheets.values.batchUpdate({
        auth,
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: [
            {
              range: statusRange,
              values: [['Review']]
            },
            {
              range: draftLinkRange,
              values: [[draftLink]]
            },
            {
              range: lastUpdatedRange,
              values: [[now]]
            }
          ]
        }
      });

      return true;
    } catch (error) {
      console.error('Error updating asset status:', error);
      throw error;
    }
  }

  /**
   * Validate if asset code exists and status is Draft
   */
  async validateAssetCode(assetCode) {
    try {
      const asset = await this.getAssetByCode(assetCode);
      if (!asset) {
        return { valid: false, error: 'Asset code not found' };
      }
      
      if (asset['Status'] && asset['Status'].trim().toLowerCase() !== 'draft') {
        return { valid: false, error: `Asset status is "${asset['Status']}", not "Draft"` };
      }
      
      return { valid: true, asset };
    } catch (error) {
      console.error('Error validating asset code:', error);
      return { valid: false, error: 'Error validating asset code' };
    }
  }

  /**
   * Approve an asset - update status to Finalized
   */
  async approveAsset(assetCode) {
    try {
      const auth = await this.auth.getClient();
      
      // First, find the row number for this asset code
      const response = await this.sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: this.spreadsheetId,
        range: this.range
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        throw new Error('No data found in sheet');
      }

      // Find the row index (A Code is in column B, index 1)
      let rowIndex = -1;
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][1] && rows[i][1].toString().trim().toLowerCase() === assetCode.trim().toLowerCase()) {
          rowIndex = i + 1; // +1 because sheets are 1-indexed
          break;
        }
      }

      if (rowIndex === -1) {
        throw new Error(`Asset with code "${assetCode}" not found`);
      }

      // Update Status (column G, index 6) and Last Updated (column M, index 12)
      const statusRange = `G${rowIndex}`;
      const lastUpdatedRange = `M${rowIndex}`;

      const now = new Date().toISOString();

      await this.sheets.spreadsheets.values.batchUpdate({
        auth,
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: [
            {
              range: statusRange,
              values: [['Finalized']]
            },
            {
              range: lastUpdatedRange,
              values: [[now]]
            }
          ]
        }
      });

      return true;
    } catch (error) {
      console.error('Error approving asset:', error);
      throw error;
    }
  }

  /**
   * Reject an asset - update status back to Draft
   */
  async rejectAsset(assetCode) {
    try {
      const auth = await this.auth.getClient();
      
      // First, find the row number for this asset code
      const response = await this.sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: this.spreadsheetId,
        range: this.range
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        throw new Error('No data found in sheet');
      }

      // Find the row index (A Code is in column B, index 1)
      let rowIndex = -1;
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][1] && rows[i][1].toString().trim().toLowerCase() === assetCode.trim().toLowerCase()) {
          rowIndex = i + 1; // +1 because sheets are 1-indexed
          break;
        }
      }

      if (rowIndex === -1) {
        throw new Error(`Asset with code "${assetCode}" not found`);
      }

      // Update Status (column G, index 6) and Last Updated (column M, index 12)
      const statusRange = `G${rowIndex}`;
      const lastUpdatedRange = `M${rowIndex}`;

      const now = new Date().toISOString();

      await this.sheets.spreadsheets.values.batchUpdate({
        auth,
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: [
            {
              range: statusRange,
              values: [['Draft']]
            },
            {
              range: lastUpdatedRange,
              values: [[now]]
            }
          ]
        }
      });

      return true;
    } catch (error) {
      console.error('Error rejecting asset:', error);
      throw error;
    }
  }
}

module.exports = GoogleSheetsService;
