# Slack Content Workflow App

A comprehensive Slack application built with Slack Bolt framework that streamlines content review and resource request workflows with Google Sheets and Google Drive integration.

## 🚀 Features

### Dual Workflow System
- **Submit for Review**: Content review workflow with approval/rejection system
- **Request for Resource**: Resource request workflow with Google Drive integration

### Submit for Review Workflow
- **Global Shortcut**: "Submit for Review" accessible in private channels
- **Smart Form**: Auto-fills Topic and Asset Name from Google Sheets
- **Review Workflow**: Approve/Need Changes buttons with comments
- **Thread Management**: All communications happen in organized threads
- **Status Tracking**: Updates asset status (Draft → Review → Finalized)

### Request for Resource Workflow
- **Global Shortcut**: "Request for Resource" accessible in private channels
- **Smart Form**: Auto-fills Topic and Asset Name from Google Sheets
- **Resource Types**: Dropdown for Video, Image, Document
- **Google Drive Integration**: Direct file upload links to organized folders
- **Thread Management**: All communications happen in organized threads

### Google Integration
- **Google Sheets**: Automatic data fetching and status updates
- **Google Drive**: Organized file storage in type-specific folders
- **Real-time Updates**: Automatic timestamp and status tracking
- **Error Handling**: Graceful fallbacks when services are unavailable

### Enhanced User Experience
- **Pre-filled Forms**: Asset Code auto-population from feedback
- **Validation**: URL validation and required field checking
- **Clean Interface**: No unnecessary confirmation popups
- **Error Recovery**: Comprehensive error handling and user feedback

## 📋 Prerequisites

- Node.js (v16 or higher)
- Slack Workspace with admin permissions
- Google Cloud Project (for Google Sheets and Drive integration)
- Google Service Account (for API access)

## 🛠️ Installation

### 1. Clone the Repository
```bash
git clone https://github.com/hanumendraprm/slack-content-workflow-app.git
cd slack-content-workflow-app
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

### 4. Configure Slack Apps
1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Create two apps or use existing ones:
   - **Submit for Review App**
   - **Request for Resource App**
3. Configure each app with:
   - **Socket Mode**: Enable and get App-Level Token
   - **Bot Token Scopes**: `commands`, `chat:write`, `groups:read`, `files:read`, `files:write`
   - **Global Shortcuts**: Add respective shortcuts
   - **Install App**: Install to your workspace

### 5. Configure Google Services
See [Google Services Setup Guide](GOOGLE_SERVICES_SETUP.md) for detailed instructions.

## 🔧 Configuration

### Environment Variables

```env
# Slack Configuration - Submit for Review
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token

# Slack Configuration - Request for Resource
SLACK_BOT_TOKEN_RFR=xoxb-your-rfr-bot-token
SLACK_SIGNING_SECRET_RFR=your-rfr-signing-secret
SLACK_APP_TOKEN_RFR=xapp-your-rfr-app-token

# Channel Configuration
CHANNEL_NAME=production-ems-in8code-gwunspoken
# OR
CHANNEL_ID=C09ABPWMUEN

# Google Sheets Integration
GOOGLE_SHEET_ID=your-google-sheet-id
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
GOOGLE_SHEET_RANGE=Sheet1!A:Z

# Google Drive Integration
GOOGLE_DRIVE_FOLDER_ID=your-google-drive-folder-id
```

## 🚀 Usage

### Starting the App
```bash
# Development mode
npm run dev

# Production mode
npm start
```

### Submit for Review Workflow
1. **Submit for Review**: Use lightning bolt (⚡️) → "Submit for Review"
2. **Enter Asset Code**: Type asset code (e.g., "GW1", "GW2")
3. **Fetch Details**: Click "Fetch Details" to auto-fill Topic and Asset Name
4. **Add Draft Link**: Enter the draft document URL
5. **Submit**: Form posts to channel with Approve/Need Changes buttons

### Request for Resource Workflow
1. **Request for Resource**: Use lightning bolt (⚡️) → "Request for Resource"
2. **Enter Asset Code**: Type asset code (e.g., "GW1", "GW2")
3. **Fetch Details**: Click "Fetch Details" to auto-fill Topic and Asset Name
4. **Select Resource Type**: Choose Video, Image, or Document
5. **Add Comments**: Enter additional requirements
6. **Submit**: Form posts to channel with Upload Resource button

### Review Workflow
- **Approve**: Opens comments modal → Updates status to "Finalized"
- **Need Changes**: Opens feedback modal → Updates status to "Draft"
- **Submit for Review**: From feedback → Pre-fills form for same asset

### Resource Upload Workflow
- **Upload Resource**: Opens modal with Google Drive upload instructions
- **File Link**: Paste Google Drive file link
- **Thread Reply**: Posts detailed response with file information

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

## 📁 Google Drive Structure

The app organizes uploaded resources in the following structure:
```
Shared Resource Folder/
├── Video/
│   └── [Asset Code]/
├── Image/
│   └── [Asset Code]/
└── Document/
    └── [Asset Code]/
```

## 🏗️ Project Structure

```
slack-content-workflow-app/
├── app-single-instance.js    # Main application file (dual workflows)
├── googleSheets.js           # Google Sheets integration
├── googleDrive.js            # Google Drive integration
├── setup.js                  # Interactive setup script
├── package.json              # Dependencies and scripts
├── env.example               # Environment variables template
├── .gitignore               # Git ignore rules
├── README.md                # This file
├── GOOGLE_SERVICES_SETUP.md # Google services setup guide
├── QUICK_START.md           # Quick setup guide
└── DEPLOYMENT.md            # Deployment instructions
```

## 🚀 Deployment

### Heroku Deployment
```bash
# Create Heroku app
heroku create your-app-name

# Set environment variables
heroku config:set SLACK_BOT_TOKEN=xoxb-your-token
heroku config:set SLACK_SIGNING_SECRET=your-secret
# ... (set all other environment variables)

# Deploy
git push heroku main
```

### Continuous Deployment
The app is configured for automatic deployment from GitHub to Heroku.

## 🔍 Troubleshooting

### Common Issues
1. **"invalid_auth" error**: Check your Slack tokens in environment variables
2. **"missing_scope" error**: Ensure bot has required permissions
3. **Google Sheets not updating**: Verify service account has edit access
4. **Channel not found**: Ensure app is invited to the target channel
5. **Modal not opening**: Check for `invalid_arguments` errors in logs

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
- [Google Drive API](https://developers.google.com/drive/api) for file management
- [Node.js](https://nodejs.org/) for the runtime environment

## 📞 Support

For support and questions:
- Create an issue in this repository
- Check the [troubleshooting section](#troubleshooting)
- Review the [Google Services Setup Guide](GOOGLE_SERVICES_SETUP.md)

---

**Built with ❤️ for streamlined content workflows**

**Last Updated**: August 22, 2025
**Version**: 2.0.0 - Dual Workflow System
