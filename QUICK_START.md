# Quick Start Guide

Get your Slack Content Review Workflow app running in 5 minutes!

## 🚀 Quick Setup

### 1. Create Slack App
1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Name: "Content Review Workflow"
4. Select your workspace

### 2. Configure Slack App

#### Enable Socket Mode
- Go to "Socket Mode" → Enable
- Create App-Level Token with `connections:write` scope
- Copy the App Token (starts with `xapp-`)

#### Add Bot Token Scopes
- Go to "OAuth & Permissions"
- Add these scopes:
  - `chat:write`
  - `chat:write.public`
  - `channels:read`
  - `groups:read`
  - `users:read`
- Install app to workspace
- Copy Bot User OAuth Token (starts with `xoxb-`)

#### Create Global Shortcut
- Go to "Interactivity & Shortcuts"
- Enable Interactivity
- Add Global Shortcut:
  - Name: "Submit for Review"
  - Callback ID: `submit_for_review_shortcut`

#### Get Signing Secret
- Go to "Basic Information" → "App Credentials"
- Copy the Signing Secret

### 3. Setup Project

```bash
# Install dependencies
npm install

# Run interactive setup
npm run setup

# Or manually copy and edit env file
npm run setup:manual
```

### 4. Start the App

```bash
npm start
```

### 5. Test in Slack

1. Invite your bot to the target channel: `/invite @YourBotName`
2. Click the lightning bolt (⚡️) in any channel
3. Select "Submit for Review"
4. Fill out the form and submit
5. Check your target channel for the formatted message
6. Test the Approve/Need Changes buttons

## ✅ What You Should See

### Form Fields
- Asset Code (required)
- Topic (required)
- Asset Name (required)
- Draft Link (required, must be URL)
- Additional Notes (optional)

### Posted Message Format
```
DRAFT COMPLETED | READY FOR REVIEW

Code: ASSET-001
Topic: Product Launch
Asset Name: Q1 Product Launch Video
Status: Draft → Ready for Review
Draft Link: https://docs.google.com/...

Notes: _No additional notes_

@garry.woodford - Please review this asset!
Next Action: Garry to review and approve/request changes

:magnifying_glass: Click below to start review:

[Approve] [Need Changes]
```

### Button Actions
- **Approve**: Posts "✅ Approved by @username" in thread
- **Need Changes**: Opens feedback modal, posts feedback in thread

## 🔧 Troubleshooting

### Common Issues

1. **"Could not find private channel"**
   - Make sure bot is invited to the channel
   - Check channel name in .env

2. **Shortcut not appearing**
   - Verify callback ID is exactly `submit_for_review_shortcut`
   - Check that app is installed to workspace

3. **Form validation errors**
   - All required fields must be filled
   - Draft Link must start with http:// or https://

4. **Messages not posting**
   - Check bot has required scopes
   - Verify bot is in target channel

### Debug Mode

Add to your `.env`:
```env
DEBUG=@slack/bolt:*
```

## 📱 Next Steps

1. **Deploy to Production**: See [DEPLOYMENT.md](DEPLOYMENT.md)
2. **Customize**: Modify message format in `app.js`
3. **Add Features**: Extend with additional workflows
4. **Monitor**: Set up logging and monitoring

## 🆘 Need Help?

- Check the full [README.md](README.md) for detailed documentation
- Review [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment
- Check app logs for error messages
- Verify Slack app configuration
