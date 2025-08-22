# Single Slack App Setup Guide

## Overview
We've fixed the multi-app functionality by using a **single Slack app instance** that handles both workflows. This approach eliminates the conflicts that were causing the "Sorry, that hasn't worked" errors.

## What Changed
- **Before**: Two separate Slack app instances trying to run in the same process
- **After**: One Slack app instance handling both workflows with different shortcuts and callbacks

## Slack API Console Configuration

### Step 1: Configure the Main Slack App (App 1)

1. **Go to Slack API Console**: https://api.slack.com/apps
2. **Select your first app** (the original one that was working)
3. **Configure Global Shortcuts**:
   - Go to "Features" → "Global Shortcuts"
   - **Add/Update the first shortcut**:
     - **Name**: "Submit for Review"
     - **Callback ID**: `submit_for_review`
     - **Description**: "Submit content for review"
   - **Add the second shortcut**:
     - **Name**: "Request for Resource"
     - **Callback ID**: `request_for_resource`
     - **Description**: "Request resources for assets"

4. **Check OAuth & Permissions**:
   - Go to "OAuth & Permissions" → "Scopes" → "Bot Token Scopes"
   - Ensure these scopes are added:
     - `chat:write`
     - `channels:read`
     - `groups:read`
     - `im:read`
     - `mpim:read`

5. **Check Socket Mode**:
   - Go to "Socket Mode"
   - Ensure Socket Mode is **enabled**
   - Verify the App-Level Token name is `SLACK_APP_TOKEN` (or `SLACK_APP_TOKEN_APP1`)

6. **Check App Installation**:
   - Go to "Install App"
   - Ensure the app is **installed to workspace**
   - Note the Bot User OAuth Token (should match `SLACK_BOT_TOKEN_APP1`)

### Step 2: Remove or Disable the Second Slack App

Since we're now using a single app for both workflows:

1. **Option A**: Delete the second Slack app entirely
   - Go to https://api.slack.com/apps
   - Select your second app (Request for Resource)
   - Go to "Settings" → "Basic Information"
   - Scroll down and click "Delete App"

2. **Option B**: Keep it but don't use it
   - Just leave it as is, but don't install it to any workspace

## Environment Variables

The app now uses these environment variables:

**Primary App (Handles Both Workflows)**:
- `SLACK_BOT_TOKEN_APP1` - Bot User OAuth Token from App 1
- `SLACK_SIGNING_SECRET_APP1` - Signing Secret from App 1
- `SLACK_APP_TOKEN_APP1` - App-Level Token from App 1

**Review Workflow Configuration**:
- `CHANNEL_NAME_APP1` - Channel for review submissions
- `GOOGLE_SHEET_ID_APP1` - Google Sheet for review workflow
- `GOOGLE_SERVICE_ACCOUNT_KEY_APP1` - Google Service Account for review workflow

**Resource Request Configuration**:
- `CHANNEL_NAME_APP2` - Channel for resource requests
- `GOOGLE_SHEET_ID_APP2` - Google Sheet for resource workflow
- `GOOGLE_SERVICE_ACCOUNT_KEY_APP2` - Google Service Account for resource workflow
- `GOOGLE_DRIVE_FOLDER_ID_APP2` - Google Drive folder for uploads

## How It Works Now

### Single App Architecture
```
┌─────────────────────────────────────┐
│           Single Slack App          │
├─────────────────────────────────────┤
│  Shortcut: submit_for_review        │
│  → Opens Review Modal               │
│  → Posts to Review Channel          │
│  → Updates Review Google Sheet      │
├─────────────────────────────────────┤
│  Shortcut: request_for_resource     │
│  → Opens Resource Modal             │
│  → Posts to Resource Channel        │
│  → Updates Resource Google Sheet    │
│  → Handles Google Drive Uploads     │
└─────────────────────────────────────┘
```

### Benefits of This Approach
1. **No Conflicts**: Single app instance eliminates Socket Mode conflicts
2. **Simpler Configuration**: Only one app to configure in Slack API Console
3. **Better Resource Usage**: Single process, single connection
4. **Easier Maintenance**: One codebase, one deployment

## Testing the Setup

After configuring:

1. **Deploy to Heroku**:
   ```bash
   git add .
   git commit -m "Switch to single app architecture"
   git push heroku main
   ```

2. **Check Logs**:
   ```bash
   heroku logs --app slack-submit-to-verify --tail
   ```

3. **Test in Slack**:
   - Type `/` in any channel
   - You should see both shortcuts:
     - "Submit for Review"
     - "Request for Resource"
   - Try both shortcuts - they should work without errors

## Expected Behavior

### Submit for Review Workflow
1. Click "Submit for Review" shortcut
2. Modal opens with Asset Code, Fetch Details button, Topic, Asset Name, Draft Link, Additional Notes
3. Enter Asset Code and click "Fetch Details" to auto-fill Topic and Asset Name
4. Fill in Draft Link and Additional Notes
5. Submit → Message posted to review channel with Approve/Need Changes buttons

### Request for Resource Workflow
1. Click "Request for Resource" shortcut
2. Modal opens with Asset Code, Fetch Details button, Topic, Asset Name, Resource Type dropdown, Additional Comments
3. Enter Asset Code and click "Fetch Details" to auto-fill Topic and Asset Name
4. Select Resource Type (Video/Image/Document)
5. Add Additional Comments
6. Submit → Message posted to resource channel with Upload Resource button

## Troubleshooting

**If shortcuts still don't work**:
1. Verify both shortcuts are configured in the same Slack app
2. Check that callback IDs match exactly: `submit_for_review` and `request_for_resource`
3. Ensure the app is installed to the workspace
4. Verify Socket Mode is enabled
5. Check that all required scopes are added

**If you get "Sorry, that hasn't worked"**:
1. Check the Heroku logs for errors
2. Verify the environment variables are set correctly
3. Ensure the Google Sheets and Google Drive configurations are correct

This single-app approach should resolve all the multi-app conflicts and provide a stable, working solution for both workflows.
