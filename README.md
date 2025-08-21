# Slack Submit for Review App

A comprehensive Slack application built with Slack Bolt framework that streamlines content review workflows with Google Sheets integration.

## 🚀 Features

### Core Functionality
- **Global Shortcut**: "Submit for Review" accessible in private channels
- **Smart Form**: Auto-fills Topic and Asset Name from Google Sheets
- **Review Workflow**: Approve/Need Changes buttons with comments
- **Thread Management**: All communications happen in organized threads

### Google Sheets Integration
- **Automatic Data Fetching**: Retrieves Topic and Asset Name based on Asset Code
- **Status Tracking**: Updates asset status (Draft → Review → Finalized)
- **Timestamp Updates**: Automatically updates "Last Updated" column
- **Error Handling**: Graceful fallbacks when Google Sheets is unavailable

### Enhanced User Experience
- **Pre-filled Forms**: Asset Code auto-population from feedback
- **Validation**: URL validation and required field checking
- **Ephemeral Messages**: Clean interface with user-only confirmations
- **Error Recovery**: Comprehensive error handling and user feedback

## 📋 Prerequisites

- Node.js (v16 or higher)
- Slack Workspace with admin permissions
- Google Cloud Project (for Google Sheets integration)
- Google Service Account (for API access)

## 🛠️ Installation

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/slack-submit-for-review-app.git
cd slack-submit-for-review-app
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
```bash
# Copy environment template
cp env.example .env

# Run interactive setup
npm run setup
```

### 4. Configure Slack App
1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Create a new app or use existing one
3. Configure the following:
   - **Socket Mode**: Enable and get App-Level Token
   - **Bot Token Scopes**: `commands`, `chat:write`, `groups:read`
   - **Global Shortcuts**: Add "Submit for Review" shortcut
   - **Install App**: Install to your workspace

### 5. Configure Google Sheets (Optional)
See [Google Sheets Setup Guide](GOOGLE_SHEETS_SETUP.md) for detailed instructions.

## 🔧 Configuration

### Environment Variables

```env
# Slack Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token

# Channel Configuration
CHANNEL_NAME=production-ems-in8code-gwunspoken
# OR
CHANNEL_ID=C09ABPWMUEN

# Google Sheets Integration (Optional)
GOOGLE_SHEET_ID=your-google-sheet-id
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
GOOGLE_SHEET_RANGE=Sheet1!A:Z
```

## 🚀 Usage

### Starting the App
```bash
# Development mode
npm run dev

# Production mode
npm start
```

### Using the App
1. **Submit for Review**: Use lightning bolt (⚡️) → "Submit for Review"
2. **Enter Asset Code**: Type asset code (e.g., "GW1", "GW2")
3. **Fetch Details**: Click "Fetch Details" to auto-fill Topic and Asset Name
4. **Add Draft Link**: Enter the draft document URL
5. **Submit**: Form posts to channel with Approve/Need Changes buttons

### Review Workflow
- **Approve**: Opens comments modal → Updates status to "Finalized"
- **Need Changes**: Opens feedback modal → Updates status to "Draft"
- **Submit for Review**: From feedback → Pre-fills form for same asset

## 📊 Google Sheets Structure

The app expects a Google Sheet with the following columns:
- **A**: S.No.
- **B**: A Code (Asset Code)
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

## 🏗️ Project Structure

```
slack-submit-for-review-app/
├── app.js                 # Main application file
├── googleSheets.js        # Google Sheets integration
├── setup.js              # Interactive setup script
├── package.json          # Dependencies and scripts
├── env.example           # Environment variables template
├── .gitignore           # Git ignore rules
├── README.md            # This file
├── GOOGLE_SHEETS_SETUP.md    # Google Sheets setup guide
├── GOOGLE_SHEETS_FEATURES.md # Google Sheets features
├── QUICK_START.md       # Quick setup guide
├── PROJECT_SUMMARY.md   # Project overview
└── DEPLOYMENT.md        # Deployment instructions
```

## 🔍 Troubleshooting

### Common Issues
1. **"invalid_auth" error**: Check your Slack tokens in `.env`
2. **"missing_scope" error**: Ensure bot has required permissions
3. **Google Sheets not updating**: Verify service account has edit access
4. **Channel not found**: Ensure app is invited to the target channel

### Debug Mode
```bash
# Enable debug logging
DEBUG=* npm start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Slack Bolt Framework](https://slack.dev/bolt-js/) for the excellent Slack app framework
- [Google Sheets API](https://developers.google.com/sheets/api) for seamless spreadsheet integration
- [Node.js](https://nodejs.org/) for the runtime environment

## 📞 Support

For support and questions:
- Create an issue in this repository
- Check the [troubleshooting section](#troubleshooting)
- Review the [Google Sheets Setup Guide](GOOGLE_SHEETS_SETUP.md)

---

**Built with ❤️ for streamlined content review workflows**
