# Google Sheets Integration Setup Guide

This guide will help you set up Google Sheets integration for your Slack Content Review Workflow app.

## Prerequisites

- A Google account
- Access to Google Cloud Console
- Your "Garry Woodford Social Outreach" Google Sheet

## Step 1: Set Up Google Cloud Project

### 1.1 Create a New Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top
3. Click "New Project"
4. Name it something like "Slack Review Workflow"
5. Click "Create"

### 1.2 Enable Google Sheets API
1. In your new project, go to "APIs & Services" > "Library"
2. Search for "Google Sheets API"
3. Click on it and click "Enable"

## Step 2: Create a Service Account

### 2.1 Create Service Account
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Fill in the details:
   - **Service account name**: `slack-review-workflow`
   - **Service account ID**: Will auto-generate
   - **Description**: `Service account for Slack Review Workflow app`
4. Click "Create and Continue"

### 2.2 Grant Permissions
1. For "Role", select "Editor" (or create a custom role with just Sheets permissions)
2. Click "Continue"
3. Click "Done"

### 2.3 Create and Download Key
1. Click on your new service account
2. Go to the "Keys" tab
3. Click "Add Key" > "Create New Key"
4. Choose "JSON" format
5. Click "Create"
6. The JSON file will download automatically

## Step 3: Configure Your Google Sheet

### 3.1 Share the Sheet
1. Open your "Garry Woodford Social Outreach" Google Sheet
2. Click the "Share" button in the top right
3. Add the service account email (found in the JSON file under `client_email`)
4. Give it "Editor" permissions
5. Click "Send" (no need to send notification)

### 3.2 Verify Sheet Structure
Ensure your sheet has these columns in order:
- **A**: S.No.
- **B**: A Code
- **C**: Product
- **D**: Topic
- **E**: Asset Name
- **F**: Platform(s)
- **G**: Status
- **H**: Assigned To
- **I**: ETA
- **J**: Draft Link
- **K**: Feedback/Comments
- **L**: Final Link
- **M**: Last Updated

## Step 4: Configure Your App

### 4.1 Get Sheet ID
1. Open your Google Sheet
2. Copy the ID from the URL: `https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID_HERE/edit`
3. The ID is the long string between `/d/` and `/edit`

### 4.2 Update Environment Variables
1. Open your `.env` file
2. Add these variables:

```env
# Google Sheets Integration
GOOGLE_SHEET_ID=your-sheet-id-here
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}
GOOGLE_SHEET_RANGE=Sheet1!A:M
```

**Important**: The `GOOGLE_SERVICE_ACCOUNT_KEY` should be the entire JSON content from the downloaded file, but as a single line.

### 4.3 Alternative: Use Setup Script
Run the interactive setup:
```bash
npm run setup
```
Choose "y" when asked about Google Sheets integration and follow the prompts.

## Step 5: Test the Integration

### 5.1 Start the App
```bash
npm start
```

You should see:
```
📊 Google Sheets integration enabled
⚡️ Bolt app is running on port 3000
```

### 5.2 Test Auto-Fill
1. Use the "Submit for Review" shortcut in Slack
2. Enter an Asset Code that exists in your sheet with "Draft" status
3. The Topic and Asset Name should auto-fill
4. Submit the form
5. Check that the sheet was updated with:
   - Status changed to "Review"
   - Draft Link added
   - Last Updated timestamp

## Troubleshooting

### Common Issues

#### 1. "Google Sheets integration disabled"
- Check that `GOOGLE_SHEET_ID` and `GOOGLE_SERVICE_ACCOUNT_KEY` are set in `.env`
- Verify the JSON key is properly formatted

#### 2. "Asset code not found"
- Check that the Asset Code exists in your sheet
- Verify the sheet is shared with the service account email
- Check that the column structure matches the expected format

#### 3. "Asset status is not Draft"
- Only assets with "Draft" status can be submitted for review
- Update the status in your sheet to "Draft"

#### 4. "Permission denied"
- Ensure the service account has "Editor" access to the sheet
- Check that the Google Sheets API is enabled in your project

#### 5. "Invalid JSON"
- Make sure the service account key JSON is properly formatted
- Remove any line breaks from the JSON string in `.env`

### Debug Mode

Add this to your `.env` to see detailed logs:
```env
DEBUG=@slack/bolt:*,googleapis:*
```

## Security Best Practices

1. **Never commit your `.env` file** to version control
2. **Rotate service account keys** regularly
3. **Use minimal permissions** - only grant what's necessary
4. **Monitor usage** in Google Cloud Console
5. **Backup your configuration** securely

## Advanced Configuration

### Custom Sheet Range
If your data is in a different range, update `GOOGLE_SHEET_RANGE`:
```env
GOOGLE_SHEET_RANGE=Assets!A:M
```

### Multiple Sheets
You can modify the code to work with multiple sheets by updating the `googleSheets.js` file.

### Custom Status Values
To use different status values, update the validation in `googleSheets.js`:
```javascript
if (asset['Status'] && asset['Status'].trim().toLowerCase() !== 'draft') {
  // Change 'draft' to your desired status
}
```

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review Google Cloud Console logs
3. Check your app logs for detailed error messages
4. Verify all environment variables are set correctly
