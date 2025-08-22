# Resource Request Workflow Deployment Guide

This guide will help you deploy the enhanced multi-app setup with both the **Content Review Workflow** and **Resource Request Workflow**.

## 🎯 Overview

### **App 1: Content Review Workflow**
- **Purpose**: Submit content for review and approval
- **Shortcut**: "Submit for Review"
- **Process**: Submit → Review → Approve/Reject

### **App 2: Resource Request Workflow**
- **Purpose**: Request resources from clients
- **Shortcut**: "Request for Resource"
- **Process**: Request → Upload → Store in Google Drive

## 📋 Prerequisites

1. **Existing App**: Your current Slack app should be working
2. **Second Slack App**: Create a new Slack app for resource requests
3. **Google Drive**: Set up a shared Google Drive folder
4. **Heroku Account**: For deployment

## 🚀 Step-by-Step Setup

### Step 1: Create Second Slack App

1. Go to [Slack API Console](https://api.slack.com/apps)
2. Click "Create New App" → "From scratch"
3. Name: `Resource Request App`
4. Workspace: Select your workspace
5. Click "Create App"

### Step 2: Configure Second Slack App

#### Basic Information
- **Display Name**: Resource Request App
- **Short Description**: Request resources from clients
- **App Icon**: Upload an icon

#### Socket Mode
1. Go to "Socket Mode" in sidebar
2. Enable Socket Mode
3. Generate App-Level Token: `xapp-...`
4. Save the token

#### OAuth & Permissions
1. Go to "OAuth & Permissions"
2. Add Bot Token Scopes:
   - `channels:read`
   - `chat:write`
   - `commands`
   - `files:read`
   - `files:write`
   - `groups:read`
   - `groups:write`
   - `im:write`
   - `mpim:read`
   - `mpim:write`
   - `users:read`
3. Install to Workspace
4. Copy Bot User OAuth Token: `xoxb-...`

#### App Credentials
1. Go to "Basic Information"
2. Copy "Signing Secret"

#### Global Shortcuts
1. Go to "Interactivity & Shortcuts"
2. Click "Create New Shortcut"
3. **Name**: `Request for Resource`
4. **Type**: Global
5. **Callback ID**: `request_for_resource`
6. **Description**: Request resources from clients
7. Save

### Step 3: Set Up Google Drive

#### Create Shared Folder
1. Go to [Google Drive](https://drive.google.com)
2. Create a new folder: "Resource Requests"
3. Right-click → Share → Add people
4. Share with your service account email
5. Copy the folder ID from URL

#### Update Service Account Permissions
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project
3. Go to "APIs & Services" → "Library"
4. Enable "Google Drive API"
5. Go to "IAM & Admin" → "Service Accounts"
6. Add "Drive File Stream" role to your service account

### Step 4: Configure Environment Variables

Create `.env` file with both apps:

```env
# App 1 Configuration (Content Review Workflow)
SLACK_BOT_TOKEN_APP1=xoxb-your-review-app-token
SLACK_SIGNING_SECRET_APP1=your-review-app-secret
SLACK_APP_TOKEN_APP1=xapp-your-review-app-token
CHANNEL_NAME_APP1=production-ems-in8code-gwunspoken
GOOGLE_SHEET_ID_APP1=1nM7YIobuJ33HEvaDLfIijLkT40gRRggLPf8mkUltMyQ
GOOGLE_SERVICE_ACCOUNT_KEY_APP1={"type":"service_account",...}

# App 2 Configuration (Resource Request Workflow)
SLACK_BOT_TOKEN_APP2=xoxb-your-resource-app-token
SLACK_SIGNING_SECRET_APP2=your-resource-app-secret
SLACK_APP_TOKEN_APP2=xapp-your-resource-app-token
CHANNEL_NAME_APP2=your-resource-channel
GOOGLE_SHEET_ID_APP2=your-resource-sheet-id
GOOGLE_SERVICE_ACCOUNT_KEY_APP2={"type":"service_account",...}
GOOGLE_DRIVE_FOLDER_ID_APP2=your-google-drive-folder-id

# Fallback Configuration (for backward compatibility)
SLACK_BOT_TOKEN=xoxb-your-review-app-token
SLACK_SIGNING_SECRET=your-review-app-secret
SLACK_APP_TOKEN=xapp-your-review-app-token
CHANNEL_NAME=production-ems-in8code-gwunspoken
GOOGLE_SHEET_ID=1nM7YIobuJ33HEvaDLfIijLkT40gRRggLPf8mkUltMyQ
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# Shared Configuration
PORT=3000
NODE_ENV=production
```

### Step 5: Update Procfile

Update your `Procfile` to use the enhanced multi-app version:

```procfile
web: node app-multi-enhanced.js
```

### Step 6: Deploy to Heroku

#### Update Existing App

```bash
# Update Procfile
echo "web: node app-multi-enhanced.js" > Procfile

# Set environment variables for both apps
heroku config:set SLACK_BOT_TOKEN_APP1=xoxb-your-review-app-token --app your-app-name
heroku config:set SLACK_SIGNING_SECRET_APP1=your-review-app-secret --app your-app-name
heroku config:set SLACK_APP_TOKEN_APP1=xapp-your-review-app-token --app your-app-name
heroku config:set CHANNEL_NAME_APP1=production-ems-in8code-gwunspoken --app your-app-name
heroku config:set GOOGLE_SHEET_ID_APP1=1nM7YIobuJ33HEvaDLfIijLkT40gRRggLPf8mkUltMyQ --app your-app-name
heroku config:set GOOGLE_SERVICE_ACCOUNT_KEY_APP1='{"type":"service_account",...}' --app your-app-name

heroku config:set SLACK_BOT_TOKEN_APP2=xoxb-your-resource-app-token --app your-app-name
heroku config:set SLACK_SIGNING_SECRET_APP2=your-resource-app-secret --app your-app-name
heroku config:set SLACK_APP_TOKEN_APP2=xapp-your-resource-app-token --app your-app-name
heroku config:set CHANNEL_NAME_APP2=your-resource-channel --app your-app-name
heroku config:set GOOGLE_SHEET_ID_APP2=your-resource-sheet-id --app your-app-name
heroku config:set GOOGLE_SERVICE_ACCOUNT_KEY_APP2='{"type":"service_account",...}' --app your-app-name
heroku config:set GOOGLE_DRIVE_FOLDER_ID_APP2=your-google-drive-folder-id --app your-app-name

# Deploy
git add .
git commit -m "Add resource request workflow"
git push heroku main
```

### Step 7: Install App 2 to Workspace

1. Go to your second Slack app in API Console
2. Click "Install App" → "Install to Workspace"
3. Authorize the app
4. Invite the bot to your target channel: `/invite @ResourceRequestApp`

## 🔧 Testing

### Test App 1 (Content Review)
1. Go to your original channel
2. Use the global shortcut "Submit for Review"
3. Verify it works as before

### Test App 2 (Resource Request)
1. Go to your resource channel
2. Use the global shortcut "Request for Resource"
3. Enter an Asset Code and click "Fetch Details"
4. Select resource type and add comments
5. Submit the request
6. Verify the message is posted to the channel

### Check Logs
```bash
heroku logs --tail --app your-app-name
```

You should see:
```
⚡️ Review Workflow is running with Socket Mode
⚡️ Resource Request is running with Socket Mode
🚀 Express server started on port 9214
📋 Running 2 Slack apps on single dyno
📋 Review Workflow channel: production-ems-in8code-gwunspoken
📋 Resource Request channel: your-resource-channel
📊 Google Sheets integration enabled for Review Workflow
📁 Google Drive integration enabled for Resource Request
```

## 📊 Resource Request Workflow Details

### **Request for Resource Modal:**
- Asset Code (user input)
- Fetch Details button (auto-fills Topic & Asset Name)
- Topic (auto-filled)
- Asset Name (auto-filled)
- Resource Required (dropdown: Video/Image/Document)
- Additional Comments (optional)

### **Posted Message:**
```
REQUEST FOR RESOURCE
Code: GW1
Topic: Product Launch
Asset Name: Q1 Product Launch Video
Resource(s) Required: Video
Notes: Need high-quality video for social media

Garry Woodford - Please provide the requested resource.

[Upload Resource Button]
```

### **Upload Resource Modal:**
- Asset Code (display only)
- Topic (display only)
- Asset Name (display only)
- Upload Files button
- Files uploaded to Google Drive

## 🛠️ Troubleshooting

### App 2 Not Working
1. **Check tokens**: Verify all App 2 tokens are correct
2. **Check permissions**: Ensure App 2 has required scopes (including files:read, files:write)
3. **Check installation**: Make sure App 2 is installed to workspace
4. **Check channel**: Verify App 2 is invited to target channel

### Google Drive Issues
1. **Check folder ID**: Verify Google Drive folder ID is correct
2. **Check permissions**: Ensure service account has access to the folder
3. **Check API**: Verify Google Drive API is enabled

### Environment Variables
```bash
# Check all config vars
heroku config --app your-app-name

# Check specific app vars
heroku config:get SLACK_BOT_TOKEN_APP2 --app your-app-name
heroku config:get GOOGLE_DRIVE_FOLDER_ID_APP2 --app your-app-name
```

## 📝 Next Steps

After deployment, you'll need to:

1. **Add more event handlers** for the resource request workflow
2. **Implement file upload functionality**
3. **Add message posting for resource requests**
4. **Test the complete workflow**

## 🆘 Support

If you encounter issues:

1. Check the logs: `heroku logs --tail`
2. Verify environment variables: `heroku config`
3. Test locally: `npm run dev:multi`
4. Check Slack app configuration in API Console
5. Verify Google Drive permissions
