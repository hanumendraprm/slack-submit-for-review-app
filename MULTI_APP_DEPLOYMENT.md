# Multi-App Slack Deployment Guide

This guide will help you deploy multiple Slack apps in a single Heroku dyno using the **Single Codebase, Multiple Apps** approach.

## 🎯 Overview

- **App 1**: Your current app (uses existing configuration as fallback)
- **App 2**: New app (requires separate Slack app configuration)
- **Single Dyno**: Both apps run in one Heroku dyno
- **Cost Savings**: $7/month vs $14/month for separate dynos

## 📋 Prerequisites

1. **Existing App**: Your current Slack app should be working
2. **Slack API Access**: Ability to create a second Slack app
3. **Heroku Account**: For deployment
4. **Google Sheets**: Optional for App 2

## 🚀 Step-by-Step Setup

### Step 1: Create Second Slack App

1. Go to [Slack API Console](https://api.slack.com/apps)
2. Click "Create New App" → "From scratch"
3. Name: `Your App Name 2`
4. Workspace: Select your workspace
5. Click "Create App"

### Step 2: Configure Second Slack App

#### Basic Information
- **Display Name**: Your App Name 2
- **Short Description**: Second instance of review workflow
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
3. **Name**: `Submit for Review`
4. **Type**: Global
5. **Callback ID**: `submit_for_review`
6. **Description**: Submit content for review
7. Save

### Step 3: Configure Environment Variables

Run the multi-app setup script:

```bash
npm run setup:multi
```

Or manually create `.env` file:

```env
# App 1 Configuration (Your current app)
SLACK_BOT_TOKEN_APP1=xoxb-your-app1-bot-token
SLACK_SIGNING_SECRET_APP1=your-app1-signing-secret
SLACK_APP_TOKEN_APP1=xapp-your-app1-app-token
CHANNEL_NAME_APP1=production-ems-in8code-gwunspoken
GOOGLE_SHEET_ID_APP1=1nM7YIobuJ33HEvaDLfIijLkT40gRRggLPf8mkUltMyQ
GOOGLE_SERVICE_ACCOUNT_KEY_APP1={"type":"service_account",...}

# App 2 Configuration (New app)
SLACK_BOT_TOKEN_APP2=xoxb-your-app2-bot-token
SLACK_SIGNING_SECRET_APP2=your-app2-signing-secret
SLACK_APP_TOKEN_APP2=xapp-your-app2-app-token
CHANNEL_NAME_APP2=your-app2-channel
GOOGLE_SHEET_ID_APP2=your-app2-sheet-id
GOOGLE_SERVICE_ACCOUNT_KEY_APP2={"type":"service_account",...}

# Fallback Configuration (for backward compatibility)
SLACK_BOT_TOKEN=xoxb-your-app1-bot-token
SLACK_SIGNING_SECRET=your-app1-signing-secret
SLACK_APP_TOKEN=xapp-your-app1-app-token
CHANNEL_NAME=production-ems-in8code-gwunspoken
GOOGLE_SHEET_ID=1nM7YIobuJ33HEvaDLfIijLkT40gRRggLPf8mkUltMyQ
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# Shared Configuration
PORT=3000
NODE_ENV=production
```

### Step 4: Update Procfile

Update your `Procfile` to use the multi-app version:

```procfile
web: node app-multi.js
```

### Step 5: Deploy to Heroku

#### Option A: Update Existing App

```bash
# Update Procfile
echo "web: node app-multi.js" > Procfile

# Set environment variables for both apps
heroku config:set SLACK_BOT_TOKEN_APP1=xoxb-your-app1-token --app your-app-name
heroku config:set SLACK_SIGNING_SECRET_APP1=your-app1-secret --app your-app-name
heroku config:set SLACK_APP_TOKEN_APP1=xapp-your-app1-token --app your-app-name
heroku config:set CHANNEL_NAME_APP1=production-ems-in8code-gwunspoken --app your-app-name
heroku config:set GOOGLE_SHEET_ID_APP1=1nM7YIobuJ33HEvaDLfIijLkT40gRRggLPf8mkUltMyQ --app your-app-name
heroku config:set GOOGLE_SERVICE_ACCOUNT_KEY_APP1='{"type":"service_account",...}' --app your-app-name

heroku config:set SLACK_BOT_TOKEN_APP2=xoxb-your-app2-token --app your-app-name
heroku config:set SLACK_SIGNING_SECRET_APP2=your-app2-secret --app your-app-name
heroku config:set SLACK_APP_TOKEN_APP2=xapp-your-app2-token --app your-app-name
heroku config:set CHANNEL_NAME_APP2=your-app2-channel --app your-app-name

# Deploy
git add .
git commit -m "Add multi-app support"
git push heroku main
```

#### Option B: Create New App

```bash
# Create new Heroku app
heroku create your-multi-app-name

# Set environment variables
heroku config:set SLACK_BOT_TOKEN_APP1=xoxb-your-app1-token --app your-multi-app-name
# ... (set all variables as above)

# Deploy
git push heroku main
```

### Step 6: Install App 2 to Workspace

1. Go to your second Slack app in API Console
2. Click "Install App" → "Install to Workspace"
3. Authorize the app
4. Invite the bot to your target channel: `/invite @YourApp2`

## 🔧 Testing

### Test App 1
1. Go to your original channel
2. Use the global shortcut "Submit for Review"
3. Verify it works as before

### Test App 2
1. Go to your second channel
2. Use the global shortcut "Submit for Review"
3. Verify it opens the modal with "(App2)" in the title

### Check Logs
```bash
heroku logs --tail --app your-app-name
```

You should see:
```
⚡️ App1 is running with Socket Mode
⚡️ App2 is running with Socket Mode
🚀 Express server started on port 9214
📋 Running 2 Slack apps on single dyno
📋 App1 channel: production-ems-in8code-gwunspoken
📋 App2 channel: your-app2-channel
```

## 🛠️ Troubleshooting

### App 2 Not Working
1. **Check tokens**: Verify all App 2 tokens are correct
2. **Check permissions**: Ensure App 2 has required scopes
3. **Check installation**: Make sure App 2 is installed to workspace
4. **Check channel**: Verify App 2 is invited to target channel

### Environment Variables
```bash
# Check all config vars
heroku config --app your-app-name

# Check specific app vars
heroku config:get SLACK_BOT_TOKEN_APP2 --app your-app-name
```

### Logs
```bash
# View recent logs
heroku logs --app your-app-name --num 50

# Follow logs in real-time
heroku logs --tail --app your-app-name
```

## 📊 Benefits

- **Cost**: $7/month vs $14/month
- **Management**: Single deployment, single logs
- **Resources**: Shared memory and CPU
- **Scalability**: Easy to add more apps

## 🔄 Adding More Apps

To add a third app:

1. Create App 3 in Slack API Console
2. Add App 3 configuration to `app-multi.js`
3. Add App 3 environment variables
4. Deploy

## 📝 Notes

- Each app needs unique callback IDs
- Each app can have different Google Sheets
- Each app can target different channels
- All apps share the same codebase but run independently

## 🆘 Support

If you encounter issues:

1. Check the logs: `heroku logs --tail`
2. Verify environment variables: `heroku config`
3. Test locally: `npm run dev:multi`
4. Check Slack app configuration in API Console
