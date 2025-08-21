# Slack Content Review Workflow App

A Slack app built with Bolt that streamlines the content review process. This app provides a structured workflow for submitting content for review, tracking approvals, and managing feedback.

## Features

- **Global Shortcut**: "Submit for Review" shortcut accessible from any channel
- **Structured Form**: Collects Asset Code, Topic, Asset Name, Draft Link, and Additional Notes
- **Google Sheets Integration**: Auto-fills form data and updates sheet status
- **Formatted Messages**: Posts beautifully formatted review requests to your target channel
- **Review Workflow**: Approve/Need Changes buttons with threaded responses
- **Feedback Collection**: Modal for collecting detailed feedback when changes are needed
- **Error Handling**: Comprehensive error handling and validation

## Workflow

1. User clicks "Submit for Review" shortcut
2. Modal opens with form fields
3. Upon submission, formatted message is posted to target channel
4. Reviewers can click "Approve" or "Need Changes"
5. Approvals are recorded in thread
6. Change requests open feedback modal and post feedback in thread

## Prerequisites

- Node.js 16+ installed
- A Slack workspace with admin permissions
- A Slack app created at https://api.slack.com/apps

## Setup Instructions

### 1. Create a Slack App

1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Name your app (e.g., "Content Review Workflow")
4. Select your workspace

### 2. Configure App Settings

#### Basic Information
- Note your **Signing Secret** (you'll need this later)

#### Socket Mode
- Enable Socket Mode
- Create an App-Level Token with `connections:write` scope
- Note your **App Token** (starts with `xapp-`)

#### OAuth & Permissions
- Add the following Bot Token Scopes:
  - `chat:write` - Post messages
  - `chat:write.public` - Post to public channels
  - `channels:read` - Read channel information
  - `groups:read` - Read private channels
  - `users:read` - Read user information
- Install the app to your workspace
- Copy the **Bot User OAuth Token** (starts with `xoxb-`)

#### Global Shortcuts
- Go to "Interactivity & Shortcuts"
- Enable Interactivity
- Add a Global Shortcut:
  - Name: "Submit for Review"
  - Callback ID: `submit_for_review_shortcut`
  - Description: "Submit content for review"

#### Event Subscriptions
- Enable Events API
- Subscribe to bot events:
  - `message.channels` (if posting to public channels)
  - `message.groups` (if posting to private channels)

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment

1. Copy the example environment file:
   ```bash
   cp env.example .env
   ```

2. Edit `.env` with your Slack app credentials:
   ```env
   SLACK_BOT_TOKEN=xoxb-your-bot-token-here
   SLACK_SIGNING_SECRET=your-signing-secret-here
   SLACK_APP_TOKEN=xapp-your-app-token-here
   CHANNEL_NAME=production-ems-in8code-gwunspoken
   ```

### 5. Invite Bot to Target Channel

Invite your bot to the target private channel:
```
/invite @YourBotName
```

### 6. Run the App

```bash
npm start
```

The app will start on port 3000 (or the port specified in your `.env` file).

## Usage

### Submitting for Review

1. In any Slack channel, click the lightning bolt icon (⚡️)
2. Select "Submit for Review" from the shortcuts menu
3. Fill out the form:
   - **Asset Code**: Unique identifier (e.g., ASSET-001)
   - **Topic**: Content topic (e.g., Product Launch)
   - **Asset Name**: Descriptive name (e.g., Q1 Product Launch Video)
   - **Draft Link**: URL to the draft content
   - **Additional Notes**: Optional context or notes
4. Click "Submit"

### Reviewing Content

When a review request is posted:

1. **To Approve**: Click the green "Approve" button
   - An approval message will be posted in the thread

2. **To Request Changes**: Click the red "Need Changes" button
   - A feedback modal will open
   - Enter specific, actionable feedback
   - Click "Submit Feedback"
   - Your feedback will be posted in the thread

## Deployment

### Local Development

```bash
npm start
```

### Production Deployment

#### Option 1: Heroku

1. Create a Heroku app
2. Set environment variables in Heroku dashboard
3. Deploy:
   ```bash
   git push heroku main
   ```

#### Option 2: Railway

1. Connect your GitHub repo to Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically on push

#### Option 3: DigitalOcean App Platform

1. Create a new app in DigitalOcean
2. Connect your GitHub repo
3. Set environment variables
4. Deploy

### Environment Variables for Production

Make sure to set these in your deployment platform:

- `SLACK_BOT_TOKEN`
- `SLACK_SIGNING_SECRET`
- `SLACK_APP_TOKEN`
- `CHANNEL_NAME` or `CHANNEL_ID`
- `PORT` (optional, defaults to 3000)

#### Google Sheets Integration (Optional)
- `GOOGLE_SHEET_ID` - Your Google Sheet ID
- `GOOGLE_SERVICE_ACCOUNT_KEY` - Service account JSON key
- `GOOGLE_SHEET_RANGE` - Sheet range (default: Sheet1!A:L)

## Troubleshooting

### Common Issues

1. **"Could not find private channel"**
   - Ensure the bot is invited to the target channel
   - Verify the channel name is correct in `.env`

2. **"Missing required environment variables"**
   - Check that all required variables are set in `.env`
   - Verify the values are correct (no extra spaces)

3. **"Error opening modal"**
   - Ensure the shortcut is properly configured in Slack app settings
   - Check that the callback ID matches exactly

4. **Messages not posting**
   - Verify the bot has the required scopes
   - Check that the bot is invited to the target channel

### Debug Mode

To enable debug logging, add this to your `.env`:

```env
DEBUG=@slack/bolt:*
```

## Customization

### Changing the Target Channel

Update the `CHANNEL_NAME` or `CHANNEL_ID` in your `.env` file.

### Modifying the Message Format

Edit the `textLines` array in the `submit_for_review_modal` handler in `app.js`.

### Adding New Fields

1. Add the field to the modal blocks in the shortcut handler
2. Update the validation function
3. Include the field in the message formatting

## Security Considerations

- Never commit your `.env` file to version control
- Use environment variables for all sensitive data
- Regularly rotate your Slack app tokens
- Monitor app usage and permissions

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review Slack API documentation
3. Check the app logs for error messages

## Google Sheets Integration

For detailed setup instructions, see [GOOGLE_SHEETS_SETUP.md](GOOGLE_SHEETS_SETUP.md).

## License

This project is open source and available under the MIT License.
