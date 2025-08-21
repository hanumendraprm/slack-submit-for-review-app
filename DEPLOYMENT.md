# Deployment Guide

This guide covers deploying your Slack Content Review Workflow app to various platforms.

## Prerequisites

Before deploying, ensure you have:

1. ✅ Created a Slack app at https://api.slack.com/apps
2. ✅ Configured all required scopes and settings
3. ✅ Tested the app locally
4. ✅ Set up your environment variables

## Deployment Options

### Option 1: Heroku (Recommended for beginners)

#### Step 1: Install Heroku CLI
```bash
# macOS
brew install heroku/brew/heroku

# Windows
# Download from https://devcenter.heroku.com/articles/heroku-cli

# Linux
curl https://cli-assets.heroku.com/install.sh | sh
```

#### Step 2: Login to Heroku
```bash
heroku login
```

#### Step 3: Create Heroku App
```bash
heroku create your-app-name
```

#### Step 4: Set Environment Variables
```bash
heroku config:set SLACK_BOT_TOKEN=xoxb-your-bot-token
heroku config:set SLACK_SIGNING_SECRET=your-signing-secret
heroku config:set SLACK_APP_TOKEN=xapp-your-app-token
heroku config:set CHANNEL_NAME=production-ems-in8code-gwunspoken
```

#### Step 5: Deploy
```bash
git add .
git commit -m "Initial deployment"
git push heroku main
```

#### Step 6: Verify Deployment
```bash
heroku logs --tail
```

### Option 2: Railway

#### Step 1: Install Railway CLI
```bash
npm install -g @railway/cli
```

#### Step 2: Login to Railway
```bash
railway login
```

#### Step 3: Initialize Project
```bash
railway init
```

#### Step 4: Set Environment Variables
```bash
railway variables set SLACK_BOT_TOKEN=xoxb-your-bot-token
railway variables set SLACK_SIGNING_SECRET=your-signing-secret
railway variables set SLACK_APP_TOKEN=xapp-your-app-token
railway variables set CHANNEL_NAME=production-ems-in8code-gwunspoken
```

#### Step 5: Deploy
```bash
railway up
```

### Option 3: DigitalOcean App Platform

#### Step 1: Create App
1. Go to https://cloud.digitalocean.com/apps
2. Click "Create App"
3. Connect your GitHub repository
4. Select the repository and branch

#### Step 2: Configure App
- **Build Command**: Leave empty (uses package.json)
- **Run Command**: `npm start`
- **Environment**: Node.js

#### Step 3: Set Environment Variables
Add these in the DigitalOcean dashboard:
- `SLACK_BOT_TOKEN`
- `SLACK_SIGNING_SECRET`
- `SLACK_APP_TOKEN`
- `CHANNEL_NAME`

#### Step 4: Deploy
Click "Create Resources" to deploy.

### Option 4: Render

#### Step 1: Create Web Service
1. Go to https://render.com
2. Click "New Web Service"
3. Connect your GitHub repository

#### Step 2: Configure Service
- **Name**: Your app name
- **Environment**: Node
- **Build Command**: `npm install`
- **Start Command**: `npm start`

#### Step 3: Set Environment Variables
Add all required environment variables in the Render dashboard.

#### Step 4: Deploy
Click "Create Web Service" to deploy.

## Post-Deployment Steps

### 1. Update Slack App Settings

After deployment, update your Slack app settings:

1. Go to https://api.slack.com/apps
2. Select your app
3. Go to "Event Subscriptions"
4. Update the Request URL to your deployment URL (if using HTTP mode)

### 2. Test the App

1. Invite your bot to the target channel
2. Try the "Submit for Review" shortcut
3. Test the approve/need changes workflow

### 3. Monitor Logs

```bash
# Heroku
heroku logs --tail

# Railway
railway logs

# DigitalOcean
# Check in the App Platform dashboard

# Render
# Check in the Render dashboard
```

## Environment Variables Reference

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `SLACK_BOT_TOKEN` | Bot User OAuth Token | Yes | `xoxb-1234567890-...` |
| `SLACK_SIGNING_SECRET` | App Signing Secret | Yes | `abc123def456...` |
| `SLACK_APP_TOKEN` | App-Level Token | Yes | `xapp-A1234567890-...` |
| `CHANNEL_NAME` | Target channel name | Yes* | `production-ems-in8code-gwunspoken` |
| `CHANNEL_ID` | Target channel ID | Yes* | `C1234567890` |
| `PORT` | Server port | No | `3000` |

*Either `CHANNEL_NAME` or `CHANNEL_ID` is required.

## Troubleshooting Deployment

### Common Issues

1. **Build Failures**
   - Check that all dependencies are in `package.json`
   - Verify Node.js version compatibility
   - Check build logs for specific errors

2. **Environment Variables**
   - Ensure all required variables are set
   - Check for typos in variable names
   - Verify values are correct

3. **App Not Responding**
   - Check if the app is running (logs)
   - Verify the port configuration
   - Check for startup errors

4. **Slack Integration Issues**
   - Verify bot token permissions
   - Check that the app is installed to workspace
   - Ensure bot is invited to target channel

### Debug Commands

```bash
# Check app status
heroku ps

# View recent logs
heroku logs --tail

# Restart app
heroku restart

# Check environment variables
heroku config
```

## Scaling Considerations

### For High Traffic

1. **Upgrade Plan**: Consider upgrading to a paid plan for better performance
2. **Load Balancing**: Use multiple instances if needed
3. **Monitoring**: Set up monitoring and alerting
4. **Caching**: Consider adding Redis for caching if needed

### Security Best Practices

1. **Environment Variables**: Never commit sensitive data
2. **Token Rotation**: Regularly rotate Slack tokens
3. **Access Control**: Limit who can deploy and manage the app
4. **Monitoring**: Set up security monitoring

## Cost Optimization

### Free Tier Limits

- **Heroku**: 550-1000 dyno hours/month
- **Railway**: $5 credit/month
- **DigitalOcean**: Free tier available
- **Render**: Free tier available

### Paid Plans

Consider upgrading when you need:
- More reliable uptime
- Better performance
- Custom domains
- Advanced features

## Support

If you encounter issues:

1. Check the troubleshooting section
2. Review platform-specific documentation
3. Check the app logs for errors
4. Verify Slack app configuration
